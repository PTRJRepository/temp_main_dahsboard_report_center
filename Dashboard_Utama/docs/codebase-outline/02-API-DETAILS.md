# PT REBINMAS JAYA REPORT CENTER
# API DETAILS - COMPLETE REFERENCE

**Project:** D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/
**Generated:** May 2026
**Purpose:** Complete API documentation with endpoints, requests, responses, SQL tables, and report types

---

## DAFTAR ISI

1. [API Endpoints Overview](#1-api-endpoints-overview)
2. [Query Parameters Reference](#2-query-parameters-reference)
3. [Report Types (17)](#3-report-types-17)
4. [Request/Response Shapes](#4-requestresponse-shapes)
5. [SQL Tables Reference](#5-sql-tables-reference)
6. [Database Sources](#6-database-sources)
7. [Error Handling](#7-error-handling)

---

## 1. API ENDPOINTS OVERVIEW

### 1.1 Reports API Endpoints

| Endpoint | Method | Handler | Description |
|----------|--------|---------|-------------|
| `/api/reports/inventory` | GET | inventory/route.ts | Main inventory reports (17 types) |
| `/api/reports/system-status` | GET | system-status/route.ts | DB & integration status |
| `/api/reports/ai-insight` | POST | ai-insight/route.ts | AI-powered insights |
| `/api/reports/natural-filter` | GET | natural-filter/route.ts | Parse natural query |

### 1.2 Auth API Endpoints

| Endpoint | Method | Handler | Description |
|----------|--------|---------|-------------|
| `/api/auth/login` | POST | login/route.ts | User authentication |
| `/api/auth/logout` | POST | logout/route.ts | Clear session |
| `/api/auth/verify` | GET | verify/route.ts | Verify JWT token |
| `/api/auth/public-key` | GET | public-key/route.ts | RSA public key |
| `/api/auth/[...nextauth]` | * | nextauth/route.ts | NextAuth.js handler |

---

## 2. QUERY PARAMETERS REFERENCE

### 2.1 Inventory Reports Query Parameters

| Parameter | Required | Default | Type | Description | Valid Values |
|-----------|----------|------|-------------|------------|
| `report` | No | `stok-gudang` | string | Report type identifier | See Section 3 |
| `source` | No | (inferred) | string | Data source | `estate`, `pabrik`, `mill`, `factory` |
| `format` | No | `json` | string | Output format | `json`, `csv` |
| `search` | No | (empty) | string | Text search | Any text (max 80 chars) |
| `stale` | No | `lebih-1-tahun` | string | Staleness filter | `semua`, `kurang-1-tahun`, `lebih-1-tahun` |
| `limit` | No | `50` | number | Rows limit | 5-500 |
| `offset` | No | `0` | number | Pagination offset | >= 0 |
| `location` | No | (none) | string | Filter by location | LocCode |
| `month` | No | (none) | string | Filter by month | YYYY-MM |
| `category` | No | (none) | string | Filter by category | ProdCatCode |

### 2.2 System Status Query Parameters

| Parameter | Required | Default | Type | Description |
|-----------|----------|---------|------|-------------|
| `source` | No | `estate` | string | Data source |

### 2.3 AI Insight Request Body

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `title` | No | string | Card title |
| `context` | No | object | Report context with metadata |
| `fallbackInsight` | No | object | Fallback insight content |

---

## 3. REPORT TYPES (17)

### Complete Report List

| # | Report ID | Report Value | Function | Description |
|---|----------|-------------|----------|-------------|
| 1 | INV-A1 | `stok-gudang` | stockSummary | Posisi Stok & Nilai Gudang |
| 2 | INV-A2 | `summary` | stockSummary | Alias: Stok Gudang Summary |
| 3 | INV-B1 | `kartu-stok` | stockCard | Kualitas Master Item & Slow Moving |
| 4 | INV-B2 | `kualitas-master-item` | stockCard | Alias: Kualitas Master |
| 5 | INV-C1 | `mutasi-barang` | stockMovement | Mutasi Masuk vs Keluar |
| 6 | INV-D1 | `penerimaan-barang` | stockReceive | Penerimaan Barang |
| 7 | INV-D2 | `pengeluaran-barang` | stockIssue | Pengeluaran Barang Operasional |
| 8 | INV-E1 | `purchase-request-inventory` | purchaseRequestInventory | Purchase Request Inventory & Outstanding |
| 9 | INV-F1 | `transfer-antar-gudang` | transferWarehouse | Transfer Antar Gudang |
| 10 | INV-G1 | `stock-opname` | stockOpname | Stock Opname & Adjustment |
| 11 | INV-H1 | `fuel-usage` | fuelUsage | Fuel Usage Inventory |
| 12 | INV-I1 | `reorder-level` | reorderLevel | Reorder Level |
| 13 | INV-J1 | `riwayat-transaksi` | transactionHistory | Riwayat Transaksi |
| 14 | INV-K1 | `return-barang` | stockReturn | Return Barang |
| 15 | INV-L1 | `item-stale-update` | itemUpdateAge | Item Tidak Update & Aging Master |
| 16 | INV-M1 | `purchase-order-history` | purchaseOrderHistory | Purchasing Order History per Item & Supplier |
| 17 | INV-N1 | `supplier-purchasing-performance` | supplierPerformance | Supplier Performance & Master Quality |
| 18 | INV-O1 | `pupuk-stock-procurement` | fertilizerInventoryProcurement | Pupuk: Stock, Issue Readiness & Procurement |
| 19 | INV-P1 | `vehicle-running-workshop` | vehicleRunningWorkshop | Vehicle Running & Workshop Inventory Usage |

### Report ID Mapping to SQL Tables

| Report | Source Tables |
|--------|------------|
| stok-gudang | IN_ITEM, IN_PRODCAT |
| kartu-stok | IN_ITEM, IN_ITEMCODE, IN_PRODCAT |
| mutasi-barang | IN_STOCKISSUE, IN_STOCKISSUELN, IN_STOCKRECEIVE, IN_STOCKRECEIVELN, IN_STOCKTRANSFER, IN_STOCKTRANSFERLN |
| penerimaan-barang | IN_STOCKRECEIVE, IN_STOCKRECEIVELN |
| pengeluaran-barang | IN_STOCKISSUE, IN_STOCKISSUELN, IN_STOCKISSUELN_ACC |
| purchase-request-inventory | IN_PR, IN_PRLN, IN_PRLN_ACC |
| transfer-antar-gudang | IN_STOCKTRANSFER, IN_STOCKTRANSFERLN, IN_STOCKTRANSFERLN_ACC |
| stock-opname | IN_STOCKADJ, IN_STOCKADJLN, IN_STOCKADJLN_ACC |
| fuel-usage | IN_FUELISSUE, IN_FUELISSUELN, IN_FUELISSUELN_ACC |
| reorder-level | IN_ITEM |
| riwayat-transaksi | IN_MTHENDTRX |
| return-barang | IN_STOCKRTN, IN_STOCKRTNLN |
| item-stale-update | IN_ITEM |
| purchase-order-history | PU_PO, PU_POLN, PU_SUPPLIER, IN_ITEM |
| supplier-purchasing-performance | PU_SUPPLIER, PU_PO, PU_POLN, PU_GOODSRCV, PU_GOODSRCVLN, AP_INVOICERCV |
| pupuk-stock-procurement | IN_ITEM, PU_PO, PU_POLN, PU_SUPPLIER |
| vehicle-running-workshop | GL_VEHICLE, BD_VEHICLERUNNING, GL_VEHUSAGE, GL_VEHUSAGELN, WS_JOB, WS_JOBSTOCK |

---

## 4. REQUEST/RESPONSE SHAPES

### 4.1 Inventory Report Request

```http
GET /api/reports/inventory?report=stok-gudang&source=estate&limit=50&search=&stale=lebih-1-tahun
Host: localhost:3000
Accept: application/json
```

### 4.2 Inventory Report Response (Success)

```typescript
{
  "success": true,
  "report": "stok-gudang",
  "data": {
    "title": "Posisi Stok & Nilai Gudang",
    "description": "Executive view nilai persediaan, stok, gudang dominante...",
    "rows": [
      {
        "KodeBarang": "ITEM001",
        "NamaBarang": "Solar Dex",
        "Gudang": "A",
        "Satuan": "L",
        "StokAkhir": 5000.00,
        "AverageCost": 15000.00,
        "NilaiStok": 75000000.00,
        "Kategori": "CA2111",
        "TerakhirUpdate": "2026-05-15"
      }
    ],
    "columns": ["KodeBarang", "NamaBarang", "Gudang", "Satuan", "StokAkhir", "AverageCost", "NilaiStok", "Kategori", "TerakhirUpdate"],
    "summary": {
      "TotalItem": 7483,
      "ItemAdaStok": 6234,
      "ItemStokNol": 1249,
      "ItemTanpaKategori": 89,
      "TotalStok": 450000.00,
      "TotalGudang": 12,
      "NilaiPersediaan": 6750000000.00,
      "ItemMinimumStock": 456,
      "TerakhirUpdate": "2026-05-18"
    },
    "chart": [
      {
        "Gudang": "A",
        "TotalItem": 2341,
        "TotalStok": 150000.00,
        "NilaiStok": 2250000.00
      }
    ],
    "metadata": {
      "source": "estate",
      "sourceLabel": "Estate / Kebun",
      "sourceServer": "SERVER_PROFILE_2",
      "sourceDatabase": "db_ptrj",
      "dataSource": "Estate Inventory DB (Live)",
      "period": "Mei 2026",
      "generatedAt": "2026-05-18T10:30:00.000Z",
      "updatedBy": "Sistem Otomatis",
      "readOnly": true,
      "sourceTables": "IN_ITEM, IN_PRODCAT",
      "primaryChart": "Nilai Persediaan per Gudang",
      "availableCharts": [
        "Nilai Persediaan per Gudang",
        "Komposisi Nilai per Kategori",
        "Top Item Berdasarkan Nilai Stok",
        "Quality Flags Master Stok"
      ],
      "qualityFocus": ["ItemStokNol", "ItemTanpaKategori", "ItemTanpaIssueValid", "ItemUpdateLebih12Bulan"],
      "reportId": "INV-A1",
      "reportCode": "INV-A1",
      "reportStatus": "live"
    }
  }
}
```

### 4.3 Inventory Report Response (Error)

```typescript
{
  "success": false,
  "report": "stok-gudang",
  "error": "Report 'stok-gudang' tidak ditemukan",
  "metadata": {
    "source": "estate",
    "sourceLabel": "Estate / Kebun",
    "sourceServer": "SERVER_PROFILE_2",
    "sourceDatabase": "db_ptrj",
    "dataSource": "Estate Inventory DB (Live)",
    "period": "Mei 2026",
    "generatedAt": "2026-05-18T10:30:00.000Z"
  }
}
```

### 4.4 CSV Response

```http
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="stok-gudang.csv"

KodeBarang,NamaBarang,Gudang,Satuan,StokAkhir,AverageCost,NilaiStok,Kategori,TerakhirUpdate
"ITEM001","Solar Dex","A","L",5000.00,15000.00,75000000.00,"CA2111","2026-05-15"
```

### 4.5 System Status Response

```typescript
{
  "success": true,
  "gatewayOnline": true,
  "activeSource": "estate",
  "activeServer": "SERVER_PROFILE_2",
  "activeDatabase": "db_ptrj",
  "activeConnected": true,
  "activeHealthy": true,
  "sources": [
    {
      "source": "estate",
      "label": "Estate / Kebun",
      "server": "SERVER_PROFILE_2",
      "database": "db_ptrj",
      "connected": true,
      "healthy": true
    },
    {
      "source": "pabrik",
      "label": "Pabrik",
      "server": "SERVER_PROFILE_3",
      "database": "db_ptrj_mill",
      "connected": true,
      "healthy": true
    }
  ],
  "servers": [
    {
      "name": "SERVER_PROFILE_2",
      "host": "103.127.66.32",
      "port": 1888,
      "defaultDatabase": "db_ptrj",
      "connected": true,
      "healthy": true
    }
  ],
  "checkedAt": "2026-05-18T10:30:00.000Z"
}
```

### 4.6 AI Insight Request

```typescript
{
  "title": "Stok Gudang Summary",
  "context": {
    "moduleId": "inventory",
    "moduleName": "Inventory Module",
    "reportName": "stok-gudang",
    "reportDescription": "Posisi Stok & Nilai Gudang",
    "dataSource": "estate",
    "summary": {
      "TotalItem": 7483,
      "NilaiPersediaan": 6750000000.00
    },
    "metadata": {
      "source": "estate"
    },
    "sampleRows": [
      { "KodeBarang": "ITEM001", "NamaBarang": "Solar Dex", "NilaiStok": 75000000.00 }
    ]
  },
  "fallbackInsight": {
    "summary": "Total nilai persediaan estates adalah Rp 6,75 Miliar.",
    "recommendation": "Review top 10 item bernilai untuk optimasi stok."
  }
}
```

### 4.7 AI Insight Response

```typescript
{
  "success": true,
  "provider": "local-llm",
  "model": "minimax-m2.5",
  "insight": {
    "summary": "Total nilai persediaan estates adalah Rp 6,75 miliar dengan 7.483 item aktif.",
    "trendDetection": "Nilai persediaan menurun 5% dari bulan lalu.",
    "anomalyDetection": "157 item memiliki stok nol namun memiliki nilai average cost.",
    "recommendation": "Lakukan stock opname untuk item dengan FlagStokNol=1 dan nilai > Rp 100 juta.",
    "dataQualityNote": "Quality flags menunjukkan 89 item tanpa kategori dan 1.249 item stok nol."
  }
}
```

### 4.8 Auth Login Request

```typescript
// POST /api/auth/login
// Content-Type: application/json

{
  "email": "user@company.com",
  "password": "encrypted_password"
}
```

### 4.9 Auth Login Response

```typescript
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "USR001",
      "name": "John Doe",
      "email": "user@company.com",
      "role": "user",
      "division": "Estate"
    }
  }
}
```

---

## 5. SQL TABLES REFERENCE

### 5.1 Inventory Tables (IN_*)

| Table | Rows | Primary Key | Purpose |
|-------|------|-------------|---------|
| `IN_ITEM` | 7,483 | ItemCode, LocCode | Master stok aktif per item dan lokasi |
| `IN_ITEMCODE` | 7,179 | ItemCode | Master item global tanpa lokasi |
| `IN_STOCKISSUE` | 72,244 | StockIssueID, LocCode | Header pengeluaran barang |
| `IN_STOCKISSUELN` | 119,603 | StockIssueLNID, StockIssueID | Detail pengeluaran barang |
| `IN_STOCKRECEIVE` | 4,612 | StockReceiveID, LocCode | Header penerimaan barang |
| `IN_STOCKRECEIVELN` | 9,669 | StockReceiveLNID, StockReceiveID | Detail penerimaan barang |
| `IN_STOCKTRANSFER` | 3,096 | StockTransferID, LocCode | Header transfer stok antar lokasi |
| `IN_STOCKTRANSFERLN` | 6,644 | StockTransferID, ItemCode, Qty | Detail transfer stok |
| `IN_STOCKADJ` | 345 | StockAdjID, LocCode | Header adjustment/opname |
| `IN_STOCKADJLN` | 1,001 | StockAdjLNID, StockAdjID | Detail adjustment |
| `IN_STOCKRTN` | 302 | StockRtnID, LocCode | Header return barang |
| `IN_STOCKRTNLN` | 421 | StockRtnLnID, StockRtnID | Detail return barang |
| `IN_FUELISSUE` | 76,706 | FuelIssueID, LocCode | Header pengeluaran fuel/BBM |
| `IN_FUELISSUELN` | 93,450 | FuelIssueLNID, FuelIssueID | Detail pengeluaran fuel |
| `IN_PR` | 11,616 | PRID, LocCode | Header purchase request |
| `IN_PRLN` | 43,774 | PRID, ItemCode, PRLnID | Detail purchase request |
| `IN_MTHENDTRX` | 105,512 | (none) | Histori transaksi inventory bulanan |
| `IN_MTHENDITEM` | 103,742 | ItemCode, LocCode, AccMonth, AccYear | Snapshot saldo item per bulan |
| `IN_PRODCAT` | 6 | ProdCatCode | Master kategori produk |
| `IN_PRODTYPE` | 44 | ProdTypeCode | Master tipe produk |

### 5.2 Purchasing Tables (PU_*)

| Table | Rows | Primary Key | Purpose |
|-------|------|-------------|---------|
| `PU_PO` | varies | POID | Header purchase order |
| `PU_POLN` | varies | POID, ItemCode | Detail purchase order |
| `PU_SUPPLIER` | varies | SupplierCode | Master supplier |
| `PU_GOODSRCV` | varies | GoodsRcvID | Header goods received |
| `PU_GOODSRCVLN` | varies | GoodsRcvLNID, GoodsRcvID | Detail goods received |

### 5.3 Accounting Tables (AP_*, GL_*)

| Table | Rows | Primary Key | Purpose |
|-------|------|-------------|---------|
| `AP_INVOICERCV` | varies | InvoiceRcvID | AP invoice received |
| `GL_VEHICLE` | varies | VehCode | Master kendaraan |
| `GL_VEHUSAGE` | varies | VehUsageID | Header vehicle usage |
| `GL_VEHUSAGELN` | varies | VehUsageLNID, VehUsageID | Detail vehicle usage |

### 5.4 Workshop Tables (WS_*)

| Table | Rows | Primary Key | Purpose |
|-------|------|-------------|---------|
| `WS_JOB` | varies | JobID | Header workshop job |
| `WS_JOBSTOCK` | varies | JobStockID | Detail workshop stock usage |

### 5.5 Budget Tables (BD_*)

| Table | Rows | Primary Key | Purpose |
|-------|------|-------------|---------|
| `BD_VEHICLERUNNING` | varies | VehCode | Vehicle running budget |

### 5.6 Core Columns Reference

| Domain | Key Columns |
|--------|-------------|
| Item | ItemCode, LocCode, Description, ProdCatCode, ProdTypeCode, UOMCode, Status |
| Stock | QtyOnHand, QtyOnHold, QtyOnOrder, ReOrderLevel, AverageCost, LatestCost |
| Period | AccMonth, AccYear, PostDate, DocDate, UpdateDate |
| Document | StockIssueID, StockReceiveID, StockAdjID, StockTransferID, StockRtnID, FuelIssueID, PRID |
| Cost Allocation | AccCode, BlkCode, VehCode, VehExpCode, ChargeLocCode, PsEmpCode |
| Purchasing | PRID, PRLnID, QtyReq, QtyRcv, QtyOutstanding, BillToHQ, AGCode |

---

## 6. DATABASE SOURCES

### 6.1 Available Sources

| Source | Server | Database | Label |
|--------|--------|----------|-------|
| `estate` | SERVER_PROFILE_2 | db_ptrj | Estate / Kebun |
| `pabrik` / `mill` / `factory` | SERVER_PROFILE_3 | db_ptrj_mill | Pabrik |

### 6.2 SQL Gateway Configuration

```
Base URL   : http://localhost:8001 (or configurable via SQL_GATEWAY_URL)
API Key   : 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6
Timeout   : 30 seconds
Max Rows  : 5000
Databases : db_ptrj, db_ptrj_mill
```

### 6.3 Environment Variables

| Variable | Description |
|----------|-------------|
| `SQL_GATEWAY_URL` | SQL Gateway base URL |
| `SQL_GATEWAY_API_KEY` | API key for SQL Gateway |
| `DATABASE_NAME` | Override default database |
| `LOCAL_LLM_BASE_URL` | Local LLM endpoint |
| `LOCAL_LLM_MODEL` | Model name |
| `LOCAL_LLM_API_KEY` | API key for LLM |

---

## 7. ERROR HANDLING

### 7.1 HTTP Status Codes

| Status | Meaning |
|--------|--------|
| 200 | Success |
| 400 | Bad Request (invalid parameters) |
| 401 | Unauthorized (invalid/missing JWT) |
| 404 | Not Found (report not found) |
| 409 | Conflict (report on hold) |
| 502 | Bad Gateway (SQL Gateway error) |
| 503 | Service Unavailable (e.g., missing API key) |

### 7.2 Common Errors

| Error Message | Cause |
|---------------|-------|
| `Report 'xxx' tidak ditemukan` | Invalid report parameter |
| `Report 'xxx' masih hold` | Report is disabled/under development |
| `Query non-read diblokir oleh validator report` | Non-SELECT SQL detected |
| `SQL Gateway HTTP 500` | Database query failed |
| `LOCAL_LLM_API_KEY belum dikonfigurasi` | Missing LLM API key |
| `Gagal memuat laporan inventory` | General query failure |

---

## RELATED DOCUMENTATION

| File | Description |
|------|-------------|
| [00-CODEBASE-OUTLINE.md](./00-CODEBASE-OUTLINE.md) | Complete codebase reference |
| [logic-flows/02-API-LOGIC.md](../logic-flows/02-API-LOGIC.md) | API logic flows |
| [inventory-in-database/TABLE-CATALOG.md](../inventory-in-database/TABLE-CATALOG.md) | SQL table catalog |

---

**END OF API DETAILS**