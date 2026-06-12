# Inventory Module - Dokumentasi Lengkap

**Last updated:** 2026-06-10

---

## Daftar Isi

1. [Module Overview](#1-module-overview)
2. [Database Schema](#2-database-schema)
   - [IN_ITEM - Tabel Utama](#21-in_item---tabel-utama)
   - [IN_ITEMCODE - Master Item](#22-in_itemcode---master-item)
   - [Lookup Tables](#23-lookup-tables)
   - [Transaction Tables](#24-transaction-tables)
3. [Semua Tabel (tables.json)](#3-semua-tabel-tablesjson)
4. [Foreign Key Relationships](#4-foreign-key-relationships)
5. [Sample Data](#5-sample-data)
6. [Report Generation](#6-report-generation)
7. [Quick Reference](#7-quick-reference)

---

## 1. Module Overview

### Deskripsi

Module Inventory mengakses database SQL Server melalui **SQL Gateway** (`http://localhost:8001`) yang mendukung multi-server profiles. Module ini menyediakan functionality untuk:

- **Stock Management** - Manajemen stok barang per item dan lokasi
- **Purchase Requisition** - Permintaan pembelian
- **Stock Issue/Return/Adjustment** - Transaksi keluar, retur, dan penyesuaian
- **Fuel Management** - Manajemen bahan bakar
- **Month-End Valuation** - Penilaian stok akhir bulan

### SQL Gateway Servers

| Profile | Host | Port | Database | Access |
|---|---|---|---|---|
| `SERVER_PROFILE_1` | 10.0.0.110 | 1433 | `db_ptrj_mill` (Estate), `extend_db_ptrj`, `db_ptrj_mill`, `VenusHR14`, dll | **Read/Write** |
| `SERVER_PROFILE_2` | 10.0.0.2 | 1888 | ? | **Read-Only** |
| `SERVER_PROFILE_3` | 103.127.66.32 | 1888 | `db_ptrj_mill` (Mill/Pabrik), `VenusHR14` | **Read-Only** |

> **Default:** `SERVER_PROFILE_3` (Mill/Pabrik). Untuk Estate gunakan parameter `server: "SERVER_PROFILE_1"`.

### Koneksi

| Property | Value |
|---|---|
| Base URL | `http://localhost:8001` |
| API Token | `2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6` |
| Auth Header | `x-api-key: <token>` |

---

## 2. Database Schema

### 2.1 IN_ITEM - Tabel Utama

**Path:** `Services/module/inventory/schema/IN_ITEM.json`

Tabel utama inventori yang menyimpan snapshot stok per item dan lokasi.

**Composite PK:** `(ItemCode, LocCode)`  
**Jumlah Row:** ~11,976 rows (Mill), ~11,571 rows (Estate)

#### Kolom-Kolom IN_ITEM

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

### 2.2 IN_ITEMCODE - Master Item

**Path:** `Services/module/inventory/schema/IN_ITEM.json`

Item master catalog. 1 row per unique ItemCode. No LocCode here — just the item definition.

**PK:** `ItemCode`  
**Jumlah Row:** ~12,058 rows (Mill), ~11,654 rows (Estate)

| Column | Data Type | Nullable | Description |
|--------|-----------|----------|-------------|
| ItemCode | char(20) | NO | Unique item identifier |
| Description | nchar(128) | ? | Item name |
| ItemType | char(8) | ? | Classification |
| ProdTypeCode | char(8) | YES | Product type |
| UOMCode | char(8) | ? | Unit of measure |
| Status | char(2) | ? | Active/Inactive |

---

### 2.3 Lookup Tables

**Path:** `Services/module/inventory/schema/`

Lookup tables untuk klasifikasi produk.

#### IN_PRODTYPE (52 rows)

| Column | Data Type | Description |
|--------|-----------|-------------|
| ProdTypeCode | char(8) | PK |
| Description | nchar(64) | Type name |
| Status | char(2) | Active status |

#### IN_PRODCAT (9 rows)

| Column | Data Type | Description |
|--------|-----------|-------------|
| ProdCatCode | char(8) | PK |
| Description | nchar(64) | Category name |
| Status | char(2) | Active status |

#### IN_PRODMAT (25 rows)

| Column | Data Type | Description |
|--------|-----------|-------------|
| ProdMatCode | char(8) | PK |
| Description | nchar(64) | Material name |
| Status | char(2) | Active status |

#### IN_PRODBRAND (9 rows)

| Column | Data Type | Description |
|--------|-----------|-------------|
| ProdBrandCode | char(8) | PK |
| Description | nchar(64) | Brand name |
| Status | char(2) | Active status |

#### IN_PRODMODEL (5 rows)

| Column | Data Type | Description |
|--------|-----------|-------------|
| ProdModelCode | char(8) | PK |
| Description | nchar(64) | Model name |
| Status | char(2) | Active status |

#### IN_STOCKANALYSIS (4 rows)

| Column | Data Type | Description |
|--------|-----------|-------------|
| StockAnalysisCode | char(8) | PK |
| Description | nchar(64) | Analysis name |
| Status | char(2) | Active status |

---

### 2.4 Transaction Tables

**Path:** `Services/module/inventory/tables/tables.json`

#### Stock Issue (IN_STOCKISSUE / IN_STOCKISSUELN)

| Table | Rows | Description |
|---|---|---|
| IN_STOCKISSUE | 16,380 (Mill) / 15,514 (Estate) | Header rows |
| IN_STOCKISSUELN | 32,501 (Mill) / 30,637 (Estate) | Line rows |
| IN_STOCKISSUELN_ACC | 33,206 (Mill) / 30,309 (Estate) | Audit rows |
| IN_STOCKISSUE_EXDATE | 0 | Expiry tracking |

#### Stock Receive

| Table | Rows | Description |
|---|---|---|
| IN_STOCKRECEIVE | 0 | Empty |
| IN_STOCKRECEIVELN | 0 | Empty |

#### Stock Return (IN_STOCKRTN / IN_STOCKRTNLN)

| Table | Rows | Description |
|---|---|---|
| IN_STOCKRTN | 31 (Mill) | Header rows |
| IN_STOCKRTNLN | 32 (Mill) | Line rows |

#### Stock Adjustment (IN_STOCKADJ / IN_STOCKADJLN)

| Table | Rows | Description |
|---|---|---|
| IN_STOCKADJ | 34 (Mill) | Header rows |
| IN_STOCKADJLN | 134 (Mill) | Line rows |

#### Stock Transfer

| Table | Rows | Description |
|---|---|---|
| IN_STOCKTRANSFER | 0 | Empty |
| IN_STOCKTRANSFERLN | 0 | Empty |

#### Fuel Issue (IN_FUELISSUE / IN_FUELISSUELN)

| Table | Rows | Description |
|---|---|---|
| IN_FUELISSUE | 7,500 (Mill) / 7,067 (Estate) | Header rows |
| IN_FUELISSUELN | 8,759 (Mill) / 8,293 (Estate) | Line rows |

#### Fuel Return (IN_FUELRTN / IN_FUELRTNLN)

| Table | Rows | Description |
|---|---|---|
| IN_FUELRTN | 27 (Mill) | Header rows |
| IN_FUELRTNLN | 34 (Mill) | Line rows |

#### Purchase Requisition (IN_PR / IN_PRLN)

| Table | Rows | Description |
|---|---|---|
| IN_PR | 10,297 (Mill) / 9,700 (Estate) | Header rows |
| IN_PRLN | 31,228 (Mill) / 29,592 (Estate) | Line rows |
| IN_PRLN_ACC | 31,945 (Mill) / 30,309 (Estate) | Audit rows |

#### Month-End Snapshots

| Table | Rows | Description |
|---|---|---|
| IN_MTHENDITEM | 673,053 (Mill) / 626,553 (Estate) | Monthly stock snapshot |
| IN_MTHENDTRX | 82,194 (Mill) / 77,522 (Estate) | Monthly transaction snapshot |

---

## 3. Semua Tabel (tables.json)

**Path:** `Services/module/inventory/tables/tables.json`

Daftar lengkap semua tabel IN_* di database `db_ptrj_mill`:

```sql
-- List all IN_* base tables in db_ptrj_mill
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE 'IN[_]%'
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
```

---

## 4. Foreign Key Relationships

**Path:** `Services/module/inventory/queries/foreign_keys.sql`

### Formal Foreign Keys

**Catatan:** Tidak ada formal FK constraints yang didefinisikan. Semua relationships adalah implisit melalui naming convention kolom.

```sql
-- Query untuk foreign keys yang ada
SELECT
    tp.name AS ParentTable,
    cp.name AS ParentCol,
    tr.name AS RefTable,
    cr.name AS RefCol
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
WHERE tp.name LIKE 'IN[_]%' OR tr.name LIKE 'IN[_]%';
```

### Implicit Relationships

| Parent Column | References Table |
|---|---|
| IN_ITEM.ItemCode | IN_ITEMCODE.ItemCode |
| IN_ITEM.ProdTypeCode | IN_PRODTYPE.ProdTypeCode |
| IN_ITEM.ProdCatCode | IN_PRODCAT.ProdCatCode |
| IN_ITEM.ProdBrandCode | IN_PRODBRAND.ProdBrandCode |
| IN_ITEM.ProdModelCode | IN_PRODMODEL.ProdModelCode |
| IN_ITEM.ProdMatCode | IN_PRODMAT.ProdMatCode |
| IN_ITEM.StockAnalysisCode | IN_STOCKANALYSIS.StockAnalysisCode |

---

## 5. Sample Data

**Path:** `Services/module/inventory/samples/IN_ITEM.json`

### Sample Query - IN_ITEM Schema

```sql
-- Get IN_ITEM schema (50 columns)
SELECT
    c.COLUMN_NAME,
    c.DATA_TYPE,
    c.CHARACTER_MAXIMUM_LENGTH,
    c.NUMERIC_PRECISION,
    c.NUMERIC_SCALE,
    c.IS_NULLABLE,
    c.COLUMN_DEFAULT,
    c.ORDINAL_POSITION
FROM INFORMATION_SCHEMA.COLUMNS c
WHERE c.TABLE_NAME = 'IN_ITEM'
ORDER BY c.ORDINAL_POSITION;
```

### Sample Query - IN_ITEM Data

```sql
-- Sample rows from IN_ITEM (all columns)
SELECT TOP 10
    RTRIM(ItemCode) AS ItemCode,
    RTRIM(LocCode) AS LocCode,
    RTRIM(Description) AS Description,
    RTRIM(Bin) AS Bin,
    RTRIM(ItemType) AS ItemType,
    RTRIM(ProdTypeCode) AS ProdTypeCode,
    RTRIM(ProdCatCode) AS ProdCatCode,
    FuelTypeInd,
    RTRIM(ProdBrandCode) AS ProdBrandCode,
    RTRIM(ProdModelCode) AS ProdModelCode,
    RTRIM(ProdMatCode) AS ProdMatCode,
    RTRIM(StockAnalysisCode) AS StockAnalysisCode,
    RTRIM(UOMCode) AS UOMCode,
    QtyOnHand,
    QtyOnHold,
    QtyOnOrder,
    AverageCost,
    LatestCost,
    DiffAverageCost,
    ClosingBal,
    Status,
    CreateDate,
    UpdateDate,
    RTRIM(UpdateID) AS UpdateID
FROM [db_ptrj_mill].[dbo].[IN_ITEM]
ORDER BY UpdateDate DESC;
```

### Sample Query - Row Counts

```sql
-- Row counts for all IN_* tables
SELECT
    t.NAME AS TableName,
    p.rows AS RowCounts
FROM sys.tables t
INNER JOIN sys.partitions p ON t.object_id = p.object_id
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE t.name LIKE 'IN[_]%'
  AND p.index_id IN (0, 1)
ORDER BY t.name;
```

---

## 6. Report Generation

**Path:** `Services/module/inventory/reports/generate_reports.py`

Script Python untuk generate semua report dari Estate dan Mill.

### Fitur Report

1. **IN_ITEM Stock Summary** - Summary stok per lokasi dan tipe produk
2. **Low Stock & Dead Stock** - Items dengan stok rendah dan mati
3. **IN_STOCKISSUE Analysis** - Analisis pengeluaran stok
4. **IN_PRLN Analysis** - Analisis purchase requisition
5. **IN_FUELISSUE Analysis** - Analisis konsumsi bahan bakar
6. **IN_MTHENDITEM** - Valuasi stok akhir bulan
7. **Lookup Tables** - Product classification

### Cara Penggunaan

```bash
# Jalankan script dari direktori reports
cd Services/module/inventory/reports
python generate_reports.py

# Output akan disimpan di:
# D:/Gawean Rebinmas/Main Dashboard/Services/module/inventory/reports/
```

### Output Files

| File | Description |
|---|---|
| `estate_in_item_summary.json` | Summary stok Estate |
| `mill_in_item_summary.json` | Summary stok Mill |
| `estate_low_dead_stock.json` | Low/dead stock Estate |
| `mill_low_dead_stock.json` | Low/dead stock Mill |
| `estate_stock_issue.json` | Stock issue Estate |
| `mill_stock_issue.json` | Stock issue Mill |
| `estate_pr.json` | Purchase requisition Estate |
| `mill_pr.json` | Purchase requisition Mill |
| `estate_fuel.json` | Fuel consumption Estate |
| `mill_fuel.json` | Fuel consumption Mill |
| `estate_mthend.json` | Month-end Estate |
| `mill_mthend.json` | Month-end Mill |
| `estate_lookup.json` | Lookup tables Estate |
| `mill_lookup.json` | Lookup tables Mill |

---

## 7. Quick Reference

**Path:** `Services/module/inventory/docs/QUICK_REFERENCE.md`

### Bash / cURL Cheatsheet

```bash
# Variables
API="http://localhost:8001"
TOKEN="2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6"
DB="db_ptrj_mill"

# 1. Health check
curl -s $API/health

# 2. List databases
curl -s $API/v1/databases -H "x-api-key: $TOKEN"

# 3. Count IN_ITEM rows
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d "{\"sql\":\"SELECT COUNT(*) AS TotalRows FROM [db_ptrj_mill].[dbo].[IN_ITEM]\",\"database\":\"$DB\"}"

# 4. Get top 5 items by QtyOnHand
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT TOP 5 ItemCode, LocCode, Description, QtyOnHand, AverageCost, Status FROM [db_ptrj_mill].[dbo].[IN_ITEM] ORDER BY QtyOnHand DESC","database":"db_ptrj_mill"}'

# 5. Get items with low stock (QtyOnHand < ReOrderLevel)
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT ItemCode, LocCode, Description, QtyOnHand, ReOrderLevel FROM [db_ptrj_mill].[dbo].[IN_ITEM] WHERE QtyOnHand < ReOrderLevel AND Status = '\''1 '\'' ORDER BY QtyOnHand ASC","database":"db_ptrj_mill"}'

# 6. Search items by description
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT TOP 10 ItemCode, Description, QtyOnHand, UOMCode FROM [db_ptrj_mill].[dbo].[IN_ITEM] WHERE Description LIKE '\''%bolt%'\''","database":"db_ptrj_mill"}'

# 7. Get stock value summary by location
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT LocCode, COUNT(*) AS ItemCount, SUM(QtyOnHand * AverageCost) AS TotalValue FROM [db_ptrj_mill].[dbo].[IN_ITEM] GROUP BY LocCode ORDER BY TotalValue DESC","database":"db_ptrj_mill"}'

# 8. List all location codes
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT DISTINCT LocCode FROM [db_ptrj_mill].[dbo].[IN_ITEM] ORDER BY LocCode","database":"db_ptrj_mill"}'

# 9. Get items by type
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT ItemType, COUNT(*) AS Count FROM [db_ptrj_mill].[dbo].[IN_ITEM] GROUP BY ItemType ORDER BY Count DESC","database":"db_ptrj_mill"}'

# 10. Recent updates
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT TOP 10 ItemCode, LocCode, Description, UpdateDate, UpdateID FROM [db_ptrj_mill].[dbo].[IN_ITEM] ORDER BY UpdateDate DESC","database":"db_ptrj_mill"}'

# 11. List product types
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT * FROM [db_ptrj_mill].[dbo].[IN_PRODTYPE] ORDER BY ProdTypeCode","database":"db_ptrj_mill"}'

# 12. List product categories
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT * FROM [db_ptrj_mill].[dbo].[IN_PRODCAT] ORDER BY ProdCatCode","database":"db_ptrj_mill"}'

# 13. Get item master data (IN_ITEMCODE)
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT TOP 5 * FROM [db_ptrj_mill].[dbo].[IN_ITEMCODE] ORDER BY ItemCode","database":"db_ptrj_mill"}'

# 14. Batch: Insert + verify (transaction)
curl -s -X POST $API/v1/query/batch \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"database":"db_ptrj_mill","queries":[{"sql":"SELECT TOP 1 * FROM [db_ptrj_mill].[dbo].[IN_ITEM]"},{"sql":"SELECT COUNT(*) AS Total FROM [db_ptrj_mill].[dbo].[IN_ITEM]"}]}'
```

### Python Example

```python
import requests

API = "http://localhost:8001"
TOKEN = "2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6"
DB = "db_ptrj_mill"
HEADERS = {"x-api-key": TOKEN, "Content-Type": "application/json"}

def query(sql, database=DB):
    r = requests.post(f"{API}/v1/query",
        json={"sql": sql, "database": database},
        headers=HEADERS)
    return r.json()

# Get low stock items
result = query(
    "SELECT ItemCode, Description, QtyOnHand, ReOrderLevel "
    "FROM [db_ptrj_mill].[dbo].[IN_ITEM] "
    "WHERE QtyOnHand < ReOrderLevel AND Status = '1 '"
)
for row in result["data"]["recordset"]:
    print(f"{row['ItemCode']} | {row['Description']} | Stock: {row['QtyOnHand']} / Reorder: {row['ReOrderLevel']}")
```

### PowerShell Example

```powershell
$headers = @{
    "x-api-key" = "2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6"
    "Content-Type" = "application/json"
}

# Get low stock items
$body = '{"sql":"SELECT TOP 20 ItemCode, Description, QtyOnHand, ReOrderLevel FROM [db_ptrj_mill].[dbo].[IN_ITEM] WHERE QtyOnHand < ReOrderLevel AND Status = '\''1 '\'' ORDER BY QtyOnHand ASC","database":"db_ptrj_mill"}'
$r = Invoke-RestMethod -Uri "http://localhost:8001/v1/query" -Method POST -Headers $headers -Body $body
$r.data.recordset | ForEach-Object { Write-Host "$($_.ItemCode) | $($_.Description) | Stock: $($_.QtyOnHand)" }
```

---

## Design Patterns

1. **Header + Line pattern:** Setiap transaksi memiliki `*_HDR` (header) dan `*_LN` (line) tables.
2. **Audit tables (_ACC):** Setiap main table memiliki corresponding `*_ACC` table untuk audit trail.
3. **Staging tables (_TEMP):** Empty — digunakan untuk temporary work sebelum commit.
4. **Expiry tables (_EXDATE):** Untuk tracking expiry dates pada stock receive/issue/return/transfer.
5. **No FK constraints:** Semua relationships adalah implisit via column naming conventions.
6. **Fixed-width char fields:** Semua code fields menggunakan `char()` (padded with spaces). Selalu gunakan `RTRIM()` saat membandingkan atau menampilkan.

---

## Important Notes

- Semua `char(N)` fields adalah **zero-padded with spaces** di SQL Server. Selalu gunakan `RTRIM()` saat menampilkan atau membandingkan.
- `Status` values: `'1 '` = active, `'2 '` = inactive (2-char, space-padded).
- `LocCode` values disimpan sebagai 8-char padded strings (e.g., `"PTRJ    "`).
- Semua timestamps ada di **UTC** (SQL Server datetime type).
- Composite key `(ItemCode, LocCode)` berarti satu ItemCode bisa muncul multiple kali — satu per lokasi.

---

## File Paths

| File | Path |
|---|---|
| Schema IN_ITEM | `D:\Gawean Rebinmas\Main Dashboard\Services\module\inventory\schema\IN_ITEM.json` |
| Sample IN_ITEM | `D:\Gawean Rebinmas\Main Dashboard\Services\module\inventory\samples\IN_ITEM.json` |
| Tables JSON | `D:\Gawean Rebinmas\Main Dashboard\Services\module\inventory\tables\tables.json` |
| DB Schema Docs | `D:\Gawean Rebinmas\Main Dashboard\Services\module\inventory\docs\DB_SCHEMA.md` |
| Quick Reference | `D:\Gawean Rebinmas\Main Dashboard\Services\module\inventory\docs\QUICK_REFERENCE.md` |
| FK Queries | `D:\Gawean Rebinmas\Main Dashboard\Services\module\inventory\queries\foreign_keys.sql` |
| IN_ITEM Sample SQL | `D:\Gawean Rebinmas\Main Dashboard\Services\module\inventory\queries\in_item_sample.sql` |
| IN_ITEM Schema SQL | `D:\Gawean Rebinmas\Main Dashboard\Services\module\inventory\queries\in_item_schema.sql` |
| List Tables SQL | `D:\Gawean Rebinmas\Main Dashboard\Services\module\inventory\queries\list_in_tables.sql` |
| Row Counts SQL | `D:\Gawean Rebinmas\Main Dashboard\Services\module\inventory\queries\row_counts.sql` |
| Generate Reports | `D:\Gawean Rebinmas\Main Dashboard\Services\module\inventory\reports\generate_reports.py` |
| Dokumentasi README | `D:\Gawean Rebinmas\Main Dashboard\docs\04-services-inventory\README.md` |

---

**Last updated:** 2026-06-10