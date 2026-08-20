# 08 - Workshop Items

## Overview

**Workshop Items** adalah item inventory dengan `ItemType = '4'` yang digunakan untuk operasional workshop/mesin. Item ini ditangani berbeda dari item stock biasa karena:

1. **Transaksi berbeda** - Pakai `WS_JOBSTOCK` bukan `IN_STOCKISSUE`
2. **TransType classification** - 1=Issue, 2=Return
3. **Vehicle/Block context** - Issue ke kendaraan atau station

```
┌─────────────────────────────────────────────────────────────────┐
│              ITEM TYPE CLASSIFICATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    IN_ITEM.ItemType                      │  │
│  └───────────────────────┬─────────────────────────────────┘  │
│                          │                                       │
│          ┌───────────────┼───────────────┐                     │
│          ▼               ▼               ▼                     │
│    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│    │    1    │    │    2     │    │    4     │              │
│    │  STOCK  │    │  ASSET   │    │ WORKSHOP │              │
│    │          │    │          │    │          │              │
│    │ IN_     │    │ (not     │    │ WS_      │              │
│    │ STOCKISSUE│   │ used)    │    │ JOBSTOCK │              │
│    └──────────┘    └──────────┘    └──────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## ItemType Filter

```typescript
function inventoryValuationItemTypeFilter(alias: string) {
  // Scope: ItemType 1 (Stock) dan 4 (Workshop)
  return `AND ISNULL(RTRIM(CONVERT(varchar(10), ${alias}.ItemType)), '') IN ('1', '4')`
}
```

**Included:**
- ItemType `1` - Stock/Gudang items
- ItemType `4` - Workshop/Mesin items

**Excluded:**
- ItemType `2`, `3`, `5`, etc.

## WS_JOBSTOCK Table Structure

| Column | Type | Description |
|--------|------|-------------|
| `JobStockID` | int | Primary key |
| `JobID` | int | FK to WS_JOB |
| `LocCode` | varchar | Location |
| `ItemCode` | varchar | Part/spare item used |
| `TransType` | varchar | 1=Issue, 2=Return |
| `Qty` | decimal | Quantity |
| `Amount` | decimal | Total value |
| `PriceAmount` | decimal | Alternative price field |
| `Price` | decimal | Unit price |
| `AccYear` | int | Accounting year |
| `AccMonth` | int | Accounting month |
| `CreateDate` | datetime | Creation timestamp |
| `UpdateDate` | datetime | Last update timestamp |

## WS_JOB Table Structure

| Column | Type | Description |
|--------|------|-------------|
| `JobID` | int | Primary key |
| `VehCode` | varchar | Vehicle code (empty if not vehicle job) |
| `BlkCode` | varchar | Block/station code |
| `JobDate` | datetime | Job date |
| `Status` | varchar | Job status |

## Workshop Movement Classification

```
┌─────────────────────────────────────────────────────────────────┐
│           WS_JOBSTOCK MOVEMENT CLASSIFICATION                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  WS_JOBSTOCK.TransType = '1' (Issue)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │  BlkCode = empty AND VehCode = empty               │ │  │
│  │  │  → LEDGER (General ledger issue)                   │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │  BlkCode = has_value AND VehCode = empty          │ │  │
│  │  │  → STATION (Cost center issue to station/block)   │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │  VehCode = has_value (any BlkCode)                 │ │  │
│  │  │  → VEHICLE (Vehicle expense)                      │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  WS_JOBSTOCK.TransType = '2' (Return)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  → RETURN (Return from operational to inventory)         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## SQL Classification

### Issue Ledger (No Block, No Vehicle)
```sql
CASE WHEN RTRIM(ISNULL(s.TransType, '')) = '1'
     AND LEN(RTRIM(ISNULL(j.VehCode, ''))) = 0
     AND LEN(RTRIM(ISNULL(j.BlkCode, ''))) = 0
     THEN ISNULL(s.Qty, 0) ELSE 0 END AS ledger_qty
```

### Issue Station (Has Block, No Vehicle)
```sql
CASE WHEN RTRIM(ISNULL(s.TransType, '')) = '1'
     AND LEN(RTRIM(ISNULL(j.VehCode, ''))) = 0
     AND LEN(RTRIM(ISNULL(j.BlkCode, ''))) > 0
     THEN ISNULL(s.Qty, 0) ELSE 0 END AS issued_station_qty
```

### Issue Vehicle (Has Vehicle)
```sql
CASE WHEN RTRIM(ISNULL(s.TransType, '')) = '1'
     AND LEN(RTRIM(ISNULL(j.VehCode, ''))) > 0
     THEN ISNULL(s.Qty, 0) ELSE 0 END AS issued_vehicle_qty
```

### Return
```sql
CASE WHEN RTRIM(ISNULL(s.TransType, '')) = '2'
     THEN ISNULL(s.Qty, 0) ELSE 0 END AS return_qty
```

## Complete WS_JOBSTOCK Union

```sql
SELECT
  RTRIM(s.ItemCode),
  -- Ledger: TransType=1, no vehicle, no block
  CASE WHEN TransType = '1' AND VehCode IS NULL AND BlkCode IS NULL THEN s.Qty ELSE 0 END,
  CASE WHEN TransType = '1' AND VehCode IS NULL AND BlkCode IS NULL
       THEN COALESCE(s.Amount, s.PriceAmount, s.Qty * s.Price, 0) ELSE 0 END,
  -- Station: TransType=1, no vehicle, has block
  CASE WHEN TransType = '1' AND VehCode IS NULL AND BlkCode IS NOT NULL THEN s.Qty ELSE 0 END,
  CASE WHEN TransType = '1' AND VehCode IS NULL AND BlkCode IS NOT NULL
       THEN COALESCE(s.Amount, s.PriceAmount, s.Qty * s.Price, 0) ELSE 0 END,
  -- Vehicle: TransType=1, has vehicle
  CASE WHEN TransType = '1' AND VehCode IS NOT NULL THEN s.Qty ELSE 0 END,
  CASE WHEN TransType = '1' AND VehCode IS NOT NULL
       THEN COALESCE(s.Amount, s.PriceAmount, s.Qty * s.Price, 0) ELSE 0 END,
  -- Return: TransType=2
  CASE WHEN TransType = '2' THEN s.Qty ELSE 0 END,
  CASE WHEN TransType = '2'
       THEN COALESCE(s.Amount, s.PriceAmount, s.Qty * s.Price, 0) ELSE 0 END,
  0, 0, 0, 0, 0, 0
FROM [${database}].[dbo].[WS_JOBSTOCK] s
LEFT JOIN [${database}].[dbo].[WS_JOB] j ON s.JobID = j.JobID
LEFT JOIN [${database}].[dbo].[IN_ITEM] issueItem ON issueItem.ItemCode = s.ItemCode AND issueItem.LocCode = s.LocCode
WHERE s.LocCode = '${scope.location}'
  AND s.AccYear = '${scope.accYear}'
  AND s.AccMonth = '${scope.accMonth}'
  AND issueItem.ItemType = '4'
```

## Workshop vs Non-Workshop Split

```
┌─────────────────────────────────────────────────────────────────┐
│               ITEM TYPE PROCESSING SPLIT                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  IN_STOCKISSUE / IN_FUELISSUE                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  LEFT JOIN IN_ITEM issueItem                             │  │
│  │  WHERE issueItem.ItemType <> '4' OR issueItem IS NULL   │  │
│  │  → Excludes Workshop items from non-workshop issue      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  WS_JOBSTOCK                                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  LEFT JOIN IN_ITEM issueItem                             │  │
│  │  WHERE issueItem.ItemType = '4'                         │  │
│  │  → Only Workshop items                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Amount Calculation

Workshop uses multiple price fields with COALESCE fallback:

```sql
COALESCE(s.Amount, s.PriceAmount, ISNULL(s.Qty, 0) * ISNULL(s.Price, 0), 0)
```

**Priority:**
1. `s.Amount` - Direct amount
2. `s.PriceAmount` - Alternative price
3. `s.Qty * s.Price` - Quantity × Unit Price
4. `0` - Default if all null

## Filtering

```sql
WHERE s.LocCode = '${scope.location}'
  AND s.AccYear = '${scope.accYear}'
  AND s.AccMonth = '${scope.accMonth}'
  AND issueItem.ItemType = '4'
  ${transactionAsOfFilter('s', scope.transactionAsOf)}
```

**Note:** `WS_JOBSTOCK` tidak memiliki `Status` column, jadi tidak difilter seperti `IN_STOCKISSUE`.

## Navigation

**Previous:** [07-Accounting Period](./07-ACCOUNTING-PERIOD.md)
**Next:** [09-Goods Receive](./09-GOODS-RECEIVE.md)
