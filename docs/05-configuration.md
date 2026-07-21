# 05 — Configuration

**Last verified:** 2026-07-21  
**Rule:** documentation lists keys and purpose only. No real secrets.

## Environment files found

| File | Role |
|---|---|
| Root `.env.development` / `.env.production` | Gateway dual-mode |
| Root `.env.example` | Template added 2026-07-21 |
| `Dashboard_Utama/.env` | Dev defaults |
| `Dashboard_Utama/.env.local` | Local overrides (gitignored) |
| `Dashboard_Utama/.env.local.example` | Dashboard template |
| `Dashboard_Utama/.env.docker` | Docker |
| `Dashboard_Utama/.env.example` | Template added 2026-07-21 |
| `Dashboard_Utama/env-config.txt` | Documented MSSQL/auth key names |
| Service `.env.example` under `Services/*` | Per-service |

## Variable catalog (safe)

| Variable | Required | Default / notes | Purpose | Sensitive | Used by |
|---|---:|---|---|---:|---|
| `NODE_ENV` | no | development/production | Mode | no | gateway, Next |
| `PORT` | no | 3001 | Gateway bind port | no | `server_bun.js` |
| `HOST` | no | 0.0.0.0 | Bind host | no | gateway |
| `DASHBOARD_PORT` | no | 3100 | Spawned Next port | no | gateway scripts |
| `START_DASHBOARD` | no | true/false | Spawn Next from gateway | no | `server_bun.js` |
| `JWT_PRIVATE_KEY_PATH` | yes for JWT | `./keys/private.pem` | Sign tokens | yes path to secret | auth |
| `JWT_PUBLIC_KEY_PATH` | yes for JWT | `./keys/public.pem` | Verify tokens | no (public) | auth |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | yes for NextAuth | — | Session secret | yes | Next auth |
| `NEXTAUTH_URL` | yes for NextAuth | local URL | Callback base | no | Next auth |
| `MSSQL_HOST` | yes for direct MSSQL | — | SQL Server host | no host itself | dashboard/db utils |
| `MSSQL_PORT` | no | 1433 | SQL port | no | mssql |
| `MSSQL_USER` | yes | — | SQL user | yes | mssql |
| `MSSQL_PASSWORD` | yes | — | SQL password | yes | mssql |
| `MSSQL_DATABASE` | yes | — | Default DB name | no | mssql |
| `DATABASE_URL` | yes for Prisma | sqlite file URL | Prisma datasource | maybe | Prisma |
| `NEXT_PUBLIC_SQL_GATEWAY_URL` | often | — | Browser-visible gateway | no | client |
| `SQL_GATEWAY_URL` | often | — | Server gateway base | no | server |
| `SQL_GATEWAY_API_KEY` | often | — | Gateway key | yes | server |
| `SQL_GATEWAY_TIMEOUT_MS` | no | — | Timeout | no | server |
| `DATABASE_PROFILE` | no | — | Profile selection | no | inventory query |
| `NEXT_PUBLIC_APP_URL` | no | — | Public app URL | no | client |
| `LOCAL_LLM_*` | no | — | Local LLM for AI insight | yes key | AI routes |
| `EXPORT_MAX_ROWS` / `EXPORT_TIMEOUT_MS` | no | — | Export limits | no | export |
| `IFESS_API_KEY` | yes for IFESS API | may have code default | IFESS auth | yes | gateway/proxy |
| `GATEWAY_BASE` | no | localhost:3001 | Next→gateway proxy | no | `/api/ifess` |
| `NEXT_PUBLIC_REPORT_CENTER_THEME_V2` | no | true unless `false` | Theme flag | no | shell |
| `COOKIE_SECURE` | no | false dev | Secure cookies | no | auth cookies |

## Precedence

1. Process environment / shell.
2. `.env.local` (Next local).
3. `.env` / `.env.docker` depending on runtime.
4. Hardcoded fallbacks in code (security risk when keys default) — see [14-security.md](./14-security.md).

## Route configuration

- Dev: `routes-config.json`
- Prod: `routes-config.production.json`
- Hot-reload behavior documented for gateway; verify after edit.

## Feature flags

| Flag | Effect |
|---|---|
| `NEXT_PUBLIC_REPORT_CENTER_THEME_V2` | Report center theme v2 unless explicitly `false` |
| AI env vars | Enable remote/local model insight paths when configured |

## Related

- [12-deployment.md](./12-deployment.md)
- [08-authentication-and-permissions.md](./08-authentication-and-permissions.md)
