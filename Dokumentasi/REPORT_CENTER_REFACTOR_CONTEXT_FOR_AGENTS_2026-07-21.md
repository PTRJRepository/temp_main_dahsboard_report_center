# Report Center — Deep Refactor Context for Agents

**Date:** 2026-07-21  
**Audience:** coding agents (Codex / Claude / Hermes / Sonnet)  
**Goal:** one shared mental model so redesign is **professional, non-redundant, hierarchical** — not another card wall.  
**Primary pain:** Report Detail layout (especially inventory **MONTHLY STOCK ACCOUNT MOVEMENT DETAILS**) feels messy, redundant, unprofessional.

This file is the **orientation + architecture diagnosis**. It does **not** replace business metric truth. Always cross-check:

| Priority | Document / code |
| --- | --- |
| 1 | Runtime + repo |
| 2 | `Dashboard_Utama/lib/reports/inventory/monthly-stock-account-movement.ts` + tests |
| 3 | `Dashboard_Utama/utils/format.ts` + tests |
| 4 | `Dokumentasi/REPORT_DETAIL_IMPLEMENTATION_REFERENCE.md` |
| 5 | `Dashboard_Utama/lib/reports/inventory/metric-dictionary.md` |
| 6 | `Dokumentasi/REPORT_CENTER_DEBUG_REPORT_2026-07-21.md` |
| 7 | `Dokumentasi/MASTER_PROMPT_REPORT_CENTER_REDESIGN_ADVANCED.md` |
| 8 | This file (IA + engineering map) |

---

## 0. User problem statement (product language)

User (CEO / product owner):

- Report Center **report detail**, inventory, **monthly movement details** especially, has **bad layout**.
- Overall app report UI feels **messy, redundant, not proper, not professional**.
- Wants a **deep context pack** so another agent can refactor optimally without rediscovering the codebase.

**Success feel:** premium enterprise accounting/ops analytics — calm, structured, trustworthy, dense when needed — **same dark forest identity matured**, not a generic SaaS reskin.

---

## 1. Git checkpoints (mandatory)

| Commit | Meaning |
| --- | --- |
| `05dd66b` | Checkpoint **before** total report-detail redesign |
| `4fe3253` | Typed metrics + calmer monthly Ringkasan hierarchy (presentation fixes) |
| `386c710` | Debug report + advanced master prompt docs |

Rollback (only if user asks / disaster):

```bash
git reset --hard 05dd66b   # pre-redesign
# or
git reset --hard 4fe3253   # after typed metrics + hierarchy calm
```

Never force-push. Never commit `.env*` / keys.

---

## 2. App map (where things live)

### Routes (Report Center)

| Route | File |
| --- | --- |
| Shell (auth + sidebar/topbar) | `Dashboard_Utama/app/(report-center)/report-center/layout.tsx` → `ReportCenterShell.tsx` |
| RC home | `.../report-center/page.tsx` |
| Module hub | `.../report-center/[module]/page.tsx` |
| Inventory catalog | `.../report-center/inventory/page.tsx` + `InventoryReportsClient.tsx` |
| **Report detail** | `.../report-center/inventory/[report]/page.tsx` → **`ReportViewerClient.tsx`** |

Canonical monthly report id:

- **id:** `monthly-stock-account-movement-details`
- **code:** `RPTIN1000015`
- URL: `/report-center/inventory/monthly-stock-account-movement-details`

### Size / complexity bombs (read this before planning)

| Artifact | ~Lines | Role |
| --- | --- | --- |
| `ReportViewerClient.tsx` | **~6461** | **Monolith:** fetch, filters, KPI builders, table virtualizer, export, AI, debug SQL, monthly special-cases |
| `app/api/reports/inventory/route.ts` | **~4716** | Inventory report handlers + monthly wiring |
| `monthly-stock-account-movement.ts` | **~1593** | SQL CTE, scope, payload, analytics for RPTIN1000015 |
| `inventory/config.ts` | **~1170** | Report catalog metadata |
| `globals.css` `.rc-*` / forest | large | Design tokens for RC |

### Partial shell components (exist but underused by detail)

Under `Dashboard_Utama/components/report-center/`:

| Component | Lines | Intended role | Reality |
| --- | --- | --- | --- |
| `ReportWorkspaceFrame.tsx` | ~77 | Header + command + main/aside grid | Thin; **not** driving monthly detail structure |
| `ReportCommandBar.tsx` | ~80 | Toolbar slots | Exists; detail still mostly custom banner |
| `ReportAnalysisBand.tsx` | ~420 | Insight / dimension band | Used when `!tableExpanded` |
| `ReportDetailLoadingScreen.tsx` | ~162 | Loading overlay | Used |
| `ReportStatePanel.tsx` | ~91 | Empty/error states | Partial |
| `InventoryOverview.tsx` | ~640 | Module overview | Catalog side |
| `AnalyticsKpiStrip.tsx` | ~96 | KPI strip abstraction | Not the monthly ringkasan source of truth |

**Key architectural truth:** redesign “design system” pieces exist, but **Report Detail still is one giant client component** with monthly forks (`isMonthlyStockMovement`). Parallel agents editing this file will conflict and reintroduce redundancy.

---

## 3. What the monthly report actually does (domain)

Config source: `lib/reports/inventory/config.ts` entry `monthly-stock-account-movement-details`.

**Business story (user should understand in 5 seconds):**

```
Saldo Awal → Penerimaan (GR) → Pengeluaran (issued) → Retur / other → Saldo Akhir
+ period (actual) + source (estate|pabrik) + filters
```

**Not the story:** server profile, full CTE dump, 40 product-type cards, SQL buttons as primary chrome.

### Data / accounting notes (do not invent)

- Filter **period** = actual calendar `YYYY-MM`; server converts to **AccYear/AccMonth** (`accounting-period.ts`).
- Opening from previous month-end (`IN_MTHENDITEM`); closing **computed** (not blindly `IN_ITEM` alone).
- Issued: stock + fuel + workshop (`WS_JOBSTOCK` for ItemType 4).
- Goods receive amount: `PU_GOODSRCVLN` × `PU_POLN.Cost` (not empty `IN_STOCKRECEIVE` for estate patterns).
- Analysis group default often StockAnalysisCode DEADS/MEMOV/SLMOV; taxonomy groups change scope.
- Movement keys with `placeholder_zero` must **not** look like proven movements (see metric dictionary).

Primary KPI set (max 6) — see metric-dictionary:

1. OpeningAmount  
2. GoodsReceiveAmount  
3. IssuedTotalAmount  
4. ReturnAmount  
5. ClosingAmount  
6. TotalItem (count)

Formatting: **`utils/format.ts`** — never force currency on period/qty/count.

---

## 4. Current UI structure of Report Detail (as implemented)

Approximate vertical stack inside `ReportViewerClient` main return (~line 4374+):

1. **Banner header** (`rc-report-banner`) — title, favorite, source, export-ish actions, long description  
2. **Sticky active filters** strip (lime chips + clear all) — when filters exist  
3. **Loading screen** overlay while fetch  
4. **Sticky Ringkasan block** (`rc-ringkasan sticky top-0 z-30`) — the noisiest zone for monthly:
   - Optional “Ringkasan cepat” grand chips (hidden for monthly when flow KPIs exist — good)
   - Monthly control mini-row: Actual period + Analysis group + Movement period + More filters  
   - **Flow KPI grid** Opening→In→Issued→Purchasing→Closing (+ Issued breakdown callout with mono field names)  
   - Toggle “analisis lanjutan” (default **collapsed** for monthly — good)  
   - Behind toggle: global context cards, Gudang/Workshop breakdown, sub-category grid, movement-category grid  
5. **`ReportAnalysisBand`** (unless table expanded)  
6. **Period filter section** again (`showAccountingPeriodFilter`) — **duplicates** period control already in sticky rail  
7. **Report info / Natural filter / Preset / Manual filters** (large, when `reportInfoVisible`) — period controls appear **again** inside manual filter  
8. Monthly Stock Analysis master field block  
9. Table toolbar + virtualized table + grouping/subtotals  
10. Debug SQL / AI / extra panels further down

### Redundancy map (root of “berantakan”)

| Redundant concern | Where it appears | Agent fix direction |
| --- | --- | --- |
| Actual period | Sticky monthly rail + dedicated period section + manual filter period | **One** control surface in sticky Control Bar; others remove or deep-link |
| Active filter chips | Sticky top strip + Natural filter panel | One AppliedFilterBar; panel shows same state |
| Totals story | Sticky grand + flow KPIs + global cards + group subtotals + analysis band | Primary = flow ≤6; rest progressive disclosure / Analisis tab |
| Issued breakdown | Flow card metrics + rose callout repeating same metrics | Single issued card with expandable metrics |
| SQL / field names | `rc-sql-debug` hover + mono `source: IN_...` in callouts + debug dump | Default executive view: **zero** SQL; Audit workspace only |
| Scope labels | Mixed English “summary server · bukan sample” + Indonesian | Standardize ID-first chips: `Ringkasan server (terfilter)` |
| Analysis | KPI walls + `ReportAnalysisBand` + table group | One Analisis workspace with Dimension Explorer |

This is **IA debt**, not “need more cards.”

---

## 5. Already fixed (do not re-break) — from debug report

| Defect | Root cause | Fix location |
| --- | --- | --- |
| Period/qty/count shown as `Rp` | `compactMetric` forced currency | `utils/format.ts`; all call sites pass field/label |
| Loud subtotals | Solid fills + CSS remap of `#167A3A` | `rc-subtotal-row` + `globals.css` |
| SQL always loud | Amber pills always visible | `rc-sql-debug` + parent `group` hover/focus |
| Duplicate sticky grand + flow | Both always on | Hide sticky grand when monthly + flow present |
| Secondary KPI flood | All rails always open | `monthlySecondaryOpen` default **false** |

Guard tests:

```bash
cd "Dashboard_Utama"
npx tsx utils/format.test.ts
npx tsx lib/reports/inventory/monthly-stock-account-movement.test.ts
npx tsx lib/reports/report-detail-performance.test.ts
npx tsc --noEmit
```

Forbidden regressions: bare `compactMetric(value)`, solid orange/green subtotals, always-on SQL pills, always-open product-type walls, inventing placeholder_zero movements.

---

## 6. Target information architecture (ship design)

Every report detail screen:

```
1 Context     title, 1-line purpose, source, period, status, Export (primary)
2 Controls    sticky: period, source, group, search, more filters, chips, apply/reset
3 Summary     ≤6 typed KPIs + optional recon (verified only)
4 Insight     exceptions / top contributors / dimension explorer (not 40 cards)
5 Detail      table tool (sticky identity cols, calm subtotals, presets)
6 Advanced    SQL, metadata, gateway profile, lineage (permission-aware)
```

### Workspace tabs (do not mount all heavy DOM at once)

1. **Ringkasan** — default  
2. **Analisis**  
3. **Detail Data**  
4. **Audit Data**

### Theme tokens (preserve)

- Shell: `report-center-dark` + optional `report-center-forest` (`NEXT_PUBLIC_REPORT_CENTER_THEME_V2`)
- Colors: deep navy/forest `#071426`, emerald/lime accent, muted amber attention, red only for real error/negative
- Prefer `.rc-*` in `globals.css` over one-off neon Tailwind walls

### Product copy (ID-first)

`Ringkasan`, `Analisis`, `Detail Data`, `Audit Data`, `Saldo Awal`, `Penerimaan`, `Pengeluaran`, `Saldo Akhir`, `Selisih Rekonsiliasi`. Codes/SQL in tooltips/Audit only.

---

## 7. Engineering strategy (how to refactor without melting the tree)

### 7.1 Do NOT

- Big-bang rewrite of `ReportViewerClient.tsx` in one PR  
- Two agents editing the same 6k file concurrently  
- Re-skin with random template colors  
- Change accounting SQL formulas without tests + payload evidence  
- Add more KPI cards to “look complete”

### 7.2 DO (incremental extraction order)

1. Keep `utils/format.ts` + CSS tokens (done)  
2. Cap **data-layer** primary flow KPIs to verified 6 (not only `slice(0, 6)` in JSX)  
3. After visual sign-off: extract `MonthlyStockRingkasan.tsx` (or `ReportSummaryWorkspace`)  
4. Extract `ReportControlBar` / `AppliedFilterBar` and **delete duplicate period UIs**  
5. Introduce workspace tabs (feature flag if needed) — mount lazy  
6. Extract table last (`ReportDataTable` + virtualizer)  
7. Export honesty dialog + AI sample labels  

Max **3–5 new files** early. Prefer delete/merge over new decoration.

### 7.3 File ownership for parallel agents

| Agent | Owns | Avoid |
| --- | --- | --- |
| Data/accounting | `lib/reports/inventory/*`, tests | Viewer JSX thrash |
| UX/IA | CSS tokens, new shell components under `components/report-center/` | SQL formulas |
| Table/perf | Table section only after extract | KPI formulas |
| Export/AI | export routes + AI panel | Ringkasan layout |
| Lead | Integration, merge order, acceptance | — |

**Windows note (this host):** large multi-file writes via flaky subagents often stall — orchestrator should write files directly; pass full specs inline.

### 7.4 State model (what must stay correct)

- Filters live in **URL** (`filtersFromSearchParams` / `viewerUrlWithFilters`)  
- `appliedFilters` vs `manualFilters` draft  
- Source `estate|pabrik` in URL + localStorage  
- Fetch: first page paint → optional stream full rows for monthly (KPI from **summary**, not window)  
- GUARDRAIL: never `setPage` from response in a way that re-triggers full loading bounce  
- Scope honesty: summary ≠ loaded window ≠ AI sample  

Types: `lib/reports/report-experience.ts`, filtering: `report-filtering.ts`, window metadata: `report-detail-performance.ts`.

---

## 8. Component inventory recommendation (create only if no equivalent)

Preferred names (from master prompt — align agents):

- `ReportDetailShell`, `ReportHeader`, `ReportControlBar`, `AppliedFilterBar`
- `ReportWorkspaceTabs`
- `ReportSummaryWorkspace` / `MonthlyStockRingkasan`
- `ReconciliationPanel`, `ScopeComparison`, `InsightQueue`
- `ReportAnalysisWorkspace` / `DimensionExplorer`
- `ReportDataWorkspace`, `ReportTableToolbar`, `ReportDataTable`
- `ReportAuditWorkspace`
- `MetricValue` (wraps formatKpiValue)

Existing thin frames (`ReportWorkspaceFrame`, `ReportCommandBar`) should be **evolved and used**, not abandoned for a third parallel system.

---

## 9. Acceptance criteria (definition of done)

### Clarity

- [ ] 5-second read: report name, source, period, open/in/out/close without SQL  
- [ ] No duplicate primary totals  
- [ ] No Product Type / movement card flood on default Ringkasan  
- [ ] Single period control path  

### Correctness

- [ ] Typed metrics: no `Rp` on period/qty/count  
- [ ] Primary numbers not truncated  
- [ ] KPIs independent of table page  
- [ ] placeholder_zero labeled  
- [ ] Recon only if verified  

### Table

- [ ] Sticky headers + identity columns  
- [ ] Calm subtotals  
- [ ] One deliberate scroll container  
- [ ] Virtualization healthy  

### Engineering

- [ ] Viewer smaller / clearer boundaries OR documented migration path  
- [ ] Other inventory reports still work or safe fallback  
- [ ] Tests + tsc green  
- [ ] Screenshots before/after for monthly route  

---

## 10. Immediate checklist for the next implementing agent

```text
[ ] Read REPORT_DETAIL_IMPLEMENTATION_REFERENCE.md
[ ] Read metric-dictionary.md
[ ] Read REPORT_CENTER_DEBUG_REPORT_2026-07-21.md
[ ] Read MASTER_PROMPT_REPORT_CENTER_REDESIGN_ADVANCED.md
[ ] Read THIS file (IA + redundancy map)
[ ] git log -5 --oneline (know 05dd66b / 4fe3253 / 386c710)
[ ] Run format + monthly + tsc tests
[ ] Open monthly route if server up; screenshot default Ringkasan
[ ] Cap data-layer primary KPIs to 6 verified fields
[ ] Remove or hide ONE duplicate period UI (smallest safe win)
[ ] Only then extract MonthlyStockRingkasan
[ ] Do not claim done without browser proof
```

### Run server (context)

- Dashboard typically via root proxy / Next on **port 3001**  
- Prefer real `node server.js` patterns documented in skill if CSS/routing stale under bun  

### First vertical slice recommendation (optimal)

**Slice A (layout honesty, low risk):**  
Delete/hide duplicate period sections when monthly sticky rail already owns period; unify filter chips to one bar; keep data untouched.

**Slice B (summary professionalism):**  
Hard-cap flow KPI builder to primary 6; merge issued callout into issued card; keep secondary behind one “Analisis lanjutan” or move to Analisis tab.

**Slice C (architecture):**  
Extract Ringkasan component; introduce tabs with lazy mount.

Do A→B before C.

---

## 11. Related docs (absolute paths)

```
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/REPORT_CENTER_REFACTOR_CONTEXT_FOR_AGENTS_2026-07-21.md  (this file)
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/REPORT_DETAIL_CARD_LAYOUT_EXPLORATION_2026-07-21.md  (card/grid/hierarchy detail)
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/REPORT_DETAIL_TABLE_AND_FILTERS_EXPLORATION_2026-07-21.md  (table + filter surfaces)
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/REPORT_DETAIL_EXPORT_AI_SCOPE_EXPLORATION_2026-07-21.md  (export + AI + scope honesty)
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/REPORT_CENTER_SHELL_CATALOG_PROFILES_EXPLORATION_2026-07-21.md  (shell + catalog + viewer profiles)
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/REPORT_CENTER_UNIFIED_IMPLEMENTATION_CHECKLIST_2026-07-21.md  (component tree + phases)
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/REPORT_DETAIL_TARGET_WIREFRAME_2026-07-21.md  (ASCII target IA)
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/mocks/report-detail-monthly-wireframe-2026-07-21.html  (HTML mock)
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/REPORT_CENTER_EXPLORATION_INDEX_2026-07-21.md  (read order)
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/REPORT_CENTER_RISK_REGRESSION_REGISTER_2026-07-21.md
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/REPORT_VIEWER_CLIENT_SECTION_LINE_MAP_2026-07-21.md
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/REPORT_CENTER_DEBUG_REPORT_2026-07-21.md
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/MASTER_PROMPT_REPORT_CENTER_REDESIGN_ADVANCED.md
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/REPORT_DETAIL_IMPLEMENTATION_REFERENCE.md
D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/lib/reports/inventory/metric-dictionary.md
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/MONTHLY_STOCK_ACCOUNT_MOVEMENT_DETAILS.md
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/Report-Center-Inventory-Module.md
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/IN_ITEM-Database-Schema.md
```

Code entry points:

```
D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx
D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/lib/reports/inventory/monthly-stock-account-movement.ts
D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/app/api/reports/inventory/route.ts
D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/utils/format.ts
D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/app/globals.css
```

---

## 12. One-paragraph brief to paste into any agent

> Redesign Report Center detail UX starting with `monthly-stock-account-movement-details` (RPTIN1000015). The product problem is **redundant hierarchical noise** in a ~6461-line `ReportViewerClient.tsx`, not missing cards. Preserve accounting SQL and typed metrics (`utils/format.ts`). Target IA: Context → Controls → ≤6 Ringkasan KPIs → Insight → Detail table → Audit. Remove duplicate period/filter/total surfaces. Evolve dark forest theme. Incremental extract; no big-bang. Follow `Dokumentasi/REPORT_DETAIL_IMPLEMENTATION_REFERENCE.md`, `metric-dictionary.md`, `REPORT_CENTER_DEBUG_REPORT_2026-07-21.md`, `MASTER_PROMPT_REPORT_CENTER_REDESIGN_ADVANCED.md`, and this refactor context. Checkpoints: `05dd66b` / `4fe3253`. Prove with tests + browser screenshots before claiming done.

---

**End of agent context pack.**
