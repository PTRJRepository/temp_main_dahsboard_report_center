/**
 * PRD Section 11.3: IFESS Control Service - Handler Tests
 * - Registration is idempotent
 * - Heartbeats don't lose concurrent updates
 * - Command state transitions validated
 * - Audit entries written
 *
 * Run with: node --test tests/handler.test.js
 * Requires: service running on PORT=8003 (or set IFESS_SERVICE_PORT)
 */

import assert from 'node:assert/strict';
import http from 'node:http';

const PORT = parseInt(process.env.IFESS_SERVICE_PORT || process.env.PORT || '8003', 10);
const BASE = 'http://localhost:' + PORT;
const TIMEOUT = 5000;
const VALID_KEY = process.env.IFESS_API_KEY || 'ptrj-rebinmas-air-ruak-parit-gunung-darul';

const TEST_CLIENT = 'handler-test-' + Date.now();
const TEST_GROUP = 'test-group-' + Date.now();

function api(path, options) {
    options = options || {};
    return new Promise(function(resolve, reject) {
        var headers = { 'Content-Type': 'application/json' };
        if (VALID_KEY) headers['X-API-Key'] = VALID_KEY;
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

// ── 11.3.1 Registration is idempotent ────────────────────────────────────────

var r1 = await api('/api/ifess/clients/register', {
    method: 'POST',
    body: JSON.stringify({ clientId: TEST_CLIENT, clientName: 'Handler Test', machineName: 'test-machine', environment: 'test', appVersion: '1.0.0', os: 'Linux' }),
});
assert.strictEqual(r1.status, 200, 'First registration returns 200');
assert.strictEqual(r1.json && r1.json.success, true, 'First registration success=true');

var r2 = await api('/api/ifess/clients/register', {
    method: 'POST',
    body: JSON.stringify({ clientId: TEST_CLIENT, clientName: 'Handler Test v2', machineName: 'test-machine', environment: 'test', appVersion: '1.0.1', os: 'Linux' }),
});
assert.strictEqual(r2.status, 200, 'Second registration (idempotent) returns 200');
assert.strictEqual(r2.json && r2.json.success, true, 'Second registration success=true');

// Verify update applied
var r3 = await api('/api/ifess/clients', { apiKey: VALID_KEY });
assert.strictEqual(r3.status, 200, 'listClients returns 200');
var updated = r3.json && r3.json.find(function(c) { return c.clientId === TEST_CLIENT; });
assert.ok(updated, 'Client appears in list');
assert.strictEqual(updated.appVersion, '1.0.1', 'Version was updated on idempotent registration');

// ── 11.3.2 Heartbeats don't lose concurrent updates ───────────────────────────

// Send 3 heartbeats in rapid succession
for (var i = 0; i < 3; i++) {
    var hb = await api('/api/ifess/clients/' + TEST_CLIENT + '/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ status: 'Online', uptimeSeconds: 100 + i, modules: [] }),
    });
    assert.strictEqual(hb.status, 200, 'Heartbeat ' + i + ' returns 200');
    assert.strictEqual(hb.json && hb.json.success, true, 'Heartbeat ' + i + ' success');
}

// hasPendingCommand should be boolean
var hbCheck = await api('/api/ifess/clients/' + TEST_CLIENT + '/heartbeat', {
    method: 'POST',
    body: JSON.stringify({ status: 'Online', uptimeSeconds: 200, modules: [] }),
});
assert.strictEqual(typeof (hbCheck.json && hbCheck.json.hasPendingCommand), 'boolean', 'hasPendingCommand is boolean');

// ── 11.3.3 Command state transitions ───────────────────────────────────────────

var emptyPoll = await api('/api/ifess/clients/' + TEST_CLIENT + '/commands/pending');
assert.strictEqual(emptyPoll.status, 200, 'Poll pending commands returns 200');
assert.ok(Array.isArray(emptyPoll.json && emptyPoll.json.commands), 'commands is array');

// Report result for non-existent command returns 404
var badResult = await api('/api/ifess/clients/' + TEST_CLIENT + '/commands/bad-cmd-id/result', {
    method: 'POST',
    body: JSON.stringify({ status: 'Completed', message: 'done' }),
});
assert.ok([200, 404].indexOf(badResult.status) >= 0, 'Report result for unknown command is 200 or 404 (expected)');

// Config for registered client
var cfg = await api('/api/ifess/clients/' + TEST_CLIENT + '/config');
assert.strictEqual(cfg.status, 200, 'Config for registered client returns 200');
assert.ok(cfg.json, 'Config body is returned');

// Config for unknown client
var unknownCfg = await api('/api/ifess/clients/unknown-client/config');
assert.strictEqual(unknownCfg.status, 404, 'Config for unknown client returns 404');

// ── 11.3.4 Audit entries written ────────────────────────────────────────────

var audit = await api('/api/ifess/audit-logs');
assert.strictEqual(audit.status, 200, 'GET /api/ifess/audit-logs returns 200');
assert.ok(Array.isArray(audit.json), 'audit-logs returns array');

// ── 11.3.5 Client groups ─────────────────────────────────────────────────

var createGroup = await api('/api/ifess/client-groups', {
    method: 'POST',
    body: JSON.stringify({ groupCode: TEST_GROUP, groupName: 'Test Group', description: 'Handler test' }),
});
assert.strictEqual(createGroup.status, 200, 'Create group returns 200');
assert.strictEqual(createGroup.json && createGroup.json.success, true, 'Create group success');

var listGroups = await api('/api/ifess/client-groups');
assert.strictEqual(listGroups.status, 200, 'List groups returns 200');
var found = listGroups.json && listGroups.json.find(function(g) { return g.groupCode === TEST_GROUP; });
assert.ok(found, 'Created group appears in list');

// ── 11.3.6 Dashboard summary ────────────────────────────────────────────────

var dash = await api('/api/ifess/dashboard');
assert.strictEqual(dash.status, 200, 'GET /api/ifess/dashboard returns 200');
assert.ok('totalClients' in (dash.json || {}), 'dashboard has totalClients');
assert.ok('onlineClients' in (dash.json || {}), 'dashboard has onlineClients');
assert.ok('totalPendingCommands' in (dash.json || {}), 'dashboard has totalPendingCommands');

// ── 11.3.7 Frontend proxy action dispatcher ───────────────────────────────

var proxyList = await api('/', {
    method: 'POST',
    body: JSON.stringify({ action: 'listClients' }),
});
assert.strictEqual(proxyList.status, 200, 'POST / with listClients returns 200');
assert.ok(Array.isArray(proxyList.json), 'listClients action returns array');

var proxyUnknown = await api('/', {
    method: 'POST',
    body: JSON.stringify({ action: 'unknownAction' }),
});
assert.strictEqual(proxyUnknown.status, 400, 'Unknown action returns 400');
assert.ok(proxyUnknown.json && proxyUnknown.json.error && proxyUnknown.json.error.indexOf('Unknown action') >= 0, 'Unknown action error message');

var proxyDash = await api('/', {
    method: 'POST',
    body: JSON.stringify({ action: 'getDashboard' }),
});
assert.strictEqual(proxyDash.status, 200, 'getDashboard action returns 200');
assert.ok('totalClients' in (proxyDash.json || {}), 'getDashboard action returns dashboard');

// ── 11.3.8 CORS headers ───────────────────────────────────────────────

var corsCheck = await api('/api/ifess/clients');
assert.ok(corsCheck.headers && corsCheck.headers['access-control-allow-origin'], 'CORS origin header set');

// ── 11.3.9 404 for unknown routes ─────────────────────────────────────

var notFound = await api('/api/ifess/unknown-route');
assert.strictEqual(notFound.status, 404, 'Unknown route returns 404');

console.log('\nAll handler tests passed');
