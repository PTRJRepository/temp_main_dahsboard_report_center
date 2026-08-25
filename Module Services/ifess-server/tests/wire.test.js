/**
 * IFESS Server — Wire Compatibility Tests
 *
 * Exercises handleRequest() directly against the real service layer.
 * Covers auth gating, the .NET SuperApp wire protocol, the legacy
 * /api/ifess dispatcher, and the unified frontend routes.
 */

import { describe, test, expect } from 'bun:test';
import { handleRequest } from '../src/handler.js';

const KEY = process.env.IFESS_API_KEY || 'ptrj-rebinmas-air-ruak-parit-gunung-darul';

function req(method, path, body, headers = {}) {
    const h = { 'X-API-Key': KEY, ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    return new Request(`http://localhost:8012${path}`, {
        method,
        headers: h,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

async function call(method, path, body, headers) {
    const res = await handleRequest(req(method, path, body, headers), new URL(`http://x${path}`).pathname);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* html or empty */ }
    return { status: res.status, data, text };
}

// ── Public surface ───────────────────────────────────────────────────────

describe('public endpoints', () => {
    test('GET /health returns Healthy', async () => {
        const r = await call('GET', '/health');
        expect(r.status).toBe(200);
        expect(r.data.status).toBe('Healthy');
        expect(r.data.serverTime).toBeTruthy();
    });

    test('GET /server-info without key', async () => {
        const r = await call('GET', '/server-info', undefined, {});
        expect(r.status).toBe(200);
    });
});

// ── Auth gating ──────────────────────────────────────────────────────────

describe('auth', () => {
    test('wrong key on /api/clients → 401', async () => {
        const r = await call('GET', '/api/clients', undefined, { 'X-API-Key': 'wrong-key-123' });
        expect(r.status).toBe(401);
        expect(r.data.error).toBe('Unauthorized');
    });

    test('UI page without portal identity → 401', async () => {
        const r = await call('GET', '/', undefined, {});
        expect(r.status).toBe(401);
    });

    test('UI asset without portal identity → 401', async () => {
        const r = await call('GET', '/ifess-assets/css/theme.css?v=3', undefined, {});
        expect(r.status).toBe(401);
    });
});

// ── .NET wire protocol ───────────────────────────────────────────────────

describe('.NET wire protocol', () => {
    const CID = `TEST-${Date.now().toString(36)}`;

    test('register client (bare path)', async () => {
        const r = await call('POST', '/api/clients/register', {
            clientId: CID,
            clientName: 'Wire Test Client',
            machineName: 'WIRE-BOX',
            environment: 'Test',
            appVersion: '1.0.0',
            os: 'Win11',
        });
        expect(r.status).toBe(200);
        expect(r.data.success).toBe(true);
        expect(r.data.serverTime).toBeTruthy();
    });

    test('heartbeat returns hasPendingCommand', async () => {
        const r = await call('POST', `/api/clients/${CID}/heartbeat`, {
            timestamp: new Date().toISOString(),
            status: 'Online',
            uptimeSeconds: 120,
            modules: [],
        });
        expect(r.status).toBe(200);
        expect(r.data.success).toBe(true);
        expect(r.data.hasPendingCommand).toBeDefined();
    });

    test('pending commands wrapped in {commands:[...]}', async () => {
        const r = await call('GET', `/api/clients/${CID}/commands/pending`);
        expect(r.status).toBe(200);
        expect(Array.isArray(r.data.commands)).toBe(true);
    });

    test('module status post + get', async () => {
        const post = await call('POST', `/api/clients/${CID}/modules/status`, {
            modules: [{ moduleCode: 'IFESS_QUERY_GATEWAY', status: 'Running', pid: 999 }],
        });
        expect(post.status).toBe(200);
        const list = await call('GET', `/api/clients/${CID}/modules/status`);
        expect(list.status).toBe(200);
        expect(Array.isArray(list.data)).toBe(true);
    });

    test('command create → poll → result lifecycle', async () => {
        const created = await call('POST', `/api/clients/${CID}/commands`, {
            commandType: 'RestartModule',
            moduleCode: 'IFESS_AUTO_TASK_KILL',
            payload: { reason: 'wire-test' },
        });
        expect(created.status).toBe(200);

        const done = await call('POST',
            `/api/clients/${CID}/commands/${created.data.commandId}/result`,
            { status: 'Completed', message: 'ok', executedAt: new Date().toISOString() });
        expect(done.status).toBe(200);
        expect(done.data.success).toBe(true);
    });

    test('dashboard summary camelCase', async () => {
        const r = await call('GET', '/api/dashboard');
        expect(r.status).toBe(200);
        expect(r.data.totalClients).toBeDefined();
    });

    test('query validate endpoint', async () => {
        const r = await call('POST', '/api/query-gateway/validate',
            { queryText: 'SELECT 1 FROM RDB$DATABASE' });
        expect(r.status).toBe(200);
    });
});

// ── Legacy alias surface ─────────────────────────────────────────────────

describe('/api/ifess aliases', () => {
    test('dispatcher getDashboard', async () => {
        const r = await call('POST', '/api/ifess', { action: 'getDashboard', params: {} });
        expect(r.status).toBe(200);
        expect(r.data.totalClients).toBeDefined();
    });

    test('GET /api/ifess/clients', async () => {
        const r = await call('GET', '/api/ifess/clients');
        expect(r.status).toBe(200);
    });
});
