/**
 * IFESS Server — HTTP Handler
 *
 * One Bun server, three request surfaces:
 *
 * 1. Bare REST paths — the wire protocol spoken by IFESS.SuperApp (.NET)
 *    clients (ControlServerClient.cs). BaseUrl points straight at this
 *    server; camelCase JSON, string enums.
 *
 *      POST   /api/clients/register
 *      GET    /api/clients
 *      GET    /api/clients/{id}
 *      GET    /api/clients/{id}/config          PUT same path
 *      POST   /api/clients/{id}/heartbeat
 *      POST   /api/clients/{id}/modules/status  GET same path
 *      GET    /api/module-statuses
 *      POST   /api/clients/{id}/commands
 *      GET    /api/clients/{id}/commands/pending   → {commands:[...]}
 *      POST   /api/clients/{id}/commands/{cmdId}/result
 *      GET    /api/commands
 *      GET    /api/dashboard
 *      POST   /api/query-gateway/validate | dispatch
 *      GET    /api/query-gateway/batches[/{batchId}] | /history | /templates
 *      POST   /api/query-gateway/jobs/{jobId}/result | /chunks
 *      POST   /api/query-gateway/templates          PUT|DELETE /{code}
 *
 * 2. /api/ifess/* aliases + action dispatcher — the surface server_bun.js
 *    exposed; keeps the control UI and gateway-proxied traffic working
 *    unchanged. POST /api/ifess with {action, params} body (X-API-Key).
 *
 * 3. Unified frontend — serves the Module Services/ifess-control UI
 *    directly (app console at /, query console at /simple, /assets/*).
 *
 * Public (no key): /health, /server-info, /api/ifess/health,
 * /api/ifess/server-info. Everything else requires X-API-Key
 * (IFESS_API_KEY or IFESS_CLIENT_API_KEY).
 */

import { resolve as resolvePath } from 'node:path';
import { createRequire } from 'node:module';
import { validateApiKey, unauthorizedResponse } from './auth.js';
import svc from './service.js';
import { serveUi } from './static.js';
import { resolveIdentity } from './lib/authkit/index.js';
import { REPO_ROOT } from './config.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const requireFn = createRequire(import.meta.url);

function json(status, data) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/** Parse a JSON body; null on invalid JSON, {} on empty body. */
async function parseBody(req) {
    try {
        const text = await req.text();
        if (!text) return {};
        return JSON.parse(text);
    } catch {
        return null;
    }
}

/**
 * Browser-facing auth via the module-local authkit copy (src/lib/authkit —
 * copy-per-module rule): gateway-injected x-user-* headers (SSO proxy mode)
 * OR the portal RS256 cookie verified locally against keys/public.pem.
 * Returns the identity payload or null.
 */
function resolvePortalIdentity(req) {
    const headers = {};
    req.headers.forEach((v, k) => { headers[k] = v; });
    const cookie = req.headers.get('cookie');
    return resolveIdentity({ headers, cookie, opts: { keysDir: resolvePath(REPO_ROOT, 'keys') } });
}

/**
 * Unified gate for every protected surface:
 *  - X-API-Key (IFESS_API_KEY / IFESS_CLIENT_API_KEY) → machine clients (.NET SuperApp)
 *  - Portal identity (gateway headers or RS256 cookie) → browser UI users
 */
function isAuthorized(req) {
    if (validateApiKey(req)) return true;
    return resolvePortalIdentity(req) !== null;
}

// ── Action dispatcher (POST /api/ifess {action, params}) ─────────────────────

async function handleActionDispatcher(req) {
    const data = await parseBody(req);
    if (!data || !data.action) {
        return json(400, { error: 'Action is required' });
    }
    const { action, params = {} } = data;

    try {
        switch (action) {
            // Dashboard & clients
            case 'getDashboard':
                return json(200, svc.getDashboardSummary());
            case 'listClients':
                return json(200, svc.listClients());
            case 'getClient': {
                const client = svc.getClient(params.clientId);
                return client ? json(200, client) : json(404, { error: 'Client not found' });
            }
            case 'getClientConfig': {
                const config = svc.getClientConfig(params.clientId);
                return config ? json(200, config) : json(404, { error: 'Config not found' });
            }
            case 'registerClient':
                return json(200, svc.registerClient(params));
            case 'updateClientConfig': {
                const result = svc.updateClientConfig(params.clientId, params.config || params);
                return result.success ? json(200, result) : json(400, result);
            }

            // Heartbeat & module status
            case 'sendHeartbeat':
            case 'receiveHeartbeat': {
                const result = svc.receiveHeartbeat(params.clientId, params);
                return result.success ? json(200, result) : json(404, result);
            }
            case 'getModuleStatuses':
                return json(200, svc.listModuleStatuses(params.clientId));
            case 'reportModuleStatus':
                return json(200, svc.reportModuleStatus(params.clientId, { modules: params.modules || [] }));

            // Commands
            case 'pollCommands':
                return json(200, { commands: svc.pollPendingCommands(params.clientId) });
            case 'listCommands':
                return json(200, svc.listCommands(params.clientId, params.status));
            case 'createCommand': {
                const cmd = svc.createCommand(params.clientId, {
                    commandType: params.commandType,
                    moduleCode: params.moduleCode,
                    payload: params.payload || {},
                });
                return json(200, cmd);
            }
            case 'reportCommandResult': {
                const result = svc.reportCommandResult(params.clientId, params.commandId, {
                    status: params.status,
                    message: params.message,
                });
                return result.success ? json(200, result) : json(404, result);
            }

            // Client groups
            case 'listClientGroups':
                return json(200, svc.listClientGroups());
            case 'getClientGroup': {
                const group = svc.getClientGroup(params.groupCode);
                return group ? json(200, group) : json(404, { error: 'Group not found' });
            }
            case 'createClientGroup': {
                const result = svc.createClientGroup(params);
                return result.success ? json(200, result) : json(400, result);
            }
            case 'updateClientGroup': {
                const result = svc.updateClientGroup(params.groupCode, params);
                return result.success ? json(200, result) : json(404, result);
            }
            case 'deleteClientGroup': {
                const result = svc.deleteClientGroup(params.groupCode);
                return result.success ? json(200, result) : json(404, result);
            }
            case 'addClientToGroup': {
                const result = svc.addClientToGroup(params.groupCode, params.clientId);
                return result.success ? json(200, result) : json(404, result);
            }
            case 'removeClientFromGroup': {
                const result = svc.removeClientFromGroup(params.groupCode, params.clientId);
                return result.success ? json(200, result) : json(404, result);
            }

            // Audit logs
            case 'listAuditLogs':
                return json(200, svc.listAuditLogs(params.filters || {}));

            // Firebird → SQL sync
            case 'listSyncDivisions':
                return json(200, svc.listSyncDivisions());
            case 'syncBootstrap': {
                const job = svc.createSyncJob({
                    clientId: params.clientId || 'bootstrap',
                    divisionCode: params.divisionCode,
                    mode: 'bootstrap',
                    tables: params.tables || [],
                    requestedBy: params.requestedBy,
                });
                svc.updateSyncJob(job.syncJobId, { status: 'running', startedAt: new Date().toISOString() });
                spawnFbMigration(params, job.syncJobId);
                return json(200, job);
            }
            case 'listSyncJobs':
                return json(200, svc.listSyncJobs(params.limit || 50));
            case 'getSyncJob':
                return json(200, svc.getSyncJob(params.syncJobId));

            default:
                return json(400, { error: `Unknown action: ${action}` });
        }
    } catch (e) {
        console.error('[IFESS-SVC] action error:', action, e.message);
        return json(500, { error: e.message });
    }
}

/** Fire-and-forget FB_Migration subprocess for syncBootstrap (mirrors server_bun.js). */
function spawnFbMigration(params, syncJobId) {
    try {
        // createRequire — bare require() breaks under plain Node ESM.
        const { spawn } = requireFn('node:child_process');
        const { resolve } = requireFn('node:path');
        // FB_Migration lives OUTSIDE this repo as a SIBLING of Main Dashboard
        // (`../FB_Migration` from repo root) — the gateway resolves it the
        // same way (server_bun.js ROOT_DIR + '/../FB_Migration').
        const migrate = resolve(REPO_ROOT, '../../FB_Migration/src/migrate.js');
        const args = [
            params.tables && params.tables.length ? 'selected' : 'full',
            '--divisions=' + params.divisionCode,
            ...(params.tables && params.tables.length ? ['--tables=' + params.tables.join(',')] : []),
            ...(params.from ? ['--from=' + params.from] : []),
        ];
        // FB_Migration reads DB credentials via dotenv; propagate them into the
        // subprocess exactly like the gateway does (server_bun.js spawnFbMigration).
        const env = {
            ...process.env,
            DB_NAME: process.env.MSSQL_MIGRATED_DB || 'rebinmas_ifess_migrated',
            DB_SERVER: process.env.MSSQL_HOST || '10.0.0.110',
            DB_PORT: process.env.MSSQL_PORT || '1433',
            DB_USER: process.env.MSSQL_USER || 'sa',
            DB_PASSWORD: process.env.MSSQL_PASSWORD || 'ptrj@123',
        };
        const child = spawn(process.execPath, [migrate, ...args], {
            cwd: migrate.replace(/[/\\]src[/\\]migrate\.js$/, ''),
            env, stdio: ['ignore', 'pipe', 'pipe'],
        });
        let tail = '';
        if (child.stdout) child.stdout.on('data', c => { tail = (tail + c.toString()).slice(-2000); });
        if (child.stderr) child.stderr.on('data', c => { tail = (tail + c.toString()).slice(-2000); });
        child.on('exit', (code) => {
            svc.updateSyncJob(syncJobId, {
                status: code === 0 ? 'success' : 'failed',
                finishedAt: new Date().toISOString(),
                errorMessage: code === 0 ? null : ('FB_Migration exit ' + code + ' | ' + tail.slice(-500)),
            });
        });
        child.on('error', (err) => {
            svc.updateSyncJob(syncJobId, { status: 'failed', finishedAt: new Date().toISOString(), errorMessage: err.message });
        });
    } catch (e) {
        console.error('[IFESS-SVC] spawnFbMigration failed:', e.message);
        svc.updateSyncJob(syncJobId, { status: 'failed', error: e.message });
    }
}

// ── Query Gateway REST (shared by bare + /api/ifess aliases) ─────────────────

async function handleQueryGateway(req, path) {
    const method = req.method;

    if (method === 'POST' && path.endsWith('/validate')) {
        const body = await parseBody(req);
        return json(200, svc.isReadOnlySql(body.queryText));
    }

    if (method === 'POST' && path.endsWith('/dispatch')) {
        const body = await parseBody(req);
        const result = svc.createQueryBatch(body);
        return json(result.success ? 200 : 400, result);
    }

    if (method === 'GET' && /\/batches$/.test(path)) {
        return json(200, svc.listQueryBatches());
    }

    const batchMatch = path.match(/\/batches\/([^/]+)$/);
    if (method === 'GET' && batchMatch) {
        const batch = svc.getQueryBatch(decodeURIComponent(batchMatch[1]));
        return batch ? json(200, batch) : json(404, { error: 'NotFound', message: 'Batch not found' });
    }

    const jobResult = path.match(/\/jobs\/([^/]+)\/result$/);
    if (method === 'POST' && jobResult) {
        const body = await parseBody(req);
        const result = svc.storeQueryJobResult({
            queryJobId: decodeURIComponent(jobResult[1]),
            clientId: body.clientId,
            headers: body.headers,
            rows: body.rows,
            rowCount: body.rowCount,
            isTruncated: body.isTruncated,
            executionTimeMs: body.executionTimeMs,
            status: body.status,
            errorMessage: body.errorMessage,
        });
        return json(result.success ? 200 : 404, result);
    }

    const jobChunk = path.match(/\/jobs\/([^/]+)\/chunks$/);
    if (method === 'POST' && jobChunk) {
        const body = await parseBody(req);
        const result = svc.storeQueryResultChunk({
            queryJobId: decodeURIComponent(jobChunk[1]),
            clientId: body.clientId,
            chunkIndex: body.chunkIndex,
            headers: body.headers,
            rows: body.rows,
            isLastChunk: body.isLastChunk,
        });
        return json(200, result);
    }

    if (method === 'GET' && /\/history$/.test(path)) {
        return json(200, svc.listQueryBatches());
    }

    if (method === 'GET' && /\/templates$/.test(path)) {
        return json(200, svc.listQueryTemplates());
    }

    if (method === 'POST' && /\/templates$/.test(path)) {
        const body = await parseBody(req);
        const result = svc.createQueryTemplate(body);
        return json(result.success ? 200 : 400, result);
    }

    const template = path.match(/\/templates\/([^/]+)$/);
    if (template) {
        const code = decodeURIComponent(template[1]);
        if (method === 'PUT') {
            const body = await parseBody(req);
            const result = svc.updateQueryTemplate(code, body);
            return json(result.success ? 200 : 404, result);
        }
        if (method === 'DELETE') {
            const result = svc.deleteQueryTemplate(code);
            return json(result.success ? 200 : 404, result);
        }
    }

    return null;
}

// ── Main Request Handler ─────────────────────────────────────────────────────

/**
 * @param {Request} req — Bun Request
 * @param {string} path — URL pathname
 * @returns {Promise<Response>} — never null; 404 is produced here
 */
export async function handleRequest(req, path) {
    const method = req.method;

    try {
        // ── CORS preflight ───────────────────────────────────────────────────
        if (method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
                },
            });
        }

        // ── Public endpoints ─────────────────────────────────────────────────
        if (method === 'GET' && path === '/health') {
            return json(200, { status: 'Healthy', serverTime: new Date().toISOString() });
        }
        if (method === 'GET' && path === '/server-info') {
            return json(200, svc.getServerInfo());
        }
        if (method === 'GET' && path === '/api/ifess/health') {
            return json(200, { status: 'Healthy', serverTime: new Date().toISOString() });
        }
        if (method === 'GET' && path === '/api/ifess/server-info') {
            return json(200, svc.getServerInfo());
        }

        // Identity probe for the UI topbar — who am I, and by which channel?
        // Accepts API key too so headless/dev sessions can self-identify.
        if (method === 'GET' && path === '/api/ifess/me') {
            const portal = resolvePortalIdentity(req);
            if (portal) return json(200, { ...portal, authenticated: true });
            const key = req.headers.get('x-api-key');
            if (key && validateApiKey(req)) {
                return json(200, { userId: 'api-key', name: 'API Key Session', email: '', role: 'Service', source: 'api-key', authenticated: true });
            }
            return json(401, { error: 'Unauthorized', message: 'Sign in through the portal or provide X-API-Key.' });
        }

        // ── Unified frontend (portal-authenticated browsers) ─────────────────
        if (method === 'GET') {
            // Gateway proxy forwards the FULL path (/ifess-control, /ifess-control/app,
            // …/simple); direct access uses bare (/ , /app, /simple).
            const bare = path.replace(/^\/ifess-control/, '') || '/';
            const isUiPage = bare === '/' || bare === '/app' || bare === '/app/' ||
                bare === '/simple' || bare === '/simple/';
            const isUiAsset = bare.startsWith('/assets/') || bare.startsWith('/ifess-assets/');
            if (isUiPage || isUiAsset) {
                const user = resolvePortalIdentity(req);
                if (!user) return unauthorizedResponse();
                if (isUiPage) {
                    const rel = bare.startsWith('/simple') ? 'simple/index.html' : 'app/index.html';
                    const ui = serveUi(rel);
                    if (ui) return ui;
                } else {
                    // /assets/x and /ifess-assets/x → ui/assets/x (UI's canonical
                    // asset prefix, also forwarded verbatim by the gateway route)
                    const rel = ('assets/' + bare.replace(/^\/(ifess-)?assets\//, '')).replace(/\/+$/, '');
                    const ui = serveUi(rel);
                    if (ui) return ui;
                }
                return json(404, { error: 'Not Found', path });
            }
        }

        // ── Action dispatcher (protected) ────────────────────────────────────
        if (method === 'POST' && (path === '/api/ifess' || path === '/api/ifess/')) {
            if (!isAuthorized(req)) return unauthorizedResponse();
            return await handleActionDispatcher(req);
        }

        // ── /api/ifess/query-gateway/* aliases (protected) ───────────────────
        if (path.startsWith('/api/ifess/query-gateway/')) {
            if (!isAuthorized(req)) return unauthorizedResponse();
            const qg = await handleQueryGateway(req, path.slice('/api/ifess'.length));
            return qg ?? json(404, { error: 'Not Found', path });
        }

        // ── /api/ifess/sync/* aliases (protected; dispatcher handles the rest of sync) ──
        if (path.startsWith('/api/ifess/sync/')) {
            if (!isAuthorized(req)) return unauthorizedResponse();
        }

        // ── Everything below requires the API key ────────────────────────────
        const isClientApi =
            path.startsWith('/api/clients/') ||
            path === '/api/clients' ||
            path === '/api/module-statuses' ||
            path === '/api/commands' ||
            path === '/api/dashboard' ||
            path.startsWith('/api/query-gateway/') ||
            /^\/api\/sync\/jobs\//.test(path) ||
            path.startsWith('/api/ifess/clients') ||
            path === '/api/ifess/dashboard' ||
            path === '/api/ifess/client-groups' ||
            path === '/api/ifess/audit-logs';

        if (!isClientApi) {
            return json(404, { error: 'Not Found', path });
        }
        if (!isAuthorized(req)) return unauthorizedResponse();

        // ── Query Gateway REST (bare paths) ──────────────────────────────────
        if (path.startsWith('/api/query-gateway/')) {
            const qg = await handleQueryGateway(req, path);
            return qg ?? json(404, { error: 'Not Found', path });
        }

        // ── Sync job status (gateway-compat REST; bootstrap polling) ─────────
        // GET /api/ifess/sync/jobs/:id and /api/sync/jobs/:id
        if (method === 'GET' && /^\/api(?:\/ifess)?\/sync\/jobs\/[^/]+$/.test(path)) {
            const jobId = path.split('/').pop();
            const job = svc.getSyncJob(decodeURIComponent(jobId));
            return job ? json(200, job) : json(404, { error: 'Sync job not found' });
        }

        // ── Dashboard ────────────────────────────────────────────────────────
        if (method === 'GET' && (path === '/api/dashboard' || path === '/api/ifess/dashboard')) {
            return json(200, svc.getDashboardSummary());
        }

        // ── Clients collection ───────────────────────────────────────────────
        if (method === 'GET' && (path === '/api/clients' || path === '/api/ifess/clients' || path === '/api/ifess/clients/')) {
            return json(200, svc.listClients());
        }

        if (method === 'POST' && (path === '/api/clients/register' || path === '/api/ifess/clients/register')) {
            const body = await parseBody(req);
            if (!body) return json(400, { error: 'Invalid JSON body' });
            return json(200, svc.registerClient(body));
        }

        // ── Per-client routes ────────────────────────────────────────────────
        const heartbeat = path.match(/^\/api(?:\/ifess)?\/clients\/([^/]+)\/heartbeat$/);
        if (method === 'POST' && heartbeat) {
            const clientId = decodeURIComponent(heartbeat[1]);
            const body = await parseBody(req);
            if (!body) return json(400, { error: 'Invalid JSON body' });
            const result = svc.receiveHeartbeat(clientId, body);
            return result.success ? json(200, result) : json(404, result);
        }

        const pending = path.match(/^\/api(?:\/ifess)?\/clients\/([^/]+)\/commands\/pending$/);
        if (method === 'GET' && pending) {
            const clientId = decodeURIComponent(pending[1]);
            return json(200, { commands: svc.pollPendingCommands(clientId) });
        }

        const cmdResult = path.match(/^\/api(?:\/ifess)?\/clients\/([^/]+)\/commands\/([^/]+)\/result$/);
        if (method === 'POST' && cmdResult) {
            const clientId = decodeURIComponent(cmdResult[1]);
            const commandId = decodeURIComponent(cmdResult[2]);
            const body = await parseBody(req);
            if (!body) return json(400, { error: 'Invalid JSON body' });
            const result = svc.reportCommandResult(clientId, commandId, body);
            return result.success ? json(200, result) : json(404, result);
        }

        const config = path.match(/^\/api(?:\/ifess)?\/clients\/([^/]+)\/config$/);
        if (config) {
            const clientId = decodeURIComponent(config[1]);
            if (method === 'GET') {
                const clientConfig = svc.getClientConfig(clientId);
                return json(clientConfig ? 200 : 404, clientConfig);
            }
            if (method === 'PUT') {
                const body = await parseBody(req);
                if (!body) return json(400, { error: 'Invalid JSON body' });
                const result = svc.updateClientConfig(clientId, body);
                return result.success ? json(200, result) : json(400, result);
            }
        }

        const modStatus = path.match(/^\/api(?:\/ifess)?\/clients\/([^/]+)\/modules\/status$/);
        if (modStatus) {
            const clientId = decodeURIComponent(modStatus[1]);
            if (method === 'POST') {
                const body = await parseBody(req);
                if (!body) return json(400, { error: 'Invalid JSON body' });
                svc.reportModuleStatus(clientId, { modules: body.modules || [] });
                return json(200, { success: true });
            }
            if (method === 'GET') {
                return json(200, svc.listModuleStatuses(clientId));
            }
        }

        const createCmd = path.match(/^\/api\/clients\/([^/]+)\/commands$/);
        if (method === 'POST' && createCmd) {
            const clientId = decodeURIComponent(createCmd[1]);
            const body = await parseBody(req);
            if (!body) return json(400, { error: 'Invalid JSON body' });
            return json(200, svc.createCommand(clientId, body));
        }

        // ── Module statuses / commands listing (flat) ────────────────────────
        if (method === 'GET' && path === '/api/module-statuses') {
            const clientId = new URL(req.url).searchParams.get('clientId');
            return json(200, svc.listModuleStatuses(clientId));
        }

        if (method === 'GET' && path === '/api/commands') {
            const url = new URL(req.url);
            return json(200, svc.listCommands(url.searchParams.get('clientId'), url.searchParams.get('status')));
        }

        // ── Client groups (alias surface) ────────────────────────────────────
        if (path === '/api/ifess/client-groups') {
            if (method === 'GET') return json(200, svc.listClientGroups());
            if (method === 'POST') {
                const body = await parseBody(req);
                if (!body) return json(400, { error: 'Invalid JSON body' });
                const result = svc.createClientGroup(body);
                return json(result.success ? 200 : 400, result);
            }
        }

        // ── Audit logs (alias surface) ───────────────────────────────────────
        if (method === 'GET' && path === '/api/ifess/audit-logs') {
            return json(200, svc.listAuditLogs());
        }

        // ── Single client lookup ─────────────────────────────────────────────
        const singleClient = path.match(/^\/api\/clients\/([^/]+)$/);
        if (method === 'GET' && singleClient) {
            const client = svc.getClient(decodeURIComponent(singleClient[1]));
            return client ? json(200, client) : json(404, { error: 'NotFound', message: 'Client not found' });
        }

        return json(404, { error: 'Not Found', path });
    } catch (e) {
        console.error('[IFESS-SVC] Unhandled error:', e.message || String(e));
        return json(500, { error: 'Internal server error', message: e.message || String(e) });
    }
}
