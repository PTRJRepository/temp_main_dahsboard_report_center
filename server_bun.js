/**
 * Bun Native Proxy Gateway — high-performance reverse proxy
 * Equivalent to nginx in functionality, powered by Bun's native HTTP server
 *
 * Key optimizations vs Express:
 * - Native HTTP with zero middleware overhead
 * - LRU in-memory cache for static assets (F-004)
 * - Streaming passthrough for non-HTML content
 * - Connection pooling via keep-alive
 * - Compression pass-through for non-rewrite routes
 * - Bun.serve() for maximum throughput
 *
 * Run: bun run server_bun.js
 * Dev: bun --watch run server_bun.js
 */

// ─── ESM Imports (must be at top) ────────────────────────────────────────────
import { readFileSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { verifyJWTCached, extractToken } from './shared/auth/jwt.js';
import {
    isProtectedPath, isDashboardPublicPath, isDashboardPath,
    redirectToLogin, wantsJson,
} from './shared/auth/paths.js';
import { createMonitoring } from './shared/monitoring/index.js';
import { platform } from 'node:os';


// ─── Load .env BEFORE any process.env usage ──────────────────────────────────
const env = process.env.NODE_ENV || 'development';
try {
    const dotenv = await import('dotenv');
    try {
        dotenv.config({ path: resolve(import.meta.dir, `.env.${env}`) });
    } catch {
        try {
            dotenv.config({ path: resolve(import.meta.dir, '.env') });
        } catch { /* dotenv optional */ }
    }
} catch { /* dotenv optional */ }

const ROOT_DIR = import.meta.dir;
// Verbose per-request logging — off by default (synchronous console.log on every
// request blocks the event loop under load). Set LOG_VERBOSE=1 to enable.
const LOG_VERBOSE = process.env.LOG_VERBOSE === '1';
const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.HOST || '0.0.0.0';
const DASHBOARD_DIR = `${ROOT_DIR}/Dashboard_Utama`;
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT || '3100');
// Portal binds loopback only: LAN users must go through the gateway (:3001) —
// direct portal access would bypass the auth center.
const DASHBOARD_HOST = process.env.DASHBOARD_HOST || '127.0.0.1';
const DASHBOARD_TARGET = process.env.DASHBOARD_TARGET || `http://127.0.0.1:${DASHBOARD_PORT}`;
const START_DASHBOARD = process.env.START_DASHBOARD !== 'false';
// Module services are NEVER auto-started by the gateway — they run externally
// (own process/port). This flag only gates a stub; kept for clarity.
const START_MODULE_SERVICES = process.env.START_MODULE_SERVICES === 'true';
const NETWORK_MONITOR_DIR = `${ROOT_DIR}/Module Services/Wifi_LAN_Monitor/reference-design`;
const CACHE_MAX_SIZE = 50;
const CACHE_TTL_MS = 5 * 60 * 1000;
const GATEWAY_IDLE_TIMEOUT_SECONDS = parseInt(process.env.GATEWAY_IDLE_TIMEOUT_SECONDS || '120');

// ─── LRU Cache Implementation ─────────────────────────────────────────────────
class LRUCache {
    #cache = new Map();
    #maxSize;
    #ttl;

    constructor(maxSize = CACHE_MAX_SIZE, ttlMs = CACHE_TTL_MS) {
        this.#maxSize = maxSize;
        this.#ttl = ttlMs;
    }

    get(key) {
        const entry = this.#cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expires) {
            this.#cache.delete(key);
            return null;
        }
        this.#cache.delete(key);
        this.#cache.set(key, entry);
        return entry.value;
    }

    set(key, value) {
        if (this.#cache.size >= this.#maxSize) {
            const firstKey = this.#cache.keys().next().value;
            this.#cache.delete(firstKey);
        }
        this.#cache.set(key, { value, expires: Date.now() + this.#ttl });
    }

    clear() { this.#cache.clear(); }
    get size() { return this.#cache.size; }
}

// Static asset cache — long TTL, keyed by path + query
const assetCache = new LRUCache(CACHE_MAX_SIZE * 2, 30 * 60 * 1000);

// ─── Auth: JWT verification + path protection (extracted to shared/auth/) ──────
// Cached RS256 verify — browsers resend the same cookie on every request, so
// repeated verifies hit the in-memory payload cache instead of the CPU.
const verifyJwtForRoot = (token) => verifyJWTCached(token, ROOT_DIR);

// ─── IFESS Control Server Handler (Bun Native) ─────────────────────────────────
// API keys are env-sourced only — no hardcoded fallback. Dev values live in
// .env.development (gitignored). Production MUST set all three or the gateway
// refuses to boot. Rotation tracked in docs/14-security/SEC-Credential-Rotation-Plan.md.
const IFESS_API_KEY = process.env.IFESS_API_KEY;
const QUERY_API_KEY = process.env.QUERY_API_KEY;
const IFESS_CLIENT_API_KEY = process.env.IFESS_CLIENT_API_KEY;
if (process.env.NODE_ENV === 'production') {
    if (!IFESS_API_KEY || !QUERY_API_KEY || !IFESS_CLIENT_API_KEY) {
        throw new Error('FATAL: IFESS_API_KEY, QUERY_API_KEY, and IFESS_CLIENT_API_KEY must be set in production.');
    }
}

function getServerTime() { return new Date().toISOString(); }

function validateApiKey(req) {
    const key = req.headers.get('x-api-key');
    if (!key || !IFESS_API_KEY) return false;
    return key === IFESS_API_KEY;
}

function jsonResp(status, body) {
    const data = JSON.stringify(body);
    return new Response(data, { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

function clampPercent(value) {
    const number = Number.isFinite(value) ? value : 0;
    return Math.max(0, Math.min(100, Math.round(number)));
}

function bytesToGiB(value) {
    return Math.round((value / 1024 / 1024 / 1024) * 10) / 10;
}

function formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

function runPowerShell(command, timeoutMs = 2500) {
    if (process.platform !== 'win32') return null;

    try {
        return execFileSync('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            command,
        ], {
            encoding: 'utf8',
            timeout: timeoutMs,
            windowsHide: true,
        }).trim();
    } catch {
        return null;
    }
}

async function runPowerShellAsync(command, timeoutMs = 3500) {
    if (process.platform !== 'win32') return null;

    try {
        const proc = Bun.spawn({
            cmd: [
                'powershell.exe',
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy',
                'Bypass',
                '-Command',
                command,
            ],
            stdout: 'pipe',
            stderr: 'ignore',
        });
        const timeout = setTimeout(() => {
            try { proc.kill(); } catch { /* process already exited */ }
        }, timeoutMs);
        const text = await new Response(proc.stdout).text();
        await proc.exited;
        clearTimeout(timeout);
        return text.trim() || null;
    } catch {
        return null;
    }
}

function parseJsonMaybe(value, fallback) {
    if (!value) return fallback;
    try {
        const parsed = JSON.parse(value);
        if (parsed === null || parsed === undefined) return fallback;
        return parsed;
    } catch {
        return fallback;
    }
}

// ─── LAN monitoring (extracted to shared/monitoring) ────────────────────────
const monitoring = createMonitoring({
    rootDir: ROOT_DIR,
    getServerTime,
    jsonResp,
    runPowerShell,
    runPowerShellAsync,
    parseJsonMaybe,
    clampPercent,
    bytesToGiB,
    formatDuration,
});



// Routes hot-reload: if routes-config.json mtime changes, reload the table and
// rebuild derived artifacts (rewrite regexes, static roots). Cheap stat every 5s.
let _routesMtime = 0;
try { _routesMtime = statSync(routesConfigPath).mtimeMs; } catch { /* file gone? */ }
setInterval(() => {
    try {
        const m = statSync(routesConfigPath).mtimeMs;
        if (m !== _routesMtime) {
            _routesMtime = m;
            const configuredRoutes = JSON.parse(readFileSync(routesConfigPath, 'utf-8'))
                .filter(r => r.enabled !== false)
                .flatMap(route => [
                    route,
                    ...(Array.isArray(route.aliases)
                        ? route.aliases.map(alias => ({
                            ...route,
                            id: `${route.id}:${alias}`,
                            path: alias,
                            rewritePath: false,
                            staticRoots: [],
                            spaIndex: undefined,
                            hidden: true,
                        }))
                        : []),
                ]);
            routesConfig = configuredRoutes.sort((a, b) => b.path.length - a.path.length);
            refreshRouteDerivedArtifacts();
            console.log(`[routes] hot-reloaded ${routesConfig.length} routes`);
        }
    } catch (e) {
        console.error(`[routes] hot-reload failed: ${e.message}`);
    }
}, 5000);

// ─── Routes Configuration ─────────────────────────────────────────────────────
const routesConfigPath = `${ROOT_DIR}/routes-config.json`;
let routesConfig = [];

try {
    const raw = readFileSync(routesConfigPath, 'utf-8');
    const configuredRoutes = JSON.parse(raw)
        .filter(r => r.enabled !== false)
        .flatMap(route => [
            route,
            ...(Array.isArray(route.aliases)
                ? route.aliases.map(alias => ({
                    ...route,
                    id: `${route.id}:${alias}`,
                    path: alias,
                    rewritePath: false,
                    staticRoots: [],
                    spaIndex: undefined,
                    hidden: true,
                }))
                : []),
        ]);
    routesConfig = configuredRoutes
        .sort((a, b) => b.path.length - a.path.length);
    console.log(`Loaded ${routesConfig.length} routes from routes-config.json`);
} catch (e) {
    console.error(`Failed to load routes-config.json: ${e.message}`);
    process.exit(1);
}

// Artifacts derived from the route table; rebuilt whenever the config file
// changes on disk (mtime hot-reload — previously regexes/staticRoots were
// built once at boot and went stale after route edits).
let routeDerived = null;
function refreshRouteDerivedArtifacts() {
    // Rewrite regexes derived from the live route table (was a hardcoded
    // service-name list — stale whenever a route was added/renamed).
    const pathAlts = routesConfig.map(r => r.path.replace(/^\//, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    REWRITE_PATTERNS.length = 0;
    REWRITE_PATTERNS.push(
        { from: /https?:\/\/localhost:8002\//g, to: '/upah/' },
        { from: /https?:\/\/localhost:5176\//g, to: '/absen/' },
        { from: /https?:\/\/localhost:5177\//g, to: '/monitoring-beras/' },
        { from: /https?:\/\/localhost:5178\//g, to: '/file/' },
        { from: /https?:\/\/localhost:8003\//g, to: '/ifess/' },
        { from: new RegExp(`src="(/(?!${pathAlts}|backend|assets|dashboard|src|@vite|node_modules)[^"]*)"`, 'g'), to: 'src="/dashboard$1"' },
        { from: new RegExp(`href="(/(?!${pathAlts}|backend|assets|dashboard|src|@vite|node_modules)[^"]*)"`, 'g'), to: 'href="/dashboard$1"' },
        { from: /ws:\/\/localhost:\d+/g, to: `ws://localhost:${PORT}` },
    );
    staticRoots = [
        ...routesConfig.flatMap(normalizeStaticRoots),
        ...DEFAULT_STATIC_ROOTS,
    ].sort((a, b) => b.prefix.length - a.prefix.length);
}

// ─── URL Rewriting Utilities ──────────────────────────────────────────────────
const REWRITE_PATTERNS = [];

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteBody(body, routePath, routeTarget) {
    if (typeof body !== 'string' && !(body instanceof Uint8Array)) return body;
    const text = typeof body === 'string' ? body : new TextDecoder().decode(body);

    if (!text.includes('localhost:8002') &&
        !text.includes('localhost:5176') &&
        !text.includes('localhost:5177') &&
        !text.includes('localhost:5178') &&
        !text.includes('localhost:8003') &&
        !/["'(=]\s*\/(?!\/)/.test(text) &&
        (routePath === '/upah' || !text.includes('/upah/'))) {
        return text;
    }

    let result = text;
    if (routeTarget) {
        result = result.replace(new RegExp(escapeRegExp(routeTarget), 'g'), routePath);
    }

    for (const { from, to } of REWRITE_PATTERNS) {
        result = result.replace(from, to);
    }

    if (routePath !== '/') {
        result = result.replace(/(<script[^>]+src=["']\s*)\/(?!\/)/gi, `$1${routePath}/`);
        result = result.replace(/(<link[^>]+href=["']\s*)\/(?!\/)/gi, `$1${routePath}/`);
        result = result.replace(/(<img[^>]+src=["']\s*)\/(?!\/)/gi, `$1${routePath}/`);
        result = result.replace(/(<a[^>]+href=["']\s*)\/(?!\/)/gi, `$1${routePath}/`);
        result = result.replace(/from\s+(["'])\/(?!\/)/g, `from $1${routePath}/`);
        result = result.replace(/import\s+(["'])\/(?!\/)/g, `import $1${routePath}/`);
        result = result.replace(/fetch\((["'])\/(?!\/)/g, `fetch($1${routePath}/`);
        result = result.replace(/url\((["']?)\/(?!\/)/g, `url($1${routePath}/`);
        result = result.replace(/(["'])\/@vite\//g, `$1${routePath}/@vite/`);
        result = result.replace(/(["'])\/@react-refresh/g, `$1${routePath}/@react-refresh`);
        result = result.replace(/(["'])\/@id\//g, `$1${routePath}/@id/`);
        result = result.replace(/(["'])\/@fs\//g, `$1${routePath}/@fs/`);
        result = result.replace(/(["'])\/src\//g, `$1${routePath}/src/`);
        result = result.replace(/(["'])\/node_modules\//g, `$1${routePath}/node_modules/`);
        result = result.replace(/(["'])\/assets\//g, `$1${routePath}/assets/`);
        result = result.split(`${routePath}${routePath}/`).join(`${routePath}/`);
    }

    if (routePath !== '/upah') {
        result = result.replace(/\/upah\//g, `${routePath}/`);
    }
    return result;
}

function rewriteViteDevResponse(text, routePath) {
    if (routePath === '/') return text;

    return text
        .replace(/(["'`])\/@vite\//g, `$1${routePath}/@vite/`)
        .replace(/(["'`])\/@react-refresh/g, `$1${routePath}/@react-refresh`)
        .replace(/(["'`])\/@id\//g, `$1${routePath}/@id/`)
        .replace(/(["'`])\/@fs\//g, `$1${routePath}/@fs/`)
        .replace(/(["'`])\/src\//g, `$1${routePath}/src/`)
        .replace(/(["'`])\/node_modules\//g, `$1${routePath}/node_modules/`)
        .replace(/(["'`])\/assets\//g, `$1${routePath}/assets/`)
        .replace(/(from\s+["'`])\/(?!\/)/g, `$1${routePath}/`)
        .replace(/(import\(["'`])\/(?!\/)/g, `$1${routePath}/`)
        .split(`${routePath}${routePath}/`).join(`${routePath}/`);
}

// ─── Route Resolution ────────────────────────────────────────────────────────
function matchRoute(urlPath) {
    for (const route of routesConfig) {
        if (urlPath.startsWith(route.path)) return route;
    }
    return null;
}

function matchRouteFromReferer(req) {
    const referer = req.headers.get('referer') || '';
    if (!referer) return null;

    let refererPath = referer;
    try {
        refererPath = new URL(referer).pathname;
    } catch { /* keep raw header */ }

    return routesConfig.find(route =>
        route.enabled !== false &&
        isHttpTarget(route.target) &&
        (refererPath === route.path || refererPath.startsWith(`${route.path}/`))
    ) || null;
}

function isViteDevAssetPath(reqPath) {
    return reqPath === '/@vite/client' ||
        reqPath === '/@react-refresh' ||
        reqPath.startsWith('/@id/') ||
        reqPath.startsWith('/@fs/') ||
        reqPath.startsWith('/src/') ||
        reqPath.startsWith('/node_modules/.vite/') ||
        reqPath.startsWith('/node_modules/vite/');
}

function isHttpTarget(target) {
    return typeof target === 'string' && /^https?:///i.test(target);
}

// ─── Static File Utilities ───────────────────────────────────────────────────
const STATIC_EXTENSIONS_RE = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|webp|avif|map)$/;
const VERSION_HASH_RE = /-[a-f0-9]{6,}\.[a-z]+$/;

const DEFAULT_STATIC_ROOTS = [
    { prefix: '/assets', dir: `${DASHBOARD_DIR}/public/assets`, immutable: false },
];

function normalizeStaticRoots(route) {
    const configured = Array.isArray(route.staticRoots) ? route.staticRoots : [];
    return configured.map(root => ({
        ...root,
        textRewrites: root.textRewrites || route.textRewrites || [],
        dir: root.dir ? resolve(ROOT_DIR, root.dir) : undefined,
        file: root.file ? resolve(ROOT_DIR, root.file) : undefined,
    }));
}

let staticRoots = [];
try {
    refreshRouteDerivedArtifacts();
} catch { /* staticRoots stays empty → route staticRoots just won't match */ }

function getStaticFilePath(reqPath) {
    const root = staticRoots.find(item => reqPath === item.prefix || reqPath.startsWith(`${item.prefix}/`));
    if (!root) return null;

    if (root.file) return { path: root.file, root };

    const suffix = reqPath.slice(root.prefix.length).replace(/^\//, '');
    if (suffix.includes('..')) return null;
    return { path: suffix ? `${root.dir}/${suffix}` : root.dir, root };
}

function getCacheControl(reqPath, contentType = '') {
    const hasVersionHash = VERSION_HASH_RE.test(reqPath);
    const isJs = contentType.includes('javascript') || contentType.includes('application/javascript');
    const isCss = contentType.includes('text/css');
    const isImage = /\.(png|jpg|jpeg|gif|ico|svg|webp|avif)$/.test(reqPath);
    const isFont = /\.(woff2?|ttf|eot|otf)$/.test(reqPath);
    const isHtml = contentType.includes('text/html');

    if ((isJs || isCss) && hasVersionHash) return 'public, max-age=31536000, immutable';
    if (isJs || isCss) return 'public, max-age=3600';
    if (isImage) return hasVersionHash ? 'public, max-age=31536000, immutable' : 'public, max-age=604800';
    if (isFont) return 'public, max-age=31536000, immutable';
    if (isHtml) return 'no-cache, no-store, must-revalidate';
    return 'no-cache';
}

const REWRITABLE_TEXT_RE = /text\/html|javascript|text\/css|application\/json|text\/plain/;

async function serveLocalFile(filePath, reqPath, options = {}) {
    const file = Bun.file(filePath);
    if (!(await file.exists())) return null;

    const contentType = getMimeType(reqPath);
    const isVersioned = VERSION_HASH_RE.test(reqPath);
    const textRewrites = Array.isArray(options.textRewrites) ? options.textRewrites : [];

    // Stream the file object directly (zero-copy passthrough in Bun) unless
    // text rewrites force a buffered read. Memory: no arrayBuffer copy for
    // assets — large chunks never fully materialize on the JS heap.
    let body = file;
    if (textRewrites.length > 0 && REWRITABLE_TEXT_RE.test(contentType)) {
        let text = await file.text();
        for (const rewrite of textRewrites) {
            if (!rewrite?.from) continue;
            text = text.split(rewrite.from).join(rewrite.to || '');
        }
        body = new TextEncoder().encode(text);
    }

    const cacheControl = options.cacheControl || (isVersioned || options.immutable
        ? 'public, max-age=31536000, immutable'
        : getCacheControl(reqPath, contentType));

    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': contentType,
            'Content-Length': String(body === file ? file.size : body.byteLength),
            'Cache-Control': cacheControl,
            'Server': 'Bun-Proxy',
            'X-Proxy-Path': options.proxyPath || 'static-bypass',
        }
    });
}

function getNetworkMonitorFilePath(reqPath) {
    if (reqPath !== '/network-monitor' && !reqPath.startsWith('/network-monitor/')) return null;

    let suffix = decodeURIComponent(reqPath.slice('/network-monitor'.length)).replace(/^\/+/, '');
    suffix = suffix.replace(/\/$/, '');

    if (!suffix ||
        suffix === 'network' ||
        ['index', 'index.html', 'cable-trace', 'cable-trace.html', 'topology', 'topology.html', 'inventory', 'inventory.html'].includes(suffix)) {
        suffix = 'index.html';
    }

    if (suffix.includes('..') || suffix.includes('\\')) return null;
    return `${NETWORK_MONITOR_DIR}/${suffix}`;
}

async function serveNetworkMonitor(reqPath) {
    const filePath = getNetworkMonitorFilePath(reqPath);
    if (!filePath) return null;

    const cacheControl = filePath.endsWith('.html')
        ? 'no-cache, no-store, must-revalidate'
        : undefined;

    return serveLocalFile(filePath, filePath, {
        cacheControl,
        proxyPath: 'network-monitor-static',
    });
}

function isSpaNavigation(req, route, reqPath) {
    if (!route?.spaIndex) return false;
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    if (STATIC_EXTENSIONS_RE.test(reqPath)) return false;
    if (Array.isArray(route.apiPrefixes) && route.apiPrefixes.some(prefix => reqPath.startsWith(prefix))) return false;
    const accept = req.headers.get('accept') || '';
    return accept.includes('text/html') || accept.includes('*/*') || accept === '';
}

async function isUpstreamReady(target) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const response = await fetch(target, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        return response.status < 500;
    } catch {
        return false;
    }
}

// A Next.js dev server leaves fingerprints a production build never emits:
// `static/development/*` assets, the webpack HMR endpoint, and versioned chunk
// URLs (`main-app.js?v=<timestamp>` — prod chunks are content-hashed instead).
// Used to warn when a production gateway is about to silently adopt a dev
// portal on its port (proxying every request through the slow dev compiler).
const NEXT_DEV_MARKERS_RE = new RegExp([
    '_next/static/development/',
    '_next/webpack-hmr',
    '_next/static/chunks/[\\w./-]+\\.js\\?v=\\d+',
].join('|'));

async function upstreamLooksLikeDevServer(baseUrl) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) return false;
        return NEXT_DEV_MARKERS_RE.test(await response.text());
    } catch {
        return false;
    }
}

// ─── Portal (Dashboard_Utama) supervisor ─────────────────────────────────────
// The portal is a CHILD of the gateway, never a peer the operator manages:
// production runs its standalone build (instant start, no compiler); dev runs
// `next dev` for HMR. If it dies, it is respawned with exponential backoff —
// the gateway and every proxied module stay up regardless.
let _portalChild = null;
let _portalRespawnDelayMs = 3000;

function portalSpawnCmd() {
    const standaloneServer = process.env.DASHBOARD_STANDALONE
        || `${DASHBOARD_DIR}/.next/standalone/Dashboard_Utama/server.js`;
    if (process.env.NODE_ENV === 'production' && !process.env.DASHBOARD_DEV && existsSync(standaloneServer)) {
        return { cmd: [process.execPath, standaloneServer], kind: 'standalone' };
    }
    return {
        cmd: [process.execPath, 'run', 'dev', '--', '-p', String(DASHBOARD_PORT), '--hostname', DASHBOARD_HOST],
        cwd: DASHBOARD_DIR,
        kind: 'dev',
    };
}

function spawnPortalChild() {
    const spec = portalSpawnCmd();
    console.log(`[portal] starting (${spec.kind}) on ${DASHBOARD_HOST}:${DASHBOARD_PORT}...`);
    const child = Bun.spawn({
        cmd: spec.cmd,
        cwd: spec.cwd || ROOT_DIR,
        stdout: 'inherit',
        stderr: 'inherit',
        env: {
            ...process.env,
            HOST: DASHBOARD_HOST,
            PORT: String(DASHBOARD_PORT),
            HOSTNAME: DASHBOARD_HOST,
            NODE_ENV: process.env.NODE_ENV || 'development',
        },
    });
    _portalChild = child;
    process.on('exit', () => { try { child.kill(); } catch { /* already gone */ } });

    // Respawn watchdog with exponential backoff (3s → 6s → … cap 60s; reset on long uptime).
    child.exited.then(code => {
        _portalChild = null;
        if (_portalShuttingDown) return;
        console.error(`[portal] exited (code ${code}) — respawning in ${Math.round(_portalRespawnDelayMs / 1000)}s`);
        setTimeout(async () => {
            await spawnPortalChild();
            _portalRespawnDelayMs = Math.min(_portalRespawnDelayMs * 2, 60_000);
        }, _portalRespawnDelayMs);
    }).catch(() => {});
    return child;
}

let _portalShuttingDown = false;
async function startDashboardIfNeeded() {
    if (await isUpstreamReady(DASHBOARD_TARGET)) {
        console.log(`Portal upstream ready (external): ${DASHBOARD_TARGET}`);
        if (process.env.NODE_ENV === 'production' && await upstreamLooksLikeDevServer(DASHBOARD_TARGET)) {
            console.warn(`[portal] WARNING: ${DASHBOARD_TARGET} is served by a Next.js DEV server while the gateway runs in production mode.`);
            console.warn('[portal]          Traffic is proxied through the slow dev compiler. Restart the portal in prod mode:');
            console.warn('[portal]          powershell -ExecutionPolicy Bypass -File scripts/start-module-services.ps1 -IncludeDashboard');
        }
        return;
    }

    spawnPortalChild();

    for (let attempt = 0; attempt < 120; attempt += 1) {
        await Bun.sleep(500);
        if (await isUpstreamReady(DASHBOARD_TARGET)) {
            console.log(`Portal upstream ready: ${DASHBOARD_TARGET}`);
            _portalRespawnDelayMs = 3000;
            return;
        }
    }
    console.warn(`Portal upstream did not become ready yet: ${DASHBOARD_TARGET} (watchdog keeps retrying)`);
}

async function startModuleServicesIfNeeded() {
    // Module services run externally (own process/port). The gateway never
    // spawns them — it only proxies to their ports via routes-config.json.
    console.log('[startup] Module services are external — not started by gateway');
    return;
}
async function proxyDashboard(req, reqPath, search, user = null) {
    const targetUrl = `${DASHBOARD_TARGET}${reqPath}${search}`;
    // Identity transfer end-to-end: Bun fetch auto-decompresses any encoded
    // upstream body, so requesting gzip only buys a decompress pass at the
    // gateway before streaming plain bytes to the client anyway.
    const headers = buildProxyHeaders(req, { stripAcceptEncoding: true }, user);

    try {
        const response = await fetch(targetUrl, {
            headers,
            method: req.method,
            body: hasRequestBody(req.method) ? req.body : undefined,
            redirect: 'manual',
            signal: req.signal,
        });
        const responseHeaders = copyResponseHeaders(response.headers);
        responseHeaders.set('Server', 'Bun-Proxy');
        responseHeaders.set('X-Proxy-Upstream', 'dashboard');
        return new Response(response.body, { status: response.status, headers: responseHeaders });
    } catch (err) {
        console.error(`Dashboard proxy error: ${err.message}`);
        return new Response('Dashboard Service Unavailable', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Server': 'Bun-Proxy' },
        });
    }
}

function dashboardWsTarget(reqPath, search) {
    if (!reqPath.startsWith('/_next/webpack-hmr')) return null;
    return `${DASHBOARD_TARGET.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')}${reqPath}${search}`;
}

function proxyWsTarget(req, reqPath, search) {
    let route = matchRoute(reqPath);

    if (!route) {
        const referer = req.headers.get('referer') || '';
        route = routesConfig.find(item => item.enabled !== false && referer.includes(item.path));
    }

    if (!route?.target || !isHttpTarget(route.target)) return null;

    const targetPath = route.rewritePath === false
        ? reqPath
        : (reqPath.startsWith(route.path) ? (reqPath.slice(route.path.length) || '/') : reqPath);
    return `${route.target.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')}${targetPath}${search}`;
}

function isWebSocketRequest(req) {
    return (req.headers.get('upgrade') || '').toLowerCase() === 'websocket';
}

function hasRequestBody(method) {
    return method !== 'GET' && method !== 'HEAD';
}

// Identity headers injected into every proxied request. Inbound copies are
// ALWAYS stripped first — only the gateway (which verifies the RS256 cookie)
// may set these, so upstream modules can trust them as authenticated identity.
const USER_HEADER_NAMES = ['x-user-id', 'x-user-name', 'x-user-email', 'x-user-role'];
const HOP_BY_HOP_HEADERS = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade']);
const USER_HEADER_NAME_SET = new Set(USER_HEADER_NAMES);

function buildProxyHeaders(req, options = {}, user = null) {
    const headers = new Headers();
    for (const [key, value] of req.headers.entries()) {
        const lower = key.toLowerCase();
        if (HOP_BY_HOP_HEADERS.has(lower)) continue;
        if (lower === 'host') continue;
        if (USER_HEADER_NAME_SET.has(lower)) continue; // anti-spoof: strip inbound
        if (options.stripAcceptEncoding && lower === 'accept-encoding') continue;
        headers.set(key, value);
    }
    if (user) {
        if (user.userId != null) headers.set('X-User-Id', String(user.userId));
        if (user.name) headers.set('X-User-Name', user.name);
        if (user.email) headers.set('X-User-Email', user.email);
        if (user.role) headers.set('X-User-Role', user.role);
    }
    headers.set('X-Forwarded-For', req.headers.get('x-forwarded-for') || '127.0.0.1');
    headers.set('X-Forwarded-Host', req.headers.get('host') || `localhost:${PORT}`);
    headers.set('X-Real-IP', req.headers.get('x-real-ip') || '127.0.0.1');
    return headers;
}

const RESPONSE_HEADERS_TO_STRIP = new Set(['content-length', 'transfer-encoding', 'connection', 'content-encoding']);

function copyResponseHeaders(source) {
    const headers = new Headers();
    source.forEach((value, key) => {
        if (RESPONSE_HEADERS_TO_STRIP.has(key)) return;
        headers.set(key, value);
    });
    return headers;
}

// TCP reachability probe for /api/services/status (Bun.connect, 500ms cap).
async function checkTcpPort(hostname, port, timeoutMs = 500) {
    await Promise.race([
        Bun.connect({ hostname, port, socket: { data() {}, close() {}, error() {} } })
            .then(sock => { try { sock.end(); } catch { /* already closed */ } }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('tcp-timeout')), timeoutMs)),
    ]);
}

const serviceStatusCache = { at: 0, value: null };

// ─── HTTP Client Pre-warm ────────────────────────────────────────────────────
async function prewarmConnections() {
    const targets = [...new Set(routesConfig.map(r => r.target).filter(isHttpTarget))];
    console.log('Pre-warming connections to upstream services...');
    await Promise.allSettled(
        targets.map(async (target) => {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                await fetch(target, { signal: controller.signal, method: 'HEAD' });
                clearTimeout(timeout);
                console.log(`  Up: ${target}`);
            } catch {
                console.log(`  Down: ${target} (may not be running yet)`);
            }
        })
    );
}

// ─── Bun HTTP Server ─────────────────────────────────────────────────────────
async function proxyRequest(req, route, reqPath, search, user = null) {
    const targetPath = route.rewritePath === false
        ? reqPath
        : (reqPath.slice(route.path.length) || '/');
    const targetUrl = `${route.target}${targetPath}${search}`;
    const shouldRewriteContent = route.rewriteContent === true || route.rewriteContent === 'html-only';

    // ── Static Extension Fast-Path ──────────────────────────────────────────
    // Skip buffering entirely — serve as streaming passthrough
    if (STATIC_EXTENSIONS_RE.test(reqPath) && route.path === '/upah') {
        const fetchOptions = {
            headers: {},
            method: req.method,
            redirect: 'follow',
            signal: req.signal,
        };
        try {
            const response = await fetch(targetUrl, fetchOptions);
            const contentType = response.headers.get('content-type') || '';
            const cacheControl = getCacheControl(reqPath, contentType);
            const responseHeaders = new Headers();
            response.headers.forEach((value, key) => {
                if (['content-length', 'transfer-encoding'].includes(key)) return;
                responseHeaders.set(key, value);
            });
            responseHeaders.set('Cache-Control', cacheControl);
            responseHeaders.set('Server', 'Bun-Proxy');
            responseHeaders.set('X-Proxy-Path', 'static-bypass');
            return new Response(response.body, {
                status: response.status,
                headers: responseHeaders,
            });
        } catch { /* fall through to normal proxy */ }
    }

    const headers = buildProxyHeaders(req, { stripAcceptEncoding: true }, user);

    const startTime = Date.now();
    // Upstream always receives stripped accept-encoding → identity bodies only,
    // so client encoding needn't be part of the cache key.
    const cacheKey = `${req.method}:${reqPath}`;

    // 304 Not Modified — ETag conditional check before hitting upstream
    const upstreamETag = req.headers.get('if-none-match');

    // LRU cache hit for /upah GET requests (text only — no binary in cache)
    if (req.method === 'GET' && route.path === '/upah') {
        const cached = assetCache.get(cacheKey);
        if (cached) {
            // Return 304 if ETag matches (no body = instant response)
            if (upstreamETag && cached.etag && upstreamETag === cached.etag) {
                const responseHeaders = new Headers();
                responseHeaders.set('ETag', cached.etag);
                responseHeaders.set('Cache-Control', cached.headers['cache-control']);
                responseHeaders.set('Server', 'Bun-Proxy');
                return new Response(null, { status: 304, headers: responseHeaders });
            }
            const responseHeaders = new Headers();
            responseHeaders.set('Content-Type', cached.headers['content-type']);
            responseHeaders.set('Cache-Control', cached.headers['cache-control']);
            responseHeaders.set('Server', 'Bun-Proxy');
            if (cached.etag) responseHeaders.set('ETag', cached.etag);
            return new Response(cached.body, { status: cached.status, headers: responseHeaders });
        }
    }

    try {
        const fetchOptions = {
            headers,
            method: req.method,
            body: hasRequestBody(req.method) ? req.body : undefined,
            redirect: 'follow',
            signal: req.signal,
        };

        const response = await fetch(targetUrl, fetchOptions);
        const elapsed = Date.now() - startTime;
        const contentType = response.headers.get('content-type') || '';
        const cacheControl = getCacheControl(reqPath, contentType);

        // SLOW requests always logged; normal requests only when LOG_VERBOSE=1.
        if (elapsed > 500) {
            console.log(`SLOW ${req.method} ${route.path}${targetPath} → ${response.status} (${elapsed}ms)`);
        } else if (LOG_VERBOSE) {
            console.log(`${req.method} ${route.path}${targetPath} → ${response.status} (${elapsed}ms)`);
        }

        // ── Passthrough: streaming for non-rewrite routes ─────────────────────
        if (!shouldRewriteContent) {
            const responseHeaders = copyResponseHeaders(response.headers);
            responseHeaders.set('Cache-Control', cacheControl);
            responseHeaders.set('X-Proxy-Elapsed', `${elapsed}ms`);
            responseHeaders.set('Server', 'Bun-Proxy');
            responseHeaders.set('Vary', 'Accept-Encoding');

            return new Response(response.body, {
                status: response.status,
                headers: responseHeaders,
            });
        }

        if (route.rewriteContent === 'html-only' && !contentType.includes('text/html')) {
            const responseHeaders = copyResponseHeaders(response.headers);
            responseHeaders.set('Cache-Control', cacheControl);
            responseHeaders.set('X-Proxy-Elapsed', `${elapsed}ms`);
            responseHeaders.set('Server', 'Bun-Proxy');
            responseHeaders.set('Vary', 'Accept-Encoding');

            return new Response(response.body, {
                status: response.status,
                headers: responseHeaders,
            });
        }

        // ── Rewrite route: read, optionally rewrite, return concrete bytes ───
        const bodyBuffer = await response.arrayBuffer();
        const isText = contentType.includes('text/html') ||
            contentType.includes('text/plain') ||
            contentType.includes('application/javascript') ||
            contentType.includes('text/css');
        const isHtml = contentType.includes('text/html');

        // Binary: stream directly (no buffering overhead for large files)
        // NOTE: binary content is NOT cached — images/fonts served via static bypass path
        if (!isText) {
            const responseHeaders = copyResponseHeaders(response.headers);
            responseHeaders.set('Cache-Control', cacheControl);
            responseHeaders.set('X-Proxy-Elapsed', `${elapsed}ms`);
            responseHeaders.set('Server', 'Bun-Proxy');
            responseHeaders.set('X-Content-Type-Options', 'nosniff');

            return new Response(bodyBuffer, {
                status: response.status,
                headers: responseHeaders,
            });
        }

        // Text content: rewrite if needed
        const text = new TextDecoder().decode(bodyBuffer);
        const needsRewrite =
            route.rewriteContent === true && (
                text.includes('localhost:8002') ||
                text.includes('localhost:5176') ||
                text.includes('localhost:5177') ||
                text.includes('localhost:5178') ||
                text.includes('localhost:8003') ||
                text.includes('/upah/') ||
                (route.path !== '/' && /["'(=]\s*\/(?!\/)/.test(text))
            );

        let finalText = needsRewrite ? rewriteBody(text, route.path, route.target) : text;
        if (route.id === 'server-monitor') {
            finalText = rewriteViteDevResponse(finalText, route.path);
        }
        const finalBytes = new TextEncoder().encode(finalText);

        const responseHeaders = new Headers({
            'Content-Type': contentType || (isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8'),
            'Content-Length': String(finalBytes.byteLength),
            'Cache-Control': cacheControl,
            'X-Proxy-Elapsed': `${elapsed}ms`,
            'Server': 'Bun-Proxy',
            'Vary': 'Accept-Encoding',
        });

        ['etag', 'last-modified', 'expires'].forEach(h => {
            const v = response.headers.get(h);
            if (v) responseHeaders.set(h, v);
        });

        // Cache GET responses for /upah (text only — skip binary > 100KB)
        if (req.method === 'GET' && route.path === '/upah') {
            const isBinary = bodyBuffer.byteLength > 100 * 1024; // skip large binary
            if (!isBinary) {
                assetCache.set(cacheKey, {
                    body: finalBytes,
                    status: response.status,
                    headers: { 'content-type': contentType, 'cache-control': cacheControl },
                    etag: response.headers.get('etag') || null,
                });
            }
        }

        return new Response(finalBytes, {
            status: response.status,
            headers: responseHeaders,
        });

    } catch (err) {
        console.error(`Proxy error for ${route.path}: ${err.message}`);
        return new Response(JSON.stringify({ error: 'Proxy error', path: reqPath }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Proxy' }
        });
    }
}

// ─── Bun HTTP Server ─────────────────────────────────────────────────────────
console.log(`Bun Native Proxy Gateway starting on ${HOST}:${PORT}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'} | Bun v${Bun.version}`);

if (START_DASHBOARD) {
    await startDashboardIfNeeded();
} else {
    console.log('START_DASHBOARD=false — skipping dashboard upstream startup');
}

if (START_MODULE_SERVICES) { await startModuleServicesIfNeeded(); } else { console.log('[Phase 4] START_MODULE_SERVICES=false — skipping module services startup'); }
await prewarmConnections();
monitoring.startLanDiscoveryScheduler();

let server;
server = Bun.serve({
    port: PORT,
    hostname: HOST,
    idleTimeout: GATEWAY_IDLE_TIMEOUT_SECONDS,

    async fetch(req) {
        const url = new URL(req.url);
        const reqPath = url.pathname;

        // Phase 1: Canonical health endpoints
        if (reqPath === "/health/live" || reqPath === "/health/live/") {
            const rid = "req_"+Date.now().toString(36)+"_"+(1+Math.random()*999999|0).toString(36);
            return new Response(JSON.stringify({ ok: true, timestamp: new Date().toISOString(), service: "bun-gateway" }), {
                status: 200, headers: { "Content-Type": "application/json", "Server": "Bun-Gateway", "X-Request-ID": rid }
            });
        }
        if (reqPath === '/health/ready' || reqPath === '/health/ready/') {
            return new Response(JSON.stringify({ ok: true, version: "1.0.0", service: 'bun-gateway', initialized: true }), {
                status: 200, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway' }
            });
        }
        if (reqPath === '/version' || reqPath === '/version/') {
            return new Response(JSON.stringify({ gateway: '1.0.0', bun: process.versions.bun || 'unknown' }), {
                status: 200, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway' }
            });
        }

        // Root /health alias — client SetupForm TestServer hits BaseUrl + "health" (no /api/ifess).
        if (reqPath === '/health' || reqPath === '/health/') {
            return new Response(JSON.stringify({ status: 'Healthy', serverTime: getServerTime() }), {
                headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Proxy' }
            });
        }

        if (isWebSocketRequest(req)) {
            const upstreamUrl = dashboardWsTarget(reqPath, url.search) || proxyWsTarget(req, reqPath, url.search);
            if (upstreamUrl && server.upgrade(req, { data: { upstreamUrl, queue: [] } })) {
                return;
            }
            return new Response('WebSocket route not found', {
                status: 404,
                headers: { 'Server': 'Bun-Proxy' },
            });
        }

        if (reqPath === '/__gateway/health') {
            return new Response(JSON.stringify({
                ok: true,
                gateway: 'bun',
                dashboardTarget: DASHBOARD_TARGET,
                routes: routesConfig.map(route => ({ id: route.id, path: route.path, target: route.target, public: route.public === true })),
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Server': 'Bun-Proxy' },
            });
        }

        if (reqPath === '/logout') {
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': '/',
                    'Set-Cookie': 'auth-token=; Path=/; Max-Age=0; SameSite=Lax',
                    'Server': 'Bun-Proxy',
                }
            });
        }

        // ── Bun Native API Handlers (before route matching) ──────────────────
        // iFESS cut-over (2026-08-26): /api/clients, /api/ifess and
        // /api/query-gateway are NO LONGER hosted here. They are proxied to the
        // standalone Module Services/ifess-server (:8003) via routes-config.json
        // entries (ids: api-clients, api-ifess, api-query-gateway). The module
        // enforces X-API-Key / portal identity itself.
        // Runtime monitoring snapshot for Server Monitor and Network Monitor.
        if (reqPath === '/api/monitoring/host-labels') {
            const monitoringToken = extractToken(req.headers.get('cookie') || '');
            const monitoringUser = monitoringToken ? verifyJwtForRoot(monitoringToken) : null;
            if (!monitoringUser) return redirectToLogin(req, reqPath, url.search);

            if (req.method === 'GET') {
                const store = monitoring.loadHostLabels();
                const key = monitoring.getHostLabelKey({
                    ipAddress: url.searchParams.get('ipAddress') || url.searchParams.get('ip'),
                    macAddress: url.searchParams.get('macAddress') || url.searchParams.get('mac'),
                });
                return jsonResp(200, key
                    ? { success: true, label: store.labels[key] || null }
                    : { success: true, labels: store.labels });
            }

            if (req.method === 'POST') {
                const data = await req.json().catch(() => null);
                if (!data || typeof data !== 'object') return jsonResp(400, { success: false, error: 'Invalid JSON body' });
                const normalized = monitoring.normalizeHostLabelInput(data, monitoringUser);
                if (normalized.error) return jsonResp(400, { success: false, error: normalized.error });
                const store = monitoring.loadHostLabels();
                store.labels[normalized.label.key] = normalized.label;
                const saved = monitoring.saveHostLabels(store.labels);
                return jsonResp(200, { success: true, label: normalized.label, labels: saved.labels });
            }

            return jsonResp(405, { success: false, error: 'Method not allowed' });
        }

        if (reqPath === '/api/monitoring/host-labels/delete') {
            const monitoringToken = extractToken(req.headers.get('cookie') || '');
            const monitoringUser = monitoringToken ? verifyJwtForRoot(monitoringToken) : null;
            if (!monitoringUser) return redirectToLogin(req, reqPath, url.search);
            if (req.method !== 'DELETE') return jsonResp(405, { success: false, error: 'Method not allowed' });

            const data = await req.json().catch(() => ({}));
            const key = monitoring.getHostLabelKey({
                ipAddress: data?.ipAddress || url.searchParams.get('ipAddress') || url.searchParams.get('ip'),
                macAddress: data?.macAddress || url.searchParams.get('macAddress') || url.searchParams.get('mac'),
            });
            if (!key) return jsonResp(400, { success: false, error: 'ipAddress or macAddress is required' });
            const store = monitoring.loadHostLabels();
            const label = store.labels[key] || null;
            delete store.labels[key];
            const saved = monitoring.saveHostLabels(store.labels);
            return jsonResp(200, { success: true, label, labels: saved.labels });
        }

        if (reqPath === '/api/monitoring/discovery/refresh') {
            const monitoringToken = extractToken(req.headers.get('cookie') || '');
            const monitoringUser = monitoringToken ? verifyJwtForRoot(monitoringToken) : null;
            if (!monitoringUser) return redirectToLogin(req, reqPath, url.search);
            monitoring.scheduleLanDiscoveryRefresh(url.searchParams.get('reason') || 'manual-api');
            return jsonResp(202, {
                success: true,
                refreshing: true,
                cachePath: 'data/monitoring/network-discovery-cache.json',
                refreshIntervalMs: monitoring.refreshIntervalMs,
                snapshot: await monitoring.getMonitoringSnapshot({}),
            });
        }

        if (reqPath === '/api/monitoring/snapshot') {
            const monitoringToken = extractToken(req.headers.get('cookie') || '');
            const monitoringUser = monitoringToken ? verifyJwtForRoot(monitoringToken) : null;
            if (!monitoringUser) return redirectToLogin(req, reqPath, url.search);
            return jsonResp(200, await monitoring.getMonitoringSnapshot({
                forceDiscovery: url.searchParams.get('forceDiscovery') === '1',
                waitDiscovery: url.searchParams.get('waitDiscovery') === '1',
            }));
        }

        // Service health for the portal cards: TCP-check each enabled route
        // target. Cached 30s so many users don't multiply probes.
        if (reqPath === '/api/services/status') {
            const statusToken = extractToken(req.headers.get('cookie') || '');
            const statusUser = statusToken ? verifyJwtForRoot(statusToken) : null;
            if (!statusUser) return redirectToLogin(req, reqPath, url.search);

            if (!serviceStatusCache.value || Date.now() - serviceStatusCache.at > 30_000) {
                const checks = routesConfig
                    .filter(r => !r.hidden && isHttpTarget(r.target) && r.target.startsWith('http://127.0.0.1'))
                    .map(async r => {
                        try {
                            const u = new URL(r.target);
                            await checkTcpPort(u.hostname, Number(u.port) || 80, 500);
                            return { serviceId: r.id, path: r.path, up: true };
                        } catch { return { serviceId: r.id, path: r.path, up: false }; }
                    });
                serviceStatusCache.value = await Promise.all(checks);
                serviceStatusCache.at = Date.now();
            }
            return jsonResp(200, { success: true, checkedAt: serviceStatusCache.at, services: serviceStatusCache.value });
        }

        const directRoute = matchRoute(reqPath);
        const refererRoute = !directRoute && isViteDevAssetPath(reqPath)
            ? matchRouteFromReferer(req)
            : null;
        const route = directRoute || refererRoute;
        const routeReqPath = directRoute ? reqPath : `${route?.path || ''}${reqPath}`;

        // ── Static file bypass (zero overhead — fastest path) ───────────────
        // Runs BEFORE auth on purpose: local files carry no identity headers,
        // so asset requests skip cookie parsing + JWT verify entirely.
        const staticFile = getStaticFilePath(reqPath);
        if (staticFile) {
            try {
                const response = await serveLocalFile(staticFile.path, reqPath, {
                    immutable: staticFile.root.immutable,
                    textRewrites: staticFile.root.textRewrites,
                    cacheControl: staticFile.root.immutable
                        ? 'public, max-age=31536000, immutable'
                        : undefined,
                });
                if (response) return response;
            } catch { /* fall through to proxy */ }
        }

        const token = extractToken(req.headers.get('cookie') || '');
        const user = token ? verifyJwtForRoot(token) : null;

        // Phase 5: require X-API-Key for /query, /ifess
        // NOTE: /backend/upah has NO x-api-key guard — the upah backend auths via
        // its own Bearer JWT; the frontend never sends x-api-key, so guarding it
        // here caused 401s on every /backend/upah/* call (login kick-out loop).
        const hApiKey = req.headers.get('x-api-key'); const reqId = req.headers.get('x-request-id') || 'req_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);

        if (reqPath.startsWith('/query') && !hApiKey) { return new Response(JSON.stringify({error:{code:'UNAUTHORIZED',message:'X-API-Key required'}}), { status: 401, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway' } }); }
        if (reqPath.startsWith('/query') && hApiKey !== QUERY_API_KEY) { return new Response(JSON.stringify({error:{code:'FORBIDDEN',message:'Invalid X-API-Key'}}), { status: 403, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway' } }); }

        // Phase 5: require X-API-Key for the proxied legacy /ifess alias (bare
        // SuperApp RPC surface). The canonical ifess routes (/ifess-control,
        // /api/ifess, /api/clients, /api/query-gateway, /ifess-assets) are
        // public in the route table — the ifess-server module (:8003) enforces
        // X-API-Key / portal identity itself.
        const isIfessClientRpc = reqPath.startsWith('/ifess/') || reqPath === '/ifess';
        if (isIfessClientRpc && !hApiKey) { return new Response(JSON.stringify({error:{code:'UNAUTHORIZED',message:'X-API-Key required'}}), { status: 401, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway' } }); }
        if (isIfessClientRpc && hApiKey !== IFESS_CLIENT_API_KEY) { return new Response(JSON.stringify({error:{code:'FORBIDDEN',message:'Invalid X-API-Key'}}), { status: 403, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway' } }); }

        if (route && route.public !== true && !user) {
            return redirectToLogin(req, reqPath, url.search);
        }

        if (route?.id === 'network-monitor' && reqPath === '/network-monitor') {
            return Response.redirect('/network-monitor/', 308);
        }

        if (route?.id === 'network-monitor') {
            const response = await serveNetworkMonitor(reqPath);
            if (response) return response;

            return new Response('Network Monitor asset not found', {
                status: 404,
                headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Server': 'Bun-Proxy' },
            });
        }

        if (route && isSpaNavigation(req, route, reqPath)) {
            const response = await serveLocalFile(resolve(ROOT_DIR, route.spaIndex), '/index.html', {
                textRewrites: route.textRewrites,
                cacheControl: 'no-cache, no-store, must-revalidate',
                proxyPath: 'spa-index',
            });
            if (response) return response;
        }

        // ── IFESS API (Bun native handler) ─────────────────────────────────
        // Moved to early handlers above


        // ── Dashboard paths first (before route matching) ─────────────────────
        if (isDashboardPath(reqPath)) {
            return proxyDashboard(req, reqPath, url.search, user);
        }

        // ── Proxy to upstream ───────────────────────────────────────────────
        if (route) {
            return proxyRequest(req, route, routeReqPath, url.search, user);
        }

        if (isProtectedPath(reqPath) && !user) {
            return redirectToLogin(req, reqPath, url.search);
        }

        return new Response(JSON.stringify({
            error: 'Not Found',
            path: reqPath,
            availableRoutes: routesConfig.map(route => ({ path: route.path, target: route.target, description: route.description })),
        }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Proxy' },
        });
    },

    error(err) {
        console.error(`Server error: ${err.message}`);
        return new Response('Internal Server Error', { status: 500 });
    },

    websocket: {
        open(client) {
            const upstream = new WebSocket(client.data.upstreamUrl);
            client.data.upstream = upstream;
            upstream.binaryType = 'arraybuffer';

            upstream.onopen = () => {
                for (const message of client.data.queue || []) upstream.send(message);
                client.data.queue = [];
            };
            upstream.onmessage = (event) => {
                if (client.readyState === WebSocket.OPEN) client.send(event.data);
            };
            upstream.onclose = (event) => {
                if (client.readyState === WebSocket.OPEN) client.close(event.code || 1000, event.reason || 'Dashboard websocket closed');
            };
            upstream.onerror = () => {
                if (client.readyState === WebSocket.OPEN) client.close(1011, 'Dashboard websocket error');
            };
        },

        message(client, message) {
            const upstream = client.data.upstream;
            if (upstream?.readyState === WebSocket.OPEN) {
                upstream.send(message);
                return;
            }
            client.data.queue ||= [];
            client.data.queue.push(message);
        },

        close(client) {
            const upstream = client.data.upstream;
            if (upstream?.readyState === WebSocket.OPEN || upstream?.readyState === WebSocket.CONNECTING) {
                upstream.close();
            }
        },
    },
});

console.log(`\nProxy gateway ready at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
console.log('Routes active:');
routesConfig.forEach(r => console.log(`  ${r.path} → ${r.target}`));

export default server;

// ─── MIME Type Helper ─────────────────────────────────────────────────────────
function getMimeType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const types = {
        'js': 'application/javascript',
        'mjs': 'application/javascript',
        'css': 'text/css',
        'html': 'text/html',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'ttf': 'font/ttf',
        'eot': 'application/vnd.ms-fontobject',
        'otf': 'font/otf',
        'webp': 'image/webp',
        'avif': 'image/avif',
        'map': 'application/json',
    };
    return types[ext] || 'application/octet-stream';
}
