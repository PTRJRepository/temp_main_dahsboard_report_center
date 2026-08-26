'use strict';

/**
 * Mock IFESS Control Server untuk pengujian client_app tanpa server asli.
 *
 *   node scripts/mock-control-server.mjs [port]
 *   default port 8100
 *
 * Endpoint utama mengikuti kontrak IFESS Control Server js-server:
 *   POST /api/clients/register
 *   POST /api/clients/{id}/heartbeat
 *   GET  /api/clients/{id}/commands/pending
 *   POST /api/clients/{id}/commands/{cid}/result
 *   POST /api/query-gateway/jobs/{jid}/result
 *   POST /api/query-gateway/jobs/{jid}/chunks
 *
 * Endpoint admin (tanpa auth, khusus testing):
 *   POST /admin/command   body = command lengkap {commandId?, commandType, moduleCode?, payload}
 *                         -> diantrikan ke SEMUA client yang poll
 *   POST /admin/notify    body = payload notifikasi {clientId?, title, message, ...}
 *                         -> diantrikan sebagai EXECUTE_SHOW_NOTIFICATION
 *                            (clientId kosong/null = broadcast)
 *   GET  /admin/events    -> daftar event register/heartbeat/result
 */

import http from 'node:http';

const PORT = Number(process.argv[2] || process.env.PORT || 8100);
const API_KEY = 'test-key';

/** @type {Map<string, object[]>} clientId -> pending commands */
const pendingByClient = new Map();
/** @type {object[]} */
const events = [];

function pushEvent(event) {
  const entry = { at: new Date().toISOString(), ...event };
  events.push(entry);
  console.log(`[event] ${JSON.stringify(entry)}`);
}

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function queueCommand(clientId, command) {
  if (!pendingByClient.has(clientId)) pendingByClient.set(clientId, []);
  pendingByClient.get(clientId).push(command);
}

// ============================================================================
// INDEX MAP — segments[] untuk path /api/* (hasil split('/').filter(Boolean))
// ----------------------------------------------------------------------------
// Grep hint: "INDEX MAP" | "segments[" 
//
// /api/clients/register
//   [0]=api            [1]=clients        [2]=register
// /api/clients
//   [0]=api            [1]=clients
// /api/clients/{clientId}
//   [0]=api            [1]=clients        [2]={clientId}
// /api/clients/{clientId}/heartbeat          -> segments[3]==='heartbeat'
//   [0]=api            [1]=clients        [2]={clientId}   [3]=heartbeat
// /api/clients/{clientId}/commands/pending   -> segments[3]==='commands' && segments[4]==='pending'
//   [0]=api            [1]=clients        [2]={clientId}   [3]=commands     [4]=pending
// /api/clients/{clientId}/commands           (POST buat command)
//   [0]=api            [1]=clients        [2]={clientId}   [3]=commands     (length===4)
// /api/clients/{clientId}/commands/{commandId}/result
//   [0]=api            [1]=clients        [2]={clientId}   [3]=commands     [4]={commandId}  [5]=result
// /api/query-gateway/jobs/{queryJobId}/result
//   [0]=api            [1]=query-gateway  [2]=jobs         [3]={queryJobId} [4]=result
// /api/query-gateway/jobs/{queryJobId}/chunks
//   [0]=api            [1]=query-gateway  [2]=jobs         [3]={queryJobId} [4]=chunks
// ============================================================================

const SEG = {
  API: 0,
  CLIENTS: 1,
  CLIENT_ID: 2,
  SUB_ACTION: 3,      // 'heartbeat' | 'commands' | 'config' | 'modules'
  COMMAND_OR_SUB: 4,  // {commandId} | 'pending' | 'result' | ...
  RESULT_TAIL: 5,     // 'result'
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const segments = url.pathname.split('/').filter(Boolean);

    // ── Admin endpoints ────────────────────────────────────────────────────
    if (segments[0] === 'admin') {
      if (req.method === 'POST' && segments[1] === 'command') {
        const body = await readBody(req);
        const command = {
          commandId: body.commandId ?? `CMD-${Date.now()}`,
          clientId: '*',
          commandType: body.commandType,
          moduleCode: body.moduleCode ?? null,
          payload: body.payload ?? {},
          status: 'Pending',
          createdAt: new Date().toISOString(),
        };
        // Broadcast ke semua client yang dikenal; kalau belum ada, simpan global.
        if (pendingByClient.size === 0) queueCommand('*', command);
        else for (const clientId of [...pendingByClient.keys(), ...[body.clientId].filter(Boolean)]) {
          queueCommand(clientId, command);
        }
        return json(res, 200, { success: true, command });
      }
      if (req.method === 'POST' && segments[1] === 'notify') {
        // INDEX MAP admin: /admin/notify -> bungkus payload menjadi command
        // EXECUTE_SHOW_NOTIFICATION lalu antrikan ke satu client atau broadcast.
        const body = await readBody(req);
        const command = {
          commandId: body.commandId ?? `CMD-${Date.now()}`,
          clientId: body.clientId ?? '*',
          commandType: 'EXECUTE_SHOW_NOTIFICATION',
          moduleCode: 'IFESS_PUSH_NOTIFICATION',
          payload: {
            notificationId: body.notificationId ?? `NTF-${Date.now()}`,
            category: body.category,
            priority: body.priority,
            title: body.title,
            message: body.message,
            details: body.details,
            footer: body.footer,
            theme: body.theme,
            expiresAt: body.expiresAt,
            sound: body.sound,
          },
          status: 'Pending',
          createdAt: new Date().toISOString(),
        };
        if (command.clientId !== '*' && command.clientId) {
          queueCommand(command.clientId, command);
        } else if (pendingByClient.size === 0) {
          queueCommand('*', command);
        } else {
          for (const clientId of pendingByClient.keys()) queueCommand(clientId, { ...command });
        }
        pushEvent({ type: 'queuedNotification', clientId: command.clientId, notificationId: command.payload.notificationId, title: command.payload.title });
        return json(res, 200, { success: true, command });
      }
      if (req.method === 'GET' && segments[1] === 'events') {
        return json(res, 200, events);
      }
      if (req.method === 'POST' && segments[1] === 'reset') {
        pendingByClient.clear();
        events.length = 0;
        return json(res, 200, { success: true });
      }
      return json(res, 404, { error: 'NotFound' });
    }

    // ── Contract endpoints (butuh X-API-Key) ───────────────────────────────
    if (req.headers['x-api-key'] !== API_KEY) return json(res, 401, { error: 'Unauthorized' });

    // INDEX MAP: /api/clients/register -> segments.join('/')==='api/clients/register'
    if (req.method === 'POST' && segments[SEG.API] === 'api' && segments.join('/') === 'api/clients/register') {
      const body = await readBody(req);
      pushEvent({ type: 'register', clientId: body.clientId, machineName: body.machineName, os: body.os });
      return json(res, 200, { success: true, serverTime: new Date().toISOString(), configVersion: 1 });
    }

    // INDEX MAP: /api/clients/{clientId}/commands (POST buat command, length===4)
    //   -> setara endpoint server asli yang dipakai aplikasi lain via
    //      scripts/send-notification.mjs (INDEX SENDNOTIF).
    if (req.method === 'POST'
      && segments[SEG.API] === 'api'
      && segments[SEG.CLIENTS] === 'clients'
      && segments[SEG.SUB_ACTION] === 'commands'
      && segments.length === 4) {
      const clientId = segments[SEG.CLIENT_ID];
      const body = await readBody(req);
      const command = {
        commandId: body.commandId ?? `CMD-${Date.now()}`,
        clientId,
        commandType: body.commandType,
        moduleCode: body.moduleCode ?? null,
        payload: body.payload ?? {},
        status: 'Pending',
        createdAt: new Date().toISOString(),
      };
      queueCommand(clientId, command);
      pushEvent({ type: 'queuedCommand', clientId, commandId: command.commandId, commandType: command.commandType });
      return json(res, 200, { success: true, command });
    }

    // INDEX MAP: /api/clients/{clientId}/heartbeat -> segments[3]==='heartbeat'
    if (req.method === 'POST' && segments[SEG.API] === 'api'
      && segments[SEG.CLIENTS] === 'clients'
      && segments[SEG.SUB_ACTION] === 'heartbeat') {
      const body = await readBody(req);
      pushEvent({ type: 'heartbeat', clientId: segments[SEG.CLIENT_ID], uptimeSeconds: body.uptimeSeconds, modules: body.modules?.map(m => `${m.moduleCode}=${m.status}`) });
      return json(res, 200, { success: true, serverTime: new Date().toISOString(), hasPendingCommand: false, latestConfigVersion: 1 });
    }

    // INDEX MAP: /api/clients/{clientId}/commands/pending -> [3]='commands', [4]='pending'
    if (req.method === 'GET' && segments[SEG.API] === 'api'
      && segments[SEG.CLIENTS] === 'clients'
      && segments[SEG.SUB_ACTION] === 'commands'
      && segments[SEG.COMMAND_OR_SUB] === 'pending') {
      const clientId = segments[SEG.CLIENT_ID];
      const wildcard = pendingByClient.get('*') ?? [];
      const mine = pendingByClient.get(clientId) ?? [];
      const commands = [...wildardSafe(wildcard), ...mine];
      pendingByClient.set(clientId, []);
      return json(res, 200, { commands });
    }

    if (req.method === 'POST' && segments[SEG.API] === 'api'
      && segments[SEG.CLIENTS] === 'clients'
      && segments[SEG.SUB_ACTION] === 'commands'
      && segments[SEG.RESULT_TAIL] === 'result') {
      // INDEX MAP: segments[4]={commandId}, segments[5]='result' (lihat INDEX MAP di atas)
      const body = await readBody(req);
      pushEvent({
        type: 'commandResult',
        clientId: segments[SEG.CLIENT_ID],
        commandId: segments[SEG.COMMAND_OR_SUB],
        status: body.status,
        message: body.message,
      });
      return json(res, 200, { success: true });
    }

    // INDEX MAP query-gateway (indeks eksplisit, beda pola dengan /clients/*):
    //   /api/query-gateway/jobs/{queryJobId}/result
    //     [1]=query-gateway  [2]=jobs  [3]={queryJobId}  [4]=result
    //   /api/query-gateway/jobs/{queryJobId}/chunks
    //     [1]=query-gateway  [2]=jobs  [3]={queryJobId}  [4]=chunks
    if (req.method === 'POST' && segments[1] === 'query-gateway' && segments[2] === 'jobs' && segments[4] === 'result') {
      const body = await readBody(req);
      pushEvent({ type: 'queryResult', jobId: segments[3], status: body.status, rowCount: body.rowCount, errorMessage: body.errorMessage ?? null });
      return json(res, 200, { success: true });
    }

    if (req.method === 'POST' && segments[1] === 'query-gateway' && segments[2] === 'jobs' && segments[4] === 'chunks') {
      const body = await readBody(req);
      pushEvent({ type: 'queryChunk', jobId: segments[3], chunkIndex: body.chunkIndex, isLastChunk: body.isLastChunk, rows: (body.rows ?? []).length });
      return json(res, 200, { success: true });
    }

    return json(res, 404, { error: 'NotFound', path: url.pathname });
  } catch (err) {
    return json(res, 500, { error: 'ServerError', message: err.message });
  }
});

// '*' bucket hanya dipakai sebelum client pertama dikenal; tetap aman dikosongkan saat poll.
function wildardSafe(list) {
  return list.splice(0);
}

server.listen(PORT, () => {
  console.log(`Mock IFESS Control Server listening on http://localhost:${PORT}`);
  console.log(`API key: ${API_KEY}`);
});
