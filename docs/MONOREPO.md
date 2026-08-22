# MONOREPO — Module Platform Rulebook

**Last updated:** 2026-08-22
Single source of truth for how services are organized, run, routed, and authenticated in the PT Rebinmas Main Dashboard monorepo.

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
        ▼               ▼           ▼                ▼             ▼
  Dashboard_Utama  report-center rjfm        file-manager   external services
  :3100 (portal,   :3101         :8011       :3103          upah :8002 · absen :5176
  admin, landing,  (Next)        (Express)   (Next)         monitoring-beras :5177
  file stubs)                                              basis-panen :3002 · query :8001
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
| rebinmas-jaya-server | `/server-monitor` | 3102 | Vite React SPA | `cd "Module Services/rebinmas-jaya-server" && npm run dev` |
| file-manager | `/file` | 3103 | Next.js 16 | `cd "Module Services/file-manager" && bun start` |
| rjfm | `/rjfm` | 8011 | Express TS API | `cd "Module Services/rjfm" && npm start` |
| Wifi_LAN_Monitor | `/network-monitor` | — | static site | served by gateway (`staticSiteDir`) |
| ifess-control UI | `/ifess-control` | — | static HTML | served by gateway from `Module Services/ifess-control/` |
| IFESS control server | `/api/ifess/*` | embedded | JS lib | `require()`d into gateway process (`Services/ifess-control-server/service.js`) |
| Firebird query gateway | `/api/query-gateway/*` | embedded | Bun handler | inside `server_bun.js` (`execLocalQuery` → isql.exe) |

### Registered external services (source outside this repo — do NOT move)

| Route | Port | Source location |
|---|---|---|
| `/upah` (+ `/backend/upah`) | 8002 | `D:/Gawean Rebinmas/PORTAL_ESTATE/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production` (Vite dist + Python backend) |
| `/absen` | 5176 | external Vite dev server |
| `/monitoring-beras` | 5177 | external Vite dev server |
| `/basis-panen` | 3002 | external PWA |
| `/query` | 8001 | SQL Gateway API (external process) |
| `/file-legacy` | 5178 | Gdrive Gateway (legacy) |

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
