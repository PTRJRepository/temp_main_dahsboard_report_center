/* IFESS Control — Ops Console
 * Served by ifess-server (:8012). Talks the /api/ifess surface:
 * action dispatcher + REST aliases. Auth: portal cookie / gateway headers /
 * X-API-Key (dev). All rendering via tiny DOM helpers; no framework. */
/* Hallmark · macrostructure: Workbench Control-Room · theme: Midnight Ops (custom) */
'use strict';

// ── Tiny DOM helpers ─────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

function el(tag, opts = {}) {
    const e = document.createElement(tag);
    if (opts.cls) e.className = opts.cls;
    if (opts.text != null) e.textContent = String(opts.text);
    if (opts.html != null) e.innerHTML = opts.html;
    if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) e.setAttribute(k, v);
    return e;
}

function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

function fmtWhen(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtAgo(iso) {
    if (!iso) return '—';
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `${Math.floor(s)}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

let toastTimer = null;
function toast(msg, kind = '') {
    const t = $('toast');
    t.textContent = msg;
    t.className = `toast show ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = `toast ${kind}`; }, 2600);
}

/** Button loading state helper — returns restore fn. */
function busy(btn, on = true) {
    if (!btn) return () => {};
    if (on) {
        const prev = btn.dataset.state;
        btn.dataset.state = 'loading';
        btn.disabled = true;
        return () => { delete btn.dataset.state; if (prev) btn.dataset.state = prev; else btn.removeAttribute('data-state'); btn.disabled = false; };
    }
    return () => {};
}

// ── API layer ────────────────────────────────────────────────────────────────

async function api(path, opts = {}) {
    const r = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    if (r.status === 401) throw Object.assign(new Error('Unauthorized'), { code: 401 });
    const body = await r.json().catch(() => null);
    if (!r.ok) throw Object.assign(new Error(body?.error || body?.message || `HTTP ${r.status}`), { status: r.status, body });
    return body;
}

/** Action-dispatcher call (POST /api/ifess {action, params}). */
const rpc = (action, params = {}) => api('/api/ifess', { method: 'POST', body: JSON.stringify({ action, params }) });

// ── Identity ─────────────────────────────────────────────────────────────────

async function loadIdentity() {
    try {
        const me = await api('/api/ifess/me');
        $('me-chip').hidden = false;
        $('me-name').textContent = me.name || me.userId || '?';
        $('me-role').textContent = `${me.role || '—'} · ${me.source}`;
        $('me-av').textContent = (me.name || '?').trim().charAt(0).toUpperCase();
    } catch (e) {
        if (e.code === 401) { renderGate(); throw e; }
    }
}

function renderGate() {
    document.title = 'IFESS Control — Sign in';
    clear($('main'));
    const wrap = el('div', { cls: 'page is-open', style: 'max-width:560px;margin:12vh auto 0;text-align:center;' });
    wrap.appendChild(el('div', { html: '<img src="/ifess-assets/logo-ifess.svg" alt="" style="width:56px;height:56px;opacity:.9;">' }));
    wrap.appendChild(el('h1', { text: 'Portal sign-in required', style: 'margin:16px 0 8px;font-size:var(--text-xl);' }));
    wrap.appendChild(el('p', { text: 'This console is protected by the portal identity layer (shared/authkit). Open it through the dashboard portal, or set X-API-Key for headless use.', cls: 'dim', style: 'line-height:1.6;margin-bottom:20px;' }));
    const a = el('a', { text: 'Go to portal →', attrs: { href: '/' } });
    a.style.cssText = 'color:var(--color-accent);font-weight:700;';
    wrap.appendChild(a);
    $('main').appendChild(wrap);
}

// ── Navigation ───────────────────────────────────────────────────────────────

const PAGES = {
    overview: { title: 'Overview', load: loadOverview },
    clients:  { title: 'Clients',  load: loadClients },
    modules:  { title: 'Modules',  load: loadModules },
    commands: { title: 'Commands', load: loadCommands },
    query:    { title: 'Query Console', load: initQueryPage },
    templates:{ title: 'Query Templates', load: loadTemplates },
    batches:  { title: 'Query Batches', load: loadBatches },
    groups:   { title: 'Client Groups', load: loadGroups },
    audit:    { title: 'Audit Log', load: loadAudit },
    sync:     { title: 'Sync', load: loadSync },
};

let currentPage = null;

function showPage(name) {
    const page = PAGES[name];
    if (!page) return;
    currentPage = name;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('is-active', b.dataset.page === name));
    $('page-title').textContent = page.title;
    window.location.hash = name;

    // Lazy view container per page.
    let sec = $(`page-${name}`);
    if (!sec) {
        sec = el('section', { cls: 'page', attrs: { id: `page-${name}` } });
        $('main').appendChild(sec);
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('is-open'));
    sec.classList.add('is-open');
    $('main').scrollTop = 0;
    Promise.resolve(page.load()).catch(err => {
        if (err.code === 401) return renderGate();
        console.error(err);
        toast(err.message || 'Load failed', 'err');
    });
}

// ── Health probe ─────────────────────────────────────────────────────────────

async function checkGW() {
    const dot = $('gw-dot'), txt = $('gw-txt');
    try {
        await api('/health');
        dot.className = 'dot live';
        txt.textContent = 'online';
    } catch {
        dot.className = 'dot dead';
        txt.textContent = 'offline';
    }
}

// ── Drawer ───────────────────────────────────────────────────────────────────

function openDrawer(title) {
    $('drawer-title').textContent = title;
    clear($('drawer-body'));
    $('drawer').classList.add('is-open');
    $('veil').classList.add('is-open');
}

function closeDrawer() {
    $('drawer').classList.remove('is-open');
    $('veil').classList.remove('is-open');
}

// ── Shared renderers ─────────────────────────────────────────────────────────

function statusBadge(status) {
    const s = String(status || '').toLowerCase();
    const map = {
        online: 'b-ok', running: 'b-ok', success: 'b-ok', completed: 'b-ok',
        offline: 'b-mute', idle: 'b-info', pending: 'b-info', sent: 'b-info',
        warning: 'b-warn', degraded: 'b-warn', timeout: 'b-warn', expired: 'b-warn',
        failed: 'b-bad', rejected: 'b-bad', error: 'b-bad', cancelled: 'b-bad', stopped: 'b-bad',
    };
    return el('span', { cls: `badge ${map[s] || 'b-mute'}`, html: `<span class="sdot"></span>${esc(status || '—')}` });
}

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function kvGrid(pairs) {
    const dl = el('dl', { cls: 'kv' });
    for (const [k, v] of pairs) {
        dl.appendChild(el('dt', { text: k }));
        const dd = el('dd');
        if (v instanceof Node) dd.appendChild(v);
        else dd.textContent = v == null ? '—' : String(v);
        dl.appendChild(dd);
    }
    return dl;
}

function emptyRow(cols, msg = 'Nothing here yet') {
    const tr = el('tr');
    const td = el('td', { text: msg, cls: 'empty' });
    td.colSpan = cols;
    tr.appendChild(td);
    return tr;
}

function dataTable(headers, opts = {}) {
    const wrap = el('div', { cls: 'table-wrap' });
    const tbl = el('table');
    const thead = el('thead');
    const hr = el('tr');
    headers.forEach((h, i) => hr.appendChild(el('th', { text: h, cls: opts.numeric?.includes(i) ? 'num' : '' })));
    thead.appendChild(hr);
    tbl.appendChild(thead);
    const tbody = el('tbody');
    tbl.appendChild(tbody);
    wrap.appendChild(tbl);
    return { wrap, tbody };
}

function toCSV(headers, rows) {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [headers.map(q).join(','), ...rows.map(r => r.map(q).join(','))].join('\n');
}

function downloadCSV(name, headers, rows) {
    const blob = new Blob(['﻿' + toCSV(headers, rows)], { type: 'text/csv;charset=utf-8' });
    const a = el('a', { attrs: { href: URL.createObjectURL(blob), download: name } });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast(`Exported ${name}`, 'okk');
}
