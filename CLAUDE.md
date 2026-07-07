# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dual-mode deployment architecture:
- **Standalone Gateway**: `server_bun.js` (Bun, native HTTP) is the active gateway — serves the standalone IFESS HTML UI, the IFESS Control API, and the Firebird Query Gateway on one port. `server.js` (Express) is the legacy equivalent, still present.
- **Docker Deployment**: Next.js app only, nginx reverse proxy on port 8080

The Bun gateway is a single process serving three concerns: (1) reverse proxy (routes from `routes-config.json`), (2) IFESS client management API (`/api/ifess/*`), (3) Firebird Query Gateway (`/api/query-gateway/*`) that runs `isql.exe` against the local Firebird 1.5 DB and serves a standalone analytics HTML UI.

## Project Structure

```
Main Dashboard/
├── server.js                    # Express gateway (standalone mode, port 3001)
├── routes-config.json           # Proxy route definitions (hot-reload)
├── keys/                        # JWT RSA keypairs
├── Dokumentasi/                 # Service usage guides
├── Services/
│   ├── ifess-control-server/  # iFESS Control Server (JS)
│   └── query/                  # SQL Gateway
├── data/ifess/                 # iFESS JSON data storage
└── Dashboard_Utama/            # Next.js 16 App
    ├── Dockerfile              # Container build
    ├── docker-compose.yml     # Docker orchestration
    └── app/
        ├── api/               # Route Handlers
        │   ├── auth/         # NextAuth.js + credentials
        │   ├── reports/      # Report SQL handlers
        │   ├── ifess/        # iFESS proxy route
        │   └── services/     # Service config
        ├── ifess-control/    # iFESS admin dashboard
        ├── report-center/     # Report viewer pages
        └── lib/reports/      # SQL builders, filters
```

## Development Commands

### Standalone Mode (Gateway + Next.js)

```bash
# Run from root - starts both gateway (port 3001) and Next.js
npm run dev
npm run start          # production
npm run build:dashboard  # build Next.js from root
```

### Docker Mode (Next.js only)

```bash
cd Dashboard_Utama
docker-compose up --build    # build and start
docker-compose up            # start existing image
docker-compose down         # stop
```

In Docker: nginx serves port **8080**, proxies to Next.js on **3001**.

### Next.js (standalone)

```bash
cd Dashboard_Utama
npm run dev       # Next.js dev server
npm run build     # production build
npm run lint      # ESLint
npx tsc --noEmit # TypeScript validation
```

### Testing

```bash
# Standalone test
cd Dashboard_Utama && npx tsx lib/reports/accounting-period.test.ts
```

### Bun Gateway + IFESS (the active dev layer)

```bash
# Gateway only — no Next.js, no dashboard upstream (fastest for IFESS work)
# Default port 3001; use PORT=3002 if 3001 has a zombie process (see below)
cd "D:/Gawean Rebinmas/Main Dashboard"
PORT=3002 START_DASHBOARD=false bun run server_bun.js
```

- `START_DASHBOARD=false` skips spawning the Next.js dev server on :3100 (which otherwise hangs `startDashboardIfNeeded` / `prewarmConnections` and yields 503s).
- Standalone analytics UI: `http://localhost:3002/ifess-control/app` (full dashboard) and `/ifess-control/simple` (query-only). These are static HTML served directly by the gateway — no Next.js build involved.
- Run a single IFESS query quickly: `POST /api/query-gateway/exec-sync` with `{"queryText":"...","maxRows":N}`. See the Firebird section below for the many ways this fails.

**Port 3001 zombie**: a `bun.exe` on the Services session (PID shown by `tasklist`) often holds 3001 with "access denied". It cannot be killed from a Console session. Run the gateway on `PORT=3002` instead and point clients/browser there.

## Key Architectural Patterns

### Report System (MSSQL)

Reports use raw SQL via `mssql` library. Key concepts:

- **Handlers** in `app/api/reports/inventory/route.ts` — async functions accepting `{ limit, limitAll, search, ctx, filters }`
- **MovementCategory** from `StockIssueEventCount`:
  - `>= 6` → Fast Moving, `2-5` → Moving, `1` → Slow Moving
  - `0` with stock > 0 → Dead Stock, `0` with stock = 0 → No Movement
- **ReportViewerClient** (`app/report-center/inventory/[report]/`) — generic report renderer with profile-specific configs
- **Data source** via `source` param: `pabrik` → `db_ptrj_mill`, `estate` → `db_ptrj`
- Initial load: **500 rows** (TABLE_FIRST_LIMIT)

### Auth Flow

```
Browser → NextAuth.js (credentials) → /api/auth/login → MSSQL verify
                                            ↓
                                    Set cookie (payroll_auth_token)
```

- JWT tokens stored in cookies, not localStorage
- `auth()` from `auth.ts` validates session
- `verifyToken()` in `lib/utils/jwt.ts` checks token validity

### Proxy Gateway

Routes are loaded from `routes-config.json` (hot-reloaded). Both `server_bun.js` (active, Bun) and `server.js` (legacy, Express) implement the same flow:

1. Check `/api/ifess`, `/api/routes`, `/api/auth`, `/api/reports`, `/api/services` — skip proxy
2. Match path against enabled routes (longest path first)
3. Rewrite content for HTML/JS/CSS (replace target URLs with proxy paths)
4. Stream static assets directly

## Coding Standards

- **TypeScript strict** mode throughout
- **2-space indentation**, single quotes in TS/TSX
- Report IDs and routes: **kebab-case**
- React components: `PascalCase`; functions/variables/hooks: `camelCase`
- Prefer existing helpers over duplicating logic
- SQL routes must be read-only

## Firebird Query Gateway (the hardest layer — read before editing queries)

The gateway runs read-only SQL against a local Firebird 1.5 DB by shelling out to `isql.exe`. All execution goes through `execLocalQuery()` in `server_bun.js`. This layer has many sharp edges; changes here caused the long "no data / intermittent timeout" debugging.

### Execution path
`POST /api/query-gateway/exec-sync` → `execLocalQuery(queryText, maxRows)` → writes temp `.sql` → `execFileSync(isql, ['localhost:DBPATH', '-u','SYSDBA','-p','masterkey','-q','-i', tmp])` → `parseIsqlOutput()` (multi-page isql output parser) → `{headers, rows, rowCount, raw}`.

### Critical correctness rules (violating these = silent wrong/zero data)
- **Scanner tables hold multi-year data per partition.** `FFBSCANNERDATA01..12`, `GWSCANNERDATA01..12`, `RTSCANNERDATA01..12` are split by month-suffix but each holds ALL years. The `#MONTH#` placeholder selects the *partition slot*, NOT a calendar month. **Every** scanner query MUST filter `TRANSDATE BETWEEN 'YYYY-MM-01' AND 'YYYY-MM-#LASTDAY#'`, else monthly aggregates silently return multi-year totals (e.g. `HariHadir=166` instead of 22).
- **`COUNT(DISTINCT)` over a `UNION` of large scanner tables times out (>60s, ETIMEDOUT).** Single-table `COUNT(DISTINCT)` is fine. Never cross-union DISTINCT. If you need "present across FFB+GW", run separate single-table counts and combine in the app.
- **`ORDER BY <alias>` fails on Firebird 1.5** (`SQLCODE -206 Column unknown`) when the alias is an aggregate. Use the column **ordinal**: `ORDER BY 8 DESC`.
- **No `WITH`, no window functions, no `FETCH FIRST n OFFSET`, no derived tables in `FROM`/`JOIN`** (subselect as a table throws "Token unknown - SELECT"). Use `FIRST n` in the SELECT list. `NOT IN (single-col subquery)` works; `NOT EXISTS` correlated over a large scanner table times out — prefer `NOT IN`.
- **No `LAST_DAY()` / `EXTRACT(DAY FROM date)`.** Compute last-day-of-month in the app and inject as `#LASTDAY#`.

### Placeholders (substituted by the UI/app, NOT by isql)
Templates use `#VAR#` tokens replaced before execution: `#MONTH#` (01–12, bare), `#YEAR#` (4-digit, bare), `#LASTDAY#` (last day, bare), `#TABLE_NAME#` (bare), others → quoted SQL string literal. Identifier-type vars are injected unquoted. The HTML UI's `dateVarsPrompter()` + `runModule()` do this substitution; `executeQuery()` (manual editor) applies the same identifier rule.

### Reliability fixes already applied to `execLocalQuery`
- **Temp-file collision**: concurrent `Promise.all` calls reused `Date.now()` filenames → one query's `.sql` was overwritten mid-read. Fixed with a `_seq` counter + pid in the temp name. (This made `/explore` return 0 tables while `/exec-sync` returned 183.)
- **isql serialization**: Firebird 1.5 `fbserver` is single-threaded; concurrent isql sessions serialize at the DB and cascade-timeout. `withIsqlLock()` runs at most one query at a time (promise-chain queue). API requests can still arrive concurrently; they queue.
- **Zombie isql reaper**: `execFileSync` timeout kills the Node *wait* but may leave an orphan `isql.exe` on Windows, which pins the Firebird DB lock. On `ETIMEDOUT`, the catch block scans `wmic process` and `taskkill`s any `isql.exe` older than 60s. **`spawnSync` with a `timeout` option is unreliable under Bun** (sets `signal=SIGTERM` even on fast success → false "timeout"); keep using `execFileSync`.

### Verifying queries
The UI page (Absensi/Produksi/Payroll/Eksekutif) auto-loads data on open. To test the API directly without the browser, POST to `/api/query-gateway/exec-sync` — but **inline `node -e`/`http` calls are intercepted by the harness**; write a small `.js` file using the `http` module and run it with `node`, or use `curl --data-binary @file.json`.

### DB facts (PTRJ_ARC.FDB, ARE-C estate — verify before assuming for other estates)
- Tables: 183. Views: 81. `EMP` ~5915 rows. `RESIGNED`/`RETIRE` empty here (active filter = `NOT IN` against scanner, not against these).
- `GWSCANNERDATA*` ~40k rows/mo (the attendance scanner). `FFBSCANNERDATA*` ~78k/mo. `RTSCANNERDATA*` = **0 rows** (this is a palm estate; rubber tapping tables empty — do not query RT).
- `FFBSCANNERDATA.LOOSEFRUIT` is all 0; real bracts weight is in `LOOSEFRUIT2`. Use `LOOSEFRUIT2`.
- `OVERTIME` is single (not partitioned), ~72k rows across years. `BASICRATE`/`ADDRATE` are 0 for all rows → any `EstCost` is 0; rates live in `SALARYSCALE`. `VEHID=0` is the "no vehicle" sentinel (VEHID is never NULL — use `= 0`, not `IS NULL`). Filter OT by month with `EXTRACT(MONTH FROM INPDATE)=#MONTH# AND EXTRACT(YEAR FROM INPDATE)=#YEAR#`.
- FK columns (verified): `EMP.OCID→OC.ID`, `EMP.ID←GW.WORKEREMPID / FFB.SCANUSERID / OVERTIME.EMPID`, `OCFIELD.OCID→OC.ID`, `FFB.FIELDID→OCFIELD.ID`, `OVERTIME.JOBID→JOBCODE.ID`, `OVERTIME.VEHID→VEHCODE.ID`.

## Query Templates

Templates are the source of ready-made SQL for every analytics module. **The live store is `data/ifess/query-templates.json`** — edit that file directly. `DEFAULT_QUERY_TEMPLATES` in `Services/ifess-control-server/service.js` is the seed and only runs when the JSON file is empty (`seedDefaultTemplates()`); it is NOT kept in sync with the JSON. If you add/fix a template, update the JSON (and ideally mirror in `DEFAULT_QUERY_TEMPLATES` so a fresh seed stays correct).

- Listing: `GET /api/query-gateway/templates` (mtime-cached in `readJsonFile` — a fresh write picks up automatically, no restart needed).
- Schema of one object/table: `GET /api/query-gateway/explore/:tableName` (returns columns).
- Template object shape: `templateCode, templateName, description, queryText, defaultMaxRows, defaultTimeoutSeconds, tags, enabled, createdBy, createdAt, updatedAt`.

## Standalone Analytics UI (`Dashboard_Utama/public/ifess-app.html`)

Single static HTML file (Bootstrap 5 + CodeMirror) served by the gateway at `/ifess-control/app`. No build step. Pages: Dashboard, Clients, Query, History, Explorer, Absensi, Produksi, Payroll, Eksekutif, Tables (default landing).

- **Absensi** auto-loads a pivot matrix (X=tanggal, Y=karyawan, sel=hadir) on page open via `loadAbsensiCalendar(offset)`; raw `(emp,date,scan)` queried then pivoted in JS — Firebird 1.5 has no PIVOT. Sticky header + sticky first column via CSS `position: sticky`.
- Result rendering: `renderSyncResultInto(r, ms, wrap)` — reusable table renderer with search/CSV/auto-size/load-more. `.query-result-table` has fixed column separators; `makeHeader`/`makeCell` keep th/td widths in sync.
- Module runners (`runAbsensi/runProduksi/runPayroll/runEksekutif`) all use `runModule(code, promptFn, resultId)` + `dateVarsPrompter()`.

## iFESS Control Server

Manages iFESS SuperApp desktop clients. Built into `server_bun.js` (no external dependency):

- **API Base**: `/api/ifess`
- **Dashboard**: `/ifess-control` — web UI for client management
- **Public Endpoints**: `/api/ifess/health`, `/api/ifess/server-info`
- **Protected Endpoints**: All others require `X-API-Key` header

### Client Flow
1. Fetch `/api/ifess/server-info` → get server URL and config
2. POST `/api/ifess/clients/register` → register client
3. POST `/api/ifess/clients/:id/heartbeat` → periodic heartbeat

### Key Endpoints
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/ifess/health` | GET | No | Health check |
| `/api/ifess/server-info` | GET | No | Server config for clients |
| `/api/ifess/clients` | GET | Yes | List clients |
| `/api/ifess/clients/register` | POST | Yes | Register client |
| `/api/ifess/clients/:id/heartbeat` | POST | Yes | Client heartbeat |
| `/api/ifess/dashboard` | GET | Yes | Dashboard summary |

### Data Storage
- Location: `data/ifess/*.json`
- Files: `clients.json`, `configs.json`, `commands.json`, `module-statuses.json`, `heartbeat-logs.json`, `client-groups.json`, `audit-logs.json`, `query-batches.json`, `query-jobs.json`, `query-results.json`, `query-result-chunks.json`, **`query-templates.json`** (the live template store — see Query Templates above)

### Testing
```bash
node scripts/test-ifess.js
```

Full documentation: `docs/IFESS_QUICKSTART.md`

## Environment Files

| File | Purpose |
|------|---------|
| `Dashboard_Utama/.env` | Dev defaults |
| `Dashboard_Utama/.env.local` | Local overrides (gitignored) |
| `Dashboard_Utama/.env.docker` | Docker container |
| `.env.production` | Standalone production |
| `routes-config.json` | Dev proxy config |
| `routes-config.production.json` | Production proxy config |

## Security

- Never commit `.env`, `.env.local`, `keys/`, or secrets
- All report SQL must be read-only — use `validateReadOnlySql`
- IFESS API key required via `IFESS_API_KEY` environment variable
