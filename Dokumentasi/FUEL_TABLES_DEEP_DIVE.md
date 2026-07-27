# Fuel Tables Deep-Dive: IN_FUELISSUE, IN_FUELISSUELN, IN_FUELRTN, IN_FUELRTNLN

> **Period filter (LIVE 2026-07):** jangan filter cuma `PostDate`.  
> Canonical: `Dokumentasi/FUEL_ISSUE_SELECTED_PERIOD.md` · code `lib/reports/inventory/fuel-issue-sql.ts`.  
> Schema notes below may be older (May 2026); server labels in body may be stale vs current SP2=estate.

**Generated:** 2026-05-16  
**Servers:** SERVER_PROFILE_1 (Estate, 10.0.0.110:1433) & SERVER_PROFILE_2 (Mill, 103.127.66.32:1888)  
**Database:** db_ptrj_mill  
**Access:** Read-only (via SQL Gateway localhost:8001)

---

## 0. Row Counts

| Table | Estate (SP1) | Mill (SP3) | Description |
|---|---|---|---|
| IN_FUELISSUE | 7,067 | 7,500 | Fuel issue header |
| IN_FUELISSUELN | 8,293 | 8,759 | Fuel issue line |
| IN_FUELRTN | 27 | 27 | Fuel return header |
| IN_FUELRTNLN | 34 | 34 | Fuel return line |

- Mill has more recent IN_FUELISSUE records (through 2026-05-16).
- IN_FUELRTN/RTNLN data is identical between both servers (last entry ~May 2025).
- All 4 tables have identical schemas on both servers.

---

## 1. IN_FUELISSUE (Header Table)

21 columns, PK: FuelIssueID (char 20, NOT NULL)

| # | Column | Data Type | Nullable | Interpretation |
|---|---|---|---|---|
| 1 | FuelIssueID | char(20) | NO | **Primary key.** Format: `FIYYNNNNNNN` e.g. FI26007067 (FI + Year 26 + 7-digit seq) |
| 2 | DNID | char(20) | YES | Delivery Note ID (empty in sample — delivery note reference) |
| 3 | BillPartyCode | char(8) | YES | Billing party code (empty in sample) |
| 4 | IssueType | char(2) | YES | **'1' = Normal issue.** Only one type used across all 7,067 records |
| 5 | TotalAmount | decimal | YES | Total cost amount (Qty * Cost). Nullable but always populated |
| 6 | Remark | nvarchar(500) | YES | Free-text notes |
| 7 | AccMonth | char(2) | YES | Accounting period month (01–12) |
| 8 | AccYear | char(4) | YES | Accounting period year (e.g. '2026') |
| 9 | LocCode | char(8) | **NO** | **Issuing location code.** All sample records: 'PTRJ' |
| 10 | Status | char(2) | YES | Status code (see below) |
| 11 | PayrollPosted | char(2) | YES | Flag: posted to payroll? |
| 12 | CreateDate | datetime | YES | Record creation timestamp (UTC) |
| 13 | UpdateDate | datetime | YES | Last update timestamp |
| 14 | UpdateID | char(20) | YES | User who last updated |
| 15 | PrintDate | datetime | YES | Last print date |
| 16 | TotalPrice | decimal | **NO** | Total price amount (Qty * Price). Always populated |
| 17 | ChargeLocCode | char(8) | **NO** | **Charge-to location code.** All sample: 'PTRJ' |
| 18 | PSEMPCODE | char(20) | YES | Personal employee code (empty in samples) |
| 19 | PostDate | datetime | **NO** | **Posting date to GL.** `1900-01-01` = not yet posted; actual date = posted |
| 20 | FuelIssueRefDate | datetime | YES | Reference document date |
| 21 | FuelIssueRefNo | varchar(32) | YES | Reference document number |

### Status Values (IN_FUELISSUE)

| Status | Count | Meaning |
|---|---|---|
| 1 | 32 | Open / baru dibuat |
| 3 | 81 | In progress / partial |
| 6 | 6,954 | Closed / posted to GL |

### PostDate Behavior

- `PostDate = '1900-01-01'` means the transaction is **not yet posted** to the general ledger.
- When `PostDate` has an actual datetime value, the record has been **posted/closed**.

### Sample Data (IN_FUELISSUE, Estate, most recent)

| FuelIssueID | LocCode | Status | TotalAmount | TotalPrice | CreateDate | PostDate |
|---|---|---|---|---|---|---|
| FI26007067 | PTRJ | 1 | 1,041,126.33 | 1,041,126.33 | 2026-01-12 09:46 | 1900-01-01 |
| FI26007066 | PTRJ | 1 | 640,693.13 | 640,693.13 | 2026-01-12 09:46 | 1900-01-01 |
| FI26007065 | PTRJ | 1 | 1,954,114.04 | 1,954,114.04 | 2026-01-12 09:45 | 1900-01-01 |

---

## 2. IN_FUELISSUELN (Line Table)

19 columns, PK: FuelIssueLNID (char 20, NOT NULL), FK: FuelIssueID

| # | Column | Data Type | Nullable | Interpretation |
|---|---|---|---|---|
| 1 | FuelIssueLNID | char(20) | NO | **Primary key.** Format: `FILYYNNNNNNN` e.g. FIL26008327 |
| 2 | FuelIssueID | char(20) | NO | **FK to IN_FUELISSUE header** |
| 3 | AccCode | char(32) | YES | **GL account code charged.** Values seen: GA9010, GA9050, OC7220 |
| 4 | BlkCode | char(8) | YES | **Block/Estate section code.** e.g. 'ETP03001' (non-vehicle issue) |
| 5 | VehCode | char(8) | YES | **Vehicle code.** e.g. BE002, BE004, VN008, LN002 (vehicle fuel) |
| 6 | VehExpCode | char(8) | YES | Vehicle expense code. e.g. '21' (appears with VehCode) |
| 7 | PsEmpCode | char(20) | YES | Personal employee code |
| 8 | ItemCode | char(20) | **NO** | **Fuel item code.** All records: MF01001 (Diesoline/Solar) |
| 9 | Qty | decimal | YES | **Issued quantity (liters).** Range seen: 10–218 |
| 10 | Cost | decimal | YES | Unit cost (INR) |
| 11 | Amount | decimal | YES | Total cost (Qty * Cost) |
| 12 | Price | decimal | **NO** | Unit selling/standard price (INR) |
| 13 | PriceAmount | decimal | **NO** | Total price amount (Qty * Price) |
| 14 | TotalPrice | decimal | **NO** | Total (usually 0 when price=0, otherwise = PriceAmount) |
| 15 | QtyReturn | decimal | **NO** | **Quantity returned.** All samples = 0 (no return yet) |
| 16 | TaxRate | decimal | YES | Tax rate % |
| 17 | TaxRef | varchar(20) | YES | Tax reference number |
| 18 | TaxInd | varchar(1) | YES | Tax indicator (Y/N) |
| 19 | ExportHistoryID | bigint | YES | Integration export tracking ID |

### AccCode (GL Account) Values Observed

| AccCode | Likely Meaning |
|---|---|
| GA9010 | General Admin — Fuel expense |
| GA9050 | General Admin — Fuel (alternative) |
| OC7220 | Operating Cost — Block/Estate operations fuel |

### Vehicle vs Block Pattern

- When **VehCode is populated** (e.g. BE002, BE004) → vehicle fuel issue, VehExpCode='21'
- When **BlkCode is populated** (e.g. ETP03001) → estate block fuel issue (genset, pump, etc.)
- PsEmpCode is rarely used (possibly for employee-owned equipment)

### Sample Data (IN_FUELISSUELN, Estate)

| FuelIssueLNID | FuelIssueID | AccCode | BlkCode | VehCode | VehExpCode | ItemCode | Qty | Price | Amount |
|---|---|---|---|---|---|---|---|---|---|
| FIL26008327 | FI26007067 | GA9050 | | | | MF01001 | 65 | 16,017.33 | 1,041,126 |
| FIL26008326 | FI26007066 | GA9010 | | BE004 | 21 | MF01001 | 40 | 16,017.33 | 640,693 |
| FIL26008325 | FI26007065 | GA9010 | | BE002 | 21 | MF01001 | 122 | 16,017.33 | 1,954,114 |
| FIL26008324 | FI26007064 | GA9010 | | VN008 | 21 | MF01001 | 36 | 16,017.33 | 576,624 |
| FIL26008323 | FI26007063 | OC7220 | ETP03001 | | | MF01001 | 50 | 16,017.33 | 800,866 |

### Fuel Item Summary (Estate IN_FUELISSUELN)

| ItemCode | Description | Lines | Total Qty (liters) |
|---|---|---|---|
| MF01001 | Diesoline / Solar | 8,293 | 1,034,599.3 |

---

## 3. IN_FUELRTN (Fuel Return Header)

17 columns, PK: ID (int) + FuelRtnId (char 20)

| # | Column | Data Type | Nullable | Interpretation |
|---|---|---|---|---|
| 1 | ID | int | NO | Auto-increment integer primary key |
| 2 | FuelRtnId | char(20) | NO | **Primary key.** Format: `FRYYNNNNNN` e.g. FR25000027 |
| 3 | LocCode | char(8) | NO | Returning location. All: 'PTRJ' |
| 4 | AccMonth | char(2) | YES | Accounting period month |
| 5 | AccYear | char(4) | YES | Accounting period year |
| 6 | TotalAmount | decimal | YES | Total cost of returned fuel |
| 7 | Remark | nvarchar(500) | YES | Free-text notes |
| 8 | PrintDate | datetime | YES | Last print date |
| 9 | PayrollPosted | char(2) | YES | Flag: posted to payroll |
| 10 | Status | char(2) | YES | Status code |
| 11 | CreateDate | datetime | YES | Record creation timestamp |
| 12 | UpdateDate | datetime | YES | Last update timestamp |
| 13 | UpdateID | char(20) | YES | User who last updated |
| 14 | TotalPrice | decimal | NO | Total price amount |
| 15 | PostDate | datetime | NO | Posting date to GL |
| 16 | FuelRtnDate | datetime | YES | Actual return date |
| 17 | CNID | char(20) | YES | Credit Note ID (links to billing) |

### Status Values (IN_FUELRTN)

All 27 records have **Status = '6'** (closed/posted to GL).

### Sample Data (IN_FUELRTN, Estate)

| FuelRtnId | LocCode | TotalAmount | TotalPrice | Status | CreateDate | PostDate | FuelRtnDate |
|---|---|---|---|---|---|---|---|
| FR25000027 | PTRJ | 141,235.14 | 141,235.14 | 6 | 2025-05-15 11:10 | 2025-05-31 | 2025-05-15 |
| FR25000026 | PTRJ | 2,542,232.58 | 2,542,232.58 | 6 | 2025-05-15 11:08 | 2025-05-31 | 2025-05-15 |
| FR23000025 | PTRJ | 444,578.03 | 444,578.03 | 6 | 2023-06-07 | 2023-06-30 | 2023-06-07 |
| FR23000024 | PTRJ | 2,052,702.38 | 2,052,702.38 | 6 | 2023-03-04 | 2023-04-01 | 2023-02-01 |
| FR23000023 | PTRJ | 4,068,082.89 | 4,068,082.89 | 6 | 2023-03-04 | 2023-04-01 | 2023-02-01 |

---

## 4. IN_FUELRTNLN (Fuel Return Line)

19 columns, PK: FuelRtnLNID (char 20, NOT NULL), FK: FuelRtnID

| # | Column | Data Type | Nullable | Interpretation |
|---|---|---|---|---|
| 1 | FuelRtnLNID | char(20) | NO | **Primary key.** Format: `FRLYYNNNNNN` e.g. FRL25000034 |
| 2 | FuelRtnID | char(20) | NO | **FK to IN_FUELRTN header** |
| 3 | FuelIssueID | char(20) | YES | **FK to original IN_FUELISSUE** — links return to the original issue |
| 4 | FuelIssueLNID | char(20) | YES | FK to original IN_FUELISSUELN line |
| 5 | AccCode | char(32) | YES | GL account credited on return |
| 6 | BlkCode | char(8) | YES | Block/estate section code |
| 7 | VehCode | char(8) | YES | Vehicle code (return from vehicle) |
| 8 | VehExpCode | char(8) | YES | Vehicle expense code |
| 9 | PsEmpCode | char(20) | YES | Personal employee code |
| 10 | ItemCode | char(20) | NO | Fuel item code. All: MF01001 (Diesoline/Solar) |
| 11 | Qty | decimal | YES | **Returned quantity (liters)** |
| 12 | Cost | decimal | YES | Unit cost at time of return |
| 13 | Amount | decimal | YES | Total cost (Qty * Cost) |
| 14 | Price | decimal | NO | Unit price at return |
| 15 | PriceAmount | decimal | NO | Total price (Qty * Price) |
| 16 | ChargeLocCode | char(8) | NO | Charge-to location code (all PTRJ) |
| 17 | TaxRate | decimal | YES | Tax rate |
| 18 | TaxRef | varchar(20) | YES | Tax reference |
| 19 | TaxInd | varchar(1) | YES | Tax indicator |

### Return ↔ Issue Linkage

The return line stores `FuelIssueID` and `FuelIssueLNID`, enabling full traceability:
- Each fuel return line can be traced back to the original fuel issue.
- `QtyReturn` in IN_FUELISSUELN tracks how much of an issued quantity was returned.

### Sample Data (IN_FUELRTNLN, Estate)

| FuelRtnLNID | FuelRtnID | FuelIssueID | AccCode | VehCode | ItemCode | Qty | Cost | Amount |
|---|---|---|---|---|---|---|---|---|
| FRL25000034 | FR25000027 | FI25006277 | GA9050 | | MF01001 | 10 | 14,123.51 | 141,235 |
| FRL25000033 | FR25000026 | FI25006255 | GA9010 | LN002 | MF01001 | 180 | 14,123.51 | 2,542,233 |
| FRL23000032 | FR23000025 | FI23003963 | GA9010 | T001 | MF01001 | 35 | 12,702.23 | 444,578 |
| FRL23000031 | FR23000024 | FI23003748 | GA9010 | BE002 | MF01001 | 110 | 18,660.93 | 2,052,702 |
| FRL23000030 | FR23000023 | FI23003757 | GA9010 | LN001 | MF01001 | 218 | 18,660.93 | 4,068,083 |

---

## 5. Relationship Diagram

```
IN_FUELISSUE (Header, 1)
  PK: FuelIssueID
  └── 1:N ──→ IN_FUELISSUELN (Line, N)
                PK: FuelIssueLNID
                FK: FuelIssueID
                AccCode, VehCode/VehExpCode, BlkCode → cost center routing
                ItemCode → MF01001 (Diesoline/Solar)
                QtyReturn → tracks how much returned

IN_FUELRTN (Header, 1)
  PK: FuelRtnId
  └── 1:N ──→ IN_FUELRTNLN (Line, N)
                PK: FuelRtnLNID
                FK: FuelRtnID
                FK: FuelIssueID + FuelIssueLNID → links return back to original issue
                ItemCode → MF01001 (Diesoline/Solar)
```

---

## 6. Key Findings & Business Logic

### Fuel Item
- Only **one fuel type** in the system: **MF01001 — Diesoline / Solar** (Diesel).
- All issues and returns are diesel fuel.
- Fuel is consumed by: (a) vehicles, (b) estate block equipment (gensets, water pumps, etc.).

### Issue Flow
1. Fuel issue is created → Status='1' (open), PostDate='1900-01-01'
2. Line items capture: vehicle code OR block code + quantity + cost center (AccCode)
3. When posted to GL → Status='6', PostDate gets actual date
4. Any unused fuel can be returned via IN_FUELRTN/IN_FUELRTNLN

### Return Flow
1. Fuel return header (IN_FUELRTN) created with FuelRtnDate
2. Each return line links back to the original FuelIssueID + FuelIssueLNID
3. Returned qty reduces QtyReturn in IN_FUELISSUELN
4. Returns are all Status='6' (posted)

### Cost vs Price Columns
- `Cost` / `Amount` = actual/acquisition cost
- `Price` / `PriceAmount` = standard/selling price
- `TotalAmount` = Qty * Cost
- `TotalPrice` = Qty * Price
- For diesel fuel records: Cost ≈ Price, so Amount ≈ PriceAmount

### Accounting Period
- AccMonth + AccYear indicate the accounting period
- PostDate confirms when it was actually posted to GL
- All fuel returns have been posted (Status='6')

### Server Differences
- Mill (SERVER_PROFILE_3) is more current — has records through 2026-05-16
- Estate (SERVER_PROFILE_1) has fewer records (historical sync)
- IN_FUELRTN/IN_FUELRTNLN data is identical on both (last updated May 2025)
