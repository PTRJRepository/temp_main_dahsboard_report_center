# AI Agent Briefing: Safe Procurement Module Development
**Target Project:** Main Dashboard (PT Rebinmas Jaya)
**Scope:** Procurement (Purchase Requisition, Purchase Order, Goods Receipt, Suppliers)
**Database Context:** `db_ptrj` (Estate) & `db_ptrj_mill` (Mill) on MS SQL Server

Use this document as your primary context when implementing, debugging, or querying any procurement/purchasing logic.

---

## 1. Safety & Security Rules (CRITICAL)

> [!WARNING]
> **1. Secrets and Keys:** 
> * Do **NOT** hardcode the SQL Query Gateway API keys or passwords in the source code or commits.
> * Always read credentials from environment variables (e.g., `process.env.SQL_GATEWAY_API_KEY`).
> * Never print raw credentials, tokens, or connection strings in logs, exceptions, or UI outputs.
>
> **2. Read-Only SQL Operations:**
> * Unless explicitly asked by the user to perform database updates, all query handlers you write must be read-only SELECT queries.
> * Reuse existing SQL validation utilities such as `validateReadOnlySql` or clean escaping to prevent SQL injection vulnerability.

---

## 2. System Architecture & Connections
The Next.js application (`Dashboard_Utama`) queries MS SQL Server through a REST SQL Query Gateway.
* **Gateway URL:** `http://localhost:8001/v1/query` (Local development)
* **Databases:** 
  * `db_ptrj` for Estate operations (e.g., location code `P1A`).
  * `db_ptrj_mill` for Mill operations.
* **Code Location for Reports:** `Dashboard_Utama/app/api/reports/inventory/route.ts`

---

## 3. Database Schema Reference

### 3.1 Purchase Requisition (PR)
* **`IN_PR` (Header):**
  * Composite PK: `(PRID, LocCode)`
  * Key columns: `PRID` (char 100, e.g. `PR26009918`), `LocCode` (char 8, e.g. `PTRJ`), `PRType` (char 3), `Status` (char 2), `PRDate` (datetime).
  * Status Codes: `'1'` = Draft, `'2'` = Confirmed, `'3'` = Partial, `'4'` = Completed, `'6'` = Canceled.
  * PRType Codes: `'1'` = General/Non-Stock, `'2'` = Stock, `'4'` = Workshop, `'6'` = Nursery.
* **`IN_PRLN` (Line):**
  * Composite PK: `(PRID, ItemCode, PRLnID)`
  * Key columns: `PRID` (char 20), `ItemCode` (char 20), `PRLnID` (char 20), `QtyReq` (decimal), `QtyRcv` (decimal), `QtyOutstanding` (decimal), `Cost` (decimal), `Amount` (decimal).
* **`IN_PRLN_ACC` (Cost Allocation):**
  * PK: `ID` (bigint, auto-increment)
  * Key columns: `TrxID` (varchar 20, links to `IN_PRLN.PRLnID`), `AccCode` (GL Account), `BlkCode` (Block/Station), `SubBlkCode` (Sub-block), `WsJobCode` (Workshop job), `Dim19` (Location code).

### 3.2 Purchase Order (PO)
* **`PU_PO` (Header):**
  * PK: `POID` (varchar, e.g. `00/PRP/LOK/26/4/7694`)
  * Key columns: `PODate` (datetime), `SupplierCode` (varchar), `LocCode` (varchar), `Status` (char).
* **`PU_POLN` (Line):**
  * PK: `POLnID` (varchar, e.g. `NPOL26044335`)
  * Key columns: `POID` (varchar), `ItemCode` (varchar), `QtyOrder` (decimal), `QtyDelv` (decimal), `Cost` (decimal) -> **Unit Price**, `Amount` (decimal), `NetAmt` (decimal).

### 3.3 Goods Receipt (GR)
* **`PU_GOODSRCV` (Header):**
  * PK: `GoodsRcvID` (varchar, e.g. `GCP1A26009896`)
  * Key columns: `GoodsRcvRefNo` (varchar), `GoodsRcvRefDate` (datetime), `LocCode` (varchar), `SupplierCode` (varchar), `POID` (varchar), `Status` (char, `'5'` = Posted).
* **`PU_GOODSRCVLN` (Line):**
  * PK: `GoodsRcvLnID` (varchar)
  * Key columns: `GoodsRcvID` (varchar), `ItemCode` (varchar), `ReceiveQty` (decimal), `POLnID` (varchar) -> **FK to PU_POLN.POLnID**, `AccCode` (varchar).

---

## 4. Crucial Joining & Querying Gotchas

When writing SQL queries, you **MUST** follow these technical requirements:

> [!IMPORTANT]
> **1. Space Padding on CHAR Fields:**
> Almost all code identifiers (`ItemCode`, `SupplierCode`, `LocCode`, `PRID`, `Status`, `AccCode`) are database `CHAR` types right-padded with spaces.
> * Always wrap selections in `RTRIM()`.
> * Always compare using trimmed strings, e.g. `RTRIM(a.SupplierCode) = RTRIM(b.SupplierCode)`.
>
> **2. Goods Receipt Pricing Join:**
> The `PU_GOODSRCVLN` table **DOES NOT** contain cost/amount columns.
> * To get the price and total value of received goods, you **MUST** join `PU_POLN` using `POLnID`:
>   ```sql
>   LEFT JOIN PU_POLN p ON l.POLnID = p.POLnID
>   -- Total Amount = l.ReceiveQty * p.Cost
>   ```
>
> **3. PR Header Join:**
> Because `IN_PR` has a composite primary key `(PRID, LocCode)`, you must join on both fields when linking lines or items back to the header to prevent duplicates:
>   ```sql
>   INNER JOIN IN_PR h ON l.PRID = h.PRID AND i.LocCode = h.LocCode
>   ```

---

## 5. Standard Query Templates

### 5.1 Joining GR to PO (Goods Receiving Activity)
```sql
SELECT 
  h.GoodsRcvID,
  h.GoodsRcvRefDate,
  RTRIM(h.SupplierCode) AS SupplierCode,
  RTRIM(s.Name) AS SupplierName,
  RTRIM(l.ItemCode) AS ItemCode,
  l.ReceiveQty,
  p.Cost AS UnitCost,
  (l.ReceiveQty * p.Cost) AS TotalAmount
FROM PU_GOODSRCVLN l
INNER JOIN PU_GOODSRCV h ON l.GoodsRcvID = h.GoodsRcvID
LEFT JOIN PU_SUPPLIER s ON RTRIM(h.SupplierCode) = RTRIM(s.SupplierCode)
LEFT JOIN PU_POLN p ON l.POLnID = p.POLnID
WHERE h.LocCode = 'P1A' AND h.Status = '5'
```

### 5.2 Retrieving Outstanding PRs
```sql
SELECT 
  h.PRID,
  h.PRDate,
  RTRIM(l.ItemCode) AS ItemCode,
  l.QtyReq,
  l.QtyRcv,
  l.QtyOutstanding,
  l.Cost
FROM IN_PRLN l
INNER JOIN IN_PR h ON l.PRID = h.PRID
WHERE l.QtyOutstanding > 0 AND h.PRDate >= '2025-01-01'
```

---

## 6. Developer Checklist Before Implementing

- [ ] Am I using `RTRIM()` on code fields for UI payloads?
- [ ] Have I joined `PU_POLN` via `POLnID` to fetch costs/prices for any Good Receipt queries?
- [ ] Did I double check that I am querying the correct database profile (`db_ptrj` vs `db_ptrj_mill`)?
- [ ] Are all database interactions read-only SELECT statements unless updates were explicitly requested?
- [ ] Have I checked if there are helper methods in `Dashboard_Utama/lib/reports` that can be reused?
