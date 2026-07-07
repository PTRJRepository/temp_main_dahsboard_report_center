# Report Center — Overview Lengkap

> Dokumentasi SELURUH Report Center (Next.js). Cakupan: module map, inventory groups, resolver report, viewer profiles, chart system, AI Insight, filtering/read-only, dan data flow (estate vs pabrik). Sumber: `lib/reports/intelligence.ts`, `module-panel.ts`, `inventory/config.ts`, `ReportViewerClient.tsx`, `app/api/reports/inventory/route.ts`, `app/api/reports/[reportCode]/ai-analysis/route.ts`, `lib/reports/report-filtering.ts`.

## 1. Module Map — 4 Intelligence Modules
Definisi di `lib/reports/intelligence.ts:49`. Hanya **`procurement`** yang `available:true`; lainnya katalog preview (`available:false`).

| id | name | available | reportCount | sub-modul | catatan |
|----|------|-----------|-------------|-----------|---------|
| `procurement` | Procurement | ✅ true | `liveInventoryReports.length` (19) | inventory, gudang, workshop, fuel | satu-satunya modul live; report Inventory |
| `financial` | Financial | ❌ false | 16 | produktivitas, cost | katalog; query real belum aktif |
| `human-resources` | Human Resources | ❌ false | 94 | payroll(24), daftar upah(15), absensi(18), premi/lembur(17), summary/wages/dampak(20) | katalog preview |
| `budget` | Budget | ❌ false | 12 | planning, realization, variance | katalog preview |

`module-panel.ts:subModulesFor`:
- `procurement` → `inventory` (`/report-center/inventory?source=`), `gudang`, `workshop`, `fuel` (count = `liveInventoryReports.length` / filter per group).
- fallback (financial/human-resources/budget) → stub dengan href placeholder; belum wired ke handler nyata.

`getModulePanel(moduleId, source)` (`module-panel.ts:77`): kalau `procurement` → map `liveInventoryReports` ke `{id,title,description,group,status,href}`; else → `ranking` array dari modul.

## 2. Inventory Group Taxonomy
`inventoryGroups` (`config.ts:47`):

| key | title | report di dalamnya |
|-----|-------|--------------------|
| `executive` | Executive Inventory Position | stok-gudang (INV-01), asset-stock-valuasi-listing |
| `master` | Master Data & Quality | kartu-stok, kualitas-master-item |
| `aging` | Item Aging & Update Quality | item-movement-update-tracking, item-stale-update |
| `transaction` | Mutasi & Transaksi | mutasi-barang (INV-03), pengeluaran-barang (INV-04), penerimaan-barang (INV-05), return-barang (INV-11), riwayat-transaksi (INV-10) |
| `purchasing` | Purchasing & Supplier | purchase-request-inventory (INV-06), transfer-antar-gudang (INV-07), purchase-order-history (INV-13), supplier-purchasing-performance (INV-14) |
| `fertilizer` | Pupuk & Material Estate | pupuk-stock-procurement (INV-15) |
| `control` | Kontrol & Audit | stock-opname (INV-08) |
| `fuel` | Fuel Inventory | fuel-usage (INV-09) |
| `vehicle` | Vehicle Running & Workshop | vehicle-running-workshop (INV-16) |
| `hold` | Kandidat Hold | expiry-inventory (INV-H01, status `hold`) |

Lihat `Report-Center-Pabrik.md` untuk SQL per report (terutama `WS_JOBSTOCK`, `IN_MTHENDITEM`, `IN_MTHENDTRX`, `IN_STOCKADJ`).

## 3. Report Resolution
`lib/reports/inventory/config.ts` — `InventoryReport` shape (`config.ts:23`):
```ts
type InventoryReport = {
  id, apiReport, code, group, groupTitle, title, description, executiveQuestion,
  status: 'live'|'update'|'hold', priority: 'critical'|'high'|'medium', tags: string[],
  sourceTables: string[], lastUpdated, owner, cadence, dataGrain, validated: boolean,
  availableFilters?: {...}, chartDefinitions: InventoryChartDefinition[], qualityNotes: string[], readOnly: true
}
```
Resolver `getInventoryReport(id)` (`config.ts:1087`): cari by `id` → `apiReport` → `code` → alias. `liveInventoryReports` = semua report non-`hold` (urut). `expiry-inventory` (INV-H01) `status:'hold'` → tidak masuk landing live.

`GET /api/reports/inventory?report=<kebab|apiReport|code>` (`route.ts:3392`) → `getInventoryReport` → lookup `reportHandlers[apiReport]` (`route.ts:3353`).

## 4. Viewer Profiles
`getReportViewerProfile(reportId)` (`ReportViewerClient.tsx:767`). Profile shape:
`presets, preferredGroupColumns, technicalColumns, businessColumns, fallbackColumns, manualFilterColumns, naturalPlaceholder, presetTitle, rowDetail, topRowsTitle, kpiBuilder, qualityBuilder, topRowsBuilder, defaultSort, maxInitialColumns, showAccountingPeriodFilter, loadAllRows, kpiPresetByLabel`.

Base profile (semua report): `rowDetail:'generic'`, `defaultSort` cari kolom `RiskScore/TotalAmount/NilaiStok/Amount` desc, `maxInitialColumns` default.

**3 special report-ID sets** (`ReportViewerClient.tsx:144-146`):
- `MOVEMENT_ANALYSIS_REPORT_IDS = {'all-stock-movement-analysis'}` → profile movement: `rowDetail:'movement'`, presets per MovementCategory (Fast Moving/Moving/Sow Moving/Dead Stock/Stale), `showAccountingPeriodFilter:true`, KPI dari `movementAnalysisKpis`.
- `STOCK_AGING_REPORT_IDS = {'item-movement-update-tracking','item-stale-update'}` → profile aging.
- `ASSET_VALUATION_REPORT_IDS = {'asset-stock-valuasi-listing'}` → profile valuation.

Kolom/visibility: `businessColumns` (default), `technicalColumns`, `fallbackColumns` (saat business kosong), capped `maxInitialColumns`. Profile menentukan grouping default, preset filter, dan builder KPI/quality/top-rows per report.

## 5. Chart System
`InventoryChartDefinition` (`config.ts:5`): `{ id, title, type:'bar'|'line'|'donut'|'ranking'|'quality'|'route', metric, dimension, sourceTables, insightFocus }`.
- Didefinisikan per report di `chartDefinitions` (`config.ts`, contoh stok-gudang punya 4: stock-value-by-warehouse bar, stock-value-by-category donut, top-stock-value-items ranking, stock-quality-flags quality).
- Viewer render `payload.chart` (`ReportViewerClient.tsx:1518`) → chart cards. AI Insight juga bisa menyarankan chart baru (lihat §6).

## 6. AI Insight
Endpoint `POST /api/reports/[reportCode]/ai-analysis` (`ai-analysis/route.ts`). **Payload-only — AI TIDAK menjalankan SQL** (guard `hasPayload`, `route.ts:162`: 400 kalau payload kosong; system prompt tegas "Jangan membuat SQL, query write... insert/update/delete").

Alur:
1. Client `fetch('/api/reports/{id}/ai-analysis', {report:{code,name,description}, payload})` (`ReportViewerClient.tsx:1424`).
2. `compactReportPayloadForAi(payload, {sampleRows:50, maxColumns:40})` (`route.ts:171`).
3. `generateLocalDashboardDefinition` → fallback lokal (selalu valid, dipakai kalau `ADACODE_API_KEY` kosong / API gagal / JSON gagal parse).
4. Kalau API key ada → `callAdaCode` (model `minimax-m2.5` via `9router`/`ADACODE_BASE_URL`); schema dashboard JSON (kpiCards, charts, insights, priorityTables, recommendedActions, missingFields). Retry+repair kalau parse gagal.
5. `sanitizeDashboardDefinition` → selalu kembalikan definisi valid (fallback jika perlu).
6. Client cache di `sessionStorage` (`getCachedAi`/`setCachedAi`, `ReportViewerClient.tsx:1296`).

Safety: AI hanya menghasilkan *dashboard definition*; backend yang menghitung dataset chart dari `rows` payload (`route.ts:324` "jangan mengisi chart.data... backend akan menghitung"). Tidak ada akses DB dari AI.

## 7. Filtering & Read-Only
`lib/reports/report-filtering.ts`:
- `ReportFilterInput` — model filter ter-normalisasi (field/operator/value).
- `validateReadOnlySql(sql)` (`report-filtering.ts:250`) — guard defensif: harus `SELECT`/`WITH`, blok `INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|MERGE|EXEC|...` dan `SELECT INTO`. Dipanggil di `route.ts:871` sebelum `querySQL`.
- `applyReportFilters(payload, filters)` (`report-filtering.ts:885`) — filter client-side allowlist (never inject user SQL).
- `parseNaturalFilterLocally` (`report-filtering.ts:1309`) — bahasa natural → `ReportFilterInput`.
- `validateNaturalLanguageReadOnly` — tolak intent write dari natural language.

Read-only di-enforce 2 lapis: gateway SQL Bridge (`lib/api/sql-gateway.ts` `SqlGateway`) + `validateReadOnlySql` di route. Semua report `readOnly:true` + `validated:true`.

## 8. Data Flow Recap
```
Browser (InventoryReportsClient / ReportViewerClient)
  → fetch(/api/reports/inventory?report=<id>&source=<estate|pabrik>&limit=...)
  → NextAuth session (payroll_auth_token cookie; auth())
  → GET route.ts:3392 (force-dynamic)
      getSource(request) → 'estate'|'pabrik'            (route.ts:56)
      sourceToContext → estate: SERVER_PROFILE_2/db_ptrj
                       → pabrik: SERVER_PROFILE_3/db_ptrj_mill   (route.ts:44)
      getInventoryReport → lookup reportHandlers[apiReport]      (route.ts:3353)
      validateReadOnlySql(sql)                                  (route.ts:871)
      handler({limit,limitAll,search,ctx,stale,filters})         (route.ts:3434)
        → querySQL → SQL Bridge Gateway /v1/query (10.0.0.110:3001)
        → MSSQL (db_ptrj | db_ptrj_mill)
      → rawPayload(rows, summary, chart, metadata)
      → applyReportFilters / applyTableSort / paginatePayload (window 20000)
  → NextResponse.json({success, report, data, totalRows})
  → viewer: KPIs, charts, virtualized table, AI Insight (payload-only)
```
- **estate** (default) → `db_ptrj`. **pabrik** (`?source=pabrik`) → `db_ptrj_mill` (lihat `Report-Center-Pabrik.md`).
- `system-status/route.ts` GET `/v1/servers` → per-source `healthy` flag.

## 9. Caveats
1. `financial`/`human-resources`/`budget` = katalog preview (`available:false`); hanya `procurement` live.
2. Default `source` = estate. Pabrik butuh `?source=pabrik`.
3. AI Insight **tidak** query DB; hanya baca payload + fallback lokal.
4. Read-only 2-lapis (gateway + route). `expiry-inventory` (INV-H01) `hold` — tidak di landing.
