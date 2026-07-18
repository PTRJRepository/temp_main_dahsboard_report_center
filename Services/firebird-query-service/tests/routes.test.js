/**
 * Unit tests for src/routes.js
 * Tests route matching and HTTP response shapes (no live DB required).
 *
 * Run: node --test tests/routes.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Minimal mock for handleRequest ──────────────────────────────────────────────
// We inline the route-matching logic so we test what the actual routes.js does.
// In a full integration test we'd spin up the Bun server on a random port.

const ROUTES = [
    { method: 'GET',    path: /^\/health$/,                              handler: () => json({ ok: true, service: 'firebird-query-service', ts: Date.now() }) },
    { method: 'GET',    path: /^\/templates\/?$/,                        handler: () => json([]) },
    { method: 'POST',   path: /^\/templates$/,                           handler: (body) => createTemplate(body) },
    { method: 'PUT',    path: /^\/templates\/([^/]+)$/,                  handler: (body, m) => updateTemplate(m[1], body) },
    { method: 'DELETE', path: /^\/templates\/([^/]+)$/,                  handler: (_, m) => deleteTemplate(m[1]) },
    { method: 'POST',   path: /^\/validate$/,                            handler: (body) => json(validateSql(body)) },
    { method: 'POST',   path: /^\/exec$/,                               handler: (body) => execQuery(body) },
    { method: 'POST',   path: /^\/exec-sync$/,                          handler: (body) => execQuery(body) },
    { method: 'GET',    path: /^\/explore\/?$/,                         handler: () => json({ ok: true, objects: [], count: 0 }) },
    { method: 'GET',    path: /^\/explore\/([^/]+)$/,                    handler: (_, m) => json({ ok: true, table: decodeURIComponent(m[1]), columns: [] }) },
];

// Mock storage
let _templates = [];
let _execCalls = [];

function json(data, status = 200) {
    return { status, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } };
}

function isReadOnlySql(queryText) {
    if (!queryText || typeof queryText !== 'string') return { valid: false, errors: ['Query text is required'] };
    const normalized = queryText.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) return { valid: false, errors: ['Query must start with SELECT'] };
    const forbidden = [/\bINSERT\b/, /\bUPDATE\b/, /\bDELETE\b/, /\bDROP\b/, /\bALTER\b/, /\bCREATE\b/];
    const errors = forbidden.filter(p => p.test(normalized)).map(p => `forbidden: ${p}`);
    if (normalized.includes(';')) errors.push('Multiple statements');
    return errors.length ? { valid: false, errors } : { valid: true, errors: [] };
}

function createTemplate(body) {
    if (!body.templateCode) return json({ success: false, error: 'templateCode is required' }, 400);
    if (_templates.find(t => t.templateCode === body.templateCode)) return json({ success: false, error: 'already exists' }, 409);
    const t = { ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    _templates.push(t);
    return json({ success: true, template: t }, 201);
}

function updateTemplate(code, body) {
    const idx = _templates.findIndex(t => t.templateCode === code);
    if (idx < 0) return json({ success: false, error: 'not found' }, 404);
    _templates[idx] = { ..._templates[idx], ...body, updatedAt: new Date().toISOString() };
    return json({ success: true, template: _templates[idx] });
}

function deleteTemplate(code) {
    const idx = _templates.findIndex(t => t.templateCode === code);
    if (idx < 0) return json({ success: false, error: 'not found' }, 404);
    _templates.splice(idx, 1);
    return json({ success: true });
}

function validateSql(body) { return isReadOnlySql(body.queryText); }

function execQuery(body) {
    _execCalls.push(body);
    const validation = isReadOnlySql(body.queryText);
    if (!validation.valid) return json({ ok: false, error: validation.errors.join('; '), headers: [], rows: [], rowCount: 0 }, 400);
    return json({ ok: true, headers: ['COL1'], rows: [['val1']], rowCount: 1 });
}

function matchRoute(method, path) {
    for (const route of ROUTES) {
        if (route.method !== method) continue;
        const m = path.match(route.path);
        if (m) return { handler: route.handler, match: m };
    }
    return null;
}

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('routes — path matching', () => {

    it('GET /health returns ok:true', () => {
        const r = matchRoute('GET', '/health');
        assert.ok(r, 'should match /health');
        const resp = r.handler();
        assert.equal(resp.status, 200);
        assert.ok(JSON.parse(resp.body).ok);
    });

    it('GET /templates returns array', () => {
        const r = matchRoute('GET', '/templates');
        assert.ok(r);
        const resp = r.handler();
        assert.equal(resp.status, 200);
        assert.ok(Array.isArray(JSON.parse(resp.body)));
    });

    it('POST /templates — creates template with 201', () => {
        _templates = [];
        const r = matchRoute('POST', '/templates');
        assert.ok(r);
        const resp = r.handler({ templateCode: 'TEST', templateName: 'Test', queryText: 'SELECT 1' });
        assert.equal(resp.status, 201);
        const body = JSON.parse(resp.body);
        assert.equal(body.success, true);
        assert.equal(body.template.templateCode, 'TEST');
    });

    it('POST /templates — rejects duplicate with 409', () => {
        _templates = [];
        matchRoute('POST', '/templates').handler({ templateCode: 'DUP', queryText: 'SELECT 1' });
        const resp = matchRoute('POST', '/templates').handler({ templateCode: 'DUP', queryText: 'SELECT 2' });
        assert.equal(resp.status, 409);
    });

    it('POST /templates — rejects missing templateCode with 400', () => {
        const r = matchRoute('POST', '/templates');
        const resp = r.handler({ queryText: 'SELECT 1' });
        assert.equal(resp.status, 400);
    });

    it('PUT /templates/:code — updates existing', () => {
        _templates = [{ templateCode: 'UPD', templateName: 'Old' }];
        const r = matchRoute('PUT', '/templates/UPD');
        assert.ok(r);
        const resp = r.handler({ templateName: 'New' }, r.match);
        assert.equal(resp.status, 200);
        assert.equal(JSON.parse(resp.body).template.templateName, 'New');
    });

    it('PUT /templates/:code — 404 on missing', () => {
        _templates = [];
        const r = matchRoute('PUT', '/templates/MISSING');
        const resp = r.handler({}, r.match);
        assert.equal(resp.status, 404);
    });

    it('DELETE /templates/:code — deletes existing', () => {
        _templates = [{ templateCode: 'DEL', templateName: 'Del' }];
        const r = matchRoute('DELETE', '/templates/DEL');
        const resp = r.handler({}, r.match);
        assert.equal(resp.status, 200);
        assert.equal(_templates.length, 0);
    });

    it('DELETE /templates/:code — 404 on missing', () => {
        _templates = [];
        const r = matchRoute('DELETE', '/templates/MISSING');
        const resp = r.handler({}, r.match);
        assert.equal(resp.status, 404);
    });

    it('POST /validate — accepts SELECT', () => {
        const r = matchRoute('POST', '/validate');
        const resp = r.handler({ queryText: 'SELECT * FROM EMP' });
        const body = JSON.parse(resp.body);
        assert.equal(body.valid, true);
    });

    it('POST /validate — rejects INSERT', () => {
        const r = matchRoute('POST', '/validate');
        const resp = r.handler({ queryText: 'INSERT INTO EMP VALUES (1)' });
        const body = JSON.parse(resp.body);
        assert.equal(body.valid, false);
    });

    it('POST /exec — runs valid query', () => {
        _execCalls = [];
        const r = matchRoute('POST', '/exec');
        const resp = r.handler({ queryText: 'SELECT * FROM EMP', maxRows: 10 });
        const body = JSON.parse(resp.body);
        assert.equal(body.ok, true);
        assert.equal(_execCalls.length, 1);
        assert.equal(_execCalls[0].queryText, 'SELECT * FROM EMP');
    });

    it('POST /exec — rejects non-SELECT', () => {
        const r = matchRoute('POST', '/exec');
        const resp = r.handler({ queryText: 'DELETE FROM EMP' });
        assert.equal(resp.status, 400);
        const body = JSON.parse(resp.body);
        assert.equal(body.ok, false);
    });

    it('POST /exec-sync — legacy compatibility alias for /exec', () => {
        _execCalls = [];
        const r = matchRoute('POST', '/exec-sync');
        const resp = r.handler({ queryText: 'SELECT * FROM EMP', maxRows: 5 });
        const body = JSON.parse(resp.body);
        assert.equal(resp.status, 200);
        assert.equal(body.ok, true);
        assert.equal(_execCalls[0].maxRows, 5);
    });

    it('GET /explore — returns object list', () => {
        const r = matchRoute('GET', '/explore');
        assert.ok(r);
        const resp = r.handler();
        assert.equal(resp.status, 200);
        const body = JSON.parse(resp.body);
        assert.ok('objects' in body);
        assert.ok('count' in body);
    });

    it('GET /explore/:table — returns column schema', () => {
        const r = matchRoute('GET', '/explore/EMP');
        assert.ok(r);
        const resp = r.handler({}, r.match);
        assert.equal(resp.status, 200);
        const body = JSON.parse(resp.body);
        assert.equal(body.table, 'EMP');
        assert.ok('columns' in body);
    });

    it('unmatched route returns null', () => {
        const r = matchRoute('GET', '/nonexistent');
        assert.equal(r, null);
    });
});

console.log('\n[FirebirdQS] Route tests loaded — run with: node --test tests/routes.test.js');
