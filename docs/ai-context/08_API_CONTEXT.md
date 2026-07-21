---
name: 08-api-context
description: Complete API endpoint documentation
metadata:
  type: documentation
  tags: [api, endpoints, routes]
---

# API Context

## API Summary

| Category | Count | Base Path |
|----------|-------|-----------|
| Auth | 4 | `/api/auth/` |
| iFESS | 6 | `/api/ifess/` |
| Query | 3 | `/api/query-gateway/` |
| Reports | 5 | `/api/reports/` |
| Services | 1 | `/api/services/` |
| **Total** | **19** | |

## Auth API

### POST `/api/auth/login`
| Property | Value |
|----------|-------|
| Auth | None |
| Handler | `app/api/auth/login/route.ts` |
| Request | `{ email: string, password: string }` |
| Response | `{ success: true, user: User, token: string }` |
| Cookie | Sets `auth-token` (8 hours) |

### POST `/api/auth/logout`
| Property | Value |
|----------|-------|
| Auth | Cookie |
| Handler | `app/api/auth/logout/route.ts` |
| Response | `{ success: true }` |

### POST `/api/auth/verify`
| Property | Value |
|----------|-------|
| Auth | Cookie/Header |
| Handler | `app/api/auth/verify/route.ts` |
| Response | `{ valid: boolean, user: User }` |

### GET `/api/auth/public-key`
| Property | Value |
|----------|-------|
| Auth | None |
| Handler | `app/api/auth/public-key/route.ts` |
| Response | `{ publicKey: string }` |

## iFESS Control API

### GET `/api/ifess/health`
| Property | Value |
|----------|-------|
| Auth | None |
| Handler | `server_bun.js` inline |
| Response | `{ status: "ok", timestamp: string }` |

### GET `/api/ifess/server-info`
| Property | Value |
|----------|-------|
| Auth | None |
| Handler | `server_bun.js` inline |
| Response | `{ serverUrl: string, version: string }` |

### GET `/api/ifess/clients`
| Property | Value |
|----------|-------|
| Auth | `X-API-Key` |
| Handler | `Services/ifess-control-server/routes.js` |
| Response | `{ success: true, clients: Client[] }` |

### POST `/api/ifess/clients/register`
| Property | Value |
|----------|-------|
| Auth | `X-API-Key` |
| Handler | `server_bun.js` inline |
| Request | `{ clientId: string, clientName: string, os: string, version: string }` |
| Response | `{ success: true, clientId: string }` |

### POST `/api/ifess/clients/:id/heartbeat`
| Property | Value |
|----------|-------|
| Auth | `X-API-Key` |
| Handler | `server_bun.js` inline |
| Request | `{ status: string, activeModule?: string }` |
| Response | `{ success: true, serverTime: string }` |

### GET `/api/ifess/commands`
| Property | Value |
|----------|-------|
| Auth | `X-API-Key` |
| Handler | `server_bun.js` inline |
| Response | `{ commands: Command[] }` |

## Query Gateway API

### POST `/api/query-gateway/exec-sync`
| Property | Value |
|----------|-------|
| Auth | `X-API-Key` or Proxy |
| Handler | `server_bun.js` inline |
| Request | `{ queryText: string, maxRows?: number }` |
| Response | `{ headers: string[], rows: any[][], rowCount: number }` |

### GET `/api/query-gateway/templates`
| Property | Value |
|----------|-------|
| Auth | None |
| Handler | `server_bun.js` inline |
| Response | `{ templates: QueryTemplate[] }` |

### GET `/api/query-gateway/explore/:tableName`
| Property | Value |
|----------|-------|
| Auth | None |
| Handler | `server_bun.js` inline |
| Response | `{ tableName: string, columns: Column[] }` |

## Report API

### GET `/api/reports/inventory`
| Property | Value |
|----------|-------|
| Auth | JWT |
| Handler | `app/api/reports/inventory/route.ts` |
| Query Params | `source`, `module`, `search`, `limit` |
| Response | `{ reports: Report[], total: number }` |

### GET `/api/reports/[reportCode]`
| Property | Value |
|----------|-------|
| Auth | JWT |
| Handler | Dynamic |
| Query Params | `limit`, `search`, `filters`, `source` |
| Response | `{ data: any[], meta: Meta }` |

### POST `/api/reports/[reportCode]/ai-analysis`
| Property | Value |
|----------|-------|
| Auth | JWT |
| Handler | `app/api/reports/[reportCode]/ai-analysis/route.ts` |
| Response | `{ insights: Insight[] }` |

### GET `/api/reports/ai-insight`
| Property | Value |
|----------|-------|
| Auth | JWT |
| Handler | `app/api/reports/ai-insight/route.ts` |
| Response | `{ insights: Insight[], generatedAt: string }` |

### GET `/api/reports/system-status`
| Property | Value |
|----------|-------|
| Auth | JWT |
| Handler | `app/api/reports/system-status/route.ts` |
| Response | `{ status: string, services: object, uptime: number }` |

## Services API

### GET `/api/services`
| Property | Value |
|----------|-------|
| Auth | JWT |
| Handler | `app/api/services/route.ts` |
| Response | `{ services: Service[] }` |

## Error Codes

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 400 | Bad Request | Missing parameters |
| 401 | Unauthorized | Invalid token/key |
| 403 | Forbidden | No permission |
| 404 | Not Found | Resource missing |
| 500 | Server Error | DB/internal error |
| 503 | Service Unavailable | Upstream down |

---

**Evidence**: `app/api/` routes, `server_bun.js`
