# Report System — Dokumentasi Teknis

**Project:** PT Rebinmas Jaya Main Dashboard  
**Updated:** 2026-06-12

---

## 1. Overview

Sistem Report adalah modul utama dashboard yang menyediakan **27+ laporan inventori kebun** untuk PT Rebinmas Jaya. Data berasal dari **MSSQL database** (SQL Server), diakses via `mssql` library melalui SQL Gateway (`/query` endpoint di port 8001).

**Report Center:** `http://localhost:3001/report-center`  
**Tech Stack:** Next.js App Router + MSSQL + React18 + Tailwind CSS  
**Database:** SQL Server (db_ptrj di 10.0.0.2:1888, db_ptrj_mill)

---

## 2. File Structure

```
Dashboard_Utama/
├── app/
│   ├── (report-center)/
│   │   ├── report-center/
│   │   │   ├── page.tsx              # Report center shell
│   │   │   ├── layout.tsx            # Layout with sidebar
│   │   │   ├── ReportCenterShell.tsx # Main shell component
│   │   │   ├── [module]/
│   │   │   │   ├── page.tsx         # Module page
│   │   │   │   └── ModuleToolbar.tsx # Toolbar per module
│   │   │   └── inventory/
│   │   │       ├── page.tsx         # Inventory module root
│   │   │       ├── InventoryReportsClient.tsx # Report list
│   │   │       └── [report]/
│   │   │           ├── page.tsx     # Report viewer page
│   │   │           └── ReportViewerClient.tsx # Generic viewer
│   │   └── modules/inventory/page.tsx
│   └── api/reports/
│       ├── inventory/route.ts       # Main report handler (large file)
│       ├── [reportCode]/ai-analysis/route.ts
│       ├── ai-insight/route.ts
│       ├── natural-filter/route.ts
│       └── system-status/route.ts
├── lib/reports/
│   ├── config.ts                     # Report metadata registry
│   ├── inventory/
│   │   ├── config.ts                # Inventory report config
│   │   └── monitoring.ts           # Monitoring helpers
│   ├── accounting-period.ts         # Period conversion logic
│   ├── accounting-period.test.ts    # Tests
│   ├── report-filtering.ts          # Filter helpers
│   ├── report-filtering.test.ts     # Tests
│   ├── movement-category.ts         # Fast/Moving/Slow/Dead stock
│   ├── movement-category.test.ts    # Tests
│   ├── report-detail-performance.ts # Performance tracking
│   ├── report-detail-performance.test.ts
│   ├── ai-dashboard.ts             # AI dashboard helpers
│   ├── intelligence.ts             # Intelligence widget
│   ├── monitoring.ts               # Monitoring helpers
│   ├── mock-data.ts               # Mock data for development
│   └── mock-data.ts
├── components/report/
│   ├── DataTable.tsx               # Generic data table
│   ├── ReportFilters.tsx           # Filter controls
│   ├── ReportHeader.tsx           # Report header
│   ├── ReportSummary.tsx          # Summary cards
│   ├── ReportActions.tsx          # Export, print actions
│   └── AiDynamicDashboard.tsx     # AI-powered dashboard
├── components/module/
│   ├── ModuleFilterRow.tsx
│   ├── ModuleHeader.tsx
│   ├── ModuleStatusBanner.tsx
│   ├── ModuleSummaryCards.tsx
│   ├── ReportListItem.tsx
│   ├── ReportPreviewPanel.tsx
│   └── reportTypes.ts
├── components/dashboard/
│   ├── AIInsightCard.tsx
│   ├── FavoritesPanel.tsx
│   ├── GlobalSearch.tsx
│   ├── MonitoringVisualSection.tsx
│   └── RecentPanel.tsx
└── store/reportStore.ts            # Zustand store
```

---

## 3. Report Categories (Groups A-H)

Reports dikelompokkan dalam 8 grup (A-H) berdasarkan jenis data:

| Group | Reports | Database |
|-------|---------|----------|
| **A** | Stock Overview | db_ptrj_mill |
| **B** | Stock Movement | db_ptrj_mill |
| **C** | Stock Aging | db_ptrj_mill |
| **D** | Asset Valuation | db_ptrj_mill |
| **E** | Estate Stock | db_ptrj |
| **F** | Mill Stock | db_ptrj_mill |
| **G** | Monitoring | db_ptrj |
| **H** | Fuel& General | db_ptrj |

---

## 4. Movement Category Logic

**Critical Business Logic** — klasifikasi stock berdasarkan `StockIssueEventCount`:

```typescript
// lib/reports/movement-category.ts
if (StockIssueEventCount >= 6) → "Fast Moving"
else if (StockIssueEventCount >= 2) → "Moving"
else if (StockIssueEventCount == 1) → "Slow Moving"
else if (StockIssueEventCount == 0 && stock > 0) → "Dead Stock"
else if (StockIssueEventCount == 0 && stock == 0) → "No Movement"
```

**StockIssueEventCount** = total stock issue events per item dalam periode tertentu.

---

## 5. Accounting Period System

```typescript
// lib/reports/accounting-period.ts
// Konversi period string → date range untuk SQL WHERE clause
// Format: "2026-01", "2026-Q1", "2026-01-01:2026-01-31"
```

**Period Types:**
- Monthly: `2026-01` → `2026-01-01` to `2026-01-31`
- Quarterly: `2026-Q1` → `2026-01-01` to `2026-03-31`
- Custom range: `2026-01-01:2026-01-31`

---

## 6. Report API

### GET /api/reports/inventory
Main report endpoint. Query params:

| Param | Type | Description |
|-------|------|-------------|
| `reportCode` | string | Report identifier (e.g., `all-stock-movement-analysis`) |
| `limit` | number | Row limit (default: 500) |
| `limitAll` | boolean | Return all rows (bypass limit) |
| `search` | string | Text search filter |
| `source` | string | `pabrik` (db_ptrj_mill) or `estate` (db_ptrj) |
| `filters` | JSON | Filter object |

**Response:**
```typescript
interface ReportPayload {
  data: Record<string, any>[];
  metadata: {
    totalRows: number;
    columns: ColumnDef[];
    reportCode: string;
    reportName: string;
    source: string;
    paginated?: boolean;
    [key: string]: any;
  };
}
```

### POST /api/reports/[reportCode]/ai-analysis
AI-powered analysis untuk report tertentu.

### GET /api/reports/system-status
System health check endpoint.

### POST /api/reports/natural-filter
Natural language filter parsing.

---

## 7. Report Handler Architecture

All inventory report handlers terdaftar di `app/api/reports/inventory/route.ts` sebagai async functions. Each handler accepts:

```typescript
async function handler({
  limit,       // Row limit (default 500)
  limitAll,    // Return all rows
  search,      // Text search
  ctx,         // QueryContext { database, accountPeriod, filters }
  filters // Filter object
}): Promise<ReportPayload>
```

**Data Source Switching:**
```typescript
ctx.database === 'db_ptrj_mill'  // source=pabrik (mill)
ctx.database === 'db_ptrj'       // source=estate (estate)
```

---

## 8. Report Configuration

### lib/reports/inventory/config.ts
Mendefinisikan metadata setiap report:
```typescript
{
  id: string; // Report code (kebab-case)
  name: string;        // Display name
  group: string;       // A-H
  tags: string[];      // Searchable tags
  sourceTables: string[]; // DB tables used
  availableFilters: FilterDef[]; // Available filters
  chartDefinitions: ChartDef[];  // Chart configs
  defaultSort: { column: string; direction: 'asc' | 'desc' };
 initialColumns?: string[]; // Default visible columns
}
```

---

## 9. ReportViewerClient — Generic Viewer

`app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx` adalah viewer generik yang merender semua inventory report. Memiliki profile-specific configurations:

```typescript
const MOVEMENT_ANALYSIS_REPORT_IDS = [...];   // Fast/Moving/Slow/Dead
const STOCK_AGING_REPORT_IDS = [...];          // Aging reports
const ASSET_VALUATION_REPORT_IDS = [...];     // Asset valuation
```

**Features:**
- Client-side pagination (jika `metadata.paginated` tidak set)
- Initial load: 500 rows (`TABLE_FIRST_LIMIT`)
- Filter row dengan `ModuleFilterRow`
- Export: CSV, Excel, Print
- AI Insight card (jika report support)

---

## 10. Report Filtering Helpers

### lib/reports/report-filtering.ts
```typescript
sanitizeLike(input: string): string         // Escape SQL LIKE chars
textSearch(columns: string[], value: string): string  // Build LIKE clause
stockIssueUsageApply(query: string, filters: FilterMap): string
warehouseInventoryItemTypeExpression(type: string): string
resolveAssetValuationPeriod(filters: FilterMap): string
```

---

## 11. Key SQL Patterns

### Safe SQL via validateReadOnlySql
Semua query harus di-validasi sebelum eksekusi untuk mencegah SQL injection.

### Movement Category in SQL
```sql
CASE
 WHEN StockIssueEventCount >= 6 THEN 'Fast Moving'
  WHEN StockIssueEventCount >= 2 THEN 'Moving'
  WHEN StockIssueEventCount = 1 THEN 'Slow Moving'
  WHEN StockIssueEventCount = 0 AND stock > 0 THEN 'Dead Stock'
  ELSE 'No Movement'
END AS MovementCategory
```

---

## 12. Development& Testing

```bash
# Run report handler
npx tsx lib/reports/accounting-period.test.ts
npx tsx lib/reports/movement-category.test.ts
npx tsx lib/reports/report-filtering.test.ts
npx tsx lib/reports/report-detail-performance.test.ts

# TypeScript validation
npx tsc --noEmit

# ESLint
npm run lint
```

---

## 13. Report List (27 Reports)

| # | Report ID | Name | Group | Source |
|---|-----------|------|-------|--------|
| 1 | all-stock-movement-analysis | All Stock Movement Analysis | A | pabrik |
| 2 | stock-card | Stock Card | A | pabrik |
| 3 | stock-summary | Stock Summary | A | pabrik |
| 4 | current-stock | Current Stock | A | pabrik |
| 5 | fast-moving-stock | Fast Moving Stock | B | pabrik |
| 6 | moving-stock | Moving Stock | B | pabrik |
| 7 | slow-moving-stock | Slow Moving Stock | B | pabrik |
| 8 | dead-stock | Dead Stock | B | pabrik |
| 9 | no-movement-stock | No Movement Stock | B | pabrik |
| 10 | stock-aging-detail | Stock Aging Detail | C | pabrik |
| 11 | stock-aging-summary | Stock Aging Summary | C | pabrik |
| 12 | asset-valuation-current | Asset Valuation (Current) | D | pabrik |
| 13 | asset-valuation-historical | Asset Valuation (Historical) | D | pabrik |
| 14 | estate-stock-location | Estate Stock by Location | E | estate |
| 15 | estate-stock-category | Estate Stock by Category | E | estate |
| 16 | estate-stock-supplier | Estate Stock by Supplier | E | estate |
| 17 | mill-stock-location | Mill Stock by Location | F | pabrik |
| 18 | mill-stock-category | Mill Stock by Category | F | pabrik |
| 19 | mill-stock-supplier | Mill Stock by Supplier | F | pabrik |
| 20 | monitoring-allocation | Monitoring Allocation | G | estate |
| 21 | monitoring-usage | Monitoring Usage | G | estate |
| 22 | monitoring-balance | Monitoring Balance | G | estate |
| 23 | fuel-stock | Fuel Stock | H | estate |
| 24 | general-stock | General Stock | H | estate |
| 25 | stock-opname | Stock Opname | H | estate |
| 26 | stock-transfer | Stock Transfer | H | estate |
| 27 | stock-adjustment | Stock Adjustment | H | estate |

---

## 14. Key Database Connections

| DB Name | Host | Port | Purpose |
|---------|------|------|---------|
| db_ptrj | 10.0.0.2 | 1888 | Estate inventory data |
| db_ptrj_mill | 10.0.0.2 | 1888 | Mill/pabrik inventory data |

Both databases on same host but different names (separate schemas).  
Source switching via `source` param: `source=pabrik` → `db_ptrj_mill`, `source=estate` → `db_ptrj`.