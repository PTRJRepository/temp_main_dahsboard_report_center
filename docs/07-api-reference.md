# 07 — API Reference

**Last verified:** 2026-07-21  
**Source:** filesystem inventory of `Dashboard_Utama/app/api/**/route.ts` plus gateway endpoints documented in `CLAUDE.md` / `docs/ai-context/08_API_CONTEXT.md`.  
**No OpenAPI file found** — this inventory is code-based, not generated.

## Auth (Next.js)

| Method | Path | Purpose | Auth | Source |
|---|---|---|---|---|
| POST | `/api/auth/login` | Credential login, set cookies | public | `app/api/auth/login/route.ts` |
| POST | `/api/auth/logout` | Clear cookies | session | `app/api/auth/logout/route.ts` |
| POST | `/api/auth/verify` | Verify token | token | `app/api/auth/verify/route.ts` |
| GET | `/api/auth/public-key` | JWT public key | public | `app/api/auth/public-key/route.ts` |
| * | `/api/auth/[...nextauth]` | NextAuth handlers | NextAuth | `app/api/auth/[...nextauth]/route.ts` |

### Login body (implemented)

JSON `{ email, password }` (login form sends username in `email` field).

### Cookies

- `auth-token`
- `payroll_auth_token` (legacy compatibility)

## Reports

| Method | Path | Purpose | Auth | Source |
|---|---|---|---|---|
| GET | `/api/reports/inventory` | Inventory report handlers + SQL gateway query | **No full-route auth** (ADMIN only for `debugSql`) | `app/api/reports/inventory/route.ts` |
| GET | `/api/reports/monthly-stock-account-movement-details-json` | Nested monthly stock JSON | **No explicit auth in route** | `.../monthly-stock-account-movement-details-json/route.ts` |
| POST | `/api/reports/ai-insight` | Insight from provided payload | **No explicit auth in route** | `app/api/reports/ai-insight/route.ts` |
| POST | `/api/reports/[reportCode]/ai-analysis` | AI dashboard definition | **No explicit auth in route** | `app/api/reports/[reportCode]/ai-analysis/route.ts` |
| POST | `/api/reports/natural-filter` | NL → filter JSON | **No explicit auth**; NL read-only validation | `app/api/reports/natural-filter/route.ts` |
| GET | `/api/reports/system-status` | SQL gateway status | **No explicit auth in route** | `app/api/reports/system-status/route.ts` |

### Inventory query params (common)

| Param | Meaning |
|---|---|
| `report` / handler id | Which inventory report |
| `source` | `estate` \| `pabrik` |
| `limit` | Row window (clamped; monthly JSON max 20000, fallback 500) |
| `period`, `movementWindow`, `groupBy`, `stale`, semantic filters | Via `filtersFromSearchParams` |

Read-only enforcement: SQL must start with `SELECT`/`WITH`; write verbs blocked (`report-filtering.ts`).

## IFESS / services (Next proxy)

| Method | Path | Purpose | Source |
|---|---|---|---|
| * | `/api/ifess` | Proxy to gateway IFESS | `app/api/ifess/route.ts` |
| * | `/api/ifess/sync` | Sync helper | `app/api/ifess/sync/route.ts` |
| * | `/api/query-gateway` | Proxy query gateway | `app/api/query-gateway/route.ts` |
| GET | `/api/services` | User services list | `app/api/services/route.ts` |

## Gateway (Bun) IFESS & query

Bun intercepts `/api/ifess*` and `/api/query-gateway*` **before** Next proxies (when traffic enters Bun).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/ifess/health` | no | Health |
| GET | `/api/ifess/server-info` | no | Client bootstrap |
| POST | `/api/ifess` | no (action dispatcher branch) | Frontend IFESS actions |
| * | `/api/ifess/clients*`, dashboard, groups, audit… | `X-API-Key` | IFESS control plane |
| * | `/api/query-gateway/*` and `/api/ifess/query-gateway/*` | **no Bun auth seen** | Proxy to Firebird Query Service |
| * | `/query*`, `/ifess*`, `/backend/upah*` | `X-API-Key` | Raw upstream proxies |

Firebird Query Service itself (`Services/firebird-query-service`) enforces **read-only SQL** on exec but **no authentication middleware** in service code.

### exec-sync body

```json
{ "queryText": "SELECT ...", "maxRows": 100 }
```

## Management routes API (gateway)

From root README (proxy management):

- `GET/POST /api/routes`, `PUT/DELETE /api/routes/:id`, toggle, health

## Error shape (typical Next JSON)

```json
{ "error": "message" }
```

HTTP 4xx/5xx depending on route. Gateway IFESS may differ.

## Related

- [08-authentication-and-permissions.md](./08-authentication-and-permissions.md)
- [10-reporting-engine.md](./10-reporting-engine.md)
