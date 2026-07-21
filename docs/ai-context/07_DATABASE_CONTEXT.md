---
name: 07-database-context
description: Database schema and entity relationships
metadata:
  type: documentation
  tags: [database, schema, mssql, firebird]
---

# Database Context

## Database Technologies

| Database | Type | Version | Purpose | Connection |
|----------|------|---------|---------|------------|
| MSSQL | SQL Server | - | Business data | TCP/IP |
| Firebird | Embedded DB | 1.5 | Scanner data | CLI (isql) |

## MSSQL Database (extend_db_ptrj)

### Database Facts

| Property | Value |
|----------|-------|
| Host | 10.0.0.110 |
| Port | 1433 |
| Database | extend_db_ptrj |
| User | sa |

### Users Table (Implied)

```typescript
interface User {
  id: number;        // Primary key
  email: string;    // Login email
  password: string; // bcrypt hashed
  name: string;     // Display name
  role: string;     // User role
  created_at: Date;
}
```

### Report-Related Tables

| Table | Purpose | Source |
|-------|---------|--------|
| StockIn | Inbound stock | Inventory reports |
| StockOut | Outbound stock | Inventory reports |
| Stock | Current levels | Inventory reports |
| StockIssueEvent | Movements | Movement analysis |
| StockIssueEventCount | Movement counts | Categorization |

### Data Sources

| Source Param | Database | Purpose |
|--------------|----------|---------|
| `pabrik` | db_ptrj_mill | Mill operations |
| `estate` | db_ptrj | Estate operations |

## Firebird Database (PTRJ_ARC.FDB)

### Database Facts

| Property | Value |
|----------|-------|
| Location | PTRJ_ARC.FDB |
| Username | SYSDBA |
| Password | masterkey |
| Tables | 183 |
| Views | 81 |

### Scanner Tables (Partitioned)

| Table Pattern | Purpose | Partition |
|--------------|---------|-----------|
| `FFBSCANNERDATA01..12` | FFB Harvest | Monthly slots |
| `GWSCANNERDATA01..12` | Gate Watch Attendance | Monthly slots |
| `RTSCANNERDATA01..12` | Rubber Tap | Monthly slots |

**⚠️ Important**: `#MONTH#` selects partition SLOT, not calendar month.

### Scanner Data Schema

```sql
-- GWSCANNERDATA (Attendance)
TRANSDATE DATE,        -- Transaction date
WORKEREMPID INTEGER,   -- FK to EMP.ID
SCANTIME TIME          -- Scan timestamp
```

### Core Tables

| Table | Rows | Key Fields |
|-------|------|------------|
| EMP | ~5915 | ID, OCID |
| OC | - | ID, NAME |
| OCFIELD | - | ID, OCID |
| OVERTIME | ~72k | EMPID, JOBID, VEHID |
| SALARYSCALE | - | Rate data |

### Foreign Key Relationships

| Child Table | Column | Parent Table | Column |
|-------------|--------|--------------|--------|
| EMP | OCID | OC | ID |
| GWSCANNERDATA | WORKEREMPID | EMP | ID |
| FFB | SCANUSERID | EMP | ID |
| FFB | FIELDID | OCFIELD | ID |
| OVERTIME | EMPID | EMP | ID |
| OVERTIME | JOBID | JOBCODE | ID |
| OVERTIME | VEHID | VEHCODE | ID |

### Special Fields

| Table | Field | Note |
|-------|-------|------|
| OVERTIME | ESTCOST | Always 0 (rates in SALARYSCALE) |
| OVERTIME | VEHID | 0 = no vehicle (not NULL) |
| FFB | LOOSEFRUIT | Always 0, use LOOSEFRUIT2 |
| RTSCANNERDATA | - | Empty (palm estate, no rubber) |

## JSON Data Storage

### Location: `/data/ifess/`

| File | Purpose |
|------|---------|
| `clients.json` | Registered iFESS clients |
| `configs.json` | Server configuration |
| `commands.json` | Pending commands |
| `module-statuses.json` | Module states |
| `heartbeat-logs.json` | Heartbeat history |
| `query-templates.json` | SQL templates |
| `query-results.json` | Result cache |

### Query Template Schema

```typescript
interface QueryTemplate {
  templateCode: string;
  templateName: string;
  description: string;
  queryText: string;
  defaultMaxRows: number;
  defaultTimeoutSeconds: number;
  tags: string[];
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

## Movement Categories

| Category | Condition | Description |
|----------|-----------|-------------|
| Fast Moving | `count >= 6` | High activity |
| Moving | `2 <= count <= 5` | Normal activity |
| Slow Moving | `count = 1` | Low activity |
| Dead Stock | `count = 0, stock > 0` | No recent movement |
| No Movement | `count = 0, stock = 0` | Empty |

---

**Evidence**: `CLAUDE.md`, `lib/reports/config.ts`
