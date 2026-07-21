# 20 — Known Limitations

**Last verified:** 2026-07-21

| Area | Current implementation | Intended / ideal | Gap / next action |
|---|---|---|---|
| Monthly stock `received` / transfer / adjustment / dispatch | `placeholder_zero` | Full RPTIN1000015 parity | Implement SQL or hide measures in UI |
| Auth role models | Prisma roles ≠ RBAC roles; JWT + NextAuth + mock RBAC | Single source of truth | Mapper + one login path |
| Report API auth | Many `/api/reports/*` routes unauthenticated at handler | JWT on every data route | Add shared auth helper |
| Query gateway edge | Firebird service + Bun proxy without app auth | Authenticated edge | API key / mTLS / private network |
| Gateway dual stack | Bun active + Express legacy; Bun loads `routes-config.json` only | One gateway + env-specific routes | Deprecate Express; load prod config |
| Docker | Next+nginx only | Full stack optional | Document compose for gateway or add service |
| Backup | Manual | Automated | Job for sqlite + ifess JSON |
| OpenAPI | None | Generated API docs | Add from route inventory |
| Report filter pushdown | Often payload-side | SQL pushdown where safe | Incremental handler work |
| Firebird concurrency | Single isql lock | Higher throughput | Accept limit or upgrade DB |
| Root README | Still proxy-gateway oriented paths | Unified Main Dashboard README | Updated front door in this pass |
| Module Services tree | Parallel report-center artifacts | One canonical UI tree | Prefer Dashboard_Utama |
| AI metrics honesty | Local fallbacks | No invented business KPIs | Keep evidence-bound insights |
| E2E test suite | Mostly manual/assert unit | CI e2e | Add Playwright smoke |

## Related

- [14-security.md](./14-security.md)
- [11-report-detail-experience.md](./11-report-detail-experience.md)
- [roadmap.md](./roadmap.md)
