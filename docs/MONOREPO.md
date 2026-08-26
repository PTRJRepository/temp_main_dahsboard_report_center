# MONOREPO — Module Platform Rulebook

**Last updated:** 2026-08-24
Single source of truth for how services are organized, run, routed, and authenticated in the PT Rebinmas Main Dashboard monorepo.

---

## 0. Start/stop ALL modules in one command

`scripts/start-module-services.ps1` is the central launcher. It knows every
module's port, dev/prod command, and build marker; skips anything whose port is
already occupied; builds first in prod when the artifact is missing; writes logs
to `logs/modules/`; tracks PIDs in `logs/modules/module-pids.json`.

```bash
npm run start:modules        # prod semua module (build otomatis jika perlu)
npm run dev:modules          # dev semua module (watch/HMR)
npm run status:modules       # tabel RUNNING/DOWN per port
npm run stop:modules         # matikan semua yang dikelola (gateway :3001 TIDAK disentuh)

# variasi
pwsh -File scripts/start-module-services.ps1 -Only rebinmas-jaya-server,rjfm   # subset
pwsh -File scripts/start-module-services.ps1 -Rebuild                          # paksa rebuild sebelum prod
pwsh -File scripts/start-module-services.ps1 -IncludeDashboard                 # + portal :3100 (standalone build, .next/static disinkron otomatis)
```

Catatan:
- **Gateway tidak pernah men-spawn module services** (`START_MODULE_SERVICES`
  default false) — launcher inilah cara baku menjalankan semuanya.
- Jika gateway sudah jalan dan portal :3100 mati, jalankan ulang launcher dengan
  `-IncludeDashboard` (memakai `.next/standalone`, NODE_ENV=production).
- **Standalone build wajib ada `.next/static`**: setelah `next build`, Next TIDAK
  menyalinnya otomatis — tanpa ini portal jalan tapi CSS/JS 404. Launcher
  `-IncludeDashboard` kini menyinkronkannya sendiri tiap start (copy penuh diulang
  saat BUILD_ID berubah). Jalankan portal di luar launcher, salin manual:
  `Copy-Item -Recurse -Force Dashboard_Utama\.next\static Dashboard_Utama\.next\standalone\Dashboard_Utama\.next\static`
  (`public/` juga, tapi biasanya sudah tersalin).
- `bun start` root memang sudah otomatis spawn portal (:3100) — syaratnya port
  3100 KOSONG saat gateway start. Kalau ada proses lama yang menduduki 3100,
  gateway akan menganggap "upstream ready" dan tidak spawn; begitu proses itu
  mati, landing mati juga. Cek dengan `status:modules` / `-IncludeDashboard`.
  Gateway produksi kini mendeteksi kalau penduduk :3100 adalah server DEV Next.js
  (fingerprint HMR / chunk `?v=`) dan mencetak `[portal] WARNING ...` saat startup —
  upstream tetap di-adopt, jadi matikan proses dev itu lalu start ulang portal prod.
- Port WAJIB sama dengan target `routes-config.json`: 3101, 3102, 8011, 8001,
  3104. `daftar-upah` default internalnya 8002 → launcher memaksa `PORT=3104`.
- Mode prod = tanpa watch/HMR, aset ter-build. Kalau ada service jalan di mode
  dev saat `bun start` root, itu sisa proses lama — cek dengan `status:modules`.

---

## 1. The one mental model

```
                        ┌────────────────────────────┐
   Browser ──login──▶   │  Gateway (server_bun.js)    │  :3001
                        │  - ONE auth center          │
                        │  - route table proxy        │
                        │  - IFESS + Firebird APIs    │
                        └───────────┬────────────────┘
              verified RS256 cookie │ X-User-* headers injected
        ┌───────────────┬───────────┼────────────────┬─────────────┐
        ▼               ▼           ▼                           ▼
  Dashboard_Utama  report-center rjfm                      external services
  :3100 (portal,   :3101         :8011 (API + RJ Drive     absen :5176 · beras :5177
  admin, landing)  (Next)        UI via internal :8012)    basis-panen :3002 · query :8001
                                                           daftar-upah :3104 (in-repo)
```

- **Gateway = front door.** Everything is reached through `:3001/<path>`.
- **Every module = independent app.** Own folder, own port, runnable alone.
- **One login.** Gateway verifies a single RS256 JWT cookie and forwards identity to every module.

---

## 2. Module contract

A module under `Module Services/` MUST:

| Rule | Detail |
|---|---|
| Own directory | `Module Services/<module-name>/` |
| Own `package.json` | Name = module name; own scripts (`dev`, `start`, `build`) |
| Own port | Unique across the platform (see table below); bind `0.0.0.0` for LAN |
| Run alone | `bun start` / `npm run dev` inside its dir works with zero other processes |
| Registered in route table | Entry in `routes-config.json` (+ `.production.json`) → reachable via gateway |
| No cross-module imports | Modules never import each other's source. Shared code = copy or publish later |
| Auth: trust the gateway | Via proxy → trust `X-User-*` headers (inbound ones stripped by gateway). Direct-port → verify the shared RS256 cookie with `keys/public.pem` |

npm workspaces at repo root + `turbopack.root = <repo root>` make out-of-root
`@modules/*` imports work from Dashboard_Utama. `Module Services/node_modules`
is a **symlink → Dashboard_Utama/node_modules** (gitignored — recreate per machine):

```bash
cd "Module Services" && node -e "require('fs').symlinkSync('../Dashboard_Utama/node_modules','node_modules','dir')"
```

> Turbopack `resolveAlias` for out-of-root paths is broken (transitive graph unresolvable). Do not retry.

### Add a new module — checklist

1. `mkdir "Module Services/<name>"` + `package.json` (pick next free port ≥3100)
2. Route entry in `routes-config.json` AND `routes-config.production.json`
3. If Next.js standalone: `next.config.js` with `turbopack.root` = repo root,
   `assetPrefix=/<route-path>`; keep thin re-export stubs in Dashboard_Utama if
   it must also render there (never re-export route segment configs)
4. Remove the path from `DASHBOARD_PATHS` in `shared/auth/paths.js` if it must go
   through the route table instead of the dashboard upstream
5. Auth: accept gateway identity headers; optional direct-port login page
6. Add a row to the tables below + `CLAUDE.md`

---

## 3. Service registry

### In-repo modules

| Module | Path | Port | Kind | Run |
|---|---|---|---|---|
| Gateway itself | `/` | 3001 | Bun server | root `npm start` / `PORT=… START_DASHBOARD=false bun run server_bun.js` |
| Dashboard_Utama | `/dashboard-user` `/admin` `/login` `/config-path` + landing | 3100 | Next.js 16 | spawned by gateway or `cd Dashboard_Utama && npm run dev` |
| report-center | `/report-center` + `/api/reports` | 3101 | Next.js 16 | `cd "Module Services/report-center" && bun start` |
| rebinmas-jaya-server | `/server-monitor` | 3102 | Vite React SPA | `cd "Module Services/rebinmas-jaya-server" && npm run dev` (prod: `npm run build` lalu `npm start` = vite preview) |
| rjfm | `/rjfm` + `/file` | 8011 | Express TS API + Next UI (ui-app) | `cd "Module Services/rjfm" && npm start` (`tsx src/server.ts`; `--loader tsx` TIDAK dipakai lagi — tsx ≥4 wajib `--import`/CLI langsung) |
| sql-gateway | `/sql-gateway` + `/api/sql-gateway` | 8001 (legacy port takeover) | Fastify TS API + static UI | `cd "Module Services/sql-gateway" && bun start` |
| daftar-upah | `/upah` + `/backend/upah` | 3104 | Bun/Elysia API + built Vite SPA (one process) | `cd "Module Services/daftar-upah" && npm start` |
| Wifi_LAN_Monitor | `/network-monitor` | — | static site | served by gateway (`staticSiteDir`) |
| ifess-server (iFESS Control Server + UI) | `/ifess-control` + `/api/ifess/*` (+ `/api/clients` bare SuperApp wire) | 8003 (legacy ControlServer port takeover — NOT 8012, that is rjfm's private UI) | Bun HTTP: unified frontend + control-plane API, owns `src/core/service.cjs` + `src/lib/authkit/` copies | `cd "Module Services/ifess-server" && bun start` |
| ifess-control UI (legacy static copy) | `/ifess-control` | — | static HTML | until cut-over completes the gateway still disk-serves `Module Services/ifess-control/`; canonical serving = ifess-server :8003 |
| Firebird query gateway | `/api/query-gateway/*` | embedded | Bun handler | inside `server_bun.js` (`execLocalQuery` → isql.exe); job/command bookkeeping also mirrored in ifess-server |

### Registered external services (source outside this repo — do NOT move)

| Route | Port | Source location |
|---|---|---|
| `/absen` | 5176 | external Vite dev server |
| `/monitoring-beras` | 5177 | external Vite dev server |
| `/basis-panen` | 3002 | external PWA |
| `/file-legacy` | 5178 | Gdrive Gateway (legacy) |

> Former external SQL Gateway (`/query` :8001, `D:/Tools_Gawe/Database_Query_Gateway`)
> has been migrated in-repo as `Module Services/sql-gateway` — it took over port
> 8001 and still answers the legacy `/query/v1/*` path shape.

> Daftar Upah (`/upah`, previously external at :8002 pointing to
> `PORTAL_ESTATE/.../refactor_production`) has been migrated in-repo as
> `Module Services/daftar-upah` (:3104) on 2026-08-24. Snapshot of
> `PORTAL_ESTATE/V 2 (begin versioning)`; sync changes from that source into the
> module folder.

---

## 4. Auth center (gateway)

```
POST :3001/login (Dashboard_Utama /api/auth/login)
  └─ MSSQL extend_db_ptrj: user_ptrj verify → sign RS256 JWT (keys/private.pem)
     └─ Set-Cookie: auth-token (httpOnly)

Any request via :3001
  ├─ gateway extracts cookie → verifyJWT() (shared/auth/jwt.js, keys/public.pem)
  ├─ public route? pass · protected & no valid token? 302 /login (or 401 JSON)
  └─ proxied to module WITH injected headers (inbound x-user-* STRIPPED first):
       X-User-Id, X-User-Name, X-User-Email, X-User-Role

Module direct-port access (bypasses gateway):
  └─ module verifies the same cookie itself with keys/public.pem
     (report-center does this today; same key file = SSO works both ways)
```

Rules:
- **One credential store:** MSSQL `extend_db_ptrj` (`user_ptrj`, `role_service_permission.role`, `AccessControl`). Admin panel manages it.
- **Machine-to-machine** calls use env-sourced API keys (`IFESS_API_KEY`, `QUERY_API_KEY`, `IFESS_CLIENT_API_KEY`) — unchanged by SSO.
- **Never spoofable:** clients cannot set `X-User-*`; the gateway deletes inbound copies before injecting verified values.

### Module auth kit (`shared/authkit/`)

Ready-made functions for any module to consume the auth center — **copy the
file into your module** (isolation rule: no cross-module imports), zero deps:

| Function | Use |
|---|---|
| `verifyGatewayIdentity(headers)` | Trust gateway-injected `X-User-*` (proxy mode) |
| `verifyPortalCookie(token)` | Verify RS256 portal JWT with repo `keys/public.pem` (direct-port mode); cached |
| `resolveIdentity({ headers, cookie })` | Both modes in one call |
| `requireAuth({ roles })` | Express middleware: 401/403 + `req.user` |

See `shared/authkit/README.md` for trust rules.

## 5. Performance rules

- Every user-facing page ships a `loading.tsx` skeleton (no blank screens).
- Proxy responses: hashed assets `immutable`; HTML `no-cache`; text GETs of
  registered SPA routes cached in gateway LRU where safe.
- DB access goes through the shared pool (`max: 10`); no N+1 loops on page render —
  batch with a single query when assembling Maps.
- Static assets of modules are served by the module itself; gateway streams them
  with correct `Cache-Control`.

## 6. Maintenance rules

- One concern per module; changes in a module must never require touching another.
- Gateway changes: keep handlers small; shared logic lives in `shared/auth` / `shared/monitoring`.
- Docs live in `docs/` — update the registry tables here when adding/removing routes.
- Hot-reload: `routes-config.json` edits apply without gateway restart (rewrite regex + static roots rebuild with it).
