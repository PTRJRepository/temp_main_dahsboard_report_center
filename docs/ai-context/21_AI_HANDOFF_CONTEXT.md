# AI Handoff Context

**Last verified:** 2026-07-21  
**Classification:** Internal — safe for AI tools if secrets stay redacted

## Project in one paragraph

Main Dashboard is a monorepo for PT Rebinmas Jaya combining a **Bun API/proxy gateway** (`server_bun.js`), a **Next.js 16** portal (`Dashboard_Utama`), **read-only MSSQL inventory/procurement reports** (via SQL gateway `/v1/query`), and **IFESS + Firebird query service** paths.

## What this project does

- Proxy multiple local services through one port (`routes-config.json`)
- Authenticate staff with custom RS256 JWT cookies (NextAuth code also present)
- Run Report Center with **procurement-first** workspace (inventory routes redirect into procurement)
- Export report payloads (CSV backend path verified; client Excel/PDF also present)
- Optional AI insight on already-fetched payloads
- Manage IFESS clients; execute Firebird SQL templates via query service

## Tech stack

Bun gateway · Next.js 16 · TypeScript · Tailwind · Prisma SQLite · mssql/SQL Bridge · Firebird isql service · Zustand · TanStack Virtual · xlsx/jspdf · JWT cookies / NextAuth parallel

## Main modules

| Module | Path hints | Status |
|---|---|---|
| Gateway | `server_bun.js` | Implemented (active) |
| Legacy Express | `server.js` | Legacy |
| Report Center UI | `Dashboard_Utama/app/(report-center)` | Implemented |
| Inventory API | `app/api/reports/inventory` | Implemented |
| Monthly stock engine | `lib/reports/inventory/monthly-stock-account-movement.ts` | Implemented + placeholders |
| Filters | `lib/reports/report-filtering.ts` | Implemented |
| SQL gateway client | `lib/reports/sql-gateway-config.ts` | Implemented |
| RBAC helpers | `lib/rbac/*` | Partial / dual with real JWT auth |
| IFESS control | `Services/ifess-control-server` + Bun handlers | Implemented |
| Firebird query service | `Services/firebird-query-service` | Implemented (no app-layer auth in service) |
| Docker Next | `Dashboard_Utama/docker-compose.yml` | Implemented (no Bun in compose) |
| Module Services report-center | `Module Services/report-center` | Parallel/legacy Unverified active |

## Important folders and files

- `Dashboard_Utama/lib/reports/` — report brain
- `Dashboard_Utama/components/report-center/` — procurement KPI/catalog/overview
- `Dashboard_Utama/app/api/` — Next route handlers
- `Services/firebird-query-service/` — Firebird exec/templates
- `Services/query/` — SQL Bridge gateway dist
- `docs/` — **canonical human docs** (numbered 01–20)
- `CLAUDE.md` / `AGENTS.md` — agent coding constraints

## Database summary

- SQLite Prisma: users/services/ACL
- MSSQL via SQL gateway: estate `db_ptrj` (`SERVER_PROFILE_2`), mill `db_ptrj_mill` (`SERVER_PROFILE_3`)
- Firebird PTRJ_ARC: scanner tables, isql service, read-only SQL guard

## API summary

Next: `/api/auth/*`, `/api/reports/*`, `/api/services`, plus `/api/ifess` and `/api/query-gateway` (often **shadowed** by Bun when traffic hits gateway first)  
Bun: IFESS native handlers, query-gateway proxy to Firebird service, protected raw upstream prefixes with API keys  
SQL Bridge: `/v1/query`, `/v1/databases` (API key)

## Auth summary

**Primary live path:** custom JWT from `/api/auth/login` (RS256, ~8h), cookie `auth-token` (also `payroll_auth_token` legacy), token also stored in `localStorage`.  
**Parallel:** NextAuth credentials provider still present.  
**Report Center layout:** cookie required; auditor notes ADMIN requirement in layout.  
**RBAC matrix** exists in `lib/rbac/permissions.ts` but client AuthProvider mount is incomplete / dual with mock AuthContext.  
**Critical:** many report API routes lack explicit auth checks; Bun proxies dashboard before late protected-path fallback — **route code is the real gate**.

## Main business flows

1. Login → dashboard-user → open service or report-center  
2. Procurement workspace → KPI deck → catalog filter hub → open report detail  
3. Report detail → filters → SQL gateway query → payload → export/AI  
4. IFESS client register → heartbeat → commands  
5. Firebird template/query → exec-sync → analytics HTML/UI  

## Current status

Active development on Report Center procurement UX and inventory analytics. Documentation pack refreshed 2026-07-21 with auditor corrections.

## Known problems

- Monthly stock placeholder measures (some zeros by design status)
- Dual gateway maintenance; Bun loads `routes-config.json` only (not production file automatically)
- Auth model fragmented (JWT + NextAuth + mock RBAC + demo middleware)
- Report/data routes may be unauthenticated at route layer
- Firebird query service has no auth in service code (depends on network placement)
- SQL Bridge auth middleware may attach broad permissions to valid tokens
- Query-gateway batch/dispatch path ownership inconsistent under Bun proxy
- Docker health probes `/` / nginx `/health` may not match app routes
- No automated backup job found
- Docs historically lag runtime (partially addressed by this pack)

## Security notes

Read-only SQL guards exist for report builders and Firebird service. Cookies currently `httpOnly:false` / `secure:false` in login/verify routes. Never commit secrets. Prefer env-only keys. Treat mock RBAC passwords as non-production.

## What not to do

- Do not write to MSSQL report DBs from app features
- Do not invent report formulas
- Do not delete `data/ifess` without backup
- Do not assume Express is primary
- Do not assume Next `/api/ifess` wins when Bun fronts traffic
- Do not document real credentials

## Recommended next steps

See [../roadmap.md](../roadmap.md) — critical: secrets, authz on report routes, monthly stock placeholders, auth unification.

## Safe context for external AI

You may share this file plus `docs/README.md` and numbered docs **without** `.env`, `keys/`, production hosts with passwords, or personal data.
