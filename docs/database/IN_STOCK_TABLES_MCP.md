# MCP: IN_STOCK Tables + Comparative Analysis
**Generated:** 2026-05-16 | **Estate:** SERVER_PROFILE_1 | **Mill:** SERVER_PROFILE_3 | **DB:** db_ptrj_mill

---

## Row Counts

| Table | Estate (SP1) | Mill (SP3) | Diff |
|---|---|---|---|
| IN_STOCKISSUE | 15,514 | 16,380 | +866 |
| IN_STOCKISSUELN | 30,637 | 32,501 | +1,864 |
| IN_STOCKRTN | 31 | 31 | 0 |
| IN_STOCKRTNLN | 32 | 32 | 0 |
| IN_STOCKADJ | 34 | 34 | 0 |
| IN_STOCKADJLN | 134 | 134 | 0 |
| IN_STOCKRECEIVE | 0 | 0 | 0 |
| IN_STOCKTRANSFER | 0 | 0 | 0 |

**Mill is more active** — 866 more issue headers, 1,864 more issue lines. Estate and Mill share identical return and adjustment data (last updated 2025).

---

## 1. IN_STOCKISSUE — Stock Issue Header

**PK:** StockIssueID (char 20, NOT NULL) | **LocCode:** PTRJ (Estate office)

### Schema (observed)

| # | Column | Type | Nullable | Interpretation |
|---|---|---|---|---|
| 1 | StockIssueID | char(20) | NO | **PK.** Format: `SIYYNNNNNNNN` e.g. `SI26015514` (Year 26, seq 015514) |
| 2 | LocCode | char(8) | NO | Location code. All = `PTRJ` |
| 3 | Status | char(2) | YES | Status. `'1 '` = open, `'5 '` = posted/closed |
| 4 | TotalAmount | decimal | YES | Total value of all lines |
| 5 | CreateDate | datetime | YES | Record creation timestamp (UTC) |
| 6 | UpdateDate | datetime | YES | Last modification timestamp |
| 7 | AccYear | char(4) | YES | Accounting year |
| 8 | AccMonth | char(2) | YES | Accounting month |

### Sample Data (Estate, most recent)

```
StockIssueID = 'SI26015514', LocCode = 'PTRJ', Status = '1 ', TotalAmount = 1,574,000
  CreateDate = 2026-01-12T10:08:56, UpdateDate = 2026-01-12T10:09:10
  Lines: MO01023 (qty=1, amt=1,550,000) + MO04004 (qty=2, amt=24,000)
  --> Issue of 2 items, value 1.574M IDR, still open

StockIssueID = 'SI26015513', LocCode = 'PTRJ', Status = '1 ', TotalAmount = 81,000
  CreateDate = 2026-01-12T10:06:41, UpdateDate = 2026-01-12T10:07:01
  Line: MO04036 (qty=1, amt=81,000)
```

---

## 2. IN_STOCKISSUELN — Stock Issue Line

**PK:** StockIssueLNID (char 20, NOT NULL) | **FK:** StockIssueID → IN_STOCKISSUE

### Schema (observed)

| # | Column | Type | Nullable | Interpretation |
|---|---|---|---|---|
| 1 | StockIssueLNID | char(20) | NO | **PK.** Format: `SILLYYNNNNNNNN` e.g. `SIL26030001` |
| 2 | StockIssueID | char(20) | NO | **FK to IN_STOCKISSUE** |
| 3 | ItemCode | char(20) | YES | Item being issued |
| 4 | Qty | decimal(18,6) | YES | Quantity issued |
| 5 | Unit | char(8) | YES | Unit of measure |
| 6 | Cost | decimal(18,6) | YES | Unit cost |
| 7 | Amount | decimal(18,6) | YES | Total amount (Qty x Cost) |
| 8 | AccCode | char(32) | YES | GL account code charged |
| 9 | BlkCode | char(8) | YES | Block/estate section code |
| 10 | VehCode | char(8) | YES | Vehicle code (if vehicle issue) |

### Business Logic

- **One StockIssueID → many StockIssueLNID rows** (multiple items per issue)
- `AccCode` determines which GL account is charged (e.g., `CA4813` for workshop, `GA*` for general admin)
- `BlkCode` routes cost to estate block/station cost center
- `VehCode` used when issue is for a specific vehicle/equipment

---

## 3. IN_STOCKRTN — Stock Return Header

**PK:** StockRtnID (char 20) | **LocCode:** PTRJ | **Status:** `'5 '` (posted/closed for all records)

### Schema (observed)

| # | Column | Type | Nullable | Interpretation |
|---|---|---|---|---|
| 1 | StockRtnID | char(20) | NO | **PK.** Format: `SRYYNNNNNNNN` e.g. `SR25000031` |
| 2 | LocCode | char(8) | NO | Location (PTRJ) |
| 3 | Status | char(2) | YES | All = `'5 '` (posted/closed) |
| 4 | TotalAmount | decimal | YES | Total return value |
| 5 | CreateDate | datetime | YES | Record creation timestamp |
| 6 | UpdateDate | datetime | YES | Last modification timestamp |

### Sample Data (Estate)

```
SR25000031: TotalAmount=53,750, CreateDate=2025-03-18, Status='5 '
  --> Small return, 2 line items (MO03004 + MO03003), credited to CA1180

SR24000030: TotalAmount=2,152,004.85, CreateDate=2024-07-30, Status='5 '
  --> Medium return, MC01004 (20 units), credited to OC7230

SR24000029: TotalAmount=23,000,000, CreateDate=2024-04-18, Status='5 '
SR24000028: TotalAmount=50,600,000, CreateDate=2024-04-18, Status='5 '
SR24000027: TotalAmount=46,000,000, CreateDate=2024-04-18, Status='5 '
  --> Large returns (Apr 2024), MO04164 (Karung Plastik 60x70), credited to CA4813
```

---

## 4. IN_STOCKRTNLN — Stock Return Line

**PK:** StockRtnLNID (char 20) | **FK:** StockRtnID, StockIssueID

### Schema (observed)

| # | Column | Type | Nullable | Interpretation |
|---|---|---|---|---|
| 1 | StockRtnLNID | char(20) | NO | **PK.** Format: `SRLYYNNNNNNNN` e.g. `SRL25000032` |
| 2 | StockRtnID | char(20) | NO | **FK to IN_STOCKRTN header** |
| 3 | StockIssueID | char(20) | YES | **FK back to original IN_STOCKISSUE** |
| 4 | ItemCode | char(20) | YES | Item being returned |
| 5 | Qty | decimal | YES | Quantity returned |
| 6 | Cost | decimal | YES | Unit cost at return time |
| 7 | Amount | decimal | YES | Total (Qty x Cost) |
| 8 | AccCode | char(32) | YES | GL account credited |

### Return Flow

Each return line traces back to the original `StockIssueID`:
- `SR25000031` → `SI25013107` (return of items from issue SI25013107, 2 line items, CA1180)
- `SR24000030` → `SI24011414` (20 units MC01004, OC7230)
- `SR24000029/28/27` → `SI24010561/10432/10432` (large MO04164 returns, CA4813 workshop)

---

## 5. IN_STOCKADJ — Stock Adjustment Header

**PK:** StockAdjID (char 20) | **LocCode:** PTRJ | **Status:** `'5 '` (all closed/posted)

### Schema (observed)

| # | Column | Type | Nullable | Interpretation |
|---|---|---|---|---|
| 1 | StockAdjID | char(20) | NO | **PK.** Format: `SAYYNNNNNNNN` e.g. `SA25000034` |
| 2 | LocCode | char(8) | NO | Location (PTRJ) |
| 3 | Status | char(2) | YES | All = `'5 '` (posted/closed) |
| 4 | TotalAmount | decimal | YES | Total adjustment value |
| 5 | CreateDate | datetime | YES | Record creation timestamp |
| 6 | UpdateDate | datetime | YES | Last modification timestamp |

### Sample Data (Estate, most recent)

```
SA25000034: TotalAmount=0, CreateDate=2025-08-07, Status='5 '
SA25000033: TotalAmount=1, CreateDate=2025-05-02, Status='5 '
SA25000032: TotalAmount=1, CreateDate=2025-03-24, Status='5 '
SA25000031: TotalAmount=1, CreateDate=2025-03-11, Status='5 '
SA25000030: TotalAmount=1, CreateDate=2025-02-05, Status='5 '
```

**Note:** TotalAmount is very small (0 or 1) for recent adjustments — likely reflects unit-count adjustments, not monetary value.

---

## 6. IN_STOCKADJLN — Stock Adjustment Line

**PK:** (inferred) StockAdjLNID (char 20) | **FK:** StockAdjID

No sample data returned — table has 134 rows with very specific/infrequent adjustments.

---

## Top Items Issued (Estate SP1 — all time)

| # | ItemCode | Description | Total Qty | Total Amount |
|---|---|---|---|---|
| 1 | MO04148 | Karung Plastik Uk. 60 x 85 | 2,467,000 | 6,599,225,000 |
| 2 | MO04164 | Karung Plastik 60 x 70 Denier | 1,528,500 | 3,540,175,980 |
| 3 | MO04139 | Karung Plastik Uk. 60 x 95 DEN | 386,500 | 1,091,862,500 |
| 4 | MC02001 | Calcium Carbonate Mesh 400 | 354,500 | 479,491,820 |
| 5 | MG19071 | Smoothlock 02 (SDA 071022) | 110,000 | 139,450,000 |
| 6 | MC02003 | Soda Ash (Light) | 53,374 | 428,998,132 |
| 7 | MO06001 | BPA Organic Concentrate Organi | 20,100 | 1,472,206,952 |
| 8 | MC01005 | Nalco 3276 Plus @25Kg/pail | 32,149 | 679,281,802 |
| 9 | MO13008 | Bata merah | 37,200 | 41,930,000 |
| 10 | MM05007 | Bata api SK-34 75x114x2 | 16,200 | 375,418,000 |

**Top 3 items are all plastic bags (karung plastik)** — likely for FFB/Fruit packing at estate. Combined value > 11B IDR.

---

## ItemType Distribution (IN_ITEMCODE, Estate SP1)

| ItemType | Items | QtyOnHand | StockValue | Interpretation |
|---|---|---|---|---|
| 4 | 6,022 | 2.00 | ~0 | Workshop/Maintenance items (minimal stock) |
| 2 | 4,233 | 0 | 0 | Stock/General items |
| 1 | 1,169 | 0 | 0 | Services/Non-stock items |
| 6 | 123 | 0 | 0 | ? |
| 10 | 39 | 0 | 0 | Fuel/Commodity items |
| 8 | 4 | 0 | 0 | ? |
| 7 | 4 | 0 | 0 | ? |
| 9 | 2 | 0 | 0 | ? |

**Most IN_ITEMCODE records have QtyOnHand = 0** — this is the consolidated (non-location-specific) master. Real per-location stock is in `IN_ITEM` with LocCode=PTRJ.

---

## Comparative: Estate vs Mill

| Table | Estate (SP1) | Mill (SP3) | Diff |
|---|---|---|---|
| IN_ITEM | 11,571 | 11,976 | +405 |
| IN_ITEMCODE | 11,654 | 12,058 | +404 |
| IN_FUELISSUE | 7,067 | 7,500 | +433 |
| IN_FUELISSUELN | 8,293 | 8,759 | +466 |
| IN_PR | 9,700 | 10,300 | +600 |
| IN_PRLN | 29,592 | 31,239 | +1,647 |
| IN_PRLN_ACC | 30,309 | 31,956 | +1,647 |
| IN_STOCKISSUE | 15,514 | 16,380 | +866 |
| IN_STOCKISSUELN | 30,637 | 32,501 | +1,864 |
| IN_MTHENDITEM | 626,553 | 673,053 | +46,500 |
| IN_MTHENDTRX | 77,522 | 82,194 | +4,672 |

**Mill is consistently ~3-5% larger** across all tables — it is the live/current system. Estate data appears to lag (fewer recent records). The 404-row difference in IN_ITEM/IN_ITEMCODE is consistent across all lookup table reference counts.

---

## Key Observations

1. **IN_STOCKISSUE naming:** `SIYYNNNNNNNN` — Stock Issue, Year, 8-digit sequence. Same pattern as `FIYYNNNNNNN` for fuel issues.
2. **Stock return (SR) vs stock adjustment (SA):** Returns link back to original StockIssueID (traceable). Adjustments appear to be independent stocktake corrections.
3. **AccCode mapping:** Stock issues credit to cost accounts (CA4813 = workshop, OC7230 = operational cost, CA1180 = inventory). Each line can have its own GL account.
4. **Top stock items:** Karung Plastik (plastic bags) dominate — estate uses millions of units for FFB/fruit handling.
5. **All IN_STOCKRTN and IN_STOCKADJ records are Status='5' (posted)** — no open returns/adjustments in the system.
6. **IN_STOCKRECEIVE and IN_STOCKTRANSFER are empty** — the system does not currently track stock receipts or transfers between locations.