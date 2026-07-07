# IFESS Control Server — Deep Dive

> Control plane for the iFESS SuperApp desktop client fleet. Manages client registration, heartbeat, module status, command dispatch, audit logging, and a Firebird 1.5 Query Gateway.

## 1. Purpose & Responsibilities
- Manage iFESS desktop clients: register, track online/heartbeat, per-client config, groups.
- Dispatch commands to clients and collect results (used by the query-batch flow & Firebird→MSSQL sync).
- Run **read-only SQL** against the local palm-estate Firebird DB (`PTRJ_ARC.FDB`) by shelling out to `isql.exe`.

## 2. Architecture (4 layers, one active process)
| Layer | File | Role |
|------|------|------|
| Bun gateway (ACTIVE) | `server_bun.js` | `handleIFESSApi` (`server_bun.js:2580`), `handleQueryGateway` (`server_bun.js:2734`), `execLocalQuery` (`server_bun.js:2968`). Calls shared `ifessService`. |
| Legacy seed core | `Services/ifess-control-server/service.js` | JSON-file persistence, client/command/template logic, `DEFAULT_QUERY_TEMPLATES`, `isReadOnlySql`. |
| Next.js proxy | `Dashboard_Utama/app/api/ifess/`, `app/api/query-gateway/route.ts` | Thin `{action,params}` → gateway `fetch` with `X-API-Key`. Only IFESS entry in Docker deploys. |
| Web UI | `Dashboard_Utama/app/ifess-control/` | Next.js pages calling `lib/api.ts`. |

**Sync trap:** `loadAll()` (`service.js:707`) re-reads ALL JSON from disk on every register/heartbeat-bearing call. Nested mutations that call `loadAll()` mid-handler can wipe unsaved in-memory cache.

## 3. Key Endpoints
Auth: `X-API-Key` on protected routes; public = none.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/ifess/health` | none | `{status:'Healthy', serverTime}` |
| GET | `/api/ifess/server-info` | none | server URL/config for clients |
| POST | `/api/ifess` | none | `handleFrontendProxy` — `{action,params}` UI dispatch |
| GET | `/api/ifess/clients` | key | `listClients()` |
| GET | `/api/ifess/dashboard` | key | `getDashboardSummary()` |
| POST | `/api/ifess/clients/register` | key | `registerClient` |
| POST | `/api/ifess/clients/:id/heartbeat` | key | `receiveHeartbeat` |
| GET | `/api/ifess/clients/:id/commands/pending` | key | `pollPendingCommands` |
| POST | `/api/ifess/clients/:id/commands/:cmdId/result` | key | `reportCommandResult` |
| GET/POST | `/api/ifess/client-groups` | key | list / create group |
| GET | `/api/ifess/audit-logs` | key | `listAuditLogs()` |
| GET | `/api/ifess/query-gateway/templates` | key | `listQueryTemplates()` |
| POST | `/api/ifess/query-gateway/validate` | key | `isReadOnlySql` |
| POST | `/api/ifess/query-gateway/exec-sync` | key | direct isql `execLocalQuery` |
| POST | `/api/ifess/query-gateway/dispatch` | key | `createQueryBatch` |
| GET | `/api/ifess/query-gateway/explore` | key | list all tables+views (2 parallel isql) |
| GET | `/api/ifess/query-gateway/explore/:table` | key | list columns of a table/view |
| POST/DELETE | `/api/ifess/query-gateway/templates[/:code]` | key | create / delete template |

**Frontend proxy actions** (`handleFrontendProxy`, `server_bun.js:230`): `getDashboard, listClients, getClient, getClientConfig, registerClient, updateClientConfig, sendHeartbeat, getModuleStatuses, reportModuleStatus, pollCommands, listCommands, createCommand, reportCommandResult, listClientGroups, createClientGroup, updateClientGroup, deleteClientGroup, listAuditLogs, listSyncDivisions, syncBootstrap, listSyncJobs, getSyncJob`.

> ✅ **Fixed:** `updateTemplate` via `PUT /api/ifess/query-gateway/templates/:code` now has a handler in `handleQueryGateway` (`server_bun.js`). Before, editing templates via the dashboard 404'd at the gateway.

## 4. Client Lifecycle
1. **Register** — client fetches `/server-info`, POSTs `/clients/register`. `registerClient` (`service.js:822`): upsert client (status `Online`), create default `configs[clientId]` (`configVersion:1, allowRun:true, modules:[]`), `loadAll()` then `saveDirty(['clients'])`.
2. **Heartbeat** — periodic POST `/heartbeat` (`receiveHeartbeat`, `service.js:964`): sets `Online` + `lastHeartbeatAt`, appends to `heartbeat-logs`.
3. **Command flow** — `createCommand` (`service.js:1061`, status `Received`) → `pollPendingCommands` (`service.js:1099`) → `reportCommandResult` (`service.js:1130`, `Completed/Failed`, audit-logged).
4. **Stuck-command reaper** — `setInterval` 30s fails any `Received` command unacknowledged >120s (`reapStaleCommands`, `service.js:1882`).
5. **Module status** — `reportModuleStatus` (`service.js:1016`) / `listModuleStatuses` (`service.js:1048`).

## 5. Query Gateway Internals
Execution path: `POST /api/ifess/query-gateway/exec-sync` → `isReadOnlySql` guard → `execLocalQuery(queryText, maxRows)`.
- **Temp-file collision fix** (`server_bun.js:2972`): `ifess_exec_${Date.now()}_${pid}_${_seq}.sql` — `_seq` monotonic counter stops concurrent `Promise.all` from overwriting each other's `.sql` (was causing `/explore`→0 tables while `/exec-sync`→183).
- **isql serialization** (`withIsqlLock`, `server_bun.js:2962`): Firebird 1.5 `fbserver` is single-threaded; `_isqlChain` promise queue runs at most one isql at a time.
- **20s timeout** (`execFileSync`, line 2985) so a hung query fails fast and frees the queue.
- **Zombie reaper** (`catch`, line 2993): `spawnSync('taskkill','/IM','isql.exe','/F')` kills all isql on any failure to release a pinned `fbserver` lock.
- **`spawnSync`+timeout avoided** under Bun (false SIGTERM on fast success); keep `execFileSync`.
- **`parseIsqlOutput`** (`server_bun.js:2895`): merges multi-page isql (≈20 rows/page) by detecting `===` separators and slicing cells by column spans. All cells are strings — cast in app.
- **Read-only guard** `isReadOnlySql` (`service.js:1426`): must start `SELECT`/`WITH`; rejects write keywords, multiple statements, semicolons.

## 6. Query Templates
- **Live store** = `data/ifess/query-templates.json` (edit directly; mtime-cached, no restart).
- **Seed** = `DEFAULT_QUERY_TEMPLATES` (`service.js:102`), runs only when JSON empty (`seedDefaultTemplates`, `service.js:694`).
- **Shape**: `templateCode, templateName, description, queryText, defaultMaxRows, defaultTimeoutSeconds, tags, enabled, createdBy, createdAt, updatedAt`.
- ~25 live templates: `ATTEND_*`, `FFB_*`, `GW_*`, `OT_*`, `EXEC_KPI`, `LIST_TABLES`, `TABLE_COLUMNS`, etc.

## 7. Data Storage (`data/ifess/*.json`)
`clients, configs, commands, module-statuses, heartbeat-logs, client-groups, audit-logs, query-templates, query-batches, query-jobs, query-results, query-result-chunks, sync-jobs, sync-divisions, query-history`.

## 8. Firebird 1.5 Sharp Edges
- Multi-year scanner tables (`FFBSCANNERDATA01..12`, `GWSCANNERDATA01..12`, `RTSCANNERDATA01..12`) hold ALL years in each month-slot. **Every scanner query MUST filter `TRANSDATE BETWEEN 'YYYY-MM-01' AND 'YYYY-MM-#LASTDAY#'`** else silent multi-year totals.
- `COUNT(DISTINCT)` over a UNION of large scanner tables times out → run separate single-table counts, combine in app.
- `ORDER BY <alias>` fails (SQLCODE -206) → use ordinal `ORDER BY 8 DESC`.
- No `WITH`/window functions/`FETCH FIRST n OFFSET`/derived tables → use `FIRST n`. Prefer `NOT IN` over `NOT EXISTS` (correlated times out).
- No `LAST_DAY()` / `EXTRACT(DAY FROM date)` → compute `#LASTDAY#` in app.
- Placeholders `#MONTH#/#YEAR#/#LASTDAY#/#TABLE_NAME#` injected **unquoted** (identifiers); others become quoted string literals. Substitution done in the HTML UI, not by isql.

## 9. Key Files
- `server_bun.js`: `handleIFESSApi:2580`, `handleFrontendProxy:230`, `validateApiKey:223`, `handleQueryGateway:2734`, `execLocalQuery:2968`, `withIsqlLock:2962`, `parseIsqlOutput:2895`
- `Services/ifess-control-server/service.js`: `DEFAULT_QUERY_TEMPLATES:102`, `seedDefaultTemplates:694`, `loadAll:707`, `registerClient:822`, `receiveHeartbeat:964`, `createCommand:1061`, `isReadOnlySql:1426`, `createQueryTemplate:1742`
- `Dashboard_Utama/app/ifess-control/lib/api.ts`, `types.ts`
