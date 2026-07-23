# 03 - SQL CTE Structure

## Overview

SQL query menggunakan **Common Table Expressions (CTE)** dengan struktur bertingkat untuk menghitung semua movement per item. Struktur ini memungkinkan modularitas dan reusable base query.

## CTE Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                    FINAL CTE HIERARCHY                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐                                                   │
│  │  base   │  ← Item master + snapshot/in_live hybrid        │
│  └────┬────┘                                                   │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────────────┐                                          │
│  │   movements     │  ← Opening + All transaction unions        │
│  └────┬───────────┘                                          │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────┐                                                   │
│  │   agg   │  ← SUM semua movement per ItemCode                │
│  └────┬────┘                                                   │
│       │                                                        │
│       ▼                                                        │
│  ┌──────────────┐                                             │
│  │period_closing│  ← Closing balance dari IN_MTHENDITEM       │
│  └──────┬───────┘                                             │
│          │                                                      │
│          ▼                                                      │
│  ┌─────────┐                                                   │
│  │  final  │  ← Base + aggregated movements + closing         │
│  └────┬────┘                                                   │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────────┐                                              │
│  │report_rows  │  ← Final output dengan semua kolom           │
│  └─────────────┘                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## CTE 1: base

**Purpose:** Item master dengan saldo saat ini (snapshot atau live)

**Snapshot Mode (Periode Lampau):**
```sql
WITH base AS (
  -- Snapshot: dari IN_MTHENDITEM periode ini
  SELECT
    m.ItemCode,
    m.Description,
    i.UOMCode AS UOM,
    m.LocCode AS Location,
    i.ProdTypeCode,
    pt.Description AS ProductTypeDescription,
    CAST(ISNULL(m.Qty, 0) AS decimal(18,6)) AS QtyOnHand,
    CAST(0 AS decimal(18,6)) AS QtyOnHold,
    CAST(ISNULL(m.AverageCost, 0) AS decimal(18,6)) AS AverageCost,
    CAST(ISNULL(m.Amount, ISNULL(m.Qty, 0) * ISNULL(m.AverageCost, 0)) AS decimal(18,6)) AS OnHandHoldAmount
  FROM [${database}].[dbo].[IN_MTHENDITEM] m
  LEFT JOIN [${database}].[dbo].[IN_ITEM] i ON i.ItemCode = m.ItemCode AND i.LocCode = m.LocCode
  LEFT JOIN [${database}].[dbo].[IN_PRODTYPE] pt ON pt.ProdTypeCode = i.ProdTypeCode
  WHERE m.LocCode = '${scope.location}'
    AND m.AccYear = '${scope.accYear}'
    AND m.AccMonth = '${scope.accMonth}'

  UNION ALL

  -- Items di IN_ITEM tapi belum ada di IN_MTHENDITEM bulan ini
  SELECT
    i.ItemCode,
    i.Description,
    i.UOMCode,
    i.LocCode,
    i.ProdTypeCode,
    pt.Description,
    CAST(0 AS decimal(18,6)) AS QtyOnHand,
    CAST(0 AS decimal(18,6)) AS QtyOnHold,
    CAST(0 AS decimal(18,6)) AS AverageCost,
    CAST(0 AS decimal(18,6)) AS OnHandHoldAmount
  FROM [${database}].[dbo].[IN_ITEM] i
  LEFT JOIN [${database}].[dbo].[IN_PRODTYPE] pt ON pt.ProdTypeCode = i.ProdTypeCode
  WHERE i.LocCode = '${scope.location}'
    AND i.Status IN ('1', '2')
    AND i.ItemType IN ('1', '4')
    AND i.ProdTypeCode <> 'DC'
    AND NOT EXISTS (
      SELECT 1 FROM [${database}].[dbo].[IN_MTHENDITEM] mx
      WHERE mx.ItemCode = i.ItemCode
        AND mx.LocCode = i.LocCode
        AND mx.AccYear = '${scope.accYear}'
        AND mx.AccMonth = '${scope.accMonth}'
    )
)
```

**Live Mode (Bulan Berjalan):**
```sql
WITH base AS (
  SELECT
    i.ItemCode,
    i.Description,
    i.UOMCode AS UOM,
    i.LocCode AS Location,
    i.ProdTypeCode,
    pt.Description AS ProductTypeDescription,
    CAST(ISNULL(i.QtyOnHand, 0) AS decimal(18,6)) AS QtyOnHand,
    CAST(ISNULL(i.QtyOnHold, 0) AS decimal(18,6)) AS QtyOnHold,
    CAST(ISNULL(i.AverageCost, 0) AS decimal(18,6)) AS AverageCost,
    CAST((ISNULL(i.QtyOnHand, 0) + ISNULL(i.QtyOnHold, 0)) * ISNULL(i.AverageCost, 0) AS decimal(18,6)) AS OnHandHoldAmount
  FROM [${database}].[dbo].[IN_ITEM] i
  LEFT JOIN [${database}].[dbo].[IN_PRODTYPE] pt ON pt.ProdTypeCode = i.ProdTypeCode
  WHERE i.LocCode = '${scope.location}'
    AND i.Status IN ('1', '2')
    AND i.ItemType IN ('1', '4')
    AND i.ProdTypeCode <> 'DC'
)
```

## CTE 2: movements

**Purpose:** Menghitung semua movement transaction per ItemCode

### Union 1: Opening from IN_MTHENDITEM (Previous Period)
```sql
SELECT
  RTRIM(ItemCode) AS ItemCode,
  Qty AS opening_qty,
  CAST(ISNULL(Amount, ISNULL(Qty, 0) * ISNULL(AverageCost, 0)) AS decimal(18,6)) AS opening_amt,
  0 AS received_qty, 0 AS received_amt,
  0 AS return_advice_qty, 0 AS return_advice_amt,
  0 AS transferred_qty, 0 AS transferred_amt,
  0 AS adjustment_qty, 0 AS adjustment_amt,
  -- Issued columns (initialized to 0)
  0 AS ledger_qty, 0 AS ledger_amt,
  0 AS issued_station_qty, 0 AS issued_station_amt,
  0 AS issued_vehicle_qty, 0 AS issued_vehicle_amt,
  -- Return
  0 AS return_qty, 0 AS return_amt,
  -- Purchasing
  0 AS goods_receive_qty, 0 AS goods_receive_amt,
  0 AS goods_return_qty, 0 AS goods_return_amt,
  0 AS dispatch_adv_qty, 0 AS dispatch_adv_amt
FROM [${database}].[dbo].[IN_MTHENDITEM]
WHERE LocCode = '${scope.location}'
  AND AccYear = '${scope.openingAccYear}'
  AND AccMonth = '${scope.openingAccMonth}'
```

### Union 2: IN_STOCKISSUE (Non-Workshop Ledger/Station/Vehicle)
```sql
SELECT
  RTRIM(l.ItemCode),
  -- All 0 except...
  CASE WHEN BlkCode IS NULL AND VehCode IS NULL THEN l.Qty ELSE 0 END AS ledger_qty,
  CASE WHEN BlkCode IS NULL AND VehCode IS NULL THEN COALESCE(l.Amount, l.Qty * l.Cost) ELSE 0 END AS ledger_amt,
  CASE WHEN VehCode IS NULL AND BlkCode IS NOT NULL THEN l.Qty ELSE 0 END AS issued_station_qty,
  CASE WHEN VehCode IS NULL AND BlkCode IS NOT NULL THEN COALESCE(l.Amount, l.Qty * l.Cost) ELSE 0 END AS issued_station_amt,
  CASE WHEN VehCode IS NOT NULL THEN l.Qty ELSE 0 END AS issued_vehicle_qty,
  CASE WHEN VehCode IS NOT NULL THEN COALESCE(l.Amount, l.Qty * l.Cost) ELSE 0 END AS issued_vehicle_amt,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0
FROM [${database}].[dbo].[IN_STOCKISSUE] h
JOIN [${database}].[dbo].[IN_STOCKISSUELN] l ON h.StockIssueID = l.StockIssueID
LEFT JOIN [${database}].[dbo].[IN_ITEM] issueItem ON issueItem.ItemCode = l.ItemCode AND issueItem.LocCode = h.LocCode
WHERE h.LocCode = '${scope.location}'
  AND h.AccYear = '${scope.accYear}'
  AND h.AccMonth = '${scope.accMonth}'
  AND h.Status IN ('2', '5', '6')
  AND (issueItem.ItemCode IS NULL OR issueItem.ItemType <> '4')
```

### Union 3: IN_FUELISSUE (BBM Issue)
```sql
SELECT
  RTRIM(l.ItemCode),
  -- Same classification as IN_STOCKISSUE
  CASE WHEN BlkCode IS NULL AND VehCode IS NULL THEN l.Qty ELSE 0 END AS ledger_qty,
  ...
FROM [${database}].[dbo].[IN_FUELISSUE] h
JOIN [${database}].[dbo].[IN_FUELISSUELN] l ON h.FuelIssueID = l.FuelIssueID
LEFT JOIN [${database}].[dbo].[IN_ITEM] issueItem ON issueItem.ItemCode = l.ItemCode AND issueItem.LocCode = h.LocCode
WHERE h.LocCode = '${scope.location}'
  AND h.AccYear = '${scope.accYear}'
  AND h.AccMonth = '${scope.accMonth}'
  AND h.Status IN ('2', '6')
  AND (issueItem.ItemCode IS NULL OR issueItem.ItemType <> '4')
```

### Union 4: WS_JOBSTOCK (Workshop Issue/Return)
```sql
SELECT
  RTRIM(s.ItemCode),
  -- Issue Ledger: TransType=1, no vehicle, no block
  CASE WHEN TransType = '1' AND VehCode IS NULL AND BlkCode IS NULL THEN s.Qty ELSE 0 END AS ledger_qty,
  -- Issue Station: TransType=1, no vehicle, has block
  CASE WHEN TransType = '1' AND VehCode IS NULL AND BlkCode IS NOT NULL THEN s.Qty ELSE 0 END AS issued_station_qty,
  -- Issue Vehicle: TransType=1, has vehicle
  CASE WHEN TransType = '1' AND VehCode IS NOT NULL THEN s.Qty ELSE 0 END AS issued_vehicle_qty,
  -- Return: TransType=2
  CASE WHEN TransType = '2' THEN s.Qty ELSE 0 END AS return_qty,
  0, 0, 0, 0, 0, 0, 0, 0
FROM [${database}].[dbo].[WS_JOBSTOCK] s
LEFT JOIN [${database}].[dbo].[WS_JOB] j ON s.JobID = j.JobID
LEFT JOIN [${database}].[dbo].[IN_ITEM] issueItem ON issueItem.ItemCode = s.ItemCode AND issueItem.LocCode = s.LocCode
WHERE s.LocCode = '${scope.location}'
  AND s.AccYear = '${scope.accYear}'
  AND s.AccMonth = '${scope.accMonth}'
  AND (issueItem.ItemType = '4' OR issueItem.ItemCode IS NULL)
```

### Union 5: PU_GOODSRCV (Goods Receive)
```sql
SELECT
  RTRIM(gl.ItemCode),
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ISNULL(gl.StockQty, 0) AS goods_receive_qty,
  CAST(ISNULL(gl.StockQty, 0) * ISNULL(p.Cost, 0) AS decimal(18,6)) AS goods_receive_amt,
  0, 0, 0, 0
FROM [${database}].[dbo].[PU_GOODSRCV] g
JOIN [${database}].[dbo].[PU_GOODSRCVLN] gl ON g.GoodsRcvID = gl.GoodsRcvID
LEFT JOIN [${database}].[dbo].[PU_POLN] p ON gl.POLnID = p.POLnID
WHERE g.LocCode = '${scope.location}'
  AND g.AccYear = '${scope.accYear}'
  AND g.AccMonth = '${scope.accMonth}'
  AND g.Status = '2'
```

### Union 6: PU_GOODSRET (Goods Return)
```sql
SELECT
  RTRIM(grl.ItemCode),
  -- All 0 except goods_return
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  COALESCE(NULLIF(grl.ReturnStockQty, 0), grl.QtyReturn, 0) AS goods_return_qty,
  CAST(COALESCE(
    NULLIF(grl.Amount, 0),
    COALESCE(NULLIF(grl.ReturnStockQty, 0), grl.QtyReturn, 0) * COALESCE(NULLIF(grl.Cost, 0), p.Cost, 0),
    0
  ) AS decimal(18,6)) AS goods_return_amt,
  0, 0
FROM [${database}].[dbo].[PU_GOODSRET] gr
JOIN [${database}].[dbo].[PU_GOODSRETLN] grl ON gr.GoodsRetId = grl.GoodsRetId
LEFT JOIN [${database}].[dbo].[PU_POLN] p ON grl.POLnID = p.POLnID
WHERE gr.LocCode = '${scope.location}'
  AND gr.AccYear = '${scope.accYear}'
  AND gr.AccMonth = '${scope.accMonth}'
  AND gr.Status = '2'
```

## CTE 3: agg (Aggregation)

```sql
agg AS (
  SELECT
    ItemCode,
    SUM(opening_qty) AS opening_qty,
    SUM(opening_amt) AS opening_amt,
    SUM(received_qty) AS received_qty,
    SUM(received_amt) AS received_amt,
    -- ... all other movement columns
    SUM(goods_receive_qty) AS goods_receive_qty,
    SUM(goods_receive_amt) AS goods_receive_amt,
    SUM(goods_return_qty) AS goods_return_qty,
    SUM(goods_return_amt) AS goods_return_amt,
    SUM(dispatch_adv_qty) AS dispatch_adv_qty,
    SUM(dispatch_adv_amt) AS dispatch_adv_amt
  FROM movements
  GROUP BY ItemCode
)
```

## CTE 4: period_closing

```sql
period_closing AS (
  SELECT
    RTRIM(ItemCode) AS ItemCode,
    CAST(ISNULL(Qty, 0) AS decimal(18,6)) AS period_closing_qty,
    CAST(ISNULL(Amount, ISNULL(Qty, 0) * ISNULL(AverageCost, 0)) AS decimal(18,6)) AS period_closing_amt
  FROM [${database}].[dbo].[IN_MTHENDITEM]
  WHERE RTRIM(LocCode) = '${scope.location}'
    AND RTRIM(CONVERT(varchar(10), AccYear)) = '${scope.accYear}'
    AND RTRIM(CONVERT(varchar(10), AccMonth)) = '${scope.accMonth}'
)
```

## CTE 5: final

```sql
final AS (
  SELECT
    b.Location,
    b.ProductTypeCode,
    b.ProductTypeDescription,
    ROW_NUMBER() OVER (PARTITION BY b.ProductTypeCode ORDER BY b.ItemCode) AS RowNo,
    b.ItemCode,
    b.Description,
    b.UOM,
    b.QtyOnHand,
    b.QtyOnHold,
    b.AverageCost,
    b.OnHandHoldAmount,
    -- All movement columns from agg (with ISNULL to 0)
    -- Period closing from period_closing CTE
    CASE WHEN pc.ItemCode IS NULL THEN 0 ELSE 1 END AS has_period_closing
  FROM base b
  LEFT JOIN agg a ON a.ItemCode = b.ItemCode
  LEFT JOIN period_closing pc ON pc.ItemCode = b.ItemCode
)
```

## CTE 6: report_rows

```sql
report_rows AS (
  SELECT
    -- Metadata
    '${scope.actualPeriod}' AS ActualPeriod,
    '${scope.accountingPeriod}' AS AccountingPeriod,
    Location,
    ProductTypeCode,
    ProductTypeDescription,
    RowNo AS [No],
    ItemCode,
    Description AS ItemDescription,
    UOM,
    -- Balance columns
    QtyOnHand,
    QtyOnHold,
    QtyOnHand + QtyOnHold AS QtyOnHandHold,
    AverageCost,
    OnHandHoldAmount,
    -- All movement quantities
    opening_qty AS OpeningQty,
    received_qty AS ReceivedQty,
    -- ...
    -- Computed issued total
    ledger_qty + issued_station_qty + issued_vehicle_qty AS IssuedTotalQty,
    ledger_amt + issued_station_amt + issued_vehicle_amt AS IssuedTotalAmount,
    -- Closing calculation
    CASE WHEN has_period_closing = 1 THEN period_closing_qty
      ELSE opening_qty + received_qty + return_advice_qty + transferred_qty + adjustment_qty
        - (ledger_qty + issued_station_qty + issued_vehicle_qty)
        + return_qty + goods_receive_qty - goods_return_qty - dispatch_adv_qty
    END AS ClosingQty,
    CASE WHEN has_period_closing = 1 THEN period_closing_amt
      ELSE opening_amt + received_amt + return_advice_amt + transferred_amt + adjustment_amt
        - (ledger_amt + issued_station_amt + issued_vehicle_amt)
        + return_amt + goods_receive_amt - goods_return_amt - dispatch_adv_amt
    END AS ClosingAmount,
    CASE WHEN has_period_closing = 1 THEN 'IN_MTHENDITEM' ELSE 'reconstructed' END AS ClosingSource
  FROM final
)
```

## Final Output Query

```sql
${cte}
SELECT TOP ${limit} *
FROM report_rows
ORDER BY ProductTypeCode, ItemCode
```

## Navigation

**Previous:** [02-Tables Reference](./02-TABLES-REFERENCE.md)
**Next:** [04-Movement Definitions](./04-MOVEMENT-DEFINITIONS.md)
