# MCP: PR Tables Deep-Dive - IN_PR, IN_PRLN, IN_PRLN_ACC
**Generated:** 2026-05-16 11:34 | **Estate:** SERVER_PROFILE_1 | **Mill:** SERVER_PROFILE_3 | **DB:** db_ptrj_mill

---

## Connection Details

Both Estate and Mill query `db_ptrj_mill` on SQL Server via the SQL Gateway:
```
Base URL  : http://localhost:8001/v1/query
API Key   : 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6
Database  : db_ptrj_mill
```

---

## Row Counts

| Table        | Estate (SP1) | Mill (SP3) |
|--------------|-------------|------------|
| IN_PR        | 9,700       | 10,300     |
| IN_PRLN      | 29,592      | 31,239     |
| IN_PRLN_ACC  | 30,309      | 31,956     |

---

## 1. IN_PR — Purchase Requisition Header

### Schema (14 columns) — IDENTICAL on both Estate and Mill

| # | Column        | Type            | Null? | Key  | Width      | Interpretation                                      |
|---|---------------|-----------------|-------|------|------------|-----------------------------------------------------|
| 1 | PRID          | char            | NO    | **PK** | 100       | PR document number. Format: `PR` + YR + 6-digit seq. e.g. `PR26009918` (Year=26, seq=009918). Composite PK with LocCode. |
| 2 | PRType        | char            | NO    |       | 3         | PR category. Values: `'1'`, `'2'`, `'4'`, `'6'`. See PRType codes below. |
| 3 | TotalAmount   | decimal(20,5)   | YES   |       |           | Total monetary value of PR (Qty x Cost). Nullable; 0 in sample data. |
| 4 | Remark        | nvarchar        | YES   |       | 500       | Free-text note/description for the PR. Often blank. |
| 5 | AccMonth      | char            | YES   |       | 2         | Accounting month (01–12). Groups PR into fiscal period. e.g. `'3 '` = March. |
| 6 | AccYear       | char            | YES   |       | 4         | Accounting year, e.g. `'2020'`. Fiscal year the PR belongs to. |
| 7 | LocCode       | char            | NO    | **PK** | 8         | Location code. Sample shows `'PTRJ    '` (right-padded). Identifies the estate/division originating the PR. |
| 8 | Status        | char            | YES   |       | 2         | PR workflow status. Values: `'1'`, `'2'`, `'3'`, `'4'`, `'6'`. See Status codes below. |
| 9 | CreateDate    | datetime        | YES   |       |           | Server timestamp when PR was created (UTC).        |
|10 | UpdateDate    | datetime        | YES   |       |           | Server timestamp of last modification (UTC).        |
|11 | UpdateID      | char            | YES   |       | 20        | User/operator ID who last modified the PR. e.g. `'adm032'`, `'adm027'`. |
|12 | PrintDate     | datetime        | YES   |       |           | When PR was printed. `'1900-01-01T00:00:00'` = never printed. |
|13 | IsNurseryFlag | bit             | YES   |       |           | Boolean: 1 = Nursery-related PR, 0 = standard.     |
|14 | PRDate        | datetime        | YES   |       |           | Effective/business date of the PR (may differ from CreateDate). |

### PK: (PRID, LocCode) — both are part of the composite primary key.

### PR Status Codes (IN_PR.Status)

| Status | Meaning (inferred)               | Estate Count | Mill Count |
|--------|----------------------------------|-------------|------------|
| `'1 '` | Open / Draft / Pending Approval |     25      |     34     |
| `'2 '` | Approved / Confirmed            |    770      |    930     |
| `'3 '` | Partially Fulfilled / Partial    |    130      |    131     |
| `'4 '` | Fulfilled / Completed           |  1,534      |  1,543     |
| `'6 '` | Closed / Archived / Canceled     |  7,241      |  7,662     |

### PR Type Codes (IN_PR.PRType)

| PRType | Meaning (inferred)        | Estate Count | Mill Count |
|--------|---------------------------|-------------|------------|
| `'1 '` | General / Non-Stock       |  1,369      |  1,576     |
| `'2 '` | Stock Item                |  4,003      |  4,137     |
| `'4 '` | Workshop / Maintenance    |  4,311      |  4,565     |
| `'6 '` | Nursery                   |     17      |     22     |

### Sample Row (Estate/Mill identical data for old PRs)

```
PRID        = 'PR19000221...'          (padded to 100 chars)
PRType      = '4  '                    Workshop/Maintenance
TotalAmount = 0
Remark      = ' ' (blank)
AccMonth    = '3 '                     March
AccYear     = '2020'
LocCode     = 'PTRJ    '               PTRJ Estate
Status      = '6 '                     Closed/Archived
CreateDate  = 2019-06-03 10:22:34 UTC
UpdateDate  = 2019-07-27 16:35:48 UTC
UpdateID    = 'adm032'
PrintDate   = 1900-01-01 (never)
IsNurseryFlag = false
PRDate      = 2019-06-03 00:00:00
```

**Note on char fields:** All char/varchar fields are right-padded with spaces. Always use `RTRIM()` when comparing or displaying.

---

## 2. IN_PRLN — Purchase Requisition Line

### Schema (11 columns) — IDENTICAL on both Estate and Mill

| # | Column          | Type            | Null? | Key  | Width/Default | Interpretation                                        |
|---|-----------------|-----------------|-------|------|---------------|-------------------------------------------------------|
| 1 | PRID            | char            | NO    | **PK** | 20           | Links to IN_PR.PRID. The parent PR document number.   |
| 2 | ItemCode        | char            | NO    | **PK** | 20           | Inventory item code being requested. FK to IN_ITEM.  |
| 3 | QtyReq          | decimal(20,5)   | YES   |       |              | Quantity requested.                                   |
| 4 | QtyRcv          | decimal(20,5)   | YES   |       |              | Quantity received/fulfilled so far.                  |
| 5 | QtyOutstanding  | decimal(20,5)   | YES   |       |              | Remaining qty not yet fulfilled (QtyReq - QtyRcv).   |
| 6 | Cost            | decimal(20,5)   | YES   |       |              | Unit cost at time of PR creation.                    |
| 7 | Amount          | decimal(20,5)   | YES   |       |              | Total amount (QtyReq x Cost). Often 0 in data.       |
| 8 | Status          | char            | YES   |       | 2            | Line-level status. Values: `'1 '` (open/pending), `'2 '` (closed/fulfilled). |
| 9 | BudgetInd       | char            | NO    |       | 1, default='0' | Budget check flag. `'0'` = no budget check, `'1'` = budget-controlled. |
|10 | PRLnID          | char            | NO    | **PK** | 20, default='' | Unique line ID. Format: `PRLN` + YR + 6-digit seq. e.g. `PRLN19000754`. |
|11 | AccCodeDesc     | nchar           | NO    |       | 128, default='' | Description/account name mapped to the line. e.g. `'STOCK'`, `'EFB PRESS NO. 1'`. |

### PK: (PRID, ItemCode, PRLnID) — composite primary key across 3 columns.

### PRLN Status Codes

| Status | Meaning (inferred)      | Estate Count | Mill Count |
|--------|-------------------------|-------------|------------|
| `'1 '` | Open / Pending delivery | 29,222     | 30,843     |
| `'2 '` | Closed / Fulfilled      |    370     |    396     |

### BudgetInd Codes

| BudgetInd | Meaning              | Estate Count | Mill Count |
|-----------|----------------------|-------------|------------|
| `'0'`     | No budget check      | 29,590     | 31,237     |
| `'1'`     | Budget-controlled    |      2     |      2     |

### Sample Rows (Estate)

```
PRID='PR19000221', ItemCode='MM07233', QtyReq=1, QtyRcv=1, QtyOutstanding=0, Cost=0, Amount=0,
Status='1', BudgetInd='0', PRLnID='PRLN19000754', AccCodeDesc=' '

PRID='PR19000222', ItemCode='MM11111', QtyReq=1, QtyRcv=1, QtyOutstanding=0, Cost=0, Amount=0,
Status='1', BudgetInd='0', PRLnID='PRLN19000758', AccCodeDesc='STOCK'

PRID='PR19000222', ItemCode='MM11112', QtyReq=1, QtyRcv=0, QtyOutstanding=1, Cost=0, Amount=0,
Status='1', BudgetInd='0', PRLnID='PRLN19000759', AccCodeDesc='STOCK'

PRID='PR19000223', ItemCode='DC00265', QtyReq=1, QtyRcv=0, QtyOutstanding=1, Cost=0, Amount=0,
Status='1', BudgetInd='0', PRLnID='PRLN19000763', AccCodeDesc='EFB PRESS NO. 1'
```

### Key Relationship

```
IN_PR.PRID (composite PK: PRID+LocCode)
      |
      +-- 1:N --> IN_PRLN.PRID  (each PR has many line items)
                    |
                    +-- 1:N --> IN_PRLN_ACC.TrxID (= IN_PRLN.PRLnID)  (each line has many cost allocations)
```

---

## 3. IN_PRLN_ACC — Purchase Requisition Line Accounting/Cost Allocation

### Schema (23 columns) — IDENTICAL on both Estate and Mill

| # | Column       | Type        | Null? | Key | Width | Interpretation                                             |
|---|--------------|-------------|-------|-----|-------|------------------------------------------------------------|
| 1 | ID           | bigint      | NO    | **PK** |    | Auto-increment primary key. Row sequence number.          |
| 2 | TrxID        | varchar     | YES   |     | 20   | Transaction reference = PRLnID (links to IN_PRLN.PRLnID). Acts as a foreign key. |
| 3 | AccCode      | varchar     | YES   |     | 20   | GL Account code for cost allocation. e.g. `'GA9222'`, `'CA2119'`, `'CA2121'`, `'OC7190'`. |
| 4 | BlkCode      | varchar     | YES   |     | 20   | Block/Station code. e.g. `'STN-OFF'` (Office Station), `'STN-BLR'` (Boiler Station). Estate planting block code. |
| 5 | SubBlkCode   | varchar     | YES   |     | 20   | Sub-block or sub-station. e.g. `'OFFICE  '`, `'BLR03001'`. |
| 6 | VehCode      | varchar     | YES   |     | 20   | Vehicle/Equipment code (if PR is for vehicle). Empty for most rows. |
| 7 | ExpCode      | varchar     | YES   |     | 20   | Expense code / expenditure type. Values seen: `'O'` (Operational), `'L'` (??). Empty for material items. |
| 8 | VehExpCode   | varchar     | YES   |     | 20   | Vehicle expense code.                                     |
| 9 | SuppCode     | varchar     | YES   |     | 20   | Preferred supplier code.                                  |
|10 | BillCode     | varchar     | YES   |     | 20   | Bill/Invoice reference code.                              |
|11 | ItemCode     | varchar     | YES   |     | 20   | Item code (populated when AccCode maps to an inventory item). e.g. `'ME09014'`, `'MG19096'`. |
|12 | EmpCode      | varchar     | YES   |     | 20   | Employee code (for labor-related PR allocations).         |
|13 | AssCode      | varchar     | YES   |     | 20   | Asset code (for asset-related PR allocations).           |
|14 | DeptCode     | varchar     | YES   |     | 20   | Department code for cost center.                          |
|15 | WsJobCode    | varchar     | YES   |     | 20   | Workshop job code (for workshop-type PRs, PRType='4').    |
|16 | BudgetID     | varchar     | YES   |     | 20   | Budget reference ID.                                       |
|17 | TaskCode     | varchar     | YES   |     | 20   | Task code for job costing.                                |
|18 | ContractID   | varchar     | YES   |     | 20   | Contract ID for contractual purchases.                    |
|19 | MsgID        | varchar     | YES   |     | 20   | Message/notes ID (internal ref).                          |
|20 | DocID        | varchar     | YES   |     | 20   | Document ID (internal ref).                               |
|21 | Dim19        | varchar     | YES   |     | 20   | Custom dimension 19 — used as **Location code** (`'PTRJ'` in all samples). |
|22 | Dim20        | varchar     | YES   |     | 20   | Custom dimension 20 — currently unused/empty.             |
|23 | TempID       | int         | YES   |     |       | Temporary/hold ID. Always 0 in data.                      |

### Sample Rows (Estate, recent PRLN_ACC records)

```
ID=3,  TrxID='PRLN19000003', AccCode='GA9222', BlkCode='STN-OFF', SubBlkCode='OFFICE  ', ExpCode='O',
      VehCode='', SuppCode='', BillCode='', ItemCode='', EmpCode='', AssCode='', DeptCode='',
      WsJobCode='', BudgetID='', TaskCode='', ContractID='', MsgID='', DocID='',
      Dim19='PTRJ', Dim20='', TempID=0
      --> General Admin (GA) PRType='2' or workshop PR for office supplies

ID=8,  TrxID='PRLN19000008', AccCode='CA2119', BlkCode='', SubBlkCode='', ExpCode='',
      ItemCode='ME09014', ... Dim19='PTRJ'
      --> Spare part item PR (ME prefix = Mechanical item)

ID=9,  TrxID='PRLN19000009', AccCode='CA2121', ItemCode='MG19096', Dim19='PTRJ'
      --> General material item PR (MG prefix)

ID=10, TrxID='PRLN19000010', AccCode='CA2113', ItemCode='ML0112', Dim19='PTRJ'
      --> Lubricant/oil item PR (ML prefix = Lubricant)
```

### Join Sample (Estate, latest records)

```
PRLnID='PRLN26033412', AccCode='OC7190', BlkCode='STN-BLR', SubBlkCode='BLR03001', ExpCode='L',
LocCode='PTRJ', ItemCode='DC000336', QtyReq=4, QtyRcv=0, QtyOutstanding=4, Cost=0, Amount=0
--> Workshop/cost center line item at Boiler station, partially pending

PRLnID='PRLN26033411', AccCode='CA2119', ItemCode='ME03226', QtyReq=5, QtyRcv=0, QtyOutstanding=5
--> Mechanical spares pending receipt

PRLnID='PRLN26033410', AccCode='CA4813', ItemCode='DC05374', QtyReq=1, QtyRcv=0, QtyOutstanding=1
--> Workshop item pending

PRLnID='PRLN26033409', AccCode='CA2121', ItemCode='MG19050', QtyReq=20, QtyRcv=0, QtyOutstanding=20
--> General stock item (MG), 20 units pending

PRLnID='PRLN26033408', AccCode='CA2121', ItemCode='MG19160', QtyReq=2, QtyRcv=0, QtyOutstanding=2
--> General stock item (MG), small qty pending
```

---

## Key Observations

### 1. PRID / PRLnID Naming Convention
- PRID: `PR` + last 2 digits of year + 6-digit sequence. e.g. `PR26009918` = year 2026, seq 009918.
- PRLnID: `PRLN` + year + 6-digit sequence. e.g. `PRLN26033412` = year 2026, seq 033412.
- The PRLnID sequence does NOT directly correspond to PRID sequence (one PR can have multiple lines, each with its own PRLnID).

### 2. Composite PK on IN_PR
The composite PK `(PRID, LocCode)` means the same PRID can exist in multiple locations. All current data shows `LocCode='PTRJ'`.

### 3. TotalAmount and Cost/Amount = 0 in Most Records
- Most PR lines have `Cost=0`, `Amount=0`, and `IN_PR.TotalAmount=0`.
- This suggests the system records quantities first and costs may be filled at the PO stage, or costs are entered later.

### 4. IN_PRLN_ACC acts as a cost/allocation dimension table
- One PRLN line can have multiple ACC rows (different cost centers, blocks, or split accounts).
- `TrxID` in ACC = `PRLnID` in PRLN (not `PRID`).
- `Dim19` always contains the location code (e.g. `'PTRJ'`).
- `BlkCode` / `SubBlkCode` define the estate block/station cost center.

### 5. PRType 4 = Workshop/Maintenance
- `AccCodeDesc='EFB PRESS NO. 1'` or `BlkCode='STN-BLR'` indicate workshop/cost-center-based PRs.
- Workshop items have `WsJobCode` dimension populated.

### 6. Mill vs Estate Difference
- Mill (SERVER_PROFILE_3) has slightly more records across all three tables (~600 more PRs, ~1,600 more lines).
- The newest Mill PRs (`PR26010518`) are from today (2026-05-16), while Estate newest (`PR26009918`) is from Jan 2026 — suggesting Mill is the live/current system and Estate data may lag.

### 7. All char fields are right-padded
- Always use `RTRIM()` for display and `LTRIM(RTRIM())` for comparisons.
- When inserting, the app may pass trimmed values, so pad-to-width is automatic.

### 8. AccCode Prefixes
| Prefix | Inferred Category        |
|--------|-------------------------|
| GA     | General Administration   |
| CA     | Cost Account / Inventory|
| OC     | Overhead Cost / Workshop|
| EM     | Employee-related        |
| FA     | Fixed Asset             |

---

## File Output

- `pr_tables_deepdive.json` — Full schema + sample rows (estate + mill)
- `pr_tables_extra.json` — Status distributions, recent PRs, join samples
- `PR_TABLES_MCP.md` — This document
