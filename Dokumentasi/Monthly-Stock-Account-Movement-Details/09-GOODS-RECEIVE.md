# 09 - Goods Receive

## Overview

**Goods Receive** adalah transaksi penerimaan barang dari supplier purchasing. Valuasi dilakukan dengan mengalikan quantity received dengan unit cost dari Purchase Order.

```
┌─────────────────────────────────────────────────────────────────┐
│                    GOODS RECEIVE FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │   PO     │    │ GOODS RECEIVE │    │   INVENTORY      │   │
│  │  (PO)    │    │   (GR/SJ)     │    │   UPDATE         │   │
│  │          │    │              │    │                  │   │
│  │ PU_POLN  │◄───┤ PU_GOODSRCV  │    │ IN_ITEM         │   │
│  │ .Cost    │    │ .StockQty    │    │ .QtyOnHand ↑    │   │
│  └──────────┘    └──────────────┘    └──────────────────┘   │
│                        │                                      │
│                        ▼                                      │
│              ┌──────────────────┐                             │
│              │   VALUATION      │                             │
│              │                  │                             │
│              │ Amount = Qty ×   │                             │
│              │        PO Cost   │                             │
│              └──────────────────┘                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Tables Involved

### PU_GOODSRCV (Goods Receive Header)
| Column | Type | Description |
|--------|------|-------------|
| `GoodsRcvID` | int | Primary key |
| `LocCode` | varchar | Location code |
| `SupplierCode` | varchar | Supplier identifier |
| `PONo` | varchar | PO reference |
| `AccYear` | int | Accounting year |
| `AccMonth` | int | Accounting month |
| `Status` | varchar | 2=Approved |
| `CreateDate` | datetime | Creation date |
| `UpdateDate` | datetime | Last update |

### PU_GOODSRCVLN (Goods Receive Line)
| Column | Type | Description |
|--------|------|-------------|
| `GoodsRcvLnID` | int | Primary key |
| `GoodsRcvID` | int | FK to header |
| `ItemCode` | varchar | Received item |
| `POLnID` | int | FK to PO Line (for cost lookup) |
| `StockQty` | decimal | Quantity received |
| `Qty` | decimal | Alternative qty field |

### PU_POLN (Purchase Order Line)
| Column | Type | Description |
|--------|------|-------------|
| `POLnID` | int | Primary key |
| `ItemCode` | varchar | PO item |
| `Cost` | decimal | Unit cost from PO |
| `Qty` | decimal | PO quantity |

## Valuation Formula

```sql
GoodsReceiveQty = PU_GOODSRCVLN.StockQty
GoodsReceiveAmt = StockQty × PU_POLN.Cost
```

**SQL:**
```sql
SELECT
  RTRIM(gl.ItemCode),
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ISNULL(gl.StockQty, 0) AS goods_receive_qty,
  CAST(ISNULL(gl.StockQty, 0) * ISNULL(p.Cost, 0) AS decimal(18, 6)) AS goods_receive_amt,
  0, 0, 0, 0
FROM [${database}].[dbo].[PU_GOODSRCV] g
JOIN [${database}].[dbo].[PU_GOODSRCVLN] gl ON g.GoodsRcvID = gl.GoodsRcvID
LEFT JOIN [${database}].[dbo].[PU_POLN] p ON gl.POLnID = p.POLnID
WHERE g.LocCode = '${scope.location}'
  AND g.AccYear = '${scope.accYear}'
  AND g.AccMonth = '${scope.accMonth}'
  AND g.Status = '2'
```

## Filters Applied

| Filter | Condition | Reason |
|--------|-----------|--------|
| `LocCode` | `= scope.location` | Same location |
| `AccYear` | `= scope.accYear` | Current accounting year |
| `AccMonth` | `= scope.accMonth` | Current accounting month |
| `Status` | `= '2'` | Only Approved receipts |

## Transaction As-Of

```sql
${transactionAsOfFilter('g', scope.transactionAsOf)}
```

Applied as:
```sql
AND COALESCE(g.UpdateDate, g.CreateDate) <= CONVERT(datetime, '${transactionAsOf}', 126)
```

## Goods Return (Retur Pembelian)

Goods Return mengurangi closing stock karena barang dikembalikan ke supplier.

### PU_GOODSRET Structure
| Column | Type | Description |
|--------|------|-------------|
| `GoodsRetId` | int | Primary key |
| `LocCode` | varchar | Location |
| `AccYear` | int | Accounting year |
| `AccMonth` | int | Accounting month |
| `Status` | varchar | 2=Approved |

### PU_GOODSRETLN Structure
| Column | Type | Description |
|--------|------|-------------|
| `GoodsRetId` | int | FK to header |
| `ItemCode` | varchar | Returned item |
| `QtyReturn` | decimal | Quantity returned |
| `ReturnStockQty` | decimal | Stock return qty |
| `Amount` | decimal | Return value |
| `Cost` | decimal | Unit cost |
| `POLnID` | int | FK to PO Line |

### Goods Return Valuation (Complex Fallback)

```sql
GoodsReturnQty = COALESCE(
  NULLIF(ReturnStockQty, 0),
  QtyReturn,
  0
)

GoodsReturnAmt = COALESCE(
  NULLIF(Amount, 0),
  COALESCE(NULLIF(ReturnStockQty, 0), QtyReturn, 0)
    * COALESCE(NULLIF(Cost, 0), p.Cost, 0),
  0
)
```

**Fallback Chain:**
1. Use `Amount` if not null/zero
2. Calculate: `ReturnStockQty × Cost`
3. Calculate: `QtyReturn × Cost`
4. Calculate: `ReturnStockQty × PO.Cost` (via POLnID)
5. Calculate: `QtyReturn × PO.Cost`
6. Default to 0

**SQL:**
```sql
SELECT
  RTRIM(grl.ItemCode),
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  COALESCE(NULLIF(grl.ReturnStockQty, 0), grl.QtyReturn, 0) AS goods_return_qty,
  CAST(COALESCE(
    NULLIF(grl.Amount, 0),
    COALESCE(NULLIF(grl.ReturnStockQty, 0), grl.QtyReturn, 0)
      * COALESCE(NULLIF(grl.Cost, 0), p.Cost, 0),
    0
  ) AS decimal(18, 6)) AS goods_return_amt,
  0, 0
FROM [${database}].[dbo].[PU_GOODSRET] gr
JOIN [${database}].[dbo].[PU_GOODSRETLN] grl ON gr.GoodsRetId = grl.GoodsRetId
LEFT JOIN [${database}].[dbo].[PU_POLN] p ON grl.POLnID = p.POLnID
WHERE gr.LocCode = '${scope.location}'
  AND gr.AccYear = '${scope.accYear}'
  AND gr.AccMonth = '${scope.accMonth}'
  AND gr.Status = '2'
```

## Goods Receive vs Goods Return

```
┌─────────────────────────────────────────────────────────────────┐
│         GOODS RECEIVE vs GOODS RETURN IMPACT                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GOODS RECEIVE                                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Opening  +  GoodsReceive  -  GoodsReturn  -  Issued   │  │
│  │    │              ▲                │            │       │  │
│  │    │              │                │            │       │  │
│  │    ▼              │                ▼            ▼       │  │
│  │  +N              +Q               -Q           -Q       │  │
│  │                                                     Closing │  │
│  │                                                     ▲    │  │
│  └─────────────────────────────────────────────────────┼────┘  │
│                                                                 │
│  GOODS RETURN (Negative impact on closing)                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Closing = Opening + In - Out + Return + Receive - Return │  │
│  │             │          │     │     │         │               │  │
│  │             ▼          ▼     │     ▼         │               │  │
│  │             N           Q    │     R         G               │  │
│  │                               │                                   │  │
│  │                    GoodsReturn decreases closing                │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Navigation

**Previous:** [08-Workshop Items](./08-WORKSHOP-ITEMS.md)
**Next:** [10-Closing Formula](./10-CLOSING-FORMULA.md)
