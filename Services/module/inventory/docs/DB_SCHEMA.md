# Inventory Module - Database Schema (db_ptrj_mill)

## IN_ITEM (11,976 rows)

Primary table: inventory on-hand per item+location.
**Composite PK:** (ItemCode, LocCode)

| # | Column | Data Type | Nullable | Default | Description |
|---|--------|-----------|----------|---------|-------------|
| 1 | ItemCode | char(20) | NO | | FK → IN_ITEMCODE.ItemCode. Item identifier. |
| 2 | LocCode | char(8) | NO | | Location code (e.g., "PTRJ"). |
| 3 | Description | nchar(128) | NO | | Item description (padded with spaces). |
| 4 | Bin | char(20) | YES | | Bin / storage location within warehouse. |
| 5 | ItemType | char(8) | NO | | Item classification type. |
| 6 | ProdTypeCode | char(8) | YES | | FK → IN_PRODTYPE.ProdTypeCode. Product type. |
| 7 | ProdCatCode | char(8) | YES | | FK → IN_PRODCAT.ProdCatCode. Product category. |
| 8 | FuelTypeInd | char(1) | NO | '0' | Fuel type indicator (0/1). |
| 9 | ProdBrandCode | char(8) | YES | | FK → IN_PRODBRAND.ProdBrandCode. |
| 10 | ProdModelCode | char(8) | YES | | FK → IN_PRODMODEL.ProdModelCode. |
| 11 | ProdMatCode | char(8) | YES | | FK → IN_PRODMAT.ProdMatCode. |
| 12 | StockAnalysisCode | char(8) | YES | | FK → IN_STOCKANALYSIS. |
| 13 | ExpenseCode | char(8) | YES | | Expense code for accounting. |
| 14 | ActCode | char(32) | YES | | Account code. |
| 15 | UOMCode | char(8) | NO | | Unit of measure (e.g., "PCS", "KG"). |
| 16 | PurchaseUOM | char(8) | NO | | Purchase unit. |
| 17 | FuelMeterReading | decimal(18,6) | YES | | Fuel meter reading at last transaction. |
| 18 | ReOrderLevel | decimal(18,6) | YES | | Minimum stock level before reorder. |
| 19 | QtyOnHand | decimal(18,6) | YES | | Current stock quantity on hand. |
| 20 | QtyOnHold | decimal(18,6) | YES | | Quantity on hold (reserved). |
| 21 | QtyOnOrder | decimal(18,6) | YES | | Quantity on order (not yet received). |
| 22 | QtyReOrder | decimal(18,6) | YES | | Reorder quantity. |
| 23 | InitialCost | decimal(18,6) | YES | | Initial / opening cost. |
| 24 | HighCost | decimal(18,6) | YES | | Highest recorded cost. |
| 25 | LowCost | decimal(18,6) | YES | | Lowest recorded cost. |
| 26 | AverageCost | decimal(18,6) | YES | | Average weighted cost. |
| 27 | LatestCost | decimal(18,6) | YES | | Most recent purchase cost. |
| 28 | DiffAverageCost | decimal(18,6) | YES | | Difference: LatestCost - AverageCost. |
| 29 | ClosingBal | decimal(18,6) | YES | | Month-end closing balance. |
| 30 | ClosingAvrgCost | decimal(18,6) | YES | | Month-end average cost. |
| 31 | ClosingDiffAvrgCost | decimal(18,6) | YES | | Month-end cost diff. |
| 32 | PurchaseAccNo | char(32) | YES | | Purchase account number for GL. |
| 33 | IssueAccNo | char(32) | YES | | Issue account number for GL. |
| 34 | UsePrice | char(2) | YES | | Pricing method indicator. |
| 35 | SellFixedPrice | decimal(18,6) | YES | | Fixed selling price. |
| 36 | SellLatestCost | decimal(18,6) | YES | | Selling price based on latest cost. |
| 37 | SellAverageCost | decimal(18,6) | YES | | Selling price based on average cost. |
| 38 | Remark | nchar(128) | YES | | Notes / remarks. |
| 39 | Status | char(2) | NO | '1 ' | Item status ('1 ' = active, '2 ' = inactive). |
| 40 | LastOrderDate | datetime | YES | | Date of last purchase order. |
| 41 | LastIssueDate | datetime | YES | | Date of last stock issue. |
| 42 | CreateDate | datetime | NO | | Record creation timestamp. |
| 43 | UpdateDate | datetime | NO | | Last update timestamp. |
| 44 | UpdateID | char(20) | NO | | User ID who last updated this record. |
| 45 | SMInd | bit | YES | 0 | Stock management indicator. |
| 46 | ExDateReq | tinyint | YES | | Expiry date required flag (0=no, 1=yes). |
| 47 | TaxCode | varchar(8) | YES | | Tax code. |
| 48 | SuppTaxCode | varchar(8) | YES | | Supplementary tax code. |
| 49 | DefaultTaxCode2 | nvarchar(50) | NO | '' | Default tax code 2. |
| 50 | DefaultSuppTaxCode2 | nvarchar(50) | NO | '' | Default supplementary tax code 2. |

---

## IN_ITEMCODE (12,058 rows)

Item master catalog. 1 row per unique ItemCode. No LocCode here — just the item definition.

**PK:** ItemCode

| Column | Data Type | Nullable | Description |
|--------|-----------|----------|-------------|
| ItemCode | char(20) | NO | Unique item identifier |
| Description | nchar(128) | ? | Item name |
| ItemType | char(8) | ? | Classification |
| ProdTypeCode | char(8) | YES | Product type |
| UOMCode | char(8) | ? | Unit of measure |
| Status | char(2) | ? | Active/Inactive |

---

## Lookup Tables

### IN_PRODTYPE (52 rows)
| Column | Data Type | Description |
|--------|-----------|-------------|
| ProdTypeCode | char(8) | PK |
| Description | nchar(64) | Type name |
| Status | char(2) | Active status |

### IN_PRODCAT (9 rows)
| Column | Data Type | Description |
|--------|-----------|-------------|
| ProdCatCode | char(8) | PK |
| Description | nchar(64) | Category name |
| Status | char(2) | Active status |

### IN_PRODMAT (25 rows)
| Column | Data Type | Description |
|--------|-----------|-------------|
| ProdMatCode | char(8) | PK |
| Description | nchar(64) | Material name |
| Status | char(2) | Active status |

### IN_PRODBRAND (9 rows)
| Column | Data Type | Description |
|--------|-----------|-------------|
| ProdBrandCode | char(8) | PK |
| Description | nchar(64) | Brand name |
| Status | char(2) | Active status |

### IN_PRODMODEL (5 rows)
| Column | Data Type | Description |
|--------|-----------|-------------|
| ProdModelCode | char(8) | PK |
| Description | nchar(64) | Model name |
| Status | char(2) | Active status |

### IN_STOCKANALYSIS (4 rows)
| Column | Data Type | Description |
|--------|-----------|-------------|
| StockAnalysisCode | char(8) | PK |
| Description | nchar(64) | Analysis name |
| Status | char(2) | Active status |

---

## Transaction Tables

### Stock Issue (IN_STOCKISSUE / IN_STOCKISSUELN)
- IN_STOCKISSUE: 16,380 header rows
- IN_STOCKISSUELN: 32,501 line rows
- IN_STOCKISSUELN_ACC: 33,206 audit rows
- `IN_STOCKISSUE_EXDATE`: expiry tracking (0 rows)

### Stock Receive
- All tables: 0 rows (empty)

### Stock Return (IN_STOCKRTN / IN_STOCKRTNLN)
- IN_STOCKRTN: 31 header rows
- IN_STOCKRTNLN: 32 line rows

### Stock Adjustment (IN_STOCKADJ / IN_STOCKADJLN)
- IN_STOCKADJ: 34 header rows
- IN_STOCKADJLN: 134 line rows

### Stock Transfer
- All tables: 0 rows (empty)

### Fuel Issue (IN_FUELISSUE / IN_FUELISSUELN)
- IN_FUELISSUE: 7,500 header rows
- IN_FUELISSUELN: 8,759 line rows

### Fuel Return (IN_FUELRTN / IN_FUELRTNLN)
- IN_FUELRTN: 27 header rows
- IN_FUELRTNLN: 34 line rows

### Purchase Requisition (IN_PR / IN_PRLN)
- IN_PR: 10,297 header rows
- IN_PRLN: 31,228 line rows
- IN_PRLN_ACC: 31,945 audit rows

### Month-End Snapshots
- IN_MTHENDITEM: 673,053 rows (very large — monthly stock snapshot)
- IN_MTHENDTRX: 82,194 rows (monthly transaction snapshot)

---

## Design Patterns

1. **Header + Line pattern:** Every transaction has `*_HDR` (header) and `*_LN` (line) tables.
2. **Audit tables (_ACC):** Every main table has a corresponding `*_ACC` table for audit trail.
3. **Staging tables (_TEMP):** Empty — used for temporary work before commit.
4. **Expiry tables (_EXDATE):** For tracking expiry dates on stock receive/issue/return/transfer.
5. **No FK constraints:** All relationships are implicit via column naming conventions.
6. **Fixed-width char fields:** All code fields use `char()` (padded with spaces). Always RTRIM() when comparing or displaying.

---

## Important Notes

- All `char(N)` fields are **zero-padded with spaces** in SQL Server. Always use `RTRIM()` when displaying or comparing.
- `Status` values: `'1 '` = active, `'2 '` = inactive (2-char, space-padded).
- `LocCode` values stored as 8-char padded strings (e.g., `"PTRJ    "`).
- All timestamps are in **UTC** (SQL Server datetime type).
- The composite key (ItemCode, LocCode) means one ItemCode can appear multiple times — one per location.