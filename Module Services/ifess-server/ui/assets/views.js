/* IFESS Control — Views (fleet: overview/clients/modules/commands) */
'use strict';

// ── Overview ─────────────────────────────────────────────────────────────────

async function loadOverview() {
    const sec = $('page-overview');
    clear(sec);

    const dash = await rpc('getDashboard');
    const stats = el('div', { cls: 'stat-row' });
    const items = [
        ['Total clients', dash.totalClients, 'var(--color-info)'],
        ['Online', dash.onlineClients, 'var(--color-success)'],
        ['Offline', dash.offlineClients, dash.offlineClients ? 'var(--color-danger)' : 'var(--color-ink-muted)'],
        ['Modules running', dash.totalModulesRunning, 'var(--color-accent)'],
        ['Modules failed', dash.totalModulesFailed, dash.totalModulesFailed ? 'var(--color-warn)' : 'var(--color-ink-muted)'],
        ['Pending commands', dash.totalPendingCommands, dash.totalPendingCommands ? 'var(--color-warn)' : 'var(--color-ink-muted)'],
    ];
    for (const [label, val, tone] of items) {
        const s = el('div', { cls: 'stat' });
        s.style.setProperty('--stat-tone', tone);
        s.appendChild(el('b', { text: val ?? 0 }));
        s.appendChild(el('span', { text: label }));
        stats.appendChild(s);
    }
    sec.appendChild(stats);

    const grid = el('div', { cls: 'grid-2' });

    // Left: fleet snapshot
    const fleetCard = el('div', { cls: 'card' });
    fleetCard.appendChild(el('div', { cls: 'card-head', html: '<h2>Fleet</h2>' }));
    const clients = await rpc('listClients');
    const fleet = dataTable(['Client', 'Status', 'Version', 'Last heartbeat'], { numeric: [] });
    (clients || []).slice(0, 8).forEach(c => {
        const tr = el('tr', { cls: 'rowlink' });
        tr.addEventListener('click', () => { showPage('clients'); setTimeout(() => openClientDrawer(c.clientId), 60); });
        tr.appendChild(el('td', { html: `<b>${esc(c.clientName || c.clientId)}</b><div class="mono dim">${esc(c.clientId)}</div>` }));
        const stTd = el('td'); stTd.appendChild(statusBadge(c.status)); tr.appendChild(stTd);
        tr.appendChild(el('td', { text: c.appVersion || '—', cls: 'mono' }));
        tr.appendChild(el('td', { text: fmtAgo(c.lastHeartbeatAt), cls: 'mono dim' }));
        fleet.tbody.appendChild(tr);
    });
    if (!(clients || []).length) fleet.tbody.appendChild(emptyRow(4, 'No clients registered'));
    fleetCard.appendChild(fleet.wrap);
    grid.appendChild(fleetCard);

    // Right: recent audit
    const auditCard = el('div', { cls: 'card' });
    auditCard.appendChild(el('div', { cls: 'card-head', html: '<h2>Recent activity</h2>' }));
    const logs = await rpc('listAuditLogs', {});
    const tl = el('ul', { cls: 'tl' });
    const entries = Array.isArray(logs) ? logs.slice(0, 10) : (logs?.items || []).slice(0, 10);
    for (const a of entries) {
        const li = el('li', { cls: String(a.status).toLowerCase() === 'success' ? 'ok' : 'bad' });
        li.appendChild(el('span', { cls: 'tick' }));
        const body = el('div');
        body.appendChild(el('div', { html: `<b>${esc(a.action)}</b> <span class="dim">on</span> <span class="mono">${esc(a.objectType)}${a.objectId ? '·' + esc(a.objectId) : ''}</span>` }));
        body.appendChild(el('div', { text: `${a.actorName || a.actorId || 'system'} · ${fmtWhen(a.timestamp)}`, cls: 'when' }));
        li.appendChild(body);
        tl.appendChild(li);
    }
    if (!entries.length) tl.appendChild(el('li', { html: '<span class="tick"></span><div class="dim">No audit entries yet</div>' }));
    auditCard.appendChild(tl);
    grid.appendChild(auditCard);

    sec.appendChild(grid);
}

// ── Clients ──────────────────────────────────────────────────────────────────

let clientsCache = [];

async function loadClients() {
    const sec = $('page-clients');
    clear(sec);

    const bar = el('div', { cls: 'field-row', style: 'margin-bottom:var(--space-lg);' });
    const search = el('input', { attrs: { type: 'search', placeholder: 'Filter by name / id / machine…', style: 'max-width:340px;' } });
    bar.appendChild(search);
    const refreshBtn = el('button', { cls: 'btn', text: '↻ Refresh' });
    refreshBtn.addEventListener('click', () => loadClients());
    bar.appendChild(refreshBtn);
    const exportBtn = el('button', { cls: 'btn', text: '⭳ CSV' });
    exportBtn.addEventListener('click', () => downloadCSV('ifess-clients.csv',
        ['clientId', 'clientName', 'machineName', 'environment', 'appVersion', 'status', 'lastHeartbeatAt'],
        clientsCache.map(c => [c.clientId, c.clientName, c.machineName, c.environment, c.appVersion, c.status, c.lastHeartbeatAt])));
    bar.appendChild(exportBtn);
    sec.appendChild(bar);

    const card = el('div', { cls: 'card' });
    const tbl = dataTable(['Client', 'Status', 'Machine', 'Env', 'Version', 'Heartbeat', ''], { numeric: [] });
    card.appendChild(tbl.wrap);

    async function fill() {
        clientsCache = await rpc('listClients');
        const q = search.value.trim().toLowerCase();
        clear(tbl.tbody);
        const rows = clientsCache.filter(c =>
            !q || [c.clientId, c.clientName, c.machineName, c.environment].some(v => String(v || '').toLowerCase().includes(q)));
        for (const c of rows) {
            const tr = el('tr', { cls: 'rowlink' });
            tr.addEventListener('click', () => openClientDrawer(c.clientId));
            tr.appendChild(el('td', { html: `<b>${esc(c.clientName || c.clientId)}</b><div class="mono dim">${esc(c.clientId)}</div>` }));
            const stTd = el('td'); stTd.appendChild(statusBadge(c.status)); tr.appendChild(stTd);
            tr.appendChild(el('td', { text: c.machineName || '—' }));
            tr.appendChild(el('td', { text: c.environment || '—' }));
            tr.appendChild(el('td', { text: c.appVersion || '—', cls: 'mono' }));
            tr.appendChild(el('td', { text: fmtAgo(c.lastHeartbeatAt), cls: 'mono dim' }));
            const actTd = el('td');
            const ping = el('button', { cls: 'btn sm', text: 'Ping' });
            ping.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                const un = busy(ping);
                try {
                    await rpc('createCommand', { clientId: c.clientId, commandType: 'Ping', moduleCode: null, payload: {} });
                    toast(`Ping queued → ${c.clientId}`, 'okk');
                } catch (e) { toast(e.message, 'err'); }
                un();
            });
            actTd.appendChild(ping);
            tr.appendChild(actTd);
            tbl.tbody.appendChild(tr);
        }
        if (!rows.length) tbl.tbody.appendChild(emptyRow(7, q ? 'No clients match' : 'No clients registered'));
    }
    search.addEventListener('input', () => fill());
    await fill();
    sec.appendChild(card);
}

async function openClientDrawer(clientId) {
    openDrawer(clientId);
    const body = $('drawer-body');

    const client = clientsCache.find(c => c.clientId === clientId) || await rpc('getClient', { clientId });
    const head = el('div');
    head.appendChild(el('div', { html: `<b style="font-size:var(--text-lg);">${esc(client.clientName || clientId)}</b>` }));
    const stWrap = el('div', { style: 'margin-top:6px;display:flex;gap:8px;' });
    stWrap.appendChild(statusBadge(client.status));
    if (client.environment) stWrap.appendChild(el('span', { cls: 'badge b-info', text: client.environment }));
    head.appendChild(stWrap);
    body.appendChild(head);

    body.appendChild(el('h3', { text: 'Identity', style: 'font-size:var(--text-sm);color:var(--color-ink-muted);font-family:var(--font-data);text-transform:uppercase;letter-spacing:.08em;' }));
    body.appendChild(kvGrid([
        ['Client ID', client.clientId],
        ['Machine', client.machineName],
        ['App version', client.appVersion],
        ['OS', client.os],
        ['Registered', fmtWhen(client.createdAt)],
        ['Last heartbeat', `${fmtWhen(client.lastHeartbeatAt)} (${fmtAgo(client.lastHeartbeatAt)})`],
    ]));

    // Modules
    body.appendChild(el('h3', { text: 'Modules', style: 'font-size:var(--text-sm);color:var(--color-ink-muted);font-family:var(--font-data);text-transform:uppercase;letter-spacing:.08em;' }));
    const mods = await rpc('getModuleStatuses', { clientId });
    const modsWrap = el('div', { cls: 'table-wrap' });
    const modsTbl = el('table');
    (Array.isArray(mods) ? mods : []).forEach(m => {
        const tr = el('tr');
        tr.appendChild(el('td', { html: `<span class="mono">${esc(m.moduleCode)}</span>` }));
        const st = el('td'); st.appendChild(statusBadge(m.status)); tr.appendChild(st);
        tr.appendChild(el('td', { text: m.pid ? `pid ${m.pid}` : '—', cls: 'mono dim' }));
        tr.appendChild(el('td', { text: m.restartCount ? `↻${m.restartCount}` : '', cls: 'mono dim' }));
        modsTbl.appendChild(tr);
    });
    if (!(Array.isArray(mods) ? mods.length : 0)) modsWrap.appendChild(el('div', { cls: 'empty', text: 'No module reports yet' }));
    else modsWrap.appendChild(modsTbl);
    body.appendChild(modsWrap);

    // Recent commands
    body.appendChild(el('h3', { text: 'Recent commands', style: 'font-size:var(--text-sm);color:var(--color-ink-muted);font-family:var(--font-data);text-transform:uppercase;letter-spacing:.08em;' }));
    const cmds = await rpc('listCommands', { clientId, status: null });
    const cmdList = Array.isArray(cmds) ? cmds.slice(0, 8) : [];
    const cmdTl = el('ul', { cls: 'tl' });
    for (const c of cmdList) {
        const li = el('li', { cls: String(c.status).toLowerCase() === 'completed' ? 'ok' : (String(c.status).toLowerCase() === 'failed' ? 'bad' : '') });
        li.appendChild(el('span', { cls: 'tick' }));
        const d = el('div');
        d.appendChild(el('div', { html: `<span class="mono">${esc(c.commandType)}</span> ${c.moduleCode ? `<span class="dim">· ${esc(c.moduleCode)}</span>` : ''}` }));
        d.appendChild(el('div', { text: `${c.status} · ${fmtWhen(c.createdAt)}${c.message ? ' · ' + c.message : ''}`, cls: 'when' }));
        li.appendChild(d);
        cmdTl.appendChild(li);
    }
    if (!cmdList.length) cmdTl.appendChild(el('li', { html: '<span class="tick"></span><div class="dim">No commands yet</div>' }));
    body.appendChild(cmdTl);

    // Actions
    const actions = el('div', { cls: 'chips' });
    const restartAll = el('button', { cls: 'btn danger', text: '⟳ Restart all modules' });
    restartAll.addEventListener('click', async () => {
        const un = busy(restartAll);
        try {
            const modsArr = Array.isArray(mods) ? mods : [];
            for (const m of modsArr) {
                await rpc('createCommand', { clientId, commandType: 'RestartModule', moduleCode: m.moduleCode, payload: {} });
            }
            toast(`Restart queued for ${modsArr.length} modules`, 'okk');
        } catch (e) { toast(e.message, 'err'); }
        un();
    });
    actions.appendChild(restartAll);
    body.appendChild(actions);
}

// ── Modules (fleet-wide grid) ────────────────────────────────────────────────

async function loadModules() {
    const sec = $('page-modules');
    clear(sec);
    const [clients, statuses] = await Promise.all([rpc('listClients'), api('/api/module-statuses')]);
    const byModule = new Map();
    for (const s of (Array.isArray(statuses) ? statuses : [])) {
        if (!byModule.has(s.moduleCode)) byModule.set(s.moduleCode, []);
        byModule.get(s.moduleCode).push(s);
    }

    if (!byModule.size) {
        sec.appendChild(el('div', { cls: 'card', html: '<div class="empty">No module reports yet — clients will populate this grid after their first heartbeat</div>' }));
        return;
    }

    for (const [code, reports] of [...byModule.entries()].sort()) {
        const card = el('div', { cls: 'card' });
        const running = reports.filter(r => String(r.status).toLowerCase() === 'running').length;
        card.appendChild(el('div', { cls: 'card-head', html: `<h2><span class="mono">${esc(code)}</span></h2><span class="hint">${running}/${reports.length} running</span>` }));
        const tbl = dataTable(['Client', 'Status', 'PID', 'Restarts', 'Last error', 'Updated']);
        for (const r of reports) {
            const tr = el('tr');
            const c = clients.find(x => x.clientId === r.clientId);
            tr.appendChild(el('td', { text: c?.clientName || r.clientId }));
            const st = el('td'); st.appendChild(statusBadge(r.status)); tr.appendChild(st);
            tr.appendChild(el('td', { text: r.pid || '—', cls: 'mono' }));
            tr.appendChild(el('td', { text: r.restartCount || 0, cls: 'num' }));
            tr.appendChild(el('td', { text: r.lastError || '—', cls: 'dim', style: 'max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }));
            tr.appendChild(el('td', { text: fmtAgo(r.updatedAt), cls: 'mono dim' }));
            tbl.tbody.appendChild(tr);
        }
        card.appendChild(tbl.wrap);
        sec.appendChild(card);
    }
}

// ── Commands ─────────────────────────────────────────────────────────────────

let cmdFilter = 'All';

async function loadCommands() {
    const sec = $('page-commands');
    clear(sec);

    const bar = el('div', { cls: 'field-row', style: 'margin-bottom:var(--space-lg);' });
    const chips = el('div', { cls: 'chips' });
    bar.appendChild(chips);
    const newBtn = el('button', { cls: 'btn primary', text: '+ New command' });
    newBtn.addEventListener('click', () => openNewCommand());
    bar.appendChild(newBtn);
    const exportBtn = el('button', { cls: 'btn', text: '⭳ CSV' });
    exportBtn.addEventListener('click', () => downloadCSV('ifess-commands.csv',
        ['commandId', 'clientId', 'commandType', 'moduleCode', 'status', 'message', 'createdAt'],
        cmdCache.map(c => [c.commandId, c.clientId, c.commandType, c.moduleCode, c.status, c.message, c.createdAt])));
    bar.appendChild(exportBtn);
    sec.appendChild(bar);

    const card = el('div', { cls: 'card' });
    const tbl = dataTable(['Command', 'Client', 'Type', 'Module', 'Status', 'Created', 'Message']);
    card.appendChild(tbl.wrap);
    sec.appendChild(card);

    async function fill() {
        cmdCache = await rpc('listCommands', { clientId: null, status: cmdFilter === 'All' ? null : cmdFilter });
        clear(tbl.tbody);
        for (const c of cmdCache.slice(0, 200)) {
            const tr = el('tr');
            tr.appendChild(el('td', { text: c.commandId, cls: 'mono dim' }));
            tr.appendChild(el('td', { text: c.clientId }));
            tr.appendChild(el('td', { text: c.commandType, cls: 'mono' }));
            tr.appendChild(el('td', { text: c.moduleCode || '—' }));
            const st = el('td'); st.appendChild(statusBadge(c.status)); tr.appendChild(st);
            tr.appendChild(el('td', { text: fmtWhen(c.createdAt), cls: 'mono dim' }));
            tr.appendChild(el('td', { text: c.message || '—', cls: 'dim', style: 'max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }));
            tbl.tbody.appendChild(tr);
        }
        if (!cmdCache.length) tbl.tbody.appendChild(emptyRow(7, 'No commands'));
    }

    clear(chips);
    for (const f of ['All', 'Pending', 'Sent', 'Completed', 'Failed', 'Expired']) {
        const ch = el('button', { cls: `chip ${cmdFilter === f ? 'is-on' : ''}`, text: f });
        ch.addEventListener('click', () => { cmdFilter = f; loadCommands(); });
        chips.appendChild(ch);
    }
    await fill();
}

let cmdCache = [];

function openNewCommand() {
    openDrawer('New command');
    const body = $('drawer-body');
    const form = el('div', { style: 'display:flex;flex-direction:column;gap:var(--space-lg);' });

    const fClient = el('div', { cls: 'field' });
    fClient.appendChild(el('label', { text: 'Target client' }));
    const selClient = el('select');
    for (const c of clientsCache) selClient.appendChild(el('option', { text: `${c.clientName || c.clientId}`, attrs: { value: c.clientId } }));
    fClient.appendChild(selClient);
    form.appendChild(fClient);

    const fType = el('div', { cls: 'field' });
    fType.appendChild(el('label', { text: 'Command type' }));
    const selType = el('select');
    for (const t of ['StartModule', 'StopModule', 'RestartModule', 'Ping', 'UpdateConfig', 'RunBackup', 'KillProcess']) {
        selType.appendChild(el('option', { text: t, attrs: { value: t } }));
    }
    fType.appendChild(selType);
    form.appendChild(fType);

    const fModule = el('div', { cls: 'field' });
    fModule.appendChild(el('label', { text: 'Module code (optional)' }));
    const inModule = el('input', { attrs: { placeholder: 'IFESS_AUTO_TASK_KILL' } });
    fModule.appendChild(inModule);
    form.appendChild(fModule);

    const fPayload = el('div', { cls: 'field' });
    fPayload.appendChild(el('label', { text: 'Payload (JSON)' }));
    const inPayload = el('textarea', { text: '{}' });
    fPayload.appendChild(inPayload);
    form.appendChild(fPayload);

    const send = el('button', { cls: 'btn primary', text: 'Dispatch command' });
    send.addEventListener('click', async () => {
        const un = busy(send);
        try {
            const payload = JSON.parse(inPayload.value || '{}');
            const cmd = await rpc('createCommand', {
                clientId: selClient.value,
                commandType: selType.value,
                moduleCode: inModule.value.trim() || null,
                payload,
            });
            toast(`Dispatched ${cmd.commandId}`, 'okk');
            closeDrawer();
        } catch (e) { toast(e.message.includes('JSON') ? 'Payload is not valid JSON' : e.message, 'err'); }
        un();
    });
    form.appendChild(send);
    body.appendChild(form);
    if (!clientsCache.length) rpc('listClients').then(cs => {
        clientsCache = cs;
        clear(selClient);
        for (const c of clientsCache) selClient.appendChild(el('option', { text: c.clientName || c.clientId, attrs: { value: c.clientId } }));
    });
}
