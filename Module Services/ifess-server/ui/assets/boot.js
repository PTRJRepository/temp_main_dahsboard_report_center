/* IFESS Control — Boot */
'use strict';

let ME = null;

(async function boot() {
    // 1. Identity first — gate renders on 401.
    try {
        ME = await api('/api/ifess/me');
        $('me-chip').hidden = false;
        $('me-name').textContent = ME.name || ME.userId || '?';
        $('me-role').textContent = `${ME.role || '—'} · ${ME.source}`;
        $('me-av').textContent = (ME.name || '?').trim().charAt(0).toUpperCase();
    } catch (e) {
        if (e.code === 401) { renderGate(); return; }
    }

    // 2. Nav wiring
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => showPage(btn.dataset.page));
    });

    // 3. Drawer chrome
    $('veil').addEventListener('click', closeDrawer);
    $('drawer-close').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeDrawer(); });

    // 4. Health + deep-link + initial page
    checkGW();
    setInterval(checkGW, 10000);

    const initial = window.location.hash.replace('#', '');
    showPage(PAGES[initial] ? initial : 'overview');

    console.log('[IFESS] console ready as', ME?.name, `(${ME?.source})`);
})();
