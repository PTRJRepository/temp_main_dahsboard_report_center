# 10 — Monthly Detail & Ringkasan UX (LIVE / PARTIAL)

**Pilot report:** `monthly-stock-account-movement-details` · **RPTIN1000015**  
**Komponen extract:** `MonthlyStockRingkasan.tsx` + `ReportControlBar.tsx`  
**Viewer host:** `ReportViewerClient.tsx` (masih monolit besar)

---

## 1. Ringkasan visual (MonthlyStockRingkasan)

Container sticky:
- `sticky top-0 z-30`
- border lime, blur, shadow dalam
- class `rc-ringkasan`

### Blocks
1. **Sticky grand totals** (max 6 chips) — **disembunyikan** jika monthly + flow KPI cards sudah ada (anti double totals)
2. **Hero estate view** (hanya monthly):
   - badge “Palm estate movement detail”
   - title RPTIN1000015 Movement Estate View
   - 3 mini: Actual period · Accounting period · Analysis label
3. **ReportControlBar** — single control surface
4. Flow / global / breakdown / sub / movement-category KPI sections (props-driven)
5. Secondary rails collapsible (`monthlySecondaryOpen`)

---

## 2. Control bar fields (monthly)

| Field | Binding |
|-------|---------|
| Actual period | month input → commit filters, clear accYear/Month raw |
| Analysis group | applyMonthlyAnalysisGroup |
| Movement window | applyMonthlyMovementWindow |
| Item type segments | inventory / gudang / workshop |
| More filters | open manual filter panel |

---

## 3. Primary story KPI (6)

Opening · Goods receive · Issued total · Return · Closing · Total item  

Typed via `compactMetric` / `formatValue` / field keys — **jangan** bare currency untuk period codes.

Placeholder_zero: jangan present sebagai movement proven.

---

## 4. Table (viewer — principles)

Dokumentasi penuh monolit: exploration pack Jul 2026.  
Ringkas untuk folder ini:

- Detail table di bawah ringkasan  
- Virtualization untuk stream besar  
- Subtotal calm  
- SQL debug non-primary  
- Export honesty 3 layer (lihat `04-TABLE-AND-DETAIL-DESIGN.md`)

---

## 5. Relationship ke procurement deck

| Deck (module) | Monthly detail |
|---------------|----------------|
| Net flow ad-hoc receive−issue+return | Closing formula accounting-grade |
| Period calendar UI | Actual + Accounting dual labels |
| Top usage items | Issue columns / filters di detail |
| Movement window aging | Movement window + analysis group di control bar |

User path: KPI deck “Total Usage” → `pengeluaran-barang` **atau** process map monthly → RPTIN full story.

---

## 6. Status extract A→B→C

| Step | Status |
|------|--------|
| A unify period/filters | PARTIAL (ControlBar exists; monolit still has other surfaces) |
| B cap ≤6 primary | PARTIAL (contract clear; enforce all profiles) |
| C extract workspaces/tabs | PARTIAL (Ringkasan extracted; full workspaces not done) |

---

**Next:** `11-CHANGELOG-UI-SNAPSHOT.md`
