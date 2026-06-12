# Proxy Gateway — Dokumentasi Teknis

**Project:** PT Rebinmas Jaya Main Dashboard  
**Files:** `server.js`, `server_bun.js`, `routes-config.json`, `package.json`  
**Updated:** 2026-06-12

---

## 1. Overview

Proxy gateway adalah Express/Bun server yang berjalan di **port 3001** dan menangani seluruh traffic incoming. Gateway ini berfungsi sebagai:

1. **Reverse Proxy** — meneruskan request ke 6+ backend service
2. **Next.js Host** — menjalankan Next.js dashboard
3. **Content Rewriter** — rewrite URL di HTML/JS/CSS agar berjalan di sub-path
4. **Route Manager** — API untuk manage route definitions secara dynamic
5. **Static File Server** — serve static assets langsung tanpa proxy

**Tech Stack:** Express + http-proxy-middleware (Node) / Bun native HTTP (server_bun.js)  
**Port Default:** 3001  
**Node.js Version:** Mendukung Bun (`Bun.version` detection)

---

## 2. Architecture

```
Browser / Client
       │
       ▼
 ┌─────────────────────────────────────────────┐
  │  Gateway (server.js / server_bun.js)        │
  │  Port 3001                                  │
  │                                             │
  │  ┌─ Static Serving ─────────────────────┐  │
  │  │  /assets/*   → Dashboard_Utama/pub/   │  │
  │  │  /upah/assets → Dashboard_Utama/pub/  │  │
  │  │  /upah/images → upah/dist/images │  │
  │  └───────────────────────────────────────┘  │
  │                                             │
  │  ┌─ Dynamic Proxy ───────────────────────┐  │
  │  │  /upah/*     → localhost:8002         │  │
  │  │  /absen/*    → localhost:5176         │  │
  │  │  /monitoring-beras/* → localhost:5177 │  │
  │  │  /query/*    → localhost:8001         │  │
  │  │  /file/*     → localhost:5178         │  │
  │  │  /ifess/*    → localhost:8003         │  │
  │  └───────────────────────────────────────┘  │
  │                                             │
  │ ┌─ Next.js Dashboard ───────────────────┐  │
  │  │  /report-center/*                    │  │
  │  │  /dashboard/*                       │  │
  │  │  /admin/*                           │  │
  │  │  /login                             │  │
  │  └───────────────────────────────────────┘  │
  │                                             │
  │ ┌─ Route Management API ────────────────┐  │
  │  │  GET /api/routes │  │
  │  │  POST /api/routes                    │  │
  │  │  PUT  /api/routes/:id                │  │
  │  │  DEL /api/routes/:id                │  │
  │  │  POST /api/routes/:id/toggle         │  │
  │  │  GET  /api/routes/:id/health          │  │
  │  └───────────────────────────────────────┘  │
  └─────────────────────────────────────────────┘
```

---

## 3. File Structure

```
Main Dashboard/
├── server.js                    # Express proxy gateway (836 lines)
├── server_bun.js                # Bun native proxy (optimized, in progress)
├── routes-config.json            # Route definitions (production)
├── routes-config.development.json # Route definitions (development, optional)
├── package.json                  # Scripts& dependencies
├── .env.development             # Dev env vars
├── .env.production              # Prod env vars
├── public/
│   └── index.html               # Route management UI
└── Dashboard_Utama/             # Next.js dashboard app
```

---

## 4. Routes Configuration

File: `routes-config.json` — array of route objects.

### Route Schema
```json
{
  "id": "string",              // Unique identifier
  "path": "/string",           // Gateway path prefix
  "target": "http://host:port", // Upstream target
  "description": "string",      // Human-readable description
  "enabled": true,              // Enable/disable route
  "rewriteContent": false,      // false = passthrough (no rewrite)
                               // "html-only" = rewrite HTML only
                               // true = rewrite HTML+JS+CSS
  "changeOrigin": true,         // Modify Host header
  "rewritePath": true,          // Strip path prefix when proxying
  "public": false,             // Skip auth middleware
  "textRewrites": [             // Custom text replacements
    { "from": "string", "to": "string" }
  ],
  "staticRoots": [              // Static file serving config
    { "prefix": "/path", "dir": "C:/...", "immutable": true }
  ],
  "healthPath": "/",            // Health check path
  "timeoutMs": 30000,           // Proxy timeout
  "cachePolicy": "static",      // Cache policy hint
  "image": "https://..."        // Thumbnail image URL
}
```

### Active Routes (Production)

| ID | Path | Target | Description | rewriteContent |
|----|------|--------|-------------|----------------|
| upah | `/upah` | localhost:8002 | Payroll System | html-only |
| backend-upah | `/backend/upah` | localhost:8002 | Payroll API | false |
| absen | `/absen` | localhost:5176 | Attendance System | false |
| monitoring-beras | `/monitoring-beras` | localhost:5177 | Rice Monitoring | false |
| query | `/query` | localhost:8001 | SQL Gateway API | false |
| file | `/file` | localhost:5178 | Google Drive Gateway | false |
| ifess | `/ifess` | localhost:8003 | IFESS Client | false |

---

## 5. Proxy Middleware — Deep Dive

### 5.1 Content Rewriting Flow

```
Request → Express
  ↓
Is static asset? → serve directly (no proxy)
  ↓
Find matching route (longest path first)
  ↓
Is WebSocket upgrade? → use wsProxyCache (passthrough)
  ↓
Is rewriteContent=false? → use wsProxyCache (passthrough)
  ↓
Is normal HTTP? → use proxyCache (selfHandleResponse: true)
  ↓
  ├─ Remove Accept-Encoding (decompress for rewrite)
  ├─ Remove If-None-Match / If-Modified-Since (force fresh)
  ├─ Sanitize cookies (strip auth-token RS256)
  ├─ Proxy to target
  ├─ Intercept response
  ├─ Decompress if gzip/deflate
  ├─ Rewrite content (HTML/JS/CSS)
  │   ├─ Replace target URLs → route path
  │   ├─ Replace ptrjestate.rebinmas.com:8002 → route path
  │   ├─ Add <base href="route.path/">
  │   ├─ Rewrite script src, link href, img src, a href
  │   ├─ Rewrite JS: import/fetch statements
  │   └─ Rewrite CSS: url() references
  ├─ Update Content-Length
  └─ Send rewritten response
```

### 5.2 Cookie Sanitization (Critical)

```javascript
// Strip 'auth-token' (RS256 JWT) because backend (8002) expects HS256
// Backend uses 'payroll_auth_token' (HS256) or no auth
const safeCookies = cookies.filter(c => !c.trim().startsWith('auth-token='));
```

**Problem:** RS256 JWT from dashboard auth causes HTTP 500/404 on backend8002.  
**Solution:** Strip `auth-token` cookie, preserve `payroll_auth_token`.

### 5.3 Hot-Reload Config

```javascript
fs.watchFile(CONFIG_FILE, (curr, prev) => {
 loadRoutes();
    proxyCache.clear();
    wsProxyCache.clear();
});
// No restart needed — routes config reloads automatically
```

---

## 6. Route Management API

### GET /api/routes
Returns all configured routes.

### POST /api/routes
Add new route. Body: `{path, target, description, enabled}`

### PUT /api/routes/:id
Update route. Body: `{path?, target?, description?, enabled?}`

### POST /api/routes/:id/toggle
Toggle route enabled/disabled.

### DELETE /api/routes/:id
Delete route by ID.

### GET /api/routes/:id/health
Health check — sends HEAD to target, returns `{status: 'healthy'|'unhealthy'}`.

### GET /config-path
Serves the web-based route management UI from `public/index.html`.

---

## 7. Next.js Integration

```javascript
// Gateway loads Next.js from Dashboard_Utama/node_modules
const next = require(path.join(DASHBOARD_DIR, 'node_modules', 'next'));

const nextApp = next({
    dev: process.env.NODE_ENV !== 'production',
    dir: DASHBOARD_DIR,
    hostname: 'localhost',
    port: Number(PORT)  // 3001
});
const nextHandle = nextApp.getRequestHandler();
```

**Dashboard routes handled by Next.js:**
- `/` (root → landing page)
- `/report-center/*`
- `/login`
- `/dashboard/*`
- `/dashboard-user/*`
- `/admin/*`
- `/modules/*`
- `/api/auth/*`
- `/api/services/*`
- `/api/routes/*`
- `/api/reports/*`

---

## 8. Performance Optimizations (PLANS.md)

### F-001: Static Extension Fast-Path ✅
```javascript
// server_bun.js: serve static assets via Bun.file() directly
const staticPath = getStaticFilePath(reqPath);
if (staticPath) {
    const file = Bun.file(staticPath);
    return new Response(await file.arrayBuffer(), {
        headers: { 'Content-Type': getMimeType(reqPath),
                   'Cache-Control': 'public, max-age=31536000, immutable' }
    });
}
```

### F-002: Cache-Control Headers ✅
- JS/CSS with version hash: `public, max-age=31536000, immutable`
- HTML: `no-cache, no-store, must-revalidate`
- Assets: `public, max-age=0`

### F-003: Selective Compression Preservation (PENDING)
Preserve backend gzip/brotli for `rewriteContent: false` routes.

### F-004: LRU In-Memory Cache (PENDING)
Cache `/upah` chunks with 30-min TTL.

### F-005: Selective URL Rewriting (PENDING)
Only rewrite HTML/text. Binary (images, fonts) skip rewrite.

---

## 9. Environment Configuration

### .env.development
```
NODE_ENV=development
PORT=3001
BACKEND_HOST=localhost
BACKEND_HOST_FALLBACK=localhost
DASHBOARD_PORT=3100
START_DASHBOARD=true
```

### .env.production
```
NODE_ENV=production
PORT=3001
BACKEND_HOST=223.25.98.220
BACKEND_HOST_FALLBACK=10.0.0.110
DASHBOARD_PORT=3100
START_DASHBOARD=true
```

---

## 10. NPM Scripts

```bash
# Main scripts
npm run dev              # Bun server_bun.js dev mode
npm run start # Bun server_bun.js production
npm run build:dashboard  # Build Next.js from root

# Express fallback
npm run start:express    # node server.js production
npm run dev:express      # node server.js development

# Bun variants
npm run dev:bun # Bun server_bun.js dev
npm run start:bun # Bun server_bun.js prod
npm run dev:fast         # Alias for dev:bun
npm run start:fast # Alias for start:bun

# Gateway only (no dashboard)
npm run start:gateway    # Bun server_bun.js, no START_DASHBOARD

# Utilities
npm run smoke:gateway    # bun scripts/gateway-smoke.js
npm run bench            # bun run test.ts
```

---

## 11. Troubleshooting

### Backend service unreachable
```javascript
// onError handler returns 502 with JSON error
res.status(502).json({
    error: 'Proxy Error',
    message: `Backend service at ${route.target} is not reachable`,
    details: err.message
});
```

### Cookie causing500 on backend
Check logs for `⚠️ WARNING: payroll_auth_token is MISSING!`  
Solution: Login via port 8002 to get `payroll_auth_token` cookie.

### Next.js HMR not working
Check if WebSocket proxy is active: `🔌 Using passthrough proxy for: /upah/@vite/client`

### Static assets404
Verify `dashboardAssetsPath` exists: `Dashboard_Utama/public/assets/`

---

## 12. Key Code Snippets

### Finding matching route (longest path first)
```javascript
const sortedRoutes = [...routes].sort((a, b) => b.path.length - a.path.length);
let matchedRoute = sortedRoutes.find(r => r.enabled && reqPath.startsWith(r.path));
```

### HTML URL rewriting
```javascript
body = body.replace(/(<script[^>]+src=["']\s*)\/(?!\/)/gi, `$1${route.path}/`);
body = body.replace(/(<link[^>]+href=["']\s*)\/(?!\/)/gi, `$1${route.path}/`);
body = body.replace(/(<img[^>]+src=["']\s*)\/(?!\/)/gi, `$1${route.path}/`);
if (!body.includes('<base')) {
    body = body.replace(/<head>/i, `<head>\n  <base href="${route.path}/">`);
}
```

### WebSocket detection
```javascript
const isWebSocketRequest =
    (req.headers.connection || '').toLowerCase().includes('upgrade') ||
    (req.headers.upgrade || '').toLowerCase() === 'websocket';
```