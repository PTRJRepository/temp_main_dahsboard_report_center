# PRD — Report Center Detail Redesign (Professional IA Refactor)

**Status:** ✅ ACTIVE v1.1 — implementation in progress  
**Date:** 2026-07-21  
**Owner product:** PT Rebinmas Jaya (CEO-level quality bar)  
**Primary audience:** Coding agents (Hermes / Claude / Codex / Sonnet) executing the refactor  
**Language:** Spec in English for agents; **UI copy ID-first**

---

## 0. How an agent must use this PRD

1. Read **this PRD end-to-end** before writing code.  
2. Treat **repository + tests + runtime** as higher priority than any stale markdown if they conflict — then update this PRD.  
3. Do **not** invent accounting formulas.  
4. Do **not** big-bang rewrite `ReportViewerClient.tsx` without extraction order below.  
5. After each phase: tests + (for UI) screenshot checklist.  
6. Commit small; keep rollback points.  

### Companion docs (deep dive — optional after PRD)

| Doc | When |
| --- | --- |
| `Dokumentasi/REPORT_CENTER_EXPLORATION_INDEX_2026-07-21.md` | Full pack index |
| `Dokumentasi/MASTER_AGENT_BRIEF_REPORT_CENTER_REDESIGN_2026-07-21.md` | 1-page brief |
| `Dokumentasi/REPORT_CENTER_UNIFIED_IMPLEMENTATION_CHECKLIST_2026-07-21.md` | Component tree + P0–P9 |
| `Dokumentasi/REPORT_DETAIL_REDUNDANCY_KILL_LIST_2026-07-21.md` | K1–K23 delete targets |
| `Dokumentasi/REPORT_VIEWER_CLIENT_SECTION_LINE_MAP_2026-07-21.md` | Line map monolith |
| `Dokumentasi/mocks/report-detail-monthly-wireframe-2026-07-21.html` | Visual target |
| `Dashboard_Utama/lib/reports/inventory/metric-dictionary.md` | Metric kinds |
| `Dokumentasi/REPORT_DETAIL_IMPLEMENTATION_REFERENCE.md` | Shared contracts |
| `Dokumentasi/MASTER_PROMPT_REPORT_CENTER_REDESIGN_ADVANCED.md` | Long charter |

---

## 1. Problem statement

### 1.1 User pain

Report Center **report detail**, especially inventory **MONTHLY STOCK ACCOUNT MOVEMENT DETAILS**, feels:

- Messy / crowded  
- Redundant (same control or total repeated)  
- Unprofessional / not “enterprise accounting” quality  
- Inconsistent with the calmer forest shell/home  

### 1.2 Root cause (engineering)

Not “missing cards.” Class of failures:

1. **Monolith:** `ReportViewerClient.tsx` ~6.4k lines (fetch + KPI + filters + table + AI + export).  
2. **Flat IA:** many equal-weight surfaces for one story (open→in→out→close).  
3. **Profile forks inline** in the same file.  
4. **Scope dishonesty:** PDF/AI/table window can look like full report.  
5. **Design system split:** home uses `.rc-kpi-*`; detail used rainbow ad-hoc cards.  
6. **Second monolith:** inventory catalog ~2.5k lines duplicates export/options.  

### 1.3 Success definition (product)

A first-time admin opens monthly movement and in **≤5 seconds** understands:

- Report name + source (estate|pabrik) + period  
- Saldo Awal → Penerimaan → Pengeluaran → Retur → Saldo Akhir + Jumlah Item  
- That KPIs are **server summary (terfilter)**, not a random sample  
- Where to open the table and export **with honest scope**  

Feel: **premium enterprise ops/accounting analytics** — dense when needed, calm by default — **same forest app matured**, not a new SaaS template.

---

## 2. Goals & non-goals

### 2.1 Goals

| ID | Goal |
| --- | --- |
| G1 | Single control surface for period/group/window/search/filters |
| G2 | Ringkasan ≤6 typed primary metrics (dictionary) |
| G3 | Progressive disclosure for analysis (no card walls default) |
| G4 | Table as a serious tool (toolbar = table tools only) |
| G5 | Export/AI/table scope honesty always labeled |
| G6 | Extract architecture so agents can parallelize safely |
| G7 | Preserve forest identity + ID-first copy |
| G8 | Generalize shell to other inventory profiles after monthly pilot |

### 2.2 Non-goals

- Changing accounting SQL business meaning without tests  
- Full redesign of non-inventory modules in this PRD  
- Replacing SQL Gateway / auth model  
- CUD / write paths  
- Pixel-perfect clone of legacy PDF layout as the only UI  
- Adding more decorative charts  

---

## 3. Scope

### 3.1 In scope (pilot)

| Item | Detail |
| --- | --- |
| Route | `/report-center/inventory/monthly-stock-account-movement-details` |
| Report id | `monthly-stock-account-movement-details` |
| Code | `RPTIN1000015` |
| Domain | `lib/reports/inventory/monthly-stock-account-movement.ts` |
| API | `app/api/reports/inventory/route.ts` |
| Viewer | `app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx` |

### 3.2 In scope (follow-on same PRD)

- Shared shell components for all inventory detail profiles  
- Catalog convergence (shared SourceSwitch, ExportMenu, analysis-group options)  
- Viewer profile extract to `lib/reports/inventory/viewer-profiles/*`  

### 3.3 Out of scope (later PRD)

- HR / payroll / budget report detail redesign  
- New report types / new SQL reports  
- Full job-queue export platform migration (may stage hooks only)  

---

## 4. Users & scenarios

| Persona | Need |
| --- | --- |
| Admin / inventory accounting | Monthly open/close story, export, drill by analysis group |
| Ops manager | Fast scan of issued vs GR; filter location/period |
| IT / power user | SQL audit, gateway, params (not on executive face) |

### Primary scenario (happy path)

1. Open Inventory Live → Monthly Stock Account Movement Details  
2. Confirm source + period  
3. Read 6 KPIs  
4. Optional: filter DEADS / group Product Type  
5. Open table, sort/export  
6. Optional AI sample / SQL audit  

---

## 5. Information architecture (mandatory)

```
1 Context     title, 1-line purpose, source, status, favorite, Export
2 Controls    sticky thin: period, group, window, search, more filters, reset
3 Chips       one AppliedFilterBar
4 Workspaces  tabs: Ringkasan | Analisis | Detail Data | Audit
5 Content     tab body only (lazy heavy panels)
```

### Workspace contracts

| Tab | Contains | Must not contain |
| --- | --- | --- |
| **Ringkasan** | ≤6 KPIs, scope chips, optional recon | SQL dump, product-type card flood, full filter forms |
| **Analisis** | Dimension explorer, exceptions, charts, AI (sample-labeled) | Full virtualized table |
| **Detail Data** | Table toolbar + virtual table + pagination/stream line | AI prose, gateway picker |
| **Audit** | SQL, metadata, request params, gateway | Primary KPI decoration |

### Sticky policy

- Sticky: Topbar (shell) + **thin control bar** (and optional single-row KPI only if height ≤ ~140px combined).  
- **Not sticky:** secondary analysis, filter drawers, analysis band walls.  

---

## 6. Design system

### 6.1 Theme

- Classes: `report-center-dark` + `report-center-forest` (default on unless env disables V2)  
- Tokens: `globals.css` `.rc-*`  
- Surfaces: deep navy/forest `#071426` family  
- Accent: emerald/lime  
- Attention/subtotal: muted amber  
- Danger: red only for errors/negatives  

### 6.2 KPI visual rules

- Prefer `AnalyticsKpiStrip` / `.rc-kpi-card` / `.rc-kpi-value` / `.rc-kpi-label`  
- **No rainbow** per-step borders as primary language  
- Primary numbers: tabular-nums, no ellipsis  
- Nested metrics: only where useful (e.g. Pengeluaran → Ledger/Stasiun/Kendaraan); not 4 tiles on every card  

### 6.3 Copy (ID-first)

| Use | Avoid as primary |
| --- | --- |
| Ringkasan, Saldo Awal, Penerimaan, Pengeluaran, Saldo Akhir | Opening, Inventory, Purchasing as hero labels |
| Ringkasan server (terfilter) | “full scope” without definition |
| PDF pratinjau | Export PDF (implies official full) |
| SQL (audit) | SQL Debug on executive toolbar |

Full glossary: `Dokumentasi/REPORT_CENTER_PRODUCT_GLOSSARY_ID_EN_2026-07-21.md`.

---

## 7. Data & metrics contract (RPTIN1000015)

### 7.1 Source of truth

- Payload `summary.*` for primary KPIs (never sum table page rows for grand flow).  
- Domain builder: `monthly-stock-account-movement.ts`.  
- Dictionary: `metric-dictionary.md`.  
- Formatting: `utils/format.ts` → `formatKpiValue(value, field, label)`.  

### 7.2 Primary Ringkasan (exactly these 6)

| # | Label UI | Field | Kind |
| --- | --- | --- | --- |
| 1 | Saldo Awal | `OpeningAmount` | currency |
| 2 | Penerimaan | `GoodsReceiveAmount` | currency |
| 3 | Pengeluaran | `IssuedTotalAmount` | currency |
| 4 | Retur | `ReturnAmount` | currency |
| 5 | Saldo Akhir | `ClosingAmount` | currency |
| 6 | Jumlah Item | `TotalItem` | count |

Context chips (not money KPIs): Actual period, Accounting period (auto), Source, scope honesty.

### 7.3 Issued total resolution (preserve)

```
issuedDirect = summary.IssuedTotalAmount
issuedParts = Ledger + Station + Vehicle
value = issuedDirect > 0 ? issuedDirect : (parts > 0 ? parts : issuedDirect)
```

### 7.4 Placeholder movements

Keys with `placeholder_zero` (Received/Transfer/Adj/etc. per domain definitions) must **not** be sold as primary proven KPIs.

### 7.5 Period model

- UI period = actual `YYYY-MM`  
- Server converts to AccYear/AccMonth (`accounting-period.ts`)  
- Client must not fight Acc* vs period (clear one when setting the other)  

### 7.6 Scope layers (never collapse labels)

| Layer | Meaning | May say “full filtered summary”? |
| --- | --- | --- |
| Summary KPI | SQL aggregates for filters | Yes |
| Table loaded/stream | Rows in browser | No — “baris termuat” |
| AI | Compacted sample (~50×40) | No — “sampel AI” |
| PDF | ≤34 rows × ≤7 cols | No — always pratinjau |
| CSV/Excel | limitAll ceilings (monthly 100k / other 20k) | Yes up to ceiling; warn |

---

## 8. Filters & URL

### 8.1 Model

`ReportFilterInput` in `lib/reports/report-filtering.ts`.

State:

- `manualFilters` draft  
- `appliedFilters` committed  
- `requestFilters` = applied + remote table search  

URL is shareable contract via `viewerUrlWithFilters`.

### 8.2 Target surfaces (max)

1. **ControlBar** — primary controls  
2. **AppliedFilterBar** — chips + clear all  
3. **Advanced drawer** — SA codes, movement thresholds, column filters, sort/top, natural language  
4. **Table search** — row search  

### 8.3 Kill list (must stay dead on monthly default)

See `REPORT_DETAIL_REDUNDANCY_KILL_LIST_2026-07-21.md` especially:

- K1–K4 duplicate period/chips/params on executive face  
- K7 issued full-width callout  
- K13–K15 SQL/AI/Charts as primary toolbar equals  

---

## 9. Table requirements

- Keep `@tanstack/react-virtual`  
- Sticky header + sticky identity columns (code/name)  
- Calm subtotals (`rc-subtotal-row`)  
- Stream badge for monthly; KPI independent of stream  
- Toolbar primary: Search, Group, Columns, Density, Export trio, Fullscreen  
- Secondary in overflow: SQL audit, AI sample, charts, quality, print, copy link  
- One deliberate scroll owner for table body  
- No light theme islands inside dark table  

---

## 10. Export & AI requirements

| Channel | Behavior |
| --- | --- |
| CSV | Server `format=csv` + limitAll; notify ceiling |
| Excel | Confirm; client xlsx; report row count + ceiling |
| PDF | Watermark pratinjau; filename `*-pratinjau.pdf`; max 34×7 |
| AI | Default closed; chips sample size; no fabricated causes |
| Future | Preflight dialog component; optional job queue for large Excel |

---

## 11. Architecture plan

### 11.1 Current (as of commits `15a079d` / `2c6c9c0`)

Partial progress **inside** monolith:

- [x] P0 typed metrics, calm subtotals, SQL hover, monthly secondary collapse  
- [x] Monthly 6 ID KPIs + neutral surface  
- [x] Export honesty alerts/watermark  
- [x] Hide standalone period for monthly  
- [x] Remove issued full-width callout  
- [x] Toolbar overflow “Lainnya”; dark context strip  
- [ ] Workspace tabs  
- [ ] File extraction  
- [ ] Shared catalog primitives  
- [ ] Browser QA sign-off  

### 11.2 Target tree (detail-first)

```
ReportViewerClient (orchestrator: fetch/url/state only)
  ReportHeader
  ReportControlBar
  AppliedFilterBar
  ReportWorkspaceTabs
    ReportSummaryWorkspace / MonthlyStockRingkasan
    ReportAnalysisWorkspace / DimensionExplorer
    ReportDataWorkspace
      ReportTableToolbar
      ReportDataTable
    ReportAuditWorkspace
  ExportMenu + ExportPreflightDialog
  MetricValue, ScopeChip
```

Profiles:

```
lib/reports/inventory/viewer-profiles/
  monthly-stock-movement.ts
  movement-analysis.ts
  stock-aging.ts
  asset-valuation.ts
  generic.ts
  index.ts
```

### 11.3 Extraction order (strict)

| Phase | Deliverable | Risk |
| --- | --- | --- |
| P0 | Safety metrics/CSS | done |
| P1 | Honesty labels | done-ish |
| P2 | Filter surface collapse | partial |
| P3 | Monthly summary professionalism | partial (still in monolith) |
| P4 | Extract viewer profiles (zero behavior change) | next |
| P5 | Extract table + toolbar | |
| P6 | Workspace tabs lazy | |
| P7 | Export preflight component | |
| P8 | Catalog share primitives | |
| P9 | Polish a11y + screenshots | |

**Rule:** max 3–5 new files early; extract before parallel agents touch the monolith.

### 11.4 Parallel agent ownership

| Track | Owns | Forbidden |
| --- | --- | --- |
| A Honesty | export/AI labels | SQL formulas |
| B Filters | ControlBar/chips/drawer | Table virtualizer |
| C Summary | MonthlyStockRingkasan | Catalog monolith |
| D Profiles | viewer-profiles/* | JSX thrash |
| E Table | ReportDataTable | Filter URL logic |
| F Catalog | InventoryReportsClient share | Viewer KPI builders |
| Lead | merge, commits, QA | |

---

## 12. Acceptance criteria (ship gate)

### Clarity

- [ ] 5-second understanding of open/in/out/close without SQL  
- [ ] ≤6 primary KPIs on default Ringkasan  
- [ ] No duplicate primary totals  
- [ ] No product-type card flood default  
- [ ] Single primary period control on monthly  

### Correctness

- [ ] No `Rp` on period/qty/count (`format.test.ts`)  
- [ ] Flow KPIs from summary only  
- [ ] Pagination/stream does not change primary KPI meaning  
- [ ] placeholder_zero not hero  

### Honesty

- [ ] PDF always pratinjau  
- [ ] Excel/CSV ceiling known to user  
- [ ] AI sample labeled  
- [ ] Table footer/stream: baris termuat vs summary  

### Table / a11y

- [ ] Sticky header + identity cols  
- [ ] Calm subtotals  
- [ ] Keyboard path through controls  
- [ ] Focus rings on interactive controls  

### Engineering

- [ ] `npx tsx utils/format.test.ts`  
- [ ] `npx tsx lib/reports/inventory/monthly-stock-account-movement.test.ts`  
- [ ] `npx tsx lib/reports/report-detail-performance.test.ts`  
- [ ] `npx tsc --noEmit`  
- [ ] Other inventory profiles still open (smoke)  
- [ ] Screenshots per `REPORT_CENTER_SCREENSHOT_QA_CHECKLIST_2026-07-21.md`  

---

## 13. Git checkpoints & rollback

| SHA | Meaning |
| --- | --- |
| `05dd66b` | Pre total redesign checkpoint |
| `4fe3253` | Typed metrics + calm hierarchy |
| `7d7b6ca` | Exploration documentation pack |
| `2c6c9c0` | Monthly 6 KPI + export honesty |
| `15a079d` | Chrome: no issued callout, period gate, toolbar overflow |

Rollback examples:

```bash
git reset --hard 15a079d   # current UI pass
git reset --hard 7d7b6ca   # docs only, pre UI pass
git reset --hard 05dd66b   # pre redesign
```

Never force-push unless explicitly requested. Never commit `.env*`.

---

## 14. Risks

| Risk | Mitigation |
| --- | --- |
| Agent invents recon math | Only show if verified; else “tidak langsung cocok” |
| Parallel edit monolith | Extract profiles first; line ownership |
| Excel OOM | Confirm + ceiling; later job queue |
| Catalog/viewer option drift | Shared `analysis-group-options.ts` |
| Live report count docs stale | Trust `config.ts` (~19 live + 1 hold) |
| CSS !important remaps | Prefer tokens; watch subtotal greens |

Full register: `Dokumentasi/REPORT_CENTER_RISK_REGRESSION_REGISTER_2026-07-21.md`.

---

## 15. Open questions (defaults if forced)

| ID | Question | Default |
| --- | --- | --- |
| Q1 | Sticky KPI strip with controls? | Control bar only |
| Q3 | Keep PDF? | Yes as labeled pratinjau |
| Q9 | Purchasing net vs GR+Retur? | GR + Retur separate (dictionary) |
| Q13 | Feature flag workspaces? | Optional `NEXT_PUBLIC_REPORT_DETAIL_V2` |

Log: `Dokumentasi/REPORT_CENTER_OPEN_QUESTIONS_2026-07-21.md`.

---

## 16. Implementation checklist for next agent (start now)

```text
[ ] Read this PRD
[ ] git log -6 --oneline (know 05dd66b … 15a079d)
[ ] Run format + monthly + tsc tests
[ ] Browser: open monthly route; screenshot default Ringkasan
[ ] Phase P4: extract getReportViewerProfile → viewer-profiles/* (behavior-identical)
[ ] Phase P2 remainder: AppliedFilterBar single chip source; advanced drawer
[ ] Phase P6: tabs Ringkasan/Analisis/Detail/Audit (lazy)
[ ] Phase P5: extract ReportDataTable
[ ] Kill-list audit K1–K23 still dead
[ ] Screenshot QA pack
[ ] Small commits after each phase
```

### Commands

```bash
cd "Dashboard_Utama"
npx tsx utils/format.test.ts
npx tsx lib/reports/inventory/monthly-stock-account-movement.test.ts
npx tsx lib/reports/report-detail-performance.test.ts
npx tsx lib/reports/report-filtering.test.ts
npx tsc --noEmit
```

---

## 17. Paste-ready agent kickoff

```
You are implementing PRD-REPORT-CENTER-DETAIL-REDESIGN.md (v1.1).
Pilot: monthly-stock-account-movement-details (RPTIN1000015).
Preserve accounting SQL and typed metrics. No big-bang rewrite.
Do not re-break: format.ts kinds, calm subtotals, SQL hover, monthly secondary collapse,
6 ID KPIs, export honesty, period gate, toolbar overflow.
Next: P4 profile extract OR remaining P2 filter collapse per PRD §11.
Verify with tests; screenshots for UI. Commit small; leave rollback SHAs intact.
```

---

## 18. Document control

| Version | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-07-21 | Initial PRD from exploration pack |
| 1.1 | 2026-07-21 | Records commits 2c6c9c0 + 15a079d partial delivery |

**PRD is the contract.** UI code follows PRD; PRD updates when product decisions change.

---

**End of PRD.**
