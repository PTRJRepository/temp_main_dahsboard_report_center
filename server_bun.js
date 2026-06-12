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
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import { createVerify } from 'node:crypto';

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
const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.HOST || '0.0.0.0';
const DASHBOARD_DIR = `${ROOT_DIR}/Dashboard_Utama`;
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT || '3100');
const DASHBOARD_TARGET = process.env.DASHBOARD_TARGET || `http://127.0.0.1:${DASHBOARD_PORT}`;
const START_DASHBOARD = process.env.START_DASHBOARD !== 'false';
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

// ─── JWT Verification (lightweight, no crypto.sign overhead) ─────────────────
const JWT_PUBLIC_KEY = readFileSync(`${ROOT_DIR}/keys/public.pem`, 'utf-8').trim();

function verifyJWT(token) {
    if (!token) return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [headerB64, payloadB64, signatureB64] = parts;
        const header = decodeJwtSegment(headerB64);
        if (header.alg !== 'RS256') return null;

        const verifier = createVerify('RSA-SHA256');
        verifier.update(`${headerB64}.${payloadB64}`);
        verifier.end();
        if (!verifier.verify(JWT_PUBLIC_KEY, base64UrlToBuffer(signatureB64))) return null;

        const payload = decodeJwtSegment(payloadB64);
        if (payload.exp && payload.exp * 1000 < Date.now()) return null;
        return payload;
    } catch { return null; }
}

function base64UrlToBuffer(value) {
    const padded = value + '='.repeat((4 - value.length % 4) % 4);
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function decodeJwtSegment(value) {
    return JSON.parse(base64UrlToBuffer(value).toString('utf8'));
}

function extractToken(cookieHeader) {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/auth-token=([^;]+)/);
    return match ? match[1] : null;
}

// ─── Public & Protected Path Definitions ──────────────────────────────────────
const PUBLIC_PATHS = new Set(['/', '/login', '/logout', '/favicon.ico']);
const DASHBOARD_PUBLIC_PREFIXES = ['/_next', '/assets', '/api/auth'];
const DASHBOARD_PATHS = ['/admin', '/dashboard', '/dashboard-user', '/modules', '/report-center', '/api/services', '/api/reports'];
const PROTECTED_PATHS = ['/config-path', ...DASHBOARD_PATHS];

function isProtectedPath(pathname) {
    return PROTECTED_PATHS.some(p => pathname.startsWith(p));
}

function isDashboardPublicPath(pathname) {
    return PUBLIC_PATHS.has(pathname) || DASHBOARD_PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

function isDashboardPath(pathname) {
    return isDashboardPublicPath(pathname) || DASHBOARD_PATHS.some(p => pathname.startsWith(p));
}

function wantsJson(req, pathname) {
    const accept = req.headers.get('accept') || '';
    return pathname.startsWith('/api/') || accept.includes('application/json') || req.method !== 'GET';
}

function redirectToLogin(req, pathname, search = '') {
    if (wantsJson(req, pathname)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Proxy' },
        });
    }
    const returnTo = encodeURIComponent(pathname + search);
    return Response.redirect(`/login?returnTo=${returnTo}`, 302);
}

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

// ─── URL Rewriting Utilities ──────────────────────────────────────────────────
const REWRITE_PATTERNS = [
    { from: /https?:\/\/localhost:8002\//g, to: '/upah/' },
    { from: /https?:\/\/localhost:5176\//g, to: '/absen/' },
    { from: /https?:\/\/localhost:5177\//g, to: '/monitoring-beras/' },
    { from: /https?:\/\/localhost:5178\//g, to: '/file/' },
    { from: /https?:\/\/localhost:8003\//g, to: '/ifess/' },
    { from: /src="\/(?!upah|absen|monitoring-beras|file|ifess|backend|query|assets|dashboard)/g, to: 'src="/dashboard/' },
    { from: /href="\/(?!upah|absen|monitoring-beras|file|ifess|backend|query|assets|dashboard)/g, to: 'href="/dashboard/' },
    { from: /ws:\/\/localhost:\d+/g, to: `ws://localhost:${PORT}` },
];

function rewriteBody(body, routePath) {
    if (typeof body !== 'string' && !(body instanceof Uint8Array)) return body;
    const text = typeof body === 'string' ? body : new TextDecoder().decode(body);

    if (!text.includes('localhost:8002') &&
        !text.includes('localhost:5176') &&
        !text.includes('localhost:5177') &&
        !text.includes('localhost:5178') &&
        !text.includes('localhost:8003') &&
        (routePath === '/upah' || !text.includes('/upah/'))) {
        return text;
    }

    let result = text;
    for (const { from, to } of REWRITE_PATTERNS) {
        result = result.replace(from, to);
    }
    if (routePath !== '/upah') {
        result = result.replace(/\/upah\//g, `${routePath}/`);
    }
    return result;
}

// ─── Route Resolution ────────────────────────────────────────────────────────
function matchRoute(urlPath) {
    for (const route of routesConfig) {
        if (urlPath.startsWith(route.path)) return route;
    }
    return null;
}

// ─── Static File Utilities ───────────────────────────────────────────────────
const STATIC_EXTENSIONS_RE = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|webp|avif|map)$/;
const VERSION_HASH_RE = /-[a-f0-9]{6,}\.[a-z]+$/;

const DEFAULT_STATIC_ROOTS = [
    { prefix: '/assets', dir: `${DASHBOARD_DIR}/public/assets`, immutable: false },
    { prefix: '/upah/assets', dir: `${ROOT_DIR}/Services/upah/dist/assets`, immutable: true },
    { prefix: '/upah/images', dir: `${ROOT_DIR}/Services/upah/dist/images`, immutable: false },
    { prefix: '/upah/vite.svg', file: `${ROOT_DIR}/Services/upah/dist/vite.svg`, immutable: false },
    { prefix: '/absen/assets', dir: `${ROOT_DIR}/Services/absen/dist/assets`, immutable: true },
    { prefix: '/absen/images', dir: `${ROOT_DIR}/Services/absen/dist/images`, immutable: false },
    { prefix: '/absen/vite.svg', file: `${ROOT_DIR}/Services/absen/dist/vite.svg`, immutable: false },
    { prefix: '/monitoring-beras/assets', dir: `${ROOT_DIR}/Services/monitoring-beras/dist/assets`, immutable: true },
    { prefix: '/monitoring-beras/vite.svg', file: `${ROOT_DIR}/Services/monitoring-beras/dist/vite.svg`, immutable: false },
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

const staticRoots = [
    ...routesConfig.flatMap(normalizeStaticRoots),
    ...DEFAULT_STATIC_ROOTS,
].sort((a, b) => b.prefix.length - a.prefix.length);

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

async function serveLocalFile(filePath, reqPath, options = {}) {
    const file = Bun.file(filePath);
    if (!(await file.exists())) return null;

    const contentType = getMimeType(reqPath);
    const isVersioned = VERSION_HASH_RE.test(reqPath);
    const isText = contentType.includes('text/html') ||
        contentType.includes('javascript') ||
        contentType.includes('text/css') ||
        contentType.includes('application/json') ||
        contentType.includes('text/plain');
    const textRewrites = Array.isArray(options.textRewrites) ? options.textRewrites : [];
    let body;

    if (isText && textRewrites.length > 0) {
        let text = await file.text();
        for (const rewrite of textRewrites) {
            if (!rewrite?.from) continue;
            text = text.split(rewrite.from).join(rewrite.to || '');
        }
        body = new TextEncoder().encode(text);
    } else {
        body = await file.arrayBuffer();
    }

    const cacheControl = options.cacheControl || (isVersioned || options.immutable
        ? 'public, max-age=31536000, immutable'
        : getCacheControl(reqPath, contentType));

    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': contentType,
            'Content-Length': body.byteLength.toString(),
            'Cache-Control': cacheControl,
            'Server': 'Bun-Proxy',
            'X-Proxy-Path': options.proxyPath || 'static-bypass',
        }
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

async function startDashboardIfNeeded() {
    if (await isUpstreamReady(DASHBOARD_TARGET)) {
        console.log(`Dashboard upstream ready: ${DASHBOARD_TARGET}`);
        return;
    }

    if (!START_DASHBOARD) {
        console.log(`Dashboard upstream not ready: ${DASHBOARD_TARGET}`);
        return;
    }

    const dashboardScript = process.env.NODE_ENV === 'production' ? 'start' : 'dev';

    // Use process.execPath (the running Bun executable) for spawning child processes on Windows
    const bunExecutable = process.execPath;

    console.log(`Starting dashboard upstream with bun run ${dashboardScript} at ${DASHBOARD_TARGET}...`);
    const child = Bun.spawn({
        cmd: [bunExecutable, 'run', dashboardScript, '--', '-p', String(DASHBOARD_PORT), '--hostname', '127.0.0.1'],
        cwd: DASHBOARD_DIR,
        stdout: 'inherit',
        stderr: 'inherit',
        env: {
            ...process.env,
            PORT: String(DASHBOARD_PORT),
            HOSTNAME: '127.0.0.1',
        },
    });

    process.on('exit', () => child.kill());

    for (let attempt = 0; attempt < 30; attempt += 1) {
        await Bun.sleep(500);
        if (await isUpstreamReady(DASHBOARD_TARGET)) {
            console.log(`Dashboard upstream ready: ${DASHBOARD_TARGET}`);
            return;
        }
    }

    console.warn(`Dashboard upstream did not become ready yet: ${DASHBOARD_TARGET}`);
}

async function proxyDashboard(req, reqPath, search) {
    const targetUrl = `${DASHBOARD_TARGET}${reqPath}${search}`;
    const headers = buildProxyHeaders(req);

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

function isWebSocketRequest(req) {
    return (req.headers.get('upgrade') || '').toLowerCase() === 'websocket';
}

function hasRequestBody(method) {
    return method !== 'GET' && method !== 'HEAD';
}

function buildProxyHeaders(req, options = {}) {
    const headers = new Headers();
    for (const [key, value] of req.headers.entries()) {
        const lower = key.toLowerCase();
        if (['connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(lower)) continue;
        if (lower === 'host') continue;
        if (options.stripAcceptEncoding && lower === 'accept-encoding') continue;
        headers.set(key, value);
    }
    headers.set('X-Forwarded-For', req.headers.get('x-forwarded-for') || '127.0.0.1');
    headers.set('X-Forwarded-Host', req.headers.get('host') || `localhost:${PORT}`);
    headers.set('X-Real-IP', req.headers.get('x-real-ip') || '127.0.0.1');
    return headers;
}

function copyResponseHeaders(source) {
    const headers = new Headers();
    source.forEach((value, key) => {
        if (['content-length', 'transfer-encoding', 'connection', 'content-encoding'].includes(key.toLowerCase())) return;
        headers.set(key, value);
    });
    return headers;
}

// ─── HTTP Client Pre-warm ────────────────────────────────────────────────────
async function prewarmConnections() {
    const targets = [...new Set(routesConfig.map(r => r.target))];
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
async function proxyRequest(req, route, reqPath) {
    const url = new URL(req.url);
    const targetPath = route.rewritePath === false
        ? reqPath
        : (reqPath.slice(route.path.length) || '/');
    const targetUrl = `${route.target}${targetPath}${url.search}`;
    const acceptEncoding = req.headers.get('accept-encoding') || '';
    const shouldRewriteContent = route.rewriteContent === true || route.rewriteContent === 'html-only';

    // ── Static Extension Fast-Path ──────────────────────────────────────────
    // Skip buffering entirely — serve as streaming passthrough
    if (STATIC_EXTENSIONS_RE.test(reqPath) && route.path === '/upah') {
        const fetchOptions = {
            headers: { 'Accept-Encoding': acceptEncoding },
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

    const headers = buildProxyHeaders(req, { stripAcceptEncoding: shouldRewriteContent });

    const startTime = Date.now();
    // Cache key includes acceptEncoding so gzip/br responses aren't served to clients that didn't request compression
    const cacheKey = `${req.method}:${reqPath}:${acceptEncoding}`;

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

        // Log all requests + slow requests warning
        const logKey = `${req.method} ${route.path}${targetPath} → ${response.status} (${elapsed}ms)`;
        if (elapsed > 500) {
            console.log(`SLOW ${logKey}`);
        } else {
            console.log(logKey);
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
                text.includes('/upah/')
            );

        const finalText = needsRewrite ? rewriteBody(text, route.path) : text;
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

await startDashboardIfNeeded();
await prewarmConnections();

let server;
server = Bun.serve({
    port: PORT,
    hostname: HOST,
    idleTimeout: GATEWAY_IDLE_TIMEOUT_SECONDS,

    async fetch(req) {
        const url = new URL(req.url);
        const reqPath = url.pathname;

        if (isWebSocketRequest(req)) {
            const upstreamUrl = dashboardWsTarget(reqPath, url.search);
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

        const route = matchRoute(reqPath);
        const token = extractToken(req.headers.get('cookie') || '');
        const user = token ? verifyJWT(token) : null;

        // ── Static file bypass (zero overhead — fastest path) ───────────────
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

        if (route && route.public !== true && !user) {
            return redirectToLogin(req, reqPath, url.search);
        }

        if (route && isSpaNavigation(req, route, reqPath)) {
            const response = await serveLocalFile(resolve(ROOT_DIR, route.spaIndex), '/index.html', {
                textRewrites: route.textRewrites,
                cacheControl: 'no-cache, no-store, must-revalidate',
                proxyPath: 'spa-index',
            });
            if (response) return response;
        }

        // ── Proxy to upstream ───────────────────────────────────────────────
        if (route) {
            return proxyRequest(req, route, reqPath);
        }

        if (isProtectedPath(reqPath) && !user) {
            return redirectToLogin(req, reqPath, url.search);
        }

        if (isDashboardPath(reqPath)) {
            return proxyDashboard(req, reqPath, url.search);
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
