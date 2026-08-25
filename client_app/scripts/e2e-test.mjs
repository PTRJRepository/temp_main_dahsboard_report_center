'use strict';

/**
 * End-to-end regression harness untuk client_app.
 *
 * Menjalankan mock control server + client app sungguhan, lalu memverifikasi
 * seluruh siklus protokol lewat endpoint admin mock:
 *
 *   1. register + heartbeat (module status Running)
 *   2. PING                        -> commandResult Success ("pong ...")
 *   3. EXECUTE_AUTO_TASK_KILL KillNow (tanpa target aktif) -> Success, matched=0
 *   4. EXECUTE_FIREBIRD_QUERY INSERT      -> queryResult Rejected + command Failed
 *   5. EXECUTE_FIREBIRD_QUERY SELECT tanpa DB -> queryResult Failed
 *   6. STOP_MODULE / START_MODULE         -> command Success + heartbeat snapshot berubah
 *
 * Jalankan:  npm run test:e2e   (atau: node scripts/e2e-test.mjs)
 * Exit code 0 = semua assertion lolos.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.E2E_PORT || 8199);
const API_KEY = 'test-key';
const CLIENT_ID = 'CLIENT-E2E-01';
// JobId unik per run supaya assertion tidak tertukar dengan envelope lama
// yang mungkin masih tersisa di outbox dari run sebelumnya.
const RUN_TAG = `${Date.now().toString(36)}`;

let mockProcess = null;
let clientProcess = null;
const failures = [];

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.error(`  FAIL  ${label}`);
  }
}

async function fetchJson(pathname, options = {}) {
  const response = await fetch(`http://localhost:${PORT}${pathname}`, {
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
    ...options,
  });
  return response.json();
}

async function waitFor(predicate, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) {
        assert(true, label);
        return true;
      }
    } catch { /* mock belum siap */ }
    await sleep(300);
  }
  assert(false, `${label} (timeout ${timeoutMs}ms)`);
  return false;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendCommand(command) {
  return fetchJson('/admin/command', {
    method: 'POST',
    body: JSON.stringify({ ...command, commandId: command.commandId ?? `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }),
  });
}

async function getEvents() {
  return fetchJson('/admin/events');
}

async function findEvent(predicate) {
  const events = await getEvents();
  return events.find(predicate) ?? null;
}

async function main() {
  // ── Siapkan config sementara untuk client ─────────────────────────────────
  const configPath = path.join(os.tmpdir(), `ifess-e2e-config-${process.pid}.json`);
  fs.writeFileSync(configPath, JSON.stringify({
    controlServer: {
      enabled: true,
      baseUrl: `http://localhost:${PORT}`,
      apiKey: API_KEY,
      clientId: CLIENT_ID,
      clientName: 'E2E Test Client',
      environment: 'Test',
      heartbeatIntervalSeconds: 1,
      commandPollIntervalSeconds: 0.5,
      maxCommandsPerPoll: 20,
      requestTimeoutSeconds: 5,
      inflightCommands: 3,
      retry: { baseDelaySeconds: 0.5, maxDelaySeconds: 3, jitterRatio: 0.1 },
    },
    logging: { rootPath: 'logs', retainDays: 1, console: false },
    modules: [
      {
        Code: 'IFESS_AUTO_TASK_KILL',
        Name: 'IFESS Auto Task Kill',
        Enabled: true,
        AutoStart: true,
        customConfig: {
          defaultTargets: ['definitely-not-running-target'],
          matchMode: 'Exact',
          scheduleCheckIntervalSeconds: 2,
        },
      },
      {
        Code: 'IFESS_QUERY_GATEWAY',
        Name: 'IFESS Query Gateway',
        Enabled: true,
        AutoStart: true,
        customConfig: {
          database: { type: 'Firebird', path: '', username: 'TEST_USER', password: 'test-password' },
          queryPolicy: { maxRows: 100, timeoutSeconds: 10, maxConcurrentQueries: 2, maxQueueSize: 10, chunkSize: 50 },
        },
      },
    ],
  }, null, 2));

  // ── Start mock server + client ────────────────────────────────────────────
  mockProcess = spawn(process.execPath, ['scripts/mock-control-server.mjs', String(PORT)], {
    cwd: BASE_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  mockProcess.stdout.on('data', () => {});
  mockProcess.stderr.on('data', chunk => console.error(`[mock] ${chunk}`));

  await waitFor(async () => !!(await fetchJson('/admin/events')), 'mock server siap');

  clientProcess = spawn(process.execPath, ['src/index.js', '--config', configPath], {
    cwd: BASE_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let clientLog = '';
  clientProcess.stdout.on('data', chunk => { clientLog += chunk; });
  clientProcess.stderr.on('data', chunk => { clientLog += chunk; });

  try {
    // 1. Register + heartbeat dengan kedua modul Running.
    await waitFor(async () => await findEvent(e => e.type === 'register' && e.clientId === CLIENT_ID),
      'client terdaftar di control server');
    await waitFor(async () => {
      const event = await findEvent(e => e.type === 'heartbeat' && e.clientId === CLIENT_ID);
      return event?.modules?.includes('IFESS_AUTO_TASK_KILL=Running')
        && event?.modules?.includes('IFESS_QUERY_GATEWAY=Running');
    }, 'heartbeat menunjukkan kedua modul Running');

    // 2. PING.
    await sendCommand({ commandType: 'PING' });
    await waitFor(async () => {
      const event = await findEvent(e => e.type === 'commandResult' && e.status === 'Success'
        && String(e.message ?? '').startsWith('pong from'));
      return !!event;
    }, 'PING dibalas pong dan result terlapor');

    // 3. Auto Task Kill KillNow (target pasti tidak ada).
    await sendCommand({
      commandType: 'EXECUTE_AUTO_TASK_KILL',
      moduleCode: 'IFESS_AUTO_TASK_KILL',
      payload: { action: 'KillNow', processNames: ['definitely-not-running-target'], matchMode: 'Exact', reason: 'e2e' },
    });
    await waitFor(async () => {
      const event = await findEvent(e => e.type === 'commandResult' && e.status === 'Success'
        && String(e.message ?? '').includes('No running process matched target list.'));
      return !!event;
    }, 'Auto Task Kill KillNow sukses dengan matched=0');

    // 4. Query ditolak validator read-only (INSERT).
    await sendCommand({
      commandType: 'EXECUTE_FIREBIRD_QUERY',
      moduleCode: 'IFESS_QUERY_GATEWAY',
      payload: {
        queryBatchId: `QBAT-E2E-${RUN_TAG}`,
        queryJobId: `QJOB-INSERT-${RUN_TAG}`,
        queryText: 'INSERT INTO COMPANY VALUES (1)',
        parameters: [],
        maxRows: 100,
        timeoutSeconds: 10,
        chunkSize: 50,
        resultMode: 'Inline',
      },
    });
    await waitFor(async () => {
      const event = await findEvent(e => e.type === 'queryResult' && e.jobId === `QJOB-INSERT-${RUN_TAG}`);
      return event?.status === 'Rejected';
    }, 'query INSERT ditolak (Rejected) oleh validator read-only');

    // 5. SELECT valid tapi database tidak dikonfigurasi -> Failed dengan pesan jelas.
    await sendCommand({
      commandType: 'EXECUTE_FIREBIRD_QUERY',
      moduleCode: 'IFESS_QUERY_GATEWAY',
      payload: {
        queryBatchId: `QBAT-E2E-${RUN_TAG}`,
        queryJobId: `QJOB-NODB-${RUN_TAG}`,
        queryText: 'SELECT 1 AS X FROM RDB$DATABASE',
        parameters: [],
        maxRows: 100,
        timeoutSeconds: 10,
        chunkSize: 50,
        resultMode: 'Inline',
      },
    });
    await waitFor(async () => {
      const event = await findEvent(e => e.type === 'queryResult' && e.jobId === `QJOB-NODB-${RUN_TAG}`);
      return event?.status === 'Failed' && /database/i.test(String(event.errorMessage ?? ''));
    }, 'SELECT tanpa konfigurasi DB dilaporkan Failed');

    // 6. STOP_MODULE lalu verifikasi heartbeat snapshot berubah, START kembali.
    await sendCommand({ commandType: 'STOP_MODULE', moduleCode: 'IFESS_AUTO_TASK_KILL' });
    await waitFor(async () => {
      const events = await getEvents();
      const stoppedAck = events.some(e => e.type === 'commandResult' && e.status === 'Success'
        && String(e.message ?? '').includes("Module 'IFESS_AUTO_TASK_KILL' stopped."));
      const heartbeat = [...events].reverse().find(e => e.type === 'heartbeat');
      return stoppedAck && heartbeat?.modules?.includes('IFESS_AUTO_TASK_KILL=Stopped');
    }, 'STOP_MODULE mengubah status modul menjadi Stopped');

    await sendCommand({ commandType: 'START_MODULE', moduleCode: 'IFESS_AUTO_TASK_KILL' });
    await waitFor(async () => {
      const heartbeat = [...(await getEvents())].reverse().find(e => e.type === 'heartbeat');
      return heartbeat?.modules?.includes('IFESS_AUTO_TASK_KILL=Running');
    }, 'START_MODULE mengembalikan modul ke Running');
  } finally {
    // ── Cleanup ─────────────────────────────────────────────────────────────
    clientProcess?.kill();
    mockProcess?.kill();
    fs.rmSync(configPath, { force: true });
  }

  console.log('\n================ E2E SUMMARY ================');
  if (failures.length > 0) {
    console.error(`${failures.length} assertion gagal:`);
    for (const failure of failures) console.error(` - ${failure}`);
    console.error('\n--- client log terakhir ---');
    console.error(clientLog.slice(-2000));
    process.exitCode = 1;
  } else {
    console.log('Semua assertion end-to-end lolos.');
  }
}

main().catch(err => {
  clientProcess?.kill();
  mockProcess?.kill();
  console.error('E2E harness error:', err);
  process.exitCode = 1;
});
