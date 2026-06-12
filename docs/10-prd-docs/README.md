# PRD & Plans Documentation

**Last updated: 2026-06-10**

Dokumentasi lengkap untuk semua Product Requirements Documents (PRD), arsitektur, dan rencana pengembangan sistem Main Dashboard.

---

## Table of Contents

1. [PRD: Report Detail Performance Optimization](#1-prd-report-detail-performance-optimization)
2. [Gateway Routing Architecture](#2-gateway-routing-architecture)
3. [Inventory Module Exploration via Query Gateway](#3-inventory-module-exploration-via-query-gateway)
4. [MCP Otak Digital Atta Setup](#4-mcp-otak-digital-atta-setup)
5. [Prompt Engineering Notes](#5-prompt-engineering-notes)
6. [Plans Overview (PLANS.md)](#6-plans-overview-plansmd)

---

## 1. PRD: Report Detail Performance Optimization

**File Path:** `D:\Gawean Rebinmas\Main Dashboard\PRD-Report-Detail-Performance-Optimization.md`

### 1.1 Context & Problem Statement

Halaman `/report-center/inventory/[report]` saat ini sangat berat. Analisis root cause menemukan multi-layered performance bottleneck:

| # | Bottleneck | Dampak | Severity |
|---|-----------|--------|----------|
| 1 | `loadAllRows: true` → fetch seluruh dataset (bisa 10K+ row) | Memori & network latency tinggi | Critical |
| 2 | `filteredRows` → client-side filter + sort seluruh rows setiap render | Main thread blocking, UI freeze | Critical |
| 3 | `buildTableGroups` → `shouldSubtotalColumn` scan 20 sample rows per kolom × N grup | O(n×cols) recomputation | High |
| 4 | AI analysis POST → kirim full `ReportPayload` (rows + columns + metadata) | Payload size bisa 5-10MB+ | High |
| 5 | `uniqueValues(rows, field)` → scan 500 rows per filter kolom | 30+ filter columns = 15K iterations | Medium |
| 6 | `useMemo` dengan dependency `payload` → setiap payload change recalculate 8+ memoized values | Double computation on data change | Medium |
| 7 | AI analysis fires on every `aiRefreshKey` increment | Tanpa debounce, spam API call | Medium |
| 8 | `dynamicFilterColumns` useMemo → recalculate entire column list per payload change | Expensive column inference | Medium |

### 1.2 Design Constraint

**TIDAK mengubah design/tampilan UI.** Semua optimasi dilakukan pada layer data fetching, memoization, dan rendering strategy.

### 1.3 Proposed Solutions (Phase-based)

#### Phase 1: Server-side Pagination + Initial Row Limit (Critical Fix)

**Problem:** `loadAllRows: true` fetch seluruh dataset. Tidak ada pagination.

**Solution:**

1. Hapus `loadAllRows: true` → ganti dengan default limit 500 rows.
2. API endpoint `/api/reports/inventory` perlu support pagination params:
   - `page` (default: 1)
   - `pageSize` (default: 100, max: 500)
   - `totalRows` → response include total count untuk pagination UI

3. Update `fetchReport` function:
```typescript
// Before: loadAllRows ? 'all' : 500
// After: use page + pageSize from state, default 100 rows
```

4. Replace infinite scroll → proper paginated table with page numbers.
5. Client-side search/sort hanya berlaku pada loaded page (bukan full dataset).
6. Add "Load More" button untuk append next page (max 5 pages = 500 rows).

**Impact:** Reduce initial payload from ~10K rows → ~500 rows. Loading time 80% faster.

#### Phase 2: Virtual Scrolling untuk Tabel (Critical Fix)

**Problem:** Rendering 100+ DOM rows = browser lag.

**Solution:**

1. Implement `@tanstack/react-virtual` untuk virtualized table body.
2. Only render visible rows (viewport + 10 buffer rows).
3. Maintain scroll position on filter/sort.

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

// Wrap table body with virtualizer
const rowVirtualizer = useVirtualizer({
  count: pageRows.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: () => density === 'compact' ? 36 : 48,
  overscan: 10,
})
```

**Impact:** Render only ~15-20 rows instead of 100+. FPS improvement.

#### Phase 3: Lazy AI Analysis + Payload Reduction (High Fix)

**Problem:** Full payload sent to AI endpoint (5-10MB+), fires on every filter change.

**Solution:**

1. **Separate AI analysis from main load:**
   - Load report data first → display table immediately
   - AI analysis fires only on explicit "Generate AI Insight" button OR on page idle (after 2s)
   - Remove `aiRefreshKey` auto-fire on payload change

2. **Send minimal payload to AI:**
   - Instead of full `rows[]`, send `summary` + `metadata` + `top 50 samples` (first 50 rows)
   - Remove `chart` from AI payload (AI generates its own charts)

```typescript
// AI payload: before vs after
const before = { rows: payload.rows, columns: payload.columns, summary, metadata, chart }
const after = { 
  summary: payload.summary, 
  metadata: payload.metadata,
  columns: payload.columns.slice(0, 20), // only 20 columns
  sampleRows: payload.rows.slice(0, 50), // only 50 sample rows
}
```

3. **Cache AI result** in sessionStorage with key `${reportId}:${JSON.stringify(filters)}`.
   - Re-display cached AI dashboard on filter revert within same session.

**Impact:** AI API payload reduced 90%+. No AI blocking table load.

#### Phase 4: Memoization & Computation Optimization (Medium Fix)

**Problem:** Multiple expensive computations on every payload change.

**Solution:**

1. **Debounce filteredRows computation:**
```typescript
// Before: immediate recompute
const filteredRows = useMemo(() => { ... }, [payload, tableSearch, sortColumn, sortDirection])

// After: debounce search/sort by 150ms
const debouncedSearch = useDebouncedValue(tableSearch, 150)
const filteredRows = useMemo(() => { ... }, [payload, debouncedSearch, sortColumn, sortDirection])
```

2. **Cache uniqueValues:**
```typescript
// Before: compute every time
const options = type === 'string' ? uniqueValues(rows, field).slice(0, 80) : []

// After: memoize per field
const uniqueCache = useRef<Map<string, string[]>>(new Map())
const options = uniqueCache.current.get(field) ?? uniqueValues(rows, field).slice(0, 80)
```

3. **Memoize dynamicFilterColumns:**
```typescript
// Only recompute when columns actually change, not on every payload change
const prevColumnsRef = useRef<string[]>([])
const shouldRecompute = prevColumnsRef.current !== payloadColumns
// ...
```

4. **Lazy compute tableTotals:**
```typescript
// Compute totals only when group mode is active, not on every render
const tableTotals = useMemo(() => {
  if (!groupedTableActive) return {}
  return computeTotals(...)
}, [groupedTableActive, filteredRows, visibleColumns])
```

5. **Split `stockAgingKpis` into web worker** if row count > 5000:
   - Move `rows.filter()` → web worker
   - Main thread stays responsive during KPI computation

**Impact:** Reduce recomputation on filter change by 60%.

#### Phase 5: API-level Optimization (Medium Fix)

**Problem:** `uniqueValues` compute client-side (500 rows × 30 columns = 15K iterations).

**Solution:**

1. API endpoint returns `distinctValues: { [columnName]: string[] }` in response metadata.
   - Server computes via `SELECT DISTINCT col FROM table WHERE ... LIMIT 50`
   - Only for filterable columns (string type)

2. Remove `uniqueValues()` client-side function.

```typescript
// Before: client compute
const options = uniqueValues(rows, field).slice(0, 80)

// After: from metadata
const options = payload.metadata?.distinctValues?.[field] ?? []
```

3. Reduce filterable columns from 30 → 10 (business-critical columns only).
   - Rest can be searched via `contains` operator without dropdown.

**Impact:** Remove 15K+ row iterations on each load.

### 1.4 Implementation Order

| Phase | Priority | Effort | Risk | Impact |
|-------|----------|--------|------|--------|
| Phase 1: Pagination + Row Limit | **P0** | Medium | Low | 80% faster load |
| Phase 2: Virtual Scrolling | **P0** | Medium | Low | Smooth 60fps scrolling |
| Phase 3: Lazy AI + Payload Reduction | **P1** | Medium | Medium | AI tidak block table |
| Phase 4: Memoization | **P1** | Low | Low | 40% less recomputation |
| Phase 5: Server Distinct Values | **P2** | Medium | Medium | Remove 15K iterations |

### 1.5 Acceptance Criteria

- [ ] Initial load: < 2s for 1000+ row reports (Phase 1)
- [ ] Table scroll: smooth 60fps with 10K rows (Phase 2)
- [ ] Table visible before AI analysis starts (Phase 3)
- [ ] Filter change: < 100ms response time (Phase 4)
- [ ] No design changes visible to user
- [ ] All existing features (preset, natural filter, export) still functional

### 1.6 Files to Modify

| File | Changes |
|------|---------|
| `ReportViewerClient.tsx` | Phase 1-5 implementation |
| `app/api/reports/inventory/route.ts` | Add pagination, distinct values |
| `app/api/reports/[reportCode]/ai-analysis/route.ts` | Accept minimal payload, caching |

### 1.7 Monitoring Metrics

- Initial load time (LCP): target < 2s
- Time to interactive (TTI): target < 3s
- Memory usage: target < 150MB for 10K rows
- AI analysis latency: non-blocking table load

---

## 2. Gateway Routing Architecture

**File Path:** `D:\Gawean Rebinmas\Main Dashboard\.hermes\plans\2026-05-16_0945_gateway-routing-architecture.md`

### 2.1 Goal

Mendokumentasikan dan merencanakan struktur routing gateway untuk **Main Dashboard** — single Express gateway (`server.js`) yang menjadi entry point untuk semua layanan backend (upah, absen, monitoring-beras, query, file) dan frontend Next.js (`Dashboard_Utama`).

### 2.2 Current State

#### Services & Ports

| Service | Port | Route | Type |
|---|---|---|---|
| Main Dashboard (Next.js) | 3001 | `/` | Frontend |
| Sistem Upah / Payroll | 8002 | `/upah` + `/backend/upah` | Backend API + Static |
| Sistem Absensi | 5176 | `/absen` | Full app proxy |
| Monitoring Beras | 5177 | `/monitoring-beras` | Full app proxy |
| SQL Gateway | 8001 | `/query` | API only |
| File Gateway | 5178 | `/file` | API only |

#### Key Files

```
D:\Gawean Rebinmas\Main Dashboard\
├── server.js                          # Express gateway (781 lines)
├── routes-config.json                 # Route definitions (dev)
├── routes-config.production.json      # Route definitions (prod)
├── Dashboard_Utama\                   # Next.js frontend app
│   ├── app/
│   ├── middleware.ts
│   ├── next.config.js
│   └── dist/                          # Production build output
├── context_portal\                    # Python/FastAPI backend
│   ├── alembic/
│   ├── context.db                     # SQLite database
│   └── logs/
└── .env.development                   # Dev env vars
```

#### Current Architecture (simplified)

```
Browser
   │
   ▼
server.js :3001 (Express)
   ├── GET /           → Next.js handler (Dashboard_Utama)
   ├── /upah/*         → http://localhost:8002  (rewriteContent=true)
   ├── /backend/upah/* → http://localhost:8002  (API, no rewrite)
   ├── /absen/*        → http://localhost:5176  (rewriteContent=true)
   ├── /monitoring-beras/* → http://localhost:5177 (rewriteContent=true)
   ├── /query/*        → http://localhost:8001  (API only)
   └── /file/*         → http://localhost:5178  (API, rewritePath=true)
```

### 2.3 Decisions to Make

#### 1. Content Rewrite Strategy

`rewriteContent: true` berarti gateway men-swizzle HTML response agar asset paths dan redirects mengarah ke gateway route, bukan langsung ke backend. Ini perlu untuk **full app proxies** (`/upah`, `/absen`, `/monitoring-beras`) tapi **tidak** untuk API-only routes (`/query`, `/file`, `/backend/upah`).

**Pertanyaan:** Apakah semua service ini benar-benar served dari root (`/upah`, `/absen`) atau ada yang subdomain-based? Apakah ada konfigurasi `basePath` di masing-masing app?

#### 2. `/backend/upah` vs `/upah` Separation

Dua route ke service yang sama (port 8002):
- `/upah` → `rewriteContent: true` — frontend app
- `/backend/upah` → `rewriteContent: false` — API calls dari client

**Pertanyaan:** Kenapa tidak pakai `/upah/api/*` sebagai API route di dalam satu app? Apakah ada alasan desain memisahkannya?

#### 3. Production Target Hosts

`routes-config.production.json` masih menunjuk ke `localhost:XXXX`. Di production, services mungkin jalan di `223.25.98.220` atau `10.0.0.110` sesuai comment di `server.js` baris 11.

**Pertanyaan:** Apakah production environment sudah punya fixed IPs/hostnames untuk masing-masing service? Atau masih menggunakan service discovery lain?

#### 4. Next.js Integration

`server.js` meng-import Next.js dari `./Dashboard_Utama/node_modules/next` dan meng-handle `/` route. Di production (`NODE_ENV=production`), Next.js build harus sudah ada di `Dashboard_Utama/dist/`.

**Pertanyaan:** Apakah production build pipeline sudah ada? Apakah ada plan untuk deploy Next.js separately vs di-host dalam gateway?

#### 5. Health Checks & Graceful Degradation

Tidak ada health check endpoint atau circuit breaker. Jika satu service mati, gateway akan timeout saat proxying.

**Pertanyaan:** Apakah perlu tambahkan health check per service?

### 2.4 Proposed Routing Architecture

#### Route Classification

```
Type A — Full App Proxy (serve entire app, rewrite HTML):
  /upah, /absen, /monitoring-beras
  → rewriteContent: true, target: :XXXX

Type B — API Proxy (JSON API only, no rewrite):
  /backend/upah, /query, /file
  → rewriteContent: false, rewritePath: false

Type C — Static Asset Proxy (future):
  /assets/xxx → CDN or static file server
```

#### Middleware Chain (request lifecycle)

```
1. CORS middleware        — handle cross-origin
2. Morgan logging         — HTTP request log
3. Static serving         — if any direct static files
4. Proxy routes           — check routes-config.json, proxy accordingly
5. Next.js handler        — fallback to Next.js app (/)
6. 404 handler
```

#### Recommended File Structure

```
D:\Gawean Rebinmas\Main Dashboard\
├── server.js                    # Keep as-is (gateway logic)
├── routes-config.json           # Keep as-is
├── routes-config.production.json # Update with prod hosts
├── .env.development             # Dev service URLs
├── .env.production              # Prod service URLs (223.25.98.220 / 10.0.0.110)
├── context_portal/              # Keep separate (FastAPI, port 8001)
├── Dashboard_Utama/             # Next.js frontend
│   ├── .env.local               # Next.js env vars (API_BASE_URL)
│   └── dist/                    # Production build
└── services/                    # [NEW] Optional: process manager for local dev
    ├── upah/                    # Payroll service (port 8002)
    ├── absen/                   # Absensi service (port 5176)
    ├── monitoring-beras/        # Monitoring service (port 5177)
    └── file-gateway/            # File service (port 5178)
```

### 2.5 Step-by-Step Plan

#### Phase 1: Document & Validate Current Routes
- [ ] Audit setiap service — cek `next.config.js` atau app config apakah sudah menggunakan `basePath` atau `assetPrefix`
- [ ] Cek apakah `/upah` dan `/absen` apps bisa jalan di subfolder tanpa `basePath` dikonfigurasi
- [ ] Verify `rewriteContent: true` behavior dengan inspect HTML response dari masing-masing service

#### Phase 2: Production Route Configuration
- [ ] Update `routes-config.production.json` dengan real production hostnames (bukan `localhost`)
- [ ] Tambah env vars di `.env.production`:
  ```
  UPAD_HOST=http://10.0.0.110:8002
  ABSEN_HOST=http://10.0.0.110:5176
  MONITORING_HOST=http://10.0.0.110:5177
  QUERY_HOST=http://223.25.98.220:8001
  FILE_HOST=http://223.25.98.220:5178
  ```
- [ ] Update `server.js` agar membaca service hosts dari env vars (bukan hardcoded)

#### Phase 3: Next.js BasePath Configuration
- [ ] Cek apakah `Dashboard_Utama/next.config.js` punya `basePath` — jika gateway route `/` maka `basePath: ''` (default)
- [ ] Jika ada plan deploy Next.js separately, set `basePath` sesuai
- [ ] Update `next.config.js` output `assetPrefix` agar static assets proxied correctly

#### Phase 4: Health Check & Monitoring
- [ ] Tambahkan `GET /health` endpoint di `server.js` yang nge-check semua service ports
- [ ] Opsional: log response time per proxy request untuk debugging

#### Phase 5: Error Handling
- [ ] Tambahkan error handler middleware untuk proxy failures
- [ ] Return meaningful error message jika service unavailable

### 2.6 Files to Change

| File | Action |
|---|---|
| `routes-config.production.json` | Update target hosts |
| `.env.production` | Create with prod service URLs |
| `server.js` | Read service hosts from env vars |
| `Dashboard_Utama/next.config.js` | Review basePath/assetPrefix config |
| `.env.development` | Ensure all service ports documented |

### 2.7 Risks & Tradeoffs

| Risk | Mitigation |
|---|---|
| `rewriteContent: true` bisa break jika backend kirim absolute URLs | Test setiap route, mungkin perlu custom rewrite logic |
| Production hosts belum fixed | Tunda Phase 2 sampai network topology confirmed |
| Next.js dev/prod build mixing | Pastikan `dist/` ter-build sebelum production start |
| Service downtime affecting gateway | Tambahkan timeout + error response yang jelas |

### 2.8 Open Questions

1. **Service discovery:** Bagaimana services di-production ditemukan? Static IPs, Docker network, atau orchestration?
2. **API routing convention:** Kenapa `/backend/upah` terpisah dari `/upah`? Apakah plan menggabungkan jadi `/upah/api/*`?
3. **Next.js deployment:** Di-host dalam gateway process atau separate?
4. **SSL/TLS:** Apakah gateway terminate SSL atau services masing-masing?
5. **Database:** `context_portal/context.db` — ini SQLite, apakah sudah cukup untuk production atau perlu PostgreSQL?

---

## 3. Inventory Module Exploration via Query Gateway

**File Path:** `D:\Gawean Rebinmas\Main Dashboard\.hermes\plans\2026-05-16_0955_inventory-module-exploration-via-query-gateway.md`

### 3.1 Goal

Explore schema dan data tabel dengan prefix `IN_` (inventory) di dua database:
- **db_ptrj** (Estate) → via Server 1
- **db_ptrj_mill** (Pabrik/Mill) → via Server 3

Simpan hasil exploration ke `D:\Gawean Rebinmas\Main Dashboard\Services\module\inventory\` + dokumentasi penggunaan di project.

### 3.2 Koneksi SQL Gateway

| Property | Value |
|---|---|
| Base URL | `http://localhost:8001` |
| API Token | `2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6` |
| Endpoint | `POST /v1/query` |

**Payload format:**
```json
{
  "sql": "SELECT TOP N * FROM [db].[dbo].[TABLE]",
  "database": "db_ptrj",
  "params": {}
}
```

### 3.3 Step-by-Step Plan

#### Step 1 — Verify Gateway & Database Connections
- [ ] `GET /health` → pastikan SQL Gateway alive
- [ ] `GET /v1/databases` → list semua database yang accessible
- [ ] Konfirmasi `db_ptrj` dan `db_ptrj_mill` muncul di list

#### Step 2 — List Semua Tabel dengan Prefix `IN_` (Kedua DB)
Query di setiap database:
```sql
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE 'IN[_]%'
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME
```

Output: daftar lengkap semua tabel IN_* di `db_ptrj` dan `db_ptrj_mill`.

#### Step 3 — Schema Discovery: Tabel Utama IN_ITEM
Ambil kolom, tipe data, nullable, default dari:
```sql
SELECT
    c.COLUMN_NAME,
    c.DATA_TYPE,
    c.CHARACTER_MAXIMUM_LENGTH,
    c.NUMERIC_PRECISION,
    c.NUMERIC_SCALE,
    c.IS_NULLABLE,
    c.COLUMN_DEFAULT,
    c.ORDINAL_POSITION
FROM INFORMATION_SCHEMA.COLUMNS c
WHERE c.TABLE_NAME = 'IN_ITEM'
ORDER BY c.ORDINAL_POSITION
```
Lakukan untuk `db_ptrj` (Estate) dan `db_ptrj_mill` (Mill).

#### Step 4 — Row Counts Semua Tabel IN_*
```sql
SELECT
    t.NAME AS TableName,
    p.rows AS RowCounts
FROM sys.tables t
INNER JOIN sys.partitions p ON t.object_id = p.object_id
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE t.name LIKE 'IN[_]%'
  AND p.index_id IN (0, 1)
ORDER BY t.name
```

#### Step 5 — Sample Data IN_ITEM (Estate & Mill)
Ambil 5 baris sample dari `IN_ITEM` di masing-masing database untuk understand data.

#### Step 6 — Explore Relasi: Foreign Key & Referenced Tables
```sql
SELECT
    fk.name AS FK_NAME,
    tp.name AS PARENT_TABLE,
    cp.name AS PARENT_COL,
    tr.name AS REFERENCED_TABLE,
    cr.name AS REFERENCED_COL
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
WHERE tp.name LIKE 'IN[_]%' OR tr.name LIKE 'IN[_]%'
```

#### Step 7 — Dokumentasi & Simpan Hasil

Struktur output:
```
Services/module/inventory/
├── README.md                         # Overview module
├── docs/
│   ├── QUICK_REFERENCE.md            # API usage cheatsheet
│   ├── DB_SCHEMA.md                  # Schema lengkap semua tabel IN_*
│   └── ESTATE_VS_MILL.md             # Perbandingan schema estate vs mill
├── db_ptrj/
│   ├── tables.json                   # Daftar semua tabel IN_* estate
│   ├── schema_IN_ITEM.json           # Schema IN_ITEM estate
│   ├── row_counts.json               # Row counts semua tabel
│   └── samples/
│       └── IN_ITEM.json              # Sample data
├── db_ptrj_mill/
│   ├── tables.json
│   ├── schema_IN_ITEM.json
│   ├── row_counts.json
│   └── samples/
│       └── IN_ITEM.json
└── queries/
    ├── list_in_tables.sql
    ├── in_item_schema.sql
    ├── row_counts.sql
    └── foreign_keys.sql
```

### 3.4 Implementation Notes

- **Executor:** Claude Code CLI (`claude-code`) dengan model `sonnet` untuk exploration via terminal
- **API caller:** `curl` commands via terminal tool ke SQL Gateway di port 8001
- **Token auth:** `-H "x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6"`
- **Database routing:** SQL Gateway otomatis route berdasarkan `database` field di payload
  - `"database": "db_ptrj"` → Server 1 (Estate)
  - `"database": "db_ptrj_mill"` → Server 3 (Mill)

### 3.5 Status: COMPLETED (2026-05-16)

#### Findings

**SQL Gateway (SERVER_PROFILE_3) connected to:**
- Server: `223.25.98.220:14330` (Server 3 — Pabrik)
- Databases: `db_ptrj_mill`, `db_ptrj_mill_test`, `VenusHR14`

**`db_ptrj` (Estate / Server 1) NOT accessible via this gateway.** Gateway hanya support 1 server profile sekaligus. Dibutuhkan profile terpisah untuk Estate.

**69 IN_* tables found** di `db_ptrj_mill`. Largest: `IN_MTHENDITEM` (673K rows), `IN_STOCKISSUELN` (32.5K), `IN_PRLN` (31K).

**No FK constraints** — semua relasi implicit via column naming conventions.

#### Files Created
- `Services/module/inventory/README.md`
- `Services/module/inventory/docs/QUICK_REFERENCE.md`
- `Services/module/inventory/docs/DB_SCHEMA.md`
- `Services/module/inventory/db_ptrj_mill/tables/tables.json`
- `Services/module/inventory/db_ptrj_mill/schema/IN_ITEM.json`
- `Services/module/inventory/db_ptrj_mill/samples/IN_ITEM.json`
- `Services/module/inventory/queries/*.sql`
- `Dokumentasi/SQL_GATEWAY_INVENTORY_MODULE.md`

### 3.6 Next Steps

1. **Akses Estate (`db_ptrj`):** Setup SQL Gateway profile untuk Server 1 (`10.0.0.110` atau IP Estate)
2. **Explore HR module:** Ada `HR_EMPLOYEE` table untuk integrasi
3. **Explore transaction tables:** `IN_STOCKISSUELN`, `IN_PRLN`, `IN_FUELISSUELN` untuk detail transaksi
4. **Explore `IN_ITEMCODE`:** Item master tanpa LocCode (beda dengan IN_ITEM)

---

## 4. MCP Otak Digital Atta Setup

**File Path:** `D:\Gawean Rebinmas\Main Dashboard\.hermes\plans\2026-05-16_000000_mcp-otak-digital-atta-setup.md`

### 4.1 Plan: Proxy Gateway Optimization — nginx-equivalent Performance

**Context**

Proxy gateway (server.js port 3001) menangani seluruh traffic ke 6+ upstream service. Masalah utama:

1. **Buffered proxy** — `selfHandleResponse: true` membUFFER seluruh response ke memory sebelum kirim
2. **Compression stripped** — `Accept-Encoding` dihapus di `onProxyReq`, backend kirim uncompressed
3. **Tidak ada Cache-Control** — browser re-download asset setiap request
4. **Static asset leak** — `/upah/assets/*` masuk pipeline proxy padahal bisa served langsung
5. **Tidak ada caching** — chunk yang sama di-fetch ulang setiap kali

Target: **nginx-equivalent performance** untuk `/upah` assets (chunk JS 500KB+).

### 4.2 Critical Files

| File | Purpose |
|------|---------|
| `server.js` | Express proxy gateway existing (current) |
| `server_bun.js` | Bun native proxy (already exists, needs completion) |
| `routes-config.json` | Route definitions |

### 4.3 Architecture Decision

**Bun native (server_bun.js) vs Nginx vs Node cluster:**

- **Nginx**: fastest raw performance but requires separate process + config syntax
- **Express/Node cluster**: familiar, but buffering overhead inherent
- **Bun native**: native HTTP server, zero middleware overhead, LRU cache built-in, competitive with Nginx for this workload

**Decision: Bun native** — fastest path to nginx-equivalent without separate infra, leverages existing Node.js ecosystem.

### 4.4 Implementation: server_bun.js (F-001 → F-006)

#### F-001: Static Extension Fast-Path ✅ Already implemented in server_bun.js

```javascript
// Static file bypass — serve directly via Bun.file()
const staticPath = getStaticFilePath(reqPath);
if (staticPath) {
    const file = Bun.file(staticPath);
    return new Response(await file.arrayBuffer(), {
        headers: { 'Content-Type': getMimeType(reqPath), 'Cache-Control': 'public, max-age=31536000, immutable' }
    });
}
```

Serves `/upah/assets/*` and `/assets/*` directly — no proxy middleware overhead.

#### F-002: Cache-Control Headers ✅ Already implemented in server_bun.js

```javascript
function getCacheControl(reqPath, contentType) {
    if ((isJs || isCss) && hasVersionHash) return 'public, max-age=31536000, immutable';
    if (isHtml) return 'no-cache, no-store, must-revalidate';
    // ...
}
```

#### F-003: Selective Compression Preservation (PENDING)

For routes with `rewriteContent: false` — preserve backend gzip/brotli, no decompression.

#### F-004: LRU In-Memory Cache (PENDING)

Cache frequently-accessed `/upah` chunks in LRU with 30-min TTL. Already skeleton exists.

#### F-005: Selective URL Rewriting (PENDING)

Only rewrite HTML/text content types. Binary (images, fonts) skip rewrite entirely.

#### F-006: Extended Route Config Schema (COMPLETED)

routes-config.json extended with cache/maxAge/rewriteExtensions support.

### 4.5 Verification

1. Run `bun run server_bun.js` alongside existing services
2. Test: `curl -I http://localhost:3001/upah/assets/index-[hash].js`
   - Expected: `200 OK`, `Cache-Control: public, max-age=31536000, immutable`, no `X-Proxy-Elapsed`
3. Test: `curl -I http://localhost:3001/upah/`
   - Expected: `200 OK`, HTML with rewritten URLs, `Cache-Control: no-cache`
4. Test: Dashboard loads → HMR WebSocket connects
5. Benchmark: compare TTFB vs Express server.js for 500KB chunk
6. Swap default: update `package.json` `scripts.start` to `bun run server_bun.js`

---

## 5. Prompt Engineering Notes

**File Path:** `D:\Gawean Rebinmas\Main Dashboard\prompt\current.txt`

### 5.1 Diagram: Gateway/Proxy Architecture

```
[ USER / BROWSER ]
       |
       | 1. Request: "Saya mau ke /produk"
       |    URL: http://localhost:3000/produk
       v
+---------------------------------------------------+
|             GATEWAY / PROXY SERVER                |
|           (Running di Port 3000)                  |
| ------------------------------------------------- |
|  Tugas: Mengecek label URL (path)                 |
|                                                   |
|  2. "Oh, dia minta /produk?                       |
|      Oke, sambungkan ke Port 5001"               |
+------------------------+--------------------------+
                         |
        +----------------+----------------+
        |                |                |
        v                v                v
+--------------+  +--------------+  +--------------+
| SERVICE A    |  | SERVICE B    |  | SERVICE C    |
| (Produk)     |  | (User/Auth)  |  | (Payment)    |
|              |  |              |  |              |
| Port: 5001   |  | Port: 5002   |  | Port: 5003   |
+--------------+  +--------------+  +--------------+
       ^
       |
       | 3. Response: Data Produk dikirim balik
       |    melalui Gateway ke User
```

### 5.2 Use Case Summary

**Konsep:** Bagaimana membuat banyak port service yang running di local menjadi hemat port untuk forwarding public port, misal ke 3001 sebagai gateway untuk semua running port service.

**Solusi:** Gunakan gateway/proxy server yang running di satu port (misal 3001) dan route request berdasarkan path ke service yang sesuai.

**Benefits:**
- User hanya perlu ingat 1 port (3001)
- Semua layanan diakses melalui 1 URL terpusat
- Mudah untuk maintenance dan scaling
- Bisa tambahkan authentication, logging, rate-limiting di gateway level

---

## 6. Plans Overview (PLANS.md)

**File Path:** `D:\Gawean Rebinmas\Main Dashboard\PLANS.md`

### 6.1 Overview

Dokumentasi ini berisi semua rencana pengembangan yang telah dan sedang berjalan untuk sistem Main Dashboard. Setiap plan memiliki status dan timeline yang jelas.

### 6.2 Plan Categories

| Category | Description |
|----------|-------------|
| Architecture | Gateway routing, service integration |
| Performance | Report optimization, caching strategies |
| Modules | Inventory, HR, Payroll exploration |
| Infrastructure | MCP setup, Bun migration, proxy optimization |

### 6.3 Active Plans Summary

| Plan | Status | Priority |
|------|--------|----------|
| Report Detail Performance Optimization | In Progress | P0 |
| Gateway Routing Architecture | Planning | P1 |
| Inventory Module Exploration | Completed | P1 |
| MCP Otak Digital Atta Setup | Completed | P2 |

### 6.4 Related Documentation

- **PRD:** `PRD-Report-Detail-Performance-Optimization.md`
- **Gateway:** `.hermes/plans/2026-05-16_0945_gateway-routing-architecture.md`
- **Inventory:** `.hermes/plans/2026-05-16_0955_inventory-module-exploration-via-query-gateway.md`
- **MCP Setup:** `.hermes/plans/2026-05-16_000000_mcp-otak-digital-atta-setup.md`
- **Prompts:** `prompt/current.txt`

---

## File Path Reference

Berikut adalah path absolut dari semua file yang diacu dalam dokumentasi ini:

| Dokumentasi | File Path |
|-------------|-----------|
| PRD Report Detail | `D:\Gawean Rebinmas\Main Dashboard\PRD-Report-Detail-Performance-Optimization.md` |
| Gateway Routing | `D:\Gawean Rebinmas\Main Dashboard\.hermes\plans\2026-05-16_0945_gateway-routing-architecture.md` |
| Inventory Module | `D:\Gawean Rebinmas\Main Dashboard\.hermes\plans\2026-05-16_0955_inventory-module-exploration-via-query-gateway.md` |
| MCP Setup | `D:\Gawean Rebinmas\Main Dashboard\.hermes\plans\2026-05-16_000000_mcp-otak-digital-atta-setup.md` |
| Prompt Notes | `D:\Gawean Rebinmas\Main Dashboard\prompt\current.txt` |
| Plans Overview | `D:\Gawean Rebinmas\Main Dashboard\PLANS.md` |
| **This Document** | `D:\Gawean Rebinmas\Main Dashboard\docs\10-prd-docs\README.md` |

---

**Last updated: 2026-06-10**