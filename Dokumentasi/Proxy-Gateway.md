# Proxy Gateway Layer — Deep Dive

> Two gateway implementations serve the SAME responsibilities. `server_bun.js` (ACTIVE, Bun native HTTP) is the live gateway. `server.js` (LEGACY, Express) is equivalent and still present.

## 1. Dual-Mode Deployment
| Aspect | Standalone (Bun) | Docker (Next.js only) |
|--------|------------------|------------------------|
| Process | `server_bun.js` `Bun.serve()` on `:3001` (override `PORT`) | nginx `listen 80` (container) published **:8080** on host; Next.js on `:3001` |
| Upstream | spawns Next.js at `127.0.0.1:3100` (`START_DASHBOARD`), or skipped with `START_DASHBOARD=false` | nginx upstream `app:3001` |
| Next.js | spawned by gateway, or external | built image |
| Auth/rewrite | gateway-owned | nginx passes through to Next.js |

## 2. Proxy Flow (server_bun.js)
1. Short-circuit `/api/ifess`, `/api/routes`, `/api/auth`, `/api/reports`, `/api/services` (skip proxy).
2. Match path against enabled routes — **longest path first**.
3. Rewrite content for HTML/JS/CSS (replace target URLs with proxy paths). `rewriteContent`: `true` (all text) / `false` (passthrough) / `'html-only'`.
4. Stream static assets via static bypass (`serveLocalFile`, `:3911`).

**Static roots** (`DEFAULT_STATIC_ROOTS`, `:3209`): `{prefix:'/ifess-assets', dir: public/ifess-assets}` plus route `staticRoots`. HTML served `no-cache`; assets `max-age=3600` (or immutable if filename carries `-[hash]`).

**Hot-reload**: `server.js` uses `fs.watchFile` on `routes-config.<env>.json` (env fallback `routes-config.json`, `:88`). `server_bun.js` loads routes startup-only, sorted + alias-expanded (`:3063`).

## 3. server_bun.js vs server.js
| Field | `server.js` (LEGACY) | `server_bun.js` (ACTIVE) |
|-------|----------------------|--------------------------|
| Runtime | Express + `http-proxy-middleware` | Bun `Bun.serve` native HTTP |
| IFESS/Query | mounts `Services/ifess-control-server/routes` at `/api/ifess`; query via proxy | **bundled** as native handlers |
| Route load | hot-reload via `fs.watchFile` | startup-only, sorted, alias-expanded |
| Rewrite impl | `selfHandleResponse` regex over chunks (`:326`) | `rewriteBody()` regex over buffered text (`:3105`) |
| Auth cookie | strips `auth-token` before `:8002` backend | JWT `auth-token` via `verifyJWT` |
| Dashboard spawn | `next` required (`nextHandle`, `:809`) | `startDashboardIfNeeded()` via `Bun.spawn` (`:3356`) |
| Module services | none | `startModuleServicesIfNeeded()` (`:3482`, e.g. server-monitor :3000) |
| Extras | `/config-path` UI, `server.on('upgrade')` ws | LAN discovery, `/api/monitoring/*`, `/__gateway/health`, `server.upgrade` ws |

`startDashboardIfNeeded()` (`:3356`): no-op if `DASHBOARD_TARGET` already up; else `Bun.spawn([bun,'run','dev','start','-p',3100])`, waits up to 30×500ms, kills child on exit.

## 4. routes-config.json Schema
| Field | Meaning |
|-------|---------|
| `id` | cache key |
| `path` | public proxy prefix (`/upah`, `/absen`, `/ifess`) |
| `target` | upstream URL or `static://<name>` |
| `description` | human label |
| `enabled` | `false` → dropped at load |
| `rewriteContent` | `true`/`false`/`'html-only'` |
| `rewritePath` | `false` → keep prefix on upstream |
| `changeOrigin` | proxy header behavior |
| `public` | `true` → no auth gate |
| `aliases` | extra public paths (rewritePath:false) |
| `apiPrefixes` | documented API sub-paths |
| `textRewrites` | `[{from,to}]` literal substitutions |
| `staticRoots` | `[{prefix,dir,immutable}]` local mount |
| `spaIndex` | SPA `index.html` for client routes |
| `servicePath`/`serviceUrl` | monitoring metadata |
| `staticSiteDir` | dir for `static://` routes |
| `healthPath`/`timeoutMs`/`cachePolicy`/`image`/`hidden` | monitoring/UI metadata |

Targets map to sibling services: `:8002` upah, `:5176` absen, `:5177` monitoring-beras, `:5178` file, `:8003` ifess, `:8001` query, `:3000` server-monitor.

## 5. Gateway ↔ Next.js Integration
- `START_DASHBOARD=false` skips spawning Next.js (avoids 503s from `startDashboardIfNeeded`/`prewarmConnections` hanging).
- **Port 3001 zombie**: a `bun.exe` on the Services session often holds 3001 ("access denied", unkillable from Console) → free the process and keep using canonical `PORT=3001`.
- Direct IFESS analytics UI served by the Bun gateway (before proxy): `/ifess-control[/app,/simple]` → `ifess-app.html` / `ifess-simple.html`; `/ifess-assets/*` → static.

## 6. nginx (Docker)
`Dashboard_Utama/nginx/conf.d/rebinmas.conf`: `listen 80` published as `:8080`; upstream `app:3001`; static/cache rules. No app logic — all inside Next.js.

## 7. Key Files
- `server_bun.js`: `startDashboardIfNeeded:3356`, `startModuleServicesIfNeeded:3482`, `rewriteBody:3105`, `DEFAULT_STATIC_ROOTS:3209`, `serveLocalFile:3911`, route load `:3063`
- `server.js`: `nextHandle:809`, proxy `:326`, `:633` routes mount, `:830` ws upgrade
- `routes-config.json`, `routes-config.production.json`
- `Dashboard_Utama/nginx/conf.d/rebinmas.conf`
