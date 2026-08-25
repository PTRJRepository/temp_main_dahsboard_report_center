/* sql-gateway dashboard — vanilla JS, no build step.
   Works direct-port (:8001) and via gateway proxy (/sql-gateway). */
'use strict';

const BASE = location.pathname.startsWith('/sql-gateway') ? '/sql-gateway' : '';
const api = (path) => `${BASE}${path}`;
// Optional m2m key entered once on the login page (direct-port usage).
// Portal SSO users never need this — the cookie/gateway headers carry auth.
let storedKey = localStorage.getItem('sqlgw_key') || '';
const authHeaders = () => ({ accept: 'application/json', ...(storedKey ? { 'x-api-key': storedKey } : {}) });

function redirectToLogin() {
  const next = encodeURIComponent(location.pathname + location.search);
  location.href = `${BASE}/login?next=${next}`;
}

const $ = (id) => document.getElementById(id);
let overview = null;
let lastTraffic = [];
let lastQueries = [];
let lastSecurity = [];
let activeTab = 'traffic';
let refreshTimer = null;

// ── helpers ──────────────────────────────────────────────────────────────────
async function getJSON(path) {
  const res = await fetch(api(path), { headers: authHeaders() });
  if (res.status === 401) { redirectToLogin(); throw new Error('unauthenticated'); }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtTime(ts) { return new Date(ts).toLocaleTimeString('en-GB', { hour12: false }); }
function fmtBytes(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
function badge(status) {
  const cls = status >= 500 ? 'b-5xx' : status >= 400 ? 'b-4xx' : 'b-2xx';
  return `<span class="badge ${cls}">${status}</span>`;
}

// ── drawer ───────────────────────────────────────────────────────────────────
function openDrawer(title, obj) {
  $('drawerTitle').textContent = title;
  $('drawerBody').textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  $('drawer').hidden = false;
}
$('drawerClose').onclick = () => { $('drawer').hidden = true; };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('drawer').hidden = true; });

// ── cards ────────────────────────────────────────────────────────────────────
function renderCards(d) {
  const s = d.stats;
  const cards = [
    { k: `requests (${s.windowMinutes}m)`, v: s.requests.total, s: `${s.requests.ok2xx} ok · ${s.requests.err4xx + s.requests.err5xx} err` },
    { k: 'error rate', v: `${s.requests.errorRate}%`, cls: s.requests.errorRate > 10 ? 'err' : s.requests.errorRate > 2 ? 'warn' : 'ok', s: `p95 ${s.requests.p95Ms} ms` },
    { k: 'avg latency', v: `${s.requests.avgMs} ms`, s: `p50 ${s.requests.p50Ms} ms · p95 ${s.requests.p95Ms} ms` },
    { k: 'queries', v: s.queries.total, s: `${s.queries.cacheHits} cached · avg ${s.queries.avgMs} ms` },
    { k: 'cache hit rate', v: `${d.cacheHitRatePct}%`, cls: d.cacheHitRatePct >= 30 ? 'ok' : '', s: `${d.cache.entries} entries` },
    { k: 'blocked / errors', v: s.queries.blocked + s.queries.errors, cls: (s.queries.blocked + s.queries.errors) ? 'warn' : '', s: `${s.queries.slow} slow (>5s)` },
    { k: 'security events', v: d.status.counters.securityEvents, cls: d.status.counters.securityEvents ? 'warn' : 'ok', s: 'since boot' },
    { k: 'pools healthy', v: `${d.servers.filter(x => x.healthy).length}/${d.servers.length}`, cls: d.servers.length && d.servers.every(x => x.healthy) ? 'ok' : (d.servers.length ? 'warn' : ''), s: d.config.profilesConfigured ? `${d.config.profilesConfigured} profiles` : 'no profiles configured' },
  ];
  $('cards').innerHTML = cards.map(c =>
    `<div class="card"><div class="k">${esc(c.k)}</div><div class="v ${c.cls || ''}">${esc(c.v)}</div><div class="s">${esc(c.s)}</div></div>`
  ).join('');
}

// ── chart ────────────────────────────────────────────────────────────────────
function renderChart(series) {
  const cv = $('chart');
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  if (!series.length) return;
  const padB = 16, padT = 6;
  const maxV = Math.max(4, ...series.map(p => Math.max(p.req, p.q)));
  const stepX = series.length > 1 ? (w - 8) / (series.length - 1) : w - 8;
  const y = v => h - padB - (v / maxV) * (h - padB - padT);

  // grid
  ctx.strokeStyle = 'rgba(30,38,48,.9)';
  ctx.beginPath();
  for (let g = 0; g <= 3; g++) {
    const gy = padT + ((h - padB - padT) * g) / 3;
    ctx.moveTo(0, gy); ctx.lineTo(w, gy);
  }
  ctx.stroke();

  const line = (key, color, fill) => {
    ctx.beginPath();
    series.forEach((p, i) => { const x = 4 + i * stepX; i ? ctx.lineTo(x, y(p[key])) : ctx.moveTo(x, y(p[key])); });
    ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.stroke();
    if (fill) {
      ctx.lineTo(4 + (series.length - 1) * stepX, h - padB); ctx.lineTo(4, h - padB); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
    }
  };
  line('req', '#4da3ff', 'rgba(77,163,255,.10)');
  line('q', '#2ecc71');
  line('err', '#e74c3c');

  // labels
  ctx.fillStyle = '#7a8699'; ctx.font = '10px ui-monospace, monospace';
  ctx.fillText(String(maxV), 2, padT + 8);
  const t0 = series[0]?.minute?.slice(11, 16) || '';
  const t1 = series[series.length - 1]?.minute?.slice(11, 16) || '';
  ctx.fillText(t0, 2, h - 4);
  ctx.fillText(t1, w - 34, h - 4);
}

// ── tables ───────────────────────────────────────────────────────────────────
function setRows(tableId, rowsHtml, emptyMsg) {
  const tb = document.querySelector(`#${tableId} tbody`);
  tb.innerHTML = rowsHtml || `<tr><td colspan="9" class="empty">${esc(emptyMsg)}</td></tr>`;
}

function renderTraffic(rows) {
  lastTraffic = rows;
  setRows('trafficTable', rows.map(r => `<tr data-kind="traffic">
      <td class="mono">${fmtTime(r.ts)}</td>
      <td class="mono">${esc(r.method)}</td>
      <td class="mono" title="${esc(r.path)}">${esc(r.path)}</td>
      <td>${badge(r.status)}</td>
      <td class="mono">${r.durMs}</td>
      <td>${esc(r.caller)}</td>
      <td class="mono">${esc(r.mode)}</td>
      <td class="mono" title="${esc(r.ip)}">${esc(r.clientIp || r.ip)}</td>
    </tr>`).join(''), 'no traffic yet in this window');
}

function renderQueries(rows) {
  lastQueries = rows;
  setRows('queriesTable', rows.map(q => `<tr data-kind="query">
      <td class="mono">${fmtTime(q.ts)}</td>
      <td class="mono">${esc(q.server)}${q.db ? '/' + esc(q.db) : ''}</td>
      <td class="sqlcell" title="${esc(q.sqlPreview)}">${esc(q.sqlPreview)}</td>
      <td class="mono">${esc(q.queryType || 'SELECT')}</td>
      <td><span class="badge ${q.decision === 'allowed' ? 'b-allow' : q.decision === 'blocked' ? 'b-block' : 'b-error'}">${esc(q.decision)}</span></td>
      <td class="mono">${q.rows}</td>
      <td class="mono">${q.execMs}</td>
      <td>${q.cacheHit ? '<span class="badge b-cache">hit</span>' : '<span style="color:#7a8699">·</span>'}</td>
      <td>${esc(q.caller)}</td>
    </tr>`).join(''), 'no queries yet in this window');
}

function renderSecurity(rows) {
  lastSecurity = rows;
  setRows('securityTable', rows.map(e => `<tr data-kind="security">
      <td class="mono">${fmtTime(e.ts)}</td>
      <td><span class="badge b-block">${esc(e.kind)}</span></td>
      <td class="mono">${esc(e.ip)}</td>
      <td>${esc(e.caller)}</td>
      <td style="white-space:normal">${esc(e.detail)}</td>
    </tr>`).join(''), 'no security events — all quiet');
}

function renderCallers(callers, topIps) {
  setRows('callersTable', callers.map(c => `<tr>
      <td class="mono">${esc(c.caller)}</td><td class="mono">${esc(c.mode)}</td>
      <td class="mono">${c.requests}</td><td class="mono">${c.errors}</td>
      <td class="mono">${fmtTime(c.lastSeen)}</td><td class="mono">${esc(c.ips.join(', '))}</td>
    </tr>`).join(''), 'no callers in this window');
  setRows('ipsTable', topIps.map(i => `<tr><td class="mono">${esc(i.ip)}</td><td class="mono">${i.count}</td></tr>`).join(''), 'no IPs in this window');
}

function renderServers(servers, config) {
  $('serverGrid').innerHTML = servers.length ? servers.map(s => {
    const faWindow = config.fullAccessWindow.profile === s.name;
    return `<div class="servercard">
      <h4><span class="dot ${s.connected ? 'ok' : s.profilesConfigured === 0 ? 'na' : 'bad'}"></span> ${esc(s.name)}
        ${s.isDefault ? '<span class="tag def">default</span>' : ''}
        ${s.readOnly ? '<span class="tag ro">read-only</span>' : ''}
        ${faWindow ? '<span class="tag fa">write window</span>' : ''}
      </h4>
      <div class="kv">
        <span class="k">endpoint</span><span class="mono">${esc(s.host)}:${s.port}</span>
        <span class="k">default db</span><span class="mono">${esc(s.defaultDatabase)}</span>
        <span class="k">connected</span><span>${s.connected ? 'yes' : 'no'}</span>
        <span class="k">pool</span><span class="mono">${s.pool ? `${s.pool.size} size · ${s.pool.available} avail · ${s.pool.pending} pending` : '—'}</span>
      </div>
    </div>`;
  }).join('') : `<p class="empty">No DATABASE_PROFILES_* configured. Add profiles to <code>.env</code> and restart.</p>`;
}

function renderLogs(files, retentionDays) {
  $('retentionInfo').textContent = `${retentionDays} days`;
  setRows('logsTable', files.map(f => `<tr>
      <td class="mono">${esc(f.name)}</td>
      <td class="mono">${fmtBytes(f.sizeBytes)}</td>
      <td class="mono">${new Date(f.mtime).toLocaleString()}</td>
    </tr>`).join(''), 'no log files yet');
}

// ── row click → drawer ───────────────────────────────────────────────────────
document.querySelector('.tabwrap').addEventListener('click', (ev) => {
  const tr = ev.target.closest('tr[data-kind]');
  if (!tr) return;
  const idx = [...tr.parentElement.children].indexOf(tr);
  if (tr.dataset.kind === 'traffic' && lastTraffic[idx]) openDrawer(`request ${lastTraffic[idx].id.slice(0, 8)}`, lastTraffic[idx]);
  if (tr.dataset.kind === 'query' && lastQueries[idx]) openDrawer(`query ${lastQueries[idx].sqlHash}`, lastQueries[idx]);
  if (tr.dataset.kind === 'security' && lastSecurity[idx]) openDrawer(`event ${lastSecurity[idx].kind}`, lastSecurity[idx]);
});

// ── identity chip ────────────────────────────────────────────────────────────
function renderIdentity(id) {
  const chip = $('identityChip');
  if (!id || id.kind === 'anon') { chip.textContent = 'anonymous'; chip.className = 'chip ro'; return; }
  const label = id.caller + (id.role ? ` (${id.role})` : '');
  chip.textContent = label;
  chip.className = 'chip ' + (id.readOnly ? 'ro' : 'fa');
  chip.title = `mode=${id.mode} readOnly=${id.readOnly}`;
}

// ── main refresh cycle ───────────────────────────────────────────────────────
async function refresh() {
  try {
    const minutes = $('windowSel').value;
    const [ovRes] = await Promise.all([getJSON(`/monitor/overview?minutes=${minutes}`)]);
    if (!ovRes.success) throw new Error(ovRes.error || 'overview failed');
    overview = ovRes.data;

    renderCards(overview);
    renderChart(overview.stats.series);
    renderIdentity(overview.identity);
    renderServers(overview.servers, overview.config);
    $('connState').textContent = `live · uptime ${Math.floor(overview.status.uptimeSec / 60)}m · rings r${overview.status.rings.requests}/q${overview.status.rings.queries}/s${overview.status.rings.security}`;
    $('footMeta').textContent = `retention ${overview.config.retentionDays}d · rate limit ${overview.config.rateLimitPerMin}/min · cache ttl ${Math.round(overview.cache.ttlMs / 1000)}s`;

    const listQ = (extra) => `limit=200&minutes=${minutes}${extra}`;
    const [traffic, queries, security, callers] = await Promise.all([
      getJSON(`/monitor/requests?${listQ(trFilters())}`),
      getJSON(`/monitor/queries?${listQ(queriesFilter())}`),
      getJSON(`/monitor/security?${listQ($('secKind').value ? `&kind=${encodeURIComponent($('secKind').value)}` : '')}`),
      getJSON(`/monitor/callers?minutes=${minutes}`),
    ]);
    renderTraffic(traffic.data || []);
    renderQueries(queries.data || []);
    renderSecurity(security.data || []);
    renderCallers(callers.data || [], overview.stats.topIps);

    $('connState').style.color = '';
  } catch (err) {
    $('connState').textContent = `error: ${err.message}`;
    $('connState').style.color = 'var(--err)';
  }
}

function trFilters() {
  const q = $('trafficQ').value.trim();
  const sc = $('trafficStatus').value;
  return (q ? `&q=${encodeURIComponent(q)}` : '') + (sc ? `&statusClass=${sc}` : '');
}
function queriesFilter() {
  const q = $('queriesQ').value.trim();
  return q ? `&q=${encodeURIComponent(q)}` : '';
}

// ── tabs ─────────────────────────────────────────────────────────────────────
$('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.tabpane').forEach(p => p.classList.toggle('active', p.id === `tab-${btn.dataset.tab}`));
  activeTab = btn.dataset.tab;
});

// filter inputs re-fetch on Enter
['trafficQ', 'trafficStatus', 'queriesQ', 'secKind'].forEach(id => {
  $(id).addEventListener('change', refresh);
  $(id).addEventListener('keydown', e => { if (e.key === 'Enter') refresh(); });
});

// ── CSV export of the active table ───────────────────────────────────────────
$('exportBtn').onclick = () => {
  const map = { traffic: ['trafficTable', lastTraffic], queries: ['queriesTable', lastQueries], security: ['securityTable', lastSecurity] };
  const entry = map[activeTab];
  if (!entry) return;
  const [tableId] = entry;
  const lines = [];
  document.querySelectorAll(`#${tableId} tr`).forEach(tr => {
    lines.push([...tr.children].map(td => `"${td.textContent.replace(/"/g, '""')}"`).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sql-gateway-${activeTab}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
};

// ── tester tab ───────────────────────────────────────────────────────────────
function fillServerSelect() {
  const sel = $('tServer');
  sel.innerHTML = (overview?.servers || []).map(s =>
    `<option value="${esc(s.name)}"${s.isDefault ? ' selected' : ''}>${esc(s.name)}${s.readOnly ? ' (ro)' : ''}</option>`
  ).join('') || '<option value="">(no profiles)</option>';
}

async function runTester() {
  const meta = $('tMeta');
  meta.textContent = 'running…';
  let params;
  try { params = $('tParams').value.trim() ? JSON.parse($('tParams').value) : undefined; }
  catch { meta.textContent = 'params: invalid JSON'; return; }

  try {
    const t0 = performance.now();
    const res = await fetch(api('/v1/query'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ sql: $('tSql').value, server: $('tServer').value || undefined, database: $('tDb').value.trim() || undefined, params }),
    });
    if (res.status === 401) { redirectToLogin(); return; }
    const json = await res.json();
    const ms = Math.round((performance.now() - t0));

    if (!json.success) {
      meta.textContent = `✗ ${json.error} (${res.status}, ${ms}ms)`;
      return;
    }
    const rs = json.data?.recordset || [];
    meta.textContent = `✓ ${rs.length} rows · db ${json.execution_ms}ms · total ${ms}ms${json.db === 'default' ? '' : ` · ${json.server}/${json.db}`}`;

    const cols = rs.length ? Object.keys(rs[0]) : [];
    document.querySelector('#tResult thead').innerHTML = cols.length ? `<tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>` : '';
    document.querySelector('#tResult tbody').innerHTML = rs.map(row =>
      `<tr style="cursor:default">${cols.map(c => `<td class="mono">${esc(typeof row[c] === 'object' ? JSON.stringify(row[c]) : row[c] ?? '')}</td>`).join('')}</tr>`
    ).join('') || '<tr><td class="empty">(empty recordset)</td></tr>';
  } catch (err) {
    meta.textContent = `✗ ${err.message}`;
  }
}
$('tRun').onclick = runTester;
$('tSql').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runTester();
});
$('tPurge').onclick = async () => {
  const res = await fetch(api('/v1/cache'), { method: 'DELETE', headers: authHeaders() });
  if (res.status === 401) { redirectToLogin(); return; }
  const json = await res.json();
  $('tMeta').textContent = json.success ? `purged ${json.data.purgedEntries} cache entries` : 'purge failed';
};

// ── logout (clears stored m2m key; SSO users re-login at the portal) ────────
$('logoutBtn').onclick = () => {
  localStorage.removeItem('sqlgw_key');
  storedKey = '';
  redirectToLogin();
};

// ── auto-refresh loop ────────────────────────────────────────────────────────
function schedule() {
  clearInterval(refreshTimer);
  if ($('autoRefresh').checked) refreshTimer = setInterval(() => { if (!document.hidden) refresh(); }, 3000);
}
$('autoRefresh').onchange = schedule;
$('refreshBtn').onclick = () => { fillServerSelect(); refresh(); };
$('windowSel').onchange = refresh;

// boot
(async function boot() {
  await refresh();
  fillServerSelect();
  schedule();
})();
