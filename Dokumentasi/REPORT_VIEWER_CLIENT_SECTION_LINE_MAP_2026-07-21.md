# ReportViewerClient — DOM / Section Line Map

**File:** `Dashboard_Utama/app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx`  
**Total lines:** 6461  
**Date:** 2026-07-21  
**Purpose:** Agents can jump to sections without reading entire monolith.

---

## 1. File zones (coarse)

| Zone | Lines (approx) | Content |
| --- | ---: | --- |
| Imports + types + constants | 1–610 | Report types, column lists, TABLE_FIRST_LIMIT, monthly ids |
| KPI SQL helpers | 169–417 | simpleSqlForKpi, attachSimpleSql |
| Filter normalize / format | 613–1060 | normalizeViewerReportFilters, formatValue, compactMetric |
| Profile-specific KPI builders | 1069–2165 | aging, movement, asset, chart helpers |
| **Flow + monthly KPI** | **1858–2063** | buildOfficialMovementFlowKpis, monthlyStockMovementKpis |
| generic KPIs | 2065–2165 | |
| **getReportViewerProfile** | **2168–2339** | All report forks |
| Column prefs + cell render | 2341–2550 | |
| ReportRowDetail | 2465–2555 | Expand row UI |
| URL / fetch / export helpers | 2647–2893 | buildReportParams, fetchReport, csv/excel/pdf |
| **Main component state + effects** | **2895–3253** | fetch, stream, AI effect |
| Table data pipeline memos | 3255–4220 | filteredRows, groups, virtualizer setup |
| renderTableRow | 4279–4370 | group/subtotal/data rows |
| **Main JSX return** | **4374–end** | Banner → filters → ringkasan → analysis → filters → table → modals |

---

## 2. Main JSX return structure (4374+)

| Approx lines | Section | Extract target |
| --- | ---: | --- |
| 4377–4510 | Report identity banner + sticky filter chips | ReportHeader + AppliedFilterBar |
| 4514–4533 | Loading screen | keep ReportDetailLoadingScreen |
| 4535–4929 | **Sticky rc-ringkasan** (controls, flow KPIs, secondary rails) | MonthlyStockRingkasan + ControlBar |
| 4538–4552 | Ringkasan cepat chips | hide when flow (already) |
| 4553–4611 | Monthly period/group/window controls | ControlBar |
| 4613–4700 | Flow KPI grid + issued callout | Summary workspace |
| 4702–4926 | Secondary analysis rails | Analisis tab |
| 4933–4947 | ReportAnalysisBand | Analysis workspace |
| 4949–5028 | Period section (duplicate) | delete when ControlBar owns |
| 5030–5700 | Report info / natural / presets / manual filters | Filter drawer |
| 5208–5341 | Stock Analysis master block | drawer section |
| 5343–5497 | Movement Category advanced | drawer section |
| 5499–5696 | Column filters + sort/limit + apply | drawer section |
| 5702–5866 | Table shell + **crowded toolbar** | ReportTableToolbar |
| 5886–5897 | Light table context strip | fix tokens |
| 5898–end table | Virtualized table | ReportDataTable |
| ~6413+ | SQL modal always-on | Audit workspace |

Exact end-of-file panels (AI, charts, quality, debug) live after table — search `aiInsightVisible`, `insightTab`, `debugSql`.

---

## 3. Critical function index

| Function | Line | Notes |
| --- | ---: | --- |
| buildOfficialMovementFlowKpis | 1858 | 5 flow cards; summary only |
| monthlyStockMovementKpis | 2011 | flow + dynamic rest |
| getReportViewerProfile | 2168 | extract to viewer-profiles |
| preferredVisibleColumnsForProfile | 2341 | official column order monthly |
| downloadCsv | 2857 | server format=csv |
| exportExcel | 2866 | client xlsx all |
| exportPdf | 2877 | 34×7 preview |
| ReportViewerClient | 2895 | orchestrator |
| fetch effect | ~3021–3167 | stream monthly |
| AI effect | 3187–3253 | sample 50 |
| flowKpiCards memos | 3930–4013 | rail split |
| table virtualizer | 4266+ | |
| Main return | 4374 | |

---

## 4. GUARDRAILS embedded in file (do not delete casually)

| Line | Guard |
| --- | --- |
| 1860 | flow KPI summary only — never page row sums |
| 2280 | RPTIN official column order |
| 2947 | monthly secondary default collapsed |
| 3068 | no setPage bounce from response |
| 4514 | hold KPI until fetch finishes |
| 4537 | hide sticky grand when flow present |

---

## 5. Suggested split order with line ownership

1. **P4** Move 2168–2340 + column constants (~480–900) → `viewer-profiles/`  
2. **P3** Move 1858–2063 + JSX 4535–4929 → summary components  
3. **P2** Move filter JSX 4949–5700 + chip bar → filter components  
4. **P5** Move 5702–table end → ReportDataTable  
5. Leave fetch/AI orchestration until last  

---

## 6. Companion docs

- Card layout exploration → zone 1858 + 4535  
- Table/filters exploration → zone 3255 + 4949 + 5702  
- Export/AI exploration → 2857 + 3187  
- Shell/catalog → outside this file  

---

**End line map.**
