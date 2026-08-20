# Report Center — Target Component Tree & Unified Implementation Checklist

**Date:** 2026-07-21  
**Purpose:** Single implementation map for agents after the exploration series.  
**Do not start coding from chat memory — start from this + the five exploration docs.**

---

## 1. Target component tree (detail-first)

```
app/(report-center)/report-center/
  layout.tsx
  ReportCenterShell.tsx                 # keep; slim later
  page.tsx → ReportCenterPage
  inventory/
    page.tsx → InventoryReportsClient   # later extract tiles
    [report]/
      page.tsx
      ReportViewerClient.tsx            # thin orchestrator only (goal)

components/report-center/
  # Shell / chrome
  SourceSwitch.tsx                      # NEW shared
  SqlGatewayMenu.tsx                    # NEW move from Topbar prominence
  ReportHeader.tsx                      # NEW
  ReportControlBar.tsx                  # NEW (or evolve ReportCommandBar)
  AppliedFilterBar.tsx                  # NEW
  ReportWorkspaceTabs.tsx               # NEW

  # Workspaces
  ReportSummaryWorkspace.tsx            # NEW (monthly first)
  MonthlyStockRingkasan.tsx             # NEW extract from viewer
  ReportAnalysisWorkspace.tsx           # NEW / evolve ReportAnalysisBand
  DimensionExplorer.tsx                 # NEW (replace card walls)
  ReportDataWorkspace.tsx               # NEW
  ReportTableToolbar.tsx                # NEW
  ReportDataTable.tsx                   # NEW virtualizer body
  ReportAuditWorkspace.tsx              # NEW SQL/metadata

  # Shared metrics / honesty
  MetricValue.tsx                       # wraps formatKpiValue
  ScopeChip.tsx                         # evolve rc-scope-chip
  ExportMenu.tsx                        # NEW honesty dialog
  ExportPreflightDialog.tsx             # NEW

  # Existing keep/evolve
  ReportWorkspaceFrame.tsx
  ReportCommandBar.tsx
  ReportAnalysisBand.tsx
  ReportDetailLoadingScreen.tsx
  ReportStatePanel.tsx
  AnalyticsKpiStrip.tsx                 # prefer for primary KPIs
  GlobalModuleNavigator.tsx
  InventoryOverview.tsx                 # merge or delete if redundant

lib/reports/inventory/
  viewer-profiles/
    index.ts
    generic.ts
    monthly-stock-movement.ts
    movement-analysis.ts
    stock-aging.ts
    asset-valuation.ts
  analysis-group-options.ts             # shared catalog+viewer
  monthly-stock-account-movement.ts     # domain keep
  metric-dictionary.md                  # keep synced
  config.ts                             # registry keep

utils/format.ts                         # typed metrics keep
```

### Orchestrator residual duties (ReportViewerClient thin)

- Read reportId + URL filters + source  
- Fetch / stream / abort  
- Hold payload state  
- Pass props into workspaces  
- No 500-line JSX grids  

---

## 2. Workspace tab content contract

| Tab | Default mount | Contains | Not contains |
| --- | --- | --- | --- |
| Ringkasan | Yes | ≤6 metrics, recon if verified, scope chips | SQL, product-type walls, full filter forms |
| Analisis | Lazy | DimensionExplorer, exceptions, charts | Full table virtualizer |
| Detail Data | Lazy or yes | Toolbar + table + pagination | AI prose, SQL dump |
| Audit Data | Lazy | SQL statements, gateway, metadata, params | Primary KPIs as decoration |

---

## 3. Unified implementation phases (ordered)

### Phase P0 — Safety (done / verify)

- [x] Typed metrics `utils/format.ts`  
- [x] Calm subtotals + SQL hover demotion  
- [x] Monthly secondary collapse  
- [ ] Browser screenshot monthly default  
- [ ] Scan bare `compactMetric(` = 0  

### Phase P1 — Honesty labels (low risk UI)

- [ ] PDF button + PDF body watermark “pratinjau 34 baris”  
- [ ] Excel/CSV toast with system ceiling  
- [ ] AI panel sample chips from metadata  
- [ ] Table footer loaded/filtered + KPI from summary  

### Phase P2 — Filter surface collapse

- [ ] `SourceSwitch` shared  
- [ ] `ReportControlBar` + `AppliedFilterBar`  
- [ ] Hide duplicate period section when control bar owns period  
- [ ] Drawer for advanced filters (SA, MC thresholds, column filters)  
- [ ] Natural language secondary  

### Phase P3 — Summary professionalism (monthly)

- [ ] Map flow builder → dictionary 6 beats (or adapter)  
- [ ] Remove issued full-width duplicate callout  
- [ ] Use `AnalyticsKpiStrip` / neutral surfaces  
- [ ] Cap data-layer primary KPIs  
- [ ] Extract `MonthlyStockRingkasan`  

### Phase P4 — Profile extract

- [ ] Move `getReportViewerProfile` + column constants to `viewer-profiles/*`  
- [ ] Unit smoke: monthly profile columns order  
- [ ] No behavior change  

### Phase P5 — Table extract

- [ ] `ReportDataTable` + toolbar triage (overflow)  
- [ ] Move AI/Charts/SQL out of table toolbar  
- [ ] Fix light context strip → dark tokens  

### Phase P6 — Workspaces

- [ ] Tabs with lazy mount  
- [ ] Analysis workspace replaces secondary sticky rails  
- [ ] Audit workspace for SQL  

### Phase P7 — Export system

- [ ] Preflight dialog  
- [ ] Optional job queue for large Excel  
- [ ] Deprecate silent PDF-as-export  

### Phase P8 — Catalog convergence

- [ ] Share analysis-group options + export menu  
- [ ] Resolve InventoryOverview vs InventoryReportsClient  
- [ ] Slim Topbar gateway  

### Phase P9 — Polish

- [ ] ID copy pass  
- [ ] a11y focus rings  
- [ ] Screenshots all entry paths  
- [ ] tsc + tests + lint  

---

## 4. File ownership for parallel agents

| Track | Owns | Forbidden |
| --- | --- | --- |
| A Honesty | PDF/Excel labels, AI chips, ScopeChip | SQL formulas |
| B Filters | ControlBar, AppliedFilterBar, drawer | Table virtualizer |
| C Summary | MonthlyStockRingkasan, flow KPI adapter | Catalog monolith |
| D Profiles | viewer-profiles/* extract | JSX layout thrash |
| E Table | ReportDataTable extract | Filter URL logic |
| F Catalog | InventoryReportsClient share primitives | Viewer KPI builders |
| Lead | Merge order P1→P6, screenshots | — |

Max 2 agents on `ReportViewerClient.tsx` ever; prefer extract-first.

---

## 5. Definition of done (product)

User (CEO path) can:

1. Open monthly movement from inventory catalog  
2. See period/source/open/in/out/close in **5 seconds** without SQL  
3. Change period once; table + KPI refresh; URL shareable  
4. Open Detail tab; table usable fullscreen  
5. Export with known scope  
6. AI clearly sample-labeled  
7. Feel same forest app as home, not a different product  

Engineering:

- Viewer file << 2000 lines or clearly split  
- Profiles testable  
- No currency-on-period regression  
- Checkpoints `05dd66b` / `4fe3253` known  

---

## 6. Commands (every PR)

```bash
cd "Dashboard_Utama"
npx tsx utils/format.test.ts
npx tsx lib/reports/inventory/monthly-stock-account-movement.test.ts
npx tsx lib/reports/report-detail-performance.test.ts
npx tsx lib/reports/report-filtering.test.ts
npx tsx lib/reports/ai-evidence.test.ts
npx tsc --noEmit
```

---

## 7. Paste brief for implementor agent

> Implement Report Center detail redesign using the exploration pack in `Dokumentasi/REPORT_*2026-07-21.md` and this checklist. Start Phase P1 honesty labels, then P2 filter collapse, then P3 monthly summary. Preserve accounting SQL and typed metrics. Extract before growing ReportViewerClient. First report: monthly-stock-account-movement-details. No generic SaaS reskin. Prove with tests + screenshots.

---

## 8. Doc dependency graph

```
MASTER_PROMPT (charter)
    ↓
REFACTOR_CONTEXT (map)
    ↓
CARD | TABLE_FILTERS | EXPORT_AI | SHELL_CATALOG (deep)
    ↓
THIS CHECKLIST (execute)
    ↓
IMPLEMENTATION_REFERENCE + metric-dictionary (contracts)
    ↓
DEBUG_REPORT (what already fixed)
```

---

**End of unified checklist.**
