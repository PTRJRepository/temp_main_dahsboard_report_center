<!-- Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4 -->

# Report Center Detail Redesign — Agent Execution Plan

**Date:** 2026-07-21  
**Mode:** Interactive planning; no implementation executed  
**Contract source:** `Dashboard_Utama/docs/PRD/PRD-REPORT-CENTER-DETAIL-REDESIGN.md` v1.1  
**Pilot route:** `/report-center/inventory/monthly-stock-account-movement-details`  
**Pilot report:** `monthly-stock-account-movement-details` / `RPTIN1000015`  
**Primary file:** `Dashboard_Utama/app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx`

## 0. Agent read order

1. `Dashboard_Utama/docs/PRD/PRD-REPORT-CENTER-DETAIL-REDESIGN.md`
2. `Dokumentasi/REPORT_CENTER_EXPLORATION_INDEX_2026-07-21.md`
3. `Dokumentasi/REPORT_CENTER_UNIFIED_IMPLEMENTATION_CHECKLIST_2026-07-21.md`
4. `Dokumentasi/REPORT_VIEWER_CLIENT_SECTION_LINE_MAP_2026-07-21.md`
5. `Dokumentasi/mocks/report-detail-monthly-wireframe-2026-07-21.html`
6. `Dokumentasi/REPORT_DETAIL_REDUNDANCY_KILL_LIST_2026-07-21.md`
7. `Dokumentasi/REPORT_CENTER_SCREENSHOT_QA_CHECKLIST_2026-07-21.md`

Repository and tests beat stale docs. If implementation differs, verify runtime, then update docs.

## 1. Pre-flight findings

- Framework: Next.js 16 App Router (`Dashboard_Utama/package.json`, `Dashboard_Utama/app/layout.tsx`).
- Font: `Inter` via `next/font/google`; CSS token `--font-inter` in `Dashboard_Utama/app/globals.css`.
- Styling: Tailwind v4 entry via `@import "tailwindcss"`; report-specific `.rc-*` tokens in `Dashboard_Utama/app/globals.css`.
- Motion: `framer-motion` installed; keep motion restrained, transform/opacity only.
- Theme: preserve `report-center-dark report-center-forest`, deep navy/forest surface, emerald/lime accent, muted amber subtotal, red only for error/negative.
- Code state: PRD says commits `2c6c9c0` and `15a079d` already landed partial UI work; current git head includes `1be564b` and `a066ab7` docs commits.

## 2. Non-negotiable guardrails

| Keep | Never do |
| --- | --- |
| Accounting SQL and domain meaning | Change formulas without tests |
| 6 primary Ringkasan KPIs | Add product-type card flood on default |
| `summary.*` as primary KPI source | Sum visible table rows for grand flow KPIs |
| `formatKpiValue(value, field, label)` typed metrics | Put `Rp` on period, qty, count, percent |
| Export honesty | Call PDF official/full when it is `pratinjau` |
| AI sample honesty | Invent causes or hide sample size |
| URL filter contract | Break `viewerUrlWithFilters` share links |
| Forest dark theme | Add light table/context islands |
| Extraction order | Big-bang rewrite `ReportViewerClient.tsx` |

Already fixed; do not regress: typed metrics, calm subtotals, SQL hover demotion, monthly secondary collapse, 6 ID KPIs, export honesty, period gate, toolbar overflow, no issued full-width callout.

## 3. Target IA

Mandatory page order:

1. **Context** — title, 1-line purpose, source, status, favorite, Export.
2. **Controls** — sticky thin bar: period, group, window, search, more filters, reset.
3. **Chips** — one `AppliedFilterBar`.
4. **Workspaces** — tabs: `Ringkasan | Analisis | Detail Data | Audit`.
5. **Content** — only active tab body; lazy heavy panels.

Workspace contracts:

| Tab | Contains | Must not contain |
| --- | --- | --- |
| Ringkasan | ≤6 KPIs, scope chips, optional verified recon | SQL dump, product-type card flood, full filter forms |
| Analisis | Dimension explorer, exceptions, charts, AI sample-labeled | Full virtualized table |
| Detail Data | Table toolbar, virtual table, pagination/stream line | AI prose, gateway picker |
| Audit | SQL, metadata, request params, gateway | Primary KPI decoration |

Sticky policy: shell topbar + thin control bar. No sticky analysis walls. KPI sticky only if combined height stays ≤140px; default = no sticky KPI.

## 4. Data contract for `RPTIN1000015`

Primary Ringkasan exactly:

| # | Label UI | Field | Kind |
| --- | --- | --- | --- |
| 1 | Saldo Awal | `OpeningAmount` | currency |
| 2 | Penerimaan | `GoodsReceiveAmount` | currency |
| 3 | Pengeluaran | `IssuedTotalAmount` | currency |
| 4 | Retur | `ReturnAmount` | currency |
| 5 | Saldo Akhir | `ClosingAmount` | currency |
| 6 | Jumlah Item | `TotalItem` | count |

Issued total resolution to preserve:

```ts
issuedDirect = summary.IssuedTotalAmount
issuedParts = Ledger + Station + Vehicle
value = issuedDirect > 0 ? issuedDirect : (parts > 0 ? parts : issuedDirect)
```

Scope labels must stay separate:

| Layer | Label rule |
| --- | --- |
| Summary KPI | `Ringkasan server (terfilter)` allowed |
| Table loaded/stream | Say `baris termuat`; never full summary |
| AI | Say `sampel AI`; include sample size |
| PDF | Always `pratinjau`; max 34 rows × 7 columns |
| CSV/Excel | Show ceiling; monthly ceiling 100k, other reports 20k |

## 5. Recommended implementation order

Start with **P4**, then merge toward UI. P4 reduces monolith conflict and lets later agents work safely.

| Order | Phase | Deliverable | Why now | Risk |
| --- | --- | --- | --- | --- |
| 1 | P4 | Extract viewer profiles | Pure TypeScript, zero behavior change, unlocks parallel work | Low |
| 2 | P2 remainder | ControlBar, AppliedFilterBar, advanced drawer | Removes duplicate filter surfaces before tabs | Medium |
| 3 | P3 extraction | `MonthlyStockRingkasan` | Pull 6-KPI summary out of monolith | Medium |
| 4 | P5 | `ReportDataTable` + `ReportTableToolbar` | Isolate virtualizer/table scope | Medium-high |
| 5 | P6 | `ReportWorkspaceTabs` | Lazy tab IA after summary/table split | Medium |
| 6 | P1 residual + P7 | Export/AI honesty + preflight dialog | Finish honesty layer after main surfaces exist | Low-medium |
| 7 | P8 | Catalog convergence | Share primitives after viewer contracts stabilize | Medium |
| 8 | P9 | Browser QA, a11y, screenshots | Final ship gate | Low |

Rule: max 2 agents editing `ReportViewerClient.tsx`; prefer extract-first; max 3–5 new files early.

## 6. Track ownership

| Track | Owns | Forbidden |
| --- | --- | --- |
| A Honesty | PDF/Excel labels, AI chips, `ScopeChip`, `ExportPreflightDialog` | SQL formulas |
| B Filters | `ReportControlBar`, `AppliedFilterBar`, advanced drawer | Table virtualizer |
| C Summary | `MonthlyStockRingkasan`, flow KPI adapter | Catalog monolith |
| D Profiles | `viewer-profiles/*` extract | JSX layout changes |
| E Table | `ReportDataTable`, `ReportTableToolbar`, virtualizer body | Filter URL logic |
| F Catalog | `InventoryReportsClient` share primitives | Viewer KPI builders |
| Lead | Merge order, screenshots, kill-list QA | Force-push / broad rewrite |

## 7. Phase details

### P4 — Extract viewer profiles first

Create:

```text
Dashboard_Utama/lib/reports/inventory/viewer-profiles/
  index.ts
  generic.ts
  monthly-stock-movement.ts
  movement-analysis.ts
  stock-aging.ts
  asset-valuation.ts
```

Move from `ReportViewerClient.tsx`:

- `ReportViewerProfile` type.
- `getReportViewerProfile(reportId)`.
- Profile-only constants: official monthly columns, report id sets, business/technical/manual columns, presets.
- `preferredVisibleColumnsForProfile` and profile grouping defaults if pure.

Keep in viewer for now if tightly coupled to JSX state:

- fetch/stream/URL effects.
- export actions.
- table virtualizer.
- active chips rendering.

Acceptance:

- Import from `viewer-profiles` only.
- No rendered DOM changes expected.
- Monthly official column order unchanged.
- Other inventory profiles still open.
- TypeScript clean.

Suggested smoke test file:

```text
Dashboard_Utama/lib/reports/inventory/viewer-profiles/viewer-profiles.test.ts
```

Minimum assertions:

- `getReportViewerProfile('monthly-stock-account-movement-details')` returns `maxInitialColumns >= 36`.
- `businessColumns` starts with `ItemCode`, `ItemDescription`, `UOM`, `OpeningQty`, `OpeningAmount`.
- `rowDetail === 'movement'`.
- generic unknown report returns base profile.

### P2 remainder — Collapse filter surface

Create/evolve:

```text
Dashboard_Utama/components/report-center/ReportControlBar.tsx
Dashboard_Utama/components/report-center/AppliedFilterBar.tsx
Dashboard_Utama/components/report-center/ReportAdvancedFilterDrawer.tsx
```

ControlBar contains primary controls only:

- source (or shared `SourceSwitch` later), period, group, movement window, search, more filters, reset.

AppliedFilterBar owns:

- committed chips from `appliedFilters`.
- remote table search chip if applied.
- clear one / clear all.

Advanced drawer owns:

- stock analysis codes.
- movement thresholds.
- column filters.
- sort/top.
- natural language secondary.

Acceptance:

- Max filter surfaces: ControlBar, AppliedFilterBar, Advanced drawer, Table search.
- Monthly default has one period control only.
- URL round-trip preserves filters.
- K1–K4 duplicate period/chips/params stay dead.

### P3 — Extract monthly Ringkasan

Create:

```text
Dashboard_Utama/components/report-center/ReportSummaryWorkspace.tsx
Dashboard_Utama/components/report-center/MonthlyStockRingkasan.tsx
Dashboard_Utama/components/report-center/MetricValue.tsx
Dashboard_Utama/components/report-center/ScopeChip.tsx
```

Use existing `.rc-kpi-*` and `AnalyticsKpiStrip` style language. Do not create new decorative card language.

Acceptance:

- Exactly 6 primary cards.
- Primary values use typed formatter.
- Scope chips are chips, not KPIs.
- Product-type or movement breakdowns are secondary/collapsed.
- `placeholder_zero` values are not hero metrics.

### P5 — Extract table and toolbar

Create:

```text
Dashboard_Utama/components/report-center/ReportDataWorkspace.tsx
Dashboard_Utama/components/report-center/ReportTableToolbar.tsx
Dashboard_Utama/components/report-center/ReportDataTable.tsx
```

Primary toolbar:

- Search, Group, Columns, Density, CSV, Excel, PDF, Fullscreen.

Overflow:

- SQL audit, AI sample, charts, quality, print, copy link.

Table body:

- keep `@tanstack/react-virtual`.
- sticky header.
- sticky identity columns (`ItemCode`, `ItemDescription` / equivalent).
- calm subtotal rows via `rc-subtotal-row`.
- single scroll owner.
- no light theme island.

Acceptance:

- Pagination/stream never changes primary KPI meaning.
- Table footer says loaded rows / stream scope honestly.
- Fullscreen table remains readable.

### P6 — Workspace tabs

Create:

```text
Dashboard_Utama/components/report-center/ReportWorkspaceTabs.tsx
Dashboard_Utama/components/report-center/ReportAnalysisWorkspace.tsx
Dashboard_Utama/components/report-center/ReportAuditWorkspace.tsx
Dashboard_Utama/components/report-center/DimensionExplorer.tsx
```

Tabs:

- `Ringkasan`
- `Analisis`
- `Detail Data`
- `Audit`

Lazy mount heavy tabs. Keep Ringkasan mounted by default.

Acceptance:

- SQL appears only in Audit.
- AI sample/charts appear in Analisis, not primary toolbar.
- Detail Data owns virtual table.
- Keyboard tab navigation and focus rings pass.

### P1 residual + P7 — Export and AI honesty

Create/evolve:

```text
Dashboard_Utama/components/report-center/ExportMenu.tsx
Dashboard_Utama/components/report-center/ExportPreflightDialog.tsx
```

Rules:

- PDF filename ends `-pratinjau.pdf`.
- PDF body watermark includes `pratinjau` and `34 baris × 7 kolom` limit.
- CSV uses server `format=csv` + `limitAll`; ceiling visible.
- Excel confirm/preflight shows row count + ceiling.
- AI panel default closed; chips show sample size and fields.

### P8 — Catalog convergence

Create/evolve after viewer stabilizes:

```text
Dashboard_Utama/lib/reports/inventory/analysis-group-options.ts
Dashboard_Utama/components/report-center/SourceSwitch.tsx
```

Goals:

- share source switch.
- share analysis group options between catalog and detail.
- share export menu if contracts match.
- resolve `InventoryOverview.tsx` vs `InventoryReportsClient.tsx` redundancy carefully.

### P9 — QA/polish

Tasks:

- ID copy pass.
- focus rings and keyboard path.
- mobile/tablet smoke.
- screenshot pack per QA checklist.
- kill-list K1–K23 audit.
- test matrix.

## 8. Agent prompts

### Lead kickoff

```text
You implement PRD-REPORT-CENTER-DETAIL-REDESIGN.md v1.1.
Pilot: monthly-stock-account-movement-details (RPTIN1000015).
Preserve accounting SQL and typed metrics. No big-bang rewrite.
Do not re-break: format.ts kinds, calm subtotals, SQL hover, monthly secondary collapse,
6 ID KPIs, export honesty, period gate, toolbar overflow, dark forest theme.
Order: P4 profiles → P2 filters remainder → P3 MonthlyStockRingkasan → P5 table → P6 tabs → P7 export preflight → P8 catalog → P9 polish.
Max 2 agents on ReportViewerClient.tsx. Extract before thrash.
Verify with tests + screenshots. Small commits. Leave rollback SHAs intact.
```

### Track D — Profiles

```text
Track D only. Extract getReportViewerProfile + preferredVisibleColumnsForProfile + profile constants
from ReportViewerClient.tsx into lib/reports/inventory/viewer-profiles/*
({index,generic,monthly-stock-movement,movement-analysis,stock-aging,asset-valuation}.ts).
Zero behavior change. No JSX redesign. No SQL formula edits.
Add smoke for monthly official column order. Run tsc + monthly tests.
Forbidden: table virtualizer, filter URL, catalog, KPI JSX.
Refs: PRD §11.2–11.3; REPORT_VIEWER_CLIENT_SECTION_LINE_MAP; UNIFIED_CHECKLIST P4.
```

### Track B — Filters

```text
Track B only. After P4 merged: build ReportControlBar + AppliedFilterBar + advanced drawer.
Collapse filter surfaces to PRD §8 max 4. Kill duplicate period on monthly default.
Keep ReportFilterInput draft/applied/request + shareable URL.
Forbidden: virtualizer body, SQL domain, invent KPIs.
Match wireframe controls/chips. Dark forest tokens only.
Refs: PRD §8; REDUNDANCY kill K1–K4; TABLE_AND_FILTERS exploration.
```

### Track C — Summary

```text
Track C only. Extract MonthlyStockRingkasan + optional ReportSummaryWorkspace.
Exactly 6 KPIs from summary.* per metric-dictionary / PRD §7.2.
Preserve issuedDirect vs parts resolution. No placeholder_zero as hero.
No issued full-width callout. Prefer AnalyticsKpiStrip / rc-kpi-*.
Forbidden: catalog, SQL formula change, export rewrite.
Refs: PRD §6–7; monthly wireframe KPI grid; CARD_LAYOUT exploration.
```

### Track E — Table

```text
Track E only. Extract ReportDataTable + ReportTableToolbar + ReportDataWorkspace.
Keep tanstack virtual, sticky header/identity, calm subtotals, stream badge.
Primary toolbar = table tools; SQL/AI/charts overflow only.
Fix any light context strip to dark forest tokens.
Forbidden: filter URL logic, profile map rewrite, domain SQL.
Refs: PRD §9; SECTION_LINE_MAP table zone; TABLE_AND_FILTERS exploration.
```

### Track Workspaces — P6

```text
Implement ReportWorkspaceTabs: Ringkasan | Analisis | Detail Data | Audit.
Lazy mount heavy panels. Enforce workspace contracts: what each tab must and must not contain.
Sticky policy: control bar thin only by default.
Optional flag NEXT_PUBLIC_REPORT_DETAIL_V2. No SQL formula changes.
Refs: PRD §5; monthly wireframe tabs; UNIFIED_CHECKLIST §2.
```

### Track A — Honesty / P7

```text
Track A: verify/fix export+AI honesty only. PDF pratinjau watermark+filename.
CSV/Excel ceiling notify. AI sample chips. ScopeChip/MetricValue if needed.
Add ExportPreflightDialog; no full job-queue platform.
Forbidden: SQL formulas.
Refs: PRD §10; EXPORT_AI exploration.
```

### Track F — Catalog

```text
Track F: share SourceSwitch, analysis-group-options, ExportMenu between catalog and viewer.
Do not edit viewer KPI builders. Resolve InventoryOverview vs InventoryReportsClient redundancy carefully.
Refs: SHELL_CATALOG exploration; UNIFIED_CHECKLIST P8.
```

## 9. Test commands

Run after any code phase:

```bash
cd "Dashboard_Utama"
npx tsx utils/format.test.ts
npx tsx lib/reports/inventory/monthly-stock-account-movement.test.ts
npx tsx lib/reports/report-detail-performance.test.ts
npx tsx lib/reports/report-filtering.test.ts
npx tsx lib/reports/ai-evidence.test.ts
npx tsc --noEmit
```

Browser QA:

1. Open `/report-center/inventory/monthly-stock-account-movement-details`.
2. Capture default Ringkasan.
3. Change period; verify table + KPIs refresh and URL stays shareable.
4. Open Detail Data; verify virtual table, fullscreen, sticky header/identity.
5. Open Analisis; verify no full table, AI is sample-labeled.
6. Open Audit; verify SQL/metadata live there, not on executive face.
7. Check K1–K23 kill list stays dead.

## 10. Stop conditions

Stop and ask/raise blocker if:

- Need to change `monthly-stock-account-movement.ts` formulas.
- Need to remove production files/components instead of extracting.
- Existing tests contradict PRD metric contract.
- Monthly route cannot be opened for browser QA because auth/session missing.
- Parallel agent touches forbidden track files.

## 11. Immediate next action

Start **P4 profile extract** only.

Do not start tabs/table/filter work until P4 lands or is explicitly skipped by lead. P4 creates the lowest-risk seam and keeps later agents consistent.
