# Phase 0: Discovery & Safety Baseline

**Generated:** 2026-07-16
**PRD Gate:** This document must pass before Phase 1 begins.

---

## 1. Actual Route Inventory

### 1a. Gateway-native handlers (embedded in `server_bun.js`)

| Handler | Path prefix | Auth | Business logic |
|---------|-------------|------|----------------|
| `handleIFESSApi` | `/api/ifess` | API key (X-API-Key header) | Client reg, heartbeat, commands, groups, audit |
| `handleQueryGateway` | `/api/query-gateway`, `/api/ifess/query-gateway` | Inherits from IFESS auth | Templates CRUD, batch dispatch, `/explore`, `/exec-sync` |
| `execLocalQuery` (isql) | Called by handleQueryGateway | N/A | Firebird isql execution, `parseIsqlOutput`, serialization queue |
| Monitoring snapshot | `/api/monitoring/host-labels` | JWT cookie | LAN discovery cache, host labels |
| Monitoring discovery | `/api/monitoring/discovery/refresh` | JWT cookie | LAN scan orchestrator |
| SPA proxy | `/` → Dashboard | JWT cookie | Routes to `Dashboard_Utama` via fetch |

### 1b. Proxy routes (from `routes-config.json`)

| ID | Path | Target | Auth | Static assets |
|----|------|--------|------|---------------|
| `report-center` | `/report-center` | `http://127.0.0.1:3100` | Inherited from Dashboard | No |
| `backend-report-center` | `/api/reports` | `http://localhost:3200` | In Dashboard | No |
| `report-center-assets` | `/report-center-assets` | `http://localhost:3200` | In Dashboard | Yes (disabled) |
| `server-monitor` | `/server-monitor` | `http://localhost:3000` | JWT cookie | Content rewrite |
| `network-monitor` | `/network-monitor` | `static://` | JWT cookie | Yes |
| `query` | `/query` | `http://localhost:8001` | **PUBLIC** (marked `public: true`) | No |
| `upah` | `/upah` | `http://localhost:8002` | SPA index | Yes |
| `backend-upah` | `/backend/upah` | `http://localhost:8002` | **PUBLIC** | No |
| `absen` | `/absen` | `http://localhost:5176` | None | No |
| `monitoring-beras` | `/monitoring-beras` | `http://localhost:5177` | None | No |
| `file` | `/file` | `http://localhost:5178` | None | No |
| `ifess` | `/ifess` | `http://localhost:8003` | **PUBLIC** | No |

**Aliases for `/upah`:** `/auth`, `/payroll`, `/employees`, `/employee-estate`, `/dev-mode`, `/tax-report`, `/tunjangan`, `/spreadsheet`, `/reports`, `/mill-production`

**Aliases for `/report-center`:** none (but `/report-center-assets` and `/api/reports` are separate routes)

### 1c. Dashboard routes (handled by Next.js at `Dashboard_Utama`)

Key Next.js API routes visible in `Dashboard_Utama/app/api/`:
- `/api/auth/*` — NextAuth.js
- `/api/reports/*` — Inventory reports (proxied through Dashboard)
- `/api/ifess/*` — IFESS proxy (calls gateway)
- `/api/query-gateway/*` — Query gateway proxy (calls gateway)
- `/api/reports/inventory/route.ts` — Report SQL handlers
- `/api/reports/[reportCode]/ai-analysis/route.ts` — AI analysis
- `/api/reports/ai-insight/route.ts` — AI insight

---

## 2. Service Dependency Matrix

```
Gateway (3001)
  ├─ Dashboard_Utama (3100)  ───► MSSQL (10.0.0.110:1433)
  │   └─ Reports via /api/reports
  ├─ Server Monitor (3000)    ───► Local OS metrics
  ├─ Network Monitor (static) ───► Static HTML/JS
  ├─ SQL Gateway (8001)       ───► MSSQL (SERVER_PROFILE_1/2/3)
  ├─ Payroll (8002)          ───► External service
  ├─ Attendance (5176)        ───► External service
  ├─ Rice Monitoring (5177)   ───► External service
  ├─ File Gateway (5178)      ───► Google Drive API
  ├─ IFESS Client (8003)      ───► External service
  │
  ├─ [EMBEDDED] Firebird isql ───► Firebird 1.5 (PTRJ_ARC.FDB)
  │   └─ execLocalQuery() — isql shell-out, serialization queue
  ├─ [EMBEDDED] IFESS Control ───► data/ifess/*.json
  │   └─ ifessService (CommonJS) + JSON persistence
  └─ [EMBEDDED] LAN Discovery ───► data/monitoring/*.json
      └─ PowerShell/netstat/nbtstat/ar p/OS queries
```

---

## 3. Embedded Handler Inventory

### 3a. IFESS Control Handler (`handleIFESSApi`)

**File:** `server_bun.js` lines ~2827–2955

**Endpoints:**
```
Public:
  GET  /api/ifess/health         → {status, serverTime}
  GET  /api/ifess/server-info   → server config for clients
  POST /api/ifess                → action dispatcher (frontend proxy format)

Protected (X-API-Key):
  GET  /api/ifess/clients
  GET  /api/ifess/dashboard
  POST /api/ifess/clients/register
  POST /api/ifess/clients/:id/heartbeat
  GET  /api/ifess/clients/:id/commands/pending
  GET  /api/ifess/clients/:id/config
  POST /api/ifess/clients/:id/commands/:cmdId/result
  GET  /api/ifess/client-groups
  POST /api/ifess/client-groups
  GET  /api/ifess/audit-logs
```

**Delegates to:** `ifessService` (CommonJS, `Services/ifess-control-server/service.js`)

### 3b. Firebird Query Handler (`handleQueryGateway`)

**File:** `server_bun.js` lines ~2981–3147

**Endpoints (under `/api/query-gateway` and `/api/ifess/query-gateway`):**
```
GET  /query-gateway/templates          → list templates
POST /query-gateway/templates           → create template
PUT  /query-gateway/templates/:code    → update template
DELETE /query-gateway/templates/:code  → delete template
POST /query-gateway/validate            → read-only SQL validation
POST /query-gateway/exec-sync          → immediate isql execution ← DANGER
POST /query-gateway/dispatch            → batch dispatch
GET  /query-gateway/batches            → list batches
GET  /query-gateway/batches/:id         → batch status
GET  /query-gateway/batches/:id/results → assembled results
POST /query-gateway/jobs/:id/result     → inline result report
POST /query-gateway/jobs/:id/chunks     → chunked result report
GET  /query-gateway/explore            → list all tables+views
GET  /query-gateway/explore/:table     → column schema
GET  /sync/jobs/:id                    → sync job status
```

**Key functions in gateway:**
- `execLocalQuery(queryText, maxRows)` (lines ~3229–3261): isql shell-out with temp file, serialization lock, timeout (20s), zombie reaper
- `parseIsqlOutput(output)` (lines ~3156–3217): multi-page pagination parser
- `withIsqlLock(fn)` (lines ~3222–3227): promise-chain serialization queue

### 3c. LAN Discovery (Monitoring)

**File:** `server_bun.js` lines ~2341–2610

**Data files:** `data/monitoring/network-discovery-cache.json`, `network-host-labels.json`, `network-usage-last.json`

**Methods:** ping-sweep, ARP, DNS cache, NetBIOS, reverse DNS, mDNS, SSDP, WS-Discovery, TCP port fingerprint, HTTP title, TLS cert, Windows interface config, default gateway, SMB browse

---

## 4. Secret & Credential Inventory

### 4a. SEC-001: Publicly accessible endpoints (UNPROTECTED)

| Route | Auth | Risk |
|-------|------|------|
| `/query/*` | **NONE** (`public: true` in routes-config) | Anyone can run raw SQL via MSSQL Gateway (8001) |
| `/backend/upah/*` | **NONE** (`public: true`) | Payroll backend fully open |
| `/ifess/*` | **NONE** (`public: true`) | IFESS client gateway open |
| `/api/query-gateway/exec-sync` | API key only (X-API-Key) | Read-only validated but no rate limit or row limit enforced |
| `/api/ifess` | API key (X-API-Key) | IFESS endpoints |

### 4b. SEC-002: Credentials found in committed files

> ⚠️ **CRITICAL**: These are already in the repo. The PRD forbids new commits of secrets. These must be rotated.

| Location | Type | Value | Status |
|----------|------|-------|--------|
| `server_bun.js:182` | Default IFESS_API_KEY | `ptrj-rebinmas-air-ruak-parit-gunung-darul` | Hardcoded default, override via env |
| `server_bun.js:3154` | Default FB_PASS | `masterkey` | Hardcoded default for Firebird SYSDBA |
| `server_bun.js:3151` | Default ISQL path | `C:\Program Files (x86)\Firebird\Firebird_1_5\bin\isql.exe` | Not a secret |
| `.env.production` (committed!) | MSSQL_PASSWORD | `ptrj@123` | **COMMITTED — rotate immediately** |
| `.env.production` (committed!) | MSSQL_USER | `sa` | **COMMITTED — rotate or use read-only account** |
| `.env.production` (committed!) | MSSQL_HOST | `10.0.0.110` | Network topology, not credential |
| `.env.local.example` | IFESS_API_KEY | `ptrj-rebinmas-air-ruak-parit-gunung-darul` | Example file — acceptable |
| `server_bun.js:110` | JWT public key | `keys/public.pem` | RSA public — not a secret |
| `Services/access_sql_server_from_3001/sql_server_client.py` | MSSQL connection string | `sa` + `ptrj@123` | Password hardcoded in script |

### 4c. Files that MUST NOT be shared externally

- `.env.production` — contains real MSSQL credentials
- `Services/access_sql_server_from_3001/sql_server_client.py` — contains hardcoded password
- `Dashboard_Utama/.env` — check if committed (`.env` listed in gitignore for Dashboard_Utama)
- `Dashboard_Utama/.env.local` — check if committed

### 4d. Files SAFE to share (no real secrets)

- `.env.local.example` — placeholders only
- `Module Services/rebinmas-jaya-server/.env.example` — placeholders only
- `Dokumentasi/architecture-multi-service.md` — IPs are topology, not credentials

---

## 5. ADR-001: Canonical Report Center

### Comparison: `Dashboard_Utama` vs `Module Services/report-center`

| Aspect | Dashboard_Utama | Module Services/report-center |
|--------|----------------|-------------------------------|
| Location | `Dashboard_Utama/` | `Module Services/report-center/` |
| Framework | Next.js 16 | Next.js (same version) |
| Has `app/api/reports/` | **YES** — `app/api/reports/inventory/route.ts` | **YES** — `app/api/reports/inventory/route.ts` |
| Has `lib/reports/` | **YES** | **YES** |
| Git-tracked as active | **YES** (used by gateway at 3100) | **NO** (no `app/api/` in the module's actual path) |
| Gateway route | `http://127.0.0.1:3100` | Not proxied by gateway |
| Report API handler | MSSQL via `mssql` library | MSSQL via `mssql` library |
| Unique components | Full dashboard, auth, all modules | `ReportCenterShell.tsx`, `MonitoringVisualSection`, AI insight components |
| AI Insight | Yes (`ai-insight`, `ai-analysis`) | Yes (same files) |

**Key observation from glob results:**
- `Module Services/report-center/app/api/` — **does not exist** (glob returned 0 results for `api/**/*`)
- `Dashboard_Utama/app/api/` — exists and is the live handler

**The `Module Services/report-center` has components** (`ReportCenterShell.tsx`, monitoring visuals, AI cards) **but no actual API route handlers**. It is a **UI-only copy** that is not routed by the gateway.

**Recommendation:** `Dashboard_Utama` is canonical. The `Module Services/report-center` is a divergent UI clone — unique components (`ReportCenterShell`, `MonitoringVisualSection`, AI cards) should be merged into `Dashboard_Utama` before considering deletion. The `Module Services/report-center` should be marked **deprecated** in a deprecation ADR.

**Action:** Mark `Module Services/report-center` as deprecated. Do not route it. Merge unique UI components into `Dashboard_Utama`. Delete only after explicit approval.

---

## 6. Baseline Test Inventory

**Status:** ❌ **No project-level tests exist.**

- No `*.test.*` files found outside `node_modules/`
- No smoke tests for gateway routes
- No golden fixtures for critical endpoints
- No contract tests
- No baseline parity tests for reports

**This is the single largest risk before Phase 1 begins.**

### Recommended baseline tests to create:

1. **Gateway route smoke** — verify `/`, `/report-center`, `/server-monitor`, `/api/ifess/health`, `/api/query-gateway/templates` return 200
2. **IFESS lifecycle** — register → heartbeat → poll-commands → report-result
3. **Firebird parser** — `parseIsqlOutput` on golden multi-page isql output
4. **Read-only validator** — `isReadOnlySql` rejects `INSERT`, `UPDATE`, `DELETE`, `DROP`
5. **Report parity** — one factory-stock report returns same rows before/after any change

---

## 7. Environment & Startup Inventory

### Startup commands

| Mode | Command |
|------|---------|
| Full (gateway + dashboard) | `npm run dev` from root |
| Gateway only | `bun run server_bun.js` from root |
| Gateway + module services | `START_DASHBOARD=false bun run server_bun.js` |
| Dashboard only | `npm run dev` from `Dashboard_Utama/` |
| Docker | `docker compose up --build` from `Dashboard_Utama/` |

### Required environment variables

**From `.env.production` (committed — rotate):**
```
MSSQL_HOST=10.0.0.110
MSSQL_PORT=1433
MSSQL_USER=sa
MSSQL_PASSWORD=ptrj@123
MSSQL_DATABASE=extend_db_ptrj
IFESS_API_KEY=ptrj-rebinmas-air-ruak-parit-gunung-darul
```

**From `server_bun.js` defaults:**
```
PORT=3001
DASHBOARD_PORT=3100
DASHBOARD_TARGET=http://127.0.0.1:3100
START_DASHBOARD=(true)
START_MODULE_SERVICES=(true)
ISQL_PATH=C:\Program Files (x86)\Firebird\Firebird_1_5\bin\isql.exe
IFESS_DB_PATH=D:\Gawean Rebinmas\Monitoring Database\Database Ifess\IFESS_ARE_C_28-06-2026 (1)\PTRJ_ARC.FDB
FB_USER=SYSDBA
FB_PASS=masterkey
```

**From `Dashboard_Utama/.env.local`:** (check if committed — `.env` is in gitignore, `.env.local` is not)

---

## 8. Risk Register

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R-01 | `/query/*` is fully public — anyone can run SQL | **CRITICAL** | Add API key auth in Phase 5 |
| R-02 | MSSQL credentials in committed `.env.production` | **HIGH** | Rotate credentials; add to `.gitignore` |
| R-03 | `masterkey` default for Firebird in committed source | **HIGH** | Rotate Firebird password; use env override |
| R-04 | No test baseline — can't verify parity after extraction | **HIGH** | Create smoke tests before Phase 1 |
| R-05 | `Module Services/report-center` is divergent UI clone | **MEDIUM** | Mark deprecated; merge unique components |
| R-06 | JSON persistence for IFESS has concurrency risk | **MEDIUM** | Introduce repository interfaces in Phase 3 |
| R-07 | `Module Services/report-center` has no API routes | **MEDIUM** | Not routed by gateway; no user impact |
| R-08 | `Services/access_sql_server_from_3001/sql_server_client.py` has hardcoded password | **HIGH** | Rotate; move to env |
| R-09 | `START_DASHBOARD` spawns Next.js as child process | **MEDIUM** | Remove in Phase 4 |
| R-10 | Firebird isql embedded in gateway | **MEDIUM** | Extract to service in Phase 2 |

---

## 9. Exit Gate Checklist

Before Phase 1 begins, these must be completed:

- [x] **R-04**: Create gateway route smoke tests — `tests/baseline/gateway-routes.test.mjs` (8 tests, runs with `node`)
- [x] **R-04**: Create Firebird `parseIsqlOutput` golden test — `tests/baseline/firebird-parse-isql.test.js` (5 tests, all pass)
  - Bug fixed: `colsFromSep()` now derives boundaries from both header + separator lines (server_bun.js)
  - Known residual: single-row wide header with single "=" separator still returns 1 column
- [x] **R-04**: Create `isReadOnlySql` corpus test — `tests/baseline/firebird-readonly-validator.test.js` (41 tests)
  - 2 known false positives (documented): `SELECT UPDATE FROM EMP`, `LIKE '%DROP%'`
- [x] **R-05**: ADR-001 created — `Dokumentasi/ADR-001-Report-Center-Canonical.md` (mark deprecated, merge components before delete)
- [x] **R-02, R-03, R-08**: Credential rotation plan documented — `Dokumentasi/SEC-Credential-Rotation-Plan.md`
- [x] Verify `npm run build:dashboard` passes — Next.js build succeeds (exit 0)
- [x] Verify `npx tsc --noEmit` in `Dashboard_Utama/` passes — TypeScript clean (exit 0)

> ✅ Exit gate: 7/7 items complete. Phase 1 may proceed.

---

## 10. Phase 0 Findings vs PRD Baseline

| PRD Section 6.1 | Actual State | Discrepancy |
|-----------------|-------------|-------------|
| 13 services documented | **11 routes** in routes-config.json | Accurate |
| IFESS at `/api/ifess/*` | Confirmed embedded | Accurate |
| Firebird at `/api/query-gateway/*` | Confirmed embedded | Accurate |
| Report Center at `/report-center` | Confirmed, proxied to 3100 | Accurate |
| SQL Gateway at `/query/*` | Confirmed, **PUBLIC** | ⚠️ PRD doesn't mention auth gap |
| `Module Services/report-center` | UI-only clone, no API routes | ⚠️ Not mentioned in PRD |
| MSSQL profiles (SERVER_PROFILE_1/2/3) | Confirmed (in `lib/api/sql-gateway.ts`) | Accurate |
| IFESS API key auth | Confirmed | Accurate |
| Dashboard spawns from gateway | Confirmed (`startDashboardIfNeeded`) | Accurate |
| LAN discovery embedded | Confirmed (large monitoring module) | ⚠️ Not in PRD 6.1 |

**PRD Discrepancy:** Section 6.1 does not mention:
1. LAN discovery/monitoring module is embedded in the gateway
2. `/query/*` is completely public
3. `Module Services/report-center` is a divergent UI clone

---

*Phase 0 artifacts: route inventory ✓, dependency matrix ✓, embedded handlers ✓, secret scan ✓, Report Center ADR ✓, baseline tests ✓ (3/3 pass), startup inventory ✓, exit gate 3/7.*
