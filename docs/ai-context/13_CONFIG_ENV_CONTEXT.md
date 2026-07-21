---
name: 13-config-env-context
description: Environment variables and configuration
metadata:
  type: documentation
  tags: [configuration, environment]
---

# Configuration & Environment

## Environment Files

| File | Purpose | Location |
|------|---------|----------|
| `.env` | Default env vars | Root |
| `.env.production` | Production vars | Root |
| `.env.local` | Local overrides | Dashboard_Utama |
| `.env.docker` | Docker container | Dashboard_Utama |

## Core Configuration

| Variable | Default | Required | Purpose |
|----------|---------|----------|---------|
| `NODE_ENV` | development | No | Environment mode |
| `PORT` | 3001 | No | Gateway port |
| `HOST` | 0.0.0.0 | No | Bind address |
| `DASHBOARD_PORT` | 3100 | No | Next.js dev port |
| `START_DASHBOARD` | true | No | Auto-start Next.js |

## Authentication Configuration

### JWT Keys

| Variable | Default | Required | Purpose |
|----------|---------|----------|---------|
| `JWT_PRIVATE_KEY_PATH` | `./keys/private.pem` | Yes | Token signing |
| `JWT_PUBLIC_KEY_PATH` | `./keys/public.pem` | Yes | Token verification |

### Cookie Settings

| Variable | Default | Purpose |
|----------|---------|---------|
| `COOKIE_SECURE` | false | HTTPS-only cookies |
| `NEXTAUTH_URL` | http://localhost:3001 | Auth callback |

## Database Configuration

### MSSQL

| Variable | Default | Required | Purpose |
|----------|---------|----------|---------|
| `MSSQL_HOST` | 10.0.0.110 | Yes | Server IP |
| `MSSQL_PORT` | 1433 | No | Port |
| `MSSQL_DATABASE` | extend_db_ptrj | Yes | Database |
| `MSSQL_USER` | sa | Yes | Username |
| `MSSQL_PASSWORD` | - | Yes | Password |

### Connection Pool

```typescript
{
  encrypt: false,
  trustServerCertificate: true,
  connectionTimeout: 15000,
  requestTimeout: 30000,
  max: 10,  // Pool size
  min: 0
}
```

### Firebird

| Variable | Default | Purpose |
|----------|---------|---------|
| Firebird path | PTRJ_ARC.FDB | Database location |
| SYSDBA password | masterkey | Default password |

## API Keys

| Variable | Default | Purpose | Security |
|----------|---------|---------|----------|
| `IFESS_API_KEY` | ptrj-rebinmas-air-ruak-... | iFESS Control | ⚠️ Default in code |
| `QUERY_API_KEY` | ptrj-query-gateway-key | Query Gateway | ⚠️ Default in code |
| `UPATH_API_KEY` | ptrj-upath-key | Payroll API | ⚠️ Default in code |
| `IFESS_CLIENT_API_KEY` | ptrj-ifess-client-key | iFESS Client | ⚠️ Default in code |

## Service Ports

| Variable | Default | Service |
|----------|---------|---------|
| `UPAH_PORT` | 5175 | Payroll |
| `ABSEN_PORT` | 5176 | Attendance |
| `MONITORING_BERAS_PORT` | 5177 | Rice Monitor |
| `GDRIVE_PORT` | 5178 | Google Drive |

## Backend Hosts

| Variable | Default | Purpose |
|----------|---------|---------|
| `BACKEND_HOST` | localhost | Primary backend |
| `BACKEND_HOST_FALLBACK` | localhost | Fallback backend |

## Feature Flags

| Variable | Default | Purpose |
|----------|---------|---------|
| `ENABLE_AI_INSIGHTS` | true | AI report analysis |
| `ENABLE_QUERY_CACHE` | true | Query result caching |

## Configuration Patterns

### Development
```bash
NODE_ENV=development
PORT=3001
DASHBOARD_PORT=3100
START_DASHBOARD=true
```

### Production
```bash
NODE_ENV=production
PORT=3001
DASHBOARD_PORT=3100
START_DASHBOARD=true
COOKIE_SECURE=true
```

## Route Configuration

### routes-config.json

```json
{
  "id": "upah",
  "path": "/upah",
  "target": "http://localhost:8002",
  "enabled": true,
  "rewriteContent": "html-only",
  "timeoutMs": 30000,
  "cachePolicy": "static"
}
```

---

**Evidence**: `.env.production`, `routes-config.json`
