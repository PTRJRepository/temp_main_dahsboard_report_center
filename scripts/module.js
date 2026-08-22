#!/usr/bin/env node
/**
 * module.js — pick-and-choose module service manager for Main Dashboard.
 *
 * Usage:
 *   node scripts/module.js list                 show all modules + ports + running state
 *   node scripts/module.js start <name> [...]   start one or more modules (background)
 *   node scripts/module.js stop <name>          stop a module by port owner
 *   node scripts/module.js status               health-check every enabled route
 *
 * Modules NOT started here stay off — the main dashboard (gateway) does not
 * require them; it only proxies to whichever ports are alive.
 */
const { spawn, execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// name → { dir, command, route } — ports live in routes-config.json (single
// source); `route` picks which entry supplies the port.
const MODULES = {
  'dashboard': { dir: 'Dashboard_Utama', cmd: ['npx', ['next', 'dev', '--hostname', '0.0.0.0', '-p', '3100']], port: '3100' },
  'report-center': { dir: 'Module Services/report-center', cmd: ['bun', ['run', 'dev']], route: 'report-center' },
  'server-monitor': { dir: 'Module Services/rebinmas-jaya-server', cmd: ['npm', ['run', 'dev']], route: 'server-monitor' },
  'rjfm': { dir: 'Module Services/rjfm', cmd: ['npx', ['tsx', 'src/server.ts']], route: 'rjfm' },
};

function portFor(name) {
  const m = MODULES[name];
  if (!m) return null;
  if (m.port) return m.port;
  const routes = JSON.parse(fs.readFileSync(path.join(ROOT, 'routes-config.json'), 'utf8'));
  const r = routes.find(x => x.id === m.route);
  if (!r) return null;
  try { return new URL(r.target).port || null; } catch { return null; }
}

function pidOnPort(port) {
  // port comes from routes-config.json (trusted config), not user input
  try {
    const out = execSync(`netstat -ano | findstr ":${port} " | findstr LISTENING`, { shell: 'cmd.exe' }).toString();
    const line = out.trim().split('\n').pop() || '';
    return parseInt(line.trim().split(/\s+/).pop(), 10) || null;
  } catch { return null; }
}

function isUp(port) {
  return Boolean(pidOnPort(port));
}

async function probe(url, timeoutMs = 1500) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    return r.ok || r.status < 500;
  } catch { clearTimeout(t); return false; }
}

function start(name) {
  const m = MODULES[name];
  if (!m) { console.error(`Unknown module '${name}'. Known: ${Object.keys(MODULES).join(', ')}`); process.exit(1); }
  const port = portFor(name);
  if (port && isUp(port)) { console.log(`[skip] ${name} already listening on :${port}`); return; }
  const log = fs.openSync(path.join(LOG_DIR, `module-${name}.log`), 'a');
  const child = spawn(m.cmd[0], m.cmd[1], { cwd: path.join(ROOT, m.dir), detached: true, stdio: ['ignore', log, log] });
  child.unref();
  console.log(`[start] ${name} (pid ${child.pid}) → logs/module-${name}.log`);
}

function stop(name) {
  const port = portFor(name);
  if (!port) { console.error(`No route/port for '${name}'`); process.exit(1); }
  const pid = pidOnPort(port);
  if (!pid) { console.log(`[skip] ${name}: nothing on :${port}`); return; }
  try { execSync(`taskkill /PID ${pid} /T /F`, { shell: 'cmd.exe' }); console.log(`[stop] ${name} killed pid ${pid}`); }
  catch (e) { console.error(`[stop] failed: ${e.message}`); }
}
// ponytail: netstat/taskkill via shell cmd — Windows CLI only, inputs from trusted
// routes-config.json; swap to PowerShell Get-NetTCPConnection if this grows.

async function status() {
  const routes = JSON.parse(fs.readFileSync(path.join(ROOT, 'routes-config.json'), 'utf8')).filter(r => r.enabled !== false && !r.hidden);
  for (const r of routes) {
    let target;
    try { target = new URL(r.target); } catch { console.log(`  --    ${r.path.padEnd(20)} (static/self)`); continue; }
    const up = await probe(`${target.protocol}//${target.hostname}:${target.port || ''}${r.healthPath || '/'}`);
    console.log(`  ${up ? 'UP  ' : 'DOWN'} ${r.path.padEnd(20)} ${r.target}`);
  }
}

const [cmd, ...args] = process.argv.slice(2);
(async () => {
  if (cmd === 'list' || !cmd) {
    for (const [name, m] of Object.entries(MODULES)) {
      const port = portFor(name) || '?';
      console.log(`  ${isUp(port) ? 'UP  ' : 'DOWN'} ${name.padEnd(16)} :${port}  (${m.dir})`);
    }
  } else if (cmd === 'start') args.forEach(start);
  else if (cmd === 'stop') args.forEach(stop);
  else if (cmd === 'status') await status();
  else { console.error('Usage: node scripts/module.js [list|start|stop|status] [names...]'); process.exit(1); }
})();
