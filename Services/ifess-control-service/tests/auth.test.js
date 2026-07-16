/**
 * PRD Section 11.3: IFESS Control Service - Auth Tests
 * Authorization enforced (401 without valid X-API-Key)
 *
 * Run with: node --test tests/auth.test.js
 * Requires: service running on PORT=8003 (or set IFESS_SERVICE_PORT)
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';

const PORT = parseInt(process.env.IFESS_SERVICE_PORT || process.env.PORT || '8003', 10);
const BASE = 'http://localhost:' + PORT;
const TIMEOUT = 5000;
const VALID_KEY = process.env.IFESS_API_KEY || 'ptrj-rebinmas-air-ruak-parit-gunung-darul';

function request(path, options) {
    options = options || {};
    return new Promise(function(resolve, reject) {
        var headers = { 'Content-Type': 'application/json' };
        if (options.apiKey) headers['X-API-Key'] = options.apiKey;
        var req = http.request(BASE + path, {
            method: options.method || 'GET',
            headers: headers,
            timeout: TIMEOUT,
        }, function(res) {
            var chunks = [];
            res.on('data', function(c) { chunks.push(c); });
            res.on('end', function() {
                var body = Buffer.concat(chunks).toString('utf8');
                var json = null;
                try { json = JSON.parse(body); } catch(e) { /* not JSON */ }
                resolve({ status: res.statusCode, headers: res.headers, body: body, json: json });
            });
        });
        req.on('timeout', function() { req.destroy(); reject(new Error('timeout: ' + path)); });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

describe('IFESS Control Service - Authorization', function() {

    it('GET /health returns 200 without API key', async function() {
        var res = await request('/health');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.json && res.json.status, 'Healthy');
    });

    it('GET /server-info returns 200 without API key', async function() {
        var res = await request('/server-info');
        assert.strictEqual(res.status, 200);
        assert.ok(res.json && res.json.serverUrl);
    });

    it('GET /api/ifess/health returns 200 (public alias)', async function() {
        var res = await request('/api/ifess/health');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.json && res.json.status, 'Healthy');
    });

    it('GET /api/ifess/server-info returns 200 (public alias)', async function() {
        var res = await request('/api/ifess/server-info');
        assert.strictEqual(res.status, 200);
        assert.ok(res.json && res.json.serverUrl);
    });

    it('GET /api/ifess/clients returns 401 without API key', async function() {
        var res = await request('/api/ifess/clients');
        assert.strictEqual(res.status, 401);
    });

    it('POST /api/ifess/clients/register returns 401 without API key', async function() {
        var res = await request('/api/ifess/clients/register', {
            method: 'POST',
            body: JSON.stringify({ clientId: 'test', clientName: 'Test' }),
        });
        assert.strictEqual(res.status, 401);
    });

    it('POST /api/ifess/clients/:id/heartbeat returns 401 without API key', async function() {
        var res = await request('/api/ifess/clients/t1/heartbeat', {
            method: 'POST',
            body: JSON.stringify({ status: 'Online' }),
        });
        assert.strictEqual(res.status, 401);
    });

    it('GET /api/ifess/client-groups returns 401 without API key', async function() {
        var res = await request('/api/ifess/client-groups');
        assert.strictEqual(res.status, 401);
    });

    it('GET /api/ifess/dashboard returns 401 without API key', async function() {
        var res = await request('/api/ifess/dashboard');
        assert.strictEqual(res.status, 401);
    });

    it('GET /api/ifess/clients returns 401 with wrong API key', async function() {
        var res = await request('/api/ifess/clients', { apiKey: 'wrong-key' });
        assert.strictEqual(res.status, 401);
    });

    it('POST /api/ifess/clients/register returns 401 with wrong API key', async function() {
        var res = await request('/api/ifess/clients/register', {
            method: 'POST',
            apiKey: 'wrong-key',
            body: JSON.stringify({ clientId: 'test', clientName: 'Test' }),
        });
        assert.strictEqual(res.status, 401);
    });

    it('GET /api/ifess/clients returns 200 with valid API key', async function() {
        var res = await request('/api/ifess/clients', { apiKey: VALID_KEY });
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.json));
    });

    it('POST /api/ifess/clients/register returns 200 with valid API key', async function() {
        var res = await request('/api/ifess/clients/register', {
            method: 'POST',
            apiKey: VALID_KEY,
            body: JSON.stringify({ clientId: 'auth-test-client', clientName: 'Auth Test' }),
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.json && res.json.success, true);
    });

    it('GET /api/ifess/dashboard returns 200 with valid API key', async function() {
        var res = await request('/api/ifess/dashboard', { apiKey: VALID_KEY });
        assert.strictEqual(res.status, 200);
        assert.ok(res.json && 'totalClients' in res.json);
    });

});
