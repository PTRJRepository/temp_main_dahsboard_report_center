# Next.js Report System — Deep Dive

> MSSQL-backed analytics reports in a Report Center. Drill-down: **Report Center → Module → Report list → Report Viewer**.

## 1. Navigation
```
Report Center (landing) → Module → Report list → Report Viewer (table + charts + AI)
```
- **Landing** — `components/ReportCenterPage.tsx`: grid of `ModuleCard`s (`components/dashboard/ModuleCard.tsx` `MODULES`) + insight section. Reads `?source=` (estate/pabrik) and `#modules`.
- **Module** — `app/(report-center)/report-center/[module]/page.tsx` (server): resolves via `getModulePanel(module, source)` (`lib/reports/module-panel.ts`); `inventory` redirects to `/report-center/inventory`.
- **Inventory** — `InventoryReportsClient.tsx`: source toggle, flow-stage filter, report tiles, preview, AI Insight, Excel/PDF export (only **live** reports).
- **Viewer** — `ReportViewerClient.tsx`: generic renderer keyed by `reportId` profile; KPIs, grouping/sort/filter, virtualized table, movement detail rows.
- **Shell** — `ReportCenterShell.tsx`: sidebar + topbar + `<main>`; `sidebarCollapsed` from `useReportStore`.

## 2. Report Handler Contract
`app/api/reports/inventory/route.ts:84`:
```ts
type ReportHandlerOptions = { limit:number; limitAll?:boolean; search:string; ctx:QueryContext; stale:string; filters?:ReportFilterInput }
type ReportHandler = (o:ReportHandlerOptions) => Promise<ReportPayload>
type ReportPayload = { title; description; rows:DbRow[]; columns:string[]; summary:DbRow; chart:DbRow[]; metadata:DbRow }
```
- `limit` capped at `TABLE_WINDOW_ROW_LIMIT=20000` (route.ts:92). `limitAll` true for CSV/full export.
- Handlers registered in `reportHandlers` lookup (route.ts:3353), keyed by `apiReport` + aliases. `GET` (route.ts:3392) resolves, then `handler({limit,limitAll,search,ctx,stale,filters})` (route.ts:3434).
- Example handlers: `stockSummary:1012`, `assetStockValuationListing:1089`, `allStockMovementAnalysis:1272`, `stockCard:1664`, `stockMovement:1757`, `fertilizerInventoryProcurement:3169`, `vehicleRunningWorkshop:3252`.

## 3. MovementCategory (from StockIssueEventCount)
`lib/reports/movement-category.ts`. SQL CASE:
```sql
WHEN <issueCount> >= 6 THEN 'Fast Moving'
WHEN <issueCount> BETWEEN 2 AND 5 THEN 'Moving'
WHEN <issueCount> = 1 THEN 'Slow Moving'
WHEN <quantityClosing> > 0 THEN 'Dead Stock'
ELSE 'Stale'
```
`StockIssueEventCount` = `COUNT(DISTINCT StockIssueID)` over valid issue docs (ItemType 1: `IN_STOCKISSUE/_LN`; ItemType 4: `WS_JOBSTOCK.TransType=1`). Order: `['Fast Moving','Moving','Slow Moving','Dead Stock','Stale']`. Legacy `'No Movement'` normalized to `'Stale'`. Viewer color via `movementTone` (ReportViewerClient.tsx:919).

## 4. ReportViewerClient
- **Initial load** `TABLE_FIRST_LIMIT=500` (tsx:148); first request `min(pageSize,500)` then paginate (`pageSize` default 100).
- **Profile** `getReportViewerProfile(reportId)` (tsx:767): `businessColumns/technicalColumns/fallbackColumns`, `kpiBuilder/qualityBuilder/topRowsBuilder`, `presets`, `preferredGroupColumns`, `defaultSort`, `rowDetail` (`'generic'|'movement'`), `naturalPlaceholder`, `showAccountingPeriodFilter`, `loadAllRows`.
- **`source` param**: `normalizeSource` (tsx:519) → `'pabrik'` only if literally `pabrik`, else `'estate'`. Persists in `localStorage` (`'report-center:last-source'`).
- Virtualized rows (`useVirtualizer`), server+client sort, column filters, AI Insight (`/api/reports/{id}/ai-analysis`, cached `sessionStorage`), CSV/Excel/PDF export.

## 5. SQL Data Source — `mssql`, Read-Only, Gateway Proxy
- Route proxies to **SQL Bridge Gateway** over HTTP: `querySQL(ctx, sql)` (route.ts:870) POSTs `{sql, server, database}` with `x-api-key` to `${SQL_GATEWAY_URL ?? 'http://10.0.0.110:3001/query'}/v1/query`.
- **Read-only guard** `validateReadOnlySql(sql)` (report-filtering.ts:250): must start `SELECT/WITH`, blocks `INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|MERGE|EXEC|...` and `SELECT INTO`. `lib/api/sql-gateway.ts` `SqlGateway` is the documented client class (default base `http://10.0.0.110:3001/query`, db `db_ptrj_mill`).

## 6. Module / Route Structure — Kebab IDs
- Report IDs kebab-case (`stok-gudang`, `fuel-usage`). `getInventoryReport(id)` resolves by `id|apiReport|code` with aliases (`config.ts:1087`). `liveInventoryReports` = non-`hold`; `expiry-inventory` is `hold`.
- **Intelligence modules** (`lib/reports/intelligence.ts`): `procurement|financial|human-resources|budget`; only `procurement` `available:true`.
- **Module→panel** `getModulePanel(moduleId, source)` (`module-panel.ts:77`): `{module, subModules, reports}`.
- **Inventory groups** (`config.ts:47`): executive, master, aging, transaction, purchasing, fertilizer, control, fuel, vehicle, hold. Each report: `group, code, status('live'|'update'|'hold'), readOnly:true`.

## 7. Data Flow
```
Browser → NextAuth session (payroll_auth_token cookie)
  → GET /api/reports/inventory?report=<kebab>&source=<estate|pabrik>
  → getSource → sourceToContext:  estate → SERVER_PROFILE_2 / db_ptrj
                                  pabrik → SERVER_PROFILE_3 / db_ptrj_mill
  → getInventoryReport → handler → validateReadOnlySql → querySQL → Gateway → MSSQL
  → rawPayload → applyReportFilters (client allowlist) → applyTableSort → paginate (20000)
  → NextResponse.json({success, report, data, totalRows})
```
`system-status/route.ts` GETs `/v1/servers` → per-source `healthy` flags.

## 8. Key Files
| Concern | File | Symbol |
|--------|------|--------|
| Landing | `components/ReportCenterPage.tsx` | `ReportCenterPage:20` |
| Module card | `components/dashboard/ModuleCard.tsx` | `MODULES` |
| Inventory catalog | `app/(report-center)/report-center/inventory/InventoryReportsClient.tsx` | `InventoryReportsClient:1293` |
| Viewer | `app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx` | `ReportViewerClient:1239`, `getReportViewerProfile:767`, `TABLE_FIRST_LIMIT:148` |
| Inventory API | `app/api/reports/inventory/route.ts` | `GET:3392`, `reportHandlers:3353`, `querySQL:870` |
| System status | `app/api/reports/system-status/route.ts` | `GET:47` |
| Movement | `lib/reports/movement-category.ts` | `movementCategorySqlCase:44` |
| Module panel | `lib/reports/module-panel.ts` | `getModulePanel:77` |
| Intelligence | `lib/reports/intelligence.ts` | `intelligenceModules:49` |
| Config | `lib/reports/inventory/config.ts` | `liveInventoryReports:1070`, `getInventoryReport:1087` |
| Read-only | `lib/reports/report-filtering.ts` | `validateReadOnlySql:250`, `applyReportFilters:885` |
| Gateway client | `lib/api/sql-gateway.ts` | `SqlGateway:159` |
| Hook | `lib/hooks/useReports.ts` | `useReports:64` |

## 9. Notable
- All inventory reports `readOnly:true` + `validated:true`; `validateReadOnlySql` is defense-in-depth.
- Client-side `applyReportFilters` is an allowlisted payload filter — never injects user SQL. Natural-language parsed to `ReportFilterInput` with write-intent rejection.
- AI Insight posts the report **payload** (never a raw query) — AI does not query DB.
