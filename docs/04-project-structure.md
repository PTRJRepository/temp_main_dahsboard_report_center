# 04 — Project Structure

**Last verified:** 2026-07-21

## Top-level

| Path | Responsibility | Common edits | Avoid editing casually |
|---|---|---|---|
| `server_bun.js` | Active gateway | Proxy/IFESS/query fixes | Large unreviewed rewrites |
| `server.js` | Legacy Express gateway | Only if maintaining Express path | Prefer Bun unless required |
| `routes-config.json` | Hot-reload proxy routes | Enable/disable targets | Production secrets |
| `package.json` | Root scripts/deps | Script changes | — |
| `Dashboard_Utama/` | Next.js application | Features, reports UI/API | Generated `.next` |
| `Services/` | IFESS, Firebird helpers, modules | Service-specific | — |
| `Module Services/` | Parallel/legacy module trees | Check which is canonical | Dual-tree drift risk |
| `data/ifess/` | JSON persistence for IFESS | Templates, clients | Commit sensitive host data |
| `keys/` | JWT RSA keypairs | Generate locally | Never commit private keys |
| `docs/` | Canonical documentation | Keep current | — |
| `Dokumentasi/` | Long-form ops/table guides | Reference | May lag code |
| `scripts/` | Smoke/start helpers | Add verifiable scripts | — |
| `sql/` | SQL assets | Review before run | Prod write scripts |
| `tests/` | Root tests if any | — | — |

## Dashboard_Utama

| Path | Responsibility |
|---|---|
| `app/` | App Router pages + `api/` handlers |
| `app/(report-center)/` | Report Center shell and modules |
| `app/(login)/` | Login, admin, dashboard-user |
| `components/` | Shared UI, report-center components |
| `lib/reports/` | Report config, filters, SQL builders, AI helpers |
| `lib/rbac/` | Roles, permissions, ProtectedRoute |
| `store/` | Zustand client stores |
| `prisma/` | SQLite schema for users/services ACL |
| `public/` | Static assets, IFESS HTML when served |
| `docker-compose.yml` / `Dockerfile` / `nginx/` | Container deploy |

## Report library hotspot

`Dashboard_Utama/lib/reports/`:

- `report-filtering.ts` — filter normalize/apply/read-only validation
- `accounting-period.ts` — actual ↔ accounting period conversion
- `inventory/config.ts` — inventory report catalog
- `inventory/monthly-stock-account-movement.ts` — RPTIN1000015 engine
- `inventory/query-gateway.ts` — inventory query execution context
- `procurement-workspace.ts` — procurement workspace links/metadata
- `module-panel.ts` / `module-registry.ts` / `intelligence.ts` — module cards

## Generated / local artifacts (do not hand-edit)

- `node_modules/`, `.next/`, `Dashboard_Utama/.next/`
- `prisma/dev.db` (local sqlite data)
- Log files: `*.log`, `server_bun.out.log`, etc.

## Dual-tree warning

Exploration found parallel report-center trees under `Module Services/` and `Dashboard_Utama/`. **Prefer `Dashboard_Utama` for Next report-center UI/API** unless a specific Module Services deploy path is confirmed.
