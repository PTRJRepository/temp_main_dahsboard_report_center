# Arsitektur Server Gateway - Dokumentasi Lengkap

**Last updated: 2026-06-10**

## Daftar Isi

1. [Gambaran Umum](#1-gambaran-umum)
2. [Deep Dive server.js (Express)](#2-deep-dive-serverjs-express)
3. [Deep Dive server_bun.js (Bun Native)](#3-deep-dive-server_bunjs-bun-native)
4. [Perbandingan Express vs Bun](#4-perbandingan-express-vs-bun)
5. [Request/Response Flow](#5-requestresponse-flow)
6. [Middleware & Security](#6-middleware--security)
7. [Proxy Logic](#7-proxy-logic)
8. [Static File Serving](#8-static-file-serving)
9. [WebSocket Support](#9-websocket-support)
10. [Route Management API](#10-route-management-api)
11. [Gateway Smoke Test](#11-gateway-smoke-test)
12. [Production vs Development](#12-production-vs-development)
13. [9Router Integration (Port 20128)](#13-9router-integration-port-20128)

---

## 1. Gambaran Umum

```
D:\Gawean Rebinmas\Main Dashboard\
├── server.js              # Express Gateway (Node.js)
├── server_bun.js          # Bun Native Gateway (High-Performance)
├── routes-config.json     # Konfigurasi route dinamis
├── scripts/
│   └── gateway-smoke.js   # Smoke test untuk gateway
└── Dashboard_Utama/       # Next.js Dashboard Application
```

### Arsitektur Multi-Layer

```
                    ┌─────────────────────────────────────────┐
                    │           Gateway (Port 3001)            │
                    │  ┌─────────────┐  ┌─────────────────┐  │
                    │  │   Express   │  │  Bun Native     │  │
                    │  │  (server.js)│  │ (server_bun.js)│  │
                    │  └─────────────┘  └─────────────────┘  │
                    └──────────────────┬──────────────────────┘
                                         │
           ┌─────────────────────────────┼─────────────────────────────┐
           │                             │                             │
           ▼                             ▼                             ▼
    ┌─────────────┐              ┌─────────────┐              ┌─────────────┐
    │ Next.js     │              │ Service     │              │ 9Router     │
    │ Dashboard   │              │ Proxies     │              │ (Port 20128)│
    │ (Port 3000) │              │ (5176, 8002)│              │             │
    └─────────────┘              └─────────────┘              └─────────────┘
```

---

## 2. Deep Dive server.js (Express)

**Lokasi File:** `D:\Gawean Rebinmas\Main Dashboard\server.js`

### 2.1 Inisialisasi Aplikasi

```javascript
const express = require('express');
const http = require('http');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3001;
```

**Komponen yang digunakan:**

| Modul | Fungsi |
|-------|--------|
| `express` | Web framework utama |
| `http` | HTTP server untuk WebSocket |
| `http-proxy-middleware` | Proxy routing |
| `cors` | Cross-Origin Resource Sharing |
| `morgan` | HTTP request logging |
| `fs` | File system operations |
| `path` | Path manipulation |

### 2.2 Environment Configuration

```javascript
const env = process.env.NODE_ENV || 'development';
const envPath = path.join(ROOT_DIR, `.env.${env}`);

// Development: localhost
// Production: 223.25.98.220 (atau fallback 10.0.0.110)
```

**Load Order:**
1. `.env.{NODE_ENV}` (jika ada)
2. `.env` (default fallback)
3. Environment variables saja

### 2.3 Next.js Integration

```javascript
// Next.js 16 resolves production artifacts dari process.cwd()
if (process.cwd() !== DASHBOARD_DIR) {
    process.chdir(DASHBOARD_DIR);
}

const nextApp = next({
    dev,
    dir: DASHBOARD_DIR,
    hostname: 'localhost',
    port: Number(PORT)
});
const nextHandle = nextApp.getRequestHandler();
```

**Poin Penting:**
- Working directory diubah ke `Dashboard_Utama/`
- Next.js handler disimpan sebagai `nextHandle`
- Dipanggil untuk routes dashboard yang tidak terproksi

### 2.4 Route Configuration Loading

```javascript
const CONFIG_FILE = path.join(ROOT_DIR, `routes-config.${env}.json`);
const DEFAULT_CONFIG_FILE = path.join(ROOT_DIR, 'routes-config.json');

function loadRoutes() {
    // 1. Coba environment-specific config
    if (fs.existsSync(CONFIG_FILE)) { ... }
    // 2. Fallback ke default config
    else if (fs.existsSync(DEFAULT_CONFIG_FILE)) { ... }
    // 3. Start dengan routes kosong
    else { routes = []; }
}
```

**Hot Reload Routes:**
```javascript
fs.watchFile(file, (curr, prev) => {
    console.log(`🔄 Config change detected...`);
    loadRoutes();
    proxyCache.clear();
    wsProxyCache.clear();
});
```

### 2.5 Middleware Stack

```javascript
// CORS - mengizinkan semua origins
app.use(cors());

// Morgan - logging request
app.use(morgan('dev'));
```

**Catatan:** Tidak ada `express.json()` atau `express.urlencoded()` di level global karena:
- Proxy routes tidak memerlukan body parsing
- Next.js handles own body parsing

### 2.6 Static Routes (Before Next.js)

Routes ini harus di-define SEBELUM `nextApp.prepare()`:

```javascript
// Config management UI
app.use('/_static', express.static(path.join(__dirname, 'public')));
app.get('/config-path', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard assets
const dashboardAssetsPath = path.join(__dirname, 'Dashboard_Utama', 'public', 'assets');
if (fs.existsSync(dashboardAssetsPath)) {
    app.use('/assets', express.static(dashboardAssetsPath));
    app.use('/upah/assets', express.static(dashboardAssetsPath));
}

// Upah dist static files
if (fs.existsSync(upahDistPath)) {
    app.use('/images', express.static(path.join(upahDistPath, 'images')));
    app.use('/upah/images', express.static(path.join(upahDistPath, 'images')));
    app.use('/upah/assets', express.static(path.join(upahDistPath, 'assets')));
    app.use('/upah/vite.svg', express.static(path.join(upahDistPath, 'vite.svg')));
}
```

### 2.7 Proxy Middleware Architecture

#### HTTP Proxy dengan Content Rewriting

```javascript
function getProxyMiddleware(route) {
    const proxy = createProxyMiddleware({
        target: route.target,
        changeOrigin: route.changeOrigin !== false,
        pathRewrite: pathRewriteRule,
        ws: true,
        selfHandleResponse: true,  // CRITICAL: Self-handle response
        
        onProxyReq: (proxyReq, req, res) => {
            // Remove Accept-Encoding untuk content rewriting
            proxyReq.removeHeader('Accept-Encoding');
            
            // Cookie sanitization - strip auth-token (RS256)
            // Backend expects HS256 (payroll_auth_token)
            if (req.headers.cookie) {
                const cookies = req.headers.cookie.split(';');
                const safeCookies = cookies.filter(c => 
                    !c.trim().startsWith('auth-token=')
                );
                proxyReq.setHeader('cookie', safeCookies.join(';'));
            }
        },
        
        onProxyRes: (proxyRes, req, res) => {
            // 1. Auth error redirect
            if ([401, 403].includes(proxyRes.statusCode) && 
                req.headers['accept']?.includes('text/html')) {
                res.writeHead(302, { 'Location': '/login' });
                res.end();
                return;
            }
            
            // 2. Static fast-path (zero buffering)
            if (STATIC_EXT_RE.test(reqPath)) {
                res.statusCode = proxyRes.statusCode;
                // Passthrough headers + streaming
                return proxyRes.pipe(res);
            }
            
            // 3. HTML/JS/CSS rewriting
            if (shouldRewrite) {
                let body = '';
                proxyRes.on('data', (chunk) => { body += chunk.toString('utf8'); });
                proxyRes.on('end', () => {
                    // Rewrite localhost:8002 -> /upah
                    body = body.replace(
                        /http:\/\/ptrjestate\.rebinmas\.com:8002/g, 
                        route.path
                    );
                    // Rewrite absolute paths
                    body = body.replace(
                        /(<script[^>]+src=["']\s*)\/(?!\/)/gi, 
                        `$1${route.path}/`
                    );
                    res.end(body);
                });
            }
        }
    });
}
```

#### WebSocket Proxy (Separate Cache)

```javascript
function getWsProxyMiddleware(route) {
    const wsProxy = createProxyMiddleware({
        target: route.target,
        changeOrigin: true,
        // NO selfHandleResponse for WebSocket
        ws: true,
        onProxyReqWs: (proxyReq, req, socket, options, head) => {
            console.log(`🔌 WebSocket proxying: ${req.url}`);
        }
    });
    wsProxyCache.set(route.id, wsProxy);
}
```

### 2.8 Route Matching Logic

```javascript
app.use((req, res, next) => {
    const reqPath = req.path;
    
    // Skip management routes
    if (reqPath.startsWith('/_static') || 
        reqPath.startsWith('/api/routes') || 
        reqPath.startsWith('/config-path')) {
        return next();
    }
    
    // Sort routes by length (longest first)
    const sortedRoutes = [...routes].sort((a, b) => 
        b.path.length - a.path.length
    );
    
    // Direct path match
    let matchedRoute = sortedRoutes.find(
        r => r.enabled && reqPath.startsWith(r.path)
    );
    
    // Referer-based fallback untuk asset requests
    if (!matchedRoute && referer) {
        matchedRoute = sortedRoutes.find(
            r => r.enabled && referer.includes(r.path)
        );
    }
    
    if (matchedRoute) {
        // WebSocket detection
        const isWebSocketRequest = 
            req.headers.connection?.toLowerCase().includes('upgrade') ||
            req.headers.upgrade === 'websocket';
        
        if (isWebSocketRequest || matchedRoute.rewriteContent === false) {
            return getWsProxyMiddleware(matchedRoute)(req, res, next);
        }
        
        return getProxyMiddleware(matchedRoute)(req, res, next);
    }
    
    next();
});
```

### 2.9 Fallback ke Next.js

```javascript
app.use((req, res) => {
    const isDashboardRoute =
        reqPath === '/' ||
        reqPath.startsWith('/report-center') ||
        reqPath === '/login' ||
        reqPath.startsWith('/dashboard') ||
        reqPath.startsWith('/api/auth') ||
        reqPath.startsWith('/api/services') ||
        reqPath.startsWith('/api/reports');
    
    if (isDashboardRoute) {
        return nextHandle(req, res);
    }
    
    res.status(404).json({ ... });
});
```

### 2.10 Error Handling

```javascript
onError: (err, req, res) => {
    console.error(`❌ Proxy error: ${err.message}`);
    
    // Express response
    if (res && typeof res.status === 'function' && !res.headersSent) {
        res.status(502).json({
            error: 'Proxy Error',
            message: `Backend service at ${route.target} is not reachable`
        });
    }
    // Raw HTTP response
    else if (res && typeof res.writeHead === 'function') {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy Error' }));
    }
}
```

---

## 3. Deep Dive server_bun.js (Bun Native)

**Lokasi File:** `D:\Gawean Rebinmas\Main Dashboard\server_bun.js`

### 3.1 ESM Import Pattern

```javascript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import { createVerify } from 'node:crypto';
```

### 3.2 LRU Cache Implementation

```javascript
class LRUCache {
    #cache = new Map();
    #maxSize;
    #ttl;

    get(key) {
        const entry = this.#cache.get(key);
        if (!entry || Date.now() > entry.expires) {
            this.#cache.delete(key);
            return null;
        }
        // Move to end (most recently used)
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
}

const assetCache = new LRUCache(CACHE_MAX_SIZE * 2, 30 * 60 * 1000);
```

### 3.3 JWT Verification (Lightweight)

```javascript
const JWT_PUBLIC_KEY = readFileSync(`${ROOT_DIR}/keys/public.pem`, 'utf-8').trim();

function verifyJWT(token) {
    if (!token) return null;
    try {
        const [headerB64, payloadB64, signatureB64] = token.split('.');
        const header = decodeJwtSegment(headerB64);
        
        if (header.alg !== 'RS256') return null;
        
        const verifier = createVerify('RSA-SHA256');
        verifier.update(`${headerB64}.${payloadB64}`);
        
        if (!verifier.verify(JWT_PUBLIC_KEY, base64UrlToBuffer(signatureB64))) {
            return null;
        }
        
        const payload = decodeJwtSegment(payloadB64);
        if (payload.exp && payload.exp * 1000 < Date.now()) return null;
        
        return payload;
    } catch { return null; }
}
```

### 3.4 Routes Configuration

```javascript
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
                    hidden: true,
                }))
                : []),
        ]);
    routesConfig = configuredRoutes
        .sort((a, b) => b.path.length - a.path.length);
} catch (e) {
    console.error(`Failed to load routes-config.json: ${e.message}`);
    process.exit(1);
}
```

### 3.5 URL Rewriting Patterns

```javascript
const REWRITE_PATTERNS = [
    { from: /https?:\/\/localhost:8002\//g, to: '/upah/' },
    { from: /https?:\/\/localhost:5176\//g, to: '/absen/' },
    { from: /https?:\/\/localhost:5177\//g, to: '/monitoring-beras/' },
    { from: /https?:\/\/localhost:5178\//g, to: '/file/' },
    { from: /https?:\/\/localhost:8003\//g, to: '/ifess/' },
    { from: /src="\/(?!upah|absen|...)/g, to: 'src="/dashboard/' },
    { from: /ws:\/\/localhost:\d+/g, to: `ws://localhost:${PORT}` },
];

function rewriteBody(body, routePath) {
    let result = text;
    for (const { from, to } of REWRITE_PATTERNS) {
        result = result.replace(from, to);
    }
    if (routePath !== '/upah') {
        result = result.replace(/\/upah\//g, `${routePath}/`);
    }
    return result;
}
```

### 3.6 Static File Handling

```javascript
const DEFAULT_STATIC_ROOTS = [
    { prefix: '/assets', dir: `${DASHBOARD_DIR}/public/assets`, immutable: false },
    { prefix: '/upah/assets', dir: `${ROOT_DIR}/Services/upah/dist/assets`, immutable: true },
    { prefix: '/upah/images', dir: `${ROOT_DIR}/Services/upah/dist/images`, immutable: false },
    // ... more static roots
];

function getStaticFilePath(reqPath) {
    const root = staticRoots.find(item => 
        reqPath === item.prefix || reqPath.startsWith(`${item.prefix}/`)
    );
    if (!root) return null;
    
    if (root.file) return { path: root.file, root };
    
    const suffix = reqPath.slice(root.prefix.length).replace(/^\//, '');
    if (suffix.includes('..')) return null;
    
    return { path: `${root.dir}/${suffix}`, root };
}
```

### 3.7 Bun.serve() Implementation

```javascript
server = Bun.serve({
    port: PORT,
    hostname: HOST,
    idleTimeout: GATEWAY_IDLE_TIMEOUT_SECONDS, // 120s default

    async fetch(req) {
        const url = new URL(req.url);
        const reqPath = url.pathname;

        // WebSocket detection
        if (isWebSocketRequest(req)) {
            const upstreamUrl = dashboardWsTarget(reqPath, url.search);
            if (upstreamUrl && server.upgrade(req, { data: { upstreamUrl } })) {
                return;
            }
            return new Response('WebSocket route not found', { status: 404 });
        }

        // Health check endpoint
        if (reqPath === '/__gateway/health') {
            return new Response(JSON.stringify({
                ok: true,
                gateway: 'bun',
                dashboardTarget: DASHBOARD_TARGET,
                routes: routesConfig.map(route => ({ ... }))
            }), { ... });
        }

        // Logout endpoint
        if (reqPath === '/logout') {
            return Response.redirect('/', 302, {
                'Set-Cookie': 'auth-token=; Path=/; Max-Age=0'
            });
        }

        // Static file bypass (fastest path)
        const staticFile = getStaticFilePath(reqPath);
        if (staticFile) {
            return serveLocalFile(staticFile.path, reqPath, { ... });
        }

        // Route matching & proxy
        const route = matchRoute(reqPath);
        if (route) {
            return proxyRequest(req, route, reqPath);
        }

        // Dashboard proxy
        if (isDashboardPath(reqPath)) {
            return proxyDashboard(req, reqPath, url.search);
        }

        // 404
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
    },

    websocket: {
        open(client) {
            const upstream = new WebSocket(client.data.upstreamUrl);
            client.data.upstream = upstream;
            
            upstream.onmessage = (event) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(event.data);
                }
            };
        },
        message(client, message) {
            const upstream = client.data.upstream;
            if (upstream?.readyState === WebSocket.OPEN) {
                upstream.send(message);
            }
        },
        close(client) {
            client.data.upstream?.close();
        },
    },
});
```

### 3.8 Dashboard Auto-Start

```javascript
async function startDashboardIfNeeded() {
    if (await isUpstreamReady(DASHBOARD_TARGET)) {
        console.log(`Dashboard upstream ready: ${DASHBOARD_TARGET}`);
        return;
    }

    if (!START_DASHBOARD) return;

    const dashboardScript = process.env.NODE_ENV === 'production' ? 'start' : 'dev';
    const bunExecutable = process.execPath;

    const child = Bun.spawn({
        cmd: [bunExecutable, 'run', dashboardScript, '--', '-p', String(DASHBOARD_PORT)],
        cwd: DASHBOARD_DIR,
        stdout: 'inherit',
        stderr: 'inherit',
    });

    // Wait for dashboard to be ready (max 30 attempts * 500ms = 15s)
    for (let attempt = 0; attempt < 30; attempt += 1) {
        await Bun.sleep(500);
        if (await isUpstreamReady(DASHBOARD_TARGET)) return;
    }
}
```

---

## 4. Perbandingan Express vs Bun

| Aspek | server.js (Express) | server_bun.js (Bun) |
|-------|---------------------|----------------------|
| **Runtime** | Node.js | Bun native |
| **HTTP Server** | `http.createServer()` | `Bun.serve()` |
| **Import** | CommonJS (`require`) | ESM (`import`) |
| **Middleware** | Express stack | Native handler |
| **Proxy** | http-proxy-middleware | Native fetch API |
| **WebSocket** | Upgrade event handling | Built-in websocket API |
| **Static Files** | express.static | Bun.file() + manual |
| **Caching** | No built-in | LRU Cache class |
| **Performance** | Moderate | High (zero overhead) |
| **Body Parsing** | express.json() | Native streaming |
| **Cookie Handling** | Manual parsing | Headers API |
| **Startup** | nextApp.prepare() | Sequential await |

### Optimizations server_bun.js

1. **Zero Middleware Overhead**
   - Tidak ada middleware chain yang tidak perlu
   - Langsung handle di fetch handler

2. **LRU Cache untuk Static Assets**
   ```javascript
   const assetCache = new LRUCache(CACHE_MAX_SIZE * 2, 30 * 60 * 1000);
   ```

3. **Streaming Passthrough**
   - Static files tidak di-buffer
   - Langsung stream dari upstream ke client

4. **Connection Pooling**
   - Bun secara native melakukan keep-alive
   - Idle timeout configurable

5. **Etag Support**
   ```javascript
   if (upstreamETag && cached.etag && upstreamETag === cached.etag) {
       return new Response(null, { status: 304, headers: responseHeaders });
   }
   ```

---

## 5. Request/Response Flow

### 5.1 Request Flow Diagram

```
Client Request (http://localhost:3001/upah/api/data)
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                    GATEWAY (Port 3001)                        │
│                                                               │
│  1. CORS Middleware (cors())                                  │
│     └── Set Access-Control-* headers                          │
│                                                               │
│  2. Morgan Logging (morgan('dev'))                            │
│     └── Log: GET /upah/api/data 200                           │
│                                                               │
│  3. Static Route Check                                        │
│     ├── /config-path → serve index.html                       │
│     ├── /_static/* → serve static files                      │
│     ├── /assets/* → serve dashboard assets                   │
│     └── /upah/assets/* → serve upah static                   │
│                                                               │
│  4. Dynamic Route Matching (sorted by path length)             │
│     └── Find route where reqPath.startsWith(route.path)       │
│                                                               │
│  5. Proxy Middleware                                          │
│     ├── onProxyReq: Cookie sanitization, header removal       │
│     ├── fetch upstream                                        │
│     ├── onProxyRes: Content rewriting (if needed)             │
│     └── Response streaming                                    │
│                                                               │
│  6. Next.js Handler (fallback)                                │
│     └── nextHandle(req, res)                                  │
│                                                               │
│  7. 404 Response (no match)                                  │
└───────────────────────────────────────────────────────────────┘
```

### 5.2 Proxy Request Flow (Detail)

```
Request: GET /upah/api/users
         │
         ▼
┌─────────────────────────────────────┐
│ Matched Route                      │
│ path: /upah                        │
│ target: http://localhost:8002      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ onProxyReq                          │
│ 1. Remove 'Accept-Encoding'         │
│ 2. Remove 'If-None-Match'          │
│ 3. Remove 'If-Modified-Since'       │
│ 4. Sanitize cookies (strip auth-token)│
│ 5. Log request                     │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Proxy to Backend                   │
│ GET http://localhost:8002/api/users │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ onProxyRes                          │
│                                     │
│ Check content type:                 │
│ ├── Static (.js, .css, .png, etc)  │ → Fast-path, no rewrite
│ ├── HTML                            │ → Full rewrite
│ │   ├── Rewrite localhost:8002 → /upah
│ │   ├── Rewrite /api → /upah/api   │
│ │   └── Rewrite absolute paths      │
│ ├── JavaScript                       │ → Rewrite imports/fetch
│ └── CSS                              │ → Rewrite url()
└─────────────────────────────────────┘
         │
         ▼
Response to Client
```

### 5.3 Content Rewriting Rules

**HTML Rewriting:**
```javascript
// Script src
body.replace(/(<script[^>]+src=["']\s*)\/(?!\/)/gi, `$1${route.path}/`);

// Link href
body.replace(/(<link[^>]+href=["']\s*)\/(?!\/)/gi, `$1${route.path}/`);

// Image src
body.replace(/(<img[^>]+src=["']\s*)\/(?!\/)/gi, `$1${route.path}/`);

// Base tag (if missing)
if (!body.includes('<base')) {
    body = body.replace(/<head>/i, `<head>\n  <base href="${route.path}/">`);
}
```

**JavaScript Rewriting:**
```javascript
// Import statements
body.replace(/from\s+["']\/(?!\/)/g, `from "${route.path}/`);
body.replace(/import\s+["']\/(?!\/)/g, `import "${route.path}/`);

// Fetch calls
body.replace(/fetch\(["']\/(?!\/)/g, `fetch("${route.path}/`);
```

**CSS Rewriting:**
```javascript
// url() references
body.replace(/url\(["']?\/(?!\/)/g, `url("${route.path}/`);
```

---

## 6. Middleware & Security

### 6.1 CORS Configuration

```javascript
app.use(cors());
```

Default behavior:
- Mengizinkan semua origins
- Semua methods (GET, POST, PUT, DELETE, etc)
- Headers yang common

### 6.2 Security Headers

**Di server_bun.js:**

```javascript
return new Response(body, {
    headers: {
        'Server': 'Bun-Proxy',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': cacheControl,
        // ...
    }
});
```

### 6.3 Cookie Sanitization

```javascript
// CRITICAL: Strip 'auth-token' (RS256) 
// Backend expects HS256 (payroll_auth_token)

const cookies = req.headers.cookie.split(';');
const safeCookies = cookies.filter(c => 
    !c.trim().startsWith('auth-token=')
);

if (safeCookies.length < cookies.length) {
    const newCookieHeader = safeCookies.join(';');
    proxyReq.setHeader('cookie', newCookieHeader);
    
    if (!newCookieHeader.includes('payroll_auth_token')) {
        console.log('⚠️ WARNING: payroll_auth_token is MISSING!');
    }
}
```

### 6.4 Path Traversal Protection

```javascript
// Prevent directory traversal attacks
const suffix = reqPath.slice(root.prefix.length).replace(/^\//, '');
if (suffix.includes('..')) return null;
```

### 6.5 Accept-Encoding Handling

```javascript
// Remove Accept-Encoding agar kita bisa rewrite content
proxyReq.removeHeader('Accept-Encoding');

// Set fresh Cache-Control untuk static assets
proxyReq.setHeader('Cache-Control', 'public, max-age=0');
```

---

## 7. Proxy Logic

### 7.1 Route Configuration Schema

```json
{
  "id": "route-1704067200000",
  "path": "/upah",
  "target": "http://localhost:8002",
  "description": "Payroll & Upah Service",
  "enabled": true,
  "rewriteContent": true,
  "changeOrigin": true,
  "rewritePath": true,
  "public": false,
  "aliases": ["/payroll", "/gaji"],
  "staticRoots": [
    {
      "prefix": "/upah/assets",
      "dir": "Services/upah/dist/assets"
    }
  ],
  "textRewrites": [
    { "from": "old-domain.com", "to": "new-domain.com" }
  ]
}
```

### 7.2 Proxy Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `target` | string | required | Backend URL |
| `changeOrigin` | boolean | true | Change Origin header |
| `pathRewrite` | object | `{}` | Path prefix stripping |
| `ws` | boolean | true | Enable WebSocket |
| `selfHandleResponse` | boolean | true | Manual response handling |
| `rewriteContent` | boolean/object | true | Content rewriting |
| `public` | boolean | false | Skip auth check |
| `rewritePath` | boolean | true | Strip route prefix |

### 7.3 Passthrough vs Rewrite Routes

**Passthrough (rewriteContent: false):**
- Video streaming
- Large file downloads
- Binary data
- API responses (no HTML/JS/CSS)

**Rewrite (rewriteContent: true):**
- SPA applications
- HTML pages
- JavaScript bundles
- CSS stylesheets

---

## 8. Static File Serving

### 8.1 Static Routes Configuration

**server.js:**
```javascript
// Dashboard assets
app.use('/assets', express.static(path.join(__dirname, 'Dashboard_Utama', 'public', 'assets')));

// Upah dist
app.use('/upah/assets', express.static(path.join(upahDistPath, 'assets')));
app.use('/upah/images', express.static(path.join(upahDistPath, 'images')));
app.use('/upah/vite.svg', express.static(path.join(upahDistPath, 'vite.svg')));
```

**server_bun.js:**
```javascript
const DEFAULT_STATIC_ROOTS = [
    { prefix: '/assets', dir: `${DASHBOARD_DIR}/public/assets`, immutable: false },
    { prefix: '/upah/assets', dir: `${ROOT_DIR}/Services/upah/dist/assets`, immutable: true },
    { prefix: '/upah/images', dir: `${ROOT_DIR}/Services/upah/dist/images`, immutable: false },
    // ...
];

async function serveLocalFile(filePath, reqPath, options = {}) {
    const file = Bun.file(filePath);
    if (!(await file.exists())) return null;
    
    const body = await file.arrayBuffer();
    return new Response(body, {
        headers: {
            'Content-Type': getMimeType(reqPath),
            'Cache-Control': options.cacheControl,
            'Server': 'Bun-Proxy',
        }
    });
}
```

### 8.2 Cache-Control Headers

| Asset Type | Development | Production |
|------------|-------------|------------|
| HTML | no-cache, no-store | no-cache, no-store |
| JS/CSS (hashed) | public, max-age=31536000, immutable | immutable |
| JS/CSS (not hashed) | public, max-age=3600 | public, max-age=3600 |
| Images | public, max-age=3600 | public, max-age=604800 |
| Fonts | public, max-age=31536000, immutable | immutable |

### 8.3 MIME Type Detection

```javascript
function getMimeType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const types = {
        'js': 'application/javascript',
        'css': 'text/css',
        'html': 'text/html',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'svg': 'image/svg+xml',
        'woff2': 'font/woff2',
        // ...
    };
    return types[ext] || 'application/octet-stream';
}
```

---

## 9. WebSocket Support

### 9.1 WebSocket Detection

```javascript
// server.js (Express)
const isWebSocketRequest = 
    (req.headers.connection || '').toLowerCase().includes('upgrade') ||
    (req.headers.upgrade || '').toLowerCase() === 'websocket';

// server_bun.js (Bun)
function isWebSocketRequest(req) {
    return (req.headers.get('upgrade') || '').toLowerCase() === 'websocket';
}
```

### 9.2 WebSocket Upgrade (server.js)

```javascript
server.on('upgrade', (req, socket, head) => {
    const reqPath = req.url;
    console.log(`🔌 WebSocket upgrade: ${reqPath}`);
    
    // Route matching berdasarkan:
    // 1. URL path
    // 2. Origin header
    // 3. Referer header
    // 4. Vite dev server pattern (/:5173-5177)
    
    let matchedRoute = sortedRoutes.find(r => 
        r.enabled && reqPath.startsWith(r.path)
    );
    
    if (matchedRoute) {
        const wsProxy = getWsProxyMiddleware(matchedRoute);
        wsProxy.upgrade(req, socket, head);
    } else {
        socket.destroy();
    }
});
```

### 9.3 WebSocket Proxy (server_bun.js)

```javascript
websocket: {
    open(client) {
        const upstream = new WebSocket(client.data.upstreamUrl);
        client.data.upstream = upstream;
        
        upstream.onopen = () => {
            // Flush queued messages
            for (const msg of client.data.queue || []) {
                upstream.send(msg);
            }
            client.data.queue = [];
        };
        
        upstream.onmessage = (event) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(event.data);
            }
        };
        
        upstream.onclose = (event) => {
            client.close(event.code || 1000, event.reason);
        };
    },
    
    message(client, message) {
        const upstream = client.data.upstream;
        if (upstream?.readyState === WebSocket.OPEN) {
            upstream.send(message);
        } else {
            // Queue message until upstream connects
            client.data.queue ||= [];
            client.data.queue.push(message);
        }
    },
    
    close(client) {
        client.data.upstream?.close();
    },
}
```

### 9.4 Dashboard WebSocket (Next.js HMR)

```javascript
function dashboardWsTarget(reqPath, search) {
    if (!reqPath.startsWith('/_next/webpack-hmr')) return null;
    return `${DASHBOARD_TARGET.replace(/^http:/, 'ws:')}${reqPath}${search}`;
}
```

---

## 10. Route Management API

### 10.1 API Endpoints

**File:** `D:\Gawean Rebinmas\Main Dashboard\server.js`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/routes` | List semua routes |
| POST | `/api/routes` | Add new route |
| PUT | `/api/routes/:id` | Update route |
| DELETE | `/api/routes/:id` | Delete route |
| POST | `/api/routes/:id/toggle` | Toggle enable/disable |
| GET | `/api/routes/:id/health` | Check backend health |

### 10.2 GET /api/routes

```javascript
app.get('/api/routes', (req, res) => {
    res.json(routes);
});
```

### 10.3 POST /api/routes

```javascript
app.post('/api/routes', express.json(), (req, res) => {
    const { path: routePath, target, description, enabled } = req.body;
    
    if (!routePath || !target) {
        return res.status(400).json({ error: 'Path and target are required' });
    }
    
    const newRoute = {
        id: `route-${Date.now()}`,
        path: routePath,
        target,
        description: description || '',
        enabled: enabled !== false
    };
    
    routes.push(newRoute);
    saveRoutes();
    
    res.json({ message: 'Route added successfully', route: newRoute });
});
```

### 10.4 Health Check

```javascript
app.get('/api/routes/:id/health', async (req, res) => {
    const route = routes.find(r => r.id === req.params.id);
    if (!route) {
        return res.status(404).json({ error: 'Route not found' });
    }
    
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(route.target, {
            method: 'HEAD',
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        res.json({ status: response.ok ? 'healthy' : 'unhealthy' });
    } catch (error) {
        res.json({ status: 'unhealthy', error: error.message });
    }
});
```

---

## 11. Gateway Smoke Test

**Lokasi File:** `D:\Gawean Rebinmas\Main Dashboard\scripts\gateway-smoke.js`

### 11.1 Test Cases

```javascript
async function main() {
    // 1. Gateway health check
    await check('gateway health', async () => {
        const response = await request('/__gateway/health');
        assert(response.status === 200);
        const body = await response.json();
        assert(body.ok === true);
    });
    
    // 2. Landing page
    await check('landing page route', async () => {
        const response = await request('/');
        assert(response.status !== 404);
        assert(response.status < 500);
    });
    
    // 3. Login page
    await check('login page route', async () => {
        const response = await request('/login');
        assert(response.status !== 404);
        assert(response.status < 500);
    });
    
    // 4. Protected route redirect
    await check('protected dashboard redirects unauthenticated', async () => {
        const response = await request('/dashboard');
        assert([302, 307, 308, 401].includes(response.status));
        if (response.status !== 401) {
            const location = response.headers.get('location') || '';
            assert(location.includes('/login'));
        }
    });
    
    // 5. Configured routes
    for (const route of routes) {
        await check(`configured route ${route.path}`, async () => {
            const response = await request(route.path, { 
                headers: { accept: 'text/html' } 
            });
            // Public routes harus accessible
            if (route.public === true) {
                assert(response.status !== 404);
                assert(response.status !== 500);
            } else {
                // Protected routes bisa redirect/401/502/503
                assert([302, 307, 308, 401, 502, 503].includes(response.status) 
                    || response.status < 400);
            }
        });
    }
    
    // 6. Static asset cache header
    await check('upah static asset cache header', async () => {
        const response = await request(sampleAsset);
        assert(response.status !== 404);
        const cacheControl = response.headers.get('cache-control') || '';
        assert(cacheControl.includes('max-age'));
    });
}
```

### 11.2 Running the Test

```bash
# From project root
node scripts/gateway-smoke.js

# Or with bun
bun run scripts/gateway-smoke.js
```

### 11.3 Expected Output

```
PASS gateway health
PASS landing page route
PASS login page route
PASS protected dashboard redirects unauthenticated
PASS configured route /upah
PASS configured route /absen
PASS upah static asset cache header

Gateway smoke passed
```

---

## 12. Production vs Development

### 12.1 Environment Configuration

**Development (.env.development):**
```
NODE_ENV=development
PORT=3001
BACKEND_HOST=localhost
BACKEND_HOST_FALLBACK=localhost
```

**Production (.env.production):**
```
NODE_ENV=production
PORT=3001
BACKEND_HOST=223.25.98.220
BACKEND_HOST_FALLBACK=10.0.0.110
```

### 12.2 Differences

| Aspect | Development | Production |
|--------|-------------|------------|
| Next.js | `dev: true` | `dev: false` |
| Hot Reload | Yes | No |
| Morgan | `dev` format | `combined` format |
| Source Maps | Enabled | Disabled |
| Error Details | Verbose | Minimal |
| Dashboard Port | 3000 | Build artifact |
| Logging | Console + file | File only |

### 12.3 Startup Scripts

**package.json:**
```json
{
  "scripts": {
    "dev": "node server.js",
    "start": "NODE_ENV=production node server.js",
    "build:dashboard": "cd Dashboard_Utama && npm run build"
  }
}
```

**Bun startup:**
```bash
# Development
bun --watch run server_bun.js

# Production
NODE_ENV=production bun run server_bun.js
```

---

## 13. 9Router Integration (Port 20128)

### 13.1 Overview

9Router adalah router service yang berjalan di port 20128 dan terintegrasi dengan gateway melalui proxy configuration.

### 13.2 Konfigurasi Route

Di `routes-config.json`:

```json
[
  {
    "id": "route-9router",
    "path": "/9router",
    "target": "http://localhost:20128",
    "description": "9Router Service",
    "enabled": true,
    "rewriteContent": false,
    "public": true
  }
]
```

### 13.3 Integration Flow

```
Client Request (http://localhost:3001/9router/api/...)
        │
        ▼
┌─────────────────────────────────────┐
│ Gateway Route Matching              │
│ path: /9router                      │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Proxy Middleware                    │
│ target: http://localhost:20128     │
│ pathRewrite: {'^/9router': ''}     │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ 9Router Service (Port 20128)        │
│ Receives: /api/...                  │
└─────────────────────────────────────┘
```

### 13.4 Request Headers Forwarding

Headers yang di-forward ke 9Router:

```javascript
// Standard headers
'X-Forwarded-For': client IP
'X-Forwarded-Host': localhost:3001
'X-Real-IP': client IP
'Host': localhost:20128

// Request-specific
'Content-Type': preserved
'Authorization': preserved
'Cookie': sanitized (auth-token stripped)
```

### 13.5 Response Handling

```javascript
// 9Router responses biasanya JSON API
// Tidak需要进行 HTML/JS/CSS rewriting

if (!shouldRewriteContent) {
    const responseHeaders = copyResponseHeaders(response.headers);
    responseHeaders.set('Cache-Control', cacheControl);
    responseHeaders.set('X-Proxy-Elapsed', `${elapsed}ms`);
    
    return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
    });
}
```

---

## Appendix: File Path Reference

| File | Absolute Path |
|------|---------------|
| server.js | `D:\Gawean Rebinmas\Main Dashboard\server.js` |
| server_bun.js | `D:\Gawean Rebinmas\Main Dashboard\server_bun.js` |
| routes-config.json | `D:\Gawean Rebinmas\Main Dashboard\routes-config.json` |
| gateway-smoke.js | `D:\Gawean Rebinmas\Main Dashboard\scripts\gateway-smoke.js` |
| Dashboard_Utama | `D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama` |
| keys/ | `D:\Gawean Rebinmas\Main Dashboard\keys` |
| public/ | `D:\Gawean Rebinmas\Main Dashboard\public` |
| ../ | `D:\Gawean Rebinmas\Main Dashboard\Dokumentasi` |
| Services/ | `D:\Gawean Rebinmas\Main Dashboard\Services` |

---

*Document generated: 2026-06-10*
