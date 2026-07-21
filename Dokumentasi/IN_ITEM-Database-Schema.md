# IN_ITEM Database Schema — Full Inventory System Tables

> **Created:** 2026-07-20
> **Scope:** MSSQL Inventory module — all 33 tables, columns, FK relationships
> **Source:** Analyzed from `app/api/reports/inventory/route.ts` SQL queries

---

## 1. Table Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    IN_ITEM (Master Table)                        │
│  PK: ItemCode  ·  FK: ProdTypeCode, ProdCatCode, StockAnalysisCode │
└─────────────────────────────────────────────────────────────────┘
         │
         ├── IN_PRODTYPE ──────────── Product Type lookup
         ├── IN_PRODCAT ────────────── Product Category lookup
         ├── IN_STOCKANALYSIS ──────── Stock Analysis lookup
         │
         ├── IN_STOCK ──────────────── Monthly end snapshot
         ├── IN_MTHENDITEM ─────────── Month-end item balance
         ├── IN_MTHENDTRX ──────────── Month-end transaction log
         │
         ├── IN_STOCKRECEIVE ───────────┐
         │   └── IN_STOCKRECEIVELN ────┤── Stock Receipt flow
         │                               │
         ├── PU_GOODSRCV ───────────────┐│
         │   └── PU_GOODSRCVLN ────────┘│
         │                               │
         ├── IN_STOCKISSUE ──────────────┤
         │   └── IN_STOCKISSUELN ────────┤── Stock Issue flow
         │                               │
         ├── WS_JOB ─────────────────────┤
         │   └── WS_JOBSTOCK ────────────┘
         │
         ├── IN_STOCKTRANSFER ───────────┐
         │   └── IN_STOCKTRANSFERLN ─────┘── Transfer flow
         │
         ├── IN_STOCKADJ ───────────────┐
         │   └── IN_STOCKADJLN ─────────┘── Adjustment flow
         │
         ├── IN_FUELISSUE ───────────────┐
         │   └── IN_FUELISSUELN ─────────┘── Fuel flow
         │
         ├── IN_PR ─────────────────────┐
         │   └── IN_PRLN ────────────────┘── Purchase Request
         │
         ├── PU_PO ──────────────────────┐
         │   └── PU_POLN ────────────────┘── Purchase Order
         │
         ├── PU_SUPPLIER ──────────────── Supplier master
         │
         ├── BD_VEHICLERUNNING ────────── Vehicle running summary
         ├── GL_VEHICLE ────────────────── GL vehicle
         ├── GL_VEHUSAGE / GL_VEHUSAGELN ── GL vehicle usage
         └── AP_INVOICERCV ─────────────── AP invoice receipt
```

---

## 2. Master Data Tables

### 2.1 IN_ITEM — Master Item Table

**Primary table, alias: `i`**

| Column | Type | Description |
|---|---|---|
| `ItemCode` | `varchar` | **Primary Key** |
| `Description` | `varchar` | Item name |
| `ItemType` | `varchar` | `'1'` = Gudang (Warehouse), `'4'` = Workshop |
| `LocCode` | `varchar` | Default location code |
| `ProdTypeCode` | `varchar` | FK → `IN_PRODTYPE.ProdTypeCode` |
| `ProdCatCode` | `varchar` | FK → `IN_PRODCAT.ProdCatCode` |
| `ProdBrandCode` | `varchar` | Brand code |
| `ProdModelCode` | `varchar` | Model code |
| `ProdMatCode` | `varchar` | Material code |
| `StockAnalysisCode` | `varchar` | FK → `IN_STOCKANALYSIS.StockAnalysisCode` |
| `UOMCode` | `varchar` | Unit of Measure |
| `AccountCode` | `varchar` | GL account code |
| `SupplierCode` | `varchar` | Default supplier, FK → `PU_SUPPLIER` |
| `QtyOnHand` | `decimal` | Current stock quantity |
| `QtyOnHold` | `decimal` | On-hold quantity |
| `QtyOnOrder` | `decimal` | On-order quantity |
| `ReOrderLevel` | `decimal` | Minimum reorder point |
| `Status` | `varchar` | Active/Inactive |
| `UpdateDate` | `datetime` | Last update timestamp |
| `CreateDate` | `datetime` | Creation timestamp |
| `AverageCost` | `decimal(18,6)` | Weighted average cost |
| `DiffAverageCost` | `decimal` | Cost variance |
| `UnitCost` | `decimal` | Unit cost |
| `UnitPrice` | `decimal` | Unit selling price |
| `StockValue` | `decimal` | Stock value (QtyOnHand × UnitCost) |
| `StockValueReal` | `decimal` | Real stock value |

**Key joins in code:**
```sql
LEFT JOIN [db].[dbo].[IN_PRODTYPE] pt ON i.ProdTypeCode = pt.ProdTypeCode
LEFT JOIN [db].[dbo].[IN_PRODCAT] pc ON i.ProdCatCode = pc.ProdCatCode
LEFT JOIN [db].[dbo].[IN_STOCKANALYSIS] sa ON i.StockAnalysisCode = sa.StockAnalysisCode
LEFT JOIN [db].[dbo].[PU_SUPPLIER] s ON i.SupplierCode = s.SupplierCode
```

### 2.2 IN_PRODTYPE — Product Type

| Column | Type | Description |
|---|---|---|
| `ProdTypeCode` | `varchar` | **Primary Key** |
| `Description` | `varchar` | Type description |

### 2.3 IN_PRODCAT — Product Category

| Column | Type | Description |
|---|---|---|
| `ProdCatCode` | `varchar` | **Primary Key** |
| `ProdTypeCode` | `varchar` | FK → `IN_PRODTYPE.ProdTypeCode` |
| `Description` | `varchar` | Category description |

### 2.4 IN_STOCKANALYSIS — Stock Analysis

| Column | Type | Description |
|---|---|---|
| `StockAnalysisCode` | `varchar` | **Primary Key** |
| `Description` | `varchar` | Analysis description |

---

## 3. Monthly End Tables

### 3.1 IN_STOCK — Monthly Stock Snapshot

**Alias: `m`**

| Column | Type | Description |
|---|---|---|
| `ItemCode` | `varchar` | FK → `IN_ITEM.ItemCode` |
| `LocCode` | `varchar` | Location code |
| `Qty` | `decimal` | Closing quantity for period |
| `AverageCost` | `decimal(18,6)` | Average cost at month-end |
| `AccYear` | `int` | Accounting year |
| `AccMonth` | `int` | Accounting month (1=Apr→12=Mar) |
| `Amount` | `decimal` | `Qty × AverageCost` |

**Used for:** Computing period-closing quantity, comparing opening vs closing stock.

### 3.2 IN_MTHENDITEM — Month-End Item Balance

Same structure as `IN_STOCK` — stores item-level closing balances per accounting period.

### 3.3 IN_MTHENDTRX — Month-End Transaction Log

Stores aggregated transaction totals per item per accounting period.

---

## 4. Stock Receipt Flow

### 4.1 IN_STOCKRECEIVE — Stock Receipt Header

**Alias: `h` (header)**

| Column | Type | Description |
|---|---|---|
| `StockReceiveID` | `int` | **Primary Key** |
| `LocCode` | `varchar` | Receiving location |
| `TransDate` | `date` | Transaction date |
| `ReferenceNo` | `varchar` | Reference/DO number |
| `SupplierCode` | `varchar` | Supplier (optional) |
| `Status` | `varchar` | Receipt status |

### 4.2 IN_STOCKRECEIVELN — Stock Receipt Line

**Alias: `l` (line), parent join: `StockReceiveID`**

| Column | Type | Description |
|---|---|---|
| `StockReceiveLnID` | `int` | **Primary Key** |
| `StockReceiveID` | `int` | FK → `IN_STOCKRECEIVE.StockReceiveID` |
| `ItemCode` | `varchar` | FK → `IN_ITEM.ItemCode` |
| `Qty` | `decimal` | Received quantity |
| `Amount` | `decimal` | Total amount |
| `Cost` | `decimal` | Unit cost |

**Join pattern:**
```sql
INNER JOIN [db].[dbo].[IN_STOCKRECEIVE] h ON l.StockReceiveID = h.StockReceiveID
LEFT JOIN [db].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
```

### 4.3 PU_GOODSRCV — Goods Receiving Header

**Alias: `h` (header)**

| Column | Type | Description |
|---|---|---|
| `GoodsRcvID` | `int` | **Primary Key** |
| `SupplierCode` | `varchar` | FK → `PU_SUPPLIER.SupplierCode` |
| `CreateDate` | `datetime` | Receipt date |
| `ReferenceNo` | `varchar` | GRN reference |
| `InvoiceNo` | `varchar` | Supplier invoice number |
| `Status` | `varchar` | Receipt status |

### 4.4 PU_GOODSRCVLN — Goods Receiving Line

**Alias: `gl`**

| Column | Type | Description |
|---|---|---|
| `GoodsRcvLnID` | `int` | **Primary Key** |
| `GoodsRcvID` | `int` | FK → `PU_GOODSRCV.GoodsRcvID` |
| `POLnID` | `int` | FK → `PU_POLN.POLnID` (optional) |
| `ItemCode` | `varchar` | Item code |
| `ReceiveQty` | `decimal` | Received quantity |
| `Amount` | `decimal` | Total amount |
| `Cost` | `decimal` | Unit cost |
| `CommAmount` | `decimal` | Commission/landed cost |

**Join pattern:**
```sql
JOIN [db].[dbo].[PU_GOODSRCV] h ON l.GoodsRcvID = h.GoodsRcvID
LEFT JOIN [db].[dbo].[PU_POLN] p ON l.POLnID = p.POLnID
LEFT JOIN [db].[dbo].[PU_SUPPLIER] s ON h.SupplierCode = s.SupplierCode
LEFT JOIN [db].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
```

---

## 5. Stock Issue Flow

### 5.1 IN_STOCKISSUE — Stock Issue Header

**Alias: `h` (header)**

| Column | Type | Description |
|---|---|---|
| `StockIssueID` | `int` | **Primary Key** |
| `LocCode` | `varchar` | Issuing location |
| `TransDate` | `date` | Transaction date |
| `PostDate` | `date` | Posting date |
| `ReferenceNo` | `varchar` | Reference number |
| `TransType` | `varchar` | Issue type |
| `BlkCode` | `varchar` | Estate/field block code |
| `VehCode` | `varchar` | Vehicle code |
| `Remarks` | `varchar` | Notes |
| `Status` | `varchar` | Issue status |
| `AccYear` | `int` | Accounting year |
| `AccMonth` | `int` | Accounting month |

### 5.2 IN_STOCKISSUELN — Stock Issue Line

**Alias: `l` (line), parent join: `StockIssueID`**

| Column | Type | Description |
|---|---|---|
| `StockIssueLnID` | `int` | **Primary Key** |
| `StockIssueID` | `int` | FK → `IN_STOCKISSUE.StockIssueID` |
| `ItemCode` | `varchar` | FK → `IN_ITEM.ItemCode` |
| `Qty` | `decimal` | Issued quantity |
| `Amount` | `decimal` | Total amount |
| `Cost` | `decimal` | Unit cost |
| `UnitCode` | `varchar` | Unit code |

**Join pattern:**
```sql
JOIN [db].[dbo].[IN_STOCKISSUELN] l ON l.StockIssueID = h.StockIssueID
JOIN [db].[dbo].[IN_ITEM] issueItem ON l.ItemCode = issueItem.ItemCode
LEFT JOIN [db].[dbo].[WS_JOB] j ON h.BlkCode = j.BlkCode
LEFT JOIN [db].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
```

---

## 6. Workshop Flow

### 6.1 WS_JOB — Workshop Job Header

**Alias: `j`**

| Column | Type | Description |
|---|---|---|
| `JobID` | `int` | **Primary Key** |
| `VehCode` | `varchar` | FK → `BD_VEHICLERUNNING.VehCode` |
| `BlkCode` | `varchar` | Block code |
| `TransDate` | `date` | Transaction date |
| `PostDate` | `date` | Posting date |
| `Status` | `varchar` | Job status |

**Join:** `WS_JOB.VehCode` links to vehicle master. Workshop issues use `ItemType = '4'`.

### 6.2 WS_JOBSTOCK — Workshop Job Material

**Alias: `s` (stock)**

| Column | Type | Description |
|---|---|---|
| `JobStockID` | `int` | **Primary Key** |
| `JobID` | `int` | FK → `WS_JOB.JobID` |
| `ItemCode` | `varchar` | FK → `IN_ITEM.ItemCode` |
| `LocCode` | `varchar` | Location code |
| `TransType` | `varchar` | Transaction type |
| `Qty` | `decimal` | Quantity |
| `Cost` | `decimal` | Unit cost |
| `Amount` | `decimal` | Total amount |
| `VehCode` | `varchar` | Vehicle code |
| `SupplierCode` | `varchar` | Supplier code |
| `ReferenceNo` | `varchar` | Reference |
| `UpdateDate` | `datetime` | Update timestamp |

**Join pattern:**
```sql
LEFT JOIN [db].[dbo].[WS_JOB] j ON s.JobID = j.JobID
LEFT JOIN [db].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
```

---

## 7. Stock Transfer Flow

### 7.1 IN_STOCKTRANSFER — Transfer Header

**Alias: `h`**

| Column | Type | Description |
|---|---|---|
| `StockTransferID` | `int` | **Primary Key** |
| `FromLocCode` | `varchar` | Source location |
| `ToLocCode` | `varchar` | Destination location |
| `TransDate` | `date` | Transfer date |
| `ReferenceNo` | `varchar` | Reference number |
| `Status` | `varchar` | Transfer status |

### 7.2 IN_STOCKTRANSFERLN — Transfer Line

**Alias: `l`, parent join: `StockTransferID`**

| Column | Type | Description |
|---|---|---|
| `StockTransferLnID` | `int` | **Primary Key** |
| `StockTransferID` | `int` | FK → `IN_STOCKTRANSFER.StockTransferID` |
| `ItemCode` | `varchar` | FK → `IN_ITEM.ItemCode` |
| `Qty` | `decimal` | Transfer quantity |

---

## 8. Stock Adjustment Flow

### 8.1 IN_STOCKADJ — Adjustment Header

| Column | Type | Description |
|---|---|---|
| `StockAdjID` | `int` | **Primary Key** |
| `LocCode` | `varchar` | Location |
| `TransDate` | `date` | Adjustment date |
| `ReferenceNo` | `varchar` | Reference |
| `Remarks` | `varchar` | Adjustment reason |
| `Status` | `varchar` | Status |

### 8.2 IN_STOCKADJLN — Adjustment Line

**Alias: `l`, parent join: `StockAdjID`**

| Column | Type | Description |
|---|---|---|
| `StockAdjLnID` | `int` | **Primary Key** |
| `StockAdjID` | `int` | FK → `IN_STOCKADJ.StockAdjID` |
| `ItemCode` | `varchar` | FK → `IN_ITEM.ItemCode` |
| `Qty` | `decimal` | Adjustment quantity (+/-) |
| `Amount` | `decimal` | Amount |
| `Cost` | `decimal` | Unit cost |

---

## 9. Fuel Flow

### 9.1 IN_FUELISSUE — Fuel Issue Header

| Column | Type | Description |
|---|---|---|
| `FuelIssueID` | `int` | **Primary Key** |
| `LocCode` | `varchar` | Location |
| `TransDate` | `date` | Issue date |
| `ReferenceNo` | `varchar` | Reference |
| `VehCode` | `varchar` | FK → `BD_VEHICLERUNNING.VehCode` |
| `DriverName` | `varchar` | Driver name |
| `Status` | `varchar` | Status |

### 9.2 IN_FUELISSUELN — Fuel Issue Line

| Column | Type | Description |
|---|---|---|
| `FuelIssueLnID` | `int` | **Primary Key** |
| `FuelIssueID` | `int` | FK → `IN_FUELISSUE.FuelIssueID` |
| `ItemCode` | `varchar` | FK → `IN_ITEM.ItemCode` (fuel item) |
| `Qty` | `decimal` | Fuel quantity |

---

## 10. Purchase Request Flow

### 10.1 IN_PR — Purchase Request Header

| Column | Type | Description |
|---|---|---|
| `PRID` | `int` | **Primary Key** |
| `LocCode` | `varchar` | Requesting location |
| `TransDate` | `date` | PR date |
| `ReferenceNo` | `varchar` | PR reference |
| `Requestor` | `varchar` | Requestor name |
| `Status` | `varchar` | PR status |

### 10.2 IN_PRLN — Purchase Request Line

| Column | Type | Description |
|---|---|---|
| `PRLnID` | `int` | **Primary Key** |
| `PRID` | `int` | FK → `IN_PR.PRID` |
| `ItemCode` | `varchar` | FK → `IN_ITEM.ItemCode` |
| `Qty` | `decimal` | Requested quantity |
| `Cost` | `decimal` | Estimated cost |
| `Remarks` | `varchar` | Notes |

---

## 11. Purchase Order Flow

### 11.1 PU_PO — Purchase Order Header

**Alias: `po`**

| Column | Type | Description |
|---|---|---|
| `POID` | `int` | **Primary Key** |
| `SupplierCode` | `varchar` | FK → `PU_SUPPLIER.SupplierCode` |
| `PODate` | `date` | PO date |
| `ReferenceNo` | `varchar` | PO reference |
| `Status` | `varchar` | PO status |

### 11.2 PU_POLN — Purchase Order Line

**Alias: `v` or `p`**

| Column | Type | Description |
|---|---|---|
| `POLnID` | `int` | **Primary Key** |
| `POID` | `int` | FK → `PU_PO.POID` |
| `ItemCode` | `varchar` | FK → `IN_ITEM.ItemCode` |
| `ProdTypeCode` | `varchar` | Product type |
| `Qty` | `decimal` | Ordered quantity |
| `Cost` | `decimal` | Unit cost |
| `Status` | `varchar` | Line status |

---

## 12. Supplier

### 12.1 PU_SUPPLIER — Supplier Master

**Alias: `s`**

| Column | Type | Description |
|---|---|---|
| `SupplierCode` | `varchar` | **Primary Key** |
| `Name` | `varchar` | Supplier name |
| `ContactPerson` | `varchar` | Contact name |
| `TelNo` | `varchar` | Phone number |
| `Email` | `varchar` | Email address |
| `Town` | `varchar` | City/town |
| `BlkCode` | `varchar` | Estate block code |
| `Status` | `varchar` | Active/Inactive |

---

## 13. Vehicle & GL Tables

### 13.1 BD_VEHICLERUNNING — Vehicle Running Summary

| Column | Type | Description |
|---|---|---|
| `VehCode` | `varchar` | **Primary Key**, FK → `WS_JOB.VehCode` |
| *(other columns)* | — | Vehicle running stats |

### 13.2 GL_VEHICLE — GL Vehicle

| Column | Type | Description |
|---|---|---|
| `VehCode` | `varchar` | **Primary Key** |

### 13.3 GL_VEHUSAGE — GL Vehicle Usage Header

| Column | Type | Description |
|---|---|---|
| *(usage header fields)* | — | GL posting header |

### 13.4 GL_VEHUSAGELN — GL Vehicle Usage Line

| Column | Type | Description |
|---|---|---|
| `VehCode` | `varchar` | Vehicle code |
| *(other columns)* | — | Usage line details |

---

## 14. AP Table

### 14.1 AP_INVOICERCV — AP Invoice Receipt

| Column | Type | Description |
|---|---|---|
| *(invoice fields)* | — | Accounts payable invoice data |

---

## 15. Column Naming Patterns

### Standard Header (h) Columns
```
StockIssueID, StockReceiveID, StockTransferID, StockAdjID, 
GoodsRcvID, POID, JobID, FuelIssueID, PRID, VehCode,
LocCode, TransDate, PostDate, ReferenceNo, Status,
AccYear, AccMonth, BlkCode, Remarks
```

### Standard Line (l) Columns
```
StockIssueLnID, StockReceiveLnID, StockTransferLnID, StockAdjLnID,
GoodsRcvLnID, POLnID, PRLnID, JobStockID, FuelIssueLnID,
ItemCode, Qty, Amount, Cost, UnitCode
```

### IN_ITEM (i) Columns
```
ItemCode, Description, ItemType, LocCode, 
ProdTypeCode, ProdCatCode, ProdBrandCode, ProdModelCode, ProdMatCode,
StockAnalysisCode, UOMCode, AccountCode, SupplierCode,
QtyOnHand, QtyOnHold, QtyOnOrder, ReOrderLevel,
Status, UpdateDate, CreateDate,
AverageCost, DiffAverageCost, UnitCost, UnitPrice, StockValue, StockValueReal
```

### Computed Movement Columns (from OUTER APPLY)
```
StockIssueEventCount   — COUNT(DISTINCT StockIssueID)
MovementEventCountAll  — COUNT(DISTINCT) across all periods
MovementQtyAll         — SUM(Qty) across all periods
MovementAmountAll      — SUM(Amount) across all periods
LastStockIssueDate     — MAX(PostDate)
MovementAgeDays        — DATEDIFF(DAY, LastMovementDate, GETDATE())
MovementCategory       — Fast Moving / Moving / Slow Moving / Dead Stock / Stale
LatestMovement         — Last 2 events as formatted text
StockIssueMovementEvent1, StockIssueMovementEvent2
```

---

## 16. FK Reference Map

```
IN_ITEM.ProdTypeCode      → IN_PRODTYPE.ProdTypeCode
IN_ITEM.ProdCatCode       → IN_PRODCAT.ProdCatCode
IN_ITEM.StockAnalysisCode → IN_STOCKANALYSIS.StockAnalysisCode
IN_ITEM.SupplierCode      → PU_SUPPLIER.SupplierCode

IN_STOCKISSUELN.StockIssueID → IN_STOCKISSUE.StockIssueID
IN_STOCKISSUELN.ItemCode     → IN_ITEM.ItemCode
IN_STOCKISSUE.VehCode         → BD_VEHICLERUNNING.VehCode

IN_STOCKRECEIVELN.StockReceiveID → IN_STOCKRECEIVE.StockReceiveID
IN_STOCKRECEIVELN.ItemCode        → IN_ITEM.ItemCode

IN_STOCKTRANSFERLN.StockTransferID → IN_STOCKTRANSFER.StockTransferID
IN_STOCKTRANSFERLN.ItemCode         → IN_ITEM.ItemCode

IN_STOCKADJLN.StockAdjID → IN_STOCKADJ.StockAdjID
IN_STOCKADJLN.ItemCode   → IN_ITEM.ItemCode

PU_GOODSRCVLN.GoodsRcvID → PU_GOODSRCV.GoodsRcvID
PU_GOODSRCVLN.POLnID     → PU_POLN.POLnID
PU_GOODSRCV.SupplierCode → PU_SUPPLIER.SupplierCode

PU_POLN.POID     → PU_PO.POID
PU_POLN.ItemCode → IN_ITEM.ItemCode

WS_JOBSTOCK.JobID    → WS_JOB.JobID
WS_JOBSTOCK.ItemCode → IN_ITEM.ItemCode
WS_JOBSTOCK.VehCode  → BD_VEHICLERUNNING.VehCode

WS_JOB.VehCode → BD_VEHICLERUNNING.VehCode
```

---

## 17. ItemType Classification

| ItemType | Meaning | Location |
|---|---|---|
| `'1'` | Gudang (Warehouse) | Regular inventory warehouse |
| `'4'` | Workshop | Workshop/vehicle maintenance |

**Filter in code:**
```sql
-- Workshop items
RTRIM(i.ItemType) = '4'

-- Non-workshop items (regular warehouse)
RTRIM(i.ItemType) != '4'
```

---

*End of IN_ITEM Database Schema Documentation*
