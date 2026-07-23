# 05 — Design System & Tokens (Report Center)

## 1. Theme shell

Kelas root: `report-center-dark` + `report-center-forest`  
File: `Dashboard_Utama/app/globals.css`

### Brand / forest

| Token / role | Arah warna | Penggunaan |
|--------------|------------|------------|
| Navy deep | `#071426` / near-black green | page depth |
| Forest primary | `#167A3A` / lime accents | CTA, active, rings |
| Accent lime | `rgba(155,226,61,…)` | badges, bars |
| Gold/amber | workshop, warning shares | workshop bar, net− |
| Surface glass | `white/4–8%` borders | cards |
| Text | `--rc-text` / muted / faint | hierarchy |

CSS variables (contoh dipakai di komponen):  
`--rc-forest-border`, `--rc-forest-border-strong`, `--rc-forest-primary`, `--rc-forest-accent`, `--rc-text`, `--rc-text-muted`, `--rc-text-faint`, `--rc-border`, `--rc-success`, `--rc-warning`, `--rc-danger`, `--rc-info`

## 2. Component classes

| Class | Role |
|-------|------|
| `.rc-panel` / `.rc-panel-active` | section surfaces |
| `.rc-kpi-card` | standalone KPI tile (home/legacy) |
| `.rc-kpi-strip` + `__item/__value/__label` | detail report KPI strip |
| `.rc-kpi-label` / `.rc-kpi-value` | monthly compact metrics |
| `.rc-subtotal-row` | calm table subtotals |
| `.rc-sql-debug` | non-primary SQL chrome |

## 3. KPI deck local patterns (ProcurementKpiStrip)

- Section radius `rounded-[32px]`  
- Card radius `rounded-[22px]` / master `rounded-[28px]`  
- Grid secondary: `sm:2` `xl:3`  
- Min heights: card ~150px, master ~222px  
- Motion: hover translate + border strengthen only (no gimmick)  
- Typography: `font-black`, tight tracking on values  

### Title tone pills
Per-card id maps to pill border/bg (emerald, teal, sky, amber, rose, cyan, …) — **systemized per id**, not random rainbow walls on one row of equal weight.

## 4. Icons

Lucide-react: Package, Truck, ClipboardList, CircleDollarSign, Wrench, Layers3, Gauge, TrendingUp/Down, ArrowRight, …

## 5. Number formatting (deck)

| Kind | Helper in strip |
|------|-----------------|
| Count | `formatNumber` id-ID 0 dec |
| Qty | `formatQuantity` 0–2 dec |
| Money | `formatCurrency` **IDR 4 decimals** (deck local) |
| Percent | `formatPercent` 1 dec |

**Note:** Detail reports prefer `utils/format.ts` / `formatMetric` kind inference — keep deck consistent *within* strip; long-term unify to `format.ts` to avoid dual currency styles.

## 6. Do / Don’t

**Do**
- Forest depth + glass cards  
- One primary story per viewport section  
- Typed metrics  

**Don’t**
- Generic SaaS purple gradients  
- Equal-weight 20 KPI grid  
- Amber SQL pills as primary KPI face  
- CUD DILARANG badge (product preference: locked UI, no badge)  

---

**Next:** `06-LONG-HORIZON-ROADMAP.md`

## 5. 2026-07-23 Token sync

- **LIVE:** forest/mineral tokens remain source of truth: `--rc-forest-*`, `--rc-chart-*`, `--rc-focus`.
- **LIVE:** role tokens added for workbench header, command rail, data surface, and focus ring; no parallel theme system or dependency added.
- **LIVE:** chart semantics use stable named colors; text stays on text tokens, not series colors.
- **PLANNED:** broader raw-color cleanup outside touched report-center surfaces remains deferred.

