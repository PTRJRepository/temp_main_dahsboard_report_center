# 10 - Closing Formula

## Overview

**Closing Balance** adalah saldo akhir inventory untuk periode tertentu. Report ini mendukung dua sumber closing:

1. **From IN_MTHENDITEM** - Jika snapshot period-end tersedia (snapshot mode)
2. **Reconstructed** - Dihitung dari formula (live mode atau jika snapshot tidak ada)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLOSING CALCULATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              SNAPSHOT MODE (Past Period)                  │  │
│  │                                                          │  │
│  │  IF IN_MTHENDITEM exists for current AccYear/AccMonth   │  │
│  │  THEN Closing = IN_MTHENDITEM.Qty/Amount               │  │
│  │  ELSE Closing = Reconstructed                           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              LIVE MODE (Current Month)                    │  │
│  │                                                          │  │
│  │  Closing = Reconstructed (no month-end snapshot yet)    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Reconstructed Closing Formula

```typescript
ClosingQty =
  opening_qty
  + received_qty          // ⚠️ Placeholder (0)
  + return_advice_qty    // ⚠️ Placeholder (0)
  + transferred_qty       // ⚠️ Placeholder (0)
  + adjustment_qty        // ⚠️ Placeholder (0)
  - ledger_qty           // ✅
  - issued_station_qty   // ✅
  - issued_vehicle_qty    // ✅
  + return_qty            // ✅
  + goods_receive_qty     // ✅
  - goods_return_qty       // ✅
  - dispatch_adv_qty       // ⚠️ Placeholder (0)
```

## Visual Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STOCK MOVEMENT EQUATION                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌───────────────┐                                                   │
│   │   OPENING    │  ← IN_MTHENDITEM previous period                   │
│   │    (O)       │     + Inflows                          │
│   └───────┬───────┘     │                                                   │
│           │             ▼                                                   │
│           │      ┌─────────────────────┐                                  │
│           │      │  (+)  INCOMING     │                                  │
│           │      │                     │                                  │
│           │      │  (+) Received       │ ⚠️ Placeholder                 │
│           │      │  (+) Return Advice │ ⚠️ Placeholder                 │
│           │      │  (+) Transferred   │ ⚠️ Placeholder                 │
│           │      │  (+) Adjustment    │ ⚠️ Placeholder                 │
│           │      │  (+) Goods Receive │ ✅ PU_GOODSRCV                  │
│           │      │  (+) Return       │ ✅ WS_JOBSTOCK.TType=2         │
│           │      └──────────┬──────────┘                                │
│           │                 │                                            │
│           │                 ▼                                            │
│           │      ┌─────────────────────┐                                 │
│           │      │                     │                                 │
│           │      │  (-)  OUTGOING     │                                 │
│           │      │                     │                                 │
│           │      │  (-) Ledger Issue   │ ✅ IN_STOCKISSUE              │
│           │      │  (-) Station Issue  │ ✅ IN_STOCKISSUE              │
│           │      │  (-) Vehicle Issue  │ ✅ IN_STOCKISSUE              │
│           │      │  (-) Goods Return   │ ✅ PU_GOODSRET                 │
│           │      │  (-) Dispatch Adv   │ ⚠️ Placeholder                 │
│           │      └──────────┬──────────┘                                │
│           │                 │                                            │
│           │                 ▼                                            │
│           │      ┌─────────────────────┐                                 │
│           │      │                     │                                 │
│           │      │     CLOSING (C)    │                                 │
│           │      │                     │                                 │
│           │      │  = O + In - Out    │                                 │
│           │      │  = ClosingQty       │                                 │
│           │      └─────────────────────┘                                 │
│           │                                                           │
│           └───────────────────────────────────────────────────────────┘
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## SQL Implementation

### Quantity Closing
```sql
CASE WHEN has_period_closing = 1 THEN period_closing_qty
  ELSE opening_qty
    + received_qty
    + return_advice_qty
    + transferred_qty
    + adjustment_qty
    - ledger_qty
    - issued_station_qty
    - issued_vehicle_qty
    + return_qty
    + goods_receive_qty
    - goods_return_qty
    - dispatch_adv_qty
END AS ClosingQty
```

### Amount Closing
```sql
CASE WHEN has_period_closing = 1 THEN period_closing_amt
  ELSE opening_amt
    + received_amt
    + return_advice_amt
    + transferred_amt
    + adjustment_amt
    - ledger_amt
    - issued_station_amt
    - issued_vehicle_amt
    + return_amt
    + goods_receive_amt
    - goods_return_amt
    - dispatch_adv_amt
END AS ClosingAmount
```

## Closing Source Tracking

```sql
CASE WHEN has_period_closing = 1 THEN 'IN_MTHENDITEM' ELSE 'reconstructed' END AS ClosingSource
```

**Values:**
- `IN_MTHENDITEM` - Closing dari snapshot period-end (snapshot mode)
- `reconstructed` - Closing dihitung dari formula

## Snapshot Availability

### Snapshot Mode Detection
```typescript
const snapshotMode =
  requestedYear < currentYear ||
  (requestedYear === currentYear && requestedMonth < currentMonth)
```

### Period Closing Check
```sql
SELECT
  RTRIM(ItemCode) AS ItemCode,
  CAST(ISNULL(Qty, 0) AS decimal(18,6)) AS period_closing_qty,
  CAST(ISNULL(Amount, ISNULL(Qty, 0) * ISNULL(AverageCost, 0)) AS decimal(18,6)) AS period_closing_amt
FROM [${database}].[dbo].[IN_MTHENDITEM]
WHERE RTRIM(LocCode) = '${scope.location}'
  AND RTRIM(CONVERT(varchar(10), AccYear)) = '${scope.accYear}'
  AND RTRIM(CONVERT(varchar(10), AccMonth)) = '${scope.accMonth}'
```

### Has Period Closing Flag
```sql
CASE WHEN pc.ItemCode IS NULL THEN 0 ELSE 1 END AS has_period_closing
```

## Practical Examples

### Example 1: Full Implementation
```
Opening     = 100
Received    = 0       (placeholder)
ReturnAdv   = 0       (placeholder)
Transferred= 0       (placeholder)
Adjustment  = 0       (placeholder)
Issued:
  Ledger    = 20
  Station    = 30
  Vehicle    = 10
Return      = 5
GoodsRecv   = 50
GoodsRet    = 2
DispatchAdv = 0       (placeholder)

Closing = 100 + 0 + 0 + 0 + 0 - 20 - 30 - 10 + 5 + 50 - 2 - 0
        = 93
```

### Example 2: With Goods Return
```
Opening     = 200
GoodsRecv   = 100
GoodsRet    = 15
Issued:
  Ledger    = 50
  Station    = 25

Closing = 200 + 100 - 15 - 50 - 25
        = 210
```

## Verification

Closing balance dapat diverifikasi dengan:

1. **Snapshot comparison** - Jika IN_MTHENDITEM tersedia, bandingkan
2. **Cross-period validation** - Closing bulan ini = Opening bulan depan
3. **Balance equation** - Opening + Movement In - Movement Out = Closing

```sql
-- Verify: Closing should equal next period's Opening
SELECT
  curr.ItemCode,
  curr.ClosingQty AS this_period_closing,
  next.OpeningQty AS next_period_opening,
  CASE WHEN curr.ClosingQty <> next.OpeningQty THEN 'MISMATCH' ELSE 'OK' END AS status
FROM report_rows curr
LEFT JOIN (
  SELECT ItemCode, opening_qty AS OpeningQty
  FROM movements
  WHERE ... -- next period
) next ON curr.ItemCode = next.ItemCode
```

## Navigation

**Previous:** [09-Goods Receive](./09-GOODS-RECEIVE.md)
**Next:** [11-Validation Rules](./11-VALIDATION-RULES.md)
