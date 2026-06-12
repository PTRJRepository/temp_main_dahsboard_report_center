# Project Overview — PT Rebinmas Jaya Unified Dashboard & Proxy Gateway

**Last updated:** 2026-06-10

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Package.json Scripts & Dependencies](#2-packagejson-scripts--dependencies)
3. [Server Entry Point](#3-server-entry-point)
4. [Environment Configuration](#4-environment-configuration)
5. [Route Configuration](#5-route-configuration)
6. [Server Architecture](#6-server-architecture)
7. [Port Mapping](#7-port-mapping)
8. [Proxy Gateway Setup](#8-proxy-gateway-setup)
9. [Deployment Notes](#9-deployment-notes)

---

## 1. Project Overview

**Path:** `D:\Gawean Rebinmas\Main Dashboard\`

### Deskripsi Proyek

Unified Dashboard and Proxy Gateway untuk **PT Rebinmas Jaya** — sebuah sistem management proxy dengan UI dashboard untuk mengelola routing dari berbagai service lokal yang berjalan di port berbeda, semuanya dapat diakses melalui **satu port gateway (3001)**.

### Teknologi Stack

| Layer | Teknologi | Keterangan |
|-------|-----------|------------|
| Gateway | Bun / Node.js + Express | Reverse proxy server |
| Dashboard | Next.js 16 (React 19, App Router, TypeScript) | Frontend dashboard |
| Database | MSSQL (reporting), SQLite via Prisma (auth/users) | Data storage |
| Auth | NextAuth.js (JWT RS256) | Authentication |
| Bundler | Vite | Frontend build (upah service) |
| Proxy Middleware | http-proxy-middleware | Route proxying |

### Arsitektur Dual-Layer

```
Root (/) — Bun/Express proxy gateway (port 3001)
    │
    └── Dashboard_Utama/ — Next.js 16 dashboard (dev: port 3100, production: embedded)
```

### Direktori Utama

```
D:\Gawean Rebinmas\Main Dashboard\
├── server.js                    # Express gateway entrypoint (legacy)
├── server_bun.js                # Bun native gateway (production recommended)
├── routes-config.json           # Route definitions (development)
├── routes-config.production.json # Route definitions (production)
├── package.json                 # Dependencies
├── .env.production              # Production environment config
├── keys/                        # JWT RSA keypairs
├── Dokumentasi/                 # Service usage guides
├── Services/                    # Upstream services (upah, absen, dll)
└── Dashboard_Utama/             # Next.js dashboard app
    └── app/
        ├── api/                 # Route Handlers (auth/, reports/, services/)
        ├── report-center/      # Report viewer pages
        ├── actions/             # Server Actions
        └── ...                  # pages and layouts
```

---

## 2. Package.json Scripts & Dependencies

**Path:** `D:\Gawean Rebinmas\Main Dashboard\package.json`

### Scripts

| Script | Command | Keterangan |
|--------|---------|------------|
| `start` | `NODE_ENV=production DASHBOARD_PORT=3100 START_DASHBOARD=true bun run server_bun.js` | Start production dengan Bun |
| `dev` | `NODE_ENV=development DASHBOARD_PORT=3100 START_DASHBOARD=true bun run server_bun.js` | Start development dengan Bun |
| `build:dashboard` | `bun --cwd Dashboard_Utama run build` | Build Next.js dashboard |
| `start:express` | `cross-env NODE_ENV=production node server.js` | Start dengan Express (Node.js) |
| `dev:express` | `cross-env NODE_ENV=development node server.js` | Dev dengan Express (Node.js) |
| `dev:express-orig` | `cross-env NODE_ENV=development bun --watch server.js` | Dev Express dengan hot-reload |
| `start:bun` | `NODE_ENV=production DASHBOARD_PORT=3100 START_DASHBOARD=true bun run server_bun.js` | Alias untuk start |
| `dev:bun` | `NODE_ENV=development DASHBOARD_PORT=3100 START_DASHBOARD=true bun run server_bun.js` | Alias untuk dev |
| `start:gateway` | `NODE_ENV=production DASHBOARD_PORT=3100 START_DASHBOARD=false bun run server_bun.js` | Start gateway only (no dashboard) |
| `start:fast` | `bun run start:bun` | Quick start |
| `dev:fast` | `bun run dev:bun` | Quick dev |
| `smoke:gateway` | `bun scripts/gateway-smoke.js` | Smoke test gateway |
| `bench` | `bun run test.ts` | Benchmark test |

### Dependencies

| Package | Version | Fungsi |
|---------|--------|--------|
| `express` | ^4.18.2 | HTTP server framework (legacy) |
| `http-proxy-middleware` | ^2.0.6 | Proxy middleware |
| `cors` | ^2.8.5 | CORS support |
| `morgan` | ^1.10.0 | HTTP logging |
| `mssql` | ^12.2.0 | MSSQL database driver |
| `dotenv` | ^16.3.1 | Environment variable loading |
| `bcryptjs` | ^3.0.3 | Password hashing |
| `cross-env` | ^7.0.3 | Cross-platform env vars |
| `next` | ^14.1.0 | Next.js framework |
| `react` | ^18.2.0 | React library |
| `react-dom` | ^18.2.0 | React DOM |

### Dev Dependencies

| Package | Version | Fungsi |
|---------|--------|--------|
| `autocannon` | ^8.0.0 | HTTP benchmarking |

---

## 3. Server Entry Point

### server_bun.js (Production Recommended)

**Path:** `D:\Gawean Rebinmas\Main Dashboard\server_bun.js`

Bun native proxy gateway dengan optimasi performa:

- **Native HTTP server** dengan zero middleware overhead
- **LRU In-Memory Cache** untuk static assets (TTL 5-30 menit)
- **Streaming passthrough** untuk non-HTML content
- **Connection pooling** via keep-alive
- **Compression pass-through** untuk non-rewrite routes
- **JWT verification** lightweight (RS256)
- **SPA support** dengan text rewrite patterns
- **Static file bypass** — serves directly via `Bun.file()`

```javascript
// Run: bun run server_bun.js
// Dev: bun --watch run server_bun.js
```

### server.js (Legacy Express)

**Path:** `D:\Gawean Rebinmas\Main Dashboard\server.js`

Express-based proxy gateway:

- **Middleware-based** dengan `http-proxy-middleware`
- **selfHandleResponse: true** — buffers entire response untuk rewrite
- **Hot-reload routes** via `fs.watchFile()`
- **Management API** untuk CRUD routes
- **Dashboard static serving** dari `public/` folder

```javascript
// Run: node server.js
// Dev: bun --watch server.js
```

### Perbandingan

| Fitur | server_bun.js | server.js |
|-------|---------------|-----------|
| Runtime | Bun | Node.js |
| Performance | ~nginx-equivalent | Standard Express |
| Static Caching | LRU 30-min TTL | None |
| Memory Usage | Lower | Higher |
| Compression | Pass-through | Stripped |
| WebSocket | Native upgrade | Via http-proxy |
| Maintenance | Active | Legacy |

---

## 4. Environment Configuration

**Path:** `D:\Gawean Rebinmas\Main Dashboard\.env.production`

### Production Environment Variables

```bash
# Environment
NODE_ENV=production

# Server Configuration
PORT=3001                                    # Gateway port
NEXTAUTH_URL=http://localhost:3001           # Auth callback URL

# Cookie Configuration
COOKIE_SECURE=false                          # false untuk localhost HTTP

# Backend Service Hosts
BACKEND_HOST=localhost                        # Primary backend
BACKEND_HOST_FALLBACK=localhost              # Fallback backend

# Service Ports
UPAH_PORT=5175                               # Payroll service
ABSEN_PORT=5176                             # Attendance service
MONITORING_BERAS_PORT=5177                   # Rice monitoring service
GDRIVE_PORT=5178                            # Google Drive service

# SQL Server Configuration (Production)
MSSQL_HOST=10.0.0.110                        # MSSQL host
MSSQL_PORT=1433                             # MSSQL port
MSSQL_USER=sa                               # MSSQL username
MSSQL_PASSWORD=ptrj@123                     # MSSQL password
MSSQL_DATABASE=extend_db_ptrj               # MSSQL database
```

### Environment Loading Logic

```javascript
// Development: loads .env.development
// Production: loads .env.production
const env = process.env.NODE_ENV || 'development';
const envPath = path.join(ROOT_DIR, `.env.${env}`);
```

### Dashboard Environment

```bash
DASHBOARD_PORT=3100                    # Next.js dev server port
START_DASHBOARD=true                   # Auto-start dashboard process
DASHBOARD_TARGET=http://127.0.0.1:3100 # Dashboard upstream URL
```

---

## 5. Route Configuration

### routes-config.json (Development)

**Path:** `D:\Gawean Rebinmas\Main Dashboard\routes-config.json`

### routes-config.production.json (Production)

**Path:** `D:\Gawean Rebinmas\Main Dashboard\routes-config.production.json`

### Route Definitions

| Route ID | Path | Target | Description | Auth |
|----------|------|--------|-------------|------|
| `upah` | `/upah` | `localhost:8002` | Sistem Penggajian/Payroll | Protected |
| `backend-upah` | `/backend/upah` | `localhost:8002` | Payroll API Backend | Public |
| `absen` | `/absen` | `localhost:5176` | Sistem Absensi Karyawan | Protected |
| `monitoring-beras` | `/monitoring-beras` | `localhost:5177` | Monitoring Distribusi Beras | Protected |
| `query` | `/query` | `localhost:8001` | SQL Gateway API | Public |
| `file` | `/file` | `localhost:5178` | Google Drive File Gateway | Protected |
| `ifess` | `/ifess` | `localhost:8003` | IFESS Client Gateway | Public |

### Route Aliases (upah)

```json
{
  "aliases": [
    "/auth",
    "/payroll",
    "/employees",
    "/employee-estate",
    "/dev-mode",
    "/tax-report",
    "/tunjangan",
    "/spreadsheet",
    "/reports",
    "/mill-production"
  ]
}
```

### Static Roots Configuration

```json
{
  "staticRoots": [
    {
      "prefix": "/upah/assets",
      "dir": "D:/Gawean Rebinmas/.../frontend/dist/assets",
      "immutable": true
    },
    {
      "prefix": "/upah/images",
      "dir": "D:/Gawean Rebinmas/.../assets/images",
      "immutable": false
    }
  ]
}
```

### Route Schema Properties

| Property | Type | Default | Keterangan |
|----------|------|---------|------------|
| `id` | string | required | Unique route identifier |
| `path` | string | required | Gateway path prefix |
| `target` | string | required | Upstream service URL |
| `description` | string | "" | Route description |
| `enabled` | boolean | true | Enable/disable route |
| `public` | boolean | false | Skip auth check |
| `rewriteContent` | boolean/string | true | Rewrite HTML/JS/CSS paths |
| `rewritePath` | boolean | true | Strip path prefix |
| `changeOrigin` | boolean | true | Change Origin header |
| `aliases` | array | [] | Additional path aliases |
| `staticRoots` | array | [] | Static file serving config |
| `spaIndex` | string | undefined | SPA index.html path |
| `apiPrefixes` | array | [] | API path prefixes |
| `textRewrites` | array | [] | Content rewrite rules |

---

## 6. Server Architecture

### Proxy Gateway Flow

```
Client Request
     │
     ▼
┌─────────────────────────────┐
│  Bun/Express Gateway        │
│  (port 3001)                │
└─────────────┬───────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
Static File Bypass   Route Match
    │                   │
    ▼                   ▼
Bun.file() ──────► Proxy Request
                    │
                    ▼
              ┌─────────────────┐
              │ Upstream Service│
              │ (localhost:XXXX)│
              └─────────────────┘
```

### Dashboard Architecture

```
Gateway Request
     │
     ▼
┌─────────────────────────────┐
│  Dashboard Proxy            │
│  (server_bun.js)           │
└─────────────┬───────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
SPA Navigation     API/Report
    │                   │
    ▼                   ▼
Next.js Pages    Route Handlers
(NextAuth + JWT)  (MSSQL Query)
```

### Report System Architecture

```
Dashboard UI (Next.js)
     │
     ▼
Report Center API
(/api/reports/inventory/*)
     │
     ▼
Report Handler
(lib/reports/inventory/)
     │
     ▼
MSSQL Database
(db_ptrj / db_ptrj_mill)
```

### Movement Category Logic

Movement category ditentukan oleh `StockIssueEventCount`:

| StockIssueEventCount | Category |
|---------------------|----------|
| >= 6 | Fast Moving |
| 2-5 | Moving |
| 1 | Slow Moving |
| 0 with stock > 0 | Dead Stock |
| 0 with stock = 0 | No Movement |

---

## 7. Port Mapping

### Primary Ports

| Port | Service | Description |
|------|---------|-------------|
| **3001** | Proxy Gateway | Main entry point (all traffic) |
| **3100** | Next.js Dashboard | Development server |
| **8001** | SQL Gateway | Query API service |
| **8002** | Payroll Backend | Upah/Penggajian API |
| **8003** | IFESS Backend | IFESS Client API |
| **5175** | Upah Frontend Dev | Vite dev server (upah) |
| **5176** | Absen Frontend Dev | Vite dev server (absen) |
| **5177** | Monitoring Dev | Vite dev server (monitoring) |
| **5178** | File Gateway Dev | Google Drive service dev |

### Next.js Ports

| Port | Usage |
|------|-------|
| 3001 | Production gateway port (embedded) |
| 3100 | Development Next.js server |

### MSSQL Connection

| Host | Port | Database | User |
|------|------|----------|------|
| 10.0.0.110 | 1433 | extend_db_ptrj | sa |

### Data Source Switching

| source param | Database | Description |
|--------------|----------|-------------|
| `source=pabrik` | `db_ptrj_mill` | Mill/factory data |
| `source=estate` (default) | `db_ptrj` | Estate data |

---

## 8. Proxy Gateway Setup

### Bun Gateway (Production)

```bash
# Production
bun run server_bun.js

# Development
bun --watch run server_bun.js
```

### Features

1. **Static File Bypass** — `/upah/assets/*`, `/absen/assets/*` served directly
2. **LRU Cache** — In-memory cache dengan 5-30 min TTL
3. **Content Rewriting** — Rewrite absolute URLs ke relative paths
4. **WebSocket Proxy** — HMR support untuk Vite dev servers
5. **JWT Auth** — RS256 token verification
6. **Health Check** — `GET /__gateway/health`
7. **Connection Pre-warm** — Pre-connect ke upstream services

### Text Rewrite Patterns

```javascript
const REWRITE_PATTERNS = [
  { from: /https?:\/\/localhost:8002\//g, to: '/upah/' },
  { from: /https?:\/\/localhost:5176\//g, to: '/absen/' },
  { from: /https?:\/\/localhost:5177\//g, to: '/monitoring-beras/' },
  { from: /https?:\/\/localhost:5178\//g, to: '/file/' },
  { from: /https?:\/\/localhost:8003\//g, to: '/ifess/' },
];
```

### Cache-Control Headers

| Content Type | Version Hash | Cache-Control |
|--------------|--------------|----------------|
| JS/CSS | Yes | `public, max-age=31536000, immutable` |
| JS/CSS | No | `public, max-age=3600` |
| Images | Yes | `public, max-age=31536000, immutable` |
| Images | No | `public, max-age=604800` |
| Fonts | Any | `public, max-age=31536000, immutable` |
| HTML | Any | `no-cache, no-store, must-revalidate` |

### Express Gateway (Legacy)

```bash
# Development
node server.js

# With bun hot-reload
bun --watch server.js
```

### Management API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/routes` | List all routes |
| POST | `/api/routes` | Add new route |
| PUT | `/api/routes/:id` | Update route |
| DELETE | `/api/routes/:id` | Delete route |
| POST | `/api/routes/:id/toggle` | Toggle route |
| GET | `/api/routes/:id/health` | Health check |

### Management Dashboard UI

Access: `http://localhost:3001/config-path`

---

## 9. Deployment Notes

### Development Deployment

```bash
# Start all services
npm run dev

# Or use Bun directly
bun run server_bun.js
```

### Production Deployment

```bash
# Build dashboard first
npm run build:dashboard

# Start production gateway
npm start
# or
bun run server_bun.js
```

### Environment-Specific Config

| Environment | Config File | .env File |
|-------------|-------------|-----------|
| Development | `routes-config.json` | `.env.development` or `.env` |
| Production | `routes-config.production.json` | `.env.production` |

### Health Monitoring

```bash
# Check gateway health
curl http://localhost:3001/__gateway/health

# Response
{
  "ok": true,
  "gateway": "bun",
  "dashboardTarget": "http://127.0.0.1:3100",
  "routes": [...]
}
```

### Performance Optimization Features

1. **Static Extension Fast-Path** — Zero buffering untuk JS/CSS/images
2. **LRU In-Memory Cache** — Cache frequent requests
3. **Compression Pass-through** — Preserve upstream gzip/br
4. **Connection Pre-warm** — Pre-connect ke upstream
5. **Idle Timeout** — Configurable via `GATEWAY_IDLE_TIMEOUT_SECONDS`

### Troubleshooting

#### Route tidak work setelah add/edit
```bash
# Restart server
npm start
```

#### Backend service unreachable
1. Pastikan backend service running
2. Check port number
3. Check health status
4. Verify target URL format

#### Port 3001 sudah digunakan
```bash
# Edit server_bun.js atau server.js
const PORT = parseInt(process.env.PORT || '3002');
```

### Security Notes

1. **JWT Keys** — RSA keypairs ada di `keys/` folder, jangan commit
2. **Auth Token Stripping** — `auth-token` (RS256) di-strip saat proxy ke backend
3. **Public Routes** — Routes dengan `public: true` skip auth check
4. **SQL Injection** — Gunakan parameterized queries, raw SQL di-validasi

---

## Related Documentation

- [Panduan Komprehensif Layanan](./Dokumentasi/panduan_komprehensif_layanan.md)
- [PLANS.md](./PLANS.md) — Proxy Gateway Optimization Plan
- [CLAUDE.md](./CLAUDE.md) — Project-specific Claude Code guidance
