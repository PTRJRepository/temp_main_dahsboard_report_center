# Multi-Service Architecture — PT Rebinmas Jaya Dashboard

> **Dokumentasi ini** menjelaskan arsitektur multi-service, cara standalone vs terintegrasi, port/path per service, dan developer guide untuk fokus isolasi pada tiap modul.

---

## 1. Gambaran Arsitektur Tingkat Tinggi

```
                     ┌─────────────────────────────────────┐
                     │   server_bun.js (PORT 3001)          │
                     │   Bun Native Gateway — single process │
                     │                                      │
                     │  ┌────────────┬──────────────────┐  │
                     │  │  Reverse   │  Native API      │  │
                     │  │  Proxy     │  Endpoints       │  │
                     │  │  Engine    │                  │  │
                     │  └─────┬──────┴────────┬─────────┘  │
                     └────────┼───────────────┼───────────┘
                              │               │
               ┌──────────────┘               └──────────────────┐
               │ proxy by path prefix                          │ native direct
               ▼                                                ▼
  ┌────────────┴─────────────────────────┐         ┌──────────────────────────┐
  │ Upstream Services (via proxy)        │         │ Native Handlers          │
  │                                      │         │ (no upstream)            │
  │  /upah        → localhost:8002       │         │  /api/auth/*             │
  │  /absen       → localhost:5176       │         │  /api/query-gateway/*    │
  │  /monitoring-beras → 5177            │         │  /api/ifess/*            │
  │  /server-monitor → 3000              │         │  /api/reports/*          │
  │  /report-center → 3100               │         │  /ifess-control/*        │
  │  /network-monitor → static site      │         │  /query/*                │
  │  /file        → 5178 (GDrive)        │         │  /api/services/*         │
  │  /ifess       → 8003 (IFESS)         │         │  Firebird isql gateway    │
  └──────────────────────────────────────┘         └──────────────────────────┘
```

### Mode Operasi Gateway

| Mode | Perintah | Deskripsi |
|---|---|---|
| **Full** (default) | `npm run dev` | Spawn gateway (3001) **+** Next.js dashboard (3100) |
| **Gateway only** | `PORT=3001 START_DASHBOARD=false bun run server_bun.js` | Hanya proxy + API, tanpa dashboard — **fastest** untuk IFESS work |
| **Express legacy** | `npm run dev:express` | Gateway berbasis Express (`server.js`) — fallback |

`★ Insight ─────────────────────────────────────`
- `server_bun.js` adalah **single-binary architecture**: reverse proxy, Firebird query gateway, IFESS control server, dan static hosting semuanya di satu process (Bun). Ini menghindari overhead multi-process tapi menuntut serialisasi isql via queue.
- `START_DASHBOARD=false` adalah **intentional kill switch** — tanpa itu, Next.js dev server spawn tapi prewarm hang, resulting 503. Settings ini eksplisit karena要找 cepat tanpa UI.
`─────────────────────────────────────────────────`

---

## 2. Daftar Semua Services (9 Unit)

### 2.1 Report Center (`Module Services/report-center/`)

| Property | Value |
|---|---|
| **Port dev** | `3100` (Next.js dev) |
| **Port prod** | single invocation via gateway |
| **Path gateway** | `/report-center` |
| **Startup** | di-spawn otomatis dari `server_bun.js` (via `startDashboardIfNeeded()`) |
| **Standalone** | `cd Module Services/report-center && npm run dev` |
| **Framework** | Next.js 16 + React 19 + TypeScript strict |
| **Data source** | MSSQL (via `/api/query-gateway` proxy ke `db_ptrj_mill`/`db_ptrj`) |
| **Auth** | NextAuth.js credentials (cookie: `payroll_auth_token`) |

**Backend API routes** (dalam `Dashboard_Utama/app/api/`):
- `api/auth/*` — login/logout/verify/public-key
- `api/reports/inventory/*` — SQL handlers (read-only via `validateReadOnlySql`)
- `api/reports/ai-insight/*` — AI insight generation
- `api/query-gateway/*` — Firebird SQL execution bridge
- `api/ifess/*` — iFESS proxy
- `api/services/*` — service config registry

**Report modules**: Accounting Period, FFB, PPIC, Payroll, Monitoring Beras, Produksi Barang Jadi, KPI, Payment, Retur, Quality control, Gapeka 2025/2026, etc.

**Standalone dev**:
```bash
cd Dashboard_Utama && npm run dev        # runs on :3100 internally
cd "Module Services/report-center" && npm run dev  # port 3101
```

`★ Insight ─────────────────────────────────────`
- Report Center dan `Module Services/report-center/` adalah **duplicate/early-iteration** dari Dashboard_Utama — keduanya Next.js 16 siap production. Gateway routes ke `:3100` (yang di-spawn dari gateway) atau bisa di-route ke `:3200` (aktif di config tapi `enabled: false`).
- SQL laporan **tidak boleh write** — semua lewat `validateReadOnlySql()` sebelum inject ke mssql driver.
`─────────────────────────────────────────────────`

---

### 2.2 Server Monitor (`Module Services/rebinmas-jaya-server/`)

| Property | Value |
|---|---|
| **Port dev** | `3000` |
| **Port prod** | di-route ke `/server-monitor` via gateway |
| **Path gateway** | `/server-monitor` |
| **Standalone** | `cd Module Services/rebinmas-jaya-server && npm run dev` |
| **Framework** | Vite + React 19 + Express embedded + Tailwind v4 |
| **Stack** | `lucide-react`, `recharts`, `react-router-dom` |
| **Purpose** | Monitoring kesehatan server fisik/virtual, battery, UPS, rack |

**Build untuk production** (Vite bundling, lalu gateway host static):
```bash
cd "Module Services/rebinmas-jaya-server" && VITE_BASE_PATH=/server-monitor/ bun run build
# Output: dist/
hosted by gateway sebagai static site
```

`★ Insight ─────────────────────────────────────`
- Module ini **tidak punya package name** (di-package.json sebagai `react-example` — boilerplate Vite). Harus di-rename saat ekstrak sebagai standalone service.
- Menggunakan **Vite** (bukan Next.js), berbeda dari module lain — standalone via `vite --port=3000`.
`─────────────────────────────────────────────────`

---

### 2.3 Network/WiFi Monitor (`Module Services/Wifi_LAN_Monitor/`)

| Property | Value |
|---|---|
| **Port** | No server (fully static) |
| **Path gateway** | `/network-monitor` |
| **Static root** | `Module Services/Wifi_LAN_Monitor/reference-design/` |
| **Standalone** | buka `reference-design/index.html` langsung di browser |
| **Framework** | Pure HTML/Bootstrap + JavaScript |
| **Purpose** | Monitoring perangkat jaringan: switch, router, firewall, AP |

Gateway config menggunakan `target: "static://network-monitor"` — gateway serves static files tanpa upstream server.

`★ Insight ─────────────────────────────────────`
- Module ini **paling ringan**: tidak ada npm, tidak ada build, hanya HTML statis. Gateway stream files dari filesystem. Cocok untuk dokumen teknis (PRD + HTML reference design).
`─────────────────────────────────────────────────`

---

### 2.4 IFESS Control Server (`Services/ifess-control-server/`)

| Property | Value |
|---|---|
| **Port** | di-host oleh `server_bun.js` (native, bukan upstream) |
| **Path** | `/api/ifess/*` (API) + `/ifess-control/*` (dashboard HTML) |
| **Standalone** | Tidak perlu — selalu via gateway |
| **Framework** | Pure Node.js (no framework — built into gateway) |
| **Data storage** | `data/ifess/*.json` (8 file JSON) |

**8 file data**:
| File | Deskripsi |
|---|---|
| `clients.json` | Registered iFESS clients |
| `configs.json` | Server configuration |
| `commands.json` | Queued commands |
| `module-statuses.json` | Per-module status |
| `heartbeat-logs.json` | Client heartbeat logs |
| `client-groups.json` | Client grouping |
| `audit-logs.json` | Audit trail |
| `query-templates.json` | **Live template store** (Firebird SQL) |

`query-templates.json` adalah **source of truth** untuk SQL queries IFESS. `DEFAULT_QUERY_TEMPLATES` di `service.js` adalah seed — hanya dijalankan saat JSON kosong.

API key: header `X-API-Key: <IFESS_API_KEY>`.

`★ Insight ─────────────────────────────────────`
- IFESS Control Server adalah **rare case** — tidak ada upstream service, logic di-host langsung di `server_bun.js` sebagai native handler. File `auth.js`, `routes.js`, `service.js` di `Services/ifess-control-server/` adalah **legacy Express-split** — saat ini inline di gateway tapi bisa di-extract ke npm package/separate repo.
`─────────────────────────────────────────────────`

---

### 2.5 Firebird Query Gateway (`/api/query-gateway/*`)

| Property | Value |
|---|---|
| **Host** | `localhost:3001` (via gateway) atau standalone |
| **Path** | `/api/query-gateway/exec-sync`, `/explore`, `/templates`, `/history` |
| **Data source** | Firebird 1.5 FDB (`PTRJ_ARC.FDB`) |
| **Execution** | `execLocalQuery()` → write `.sql` temp → `execFileSync(isql.exe ...)` → `parseIsqlOutput()` |
| **Serialization** | `withIsqlLock()` — promise-chain queue (Firebird fbserver single-threaded) |

**Safety rules** (Kritis — violasi = silent wrong data):
1. Scanner tables (`FFBSCANNERDATA01..12`) hold **multi-year data** per slot — always filter by `TRANSDATE BETWEEN 'YYYY-MM-01' AND 'YYYY-MM-31'`
2. `COUNT(DISTINCT)` over UNION times out — run separate single-table counts
3. No `WITH`, no window functions, no `OFFSET` — use `FIRST n`
4. `LOOSEFRUIT2` not `LOOSEFRUIT` (real bracts weight)
5. No `LAST_DAY()` / `EXTRACT(DAY FROM date)` — use `#LASTDAY#` placeholder

**Placeholders** (substituted by app, not isql):
- `#MONTH#` — 01-12 (bare identifier)
- `#YEAR#` — 4-digit
- `#LASTDAY#` — last day of month (computed by app)
- `#TABLE_NAME#` — bare identifier

`★ Insight ─────────────────────────────────────`
- Firebird FDB di kiosk lokal estate (ARE-C) — 183 tables, ~6k EMP rows, `FFBSCANNERDATA` ~78k rows/month.
- **Race condition temp file** (concurrent `Promise.all` queries overwriting `.sql`) dan **isql serialization** adalah top-2 reliability issues yang sudah diperbaiki dengan `_seq` counter + pid naming dan promise-chain queue.
`─────────────────────────────────────────────────`

---

### 2.6 SQL Gateway (Inventory/Procurement) — `Services/query/`

| Property | Value |
|---|---|
| **Port** | `8001` (internal) |
| **Path gateway** | `/query` |
| **Standalone** | `cd Services/query && npm start` |
| **Data source** | MSSQL (multi-server profile: `SERVER_PROFILE_1`/`2`/`3`) |
| **Auth** | `x-api-key: <token>` |
| **Build** | Composable (TypeScript → `dist/`) |

**Multi-server profiles**:

| Profile | Host | Port | DB | Access |
|---|---|---|---|---|
| `SERVER_PROFILE_1` | 10.0.0.110 | 1433 | `db_ptrj_mill`, `extend_db_ptrj`, etc | Read/Write |
| `SERVER_PROFILE_2` | 10.0.0.2 | 1888 | ? | Read-Only |
| `SERVER_PROFILE_3` | 103.127.66.32 | 1888 | `db_ptrj_mill` (Mill) | Read-Only |

Default: `SERVER_PROFILE_3` (Mill). Gunakan `server: "SERVER_PROFILE_1"` untuk Estate.

`★ Insight ─────────────────────────────────────`
- SQL Gateway ini berbeda dari Firebird Query Gateway — ini **MSSQL gateway** untuk inventori dan procurement dengan REST API, bukan Firebird FDB. Dua layer SQL berbeda: Firebird untuk HR/absensi (port 3001), MSSQL untuk inventori (port 8001).
`─────────────────────────────────────────────────`

---

### 2.7 Google Drive File Gateway (`/file`)

| Property | Value |
|---|---|
| **Port** | `5178` |
| **Path gateway** | `/file` |
| **Purpose** | File management via Google Drive API |

---

### 2.8 Payroll/Upah System (External Service)

| Property | Value |
|---|---|
| **Port** | `8002` (internal to gateway) |
| **Path gateway** | `/upah` (frontend), `/backend/upah` (API) |
| **Data** | Static frontend dari `dist/` + backend API |
| **Aliases** | `/auth`, `/payroll`, `/employees`, `/employee-estate`, `/dev-mode`, `/tax-report`, |

---

### 2.9 Absensi & Monitoring Beras (External Services)

| Service | Port | Path | Status |
|---|---|---|---|
| **Absensi** | `5176` | `/absen` | Active |
| **Monitoring Beras** | `5177` | `/monitoring-beras` | Active |

---

## 3. Map: Standalone vs Terintegrasi

```
┌──────┬────────────────────────────────────┬──────────┬───────────────────┐
│ #    │ Service                            │ Port     │ Mode              │
├──────┼────────────────────────────────────┼──────────┼───────────────────┤
│ 1    │ Report Center (Next.js 16)         │ 3100     │ spawn otomatis    │
│ 2    │ Server Monitor (Vite + React 19)   │ 3000     │ spawn otomatis    │
│ 3    │ Network Monitor (static HTML)      │ none     │ static files      │
│ 4    │ IFESS Control (native handler)      │ 3001     │ embedded          │
│ 5    │ Firebird Query (native handler)     │ 3001     │ embedded          │
│ 6    │ SQL Gateway (MSSQL)                 │ 8001     │ external          │
│ 7    │ Google Drive File                   │ 5178     │ external          │
│ 8    │ Upah/Payroll                        │ 8002     │ external          │
│ 9    │ Absensi                             │ 5176     │ external          │
│ 10   │ Monitoring Beras                    │ 5177     │ external          │
│ 11   │ IFESS Client Gateway                │ 8003     │ external          │
└──────┴────────────────────────────────────┴──────────┴───────────────────┘
```

**Standalone per service** (cara developer fokus isolasi):

```bash
# 1. Report Center — development langsung
cd "Module Services/report-center" && npm run dev

# 2. Server Monitor — Vite
cd "Module Services/rebinmas-jaya-server" && npm run dev

# 3. Network Monitor — buka HTML langsung
open "Module Services/Wifi_LAN_Monitor/reference-design/index.html"

# 4. IFESS / Firebird — via gateway only (START_DASHBOARD=false)
PORT=3001 START_DASHBOARD=false bun run server_bun.js
# lalu test:
POST http://localhost:3001/api/query-gateway/exec-sync  {"query":"..."}

# 5-11. External services — jalankan di terminal masing-masing
cd Services/query && npm start        # :8001
<start upah service>                   # :8002
<start absensi service>                # :5176
...
```

---

## 4. Request Flow: Full vs Minimal

### 4.1 Full Mode (`npm run dev`)

```
Browser :3001
    ├─ match /report-center  ──→ gateway spawns Next.js on :3100
    │                              └─→ MSSQL via /api/query-gateway
    │                              └─→ Firebird via /api/query-gateway/exec-sync
    ├─ match /upah            ──→ static site + proxy to :8002
    ├─ match /api/auth/*      ──→ native handler (NextAuth)
    ├─ match /ifess/*         ──→ native handler (IFESS server)
    ├─ match /query/*         ──→ proxy to :8001 (SQL Gateway)
    └─ match /static/*        ──→ disk stream
```

### 4.2 Gateway Only (`START_DASHBOARD=false`)

```
Bun process :3001
    ├─ every API route  ──→ native handler (FAST — no overhead from dashboard spawn)
    ├─ /ifess-control/app ──→ static HTML served
    └─ ALL proxy routes disabled (no dashboard upstream needed)
```

**Kapan pakai yang mana**:
- **Full mode**: development UI Report Center
- **Gateway only**: IFESS development, Firebird query debugging, kategori service lain tanpa UI

`★ Insight ─────────────────────────────────────`
- Kubernetes-like single-port entry point pattern di Windows: `localhost:3001` sebagai single ingress. Proxying happens di application layer (Bun `Server.prototype.fetch`), bukan OS-level port forwarding. Jadi bisa hot-reload `routes-config.json` tanpa restart.
`─────────────────────────────────────────────────`

---

## 5. Struktur File per Service (Developer Isolation Guide)

### Report Center (Modular Development)

```
Module Services/report-center/
├── app/
│   ├── (report-center)/
│   │   ├── report-center/            ← shell: tab switcher + module registration
│   │   │   ├── ReportCenterShell.tsx
│   │   │   ├── inventory/            ← module: inventory reports
│   │   │   ├── payroll/              ← module: payroll/KPI
│   │   │   ├── accounting/           ← module: accounting
│   │   │   └── production/           ← module: production
│   ├── api/
│   │   ├── reports/
│   │   │   ├── inventory/route.ts    ← SQL handlers (19+ reports)
│   │   │   ├── ai-insight/route.ts
│   │   │   └── system-status/route.ts
│   └── lib/
│       └── reports/                  ← SQL builders, filters, utils
│           ├── config.ts             ← inventory config registry
│           ├── inventory-report-builder.ts
│           └── *.filter.ts
├── lib/
│   └── reports/
│       ├── accounting-period/
│       ├── ffb/
│       ├── ppic/
│       └── ...
├── store/
│   └── reportStore.ts                ← Zustand global state
└── package.json                      ← next, react 19, mssql, zustand
```

**Cara modul isolasi**: Setiap folder module (inventory/payroll/production) bisa dikembangkan tanpa menyentuh module lain. `ReportCenterShell.tsx` hanya register module via config — tambah module baru = tambah route + config entry.

### IFESS Query Templates (JSON-first)

```
data/ifess/
├── query-templates.json              ← source of truth (CRUD via API)
├── clients.json
├── module-statuses.json
├── configs.json
└── ...
```

**Developer isolation**: Tambah template baru = POST `/api/query-gateway/templates` atau edit `query-templates.json` langsung. Gateway auto-reload (mtime cache). `service.js` (seed) hanya saat JSON kosong.

### Server Monitor (Vite module)

```
Module Services/rebinmas-jaya-server/
├── src/
│   ├── types.ts                      ← shared types
│   ├── components/
│   │   ├── BatteryMonitor.tsx
│   │   └── RackVisualizer.tsx
│   └── main.tsx                      ← entry
├── vite.config.ts                    ← Vite build config
├── tsconfig.json
└── package.json
```

---

## 6. Port Registry (Dev Environment)

| Port | Process | Service | Protocol |
|---|---|---|---|
| `3001` | `server_bun.js` | **Main Gateway** (default) | HTTP |
| `3001` | `server_bun.js` | **Main Gateway** (canonical) | HTTP |
| `3100` | Next.js | **Report Center** (spawn otomatis) | HTTP |
| `3200` | standalone Next.js | **Report Center** (manual) | HTTP (disabled in proxy) |
| `3000` | Vite | **Server Monitor** | HTTP+WS |
| `5176` | ??? | **Absensi** | HTTP |
| `5177` | ??? | **Monitoring Beras** | HTTP |
| `5178` | ??? | **Google Drive File** | HTTP |
| `8001` | SQL Gateway | **SQL/MSSQL API** | HTTP |
| `8002` | ??? | **Upah/Payroll** | HTTP |
| `8003` | ??? | **IFESS Client Gateway** | HTTP |
| `1433` | MSSQL | **SQL Server (Estate/Mill)** | TCP |
| `1888` | MSSQL | **SQL Server Mirror** | TCP |

**Port 3001 zombie**: bun.exe di sesi Services kadang menahan 3001 dengan "access denied", tidak bisa di-kill dari console. Solusi: hentikan proses lama, tetap gunakan `PORT=3001`.

---

## 7. Environment Variables

### Gateway (`server_bun.js`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Gateway listen port |
| `DASHBOARD_PORT` | `3100` | Next.js spawn port |
| `DASHBOARD_TARGET` | `http://127.0.0.1:${DASHBOARD_PORT}` | Dashboard upstream URL |
| `START_DASHBOARD` | `true` | Set `false` untuk gateway-only mode |
| `IFESS_API_KEY` | required | API key untuk protected IFESS endpoints |
| `MSSQL_PORT` | `1433` | Default SQL Server port |
| `BUN_INSTALL` | — | Bun executable path untuk subprocess |

### Application

| File | Purpose |
|---|---|
| `Dashboard_Utama/.env` | Dev defaults |
| `Dashboard_Utama/.env.local` | Local overrides (gitignored) |
| `Dashboard_Utama/.env.docker` | Docker container |
| `.env.production` | Standalone production |

---

## 8. Cara Menambahkan Service Baru (Step-by-step)

```
Step 1: Buat service di folder (
  Module Services/<service-name>/ untuk backend           |
  Module Services/<service-name>/src untuk frontend       |
  untuk static HTML: Module Services/<service-name>/      |
)

Step 2: Tambah route di routes-config.json                |
  {                                                       |
    "id": "service-baru",                                 |
    "path": "/service-baru",                              |
    "target": "http://localhost:XXXX",                    |
    "enabled": true,                                      |
    "rewriteContent": false,                              |
    "spaIndex": "<path-ke-index.html-atau-spa-root>",     |
    "staticRoots": [...],                                 |
    "apiPrefixes": ["/service-baru/api"],                 |
  }                                                       |

Step 3: Tentukan isolation level                          |
  - Node.js server  → standalone dengan port sendiri       |
  - Static HTML     → target: "static://<path>"            |
  - Embeddable      → tambah handler di server_bun.js      |

Step 4: Tambah route di
  server_bun.js (jika backend API perlu handler khusus)    |

Step 5: Tambah service endpoint di                        |
  Dashboard_Utama/app/api/services/route.ts               |

Step 6: Tambah icon + card di shell utama                   |
```

---

## 9. Developer Isolation Checklist

Setiap service harus bisa:

1. **`npm run dev` tanpa jalankan gateway** — service jalan di port sendiri
2. **API bisa di-test dengan curl/Thunder Client** — ke port service langsung
3. **Tidak memakai router/dashboard state** dari module lain
4. **Env vars jelas** — baca dari `.env.local` sendiri, bukan dari root
5. **build output bisa di-host** — gateway bisa serve static build artifact

Jika module tidak memenuhi poin 1 → perlu direfactor (add `dev` script, expose own API).

`★ Insight ─────────────────────────────────────`
- **YAGNI principle for services**: setiap module sebaiknya bisa berjalan tanpa gateway, tapi **hanya module yang dipakai standalone** yang butuh `dev` script yang mandiri. Module statis (Wifi Monitor) cukup HTML file saja. Module reactive (Report Center) butuh dev server + hot reload. Module "data" (IFESS templates) cukup JSON edit + gateway auto-reload.
`─────────────────────────────────────────────────`

---

## 10. Troubleshooting Port**

| Gejala | Penyebab | Solusi |
|---|---|---|
| `EADDRINUSE: port 3001` | Zombie bun.exe di Services | kill proses lama via Task Manager, tetap `PORT=3001` |
| Report Center 503 | Next.js belum ready | Tunggu 5-10 detik setelah spawn |
| IFESS timeout (>60s) | `COUNT(DISTINCT)` over UNION | Split jadi single-table counts |
| SQL wrong data (`HariHadir=166`) | Missing month filter on scanner table | Tambah `TRANSDATE BETWEEN 'YYYY-MM-01' AND 'YYYY-MM-31'` |
| Gateway routes tidak aktif | `routes-config.json` typo | Validasi JSON, cek `enabled: true` |
| Next.js build hang | Module tidak di-spawn | `START_DASHBOARD=true` atau manual `npm run dev` |

---

## 11. Diagram: Dependency Ring

```
Dashboard_Utama (Next.js 16 :3100)
  │  ├─→ MSSQL (1433) via SQL Gateway (:8001)
  │  ├─→ Firebird FDB via gateway /query-gateway/:3001
  │  ├─→ IFESS via /api/ifess/:3001
  │  └─→ SQL templates živě: data/ifess/query-templates.json

Report Center (alternative, :3200) ← SAME code as Dashboard_Utama
  └─ same dependencies

Server Monitor (:3000)
  └─ static (no DB)

SQL Gateway (:8001)
  └─ MSSQL (1433 or 1888)

IFESS/Query Gateway (:3001)
  └─ Firebird FDB (via isql)
  └─ data/ifess/*.json
```

---

**Last updated**: 2026-07-16 | Author: CL (session arch)
