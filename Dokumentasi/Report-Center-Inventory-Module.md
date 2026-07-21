# Report Center — Inventory Module

> **Created:** 2026-07-20
> **Scope:** Inventory module only — safe to share with external agents
> **Status:** Architecture reference

---

## 1. System Overview

A generic report viewer system. One `ReportViewerClient` renders 20 inventory reports through declarative profile configs. All SQL executes through a MSSQL gateway with mandatory read-only validation.

```
Browser → Next.js GET /api/reports/inventory → SQL Gateway → MSSQL → Response
                ↑                                              ↓
         ReportViewerClient ← JSON Payload ←─────────────────┘
```

### Key Facts

- **1 API route** handles all 20 inventory reports
- **20 async handler functions** dispatched via `reportHandlers` object
- **2 data sources**: `db_ptrj` (estate) and `db_ptrj_mill` (pabrik)
- **Client-side filtering** via `applyReportFilters()` — operates on returned rows
- **Read-only enforcement** via `validateReadOnlySql()` before any gateway call

---

## 2. Directory Structure

```
Dashboard_Utama/
├── app/
│   ├── (report-center)/
│   │   └── report-center/
│   │       ├── inventory/[report]/
│   │       │   ├── page.tsx                    # Dynamic report viewer
│   │       │   └── ReportViewerClient.tsx       # Generic renderer (3169 lines)
│   │       └── modules/inventory/page.tsx       # Module landing
│   │
│   └── api/reports/
│       └── inventory/route.ts                  # Main SQL executor (3520 lines)
│
└── lib/reports/
    ├── inventory/
    │   └── config.ts                          # 20 report configs
    ├── movement-category.ts                    # MovementCategory logic
    ├── report-filtering.ts                     # Filter system
    ├── report-detail-performance.ts             # Table rendering
    └── accounting-period.ts                    # Period conversion
```

---

## 3. Data Flow

```
1. User opens /report-center/inventory/stok-gudang
2. ReportViewerClient reads InventoryReport profile from inventory/config.ts
3. Client renders: title, description, KPI cards, chart selector, filter bar
4. User applies filters → fetchReport() builds URLSearchParams
5. GET /api/reports/inventory?report=stok-gudang&source=estate&limit=500&...
6. GET handler:
   a. getSource(request) → 'estate' | 'pabrik'
   b. sourceToContext(source) → QueryContext {server, database}
   c. getInventoryReport(reportParam) → InventoryReport profile
   d. reportHandlers[apiReport] → handler function
   e. handler() builds SQL → querySQL() → SQL Gateway → returns rows
   f. Returns NextResponse.json(payload)
7. Client receives: {title, rows, columns, summary, chart, metadata}
8. Client applies applyReportFilters() on rows
9. Client renders table, KPI cards, chart
```

---

## 4. Data Sources

### Source Switching

| `source` param | Server Profile | Database | Label |
|---|---|---|---|
| `pabrik` / `mill` / `factory` | `SERVER_PROFILE_3` | `db_ptrj_mill` | Pabrik |
| `estate` (default) | `SERVER_PROFILE_2` | `db_ptrj` | Estate |

### Resolved in API Route

```typescript
function sourceToContext(source: ReportSource): QueryContext {
  const server = source === 'pabrik' ? 'SERVER_PROFILE_3' : 'SERVER_PROFILE_2'
  const database = databaseForServer(server)
  return { source, server, database, dataSource: /* label */ }
}

function databaseForServer(server: string) {
  if (process.env.DATABASE_NAME) return process.env.DATABASE_NAME
  if (server === 'SERVER_PROFILE_2') return 'db_ptrj'
  if (server === 'SERVER_PROFILE_3') return 'db_ptrj_mill'
  return 'db_ptrj'
}
```

---

## 5. API Layer

**File:** `Dashboard_Utama/app/api/reports/inventory/route.ts` (~3,520 lines)

### Query Parameters

| Param | Type | Description |
|---|---|---|
| `report` | string | Report code (e.g. `stok-gudang`, `kartu-stok`) |
| `source` | `estate` \| `pabrik` | Data source |
| `search` | string | Full-text search |
| `period` | string | Period filter (e.g. `2026-01`) |
| `accYear` / `accMonth` | number | Accounting year/month |
| `dateFrom` / `dateTo` | string | Date range (YYYY-MM-DD) |
| `location` | string | Warehouse/location |
| `category` | string | Item category |
| `supplier` | string | Supplier filter |
| `stale` | string | Stale filter (default: `lebih-1-tahun`) |
| `sortColumn` / `sortDirection` | string | Sort |
| `page` / `pageSize` | number | Pagination |
| `columnFilters` | JSON | Array of `ReportColumnFilter` |
| `naturalQuery` | string | Natural language filter |

### Pagination

```typescript
const TABLE_WINDOW_ROW_LIMIT = 20000
// First load capped at 500 rows
// wantsAllRows: 'all' | 'semua' | '*' → 20000 rows
```

### Error Handling

| Layer | Trigger | Response |
|---|---|---|
| `report?.status === 'hold'` | Report disabled | HTTP 409 with reason |
| Handler not found | Unknown report | HTTP 404 |
| `validateReadOnlySql()` fail | Non-read SQL | `{success: false, error}` |
| Gateway error | HTTP non-ok | `{success: false, error}` |

---

## 6. Report Handler Catalog

### Dispatch Map

```typescript
const reportHandlers: Record<string, ReportHandler> = {
  'stok-gudang': stockSummary,
  'asset-stock-valuasi-listing': assetStockValuationListing,
  'all-stock-movement-analysis': allStockMovementAnalysis,
  'report-asset-stock-valuasi-listing': assetStockValuationListing,  // alias
  'seluruh-stock-summary': assetStockValuationListing,               // alias
  'RPTIN1000011': assetStockValuationListing,                       // legacy
  'summary': stockSummary,
  'kartu-stok': stockCard,
  'kualitas-master-item': stockCard,
  'mutasi-barang': stockMovement,
  'monthly-stock-account-movement-details': monthlyStockAccountMovementDetails,
  'RPTIN1000015': monthlyStockAccountMovementDetails,
  'penerimaan-barang': stockReceive,
  'pengeluaran-barang': stockIssue,
  'purchase-request-inventory': purchaseRequestInventory,
  'transfer-antar-gudang': transferWarehouse,
  'stock-opname': stockOpname,
  'fuel-usage': fuelUsage,
  'reorder-level': reorderLevel,
  'riwayat-transaksi': transactionHistory,
  'return-barang': stockReturn,
  'item-stale-update': itemUpdateAge,
  'purchase-order-history': purchaseOrderHistory,
  'supplier-purchasing-performance': supplierPerformance,
  'pupuk-stock-procurement': fertilizerInventoryProcurement,
  'vehicle-running-workshop': vehicleRunningWorkshop,
}
```

### Handler Profile Matrix

| # | Handler | API Key | Key Tables | Helpers |
|---|---|---|---|---|
| 1 | `stockSummary` | `stok-gudang` | `IN_ITEM` | stockIssueUsage, warehouse, movCat, accPeriod, stale |
| 2 | `assetStockValuationListing` | `asset-stock-valuasi-listing` | `IN_ITEM` + CTE | stockIssueUsage, warehouse, movCat, accPeriod |
| 3 | `allStockMovementAnalysis` | `all-stock-movement-analysis` | `IN_ITEM`, `WS_*` | stockIssueUsage, warehouse, movCat, accPeriod |
| 4 | `stockCard` | `kartu-stok` | `IN_ITEM` + CTE | stockIssueUsage, warehouse, movCat, accPeriod, stale |
| 5 | `stockMovement` | `mutasi-barang` | `IN_ITEM`, `WS_*` | warehouse, movCat, OUTER APPLY |
| 6 | `monthlyStockAccountMovementDetails` | `monthly-stock-account-movement-details` | `IN_ITEM` | warehouse, movCat, accPeriod |
| 7 | `stockReceive` | `penerimaan-barang` | `IN_ITEM` | OUTER APPLY (5×) |
| 8 | `stockIssue` | `pengeluaran-barang` | `IN_ITEM`, `WS_*` | warehouse, movCat |
| 9 | `stockOpname` | `stock-opname` | `IN_ITEM` | warehouse, movCat, CASE |
| 10 | `reorderLevel` | `reorder-level` | `IN_ITEM` | stockIssueUsage, CASE |
| 11 | `transactionHistory` | `riwayat-transaksi` | `IN_ITEM` | warehouse, CASE |
| 12 | `purchaseRequestInventory` | `purchase-request-inventory` | `IN_ITEM` | warehouse, movCat |
| 13 | `transferWarehouse` | `transfer-antar-gudang` | `IN_ITEM` | warehouse, movCat |
| 14 | `fuelUsage` | `fuel-usage` | `IN_ITEM` | warehouse, movCat |
| 15 | `stockReturn` | `return-barang` | `IN_ITEM` | warehouse, movCat |
| 16 | `itemUpdateAge` | `item-stale-update` | `IN_ITEM` | stockIssueUsage, warehouse, movCat |
| 17 | `purchaseOrderHistory` | `purchase-order-history` | `IN_ITEM` | warehouse |
| 18 | `supplierPerformance` | `supplier-purchasing-performance` | `IN_ITEM` + CTE | warehouse |
| 19 | `fertilizerInventoryProcurement` | `pupuk-stock-procurement` | `IN_ITEM` | stockIssueUsage, OUTER APPLY |
| 20 | `vehicleRunningWorkshop` | `vehicle-running-workshop` | `WS_JOB`, `WS_JOBSTOCK` + CTE | CTE |

---

## 7. Report Config

**File:** `Dashboard_Utama/lib/reports/inventory/config.ts` (~1,092 lines)

### Type

```typescript
export type InventoryReport = {
  id: string
  apiReport: string                  // maps to reportHandlers key
  code: string                       // URL slug
  group: string                       // inventoryGroups key
  title: string
  description: string
  status: 'active' | 'hold' | 'deprecated'
  chartDefinitions: InventoryChartDefinition[]
  qualityNotes: string[]
  readOnly: true
  sourceTables: string[]
}
```

### Groups

```typescript
export const inventoryGroups = {
  executive:   "Executive Inventory Position",
  master:       "Master Data & Quality",
  aging:        "Item Aging & Update Quality",
  transaction:  "Mutasi & Transaksi",
  purchasing:   "Purchasing & Supplier Linkage",
  fertilizer:    "Pupuk & Material Estate",
  control:      "Kontrol & Audit",
  fuel:         "Fuel Inventory",
  vehicle:      "Vehicle Running & Workshop",
  hold:         "Kandidat Hold",
} as const
```

### Report Catalog

| # | Title | ID | Code | Group | Status | Charts | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Posisi Stok & Nilai Gudang | `stok-gudang` | INV-01 | executive | active | 4 | 5 |
| 2 | Asset Stock Valuasi Listing | `asset-stock-valuasi-listing` | RPTIN1000011 | executive | active | 3 | 7 |
| 3 | ALL Stock Movement Analysis | `all-stock-movement-analysis` | INV-ALL-STOCK-MOVEMENT | transaction | active | 3 | 6 |
| 4 | Stock Aging & Item Movement | `item-movement-update-tracking` | INV-STOCK-AGING | master | active | 3 | 6 |
| 5 | Movement Stock | `movement-stock` | INV-03 | transaction | active | 2 | 5 |
| 6 | Monthly Stock Account Movement | `monthly-stock-account-movement-details` | RPTIN1000015 | transaction | active | 2 | 6 |
| 7 | Pengeluaran Barang | `pengeluaran-barang` | INV-04 | transaction | active | 2 | 3 |
| 8 | Goods Receiving | `goods-receiving-receipt-activity` | INV-05 | purchasing | active | 3 | 3 |
| 9 | Purchase Request Inventory | `purchase-request-inventory` | INV-06 | purchasing | active | 2 | 0 |
| 10 | Transfer Antar Gudang | `transfer-antar-gudang` | INV-07 | transaction | active | 2 | 0 |
| 11 | Stock Opname | `stock-opname` | INV-08 | control | active | 2 | 0 |
| 12 | Fuel Usage | `fuel-usage` | INV-09 | fuel | active | 2 | 0 |
| 13 | Riwayat Transaksi | `riwayat-transaksi` | INV-10 | control | active | 2 | 0 |
| 14 | Return Barang | `return-barang` | INV-11 | control | active | 2 | 0 |
| 15 | Item Tidak Update & Aging | `item-stale-update` | INV-12 | aging | active | 3 | 6 |
| 16 | Purchase Order History | `purchase-order-history` | INV-13 | purchasing | active | 3 | 3 |
| 17 | Supplier Performance | `supplier-purchasing-performance` | INV-14 | purchasing | active | 3 | 3 |
| 18 | Pupuk Stock Procurement | `pupuk-stock-procurement` | INV-15 | fertilizer | active | 3 | 5 |
| 19 | Vehicle Running Workshop | `vehicle-running-workshop` | INV-16 | vehicle | active | 3 | 3 |
| 20 | Expiry Inventory | `expiry-inventory` | INV-H01 | hold | **hold** | 0 | 0 |

**Totals:** 20 reports, 19 live, 1 hold, 49 charts, 61 qualityNotes.

---

## 8. Filter System

**File:** `Dashboard_Utama/lib/reports/report-filtering.ts` (~1,402 lines)

### Types

```typescript
export type ReportColumnType = 'string' | 'number' | 'date' | 'boolean'
export type ReportColumnOperator =
  | 'contains' | 'equals' | 'notEquals'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'between' | 'blank' | 'notBlank'
export type ReportColumnFilter = {
  field: string
  operator: ReportColumnOperator
  value?: string | number
  valueTo?: string | number   // for 'between'
}
```

### Column Type Inference

Runtime inference from rows[0..24]:

| Rule | Result |
|---|---|
| Any boolean values | `boolean` |
| All parse as numbers | `number` |
| Date pattern ≥60% | `date` |
| Default | `string` |

### Operator Assignment by Type

| Column Type | Operators |
|---|---|
| `number` | equals, gt, gte, lt, lte, between, blank, notBlank |
| `date` | equals, gt, gte, lt, lte, between, blank, notBlank |
| `boolean` | equals, notEquals, blank, notBlank |
| `string` | contains, equals, notEquals, blank, notBlank |

### applyReportFilters() — 7 Steps

```
Input: FilterablePayload + ReportFilterInput

Step 1  inferReportSchema()         → type per column, operators per type
Step 2  sanitizeFiltersForSchema()   → validate columnFilters against schema
Step 3  activeFiltersToRecord()      → check if any filter is active
Step 4  filter: rows.filter()       → text search, date range, MovementCategory,
                                       columnFilters, minQty, minAmount
Step 5  sort: sortRows()            → by metric or explicit sortColumn
Step 6  window: rowStart, rowEnd     → pagination
Step 7  output: {rows, columns, summary, chart, metadata}
```

### Read-Only Validation

```typescript
validateReadOnlySql(sql)
// Must start with SELECT or WITH
// Blocked: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, MERGE, EXEC,
//          CREATE, GRANT, REVOKE, DENY, BACKUP, RESTORE, DBCC, USE, KILL,
//          WAITFOR, OPENROWSET, OPENQUERY, BULK, xp_*, sp_*
// Blocked: SELECT ... INTO
// Returns: {safe: boolean, reason?: string, blockedTerms?: string[]}
```

---

## 9. Movement Category

**File:** `Dashboard_Utama/lib/reports/movement-category.ts` (~128 lines)

### Classification

```
StockIssueEventCount ≥ 6  → Fast Moving
StockIssueEventCount 2-5  → Moving
StockIssueEventCount 1    → Slow Moving
StockIssueEventCount 0 + stock > 0 → Dead Stock
StockIssueEventCount 0 + stock = 0 → Stale
```

### SQL CASE

```sql
CASE
  WHEN StockIssueEventCount >= 6 THEN 'Fast Moving'
  WHEN StockIssueEventCount BETWEEN 2 AND 5 THEN 'Moving'
  WHEN StockIssueEventCount = 1 THEN 'Slow Moving'
  WHEN quantityClosing > 0 THEN 'Dead Stock'
  ELSE 'Stale'
END
```

### Functions

```typescript
export function movementCategoryFromIssueCount(issueCount, quantityClosing): MovementCategory
export function movementCategorySqlCase(issueExpr, qtyExpr)         // basic
export function movementAnalysisSqlCase(issueExpr, qtyExpr)        // verbose labels
export function movementCategoryRankSqlCase(categoryExpr)            // rank 1-5
export function isMovementCategoryField(value): boolean
export function countMovementCategoryRows(rows, field?)
export function buildMovementCategoryBalancedRows(rows, limit, getCategory, compare?)
export const MOVEMENT_CATEGORY_ORDER = ['Fast Moving','Moving','Slow Moving','Dead Stock','Stale']
```

---

## 10. Accounting Period

**File:** `Dashboard_Utama/lib/reports/accounting-period.ts` (~144 lines)

Accounting year: **April → March**

### Conversion Matrix

| Acc Month | Actual Month | Actual Year |
|---|---|---|
| 1 (Apr) | 6 (Jun) | accYear - 1 |
| 2 (May) | 7 (Jul) | accYear - 1 |
| 3 (Jun) | 8 (Aug) | accYear - 1 |
| 4 (Jul) | 9 (Sep) | accYear - 1 |
| 5 (Aug) | 10 (Oct) | accYear - 1 |
| 6 (Sep) | 11 (Nov) | accYear - 1 |
| 7 (Oct) | 12 (Dec) | accYear - 1 |
| 8 (Nov) | 1 (Jan) | accYear |
| 9 (Dec) | 2 (Feb) | accYear |
| 10 (Jan) | 3 (Mar) | accYear |
| 11 (Feb) | 4 (Apr) | accYear + 1 |
| 12 (Mar) | 5 (May) | accYear + 1 |

### Functions

```typescript
export function accountingMonthToActualMonth(value): number   // ((accMonth + 2) % 12) + 1
export function accountingToActualPeriod(accYear, accMonth): AccountingPeriod
export function actualToAccountingPeriod(actualYear, actualMonth): ActualPeriod
export function accountingActualPeriodSelectSql({accYearExpression, accMonthExpression,
  actualYearAlias?, actualMonthAlias?, ...}): string  // full SELECT clause
```

---

## 11. UI Rendering

**File:** `Dashboard_Utama/app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx` (~3,169 lines)

### Three Special Profiles

| Profile | Reports | Key Overrides |
|---|---|---|
| **Movement Analysis** | `all-stock-movement-analysis` | 32 max columns, preferredGroupColumns, rowDetail: 'movement' |
| **Stock Aging** | `item-stale-update` | loadAllRows: false, AgingBucket grouping |
| **Asset Valuation** | `asset-stock-valuasi-listing` | loadAllRows: false, tableContextColumns |

### KPI Builders

| Function | Returns |
|---|---|
| `genericKpis(payload)` | summary.entries → KpiCards |
| `movementAnalysisKpis(summary, rows)` | 8 cards: Asset Amount, Total Item, 5× category, Movement count |
| `stockAgingKpis(summary, rows)` | 11 cards: Total, aging buckets, risk levels |
| `assetValuationKpis(summary, metadata, rows)` | 8 cards: AccYear, Qty, Amount, Item count |

### Source Persistence

```typescript
// URL ?source= wins over localStorage
// localStorage['report-center:last-source'] persists selection
```

---

## 12. Table Rendering

**File:** `Dashboard_Utama/lib/reports/report-detail-performance.ts` (~307 lines)

```typescript
export function buildReportTableGroups(rows, groupColumn, visibleColumns, subtotalColumns?)
export function buildReportTableRows({grouped, groups, pageRows, page,
  collapsedGroups?, expandedRows?, getRowKey}): ReportTableRenderRow[]
export function buildReportSummaryTotals(summary, rows, columns, {fallbackToRows?})
export function normalizeReportTableWindow(metadata, loadedRowsLength, pageSize)
export function compactReportPayloadForAi(payload, {sampleRows?, maxColumns?, chartRows?})
```

---

## 13. SQL Helper Functions

### Movement

```typescript
stockIssueUsageApply(database, itemAlias)
  // Dual OUTER APPLY:
  //   #1: issueUsage (all-time) — COUNT(DISTINCT StockIssueID), max PostDate
  //   #2: movement12 (12-month window) — gap calculation
  //   #3: latestMovement — last 2 events as formatted text

stockIssueUsageColumns(quantityExpression)
  // Returns: StockIssueEventCount, MovementGapQty, MovementCategory, ...
```

### Workshop

```typescript
warehouseInventoryItemTypeFilter(alias)
  // ItemType IN ('1', '4')

nonWorkshopItemTypeFilter(alias)
  // ItemType != '4'

workshopStockIssueDateExpression(alias)
  // COALESCE(NULLIF(PostDate, '1900-01-01'), TransDate)
```

### Search

```typescript
itemSearch(alias, search)    // ItemCode/Description LIKE
textSearch(search, fields[])  // Multi-field LIKE
```

### Stale

```typescript
staleFilterByRange(alias, stale)
  // 'active', 'watch', 'slow-moving', 'dead-stock', 'lebih-1-tahun'
staleUpdateFilter(alias, stale)
  // Filters by UpdateDate age
```

---

## 14. Quick Reference

### Source Mapping
```
estate  → SERVER_PROFILE_2 → db_ptrj
pabrik  → SERVER_PROFILE_3 → db_ptrj_mill
```

### Movement Category Thresholds
```
≥6 events   → Fast Moving
2-5 events  → Moving
1 event     → Slow Moving
0 + stock>0 → Dead Stock
0 + stock=0 → Stale
```

### Accounting Period (April → March)
```
Acc Month 1 (Apr) → Actual June, accYear - 1
Acc Month 8 (Nov) → Actual January, accYear
```

### Initial Load
```
First fetch: 500 rows (TABLE_FIRST_LIMIT)
Max per page: 500 (capped at first load)
Max all: 20,000 rows (TABLE_WINDOW_ROW_LIMIT)
```

### Filter Execution
```
Server-side:  search, location, category, supplier, stale, accYear/Month, dateFrom/To
Client-side: columnFilters, sortColumn, sortDirection, minQty, minAmount, top, pagination
```

### Env Vars
```
SQL_GATEWAY_URL      — MSSQL gateway endpoint
SQL_GATEWAY_API_KEY  — gateway auth token
DATABASE_NAME        — override database selection
```

---

*End of Inventory Module Documentation*
