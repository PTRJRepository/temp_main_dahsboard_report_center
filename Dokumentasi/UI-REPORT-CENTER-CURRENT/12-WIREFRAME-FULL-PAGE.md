# 12 — Full-Page Wireframe (ASCII)

**Route:** `/report-center/procurement?source=estate|pabrik`  
**Status:** mencerminkan layout LIVE (bukan mock ideal murni)

---

## Desktop (≥1280px)

```
┌─ SHELL (sidebar forest + topbar) ─────────────────────────────────────┐
│ Sidebar: Dashboard · Procurement · …                                  │
│ Main content max-w-screen-2xl, gap-y ~5, px-4..8                      │
│                                                                        │
│ ┌─ A. HERO WORKSPACE ───────────────────────────────────────────────┐ │
│ │ Breadcrumb: Dashboard / Procurement                               │ │
│ │ Badge: Procurement control tower                                  │ │
│ │ H1: Procurement global: Inventory dan proses…                     │ │
│ │ CTA: [Dashboard] [Buka inventory live]                            │ │
│ │                          ┌─ Active source ─────────────────────┐  │ │
│ │                          │ Estate | Pabrik                     │  │ │
│ │                          │ live · stock · process counts       │  │ │
│ │                          └─────────────────────────────────────┘  │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ ┌─ B. KPI COMMAND DECK ─────────────────────────────────────────────┐ │
│ │ Header: title + Live badge + period chips                         │ │
│ │ Filters: [Period][MC window][Group][Code][ItemType][Lokasi][Reset]│ │
│ │ Active chips…                                                     │ │
│ │ ┌ Master Valuation ──┐  ┌ 1.Hero Net Flow | Total Usage ───────┐ │ │
│ │ │ Rp BIG             │  │ 2.Valuasi Gudang | Workshop          │ │ │
│ │ │ bar Gudang/WS      │  │ 3.GR | PR out | PO out               │ │ │
│ │ └────────────────────┘  │ 4.Movement event|qty|amount          │ │ │
│ │                         └──────────────────────────────────────┘ │ │
│ │ ┌ Top item usage #1..#5 ──────────────────────── [Buka issue] ─┐ │ │
│ │ └──────────────────────────────────────────────────────────────┘ │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ ┌─ C. INVENTORY OVERVIEW ───────────────────────────────────────────┐ │
│ │ Title + note “KPI di deck atas”   │ Exception queue (dead/slow)   │ │
│ │ Scope amber: period·MC + thresholds Fast/Slow/Moving + refresh    │ │
│ │ Movement composition bars         │ Fast actions drill buttons    │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ ┌─ D. AREA KERJA ───────────────────────────────────────────────────┐ │
│ │ Title Inventory·Semua|Gudang|Workshop|Ordering  [tabs]            │ │
│ │ body: InventoryReportsClient OR process report cards              │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ ┌─ E. PROCESS MAP ──────────────────────┬─ Cara baca module ────────┐ │
│ │ 1 PR 2 PO 3 Receive 4 Stock 5 Issue 6 Workshop                    │ │
│ └───────────────────────────────────────┴───────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Report detail (monthly pilot)

```
┌ Context: title · source · RPTIN1000015 ──────────── [export/AI] ─┐
├ Sticky Ringkasan (MonthlyStockRingkasan) ────────────────────────┤
│ [optional grand chips]                                           │
│ Hero estate view: Actual | Accounting | Analysis                 │
│ ReportControlBar: period · group · MC · itemType · more          │
│ Flow KPI ≤6 · secondary collapsible                              │
├ Insight (opsional) ──────────────────────────────────────────────┤
├ Table toolbar · filters applied chips ───────────────────────────┤
│ virtualized rows…                                                │
├ Advanced / Audit / SQL hover ────────────────────────────────────┤
└──────────────────────────────────────────────────────────────────┘
```

---

## Mobile (sm)

- Hero source stack vertical  
- KPI master full width, then hero cards 1-col → 2-col  
- Top items 1-col  
- Overview exception below title  
- Tabs area kerja wrap  
- Process map 1-col  

---

## Z-index / sticky notes

| Layer | z |
|-------|---|
| Monthly ringkasan sticky | z-30 |
| Sidebar / topbar shell | shell defaults |
| Deck itself | not sticky (scrolls with page) |

---

**Next:** `13-FILTER-MATRIX.md`
