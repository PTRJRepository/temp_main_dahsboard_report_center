# Documentation Index

**Last verified:** 2026-07-21  
**Scope:** Main Dashboard monorepo (Bun/Express gateway + `Dashboard_Utama` Next.js app + IFESS/query services)

This index is the canonical navigation for human operators and AI agents. Older docs remain under numbered folders, `ai-context/`, `Dashboard_Utama/docs/`, and `Dokumentasi/`. Prefer this numbered series when content conflicts; mark gaps as **Unverified** rather than inventing behavior.

## Start here

| Audience | Read first |
|---|---|
| New developer | [02-getting-started.md](./02-getting-started.md), root [README.md](../README.md) |
| Architect | [03-architecture.md](./03-architecture.md), [04-project-structure.md](./04-project-structure.md) |
| Product / operator | [01-product-overview.md](./01-product-overview.md), [10-reporting-engine.md](./10-reporting-engine.md) |
| Report analyst | [11-report-detail-experience.md](./11-report-detail-experience.md) |
| Admin / deploy | [05-configuration.md](./05-configuration.md), [12-deployment.md](./12-deployment.md), [13-backup-and-restore.md](./13-backup-and-restore.md) |
| Security | [08-authentication-and-permissions.md](./08-authentication-and-permissions.md), [14-security.md](./14-security.md) |
| AI agent handoff | [ai-context/21_AI_HANDOFF_CONTEXT.md](./ai-context/21_AI_HANDOFF_CONTEXT.md) |

## Numbered guides

| # | Document | Status |
|---|---|---|
| 01 | [Product overview](./01-product-overview.md) | Verified summary |
| 02 | [Getting started](./02-getting-started.md) | Verified commands |
| 03 | [Architecture](./03-architecture.md) | Verified dual-mode deploy |
| 04 | [Project structure](./04-project-structure.md) | Verified tree |
| 05 | [Configuration](./05-configuration.md) | Keys only; no secrets |
| 06 | [Database](./06-database.md) | MSSQL + Firebird + SQLite auth |
| 07 | [API reference](./07-api-reference.md) | Route inventory from code |
| 08 | [Auth & permissions](./08-authentication-and-permissions.md) | Cookie JWT + RBAC matrix |
| 09 | [Frontend & design system](./09-frontend-and-design-system.md) | Report-center shell |
| 10 | [Reporting engine](./10-reporting-engine.md) | Inventory catalog + filters |
| 11 | [Report detail experience](./11-report-detail-experience.md) | Monthly stock RPTIN1000015 |
| 12 | [Deployment](./12-deployment.md) | Standalone + Docker |
| 13 | [Backup and restore](./13-backup-and-restore.md) | Partial / gaps noted |
| 14 | [Security](./14-security.md) | Confirmed + risks |
| 15 | [Testing](./15-testing.md) | Standalone assert tests |
| 16 | [Observability](./16-observability.md) | Logs/health |
| 17 | [Performance](./17-performance.md) | Report detail constraints |
| 18 | [Troubleshooting](./18-troubleshooting.md) | Symptom-based |
| 19 | [Maintenance](./19-maintenance-and-upgrades.md) | Ops checklist |
| 20 | [Known limitations](./20-known-limitations.md) | Implemented vs intended |
| — | [Glossary](./glossary.md) | Domain terms |
| — | [Roadmap](./roadmap.md) | Evidence-based next steps |
| — | [ADRs](./adr/README.md) | Decision records |
| — | [Diagrams](./diagrams/README.md) | Mermaid sources |

## Related legacy / deep docs

- Root agent notes: [`AGENTS.md`](../AGENTS.md), [`CLAUDE.md`](../CLAUDE.md), [`AGENT_GUIDE.md`](../AGENT_GUIDE.md)
- IFESS: [`IFESS_QUICKSTART.md`](./IFESS_QUICKSTART.md), [`IFESS_CONTROL_SERVER.md`](./IFESS_CONTROL_SERVER.md)
- AI context pack: [`ai-context/README.md`](./ai-context/README.md)
- Dashboard PRDs: `Dashboard_Utama/docs/PRD/`
- Table deep dives: `Dokumentasi/Report-Center-Tables/` (if present), root `IN_*_MCP.md`
- Inventory schema notes: `Dashboard_Utama/docs/inventory-in-database/`

## Coverage matrix (2026-07-21)

| Area | Evidence source | Doc target | Gap |
|---|---|---|---|
| Gateway dual mode | `server_bun.js`, `package.json`, `CLAUDE.md` | 03, 12 | Express legacy still present |
| Next.js report center | `Dashboard_Utama/app/(report-center)` | 09–11 | Large UI files; partial UX polish ongoing |
| Auth | `app/api/auth/*`, `lib/rbac/*`, Prisma User | 08, 14 | Dual cookie names; mock RBAC vs Prisma roles |
| Inventory reports | `lib/reports/inventory/*`, `app/api/reports/inventory` | 10–11 | Some movement columns placeholder_zero |
| Firebird/IFESS | `server_bun.js` query gateway, `docs/IFESS_*` | 03, 07, 18 | Port 3001 zombie on Windows noted in CLAUDE.md |
| Docker | `Dashboard_Utama/docker-compose.yml` | 12 | Gateway not in compose; Next-only |
| Backup | No dedicated automation found | 13 | Strategy **Unverified** / missing |
| OpenAPI | No OpenAPI file found | 07 | Manual inventory only |

## Contribution rule for docs

1. Prefer editing these numbered files over scattering new README clones.
2. Never paste real secrets, production IPs as credentials, or personal data.
3. When code and doc disagree, document **Current implementation** and **Intended** separately.
4. Run `npx tsc --noEmit` and relevant `npx tsx *.test.ts` before claiming test pass.
