/**
 * Firebird Query Service — standalone Bun HTTP server
 * Port: 8004
 *
 * Endpoints:
 *   GET  /health               → {ok: true, service, ts}
 *   GET  /templates             → list templates
 *   POST /templates             → create template
 *   PUT  /templates/:code       → update template
 *   DELETE /templates/:code     → delete template
 *   POST /validate              → read-only SQL validation
 *   POST /exec                  → execute query via isql
 *   GET  /explore               → list all tables + views
 *   GET  /explore/:table        → column schema for a table
 *
 * Proxied by server_bun.js at /api/query-gateway/* (backward compat).
 * Run standalone: bun run src/index.js
 */

import { resolve } from 'node:path';
import { handleRequest, initRoutes } from './routes.js';

// ── Configuration ───────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '8004', 10);
const DATA_DIR = process.env.DATA_DIR
    ? resolve(process.env.DATA_DIR)
    : resolve(import.meta.dir, '../../../data/ifess');
const TEMPLATES_FILE = resolve(DATA_DIR, 'query-templates.json');

// Init routes with the shared templates file (same JSON used by ifess-control-server)
initRoutes(TEMPLATES_FILE);

// ── Bun HTTP Server ────────────────────────────────────────────────────────────
const server = Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);
        const path = url.pathname;

        console.log(`[FirebirdQS] ${req.method} ${path}`);

        // Forward CORS for browser-based clients
        const response = await handleRequest(req, path, url);

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
        headers.set('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers });
        }

        return new Response(response.body, {
            status: response.status,
            headers
        });
    }
});

console.log(`[FirebirdQS] Firebird Query Service running on http://localhost:${PORT}`);
console.log(`[FirebirdQS] Templates: ${TEMPLATES_FILE}`);
console.log(`[FirebirdQS] PID: ${process.pid}`);
