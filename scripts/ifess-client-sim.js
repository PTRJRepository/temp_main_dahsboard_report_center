#!/usr/bin/env node
/**
 * IFESS Client Poller Simulator
 *
 * Mimics what Kerani SuperApp SHOULD do: poll pending commands from the
 * Control Server, execute ExecuteFirebirdQuery commands via isql against the
 * local Firebird DB, then POST the result back.
 *
 * Use this when the .NET SuperApp host is not running its background loops.
 *
 * Usage: node scripts/ifess-client-sim.js
 * Env:  IFESS_API_KEY, IFESS_GATEWAY (default http://localhost:3001)
 *       IFESS_CLIENT_ID (default CLIENT-PTRJ-ARE-A)
 *       IFESS_DB_PATH (default PTRJ_ARA.FDB location)
 *       ISQL_PATH (default Firebird 1.5 isql.exe)
 *       FB_USER / FB_PASS (Firebird credentials)
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const GATEWAY = process.env.IFESS_GATEWAY || 'http://localhost:3001';
const API_KEY = process.env.IFESS_API_KEY || 'ptrj-rebinmas-air-ruak-parit-gunung-darul';
const CLIENT_ID = process.env.IFESS_CLIENT_ID || 'CLIENT-PTRJ-ARE-A';
const ISQL_PATH = process.env.ISQL_PATH || 'C:\\Program Files (x86)\\Firebird\\Firebird_1_5\\bin\\isql.exe';
const FB_USER = process.env.FB_USER || 'PTRJ_IFESS_GATEWAY';
const FB_PASS = process.env.FB_PASS || 'PT@RJ0819';
const DB_PATH = process.env.IFESS_DB_PATH || 'D:\\Gawean Rebinmas\\Monitoring Database\\Database Ifess\\IFESS_ARE_A_15-05-2026\\PTRJ_ARA.FDB';
const POLL_INTERVAL_MS = 100;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function fetchJson(url, opts = {}) {
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, ...opts.headers },
  }).then(async (r) => {
    const text = await r.text();
    try { return JSON.parse(text); } catch { return { _raw: text, _status: r.status }; }
  });
}

// Parse isql tabular output into { headers, rows }
function parseIsqlOutput(output) {
  const lines = output.split(/\r?\n/);
  // Find header line: first line with non-space content that isn't a separator
  // isql format: header row, then "===" separator under each column, then data, then blank line, then "" footer
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '' ) continue;
    if (/^=+$/.test(lines[i].trim())) continue;
    // first content line = header
    headerIdx = i;
    break;
  }
  if (headerIdx < 0) return { headers: [], rows: [] };
  const headerLine = lines[headerIdx];
  const sepLine = lines[headerIdx + 1] || '';
  // Column boundaries from separator === positions
  const cols = [];
  let i = 0;
  while (i < sepLine.length) {
    if (sepLine[i] === '=') {
      const start = i;
      while (i < sepLine.length && sepLine[i] === '=') i++;
      cols.push([start, i]);
    } else i++;
  }
  if (cols.length === 0) {
    // single column fallback
    return { headers: [headerLine.trim()], rows: lines.slice(headerIdx + 2).filter(l => l.trim() && !/^=+$/.test(l.trim()) && l.trim() !== headerLine.trim()).map(l => [l.trim()]) };
  }
  const headers = cols.map(([s, e]) => headerLine.slice(s, e).trim());
  const rows = [];
  for (let j = headerIdx + 2; j < lines.length; j++) {
    const line = lines[j];
    // skip blank lines (isql puts blanks between separator and data)
    if (line.trim() === '') continue;
    // stop at a second separator row or summary footer
    if (/^=+\s*$/.test(line)) break;
    rows.push(cols.map(([s, e]) => line.slice(s, e).trim()));
  }
  return { headers, rows };
}

function executeQuery(queryText, maxRows) {
  const tmpSql = path.join(os.tmpdir(), `ifess_q_${Date.now()}.sql`);
  const tmpOut = path.join(os.tmpdir(), `ifess_o_${Date.now()}.txt`);
  // Firebird FIRST N to limit rows; wrap if not already
  let sql = queryText.trim();
  if (!/^SELECT FIRST/i.test(sql) && maxRows) {
    sql = sql.replace(/^SELECT/i, `SELECT FIRST ${maxRows}`);
  }
  fs.writeFileSync(tmpSql, sql + ';\nquit;\n');
  try {
    const out = execFileSync(ISQL_PATH, [
      `localhost:${DB_PATH}`, '-u', FB_USER, '-p', FB_PASS, '-q', '-i', tmpSql
    ], { encoding: 'utf8', timeout: 30000, maxBuffer: 50 * 1024 * 1024 });
    const parsed = parseIsqlOutput(out);
    return { ok: true, ...parsed, raw: out };
  } catch (e) {
    return { ok: false, error: e.message, raw: e.stdout || '' };
  } finally {
    try { fs.unlinkSync(tmpSql); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

async function pollAndExecute() {
  let pending;
  try {
    pending = await fetchJson(`${GATEWAY}/api/clients/${encodeURIComponent(CLIENT_ID)}/commands/pending?limit=20`);
  } catch (e) {
    log(`Poll failed: ${e.message}`);
    return;
  }
  const commands = pending.commands || [];
  if (commands.length === 0) return;
  log(`Polled ${commands.length} pending command(s)`);

  for (const cmd of commands) {
    if (cmd.commandType !== 'ExecuteFirebirdQuery') {
      // Report other command types as success (not handled by sim)
      await fetchJson(`${GATEWAY}/api/clients/${encodeURIComponent(CLIENT_ID)}/commands/${encodeURIComponent(cmd.commandId)}/result`, {
        method: 'POST',
        body: JSON.stringify({ status: 'Success', message: 'Acknowledged (sim)', executedAt: new Date().toISOString() }),
      });
      continue;
    }

    const payload = cmd.payload || {};
    const queryText = payload.queryText;
    const queryJobId = payload.queryJobId;
    const maxRows = payload.maxRows || 1000;
    log(`Executing query job ${queryJobId}: ${queryText.slice(0, 60)}...`);

    const res = executeQuery(queryText, maxRows);
    if (!res.ok) {
      log(`  query failed: ${res.error}`);
      // Report command result as Failed
      await fetchJson(`${GATEWAY}/api/clients/${encodeURIComponent(CLIENT_ID)}/commands/${encodeURIComponent(cmd.commandId)}/result`, {
        method: 'POST',
        body: JSON.stringify({ status: 'Failed', message: res.error, executedAt: new Date().toISOString() }),
      });
      // Also report query job result as failed
      if (queryJobId) {
        await fetchJson(`${GATEWAY}/api/query-gateway/jobs/${encodeURIComponent(queryJobId)}/result`, {
          method: 'POST',
          body: JSON.stringify({ clientId: CLIENT_ID, status: 'Failed', errorMessage: res.error, executionTimeMs: 0 }),
        });
      }
      continue;
    }

    const rowCount = res.rows.length;
    log(`  query ok: ${rowCount} rows, headers: ${res.headers.join(', ')}`);

    // Report command result Success
    await fetchJson(`${GATEWAY}/api/clients/${encodeURIComponent(CLIENT_ID)}/commands/${encodeURIComponent(cmd.commandId)}/result`, {
      method: 'POST',
      body: JSON.stringify({ status: 'Success', message: `${rowCount} rows`, executedAt: new Date().toISOString() }),
    });

    // Report query job result with rows
    if (queryJobId) {
      await fetchJson(`${GATEWAY}/api/query-gateway/jobs/${encodeURIComponent(queryJobId)}/result`, {
        method: 'POST',
        body: JSON.stringify({
          clientId: CLIENT_ID,
          headers: res.headers,
          rows: res.rows,
          rowCount,
          isTruncated: false,
          executionTimeMs: 100,
          status: 'Success',
        }),
      });
      log(`  posted result for job ${queryJobId}`);
    }
  }
}

async function heartbeat() {
  try {
    await fetch(`${GATEWAY}/api/clients/${encodeURIComponent(CLIENT_ID)}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
      body: JSON.stringify({ status: 'Online', uptimeSeconds: process.uptime() | 0 }),
    });
  } catch {}
}

async function main() {
  log(`IFESS Client Simulator starting`);
  log(`  Gateway: ${GATEWAY}`);
  log(`  Client:  ${CLIENT_ID}`);
  log(`  DB:      ${DB_PATH}`);
  log(`  isql:    ${ISQL_PATH}`);

  // Register first
  await fetchJson(`${GATEWAY}/api/clients/register`, {
    method: 'POST',
    body: JSON.stringify({
      clientId: CLIENT_ID,
      clientName: 'PTRJ ARE A IFESS Client (sim)',
      machineName: os.hostname(),
      environment: 'Production',
      appVersion: '1.0.0-sim',
      os: `${os.type()} ${os.release()}`,
    }),
  });
  log('Registered');

  // Loops
  setInterval(heartbeat, 15000);
  setInterval(pollAndExecute, POLL_INTERVAL_MS);
  // Initial immediate poll
  setTimeout(pollAndExecute, 1000);

  // Keep alive
  setInterval(() => {}, 60000);
  log(`Polling every ${POLL_INTERVAL_MS}ms. Ctrl+C to stop.`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
