/**
 * IFESS Control Service — Standalone Bun HTTP Server
 *
 * Port: 8003 (default)
 * Extracted from server_bun.js handleIFESSApi() + handleFrontendProxy().
 *
 * Endpoints:
 *   Public:
 *     GET  /health               → {status, serverTime}
 *     GET  /server-info           → server config
 *     POST /                      → action dispatcher (frontend proxy format)
 *     GET  /api/ifess/health      → public alias
 *     GET  /api/ifess/server-info → public alias
 *   Protected (X-API-Key):
 *     GET    /api/ifess/clients
 *     POST   /api/ifess/clients/register
 *     POST   /api/ifess/clients/:id/heartbeat
 *     GET    /api/ifess/clients/:id/commands/pending
 *     GET    /api/ifess/clients/:id/config
 *     POST   /api/ifess/clients/:id/commands/:cmdId/result
 *     GET    /api/ifess/client-groups
 *     POST   /api/ifess/client-groups
 *     GET    /api/ifess/audit-logs
 *     GET    /api/ifess/dashboard
 *
 * Backward compat: server_bun.js proxies /api/ifess/* → localhost:8003.
 *
 * Run standalone:
 *   bun run src/index.js
 *   IFESS_API_KEY=... bun run src/index.js
 */

import { handleRequest } from './handler.js';

// ── Configuration ────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '8003', 10);

// ── Bun HTTP Server ─────────────────────────────────────────────────────────────
const server = Bun.serve({
    port: PORT,
    fetch(req) {
        const url = new URL(req.url);
        const path = url.pathname;

        console.log(`[IFESS-SVC] ${req.method} ${path}`);

        return handleRequest(req, path).then(response => {
            if (response === null) {
                return new Response(JSON.stringify({ error: 'Not Found', path }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Apply CORS headers
            const headers = new Headers(response.headers);
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

            if (req.method === 'OPTIONS') {
                return new Response(null, { status: 204, headers });
            }

            return new Response(response.body, {
                status: response.status,
                headers
            });
        }).catch(err => {
            console.error('[IFESS-SVC] Unhandled error:', err.message);
            return new Response(JSON.stringify({ error: 'Internal error' }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        });
    }
});

console.log(`[IFESS-SVC] IFESS Control Service running on http://localhost:${PORT}`);
console.log(`[IFESS-SVC] PID: ${process.pid}`);
console.log(`[IFESS-SVC] API Key auth: ${process.env.IFESS_API_KEY ? 'enabled' : 'using default'}`);
