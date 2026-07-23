# 02 - Tables Reference

## Master Tables

### IN_ITEM (Base Item Master)
**Purpose:** Source utama untuk daftar item inventory

| Column | Type | Usage |
|--------|------|-------|
| `ItemCode` | varchar | Primary key per location |
| `LocCode` | varchar | Location filter (e.g., PTRJ) |
| `Description` | varchar | Item name |
| `UOMCode` | varchar | Unit of measure |
| `ProdTypeCode` | varchar | Product type classification |
| `ItemType` | varchar | 1=Stock, 4=Workshop |
| `Status` | varchar | 1=Active, 2=Inactive |
| `StockAnalysisCode` | varchar | DEADS/MEMOV/SLMOV (deprecated) |
| `QtyOnHand` | decimal | Current stock quantity |
| `QtyOnHold` | decimal | Stock on hold |
| `AverageCost` | decimal | Average cost per unit |

```sql
-- Filter applied in base CTE
WHERE RTRIM(i.LocCode) = 'PTRJ'
  AND RTRIM(i.Status) IN ('1', '2')
  AND RTRIM(ISNULL(i.ProdTypeCode, '')) <> 'DC'
  -- ItemType 1 (Stock) dan 4 (Workshop)
  AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') IN ('1', '4')
```

---

### IN_PRODTYPE (Product Type)
**Purpose:** Lookup deskripsi untuk ProductTypeCode

| Column | Type | Usage |
|--------|------|-------|
| `ProdTypeCode` | varchar | Code |
| `Description` | varchar | Deskripsi product type |

```sql
LEFT JOIN [${database}].[dbo].[IN_PRODTYPE] pt
  ON pt.ProdTypeCode = i.ProdTypeCode
```

---

### IN_MTHENDITEM (Monthly End Item Snapshot)
**Purpose:** Period-end balance snapshot untuk opening dan closing

| Column | Type | Usage |
|--------|------|-------|
| `ItemCode` | varchar | Item identifier |
| `LocCode` | varchar | Location |
| `AccYear` | int | Accounting year |
| `AccMonth` | int | Accounting month |
| `Qty` | decimal | Quantity on hand at period end |
| `AverageCost` | decimal | Average cost at period end |
| `Amount` | decimal | Total value (Qty × AverageCost) |

**Two Usage Patterns:**

1. **Opening Balance** (Previous Period):
```sql
FROM [${database}].[dbo].[IN_MTHENDITEM]
WHERE RTRIM(LocCode) = '${scope.location}'
  AND RTRIM(CONVERT(varchar(10), AccYear)) = '${scope.openingAccYear}'
  AND RTRIM(CONVERT(varchar(10), AccMonth)) = '${scope.openingAccMonth}'
```

2. **Closing Balance** (Current Period, if exists):
```sql
SELECT ItemCode, Qty AS period_closing_qty, Amount AS period_closing_amt
FROM [${database}].[dbo].[IN_MTHENDITEM]
WHERE RTRIM(LocCode) = '${scope.location}'
  AND RTRIM(CONVERT(varchar(10), AccYear)) = '${scope.accYear}'
  AND RTRIM(CONVERT(varchar(10), AccMonth)) = '${scope.accMonth}'
```

---

## Transaction Tables - Issue

### IN_STOCKISSUE / IN_STOCKISSUELN (Non-Workshop Issue)
**Purpose:** Issue stock untuk item non-workshop (ItemType 1-3)

| Table | Column | Type | Usage |
|-------|--------|------|-------|
| `IN_STOCKISSUE` | `StockIssueID` | int | Header link |
| `IN_STOCKISSUE` | `LocCode` | varchar | Location filter |
| `IN_STOCKISSUE` | `AccYear` | int | Accounting year |
| `IN_STOCKISSUE` | `AccMonth` | int | Accounting month |
| `IN_STOCKISSUE` | `Status` | varchar | 2=Approved, 5=Cancelled, 6=Posted |
| `IN_STOCKISSUE` | `BlkCode` | varchar | Block/station code (empty = ledger) |
| `IN_STOCKISSUE` | `VehCode` | varchar | Vehicle code (empty = non-vehicle) |
| `IN_STOCKISSUELN` | `ItemCode` | varchar | Item being issued |
| `IN_STOCKISSUELN` | `Qty` | decimal | Quantity issued |
| `IN_STOCKISSUELN` | `Amount` | decimal | Value of issue |
| `IN_STOCKISSUELN` | `Cost` | decimal | Cost per unit |

**Classification Logic:**
```sql
CASE
  -- Ledger: no block, no vehicle
  WHEN LEN(RTRIM(ISNULL(l.BlkCode, ''))) = 0
   AND LEN(RTRIM(ISNULL(l.VehCode, ''))) = 0
  -- Station: has block, no vehicle
  WHEN LEN(RTRIM(ISNULL(l.VehCode, ''))) = 0
   AND LEN(RTRIM(ISNULL(l.BlkCode, ''))) > 0
  -- Vehicle: has vehicle
  WHEN LEN(RTRIM(ISNULL(l.VehCode, ''))) > 0
END
```

**Status Filter:**
```sql
AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
-- Exclude Status '1' (draft/open)
```

---

### IN_FUELISSUE / IN_FUELISSUELN (Fuel Issue)
**Purpose:** Issue BBM untuk kendaraan/station

| Table | Column | Type | Usage |
|-------|--------|------|-------|
| `IN_FUELISSUE` | `FuelIssueID` | int | Header link |
| `IN_FUELISSUE` | `LocCode` | varchar | Location |
| `IN_FUELISSUE` | `AccYear` | int | Accounting year |
| `IN_FUELISSUE` | `AccMonth` | int | Accounting month |
| `IN_FUELISSUE` | `Status` | varchar | 2=Approved, 6=Posted |
| `IN_FUELISSUELN` | `ItemCode` | varchar | Fuel item |
| `IN_FUELISSUELN` | `Qty` | decimal | Quantity |
| `IN_FUELISSUELN` | `Amount` | decimal | Value |

**Status Filter:**
```sql
AND RTRIM(ISNULL(${alias}.Status, '')) IN ('2', '6')
```

---

## Transaction Tables - Workshop

### WS_JOB / WS_JOBSTOCK (Workshop Stock Movement)
**Purpose:** Issue dan return untuk item workshop (ItemType 4)

| Table | Column | Type | Usage |
|-------|--------|------|-------|
| `WS_JOB` | `JobID` | int | Header link |
| `WS_JOB` | `VehCode` | varchar | Vehicle code |
| `WS_JOB` | `BlkCode` | varchar | Block code |
| `WS_JOBSTOCK` | `JobID` | int | Link to header |
| `WS_JOBSTOCK` | `ItemCode` | varchar | Part/spare item |
| `WS_JOBSTOCK` | `LocCode` | varchar | Location |
| `WS_JOBSTOCK` | `AccYear` | int | Accounting year |
| `WS_JOBSTOCK` | `AccMonth` | int | Accounting month |
| `WS_JOBSTOCK` | `TransType` | varchar | 1=Issue, 2=Return |
| `WS_JOBSTOCK` | `Qty` | decimal | Quantity |
| `WS_JOBSTOCK` | `Amount` | decimal | Value |
| `WS_JOBSTOCK` | `PriceAmount` | decimal | Price alternative |
| `WS_JOBSTOCK` | `Price` | decimal | Unit price |

**Workshop Issue Classification:**
```sql
CASE
  -- Ledger: TransType=1, no vehicle, no block
  WHEN RTRIM(ISNULL(s.TransType, '')) = '1'
   AND LEN(RTRIM(ISNULL(j.VehCode, ''))) = 0
   AND LEN(RTRIM(ISNULL(j.BlkCode, ''))) = 0
  -- Station: TransType=1, no vehicle, has block
  WHEN RTRIM(ISNULL(s.TransType, '')) = '1'
   AND LEN(RTRIM(ISNULL(j.VehCode, ''))) = 0
   AND LEN(RTRIM(ISNULL(j.BlkCode, ''))) > 0
  -- Vehicle: TransType=1, has vehicle
  WHEN RTRIM(ISNULL(s.TransType, '')) = '1'
   AND LEN(RTRIM(ISNULL(j.VehCode, ''))) > 0
  -- Return: TransType=2
  WHEN RTRIM(ISNULL(s.TransType, '')) = '2'
END
```

---

## Transaction Tables - Purchasing

### PU_GOODSRCV / PU_GOODSRCVLN / PU_POLN (Goods Receive)
**Purpose:** Receiving barang dari supplier purchasing

| Table | Column | Type | Usage |
|-------|--------|------|-------|
| `PU_GOODSRCV` | `GoodsRcvID` | int | Header link |
| `PU_GOODSRCV` | `LocCode` | varchar | Location |
| `PU_GOODSRCV` | `AccYear` | int | Accounting year |
| `PU_GOODSRCV` | `AccMonth` | int | Accounting month |
| `PU_GOODSRCV` | `Status` | varchar | 2=Approved |
| `PU_GOODSRCVLN` | `GoodsRcvID` | int | Header link |
| `PU_GOODSRCVLN` | `ItemCode` | varchar | Received item |
| `PU_GOODSRCVLN` | `StockQty` | decimal | Quantity received |
| `PU_POLN` | `POLnID` | int | PO Line link |
| `PU_POLN` | `Cost` | decimal | Unit cost from PO |

**Valuation Formula:**
```sql
GoodsReceiveAmount = PU_GOODSRCVLN.StockQty × PU_POLN.Cost
```

**Status Filter:**
```sql
AND RTRIM(g.Status) = '2'
```

---

### PU_GOODSRET / PU_GOODSRETLN (Goods Return)
**Purpose:** Return barang ke supplier

| Table | Column | Type | Usage |
|-------|--------|------|-------|
| `PU_GOODSRET` | `GoodsRetId` | int | Header link |
| `PU_GOODSRET` | `LocCode` | varchar | Location |
| `PU_GOODSRET` | `AccYear` | int | Accounting year |
| `PU_GOODSRET` | `AccMonth` | int | Accounting month |
| `PU_GOODSRET` | `Status` | varchar | 2=Approved |
| `PU_GOODSRETLN` | `GoodsRetId` | int | Header link |
| `PU_GOODSRETLN` | `ItemCode` | varchar | Returned item |
| `PU_GOODSRETLN` | `QtyReturn` | decimal | Quantity returned |
| `PU_GOODSRETLN` | `ReturnStockQty` | decimal | Stock return qty |
| `PU_GOODSRETLN` | `Amount` | decimal | Return value |
| `PU_GOODSRETLN` | `Cost` | decimal | Unit cost |
| `PU_GOODSRETLN` | `POLnID` | int | PO Line link (for cost lookup) |

**Valuation Formula (with fallback):**
```sql
GoodsReturnAmount = COALESCE(
  NULLIF(grl.Amount, 0),
  COALESCE(NULLIF(grl.ReturnStockQty, 0), grl.QtyReturn, 0)
    * COALESCE(NULLIF(grl.Cost, 0), p.Cost, 0),
  0
)
```

---

## Table Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           TABLE RELATIONSHIPS                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MASTER TABLES                    TRANSACTION TABLES                         │
│  ─────────────                   ──────────────────                         │
│                                                                              │
│  ┌─────────┐                    ┌──────────────────┐                        │
│  │ IN_ITEM │◄──────────────────│ IN_STOCKISSUELN  │ IN_STOCKISSUE (h)     │
│  │         │  (issueItem)      │                  │                        │
│  └────┬────┘                    └──────────────────┘                        │
│       │                                                                        │
│       │ JOIN on ItemCode, LocCode                                             │
│       ▼                                                                        │
│  ┌─────────┐                    ┌──────────────────┐                        │
│  │IN_PROD  │                    │ IN_FUELISSUELN   │ IN_FUELISSUE (h)     │
│  │ TYPE    │                    │                  │                        │
│  └─────────┘                    └──────────────────┘                        │
│                                                                              │
│  ┌─────────────────┐              ┌──────────────────┐                     │
│  │  IN_MTHENDITEM  │              │  WS_JOBSTOCK     │ WS_JOB (j)          │
│  │  (opening/      │              │                  │                      │
│  │   closing)       │              └────────┬─────────┘                      │
│  └────────┬────────┘                       │                                │
│           │                                │ JobID                          │
│           │                                ▼                                │
│           │                       ┌──────────────────┐                     │
│           │                       │     WS_JOB       │                     │
│           │                       └──────────────────┘                     │
│           │                                                                │
│           │                 PURCHASING TABLES                              │
│           │                 ──────────────────                              │
│           │                                                                │
│           │                 ┌──────────────────┐                           │
│           │                 │ PU_GOODSRCVLN    │ PU_GOODSRCV (g)           │
│           │                 │     GoodsRcvID   │                           │
│           │                 └────────┬─────────┘                           │
│           │                          │ POLnID                             │
│           │                          ▼                                    │
│           │                 ┌──────────────────┐                           │
│           │                 │    PU_POLN       │                           │
│           │                 │    (Cost)        │                           │
│           │                 └──────────────────┘                           │
│           │                                                                │
│           │                 ┌──────────────────┐                           │
│           │                 │ PU_GOODSRETLN    │ PU_GOODSRET (gr)          │
│           │                 │   GoodsRetId    │                           │
│           │                 └──────────────────┘                           │
│           │                                                                │
└───────────┴────────────────────────────────────────────────────────────────┘
```

---

## Navigation

**Previous:** [01-Overview](./01-OVERVIEW.md)
**Next:** [03-SQL CTE Structure](./03-SQL-CTE-STRUCTURE.md)
