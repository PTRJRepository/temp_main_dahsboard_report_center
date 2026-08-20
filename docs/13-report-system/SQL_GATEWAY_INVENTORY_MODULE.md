# SQL Gateway - Inventory Module Integration Guide

> Dokumentasi lengkap penggunaan SQL Gateway untuk mengakses modul inventori `IN_*` di `db_ptrj_mill` via **SERVER_PROFILE_1** (10.0.0.110 — Estate).
> Dibuat: 2026-05-16 | Updated: 2026-05-16

---

## SQL Gateway Configuration

| Server | Host | Port | Access | Description |
|---|---|---|---|---|
| `SERVER_PROFILE_1` | 10.0.0.110 | 1433 | **Read/Write** | Primary server (Estate) |
| `SERVER_PROFILE_2` | 10.0.0.2 | 1888 | **Read-Only** | Secondary server |
| `SERVER_PROFILE_3` | 103.127.66.32 | 1888 | **Read-Only** | Mill/Pabrik server |

---

## Koneksi

| Property | Value |
|---|---|
| SQL Gateway URL | `http://localhost:8001` |
| API Token | `2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6` |
| Auth Header | `x-api-key: <token>` |
| Database | `db_ptrj_mill` |
| Server | `SERVER_PROFILE_1` (10.0.0.110) |

---

## Catatan Penting

### db_ptrj (Estate main DB) is OFFLINE
Main database `db_ptrj` pada SERVER_PROFILE_1 dalam keadaan offline. Gunakan `db_ptrj_mill` untuk akses data inventori Estate.

### Server vs Database Routing
- Parameter `server` → memilih server/SQL Server target
- Parameter `database` → memilih database dalam server tersebut

```
server: "SERVER_PROFILE_1"  → 10.0.0.110:1433
database: "db_ptrj_mill"   → database di dalam 10.0.0.110
```

### Character Field Padding
Semua field `char(N)` di database ini adalah **space-padded**. Selalu gunakan `RTRIM()` saat membandingkan atau menampilkan.

---

## API Endpoints

### Cek Server Profiles
```http
GET /v1/servers
x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6
```

### List Databases (per server)
```http
GET /v1/databases?server=SERVER_PROFILE_1
x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6
```

### Execute Query
```http
POST /v1/query
Content-Type: application/json
x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6

{
  "sql": "SELECT TOP 1000 [ItemCode], [LocCode], [Description], [QtyOnHand], [AverageCost] FROM [db_ptrj_mill].[dbo].[IN_ITEM]",
  "server": "SERVER_PROFILE_1",
  "database": "db_ptrj_mill"
}
```

---

## Database Availability

### SERVER_PROFILE_1 (10.0.0.110 — Estate, R/W)
```
db_ptrj_mill       ← INVENTORY ESTATE (use this)
extend_db_ptrj     ← Extended data (R/W)
db_ptrj_backup
staging_PTRJ_iFES_Plantware_backup
VenusHR14_ptrj_backup
vector_db
```
> `db_ptrj` → **OFFLINE** ❌

### SERVER_PROFILE_3 (103.127.66.32 — Mill/Pabrik, R/O)
```
db_ptrj_mill       ← INVENTORY MILL (use this)
db_ptrj_mill_test
VenusHR14
```

---

## IN_* Tables Summary (Estate db_ptrj_mill via SERVER_PROFILE_1)

**69 IN_* base tables**, 11,571 rows di IN_ITEM.

| Group | Table | Rows | Description |
|---|---|---|---|
| **Item Master** | IN_ITEMCODE | 11,654 | Item master catalog |
| | IN_ITEM | 11,571 | Per-location inventory (PTRJ) |
| | IN_ITEM_ACC | 244 | Audit trail |
| **Product Lookup** | IN_PRODTYPE | 52 | Product type |
| | IN_PRODCAT | 9 | Product category |
| | IN_PRODMAT | 25 | Product material |
| | IN_PRODBRAND | 9 | Product brand |
| | IN_PRODMODEL | 5 | Product model |
| | IN_STOCKANALYSIS | 4 | Stock analysis code |
| **Stock Movement** | IN_STOCKISSUE | 15,514 | Stock issue header |
| | IN_STOCKISSUELN | 30,637 | Stock issue lines |
| | IN_STOCKRECEIVE | 0 | (empty) |
| | IN_STOCKRTN | 31 | Stock return header |
| | IN_STOCKRTNLN | 32 | Stock return lines |
| | IN_STOCKADJ | 34 | Stock adjustment header |
| | IN_STOCKADJLN | 134 | Stock adjustment lines |
| | IN_STOCKTRANSFER | 0 | (empty) |
| **Fuel** | IN_FUELISSUE | 7,067 | Fuel issue header |
| | IN_FUELISSUELN | 8,293 | Fuel issue lines |
| | IN_FUELRTN | 27 | Fuel return header |
| | IN_FUELRTNLN | 34 | Fuel return lines |
| **Purchase Requisition** | IN_PR | 9,700 | PR header |
| | IN_PRLN | 29,592 | PR lines |
| | IN_PRLN_ACC | 30,309 | Audit trail |
| **Month-End** | IN_MTHENDITEM | 626,553 | Monthly inventory snapshot |
| | IN_MTHENDTRX | 77,522 | Monthly transaction log |

---

## IN_ITEM — 50 Kolom

**Composite PK:** `(ItemCode, LocCode)`
**Location:** PTRJ (Estate office)

### Column Groups

**Identification:**
- `ItemCode` char(20) NOT NULL — item identifier
- `LocCode` char(8) NOT NULL — location (PTRJ)
- `Description` nchar(128) NOT NULL — item name
- `Bin` char(20) NULL — storage location

**Classification:**
- `ItemType` char(8) NOT NULL — item type code
- `ProdTypeCode` → IN_PRODTYPE
- `ProdCatCode` → IN_PRODCAT
- `ProdBrandCode` → IN_PRODBRAND
- `ProdModelCode` → IN_PRODMODEL
- `ProdMatCode` → IN_PRODMAT
- `StockAnalysisCode` → IN_STOCKANALYSIS

**Stock Quantities:**
- `QtyOnHand`, `QtyOnHold`, `QtyOnOrder`, `QtyReOrder` — decimal(20,5)
- `ReOrderLevel` — minimum stock before reorder

**Costs (all decimal 20,5):**
- `InitialCost`, `HighCost`, `LowCost`, `AverageCost`, `LatestCost`
- `DiffAverageCost` = LatestCost - AverageCost
- `ClosingBal`, `ClosingAvrgCost`, `ClosingDiffAvrgCost`

**Pricing:**
- `SellFixedPrice`, `SellLatestCost`, `SellAverageCost`
- `UsePrice` char(2)

**Units:**
- `UOMCode` char(8), `PurchaseUOM` char(8)
- `FuelTypeInd` char(1), `FuelMeterReading` decimal(20,5)

**Accounting:**
- `ExpenseCode` char(8), `ActCode` char(32)
- `PurchaseAccNo` char(32), `IssueAccNo` char(32)

**Tax:**
- `TaxCode` varchar(8), `SuppTaxCode` varchar(8)
- `DefaultTaxCode2` nvarchar(50), `DefaultSuppTaxCode2` nvarchar(50)

**Metadata:**
- `Status` char(2) NOT NULL — '1 ' = active, '2 ' = inactive
- `LastOrderDate`, `LastIssueDate` datetime
- `CreateDate`, `UpdateDate` datetime NOT NULL
- `UpdateID` char(20) NOT NULL
- `SMInd` bit, `ExDateReq` tinyint
- `Remark` nchar(128)

---

## Sample Data (Estate IN_ITEM)

```
ItemCode    | LocCode | Description                        | Qty | AvgCost     | Status | Updated
------------|---------|------------------------------------|-----|-------------|--------|----------
ME03226     | PTRJ    | Kabel Ekstensi Telepon Putih @2m   |   0 |       0     | 1      | 2026-01-12
ME03006     | PTRJ    | Kabel NYY-HY 3x1.5mm @50M ETERNA   |   2 |   875,000   | 1      | 2026-01-12
ME01045     | PTRJ    | Light bulb LED 19W 220-240V        |   4 |    85,000   | 1      | 2026-01-12
MM01034     | PTRJ    | Mechanical Seal 1.5" KS SC3 SEK     |   7 |   950,160   | 1      | 2026-01-12
MG04017     | PTRJ    | Spring Washer 5/8"                 | 294 |     1,205   | 1      | 2026-01-12
MG03109     | PTRJ    | Bolt & Nut 5/8" x 5" Full Drat     |  59 |    18,000   | 1      | 2026-01-12
ME13036     | PTRJ    | Power Supply S-100-24              |   2 |   248,507   | 1      | 2026-01-12
MG03019     | PTRJ    | Bolt & Nut 5/8" x 2" Baja Full Drat| 146 |     9,000   | 1      | 2026-01-12
MG09009     | PTRJ    | UNP Channel 100x50x6000mm (#3.2)    |   5 |   560,149   | 1      | 2026-01-12
MG09046     | PTRJ    | Besi Siku Uk. 50mm x 50mm          |  12 |   285,000   | 1      | 2026-01-12
```

---

## Quick Query Examples

### Low stock items
```sql
SELECT RTRIM(ItemCode), RTRIM(Description), QtyOnHand, ReOrderLevel, AverageCost
FROM [db_ptrj_mill].[dbo].[IN_ITEM]
WHERE QtyOnHand < ReOrderLevel AND Status = '1 '
ORDER BY QtyOnHand ASC
```

### Stock value by location
```sql
SELECT RTRIM(LocCode) AS LocCode, COUNT(*) AS ItemCount,
       SUM(QtyOnHand * AverageCost) AS TotalValue
FROM [db_ptrj_mill].[dbo].[IN_ITEM]
WHERE Status = '1 '
GROUP BY LocCode ORDER BY TotalValue DESC
```

### Search by description
```sql
SELECT TOP 20 RTRIM(ItemCode), RTRIM(Description), QtyOnHand, AverageCost
FROM [db_ptrj_mill].[dbo].[IN_ITEM]
WHERE RTRIM(Description) LIKE '%bolt%'
ORDER BY UpdateDate DESC
```

---

## File Structure

```
Services/module/inventory/
├── README.md                          # This file
├── docs/
│   ├── QUICK_REFERENCE.md             # cURL/PowerShell/Python cheatsheet
│   └── DB_SCHEMA.md                   # Full schema (50 columns)
├── db_ptrj_mill/
│   ├── tables/tables.json             # 69 IN_* tables + row counts (Estate)
│   ├── schema/IN_ITEM.json            # 50 columns schema
│   └── samples/IN_ITEM.json            # 10 sample rows
└── queries/
    ├── list_in_tables.sql
    ├── in_item_schema.sql
    ├── in_item_sample.sql
    ├── row_counts.sql
    └── foreign_keys.sql

../SQL_GATEWAY_INVENTORY_MODULE.md  # Full integration guide
```