# 13 — Backup and Restore

**Last verified:** 2026-07-21

## Current implementation

No dedicated automated backup job or scheduled restore runbook was found in application code. Treat backup as an **operations responsibility** until automation is added.

## What to back up

| Asset | Path / system | Criticality | Method (recommended) |
|---|---|---|---|
| App users / ACL | `Dashboard_Utama/prisma/dev.db` (or prod sqlite path) | High | File copy while app stopped or use sqlite backup API |
| Prisma migrations | `Dashboard_Utama/prisma/migrations` | High | Git already; keep with release |
| JWT keys | `keys/*.pem` | Critical | Secure secret store offline |
| Env files | deployment secrets | Critical | Secret manager — never git |
| IFESS JSON stores | `data/ifess/*.json` | High | Directory snapshot |
| Query templates | `data/ifess/query-templates.json` | High | Version in git if non-secret |
| Proxy routes | `routes-config.json` (+ production variant) | Medium | Git + deploy artifact |
| MSSQL business data | SQL Server | Critical | DBA full/diff backup — **out of app** |
| Firebird FDB | PTRJ_ARC.FDB path | Critical | Offline file copy with Firebird locked/stopped |

## Restore procedures (manual)

### SQLite (Prisma)

1. Stop dashboard process.
2. Replace `dev.db` (or configured `DATABASE_URL` file) with backup.
3. Start app; verify login and `/api/services`.

### IFESS data

1. Stop gateway.
2. Restore `data/ifess/` directory.
3. Start gateway; hit `/api/ifess/health` and list clients.

### MSSQL / Firebird

Use platform tools (SSMS maintenance plans, `gbak`/file copy for Firebird). Application has no built-in restore UI.

## Pre-migration backup checklist

- [ ] Export env keys list (not values in tickets)
- [ ] Copy prisma DB file
- [ ] Copy `data/ifess`
- [ ] Confirm DBA snapshot of MSSQL
- [ ] Confirm Firebird backup if analytics required

## Gap

**Intended:** documented automated backup.  
**Current:** manual only.  
**Next:** add scheduled copy for sqlite + ifess JSON and alert on failure.
