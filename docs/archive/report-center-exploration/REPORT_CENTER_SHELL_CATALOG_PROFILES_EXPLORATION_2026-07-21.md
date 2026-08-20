# Report Center — Shell, Catalog & Viewer Profiles (Deep Exploration)

**Date:** 2026-07-21  
**Scope:** App chrome **around** report detail — shell, home, inventory catalog, source switching, and per-report **viewer profiles** that fork detail UX.  
**Why this matters:** Detail redesign fails if catalog/shell keep dumping users into inconsistent chrome, duplicate source pickers, or profile-specific JSX forks inside the 6k monolith.

**Primary code:**  
- `app/(report-center)/report-center/layout.tsx` + `ReportCenterShell.tsx`  
- `components/layout/Sidebar.tsx`, `Topbar.tsx`  
- `components/ReportCenterPage.tsx`  
- `components/report-center/GlobalModuleNavigator.tsx`  
- `app/(report-center)/report-center/inventory/InventoryReportsClient.tsx` (~2519 lines)  
- `components/report-center/InventoryOverview.tsx` (~640)  
- `ReportViewerClient.tsx` → `getReportViewerProfile`  
- `lib/reports/inventory/config.ts`, `module-registry.ts`  
- `store/reportStore` (favorites, recent, sidebar)

**Series:**  
1. Refactor context  
2. Card layout  
3. Table + filters  
4. Export + AI + scope  
5. **This file — shell / catalog / profiles**

---

## 0. Journey map (user path)

```
Login (ADMIN only for RC layout)
   ↓
ReportCenterShell = Sidebar + Topbar + rc-scroll-root
   ↓
/report-center  → ReportCenterPage (modules + collapsible insights)
   ↓
/report-center/inventory → InventoryReportsClient (flow catalog + tiles)
   ↓
/report-center/inventory/[report] → ReportViewerClient (monolith detail)
```

Parallel entries from Sidebar: module query links, favorites anchors, direct Inventory Live.

**Auth gate:** layout requires cookie JWT + `role === 'ADMIN'`, else redirect login / dashboard-user.

---

## 1. Shell composition

### 1.1 `ReportCenterShell`

```
div.report-center-dark.rc-shell (+ report-center-forest if NEXT_PUBLIC_REPORT_CENTER_THEME_V2 !== 'false')
  Sidebar
  div flex-1
    ambient gradient
    Topbar
    motion.main.rc-scroll-root  ← PRIMARY PAGE SCROLL
      {children}
```

Implications for detail:

- Sticky Ringkasan `top-0` is relative to **this scroll root**, not `window`.  
- Fullscreen table `fixed inset-0 z-50` escapes shell (good).  
- Framer motion remount on sidebar collapse can re-animate main (minor jank).

### 1.2 Theme tokens

- Forest theme is **default-on** unless env disables V2.  
- Detail monthly still uses many hard-coded Tailwind colors (sky/rose/violet) that **fight** forest KPI tokens used on home (`rc-kpi-card`).  
- Home already uses cleaner tokenized cards; detail is the regression zone.

### 1.3 Sidebar (~264 lines)

Nav groups:

| Group | Items |
| --- | --- |
| Root | Dashboard Report → `/report-center` |
| MODUL UTAMA | Procurement / Financial / HR / Budget → query `?module=` + `#modules` |
| REPORT CEPAT | Inventory Live, Daftar Laporan, Favorit |
| PENGELOLAAN | Integrasi, Pengaturan (anchors on home) |

Behaviors:

- Collapsible via `useReportStore.sidebarCollapsed`  
- Mobile drawer  
- **Source-aware hrefs:** appends `source=estate|pabrik` from localStorage / URL / custom event `report-center-source-change`  
- Active path: inventory detail highlights Inventory Live via `startsWith`  

Gaps:

- No deep link to current report title in sidebar (only module)  
- Hash-only items never `isActive`  
- “Procurement” label vs inventory path naming can confuse (procurement module vs inventory live)

### 1.4 Topbar (~336 lines)

Responsibilities piled high:

- Breadcrumb-ish page title from pathname  
- Global search entry  
- **SQL Gateway picker** (presets localhost / 10.0.0.110 / ports)  
- **Estate | Pabrik source switch** (localStorage + event bus)  
- Notifications stub  
- User avatar/role  

**Source is controlled in Topbar AND catalog AND viewer.** Three UIs, one storage key `report-center:last-source`.

**Gateway picker** is power-user chrome on every page including executive-facing detail — belongs in Audit/settings for most users.

Target: Topbar = title, search, source (one), user. Gateway → Settings/Audit.

---

## 2. Report Center home

`ReportCenterPage` (~102 lines) — relatively clean:

1. `GlobalSearch`  
2. `GlobalModuleNavigator`  
3. 5 registry KPI cards (`rc-kpi-card`)  
4. Collapsible “Insight tambahan” (mock recommendations + favorites + recent + system)

**Good pattern:** progressive disclosure for secondary panels (default closed). Detail Ringkasan should copy this, not invert it.

Mock recommendations still `console.info` on select — not product-complete.

`GlobalModuleNavigator` (~310) drives module cards from `REPORT_GLOBAL_MODULES` registry — source of truth for counts/availability.

---

## 3. Inventory catalog (`InventoryReportsClient` ~2519)

Second monolith after the viewer. Owns:

- Flow stage model (request → PO → receive → movement → usage → valuation → audit…)  
- Catalog cards / tiles (`ReportTile`, `FlowStageTile`, `KpiTile`, `AIInsightTile`, workspace tiles)  
- Sticky **catalog jump nav** (`.rc-catalog-jump`) by report group  
- Source picker, stale filter, movement window, analysis group scope controls  
- Preview fetch (limit 50) + mini AI dashboard embed  
- Export excel/pdf helpers **duplicated** vs viewer (same honesty problems)  
- Favorites/recent via store  
- URL params for selected report, stage, filters  

### 3.1 Dual catalog concepts

| Concept | Source |
| --- | --- |
| `liveInventoryReports` / `config.ts` | Real live handlers + metadata |
| `InventoryCatalogReport` + flow stages | UX catalog mapping live + planned cards |
| Optional `InventoryOverview` component | Another overview path (~640) — risk of third inventory face |

Status keys: `live | preview | mapping_db | need_validation | planned`.

Only live with `existingReportId` should open detail; others preview-only.

### 3.2 Catalog → detail handoff

Open report builds URL under `/report-center/inventory/{id}?source=&…filters…`.

Catalog can pre-set:

- analysis group (StockAnalysisCode, ProductTypeCode, …)  
- stock analysis scope codes  
- movement window  
- stale (more relevant aging reports)  

**Handoff risk:** catalog and viewer both redefine `INVENTORY_ANALYSIS_GROUP_OPTIONS` / movement windows — drift if one list updates.

### 3.3 Catalog visual language

- Forest tokens, rounded 22px group panels  
- Sticky jump chips (better than detail’s multi-rail sticky)  
- Tile density high but **grouped by flow** — clearer IA than detail’s flat card walls  

**Lesson for detail redesign:** catalog’s sticky jump + group sections is closer to professional IA than viewer’s sticky mega-Ringkasan.

### 3.4 Size / maintainability

~2519 lines client catalog + ~6461 viewer = **~9k lines** inventory UI surface alone. Parallel agents will thrash. Extract order should treat catalog as second extract target after detail Ringkasan, sharing:

- Source control component  
- Export preflight  
- Report tile  
- Analysis group options module  

---

## 4. Viewer profiles (fork engine inside detail)

`getReportViewerProfile(reportId)` returns a large config object that changes almost everything about detail UX.

### 4.1 Profile fields (conceptual)

| Field | Effect |
| --- | --- |
| `kpiBuilder` | Which KPI cards exist |
| `presets` / `presetTitle` | Quick preset buttons |
| `businessColumns` / `fallbackColumns` / `maxInitialColumns` | Default table columns |
| `technicalColumns` | Hidden/deprioritized |
| `manualFilterColumns` | Column filter builder options |
| `preferredGroupColumns` | Group suggestions |
| `tableContextColumns` | Context strip keys |
| `showAccountingPeriodFilter` | Period section visibility (**true for all inventory base**) |
| `rowDetail` | `generic` \| `movement` expand UI |
| `kpiPresetByLabel` | Clickable KPI → filter map |
| `qualityBuilder` / `topRowsBuilder` | Quality/top lists |
| `naturalPlaceholder` | NL filter hint |
| `defaultSort` | Initial sort |
| `loadAllRows` | Fetch strategy hint |

### 4.2 Profile families

| Family | Report IDs set | KPI style | Columns intent |
| --- | --- | --- | --- |
| **Base generic** | default | `genericKpis` | generic prefs |
| **Movement analysis** | MOVEMENT_ANALYSIS_* | movement category KPIs | movement business cols |
| **Stock aging** | STOCK_AGING_* | aging/risk | aging cols |
| **Asset valuation** | ASSET_VALUATION_* | valuation KPIs | product type amounts |
| **Monthly stock movement** | `monthly-stock-account-movement-details` | `monthlyStockMovementKpis` + official flow | **MONTHLY_OFFICIAL_DETAIL_COLUMNS** order |

### 4.3 Monthly profile specifics (critical)

Comments in code (GUARDRAIL official columns):

Visible table order should follow official PDF/JSON story:

`Item/Description → Opening → INVENTORY block → ISSUED → PURCHASING → Closing`  
then taxonomy / MovementCategory as context columns (`MONTHLY_CONTEXT_DETAIL_COLUMNS` fallback).

Presets include:

- Bulan berjalan  
- Group SA / Movement / Product Type / Brand / Model / Material  
- Match JSON Product Type (hard-codes period `2026-07`, location PTRJ, gudang only) — **demo bias** if left as production default click  
- DEADS / MEMOV / SLMOV only  

`showAccountingPeriodFilter: true` **plus** sticky monthly period rail = duplicate (documented in filters exploration).

`loadAllRows: false` but stream logic still pulls more for monthly — profile flag vs stream implementation must stay consistent in docs/code.

### 4.4 Architectural smell

Profiles are **inline in ReportViewerClient** (hundreds of lines of column constants + builders). They should live in:

```
lib/reports/inventory/viewer-profiles/
  monthly-stock-movement.ts
  movement-analysis.ts
  stock-aging.ts
  asset-valuation.ts
  generic.ts
```

UI shell reads profile; builders stay pure/testable. This is the main path to stop per-report JSX forks.

---

## 5. Cross-cutting state

### 5.1 Source `estate | pabrik`

| Location | Mechanism |
| --- | --- |
| localStorage `report-center:last-source` | Persist |
| URL `?source=` | Shareable |
| CustomEvent `report-center-source-change` | Sync sidebar/topbar |
| Viewer state `selectedSource` | Fetch param |

Servers (from labels): estate → SP2/db_ptrj; pabrik → SP3/db_ptrj_mill (verify against sql-gateway config when changing).

### 5.2 Favorites / recent

`useReportStore`: toggle favorite, addRecent on open. Catalog and viewer both use it. Home FavoritesPanel reads same store.

### 5.3 SQL gateway base

Topbar client override via `sql-gateway-client` — affects all report queries. Must be visible when non-default (ops safety) but not equal to “Export” prominence.

---

## 6. Inconsistencies that make the app feel unprofessional

| Issue | Where |
| --- | --- |
| Home uses calm `rc-kpi-card`; detail uses rainbow flow cards | Visual system split |
| Source picker ×3 | Topbar, catalog, viewer |
| Export helpers duplicated | Catalog + viewer (+ shared ExportButtonGroup unused) |
| Analysis group option lists duplicated | Catalog + viewer |
| InventoryOverview vs InventoryReportsClient | Possible dual inventory landings |
| Sidebar “Procurement” vs route inventory | Naming |
| Gateway picker always on | Cognitive load for CEO path |
| Mock AI recommendations on home | Trust |
| Profile presets hard-code sample period 2026-07 | Stale demo |
| Period filter forced on all profiles | Even when sticky monthly already has it |
| Two mega-clients (2.5k + 6.5k) | Agent conflict risk |

---

## 7. Target shell IA (product)

```
Shell
  Sidebar: modules + inventory + favorites (source-aware links)
  Topbar: breadcrumb, search, source, user | overflow: gateway, settings
  Main:
    Home: module navigator + thin stats + optional insights
    Module catalog: flow groups + jump nav + report tiles
    Report detail: Header + ControlBar + Workspaces (not another catalog)
```

### Detail entry chrome (shared)

Every report detail (all profiles) shares:

1. ReportHeader (title, code, source chip, favorite, export)  
2. ReportControlBar (profile-driven fields)  
3. Workspaces tabs  
4. Profile only swaps: summary widgets, column presets, filter advanced sections, row detail mode  

**No** full-page redesign per reportId inside one file.

---

## 8. Extraction / refactor order (shell-aware)

1. **Shared primitives:** SourceSwitch, ScopeChip, ExportMenu (honesty), AnalysisGroupSelect  
2. **Extract viewer profiles** out of ReportViewerClient (no UI change)  
3. **Detail Ringkasan/ControlBar** extract (monthly first)  
4. **Catalog** share primitives; delete duplicate export/pdf if possible  
5. **Topbar slim-down** (gateway to settings)  
6. **Deprecate/merge InventoryOverview** if redundant with InventoryReportsClient  
7. **Home** wire real recommendations or hide mock  

Parallel agents: never edit catalog + viewer monoliths simultaneously without profile extract first.

---

## 9. Acceptance (shell/catalog)

- [ ] One SourceSwitch component used in ≤2 places (topbar + optional catalog contextual)  
- [ ] Gateway not primary topbar control for default users  
- [ ] Catalog jump nav remains; detail does not re-implement catalog  
- [ ] Opening live report preserves source + key filters in URL  
- [ ] Viewer profiles live outside 6k file  
- [ ] Monthly official column order preserved via profile  
- [ ] Home/detail share forest KPI visual language  
- [ ] No hard-coded demo period in default preset without label “contoh”  
- [ ] Favorites/recent work from catalog and detail  

---

## 10. Size map (inventory UI surface)

| File | ~Lines | Role |
| --- | --- | --- |
| ReportViewerClient | 6461 | Detail monolith |
| InventoryReportsClient | 2519 | Catalog monolith |
| inventory/config | 1170 | Report registry |
| inventory route API | 4716 | Handlers |
| monthly-stock-account-movement | 1593 | Domain SQL |
| InventoryOverview | 640 | Alt overview? |
| GlobalModuleNavigator | 310 | Home modules |
| Sidebar + Topbar | 264+336 | Shell |
| ReportCenterPage | 102 | Home |

---

## 11. Agent one-liner

> Shell is forest-themed and mostly right; **catalog is a second monolith** with good jump-nav IA; **detail ignores shell design system** and forks behavior via **inline viewer profiles**. Redesign = extract profiles + shared source/export/scope primitives + detail workspaces; don’t invent a third inventory home.

---

## 12. Full exploration pack index

| # | Path under `Dokumentasi/` |
| --- | --- |
| 1 | `REPORT_CENTER_REFACTOR_CONTEXT_FOR_AGENTS_2026-07-21.md` |
| 2 | `REPORT_DETAIL_CARD_LAYOUT_EXPLORATION_2026-07-21.md` |
| 3 | `REPORT_DETAIL_TABLE_AND_FILTERS_EXPLORATION_2026-07-21.md` |
| 4 | `REPORT_DETAIL_EXPORT_AI_SCOPE_EXPLORATION_2026-07-21.md` |
| 5 | **`REPORT_CENTER_SHELL_CATALOG_PROFILES_EXPLORATION_2026-07-21.md` (this)** |
| + | `REPORT_CENTER_DEBUG_REPORT_2026-07-21.md` |
| + | `MASTER_PROMPT_REPORT_CENTER_REDESIGN_ADVANCED.md` |
| + | `REPORT_DETAIL_IMPLEMENTATION_REFERENCE.md` |
| + | `Dashboard_Utama/lib/reports/inventory/metric-dictionary.md` |

---

**End of shell / catalog / profiles exploration.**  
Next automatic continuation candidates (until user stops): workspace tab IA wireframe doc, component tree target architecture, or implementation checklist unified.
