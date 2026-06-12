# Database Schema - Deep Dive

> **Lokasi File:** `D:/Gawean Rebinmas/Main Dashboard/docs/08-database-schema/README.md`
> **Last Updated:** 2026-06-10
> **Scope:** All database schemas, table definitions, column details, relationships

---

## Overview

Project Main Dashboard menggunakan **3 sumber database berbeda**:

1. **SQL Server (db_ptrj)** — Production reports (PR tables)
2. **SQL Server (db_ptrj_mill)** — Inventory module
3. **Python TCP Forwarder** — Bridge ke SQL Server dari Node.js

---

## Database 1: Production Reports (PR Tables)

**Source:** `pr_tables_deepdive.json` (generated 2026-05-16)

### Server Profiles
- `SERVER_PROFILE_1` — Estate reports
- `SERVER_PROFILE_3` — Mill reports

### Estate Tables

| Table | Columns | Description |
|-------|---------|-------------|
| **IN_PR** | ~15 | Production Report header |
| **IN_PRLN** | ~20 | Production Report Line items |
| **IN_PRLN_ACC** | ~10 | Production Report Line Accounting |

### Mill Tables

| Table | Columns | Description |
|-------|---------|-------------|
| **IN_PR** | ~15 | Production Report header |
| **IN_PRLN** | ~20 | Production Report Line items |
| **IN_PRLN_ACC** | ~10 | Production Report Line Accounting |

### Key Columns (IN_PR)
- `PRID` (char, NOT NULL) — Primary key
- `PRDATE` — Report date
- `ESTATE` — Estate identifier
- `MILL` — Mill identifier
- `PERIOD` — Reporting period

### Key Columns (IN_PRLN)
- `PRID` (char, NOT NULL) — FK to IN_PR
- `LINENUM` — Line number
- `ACCOUNT` — Account code
- `DESCRIPTION` — Line description
- `AMOUNT` — Transaction amount

### Key Columns (IN_PRLN_ACC)
- `ID` (bigint, NOT NULL) — Primary key
- `PRID` — FK to IN_PR
- `LINENUM` — FK to IN_PRLN
- `ACCOUNT_CODE` — Accounting code
- `DEBIT`, `CREDIT` — Amount fields

---

## Database 2: Inventory Module (db_ptrj_mill)

**Source:** `Services/module/inventory/`

### Main Tables

| Table | Description |
|-------|-------------|
| **IN_ITEM** | Master item/inventory data |
| See `tables.json` | Full list of inventory tables |

### IN_ITEM Schema
**File:** `Services/module/inventory/schema/IN_ITEM.json`

```json
{
  "columns": [
    {"name": "ITEMCODE", "type": "varchar", "pk": true},
    {"name": "ITEMNAME", "type": "nvarchar"},
    {"name": "UNIT", "type": "varchar"},
    {"name": "CATEGORY", "type": "varchar"},
    ...
  ]
}
```

### Foreign Keys
**File:** `Services/module/inventory/queries/foreign_keys.sql`

Key relationships:
- `IN_ITEM.CATEGORY` → `IN_CATEGORY`
- `IN_ITEM.UNIT` → `IN_UNIT`
- `IN_PRLN.PRID` → `IN_PR.PRID`
- `IN_PRLN_ACC.PRID` → `IN_PR.PRID`
- `IN_PRLN_ACC.LINENUM` → `IN_PRLN.LINENUM`

---

## Database 3: Access SQL Server from Node.js

**Source:** `Services/access_sql_server_from_3001/`

### Python Client Architecture

```
Node.js (port 3001)
    ↓ (internal HTTP)
Python TCP Forwarder
    ↓ (TCP)
SQL Server (db_ptrj)
```

### Connection Details
- **Host:** From `.env.production`
- **Port:** 1433 (default SQL Server)
- **Driver:** Python `pyodbc` or `pymssql`
- **Auth:** SQL Server authentication

### Files
- `sql_server_client.py` — Main client
- `tcp_port_forwarder.py` — TCP port forwarding
- `requirements.txt` — Dependencies

---

## SQL Query Files

### Inventory Queries
**Location:** `Services/module/inventory/queries/`

| File | Purpose |
|------|---------|
| `list_in_tables.sql` | List all tables in db_ptrj_mill |
| `in_item_schema.sql` | Full IN_ITEM table schema |
| `in_item_sample.sql` | Sample data from IN_ITEM |
| `foreign_keys.sql` | Foreign key relationships |
| `row_counts.sql` | Row counts per table |

---

## Related Documentation

- **Inventory Module:** `docs/04-services-inventory/README.md`
- **SQLServer Access:** `docs/05-services-sqlserver/README.md`
- **Query API:** `docs/03-services-query/README.md`

---

*Document ini bagian dari dokumentasi project Main Dashboard PT Rebinmas Jaya*
