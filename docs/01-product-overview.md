# 01 — Product Overview

**Last verified:** 2026-07-21

## Application name

**PT Rebinmas Jaya Main Dashboard** (workspace also called *proxy-gateway* in root `package.json`).

## Problem it solves

Operators and managers need one entry point to:

- Open estate/mill operational services through a single proxy port.
- Run **read-only** inventory / procurement reports against MSSQL.
- Manage **iFESS** field clients and run Firebird scanner analytics.
- Authenticate staff and gate service/report access by role.

## Current status

| Area | Status | Evidence |
|---|---|---|
| Bun gateway | Active primary | `server_bun.js`, root scripts `dev`/`start` |
| Express gateway | Legacy present | `server.js`, `start:express` |
| Report Center inventory/procurement | Live UI + APIs | `Dashboard_Utama/app/(report-center)`, `app/api/reports/*` |
| Monthly stock movement report | Implemented with placeholders | `lib/reports/inventory/monthly-stock-account-movement.ts` |
| Docker (Next only) | Supported | `Dashboard_Utama/docker-compose.yml` |
| Full backup automation | Not found | See [13-backup-and-restore.md](./13-backup-and-restore.md) |

## Primary users

| Role (RBAC type) | Typical use |
|---|---|
| `kerani` | Operational dashboards, reports |
| `hr` | HR modules, user management |
| `payroll` | Payroll reports |
| `manager` | Settings, audit, broader reports |
| `admin` / `SuperAdmin` | Full access |

Prisma `User.role` uses a different string set (`ADMIN`, `KERANI`, …). **Current implementation has dual role vocabularies** — see [08-authentication-and-permissions.md](./08-authentication-and-permissions.md).

## Major modules

1. **Proxy gateway** — route external local services under one port (`routes-config.json`).
2. **Dashboard / portal** — login, user dashboard, service cards (`Dashboard_Utama`).
3. **Report Center** — procurement/inventory report catalog, KPI command deck, detail viewer.
4. **IFESS control** — client register/heartbeat/dashboard + static analytics HTML.
5. **Firebird query gateway** — `isql` execution for scanner/attendance/production SQL templates.

## Product principles (from code)

- Report SQL is **read-only**.
- Inventory source is selectable: `estate` → `db_ptrj`, `pabrik` → `db_ptrj_mill` (via query context helpers).
- Procurement inventory UX prefers one central filter hub; embedded catalog lives under procurement workspace.

## Related docs

- [10-reporting-engine.md](./10-reporting-engine.md)
- [11-report-detail-experience.md](./11-report-detail-experience.md)
- [glossary.md](./glossary.md)
