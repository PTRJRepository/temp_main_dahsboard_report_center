# Report Center — Complete Documentation

## Table of Contents

1. [Page Architecture & URL Structure](#1-page-architecture--url-structure)
2. [Shell Layout (`ReportCenterShell`)](#2-shell-layout-reportcentershell)
3. [Dashboard Root (`/report-center`)](#3-dashboard-root-report-center)
4. [Module Detail Page (`/[module]`)](#4-module-detail-page-module)
5. [Procurement Workspace (`/report-center/procurement`)](#5-procurement-workspace-report-centerprocurement)
6. [Inventory Page (`/report-center/inventory`)](#6-inventory-page-report-centerinventory)
7. [Inventory Reports Client — The Catalog Browser](#7-inventory-reports-client--the-catalog-browser)
8. [Report Viewer — The Detail Page](#8-report-viewer--the-detail-page)
9. [All UI Components](#9-all-ui-components)
10. [All Live Reports](#10-all-live-reports)
11. [Filter System](#11-filter-system)
12. [AI Layer](#12-ai-layer)
13. [Export System](#13-export-system)
14. [Theme & Design Tokens](#14-theme--design-tokens)

---

## 1. Page Architecture & URL Structure

```
/report-center
├── ?source=estate|pabrik
│
├── /report-center/[module]
│   ├── /report-center/inventory         ← redirects to /procurement
│   ├── /report-center/forest
│   └── (other modules)
│       ?source=estate|pabrik
│
├── /report-center/procurement           ← main workspace
│   ?source=estate|pabrik
│   &stockGroup=inventory|gudang|workshop|process
│
└── /report-center/inventory/[report]   ← report detail viewer
    ?source=estate|pabrik
    &stage=&report=&search=&stale=...
    &groupBy=&chartDimension=&period=
    &movementWindow=&stockAnalysis=...
```

### Navigation Hierarchy

```
Sidebar (always visible)
└── Report Center
    ├── Dashboard       → /report-center
    ├── Inventory       → /report-center/inventory (redirects → /procurement)
    └── [other modules] → /report-center/[module]
```

---

## 2. Shell Layout (`ReportCenterShell`)

**File:** `app/(report-center)/report-center/ReportCenterShell.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar (collapsed/expanded)  │  Topbar                   │
│                                │  ┌─────────────────────┐   │
│  [Dashboard]                   │  │ breadcrumb + user   │   │
│  [Report Center]  ● active     │  └─────────────────────┘   │
│  [Inventory]                   │                            │
│  [Forest]                      │  <motion.main>              │
│  ...                           │    radial-gradient overlay   │
│                                │    ┌─────────────────┐      │
│                                │    │  children        │      │
│                                │    │  (page content)  │      │
│                                │    └─────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**Key features:**
- Full-height `h-screen overflow-hidden` flex container
- `pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_0%,rgba(16,185,129,0.11),transparent_28rem)]` — subtle green radial glow in top-right corner
- `framer-motion` entrance animation (`opacity 0→1, y 8→0, duration 0.2s`)
- Two themes controlled by `NEXT_PUBLIC_REPORT_CENTER_THEME_V2`:
  - **Default dark:** `report-center-dark rc-shell` + `--rc-bg`, `--rc-text` CSS vars
  - **Forest theme:** `report-center-forest` class adds `--rc-forest-*` vars (emerald accent, warm amber)

---

## 3. Dashboard Root (`/report-center`)

**File:** `app/(report-center)/report-center/page.tsx`

Simply renders `<ReportCenterPage />` (a separate root component in `components/`).

**Purpose:** The top-level report center landing — shows module cards, global KPI summary, and navigation to sub-modules.

---

## 4. Module Detail Page (`/[module]`)

**File:** `app/(report-center)/report-center/[module]/page.tsx`

```
┌──────────────────────────────────────────────────────────────────────┐
│  Breadcrumb: Dashboard / ModuleName                                   │
│                                                                      │
│  ┌──────────────────────────────┐  ┌───────────┐ ┌───────────┐       │
│  │ MODULE WORKSPACE             │  │ Sub-modul │ │  Report  │       │
│  │ Module Name                  │  │   3       │ │   17     │       │
│  │ Module description text...   │  └───────────┘ └───────────┘       │
│  └──────────────────────────────┘                                    │
│                                                                      │
│  SUB-MODULE MAP                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐  │
│  │ [icon]   3  │ │ [icon]   5  │ │ [icon]   2  │ │ [icon] 7  │  │
│  │ SubMod A     │ │ SubMod B     │ │ SubMod C     │ │ SubMod D  │  │
│  │ desc...      │ │ desc...      │ │ desc...      │ │ desc...   │  │
│  │ Buka sub-mod→│ │ Buka sub-mod→│ │ Buka sub-mod→│ │ Preview   │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘  │
│                                                                      │
│  REPORT LIST                                                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐        │
│  │ [icon] Live     │ │ [icon] Live     │ │ [icon] Preview  │        │
│  │ Report Title A  │ │ Report Title B  │ │ Report Title C  │        │
│  │ Business group  │ │ Business group  │ │ Business group  │        │
│  │ Buka report →   │ │ Buka report →   │ │ Preview         │        │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘        │
└──────────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- `module === 'inventory'` → redirects to `/report-center/procurement`
- `module === 'procurement'` → renders `ProcurementModuleWorkspace` directly (bypasses the generic layout)
- Other modules → renders generic module panel via `getModulePanel(module, source)`

**Sub-module cards:** Each card links to `subModule.href` or shows as disabled preview.
**Report cards:** Each card links to `report.href` or shows as disabled preview.

---

## 5. Procurement Workspace (`/report-center/procurement`)

**File:** `components/report-center/ProcurementModuleWorkspace.tsx`

This is the **primary entry point** for inventory. `inventory/page.tsx` redirects here.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [bg: radial-gradient circle + blur orbs — forest theme hero]          │
│                                                                         │
│  ┌─────────────────────────────────────┐  ┌──────────────────────────┐ │
│  │ PROCUREMENT CONTROL TOWER           │  │ Active source: Estate    │ │
│  │                                     │  │ [Estate] [Pabrik]        │ │
│  │ Procurement global: Inventory dan    │  │                          │ │
│  │ proses dalam satu layar.           │  │ Workspace scope:         │ │
│  │                                     │  │ 12 live │ 8 stock │ 9   │ │
│  │ [← Dashboard] [Buka inventory →]   │  │                          │ │
│  └─────────────────────────────────────┘  └──────────────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ProcurementKpiStrip — 5 KPI tiles:                              │   │
│  │ [Stock Value] [Asset List] [Receive Activity] [PR/PO Process]   │   │
│  │ [Movement Category] [Workshop Usage]                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ InventoryOverview — movement analysis + breakdown charts         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  AREA KERJA  [Semua] [Gudang] [Workshop] [Ordering]                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ InventoryReportsClient (embedded, no outer chrome)               │   │
│  │ OR: Process cards (PR, PO, GR, etc.) when tab = "Ordering"       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────┐  ┌───────────────────────────────┐    │
│  │ PROCUREMENT PROCESS MAP      │  │ HOW TO READ THIS MODULE      │    │
│  │ [1] PR Request               │  │ Mulai dari KPI, lalu drill.  │    │
│  │ [2] Purchase Order           │  │                               │    │
│  │ [3] Goods Receiving          │  │ Inventory = master stock      │    │
│  │ [4] Stock Movement           │  │ Gudang/Workshop = split       │    │
│  │ [5] Usage & Cost Center      │  │ Process = procurement flow    │    │
│  │ [6] Final Stock Position     │  │                               │    │
│  │ [7] Audit & Quality          │  │ [Lihat movement category →]   │    │
│  └──────────────────────────────┘  └───────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### ProcurementKpiStrip

**File:** `components/report-center/ProcurementKpiStrip.tsx`

6 KPI tiles in responsive grid:
1. **Stock Value** — links to `asset-stock-valuasi-listing`
2. **Asset List** — links to `stok-gudang`
3. **Receive Activity** — links to `goods-receiving-receipt-activity`
4. **PR/PO Process** — links to `purchase-request-inventory`
5. **Movement Category** — links to `all-stock-movement-analysis` grouped by `MovementCategory`
6. **Workshop Usage** — links to `vehicle-running-workshop`

Each tile shows: label, current value, trend delta, sparkline, source badge, and action button.

### InventoryOverview

**File:** `components/report-center/InventoryOverview.tsx`

Shows:
- **Movement composition:** breakdown by `MovementCategory` (Fast Moving / Moving / Slow Moving / Dead Stock / Stale)
- **Stock breakdown:** Gudang vs Workshop stock values
- **Period selector:** monthly period picker
- **Movement window:** 1m / 3m / 6m / 12m / all period
- **Scope controls:** ItemType filter (gudang / workshop / all)

### ProcurementWorkspace — Process Tab

When `stockGroup=process`, shows 6 ordering cards:
- **PR & Outstanding** — Purchase Request belum terlaksana
- **PO & On Order** — Purchase Order masih outstanding
- **Goods Receiving** — Receive activity dari supplier
- **Supplier Performance** — Kualitas dan lead time supplier
- **Transfer Gudang** — Perpindahan antar gudang
- **Closing Inventory** — Ringkasan bulanan

Each card shows: priority badge (critical/high/medium), cadence (Harian/Bulanan), signal text, owner, and a link to the report detail.

---

## 6. Inventory Page (`/report-center/inventory`)

**File:** `app/(report-center)/report-center/inventory/page.tsx`

```
redirect(`/report-center/procurement?source=${source}&stockGroup=${stockGroup}`)
```

**Purpose:** Acts as an alias that always redirects to the procurement workspace with the correct stock group.

`stockGroup` derivation from query params:
- `itemType=gudang` → `stockGroup=gudang`
- `itemType=workshop` → `stockGroup=workshop`
- `stockGroup=inventory|gudang|workshop|process` → pass through
- Default → `stockGroup=inventory`

---

## 7. Inventory Reports Client — The Catalog Browser

**File:** `app/(report-center)/report-center/inventory/InventoryReportsClient.tsx` (2,412 lines)

This is the **core catalog UI**. Renders in two modes:
- **Standalone** (`embedded=false`): Full page with header, breadcrumbs, KPI row
- **Embedded** (`embedded=true`): No outer chrome — embedded inside `ProcurementModuleWorkspace`

### 7.1 Central Filter Hub (always visible)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Filter Pusat                                                        │
│  ┌──────────────────────────────────┐  [Estate ▼]  [Group ▼]  [Flow▼] │
│  │ 🔍 Cari report: PO, supplier...  │                                  │
│  └──────────────────────────────────┘                                  │
│                                                                         │
│  [Quick Jump: Report ▼]  [Open ▶]  [Month ▼]  [GroupBy ▼]  [Window▼] │
│  [StockAnalysis ▼ or MovementCategory ▼ or scope input]  [Stale filter] │
└─────────────────────────────────────────────────────────────────────────┘
```

Filter bar has **2 rows**:
- **Row 1:** Search + Source selector + Report Group selector + Flow Stage selector
- **Row 2:** Quick report jump + Open button + Period (month picker) + Group By selector + Movement Window + Reset

All filters sync to URL query params. Changing any filter updates URL via `router.replace()` without page reload.

### 7.2 KPI Row

4 tiles showing current state:
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Reports shown│ │ Active source│ │ Current scope│ │ Selected    │
│ 12 dari 17   │ │ Estate       │ │ StockAnalysis│ │ stok-gudang │
│ · Stage All  │ │ db_ptrj      │ │ DEADS · 3m  │ │ INV-01 ·Live│
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

### 7.3 Report Catalog — Grouped by Business Group

Reports grouped by `groupTitle` (e.g., "Executive Inventory Position", "Master Data & Quality"). Each group is a collapsible section:

```
┌──────────────────────────────────────────────────────────────────┐
│  BUSINESS GROUP TITLE                            3 report       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ [color bar top]  │  │                  │  │               │  │
│  │ [Stage badge]    │  │                  │  │               │  │
│  │ [DB badge]      │  │                  │  │               │  │
│  │ [Status badge]  │  │                  │  │               │  │
│  │ INV-01 / Title  │  │                  │  │               │  │
│  │ description...  │  │                  │  │               │  │
│  │ [Cadence] [Owner]  │                  │  │               │  │
│  │ [tag] [tag] [n pertanyaan AI]        │  │               │  │
│  │ [★] [Preview] [XLS] [PDF]           │  │               │  │
│  │      [Buka Report ▶]                │  │               │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**ReportTile states:**
- **Live + openable:** Full green CTA "Buka Report" + all export buttons active
- **Live but not openable:** Export buttons disabled, only "Catalog Preview"
- **Preview/Mapping/Planned:** Grayed out, no live data link

### 7.4 Preview Panel (selected report)

Below the catalog grid, always shows the **currently selected report** in detail:

```
┌──────────────────────────────────────────────────────────────────┐
│  Stage | Status | Owner | Cadence (4 MiniTiles)                 │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ PREVIEW CATALOG                                              │  │
│ │ [Title]                                     [Live badge]     │  │
│ │ Business purpose text...                                     │  │
│ │                                                              │  │
│ │ CATEGORY LABEL                                               │  │
│ │ Full Report Name                                             │  │
│ │ Full description...                                          │  │
│ │                                                              │  │
│ │ Report Code         Last Updated                             │  │
│ │ INV-01              Live query                                │  │
│ │                                                              │  │
│ │ SOURCE DATABASE                                               │  │
│ │ Source | Server | Open Full Report | Read-only safety        │  │
│ │                                                              │  │
│ │ [tag] [tag] [tag]                                           │  │
│ │                                                              │  │
│ │ PERTANYAAN UNTUK AI                                          │  │
│ │ ┌─ Question 1 ──────────────────────────────────────────┐    │  │
│ │ └─ Question 2 ──────────────────────────────────────────┘    │  │
│ │                                                              │  │
│ │ [Summary entries — when payload loaded]                      │  │
│ │ [Live Preview Table — first 5 rows]                         │  │
│ │ [Sample Chart bars]                                         │  │
│ │                                                              │  │
│ │ [Preview] [Buka] [Excel] [PDF]                             │  │
│ └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 7.5 AI Insights Toggle

When "Show insights" is clicked, reveals two-column layout:
- **Left:** `AIInsightTile` — question selector + AI-generated answer panels (Summary, Trend, Risk/Outlier, Action, Data Quality)
- **Right:** `AiDynamicDashboard` — auto-generated charts, KPI cards, priority tables from the live payload

---

## 8. Report Viewer — The Detail Page

**File:** `app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx`

Route: `/report-center/inventory/[report]?source=&stage=&report=&groupBy=&period=&movementWindow=...`

This is the **full report viewer** — not the catalog browser, but the actual data view.

### 8.1 Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Breadcrumb: Dashboard / Procurement / Inventory / Report Name      │
│  [← Kembali ke Procurement]                                         │
│                                                                     │
│  ┌─────────────────────────────────────────────┐ ┌───────────────┐ │
│  │ Report Title                                 │ │ Source badge  │ │
│  │ Description text                            │ │ [Estate]      │ │
│  └─────────────────────────────────────────────┘ └───────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Command Bar: [Group By ▼] [Period ▼] [Movement Window ▼]      │  │
│  │             [Search...] [Columns ▼] [Density] [AI] [Export ▼] │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ KPI Strip (ReportKpiCards — 4-6 tiles)                       │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ [AI Analysis Band] (collapsible)                              │  │
│  │ ┌─────────────────┐ ┌─────────────────┐ ┌──────────────────┐  │  │
│  │ │ Tab: AI        │ │ Charts          │ │ Quality          │  │  │
│  │ │ [AI Insight]   │ │ [Bar charts]    │ │ [Data quality]   │  │  │
│  │ ├─────────────────┤ ├─────────────────┤ ├──────────────────┤  │  │
│  │ │ Metadata        │ │ Recommendations │ │ SQL              │  │  │
│  │ │ [debug info]    │ │ [suggestions]   │ │ [sql statements] │  │  │
│  │ └─────────────────┘ └─────────────────┘ └──────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Report Table (virtualized with @tanstack/react-virtual)      │  │
│  │ ┌──────────────────────────────────────────────────────────┐  │  │
│  │ │ Col1  Col2  Col3  Col4  Col5  Col6  Col7  Col8  Col9  →│  │  │
│  │ ├──────────────────────────────────────────────────────────┤  │  │
│  │ │ data  data  data  data  data  data  data  data  data     │  │  │
│  │ │ data  data  data  data  data  data  data  data  data     │  │  │
│  │ │ ...virtualized (renders only visible rows)...            │  │  │
│  │ └──────────────────────────────────────────────────────────┘  │  │
│  │ Showing 1–50 of 1,234 rows  [Load more]                      │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 ReportViewerProfile

Each report has a **profile** that defines how the viewer behaves:

```typescript
type ReportViewerProfile = {
  reportIds?: Set<string>           // which reports use this profile
  businessColumns?: string[]        // columns shown in default view
  fallbackColumns?: string[]        // columns if businessColumns unavailable
  technicalColumns?: Set<string>    // system columns to always show
  tableContextColumns?: string[]    // extra context columns (movement category, etc.)
  manualFilterColumns?: string[]    // columns with manual filter UI
  presets: ReportPreset[]            // predefined filter combinations
  kpiPresetByLabel?: Record<string, string>
  preferredGroupColumns: string[]   // default grouping columns
  loadAllRows?: boolean             // true = load all (no virtual window)
  maxInitialColumns?: number        // cap on default column set
  showAccountingPeriodFilter?: boolean
  naturalPlaceholder: string         // placeholder for AI natural filter input
  presetTitle: string
  rowDetail: 'generic' | 'movement'
  topRowsTitle: string
  defaultSort?: (columns: string[]) => { column: string; direction: 'asc'|'desc' } | null
  kpiBuilder: (payload: ReportPayload, filters?: ReportFilterInput) => ReportKpiCard[]
  qualityBuilder: (payload: ReportPayload | null, rows: DbRow[]) => Array<[string, unknown]>
  topRowsBuilder: (rows: DbRow[]) => DbRow[]
}
```

### 8.3 Report Analysis Band (tabs)

**File:** `components/report-center/ReportAnalysisBand.tsx`

Six tabs:
| Tab | Content |
|-----|---------|
| **AI** | AI-generated insight from live payload (via `/api/reports/ai-insight`) |
| **Charts** | Auto-generated bar/donut/line charts from payload |
| **Quality** | Data quality indicators: missing fields, null counts, staleness flags |
| **Metadata** | SQL debug info, server, database, execution time, row count |
| **Recommendations** | Suggested next steps based on the data |
| **SQL** | Actual SQL statements executed (read-only) |

### 8.4 Report Question Panel

**File:** `components/report-center/ReportQuestionPanel.tsx`

Allows users to ask natural-language questions about the current report data. Sends question + payload to AI and returns formatted answer.

---

## 9. All UI Components

### In `components/report-center/`

| Component | Purpose |
|-----------|---------|
| `ProcurementModuleWorkspace.tsx` | Main procurement page shell with KPI strip, inventory overview, process tabs |
| `ProcurementKpiStrip.tsx` | 6 KPI tiles: Stock Value, Asset List, Receive Activity, PR/PO Process, Movement Category, Workshop Usage |
| `InventoryOverview.tsx` | Movement composition + stock breakdown charts with period/window controls |
| `ReportCommandBar.tsx` | Command bar for report viewer: groupBy, period, search, column visibility, density, AI, export |
| `ReportStatePanel.tsx` | State display for the report (loading, error, empty, success) |
| `ReportWorkspaceFrame.tsx` | Generic frame wrapper with consistent border/padding |
| `GlobalModuleNavigator.tsx` | Navigation component for switching between modules |
| `MovementComposition.tsx` | Movement category breakdown with 3 view modes: list (bar progress), horizontal bar chart, donut chart. Click any segment to filter items. Same 5 categories: Fast/Moving/Slow/Dead/Stale. Uses `movementWindow` to define the lookback period. |
| `ExceptionQueue.tsx` | Shows data quality exceptions and anomalies |
| `AnalyticsKpiStrip.tsx` | Generic analytics KPI strip (alternative to ProcurementKpiStrip) |
| `InventoryOverview.test.tsx` | Unit tests for InventoryOverview |
| `ReportAnalysisBand.tsx` | Tabbed analysis band (AI/Charts/Quality/Metadata/Recommendations/SQL) |
| `ReportQuestionPanel.tsx` | Natural language question input for AI analysis |

### In `components/report/`

| Component | Purpose |
|-----------|---------|
| `AiDynamicDashboard.tsx` | Auto-generated dashboard from report payload — charts, KPI cards, priority table |

---

## 10. All Live Reports

**Source:** `lib/reports/inventory/config.ts` + `lib/reports/inventory/config.ts` (live reports defined in both)

### 10.1 Report ID → Code Mapping

| Report ID | Code | Title | Group | Status | Flow Stage |
|-----------|------|-------|-------|--------|------------|
| `stok-gudang` | INV-01 | Posisi Stok & Nilai Inventory | Executive Inventory Position | live | valuation |
| `asset-stock-valuasi-listing` | INV-02 | Asset Stock Valuasi | Executive Inventory Position | live | valuation |
| `item-movement-update-tracking` | INV-03 | Item Movement Update Tracking | Master Data & Quality | live | audit |
| `movement-stock` | INV-04 | Pergerakan Stok Masuk & Keluar | Mutasi & Transaksi | live | movement |
| `pengeluaran-barang` | INV-05 | Pemakaian Barang Operasional | Mutasi & Transaksi | live | usage |
| `goods-receiving-receipt-activity` | INV-06 | Goods Receiving Receipt Activity | Purchasing & Supplier Linkage | live | receive |
| `purchase-request-inventory` | INV-07 | Purchase Request Inventory | Purchasing & Supplier Linkage | live | request |
| `transfer-antar-gudang` | INV-08 | Transfer Antar Gudang | Mutasi & Transaksi | live | movement |
| `stock-opname` | INV-09 | Stock Opname | Kontrol & Audit | live | adjustment |
| `fuel-usage` | INV-10 | Pemakaian BBM Kendaraan & Operasional | Fuel Inventory | live | usage |
| `riwayat-transaksi` | INV-11 | Riwayat Transaksi | Master Data & Quality | live | audit |
| `return-barang` | INV-12 | Return Barang | Purchasing & Supplier Linkage | live | return |
| `item-stale-update` | INV-13 | Item Stale Update | Item Aging & Update Quality | live | audit |
| `purchase-order-history` | INV-14 | Purchase Order History | Purchasing & Supplier Linkage | live | purchase_order |
| `supplier-purchasing-performance` | INV-15 | Supplier Purchasing Performance | Purchasing & Supplier Linkage | live | purchase_order |
| `pupuk-stock-procurement` | INV-16 | Pupuk Stock Procurement | Pupuk & Material Estate | live | final_stock |
| `vehicle-running-workshop` | INV-17 | Vehicle Running Workshop | Vehicle Running & Workshop | live | usage |

### 10.2 Flow Stages (13 stages)

```
Request → Purchase Order → In Transit → Receive → Placement
→ Movement → Usage → Return → Adjustment → Closing
→ Final Stock → Valuation → Audit
```

**Live stages:** movement, usage, final_stock, valuation, audit, receive, request, purchase_order, return
**Planned stages:** in_transit, placement, adjustment, closing

### 10.3 Report Status Types

| Status | Badge Color | Meaning |
|--------|-------------|---------|
| `live` | Emerald border+bg | Query is live, data available |
| `preview` | Cyan border+bg | Preview only, not fully implemented |
| `mapping_db` | Amber border+bg | DB mapping in progress |
| `need_validation` | Yellow border+bg | Needs user validation |
| `planned` | Gray border+bg | Planned but not started |

### 10.4 Movement Category Classification

Derived from `StockIssueEventCount` (count of distinct issue dates):

| Category | Condition | Color |
|----------|-----------|-------|
| Fast Moving | `StockIssueEventCount >= 6` | Green |
| Moving | `StockIssueEventCount 2-5` | Blue |
| Slow Moving | `StockIssueEventCount = 1` | Yellow |
| Dead Stock | `StockIssueEventCount = 0 AND QtyOnHand > 0` | Red |
| No Movement | `StockIssueEventCount = 0 AND QtyOnHand = 0` | Gray |

---

## 11. Filter System

### 11.1 Filter Input Types

```typescript
type ReportFilterInput = {
  stale?: string                    // for item-movement-update-tracking
  movementWindow?: '1m'|'3m'|'6m'|'12m'|'all'
  period?: string                   // YYYY-MM format (month picker)
  stockAnalysis?: string             // DEADS | MEMOV | SLMOV
  productType?: string
  productCategory?: string
  productBrand?: string
  productModel?: string
  productMaterial?: string
  movementCategory?: string         // Fast Moving | Moving | Slow Moving | Dead Stock | Stale
  groupBy?: InventoryAnalysisGroup  // dimension for grouping
  chartDimension?: InventoryAnalysisGroup
  itemType?: 'gudang' | 'workshop'
}
```

### 11.2 Natural Filter System

`/api/reports/natural-filter/route.ts` — accepts natural language input:

```
Input:  "barang yang stoknya di bawah 10 dan sudah 3 bulan tidak movement"
Output: { filters: { stockAnalysis: 'SLMOV', stale: 'dari-3-bulan-sampai-sekarang' }, ... }
```

Uses AI to parse Indonesian natural language into structured filters.

### 11.3 URL Sync

All filter changes write to URL via `router.replace()`:
- Page load reads URL params to restore state
- `lastSyncedSearchRef` prevents infinite loops
- `localStorage` (`report-center:last-source`) persists source preference

---

## 12. AI Layer

### 12.1 AI Insight (`/api/reports/ai-insight`)

Sends to AI:
```typescript
{
  title: "INV-01 - Stok Gudang",
  context: {
    moduleId, moduleName,
    reportName, reportDescription,
    dataSource,
    analysisQuestion,
    analysisQuestions[],
    summary: payload.summary,
    metadata: payload.metadata,
    sampleRows: payload.rows.slice(0, 8),
    chart: payload.chart.slice(0, 8),
    alerts: [businessPurpose],
  },
  fallbackInsight: { ... }
}
```

Returns:
```typescript
{
  summary: string,
  trendDetection: string,
  anomalyDetection: string,
  recommendation: string,
  dataQualityNote: string
}
```

**Key principle:** AI reads the **payload** (result of existing query). It does NOT run new SQL queries — safe, predictable, explainable.

### 12.2 AI Dynamic Dashboard (`/api/reports/[reportCode]/ai-analysis`)

Generates an `AiDashboardDefinition`:
- Up to 5 charts (bar, line, donut, ranking, quality, route)
- Priority table (top rows by metric)
- Missing fields analysis

### 12.3 AI Question Bank

Each report has 4 pre-defined questions (stored in `REPORT_ANALYSIS_QUESTIONS` map). Example:

```typescript
// For INV-01 (stok-gudang):
[
  "Product type mana yang paling besar membawa total_amount asset stock?",
  "Item apa yang paling material berdasarkan quantity_on_hand x unit_cost?",
  "Berapa item dengan quantity_on_hand nol atau unit_cost nol yang perlu direview?",
  "Apakah nilai workshop item mendominasi valuasi stock pabrik?"
]
```

---

## 13. Export System

### 13.1 Excel Export

```typescript
// Client-side using xlsx library
async function exportExcel(report, source, filters) {
  const payload = await fetchReport(report, source, 500, filters)
  const sheet = XLSX.utils.json_to_sheet(payload.rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, report.title.slice(0, 31))
  XLSX.writeFile(workbook, `${report.id}.xlsx`)
}
```

### 13.2 PDF Export

```typescript
// Client-side using jspdf (landscape, 6 columns max, 28 rows)
async function exportPdf(report, source, filters) {
  const payload = await fetchReport(report, source, 80, filters)
  const doc = new JsPDF({ orientation: 'landscape', unit: 'pt' })
  // ... renders title, description, column headers, rows
  doc.save(`${report.id}.pdf`)
}
```

**Note:** PDF caps at 6 columns (from `payload.columns.slice(0, 6)`) and 28 rows to stay on one page.

---

## 14. Theme & Design Tokens

### 14.1 CSS Variables

**Default dark theme (`--rc-*`):**
```css
--rc-bg: #0a0a0a;           /* background */
--rc-text: #f0f0f0;          /* primary text */
--rc-text-muted: #888888;    /* muted text */
--rc-text-faint: #555555;    /* faint text */
--rc-border: rgba(255,255,255,0.1);
--rc-border-strong: rgba(255,255,255,0.2);
```

**Forest theme (`--rc-forest-*`):**
```css
--rc-forest-bg: #030c07;           /* deep green-black */
--rc-forest-surface: #0a1a10;       /* card surface */
--rc-forest-surface-raised: #0f2015;
--rc-forest-border: rgba(52,211,153,0.2);
--rc-forest-border-strong: rgba(52,211,153,0.35);
--rc-forest-primary: #41e78b;        /* emerald green CTA */
--rc-forest-accent: #41e78b;         /* accent color */
--rc-forest-text: #f0f0f0;
```

**Status colors:**
```css
/* Live */
border-emerald-400/35 bg-emerald-400/12 text-emerald-200

/* Preview */
border-cyan-400/35 bg-cyan-400/12 text-cyan-200

/* Mapping DB */
border-amber-400/35 bg-amber-400/12 text-amber-200

/* Need Validation */
border-yellow-400/38 bg-yellow-400/12 text-yellow-100

/* Planned */
border-white/10 bg-white/5 text-gray-400
```

### 14.2 Animation & Motion

- **Page entrance:** `framer-motion` — `opacity 0→1, y 8→0, duration 0.2s easeOut`
- **Sidebar collapse:** `layout` animation via `key={collapsed?'collapsed':'expanded'`
- **Hover effects:** `hover:-translate-y-0.5` on cards, `hover:border-[var(--rc-forest-border-strong)]`
- **Loading skeletons:** `animate-pulse bg-white/[0.06]` rounded-2xl placeholders

### 14.3 Border Radius System

| Token | Usage |
|-------|-------|
| `rounded-[18px]` / `rounded-2xl` | Cards, panels |
| `rounded-[22px]` | Group sections |
| `rounded-[24px]` | Section containers |
| `rounded-[28px]` | Large section panels |
| `rounded-[34px]` | Hero section |

### 14.4 Component Patterns

**TileShell:** Base card component used throughout. Supports `active` prop for selected state.
```tsx
// Inactive: subtle border, hover lift
// Active: emerald left-border inset, green glow shadow
```

**StatusBadge:** Pill badge with status-based color classes.

**MiniTile:** Compact stat tile — label + value + icon, used in 4-column KPI rows.

**KpiTile:** Full KPI card — label + large value + context + basis + icon, used in 4-column KPI rows.

**WorkspaceTile:** Feature tile — icon + title + description + stage tags, used in 3-column workspace grid.

**FlowStageTile:** Horizontal scrollable stage button — icon + badge + title + count, used in filter bar.

---

## 15. Data Architecture

### 15.1 API Routes

| Route | Purpose | Auth |
|-------|---------|------|
| `/api/reports/inventory` | Fetch report data (procurement module) | via cookie |
| `/api/reports/[reportCode]/ai-analysis` | Generate AI dynamic dashboard | via cookie |
| `/api/reports/ai-insight` | Generate AI insight from payload | via cookie |
| `/api/reports/natural-filter` | Parse natural language → filters | via cookie |

### 15.2 Data Source Selection

- `source=estate` → `db_ptrj` via `SERVER_PROFILE_2`
- `source=pabrik` → `db_ptrj_mill` via `SERVER_PROFILE_3`

### 15.3 Report Payload Shape

```typescript
type ReportPayload = {
  title: string
  description: string
  rows: DbRow[]              // up to 25 rows for preview, 500 for export
  columns: string[]         // column names
  summary: DbRow             // aggregated totals
  chart: DbRow[]             // chart-ready aggregated data (top 8)
  metadata: DbRow            // server, database, execution info
  totalRows?: number         // total available rows
  analytics?: InventoryAnalyticsContract
}
```

### 15.4 Report Detail-Performance Layer

**File:** `lib/reports/report-detail-performance.ts`

Handles:
- `buildReportTableGroups` — grouping rows by dimension
- `buildReportTableRows` — applying grouping + sorting
- `buildReportSummaryTotals` — computing grand totals
- `selectSubtotalColumns` — picking which columns to show in subtotal rows
- `formatInventoryQuantityBreakdown` — formatting stock/qty/amount
- `normalizeReportTableWindow` — computing date windows
- `compactReportPayloadForAi` — stripping payload for AI context window

---

## 16. State Management

### 16.1 Report Store (`store/reportStore.ts`)

Uses Zustand. Persists across navigation:

```typescript
{
  sidebarCollapsed: boolean
  favorites: string[]           // report IDs favorited by user
  recent: string[]              // recently viewed report IDs
  toggleFavorite(id: string): void
  addRecent(id: string): void
}
```

### 16.2 Component State (InventoryReportsClient)

Local React state:
- `selectedSource` — estate | pabrik
- `selectedReportCode` — currently selected report
- `activeStage` — flow stage filter
- `activeReportGroup` — business group filter
- `search` — text search query
- `staleFilter` — stale movement window
- `movementWindowFilter` — movement calculation window
- `periodFilter` — monthly period
- `analysisGroup` — grouping dimension
- `scopeCode` — specific code filter
- `payload` — live report data
- `aiDashboard` — AI-generated dashboard definition
- `aiInsightVisible` — toggle AI insights panel
- `loading` / `error` — data fetch state

---

*Last updated: based on codebase at 2026-07-21*
*Primary source files:*
- `app/(report-center)/report-center/ReportCenterShell.tsx`
- `app/(report-center)/report-center/[module]/page.tsx`
- `app/(report-center)/report-center/inventory/page.tsx`
- `app/(report-center)/report-center/inventory/InventoryReportsClient.tsx`
- `app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx`
- `components/report-center/ProcurementModuleWorkspace.tsx`
- `components/report-center/ProcurementKpiStrip.tsx`
- `components/report-center/InventoryOverview.tsx`
- `components/report-center/ReportAnalysisBand.tsx`
- `components/report-center/ReportQuestionPanel.tsx`
- `components/report/AiDynamicDashboard.tsx`
- `lib/reports/inventory/config.ts`
- `lib/reports/module-panel.ts`
- `lib/reports/report-filtering.ts`
- `lib/reports/intelligence.ts`
- `lib/reports/report-detail-performance.ts`
