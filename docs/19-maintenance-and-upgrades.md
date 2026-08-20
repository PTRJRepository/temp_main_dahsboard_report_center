# 19 — Maintenance and Upgrades

**Last verified:** 2026-07-21

## Routine maintenance

| Cadence | Task |
|---|---|
| Daily | Check gateway + dashboard process; disk for logs |
| Weekly | Review failed logins / IFESS client offline list |
| Monthly | Rotate logs; verify MSSQL backup with DBA; review query templates |
| Quarterly | Dependency update pass; secret rotation; fire drill restore sqlite/ifess |

## Dependency upgrades

1. Update in a branch.
2. `npm install` root + `Dashboard_Utama`.
3. `npx tsc --noEmit`, lint, key `tsx` tests.
4. Smoke login + one inventory report + IFESS health.
5. Watch Next 16 / React peer dependency notes (`--legacy-peer-deps` used in Docker).

## Schema changes

- Prisma: create migration; backup sqlite first.
- MSSQL: **no app migrations** for report DBs — coordinate with DBA; app remains read-only.

## Template / config changes

- Live IFESS templates: `data/ifess/query-templates.json` (mtime cached reads).
- Mirror seed templates in service defaults when adding permanent templates.

## Release checklist

- [ ] Changelog notes ([CHANGELOG-GUIDE.md](./dev-meta/CHANGELOG-GUIDE.md))
- [ ] Docs updated if behavior changed
- [ ] Env example keys updated
- [ ] Production routes config reviewed
- [ ] Rollback artifact identified
