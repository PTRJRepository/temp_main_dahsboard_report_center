# MCP: Inventory Tables Deep-Dive — IN_ITEMCODE, IN_MTHENDITEM, IN_MTHENDTRX, IN_ITEM_ACC
**Generated:** 2026-05-16 11:40 | **Estate:** SERVER_PROFILE_1 | **Mill:** SERVER_PROFILE_3 | **DB:** db_ptrj_mill | **Store:** MCP

---

## Connection Details

Both Estate and Mill query `db_ptrj_mill` on SQL Server via the SQL Gateway:
```
Base URL  : http://localhost:8001/v1/query
API Key   : 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6
Database  : db_ptrj_mill
```

---

## Row Counts Summary

| Table           | Mill (SP3)   | Note                                   |
|-----------------|-------------|----------------------------------------|
| IN_ITEMCODE     |    12,058   | Master item catalog                    |
| IN_MTHENDITEM   |   673,053   | Monthly item balance snapshot          |
| IN_MTHENDTRX    |    82,194   | Monthly transaction journal lines      |
| IN_ITEM_ACC     |       244   | Item master audit / cost allocation    |

---

## 1. IN_ITEMCODE — Item Master Catalog

**PK:** ItemCode (char 20) | **Rows:** 12,058 | **Columns:** 49

IN_ITEMCODE is a **flat master + snapshot table**: it holds both the item definition (description, type, classification) AND the current on-hand/cost state in one table. No temporal dimension — only the latest values.

### Schema (49 columns)

| # | Column | Type | Nullable | Width | Description |
|---|--------|------|----------|-------|-------------|
| 1 | ItemCode | char | NO | 20 | **PK.** Unique item identifier. e.g. `MM11197`, `ME004015`, `DC05060`. |
| 2 | Description | nchar | YES | 128 | Item name/description (space-padded). |
| 3 | Bin | char | YES | 20 | Storage/bin location. |
| 4 | ItemType | char | NO | 8 | Item classification type. Key discriminator. See codes below. |
| 5 | ProdTypeCode | char | YES | 8 | Product type. e.g. `DC`, `GEN-O`, `VSPARE`, `SUND`. |
| 6 | ProdCatCode | char | YES | 8 | Product category. |
| 7 | FuelTypeInd | char | NO | 1 | Fuel type flag. `'0'` = not fuel, `'1'` = fuel item. |
| 8 | ProdBrandCode | char | YES | 8 | Product brand. |
| 9 | ProdModelCode | char | YES | 8 | Product model. |
| 10 | ProdMatCode | char | YES | 8 | Material type. |
| 11 | StockAnalysisCode | char | YES | 8 | Stock analysis group. |
| 12 | ExpenseCode | char | YES | 8 | Expense classification code. |
| 13 | ActCode | char | YES | 32 | GL account code. |
| 14 | UOMCode | char | YES | 8 | Unit of measure. e.g. `PCS`, `KG`, `MT`, `LT`, `UNIT`. |
| 15 | PurchaseUOM | char | YES | 8 | Purchase unit (usually same as UOMCode). |
| 16 | FuelMeterReading | decimal(18,6) | YES | | Fuel meter reading at last transaction. |
| 17 | ReOrderLevel | decimal(18,6) | YES | | Minimum stock level before reorder. |
| 18 | QtyOnHand | decimal(18,6) | YES | | Current stock quantity on hand. |
| 19 | QtyOnHold | decimal(18,6) | YES | | Quantity on hold/reserved. |
| 20 | QtyOnOrder | decimal(18,6) | YES | | Quantity on order (not yet received). |
| 21 | QtyReOrder | decimal(18,6) | YES | | Reorder quantity. |
| 22 | InitialCost | decimal(18,6) | YES | | Opening/initial cost. |
| 23 | HighCost | decimal(18,6) | YES | | Highest recorded cost. |
| 24 | LowCost | decimal(18,6) | YES | | Lowest recorded cost. |
| 25 | AverageCost | decimal(18,6) | YES | | Average weighted cost. |
| 26 | LatestCost | decimal(18,6) | YES | | Most recent purchase cost. |
| 27 | DiffAverageCost | decimal(18,6) | YES | | Difference: LatestCost - AverageCost. |
| 28 | ClosingBal | decimal(18,6) | YES | | Month-end closing balance (synced from month-end). |
| 29 | ClosingAvrgCost | decimal(18,6) | YES | | Month-end average cost. |
| 30 | ClosingDiffAvrgCost | decimal(18,6) | YES | | Month-end cost diff. |
| 31 | PurchaseAccNo | char | YES | 32 | GL purchase account number. |
| 32 | IssueAccNo | char | YES | 32 | GL issue account number. |
| 33 | UsePrice | char | YES | 2 | Pricing method indicator. |
| 34 | SellFixedPrice | decimal(18,6) | YES | | Fixed selling price. |
| 35 | SellLatestCost | decimal(18,6) | YES | | Selling price = latest cost. |
| 36 | SellAverageCost | decimal(18,6) | YES | | Selling price = average cost. |
| 37 | Remark | nchar | YES | 128 | Notes/remarks. |
| 38 | Status | char | YES | 2 | Active status. `'1 '` = active, `'2 '` = inactive. |
| 39 | LastOrderDate | datetime | YES | | Date of last purchase order. `'1900-01-01'` = never. |
| 40 | LastIssueDate | datetime | YES | | Date of last stock issue. `'1900-01-01'` = never. |
| 41 | CreateDate | datetime | YES | | Record creation timestamp (UTC). |
| 42 | UpdateDate | datetime | YES | | Last modification timestamp (UTC). |
| 43 | UpdateID | char | YES | 20 | User ID who last updated the record. e.g. `adm039`. |
| 44 | SMInd | bit | YES | | Stock management indicator (0/1). |
| 45 | ExDateReq | tinyint | YES | | Expiry date required flag (0=no, 1=yes). |
| 46 | TaxCode | varchar | YES | 8 | Tax code. |
| 47 | SuppTaxCode | varchar | YES | 8 | Supplementary tax code. |
| 48 | DefaultTaxCode2 | nvarchar | NO | 50 | Default tax code 2. |
| 49 | DefaultSuppTaxCode2 | nvarchar | NO | 50 | Default supplementary tax code 2. |

### ItemType Distribution

| ItemType | Count | Interpretation (inferred) |
|----------|-------|---------------------------|
| `'4'`    | 6,195 | Workshop / Maintenance items (largest group) |
| `'2'`    | 4,320 | Stock / General items |
| `'1'`    | 1,356 | Services / Non-stock items |
| `'6'`    |   137 | ? (some inactive) |
| `'10'`   |    40 | Fuel / Commodity codes (DIESEL, FC, FERT, OT01, CK) |
| `'7'`    |     4 | ? |
| `'8'`    |     4 | ? |
| `'9'`    |     2 | ? |

### Status Distribution

| Status | Count | Meaning |
|--------|-------|---------|
| `'1 '` | 12,000 | Active |
| `'2 '` |     58 | Inactive |

### Status='1' samples by ItemType

```
ItemType='1' (Services/Non-stock):
  DC05060 | 1 | PCS | 1
  DC09222 | 1 | PCS | 1
  M02070  | 1 | UNIT | 1
  MC01001 | 1 | KG | 1

ItemType='2' (Stock items):
  DC000001 | 2 | LOT | 1
  DC000002 | 2 | SET | 1
  D01289   | 2 | UNIT | 1

ItemType='4' (Workshop/Maintenance):
  ME004015 | 4 | PCS | 1
  ME01001  | 4 | PCS | 1
  DC19715  | 4 | PCS | 1

ItemType='10' (Fuel/Commodity - special):
  DIESEL  | 10 | LT | 1   <-- Liquid fuel measured in Liters
  FERT    | 10 | MT | 1   <-- Fertilizer measured in Metric Tons
  FC      | 10 | MT | 1   <-- Fruit/FFB Civil? measured in MT
  OT01    | 10 | MT | 1   <-- Oil/terimal?
  CK      | 10 | MT | 1   <-- Crude palm oil (CPO Kernel?)
```

### ProdTypeCode Distribution (top)

| ProdTypeCode | Count | Description (inferred) |
|-------------|-------|------------------------|
| DC | 3,832 | ? (largest product type) |
| GEN-O | 1,500 | General Operational |
| SUND | 1,378 | Sundries/consumables |
| ELEC-O | 1,023 | Electrical Operational |
| VSPARE | 874 | Vehicle Spare parts |
| ELEC-SPR | 717 | Electrical Spare parts |
| PITING | 319 | ? |
| BOUT | 248 | ? |
| BEAR | 220 | Bearings |
| VALPIT | 202 | Valve/Pipe fittings |
| TRANCAIN | 199 | Transmission Chain |
| OSRING | 171 | O-Ring/Seal |
| PUMSP | 126 | Pump Spare parts |
| GASPACK | 116 | ? |
| PRESS | 114 | Press machine parts |
| GRS | 44 | Grease |
| STERIL | 31 | Sterilizer parts |
| ... | ... | (22 more types) |

### Key Distinction vs IN_ITEM

IN_ITEM has the same 49 columns PLUS `LocCode` as part of its composite PK (ItemCode, LocCode). IN_ITEMCODE is the **location-independent** version: one row per unique ItemCode, no LocCode. The current stock quantities and costs in IN_ITEMCODE are the same values stored in IN_ITEM filtered to a single location.

---

## 2. IN_MTHENDITEM — Monthly Item Balance Snapshot

**PK:** (ItemCode, LocCode, AccYear, AccMonth) — composite | **Rows:** 673,053 | **Columns:** 7

### Schema (7 columns)

| # | Column | Type | Nullable | Width | Description |
|---|--------|------|----------|-------|-------------|
| 1 | ItemCode | char | NO | 20 | Item identifier. |
| 2 | LocCode | char | NO | 8 | Location code (all records use `'PTRJ    '`). |
| 3 | AccMonth | char | NO | 2 | Accounting month (space-padded). Values: `'1 '` through `'12'`. |
| 4 | AccYear | char | NO | 4 | Accounting year. Values: `'2019'` through `'2027'`. |
| 5 | Qty | decimal(18,6) | NO | | Quantity on hand at period-end. |
| 6 | AverageCost | decimal(18,6) | NO | | Average cost at period-end. |
| 7 | Amount | decimal(18,6) | NO | | Period-end stock value (Qty x AverageCost). |

### Period Coverage

86 distinct (AccYear, AccMonth) combinations. Data spans 2019–2027.

| Period | Rows | Note |
|--------|------|------|
| 2027/01 | 11,760 | Latest (current month, partial) |
| 2026/09–12 | ~11k each | Q4 2026 |
| 2026/01–08 | ~9k–11k each | Q1–Q3 2026 |
| 2025/08–09 | ~9k each | |
| ... | ... | |
| 2020 | 61,017 | |
| 2019 | 2,239 | |

### Sample Rows

```
ItemCode=D01289, LocCode=PTRJ, AccYear/AccMonth=(2022–2026)/01
  -> Qty=1, AverageCost=14,653,000, Amount=14,653,000 each period
  -> Consistent unit quantity with stable avg cost (14.65M IDR)

ItemCode=D01289 expanded across 2026:
  AccMonth=01 through 12: Qty=1, Amount=14,653,000 (static)
```

### Interpretation

Each row represents **the inventory state of one item at one location at the END of an accounting month**. The table is a **time-series of inventory balances** — useful for monthly reporting, stock valuation history, and detecting stock movement patterns.

**Composite PK uniqueness:** The same ItemCode appears once per (Year, Month) pair, so D01289 appears in every month from 2019 to 2027 (one row per month per year). The table holds approximately 11,000–12,000 item snapshots per month.

**Role in the system:**
- IN_ITEMCODE = latest/current snapshot (no time dimension)
- IN_MTHENDITEM = historical monthly snapshots (time dimension, by AccYear+AccMonth)
- IN_ITEM = per-location current snapshot (composite PK = ItemCode + LocCode)

---

## 3. IN_MTHENDTRX — Monthly Transaction Journal Lines

**PK:** (DocId, DocLnId, AccYear, AccMonth) — composite | **Rows:** 82,194 | **Columns:** 20

### Schema (20 columns)

| # | Column | Type | Nullable | Width | Description |
|---|--------|------|----------|-------|-------------|
| 1 | DocId | char | NO | 20 | Document header ID (e.g. `SI26016305`, `FI26007327`, `SA25000034`). |
| 2 | DocLnId | char | NO | 20 | Document line ID (e.g. `SIL26032485`). Format: module prefix + YR + 6-digit. |
| 3 | DocType | char | YES | 3 | Document type code. See DocType codes below. |
| 4 | DocDate | datetime | NO | | Transaction date. |
| 5 | LocCode | char | NO | 8 | Location code. |
| 6 | ModuleCode | char | NO | 8 | Module origin (all = `'3       '` which is `'3'` padded). System module ID. |
| 7 | AccMonth | char | NO | 2 | Accounting month (space-padded). |
| 8 | AccYear | char | NO | 4 | Accounting year. |
| 9 | EmpCode | char | NO | 20 | Employee code (may be blank for non-labor transactions). |
| 10 | AccCode | char | NO | 32 | GL account code. e.g. `GA9234`, `CA2118`, `OC7318`, `GA9010`. |
| 11 | BlkCode | char | NO | 8 | Block/station cost center code. e.g. `OFFICE`, `BLR25001`, `GEN01001`. |
| 12 | VehCode | char | NO | 8 | Vehicle/equipment code. |
| 13 | VehExpenseCode | char | NO | 8 | Vehicle expense code. |
| 14 | ItemCode | char | NO | 20 | Item being transacted. e.g. `MO04005`, `MF01001`, `MM07196`. |
| 15 | Unit | decimal(18,6) | NO | | Quantity of items. |
| 16 | Cost | decimal(18,6) | NO | | Unit cost. |
| 17 | Amount | decimal(18,6) | NO | | Total amount (Unit x Cost). Can be negative (reversals/returns). |
| 18 | Price | decimal(18,6) | YES | | Selling unit price. |
| 19 | PriceAmount | decimal(18,6) | YES | | Selling total (Qty x Price). |
| 20 | Description | nvarchar | YES | 1000 | Transaction description. |

### DocType Distribution

| DocType | Count | Interpretation (inferred) |
|---------|-------|---------------------------|
| `'24'` | 64,538 | Stock Issue (SI prefix in DocId) |
| `'25'` | 17,254 | Fuel Issue (FI prefix in DocId) |
| `'20'` | 268 | Stock Adjustment (SA prefix in DocId) |
| `'149'` | 70 | ? |
| `'35'` | 64 | ? |

### Sample Rows by DocType

**DocType='24' (Stock Issue — largest group):**

```
AccYear=2027/01 | DocId=SI26016305 DocLnId=SIL26032485 Type=24
  Item=MO04005 Unit=8  Amount= 64000 | Acc=GA9234 Blk=OFFICE
  Item=MO04003 Unit=7  Amount= 70000 | Acc=GA9234 Blk=OFFICE

Reversal lines (negative amount, different AccCode):
  Item=MO04005 Unit=8  Amount=-64000 | Acc=CA2118 Blk=''
  Item=MO04003 Unit=7  Amount=-70000 | Acc=CA2118 Blk=''
```

**Pattern:** Every stock issue creates a **pair of journal lines** — a debit line (positive Amount, with BlkCode=OFFICE) and a credit line (negative Amount, with BlkCode=''). The AccCode changes from expense account (`GA9234`) to inventory account (`CA2118`) in the reversal.

**DocType='25' (Fuel Issue):**

```
DocId=FI26007327 DocLnId=FIL26008607 Type=25
  Item=MF01001 Unit=32  Amount=542,261.43 | Acc=GA9010 Blk=''
  Item=MF01001 Unit=130 Amount=2,202,937.05 | Acc=GA9010 Blk=''
  Item=MF01001 Unit=142 Amount=2,406,285.09 | Acc=GA9010 Blk=''
  Item=MF01001 Unit=43  Amount=728,663.79 | Acc=GA9010 Blk=''
```

Item MF01001 appears to be a **fuel item** (FuelMeterReading tracked on it). AccCode `GA9010` is the fuel expense account. Note that BlkCode is blank for all fuel issues — fuel transactions are not allocated to planting blocks (they are company-wide operational costs).

**DocType='20' (Stock Adjustment):**

```
DocId=SA25000034 Type=20
  Item=MM07196 Unit=1 Amount=-210,503,975 | Acc=CA2120  (credit: inventory reduction)
  Item=MM07273 Unit=1 Amount=210,503,975   | Acc=CA2120  (debit: inventory addition)
  Item=MM07196 Unit=1 Amount=210,503,975   | Acc=CA2120  (debit: counterpart)
```

Stock adjustments create balanced journal pairs — large amounts indicating inventory revaluation or stocktake corrections.

### AccYear Distribution

| AccYear | Rows |
|---------|------|
| 2027 | 1,336 |
| 2026 | 13,346 |
| 2025 | 12,372 |
| 2024 | 11,376 |
| 2023 | 11,006 |
| 2022 | 9,694 |
| 2021 | 11,046 |
| 2020 | 12,018 |

### Key Interpretation

- **DocId naming:** `SI` = Stock Issue, `FI` = Fuel Issue, `SA` = Stock Adjustment
- **DocLnId naming:** `SIL` = Stock Issue Line, `FIL` = Fuel Issue Line
- **ModuleCode=`'3'`:** All records belong to Module 3 (the Inventory module in this ERP system)
- **Reversal pattern:** Stock issues generate balanced double-entry lines (debit + credit sides), so every transaction appears as a pair with opposite sign Amounts
- **AccCode mapping:** `GA` = expense/gain account, `CA` = cost/inventory account, `OC` = operational cost
- **BlkCode:** Empty for fuel and adjustment transactions; populated for general stock issues (OFFICE, BLR25001, GEN01001)

---

## 4. IN_ITEM_ACC — Item Master Audit / Cost Allocation

**PK:** ID (bigint auto-increment) | **Rows:** 244 | **Columns:** 23

### Schema (23 columns)

| # | Column | Type | Nullable | Width | Description |
|---|--------|------|----------|-------|-------------|
| 1 | ID | bigint | NO | | Auto-increment primary key. Row sequence number. |
| 2 | TrxID | varchar | YES | 20 | Transaction reference = ItemCode. Acts as FK to IN_ITEMCODE.ItemCode. |
| 3 | AccCode | varchar | YES | 20 | GL account code. Empty in all current rows. |
| 4 | BlkCode | varchar | YES | 20 | Block/station code. Empty in all current rows. |
| 5 | SubBlkCode | varchar | YES | 20 | Sub-block/sub-station code. Empty in all current rows. |
| 6 | VehCode | varchar | YES | 20 | Vehicle/equipment code. Empty in all current rows. |
| 7 | ExpCode | varchar | YES | 20 | Expense code. Empty in all current rows. |
| 8 | VehExpCode | varchar | YES | 20 | Vehicle expense code. |
| 9 | SuppCode | varchar | YES | 20 | Supplier code. |
| 10 | BillCode | varchar | YES | 20 | Bill/invoice reference. |
| 11 | ItemCode | varchar | YES | 20 | Item code (populated when TrxID maps to an item). |
| 12 | EmpCode | varchar | YES | 20 | Employee code. |
| 13 | AssCode | varchar | YES | 20 | Asset code. |
| 14 | DeptCode | varchar | YES | 20 | Department code. |
| 15 | WsJobCode | varchar | YES | 20 | Workshop job code. |
| 16 | BudgetID | varchar | YES | 20 | Budget reference ID. |
| 17 | TaskCode | varchar | YES | 20 | Task code. |
| 18 | ContractID | varchar | YES | 20 | Contract ID. |
| 19 | MsgID | varchar | YES | 20 | Message/internal reference. |
| 20 | DocID | varchar | YES | 20 | Document ID. |
| 21 | Dim19 | varchar | YES | 20 | **Custom dimension 19 = Location code.** All 244 rows have `Dim19='PTRJ'`. |
| 22 | Dim20 | varchar | YES | 20 | Custom dimension 20. All rows empty. |
| 23 | TempID | int | YES | | Temporary/hold ID. All 0. |

### All 244 Rows — TrxID Pattern

**IDs 1–158: DC-prefix items (DC00001 through DC00158)**
- TrxID format: `DC00001`, `DC00002`, ... `DC00158`
- ItemCode: empty
- All other fields: empty except Dim19='PTRJ'
- These are the **158 item codes created from a specific item setup/catalog import batch** (likely initial DC item population)

**IDs 159–244: POM-prefix items (POM244, POMBU241–255, POMCO133–139, POMEP244, POMFF290, POMLE165–166, POMMP113, POMMV111–112, POMOE134–139, POMPE153, POMPM297A–343, POMRB109–110)**
- TrxID format: `POM*` — these are **POM (Palm Oil Mill) station items**
- Naming pattern: `POM` + Station code abbreviation:
  - `POMBU*` = POM Boiler Unit
  - `POMCO*` = POM Condensate Outlet
  - `POMEP*` = POM Engine/EP?
  - `POMFF*` = POM Fuel Filter?
  - `POMLE*` = POM Loading Elevator?
  - `POMMP*` = POM Main Press/MP
  - `POMMV*` = POM Motor/Valve?
  - `POMOE*` = POM Oil Exhaust/Exit?
  - `POMPE*` = POM Press Engine?
  - `POMPM*` = POM Press Machine (largest group: POMPM297A–343, 47 items)
  - `POMRB*` = POM Reject/Biomass?
  - `POM244`, `POM302` = individual station items
- All other fields: empty except Dim19='PTRJ'

### Interpretation

IN_ITEM_ACC is the **audit/cost allocation table for the IN_ITEMCODE master table**. The TrxID values in IN_ITEM_ACC reference ItemCodes in IN_ITEMCODE.

The table appears to serve as a **cost-center allocation template** for each item, but currently the AccCode, BlkCode, SubBlkCode, and other allocation fields are **all empty** — this looks like a **planned but not-yet-populated** table.

The data suggests two distinct item setup batches:
1. **DC items** (DC00001–DC00158): 158 items, all with TrxID = ItemCode, no allocation, only Dim19='PTRJ'
2. **POM items** (86 items): Various Palm Oil Mill station items, same pattern — TrxID = ItemCode, no allocation fields populated

The table structure (matching IN_PRLN_ACC's 23-column dimension pattern) suggests it was intended to store **item-level cost center allocations** (which GL account, block, vehicle, employee, etc. an item is charged to). But actual usage is minimal — only 244 rows, all with empty allocation fields.

---

## Cross-Table Relationships

```
IN_ITEMCODE.ItemCode (PK)
       |
       +-- 1:N --> IN_MTHENDITEM.ItemCode  (monthly balance per item+location+period)
       |                  (673K rows = ~11K items x 86 months)
       |
       +-- 1:N --> IN_MTHENDTRX.ItemCode    (transaction journal per item+period)
       |                  (82K rows, keyed by DocId+DocLnId+AccYear+AccMonth)
       |
       +-- 1:N --> IN_ITEM_ACC.TrxID        (audit/cost allocation, TrxID=ItemCode)
                        (244 rows, only DC/POM items have entries)
```

```
IN_ITEMCODE also relates to:
  IN_ITEM.ItemCode     -- IN_ITEM adds LocCode dimension to IN_ITEMCODE
  IN_STOCKISSUELN.ItemCode  -- stock issue transactions
  IN_PRLN.ItemCode     -- purchase requisition lines
  (other IN_*LN tables similarly)
```

---

## Key Observations

### IN_ITEMCODE vs IN_ITEM vs IN_MTHENDITEM

| Aspect | IN_ITEMCODE | IN_ITEM | IN_MTHENDITEM |
|--------|-------------|---------|---------------|
| Location dimension | No (no LocCode) | Yes (composite PK) | Yes (PTRJ only) |
| Time dimension | No (current) | No (current) | Yes (monthly) |
| Rows | 12,058 | 11,976 | 673,053 |
| Primary use | Item master catalog + current state | Per-location current state | Monthly reporting/history |

### IN_MTHENDTRX Double-Entry Pattern

Every stock issue (DocType='24') creates **two journal lines** — one positive (expense/debit), one negative (inventory credit). The paired lines sum to zero. This is a **balanced journal** system where each transaction has both a source and destination account entry.

DocType '24' (Stock Issue): Debit expense account (GA*), credit inventory account (CA*)
DocType '25' (Fuel Issue): Debit fuel expense (GA9010), no block allocation
DocType '20' (Stock Adj): Two-way balancing entries on CA account (inventory revaluation)

### IN_ITEM_ACC is a Sparse/Stub Table

244 rows out of 12,058 possible items. All allocation columns (AccCode, BlkCode, etc.) are empty. Only Dim19='PTRJ' is populated. This suggests the table was partially set up but **cost allocation at the item level is not yet in active use**. The DC00001–DC00158 and POM-prefix items are the only items that received ACC entries, possibly during initial item master setup.

### Char Field Padding

All `char(N)` fields are right-padded with spaces in SQL Server. Always use `RTRIM()` when displaying or comparing. When inserting, the application pads automatically.

### AccYear/AccMonth Storage Format

- AccMonth: 2-char, space-padded. e.g. `'4 '` = April, `'10'` = October (no padding for 10-12)
- AccYear: 4-char, no padding. e.g. `'2026'`
- Always RTRIM() on AccMonth before comparing or displaying

### Server Profile Context

- **SERVER_PROFILE_1 (Estate):** db_ptrj (main estate DB) is OFFLINE; estate inventory data is served from db_ptrj_mill
- **SERVER_PROFILE_3 (Mill/Pabrik):** db_ptrj_mill is the live system (Mill has slightly more recent PR data than Estate)
- Both servers query the same db_ptrj_mill database for inventory data

---

## File Output

This document (`IN_TABLES_MCP.md`), plus any related output files produced by this deep-dive.