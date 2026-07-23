# 05 - Filters & Parameters

## URL Parameters

### Standard Filters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `source` | string | `pabrik` | Data source: `pabrik` (db_ptrj_mill) atau `estate` (db_ptrj) |
| `location` | string | `PTRJ` | Location/gudang code |
| `period` | string | Current month | Periode dalam format `YYYY-MM` atau `acc:YYYY-MM` |
| `search` | string | - | Pencarian item (ItemCode, Description) |
| `limit` | number | 500 | Maksimal rows yang dikembalikan |
| `dateTo` | string | - | Transaction as-of date untuk live mode |

### Filter Examples

```
# Default (current month, PTRJ, pabrik)
GET /api/reports/inventory?report=monthly-stock-account-movement-details

# Specific period
GET /api/reports/inventory?report=monthly-stock-account-movement-details&period=2026-07

# Estate source
GET /api/reports/inventory?report=monthly-stock-account-movement-details&source=estate

# With search
GET /api/reports/inventory?report=monthly-stock-account-movement-details&search=nalco

# Limited results
GET /api/reports/inventory?report=monthly-stock-account-movement-details&limit=100

# Transaction as-of date
GET /api/reports/inventory?report=monthly-stock-account-movement-details&dateTo=2026-07-15
```

## Period Resolution Logic

Report mendukung multiple period input formats:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERIOD RESOLUTION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Input: ?period=2026-07                                        │
│         ↓                                                       │
│  ┌─────────────────────────────────────────┐                   │
│  │ Try: actual period (YYYY-MM)             │                   │
│  │ actualToAccountingPeriod(2026, 7)        │                   │
│  │ → {accYear: 2027, accMonth: 4}          │                   │
│  └──────────────────┬──────────────────────┘                   │
│                     │ Match found                               │
│                     ▼                                           │
│              Use actual period                                  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Input: ?accYear=2027&accMonth=4                               │
│         ↓                                                       │
│  ┌─────────────────────────────────────────┐                   │
│  │ Try: actual fields                       │                   │
│  │ accountingToActualPeriod(2027, 4)        │                   │
│  │ → {actualPeriod: '2026-07'}              │                   │
│  └──────────────────┬──────────────────────┘                   │
│                     │ Match found                               │
│                     ▼                                           │
│              Use accounting fields                              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Input: ?period=acc:2027-04                                     │
│         ↓                                                       │
│  ┌─────────────────────────────────────────┐                   │
│  │ Try: accounting period prefix            │                   │
│  │ accountingToActualPeriod(2027, 4)        │                   │
│  └──────────────────┬──────────────────────┘                   │
│                     │ Match found                               │
│                     ▼                                           │
│              Use accounting period                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Scope Resolution

`resolveMonthlyStockMovementScope()` menghasilkan scope object:

```typescript
interface MonthlyStockMovementScope {
  actualYear: number          // e.g., 2026
  actualMonth: number         // e.g., 7
  actualPeriod: string         // e.g., "2026-07"
  actualPeriodStart: string    // e.g., "2026-07-01"
  accYear: number             // e.g., 2027
  accMonth: number            // e.g., 4
  accountingPeriod: string    // e.g., "2027-04"
  openingAccYear: number      // e.g., 2027 (or 2026 if accMonth=1)
  openingAccMonth: number     // e.g., 3 (or 12 if accMonth=1)
  openingAccountingPeriod: string  // e.g., "2027-03"
  openingActualPeriod: string  // e.g., "2026-06"
  location: string             // e.g., "PTRJ"
  categoryCodes: string[]      // Always empty (deprecated)
  search: string              // Sanitized search text
  limit: number              // Bounded limit
  transactionAsOf: string     // ISO datetime or empty
  inputMode: 'actual' | 'accounting' | 'period' | 'current'
  snapshotMode: boolean       // true = past period
  analysisGroup: string      // Always "ProductTypeCode"
}
```

## Snapshot Mode Detection

```typescript
const snapshotMode =
  requestedYear < currentYear ||
  (requestedYear === currentYear && requestedMonth < currentMonth)
```

**Logic:**
- `snapshotMode = true`: Periode yang diminta adalah bulan lampau
  - Base CTE menggunakan `IN_MTHENDITEM` snapshot
  - Closing diambil dari `IN_MTHENDITEM` jika ada

- `snapshotMode = false`: Periode yang diminta adalah bulan berjalan
  - Base CTE menggunakan `IN_ITEM` live balance
  - Closing dihitung dari formula

## Location Normalization

```typescript
function normalizeLocation(value: unknown) {
  const code = sanitizeSqlText(value, 16).toUpperCase()
  return /^[A-Z0-9_-]{1,16}$/.test(code) ? code : 'PTRJ'
}
```

**Rules:**
- Uppercase conversion
- Only alphanumeric, underscore, hyphen allowed
- Default to `PTRJ` if invalid
- Max 16 characters

## Search Normalization

```typescript
function monthlyTextSearch(search: string, fields: string[]) {
  const q = sanitizeSqlText(search, 120)
  if (!q) return ''
  return `AND (${fields.map((field) =>
    `RTRIM(${field}) LIKE N'%${q}%'`
  ).join(' OR ')})`
}
```

**Searchable Fields:**
- `i.ItemCode`
- `i.Description`
- `i.ProdTypeCode`
- `pt.Description`

**Note:** Search dibatasi 120 karakter untuk keamanan.

## Transaction As-Of Filter

```typescript
function normalizeMonthlyTransactionAsOf(value?: string) {
  const raw = sanitizeSqlText(value ?? '', 32).replace(' ', 'T')
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T23:59:59`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw}:00`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) return raw
  return ''
}
```

**Applied to:**
```sql
AND COALESCE(UpdateDate, CreateDate) <= CONVERT(datetime, '${transactionAsOf}', 126)
```

**Use Case:** Batasi transaksi yang dihitung hanya yang posted sebelum tanggal tertentu.

## Item Type Filter

```typescript
function inventoryValuationItemTypeFilter(alias: string) {
  // Valuation scope: ItemType 1 (Stock) dan 4 (Workshop)
  return `AND ISNULL(RTRIM(CONVERT(varchar(10), ${alias}.ItemType)), '') IN ('1', '4')`
}
```

**Scope:**
- ItemType 1: Stock/Gudang
- ItemType 4: Workshop/Mesin
- ItemType 2, 3, 5+: Tidak termasuk

## Status Filter

### IN_STOCKISSUE
```sql
AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
```
| Status | Meaning |
|--------|---------|
| 1 | Draft/Open |
| 2 | Approved |
| 5 | Cancelled |
| 6 | Posted |

### IN_FUELISSUE
```sql
AND RTRIM(ISNULL(${alias}.Status, '')) IN ('2', '6')
```
| Status | Meaning |
|--------|---------|
| 2 | Approved |
| 6 | Posted |

### PU_GOODSRCV / PU_GOODSRET
```sql
AND RTRIM(g.Status) = '2'
```
| Status | Meaning |
|--------|---------|
| 2 | Approved |

## Navigation

**Previous:** [04-Movement Definitions](./04-MOVEMENT-DEFINITIONS.md)
**Next:** [06-API Endpoints](./06-API-ENDPOINTS.md)
