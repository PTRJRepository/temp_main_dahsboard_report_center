# Report Center (Module Service — Standalone Next.js App)

Canonical report-center module for the PT Rebinmas Main Dashboard.
Fully standalone: own Next.js app, own port, own auth. Can run independently
with `bun start`; reachable via gateway proxy `/report-center` or directly on
its local port.

## Structure

```
report-center/
├── app/                    # Standalone Next.js App Router
│   ├── page.tsx            # / → redirect /report-center
│   ├── login/              # Access-key login page
│   ├── (report-center)/    # Report Center pages (same layout as Dashboard_Utama route group)
│   ├── api/auth/           # login/logout/verify/public-key (self-contained)
│   └── api/reports/        # Report SQL handlers (single source of truth)
├── components/             # React components
├── lib/                    # Pure logic (reports/*, rbac/*, hooks/useSearch)
├── store/                  # zustand reportStore
├── utils/                  # auth-service, jwt, db, format, repositories (module-local)
├── public/assets/          # login page images
├── next.config.js          # turbopack.root = repo root, assetPrefix=/report-center
└── package.json            # standalone app (scripts dev/build/start)
```

## Run

```bash
cd "Module Services/report-center"

bun install        # or npm install at repo root (workspaces)
bun run dev        # next dev, port 3101
bun run build      # production build
bun start          # next start, port 3101  ← the standalone entry
```

- Direct: http://localhost:3101
- Via gateway proxy: http://localhost:3001/report-center (gateway must be up,
  route `report-center` → `http://127.0.0.1:3101`)

## Access key login

Single shared key file at repo root: `keys/report-center-access.key` (gitignored,
rotate by editing the file — all module services read the same file).
Login with any username + the key as password → ADMIN session, no DB lookup.

```bash
# example
curl -X POST http://localhost:3101/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin\",\"password\":\"$(cat ../keys/report-center-access.key)\"}"
```

Via the gateway proxy, the normal login flow applies (login page on the
dashboard, JWT cookie verified by the module layout).

## Setup (required after fresh clone)

The module lives OUTSIDE Dashboard_Utama, so Turbopack/Next must resolve
`@modules/*` and its bare packages:

1. **`turbopack.root = <repo root>`** in `next.config.js` (already set).
2. **A `Module Services/node_modules` symlink → `Dashboard_Utama/node_modules`**
   so the module's bare imports (`react`, `lucide-react`, `zustand`, ...)
   resolve. Gitignored; recreate per machine:

```bash
node -e "const fs=require('fs');const p='Module Services/node_modules';try{fs.rmSync(p,{force:true})}catch(e){}fs.symlinkSync('../Dashboard_Utama/node_modules',p,'dir')"
```

3. `keys/report-center-access.key` at repo root (create if missing).

## Single source of truth

Report Center pages and `/api/reports` handlers live HERE. Dashboard_Utama
re-exports them (`app/(report-center)/**` and `app/api/reports/**` are thin
`export { ... } from '@modules/report-center/...'` stubs) so both the standalone
app and the main dashboard share one implementation.

## Gateway integration

- `routes-config.json` route `report-center` → `http://127.0.0.1:3101`
  (rewritePath false — module's own app dir has `assetPrefix: '/report-center'`).
- `routes-config.json` route `api-reports` → `http://127.0.0.1:3101` (public).
- `shared/auth/paths.js` DASHBOARD_PATHS excludes `/report-center` and
  `/api/reports` so those hit the route table, not DASHBOARD_TARGET.

## SQL Gateway failover

`lib/reports/sql-gateway-config.ts` resolves the SQL Gateway base. Default
order: localhost:8001 first, 10.0.0.110:8001 fallback. `executeInventoryReadQuery`
tries each candidate in order until one succeeds.

## NPM workspaces

Repo-root `package.json` declares `workspaces: ["Dashboard_Utama", "Module Services/*"]`.
`npm install` at repo root installs all workspaces. The module's `package.json`
declares its own deps (they dedupe against Dashboard_Utama's install).
