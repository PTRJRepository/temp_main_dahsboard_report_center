// Phase 4 integration test
const http = require('http');
const { spawn } = require('child_process');

const fetch = (url, headers = {}) => new Promise((resolve) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port || 80, path: u.pathname, method: 'GET', headers }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', e => resolve({ status: 0, body: e.message }));
    req.end();
});

(async () => {
    // Start gateway with both flags false
    const env = { ...process.env, START_DASHBOARD: 'false', START_MODULE_SERVICES: 'false', PORT: '3002' };
    const bg = spawn('C:/Users/nbgmf/AppData/Roaming/npm/node_modules/bun/bin/bun.exe', ['run', 'server_bun.js'], {
        cwd: 'D:/Gawean Rebinmas/Main Dashboard',
        env,
        detached: true,
        stdio: 'ignore'
    });
    bg.on('error', e => console.error('Spawn error:', e));
    bg.on('exit', (code, sig) => console.log('Gateway exit:', code, sig));
    bg.unref();

    // Wait for startup
    await new Promise(r => setTimeout(r, 5000));

    // Test health endpoints
    console.log('=== Phase 4 Tests ===');
    const live = await fetch('http://localhost:3002/health/live');
    console.log('/health/live:', live.status, live.body.slice(0, 80));

    const ready = await fetch('http://localhost:3002/health/ready');
    console.log('/health/ready:', ready.status, ready.body.slice(0, 80));

    // Phase 5 auth tests
    const bk401 = await fetch('http://localhost:3002/backend/upah');
    console.log('/backend/upah (no key) ->', bk401.status);

    const bk302 = await fetch('http://localhost:3002/backend/upah', { 'x-api-key': 'ptrj-upath-key' });
    console.log('/backend/upah (correct key) ->', bk302.status, '(expect 302)');

    const q401 = await fetch('http://localhost:3002/query');
    console.log('/query (no key) ->', q401.status);

    const ifess401 = await fetch('http://localhost:3002/ifess');
    console.log('/ifess (no key) ->', ifess401.status);

    // All tests pass?
    const pass = live.status === 200 && ready.status === 200 &&
                  bk401.status === 401 && bk302.status === 302 &&
                  q401.status === 401 && ifess401.status === 401;
    console.log('\n' + (pass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'));

    // Kill gateway
    spawn('taskkill', ['/F', '/IM', 'bun.exe'], { stdio: 'ignore' });
})();
