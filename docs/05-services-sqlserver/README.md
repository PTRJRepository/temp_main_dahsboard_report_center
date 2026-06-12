# SQL Server Access Services

Dokumentasi lengkap untuk layanan akses SQL Server dalam proyek Main Dashboard.

**Last updated:** 2026-06-10

---

## Daftar Isi

1. [Arsitektur Overview](#1-arsitektur-overview)
2. [SQL Server Client (Python)](#2-sql-server-client-python)
3. [TCP Port Forwarder](#3-tcp-port-forwarder)
4. [Database Connection Details](#4-database-connection-details)
5. [PR_TABLES Schema Detail](#5-pr_tables-schema-detail)
6. [Routes Configuration](#6-routes-configuration)
7. [API Endpoints](#7-api-endpoints)

---

## 1. Arsitektur Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MAIN DASHBOARD                               │
│                                                                     │
│   ┌─────────────┐      ┌─────────────────┐      ┌──────────────┐  │
│   │  Browser /  │      │  Express Proxy  │      │  SQL Server  │  │
│   │   Client    │─────>│   (server.js)   │─────>│   Port 1433  │  │
│   │             │      │    Port 3001    │      │              │  │
│   └─────────────┘      └────────┬────────┘      └──────────────┘  │
│                                  │                               │
│   ┌─────────────────────────────┴─────────────────────────────┐   │
│   │                   ROUTES CONFIG                           │   │
│   │  routes-config.json / routes-config.production.json        │   │
│   └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │           SERVICES / ACCESS_SQL_SERVER_FROM_3001            │  │
│   │  ┌────────────────────┐  ┌────────────────────────────┐ │  │
│   │  │  TCP Port Forwarder │  │    SQL Server Client        │ │  │
│   │  │  (tcp_port_forwarder│  │    (sql_server_client.py)    │ │  │
│   │  │   .py)              │  │                            │ │  │
│   │  │  Port 3001 -> 1433 │  │    Python pyodbc access     │ │  │
│   │  └────────────────────┘  └────────────────────────────┘ │  │
│   └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Aliran Data

1. **Browser/Client** → HTTP Request
2. **Express Proxy (server.js)** → Route berdasarkan `routes-config.json`
3. **Target Service** → Bisa berupa:
   - Local service (localhost:8002, 5176, dll)
   - SQL Gateway API (localhost:8001/v1/query)
   - Port Forwarder (localhost:3001 → SQL Server)

---

## 2. SQL Server Client (Python)

**File Path:** `D:\Gawean Rebinmas\Main Dashboard\Services\access_sql_server_from_3001\sql_server_client.py`

### Deskripsi

Modul Python untuk mengakses SQL Server melalui port proxy 3001 yang diteruskan ke SQL Server port 1433. Menggunakan library `pyodbc` untuk koneksi.

### Struktur Kode

```python
# Koneksi via proxy
server = "223.25.98.220"  # IP Publik server
port = 3001  # Port proxy
database = "db_ptrj"  # Database PTRJ
username = "sa"
password = "ptrj@123"

# Connection string
connection_string = (
    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
    f"SERVER={server},{port};"
    f"DATABASE={database};"
    f"UID={username};"
    f"PWD={password};"
    f"TrustServerCertificate=yes;"
)
```

### Fungsi Utama

#### `connect_via_proxy()`

Fungsi untuk test koneksi ke SQL Server dan menampilkan informasi server.

```python
def connect_via_proxy():
    """Koneksi ke SQL Server via proxy port 3001"""
    # Mengembalikan: True jika berhasil, False jika gagal
```

**Fitur:**
- Menampilkan versi SQL Server
- Menampilkan daftar database
- Menampilkan machine name, edition, dan product version

#### `execute_query(query, database="master")`

Fungsi untuk mengeksekusi query SQL dan mengembalikan hasil.

```python
def execute_query(query, database="master"):
    """
    Args:
        query: SQL query string
        database: nama database (default: master)
    
    Returns:
        list of tuples hasil query, atau None jika error
    """
```

### Penggunaan dalam Kode

```python
from sql_server_client import execute_query

# Query sederhana
results = execute_query("SELECT * FROM TableName", database="DatabaseName")

# Loop hasil
for row in results:
    print(row)
```

### Dependencies

**File:** `D:\Gawean Rebinmas\Main Dashboard\Services\access_sql_server_from_3001\requirements.txt`

```
pyodbc>=4.0.0
```

---

## 3. TCP Port Forwarder

**File Path:** `D:\Gawean Rebinmas\Main Dashboard\Services\access_sql_server_from_3001\tcp_port_forwarder.py`

### Deskripsi

TCP proxy level rendah yang meneruskan koneksi dari port 3001 ke SQL Server port 1433. Berguna untuk membuat abstraksi layer antara aplikasi dan database.

### Konfigurasi

```python
LOCAL_PORT = 3001              # Port proxy yang diekspos
TARGET_HOST = "localhost"      # SQL Server di mesin yang sama
TARGET_PORT = 1433             # Port SQL Server asli
BUFFER_SIZE = 4096
```

### Arsitektur Multi-Threading

```
                    ┌─────────────────────────┐
                    │   TCP Port Forwarder    │
                    │      Port 3001          │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │    handle_client()       │
                    │  (Thread per koneksi)    │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
    ┌─────────▼─────────┐              ┌─────────▼─────────┐
    │  Client -> SQL     │              │  SQL -> Client    │
    │  (forward_data)    │              │  (forward_data)   │
    │  Thread            │              │  Thread           │
    └───────────────────┘              └───────────────────┘
              │                                   │
              └─────────────────┬─────────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │    SQL Server           │
                    │    Port 1433            │
                    └─────────────────────────┘
```

### Cara Menjalankan

#### Terminal 1 - Jalankan Port Forwarder:

```bash
cd Services\access_sql_server_from_3001
python tcp_port_forwarder.py
```

**Output:**
```
[*] TCP Port Forwarder berjalan...
[*] Listening di port 3001
[*] Forwarding ke localhost:1433
[*] Tekan Ctrl+C untuk berhenti
```

#### Terminal 2 - Test Koneksi:

```bash
python sql_server_client.py
```

### Fungsi Inti

#### `forward_data(source, destination, direction)`

Meneruskan data dari source socket ke destination socket.

```python
def forward_data(source, destination, direction):
    """Meneruskan data dari source ke destination"""
    # direction: "CLIENT->SQL" atau "SQL->CLIENT"
    # Menangani ConnectionResetError, ConnectionAbortedError, BrokenPipeError
```

#### `handle_client(client_socket, client_address)`

Handle koneksi client dan buat koneksi ke target SQL Server.

```python
def handle_client(client_socket, client_address):
    """Handle koneksi client dan buat koneksi ke target"""
    # 1. Buat koneksi ke SQL Server
    # 2. Buat 2 thread untuk forward data bidirectional
    # 3. Tunggu sampai selesai
```

#### `start_proxy()`

Memulai proxy server dengan binding ke `0.0.0.0:{LOCAL_PORT}`.

### Catatan Penting

1. **Pastikan SQL Server berjalan** di port 1433 sebelum menjalankan port forwarder
2. **Port forwarder harus aktif** selama menggunakan client via port 3001
3. Jika hanya ingin akses dari Python saja, bisa langsung konek ke port 1433 tanpa forwarder
4. Port forwarder berguna jika:
   - Aplikasi lain perlu akses SQL Server via port berbeda
   - Ingin membuat abstraksi layer antara aplikasi dan database
   - Testing dalam environment terbatas

---

## 4. Database Connection Details

### SQL Server Configuration

| Parameter | Value |
|-----------|-------|
| **Server** | 223.25.98.220 (IP Publik) |
| **Port** | 3001 (via proxy) atau 1433 (direct) |
| **Username** | sa |
| **Password** | ptrj@123 |
| **Driver** | ODBC Driver 17 for SQL Server |

### Database Locations

| Database | Description | Used By |
|----------|-------------|---------|
| `db_ptrj` | Database PTRJ Estate | Estate services |
| `db_ptrj_mill` | Database PTRJ Mill | Mill services, Report system |

### Connection String Format

```python
connection_string = (
    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
    f"SERVER={server},{port};"
    f"DATABASE={database};"
    f"UID={username};"
    f"PWD={password};"
    f"TrustServerCertificate=yes;"
)
```

### SQL Gateway API

**Base URL:** `http://localhost:8001/v1/query`
**API Key:** `2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6`

---

## 5. PR_TABLES Schema Detail

**Referensi:** `D:\Gawean Rebinmas\Main Dashboard\PR_TABLES_MCP.md`

### Overview

Sistem Purchase Requisition (PR) dengan 3 tabel utama yang saling berelasi:

```
IN_PR.PRID (composite PK: PRID+LocCode)
      |
      +-- 1:N --> IN_PRLN.PRID  (each PR has many line items)
                    |
                    +-- 1:N --> IN_PRLN_ACC.TrxID (= IN_PRLN.PRLnID)
```

### Row Counts Summary

| Table | Estate (SERVER_PROFILE_1) | Mill (SERVER_PROFILE_3) |
|-------|---------------------------|-------------------------|
| IN_PR | 9,700 | 10,300 |
| IN_PRLN | 29,592 | 31,239 |
| IN_PRLN_ACC | 30,309 | 31,956 |

---

### 5.1 IN_PR — Purchase Requisition Header

**File Path:** `D:\Gawean Rebinmas\Main Dashboard\pr_tables_deepdive.json`

#### Schema (14 columns)

| # | Column | Type | Null? | Key | Width | Interpretation |
|---|--------|------|-------|-----|-------|----------------|
| 1 | PRID | char | NO | **PK** | 100 | PR document number. Format: `PR` + YR + 6-digit seq. Composite PK with LocCode |
| 2 | PRType | char | NO | | 3 | PR category. Values: `'1'`, `'2'`, `'4'`, `'6'` |
| 3 | TotalAmount | decimal(20,5) | YES | | | Total monetary value of PR (Qty x Cost) |
| 4 | Remark | nvarchar | YES | | 500 | Free-text note/description |
| 5 | AccMonth | char | YES | | 2 | Accounting month (01–12) |
| 6 | AccYear | char | YES | | 4 | Accounting year |
| 7 | LocCode | char | NO | **PK** | 8 | Location code. Sample: `'PTRJ    '` |
| 8 | Status | char | YES | | 2 | PR workflow status. Values: `'1'`, `'2'`, `'3'`, `'4'`, `'6'` |
| 9 | CreateDate | datetime | YES | | | Server timestamp when PR was created |
| 10 | UpdateDate | datetime | YES | | | Server timestamp of last modification |
| 11 | UpdateID | char | YES | | 20 | User/operator ID who last modified |
| 12 | PrintDate | datetime | YES | | | When PR was printed. `'1900-01-01'` = never printed |
| 13 | IsNurseryFlag | bit | YES | | | Boolean: 1 = Nursery-related PR |
| 14 | PRDate | datetime | YES | | | Effective/business date of the PR |

**Primary Key:** `(PRID, LocCode)` — composite primary key

#### PR Status Codes (IN_PR.Status)

| Status | Meaning | Estate Count | Mill Count |
|--------|---------|-------------|------------|
| `'1 '` | Open / Draft / Pending Approval | 25 | 34 |
| `'2 '` | Approved / Confirmed | 770 | 930 |
| `'3 '` | Partially Fulfilled / Partial | 130 | 131 |
| `'4 '` | Fulfilled / Completed | 1,534 | 1,543 |
| `'6 '` | Closed / Archived / Canceled | 7,241 | 7,662 |

#### PR Type Codes (IN_PR.PRType)

| PRType | Meaning | Estate Count | Mill Count |
|--------|---------|-------------|------------|
| `'1 '` | General / Non-Stock | 1,369 | 1,576 |
| `'2 '` | Stock Item | 4,003 | 4,137 |
| `'4 '` | Workshop / Maintenance | 4,311 | 4,565 |
| `'6 '` | Nursery | 17 | 22 |

#### Sample Row

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

---

### 5.2 IN_PRLN — Purchase Requisition Line

#### Schema (11 columns)

| # | Column | Type | Null? | Key | Width/Default | Interpretation |
|---|--------|------|-------|-----|---------------|----------------|
| 1 | PRID | char | NO | **PK** | 20 | Links to IN_PR.PRID |
| 2 | ItemCode | char | NO | **PK** | 20 | Inventory item code. FK to IN_ITEM |
| 3 | QtyReq | decimal(20,5) | YES | | | Quantity requested |
| 4 | QtyRcv | decimal(20,5) | YES | | | Quantity received/fulfilled |
| 5 | QtyOutstanding | decimal(20,5) | YES | | | Remaining qty (QtyReq - QtyRcv) |
| 6 | Cost | decimal(20,5) | YES | | | Unit cost at time of PR creation |
| 7 | Amount | decimal(20,5) | YES | | | Total amount (QtyReq x Cost) |
| 8 | Status | char | YES | | 2 | Line-level status: `'1 '` (open), `'2 '` (closed) |
| 9 | BudgetInd | char | NO | | 1, default='0' | Budget check flag. `'0'`=no check, `'1'`=controlled |
| 10 | PRLnID | char | NO | **PK** | 20, default='' | Unique line ID. Format: `PRLN` + YR + 6-digit seq |
| 11 | AccCodeDesc | nchar | NO | | 128, default='' | Description/account name |

**Primary Key:** `(PRID, ItemCode, PRLnID)` — composite primary key

#### PRLN Status Codes

| Status | Meaning | Estate Count | Mill Count |
|--------|---------|-------------|------------|
| `'1 '` | Open / Pending delivery | 29,222 | 30,843 |
| `'2 '` | Closed / Fulfilled | 370 | 396 |

#### BudgetInd Codes

| BudgetInd | Meaning | Estate Count | Mill Count |
|-----------|---------|-------------|------------|
| `'0'` | No budget check | 29,590 | 31,237 |
| `'1'` | Budget-controlled | 2 | 2 |

#### Sample Rows (Estate)

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

---

### 5.3 IN_PRLN_ACC — Purchase Requisition Line Accounting/Cost Allocation

#### Schema (23 columns)

| # | Column | Type | Null? | Key | Width | Interpretation |
|---|--------|------|-------|-----|-------|----------------|
| 1 | ID | bigint | NO | **PK** | | Auto-increment primary key |
| 2 | TrxID | varchar | YES | | 20 | Transaction reference = PRLnID |
| 3 | AccCode | varchar | YES | | 20 | GL Account code. e.g. `'GA9222'`, `'CA2119'` |
| 4 | BlkCode | varchar | YES | | 20 | Block/Station code. e.g. `'STN-OFF'`, `'STN-BLR'` |
| 5 | SubBlkCode | varchar | YES | | 20 | Sub-block or sub-station |
| 6 | VehCode | varchar | YES | | 20 | Vehicle/Equipment code |
| 7 | ExpCode | varchar | YES | | 20 | Expense code. Values: `'O'` (Operational), `'L'` |
| 8 | VehExpCode | varchar | YES | | 20 | Vehicle expense code |
| 9 | SuppCode | varchar | YES | | 20 | Preferred supplier code |
| 10 | BillCode | varchar | YES | | 20 | Bill/Invoice reference code |
| 11 | ItemCode | varchar | YES | | 20 | Item code (when AccCode maps to inventory) |
| 12 | EmpCode | varchar | YES | | 20 | Employee code (for labor-related PR) |
| 13 | AssCode | varchar | YES | | 20 | Asset code |
| 14 | DeptCode | varchar | YES | | 20 | Department code for cost center |
| 15 | WsJobCode | varchar | YES | | 20 | Workshop job code (PRType='4') |
| 16 | BudgetID | varchar | YES | | 20 | Budget reference ID |
| 17 | TaskCode | varchar | YES | | 20 | Task code for job costing |
| 18 | ContractID | varchar | YES | | 20 | Contract ID |
| 19 | MsgID | varchar | YES | | 20 | Message/notes ID |
| 20 | DocID | varchar | YES | | 20 | Document ID |
| 21 | Dim19 | varchar | YES | | 20 | Custom dimension — **Location code** (`'PTRJ'`) |
| 22 | Dim20 | varchar | YES | | 20 | Custom dimension — currently unused |
| 23 | TempID | int | YES | | | Temporary/hold ID. Always 0 |

#### Sample Rows (Estate, recent PRLN_ACC records)

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

---

### Key Observations

#### 1. PRID / PRLnID Naming Convention
- PRID: `PR` + last 2 digits of year + 6-digit sequence. e.g. `PR26009918` = year 2026, seq 009918
- PRLnID: `PRLN` + year + 6-digit sequence. e.g. `PRLN26033412` = year 2026, seq 033412
- One PR can have multiple lines, each with its own PRLnID

#### 2. Composite PK on IN_PR
The composite PK `(PRID, LocCode)` means the same PRID can exist in multiple locations. All current data shows `LocCode='PTRJ'`

#### 3. TotalAmount and Cost/Amount = 0 in Most Records
- Most PR lines have `Cost=0`, `Amount=0`, and `IN_PR.TotalAmount=0`
- Costs may be filled at the PO stage

#### 4. IN_PRLN_ACC acts as cost/allocation dimension table
- One PRLN line can have multiple ACC rows (different cost centers, blocks, or split accounts)
- `TrxID` in ACC = `PRLnID` in PRLN
- `Dim19` always contains the location code (e.g. `'PTRJ'`)

#### 5. PRType 4 = Workshop/Maintenance
- `AccCodeDesc='EFB PRESS NO. 1'` or `BlkCode='STN-BLR'` indicate workshop/cost-center-based PRs
- Workshop items have `WsJobCode` dimension populated

#### 6. Mill vs Estate Difference
- Mill has slightly more records across all three tables (~600 more PRs, ~1,600 more lines)
- Mill newest PRs (`PR26010518`) are from 2026-05-16, Estate newest (`PR26009918`) is from Jan 2026

#### 7. All char fields are right-padded
- Always use `RTRIM()` for display and `LTRIM(RTRIM())` for comparisons

#### 8. AccCode Prefixes
| Prefix | Inferred Category |
|--------|-------------------|
| GA | General Administration |
| CA | Cost Account / Inventory |
| OC | Overhead Cost / Workshop |
| EM | Employee-related |
| FA | Fixed Asset |

---

## 6. Routes Configuration

### routes-config.json

**File Path:** `D:\Gawean Rebinmas\Main Dashboard\routes-config.json`

Konfigurasi routes untuk environment development.

### routes-config.production.json

**File Path:** `D:\Gawean Rebinmas\Main Dashboard\routes-config.production.json`

Konfigurasi routes untuk environment production.

### Route Definitions

#### 6.1 Route: `/upah` — Sistem Penggajian/Payroll

```json
{
  "id": "upah",
  "path": "/upah",
  "target": "http://localhost:8002",
  "description": "Sistem Penggajian/Payroll (Static dari dist folder)",
  "enabled": true,
  "rewriteContent": "html-only",
  "spaIndex": "D:/Gawean Rebinmas/PORTAL_ESTATE/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production/frontend/dist/index.html",
  "aliases": [
    "/auth", "/payroll", "/employees", "/employee-estate",
    "/dev-mode", "/tax-report", "/tunjangan", "/spreadsheet",
    "/reports", "/mill-production"
  ],
  "apiPrefixes": [
    "/upah/auth", "/upah/payroll", "/upah/employees",
    "/upah/employee-estate", "/upah/dev-mode", "/upah/tax-report",
    "/upah/tunjangan", "/upah/spreadsheet", "/upah/reports",
    "/upah/mill-production"
  ],
  "textRewrites": [
    { "from": "http://localhost:8002", "to": "/backend/upah" },
    { "from": "http://127.0.0.1:8002", "to": "/backend/upah" }
  ],
  "staticRoots": [
    { "prefix": "/upah/assets", "dir": ".../dist/assets", "immutable": true },
    { "prefix": "/upah/images", "dir": ".../assets/images", "immutable": false },
    { "prefix": "/upah/vite.svg", "file": ".../dist/vite.svg", "immutable": false }
  ],
  "healthPath": "/",
  "timeoutMs": 30000,
  "cachePolicy": "static"
}
```

#### 6.2 Route: `/backend/upah` — Backend API Penggajian

```json
{
  "id": "backend-upah",
  "path": "/backend/upah",
  "target": "http://localhost:8002",
  "description": "Backend API untuk Sistem Penggajian",
  "enabled": true,
  "rewriteContent": false,
  "changeOrigin": false,
  "rewritePath": true
}
```

#### 6.3 Route: `/absen` — Sistem Absensi

```json
{
  "id": "absen",
  "path": "/absen",
  "target": "http://localhost:5176",
  "description": "Sistem Absensi Karyawan",
  "enabled": true,
  "rewriteContent": true
}
```

#### 6.4 Route: `/monitoring-beras` — Monitoring Beras

```json
{
  "id": "monitoring-beras",
  "path": "/monitoring-beras",
  "target": "http://localhost:5177",
  "description": "Monitoring Distribusi Beras",
  "enabled": true,
  "rewriteContent": true
}
```

#### 6.5 Route: `/query` — SQL Gateway API

```json
{
  "id": "query",
  "path": "/query",
  "target": "http://localhost:8001",
  "description": "SQL Gateway API",
  "enabled": true,
  "rewriteContent": false,
  "rewritePath": false,
  "public": true
}
```

#### 6.6 Route: `/file` — Google Drive File Gateway

```json
{
  "id": "file",
  "path": "/file",
  "target": "http://localhost:5178",
  "description": "Google Drive File Gateway",
  "enabled": true,
  "rewriteContent": false,
  "rewritePath": true
}
```

#### 6.7 Route: `/ifess` — IFESS Client Gateway

```json
{
  "id": "ifess",
  "path": "/ifess",
  "target": "http://localhost:8003",
  "description": "IFESS Client Gateway",
  "enabled": true,
  "rewriteContent": false,
  "rewritePath": true,
  "public": true
}
```

### Route Configuration Properties

| Property | Description |
|----------|-------------|
| `id` | Unique identifier for the route |
| `path` | URL path prefix for this route |
| `target` | Target backend service URL |
| `description` | Human-readable description |
| `enabled` | Whether the route is active |
| `rewriteContent` | Content rewriting mode: `html-only`, `true`, `false` |
| `rewritePath` | Whether to rewrite the path when proxying |
| `changeOrigin` | Change the Origin header (default: false) |
| `public` | Whether route is publicly accessible (no auth) |
| `aliases` | Alternative paths that should map to this route |
| `apiPrefixes` | API endpoint prefixes under this route |
| `textRewrites` | Text replacement rules for content rewriting |
| `staticRoots` | Static file serving configuration |
| `spaIndex` | Index file for Single Page Applications |
| `healthPath` | Path to check service health |
| `timeoutMs` | Request timeout in milliseconds |
| `cachePolicy` | Caching behavior: `static`, `none`, etc. |
| `image` | Optional thumbnail image URL |

---

## 7. API Endpoints

### 7.1 SQL Gateway API

**Base URL:** `http://localhost:8001/v1/query`

Akses ke SQL Server melalui Express proxy dengan autentikasi API key.

**Headers:**
```
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

**API Key:** `2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6`

#### Query Format

```json
{
  "query": "SELECT * FROM IN_PR WHERE Status = '1'",
  "database": "db_ptrj_mill",
  "limit": 100
}
```

### 7.2 Report System API

**Base URL:** `/api/reports/inventory/`

Lokasi: `Dashboard_Utama/app/api/reports/inventory/route.ts`

Report handlers yang terdaftar untuk berbagai inventory reports.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Number of rows to return |
| `limitAll` | boolean | Return all rows |
| `search` | string | Search filter |
| `source` | string | Data source: `pabrik` (db_ptrj_mill), `estate` (db_ptrj) |
| `filters` | object | Additional filter criteria |

### 7.3 PR Tables Direct Access

**Database:** `db_ptrj_mill`

#### IN_PR Queries

```sql
-- Get PR by status
SELECT * FROM IN_PR WHERE RTRIM(Status) = '1' AND RTRIM(LocCode) = 'PTRJ'

-- Get recent PRs
SELECT TOP 10 PRID, PRType, Status, PRDate, CreateDate
FROM IN_PR
WHERE RTRIM(LocCode) = 'PTRJ'
ORDER BY CreateDate DESC
```

#### IN_PRLN Queries

```sql
-- Get lines for a PR
SELECT * FROM IN_PRLN
WHERE RTRIM(PRID) = 'PR26009918'
ORDER BY PRLnID

-- Get pending deliveries
SELECT PRID, ItemCode, QtyReq, QtyRcv, QtyOutstanding
FROM IN_PRLN
WHERE RTRIM(Status) = '1' AND QtyOutstanding > 0
```

#### IN_PRLN_ACC Queries

```sql
-- Get cost allocations for a line
SELECT * FROM IN_PRLN_ACC
WHERE RTRIM(TrxID) = 'PRLN26033412'

-- Get allocations by account code
SELECT AccCode, COUNT(*) as cnt
FROM IN_PRLN_ACC
WHERE RTRIM(Dim19) = 'PTRJ'
GROUP BY AccCode
```

### 7.4 Movement Category Calculation

**Referensi:** `Dashboard_Utama/lib/reports/inventory/config.ts`

MovementCategory ditentukan oleh `StockIssueEventCount` (total stock issue events per item):

| StockIssueEventCount | MovementCategory |
|---------------------|------------------|
| >= 6 | Fast Moving |
| 2-5 | Moving |
| 1 | Slow Moving |
| 0 with stock > 0 | Dead Stock |
| 0 with stock = 0 | No Movement |

---

## File Reference

| File | Path |
|------|------|
| SQL Server Client | `D:\Gawean Rebinmas\Main Dashboard\Services\access_sql_server_from_3001\sql_server_client.py` |
| TCP Port Forwarder | `D:\Gawean Rebinmas\Main Dashboard\Services\access_sql_server_from_3001\tcp_port_forwarder.py` |
| Requirements | `D:\Gawean Rebinmas\Main Dashboard\Services\access_sql_server_from_3001\requirements.txt` |
| Service README | `D:\Gawean Rebinmas\Main Dashboard\Services\access_sql_server_from_3001\README.md` |
| Routes Config (Dev) | `D:\Gawean Rebinmas\Main Dashboard\routes-config.json` |
| Routes Config (Prod) | `D:\Gawean Rebinmas\Main Dashboard\routes-config.production.json` |
| PR Tables Deep Dive | `D:\Gawean Rebinmas\Main Dashboard\pr_tables_deepdive.json` |
| PR Tables Extra | `D:\Gawean Rebinmas\Main Dashboard\pr_tables_extra.json` |
| PR Tables MCP Doc | `D:\Gawean Rebinmas\Main Dashboard\PR_TABLES_MCP.md` |
| Report Config | `D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\lib\reports\inventory\config.ts` |
| Report Route Handler | `D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\app\api\reports\inventory\route.ts` |

---

**Last updated:** 2026-06-10