# PT Rebinmas Jaya — Main Dashboard

Enterprise operations dashboard and API gateway for oil palm **estate** and **mill** systems: proxy routing, staff portal, **Report Center** (inventory/procurement analytics), **IFESS** client control, and Firebird query gateway.

**Last verified:** 2026-07-21

## Why this exists

Multiple local services and databases historically required separate ports and tools. This monorepo provides:

1. One gateway port for proxied services and IFESS/query APIs.
2. A Next.js portal for authentication and Report Center.
3. Read-only MSSQL inventory reporting with filterable detail views.
4. Firebird analytics for scanner/attendance style datasets.

## Status

| Layer | Status |
|---|---|
| Bun gateway (`server_bun.js`) | **Active** |
| Express gateway (`server.js`) | Legacy |
| Report Center inventory/procurement | Live (procurement-first workspace) |
| Monthly stock RPTIN1000015 | Live with some `placeholder_zero` measures |
| Docker (Next + nginx) | Supported (gateway not in compose) |

## Major features

- Dynamic reverse proxy (`routes-config.json`)
- Staff login + service ACL
- Report Center modules (procurement/inventory first-class)
- KPI command deck + report catalog + detail viewer
- Excel/PDF export from report payloads
- Optional AI insight over already-fetched payloads
- IFESS client register/heartbeat/dashboard
- Firebird `isql` exec-sync + query templates

## Tech stack

| Area | Technology |
|---|---|
| Gateway | Bun (primary), Express (legacy) |
| Web app | Next.js 16, React, TypeScript, Tailwind |
| App DB | Prisma + SQLite (users/services ACL) |
| Reports DB | Microsoft SQL Server (`mssql`) via SQL gateway |
| Field/analytics DB | Firebird 1.5 via `isql` / Firebird Query Service |
| Auth | Custom RS256 JWT cookies (+ parallel NextAuth code) |
| Export | `xlsx`, `jspdf` |

## Requirements

- Node.js 20+
- Bun (for active gateway scripts)
- npm
- Optional: MSSQL network access, Firebird + `isql.exe`

## Quick start

```bash
# root
npm install
cd Dashboard_Utama && npm install && cd ..

# configure secrets locally (never commit)
cp .env.example .env.development   # edit
cp Dashboard_Utama/.env.example Dashboard_Utama/.env.local  # edit

# run gateway (Next often started separately on 3100)
npm run dev
# or gateway only:
npm run dev:gateway
```

| URL | Use |
|---|---|
| http://localhost:3001 | Gateway default |
| http://localhost:3100 | Next.js dashboard |
| http://localhost:3100/login | Login |
| http://localhost:3100/report-center | Report Center |
| http://localhost:8080 | Docker nginx front (compose) |

For LAN access in development, run `npm run dev` from the repository root and open `http://<this-computer-ip>:3001` from another machine on the same network. The gateway and spawned dashboard dev server bind to `0.0.0.0`; if Windows blocks the connection, allow inbound TCP ports `3001` and `3100` in Windows Firewall. Use `3100` only for direct dashboard debugging; `3001` is the shared entrypoint.

If port 3001 is stuck on Windows, use `PORT=3002` (see docs troubleshooting).

## Development commands

### Root

| Command | Purpose |
|---|---|
| `npm run dev` | Bun gateway (+ dashboard spawn flags in script) |
| `npm run dev:lan` | Alias for LAN-accessible dev gateway + dashboard |
| `npm run start` | Production Bun gateway |
| `npm run build:dashboard` | Build Next app from root |
| `npm run dev:gateway` | Gateway without dashboard |
| `npm run start:express` | Legacy Express |

### Dashboard (`Dashboard_Utama/`)

| Command | Purpose |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run start` | Serve build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck |

### Tests (standalone)

```bash
cd Dashboard_Utama
npx tsx lib/reports/report-filtering.test.ts
npx tsx lib/reports/inventory/monthly-stock-account-movement.test.ts
```

There is no root `npm test` script.

## Environment

See:

- [`.env.example`](./.env.example)
- [`Dashboard_Utama/.env.example`](./Dashboard_Utama/.env.example)
- [docs/05-configuration.md](./docs/05-configuration.md)

## Database init (app ACL)

```bash
cd Dashboard_Utama
npx prisma generate
# migrate/seed as required for your environment
```

Report MSSQL/Firebird are external systems — not initialized by this repo.

## Project structure (summary)

```
Main Dashboard/
├── server_bun.js          # active gateway
├── server.js              # legacy Express
├── routes-config.json
├── Dashboard_Utama/       # Next.js app + report APIs
├── Services/              # IFESS + Firebird query service
├── data/ifess/            # IFESS JSON stores
├── keys/                  # JWT keys (local)
└── docs/                  # canonical documentation
```

Details: [docs/04-project-structure.md](./docs/04-project-structure.md)

## Deployment summary

- **Standalone:** configure env/keys, build dashboard, run Bun gateway.
- **Docker:** `cd Dashboard_Utama && docker-compose up --build` → nginx **:8080** (Next only).

Full guide: [docs/12-deployment.md](./docs/12-deployment.md)

## Documentation

**Canonical index:** [docs/README.md](./docs/README.md)

| Doc | Audience |
|---|---|
| [Getting started](./docs/02-getting-started.md) | Developers |
| [Architecture](./docs/03-architecture.md) | Architects |
| [API reference](./docs/07-api-reference.md) | Integrators |
| [Auth](./docs/08-authentication-and-permissions.md) | Security |
| [Monthly stock report detail](./docs/11-report-detail-experience.md) | Analysts / engineers |
| [Security](./docs/14-security.md) | Admins |
| [Troubleshooting](./docs/18-troubleshooting.md) | Support |
| [AI handoff](./docs/ai-context/21_AI_HANDOFF_CONTEXT.md) | Coding agents |

Also: [CONTRIBUTING.md](./docs/dev-meta/CONTRIBUTING.md), [AGENTS.md](./AGENTS.md), [CLAUDE.md](./CLAUDE.md)

## Security reporting

Do not file public issues with secrets. Rotate exposed keys immediately. Prefer private report to the platform admin. See [docs/14-security.md](./docs/14-security.md).

## Contributing

See [CONTRIBUTING.md](./docs/dev-meta/CONTRIBUTING.md).

## License

**Unverified** — no LICENSE file confirmed in this documentation pass. Confirm with repository owner before redistribution.
