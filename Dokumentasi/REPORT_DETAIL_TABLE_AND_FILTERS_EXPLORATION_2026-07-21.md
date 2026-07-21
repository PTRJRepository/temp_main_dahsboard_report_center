# Report Detail — Table & Filter Surfaces (Deep Exploration)

**Date:** 2026-07-21  
**Scope:** How **filters** and the **data table** are composed on inventory report detail (emphasis: monthly stock account movement).  
**Primary code:**  
- `Dashboard_Utama/app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx`  
- `Dashboard_Utama/lib/reports/report-filtering.ts`  
- `Dashboard_Utama/lib/reports/report-detail-performance.ts`  
**Companions:**  
- `Dokumentasi/REPORT_CENTER_REFACTOR_CONTEXT_FOR_AGENTS_2026-07-21.md`  
- `Dokumentasi/REPORT_DETAIL_CARD_LAYOUT_EXPLORATION_2026-07-21.md`

---

## 0. One-sentence diagnosis

Filters are **powerful but scattered across 6+ surfaces that re-expose the same keys**; the table is a **serious virtualized tool** trapped under a **crowded toolbar** and a page that still mounts filter walls above it.

---

## 1. Filter model (source of truth)

### 1.1 Type: `ReportFilterInput`

File: `lib/reports/report-filtering.ts` (~L44–92)

| Group | Keys |
| --- | --- |
| Time | `period`, `accYear`, `accMonth`, `actualYear`, `actualMonth`, `dateFrom`, `dateTo` |
| Scope | `location`, `itemType`, `includeWorkshopItem`, `source` (viewer-level, not all in type) |
| Taxonomy | `category`, `stockAnalysis`, `productType`, `productCategory`, `productBrand`, `productModel`, `productMaterial` |
| Movement | `movementCategory`, `movementWindow`, `movementFastMin`, `movementMovingMin`, `movementMovingMax`, `movementSlowCount` |
| Ops | `supplier`, `status`, `vehicle`, `stale`, `blankField`, `minQty`, `minAmount` |
| Analysis | `groupBy`, `chartDimension`, `aggregateField`, `aggregateFn`, `top`, `analysis` |
| Sort / window | `sortColumn`, `sortDirection`, `sortMetric`, `resultLimit`, `rowStart`, `rowEnd` |
| Freeform | `search`, `columnFilters[]`, `naturalQuery` |

### 1.2 Dual client state

| State | Role |
| --- | --- |
| `manualFilters` | Draft UI values (inputs before Apply in some paths) |
| `appliedFilters` | Committed filters that drive fetch + URL |
| `requestFilters` | `appliedFilters` + remote table search (≥2 chars) |

**Commit path:** `commitReportFilters(next, message, mode)` → updates applied + manual + URL via `viewerUrlWithFilters` / `router.push|replace`.

**URL is a contract:** reload must restore scope. Natural language can set `naturalQuery` + derived keys via `report-filtering` parsers (tested heavily).

### 1.3 Where filters become SQL vs client-only

Agents must classify each key (do not assume):

| Layer | Examples | Effect |
| --- | --- | --- |
| Server / SQL (inventory route + monthly CTE) | period→acc, location, stockAnalysis, itemType, includeWorkshopItem, groupBy for analytics, movement window defs | Changes **summary KPIs** + row set |
| Server sort/page | page, pageSize, tableSortColumn | Table window |
| Client table search debounce | `tableSearch` → `remoteTableSearch` if len≥2 | Merged into `requestFilters.search` |
| Client-only sort when not serverPaged | sortColumn local | Reorders loaded rows |
| Presentation | visibleColumns, density, tableGroupMode (partially dual with groupBy) | No SQL |

**Honesty rule:** KPI must stay on **summary** when table is windowed. Code already documents this for monthly stream.

---

## 2. Filter surfaces map (why it feels redundant)

### Surface A — Sticky Ringkasan control rail (monthly only)

Inside `rc-ringkasan`:

- Actual period (`type=month`) → **immediate** `commitReportFilters` (clears Acc*)
- Analysis group select → `applyMonthlyAnalysisGroup`
- Movement period/window select → `applyMonthlyMovementWindow`
- “More filters” → opens report info + manual filter

### Surface B — Sticky active filter chips (top)

When removable chips exist: lime chips + Clear all. Removes individual filter keys.

### Surface C — Dedicated “Periode Report (Bulan Aktual)” section

Shown when `viewerProfile.showAccountingPeriodFilter`.

- Month input + Apply Periode + Current  
- Displays Actual + Acc (auto) chips  
**Duplicates Surface A period for monthly.**

### Surface D — Report info panel (`reportInfoVisible`)

Large two-column area:

**Left:** Natural Filter (Sparkles) + Jalankan + chip list again + “Parameter request report” mono dump + Copy params  

**Right:** Presets grid + Manual Filter toggle  

When manual open (monthly):

1. **Period again** (Apply / Current)  
2. **Stock Analysis master** block (DEADS/MEMOV/SLMOV, Match JSON/PDF, Default 1+4, Group table SA)  
3. **Movement Category** block (window, dateFrom/To, Apply MC, group on/off, Fast/Moving/Slow thresholds)  
4. **Filter Kolom Report** (field / operator / value / valueTo / +)  
5. **Sort / Limit / Chart** (stale, sortColumn, sortDirection, itemType, groupBy, aggregate*, top, resultLimit, …)  
6. Footer Terapkan / Reset  

### Surface E — Table toolbar search

`tableSearch` — “Search dalam table…” — debounced; remote if ≥2 chars.

### Surface F — KPI / analysis drill

Click global/breakdown/sub/movement cards → `applyKpiFilter` / `applySubKpiCardFilter` / `applyReportFilterAction` → mutates same `ReportFilterInput`.

### Surface G — Analysis band

`ReportAnalysisBand` can emit `ReportFilterAction` into the same merge pipeline.

```
                    ┌──────── URL ────────┐
                    │ appliedFilters      │
                    └─────────┬───────────┘
         A sticky rail   B chips   C period   D panel   E table search
         F KPI drill     G analysis band
                    └─────────┬───────────┘
                              v
                     fetchReport + summary
```

**Redundancy score (monthly default path):** period ×3, groupBy ×3–4, movement window ×2, chips ×2, stock analysis × sticky group + SA block.

---

## 3. Target filter IA (for redesign agents)

### 3.1 Single Control Bar (sticky, thin)

Primary always visible:

| Control | Notes |
| --- | --- |
| Actual period | one month input |
| Source estate\|pabrik | viewer-level |
| Analysis group | groupBy |
| Search | merges table + optional global search |
| More filters (N) | drawer/sheet; badge = active count |
| Apply only if draft mode | or instant-commit with debounce for period |

### 3.2 One AppliedFilterBar

Chips only here (not also inside natural panel as primary). Clear all once.

### 3.3 More filters drawer sections (accordion)

Order:

1. Scope (location, itemType, workshop include)  
2. Stock analysis master  
3. Movement category + window + thresholds (advanced)  
4. Column filters builder  
5. Sort / Top N / result limit  
6. Natural language (optional, secondary)  
7. Request params (debug, under Audit)

### 3.4 Remove from default page scroll

- Standalone period section when Control Bar exists  
- Mono parameter dump from executive path  
- Duplicate Apply SA / Apply MC rows if same keys already in Control Bar  

Keep power-user capability; **collapse surface count**.

---

## 4. Table architecture (current)

### 4.1 Container modes

| Mode | Shell |
| --- | --- |
| Inline | `rounded-2xl border-amber-400/25 bg-[#0b1018] shadow heavy`, `mt-5` |
| Full table | `fixed inset-0 z-50`, dark `#06080d`, Exit button |

Scroll body:

- Inline: `h-[76vh] min-h-[620px] max-h-[920px] overflow-auto`  
- Expanded: `h-[calc(100vh-58px)]`  

**Nested scroll risk:** page `rc-scroll-root` + table `overflow-auto` + sticky Ringkasan above → three vertical contexts.

### 4.2 Toolbar (table header sticky `z-40`)

Crowded action row (non-expanded often shows **all** of):

Search · stream badge · Group select · Expand/Collapse groups · Density · Columns checklist · Excel · PDF · CSV · Print · Copy Link · SQL Debug · AI Insight · Charts · Quality · **Full Table**

Expanded mode hides many (PDF, Print, Copy, SQL, AI, Charts, Quality, Full Table) and adds page prev/next + pageSize.

**Problem:** toolbar mixes **table tools** with **workspace navigation** (AI, Charts, SQL, Quality). Professional apps put workspace nav in tabs; table toolbar stays: search, columns, density, group, export, fullscreen.

### 4.3 Data pipeline

```
fetchReport(limit = min(pageSize, TABLE_FIRST_LIMIT=500), page, pageSize, serverSort, debugSql)
  → payload.rows / columns / summary / metadata
monthly: after first paint may STREAM more rows (KPI still summary)
  → filteredRows (client filter/sort if !serverPaged)
  → tableWindow = normalizeReportTableWindow(metadata, ...)
  → pageRows or full filtered for groups
  → buildReportTableGroups / buildReportTableRows
  → useVirtualizer over tableRows
```

Key flags:

- `serverPaged` from `metadata.paginated`  
- `tableStreaming` / `tableStreamProgress`  
- GUARDRAIL: do not bounce `setPage` from response (reload loop)

### 4.4 Column model

| Concept | Behavior |
| --- | --- |
| `payload.columns` | Full schema from API |
| `visibleColumns` | User toggles; init via `preferredVisibleColumnsForProfile` |
| Sticky identity | Code column left 0; Name sticky at 96 if code present |
| Width classes | code ~96px, name ~200px, category ~108px, numeric ~92px right tabular |
| Header style | amber uppercase, `bg-[#0b1018]`, sticky z-40 |
| Body zebra | `#0f172a` / `#111827`, hover `#172033` |
| Sort | header button → `sortBy(column)` local and/or server |

### 4.5 Row model types (`ReportTableRenderRow`)

| type | UI |
| --- | --- |
| `group-header` | Full-width row, collapse chevron, chips Item/Amt/Qty (+ 2 extra subtotal chips on xl) |
| `group-subtotal` | `rc-subtotal-row` calm amber left accent; cells show totals for subtotal columns |
| `detail` | Expanded row detail via `ReportRowDetail` (movement metrics/facts/events) |
| data row | Click toggles movement expand; virtualized |

Row height estimates (virtualizer):

| Row | compact-ish | expanded table mode |
| --- | --- | --- |
| detail | 148 | 120 |
| group-header | 44 | 36 |
| group-subtotal | 34 | 28 |
| data | 34 compact / 42 comfort | 28 |

Overscan: 12 normal / 18 expanded.

### 4.6 Grouping dual control (confusion)

1. **Filter `groupBy` / chartDimension** — affects KPI analytics, monthly analysis group, often SQL/analytics  
2. **`tableGroupMode`** — Auto / None / per-column for **table** grouping UI  

SA / Movement panels can set **both**. Users can desync “Analysis group” in Ringkasan from “Group:” in table toolbar.

**Target:** one Group control with modes: `KPI+table linked` default; advanced “table group only”.

### 4.7 Export honesty (current gaps)

| Action | Behavior note |
| --- | --- |
| Excel | `exportExcel(report, source, requestFilters)` — server path; verify row ceiling for monthly (API allows high stream limit) |
| CSV | download via params |
| PDF | `exportPdf(report, filteredRows, visibleColumns)` — **client rows** → risk of sample/partial PDF |
| Print | `window.print()` |

Agents redesigning export must label scope and prefer full filtered server export for Excel/CSV.

---

## 5. Table visual hierarchy issues

1. **Amber table chrome + lime Ringkasan + rose issued** = three brand accents fighting.  
2. Toolbar button count equal-weight (Excel vs Charts vs Quality vs Full Table).  
3. Light “table context” strip (`bg-[#F0F4FA]`) can appear when `reportInfoVisible` — **light island inside dark report** (identity break).  
4. Sticky table header amber vs sticky Ringkasan navy — double sticky bands when scrolling page vs table.  
5. Column labels often raw glossary-ish; help only in `title` tooltip.

---

## 6. Target table composition

### 6.1 Structure

```
[ Workspace tabs: Ringkasan | Analisis | Detail Data | Audit ]
Detail Data:
  ReportTableToolbar (single row, overflow menu)
  Scope line: "Menampilkan X baris · terfilter server · stream …"
  Table shell
    sticky thead + sticky identity cols
    virtual body
    optional group headers / calm subtotals
  Footer: pagination · density · row count · export
```

### 6.2 Toolbar priority

**Primary:** Search · Columns · Group · Density · Fullscreen  
**Secondary (overflow):** Export submenu (Excel/CSV/PDF with scope dialog) · Copy link · Print  
**Not in table toolbar:** SQL Debug · AI · Charts · Quality → workspace tabs / Audit / Analisis  

### 6.3 Column presets (recommended)

| Preset | Intent |
| --- | --- |
| Ringkasan | identity + open/in/out/close amounts |
| Qty | identity + qty columns |
| Amount | identity + amount columns |
| Semua | full visible set |

Init from profile `businessColumns` / `fallbackColumns` (already partially present).

### 6.4 Scroll policy

- Prefer **one** scroll owner for table workspace (fullscreen or dedicated pane).  
- When inline: table max-height OK, but **do not** also sticky a multi-rail Ringkasan taller than ~120px.  
- Sticky: control bar + table header only.

---

## 7. Interaction matrix (filters ↔ table)

| User action | Filters | Table | KPI summary |
| --- | --- | --- | --- |
| Change period (commit) | URL+applied | refetch | refetch |
| Table search ≥2 chars | requestFilters.search | refetch/filter | may affect if server search |
| Local sort non-paged | maybe none | reorder | unchanged |
| Click Product Type KPI | group/column filter | refetch | refetch |
| Toggle column visibility | none | presentation | none |
| Table group mode only | none (unless also commits groupBy) | regroup client | no change if not committed |
| Full table | none | fullscreen layout | hidden behind |

Document any server search semantics in API when changing search UX.

---

## 8. Monthly-specific table notes

- Stream after first paint: badge “Streaming table L/T” — keep; good honesty.  
- `TABLE_FIRST_LIMIT = 500`; pageSize default 100.  
- Monthly API ceiling can go high (100k) for stream/export — UI must not claim “all rows” until `streamComplete` / metadata says so.  
- Movement expand rows + group headers increase virtualizer complexity — keep estimateSize accurate when extracting table component.

---

## 9. Extraction plan (filters + table)

### Phase F1 — Filter surface collapse (no SQL change)

1. Introduce `ReportControlBar` + `AppliedFilterBar`.  
2. Hide Surface C when monthly sticky/control has period.  
3. Hide chip list inside Natural panel; keep chips only in AppliedFilterBar.  
4. Move Surface D bulk into drawer; default closed.

### Phase F2 — Align group controls

1. Single source for analysis group.  
2. Table group either follows or explicitly “independent”.  

### Phase T1 — Toolbar triage

1. Overflow menu for secondary actions.  
2. Move AI/Charts/SQL/Quality out of table toolbar.  

### Phase T2 — Extract `ReportDataTable`

1. Move virtualizer + row render + column width helpers.  
2. Props: rows, columns, visibleColumns, groupMode, density, onSort, …  
3. Keep fetch in parent until stable.

### Phase T3 — Export dialog

1. Scope, expected rows, columns, include totals.  
2. PDF never silent-partial.

---

## 10. Acceptance checklist

### Filters

- [ ] Period controlled in exactly one primary place  
- [ ] Chips in exactly one bar  
- [ ] More filters drawer contains advanced only  
- [ ] URL still round-trips all committed keys  
- [ ] KPI still summary-scoped after filter  
- [ ] Natural language optional, not centerpiece  

### Table

- [ ] ≤1 primary toolbar row; overflow for the rest  
- [ ] Sticky header + identity columns work while horizontal scroll  
- [ ] Calm subtotals (no solid warning fill)  
- [ ] Virtualization OK with group/detail rows  
- [ ] Scope/row count visible and honest  
- [ ] Fullscreen exit clear  
- [ ] Export scope labeled  
- [ ] No light theme island inside dark table  

---

## 11. ASCII: filter+table target

```
┌ Header ──────────────────────────────────────────┐
│ Title · Source · Status · [Export]               │
├ ControlBar sticky ───────────────────────────────┤
│ Period | Group | Window | Search | More(3) | Reset│
├ AppliedFilters ──────────────────────────────────┤
│ [DEADS ×] [PTRJ ×]  Clear all                    │
├ Tabs: [Ringkasan] [Analisis] [Detail*] [Audit] ──┤
│                                                  │
│ Detail:                                          │
│ ┌ Toolbar ─────────────────────────────────────┐ │
│ │ Search  Group  Columns  Density  ⋮  Fullscreen│ │
│ │ 12.450 baris · stream complete · server filter│ │
│ ├──────────────────────────────────────────────┤ │
│ │ sticky thead …                               │ │
│ │ virtual rows …                               │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## 12. File touch list

| Concern | Path |
| --- | --- |
| Filter type + URL | `lib/reports/report-filtering.ts` |
| Filter action merge | `lib/reports/report-detail-performance.ts` |
| UI surfaces | `ReportViewerClient.tsx` (until extract) |
| New | `components/report-center/ReportControlBar.tsx`, `AppliedFilterBar.tsx`, `ReportDataTable.tsx`, `ReportTableToolbar.tsx` |
| Glossary labels | `lib/reports/inventory/column-glossary.ts` |
| Window math | `report-detail-performance.ts` / experience types |

---

## 13. Agent one-liner

> Filters: one ControlBar + one chip bar + one advanced drawer; kill period/group triple entry. Table: keep virtualization and calm subtotals; demote toolbar to table tools only; move AI/SQL/charts to workspaces; fix light context strip; label export/stream scope. Don’t invent SQL while collapsing surfaces.

---

**End of table & filters exploration.**
