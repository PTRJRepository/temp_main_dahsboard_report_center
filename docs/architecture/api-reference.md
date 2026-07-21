# API Reference

## Authentication API

### POST `/api/auth/login`
**Purpose**: User login  
**Auth**: None  
**Handler**: `app/api/auth/login/route.ts`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | User email |
| password | string | Yes | User password |

**Response** (200):
```json
{
  "success": true,
  "user": { "id": 1, "email": "user@example.com", "name": "John Doe" },
  "token": "eyJhbGciOiJSUzI1NiJ9..."
}
```
**Cookie**: Sets `auth-token` HTTP cookie (8 hours)

---

### POST `/api/auth/logout`
**Purpose**: User logout  
**Auth**: None (uses existing cookie)  
**Handler**: `app/api/auth/logout/route.ts`

**Response** (200):
```json
{ "success": true }
```
**Action**: Clears `auth-token` cookie

---

### POST `/api/auth/verify`
**Purpose**: Verify JWT token validity  
**Auth**: Token in cookie or header  
**Handler**: `app/api/auth/verify/route.ts`

**Response** (200):
```json
{
  "valid": true,
  "user": { "id": 1, "email": "user@example.com" }
}
```

---

### GET `/api/auth/public-key`
**Purpose**: Get RSA public key for client-side JWT verification  
**Auth**: None  
**Handler**: `app/api/auth/public-key/route.ts`

**Response** (200):
```json
{
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgk..."
}
```

---

## iFESS Control API

### GET `/api/ifess/health`
**Purpose**: Health check  
**Auth**: None  
**Handler**: `server_bun.js` inline

**Response** (200):
```json
{
  "status": "ok",
  "timestamp": "2026-07-18T10:30:00.000Z"
}
```

---

### GET `/api/ifess/server-info`
**Purpose**: Get server configuration for iFESS clients  
**Auth**: None  
**Handler**: `server_bun.js` inline

**Response** (200):
```json
{
  "serverUrl": "http://localhost:3001",
  "version": "1.0.0",
  "timestamp": "2026-07-18T10:30:00.000Z"
}
```

---

### GET `/api/ifess/clients`
**Purpose**: List registered clients  
**Auth**: `X-API-Key` header  
**Handler**: `server_bun.js` → `Services/ifess-control-server/routes.js`

**Response** (200):
```json
{
  "success": true,
  "clients": [
    {
      "id": "client-001",
      "name": "Workstation 1",
      "status": "online",
      "lastHeartbeat": "2026-07-18T10:25:00.000Z"
    }
  ]
}
```

---

### POST `/api/ifess/clients/register`
**Purpose**: Register new iFESS client  
**Auth**: `X-API-Key` header  
**Handler**: `server_bun.js` inline

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| clientId | string | Yes | Unique client ID |
| clientName | string | Yes | Display name |
| os | string | Yes | Operating system |
| version | string | Yes | App version |

**Response** (200):
```json
{
  "success": true,
  "clientId": "client-001"
}
```

---

### POST `/api/ifess/clients/:id/heartbeat`
**Purpose**: Client heartbeat (keep-alive)  
**Auth**: `X-API-Key` header  
**Handler**: `server_bun.js` inline

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | Yes | Client status |
| activeModule | string | No | Current module |

**Response** (200):
```json
{
  "success": true,
  "serverTime": "2026-07-18T10:30:00.000Z"
}
```

---

### GET `/api/ifess/commands`
**Purpose**: Get pending commands for client  
**Auth**: `X-API-Key` header  
**Handler**: `server_bun.js` inline

**Response** (200):
```json
{
  "commands": [
    {
      "id": "cmd-001",
      "type": "SYNC_DATA",
      "params": { "module": "attendance" }
    }
  ]
}
```

---

## Query Gateway API

### POST `/api/query-gateway/exec-sync`
**Purpose**: Execute Firebird SQL query synchronously  
**Auth**: `X-API-Key` header or proxy auth  
**Handler**: `server_bun.js` inline

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| queryText | string | Yes | SQL query |
| maxRows | number | No | Max rows (default 100) |

**Response** (200):
```json
{
  "headers": ["ID", "NAME", "VALUE"],
  "rows": [["1", "John", "100"]],
  "rowCount": 1,
  "executionTime": 125
}
```

---

### GET `/api/query-gateway/templates`
**Purpose**: List query templates  
**Auth**: None  
**Handler**: `server_bun.js` inline

**Response** (200):
```json
{
  "templates": [
    {
      "templateCode": "ATTENDANCE_MONTHLY",
      "templateName": "Monthly Attendance Report",
      "queryText": "SELECT ...",
      "tags": ["attendance", "monthly"]
    }
  ]
}
```

---

### GET `/api/query-gateway/explore/:tableName`
**Purpose**: Get table schema  
**Auth**: None  
**Handler**: `server_bun.js` inline

**Response** (200):
```json
{
  "tableName": "GWSCANNERDATA01",
  "columns": [
    { "name": "TRANSDATE", "type": "DATE" },
    { "name": "WORKEREMPID", "type": "INTEGER" }
  ]
}
```

---

## Report API

### GET `/api/reports/inventory`
**Purpose**: Get inventory reports list  
**Auth**: JWT required  
**Handler**: `app/api/reports/inventory/route.ts`

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| source | string | pabrik | Data source (pabrik/estate) |
| module | string | all | Module filter |
| search | string | - | Search term |

**Response** (200):
```json
{
  "reports": [...],
  "total": 25,
  "module": "procurement"
}
```

---

### GET `/api/reports/[reportCode]`
**Purpose**: Get report data  
**Auth**: JWT required  
**Handler**: `app/api/reports/[reportCode]/route.ts`

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | number | 500 | Max rows |
| search | string | - | Search filter |
| filters | JSON | - | Filter objects |
| source | string | pabrik | Data source |

**Response** (200):
```json
{
  "data": [...],
  "meta": {
    "totalRows": 1500,
    "returnedRows": 500,
    "executionTime": 234
  }
}
```

---

### POST `/api/reports/[reportCode]/ai-analysis`
**Purpose**: AI-powered report analysis  
**Auth**: JWT required  
**Handler**: `app/api/reports/[reportCode]/ai-analysis/route.ts`

**Response** (200):
```json
{
  "insights": [
    {
      "type": "anomaly",
      "message": "Stock levels dropped 40% this month",
      "severity": "warning"
    }
  ]
}
```

---

### GET `/api/reports/ai-insight`
**Purpose**: Global AI insights across reports  
**Auth**: JWT required  
**Handler**: `app/api/reports/ai-insight/route.ts`

**Response** (200):
```json
{
  "insights": [...],
  "generatedAt": "2026-07-18T10:30:00.000Z"
}
```

---

### GET `/api/reports/system-status`
**Purpose**: Get system health status  
**Auth**: JWT required  
**Handler**: `app/api/reports/system-status/route.ts`

**Response** (200):
```json
{
  "status": "healthy",
  "services": {
    "mssql": "connected",
    "firebird": "connected"
  },
  "uptime": 86400
}
```

---

## Services API

### GET `/api/services`
**Purpose**: List available backend services  
**Auth**: JWT required  
**Handler**: `app/api/services/route.ts`

**Response** (200):
```json
{
  "services": [
    {
      "id": "upah",
      "name": "Payroll System",
      "status": "online",
      "url": "http://localhost:8002"
    }
  ]
}
```

---

## Error Codes

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 400 | Bad Request | Missing required parameters |
| 401 | Unauthorized | Invalid/expired JWT or API key |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Database or internal error |
| 503 | Service Unavailable | Upstream service down |

---

**Evidence**: `Dashboard_Utama/app/api/auth/login/route.ts`, `server_bun.js:700-900`
