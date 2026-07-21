# 02 — Getting Started

**Last verified:** 2026-07-21  
**OS assumption:** Windows 11 (team primary); commands shown as npm/bun POSIX-friendly shells also used in Git Bash.

## Requirements

- Node.js 20+ (Docker build uses `node:20-alpine`)
- Bun (active gateway)
- npm for `Dashboard_Utama` dependencies
- Optional: MSSQL network access, Firebird `isql.exe`

## Install

```bash
cd "D:/Gawean Rebinmas/Main Dashboard"
npm install
cd Dashboard_Utama
npm install
```

## Environment

1. Copy [`.env.example`](../.env.example) for root gateway variables.
2. Copy [`Dashboard_Utama/.env.example`](../Dashboard_Utama/.env.example) → `.env.local`.
3. Ensure RSA keys exist under `keys/` for JWT (paths configurable).
4. Configure MSSQL and/or SQL gateway URLs without committing secrets.

See [05-configuration.md](./05-configuration.md).

## Run (standalone dual process)

From repository root:

```bash
npm run dev
```

This runs `server_bun.js` with `START_DASHBOARD=true` and `DASHBOARD_PORT=3100`.

Gateway-only (faster for IFESS/Firebird):

```bash
npm run dev:gateway
# equivalent: START_DASHBOARD=false bun run server_bun.js
```

If port 3001 is held by a zombie Bun process (Windows session issue documented in `CLAUDE.md`):

```bash
PORT=3002 START_DASHBOARD=false bun run server_bun.js
```

Dashboard only:

```bash
cd Dashboard_Utama
npm run dev
```

## Default local URLs

| URL | Purpose |
|---|---|
| `http://localhost:3001` | Gateway (default PORT) |
| `http://localhost:3100` | Next.js when spawned by gateway / local dev |
| `http://localhost:3001/dashboard` | Gateway management UI (legacy README) |
| `http://localhost:3100/login` | Staff login |
| `http://localhost:3100/report-center` | Report Center |
| `http://localhost:3002/ifess-control/app` | IFESS static analytics when gateway on 3002 |

## Verify install

```bash
cd Dashboard_Utama
npx tsc --noEmit
npx tsx lib/reports/report-filtering.test.ts
npx tsx lib/reports/inventory/monthly-stock-account-movement.test.ts
```

**Executed 2026-07-21:** `tsc --noEmit` pass; report-filtering and monthly-stock tests pass when run previously in session. Re-run after pull.

## Docker (Next app only)

```bash
cd Dashboard_Utama
docker-compose up --build
```

Nginx listens on **8080**, app container on **3001**. Gateway/IFESS Firebird path is **not** included in this compose file.

## First user flows

1. Open `/login`, authenticate (cookie `auth-token` or `payroll_auth_token`).
2. Open `/report-center` → procurement/inventory.
3. Select source Estate/Pabrik, period, open a live report.

## Common failures

See [18-troubleshooting.md](./18-troubleshooting.md).
