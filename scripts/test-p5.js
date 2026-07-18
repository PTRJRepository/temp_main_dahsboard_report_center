// Test Phase 1 + Phase 5 endpoints
const http = require('http');

const fetchUrl = (url, headers = {}) => new Promise((resolve) => {
    const u = new URL(url);
    const opts = { hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: 'GET', headers };
    const req = http.request(opts, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', e => resolve({ status: 0, body: e.message }));
    req.end();
});

const test = async (label, url, headers = {}) => {
    const r = await fetchUrl(url, headers);
    const short = r.body.length > 80 ? r.body.slice(0, 80) + '...' : r.body;
    console.log(`${label}: ${r.status} | ${short}`);
};

(async () => {
    // Start gateway in background using spawn
    const { spawn } = require('child_process');
    const bg = spawn('cmd.exe', ['/c', 'bun run server_bun.js'], {
        cwd: 'D:/Gawean Rebinmas/Main Dashboard',
        env: { ...process.env, START_DASHBOARD: 'false' },
        detached: true,
        stdio: 'ignore'
    });
    bg.unref();

    await new Promise(r => setTimeout(r, 4000));

    await test('/health/live', 'http://localhost:3001/health/live');
    await test('/health/ready', 'http://localhost:3001/health/ready');
    await test('/version', 'http://localhost:3001/version');
    await test('/health (legacy)', 'http://localhost:3001/health');
    await test('/backend/upah (no key) -> 401', 'http://localhost:3001/backend/upah');
    await test('/backend/upah (wrong key) -> 403', 'http://localhost:3001/backend/upah', { 'x-api-key': 'wrong' });
    await test('/backend/upah (correct key) -> proxied', 'http://localhost:3001/backend/upah', { 'x-api-key': 'ptrj-upath-key' });
    await test('/query (no key) -> 401', 'http://localhost:3001/query');
    await test('/query (correct key) -> proxied', 'http://localhost:3001/query', { 'x-api-key': 'ptrj-query-gateway-key' });
    await test('/ifess (no key) -> 401', 'http://localhost:3001/ifess');
    await test('/ifess (correct key) -> proxied', 'http://localhost:3001/ifess', { 'x-api-key': 'ptrj-ifess-client-key' });
    await test('/api/ifess/health (public)', 'http://localhost:3001/api/ifess/health');

    // Kill bun processes on 3001
    spawn('taskkill', ['/F', '/IM', 'bun.exe'], { stdio: 'ignore' });
    console.log('\nDone');
})();
