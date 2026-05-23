# IN_STOCKISSUE / IN_STOCKISSUELN / IN_STOCKRTN / IN_STOCKRTNLN / IN_STOCKADJ / IN_STOCKADJLN
# Deep-Dive: SERVER_PROFILE_1 (10.0.0.110) · db_ptrj_mill · Store: MCP

> Generated: 2026-05-16 | SQL Gateway: http://localhost:8001 | API Key: `2a993486...`

---

## Connection

```
POST http://localhost:8001/v1/query
Header: x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6

Body: { "sql": "...", "server": "SERVER_PROFILE_1", "database": "db_ptrj_mill" }
```

**Important:** `db_ptrj` (main estate DB) is OFFLINE. Use `db_ptrj_mill` instead.
All `char(N)` fields are space-padded — always use `RTRIM()`.

---

## Row Counts

| Table            | Rows  | Role                         |
|------------------|-------|------------------------------|
| IN_STOCKISSUE    | 15514 | Stock issue / issuance header |
| IN_STOCKISSUELN  | 30637 | Stock issue line items        |
| IN_STOCKRTN      |    31 | Stock return header           |
| IN_STOCKRTNLN    |    32 | Stock return line items       |
| IN_STOCKADJ      |    34 | Stock adjustment header       |
| IN_STOCKADJLN    |   134 | Stock adjustment line items   |

---

## IN_STOCKISSUE — Stock Issue Header

**Purpose:** Records outbound stock issuances (materials issued from warehouse to cost centres / workers).
Often called a "material requisition / issue slip."

### Schema (21 columns)

| # | Column             | Type              | Nullable | Description |
|---|--------------------|-------------------|----------|-------------|
| 1 | StockIssueID       | char(20) PK       | NO       | Document number, format SIYYNNNNN (e.g. SI26015514). Space-padded. |
| 2 | DNID               | char(20)          | YES      | Delivery Note ID — delivery note reference (usually blank). |
| 3 | BillPartyCode      | char(20)          | YES      | Third-party bill-to party code (usually blank, internal only). |
| 4 | IssueType          | char(2)           | YES      | Issue classification. Value is always `'1 '` (uniform across all 15,514 rows) — meaning standard stock issue. |
| 5 | TotalAmount        | decimal(18,2)     | YES      | Sum(Qty * Cost) = GL amount posted to accounts. |
| 6 | Remark             | nvarchar(500)     | YES      | Free-text note, e.g. `#cp02#` for copy-to instructions. |
| 7 | AccMonth           | char(2)           | YES      | Accounting period month (1-12, space-padded). |
| 8 | AccYear            | char(4)           | YES      | Accounting year, e.g. `'2020'`, `'2026'`. |
| 9 | LocCode            | char(8)           | NO       | Issuing warehouse location. Always `'PTRJ    '` (Estate office). |
| 10| Status             | char(2)           | YES      | Document lifecycle status. See Status table below. |
| 11| PayrollPosted      | char(2)           | YES      | `'0 '` = not posted to payroll, `'1 '` = posted. |
| 12| CreateDate         | datetime          | YES      | UTC timestamp when record was created. |
| 13| UpdateDate         | datetime          | YES      | UTC timestamp of last modification. |
| 14| UpdateID           | char(20)          | YES      | User ID who last updated (space-padded, e.g. `'adm078              '`). |
| 15| PrintDate          | datetime          | YES      | UTC timestamp when document was printed. `1900-01-01` = never printed. |
| 16| TotalPrice         | decimal(18,2)     | NO       | Sum(Qty * Price) — selling/transfer price (same as TotalAmount for internal issues). |
| 17| ChargeLocCode      | char(8)           | NO       | Cost-centre location to charge. Always `'PTRJ    '` — same as LocCode (internal). |
| 18| PSEMPCODE          | char(20)          | YES      | Payroll employee code — used when issues are charged to specific workers (blank for most). |
| 19| PostDate           | datetime          | NO       | UTC timestamp when document was posted to GL. `1900-01-01` = not yet posted. |
| 20| StockIssueRefDate  | datetime          | YES      | Reference date from external system / request date. |
| 21| StockIssueRefNo    | varchar(32)       | YES      | Reference number from external system. |

### Status Values

| Status | Label      | Count  | Meaning |
|--------|------------|--------|---------|
| `'1 '` | Draft      |     18 | Created, not yet submitted |
| `'2 '` | Pending    |     84 | Submitted, awaiting approval |
| `'3 '` | Submitted  |     67 | Approved, ready to post |
| `'6 '` | Posted     | 15,345 | Posted to GL / completed |

### Year Distribution

| AccYear | Count |
|---------|------:|
| 2020    |  2603 |
| 2021    |  2347 |
| 2022    |  1898 |
| 2023    |  2056 |
| 2024    |  1894 |
| 2025    |  2696 |
| 2026    |  2020 |

### Interpretation

- `IssueType = '1 '` is the ONLY type — this is the standard internal material issue type.
- `DNID` and `BillPartyCode` are rarely used (mostly blank), indicating internal-only transactions.
- `ChargeLocCode = 'PTRJ'` — all issues charged to the PTRJ (Estate) location, not distributed to estate divisions.
- Status `'6 '` = posted/completed dominates (99%), meaning most issues are fully processed.
- `PSEMPCODE` is mostly blank — direct worker/material charging is rare, most go to cost-centre blocks.
- Recent records (2026) processed by `adm078` — active user as of Jan 2026.

---

## IN_STOCKISSUELN — Stock Issue Line Items

**Purpose:** Individual material lines per IN_STOCKISSUE header. Each line charges a specific item to a cost-centre block.

### Schema (19 columns)

| # | Column            | Type              | Nullable | Description |
|---|-------------------|-------------------|----------|-------------|
| 1 | StockIssueLNID    | char(20) PK       | NO       | Line ID, format SILYYNNNNN (e.g. SIL26030814). |
| 2 | StockIssueID      | char(20) FK       | NO       | → IN_STOCKISSUE.StockIssueID |
| 3 | AccCode           | char(32)          | YES      | GL account code to charge (e.g. `'GA9234'`, `'OC7120'`). Space-padded. |
| 4 | BlkCode           | char(8)           | YES      | Cost-centre / block code (e.g. `'OFFICE'`, `'THR13001'`). |
| 5 | VehCode           | char(8)           | YES      | Vehicle code (blank for most). |
| 6 | VehExpCode        | char(8)           | YES      | Vehicle expense category code. |
| 7 | PsEmpCode         | char(20)          | YES      | Worker/employee code (blank for most). |
| 8 | ItemCode          | char(20) PK       | NO       | → IN_ITEMCODE. Item issued. |
| 9 | QtyReturn         | decimal(18,2)     | YES      | Quantity previously returned (for return tracking). |
| 10| Qty               | decimal(18,2)     | YES      | Issued quantity (the main field). |
| 11| Cost              | decimal(18,2)     | YES      | Unit cost used for GL Amount. |
| 12| Amount            | decimal(18,2)     | YES      | Qty × Cost — GL amount for this line. |
| 13| Price             | decimal(18,2)     | NO       | Transfer/selling price per unit. |
| 14| PriceAmount       | decimal(18,2)     | NO       | Qty × Price. |
| 15| TotalPrice        | decimal(18,2)     | NO       | Same as PriceAmount. |
| 16| TaxRate           | decimal(18,2)     | YES      | Tax rate (null = no tax). |
| 17| TaxRef            | varchar(20)       | YES      | Tax invoice reference. |
| 18| TaxInd            | varchar(1)        | YES      | Tax indicator: `'0'` = no tax. |
| 19| ExportHistoryID   | bigint            | YES      | Integration tracking ID. |

### Sample Lines (recent)

```
StockIssueLNID  StockIssueID  ItemCode   AccCode   BlkCode     Qty      Cost         Amount
SIL26030814      SI26015514    MO04004    GA9234    OFFICE         2    12,000       24,000
SIL26030813      SI26015514    MO01023    GA9234    OFFICE         1 1,550,000    1,550,000
SIL26030812      SI26015513    MO04036    OC7130    THR13001       1    81,000       81,000
SIL26030811      SI26015512    MC01006    OC7230    WTP07001     0.2   121,477       24,295
SIL26030810      SI26015512    MC01005    OC7230    WTP06001      25    22,799      569,985
```

### Interpretation

- `AccCode` maps to GL accounts: `GA*` = general admin, `OC*` = operational cost.
- `BlkCode` is the cost-centre block: `OFFICE` (admin), `THR13001` (maintenance), `WTP*` (water treatment plant).
- `QtyReturn` tracks partial returns — most lines have 0.
- Cost and Price are often identical (internal transfer = no margin).
- Tax is almost never applied (`TaxInd = '0'`, `TaxRate = null`).

---

## IN_STOCKRTN — Stock Return Header

**Purpose:** Records returns of previously issued materials back to the warehouse.

### Schema (16 columns)

| # | Column           | Type              | Nullable | Description |
|---|------------------|-------------------|----------|-------------|
| 1 | StockRtnId       | char(20) PK       | NO       | Document number, format SRYYNNNNN (e.g. SR19000001). |
| 2 | LocCode          | char(8)           | NO       | Receiving warehouse location. Always `'PTRJ    '`. |
| 3 | AccMonth         | char(2)           | YES      | Accounting period month. |
| 4 | AccYear          | char(4)           | YES      | Accounting year. |
| 5 | TotalAmount      | decimal(18,2)     | YES      | Sum(Qty * Cost) of returned items. |
| 6 | Remark           | nvarchar(500)     | YES      | Free-text note. |
| 7 | PrintDate        | datetime          | YES      | Print timestamp. `1900-01-01` = never printed. |
| 8 | PayrollPosted    | char(2)           | YES      | `'0 '` = not posted to payroll. |
| 9 | Status           | char(2)           | YES      | Lifecycle status. All 31 records have Status = `'5 '` (completed/posted). |
| 10| CreateDate       | datetime          | YES      | UTC creation timestamp. |
| 11| UpdateDate       | datetime          | YES      | UTC last-mod timestamp. |
| 12| UpdateID         | char(20)          | YES      | User who last updated (e.g. `'adm037              '`). |
| 13| TotalPrice       | decimal(18,2)     | NO       | Sum(Qty * Price). |
| 14| PostDate         | datetime          | NO       | GL posting timestamp. |
| 15| StockRtnDate     | datetime          | YES      | Date of return (as entered by user). |
| 16| CNID             | char(20)          | YES      | Credit Note ID reference (always null). |

### Year Distribution

| AccYear | Count |
|---------|------:|
| 2020    |     4 |
| 2021    |     1 |
| 2022    |     1 |
| 2023    |     3 |
| 2024    |     1 |
| 2025    |    21 |

### Sample Records

```
StockRtnId     LocCode  AccMonth  AccYear  TotalAmount    Status  StockRtnDate     CreateDate        UpdateID
SR19000001     PTRJ     4         2020      685,627.47    5       2019-07-01       2019-07-01 09:33  adm037
SR19000002     PTRJ     4         2020       80,000.00    5       2019-07-10       2019-07-10 15:47  adm032
SR20000003     PTRJ    12         2020      162,893.80    5       2020-03-28       2020-03-31 14:47  adm037
SR20000004     PTRJ    12         2020      325,787.59    5       2020-04-01       2020-04-01 16:30  adm037
SR21000005     PTRJ     1         2021       15,000.00    5       2021-01-04       2021-01-04 09:58  adm037
```

### Interpretation

- Very low volume — only 31 return documents across 6 years.
- All records are Status `'5 '` (completed/posted) — no pending returns.
- 2025 has the most returns (21), indicating a possible change in return handling practice.
- Returns reference the original `StockIssueID` in the line table (IN_STOCKRTNLN).
- `CNID` is always null — no credit note integration in use.

---

## IN_STOCKRTNLN — Stock Return Line Items

**Purpose:** Individual return lines. Links back to the original stock issue and issue line for return tracking.

### Schema (19 columns)

| # | Column            | Type              | Nullable | Description |
|---|-------------------|-------------------|----------|-------------|
| 1 | StockRtnLNID      | char(20) PK       | NO       | Line ID, format SRLYYNNNNN. |
| 2 | StockRtnID        | char(20) FK       | NO       | → IN_STOCKRTN.StockRtnId |
| 3 | StockIssueID      | char(20) FK       | YES      | → IN_STOCKISSUE.StockIssueID (original issue being returned). |
| 4 | StockIssueLNID    | char(20) FK       | YES      | → IN_STOCKISSUELN.StockIssueLNID (original issue line). |
| 5 | AccCode           | char(32)          | YES      | GL account to credit (e.g. `'OC7190'`). |
| 6 | BlkCode           | char(8)           | YES      | Block/cost-centre being credited. |
| 7 | VehCode           | char(8)           | YES      | Vehicle code. |
| 8 | VehExpCode        | char(8)           | YES      | Vehicle expense code. |
| 9 | PsEmpCode         | char(20)          | YES      | Worker code. |
| 10| ItemCode          | char(20) PK       | NO       | → IN_ITEMCODE. Item being returned. |
| 11| Qty               | decimal(18,2)     | YES      | Returned quantity. |
| 12| Cost              | decimal(18,2)     | YES      | Unit cost (inherited from original issue). |
| 13| Amount            | decimal(18,2)     | YES      | Qty × Cost — GL credit amount. |
| 14| Price             | decimal(18,2)     | NO       | Transfer price per unit. |
| 15| PriceAmount       | decimal(18,2)     | NO       | Qty × Price. |
| 16| ChargeLocCode     | char(8)           | NO       | Location being credited (always `'PTRJ    '`). |
| 17| TaxRate           | decimal(18,2)     | YES      | Tax rate. |
| 18| TaxRef            | varchar(20)       | YES      | Tax reference. |
| 19| TaxInd            | varchar(1)        | YES      | Tax indicator: `'0'` = no tax. |

### Sample Lines

```
StockRtnLNID   StockRtnID   StockIssueID   StockIssueLNID  ItemCode   AccCode   BlkCode     Qty      Cost          Amount
SRL19000001    SR19000001   SI19000456     SIL19000757    MC01006    OC7190    BLR25001       8  85,703.43   685,627.47
SRL19000002    SR19000002   SI19000669     SIL19001116    MO09002    GA9050                2  40,000.00    80,000.00
SRL20000003    SR20000003   SI20002583     SIL20004528    MC01004    OC7190    BLR25001       2  81,446.90   162,893.80
SRL20000004    SR20000004   SI20002591     SIL20004544    MC01004    OC7190    BLR25001       4  81,446.90   325,787.59
SRL21000005    SR21000005   ...            ...            ...        ...       ...           ...
```

### Interpretation

- Full traceability: each return line references the original `StockIssueID` and `StockIssueLNID`.
- Returns reduce inventory at the same GL accounts originally charged.
- `BlkCode` often blank for GA (admin) returns vs. filled for estate blocks (`BLR25001`).
- Only 32 line items for 31 header records — most returns have 1 line (occasionally 2).
- `QtyReturn` in IN_STOCKISSUELN can be cross-checked against these values.

---

## IN_STOCKADJ — Stock Adjustment Header

**Purpose:** Records inventory corrections, recondisi (reconditioning), and cut-off adjustments.
Adjustments modify on-hand quantities and/or average costs.

### Schema (16 columns)

| # | Column           | Type              | Nullable | Description |
|---|------------------|-------------------|----------|-------------|
| 1 | StockAdjID       | char(20) PK       | NO       | Document number, format SAYYNNNNN (e.g. SA25000034). |
| 2 | AccMonth         | char(2)           | YES      | Accounting period month. |
| 3 | AccYear          | char(4)           | YES      | Accounting year. |
| 4 | Remark           | nchar(256)        | YES      | Description of adjustment. Space-padded. |
| 5 | PrintDate        | datetime          | YES      | Print timestamp. `1900-01-01` = never printed. |
| 6 | LocCode          | char(8)           | NO       | Warehouse location. Always `'PTRJ    '`. |
| 7 | TotalAmount      | decimal(18,2)     | YES      | Net adjustment amount (Sum of line adjustments). Can be negative. |
| 8 | Status           | char(2)           | YES      | All 34 records = `'5 '` (completed/posted). |
| 9 | CreateDate       | datetime          | YES      | UTC creation timestamp. |
| 10| UpdateDate       | datetime          | YES      | UTC last-mod timestamp. |
| 11| UpdateID         | char(20)          | YES      | User (e.g. `'yencun              '`). |
| 12| AdjType          | char(2)           | NO       | Adjustment type. See AdjType table below. |
| 13| TransType        | char(2)           | NO       | Transaction type. See TransType table below. |
| 14| PostDate         | datetime          | NO       | GL posting timestamp. |
| 15| StockAdjDate     | datetime          | YES      | User-entered adjustment date. |
| 16| (missing CNID)  | —                 | —        | Not present in this table. |

### AdjType × TransType Distribution

| AdjType | TransType | Count | Interpretation |
|---------|-----------|------:|----------------|
| `'5 '`  | `'1 '`    |     4 | Type 5, direction 1 (quantity increase / new stock) |
| `'5 '`  | `'2 '`    |    30 | Type 5, direction 2 (negative adjustment / correction) |

### Year Distribution

| AccYear | Count |
|---------|------:|
| 2020    |    14 |
| 2021    |     1 |
| 2024    |     5 |
| 2025    |    12 |
| 2026    |     2 |

### Sample Records

```
StockAdjID  AccYear  AdjType  TransType  TotalAmount      Status  StockAdjDate     Remark
SA19000001  2020     5        —          95              5       2019-08-15       Recondisi
SA19000002  2020     5        2         -58,284,257      5       2019-08-23       Selisih Cut Off April May Juni
SA19000003  2020     5        2         -20,960,213      5       2019-08-23       Selisih Cut Off April May Juni
SA19000004  2020     5        2          5,000,000       5       2019-08-23       Barang Recondisi dari Workshop
SA25000034  2026     5        2                  0      5       2025-08-07       (latest)
```

### Interpretation

- `AdjType = '5 '` is the only adjustment type used (uniform across all 34 records).
- `TransType = '1 '` = positive adjustment (e.g. goods found, recondisi returns).
- `TransType = '2 '` = negative adjustment (e.g. cut-off corrections, scrap, write-off).
- The large negative adjustments in 2020 (-58M, -20M) represent cut-off / inventory revaluation events.
- `Remark` contains the reason: "Recondisi", "Selisih Cut Off" (cut-off discrepancy), "Barang Recondisi dari Workshop".
- All records Status `'5 '` = posted/completed.
- `yencun` is the primary adjustment operator.

---

## IN_STOCKADJLN — Stock Adjustment Line Items

**Purpose:** Individual item lines for stock adjustments. Tracks both old (D_) and new (N_) quantities and costs.

### Schema (22 columns)

| # | Column             | Type              | Nullable | Description |
|---|--------------------|-------------------|----------|-------------|
| 1 | StockAdjLNID       | char(20) PK       | NO       | Line ID, format SALYYNNNNN. |
| 2 | StockAdjID         | char(20) FK       | NO       | → IN_STOCKADJ.StockAdjID |
| 3 | AccCode            | char(32)          | YES      | GL account for adjustment (e.g. `'CA2410'`, `'CA2120'`, `'OC7200'`). |
| 4 | BlkCode            | char(8)           | YES      | Block/cost-centre. |
| 5 | VehCode            | char(8)           | YES      | Vehicle code. |
| 6 | VehExpCode         | char(8)           | YES      | Vehicle expense code. |
| 7 | AdjRefNo           | char(32)          | YES      | Adjustment reference number. |
| 8 | ItemCode           | char(20) PK       | NO       | → IN_ITEMCODE. Item being adjusted. |
| 9 | Quantity           | decimal(18,2)     | NO       | Old/current quantity before adjustment. |
| 10| AverageCost        | decimal(18,2)     | NO       | Old average cost before adjustment. |
| 11| DiffAverageCost    | decimal(18,2)     | NO       | Old cost difference. |
| 12| TotalCost          | decimal(18,2)     | NO       | Old total cost (Quantity × AverageCost). |
| 13| N_Quantity         | decimal(18,2)     | NO       | **New quantity** after adjustment. |
| 14| N_AverageCost      | decimal(18,2)     | NO       | **New average cost** after adjustment. |
| 15| N_DiffAverageCost  | decimal(18,2)     | NO       | New cost difference. |
| 16| N_TotalCost        | decimal(18,2)     | NO       | **New total cost** after adjustment. |
| 17| D_Quantity         | decimal(18,2)     | NO       | **Delta quantity** (N_Quantity - Quantity). Often negative for corrections. |
| 18| D_AverageCost      | decimal(18,2)     | NO       | Delta average cost. |
| 19| D_DiffAverageCost  | decimal(18,2)     | NO       | Delta cost diff. |
| 20| D_TotalCost        | decimal(18,2)     | NO       | **Delta total cost** = N_TotalCost - TotalCost. |
| 21| GroupID            | char(20)          | NO       | Group/batch ID (always space-padded, rarely used). |

### Sample Lines

```
StockAdjLNID  StockAdjID  ItemCode   AccCode  Quantity  N_Quantity  N_TotalCost     D_Quantity  D_TotalCost
SAL25000137   SA25000034  MM07273    CA2120         0          11    210,503,975         11    210,503,975
SAL25000136   SA25000034  MM07196    CA2120        14           3     61,061,253        -11   -210,503,975
SAL25000135   SA25000033  MF01001    OC7200    10,942      11,164   157,674,914        222            1
SAL25000134   SA25000032  MF01001    OC7200     9,755      10,149   141,758,084        394            1
SAL25000133   SA25000031  MF01001    OC7200     6,334       6,884    86,469,026        550            1
```

### Interpretation

- `Quantity` = on-hand qty before adjustment; `N_Quantity` = after.
- `D_Quantity` = net change (positive = added, negative = removed/reduced).
- `D_TotalCost` = financial impact on inventory value.
- `AccCode` prefixes: `CA*` = current asset (inventory) accounts; `OC*` = operational cost.
- For cut-off corrections (SA25000034): one line adds items (MM07273 +11), another removes (MM07196 -11) with large cost reversal.
- For physical count adjustments (SA25000033-35): items like MF01001 (fuel) get small D_TotalCost = 1 (minimal cost, large qty change = unit price correction).
- The `D_TotalCost = 1` pattern in 2025 adjustments suggests cost recalculation rather than actual value changes.

---

## Relationship Map

```
IN_STOCKISSUE (PK: StockIssueID)
  └─ 1:N ── IN_STOCKISSUELN (FK: StockIssueID, PK: StockIssueLNID)
         ItemCode ──→ IN_ITEMCODE(ItemCode)
         AccCode  ──→ [GL Account]
         BlkCode  ──→ [Cost Centre / Block]

IN_STOCKRTN (PK: StockRtnId)
  └─ 1:N ── IN_STOCKRTNLN (FK: StockRtnID, StockIssueID, StockIssueLNID)
         StockIssueID, StockIssueLNID ──→ IN_STOCKISSUELN (return traceability)
         ItemCode ──→ IN_ITEMCODE(ItemCode)

IN_STOCKADJ (PK: StockAdjID)
  └─ 1:N ── IN_STOCKADJLN (FK: StockAdjID, PK: StockAdjLNID)
         ItemCode ──→ IN_ITEMCODE(ItemCode)
         AccCode  ──→ [GL Account]

IN_STOCKISSUE ←── (return linkage in RTNLN) ── IN_STOCKRTN
```

---

## Key Findings Summary

| Aspect | IN_STOCKISSUE | IN_STOCKRTN | IN_STOCKADJ |
|--------|---------------|-------------|-------------|
| **Volume** | Very high (15,514 docs) | Very low (31 docs) | Very low (34 docs) |
| **Period** | 2020–2026 (active) | 2020–2025 (sparse) | 2020–2026 (sporadic) |
| **Status** | Mix of 1/2/3/6 | All = 5 (posted) | All = 5 (posted) |
| **Primary Type** | IssueType '1' (standard) | All same type | AdjType '5' only |
| **Direction** | Outbound (warehouse → estate) | Inbound (estate → warehouse) | Bidirectional via TransType |
| **TransType** | N/A | N/A | '1'=positive, '2'=negative |
| **AccCode pattern** | GA (admin), OC (operational) | OC (operational) | CA (asset), OC (operational) |
| **Tax** | No tax (TaxInd='0') | No tax | N/A |
| **Main operator** | adm078 (recent) | adm037, adm032 | yencun |

### Workflow Interpretation

```
[PR created] → [PO] → [Goods Received] → [IN_STOCKISSUE issued]
                                              ↓
                                    [Workers use materials]
                                              ↓
                         [Return if unused] → IN_STOCKRTN
                                              ↓
                         [Adjustment] → IN_STOCKADJ (recondisi/cut-off/scrutiny)
```

### Special Notes

- **IN_STOCKRTN** is underused (only 31 returns in 6 years) — may indicate that returns are not consistently recorded.
- **IN_STOCKADJ** has large cut-off corrections in 2020 (-58M, -20M total) suggesting manual inventory corrections were made at year-end cut-off.
- `ChargeLocCode = 'PTRJ'` for all stock issues means estate divisions are not individually charged — they draw from a central PTRJ pool.
- `BlkCode` in issue lines shows specific cost-centres: `OFFICE`, `THR13001` (thrashing machine), `WTP*` (water treatment), `BLR*` (bulker/logistic).
- The `D_TotalCost = 1` pattern in recent adjustments (2025) suggests cost recalculations rather than real value changes.