---
name: 06-backend-context
description: Backend analysis and service architecture
metadata:
  type: documentation
  tags: [backend, server, api]
---

# Backend Context

## Backend Architecture

### Dual Gateway Pattern

| Gateway | Technology | Status | Purpose |
|---------|------------|--------|---------|
| `server_bun.js` | Bun native | **Primary** | High-performance reverse proxy |
| `server.js` | Express.js | Legacy | Deprecated |

### Gateway Responsibilities

1. **Reverse Proxy** - Route to upstream services
2. **JWT Authentication** - Verify tokens, protect routes
3. **iFESS Control API** - Client management endpoints
4. **Query Gateway** - Firebird SQL execution
5. **Static File Serving** - With LRU caching

## Entry Points

### Bun Gateway (`server_bun.js`)

```javascript
// Startup sequence
1. Load .env configuration
2. Read routes-config.json
3. Initialize LRU cache
4. Load JWT public key
5. Optionally prewarm MSSQL
6. Optionally spawn Next.js dev server
7. Start Bun.serve() on port 3001
```

### Next.js App

```bash
# Production (via server.js standalone)
node server.js  # Port 3001

# Development
npm run dev  # Port 3000
```

## Routing

### Proxy Routes (`routes-config.json`)

| Path | Target | Purpose |
|------|--------|---------|
| `/upah` | localhost:8002 | Payroll system |
| `/absen` | localhost:5176 | Attendance |
| `/monitoring-beras` | localhost:5177 | Rice monitoring |
| `/backend/upah` | localhost:8002 | Payroll API |
| `/query` | localhost:8001 | SQL Gateway |
| `/file` | localhost:5178 | Google Drive |
| `/ifess` | localhost:8003 | iFESS Client |
| `/report-center` | localhost:3001:3100 | Report UI |

### Protected Paths

```javascript
const PROTECTED_PATHS = [
  '/admin/*',
  '/dashboard/*',
  '/modules/*',
  '/report-center/*',
  '/api/services/*',
  '/api/reports/*',
  '/ifess-control/*',
  '/api/ifess/*',
  '/api/query-gateway/*',
];
```

## Middleware

### JWT Middleware

```javascript
// Token extraction from cookie
const extractToken = (cookieHeader) => {
  const match = cookieHeader.match(/(?:^|;\s*)(?:auth-token|payroll_auth_token)=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

// Verification
const verifyJWT = (token) => {
  // 1. Split into parts
  // 2. Verify RS256 signature
  // 3. Check expiration
  // 4. Return payload
};
```

### API Key Middleware

| Key | Header | Environment |
|-----|--------|-------------|
| IFESS | `X-API-Key` | `IFESS_API_KEY` |
| Query | `X-API-Key` | `QUERY_API_KEY` |
| Upah | `X-API-Key` | `UPATH_API_KEY` |

## Controllers/Handlers

### Auth Controllers

| Handler | File | Purpose |
|---------|------|---------|
| Login | `app/api/auth/login/route.ts` | Authenticate user |
| Logout | `app/api/auth/logout/route.ts` | Clear session |
| Verify | `app/api/auth/verify/route.ts` | Check token |

### Report Controllers

| Handler | File | Purpose |
|---------|------|---------|
| List | `app/api/reports/inventory/route.ts` | List reports |
| Data | Dynamic | Fetch report data |
| AI | `app/api/reports/*/ai-analysis/route.ts` | AI insights |

### iFESS Controllers

| Handler | File | Purpose |
|---------|------|---------|
| Health | Inline | Health check |
| Register | Inline | Client registration |
| Heartbeat | Inline | Keep-alive |

## Error Handling

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Success |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | No/invalid auth |
| 403 | Forbidden | No permission |
| 404 | Not Found | Resource missing |
| 500 | Server Error | Internal failure |
| 503 | Service Unavailable | Upstream down |

### Error Response Format

```typescript
{
  "error": "Error message",
  "code": "ERROR_CODE" // optional
}
```

## Performance

### Caching

| Type | TTL | Scope |
|------|-----|-------|
| LRU Static Cache | 30 min | Static assets |
| Template Cache | File mtime | Query templates |
| Route Config | On change | Proxy routes |

### Connection Pooling

| Resource | Pool | Notes |
|----------|------|-------|
| MSSQL | Yes | `mssql.ConnectionPool` |
| Firebird | No | Serial via `withIsqlLock` |

## Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `server_bun.js` | ~195KB | Main gateway |
| `services/ifess-control-server/service.js` | ~64KB | iFESS logic |
| `app/api/auth/login/route.ts` | ~70 | Auth handler |

---

**Evidence**: `server_bun.js`, `app/api/` routes
