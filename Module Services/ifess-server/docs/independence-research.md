# iFESS Server Independence — Research Findings
> Generated 2026-08-25T15:34:30.782Z by workflow wf_ab2baf1d-a08 (5 deep-readers + synthesis + verify)

## RULEBOOK

MODULE-SERVICE RULEBOOK (Main Dashboard monorepo) — every rule evidenced by repo files/docs; citations are file:line. Canonical sources: docs/MONOREPO.md (updated 2026-08-24), root CLAUDE.md, per-module AGENTS.md/CLAUDE.md, and verified code.

A. ISOLATION & OWNERSHIP
1. Each module is its own runnable app under `Module Services/<name>/` owning its directory, its own package.json (name = module name, own dev/start/build scripts), and its own unique port (docs/MONOREPO.md:82–88; CLAUDE.md:20–21).
2. No cross-boundary imports: modules never import from Dashboard_Utama internals, never import each other's source, and never import `@modules/*` or paths outside their folder. Shared code = COPY into the module (`src/lib/`, `utils/`) (MONOREPO.md:87; rebinmas-jaya-server/AGENTS.md:24–25, report-center/AGENTS.md:24–25, rjfm/AGENTS.md:24–25, daftar-upah/AGENTS.md:35–36; rjfm/CLAUDE.md "ATURAN EMAS": no RJFM file may exist outside `Module Services/rjfm/`). Exception: Dashboard_Utama imports modules only via the `@modules/*` alias (CLAUDE.md:18–22).
3. Single source of truth + stub rule: pages/API handlers live in the module; Dashboard_Utama holds thin re-export stubs. Route segment configs (`dynamic`, `runtime`, `dynamicParams`, `generateStaticParams`) must NOT be re-exported — Turbopack fails with "It mustn't be reexported"; stubs declare their own segment config inline (CLAUDE.md:28–35; MONOREPO.md:104–106).
4. One concern per module: changes in a module must never require touching another (MONOREPO.md:202). Build mechanics enabling isolation: root npm workspaces glob `Module Services/*` (package.json:6–9), `turbopack.root` = repo root (Dashboard_Utama/next.config.js:24–26), and the gitignored `Module Services/node_modules` symlink → `../Dashboard_Utama/node_modules` recreated per machine (MONOREPO.md:90–96). Do NOT retry Turbopack `resolveAlias` for out-of-root paths — it is broken (MONOREPO.md:98).

B. STANDALONE STARTABILITY
5. Running `<runner> start/dev` inside the module dir must work with ZERO other processes — no gateway, no Dashboard_Utama (MONOREPO.md:85; every AGENTS.md "runs on ITS OWN PORT and must start with zero other processes"). Modules keep their own `.env`, `data/`, and logs strictly inside their folder (rjfm/CLAUDE.md; DU backend/.env pins PORT=3104, loaded before any other code — DU/backend/src/config.ts:3–9).
6. The gateway NEVER spawns modules: `startModuleServicesIfNeeded()` is a documented no-op (server_bun.js:1133–1138; START_MODULE_SERVICES default false, MONOREPO.md:27–29). Lifecycle is manual/bulk: `node scripts/module.js start|stop|list|status <name>` (scripts/module.js:5–9, 99–110; detached spawn + log to logs/module-<name>.log, module.js:71–75) and the central launcher `scripts/start-module-services.ps1` via root npm `start:modules|dev:modules|status:modules|stop:modules` (package.json:25–28), which skips occupied ports, builds-on-missing-marker in prod mode, waits ≤40 s for the port, and persists the real port-owner PID to `logs/modules/module-pids.json` (ps1 Start-Service flow). `stop:modules` never touches gateway :3001.

C. DUAL REACHABILITY
7. Every service is reachable BOTH directly on its port AND through the gateway proxy route; "a change that breaks direct-port access breaks standalone operation" (CLAUDE.md:26–27; dual-access table in each AGENTS.md). Proven patterns: mount routers under multiple prefixes so one codebase answers direct and proxied shapes identically (rjfm mounts health + every router under '', '/rjfm', '/file' — rjfm/src/server.ts:28–53; daftar-upah mounts every router bare AND under `/backend/upah` group; sql-gateway keeps legacy alias `/query` alive for old callers). Ship a public unauthenticated `/health` that also answers under proxied prefixes.
8. Routes come from `routes-config.json` (hot-reloaded ~every 5 s on mtime change; aliases expand to hidden clones; longest-path-first) and `routes-config.production.json` must carry the SAME registrations (MONOREPO.md:103,205). Gateway flow: skip-list/local handlers first, then match enabled routes; rewrite HTML/JS/CSS when configured; stream static assets (CLAUDE.md:195–200).

D. PORT REGISTRY
9. Port MUST equal the `routes-config.json` target — enforced as convention in the launcher ("# Port WAJIB sama dengan target di routes-config.json", start-module-services.ps1:53) and stated as hard rule in MONOREPO.md:45–46. Current in-repo map: gateway 3001 · portal 3100 · report-center 3101 · server-monitor 3102 · rjfm 8011 (private internal UI 8012, single-public-port rule — rjfm/CLAUDE.md "❌ Membuat port kedua untuk UI"; rjfm/src/ui/serve.ts:71) · sql-gateway 8001 (legacy takeover, still answers /query/v1/*) · daftar-upah 3104 (launcher forces PORT=3104 over internal 8002) (MONOREPO.md:118–149).
10. New modules pick the next free port ≥3100 (MONOREPO.md:102); taking over a former EXTERNAL port is allowed only as a deliberate migration (sql-gateway ← 8001, MONOREPO.md:141–143). Bind 0.0.0.0 for LAN (MONOREPO.md:84); port is env-overridable with a hardcoded sane default (sql-gateway config.ts:125–128; rjfm env.ts:10; ifess-server config.js:38). CAUTION (verified): two defaults may collide — rjfm's PRIVATE loopback UI port and any other service claiming 8012.
11. Three hand-maintained tooling registries must all agree: `routes-config.json` (reachability + `/api/services/status`), `scripts/module.js` MODULES (module.js:24–31; port auto-derived from the named route's target, module.js:37–40), and `start-module-services.ps1` $MODULES (ps1:54–79). They have already diverged historically (module.js knows ifess-server but not sql-gateway; ps1 vice versa).

E. AUTH CENTER + AUTHKIT
12. Auth center = gateway. ONE login: POST :3001/login verifies against MSSQL `extend_db_ptrj`, signs RS256 JWT with `keys/private.pem`, sets httpOnly cookie `auth-token`. Any request via :3001: gateway strips inbound `x-user-*` headers, verifies the cookie (`shared/auth/jwt.js`, `keys/public.pem`), and injects verified `X-User-Id/Name/Email/Role` into proxied requests (MONOREPO.md:153–174; CLAUDE.md:59–63). Credential store is ONE MSSQL DB managed by the admin panel (MONOREPO.md:172).
13. NEVER trust raw inbound `X-User-*` headers on a directly-exposed port — only the gateway may set them (all AGENTS.md; MONOREPO.md:174). Strictest reference implementation: sql-gateway accepts X-User-* ONLY from loopback peers and records `spoof-attempt` otherwise (SQLGW/src/plugins/auth.ts:43–46, 100–122).
14. Direct-port SSO: the module verifies the SAME RS256 portal cookie itself using `keys/public.pem` (MONOREPO.md:166–168). Any module-local copy of public.pem must match the gateway's byte-for-byte (daftar-upah/AGENTS.md:42–43).
15. Authkit is copy-per-module, zero-dependency: copy `shared/authkit/index.js` into your module (its own header says "Copy this file into a module… do NOT import across modules"); exports `verifyGatewayIdentity(headers)`, `verifyPortalCookie(token)` (RS256 pinned, keys dir found by walking ≤6 parents, exp−5 s cache), `resolveIdentity({headers,cookie})`, `requireAuth({roles})` Express middleware (MONOREPO.md:176–188; rjfm vendored copy at rjfm/src/lib/authkit/, used by middleware/auth.ts:54–74). Recommended resolution order (exemplars): gateway headers (loopback-checked) → static `x-api-key` m2m key (timing-safe compare) → portal RS256 cookie → optional own HS256 session/login; 401 vs 403 semantics; m2m surfaces fail CLOSED (503) when the key env is unset (rjfm/src/middleware/apikey.ts:15–30).
16. Machine-to-machine calls keep env-sourced API keys (`IFESS_API_KEY`, `QUERY_API_KEY`, `IFESS_CLIENT_API_KEY`) — unchanged by SSO (MONOREPO.md:173; CLAUDE.md:263–266: all non-public iFESS endpoints require `X-API-Key`).

F. ACCESS KEYS & SECRETS
17. One shared access-key file `keys/report-center-access.key` (gitignored; rotate by editing): login with any username + key as password ⇒ ADMIN session without DB lookup; ALL module services read the SAME file (CLAUDE.md:36–38). `keys/` holds JWT RSA keypairs + this file; never commit `keys/`, `.env`, `.env.local` (CLAUDE.md:72, 305–309). Module envs are module-local, gitignored, loaded first (DU config.ts:3–9; rjfm `import 'dotenv/config'`).

G. NEW-MODULE REGISTRATION CHECKLIST (canonical, MONOREPO.md:100–110, cross-checked against code)
18. (1) `mkdir "Module Services/<name>"` + package.json with own scripts and a unique port (≥3100 or deliberate legacy takeover); (2) add route entries to BOTH `routes-config.json` AND `routes-config.production.json` (hot-reload makes dev effective in ~5 s; launchers do NOT hot-reload); (3) if Next.js standalone: `turbopack.root`=repo root + `assetPrefix=/<path>`, thin stubs in Dashboard_Utama (never re-export segment configs); (4) keep the path OUT of `shared/auth/paths.js` DASHBOARD_PATHS or the gateway sends it to DASHBOARD_TARGET instead of the route table (CLAUDE.md:55–57; MONOREPO.md:107–108). Nuance verified: DASHBOARD_PATHS (shared/auth/paths.js:11) currently lists gateway-LOCAL surfaces (`'/admin','/dashboard','/dashboard-user','/modules','/api/services','/ifess-control','/api/ifess','/api/query-gateway','/config-path'`) — the rule means: once a path is delegated to a module route, remove it here; (5) accept gateway identity headers + optional direct-port login; (6) add rows to the registry tables in docs/MONOREPO.md and root CLAUDE.md (MONOREPO.md:110, docs duty MONOREPO.md:204). Additionally register in `scripts/module.js` MODULES and `scripts/start-module-services.ps1` $MODULES (item D11), and ship an `AGENTS.md` (convention: every module has one — 4 exist) following the template: golden isolation rule, dual-access URL table with per-mode auth, port, commands, storage locations, forbidden actions.

H. SHARED-DATA RULES
19. Repo-root `data/ifess/*.json` is the LIVE iFESS control-plane store (`clients, configs, commands, module-statuses, heartbeat-logs, client-groups, audit-logs, query-batches, query-jobs, query-results, query-result-chunks, query-templates`) (CLAUDE.md:283–285; store path defined at Services/ifess-control-server/service.js:22 `path.join(__dirname,'../../data/ifess')`; dir verified on disk). `query-templates.json` is edited directly; `DEFAULT_QUERY_TEMPLATES` in the service is seed-only, never synced (CLAUDE.md:243–249). Modules otherwise keep their OWN `data/` inside their folder (rjfm data/rjfm-demo.json fallback); launcher artifacts go to `logs/modules/` (MONOREPO.md:12–13); remote storage must be explicitly configured (rjfm NAS DSM env vars) with non-blocking, failure-tolerant background init (rjfm/server.ts:69–71; DU index.ts:148–152).
20. All report/DB SQL is read-only (`validateReadOnlySql`); db_ptrj/db_ptrj_mill are never written (CLAUDE.md:209, 308).

I. NAMING & STYLE
21. Folders/routes/report IDs: kebab-case (CLAUDE.md:206; existing mix tolerates `Wifi_LAN_Monitor`); package name = module name (MONOREPO.md:83); TypeScript strict, 2-space indent, single quotes, PascalCase components, camelCase functions (CLAUDE.md:204–208); prefer existing helpers over duplicating logic.
22. Ops duties attached to every module: public `/health` reachable direct and proxied; graceful SIGTERM/SIGINT shutdown + unhandledRejection logging (SQLGW index.ts:72–88); serve your own static assets in-process on ONE public port (never a second public port for UI); frontend base path must survive the gateway subpath (DU vite getBasePath() → '/upah/').

VERIFICATION NOTES (corrections to received reports): (a) `routes-config.production.json` contains NO ifess-control/api-ifess :8012 entries — only a legacy `{id:"ifess", path:"/ifess", target:"http://localhost:8003"}` at routes-config.production.json:171–179; (b) `DASHBOARD_PATHS` DOES contain '/ifess-control' and '/api/ifess' today (shared/auth/paths.js:11) because they are gateway-local surfaces, consistent with rule 18's nuance; (c) direct Firebird isql execution no longer exists ANYWHERE: grep counts for `execLocalQuery`/`isql` in server_bun.js and Services/ifess-control-server/service.js are all 0 — gateway `/api/query-gateway/*` merely proxies to `FIREBIRD_QUERY_TARGET` :8004 (server_bun.js:60), which has no in-repo owner; root CLAUDE.md's Firebird-executor section is stale documentation.

## GAPS / CUT-OVER PLAN

GAPS — making `Module Services/ifess-server` a FULLY independent module (own UI + control-plane API, runnable without the gateway), ordered so the system works at every intermediate point.

STARTING STATE (verified): the module already runs alone on 0.0.0.0:8012 (`bun run src/index.js`, package.json:8–10, config.js:38), serves the unified UI itself (handler.js:380–399), implements the full control-plane REST + dispatcher over the canonical CJS core (src/service.js:27–30 bridging Services/ifess-control-server/service.js), and shares the live JSON store at repo-root data/ifess (canonical service.js:22). Meanwhile the gateway still hosts the SAME surface in-process: `require('./Services/ifess-control-server/service')` (server_bun.js:30), local handlers (server_bun.js:380–513), action dispatcher (:136–281), sync REST (:515–640), `/api/clients`→`/api/ifess` rewrite (:1596–1598 area), and disk-serving of the UI (server_bun.js:66, 1767–1774, 894–897).

PHASE 0 — Resolve the port collision FIRST (blocks everything)
G1. Default port 8012 collides with rjfm's PRIVATE loopback UI port (`RJFM_UI_PORT || '8012'`, rjfm/src/ui/serve.ts:71) bound as 127.0.0.1:8012 whenever rjfm runs; ifess-server binding 0.0.0.0:8012 (index.js:30, config.js:38) then fails with EADDRINUSE — and worse, the `ifess-control` route target `http://localhost:8012` (routes-config.json:127) can misroute onto rjfm's UI. Fix: move ifess-server to the next free port ≥3100 per MONOREPO.md:102 (recommend 3105) — change the default in config.js:38 and the targets in routes-config.json:127,136. Do NOT touch rjfm's 8012 (rule: one-concern-per-module, MONOREPO.md:202). Update README.md:10 (it wrongly says "`PORT` env overrides"; code honors `IFEFF`-prefixed `IFESS_PORT`, config.js:36–38). Intermediate state: gateway unaffected (it ignores the route for API paths anyway, see G6); module direct-access simply moves ports.

PHASE 1 — Make the module self-contained CODE-wise (no behavior change; both processes keep sharing the store)
G2. Relocate canonical logic (bridge → owned copy): copy `Services/ifess-control-server/service.js` (~1995 lines) into the module (e.g. `Module Services/ifess-server/src/core/service.cjs`) and require the LOCAL copy from src/service.js:27–30. This satisfies the no-cross-module-import rule (MONOREPO.md:87; rjfm golden rule) — importing `../../../Services/…` escapes the module exactly like the forbidden `../../../shared/authkit` pattern. CRITICAL: DATA_DIR is resolved from the core's own `__dirname` (`path.join(__dirname,'../../data/ifess')`, canonical service.js:22) — after copying, patch the copy to accept an env override (`IFEFF_DATA_DIR`/`IFESS_DATA_DIR`) defaulting to repo-root `data/ifess`, so the store stays shared during transition (rule H19: data/ifess IS the live store; CLAUDE.md:283–285).
G3. Copy `shared/authkit/index.js` into `Module Services/ifess-server/src/lib/authkit/` and repoint the import at handler.js:43 (currently imports the shared original — violates the copy-per-module convention, MONOREPO.md:176–188; follow rjfm's vendored pattern incl. .d.ts/README).
G4. Fix syncBootstrap/FB_Migration (gateway-only capability that would be lost at cut-over): handler.js:218 resolves `../../../FB_Migration/src/migrate.js` → `Main Dashboard/FB_Migration/src/migrate.js` which does NOT exist (verified absent; real location is OUTSIDE the repo at `D:/Gawean Rebinmas/FB_Migration/src`, verified present). Gateway gets this right via `ROOT_DIR/../FB_Migration` and propagates DB env vars into the child (server_bun.js:646–656); the module's spawn passes NO env (handler.js:225). Fix path to `../../../../FB_Migration/src/migrate.js` + pass `{env:{...process.env, DB_NAME/DB_SERVER/DB_PORT/DB_USER/DB_PASSWORD}}` mirroring server_bun.js:648–656, or return 501 for `syncBootstrap` until migrated. Also replace the bare `require('node:child_process')` in ESM (handler.js:216–217) with `createRequire` for Node compatibility.

PHASE 2 — Own the static UI
G5. Today the UI is served from the SIBLING module `Module Services/ifess-control` (`UI_DIR = IFESS_UI_DIR || REPO_ROOT/'Module Services/ifess-control'`, config.js:47) — a cross-module dependency; the gateway independently disk-serves the same folder (server_bun.js:66, 1767–1774; asset root :895) with process-lifetime HTML caching (:50–51). Move `app/`, `simple/`, `assets/` INTO the module (e.g. `ui/`), default `UI_DIR` to the module-local path (config.js:47), then retire the sibling folder. Harden `src/static.js:41` traversal guard (prefix check lacks trailing-separator handling) and add mtime-based cache invalidation (static.js:6–8 caches buffers forever — restart needed to see edits). Keep the gateway's hardcoded `/ifess-control` disk-serving UNTOUCHED during this phase — it reads the same files from disk and keeps working regardless of which folder owns them.

PHASE 3 — Gateway cut-over (ONE coordinated change-set; route table becomes authoritative)
G6. Enable delegation: delete the `matchRoute` skip `if (urlPath.startsWith('/api/ifess')) return null;` (server_bun.js:853) — it is why the `api-ifess` route (routes-config.json:134–141 → :8012/3105) is present-but-unreachable. Remove the early fetch intercepts for `/api/clients`, `/api/ifess` (incl. `/sync/` and `/query-gateway` sub-branches) and `/api/query-gateway` (server_bun.js:1576–1594 region), then delete the now-orphaned gateway-local handlers: `handleIFESSApi` (:380–513), `handleIFESSActionDispatcher` (:136–281), the sync REST subset `handleQueryGateway` (:515–640), and the dead `proxyFirebirdQueryService` + `FIREBIRD_QUERY_TARGET` (:60, :1247–1271) — nothing in-repo listens on :8004, so that proxy only ever yields 503. The module already answers BOTH bare and `/api/ifess`-prefixed shapes (regexes `^\/api(?:\/ifess)?\/…`, handler.js:448/455/464/470/480/495), and `/api/clients*`, so add one gateway route `{id:'api-clients', path:'/api/clients', target:http://127.0.0.1:<port>}` for Kerani SuperApp instead of keeping the gateway rewrite.
G7. Reaper single-ownership: gateway reaps every 30 s (`ifessService.reapStaleCommands(120)`, server_bun.js:682–688) while the module reaps every 60 s (`svc.reapStaleCommands()`, index.js:61–67) — two processes mutating one JSON store. Remove the gateway reaper in the SAME change-set as G6/G8 (until then the overlap is tolerated but redundant).
G8. Drop the in-process service: remove `const ifessService = require('./Services/ifess-control-server/service')` (server_bun.js:30) once G6–G7 leave zero remaining `ifessService.*` call sites (handlers, dispatcher, sync REST, reaper, spawnFbMigration :646–680 — whose job G4 moved into the module).
G9. UI routing authority: remove the gateway's hardcoded `/ifess-control` HTML branches (server_bun.js:1767–1774) and the `ifessAppHtml/ifessSimpleHtml` caches (:50–51) so the `ifess-control` route (routes-config.json:122–132) proxies the UI to the module like every other module (dual reachability per rulebook C7). Keep `/ifess-assets` static root (:895) only if the HTML references it; otherwise drop it with the sibling folder (G5). Preserve the API-key exemptions ordering for client RPC paths (:1731–1733) accordingly.
G10. Auth/path-table cleanup: after delegation, REMOVE '/ifess-control' and '/api/ifess' from `DASHBOARD_PATHS` (shared/auth/paths.js:11) per CLAUDE.md:55–57 / MONOREPO.md:107–108, else the dashboard-upstream check (isDashboardPath, server_bun.js:~1777) can shadow the route table. Decide '/api/query-gateway': recommend routing it to the module's management API (same surface implemented at handler.js:244–328) and deleting the gateway branch, removing it from DASHBOARD_PATHS too. Auth center unchanged: gateway still verifies the RS256 cookie and injects X-User-*; module's `resolvePortalIdentity` (handler.js:71–76 via authkit resolveIdentity) already accepts both proxy headers and direct-port cookies. Optional hardening while bound 0.0.0.0: adopt sql-gateway's loopback-only trust for inbound X-User-* (SQLGW plugins/auth.ts:43–46,100–122) since the module currently accepts them from any peer.
G11. Production parity + observability + registration: (a) ADD `ifess-control` + `api-ifess` (+ `api-clients`, `api-query-gateway` if chosen) entries to `routes-config.production.json` — verified ABSENT today; the file still carries only the stale legacy `{id:"ifess", path:"/ifess", target:"http://localhost:8003"}` (production.json:171–179); required by MONOREPO.md:103. (b) Make the module visible to `/api/services/status`: the probe only includes non-hidden http targets whose target string startsWith `'http://127.0.0.1'` (server_bun.js:1677–1678) — write the new routes with `http://127.0.0.1:<port>` (as report-center/file/sql-gateway do) so both routes appear; today both ifess routes are excluded. (c) Add the module to `start-module-services.ps1` `$MODULES` (ps1:54–79; grep confirms NO ifess entry) with `Name='ifess-server'; Dir='Module Services/ifess-server'; Port=<new>; Runner=$BUN; Dev=@('run','dev'); Prod=@('run','start')`. (d) `scripts/module.js:29` already registers it via `route:'ifess-control'` with port auto-derived from the route target (module.js:37–40) — no edit needed beyond confirming the new port flows through. (e) Registry/docs duty: update the MONOREPO.md + root CLAUDE.md tables (MONOREPO.md:110) which still describe the IFESS control server as "embedded" in the gateway (MONOREPO.md registry rows for ifess-control/IFESS control server). (f) Ship `AGENTS.md` for the module (none exists — tree is only package.json, README.md, src/, tests/): golden isolation rule, dual-access table, port, commands, storage, forbidden actions.

PHASE 4 — Hygiene (post-cut-over)
G12. Test isolation: `tests/wire.test.js` exercises the real service against the LIVE store, permanently writing TEST-* clients/commands into `data/ifess/*.json` with no cleanup (wire.test.js:71–141 per deep-read) — enable via the G2 DATA_DIR override pointing at a temp dir before `bun test`.
G13. Documentation truthing: root CLAUDE.md's Firebird Query Gateway section (execLocalQuery/isql/reaper-in-gateway) is stale — grep counts are 0 in server_bun.js and in the service core; `/api/query-gateway/*` is a proxy to unowned :8004 (server_bun.js:60). Rewrite docs to reflect: dispatch-to-client pipeline (commandType EXECUTE_FIREBIRD_QUERY executed on SuperApp desktops, canonical service.js:1565–1595), no server-side SQL execution, and batches staying Pending with no online client. Document `IFESS_CLIENT_API_KEY` in `.env.example` (missing today) and fix the README port-override wording (G1).

WHY THE ORDER IS SAFE: Phases 0–2 touch only the module (gateway behavior byte-identical; both processes share the store so clients/commands stay consistent). Phase 3 is atomic per concern: routes hot-reload in ~5 s (dev table), the module already speaks every path shape the gateway used to answer (bare, /api/ifess-prefixed, /api/clients-rewritten), and the UI keeps working because module-side `serveUi` (handler.js:380–399) and gateway disk-serving read identical content until G9 removes the latter. Portal cards regain ifess visibility only after G11(b), which is why targets must be authored as 127.0.0.1 from the start.

## CLAIMS EXTRACTED

1. GATEWAY HOSTS IFEFF IN-PROCESS: server_bun.js:29-30 contains `const ifessService = require('./Services/ifess-control-server/service');`, loading the entire control-plane state machine into the gateway process.
2. CUT-OVER BLOCKER: server_bun.js:853 — matchRoute() begins with `if (urlPath.startsWith('/api/ifess')) return null;`, which makes the registered api-ifess route (routes-config.json:134-141, target http://localhost:8012) unreachable; all /api/ifess* traffic is intercepted earlier in the fetch handler (~server_bun.js:1576-1594).
3. PRODUCTION TABLE NOT UPDATED: routes-config.production.json has no ifess-control/api-ifess :8012 entries at all — the only ifess-related entry is the stale legacy `{"id":"ifess","path":"/ifess","target":"http://localhost:8003"}` at routes-config.production.json:171-179.
4. PORT COLLISION: Module Services/ifess-server/src/config.js:38 defaults to `parseInt(process.env.IFESS_PORT || '8012')` bound on 0.0.0.0 (src/index.js:30), while rjfm binds its private Next-standalone UI on `parseInt(process.env.RJFM_UI_PORT || '8012')` at 127.0.0.1 (rjfm/src/ui/serve.ts:71-73) — running both services simultaneously conflicts on 8012.
5. CANONICAL LOGIC IS BRIDGED, NOT OWNED: Module Services/ifess-server/src/service.js:27-30 uses createRequire to load `<repo>/Services/ifess-control-server/service.js`, whose DATA_DIR is `path.join(__dirname,'../../data/ifess')` (Services/ifess-control-server/service.js:22) resolving to the shared repo-root store.
6. AUTHKIT IMPORT VIOLATES COPY-PER-MODULE: Module Services/ifess-server/src/handler.js:43 imports `resolveIdentity` from '../../../shared/authkit/index.js' (the shared original) instead of copying it into the module as required by docs/MONOREPO.md:176-179 and as rjfm did (rjfm/src/lib/authkit/).
7. SYNCBOOTSTRAP IS DEAD-ON-ARRIVAL IN THE MODULE: handler.js:218 resolves '../../../FB_Migration/src/migrate.js' to Main Dashboard/FB_Migration/src/migrate.js which does not exist (verified), while the real project is outside the repo at D:/Gawean Rebinmas/FB_Migration/src (verified present); the module's spawn (handler.js:225) also passes no env, unlike the gateway's env-propagating spawnFbMigration (server_bun.js:646-656).
8. UI IS SERVED FROM A SIBLING MODULE: ifess-server config.js:47 defaults UI_DIR to `REPO_ROOT/'Module Services/ifess-control'`, and the gateway independently disk-serves the same folder (server_bun.js:66 IFESS_CONTROL_DIR; :1767-1774 app/simple HTML; :895 /ifess-assets static root) with process-lifetime HTML caches (:50-51).
9. DUPLICATE REAPERS SHARE ONE STORE: the gateway runs `ifessService.reapStaleCommands(120)` every 30 s (server_bun.js:682-688) while the module runs `svc.reapStaleCommands()` every 60 s (Module Services/ifess-server/src/index.js:61-67) — two processes mutating the same data/ifess JSON files.
10. STATUS MONITORING SKIPS IFEFF: /api/services/status only probes non-hidden http targets whose target starts with 'http://127.0.0.1' (server_bun.js:1677-1678), so the ifess routes targeting `http://localhost:8012` (routes-config.json:127,136) are excluded from portal health cards.
11. TOOLING REGISTRIES DISAGREE ON IFEFF: scripts/module.js:29 registers `'ifess-server': {dir:'Module Services/ifess-server', cmd:['bun',['run','src/index.js']], route:'ifess-control'}` with port auto-derived from the route target (module.js:37-40), but scripts/start-module-services.ps1 $MODULES (ps1:54-79) contains NO ifess entry (only report-center, rebinmas-jaya-server, rjfm, sql-gateway, daftar-upah, optional dashboard-portal).
12. DASHBOARD_PATHS CONTAINS THE IFEFF PATHS TODAY: shared/auth/paths.js:11 lists `['/admin','/dashboard','/dashboard-user','/modules','/api/services','/ifess-control','/api/ifess','/api/query-gateway','/config-path']` — per CLAUDE.md:55-57 these must be removed once the paths are delegated to the module route table.
13. NO DIRECT FIREBIRD EXECUTION EXISTS ANYWHERE: grep counts for `execLocalQuery` and `isql` are 0 in server_bun.js and 0 in Services/ifess-control-server/service.js; gateway `/api/query-gateway/*` only proxies to FIREBIRD_QUERY_TARGET default http://localhost:8004 (server_bun.js:60, :1247-1271) which has no in-repo listener, while ifess-server's query-gateway endpoints manage jobs and dispatch EXECUTE_FIREBIRD_QUERY commands to desktop clients without executing SQL locally.
14. TEST SUITE POLLUTES PRODUCTION DATA: Module Services/ifess-server/tests/wire.test.js exercises the real bridged service against the live store, registering TEST-* clients/heartbeats/commands into data/ifess/*.json with no cleanup or temp-dir isolation (wire.test.js:71-141).

## VERIFICATION VERDICTS

(verify agent still running at time of export — re-check claims marked unverified)

## RAW READER REPORTS

# Module Services Rulebook — Extracted Rules (exhaustive)

Sources (all fully read):
- `D:/Gawean Rebinmas/Main Dashboard/docs/MONOREPO.md` — canonical platform rulebook ("Single source of truth", MONOREPO.md:4), Last updated 2026-08-24 (MONOREPO.md:3)
- AGENTS.md found by glob `Module Services/*/AGENTS.md` (4 files): `Module Services/rebinmas-jaya-server/AGENTS.md`, `Module Services/report-center/AGENTS.md`, `Module Services/rjfm/AGENTS.md`, `Module Services/daftar-upah/AGENTS.md`
- `D:/Gawean Rebinmas/Main Dashboard/CLAUDE.md` — "Monorepo Architecture (memory utama)" section CLAUDE.md:13–64 plus related sections
- `D:/Gawean Rebinmas/Main Dashboard/Module Services/rjfm/CLAUDE.md` — module-local golden rule (surfaced during analysis)
- `D:/Gawean Rebinmas/Main Dashboard/shared/auth/paths.js` — actual `DASHBOARD_PATHS` list (verified)

Below, citations use `MONOREPO.md:Lx` (= docs/MONOREPO.md), `CLAUDE.md:Lx` (= root CLAUDE.md), `<module>/AGENTS.md:Lx`.

---

## 1. Isolation rules

**Core statement** — repo is "a monorepo with isolated, independent module services"; each module under `Module Services/` is its own runnable app with NO shared source code with Dashboard_Utama except through the `@modules/*` import alias used for shared components/lib (CLAUDE.md:15–18).

What each module owns:
- "each module owns its `app/`, `components/`, `lib/`, `store/`, `utils/` (auth, jwt, db), and its own port" (CLAUDE.md:20–21).
- Contract table (MONOREPO.md:78–88): own directory `Module Services/<module-name>/`; own `package.json` (name = module name; own `dev`/`start`/`build` scripts); own unique port.

Forbidden imports:
- "Modules never import from Dashboard_Utama internals; Dashboard_Utama imports modules via `@modules/*`" (CLAUDE.md:21–22).
- "No cross-module imports | Modules never import each other's source. Shared code = copy or publish later" (MONOREPO.md:87).
- Per-module restatement: "Never import from another module or from Dashboard_Utama source. Shared code = copy into this module's own `utils/`/`lib/`" (rebinmas-jaya-server/AGENTS.md:24–25; report-center/AGENTS.md:24–25; rjfm/AGENTS.md:24–25; daftar-upah/AGENTS.md:35–36).

rjfm golden rule (strongest phrasing): the module is **100% isolated and self-contained** — ALL code/pages/APIs/config/builds of RJFM must live inside `Module Services/rjfm/`; there must be NO RJFM files outside that folder (not in `Dashboard_Utama/`, not in other modules); other modules may not import from it, and it may not import from other modules or `Dashboard_Utama` (rjfm/CLAUDE.md, "ATURAN EMAS"). Also forbidden: importing `@modules/*` or any path outside the module folder; keeping local `data/`, logs, `.env` strictly inside the module folder (it is intended to become its own git subrepo — no relative paths escaping the folder, deps declared only in its own `package.json`) (rjfm/CLAUDE.md).

Build-system mechanics for isolation:
- npm workspaces at repo root + `turbopack.root = <repo root>` make out-of-root `@modules/*` imports work from Dashboard_Utama (MONOREPO.md:90–91).
- `Module Services/node_modules` is a **symlink → Dashboard_Utama/node_modules** (gitignored — recreate per machine): `cd "Module Services" && node -e "require('fs').symlinkSync('../Dashboard_Utama/node_modules','node_modules','dir')"` (MONOREPO.md:92–96).
- WARNING: "Turbopack `resolveAlias` for out-of-root paths is broken (transitive graph unresolvable). Do not retry." (MONOREPO.md:98).
- daftar-upah variant: `backend/node_modules` and `frontend/node_modules` are **junctions** to the source install at `PORTAL_ESTATE/V 2 (begin versioning)`; recreate per machine with `cmd /c mklink /J <module>\...\node_modules <source>\...\node_modules` (daftar-upah/AGENTS.md:37–40).

Single source of truth / stub rule:
- Module pages/API handlers live in the module; Dashboard_Utama `app/(report-center)/**` and `app/api/reports/**` are thin re-export stubs (`export { default } from '@modules/report-center/...'`) (CLAUDE.md:28–30).
- GOTCHA: Next.js route segment config (`dynamic`, `runtime`, `dynamicParams`, `generateStaticParams`) must NOT be re-exported — Turbopack build fails with "can't recognize the exported field in route. It mustn't be reexported." Stubs re-export handlers/default only; each stub declares its own `export const dynamic = 'force-dynamic'` (and `runtime`) inline (CLAUDE.md:31–35). Repeated in checklist: "never re-export route segment configs" (MONOREPO.md:104–106).

Maintenance corollary:
- "One concern per module; changes in a module must never require touching another." (MONOREPO.md:202).
- Gateway changes: keep handlers small; shared logic lives in `shared/auth` / `shared/monitoring` (MONOREPO.md:203).

---

## 2. Port registry

Hard rule: "Port WAJIB sama dengan target `routes-config.json`: 3101, 3102, 8011, 8001, 3104. `daftar-upah` default internalnya 8002 → launcher memaksa `PORT=3104`." (MONOREPO.md:45–46).

In-repo registry (MONOREPO.md:118–130):

| Module | Path | Port | Kind | Run |
|---|---|---|---|---|
| Gateway itself | `/` | 3001 | Bun server | root `npm start` / `PORT=… START_DASHBOARD=false bun run server_bun.js` |
| Dashboard_Utama | `/dashboard-user` `/admin` `/login` `/config-path` + landing | 3100 | Next.js 16 | spawned by gateway or `cd Dashboard_Utama && npm run dev` |
| report-center | `/report-center` + `/api/reports` | 3101 | Next.js 16 | `bun start` |
| rebinmas-jaya-server | `/server-monitor` | 3102 | Vite React SPA | `npm run dev` (prod: `npm run build` then `npm start` = vite preview) |
| rjfm | `/rjfm` + `/file` | 8011 | Express TS API + Next UI (ui-app) | `npm start` (`tsx src/server.ts`; `--loader tsx` no longer used — tsx ≥4 needs `--import`/direct CLI) |
| sql-gateway | `/sql-gateway` + `/api/sql-gateway` | 8001 (legacy port takeover) | Fastify TS API + static UI | `bun start` |
| daftar-upah | `/upah` + `/backend/upah` | 3104 | Bun/Elysia API + built Vite SPA (one process) | `npm start` |
| Wifi_LAN_Monitor | `/network-monitor` | — | static site | served by gateway (`staticSiteDir`) |
| ifess-control UI | `/ifess-control` | — | static HTML | served by gateway |
| IFESS control server | `/api/ifess/*` | embedded | JS lib | `require()`d into gateway (`Services/ifess-control-server/service.js`) |
| Firebird query gateway | `/api/query-gateway/*` | embedded | Bun handler | inside `server_bun.js` |

Mirrored in CLAUDE.md:41–49 (same table, plus note rjfm internal UI :8012).

External registered services (source outside repo — "do NOT move"): `/absen` :5176, `/monitoring-beras` :5177, `/basis-panen` :3002, `/file-legacy` :5178 (MONOREPO.md:132–139; CLAUDE.md:51–53). Former external SQL Gateway (`/query` :8001 at `D:/Tools_Gawe/Database_Query_Gateway`) migrated in-repo as `Module Services/sql-gateway` — took over port 8001 and still answers legacy `/query/v1/*` shape (MONOREPO.md:141–143). Daftar Upah previously external at :8002 → migrated in-repo to :3104 on 2026-08-24; snapshot of `PORTAL_ESTATE/V 2 (begin versioning)` (MONOREPO.md:145–149).

Ranges: new modules "pick next free port ≥3100" (MONOREPO.md:102). Memory index also notes "ports 3100-3103/8011" historically. Bind rule: bind `0.0.0.0` for LAN (MONOREPO.md:84). rjfm special: UI is reverse-proxied by Express on an internal port 8012, overridable via `RJFM_UI_PORT`; creating a second public port for the UI is FORBIDDEN — UI must go through 8011 (rjfm/CLAUDE.md; CLAUDE.md:46).

Launcher constraints (MONOREPO.md:8–48): central launcher `scripts/start-module-services.ps1` knows every module's port/command/build marker, skips occupied ports, builds prod artifacts if missing, logs to `logs/modules/`, tracks PIDs in `logs/modules/module-pids.json`; commands `npm run start:modules|dev:modules|status:modules|stop:modules`, flags `-Only`, `-Rebuild`, `-IncludeDashboard` (portal :3100). `stop:modules` does NOT touch gateway :3001. "Gateway tidak pernah men-spawn module services (`START_MODULE_SERVICES` default false)" (MONOREPO.md:27–29). Standalone Next builds MUST have `.next/static` copied into `.next/standalone` or CSS/JS 404 (launcher syncs it; manual: `Copy-Item -Recurse -Force Dashboard_Utama\.next\static Dashboard_Utama\.next\standalone\Dashboard_Utama\.next\static`) (MONOREPO.md:32–37). Root `bun start` auto-spawns portal :3100 only if port 3100 is free at gateway start; production gateway detects a dev-mode Next occupant (HMR fingerprint) and warns `[portal] WARNING ...` (MONOREPO.md:39–44).

---

## 3. Standalone startability

Contract: "Run alone | `bun start` / `npm run dev` inside its dir works with zero other processes" (MONOREPO.md:85). "Independence: `bun start` inside a module dir runs that service alone … Works without the gateway or Dashboard_Utama running" (CLAUDE.md:23–25). Every AGENTS.md repeats: "This module runs on ITS OWN PORT and must start with zero other processes." (rebinmas-jaya-server/AGENTS.md:18–20; report-center/AGENTS.md:18–20; rjfm/AGENTS.md:18–20; daftar-upah/AGENTS.md:29–31).

Per-module commands:
- report-center: `cd "Module Services/report-center" && bun start` (prod :3101) / `bun run dev`; root helpers `npm run start:report-center` / `dev:report-center` (CLAUDE.md:142–150; report-center/AGENTS.md:34).
- rebinmas-jaya-server: `npm run dev` / `npm start` (:3102) (rebinmas-jaya-server/AGENTS.md:34; MONOREPO.md:123).
- rjfm: `npm start` → `tsx src/server.ts`; `npm run dev` → `tsx watch src/server.ts` (:8011); UI build `cd ui-app && npm run build` (standalone output served by `src/ui/serve.ts`); typecheck `npx tsc --noEmit`; tests `node scripts/kerani-tests.mjs`, `sanitize-tests.mjs`, `gateway-tests.mjs` need live server on 8011 (MONOREPO.md:124; rjfm/CLAUDE.md). FORBIDDEN: running separate Next dev for the UI (rjfm/CLAUDE.md).
- sql-gateway: `bun start` (:8001) (MONOREPO.md:125).
- daftar-upah: `npm start` (:3104) — one Bun process serving BOTH API and built Vite SPA; `backend/src/index.ts` → API (`/payroll/*`, `/auth/*`, `/tax-report/*`, …) + static `frontend/dist` + SPA fallback (base `/upah/`); frontend build → `frontend/dist` (MONOREPO.md:126; daftar-upah/AGENTS.md:7–16).
- Static sites (Wifi_LAN_Monitor, ifess-control) have no port — served directly by the gateway (MONOREPO.md:127–128).
- Orchestration: "The main dashboard does NOT auto-start modules — each is started/stopped independently (`node scripts/module.js start <name>` from repo root)" (all AGENTS.md, e.g. report-center/AGENTS.md:19–20); canonical bulk launcher = `scripts/start-module-services.ps1` (MONOREPO.md:8–25). Gateway-side spawn is disabled (`START_MODULE_SERVICES=false`) (MONOREPO.md:28–29).

---

## 4. Reachability contract (dual access)

"each service is reachable BOTH directly (its local port) AND through the gateway proxy (route in `routes-config.json`)" (CLAUDE.md:26–27). Mental model: "Gateway = front door. Everything is reached through `:3001/<path>`." and "Every module = independent app. Own folder, own port, runnable alone." (MONOREPO.md:70–71).

Every AGENTS.md carries the dual-access table, e.g. report-center (report-center/AGENTS.md:7–11): Direct = `http://localhost:3101` (module verifies shared RS256 cookie itself via repo-root `keys/public.pem`, or its own login page); Via gateway = `http://localhost:3001/report-center` (gateway already verified cookie, forwards identity headers `X-User-Id`, `X-User-Name`, `X-User-Email`, `X-User-Role`). Same for rebinmas-jaya-server (:3102 / :3001/server-monitor), rjfm (:8011 / :3001/rjfm).

Mandatory consequence: "Keep both paths working. A change that breaks direct-port access breaks standalone operation." (all AGENTS.md, e.g. rebinmas-jaya-server/AGENTS.md:16–17). rjfm adds: the `:3001/rjfm` portal proxy is passthrough only — an alternative path, NOT a dependency (rjfm/CLAUDE.md).

Health probes: page returns 200 with valid session, APIs return 401 without (e.g. `/api/reports/*` 401 unauthenticated) (report-center/AGENTS.md:35–36); platform-wide probe `GET :3001/api/services/status` lists up/down for all routes (CLAUDE.md:64; all AGENTS.md). daftar-upah specifics: direct health `GET http://localhost:3104/health`, via gateway `GET http://localhost:3001/backend/upah/health`, UI via gateway `http://localhost:3001/upah` (daftar-upah/AGENTS.md:54–56). Proxy mechanics: gateway checks skip-list (`/api/ifess`, `/api/routes`, `/api/auth`, `/api/reports`, `/api/services`) first, matches enabled routes longest-path-first, rewrites HTML/JS/CSS content, streams static assets (CLAUDE.md:195–200); routes hot-reload from `routes-config.json` without gateway restart (MONOREPO.md:205; CLAUDE.md:55).

---

## 5. Auth rules

Auth center = gateway; ONE login (MONOREPO.md:72–73; CLAUDE.md:59–63). Flow (MONOREPO.md:153–169):
- `POST :3001/login` (Dashboard_Utama `/api/auth/login`) verifies against MSSQL `extend_db_ptrj` → signs RS256 JWT with `keys/private.pem` → `Set-Cookie: auth-token` (httpOnly).
- Any request via :3001: gateway extracts cookie → `verifyJWT()` (`shared/auth/jwt.js`, `keys/public.pem`); public routes pass; protected without valid token → 302 `/login` (or 401 JSON); proxied to module WITH injected headers after inbound `x-user-*` STRIPPED first: `X-User-Id`, `X-User-Name`, `X-User-Email`, `X-User-Role`.
- Direct-port access bypasses gateway → module verifies the SAME cookie itself with `keys/public.pem` ("report-center does this today; same key file = SSO works both ways") (MONOREPO.md:166–168; CLAUDE.md:62–63).

Anti-spoofing: "NEVER trust raw inbound `X-User-*` headers on direct port — only the gateway can set them legitimately (it strips inbound copies before injecting)." (all AGENTS.md, e.g. rebinmas-jaya-server/AGENTS.md:14–15); "Never spoofable: clients cannot set `X-User-*`; the gateway deletes inbound copies before injecting verified values." (MONOREPO.md:174).

Credential store: ONE store — MSSQL `extend_db_ptrj` (`user_ptrj`, `role_service_permission.role`, `AccessControl`), managed by admin panel (MONOREPO.md:172). Machine-to-machine calls use env-sourced API keys (`IFESS_API_KEY`, `QUERY_API_KEY`, `IFESS_CLIENT_API_KEY`) — unchanged by SSO (MONOREPO.md:173; CLAUDE.md:63). iFESS protected endpoints require `X-API-Key` header (CLAUDE.md:266). rjfm service-to-service: static `RJFM_API_KEY` in `.env`, sent as `x-api-key` header; delete-via-API allowed only under the `gateway/` folder (rjfm/CLAUDE.md).

Module auth kit (copy-per-module convention): `shared/authkit/` provides ready-made functions for any module to consume the auth center — **"copy the file into your module"** (isolation rule: no cross-module imports), zero deps (MONOREPO.md:176–179). Functions: `verifyGatewayIdentity(headers)` (trust gateway-injected X-User-* in proxy mode), `verifyPortalCookie(token)` (verify RS256 portal JWT with repo `keys/public.pem` in direct-port mode; cached), `resolveIdentity({headers, cookie})` (both modes), `requireAuth({ roles })` (Express middleware: 401/403 + `req.user`). Trust rules in `shared/authkit/README.md` (MONOREPO.md:180–188). rjfm already uses a vendored copy: `src/lib/authkit/` (git status shows `?? rjfm/src/lib/authkit/`; commit 729039e "authkit — reusable module auth kit … copy-per-module").

daftar-upah mode flags: backend runs `USE_PROXY=true` + `AUTH_MODE=external` behind the gateway; direct-port uses `backend/keys/public.pem`; gateway strips `/backend/upah` prefix before proxying (`PROXY_STRIP_PREFIX`) (daftar-upah/AGENTS.md:23–27).

Security baseline: never commit `.env`, `.env.local`, `keys/`, or secrets; all report SQL read-only via `validateReadOnlySql`; `IFESS_API_KEY` required (CLAUDE.md:305–309). DB read-only policy extends to `db_ptrj`/`db_ptrj_mill` (memory feedback_db_readonly; CLAUDE.md:209).

---

## 6. Access-key file conventions

"One shared key file at repo root `keys/report-center-access.key` (gitignored, rotate by editing). Login with any username + key as password → ADMIN session without DB lookup. All module services read the SAME file." (CLAUDE.md:36–38). Direct login example: `http://localhost:3101` using the access key in the password field (CLAUDE.md:148). `keys/` holds "JWT RSA keypairs + report-center-access.key" (CLAUDE.md:72). Rotation = edit the file. Never commit `keys/` (CLAUDE.md:307). Related: modules doing direct-port verification reference repo-root `keys/public.pem` (AGENTS.md dual-access tables), while daftar-upah keeps a module-local copy `backend/keys/public.pem` that "must match the gateway's `keys/public.pem` (RS256 SSO)" (daftar-upah/AGENTS.md:42–43).

---

## 7. Registration checklist for adding a NEW module

Canonical checklist (MONOREPO.md:100–110):
1. `mkdir "Module Services/<name>"` + `package.json` (pick next free port ≥3100)
2. Route entry in `routes-config.json` AND `routes-config.production.json`
3. If Next.js standalone: `next.config.js` with `turbopack.root` = repo root, `assetPrefix=/<route-path>`; keep thin re-export stubs in Dashboard_Utama if it must also render there (never re-export route segment configs)
4. Remove the path from `DASHBOARD_PATHS` in `shared/auth/paths.js` if it must go through the route table instead of the dashboard upstream
5. Auth: accept gateway identity headers; optional direct-port login page
6. Add a row to the registry tables (docs/MONOREPO.md) + `CLAUDE.md`

Additional binding rules and conventions around registration:
- `shared/auth/paths.js` exclusion rule: "`shared/auth/paths.js` `DASHBOARD_PATHS` must NOT include a module's path — otherwise the gateway proxies it to DASHBOARD_TARGET instead of the route table." (CLAUDE.md:55–57; restated in every AGENTS.md isolation section). Current actual value (do not add module paths here): `['/admin', '/dashboard', '/dashboard-user', '/modules', '/api/services', '/ifess-control', '/api/query-gateway', '/config-path']` (shared/auth/paths.js:11; `PROTECTED_PATHS = ['/config-path', ...DASHBOARD_PATHS]` at paths.js:12; export list at paths.js:42).
- Registry/manager: per-module lifecycle via `node scripts/module.js start|stop <name>` (AGENTS.md files) and bulk launcher `scripts/start-module-services.ps1` (`start:modules` / `dev:modules` / `status:modules` / `stop:modules`) — the launcher "knows every module's port, dev/prod command, and build marker", so a new module must be added there too (MONOREPO.md:8–25). Ports must match `routes-config.json` targets exactly (MONOREPO.md:45–46).
- Docs duty: "Docs live in `docs/` — update the registry tables here when adding/removing routes." (MONOREPO.md:204).
- Health/status visibility: new module appears automatically in `GET /api/services/status` once routed (CLAUDE.md:64; AGENTS.md probes).
- Hot-reload: `routes-config.json` edits apply without gateway restart — rewrite regex + static roots rebuild with it (MONOREPO.md:205).
- Convention seen in practice: each module gets its own `AGENTS.md` (4 exist) following the shared template (dual-access table, never-trust-inbound-X-User-* rule, keep-both-paths rule, own-port/zero-processes rule, isolation contract, module facts + health), and optionally a module `CLAUDE.md` (only rjfm has one).

---

## 8. Shared data directories, keys/, env files

- Data storage: iFESS JSON data lives at repo-root `data/ifess/` (CLAUDE.md:83, 283–285): `clients.json`, `configs.json`, `commands.json`, `module-statuses.json`, `heartbeat-logs.json`, `client-groups.json`, `audit-logs.json`, `query-batches.json`, `query-jobs.json`, `query-results.json`, `query-result-chunks.json`, `query-templates.json` (the LIVE template store — edit directly; `DEFAULT_QUERY_TEMPLATES` in `Services/ifess-control-server/service.js` is seed-only, runs only when JSON empty, NOT kept in sync) (CLAUDE.md:243–249). This is gateway-owned data; modules keep their OWN local `data/` inside their folders (rjfm: `data/rjfm-demo.json` demo-account fallback, `data/` must stay inside the module folder — rjfm/CLAUDE.md).
- Launcher artifacts: `logs/modules/` + `logs/modules/module-pids.json` (MONOREPO.md:12–13).
- Keys: repo-root `keys/` = JWT RSA keypairs (`private.pem` signs, `public.pem` verifies) + shared access-key file; gitignored, never commit (CLAUDE.md:72, 307; MONOREPO.md:157, 161). Modules needing direct-port verification use the same public key (copies like `backend/keys/public.pem` must match byte-for-byte for SSO — daftar-upah/AGENTS.md:42–43).
- Env files table (CLAUDE.md:294–303): `Dashboard_Utama/.env` dev defaults; `.env.local` local overrides (gitignored); `.env.docker` Docker; `.env.production` standalone prod; `routes-config.json` dev proxy; `routes-config.production.json` prod proxy. Module envs are module-local and never committed (rjfm `.env` with `RJFM_NAS_URL/RJFM_NAS_USER/RJFM_NAS_PASS/RJFM_STORAGE_PATH`, `RJFM_API_KEY`, `RJFM_UI_PORT`; daftar-upah `backend/.env` same DB credentials as source but `PORT=3104`, "Never commit it", `.env` overrides port). Machine-to-machine secrets come from env API keys only (MONOREPO.md:173).
- daftar-upah snapshot/sync rule: the folder is a SNAPSHOT of `PORTAL_ESTATE/V 2 (begin versioning)`; after changing code in the source, re-copy changed files (robocopy mirrors `backend/src`, `frontend/src`, `frontend/dist`, `assets`) then rebuild frontend if `dist` changed (MONOREPO.md:145–149; daftar-upah/AGENTS.md:47–50).
- rjfm storage exception: physical files live on Synology NAS Storage03 `http://10.0.0.8:5000` (DSM/FileStation HTTP API) — NOT an SMB drive; client in `src/lib/nas.ts`, adapter `src/lib/storage.ts`; DSM gotchas documented (upload v2 field `path`, manually-built multipart Buffer because Node FormData sends chunked and DSM truncates binary, download success marked by `Content-Disposition` header) (rjfm/CLAUDE.md).

---

## 9. Naming conventions

- Folder names: `Module Services/<module-name>/` (MONOREPO.md:82); existing names mix kebab-case (`report-center`, `rebinmas-jaya-server`, `sql-gateway`, `daftar-upah`, `ifess-control`) with underscores (`Wifi_LAN_Monitor`).
- "Report IDs and routes: kebab-case" (CLAUDE.md:206). Route ids in registry: `report-center`, `server-monitor`, `rjfm`+`file`, `sql-gateway`, `upah`, `network-monitor`, `ifess-control` (MONOREPO.md:118–130; AGENTS.md "route id" fields).
- Code style: TypeScript strict throughout; 2-space indentation, single quotes in TS/TSX; React components `PascalCase`; functions/variables/hooks `camelCase`; prefer existing helpers over duplicating logic (CLAUDE.md:204–208).
- Package naming: module `package.json` name = module name (MONOREPO.md:83).
- Performance/doc duties attached to modules: every user-facing page ships a `loading.tsx` skeleton (no blank screens); hashed assets immutable, HTML no-cache; DB via shared pool `max:10`, no N+1 loops — batch into Maps; module serves its own static assets, gateway streams them with correct `Cache-Control` (MONOREPO.md:190–198).

---

## Cross-cutting summary (one-liners)

1. One mental model: gateway :3001 = front door + sole auth center; every module independent; one RS256 login (MONOREPO.md:52–73).
2. Module contract = 7 rows: own directory, own package.json, own unique port (bind 0.0.0.0), runs alone with zero processes, registered in route tables, no cross-module imports (copy instead), trust-gateway auth (proxy headers / direct-port cookie verify) (MONOREPO.md:78–88).
3. Dual reachability must always work: direct port AND gateway proxy; breaking either is a regression (all AGENTS.md).
4. New-module checklist has exactly 6 steps including the `DASHBOARD_PATHS` removal trap and doc updates (MONOREPO.md:100–110; CLAUDE.md:55–57).
5. Authkit is copy-per-module, zero-dep — never imported across boundaries (MONOREPO.md:176–188).
6. Everything secret lives in gitignored `keys/` and module-local `.env`; M2M uses env API keys; SQL always read-only (CLAUDE.md:305–309; MONOREPO.md:171–174).

---

# Module Service Tooling — Registration / Start / Stop / Health-Check

## 1. The three tooling layers (and their separate registries)

There is **no single source of truth** for "which modules exist". Three independent registries exist, each maintained by hand:

| Layer | Registry location | What it controls |
|---|---|---|
| Node CLI | `D:/Gawean Rebinmas/Main Dashboard/scripts/module.js` (`MODULES`, lines 24–31) | per-module start/stop/list |
| PowerShell launcher | `D:/Gawean Rebinmas/Main Dashboard/scripts/start-module-services.ps1` (`$MODULES`, lines 54–79) | bulk dev/prod start, build-on-missing, stop-all, status |
| Gateway proxy + portal cards | `routes-config.json` (+ `routes-config.production.json`) | reachability, proxying, `/api/services/status` |

The two launcher registries have already diverged: `module.js` knows `ifess-server` (route id `ifess-control`, port resolved from route → :8012) but **not** `sql-gateway`; the PS1 knows `sql-gateway` (:8001) but **not** `ifess-server`. Ports live in `routes-config.json` "single source" per the comment at `scripts/module.js:22-23`, and the PS1 enforces this only by convention: `# Port WAJIB sama dengan target di routes-config.json.` (`start-module-services.ps1:53`).

The **gateway never spawns modules**: `startModuleServicesIfNeeded()` is a documented no-op — *"Module services run externally (own process/port). The gateway never spawns them — it only proxies to their ports via routes-config.json."* (`server_bun.js:1133-1138`). Modules NOT started simply stay off; the gateway proxies only to whichever ports are alive (`scripts/module.js:11-12`).

---

## 2. How each layer works

### 2a. `scripts/module.js` (pick-and-choose CLI)

- Commands: `list | start <names...> | stop <name> | status` (`module.js:5-9`, dispatch at `module.js:99-110`).
- **Port resolution** (`module.js:33-41`): use the entry's literal `port` if present (dashboard `3100` at line 25, daftar-upah `3104` at line 30); otherwise parse the port out of the matching route's `target` URL in `routes-config.json` by route `id`.
- **Start** (`module.js:66-76`): skips if `netstat` shows the port already LISTENING; spawns detached (`spawn(..., {detached:true})` + `child.unref()`), stdout/stderr appended to `logs/module-<name>.log`. Optional `cwd` subpath support (used by daftar-upah: `cwd:'backend'`, line 30/72).
- **Stop** (`module.js:78-85`): finds the listening PID via `netstat -ano | findstr` (`pidOnPort`, lines 43–50) then `taskkill /PID <pid> /T /F`. Windows-only; inputs come from trusted config (comment at lines 86–87).
- **Status** (`module.js:89-97`): iterates every enabled, non-hidden route in `routes-config.json` and does an **HTTP fetch probe** to `${target}${healthPath || '/'}` with 1.5 s timeout; anything with status `< 500` counts UP (`probe`, lines 56–64). Static/self targets (`static://…`) print `(static/self)` (line 93).

### 2b. `scripts/start-module-services.ps1` (central launcher)

Root npm wiring: `"start:modules"` / `"dev:modules"` / `"stop:modules"` / `"status:modules"` all invoke this script (`package.json:25-28`).

- Registry `$MODULES` (`ps1:54-71`): each entry carries `Name, Dir, Port, Runner, Dev[], Prod[], Build[]?, Marker?, Env?`. Current members: report-center (:3101, marker `.next/BUILD_ID`), rebinmas-jaya-server (:3102, marker `dist/index.html`), rjfm (:8011, env `RJFM_STORAGE_PATH`), sql-gateway (:8001), daftar-upah (:3104, build `run build:frontend`, marker `frontend/dist/index.html`, env `PORT=3104` — comment notes default internal 8002 but gateway route points 3104). `-IncludeDashboard` appends dashboard-portal (:3100, node runner, `.next/standalone/...`, `NoDev`) (`ps1:72-79`).
- Runner resolution forces real `.exe`s to avoid shim breakage (`Resolve-Exe`, `ps1:35-45`; bun required, throws if missing).
- **Start flow** (`Start-Service`, `ps1:160-252`):
  1. Skip if port occupied (`Get-NetTCPConnection`, `ps1:87-89,161-165`).
  2. Prod mode: build if the marker artifact is missing or `-Rebuild` (`Invoke-Build`, `ps1:122-134,166`).
  3. Launch hidden via `cmd /c` wrapper (long comments explain PowerShell quoting/pipe pitfalls, `ps1:191-214`); per-service env vars set then restored (`ps1:181-187,218-222`).
  4. Wait up to 40 s for the port to open (`ps1:226-231`).
  5. Persist the **actual port-owner PID** (not the cmd wrapper) into `logs/modules/module-pids.json` (`ps1:244-251`; rationale comment `ps1:241-243`).
- **Stop** (`Stop-Services`, `ps1:254-279`): kills every PID in the store, then a safety net kills *any* process holding a registry port — explicitly sparing gateway :3001. Removes the PID file afterwards.
- **Status** (`Show-Status`, `ps1:281-293`): pure TCP-listen table per registry port (no HTTP request at all).
- Extra: `Sync-DashboardStandalone` (`ps1:136-158`) copies `.next/static` into the standalone output keyed on BUILD_ID stamp before starting the portal.

### 2c. Gateway health-check `/api/services/status`

Handler at `server_bun.js:1671-1690`:

1. **Auth first**: extracts the RS256 cookie and `verifyJwtForRoot`; unauthenticated requests get redirected to login (`server_bun.js:1672-1674`).
2. **TCP-only probe**, not HTTP: `checkTcpPort()` opens a raw `Bun.connect` socket to the target host:port with a **500 ms** cap and immediately closes (`server_bun.js:1236-1243`). A successful TCP connect = `up:true`; no `/health` endpoint is consulted even though some routes define one (e.g. `upah.healthPath:"/health"`, `routes-config.json:62`).
3. **Filter set**: routes where `!r.hidden && isHttpTarget(r.target) && r.target.startsWith('http://127.0.0.1')` (`server_bun.js:1677-1678`) — i.e. only loopback HTTP targets, so static sites (`static://network-monitor`) and LAN-hosted externals (`http://localhost:5176` etc., which don't match the `127.0.0.1` prefix literally) are excluded from the card status.
4. **Cached 30 s** in module-level `serviceStatusCache` (`server_bun.js:1245, 1676-1688`) so many portal users don't multiply probes.
5. Response: `{ success, checkedAt, services: [{serviceId, path, up}] }` (`server_bun.js:1689`).

So three different notions of "healthy": module.js = HTTP <500 on `healthPath||'/'`; PS1 = port LISTENING; gateway = authenticated TCP connect to a loopback route target within 500 ms, cached 30 s.

---

## 3. Every route in `routes-config.json` targeting Module Services / localhost

| id | path | target | Notes |
|---|---|---|---|
| `upah` | `/upah` | `http://localhost:3104` | daftar-upah SPA+API; `spaIndex` → `Module Services/daftar-upah/frontend/dist/index.html`; 10 `aliases` + matching `apiPrefixes`; `textRewrites` localhost:3104→`/backend/upah`; `staticRoots` for assets/images/vite.svg; `healthPath:"/health"` (`routes-config.json:2-66`) |
| `backend-upah` | `/backend/upah` | `http://localhost:3104` | API backend, `rewritePath:true` (`:68-78`) |
| `server-monitor` | `/server-monitor` | `http://127.0.0.1:3102` | Vite SPA module, `rewriteContent:true` (`:97-108`) |
| `network-monitor` | `/network-monitor` | `static://network-monitor` | served by gateway from `staticSiteDir: Module Services/Wifi_LAN_Monitor/reference-design` (`:110-121`) |
| `ifess-control` | `/ifess-control` | `http://localhost:8012` | unified frontend+API of the ifess-server module (`:123-132`) |
| `api-ifess` | `/api/ifess` | `http://localhost:8012` | IFESS control-plane API (`:134-141`) |
| `report-center` | `/report-center` | `http://127.0.0.1:3101` | Next.js module (`:157-168`) |
| `api-reports` | `/api/reports` | `http://127.0.0.1:3101` | Report Center API (`:170-178`) |
| `query` | `/query` | `http://localhost:8001` | legacy SQL Gateway alias — same port now owned by sql-gateway module ("legacy port takeover", `docs/MONOREPO.md:125`) (`:180-187`) |
| `file` | `/file` | `http://127.0.0.1:8011` | rjfm ui-app build (`:199-206`) |
| `api-file` | `/api/file` | `http://127.0.0.1:8011` | rjfm file API (`:208-215`) |
| `rjfm` | `/rjfm` | `http://localhost:8011` | rjfm API (`:217-225`) |
| `sql-gateway` | `/sql-gateway` | `http://127.0.0.1:8001` | traffic & audit UI, `rewritePath:true` (`:227-237`) |
| `api-sql-gateway` | `/api/sql-gateway` | `http://127.0.0.1:8001` | internal API, x-api-key or SSO headers (`:239-246`) |

NOT Module Services (registered externals): `absen`:5176, `monitoring-beras`:5177, `basis-panen`:3002, `file-legacy`:5178 (`routes-config.json:80-96,143-155,188-197`).

### Hot-reload mechanics

Implemented in `server_bun.js:690-722`: a 5-second `setInterval` stats `routes-config.json`; on mtime change it re-reads the JSON, expands each route into itself + one hidden clone per `aliases` entry (`hidden:true`, `:703-714`), sorts longest-path-first, and calls `refreshRouteDerivedArtifacts()` (rewrite regexes/static roots rebuilt — previously built once at boot and went stale, comment `server_bun.js:754-760`). Logs `[routes] hot-reloaded N routes`. Initial boot load at `server_bun.js:725-752`. Practical effect: **a new route entry needs no gateway restart**; the launchers, however, read their own hardcoded port fields and do NOT hot-reload. `module.js` re-reads the config fresh on every invocation (`module.js:37`).

---

## 4. Exact steps (file edits) to add a new module to the tooling

Canonical checklist lives at `docs/MONOREPO.md:100-110`; cross-checked against actual code:

1. **Create the module**: `mkdir "Module Services/<name>"` + `package.json` with own `dev`/`start`/`build` scripts and a unique port ≥3100 (`MONOREPO.md:102`).
2. **Register the route**: add an entry to `routes-config.json` AND `routes-config.production.json` (`MONOREPO.md:103`). Hot-reload makes it proxied within ~5 s and visible to `/api/services/status` automatically (loopback http target ⇒ TCP-probed). Keep the path OUT of `shared/auth/paths.js` `DASHBOARD_PATHS`, else the gateway sends it to the dashboard upstream instead of the route table (`MONOREPO.md:107-108`).
3. **Add to `scripts/module.js` `MODULES`** (`module.js:24-31`): either `{ dir, cmd:[exe,[args]], route:'<route-id>' }` (port derived from the route target) or explicit `port:'NNNN'`, optional `cwd` subdir.
4. **Add to `scripts/start-module-services.ps1` `$MODULES`** (`ps1:54-71`): `Name/Dir/Port/Runner($BUN)/Dev/Prod`, plus `Build`+`Marker` if prod-mode build-on-missing is wanted, plus `Env` hashtable if needed. The Port value MUST equal the route target's port (`ps1:53`).
5. *(Optional)* Root convenience script in `package.json` following the existing pattern, e.g. `"dev:<name>": "bun --cwd \"Module Services/<name>\" run dev"` (`package.json:23-24`) — note rjfm/sql-gateway currently have NO root scripts and are started only via the PS1 or directly.
6. If it's a standalone Next.js module: `next.config.js` with `turbopack.root = repo root` and `assetPrefix=/<route-path>`; thin re-export stubs in Dashboard_Utama if it must also render inside the portal (never re-export route segment configs) (`MONOREPO.md:104-106`; reference impl `Dashboard_Utama/next.config.js:21-26`).
7. Auth: accept gateway-injected `X-User-*` headers behind the proxy; verify the shared RS256 cookie (`keys/public.pem`) for direct-port access (`MONOREPO.md:88`).
8. Docs: add a row to the registry tables in `docs/MONOREPO.md` and update `CLAUDE.md` (`MONOREPO.md:110`).

## 5. Does workspaces membership matter for out-of-root imports?

Yes, and the mechanism is deliberately layered:

- Root `package.json` `"workspaces": ["Dashboard_Utama", "Module Services/*"]` (`package.json:6-9`) — the **glob means any new module dir becomes a workspace automatically**; no edit needed here, but an install pass is required so its deps link.
- `Dashboard_Utama/next.config.js` sets `turbopack: { root: path.resolve(__dirname, '..') }` (`next.config.js:24-26`) so `@modules/*` imports pointing outside `Dashboard_Utama/` resolve during bundling.
- TypeScript mirror: `Dashboard_Utama/tsconfig.json:29-31` maps `"@modules/*": ["../Module Services/*"]`.
- **Bare-package resolution for modules without their own `node_modules` is handled by a filesystem trick, not workspaces alone**: `Module Services/node_modules` is a **symlink → `../Dashboard_Utama/node_modules`** (observed on disk: `Module Services/node_modules -> ../Dashboard_Utama/node_modules`). It is gitignored and must be recreated per machine: `cd "Module Services" && node -e "require('fs').symlinkSync('../Dashboard_Utama/node_modules','node_modules','dir')"` (`docs/MONOREPO.md:90-96`). Currently report-center, rebinmas-jaya-server, rjfm, and sql-gateway have their own `node_modules` dirs, while daftar-upah relies on the parent symlink.
- Hard-won constraint recorded in docs: *"Turbopack `resolveAlias` for out-of-root paths is broken (transitive graph unresolvable). Do not retry."* (`docs/MONOREPO.md:98`) — hence the turbopack.root + symlink combo rather than alias config.


---

# ifess-server Module Analysis

Module root: `D:\Gawean Rebinmas\Main Dashboard\Module Services\ifess-server` (untracked/new per git status). Zero npm dependencies; pure Bun runtime. Files analyzed: `package.json`, `.env.example`, `README.md`, `src/index.js`, `src/config.js`, `src/auth.js`, `src/service.js`, `src/handler.js`, `src/static.js`, `tests/wire.test.js`.

---

## 1. Entry point & port binding

- **`Bun.serve()`** at `src/index.js:28-57` with `hostname: '0.0.0.0'` (LAN-reachable, "like the .NET server was", index.js:30). Every response gets CORS headers injected post-handler (index.js:39-48): `Access-Control-Allow-Origin: *`, methods GET/POST/PUT/DELETE/OPTIONS, headers `Content-Type, X-API-Key`. OPTIONS preflight answered early in `handleRequest` (handler.js:342-351) with 204.
- **Default port 8012**, override env **`IFESS_PORT`** — `src/config.js:38`: `parseInt(process.env.IFESS_PORT || '8012', 10)`. A deliberate comment (config.js:36-37) explains generic `PORT` is NOT honored because repo .env files use `PORT=3001` for the main gateway.
- **Env fallback chain**: `process.env` wins; otherwise `parseDotEnv` reads repo-root `.env.development` then `.env.production` (config.js:31-34; parser at config.js:18-29, uppercase-only keys, never overrides existing env). Both files exist and both define `IFESS_API_KEY` (verified on disk).
- Startup logging (index.js:69-72): port/PID/masked key/UI paths. A **stuck-command reaper** runs `svc.reapStaleCommands()` every 60 s with `.unref()` (index.js:61-67).
- `package.json:8-10`: `start` = `bun run src/index.js`, `dev` = `bun --watch run src/index.js`, `test` = `bun test`. `"type": "module"`, no dependencies/devDependencies.

## 2. Auth

Two channels, combined in `isAuthorized(req)` (handler.js:83-86):

1. **API keys** (`src/auth.js:22-35`): header `X-API-Key` compared **timing-safe** (`crypto.timingSafeEqual`, auth.js:29) against each entry of `validKeys` after a length-equality pre-check (auth.js:29). Keys (config.js:41-44):
   - `IFESS_API_KEY` — default hardcoded `'ptrj-rebinmas-air-ruak-parit-gunung-darul'` (config.js:41; same literal in `.env.example:9` and tests/wire.test.js:12).
   - `IFESS_CLIENT_API_KEY` — secondary key for the gateway-proxied flow (config.js:44); default empty string, filtered out of `validKeys` when unset (auth.js:13). **Not documented in `.env.example`** (only `IFEFF_API_KEY`/port are).
2. **Portal identity** (`resolvePortalIdentity`, handler.js:71-76) via `shared/authkit` `resolveIdentity` — accepts either gateway-injected `x-user-*` headers (proxy/SSO mode) or the RS256 portal cookie (`auth-token|payroll_auth_token`) verified locally against repo-root `keys/public.pem` (authkit/index.js:16-31, 77-104, 120-133; keysDir passed as `REPO_ROOT/keys`, handler.js:75). This means **every "protected" surface also accepts a logged-in portal browser**, which the README's "Auth: X-API-Key header" line (README.md:11) understates.

**Public (no auth)**: `GET /health`, `GET /server-info`, `GET /api/ifess/health`, `GET /api/ifess/server-info` (handler.js:354-365) + all OPTIONS. Semi-public: `GET /api/ifess/me` identity probe (handler.js:369-377) — reachable without credentials but answers 401 payload when neither channel authenticates; accepts API key as fallback ("API Key Session", role Service).

**Gated differently**: UI pages (`/`, `/app`, `/simple`) and assets (`/assets/*`, `/ifess-assets/*`) require **portal identity only — API key is NOT sufficient here** (handler.js:380-399 calls `resolvePortalIdentity`, not `isAuthorized`). Direct-LAN browsing of the UI therefore needs a valid portal cookie.

**Protected (`isAuthorized`)**: everything else under `/api/clients*`, `/api/module-statuses`, `/api/commands`, `/api/dashboard`, `/api/query-gateway/*`, `/api/ifess/*` (allowlist at handler.js:415-425). Ordering quirk: unknown paths outside the allowlist get 404 **before** the auth check (handler.js:427-429) — surface-shape probing returns 404, not 401.

## 3. Endpoint coverage vs README

README table (README.md:45-68) vs implementation:

| Claimed | Status |
|---|---|
| POST `/api/clients/register` | yes, handler.js:448-452 |
| GET `/api/clients`, `/api/clients/{id}` | yes, handler.js:444, 545-549 |
| GET/PUT `/api/clients/{id}/config` | yes, handler.js:480-493 |
| POST `{id}/heartbeat` | yes, handler.js:455-462 |
| POST/GET `{id}/modules/status` | yes, handler.js:495-507 |
| POST `{id}/commands` | yes, handler.js:509-515 |
| GET `{id}/commands/pending` → `{commands:[...]}` wrapper | yes, handler.js:464-468 |
| POST `{id}/commands/{cmdId}/result` | yes, handler.js:470-478 |
| GET `/api/module-statuses?clientId=`, `/api/commands?clientId=&status=` | yes, handler.js:518-526 |
| GET `/api/dashboard` | yes, handler.js:439-441 |
| Query-gateway bare paths (below) | yes via `handleQueryGateway`, handler.js:433-436 |
| Legacy aliases `/api/ifess/clients*` (incl. per-client heartbeat/pending/result/config/modules-status) | yes — the regexes use `^\/api(?:\/ifess)?\/clients\/...` (handler.js:455, 464, 470, 480, 495); register alias at 448; dashboard 439; client-groups GET+POST 529-537; audit-logs GET 540-542; `/api/ifess/query-gateway/*` prefix-strip at 408-412 |
| POST `/api/ifess` action dispatcher | yes, handler.js:90-210 |

Dispatcher actions implemented (handler.js:98-204): `getDashboard, listClients, getClient, getClientConfig, registerClient, updateClientConfig, sendHeartbeat/receiveHeartbeat, getModuleStatuses, reportModuleStatus, pollCommands, listCommands, createCommand, reportCommandResult, listClientGroups, getClientGroup, createClientGroup, updateClientGroup, deleteClientGroup, addClientToGroup, removeClientFromGroup, listAuditLogs, listSyncDivisions, syncBootstrap, listSyncJobs, getSyncJob`; unknown action → 400 (204).

**Notable README/code discrepancies:**
- README.md:42-43 labels the unified UI (`/`, `/simple`, `/assets/*`) "Public" — code gates them behind portal identity (handler.js:385-386). Misleading wording; they're public *paths*, not public *access*.
- `GET /api/ifess/me` is in neither README list.
- No client DELETE/decommission endpoint exists anywhere (README doesn't claim one either — parity with the claimed surface holds).
- `syncBootstrap` in the dispatcher goes beyond what the README's dispatcher summary implies (see broken dependency in §6).

## 4. External dependencies (outside its folder) — all grepped

Exact list of cross-boundary imports:

1. **`src/handler.js:43`** → `../../../shared/authkit/index.js` = `D:\Gawean Rebinmas\Main Dashboard\shared\authkit\index.js` — EXISTS. Only `resolveIdentity` used. Note: authkit's own header (index.js:2) says "Copy this file into a module… do NOT import across modules", and commit 729039e describes it as "copy-per-module"; this module imports the shared original instead of copying (rjfm made a copy under `rjfm/src/lib/authkit/`). Deviation from the stated convention, though functionally identical today.
2. **`src/service.js:27-30`** → `Services/ifess-control-server/service.js` (resolved from module src via `../../../`). **YES — this is the canonical CJS bridge**: `createRequire(import.meta.url)(SERVICE_PATH)` loads `D:\Gawean Rebinmas\Main Dashboard\Services\ifess-control-server\service.js` (verified: 1995 lines, matches README's "~1996"). ~50 named exports re-exported (service.js:34-99). Before loading, `process.env.IFESS_SERVER_PORT ||= IFESS_PORT || '8012'` (service.js:24) so `getServerInfo()` advertises :8012 instead of the gateway's default 3001 (canonical service.js:1211-1231 builds `baseUrl`/endpoints from it).
3. **Data storage** — canonical service.js:22 `const DATA_DIR = path.join(__dirname, '../../data/ifess')` resolves to **repo-root `D:\Gawean Rebinmas\Main Dashboard\data\ifess`** — exactly the store server_bun.js writes (verified: directory exists containing `clients.json, configs.json, commands.json, module-statuses.json, heartbeat-logs.json, client-groups.json, audit-logs.json, query-batches.json, query-jobs.json, query-results.json, query-result-chunks.json, query-templates.json`). Both processes share the same JSON store; no override needed (as the module comment at service.js:12-14 states).
4. **`src/config.js:47`** → `UI_DIR = IFESS_UI_DIR || REPO_ROOT/'Module Services/ifess-control'` — **YES, serves the SIBLING module's frontend**. Verified on disk: `ifess-control/` contains `app/`, `simple/`, `assets/`, `README.md`. `src/static.js:37-60` serves relative paths under UI_DIR with an in-memory Buffer cache (no invalidation — restart to see edits, documented at static.js:7-8), MIME map (static.js:16-30), HTML `no-cache` / assets `max-age=300` (static.js:53).
5. **`src/handler.js:216-218`** → spawns `node <module-src>/../../../FB_Migration/src/migrate.js` for `syncBootstrap` — **path is WRONG** (see §6).
6. Node built-ins only otherwise (`node:crypto`, `node:fs`, `node:path`, `node:url`, `node:module`, `node:child_process`). The three `require(` occurrences are handler.js:216-217 (`node:child_process`, `node:path` — bare `require()` inside ESM, which Bun tolerates but Node ESM would reject) and service.js:30 (the CJS bridge via `createRequire`).

Gateway wiring confirmed: `routes-config.json:122-140` routes `/ifess-control` → `http://localhost:8012` and `/api/ifess` → `http://localhost:8012`.

## 5. Query-gateway endpoints: management-only, NO local execution

Endpoints (`handleQueryGateway`, handler.js:244-328): `POST …/validate`, `POST …/dispatch`, `GET …/batches`, `GET …/batches/{id}`, `POST …/jobs/{jobId}/result`, `POST …/jobs/{jobId}/chunks`, `GET …/history`, `GET/POST …/templates`, `PUT/DELETE …/templates/{code}`.

**These manage jobs only — no Firebird SQL is executed locally.** Trace of `/dispatch`:

1. handler.js:252-255 → `svc.createQueryBatch(body)`.
2. Canonical `createQueryBatch` (Services/ifess-control-server/service.js:1501-1610): validates SQL with `isReadOnlySql` (service.js:1429-1482 — SELECT/WITH-only, string-literal stripping, forbidden-keyword scan, no semicolons); resolves targets (`resolveQueryTargets` service.js:1484-1499: SingleClient/MultipleClients/AllClients/ClientGroup); persists one batch + one query-job per target; then **creates a Command per job with `commandType: 'EXECUTE_FIREBIRD_QUERY'`** carrying payload `{queryText, maxRows, timeoutSeconds, readOnly:true, resultMode:'Inline', chunkSize:500}` (service.js:1565-1595). Returns `{queryBatchId, status:'Running', targetCount}` — no rows.
3. Execution is **delegated to registered SuperApp clients**: each estate client polls `GET /api/clients/{id}/commands/pending` (handler.js:464-468), runs the SELECT against its local Firebird, and reports back via `POST /api/query-gateway/jobs/{jobId}/result` (inline mode, handler.js:268-283 → `storeQueryJobResult`, service.js:1630+) or `…/chunks` (chunked mode, handler.js:285-297 → `storeQueryResultChunk`).
4. `grep` over service.js confirms **zero** `isql`/`spawn`/`execFileSync`/Firebird driver usage — the only subprocess spawning in this module is the FB_Migration sync path. This is a fundamentally different pipeline from server_bun.js's local `isql.exe` gateway (`/api/query-gateway/exec-sync`); the name `/api/query-gateway` collides conceptually across the two services, though `routes-config.json` currently proxies only `/api/ifess` and `/ifess-control` here, so there is no live route conflict.
5. Consequence: with no online client, a dispatched batch stays Pending/Running indefinitely — `timeoutSeconds` is stored in the batch/job payload but nothing server-side enforces it on this path (only the generic stuck-command reaper runs).

## 6. Half-finished / bugs / wire-incompatible items

1. **BUG — FB_Migration path resolves inside the repo, but FB_Migration lives outside it.** handler.js:218: `resolve(import.meta.dir, '../../../FB_Migration/src/migrate.js')` → `Main Dashboard/FB_Migration/src/migrate.js`. That directory **does not exist** (verified). The real project sits at `D:\Gawean Rebinmas\FB_Migration` — one level above the repo. server_bun.js gets this right because its `ROOT_DIR` is the repo root and it appends `/../FB_Migration/src/migrate.js` (server_bun.js:45, 259). Net effect: every `syncBootstrap` action spawns node with a nonexistent script → child `error` event → job marked `failed` with ENOENT. Additionally, server_bun.js propagates FB_Migration's dotenv/connection env vars into the child (server_bun.js:650 area); the module's `spawn` (handler.js:225) passes **no env at all**, so even with the corrected path the migration subprocess would lack DB credentials. `spawnFbMigration` is effectively dead-on-arrival.
2. **Test suite writes to the LIVE shared store.** tests/wire.test.js exercises `handleRequest` against the real CJS service, whose DATA_DIR is the production `data/ifess/*.json` — registering `TEST-…` clients, heartbeats, commands, and completing them (wire.test.js:71-141) permanently pollutes `clients.json`/`commands.json`/etc. No cleanup, no temp-dir isolation (`bun test` while the service or gateway is running also races the same JSON files).
3. **Weak path-traversal guard**: static.js:41 `if (!full.startsWith(UI_DIR)) return null;` — no trailing-separator hardening, so a sibling directory named `ifess-control-anything` would pass the prefix test. Currently unreachable because handler.js only feeds fixed prefixes (`assets/…`, `app/index.html`, `simple/index.html`), but `serveUi` is exported and generic.
4. **Bare `require()` in ESM** (handler.js:216-217): fine under Bun, breaks under plain Node ESM; inconsistent with the `createRequire` pattern used in service.js:29.
5. **Undocumented second auth factor**: portal-cookie/`x-user-*` acceptance on all protected REST surfaces (§2) is absent from README and `.env.example` (`IFESS_CLIENT_API_KEY` missing there too). Conversely the README's "Public: unified UI" claim contradicts the UI's 401 gate.
6. **Minor**: `GET /query-gateway/history` and `GET /query-gateway/batches` are the same call (`svc.listQueryBatches()`, handler.js:258-260 vs 299-301); asset cache never invalidates (restart to pick up frontend edits, static.js:6-8); `A-CORS *` on all responses including authorized APIs (index.js:40) — acceptable given key/cookie auth but worth noting for LAN exposure of `/health` + `/server-info` on 0.0.0.0; masked key prints first4+last4 at startup (auth.js:15-19, index.js:71).
7. Test coverage gaps: nothing exercises dispatch→chunks/results flow, template CRUD, client groups, audit logs, `/api/ifess/me`, or CORS; covered are public surface, 401 gating (wrong key, UI without identity), the .NET register→heartbeat→pending→command-result lifecycle, dashboard camelCase, and one validate call (wire.test.js:34-156).


---

# Standalone Module Independence Pattern — 3 Exemplars Analyzed

Base paths (all citations below are relative to these absolutes):
- **SQLGW** = `D:/Gawean Rebinmas/Main Dashboard/Module Services/sql-gateway`
- **DU** = `D:/Gawean Rebinmas/Main Dashboard/Module Services/daftar-upah`
- **RJFM** = `D:/Gawean Rebinmas/Main Dashboard/Module Services/rjfm`
- **ROOT** = `D:/Gawean Rebinmas/Main Dashboard`

---

## 1. sql-gateway (port 8001) — Fastify + Bun

### Start command
- `SQLGW/package.json:8-10` — `"start": "bun run src/index.ts"`, `"dev": "bun run --watch src/index.ts"`, plus `"start:node": "tsx src/index.ts"` escape hatch and `typecheck`. `type: module`, main `src/index.ts`. Zero workspace coupling; deps are fastify 5, `@fastify/static`, `mssql`, `dotenv`, `node-sql-parser`.

### Port binding
- `SQLGW/src/index.ts:93` — `await app.listen({ port: appConfig.port, host: appConfig.host })`
- `SQLGW/src/config.ts:125-128` — `host: process.env.HOST || '0.0.0.0'`, `port: intEnv('PORT', 8001)`. Env-overridable, hardcoded sane default.

### Auth WITHOUT gateway running (the richest example)
`SQLGW/src/plugins/auth.ts` registers a global `preHandler` hook (`auth.ts:62-158`) resolving identity in strict order:
1. **API key (m2m)** — `x-api-key` timing-safe compared against the `SQLGW_API_KEYS` JSON map (`auth.ts:74-98`, `safeEqual` at `36-41`, parsed in `config.ts:37-79`). Invalid key = hard 401, no fallback.
2. **Gateway-injected `X-User-*` headers** — accepted ONLY from loopback peers (`isLoopback` at `auth.ts:43-46`, enforced at `100-122`). Non-loopback peer presenting `X-User-*` gets a recorded `spoof-attempt` + 401. This is the strictest posture in the repo — copy it.
3. **Portal RS256 cookie verified locally** — `authkit.extractPortalToken(req.headers.cookie)` + `verifyPortalCookie(token)` using ROOT/shared/authkit and ROOT/keys/public.pem (`auth.ts:124-141`). This IS the direct-port story.
- Unauthorized: browser-looking GETs → 302 to a self-hosted `/login?next=…` page (`auth.ts:147-153`, page served at `index.ts:50-56` with `__LOGIN_URL__` templated to the portal login `http://localhost:3001/login` from `config.ts:151`); API surfaces get 401 JSON (`auth.ts:154-157`).
- Bonus: fixed-window rate limiter per caller+IP on `/v1/*` (`auth.ts:163-188`).
- **Authkit loading pattern**: `loadAuthkit()` at `auth.ts:13-18` tries dynamic import of repo-root `../../../../shared/authkit/index.js` (single source of truth while inside the monorepo) and falls back to the bundled copy `SQLGW/src/lib/authkit.js` when run detached. Best-of-both-worlds loader.
- Public paths exempt from auth: `/health`, `/login` (`auth.ts:49,69-72`).

### Storage
- `data/logs/` inside the module: daily JSONL sinks `traffic-*.jsonl`, `queries-*.jsonl`, `security-*.jsonl` + `heartbeat.json` (`config.ts:138` `logDir: SQLGW_LOG_DIR || 'data/logs'`; writer in `src/services/monitor.ts:119-131`, heartbeat `monitor.ts:427-431`; dir auto-created `monitor.ts:112-114`).
- Query data lives in external MSSQL via pooled profiles (`services/connectionManager.ts`), warmed in background AFTER listen is scheduled (`index.ts:91`) so slow DBs never block startup.

### Direct + gateway reachability
- Self-serves its dashboard UI from `public/` via `@fastify/static` (`index.ts:59-63`) on the SAME port — one process, one port.
- Routes mounted twice where needed: `queryRoutes` at root AND under legacy alias `/query` (`index.ts:65-68`) so pre-existing direct callers of `:8001/query/v1/*` keep working.
- ROOT/routes-config.json: entry `id:"sql-gateway"` path `/sql-gateway` → `http://127.0.0.1:8001`, `rewritePath:true` (`routes-config.json:227-238`) + companion API route `id:"api-sql-gateway"` path `/api/sql-gateway` (`routes-config.json:239-249`).
- Graceful shutdown: SIGTERM/SIGINT handler flushes heartbeat, closes pools, closes app (`index.ts:72-88`).

---

## 2. daftar-upah (port 3104) — Bun/Elysia monolith serving API + built Vite dist

### Start command
- Root `DU/package.json:7-12` — `"start": "cd backend && bun run src/index.ts"`, `"dev": "bun --watch run src/index.ts"`, `"build:frontend": "cd frontend && npm run build"`. Backend has its OWN `backend/package.json` (Elysia, `@elysiajs/static`, mssql, jose, bcryptjs) so the backend is independently runnable.

### Port binding
- `DU/backend/src/index.ts:495-498` — `.listen({ port: Config.PORT, hostname: Config.HOST })`.
- `DU/backend/src/config.ts:19-20` — `PORT = parseInt(env.PORT || "8002")`, `HOST = "0.0.0.0"`; module-local `backend/.env` pins `PORT=3104` (verified: `backend/.env` line 9). dotenv is loaded FIRST before any other code (`config.ts:3-9`).

### How one process serves API + dist
- `index.ts:57` — `DIST_ROOT = "../frontend/dist"`; static assets via `staticPlugin` (`index.ts:222-225`) PLUS hand-rolled `serveDistAsset()` with an in-memory gzip cache keyed by lastModified for compressible extensions (`index.ts:90-145`), and a traversal guard `isSafeDistPath()` (`index.ts:81-86`).
- SPA fallback `GET *` serves `dist/index.html` for extension-less non-API paths, 404s API-shaped and file-shaped misses (`index.ts:459-491`).

### Auth WITHOUT gateway running (dual-algorithm design)
- `DU/backend/.env`: `USE_PROXY=true`, `AUTH_MODE=external`; config derives `AUTH_MODE` from `USE_PROXY` when unset (`config.ts:26-32`).
- `backend/src/services/authService.ts:146-201` — `verifyToken()` inspects the JWT header: **HS256** tokens are its own issued session tokens (`createToken` at `133-143`, secret `JWT_SECRET`); **RS256** tokens are PORTAL cookies/tokens verified with `importSPKI(PUBLIC_KEY_PATH)` i.e. `backend/keys/public.pem` (`config.ts:69-71`). Under `AUTH_MODE=internal` (standalone, no proxy) RS256 is rejected; under `external` it is accepted. So direct-port users who logged in via the portal still pass with the very same RS256 token.
- Per-request resolution: `.derive(({headers}) => resolveUserFromHeaders(headers, authService))` on routes (`backend/src/api/auth.ts:31-33`); `resolveUserFromHeaders` in `backend/src/utils/authBypass.ts:86-110` accepts `x-api-key` bypass (`API_KEY_BYPASS`), `Authorization: Bearer`, and a fixed `SYSTEM_TOKEN` for machine traffic.
- Key-parity requirement documented in `DU/AGENTS.md`: "`keys/public.pem` must match the gateway's `keys/public.pem` (RS256 SSO)" — and indeed `DU/backend/keys/public.pem|private.pem|ssl.key` exist.

### Storage
- All relational data through **MSSQL via the sql-gateway HTTP API** — `DB_API_URL` default `http://localhost:8001` + `DB_API_KEY` + named profiles (`config.ts:35-39`) — i.e. a module consuming another module as an m2m service over API keys, not direct imports.
- Own aggregation/history tables in `extend_db_ptrj`; background table init via `setTimeout(...,1000)` non-blocking (`index.ts:148-152`); `logs/` dir.

### Direct + gateway reachability
- Same dist reachable at `/` and `/upah/*` and `/backend/upah/*`: index.ts mounts `/upah`, `/upah/assets`, `/upah/images`, `/upah/*` SPA fallback (`index.ts:240-291`) AND `/backend/upah/assets|images` (`index.ts:262-270`).
- Every API router mounted TWICE: bare (`index.ts:393-434`) and re-grouped under `.group("/backend/upah", ...)` (`index.ts:437-456`) — that is the whole proxy-prefix strategy.
- Frontend built with `base: '/upah/'` in production/proxy mode so asset URLs survive proxying (`frontend/vite.config.js:70-91` `getBasePath()`).
- ROOT/routes-config.json: `id:"upah"` path `/upah` → `http://localhost:3104`, `public:true`, gateway serves `spaIndex` straight from `Module Services/daftar-upah/frontend/dist/index.html`, with `aliases`, `apiPrefixes`, `textRewrites` (`localhost:3104` → `/backend/upah`), `staticRoots` for `/upah/assets` + `/upah/images`, `healthPath:"/health"` (`routes-config.json:3-66`); second route `id:"backend-upah"` path `/backend/upah` `rewritePath:true` → `:3104` strips the prefix before proxying (`routes-config.json:68-78`).

---

## 3. rjfm (port 8011) — Express TS + Next standalone monolith + authkit

### Start command
- `RJFM/package.json:7-10` — `"dev": "tsx watch src/server.ts"`, `"start": "tsx src/server.ts"`. Deps fully local: express 4, jsonwebtoken, bcryptjs, mssql, multer, http-proxy-middleware, cors, dotenv. Isolation golden rule codified in `RJFM/CLAUDE.md` ("copy, jangan import lintas modul").

### Port binding
- `RJFM/src/config/env.ts:10` — `port: parseInt(process.env.PORT || '8011', 10)`.
- `RJFM/src/server.ts:73` — `app.listen(env.port, '0.0.0.0', ...)`. UI never gets a second public port: the Next standalone server binds a PRIVATE `127.0.0.1:8012` (`RJFM_UI_PORT` override) and is reverse-proxied (`RJFM/src/ui/serve.ts:71-94`), with `process.env.RJFM_API_PORT = String(env.port)` pinned at `serve.ts:76` so UI-side SSR fetches hit the API port, not the private UI port. Readiness poll loop before wiring the proxy (`serve.ts:83-86`); UI mounting is ASYNC and the catch-all 404 only registers after the proxy is ready (`server.ts:58-60`).

### Auth WITHOUT gateway running
`RJFM/src/middleware/auth.ts` — `auth(requiredRoles?)` middleware resolves in priority order:
1. `x-user-id` present → treat as gateway-injected identity (proxy mode; gateway strips inbound spoofed copies before injecting) (`auth.ts:30-44`).
2. `Authorization: Bearer` or `x-api-key` → own HS256 JWT via `jwt.verify(token, env.jwtSecret)` (`env.ts:19` dev secret; issued by `RJFM/src/routes/auth.ts:12` and stored as cookie `rjfm-token` at `auth.ts:20-22`) (`middleware/auth.ts:45-47,76-93`).
3. Cookie `rjfm-token` (UI-monolith login) (`auth.ts:49-52`).
4. **Portal RS256 cookie** `auth-token`/`payroll_auth_token` verified via `verifyPortalCookie(...)` imported from the module-local authkit copy (`middleware/auth.ts:6,54-74`) — the direct-port SSO story.
- Role gates return 403; missing identity 401. Role constants (`MANAGER_ROLES`, `TASK_CREATOR_ROLES`) at `middleware/auth.ts:12-16`.
- Service-to-service surface `/api/gateway/*` is separately gated by `requireApiKey` — static `x-api-key` vs `RJFM_API_KEY`, returning **503 when unset** rather than silently open (`RJFM/src/middleware/apikey.ts:15-30`; applied `routes/gateway.ts:12`).

### authkit — the copy-per-module kit (THE reusable piece)
Files in `RJFM/src/lib/authkit/`:
- `authkit.js` (178 lines, zero dependencies — Node crypto+fs only) — verbatim copy of `ROOT/shared/authkit/index.js`.
- `authkit.d.ts` — hand-written types for all exports.
- `README.md` — the contract: two access modes table, usage snippets, and TRUST RULES ("NEVER trust raw inbound X-User-* on a port exposed to LAN"; verification needs only `keys/public.pem`).

Exported functions (`authkit.js`):
| Export | Lines | Purpose |
|---|---|---|
| `verifyGatewayIdentity(headers)` | 16-31 | Read `x-user-id/name/email/role` case-insensitively; null ⇒ "not via gateway" |
| `hasRole(user, ...roles)` | 34-38 | Case-insensitive role membership |
| `verifyPortalCookie(token, opts?)` | 77-104 | RS256-only verify (alg pinned at :89) against `keys/public.pem` located by walking up to 6 parent dirs (`findKeysDir` 44-53, overridable `opts.keysDir`), exp check (:95), verified-payload cache max 1000 valid until exp−5s (:69-99), never throws |
| `extractPortalToken(cookieHeader)` | 109-113 | Regex `(?:^|;\s*)(?:auth-token\|payroll_auth_token)=([^;]+)` |
| `resolveIdentity({headers,cookie,opts})` | 120-133 | Both modes in one call: gateway headers first, cookie second |
| `requireAuth({roles?})` | 140-169 | Express middleware: gateway identity → portal-cookie fallback → 401 / 403-on-role-miss; sets `req.user` |

### How rjfm wires it
- Only `verifyPortalCookie` is imported, into `RJFM/src/middleware/auth.ts:6`, feeding branch 4 above. Grep confirms **`requireAuth` is NOT used anywhere in rjfm's routes** — rjfm deliberately kept its richer 4-branch `auth()`; the kit's `requireAuth` exists as the ready-made drop-in for new simpler modules. (sql-gateway consumes the same kit differently — see its `plugins/auth.ts:13-18`.)
- Type augmentation for `req.user` lives in `middleware/auth.ts:18-24`.

### Route mounting = the dual-reach trick (rewritePath:false pattern)
- Health endpoints registered under THREE prefixes `''`, `'/rjfm'`, `'/file'` (`server.ts:28-32`).
- EVERY API router mounted under the same three prefixes (`server.ts:35-53`) so one codebase answers direct `:8011/api/v1/*` AND proxied `:3001/rjfm/api/v1/*` and `:3001/file/api/v1/*` identically, with NO path rewriting anywhere.
- `mountApiRewriter` (`ui/serve.ts:25-45`, called FIRST at `server.ts:21`) maps UI-friendly `/api/file/*` → `/api/v1/*` at the app level (rewrites `req.url` AND `req.originalUrl` — comment warns scoped routers would break this).
- ROOT/routes-config.json: three entries all `rewritePath:false, public:true` — `id:"rjfm"` `/rjfm` → `:8011` (`routes-config.json:217-226`), `id:"file"` `/file` → `:8011` (`199-206`), `id:"api-file"` `/api/file` → `:8011` (`207-215`).

### Storage
- Metadata/demo store: JSON file inside module — `RJFM_STORE_PATH || cwd/data/rjfm-demo.json`, persisted via `fs.writeFileSync` (`RJFM/src/lib/store.ts:8,203-216`).
- Real file bytes: Synology NAS over DSM/FileStation HTTP (`RJFM_NAS_URL=http://10.0.0.8:5000`) via client `src/lib/nas.ts` + adapter `src/lib/storage.ts` (`ensureStorageRoot/saveBuffer/deleteRemote/statRemote`, storage.ts:47-97); storage-root creation is fire-and-forget so NAS outage never blocks listen (`server.ts:69-71`).
- User directory from MSSQL `extend_db_ptrj.user_ptrj` with JSON demo fallback (`src/lib/directory.ts`, store.ts).

---

# The Independence Checklist for a NEW Bun HTTP module

A new module is "standalone-independent" when ALL of these hold (each item cites the exemplar that proves it):

1. **Own folder + own package.json, zero cross-module imports.** Scripts self-contained (`bun run src/index.ts`); shared code = COPY into `src/lib/`, never import across modules or from Dashboard_Utama (SQLGW/package.json:7-13; RJFM/CLAUDE.md golden rule; DU/AGENTS.md "Isolation contract").
2. **Own fixed port with env override + hardcoded default**, bound explicitly with a host: `intEnv('PORT', <port>)` + `listen({port, host:'0.0.0.0'})` (SQLGW/src/config.ts:125-128, index.ts:93; RJFM env.ts:10, server.ts:73; DU config.ts:19-20 + module-local `.env` pinning e.g. `PORT=3104`).
3. **Public unauthenticated `/health`** that ALSO answers under the gateway's proxied prefixes (SQLGW index.ts:35-46; rjfm triple-prefix health server.ts:28-32; DU `/health` index.ts:330-335 + `healthPath` in route entry).
4. **Pick a dual-reach routing strategy and apply it consistently:**
   - rewritePath:false → mount every router under `['', '/<gwPath>', ...]` prefixes (rjfm server.ts:35-53);
   - rewritePath:true → additionally mount all routers under `.group("/<stripPrefix>")` so the stripped path works too (DU index.ts:393-456);
   - keep legacy alias prefixes alive if old direct callers exist (SQLGW index.ts:65-68).
5. **Auth stack without the gateway** — copy `ROOT/shared/authkit/index.js` (zero-dep) into `src/lib/authkit/` + add `.d.ts` + keep its README; resolution order: (a) gateway `X-User-*` headers — pair with a LOOPBACK-peer check like SQLGW auth.ts:43-46,100-122, (b) own static `x-api-key` for m2m (timing-safe compare), (c) `verifyPortalCookie` RS256 with `keys/public.pem` for direct browser access, (d) optional own HS256 JWT/login as final fallback. Ship `requireAuth({roles})`-style middleware; 401 vs 403 semantics.
6. **Key parity:** module's `keys/public.pem` byte-identical to ROOT `keys/public.pem` (single RSA keypair; DU/AGENTS.md states it, DU/backend/keys and ROOT/keys both exist). Never commit keys.
7. **Register BOTH reach paths in ROOT/routes-config.json AND routes-config.production.json**: UI path entry (with `spaIndex`/`staticRoots`/`textRewrites` if the gateway serves dist itself, as upah does) and/or API path entry; set `public`, `rewritePath` deliberately (routes-config.json:3-78, 196-249). Remember CLAUDE.md rule: module path must NOT be added to `shared/auth/paths.js DASHBOARD_PATHS`.
8. **Single-port monolith UI**: serve static dist in-process (`@fastify/static` / Elysia `staticPlugin`+`Bun.file` gzip-cache / express static) or reverse-proxy a PRIVATE loopback port for Next standalone (`127.0.0.1:<internal>` + readiness poll + `ws:true`) — never expose a second public port (RJFM ui/serve.ts:71-95; RJFM/CLAUDE.md "❌ Membuat port kedua untuk UI").
9. **Frontend base path** must match the gateway subpath in production builds (`getBasePath()` → `/upah/`, DU frontend/vite.config.js:70-91) so assets resolve identically direct and proxied.
10. **Data inside the module folder** (`data/`, `logs/`) or an explicitly configured remote (NAS env vars, MSSQL profiles, or another module over its m2m API-key API like DU→SQLGW `DB_API_URL:8001`); background init must be non-blocking and failure-tolerant (rjfm server.ts:69-71; DU index.ts:148-152; SQLGW warm-up index.ts:91).
11. **Module-local `.env`, gitignored, loaded before anything else** (DU config.ts:3-9; rjfm server.ts:1 `import 'dotenv/config'`).
12. **Graceful shutdown** (SIGTERM/SIGINT flush + close) and an `unhandledRejection` logger so the process stays clean under the module manager (SQLGW index.ts:72-88); startable/stoppable via root `node scripts/module.js start <name>` with a registry entry (per MONOREPO.md/DU AGENTS.md).
13. **Optional service-to-service gateway surface** (`/api/gateway/*` style) hard-gated by static `x-api-key`, failing CLOSED (503) when the key is not configured (rjfm apikey.ts:15-30).
14. **Ship an `AGENTS.md`/`CLAUDE.md`** in the module documenting: golden isolation rule, dual-access URL table with per-mode auth, port, commands, storage locations, forbidden actions (DU/AGENTS.md; RJFM/CLAUDE.md are the templates).

### Notable divergence to decide for the new module
rjfm trusts `x-user-id` from ANY peer (`middleware/auth.ts:30-44`) while sql-gateway restricts `X-User-*` trust to loopback peers and records spoof attempts (`plugins/auth.ts:43-46,100-122`). For a new module binding `0.0.0.0`, replicate sql-gateway's stricter loopback check (or bind loopback-only) — this matches the trust rule #1 in `RJFM/src/lib/authkit/README.md` and `ROOT/shared/authkit/README.md`.

---

# Bun Gateway (`server_bun.js`) — IFESS Surface Analysis

All citations are to `D:\Gawean Rebinmas\Main Dashboard\server_bun.js` (1877 lines, working tree == HEAD) unless another file is named.

## 1. Service require — CONFIRMED

`server_bun.js:29-30`:
```js
// IFESS shared service (kept in CommonJS for Bun/Node compatibility)
const ifessService = require('./Services/ifess-control-server/service');
```
The entire control-plane state machine (JSON stores under `data/ifess/*.json`) is loaded **in-process into the gateway** from `D:\Gawean Rebinmas\Main Dashboard\Services\ifess-control-server\service.js`.

## 2. `handleIFESSApi(req, reqPath)` — actual start is line 380 (not ~140)

Branches, in order (`server_bun.js:380-513`):

| Branch | Line | Auth | ifessService call |
|---|---|---|---|
| `GET /api/ifess/health` | 382-386 | public | none (inline `{status:'Healthy'}`) |
| `GET /api/ifess/server-info` | 388-390 | public | `getServerInfo()` |
| `POST /api/ifess` `{action,...}` | 393-400 | `validateApiKey` (X-API-Key == `IFESS_API_KEY`, :129-133) | delegates to `handleIFESSActionDispatcher` |
| `reqPath.startsWith('/api/ifess/query-gateway')` | 403-405 | — | `proxyFirebirdQueryService(...)` (dead in practice — the top-level fetch handler intercepts first at :1586) |
| API-key gate for everything below | 408-413 | X-API-Key required | — |
| `GET /api/ifess/clients[/]` | 416-418 | key | `listClients()` |
| `GET /api/ifess/dashboard` | 421-423 | key | `getDashboardSummary()` |
| `POST /api/ifess/clients/register` | 426-438 | key | `registerClient(data)` |
| `POST /api/ifess/clients/:id/heartbeat` | 441-452 | key | `receiveHeartbeat(clientId, data)` |
| `GET /api/ifess/clients/:id/commands/pending` (SuperApp compat) | 455-459 | key | `pollPendingCommands(clientId)` |
| `GET /api/ifess/clients/:id/config` | 462-466 | key | `getClientConfig(clientId)` |
| `POST /api/ifess/clients/:id/commands/:cmdId/result` | 469-482 | key | `reportCommandResult(clientId, commandId, data)` |
| `GET`/`POST /api/ifess/client-groups` | 485-500 | key | `listClientGroups()` / `createClientGroup(data)` |
| `GET /api/ifess/audit-logs` | 503-507 | key | `listAuditLogs()` |
| default | 510-512 | — | 404 JSON |

## 3. POST `/api/ifess` action dispatcher — `handleIFESSActionDispatcher` (:136-281)

Full supported action list (each maps 1:1 onto an `ifessService.*` method):
- Dashboard/clients: `getDashboard`, `listClients`, `getClient`, `getClientConfig`, `registerClient`, `updateClientConfig`
- Heartbeats/modules: `sendHeartbeat` + alias `receiveHeartbeat`, `getModuleStatuses`, `reportModuleStatus`
- Commands: `pollCommands`, `listCommands`, `createCommand`, `reportCommandResult`
- Client groups: `listClientGroups`, `getClientGroup`, `createClientGroup`, `updateClientGroup`, `deleteClientGroup`, `addClientToGroup`, `removeClientFromGroup`
- Audit: `listAuditLogs`
- Firebird→SQL sync: `listSyncDivisions`, `syncBootstrap` (:247-267 — resolves division, creates job, spawns `FB_Migration` node subprocess via `spawnFbMigration()` :646-680, pointing outside the repo at `ROOT_DIR/../FB_Migration/src/migrate.js`), `listSyncJobs`, `getSyncJob`
- Unknown action → 400 (:275-276)

## 4. Query-Gateway routing — proxied WHERE?

Two distinct paths:

**(a) Proxied out of the gateway.** `proxyFirebirdQueryService()` (:1247-1271) strips the `/api/ifess/query-gateway` or `/api/query-gateway` prefix and forwards verbatim to:
```js
const FIREBIRD_QUERY_TARGET = process.env.FIREBIRD_QUERY_TARGET || 'http://localhost:8004';  // :60
```
Top-level dispatch: `/api/query-gateway/*` → proxy (:1592-1594); `/api/ifess/query-gateway*` → proxy (:1586-1588). On connection failure it returns **503 "Firebird Query Service Unavailable"** (:1266-1269) — no embedded fallback.

**(b) Gateway-local REST (`handleQueryGateway` :515-640)** — reached only for `/api/ifess/sync/*` (:1583-1585). All calls go straight to the in-process `ifessService`: `listQueryTemplates`, `isReadOnlySql`, `createQueryBatch`, `getQueryBatch`, `listQueryBatches`, `createQueryTemplate`, `deleteQueryTemplate`, `updateQueryTemplate`, `storeQueryJobResult`, `storeQueryResultChunk`, `getSyncJob`.

**Critical finding — there is NO separate Firebird query service in this repo anymore, and NO in-process isql execution either.**
- `execLocalQuery` / `withIsqlLock` / `parseIsqlOutput` appear **zero times** in the current `server_bun.js` (grep verified; HEAD == working tree).
- Commit `80053c6` ("fix(P2): route Firebird Query legacy endpoints through standalone service", 2026-07-18) removed ~242 lines of gateway-local isql executor/parser/lock code and introduced the :8004 proxy. Its message states: *"Removed gateway-local Firebird executor, parser, isql config, and direct explore/exec-sync branches"*.
- The standalone `Services/firebird-query-service/` (the intended :8004 listener, incl. `src/exec.js` with the isql shell-out) was **deleted from disk** by commit `bcd8af9` ("restore ifess service + remove dead Services dirs", 2026-08-20). Nothing in `Module Services/ifess-server` binds 8004 (`config.js:38` → `IFESS_PORT || '8012'`), and nothing else references 8004 except an unrelated daftar-upah Vite variable.
- Net effect: **today `/api/query-gateway/*` and `/api/ifess/query-gateway/*` through the gateway return 503 unless some untracked external process listens on :8004.** The new `ifess-server` module (:8012) implements the *same* query-gateway REST surface locally (`Module Services/ifess-server/src/handler.js:244-328`, mounted at both bare and `/api/ifess`-prefixed paths :407-436) — but it also has **no exec-sync/isql** (no child-process/isql hits in `ifess-server/src` or in `Services/ifess-control-server/service.js`; grep verified).
- Docs are stale: root `CLAUDE.md:213-216`, `docs/MONOREPO.md:130`, and `docs/03-services-query/Firebird-Query-Gateway.md` still describe `execLocalQuery()` inside `server_bun.js`.

## 5. Direct Firebird execution location — NEGATIVE confirmation

- `server_bun.js`: no `isql`, `execLocalQuery`, `withIsqlLock`, `parseIsqlOutput` (only `FIREBIRD_QUERY_TARGET` remains, :60/:1251).
- `Services/ifess-control-server/service.js`: grep for `isql|execLocalQuery|withIsqlLock|execFileSync` → **no matches**. It contains only template text mentioning "Firebird" and the `EXECUTE_FIREBIRD_QUERY` commandType dispatched to desktop clients (:1572, :1912).
- Therefore the historical "direct isql.exe shell-out" path exists **nowhere in the repository today**. The only Firebird-adjacent execution left is the gateway-spawned external `FB_Migration` subprocess for bootstrap sync (`spawnFbMigration`, :646-680) and client-side execution pushed to iFESS SuperApp desktops via commands. The zombie-isql reaper described in CLAUDE.md is likewise gone with the executor.

## 6. `matchRoute` (:851-858) — CONFIRMED

```js
function matchRoute(urlPath) {
    // Skip IFESS API paths - handled directly by this server
    if (urlPath.startsWith('/api/ifess')) return null;
    ...
}
```
(`/api/ifess` is additionally intercepted earlier in `fetch()` at :1580-1590.) Consequence: the `api-ifess` route entry in `routes-config.json:134-141` (target `http://localhost:8012`, "→ ifess-server module") is **present but unreachable** — delegation to :8012 is configured but not active for API traffic. Only `/ifess-control` UI pages proxy to :8012 via the `ifess-control` route (`routes-config.json:122-132`).

## 7. Static serving of the ifess-control HTML

- `IFESS_CONTROL_DIR = ${ROOT_DIR}/Module Services/ifess-control` (:66); HTML cached once per process (`ifessAppHtml`/`ifessSimpleHtml`, :50-51).
- `:1767-1770` — `/ifess-control`, `/ifess-control/`, `/ifess-control/app`, `/ifess-control/app/` → `readFileSync(IFESS_CONTROL_DIR + '/app/index.html')`.
- `:1771-1774` — `/ifess-control/simple[+]` → `simple/index.html`.
- `/ifess-assets` → `${IFESS_CONTROL_DIR}/assets` via `DEFAULT_STATIC_ROOTS` (:894-897), served through the pre-auth static bypass (:1702-1714) — assets skip cookie/JWT verification entirely.
- Gateway-side X-API-Key guards explicitly exempt `/ifess-control` and `/ifess-assets` (:1731-1733).
- Note: the `ifess-server` module can also serve the same UI itself (`handler.js:380-398` `serveUi`), so this capability now exists in TWO places; the gateway copy reads the files directly and works even with :8012 down.

## 8. Reaper interval — CONFIRMED

`server_bun.js:682-688`: every **30 s**, gateway calls `ifessService.reapStaleCommands(120)` (fail Received-commands whose client hasn't reported within 120 s), logging `[reaper] failed N stale command(s)` when non-zero, inside try/catch ("reaper must never crash the gateway"). The actual implementation lives in `Services/ifess-control-server/service.js`. Caveat: `Module Services/ifess-server/src/index.js:63` also invokes `svc.reapStaleCommands()` on its own timer, so when both the gateway and :8012 run, two processes reap the same shared JSON store.

## 9. `/api/services/status` (:1671-1690)

JWT-cookie-authenticated; TCP-probes (500 ms cap, `checkTcpPort` :1237-1243) every enabled, non-hidden, HTTP route **whose target string starts with `http://127.0.0.1`**; cached 30 s. From the live `routes-config.json` this includes exactly: `server-monitor` (:3102), `report-center`+`api-reports` (:3101), `file`+`api-file` (:8011), `sql-gateway`+`api-sql-gateway` (:8001).

**Excluded** because their targets use `http://localhost:` or non-http schemes: `upah`/`backend-upah` (:3104), `absen` (:5176), `monitoring-beras` (:5177), `basis-panen` (:3002), `query` (:8001), `file-legacy` (:5178), `rjfm` (:8011 — its sibling `/file` route IS checked), `network-monitor` (`static://`), and **both `ifess-control` and `api-ifess` (:8012)** — so **ifess-server :8012 is NOT monitored** by the status endpoint despite being a registered module (`scripts/module.js:29` registers `'ifess-server': { dir: 'Module Services/ifess-server', cmd: ['bun','run','src/index.js'], route: 'ifess-control' }`; it's also absent from `scripts/start-module-services.ps1`'s `$MODULES` registry).

---

# Conclusion — capabilities ONLY in the gateway vs already delegated

**Exists ONLY inside `server_bun.js` today:**
1. **Static UI serving of `Module Services/ifess-control` HTML** (:66, :1767-1774) + `/ifess-assets` asset root (:894-897) — direct disk read, cached, pre-auth bypass.
2. **In-process IFESS control-plane hosting**: `require('./Services/ifess-control-server/service')` (:30) + the full REST surface (:380-513), the `{action}` RPC dispatcher (:136-281), and the `/api/ifess/sync/*` REST subset (:515-640) — all executing against the shared JSON stores inside the gateway process.
3. **`syncBootstrap` → `FB_Migration` subprocess spawning** (:646-680) — gateway-only orchestration of an out-of-repo migration tool.
4. **Legacy `/api/clients/*` → `/api/ifess/clients/*` rewrite** for Kerani SuperApp (:1576-1578).
5. **API-key enforcement layer**: `IFESS_API_KEY` gate on `/api/ifess*` (:129-133, :394, :408), `IFESS_CLIENT_API_KEY` on `/ifess` client-RPC paths (:1731-1733), `QUERY_API_KEY` on `/query` (:1725-1726); production boot refuses without all three (:121-125).
6. **Stuck-command reaper scheduling** (:685-688) — though the module duplicates it.
7. **Identity plumbing** consumed by ifess endpoints: RS256 cookie verify + `X-User-*` header injection/stripping (:1199-1223).

**Already delegated / no longer in the gateway:**
1. **Direct Firebird isql execution** — removed from the gateway in `80053c6`; the standalone `Services/firebird-query-service` that inherited it was deleted from disk in `bcd8af9`. It survives nowhere in the repo; CLAUDE.md/docs still claim otherwise. `/api/query-gateway/*` + `/api/ifess/query-gateway/*` are pure proxies to `FIREBIRD_QUERY_TARGET` (:60, :1247-1271) which currently has no in-repo owner (:8004) → guaranteed 503 unless run externally.
2. **Portal/Dashboard** — child process supervised by the gateway (`startDashboardIfNeeded`/`spawnPortalChild` :1055-1131).
3. **Other module services** — never started by the gateway (:1133-1138); proxied via `routes-config.json`.
4. **Delegated-in-name-only**: `routes-config.json:134-141` declares `/api/ifess → :8012` and `scripts/module.js:29` registers the `ifess-server` module (which fully reimplements the same API surface over the same service core), but `matchRoute`'s hard return-null (:853) plus the early intercept (:1580) keep all `/api/ifess*` traffic inside the gateway process. Realizing the :8012 delegation requires deleting the gateway-local handlers, not just the route entry.


## VERIFICATION VERDICTS (workflow-complete)

Wrong count: 0

1. CONFIRMED — server_bun.js:29-30: line 30 is exactly `const ifessService = require('./Services/ifess-control-server/service');` (comment above: "IFESS shared service"). The full ~1996-line CJS control-plane module (clients/heartbeats/commands/groups/audit/query jobs/sync) loads into the gateway process.

2. CONFIRMED — server_bun.js:851-853: matchRoute() opens with `if (urlPath.startsWith('/api/ifess')) return null;` (line 853). The api-ifess route exists at routes-config.json:134-141 (target http://localhost:8012) but is unreachable: the fetch handler intercepts /api/ifess* at server_bun.js:1580-1590 (plus legacy /api/clients at :1576-1578), before route resolution at :1692. Dead config.

3. CONFIRMED — routes-config.production.json has NO ifess-control/api-ifess/:8012 entries (full scan of all entries). Only ifess-related entry is {"id":"ifess","path":"/ifess","target":"http://localhost:8003"} spanning lines 172-180 (content at :171-179 as claimed) — stale legacy.

4. CONFIRMED — ifess-server/src/config.js:38 defaults IFESS_PORT||'8012'; bound on hostname '0.0.0.0' at src/index.js:30. rjfm/src/ui/serve.ts:72 defaults RJFM_UI_PORT||'8012' (HOSTNAME='127.0.0.1' set at line 74, just past the cited 71-73 window). Both default 8012 → collision when run together.

5. CONFIRMED — Module Services/ifess-server/src/service.js:27-30 uses createRequire to load <repo>/Services/ifess-control-server/service.js (header comments document the shared-store design); Services/ifess-control-server/service.js:22: DATA_DIR = path.join(__dirname,'../../data/ifess') → shared repo-root store (no env override exists).

6. CONFIRMED — handler.js:43 imports resolveIdentity from '../../../shared/authkit/index.js' (repo-root shared original), violating docs/MONOREPO.md:176-179 ("copy the file into your module — isolation rule: no cross-module imports"). Contrast: rjfm copied its kit to Module Services/rjfm/src/lib/authkit/ (verified present).

7. CONFIRMED — handler.js:218 resolves '../../../FB_Migration/src/migrate.js' → Main Dashboard/FB_Migration/src/migrate.js which does NOT exist (verified); the real project is at D:/Gawean Rebinmas/FB_Migration/src/migrate.js (verified present). handler.js:225 spawns with no env option ({stdio:'ignore',detached:false}), while the gateway's spawnFbMigration (server_bun.js:646-656) explicitly propagates env incl. DB_NAME/DB_SERVER/DB_PORT/DB_USER/DB_PASSWORD.

8. CONFIRMED — config.js:47 defaults UI_DIR to REPO_ROOT/'Module Services/ifess-control'. Gateway disk-serves the same folder: server_bun.js:66 (IFESS_CONTROL_DIR), :1767-1774 (app/simple HTML), :895 ('/ifess-assets' static root), with process-lifetime HTML caches at :50-51 ("read once, cached for the process lifetime").

9. CONFIRMED — gateway setInterval runs ifessService.reapStaleCommands(120) every 30000ms (server_bun.js:685-688); module setInterval runs svc.reapStaleCommands() every 60_000 (index.js:61-67). Both processes hold separate in-memory caches over the identical data/ifess JSON store → concurrent mutation of the same files.

10. CONFIRMED — server_bun.js:1677-1678 filters status probes to !hidden && isHttpTarget && target.startsWith('http://127.0.0.1'). The ifess routes target 'http://localhost:8012' (routes-config.json:127 and :136) → excluded from /api/services/status portal health cards.

11. CONFIRMED — scripts/module.js:29 registers 'ifess-server' with route:'ifess-control'; port auto-derived from route target via new URL(r.target).port (module.js:37-40). start-module-services.ps1 $MODULES (:54-71, optional dashboard-portal appended :72-79) contains only report-center, rebinmas-jaya-server, rjfm, sql-gateway, daftar-upah — no ifess entry.

12. CONFIRMED — shared/auth/paths.js:11 lists exactly ['/admin','/dashboard','/dashboard-user','/modules','/api/services','/ifess-control','/api/ifess','/api/query-gateway','/config-path']. CLAUDE.md:55-57 states DASHBOARD_PATHS "must NOT include a module's path"; /ifess-control and /api/ifess are now registered module routes (routes-config.json:123-141), so the rule is violated today.

13. CONFIRMED — grep -c for execLocalQuery|isql returns 0 in both server_bun.js and Services/ifess-control-server/service.js. /api/query-gateway/* goes only through proxyFirebirdQueryService (server_bun.js:1247-1271) to FIREBIRD_QUERY_TARGET default http://localhost:8004 (:60); repo-wide search finds no in-repo listener on 8004 (only the constant, docs, and build artifacts). ifess-server's query-gateway endpoints (handler.js:247-290 validate/dispatch/batches/jobs/chunks) call svc.createQueryBatch which enqueues commandType 'EXECUTE_FIREBIRD_QUERY' (service.js:1572, cf. :1912) for desktop clients — no local SQL execution.

14. CONFIRMED — wire.test.js:10 drives the real handleRequest against the real bridged service (zero mocks/isolation: greps for beforeAll/afterAll/rmSync/unlink/tmpdir/deleteClient/mock all 0). :71 creates CID `TEST-${Date.now().toString(36)}`; :73-141 registers TEST clients, heartbeats, module statuses, and command lifecycles persisted into the live repo-root data/ifess/*.json with no cleanup.