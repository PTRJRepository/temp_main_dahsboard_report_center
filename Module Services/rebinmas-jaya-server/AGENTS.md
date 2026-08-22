# Module Context — rebinmas-jaya-server

You (an agent) are working inside `Module Services/rebinmas-jaya-server`, one module of
the Main Dashboard monorepo. Read this before changing anything.

## Dual access — every module has TWO ways to be reached

| Mode | URL | Auth |
|---|---|---|
| **Direct** (independent) | `http://localhost:3102` | This module verifies the shared RS256 cookie itself (`keys/public.pem` at repo root) or its own login page |
| **Via gateway proxy** | `http://localhost:3001/server-monitor` | The Bun gateway (`server_bun.js`) already verified the cookie and forwards identity headers: `X-User-Id`, `X-User-Name`, `X-User-Email`, `X-User-Role` |

Rules that follow:
- NEVER trust raw inbound `X-User-*` headers on direct port — only the gateway
  can set them legitimately (it strips inbound copies before injecting).
- Keep both paths working. A change that breaks direct-port access breaks
  standalone operation.
- This module runs on ITS OWN PORT and must start with zero other processes.
  The main dashboard does NOT auto-start modules — each is started/stopped
  independently (`node scripts/module.js start rebinmas-jaya-server` from repo root).

## Isolation contract

- Never import from another module or from Dashboard_Utama source. Shared code =
  copy into this module's own `utils/`/`lib/`.
- Route registration lives in `routes-config.json` at repo root (hot-reloaded).
  This module's path must NOT appear in `shared/auth/paths.js` DASHBOARD_PATHS.
- Full platform rulebook: repo root `docs/MONOREPO.md`. Service registry +
  ports table live there.

## This module

- Port **3102** · Vite React SPA · route id `server-monitor`
- Start: `npm run dev` / `npm start` (see package.json)
- Health: page `/server-monitor` returns 200 with a valid session; API under
  `/api/reports/*` returns 401 without.
- Gateway status probe: `GET :3001/api/services/status` lists up/down for all routes.
