# Report Detail — Card Layout & Composition (Deep Exploration)

**Date:** 2026-07-21  
**Scope:** How cards are **built, sorted, scoped, laid out, styled**, and where redundancy comes from — especially **MONTHLY STOCK ACCOUNT MOVEMENT DETAILS** (`monthly-stock-account-movement-details` / `RPTIN1000015`).  
**Primary source:** code in `ReportViewerClient.tsx` + `globals.css` + `AnalyticsKpiStrip.tsx` (not design wish-lists).  
**Companion docs:**  
- `Dokumentasi/REPORT_CENTER_REFACTOR_CONTEXT_FOR_AGENTS_2026-07-21.md`  
- `Dokumentasi/REPORT_DETAIL_IMPLEMENTATION_REFERENCE.md`  
- `Dashboard_Utama/lib/reports/inventory/metric-dictionary.md`

---

## 1. Mental model: one data list, many visual rails

Almost all “cards” on monthly report detail come from **one array**: `kpiCards: ReportKpiCard[]`.

That array is then **sliced by `scope`** into parallel rails that the JSX renders as separate grids:

| Rail variable | Filter rule | Default monthly visibility |
| --- | --- | --- |
| `flowKpiCards` | `scope === 'flow'` | **Always** (primary Ringkasan) |
| `globalKpiCards` | `scope === 'global'` OR (no scope and no groupKey) | Behind `monthlySecondaryOpen` (default **false**) |
| `breakdownKpiCards` | `scope === 'breakdown'` + `groupKey` | Behind secondary toggle |
| `subKpiCards` | `scope === 'sub'` + groupKey, not ItemType / not MovementCategory | Behind secondary; max 12 shown for monthly |
| `movementCategoryKpiCards` | `scope === 'movement'` + field MovementCategory | Behind secondary; max 12 shown for monthly |
| `stickyGrandTotals` | Derived chips from flow (or table totals fallback) | **Hidden for monthly when flow exists** |

**Why this feels messy:** one business story is painted **up to five times** with different chrome (sticky chips, flow cards, global cards, breakdown, sub, movement). Collapse helps, but structure still multiplies surfaces.

---

## 2. How flow cards are **built** (data layer)

Function: `buildOfficialMovementFlowKpis(payload)`  
Location: `ReportViewerClient.tsx` ~L1858–2009

### 2.1 Source of numbers

```text
payload.summary  →  pickSummaryOnly(summary, keys)
```

**Guardrail in code:** page table rows are a TOP-N / window — **never** sum table rows for grand flow totals. Flow cards must use **server summary**.

### 2.2 Exactly 5 flow cards today (not 6)

| # | `flowSection` | Label (UI) | Primary `value` | Tone (Tailwind) | Nested `metrics` |
| --- | ---: | --- | --- | --- | --- |
| 1 | `opening` | Opening | `OpeningAmount` | sky | Amount + optional OpeningQty |
| 2 | `inventory` | Inventory | **client sum** Received+ReturnAdvice+Transfer+Adj | cyan | 4 placeholder-prone fields |
| 3 | `issued` | Issued total | `IssuedTotalAmount` or sum(Ledger+Station+Vehicle) | rose | Ledger, Station, Vehicle, Total |
| 4 | `purchasing` | Purchasing | **client net** Return+GR−GoodsReturn−Dispatch | violet | Return, GR, Goods return, Dispatch |
| 5 | `closing` | Closing | `ClosingAmount` | lime | Amount + optional ClosingQty |

**Mismatch with metric-dictionary “primary 6”:**

| Dictionary (target) | Current flow builder |
| --- | --- |
| Saldo Awal | Opening ✓ |
| Penerimaan (GR) | Buried inside Purchasing metrics, not primary card |
| Pengeluaran | Issued total ✓ |
| Retur | Buried inside Purchasing |
| Saldo Akhir | Closing ✓ |
| Jumlah Item (count) | **Not a flow card** (may appear in global/dynamic) |
| — | Extra “Inventory” aggregate of often-zero placeholders |

So layout noise is partly **product model drift**: UI sells 5 English engineering buckets; dictionary wants 6 ID accounting beats.

### 2.3 Issued total resolution logic

```text
issuedDirect = IssuedTotalAmount from summary
issuedPartsSum = Ledger + Station + Vehicle
issuedTotalValue = issuedDirect > 0 ? issuedDirect
                 : issuedPartsSum > 0 ? issuedPartsSum
                 : issuedDirect
```

Then JSX **also** renders an “Issued breakdown” callout under the flow grid that **repeats** the same issued metrics (rose panel + mono field names). That is intentional for audit, accidental for executive calm.

### 2.4 Merge into full monthly KPI list

`monthlyStockMovementKpis()`:

```text
flowCards
+ buildDynamicGrandTotalKpis(... up to 20 keys, group field ...)
  filtered to drop:
    - any card with scope flow
    - global cards whose label already covered by flow story (regex)
→ [...flowCards, ...withoutDuplicateGlobals]
```

So even after “dedupe”, **breakdown / sub / movement** cards still pile on.

---

## 3. Card object shape (what each card can carry)

Typical fields used in render (from flow builder + filters):

```ts
type ReportKpiCard ≈ {
  label: string
  value: number
  description: string
  tone: string                 // full Tailwind border/bg/text string
  scope?: 'flow' | 'global' | 'breakdown' | 'sub' | 'movement' | ...
  flowSection?: 'opening' | 'inventory' | 'issued' | 'purchasing' | 'closing'
  groupField?: string
  groupKey?: string
  sourceTable?: string
  sourceField?: string
  metrics?: Array<{
    key: string
    label: string
    value: number
    sourceTable?: string
    sourceField?: string
  }>
  filterAction?: ...           // drill filters for clickable cards
}
```

**Tone is not tokenized.** Each card hardcodes a color family (sky/cyan/rose/violet/lime). That fights the calmer `.rc-kpi-card` / `.rc-kpi-strip__item` system and produces a “rainbow dashboard” feel.

---

## 4. How cards are **laid out** (JSX structure)

Container: sticky Ringkasan — ~L4536

```text
.rc-ringkasan
  sticky top-0 z-30
  mt-4 space-y-2
  rounded-xl border border-lime-400/15
  bg-[#071426]/95 p-2
  shadow + backdrop-blur
```

### 4.1 Layer stack inside Ringkasan (top → bottom)

```
┌─ rc-ringkasan (sticky, p-2, space-y-2) ─────────────────────────┐
│ A. Ringkasan cepat chips (flex wrap) — HIDDEN if monthly+flow   │
│ B. Monthly control rail (grid 4 cols): period | group | window  │
│    | More filters                                               │
│ C. Section "Ringkasan · alur stok"                               │
│    C1. Flow grid: 1 / 2 / 5 cols (sm/xl)                        │
│        each FLOW CARD: min-h 118px, p-3, nested metric 2-col    │
│    C2. Issued breakdown callout (full width rose panel)         │
│ D. Toggle "Tampilkan analisis lanjutan" (monthly only)          │
│ E. IF secondary open:                                           │
│    E1. Context · full scope  → grid 2/4/6                       │
│    E2. Breakdown Gudang vs Workshop → grid 1/2                  │
│    E3. Sub-category · {group} → scroll grid max-h 18rem, 1/2/3  │
│    E4. Movement category → scroll grid max-h 18rem, 1/2/3       │
└─────────────────────────────────────────────────────────────────┘
↓ page continues (not sticky)
  ReportAnalysisBand
  Period section (duplicate controls)
  Natural filter + presets + manual filters
  Table...
```

### 4.2 Flow card anatomy (primary)

Grid:

```html
div.grid.grid-cols-1.gap-2.sm:grid-cols-2.xl:grid-cols-5
```

Monthly: `flowKpiCards.slice(0, 6)` — builder only emits 5, so slice is no-op today.

**Per card chrome:**

```
┌ group relative min-h-[118px] rounded-xl border p-3 pr-12 + tone ─┐
│ [SQL] absolute right-2 top-2  opacity-0 → group-hover:opacity-100│
│ LABEL  10px extrabold uppercase tracking 0.14em white/55         │
│ VALUE  text-xl black lime-100  whitespace-normal break-all       │
│ DESC   11px white/60                                             │
│ ┌ metrics 2-col ┐                                                │
│ │ mini tiles: label 9px + value 11px black                       │
│ └───────────────┘                                                │
└──────────────────────────────────────────────────────────────────┘
```

Nested metrics use `grid-cols-2 gap-1` mini panels (`border-white/10 bg-black/20`).  
Issued card can show **4** nested metrics → dense face + **same 3–4 again** in callout below.

### 4.3 Secondary card families (when open)

| Family | Section title color | Grid | Card interaction |
| --- | --- | --- | --- |
| Global / context | white/40 | 2 / 4 / 6 | Optional click → `applyKpiFilter` if preset map exists; min-h 82px |
| Breakdown ItemType | amber | 1 / 2 | Button → `applySubKpiCardFilter`; metrics often 3-col |
| Sub-category | sky | 1 / 2 / 3 + `rc-breakdown-scroll` max-h 18rem | Button filter; shows `group=` chip |
| Movement category | emerald | 1 / 2 / 3 + scroll | Outer div + SQL + inner button filter; chips for MovementCategory + window |

**Cap on monthly render only:** sub and movement `slice(0, 12)`. Data layer may still produce more.

### 4.4 Sticky grand chips (non-monthly or no flow)

```
flex flex-wrap gap-1.5
chip: border lime, bg lime/10, label rc-kpi-label + value rc-kpi-value text-xs
max 6 chips
```

For monthly with flow: **not rendered** (avoids double totals) — good hierarchy decision already in code.

---

## 5. Design systems that **exist but are not used** by monthly flow

### 5.1 `AnalyticsKpiStrip` + `.rc-kpi-strip*`

Canonical strip:

- Section padding + border + gradient panel  
- Grid: `repeat(auto-fit, minmax(178px, 1fr))` gap space-3  
- Item min-height **136px**, structured: topline (icon/label/status) → **large value clamp 24–36px** → meta  

**Monthly flow cards do not use this component.** They inline Tailwind + `tone` strings. Result: two visual languages in one app.

### 5.2 `.rc-kpi-card` tokens

In `globals.css`:

- Forest variant: radius 18px, soft gradient, decorative circle  
- Readability guardrails: hover border raise  
- `.rc-kpi-value` tabular-nums + no ellipsis  
- `.rc-kpi-label` 10px uppercase faint  
- `.rc-scope-chip` pill for scope honesty  
- `.rc-sql-debug` demoted until hover  
- `.rc-breakdown-scroll` max-height 18rem  

Monthly flow cards **partially** adopt (`rc-sql-debug`, `rc-scope-chip`, `rc-kpi-value` on grand chips only) but primary flow faces still use raw `text-xl font-black` + tone rainbow, not `.rc-kpi-strip__value`.

---

## 6. Spacing, elevation, z-index (why sticky feels heavy)

| Element | Sticky / z | Elevation |
| --- | --- | --- |
| Shell topbar | sticky in layout | above content |
| `rc-ringkasan` | `sticky top-0 z-30` | heavy shadow `0_12px_40px`, blur, lime border |
| Table sticky headers | `z-40` header / `z-20` body | amber header bar |
| SQL button | absolute in card | only after hover |

**Issue:** Ringkasan sticky block can grow very tall when secondary is open (controls + 5 flow + issued callout + N card grids). Sticky tall panels **steal vertical workspace** and feel “non-professional” even if data is correct.

**Target:** sticky only for **thin** control bar + optional compact KPI strip (one row), not entire analysis wall.

---

## 7. Color meaning map (current)

| Color family | Used for | Problem |
| --- | --- | --- |
| Sky | Opening | OK if only opening |
| Cyan | Inventory aggregate | Same weight as opening; often zeros |
| Rose | Issued + issued callout | Correct for outflow; repeated twice |
| Violet | Purchasing net | Mixes return + GR + placeholders |
| Lime | Closing + shell accents + sticky chips | Closing should be strongest terminal; competes with shell |
| Amber | Breakdown + table headers + subtotals | Attention color overused |
| Emerald | Movement category + filter sections | Overlaps “success” meaning |
| White/10 panels | Nested metrics, chips | Dense micro-UI |

**Professional rule for redesign:**  
- Max **one accent family** for primary flow strip (neutral surface + single accent on value).  
- Semantic color only for **status** (risk, negative, incomplete), not for every step of a waterfall.

---

## 8. Typography hierarchy (current vs target)

| Role | Current flow card | Target |
| --- | --- | --- |
| Section title | 10px uppercase tracking 0.14em lime/white | Keep; one section only in Ringkasan |
| Card label | 10px extrabold uppercase white/55 | 11–12px medium, sentence case ID |
| Primary value | text-xl black | 24–32px tabular (`rc-kpi-strip__value` / `rc-kpi-value`) |
| Description | 11px white/60 | 12px muted; hide source jargon |
| Nested metric | 9–11px mono-ish | Optional expand; not 4 tiles always visible |
| SQL / field keys | 8–9px mono in callouts | Audit tab only |

---

## 9. Interaction model per card type

| Card type | Click | SQL button | Filter effect |
| --- | --- | --- | --- |
| Flow | No card-level filter (SQL only) | Yes | None on face |
| Global | If `kpiPresetByLabel` → filter | Yes | Preset |
| Breakdown / Sub / Movement | Apply group filter | Movement has SQL | Updates URL filters + refetch |

**UX tension:** secondary cards look equally “important” to flow cards (same min heights, borders, lift hover). Users cannot tell **summary vs drill-down**.

**Target:**  
- Flow = static summary (or single recon link)  
- Drill cards = denser list/table in **Analisis**, not equal-weight KPI tiles  

---

## 10. Recommended **target** card composition (for implementors)

### 10.1 Ringkasan primary strip (default)

One row, **≤6** cards, ID labels, typed format:

| # | Label | Field | Kind | Notes |
| --- | ---: | --- | --- | --- |
| 1 | Saldo Awal | OpeningAmount | currency | |
| 2 | Penerimaan | GoodsReceiveAmount | currency | not mixed purchasing net |
| 3 | Pengeluaran | IssuedTotalAmount | currency | expand Ledger/Station/Vehicle on demand |
| 4 | Retur | ReturnAmount | currency | or hide if always 0 + status |
| 5 | Saldo Akhir | ClosingAmount | currency | strongest visual weight |
| 6 | Jumlah Item | TotalItem | count | never Rp |

Context **chips** (not cards): Actual period, Acc period, Source, scope honesty.

### 10.2 Card visual recipe (target)

```
Use AnalyticsKpiStrip OR shared MetricCard:
- surface: .rc-kpi-card / strip item (no rainbow borders)
- label: .rc-kpi-label or strip label
- value: .rc-kpi-value large tabular
- helper: one line plain language
- status pill only if placeholder / partial / error
- nested metrics: disclosure <details> or “Rincian” popover
- SQL: never on Ringkasan face; Audit only
```

Grid:

```text
xl: 6 equal columns OR auto-fit minmax(160px, 1fr)
gap: 12px (space-3)
min-height: 112–128px consistent
```

### 10.3 Issued detail

**Not** a second full-width rose panel under the strip.  
Pattern:

```
Pengeluaran card
  value = IssuedTotalAmount
  [Rincian ▾] → Ledger | Station | Vehicle (3 lines or mini spark)
```

### 10.4 Secondary analysis

Move to **Analisis** workspace / tab:

- Gudang vs Workshop → 2-column comparison (not 2 huge KPI clones)  
- Product type / analysis group → DimensionExplorer table Top N + “Lihat semua”  
- Movement category → same  

Do **not** mirror as another wall of equal KPI cards under sticky Ringkasan.

### 10.5 Sticky strategy

```
sticky top-0:
  thin ControlBar (period, group, window, search, filters, chips)
  optional compact KPI strip (single row, max ~72–96px height)

NOT sticky:
  issued detail, secondary analysis, analysis band, filters panels
```

---

## 11. ASCII before / after

### Before (monthly default, secondary closed)

```
[ BANNER tall ]
[ filter chips sticky? ]
┌ RINGKASAN STICKY ──────────────────────────────────┐
│ controls period/group/window                       │
│ [Open][Inv][Issued][Purch][Close]  ← 5 rainbow     │
│ ┌ Issued breakdown full width mono SQL-ish ┐       │
│ [ Tampilkan analisis lanjutan ]                    │
└────────────────────────────────────────────────────┘
[ AnalysisBand ]
[ Period panel again ]
[ Natural filter / presets / period again ]
[ TABLE ]
```

### After (target)

```
[ Header: title + source + Export ]
┌ CONTROL sticky thin ───────────────────────────────┐
│ period · group · window · search · more · chips    │
└────────────────────────────────────────────────────┘
┌ RINGKASAN (not full analysis wall) ────────────────┐
│ SaldoAwal | Penerimaan | Pengeluaran | Retur |     │
│ SaldoAkhir | JmlItem     + chip: server terfilter  │
│ Pengeluaran [rincian optional]                     │
│ [ tab: Ringkasan | Analisis | Detail | Audit ]     │
└────────────────────────────────────────────────────┘
Detail tab → table tool
Analisis → dimension explorer
Audit → SQL
```

---

## 12. Implementation notes for agents (card-only slice)

### Safe order

1. **Do not change SQL** when only rearranging cards.  
2. Map `buildOfficialMovementFlowKpis` → dictionary primary 6 (or adapter layer).  
3. Remove issued callout; fold into issued card disclosure.  
4. Stop rendering rainbow `tone` strings; map scope → status or neutral.  
5. Prefer `AnalyticsKpiStrip` for primary; keep monthly special logic in data mapping only.  
6. Keep `monthlySecondaryOpen` until Analisis tab exists; then delete secondary rails from sticky.  
7. Tests: format kinds + monthly payload still produce same summary numbers.

### Files to touch for card composition

| File | Role |
| --- | --- |
| `ReportViewerClient.tsx` | builders + JSX rails (temporary) |
| New `MonthlyStockRingkasan.tsx` / `ReportSummaryWorkspace.tsx` | extract UI |
| `AnalyticsKpiStrip.tsx` | reuse strip |
| `globals.css` | tokens already ready |
| `metric-dictionary.md` | keep labels/kinds in sync |
| `utils/format.ts` | values only |

### Anti-patterns to delete

- Second full-width panel that reprints flow metrics  
- `font-mono` field paths on executive faces  
- Equal visual weight for drill-down product-type tiles vs open/close  
- Sticky container taller than ~30% viewport  
- English section titles mixed with Indonesian product language without system  

---

## 13. Checklist: “is this card layout professional?”

- [ ] ≤6 primary cards on default Ringkasan  
- [ ] One accent system, not 5 border colors  
- [ ] Primary numbers fully readable (tabular, no Rp on counts)  
- [ ] Nested metrics progressive, not always-on 2×2 tiles  
- [ ] No SQL on default face  
- [ ] Sticky height thin  
- [ ] Drill cards not competing with flow  
- [ ] Labels ID-first  
- [ ] Scope chip present and honest  
- [ ] Same component system as rest of RC (`rc-kpi-*`)  

---

## 14. One-liner for agents

> Monthly cards today = **5 rainbow flow tiles + optional issued duplicate panel + collapsible walls of group cards**, all inside a **tall sticky** shell; data is summary-correct but **IA is flat**. Target = **one typed strip of ≤6 accounting beats**, issued detail on demand, analysis as explorer not card spam, reuse `AnalyticsKpiStrip` / `.rc-kpi-*` tokens.

---

**End of card layout exploration.**  
Next optional docs (only if requested): table column composition, filter surface map, or side-by-side wireframe HTML mock.
