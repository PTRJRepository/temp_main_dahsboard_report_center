import { execLocalQuery } from './exec.js';
import { isReadOnlySql } from './isReadOnlySql.js';

// ── Template CRUD helpers ────────────────────────────────────────────────────────
// These delegate to the shared JSON store. The store path is injected from index.js.
let TEMPLATES_FILE = null;

export function initRoutes(templatesFile) {
    TEMPLATES_FILE = templatesFile;
}

function readJson(file) {
    const { readFileSync } = require('node:fs');
    try {
        return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
        return [];
    }
}

function writeJson(file, data) {
    const { writeFileSync } = require('node:fs');
    writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function loadTemplates() {
    return readJson(TEMPLATES_FILE);
}

function saveTemplates(templates) {
    writeJson(TEMPLATES_FILE, templates);
}

// ── Route handler factory ───────────────────────────────────────────────────────
/**
 * @param {Request} req  — Bun Request
 * @param {string}  path — URL pathname (already stripped of /api/query-gateway prefix)
 * @param {URL}     url  — parsed URL
 * @returns {Response | null}  null = not handled (caller should 404)
 */
export function handleRequest(req, path, url) {
    const method = req.method;
    const normalizedPath = path.replace(/^\/api\/query-gateway/, '').replace(/^\/api/, '') || '/';

    // ── GET /health ──────────────────────────────────────────────────────────────
    if (method === 'GET' && (normalizedPath === '/health' || normalizedPath === '/')) {
        return json({ ok: true, service: 'firebird-query-service', ts: Date.now() });
    }

    // ── GET /templates ───────────────────────────────────────────────────────────
    if (method === 'GET' && (normalizedPath === '/templates' || normalizedPath === '/templates/')) {
        const templates = loadTemplates();
        return json(templates);
    }

    // ── POST /templates ──────────────────────────────────────────────────────────
    if (method === 'POST' && normalizedPath === '/templates') {
        return req.arrayBuffer().then(body => {
            try {
                const data = JSON.parse(new TextDecoder().decode(body));
                return handleCreateTemplate(data);
            } catch {
                return json({ success: false, error: 'Invalid JSON' }, 400);
            }
        });
    }

    // ── PUT /templates/:code ─────────────────────────────────────────────────────
    if (method === 'PUT' && /^\/templates\/([^/]+)$/.test(normalizedPath)) {
        const templateCode = normalizedPath.split('/').pop();
        return req.arrayBuffer().then(body => {
            try {
                const updates = JSON.parse(new TextDecoder().decode(body));
                return handleUpdateTemplate(templateCode, updates);
            } catch {
                return json({ success: false, error: 'Invalid JSON' }, 400);
            }
        });
    }

    // ── DELETE /templates/:code ──────────────────────────────────────────────────
    if (method === 'DELETE' && /^\/templates\/([^/]+)$/.test(normalizedPath)) {
        const templateCode = normalizedPath.split('/').pop();
        return handleDeleteTemplate(templateCode);
    }

    // ── POST /validate ──────────────────────────────────────────────────────────
    if (method === 'POST' && normalizedPath === '/validate') {
        return req.arrayBuffer().then(body => {
            try {
                const { queryText } = JSON.parse(new TextDecoder().decode(body));
                return json(isReadOnlySql(queryText));
            } catch {
                return json({ valid: false, errors: ['Invalid JSON'] }, 400);
            }
        });
    }

    // ── POST /exec, /exec-sync ──────────────────────────────────────────────────
    if (method === 'POST' && (normalizedPath === '/exec' || normalizedPath === '/exec-sync')) {
        return req.arrayBuffer().then(async (body) => {
            try {
                const raw = new TextDecoder().decode(body).trim();
                if (!raw) return json({ ok: false, error: 'Invalid JSON', headers: [], rows: [], rowCount: 0 }, 400);
                const data = JSON.parse(raw);
                // Validate read-only BEFORE executing
                const validation = isReadOnlySql(data.queryText);
                if (!validation.valid) {
                    return json({ ok: false, error: validation.errors.join('; '), headers: [], rows: [], rowCount: 0 }, 400);
                }
                const result = await execLocalQuery(data.queryText, data.maxRows || 100);
                return json(result);
            } catch (e) {
                return json({ ok: false, error: String(e && e.message || e), headers: [], rows: [], rowCount: 0 }, 500);
            }
        });
    }

    // ── GET /explore ────────────────────────────────────────────────────────────
    if (method === 'GET' && (normalizedPath === '/explore' || normalizedPath === '/explore/')) {
        return Promise.all([
            execLocalQuery("SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND RDB$VIEW_SOURCE IS NULL ORDER BY 1", 1000),
            execLocalQuery("SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND RDB$VIEW_SOURCE IS NOT NULL ORDER BY 1", 1000),
        ]).then(([rt, rv]) => {
            const objects = [
                ...(rt.rows || []).map(row => ({ name: row[0], type: 'TABLE' })),
                ...(rv.rows || []).map(row => ({ name: row[0], type: 'VIEW' })),
            ].sort((a, b) => a.name.localeCompare(b.name));
            return json({ ok: true, objects, count: objects.length });
        }).catch(e => json({ ok: false, error: String(e) }, 500));
    }

    // ── GET /explore/:table ─────────────────────────────────────────────────────
    if (method === 'GET' && /^\/explore\/([^/]+)$/.test(normalizedPath)) {
        const tableName = decodeURIComponent(normalizedPath.split('/').pop());
        return execLocalQuery(
            `SELECT RDB$FIELD_NAME, RDB$FIELD_SOURCE FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = '${tableName.replace(/'/g, "''")}' ORDER BY RDB$FIELD_POSITION`,
            1000
        ).then(r => {
            const columns = (r.rows || []).map(row => ({ name: row[0], type: row[1] }));
            return json({ ok: true, table: tableName, columns });
        }).catch(e => json({ ok: false, error: String(e) }, 500));
    }

    // Not handled by this service
    return null;
}

// ── Template CRUD ───────────────────────────────────────────────────────────────

function handleCreateTemplate({ templateCode, templateName, description, queryText, defaultMaxRows, defaultTimeoutSeconds, tags, createdBy }) {
    if (!templateCode) {
        return json({ success: false, error: 'templateCode is required' }, 400);
    }
    const templates = loadTemplates();
    if (templates.find(t => t.templateCode === templateCode)) {
        return json({ success: false, error: `Template '${templateCode}' already exists` }, 409);
    }
    const now = new Date().toISOString();
    const template = {
        templateCode,
        templateName: templateName || templateCode,
        description: description || null,
        queryText,
        defaultMaxRows: defaultMaxRows || 1000,
        defaultTimeoutSeconds: defaultTimeoutSeconds || 30,
        tags: tags || [],
        enabled: true,
        createdBy: createdBy || 'system',
        createdAt: now,
        updatedAt: now
    };
    templates.push(template);
    saveTemplates(templates);
    return json({ success: true, template }, 201);
}

function handleUpdateTemplate(templateCode, updates) {
    const templates = loadTemplates();
    const idx = templates.findIndex(t => t.templateCode === templateCode);
    if (idx < 0) {
        return json({ success: false, error: 'Template not found' }, 404);
    }
    templates[idx] = { ...templates[idx], ...updates, updatedAt: new Date().toISOString() };
    saveTemplates(templates);
    return json({ success: true, template: templates[idx] });
}

function handleDeleteTemplate(templateCode) {
    const templates = loadTemplates();
    const idx = templates.findIndex(t => t.templateCode === templateCode);
    if (idx < 0) {
        return json({ success: false, error: 'Template not found' }, 404);
    }
    templates.splice(idx, 1);
    saveTemplates(templates);
    return json({ success: true });
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}
