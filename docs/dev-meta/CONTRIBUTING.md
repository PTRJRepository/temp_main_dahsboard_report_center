# Contributing

**Last verified:** 2026-07-21

## Prerequisites

- Windows 11 or compatible environment (primary team OS is Windows).
- Node.js 20+ for Next.js dashboard builds.
- Bun for the active gateway (`server_bun.js`).
- Access to MSSQL report databases (read-only policy for `db_ptrj` / `db_ptrj_mill`).
- Optional: local Firebird 1.5 + `isql.exe` for IFESS query gateway work.

## Repository layout (short)

| Path | Role |
|---|---|
| `server_bun.js` | Active gateway: proxy + IFESS API + Firebird query gateway |
| `server.js` | Legacy Express gateway |
| `Dashboard_Utama/` | Next.js 16 app (UI + report APIs) |
| `routes-config.json` | Hot-reload proxy routes |
| `data/ifess/` | IFESS JSON stores including `query-templates.json` |
| `docs/` | Canonical documentation |

See [docs/04-project-structure.md](./docs/04-project-structure.md).

## Development workflow

### Gateway + dashboard (root)

```bash
npm install
npm run dev
```

Scripts verified in root `package.json`:

| Script | Behavior |
|---|---|
| `npm run dev` | Bun gateway, `START_DASHBOARD=true`, dashboard port 3100 |
| `npm run start` | Production Bun gateway with dashboard spawn |
| `npm run build:dashboard` | `bun --cwd Dashboard_Utama run build` |
| `npm run dev:gateway` | Gateway only (`START_DASHBOARD=false`) |
| `npm run start:express` / `dev:express` | Legacy Express path |

### Dashboard only

```bash
cd Dashboard_Utama
npm install
npm run dev
npm run lint
npx tsc --noEmit
```

### Tests

No centralized `npm test` script. Tests are standalone assert files:

```bash
cd Dashboard_Utama
npx tsx lib/reports/report-filtering.test.ts
npx tsx lib/reports/accounting-period.test.ts
npx tsx lib/reports/module-panel.test.ts
npx tsx lib/reports/inventory/monthly-stock-account-movement.test.ts
```

## Coding standards

From `AGENTS.md` / `CLAUDE.md`:

- TypeScript strict; 2-space indent; single quotes in TS/TSX.
- React components `PascalCase`; functions/hooks `camelCase`.
- Report IDs and routes: **kebab-case**.
- Prefer helpers in `Dashboard_Utama/lib/reports/` over new SQL filter stacks.
- Report SQL must be read-only (`validateReadOnlySql`).

## Security rules

- Do not commit `.env`, `.env.local`, `keys/`, or real API keys.
- Do not write/delete/alter production MSSQL report DBs.
- IFESS client management endpoints require API key headers.

## Pull requests

Include:

1. Summary of user-visible change.
2. Affected routes/reports.
3. Commands run (`tsc`, targeted `tsx` tests, manual URL checks).
4. Screenshots for UI changes.
5. Notes on intended vs implemented gaps if any.

## Documentation updates

When changing behavior, update the matching file under `docs/` and the index in `docs/README.md`. Do not invent endpoints or metrics.
