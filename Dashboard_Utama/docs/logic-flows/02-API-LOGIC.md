# API Logic & Endpoints Documentation

## 1. Inventory Reports API

### Endpoint
```
GET /api/reports/inventory
```

### Query Parameters
| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| report | No | stok-gudang | Report type |
| source | No | (inferred) | estate/pabrik |
| format | No | json | json or csv |
| search | No | (empty) | Text search |
| stale | No | lebih-1-tahun | Staleness filter |
| limit | No | 50 | Rows (5-500) |
| offset | No | 0 | Pagination offset |

### Report Types (report=)
| Value | Function | Description |
|-------|----------|-------------|
| stok-gudang | stockSummary | Stok per Gudang |
| kartu-stok | stockCard | Kualitas Master |
| mutasi-barang | stockMovement | Mutasi Masuk/Keluar |
| penerimaan-barang | stockReceive | Penerimaan Barang |
| pengeluaran-barang | stockIssue | Pengeluaran |
| purchase-request-inventory | purchaseRequestInventory | PR Inventory |
| transfer-antar-gudang | transferWarehouse | Transfer |
| stock-opname | stockOpname | Stock Opname |
| fuel-usage | fuelUsage | Fuel Usage |
| reorder-level | reorderLevel | Reorder Level |
| riwayat-transaksi | transactionHistory | Riwayat |
| return-barang | stockReturn | Return |
| item-stale-update | itemUpdateAge | Aging Master |
| purchase-order-history | purchaseOrderHistory | PO History |
| supplier-purchasing-performance | supplierPerformance | Supplier |
| pupuk-stock-procurement | fertilizerInventoryProcurement | Pupuk |
| vehicle-running-workshop | vehicleRunningWorkshop | Vehicle |

### Response Shape
```typescript
// Success
{
  "success": true,
  "report": "INV-A1",
  "source": "estate",
  "rows": [...],
  "columns": [...],
  "summary": {
    "totalItems": 120,
    "totalQty": 45000,
    "totalValue": 125000000
  }
}

// Error
{
  "success": false,
  "error": "Invalid report type"
}
```

### SQL Tables Used
- IN_ITEM - Master items
- IN_STOCKISSUELN / IN_STOCKISSUE - Issues
- IN_STOCKRECEIVELN / IN_STOCKRECEIVE - Receipts
- IN_STOCKTRANSFERLN / IN_STOCKTRANSFER - Transfers
- IN_STOCKADJLN / IN_STOCKADJ - Adjustments
- IN_FUELISSUELN / IN_FUELISSUE - Fuel
- IN_PRLN / IN_PR - Purchase requests
- IN_MTHENDTRX - Monthly history
- IN_STOCKRTLN / IN_STOCKRTN - Returns
- PU_PO / PU_POLN / PU_SUPPLIER - Purchase orders
- PU_GOODSRCV / PU_GOODSRCVLN - Goods received
- AP_INVOICERCV - AP invoices
- GL_VEHICLE / GL_VEHUSAGE - Vehicle
- WS_JOB / WS_JOBSTOCK - Workshop

### Database Sources
- Estate: db_ptrj (SERVER_PROFILE_2)
- Pabrik/Mill: db_ptrj_mill (SERVER_PROFILE_3)

---

## 2. System Status API

### Endpoint
```
GET /api/reports/system-status?source=estate
```

### Response
```typescript
{
  "success": true,
  "database": "online",
  "integration": "connected",
  "lastSync": "2026-05-18T08:45:00Z",
  "source": "estate",
  "server": "103.127.66.32:1888"
}
```

---

## 3. AI Insight API

### Endpoint
```
GET /api/reports/ai-insight
```

### Response
```typescript
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "reportId": "INV-A1",
        "type": "scheduled",
        "confidence": 0.92,
        "reason": "Scheduled for monthly review"
      }
    ]
  }
}
```

---

## 4. Natural Filter API

### Endpoint
```
GET /api/reports/natural-filter?query=stok%20gudang%20A%20Mei%202026
```

### Response
```typescript
{
  "success": true,
  "data": {
    "filters": {
      "location": "A",
      "month": "2026-05"
    }
  }
}
```

### Parsing Logic
```
"stok gudang A Mei 2026"
  ↓
location: "A" (from "gudang A")
month: "2026-05" (from "Mei 2026")
  ↓
SQL WHERE clause
```

---

## 5. Auth API

### POST /api/auth/login
```typescript
// Request
{ "email": "user@company.com", "password": "xxx" }

// Response
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "user": { "id", "name", "email", "role", "division" }
  }
}
```

### POST /api/auth/logout
```typescript
// Response
{ "success": true }
```

### GET /api/auth/verify
```typescript
// Response (with JWT cookie)
{
  "success": true,
  "data": { "user": {...} }
}
```

---

## 6. SQL Gateway Integration

### How It Works
```
Next.js Route Handler
  ↓
Validate query params
  ↓
Build SQL query (parameterized)
  ↓
HTTP POST to SQL Gateway
  ├─ Endpoint: http://localhost:8001/v1/query
  ├─ Header: x-api-key
  └─ Body: { query, params, database }
  ↓
SQL Gateway executes
  ↓
Return results
  ↓
Format response
  ↓
Send to client
```

### SQL Gateway Config
- Base URL: http://localhost:8001 (configurable)
- Auth: x-api-key header
- Timeout: 30 seconds
- Max rows: 5000
- Databases: db_ptrj, db_ptrj_mill
