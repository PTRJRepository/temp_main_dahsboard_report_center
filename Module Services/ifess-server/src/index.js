/**
 * IFESS Server — Standalone Bun HTTP Server
 *
 * Port: 8012 (default, override with IFESS_PORT)
 *
 * The single control-plane for all IFESS.SuperApp (.NET) clients:
 * registration, heartbeats, command dispatch/polling, module status,
 * client groups, audit logs, and the query-gateway job/chunk pipeline.
 * Also serves the unified ifess-control frontend directly (/, /simple,
 * /assets/*) — no separate UI process.
 *
 * Wire compatibility:
 *   - .NET clients hit bare paths (api/clients/register, ...) with
 *     X-API-Key = IFESS_API_KEY — see ControlServerClient.cs.
 *   - Control UI + gateway-proxied traffic uses POST /api/ifess
 *     {action, params} + /api/ifess/* aliases.
 *   - JSON store is shared with server_bun.js via
 *     Services/ifess-control-server/service.js → data/ifess/*.json.
 *
 * Run standalone:   bun run src/index.js
 * Via module mgr:   node scripts/module.js start ifess-server
 */

import { handleRequest } from './handler.js';
import { PORT } from './config.js';
import { getMaskedApiKey } from './auth.js';

const server = Bun.serve({
    port: PORT,
    hostname: '0.0.0.0', // reachable from LAN clients, like the .NET server was
    async fetch(req) {
        const url = new URL(req.url);
        const path = url.pathname;

        try {
            const response = await handleRequest(req, path);

            // CORS on every API response; static files set their own headers.
            const headers = new Headers(response.headers);
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers,
            });
        } catch (err) {
            console.error('[IFESS-SRV] Unhandled error:', err.message || err);
            return new Response(JSON.stringify({ error: 'Internal error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    },
});

// Stuck-command reaper — mirrors the .NET server's background cleanup.
import svc from './service.js';
setInterval(() => {
    try {
        svc.reapStaleCommands();
    } catch (e) {
        console.error('[IFESS-SRV] reapStaleCommands failed:', e.message);
    }
}, 60_000).unref();

console.log(`[IFESS-SRV] IFESS Server running on http://localhost:${PORT} (LAN: 0.0.0.0:${PORT})`);
console.log(`[IFESS-SRV] PID: ${process.pid}`);
console.log(`[IFESS-SRV] API key auth: enabled (${getMaskedApiKey()})`);
console.log(`[IFESS-SRV] Unified UI: /  |  Query console: /simple`);

export default server;
