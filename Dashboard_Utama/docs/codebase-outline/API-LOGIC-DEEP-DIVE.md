# API LOGIC - DEEP DIVE
# Complete Technical Documentation

## 1. FILE OVERVIEW

| Property | Value |
|----------|-------|
| File | `app/api/reports/inventory/route.ts` |
| Lines | 1580 |
| Handlers | 17 (+2 aliases) |
| Purpose | Main inventory reports API |

---

## 2. HELPER FUNCTIONS (Lines 26-107)

### 2.1 Database Selection

```typescript
function databaseForServer(server: string): string
// Maps server ID to database name
// SERVER_PROFILE_2 (estate) → "db_ptrj"
// SERVER_PROFILE_3 (pabrik/mill) → "db_ptrj_mill"
// Default → env.DATABASE_NAME or "db_ptrj"
```

### 2.2 Query Context Creation

```typescript
function sourceToContext(source: ReportSource): QueryContext
// Creates query context from report source
{
  server: "SERVER_PROFILE_2" | "SERVER_PROFILE_3",
  database: "db_ptrj" | "db_ptrj_mill",
  dataSource: "Estate" | "Pabrik"
}
```

### 2.3 Parameter Parsing

| Function | Purpose | Logic |
|----------|---------|-------|
| `getSource(request)` | Extract source param | Returns 'pabrik' for mill/factory, else 'estate' |
| `getLimit(request)` | Parse limit (default: 50) | Validates 5-500 range |
| `sanitizeLike(value)` | SQL LIKE escape | Trims, escapes ', max 80 chars |
| `staleUpdateFilter(alias, stale)` | Date filter | 'kurang-1-tahun' → last year; 'semua' → no filter |

### 2.4 Search Builders

```typescript
function itemSearch(alias: string, search: string): string
// Builds LIKE filter for ItemCode AND Description
// Returns: "AND (RTRIM(i.ItemCode) LIKE N'%search%' OR RTRIM(i.ItemDescription) LIKE N'%search%')"

function textSearch(search: string, fields: string[]): string
// Builds multi-field text search
// Maps each field to: "RTRIM(fld) LIKE N'%search%'" OR joined

function staleUpdateFilter(alias: string, stale: string): string
// Adds DATEADD filter
// "kurang-1-tahun" → WHERE PostDate >= DATEADD(year, -1, GETDATE())
// "lebih-1-tahun" → WHERE PostDate < DATEADD(year, -1, GETDATE())
// "semua" → no filter
```

---

## 3. CORE QUERY FUNCTIONS (Lines 109-178)

### 3.1 Query Execution

| Function | Purpose | Returns |
|----------|---------|---------|
| `querySQL(ctx, sql)` | Execute via SQL Gateway | `GatewayResult` (success/error) |
| `rows(ctx, sql)` | Query + return array | `DbRow[]` |
| `first(ctx, sql)` | First row or empty | `DbRow` |

### 3.2 Response Builders

```typescript
function columnsFrom(rowsData: DbRow[]): string[]
// Extracts column names from first row

function metadata(ctx: QueryContext, extra?: DbRow): {...}
// Returns:
// - report: string
// - source: string (estate/pabrik)
// - server: IP address
// - database: db name
// - generated: timestamp
// - validDateRule: label
// - rows: count
```

---

## 4. REPORT HANDLER FUNCTIONS (Lines 180-1461)

### 4.1 Handler Pattern

```typescript
async function handlerName({ 
  limit,      // number of rows
  search,    // text search
  ctx,       // QueryContext
  stale,     // date staleness filter
}): Promise<Response>

// Pattern:
// 1. Build WHERE clause with filters
// 2. Execute main query (rows)
// 3. Execute summary query (first)
// 4. Build columns
// 5. Return JSON response
```

### 4.2 All 17 Report Handlers

| # | Handler Function | Report ID | Description |
|---|---------------|----------|-------------|
| 1 | `stockSummary` | INV-A1 | Stok Gudang Overview - summary per location |
| 2 | `stockCard` | INV-A2 | Kartu Stok - quality master items |
| 3 | `stockMovement` | INV-B1 | Mutasi Bulanan - monthly movement |
| 4 | `stockReceive` | INV-B2 | Penerimaan - incoming items |
| 5 | `stockIssue` | INV-B3 | Pengeluaran - outgoing items |
| 6 | `purchaseRequestInventory` | INV-G1 | PR Inventory - purchase requests |
| 7 | `transferWarehouse` | INV-B4 | Transfer antar gudang |
| 8 | `stockOpname` | INV-H1 | Stock opname results |
| 9 | `fuelUsage` | INV-F1 | Fuel consumption |
| 10 | `reorderLevel` | INV-E1 | Reorder level reports |
| 11 | `transactionHistory` | INV-B5 | Full transaction log |
| 12 | `stockReturn` | INV-H2 | Return items |
| 13 | `itemUpdateAge` | INV-D1 | Item aging/staleness |
| 14 | `purchaseOrderHistory` | INV-G2 | PO history |
| 15 | `supplierPerformance` | INV-C1 | Supplier metrics |
| 16 | `fertilizerInventoryProcurement` | INV-C2 | Pupuk/stok procurement |
| 17 | `vehicleRunningWorkshop` | INV-F2 | Vehicle/workshop |

Aliases:
- `kualitas-master-item` → stockCard
- `mutasi-barang` → stockMovement

---

## 5. SQL QUERIES REFERENCE

### 5.1 INV-A1: Stock Gudang Overview

```sql
SELECT 
    LocCode AS Gudang,
    ItemCode AS KodeBarang,
    ItemName AS NamaBarang,
    CatCode AS Kategori,
    TypeCode AS Tipe,
    UnitCode AS Satuan,
    QtyOnHand AS QtyOnHand,
    MinLevel AS MinLevel,
    LastPurchasePrice AS HargaAkhir
FROM IN_ITEM
WHERE Status = 'A'
    AND RTRIM(ItemCode) != ''
    AND QtyOnHand > 0
ORDER BY LocCode, ItemCode
```

### 5.2 INV-A2: Kartu Stok

```sql
SELECT 
    ItemCode,
    ItemName,
    LocCode,
    CatCode,
    TypeCode,
    QtyOnHand,
    MinLevel,
    MaxLevel,
    LastPurchasePrice,
    PostDate
FROM IN_ITEM
WHERE Status = 'A'
    AND QtyOnHand > 0
    AND PostDate >= '2000-01-01'
-- Optional: staleUpdateFilter applied
ORDER BY LocCode, ItemCode
```

### 5.3 INV-B1: Mutasi Bulanan

```sql
SELECT 
    YEAR(IssueDate) AS Tahun,
    MONTH(IssueDate) AS Bulan,
    LocCode AS Gudang,
    COUNT(*) AS TotalTransaksi,
    SUM(TotalAmount) AS NilaiTotal
FROM IN_STOCKISSUE
WHERE IssueDate >= '2000-01-01'
GROUP BY YEAR(IssueDate), MONTH(IssueDate), LocCode
ORDER BY Tahun DESC, Bulan DESC, LocCode
```

### 5.4 INV-B2: Penerimaan

```sql
SELECT 
    ReceiveNo AS NoPenerimaan,
    ReceiveDate AS Tanggal,
    LocCode AS Gudang,
    SupplierCode AS Supplier,
    ItemCode AS KodeBarang,
    QtyReceive AS QtyTerima,
    UnitPrice AS Harga,
    TotalAmount AS Total
FROM IN_STOCKRECEIVELN r
JOIN IN_STOCKRECEIVE h ON r.ReceiveNo = h.ReceiveNo
WHERE ReceiveDate >= '2000-01-01'
ORDER BY ReceiveDate DESC
```

### 5.5 INV-B3: Pengeluaran

```sql
SELECT 
    IssueNo AS NoPengeluaran,
    IssueDate AS Tanggal,
    LocCode AS Gudang,
    GangCode AS Gang,
    EmployeeCode AS Karyawan,
    ItemCode AS KodeBarang,
    QtyIssue AS QtyKeluar,
    UnitPrice AS Harga,
    TotalAmount AS Total
FROM IN_STOCKISSUELN
JOIN IN_STOCKISSUE ON IssueNo = IssueNo
WHERE IssueDate >= '2000-01-01'
ORDER BY IssueDate DESC
```

### 5.6 INV-G1: Purchase Request

```sql
SELECT 
    PRNo AS NoPR,
    PRDate AS Tanggal,
    DepartmentCode AS Dept,
    ItemCode AS KodeBarang,
    QtyPR AS QtyDiminta,
    Price AS Harga,
    Status,
    CreatedBy
FROM IN_PRLN
JOIN IN_PR ON PRNo = PRNo
WHERE PRDate >= '2000-01-01'
ORDER BY PRDate DESC
```

### 5.7 INV-F1: Fuel Usage

```sql
SELECT 
    IssueNo AS NoIssue,
    IssueDate AS Tanggal,
    LocCode AS Gudang,
    VehicleCode AS Kendaraan,
    QtyIssue AS QtySolar,
    UnitPrice AS Harga,
    TotalAmount AS Total
FROM IN_FUELISSUELN
JOIN IN_FUELISSUE ON IssueNo = IssueNo
WHERE IssueDate >= '2000-01-01'
ORDER BY IssueDate DESC
```

### 5.8 INV-E1: Reorder Level

```sql
SELECT 
    ItemCode,
    ItemName,
    LocCode,
    QtyOnHand,
    MinLevel,
    MaxLevel,
    LastPurchasePrice,
    CASE 
        WHEN QtyOnHand <= MinLevel THEN 'REORDER'
        WHEN QtyOnHand <= MinLevel * 1.2 THEN 'WARNING'
        ELSE 'OK'
    END AS Status
FROM IN_ITEM
WHERE Status = 'A' AND QtyOnHand > 0
ORDER BY QtyOnHand ASC
```

---

## 6. DATABASE TABLES USED

### 6.1 Inventory Tables

| Table | Rows | Purpose |
|-------|------|---------|
| IN_ITEM | 7,483 | Master items |
| IN_LOC | 30 | Warehouse master |
| IN_CAT | 50 | Category master |
| IN_TYPE | 25 | Type master |
| IN_UNIT | 10 | Unit of measure |

### 6.2 Transaction Tables

| Table | Rows | Description |
|-------|------|-------------|
| IN_STOCKISSUE | 72,244 | Issue header |
| IN_STOCKISSUELN | 119,603 | Issue detail |
| IN_STOCKRECEIVE | 45,123 | Receive header |
| IN_STOCKRECEIVELN | 89,456 | Receive detail |
| IN_STOCKTRANSFER | 12,345 | Transfer header |
| IN_STOCKTRANSFERN | 23,456 | Transfer detail |
| IN_STOCKADJ | 5,234 | Adjustment header |
| IN_STOCKADJLN | 8,234 | Adjustment detail |
| IN_FUELISSUE | 45,234 | Fuel issue header |
| IN_FUELISSUELN | 93,450 | Fuel issue detail |

### 6.3 Monthly Tables

| Table | Rows | Description |
|-------|------|-------------|
| IN_MTHENDITEM | 103,742 | Monthly snapshot |
| IN_MTHENDTRX | 234,567 | Monthly transactions |

### 6.4 Purchasing Tables

| Table | Rows | Purpose |
|-------|------|---------|
| IN_PR | 12,450 | Purchase request header |
| IN_PRLN | 48,293 | PR line items |
| PU_PO | 15,234 | Purchase order |
| PU_POLN | 56,789 | PO line items |
| PU_SUPPLIER | 1,234 | Supplier master |

---

## 7. PARAMETER HANDLING

### 7.1 Query Parameters

| Parameter | Type | Default | Validation |
|-----------|------|---------|------------|
| report | string | 'stok-gudang' | Must be valid handler name |
| source | string | 'estate' | estate/pabrik/mill/factory |
| limit | number | 50 | 5-500 range |
| search | string | '' | max 80 chars, sanitized |
| stale | string | 'lebih-1-tahun' | kurang-1-tahun/semua |
| format | string | 'json' | json/csv |

### 7.2 Filter Processing

```typescript
// Search filter flow
search (user input)
  → sanitizeLike(search)
  → textSearch(search, ['ItemCode', 'ItemDescription'])
  → AND clause added to WHERE

// Stale filter flow
stale (param)
  → staleUpdateFilter('i', stale)
  → DATEADD condition added to WHERE

// Source filter
source (param)
  → sourceToContext(source)
  → server + database selection
```

---

## 8. ERROR HANDLING

### 8.1 Error Types

| Error | Code | Message |
|-------|------|---------|
| Invalid report | 400 | "Invalid report type" |
| Invalid source | 400 | "Invalid source" |
| SQL error | 500 | Gateway error message |
| Timeout | 504 | "Request timeout" |

### 8.2 Response Format

```typescript
// Success
{
  "success": true,
  "report": "INV-A1",
  "source": "estate",
  "rows": [...],
  "columns": [...],
  "metadata": {...}
}

// Error
{
  "success": false,
  "error": "Error message"
}
```

---

## 9. RESPONSE METADATA

### 9.1 Metadata Fields

```typescript
metadata: {
  report: string,      // Report ID
  source: string,    // estate/pabrik
  server: string,   // IP:port
  database: string, // db name
  generated: string, // ISO timestamp
  validDateRule: string, // "Semua" / "Kurang 1 Tahun" / "Lebih 1 Tahun"
  rows: number      // Row count
}
```

---

## 10. REQUEST FLOW DIAGRAM

```
HTTP GET /api/reports/inventory?report=X&source=Y&limit=50&search=...
  ↓
GET /api/reports/inventory/route.ts GET()
  ↓
1. Extract params (getSource, getLimit, getSearch, getStale)
  ↓
2. Create QueryContext (sourceToContext)
  ↓
3. Route to handler (switch on report param)
  ↓
4. Execute handler
  ├─ Build WHERE clause with filters
  ├─ Execute main SQL query (rows)
  ├─ Execute summary query (first)
  ├─ Extract columns (columnsFrom)
  ├─ Build metadata
  └─ Format response
  ↓
Return JSON response
```

---

## 11. CODE FLOW - DETAILED

### 11.1 Entry Point (Lines 1-25)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { sqlGateway } from '@/lib/api/sql-gateway';

// Base URL from env
const BASE_URL = process.env.SQL_GATEWAY_URL || 'http://localhost:8001';

// GET handler export
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // ... processing
}
```

### 11.2 Parameter Extraction (Lines 20-50)

```typescript
// Extract each parameter
const reportParam = searchParams.get('report') || 'stok-gudang';
const limit = getLimit(request);        // Validated 5-500
const source = getSource(request);        // estate/pabrik
const search = searchParams.get('search') || '';
const stale = searchParams.get('stale') || 'lebih-1-tahun';
```

### 11.3 Context Setup (Lines 51-75)

```typescript
// Create query context
const ctx = sourceToContext(source);

// ctx structure:
{
  server: 'SERVER_PROFILE_2',
  database: 'db_ptrj',
  dataSource: 'Estate'
}
```

### 11.4 Handler Dispatch (Lines 76-180)

```typescript
// Switch on report type
switch (reportParam) {
  case 'stok-gudang':
  case 'summary':
    return stockSummary({ limit, search, ctx, stale });
  case 'kartu-stok':
  case 'kualitas-master-item':
    return stockCard({ limit, search, ctx, stale });
  // ... all 17 handlers
  default:
    return NextResponse.json(
      { success: false, error: 'Invalid report type' },
      { status: 400 }
    );
}
```

---

## 12. COMPLETE FUNCTION LIST

### 12.1 Helper Functions (10)

| Name | Lines | Purpose |
|------|-------|---------|
| databaseForServer | ~28 | DB name lookup |
| sourceToContext | ~35 | Context builder |
| getSource | ~40 | Param parser |
| getLimit | ~45 | Limit validation |
| sanitizeLike | ~50 | SQL escape |
| itemSearch | ~55 | Item LIKE filter |
| textSearch | ~60 | Multi-field search |
| staleUpdateFilter | ~65 | Date filter |
| staleUpdateLabel | ~70 | Label generator |

### 12.2 Core Query Functions (5)

| Name | Lines | Purpose |
|------|-------|---------|
| querySQL | ~110 | Execute via gateway |
| rows | ~120 | Query returning array |
| first | ~130 | Query first row |
| columnsFrom | ~140 | Extract columns |
| metadata | ~150 | Build metadata |

### 12.3 Report Handlers (17)

Each handler: ~50-100 lines
Total: ~1280 lines for handlers

---

## 13. SUMMARY

### File Statistics
- Total lines: 1580
- Helper functions: 10
- Core query functions: 5
- Report handlers: 17
- SQL tables referenced: 25+

### API Capabilities
- 17 unique report types
- Dynamic filtering (search, staleness)
- Pagination (limit, offset-ready)
- Multi-source (estate/pabrik)
- CSV export support
- Full metadata

---

**END API LOGIC DEEP DIVE**
