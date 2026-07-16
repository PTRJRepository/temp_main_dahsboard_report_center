/**
 * IFESS Control Service — HTTP Handler
 * Ported from server_bun.js handleIFESSApi() and handleFrontendProxy().
 *
 * Endpoints (port 8003):
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
 */

import { validateApiKey, unauthorizedResponse } from './auth.js';
import * as ifessService from './service.js';

function json(status, data) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function getServerTime() {
    return new Date().toISOString();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Safely read and parse JSON body. Returns null on error or disconnect.
 * @param {Request} req
 * @returns {Promise<object|null>}
 */
async function parseBody(req) {
    try {
        const body = await req.arrayBuffer();
        return JSON.parse(new TextDecoder().decode(body));
    } catch {
        return null;
    }
}

// ── Frontend Proxy Action Dispatcher ────────────────────────────────────────────
async function handleFrontendProxy(req) {
    const data = await parseBody(req);
    if (!data) {
        return json(400, { error: 'Action is required' });
    }
    const { action, params = {} } = data;

    if (!action) {
        return json(400, { error: 'Action is required' });
    }

    switch (action) {
        case 'getDashboard':
            return json(200, ifessService.getDashboardSummary());
        case 'listClients':
            return json(200, ifessService.listClients());
        case 'getClient': {
            const client = ifessService.getClient(params.clientId);
            return client ? json(200, client) : json(404, { error: 'Client not found' });
        }
        case 'getClientConfig': {
            const config = ifessService.getClientConfig(params.clientId);
            return config ? json(200, config) : json(404, { error: 'Config not found' });
        }
        case 'registerClient':
            return json(200, ifessService.registerClient(params));
        case 'updateClientConfig': {
            const result = ifessService.updateClientConfig(params.clientId, params.config || params);
            return result.success ? json(200, result) : json(400, result);
        }
        case 'sendHeartbeat':
        case 'receiveHeartbeat': {
            const result = ifessService.receiveHeartbeat(params.clientId, params);
            return result.success ? json(200, result) : json(404, result);
        }
        case 'getModuleStatuses':
            return json(200, ifessService.listModuleStatuses(params.clientId));
        case 'reportModuleStatus':
            return json(200, ifessService.reportModuleStatus(params.clientId, { modules: params.modules || [] }));
        case 'pollCommands':
            return json(200, { commands: ifessService.pollPendingCommands(params.clientId) });
        case 'listCommands':
            return json(200, ifessService.listCommands(params.clientId, params.status));
        case 'createCommand': {
            const cmd = ifessService.createCommand(params.clientId, {
                commandType: params.commandType,
                moduleCode: params.moduleCode,
                payload: params.payload || {}
            });
            return json(200, cmd);
        }
        case 'reportCommandResult': {
            const result = ifessService.reportCommandResult(params.clientId, params.commandId, { status: params.status, message: params.message });
            return result.success ? json(200, result) : json(404, result);
        }
        case 'listClientGroups':
            return json(200, ifessService.listClientGroups());
        case 'getClientGroup': {
            const group = ifessService.getClientGroup(params.groupCode);
            return group ? json(200, group) : json(404, { error: 'Group not found' });
        }
        case 'createClientGroup': {
            const result = ifessService.createClientGroup(params);
            return result.success ? json(200, result) : json(400, result);
        }
        case 'updateClientGroup': {
            const result = ifessService.updateClientGroup(params.groupCode, params);
            return result.success ? json(200, result) : json(404, result);
        }
        case 'deleteClientGroup': {
            const result = ifessService.deleteClientGroup(params.groupCode);
            return result.success ? json(200, result) : json(404, result);
        }
        case 'addClientToGroup': {
            const result = ifessService.addClientToGroup(params.groupCode, params.clientId);
            return result.success ? json(200, result) : json(404, result);
        }
        case 'removeClientFromGroup': {
            const result = ifessService.removeClientFromGroup(params.groupCode, params.clientId);
            return result.success ? json(200, result) : json(404, result);
        }
        case 'listAuditLogs':
            return json(200, ifessService.listAuditLogs(params.filters || {}));
        case 'listSyncDivisions':
            return json(200, ifessService.listSyncDivisions());
        case 'listSyncJobs':
            return json(200, ifessService.listSyncJobs(params.limit || 50));
        case 'getSyncJob':
            return json(200, ifessService.getSyncJob(params.syncJobId));
        default:
            return json(400, { error: `Unknown action: ${action}` });
    }
}

// ── Main Request Handler ─────────────────────────────────────────────────────────
/**
 * @param {Request} req — Bun Request
 * @param {string} path — URL pathname
 * @returns {Promise<Response>}
 */
export async function handleRequest(req, path) {
    const method = req.method;

    try {
        // ── Public endpoints ──────────────────────────────────────────────────

        // GET /health
        if (method === 'GET' && (path === '/health' || path === '/')) {
            return json(200, { status: 'Healthy', serverTime: getServerTime() });
        }

        // GET /server-info
        if (method === 'GET' && path === '/server-info') {
            return json(200, ifessService.getServerInfo());
        }

        // SuperApp compat: /api/ifess/health and /api/ifess/server-info are also public
        if (method === 'GET' && path === '/api/ifess/health') {
            return json(200, { status: 'Healthy', serverTime: getServerTime() });
        }

        if (method === 'GET' && path === '/api/ifess/server-info') {
            return json(200, ifessService.getServerInfo());
        }

        // Frontend proxy action dispatcher (POST / or POST /api/ifess)
        if (method === 'POST' && (path === '/' || path === '/api/ifess')) {
            return await handleFrontendProxy(req);
        }

        // ── Protected endpoints ──────────────────────────────────────────────
        if (!validateApiKey(req)) {
            return unauthorizedResponse();
        }

        // GET /api/ifess/clients
        if (method === 'GET' && (path === '/api/ifess/clients' || path === '/api/ifess/clients/')) {
            return json(200, ifessService.listClients());
        }

        // GET /api/ifess/dashboard
        if (method === 'GET' && path === '/api/ifess/dashboard') {
            return json(200, ifessService.getDashboardSummary());
        }

        // POST /api/ifess/clients/register
        if (method === 'POST' && path === '/api/ifess/clients/register') {
            const data = await parseBody(req);
            if (!data) return json(400, { error: 'Invalid JSON body' });
            return json(200, ifessService.registerClient(data));
        }

        // POST /api/ifess/clients/:id/heartbeat
        if (method === 'POST' && /^\/api\/ifess\/clients\/[^/]+\/heartbeat$/.test(path)) {
            const clientId = path.split('/')[4];
            const data = await parseBody(req);
            if (!data) return json(400, { error: 'Invalid JSON body' });
            const result = ifessService.receiveHeartbeat(clientId, data);
            return result.success ? json(200, result) : json(404, result);
        }

        // GET /api/ifess/clients/:id/commands/pending
        if (method === 'GET' && /^\/api\/ifess\/clients\/[^/]+\/commands\/pending$/.test(path)) {
            const clientId = path.split('/')[4];
            return json(200, { commands: ifessService.pollPendingCommands(clientId) });
        }

        // GET /api/ifess/clients/:id/config
        if (method === 'GET' && /^\/api\/ifess\/clients\/[^/]+\/config$/.test(path)) {
            const clientId = path.split('/')[4];
            const config = ifessService.getClientConfig(clientId);
            return json(config ? 200 : 404, config);
        }

        // POST /api/ifess/clients/:id/commands/:cmdId/result
        if (method === 'POST' && /^\/api\/ifess\/clients\/[^/]+\/commands\/[^/]+\/result$/.test(path)) {
            const parts = path.split('/');
            const clientId = parts[4];
            const commandId = parts[6];
            const data = await parseBody(req);
            if (!data) return json(400, { error: 'Invalid JSON body' });
            const result = ifessService.reportCommandResult(clientId, commandId, data);
            return json(result.success ? 200 : 404, result);
        }

        // GET + POST /api/ifess/client-groups
        if (path === '/api/ifess/client-groups') {
            if (method === 'GET') {
                return json(200, ifessService.listClientGroups());
            }
            if (method === 'POST') {
                const data = await parseBody(req);
                if (!data) return json(400, { error: 'Invalid JSON body' });
                const result = ifessService.createClientGroup(data);
                return json(result.success ? 200 : 400, result);
            }
        }

        // GET /api/ifess/audit-logs
        if (method === 'GET' && path === '/api/ifess/audit-logs') {
            return json(200, ifessService.listAuditLogs());
        }

        // Default: 404
        return json(404, { error: 'Not Found', path });

    } catch (e) {
        // Log unexpected errors but return 500 (do not crash the server)
        console.error('[handler] Unhandled error:', e.message || String(e));
        return json(500, { error: 'Internal server error', message: e.message || String(e) });
    }
}
