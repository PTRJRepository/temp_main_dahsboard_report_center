/* IFESS Control — Query views (console/templates/batches) + governance (groups/audit/sync) */
'use strict';

// ── Query Console v2 ─────────────────────────────────────────────────────────

let cmEditor = null;
let pollTimer = null;

async function initQueryPage() {
    const sec = $('page-query');
    if (!sec.dataset.built) {
        buildQueryPage(sec);
        sec.dataset.built = '1';
    }
    await refreshQueryTargets();
}

function buildQueryPage(sec) {
    clear(sec);
    const grid = el('div', { cls: 'qgrid' });

    // ── Left column: editor + targeting
    const left = el('div');

    const editorCard = el('div', { cls: 'card' });
    editorCard.appendChild(el('div', { cls: 'card-head', html: '<h2>Query</h2><span class="hint" id="q-valid"></span>' }));
    const editorBody = el('div', { cls: 'card-body' });
    const cmHost = el('textarea');
    editorBody.appendChild(cmHost);
    const toolbar = el('div', { cls: 'field-row', style: 'margin-top:var(--space-md);' });

    const validateBtn = el('button', { cls: 'btn', text: '✓ Validate' });
    validateBtn.addEventListener('click', async () => {
        const un = busy(validateBtn);
        try {
            const res = await rpc('validateQuery', {});
            setValid(true, 'read-only ✓');
        } catch { /* fallthrough to REST below */ }
        un();
        try {
            const r = await fetch('/api/query-gateway/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ queryText: cmEditor.getValue() }) });
            const j = await r.json();
            setValid(j.valid !== false && !j.error, j.valid === false ? (j.errors || ['rejected']).join('; ') : 'read-only ✓');
        } catch (e) { setValid(false, e.message); }
    });

    async function dispatchNow() {
        const un = busy(dispatchBtn);
        try {
            const batch = await dispatchBatch();
            toast(`Batch ${batch.queryBatchId} → ${batch.totalTarget} client(s)`, 'okk');
            startPolling(batch.queryBatchId);
        } catch (e) { toast(e.message, 'err'); }
        un();
    }

    const dispatchBtn = el('button', { cls: 'btn primary', text: '▶ Dispatch' });
    dispatchBtn.addEventListener('click', dispatchNow);
    toolbar.appendChild(el('div', { style: 'margin-right:auto;' }));
    toolbar.appendChild(validateBtn);
    toolbar.appendChild(dispatchBtn);
    editorBody.appendChild(toolbar);
    editorCard.appendChild(editorBody);
    left.appendChild(editorCard);

    // Targeting card
    const targetCard = el('div', { cls: 'card' });
    targetCard.appendChild(el('div', { cls: 'card-head', html: '<h2>Targets</h2>' }));
    const tBody = el('div', { cls: 'card-body', style: 'display:flex;flex-direction:column;gap:var(--space-md);' });

    const modeRow = el('div', { cls: 'chips', id: 'target-modes' });
    let targetMode = 'All';
    for (const m of ['All', 'Group', 'Selected']) {
        const ch = el('button', { cls: `chip ${m === 'All' ? 'is-on' : ''}`, text: m, attrs: { 'data-mode': m } });
        ch.addEventListener('click', () => {
            targetMode = m;
            modeRow.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-on', c.dataset.mode === m));
            groupField.style.display = m === 'Group' ? '' : 'none';
            pickField.style.display = m === 'Selected' ? '' : 'none';
        });
        modeRow.appendChild(ch);
    }
    tBody.appendChild(modeRow);

    const groupField = el('div', { cls: 'field', style: 'display:none;' });
    groupField.appendChild(el('label', { text: 'Client group' }));
    const selGroup = el('select', { attrs: { id: 'qc-group' } });
    groupField.appendChild(selGroup);
    tBody.appendChild(groupField);

    const pickField = el('div', { cls: 'field', style: 'display:none;' });
    pickField.appendChild(el('label', { text: 'Clients' }));
    const checks = el('div', { cls: 'checks', attrs: { id: 'qc-clients' } });
    pickField.appendChild(checks);
    tBody.appendChild(pickField);

    const limits = el('div', { cls: 'field-row' });
    const fRows = el('div', { cls: 'field', style: 'max-width:120px;' });
    fRows.appendChild(el('label', { text: 'Max rows' }));
    const inRows = el('input', { attrs: { type: 'number', value: '1000', min: '1', max: '100000' } });
    fRows.appendChild(inRows);
    limits.appendChild(fRows);
    const fTimeout = el('div', { cls: 'field', style: 'max-width:120px;' });
    fTimeout.appendChild(el('label', { text: 'Timeout (s)' }));
    const inTimeout = el('input', { attrs: { type: 'number', value: '30', min: '5', max: '300' } });
    fTimeout.appendChild(inTimeout);
    limits.appendChild(fTimeout);
    const fName = el('div', { cls: 'field', style: 'flex:1;min-width:160px;' });
    fName.appendChild(el('label', { text: 'Name' }));
    const inName = el('input', { attrs: { placeholder: 'Ad-hoc query' } });
    fName.appendChild(inName);
    limits.appendChild(fName);
    tBody.appendChild(limits);
    targetCard.appendChild(tBody);
    left.appendChild(targetCard);
    grid.appendChild(left);

    // ── Right column: results
    const right = el('div');
    const resultCard = el('div', { cls: 'card' });
    resultCard.appendChild(el('div', { cls: 'card-head', html: '<h2>Results</h2><span class="hint" id="batch-id"></span>' }));
    const rBody = el('div', { cls: 'card-body', attrs: { id: 'qc-results' } });
    rBody.appendChild(el('div', { cls: 'empty', text: 'Dispatch a query to see per-client results' }));
    resultCard.appendChild(rBody);
    right.appendChild(resultCard);
    grid.appendChild(right);

    sec.appendChild(grid);

    // CodeMirror init
    cmEditor = CodeMirror.fromTextArea(cmHost, {
        mode: 'sql',
        theme: 'monokai',
        lineNumbers: true,
        indentWithTabs: true,
        smartIndent: true,
    });
    cmEditor.setSize('100%', '300px');
    cmEditor.setValue('-- Ctrl/Cmd+Enter to dispatch\nSELECT FIRST 10 * FROM RDB$RELATIONS');

    cmEditor.addKeyMap({
        'Ctrl-Enter': () => dispatchBtn.click(),
        'Cmd-Enter': () => dispatchBtn.click(),
    });

    // expose for polling code
    sec._qc = { get queryText() { return cmEditor.getValue(); }, maxRows: inRows, timeout: inTimeout, name: inName, mode: () => targetMode, group: selGroup, checks };
    sec._setBatchId = (id) => { $('batch-id').textContent = id || ''; };
}

async function dispatchBatch() {
    const qc = $('page-query')._qc;
    const params = {
        queryName: qc.name.value.trim() || 'Ad-hoc Query',
        queryText: qc.queryText,
        targetMode: qc.mode(),
        targetGroup: qc.mode() === 'Group' ? qc.group.value || null : null,
        targetClientIds: qc.mode() === 'Selected'
            ? [...qc.checks.querySelectorAll('input:checked')].map(i => i.value)
            : undefined,
        maxRows: parseInt(qc.maxRows.value, 10) || 1000,
        timeoutSeconds: parseInt(qc.timeout.value, 10) || 30,
        requestedBy: ME?.name || 'console',
    };
    return rpc('dispatch', params);
}

function setValid(ok, msg) {
    const hint = $('q-valid');
    hint.textContent = msg || '';
    hint.style.color = ok ? 'var(--color-success)' : 'var(--color-danger)';
}

// ── Live batch polling ───────────────────────────────────────────────────────

function startPolling(batchId) {
    clearInterval(pollTimer);
    const sec = $('page-query');
    sec._setBatchId(batchId);
    const tick = async () => {
        try {
            const batch = await api(`/api/query-gateway/batches/${encodeURIComponent(batchId)}`);
            renderBatchProgress(batch);
            const done = batch.jobs?.every(j => ['Success', 'Failed', 'Rejected', 'Timeout'].includes(j.status)) ?? false;
            if (done) {
                clearInterval(pollTimer);
                renderBatchResults(batch);
            }
        } catch (e) { clearInterval(pollTimer); toast(e.message, 'err'); }
    };
    tick();
    pollTimer = setInterval(tick, 1500);
}

function renderBatchProgress(batch) {
    const box = $('qc-results');
    clear(box);
    const jobs = batch.jobs || [];
    const done = jobs.filter(j => ['Success', 'Failed', 'Rejected', 'Timeout'].includes(j.status)).length;
    const meta = el('div', { cls: 'result-meta' });
    meta.appendChild(statusBadge(batch.status));
    meta.appendChild(el('span', { cls: 'mono dim', text: `${done}/${jobs.length} finished · ${batch.successCount || 0} ok · ${batch.failedCount || 0} failed` }));
    box.appendChild(meta);
    const prog = el('div', { cls: 'progress' });
    const bar = el('i');
    bar.style.width = jobs.length ? `${Math.round((done / jobs.length) * 100)}%` : '0%';
    prog.appendChild(bar);
    box.appendChild(prog);
}

function renderBatchResults(batch) {
    const box = $('qc-results');
    clear(box);
    const meta = el('div', { cls: 'result-meta' });
    meta.appendChild(statusBadge(batch.status));
    meta.appendChild(el('span', { cls: 'mono dim', text: `${batch.successCount || 0} ok · ${batch.failedCount || 0} failed · ${batch.rejectedCount || 0} rejected · ${batch.timeoutCount || 0} timeout` }));
    box.appendChild(meta);

    const tabs = el('div', { cls: 'tabs' });
    const panes = el('div');
    const resultsByJob = new Map((batch.results || []).map(r => [r.queryJobId, r]));
    let firstShown = false;

    for (const job of batch.jobs || []) {
        const clientLabel = job.targetClientId;
        const tab = el('button', { cls: `tab${!firstShown ? ' is-active' : ''}`, text: clientLabel });
        const pane = el('div', { style: firstShown ? 'display:none;' : '' });
        firstShown = true;

        const res = resultsByJob.get(job.queryJobId);
        const jm = el('div', { cls: 'result-meta' });
        jm.appendChild(statusBadge(job.status));
        if (job.executionTimeMs != null) jm.appendChild(el('span', { cls: 'mono dim', text: `${job.executionTimeMs} ms` }));
        jm.appendChild(el('span', { cls: 'mono dim', text: `${job.rowCount || 0} rows${job.isTruncated ? ' (truncated)' : ''}` }));
        if (res && (res.rows || []).length) {
            const exp = el('button', { cls: 'btn sm', text: '⭳ CSV' });
            exp.addEventListener('click', () => downloadCSV(`result-${clientLabel}.csv`, res.headers || [], res.rows || []));
            jm.appendChild(exp);
        }
        pane.appendChild(jm);

        if (job.errorMessage) pane.appendChild(el('div', { cls: 'badge b-bad', text: job.errorMessage, style: 'margin-bottom:8px;display:inline-flex;' }));
        if (res && (res.rows || []).length) {
            const tbl = dataTable(res.headers.map(h => ({ text: String(h), toString: () => String(h) })) .map(String), { numeric: [] });
            // simpler: rebuild header labels directly
            clear(tbl.wrap.querySelector('thead'));
            const thead = el('thead'); const hr = el('tr');
            (res.headers || []).forEach(h => hr.appendChild(el('th', { text: String(h) })));
            thead.appendChild(hr); tbl.wrap.querySelector('table').appendChild(thead);
            for (const row of res.rows.slice(0, 500)) {
                const tr = el('tr');
                for (const cell of row) tr.appendChild(el('td', { text: cell == null ? '' : String(cell), cls: 'csv-cell' }));
                tbl.tbody.appendChild(tr);
            }
            if (res.rows.length > 500) tbl.tbody.appendChild(emptyRow(res.headers.length, `Showing first 500 of ${res.rows.length} rows — export CSV for full data`));
            pane.appendChild(tbl.wrap);
        } else if (!job.errorMessage) {
            pane.appendChild(el('div', { cls: 'empty', text: 'No rows returned' }));
        }
        tab.addEventListener('click', () => {
            tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('is-active'));
            tab.classList.add('is-active');
            [...panes.children].forEach(p => p.style.display = 'none');
            pane.style.display = '';
        });
        tabs.appendChild(tab);
        panes.appendChild(pane);
    }
    box.appendChild(tabs);
    box.appendChild(panes);
}

async function refreshQueryTargets() {
    const qc = $('page-query')._qc;
    if (!qc) return;
    const [clients, groups] = await Promise.all([
        rpc('listClients'),
        rpc('listClientGroups').catch(() => []),
    ]);
    clear(qc.checks);
    for (const c of clients) {
        const lbl = el('label');
        const cb = el('input', { attrs: { type: 'checkbox', value: c.clientId } });
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(c.clientName || c.clientId));
        qc.checks.appendChild(lbl);
    }
    clear(qc.group);
    for (const g of (Array.isArray(groups) ? groups : [])) {
        qc.group.appendChild(el('option', { text: g.groupName || g.groupCode, attrs: { value: g.groupCode } }));
    }
}

// ── Templates CRUD ───────────────────────────────────────────────────────────

async function loadTemplates() {
    const sec = $('page-templates');
    clear(sec);
    const templates = await api('/api/query-gateway/templates');

    const bar = el('div', { cls: 'field-row', style: 'margin-bottom:var(--space-lg);' });
    const newBtn = el('button', { cls: 'btn primary', text: '+ New template' });
    newBtn.addEventListener('click', () => openTemplateDrawer());
    bar.appendChild(newBtn);
    sec.appendChild(bar);

    const card = el('div', { cls: 'card' });
    const tbl = dataTable(['Code', 'Name', 'Max rows', 'Timeout', 'Tags', 'Updated', ''], { numeric: [2, 3] });
    for (const t of (Array.isArray(templates) ? templates : [])) {
        const tr = el('tr', { cls: 'rowlink' });
        tr.addEventListener('click', () => openTemplateDrawer(t));
        tr.appendChild(el('td', { text: t.templateCode, cls: 'mono' }));
        tr.appendChild(el('td', { html: `<b>${esc(t.templateName)}</b>${t.description ? `<div class="dim" style="font-size:var(--text-xs);">${esc(t.description)}</div>` : ''}` }));
        tr.appendChild(el('td', { text: t.defaultMaxRows, cls: 'num' }));
        tr.appendChild(el('td', { text: `${t.defaultTimeoutSeconds}s`, cls: 'num' }));
        tr.appendChild(el('td', { text: (t.tags || []).join(', ') || '—', cls: 'mono dim' }));
        tr.appendChild(el('td', { text: fmtAgo(t.updatedAt), cls: 'mono dim' }));
        const actTd = el('td');
        const run = el('button', { cls: 'btn sm', text: 'Run' });
        run.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            showPage('query');
            setTimeout(() => {
                cmEditor.setValue(t.queryText || '');
                toast(`Loaded template ${t.templateCode}`, 'okk');
            }, 80);
        });
        actTd.appendChild(run);
        const del = el('button', { cls: 'btn sm danger', text: 'Delete' });
        del.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            if (!confirm(`Delete template ${t.templateCode}?`)) return;
            try {
                await api(`/api/query-gateway/templates/${encodeURIComponent(t.templateCode)}`, { method: 'DELETE' });
                toast('Deleted', 'okk');
                loadTemplates();
            } catch (e) { toast(e.message, 'err'); }
        });
        actTd.appendChild(del);
        tr.appendChild(actTd);
        tbl.tbody.appendChild(tr);
    }
    if (!(Array.isArray(templates) ? templates.length : 0)) tbl.tbody.appendChild(emptyRow(7, 'No templates — create one'));
    card.appendChild(tbl.wrap);
    sec.appendChild(card);
}

function openTemplateDrawer(t) {
    openDrawer(t ? `Edit ${t.templateCode}` : 'New template');
    const body = $('drawer-body');
    const form = el('div', { style: 'display:flex;flex-direction:column;gap:var(--space-lg);' });

    const mk = (label, val, opts = {}) => {
        const f = el('div', { cls: 'field' });
        f.appendChild(el('label', { text: label }));
        const input = el(opts.area ? 'textarea' : 'input', { text: opts.area ? (val || '') : undefined });
        if (!opts.area) input.value = val == null ? '' : String(val);
        else input.textContent = val || '';
        f.appendChild(input);
        form.appendChild(f);
        return input;
    };

    const code = mk('Code', t?.templateCode || '');
    const name = mk('Name', t?.templateName || '');
    const desc = mk('Description', t?.description || '');
    const qtext = mk('SQL', t?.queryText || '', { area: true });
    const maxr = mk('Default max rows', t?.defaultMaxRows ?? 1000);
    const tout = mk('Default timeout (s)', t?.defaultTimeoutSeconds ?? 30);

    const save = el('button', { cls: 'btn primary', text: t ? 'Save changes' : 'Create template' });
    save.addEventListener('click', async () => {
        const un = busy(save);
        const payload = {
            templateCode: code.value.trim(),
            templateName: name.value.trim() || code.value.trim(),
            description: desc.value.trim() || null,
            queryText: qtext.textContent || qtext.value || '',
            defaultMaxRows: parseInt(maxr.value, 10) || 1000,
            defaultTimeoutSeconds: parseInt(tout.value, 10) || 30,
            createdBy: ME?.name || 'console',
        };
        try {
            if (t) await api(`/api/query-gateway/templates/${encodeURIComponent(t.templateCode)}`, { method: 'PUT', body: JSON.stringify(payload) });
            else await api('/api/query-gateway/templates', { method: 'POST', body: JSON.stringify(payload) });
            toast(t ? 'Template updated' : 'Template created', 'okk');
            closeDrawer();
            loadTemplates();
        } catch (e) { toast(e.message, 'err'); }
        un();
    });
    form.appendChild(save);
    body.appendChild(form);
}

// ── Batches history ──────────────────────────────────────────────────────────

async function loadBatches() {
    const sec = $('page-batches');
    clear(sec);
    const batches = await api('/api/query-gateway/batches');

    const card = el('div', { cls: 'card' });
    const tbl = dataTable(['Batch', 'Name', 'Status', 'Targets', 'OK / Failed', 'Created']);
    for (const b of (Array.isArray(batches) ? batches : []).slice().reverse().slice(-100)) {
        const tr = el('tr', { cls: 'rowlink' });
        tr.addEventListener('click', () => viewBatch(b.queryBatchId));
        tr.appendChild(el('td', { text: b.queryBatchId, cls: 'mono dim' }));
        tr.appendChild(el('td', { text: b.queryName }));
        const st = el('td'); st.appendChild(statusBadge(b.status)); tr.appendChild(st);
        tr.appendChild(el('td', { text: b.totalTarget, cls: 'num' }));
        tr.appendChild(el('td', { html: `<span class="mono" style="color:var(--color-success)">${b.successCount || 0}</span> / <span class="mono" style="color:var(--color-danger)">${b.failedCount || 0}</span>` }));
        tr.appendChild(el('td', { text: fmtWhen(b.createdAt), cls: 'mono dim' }));
        tbl.tbody.appendChild(tr);
    }
    if (!(Array.isArray(batches) ? batches.length : 0)) tbl.tbody.appendChild(emptyRow(6, 'No batches yet'));
    card.appendChild(tbl.wrap);
    sec.appendChild(card);
}

async function viewBatch(batchId) {
    openDrawer(batchId);
    const body = $('drawer-body');
    try {
        const batch = await api(`/api/query-gateway/batches/${encodeURIComponent(batchId)}`);
        body.appendChild(kvGrid([
            ['Name', batch.queryName],
            ['Status', (() => { const w = el('span'); w.appendChild(statusBadge(batch.status)); return w; })()],
            ['Requested by', batch.requestedBy],
            ['Targets', batch.totalTarget],
            ['Created', fmtWhen(batch.createdAt)],
            ['Completed', fmtWhen(batch.completedAt)],
        ]));
        const pre = el('pre', { cls: 'mono dim', text: batch.queryText || '', style: 'white-space:pre-wrap;background:var(--color-paper);padding:12px;border-radius:var(--radius-xs);border:var(--rule-hairline);font-size:var(--text-xs);max-height:180px;overflow:auto;' });
        body.appendChild(pre);
        for (const job of batch.jobs || []) {
            const wrap = el('div');
            const head = el('div', { cls: 'result-meta' });
            head.appendChild(el('b', { text: job.targetClientId, style: 'font-size:var(--text-sm);' }));
            head.appendChild(statusBadge(job.status));
            if (job.executionTimeMs != null) head.appendChild(el('span', { cls: 'mono dim', text: `${job.executionTimeMs}ms · ${job.rowCount || 0} rows` }));
            wrap.appendChild(head);
            if (job.errorMessage) wrap.appendChild(el('div', { cls: 'badge b-bad', text: job.errorMessage }));
            body.appendChild(wrap);
        }
    } catch (e) { body.appendChild(el('div', { cls: 'empty', text: e.message })); }
}

// ── Groups CRUD ──────────────────────────────────────────────────────────────

async function loadGroups() {
    const sec = $('page-groups');
    clear(sec);
    const groups = await rpc('listClientGroups');

    const bar = el('div', { cls: 'field-row', style: 'margin-bottom:var(--space-lg);' });
    const newBtn = el('button', { cls: 'btn primary', text: '+ New group' });
    newBtn.addEventListener('click', () => openGroupDrawer());
    bar.appendChild(newBtn);
    sec.appendChild(bar);

    const grid = el('div', { cls: 'grid-2' });
    for (const g of (Array.isArray(groups) ? groups : [])) {
        const card = el('div', { cls: 'card' });
        card.appendChild(el('div', { cls: 'card-head', html: `<h2><b>${esc(g.groupName || g.groupCode)}</b> <span class="mono dim">${esc(g.groupCode)}</span></h2>` }));
        const body = el('div', { cls: 'card-body' });
        const members = g.clients || [];
        body.appendChild(el('div', { cls: 'hint', text: `${members.length} member(s)`, style: 'margin-bottom:8px;font-family:var(--font-data);font-size:10px;color:var(--color-ink-muted);text-transform:uppercase;' }));
        const chipsBox = el('div', { cls: 'chips' });
        for (const cid of members) {
            const chip = el('span', { cls: 'chip', text: cid });
            chipsBox.appendChild(chip);
        }
        if (!members.length) chipsBox.appendChild(el('span', { cls: 'dim', text: 'No members' }));
        body.appendChild(chipsBox);
        const actions = el('div', { cls: 'chips', style: 'margin-top:var(--space-md);' });
        const edit = el('button', { cls: 'btn sm', text: 'Edit' });
        edit.addEventListener('click', () => openGroupDrawer(g));
        actions.appendChild(edit);
        const del = el('button', { cls: 'btn sm danger', text: 'Delete' });
        del.addEventListener('click', async () => {
            if (!confirm(`Delete group ${g.groupCode}?`)) return;
            try { await rpc('deleteClientGroup', { groupCode: g.groupCode }); toast('Deleted', 'okk'); loadGroups(); }
            catch (e) { toast(e.message, 'err'); }
        });
        actions.appendChild(del);
        body.appendChild(actions);
        card.appendChild(body);
        grid.appendChild(card);
    }
    if (!(Array.isArray(groups) ? groups.length : 0)) sec.appendChild(el('div', { cls: 'card', html: '<div class="empty">No groups yet</div>' }));
    sec.appendChild(grid);
}

async function openGroupDrawer(g) {
    openDrawer(g ? `Edit ${g.groupCode}` : 'New group');
    const body = $('drawer-body');
    const form = el('div', { style: 'display:flex;flex-direction:column;gap:var(--space-lg);' });

    const fCode = el('div', { cls: 'field' });
    fCode.appendChild(el('label', { text: 'Group code' }));
    const inCode = el('input', { text: '' });
    if (g) inCode.value = g.groupCode;
    if (g) inCode.disabled = true;
    fCode.appendChild(inCode);
    form.appendChild(fCode);

    const fNameF = el('div', { cls: 'field' });
    fNameF.appendChild(el('label', { text: 'Display name' }));
    const inName = el('input');
    if (g) inName.value = g.groupName || '';
    fNameF.appendChild(inName);
    form.appendChild(fNameF);

    const fMembers = el('div', { cls: 'field' });
    fMembers.appendChild(el('label', { text: 'Members' }));
    const checks = el('div', { cls: 'checks' });
    const clients = clientsCache.length ? clientsCache : await rpc('listClients');
    const current = new Set(g?.clients || []);
    for (const c of clients) {
        const lbl = el('label');
        const cb = el('input', { attrs: { type: 'checkbox', value: c.clientId } });
        cb.checked = current.has(c.clientId);
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(c.clientName || c.clientId));
        checks.appendChild(lbl);
    }
    fMembers.appendChild(checks);
    form.appendChild(fMembers);

    const save = el('button', { cls: 'btn primary', text: g ? 'Save group' : 'Create group' });
    save.addEventListener('click', async () => {
        const un = busy(save);
        const selected = [...checks.querySelectorAll('input:checked')].map(i => i.value);
        try {
            let code = inCode.value.trim();
            if (!g) {
                const created = await rpc('createClientGroup', { groupCode: code, groupName: inName.value.trim() || code });
                if (!created.success) throw new Error(created.error || 'create failed');
            } else {
                await rpc('updateClientGroup', { groupCode: code, groupName: inName.value.trim(), clients: selected });
            }
            // sync membership deltas
            const before = new Set(g?.clients || []);
            for (const cid of selected) if (!before.has(cid)) await rpc('addClientToGroup', { groupCode: code, clientId: cid });
            for (const cid of (g?.clients || [])) if (!selected.includes(cid)) await rpc('removeClientFromGroup', { groupCode: code, clientId: cid });
            toast('Group saved', 'okk');
            closeDrawer();
            loadGroups();
        } catch (e) { toast(e.message, 'err'); }
        un();
    });
    form.appendChild(save);
    body.appendChild(form);
}

// ── Audit ────────────────────────────────────────────────────────────────────

async function loadAudit() {
    const sec = $('page-audit');
    clear(sec);
    const logs = await rpc('listAuditLogs', {});
    const entries = Array.isArray(logs) ? logs.slice().reverse() : [];

    const bar = el('div', { cls: 'field-row', style: 'margin-bottom:var(--space-lg);' });
    const search = el('input', { attrs: { type: 'search', placeholder: 'Filter action / actor / object…', style: 'max-width:340px;' } });
    bar.appendChild(search);
    const exportBtn = el('button', { cls: 'btn', text: '⭳ CSV' });
    exportBtn.addEventListener('click', () => downloadCSV('ifess-audit.csv',
        ['timestamp', 'actorName', 'action', 'objectType', 'objectId', 'status'],
        entries.map(a => [a.timestamp, a.actorName, a.action, a.objectType, a.objectId, a.status])));
    bar.appendChild(exportBtn);
    sec.appendChild(bar);

    const card = el('div', { cls: 'card' });
    const tl = el('ul', { cls: 'tl' });
    card.appendChild(tl);
    sec.appendChild(card);

    function fill() {
        clear(tl);
        const q = search.value.trim().toLowerCase();
        const shown = entries.filter(a =>
            !q || [a.action, a.actorName, a.objectType, a.objectId].some(v => String(v || '').toLowerCase().includes(q))).slice(-150).reverse();
        for (const a of shown) {
            const li = el('li', { cls: String(a.status).toLowerCase() === 'success' ? 'ok' : 'bad' });
            li.appendChild(el('span', { cls: 'tick' }));
            const d = el('div');
            d.appendChild(el('div', { html: `<b>${esc(a.action)}</b> <span class="dim">on</span> <span class="mono">${esc(a.objectType)}${a.objectId ? '·' + esc(a.objectId) : ''}</span> <span class="dim">by</span> ${esc(a.actorName || a.actorId || 'system')}${a.ipAddress ? ` <span class="mono dim">${esc(a.ipAddress)}</span>` : ''}` }));
            d.appendChild(el('div', { text: fmtWhen(a.timestamp), cls: 'when' }));
            li.appendChild(d);
            tl.appendChild(li);
        }
        if (!shown.length) tl.appendChild(el('li', { html: '<span class="tick"></span><div class="dim">No matching entries</div>' }));
    }
    search.addEventListener('input', fill);
    fill();
}

// ── Sync ─────────────────────────────────────────────────────────────────────

async function loadSync() {
    const sec = $('page-sync');
    clear(sec);

    const trigCard = el('div', { cls: 'card' });
    trigCard.appendChild(el('div', { cls: 'card-head', html: '<h2>Firebird → SQL bootstrap</h2>' }));
    const tBody = el('div', { cls: 'card-body' });
    const row = el('div', { cls: 'field-row' });
    const fDiv = el('div', { cls: 'field', style: 'min-width:220px;' });
    fDiv.appendChild(el('label', { text: 'Division' }));
    const selDiv = el('select');
    fDiv.appendChild(selDiv);
    row.appendChild(fDiv);
    const go = el('button', { cls: 'btn primary', text: '⇄ Bootstrap' });
    row.appendChild(go);
    tBody.appendChild(row);
    trigCard.appendChild(tBody);
    sec.appendChild(trigCard);

    const histCard = el('div', { cls: 'card' });
    histCard.appendChild(el('div', { cls: 'card-head', html: '<h2>Sync jobs</h2>' }));
    const tbl = dataTable(['Job', 'Division', 'Mode', 'Status', 'Started', 'Finished']);
    histCard.appendChild(tbl.wrap);
    sec.appendChild(histCard);

    async function fillJobs() {
        const jobs = await rpc('listSyncJobs', { limit: 50 });
        clear(tbl.tbody);
        for (const j of (Array.isArray(jobs) ? jobs : [])) {
            const tr = el('tr');
            tr.appendChild(el('td', { text: j.syncJobId, cls: 'mono dim' }));
            tr.appendChild(el('td', { text: j.divisionCode || '—' }));
            tr.appendChild(el('td', { text: j.mode || '—', cls: 'mono' }));
            const st = el('td'); st.appendChild(statusBadge(j.status)); tr.appendChild(st);
            tr.appendChild(el('td', { text: fmtWhen(j.startedAt), cls: 'mono dim' }));
            tr.appendChild(el('td', { text: fmtWhen(j.finishedAt), cls: 'mono dim' }));
            tbl.tbody.appendChild(tr);
        }
        if (!(Array.isArray(jobs) ? jobs.length : 0)) tbl.tbody.appendChild(emptyRow(6, 'No sync jobs yet'));
    }

    try {
        const divs = await rpc('listSyncDivisions');
        clear(selDiv);
        for (const d of (Array.isArray(divs) ? divs : [])) {
            selDiv.appendChild(el('option', { text: d.divisionName || d.divisionCode, attrs: { value: d.divisionCode } }));
        }
    } catch { /* optional */ }

    go.addEventListener('click', async () => {
        const un = busy(go);
        try {
            const job = await rpc('syncBootstrap', { divisionCode: selDiv.value, requestedBy: ME?.name || 'console' });
            toast(`Bootstrap ${job.syncJobId} started`, 'okk');
            fillJobs();
        } catch (e) { toast(e.message, 'err'); }
        un();
    });

    await fillJobs();
}
