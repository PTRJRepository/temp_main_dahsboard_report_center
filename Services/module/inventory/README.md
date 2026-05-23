# Inventory Module - SQL Gateway Integration Guide

## Overview

Module inventori mengakses database SQL Server melalui **SQL Gateway** (`http://localhost:8001`) yang mendukung multi-server profiles.

---

## SQL Gateway Servers

| Profile | Host | Port | Database | Access |
|---|---|---|---|---|
| `SERVER_PROFILE_1` | 10.0.0.110 | 1433 | `db_ptrj_mill` (Estate), `extend_db_ptrj`, `db_ptrj_mill`, `VenusHR14`, dll | **Read/Write** |
| `SERVER_PROFILE_2` | 10.0.0.2 | 1888 | ? | **Read-Only** |
| `SERVER_PROFILE_3` | 103.127.66.32 | 1888 | `db_ptrj_mill` (Mill/Pabrik), `VenusHR14` | **Read-Only** |

> **Default:** `SERVER_PROFILE_3` (Mill/Pabrik). Untuk Estate gunakan parameter `server: "SERVER_PROFILE_1"`.

---

## Koneksi

| Property | Value |
|---|---|
| Base URL | `http://localhost:8001` |
| API Token | `2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6` |
| Auth Header | `x-api-key: <token>` |

---

## Server Profiles

### Cek Semua Profiles
```http
GET /v1/servers
```
Response:
```json
{
  "success": true,
  "data": {
    "servers": [
      {"name": "SERVER_PROFILE_1", "host": "10.0.0.110", "port": 1433, "readOnly": false, "connected": true},
      {"name": "SERVER_PROFILE_2", "host": "10.0.0.2",   "port": 1888, "readOnly": true,  "connected": true},
      {"name": "SERVER_PROFILE_3", "host": "103.127.66.32", "port": 1888, "readOnly": true, "connected": true}
    ],
    "defaultServer": "SERVER_PROFILE_3"
  }
}
```

### List Databases per Server
```http
GET /v1/databases?server=SERVER_PROFILE_1
```
Tanpa parameter `server` → default ke `SERVER_PROFILE_3`.

---

## Endpoint: Execute Query

```http
POST /v1/query
Content-Type: application/json
x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6

{
  "sql": "SELECT TOP 10 * FROM IN_ITEM",
  "server": "SERVER_PROFILE_1",
  "database": "db_ptrj_mill"
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `sql` | ✅ | - | SQL query |
| `server` | ❌ | `SERVER_PROFILE_3` | Target server profile |
| `database` | ❌ | server default | Target database |
| `params` | ❌ | `{}` | Prepared statement params |

---

## Database Availability by Server

### SERVER_PROFILE_1 (10.0.0.110 — Estate, Read/Write)
```
db_ptrj_backup, db_ptrj_mill, extend_db_ptrj, staging_PTRJ_iFES_Plantware_backup,
VenusHR14_ptrj_backup, vector_db
```
> `db_ptrj` (Estate main DB) → **OFFLINE**, gunakan `db_ptrj_mill` atau `extend_db_ptrj`

### SERVER_PROFILE_3 (103.127.66.32 — Mill/Pabrik, Read-Only)
```
db_ptrj_mill, db_ptrj_mill_test, VenusHR14
```

---

## IN_* Tables — SERVER_PROFILE_1 (Estate db_ptrj_mill)

**69 IN_* base tables**, 11,571 rows di IN_ITEM.

### Product Classification (Lookup)
| Table | Rows | Description |
|---|---|---|
| IN_PRODTYPE | 52 | Product type |
| IN_PRODCAT | 9 | Product category |
| IN_PRODMAT | 25 | Product material |
| IN_PRODBRAND | 9 | Product brand |
| IN_PRODMODEL | 5 | Product model |
| IN_STOCKANALYSIS | 4 | Stock analysis code |

### Item Master
| Table | Rows | Description |
|---|---|---|
| IN_ITEMCODE | 11,654 | Item master catalog |
| IN_ITEM | 11,571 | Per-location inventory snapshot |

### Stock Movement
| Table | Rows | Description |
|---|---|---|
| IN_STOCKISSUE / IN_STOCKISSUELN | 15,514 / 30,637 | Stock issuance |
| IN_STOCKRECEIVE / IN_STOCKRECEIVELN | 0 | Stock receiving (empty) |
| IN_STOCKRTN / IN_STOCKRTNLN | 31 / 32 | Stock return |
| IN_STOCKADJ / IN_STOCKADJLN | 34 / 134 | Stock adjustment |
| IN_STOCKTRANSFER / IN_STOCKTRANSFERLN | 0 | Stock transfer (empty) |

### Fuel
| Table | Rows | Description |
|---|---|---|
| IN_FUELISSUE / IN_FUELISSUELN | 7,067 / 8,293 | Fuel issue |
| IN_FUELRTN / IN_FUELRTNLN | 27 / 34 | Fuel return |

### Purchase Requisition
| Table | Rows | Description |
|---|---|---|
| IN_PR / IN_PRLN | 9,700 / 29,592 | PR header + lines |
| IN_PRLN_ACC | 30,309 | Audit trail |

### Month-End
| Table | Rows | Description |
|---|---|---|
| IN_MTHENDITEM | 626,553 | Monthly inventory snapshot |
| IN_MTHENDTRX | 77,522 | Monthly transaction log |

---

## Quick Examples

### List all IN_* tables (Estate)
```bash
curl -s -X POST http://localhost:8001/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6" \
  -d '{"sql":"SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '\''IN[_]%'\'' AND TABLE_TYPE = '\''BASE TABLE'\'' ORDER BY TABLE_NAME","server":"SERVER_PROFILE_1","database":"db_ptrj_mill"}'
```

### Get IN_ITEM schema (Estate)
```bash
curl -s -X POST http://localhost:8001/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6" \
  -d '{"sql":"SELECT c.COLUMN_NAME, c.DATA_TYPE, c.CHARACTER_MAXIMUM_LENGTH, c.IS_NULLABLE, c.ORDINAL_POSITION FROM INFORMATION_SCHEMA.COLUMNS c WHERE c.TABLE_NAME = '\''IN_ITEM'\'' ORDER BY c.ORDINAL_POSITION","server":"SERVER_PROFILE_1","database":"db_ptrj_mill"}'
```

### Get low stock items (Estate)
```bash
curl -s -X POST http://localhost:8001/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6" \
  -d '{"sql":"SELECT TOP 20 RTRIM(ItemCode), RTRIM(Description), QtyOnHand, ReOrderLevel, AverageCost FROM [db_ptrj_mill].[dbo].[IN_ITEM] WHERE QtyOnHand < ReOrderLevel AND Status = '\''1 '\'' ORDER BY QtyOnHand ASC","server":"SERVER_PROFILE_1","database":"db_ptrj_mill"}'
```

### Get row counts all IN_* tables (Estate)
```bash
curl -s -X POST http://localhost:8001/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6" \
  -d '{"sql":"SELECT t.NAME AS TableName, p.rows AS RowCounts FROM sys.tables t INNER JOIN sys.partitions p ON t.object_id = p.object_id WHERE t.name LIKE '\''IN[_]%'\'' AND p.index_id IN (0, 1) ORDER BY t.name","server":"SERVER_PROFILE_1","database":"db_ptrj_mill"}'
```

---

## Gateway Server Process

- **Binary:** `bun` (Bun runtime)
- **Command:** `bun run dist/index.js`
- **Config:** Reads `DATABASE_PROFILES_*` from environment
- **PID:** 19468
- **Port:** 8001 (SQL Gateway), 3001 (Main Dashboard proxy)