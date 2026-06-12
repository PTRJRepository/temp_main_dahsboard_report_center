# Workflow Artifacts — Ringkasan Komprehensif

**Last updated: 2026-06-10**

---

## Daftar Isi

1. [Overview Workflow](#1-overview-workflow)
2. [Workflow Active (Berlangsung)](#2-workflow-active-berlangsung)
3. [Workflow Lite-Plan (Perencanaan)](#3-workflow-lite-plan-perencanaan)
4. [Workflow Multi-CLI-Plan (Eksekusi)](#4-workflow-multi-cli-plan-eksekusi)
5. [Referensi Cepat](#5-referensi-cepat)

---

## 1. Overview Workflow

Dokumen ini berisi ringkasan semua workflow yang ada di proyek Dashboard PTRJ, yang tersimpan di direktori `.workflow/`. Workflow ini mencakup berbagai perbaikan bug, peningkatan performa, dan redesign fitur utama aplikasi.

### 1.1 Kategori Workflow

| Kategori | Lokasi | Jumlah |
|----------|--------|--------|
| **Active** | `.workflow/active/` | 6 workflow |
| **Lite-Plan** | `.workflow/.lite-plan/` | 3 workflow |
| **Multi-CLI-Plan** | `.workflow/.multi-cli-plan/` | 1 workflow |

### 1.2 Ringkasan Topik Utama

| Topik | Workflow Terkait |
|-------|-----------------|
| **Report Detail Performance** | WFS-report-detail-table-body-performance, WFS-report-detail-fullscreen-readability |
| **Movement Category Bug** | WFS-fix-report-group-movement-category, bugfix-movementcategory-kpi-2026-05-23 |
| **Report Summary/Body Fix** | WFS-report-detail-summary-body-fix, 2026-05-25-report-detail-summary-body-fix |
| **Landing Page Reference** | WFS-fix-root-landing-page-reference, WFS-landing-page-reference-only |
| **PRD All Stock Movement** | prd-all-stock-movement-analysis-2026-05-26 |
| **Report Detail Context** | report-detail-context-2026-05-26 |
| **Proxy Architecture** | proxy-kerani-2026-05-30 |

---

## 2. Workflow Active (Berlangsung)

### 2.1 WFS-report-detail-table-body-performance

**Tanggal:** 2026-05 | **Status:** Completed | **Complexity:** Medium

#### Tujuan
Optimasi report detail loading dan table body rendering tanpa UI redesign.

#### Task Breakdown

| ID | Judul | Priority |
|----|-------|----------|
| IMPL-1 | Add Tested Report Detail Performance Helpers | - |
| IMPL-2 | Virtualize Report Table Body Rendering | - |
| IMPL-3 | Reduce Repeated Row/Column Computation | - |
| IMPL-4 | Harden Pagination Contract | - |
| IMPL-5 | Add Server-Side AI Payload Guardrail | - |

#### File Terlibat

```
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\app\report-center\inventory\[report]\ReportViewerClient.tsx
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\app\api\reports\inventory\route.ts
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\app\api\reports\[reportCode]\ai-analysis\route.ts
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\lib\reports\report-detail-performance.ts
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\lib\reports\report-detail-performance.test.ts
```

#### Key Findings

- Menggunakan `@tanstack/react-virtual` untuk virtualisasi table body
- AI payload compaction dibatasi 50 rows x 40 columns
- TABLE_FIRST_LIMIT = 500 untuk initial load

#### Exploration Artifacts

- `context-package.json` - Context package hasil CLI analysis
- `discoveries.ndjson` - NDJSON log semua temuan
- `.summaries/IMPL-*-summary.md` - Ringkasan setiap implementasi task

---

### 2.2 WFS-fix-report-group-movement-category

**Tanggal:** 2026-05 | **Status:** Replanned | **Complexity:** Medium

#### Tujuan
Fix inventory report detail grouping agar movement reports yang di-group berdasarkan `MovementCategory` menampilkan semua kategori yang applicable, bukan hanya satu grup dari loaded/paginated slice.

#### Task Breakdown

| ID | Judul | Priority | Status |
|----|-------|----------|--------|
| IMPL-1 | Centralize Movement Category Semantics | high | pending |
| IMPL-2 | Apply Shared Categories Across Movement Item Reports | - | pending |
| IMPL-3 | Return Category-Balanced Table Windows | - | pending |
| IMPL-4 | Align Auto Group Behavior | - | pending |
| IMPL-5 | Verification and Regression Coverage | - | pending |

#### File Terlibat

```
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\lib\reports\movement-category.ts
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\lib\reports\movement-category.test.ts
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\app\api\reports\inventory\route.ts
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\lib\reports\inventory\config.ts
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\app\report-center\inventory\[report]\ReportViewerClient.tsx
```

#### Key Findings

**Root Cause Analysis:**

1. **Bug 1: MovementCategory always "Dead Stock"**
   - Location: `route.ts:1316`
   - Problem: `issue_docs` CTE filter `ItemType = '1'` SAJA, exclude workshop items (ItemType='4')
   - Fix: Ubah filter dari `= '1'` ke `IN ('1', '4')`

2. **Bug 2: KPI summary wrong with limit** — **NOT A BUG**
   - `movementAnalysisKpis` categoryCard SUDAH menggunakan `summary[itemKey] ?? countByCategory(label)`
   - Summary dari server query ALL rows tanpa TOP N

#### Movement Category Rules

| Kategori | Issue Count | Condition |
|----------|-------------|-----------|
| Fast Moving | >= 6 | - |
| Moving | 2-5 | - |
| Slow Moving | 1 | - |
| Dead Stock | 0 | stock > 0 |
| Stale | 0 | stock = 0 |

#### Exploration Artifacts

- `planning-context.md` - Context perencanaan lengkap
- `exploration-error-handling.json` - Analisis error handling
- `exploration-dataflow.json` - Analisis dataflow
- `exploration-state-management.json` - Analisis state management
- `conflict-resolution.json` - Resolution konflik dengan workflow sebelumnya

---

### 2.3 WFS-report-detail-summary-body-fix

**Tanggal:** 2026-05 | **Status:** In Progress | **Complexity:** Medium

#### Tujuan
Perbaiki report detail agar summary dan table body konsisten, bebas dari efek limit/paginasi, dan menampilkan data item/quantity/amount/movement dengan benar.

#### Requirements
- Summary/KPI/table summary menggunakan agregasi seluruh data hasil report
- Quantity real-time format: `Total(OnHand+OnHold)`, contoh `6(4+2)`
- Warehouse dipindahkan ke kolom paling kanan
- Untuk `itemTypeStock = 4`, pencarian issue menggunakan `WS_JOBSTOCK`

#### Task Breakdown

| ID | Judul | Priority |
|----|-------|----------|
| IMPL-1 | Make Filtered Summary Full-Dataset | high |
| IMPL-2 | Make Table Summary Chips Use Full Summary | - |
| IMPL-3 | Reorder And Format Movement Report Body | - |
| IMPL-4 | Harden ItemType 4 Issue Source | - |
| IMPL-5 | Validation And Regression Gate | - |

#### Key Findings

- API post-filter summary vulnerable terhadap limits
- Frontend table totals reduce dari filteredRows (bisa hanya paginated payload)
- Working tree dirty dengan prior movement-category fixes

---

### 2.4 WFS-fix-root-landing-page-reference

**Tanggal:** 2026-05 | **Status:** Completed | **Complexity:** Low

#### Tujuan
Fix landing page yang served di root path `/` menggunakan reference repo.

#### Task Breakdown

| ID | Judul | Priority |
|----|-------|----------|
| IMPL-1 | Verify Root Landing Runtime Parity | - |
| IMPL-2 | Apply Minimal Landing Parity Fix | - |

#### File Terlibat

```
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\app\page.tsx
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\components\HeroSection.tsx
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\components\Navbar.tsx
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\components\SatelliteMapWrapper.tsx
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\components\SatelliteMap.tsx
```

#### Reference Repository
- Local path: `D:\tmp\temp_main_dahsboard_report_center`
- Remote: `https://github.com/PTRJRepository/temp_main_dahsboard_report_center`

#### Key Findings

- Source files checked identical dengan reference repo
- Runtime/build state perlu diverifikasi sebelum edit source

---

### 2.5 WFS-report-detail-fullscreen-readability

**Tanggal:** 2026-05 | **Status:** In Progress | **Complexity:** High | **Conflict Risk:** High

#### Tujuan
Redesign report detail untuk `all-stock-movement-analysis` dengan:
- Summary header dengan operational snapshot
- Table readability (zebra rows, dividers, sticky header)
- Fullscreen analysis mode
- Compact movement detail panel
- AI workspace improvements

#### Task Breakdown

| ID | Judul | Priority |
|----|-------|----------|
| IMPL-0 | Baseline Guard and Conflict Audit | - |
| IMPL-1 | Movement Source Contract and Quality Metadata | - |
| IMPL-2 | Summary Header and Metric Card Filtering | - |
| IMPL-3 | Table Readability Foundation | - |
| IMPL-4 | Sticky Columns and Fullscreen Toolbar | - |
| IMPL-5 | Compact Movement Detail Panel | - |
| IMPL-6 | AI Workspace and Chart Card Hierarchy | - |
| IMPL-7 | Verification and Regression Coverage | - |

#### File Terlibat

```
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\app\api\reports\inventory\route.ts
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\app\report-center\inventory\[report]\ReportViewerClient.tsx
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\components\report\AiDynamicDashboard.tsx
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\lib\reports\movement-category.ts
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\lib\reports\report-detail-performance.ts
```

#### Key Findings

- Report ID: `all-stock-movement-analysis`
- Route: `/report-center/inventory/all-stock-movement-analysis`
- API: `/api/reports/inventory?report=all-stock-movement-analysis`
- Staged work dari workflow sebelumnya harus dipertahankan

---

### 2.6 WFS-landing-page-reference-only

**Tanggal:** 2026-05 | **Status:** Completed | **Complexity:** Low-Medium

#### Tujuan
Verify atau apply landing page design reference dari reference repo. Scope hanya root landing page `/` dan direct landing dependencies.

#### Task Breakdown

| ID | Judul | Priority |
|----|-------|----------|
| IMPL-1 | Lock Scope And Compare Landing Reference | - |
| IMPL-2 | Apply Minimal Landing Source Reconciliation | - |
| IMPL-3 | Verify Root Render And Build Safety | - |

#### File Scope (Allowed)

```
Dashboard_Utama/app/page.tsx
Dashboard_Utama/components/HeroSection.tsx
Dashboard_Utama/components/Navbar.tsx
Dashboard_Utama/components/SatelliteMapWrapper.tsx
Dashboard_Utama/components/SatelliteMap.tsx
Dashboard_Utama/app/layout.tsx
Dashboard_Utama/app/globals.css
Dashboard_Utama/app/providers.tsx
Dashboard_Utama/context/LanguageContext.tsx
Dashboard_Utama/dictionaries/id.json
Dashboard_Utama/dictionaries/en.json
server.js, routes-config.json, routes-config.production.json
```

#### File Scope (Forbidden)

```
Dashboard_Utama/app/report-center/**
Dashboard_Utama/components/report/**
Dashboard_Utama/lib/reports/**
```

---

## 3. Workflow Lite-Plan (Perencanaan)

### 3.1 bugfix-movementcategory-kpi-2026-05-23

**Tanggal:** 2026-05-23 | **Type:** Lite-Plan | **Explorations:** 3

#### Tujuan
Analisis dan fix bug MovementCategory yang selalu menampilkan "Dead Stock" untuk semua item pabrik.

#### Exploration Angles

##### 3.1.1 Exploration: Error Handling

**File:** `exploration-error-handling.json`

**Key Findings:**
- Bug 1 ROOT CAUSE: `issue_docs` CTE line 1316 filter `= '1'` — workshop items (ItemType='4') di pabrik tidak punya StockIssueEventCount
- Fix: Ubah line 1316 dari `warehouseInventoryItemTypeExpression('issueItem') = '1'` menjadi `IN ('1', '4')`
- Bug 2 BUKAN bug — `categoryCard` SUDAH gunakan `summary[itemKey] ?? rows.filter`

##### 3.1.2 Exploration: Dataflow

**File:** `exploration-dataflow.json`

**Key Findings:**
- Server summary query TIDAK menggunakan TOP N — full data, benar
- `categoryCard` di `movementAnalysisKpis` SUDAH prioritaskan `summary[itemKey]` — ini benar
- Root cause Bug 1: SQL join tidak match (ItemType filter)

##### 3.1.3 Exploration: State Management

**File:** `exploration-state-management.json`

**Key Findings:**
- Pattern `kpiBuilder` profile: `kpiBuilder: (payload) => movementAnalysisKpis(payload.summary, payload.rows)`
- `categoryCard` cek `summary[itemKey]` duluan, baru fallback `rows.filter()`
- User juga inginkan BEP analysis per item grouped by MovementCategory — perlu query tanpa limit 500

#### Integration Points

| Location | Description |
|----------|-------------|
| `route.ts:1316` | Root cause: ItemType filter di issue_docs CTE |
| `route.ts:1330` | Workshop branch filter type='4' — benar |
| `route.ts:453-501` | stockMovementAnalysisColumns — MovementCategory CASE |
| `ReportViewerClient.tsx:663-672` | categoryCard — sudah summary-first |
| `route.ts:1496-1535` | summary query — ALL rows tanpa TOP N |

#### Planning Context

**Location:** `D:\Gawean Rebinmas\Main Dashboard\.workflow\.lite-plan\bugfix-movementcategory-kpi-2026-05-23\planning-context.md`

**Key Points:**
- ItemType = 1 → STOCK_ISSUE_REGULAR
- ItemType = 4 → WS_JOBSTOCK (MANDATORY)
- Summary query di route.ts:1496-1535 QUERIES ALL rows tanpa TOP N

---

### 3.2 prd-all-stock-movement-analysis-2026-05-26

**Tanggal:** 2026-05-26 | **Type:** Lite-Plan | **PRD Document**

#### Location
`D:\Gawean Rebinmas\Main Dashboard\.workflow\.lite-plan\prd-all-stock-movement-analysis-2026-05-26\PRD.md`

#### PRD Overview

**Report ID:** `all-stock-movement-analysis`
**Route:** `/report-center/inventory/all-stock-movement-analysis`
**API:** `GET /api/reports/inventory?report=all-stock-movement-analysis`
**Phase:** 7 phases total

#### Key Files in Scope

1. `ReportViewerClient.tsx`
2. `route.ts`
3. `config.ts`
4. `movement-category.ts`
5. `report-detail-performance.ts`
6. `report-filtering.ts`

#### Critical Rule

```
ItemType = 1 → STOCK_ISSUE_REGULAR
ItemType = 4 → WS_JOBSTOCK (MANDATORY)
```

#### 7 Implementation Phases

| Phase | Judul |
|-------|-------|
| 1 | Table Readability Quick Fix (zebra row, divider, wrap) |
| 2 | Summary Header (hero + metric cards) |
| 3 | Backend Normalized Movement Source (ItemType 4 → WS_JOBSTOCK) |
| 4 | Fullscreen Upgrade (sticky header + columns) |
| 5 | Expanded Detail Redesign (compact grid panel) |
| 6 | AI Report Improvements |
| 7 | Quality & Testing |

#### Open Questions (PRD)

1. Exact field names in `WS_JOBSTOCK` for date, qty, amount, event?
2. Workshop amount from `WS_JOBSTOCK.Amount` or join to cost table?
3. `Stale` = qty zero no movement OR no movement in period?
4. Summary row count = total after filter or total all?
5. Density/pinned preference in localStorage or DB?
6. Multiple expanded rows?
7. Movement Source visible by default or detail panel only?
8. Other reports use same summary hero?

#### DoD Checklist

- [ ] Report route accessible
- [ ] API backward compatible
- [ ] Summary hero from payload (not hardcoded)
- [ ] Zebra row + vertical divider
- [ ] Header column wrap
- [ ] Item name wrap
- [ ] Numeric right-aligned
- [ ] Fullscreen sticky header + columns
- [ ] Movement detail compact
- [ ] ItemType 4 uses WS_JOBSTOCK
- [ ] Movement category from normalized count
- [ ] AI reads payload only
- [ ] Quality tab detects invalid movement source
- [ ] Other reports not broken
- [ ] Performance initial load good

---

### 3.3 report-detail-context-2026-05-26

**Tanggal:** 2026-05-26 | **Type:** Lite-Plan | **Context Document**

#### Location
`D:\Gawean Rebinmas\Main Dashboard\.workflow\.lite-plan\report-detail-context-2026-05-26\REPORT_DETAIL_CONTEXT.md`

#### Overview

Comprehensive context document untuk report detail system yang berfungsi sebagai single source of truth. Semua agent yang memulai session baru HARUS membaca file ini sebelum membuat perubahan.

#### System Architecture

```
ReportViewerClient.tsx (Next.js App Router, React)
    ↓ fetch /api/reports/inventory?report=...&filters...
route.ts (Next.js API Route)
    ↓ build SQL CTEs per report type
    ↓ POST to SQL Gateway (MSSQL)
    ↓
SQL Gateway → MSSQL Databases:
  - db_ptrj (Estate Inventory, SERVER_PROFILE_2)
  - db_ptrj_mill (Pabrik Inventory, SERVER_PROFILE_3)
    ↓
movement-category.ts (SQL CASE expressions + display utilities)
    ↓
report-detail-performance.ts (table grouping, subtotals, AI payload compaction)
    ↓
ReportPayload returned → ReportViewerClient renders
```

#### Dual Data Source

| Source | Database | Used For |
|--------|----------|----------|
| `source=estate` (default) | `db_ptrj` | Estate / Kebun inventory |
| `source=pabrik` | `db_ptrj_mill` | Pabrik / Mill inventory |

#### Movement Category Order

```typescript
MOVEMENT_CATEGORY_ORDER = [
  'Fast Moving',   // StockIssueEventCount >= 6
  'Moving',        // StockIssueEventCount >= 2
  'Slow Moving',   // StockIssueEventCount >= 1
  'Dead Stock',    // StockIssueEventCount = 0, stock > 0
  'Stale'          // StockIssueEventCount = 0, stock = 0
]
```

#### Key File Locations

| File | Path |
|------|------|
| API Route | `Dashboard_Utama/app/api/reports/inventory/route.ts` |
| Report Viewer Client | `Dashboard_Utama/app/report-center/inventory/[report]/ReportViewerClient.tsx` |
| Report Config | `Dashboard_Utama/lib/reports/inventory/config.ts` |
| Movement Category Logic | `Dashboard_Utama/lib/reports/movement-category.ts` |
| Performance Helpers | `Dashboard_Utama/lib/reports/report-detail-performance.ts` |
| Filter Logic | `Dashboard_Utama/lib/reports/report-filtering.ts` |

#### Performance Constants

```typescript
TABLE_FIRST_LIMIT = 500
AI_PAYLOAD_MAX_ROWS = 50
AI_PAYLOAD_MAX_COLS = 40
MOVEMENT_THRESHOLD_FAST = 6
MOVEMENT_THRESHOLD_MOVING = 2
MOVEMENT_THRESHOLD_SLOW = 1
```

---

### 3.4 proxy-kerani-2026-05-30

**Tanggal:** 2026-05-30 | **Type:** Lite-Plan | **Exploration**

#### Location
`D:\Gawean Rebinmas\Main Dashboard\.workflow\.lite-plan\proxy-kerani-2026-05-30\exploration-proxy-architecture.json`

#### Exploration Summary

Express gateway (`server.js`, port 3001) acts as single entry point combining Next.js dashboard (port 3000 embedded) dengan http-proxy-middleware untuk semua backend services.

#### Gateway Overview

| Property | Value |
|----------|-------|
| Entry Point | `http://localhost:3001` |
| Technology Stack | Express.js, http-proxy-middleware, Next.js 16, Bun/Node.js |
| Server File | `D:/Gawean Rebinmas/Main Dashboard/server.js` |
| Config File | `D:/Gawean Rebinmas/Main Dashboard/routes-config.json` |
| Hot Reload | Yes — fs.watchFile watches config files |
| Env Loading | NODE_ENV-driven: .env.development, .env.production, fallback .env |

#### All Routes in routes-config.json

| ID | Path | Target | Pattern |
|----|------|--------|---------|
| upah | /upah | localhost:8002 | content-rewrite |
| backend-upah | /backend/upah | localhost:8002 | passthrough API |
| absen | /absen | localhost:5176 | content-rewrite |
| monitoring-beras | /monitoring-beras | localhost:5177 | content-rewrite |
| query | /query | localhost:8001 | passthrough API (public) |
| file | /file | localhost:5178 | passthrough with path rewrite |
| ifess | /ifess | localhost:8003 | passthrough (public) |

#### Proxy Patterns

1. **content-rewrite** (`rewriteContent=true`)
   - Used by: /upah, /absen, /monitoring-beras
   - Behavior: Intercept HTML/JS/CSS, rewrite absolute URLs to proxy paths, inject base tag
   - Use case: Vite dev servers with absolute URLs

2. **passthrough** (`rewriteContent=false`)
   - Used by: /backend/upah, /query, /file, /ifess
   - Behavior: Direct HTTP pipe without response interception
   - Use case: API backends and pre-built apps with relative paths

#### Kerani Super App Integration Requirements

- **Current State:** No Kerani Super App service exists in the codebase
- **ifess Status:** Route /ifess -> localhost:8003 is configured but port 8003 has no running service
- **What Needs to Be Built:**
  1. Create Kerani Super App service on port 8003
  2. Update routes-config.json target if using different port
  3. If SPA with absolute URLs, set `rewriteContent: true`
  4. If API-only or relative paths, keep `rewriteContent: false`

---

## 4. Workflow Multi-CLI-Plan (Eksekusi)

### 4.1 2026-05-25-report-detail-summary-body-fix

**Tanggal:** 2026-05-25 | **Type:** Multi-CLI-Plan | **Status:** Completed

#### Location
`D:\Gawean Rebinmas\Main Dashboard\.workflow\.multi-cli-plan\2026-05-25-report-detail-summary-body-fix\`

#### Purpose
Full dataset aggregation untuk report detail summary/table totals dan corrected movement report body ordering.

#### Task Breakdown

| ID | Judul | Priority |
|----|-------|----------|
| IMPL-1 | Make Filtered Summary Full-Dataset | high |
| IMPL-2 | Make Table Summary Chips Use Full Summary | - |
| IMPL-3 | Reorder And Format Movement Report Body | - |
| IMPL-4 | Harden ItemType 4 Issue Source | - |
| IMPL-5 | Validation And Regression Gate | - |

#### File Terlibat

```
Dashboard_Utama/lib/reports/report-filtering.ts
Dashboard_Utama/lib/reports/report-detail-performance.ts
Dashboard_Utama/app/report-center/inventory/[report]/ReportViewerClient.tsx
Dashboard_Utama/app/api/reports/inventory/route.ts
Dashboard_Utama/lib/reports/inventory/config.ts
```

#### Verification Commands

```bash
npx tsx lib/reports/report-filtering.test.ts
npx tsx lib/reports/report-detail-performance.test.ts
npx tsx lib/reports/movement-category.test.ts
npx tsc --noEmit
npm run lint
```

#### Key Artifacts

- `context-findings.md` - Context findings dari CLI analysis
- `EXECUTION_SUMMARY.md` - Ringkasan eksekusi
- `session-state.json` - State persistensi session

---

## 5. Referensi Cepat

### 5.1 File Path Absolut Lengkap

#### Active Workflows

| Workflow | Plan Path |
|----------|-----------|
| WFS-report-detail-table-body-performance | `D:\Gawean Rebinmas\Main Dashboard\.workflow\active\WFS-report-detail-table-body-performance\plan.json` |
| WFS-fix-report-group-movement-category | `D:\Gawean Rebinmas\Main Dashboard\.workflow\active\WFS-fix-report-group-movement-category\plan.json` |
| WFS-report-detail-summary-body-fix | `D:\Gawean Rebinmas\Main Dashboard\.workflow\active\WFS-report-detail-summary-body-fix\planning-notes.md` |
| WFS-fix-root-landing-page-reference | `D:\Gawean Rebinmas\Main Dashboard\.workflow\active\WFS-fix-root-landing-page-reference\plan.json` |
| WFS-report-detail-fullscreen-readability | `D:\Gawean Rebinmas\Main Dashboard\.workflow\active\WFS-report-detail-fullscreen-readability\plan.json` |
| WFS-landing-page-reference-only | `D:\Gawean Rebinmas\Main Dashboard\.workflow\active\WFS-landing-page-reference-only\plan.json` |

#### Lite-Plan Workflows

| Workflow | Path |
|----------|------|
| bugfix-movementcategory-kpi-2026-05-23 | `D:\Gawean Rebinmas\Main Dashboard\.workflow\.lite-plan\bugfix-movementcategory-kpi-2026-05-23\` |
| prd-all-stock-movement-analysis-2026-05-26 | `D:\Gawean Rebinmas\Main Dashboard\.workflow\.lite-plan\prd-all-stock-movement-analysis-2026-05-26\` |
| report-detail-context-2026-05-26 | `D:\Gawean Rebinmas\Main Dashboard\.workflow\.lite-plan\report-detail-context-2026-05-26\` |
| proxy-kerani-2026-05-30 | `D:\Gawean Rebinmas\Main Dashboard\.workflow\.lite-plan\proxy-kerani-2026-05-30\` |

#### Multi-CLI-Plan Workflows

| Workflow | Path |
|----------|------|
| 2026-05-25-report-detail-summary-body-fix | `D:\Gawean Rebinmas\Main Dashboard\.workflow\.multi-cli-plan\2026-05-25-report-detail-summary-body-fix\` |

### 5.2 Common Verification Commands

```bash
# Run movement category tests
npx tsx lib/reports/movement-category.test.ts

# Run report filtering tests
npx tsx lib/reports/report-filtering.test.ts

# Run report detail performance tests
npx tsx lib/reports/report-detail-performance.test.ts

# TypeScript validation
npx tsc --noEmit

# ESLint
npm run lint

# From Dashboard_Utama directory
cd Dashboard_Utama && npm run dev
```

### 5.3 Key Database Information

| Database | Profile | Used For |
|----------|---------|----------|
| `db_ptrj` | SERVER_PROFILE_2 | Estate / Kebun inventory |
| `db_ptrj_mill` | SERVER_PROFILE_3 | Pabrik / Mill inventory |

### 5.4 Important Code Locations

| Location | Role |
|----------|------|
| `route.ts:1316` | Root cause ItemType filter di issue_docs CTE |
| `route.ts:1330` | Workshop branch filter type='4' — benar |
| `route.ts:453-501` | stockMovementAnalysisColumns — MovementCategory CASE |
| `route.ts:1496-1535` | Summary query — ALL rows tanpa TOP N |
| `ReportViewerClient.tsx:663-672` | categoryCard — summary-first, tidak perlu ubah |

---

## Changelog

| Tanggal | Deskripsi |
|---------|-----------|
| 2026-06-10 | Initial creation — semua workflow di-dokumentasikan |

---

*Generated from `.workflow/` directory analysis*