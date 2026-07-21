# 06 — Database

**Last verified:** 2026-07-21

## Engines in use

| Engine | Role | Location / access |
|---|---|---|
| **Microsoft SQL Server** | Business/report data estate & mill | Network MSSQL; profiles `db_ptrj` (estate), `db_ptrj_mill` (pabrik) |
| **Firebird 1.5** | IFESS scanner/attendance/production archive | Local `PTRJ_ARC.FDB` via `isql.exe` |
| **SQLite (Prisma)** | App users, services, access control | `Dashboard_Utama/prisma/dev.db` via `DATABASE_URL` |

## Policy

- Report databases are **read-only** from application code paths (`validateReadOnlySql`, project memory policy).
- Do not ship production connection strings in docs or commits.

## Prisma (application ACL)

Source: `Dashboard_Utama/prisma/schema.prisma`

| Model | Purpose |
|---|---|
| `User` | Local users (`email` unique, `password`, `role` string) |
| `Service` | Service catalog + optional proxy path/target |
| `AccessControl` | Role- or user-scoped service access |

Provider: `sqlite`. Migrations under `prisma/migrations/`. Seed/helper scripts: `create-admin.js`, `init-db.sql`, `seed-report-center-service.sql`.

### User columns (summary)

| Column | Type | Nullable | Notes |
|---|---|---:|---|
| id | String cuid | no | PK |
| name | String | yes | |
| email | String | no | unique |
| password | String | yes | sensitive |
| role | String | no | default `KERANI` |
| image | String | yes | |
| createdAt/updatedAt | DateTime | no | |

## MSSQL inventory domain (reports)

Authoritative table notes also live in:

- `Dashboard_Utama/docs/inventory-in-database/`
- Root `IN_*_MCP.md` / deepdive JSON
- Project memory inventory schema

### High-value tables for Monthly Stock (RPTIN1000015)

From report config `sourceTables`:

| Table | Use in monthly stock |
|---|---|
| `IN_ITEM` | Live item base / valuation |
| `IN_MTHENDITEM` | Month-end opening/closing snapshot |
| `IN_STOCKANALYSIS` | Analysis group metadata |
| `IN_PRODTYPE` | Product type dimension |
| `IN_STOCKISSUE` / `IN_STOCKISSUELN` | Issues |
| `IN_FUELISSUE` / `IN_FUELISSUELN` | Fuel issues |
| `WS_JOBSTOCK` / `WS_JOB` | Workshop issue/return |
| `PU_GOODSRCV` / `PU_GOODSRCVLN` / `PU_POLN` | Goods receive costs |
| `PU_GOODSRET` / `PU_GOODSRETLN` | Goods return (implemented path) |

### Source selection

Inventory query context maps:

- `source=estate|kebun` → estate DB profile
- default / `pabrik` → mill DB profile

(Exact connection wiring: `lib/reports/inventory/query-gateway.ts`.)

## Firebird (IFESS)

- ~183 tables / 81 views on verified PTRJ_ARC instance (per `CLAUDE.md`; re-verify per estate).
- Partitioned scanner tables `FFBSCANNERDATA01..12`, `GWSCANNERDATA01..12` hold multi-year data per slot — filter by date always.
- Templates store: `data/ifess/query-templates.json`.

## Backup / move with project

| Store | Portable? | Notes |
|---|---|---|
| Prisma `dev.db` | yes | Copy file + `DATABASE_URL` |
| `data/ifess/*.json` | yes | Copy directory |
| MSSQL | no single file | Use DBA backup tools |
| Firebird FDB | file-based | Coordinate offline copy; do not corrupt live lock |

See [13-backup-and-restore.md](./13-backup-and-restore.md).

## Related

- [11-report-detail-experience.md](./11-report-detail-experience.md)
- [10-reporting-engine.md](./10-reporting-engine.md)
