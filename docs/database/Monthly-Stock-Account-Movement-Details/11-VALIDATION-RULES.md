# 11 - Validation Rules

## Overview

Report ini memiliki berbagai aturan validasi untuk memastikan akurasi data. Aturan-aturan ini penting untuk dipahami karena mempengaruhi hasil report.

## Item Filtering Rules

### 1. Location Filter
```sql
WHERE RTRIM(i.LocCode) = '${scope.location}'
```
**Default:** PTRJ
**Valid characters:** A-Z, 0-9, underscore, hyphen
**Invalid input:** Default ke PTRJ

### 2. Item Status Filter
```sql
AND RTRIM(i.Status) IN ('1', '2')
```
| Status | Meaning | Included |
|--------|---------|----------|
| 1 | Active | ✅ Yes |
| 2 | Inactive | ✅ Yes |
| 3+ | Other | ❌ No |

**Note:** Status '2' (Inactive) tetap diikutsertakan. Ini mengikuti perilaku PDF original yang memiliki opsi "Suppress Zero Balance = No".

### 3. Product Type Filter
```sql
AND RTRIM(ISNULL(i.ProdTypeCode, '')) <> 'DC'
```
**DC** = Direct Charge items, tidak termasuk dalam report.

### 4. Item Type Filter
```sql
AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') IN ('1', '4')
```
| ItemType | Meaning | Included |
|----------|---------|----------|
| 1 | Stock/Gudang | ✅ Yes |
| 4 | Workshop/Mesin | ✅ Yes |
| 2, 3, 5+ | Other | ❌ No |

## Transaction Filtering Rules

### 5. Issue Status Filter
```sql
-- IN_STOCKISSUE
AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
```
| Status | Meaning | Included |
|--------|---------|----------|
| 1 | Draft/Open | ❌ No |
| 2 | Approved | ✅ Yes |
| 5 | Cancelled | ✅ Yes |
| 6 | Posted | ✅ Yes |

**Rationale:** Document yang sudah approved atau posted sudah final dan harus dihitung.

```sql
-- IN_FUELISSUE
AND RTRIM(ISNULL(${alias}.Status, '')) IN ('2', '6')
```
| Status | Meaning | Included |
|--------|---------|----------|
| 2 | Approved | ✅ Yes |
| 6 | Posted | ✅ Yes |

### 6. Goods Receive Status Filter
```sql
AND RTRIM(g.Status) = '2'
```
Only Approved receipts dihitung.

## Classification Rules

### 7. Issue Classification Logic

```typescript
// Non-workshop issue classification
CASE
  WHEN BlkCode IS NULL AND VehCode IS NULL THEN 'Ledger'
  WHEN VehCode IS NULL AND BlkCode IS NOT NULL THEN 'Station'
  WHEN VehCode IS NOT NULL THEN 'Vehicle'
END
```

| BlkCode | VehCode | Classification |
|---------|---------|----------------|
| empty | empty | Ledger |
| has value | empty | Station |
| any | has value | Vehicle |

### 8. Workshop Classification Logic

```typescript
// WS_JOBSTOCK TransType
CASE
  WHEN TransType = '1' AND VehCode IS NULL AND BlkCode IS NULL THEN 'Ledger'
  WHEN TransType = '1' AND VehCode IS NULL AND BlkCode IS NOT NULL THEN 'Station'
  WHEN TransType = '1' AND VehCode IS NOT NULL THEN 'Vehicle'
  WHEN TransType = '2' THEN 'Return'
END
```

### 9. Workshop vs Non-Workshop Split

```sql
-- Non-workshop: exclude ItemType 4
AND (issueItem.ItemCode IS NULL OR issueItem.ItemType <> '4')

-- Workshop: only ItemType 4
AND issueItem.ItemType = '4'
```

## Period Rules

### 10. Accounting Period Conversion

```typescript
// April onwards: fiscal year + 1
const accYear = actualMonth >= 4 ? actualYear + 1 : actualYear
const accMonth = actualMonth - 3
```

### 11. Opening Period Calculation

```typescript
// Previous accounting month
return accMonth <= 1
  ? { accYear: accYear - 1, accMonth: 12 }
  : { accYear, accMonth: accMonth - 1 }
```

### 12. Snapshot Mode Detection

```typescript
// Past period = snapshot mode
const snapshotMode =
  requestedYear < currentYear ||
  (requestedYear === currentYear && requestedMonth < currentMonth)
```

## Amount Calculation Rules

### 13. Issue Amount Fallback

```sql
COALESCE(l.Amount, l.Qty * l.Cost, 0)
```

**Priority:**
1. Amount (direct value)
2. Qty × Cost (calculated)
3. 0 (default)

### 14. Workshop Amount Fallback

```sql
COALESCE(s.Amount, s.PriceAmount, s.Qty * s.Price, 0)
```

**Priority:**
1. Amount
2. PriceAmount
3. Qty × Price
4. 0

### 15. Goods Receive Amount

```sql
StockQty × PU_POLN.Cost
```

**Note:** Jika Cost = NULL, hasil = 0.

### 16. Goods Return Amount

```sql
COALESCE(
  Amount,
  ReturnStockQty × Cost,
  QtyReturn × Cost,
  0
)
```

**Note:** Complex fallback chain untuk handle null values.

## Data Quality Rules

### 17. Suppress Zero Balance
```sql
-- NOT applied in current implementation
-- All items included regardless of zero balance
```
**Note:** PDF original memiliki opsi "Suppress Zero Balance = No", tapi implementasi saat ini tidak menerapkan filter ini.

### 18. Search Sanitization

```typescript
function sanitizeSqlText(value: unknown, max = 80) {
  return String(value ?? '')
    .trim()
    .replace(/'+/g, "''")      // Escape SQL quotes
    .replace(/[%[\]]/g, '')     // Remove LIKE wildcards
    .slice(0, max)              // Limit length
}
```

**Max length:** 120 characters for search

### 19. Number Normalization

```typescript
function numberValue(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : 0
}
```

**Precision:** 2 decimal places

### 20. Null Handling

```sql
-- All movement columns use ISNULL(..., 0)
CAST(ISNULL(a.opening_qty, 0) AS decimal(18, 6)) AS opening_qty
```

## Common Validation Checks

### Check 1: Item Count by Type
```sql
SELECT
  ItemType,
  COUNT(*) AS item_count
FROM IN_ITEM
WHERE LocCode = 'PTRJ'
  AND Status IN ('1', '2')
GROUP BY ItemType
```

Expected:
| ItemType | Count |
|----------|-------|
| 1 | ~280 |
| 4 | ~10 |

### Check 2: Movement Totals Match

```
Opening + In - Out = Closing
Opening(100) + GoodsReceive(50) - Issued(60) + Return(10) = Closing(100)
```

### Check 3: Period Continuity

```
Closing(This Period) = Opening(Next Period)
```

### Check 4: Amount Calculation

```
Qty × AverageCost = Amount
```

### Check 5: Issue vs Workshop Split

```
Total Issued = Non-Workshop Issue + Workshop Issue
IN_STOCKISSUE (ItemType <> 4) + WS_JOBSTOCK (ItemType = 4)
```

## Debugging Checklist

| # | Check | SQL/Command |
|---|-------|-------------|
| 1 | Base item count | `SELECT COUNT(*) FROM IN_ITEM WHERE LocCode = 'PTRJ'` |
| 2 | ItemType distribution | `SELECT ItemType, COUNT(*) FROM IN_ITEM GROUP BY ItemType` |
| 3 | IN_MTHENDITEM exists | `SELECT COUNT(*) FROM IN_MTHENDITEM WHERE AccYear = ? AND AccMonth = ?` |
| 4 | Issue documents | `SELECT COUNT(*) FROM IN_STOCKISSUE WHERE AccYear = ? AND AccMonth = ?` |
| 5 | Workshop jobs | `SELECT COUNT(*) FROM WS_JOBSTOCK WHERE AccYear = ? AND AccMonth = ?` |
| 6 | Goods receive | `SELECT COUNT(*) FROM PU_GOODSRCV WHERE AccYear = ? AND AccMonth = ?` |

## Navigation

**Previous:** [10-Closing Formula](./10-CLOSING-FORMULA.md)
**Next:** [12-Nested Response](./12-NESTED-RESPONSE.md)
