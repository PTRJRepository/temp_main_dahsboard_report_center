# 04 — Table Design & Report Detail UX

## 1. Catalog (pre-table)

**File:** `InventoryReportsClient.tsx`  
Bukan spreadsheet dulu — **card/list report** dengan:
- stage flow (usage, valuation, …)
- priority tone
- search / semantic tags
- open → detail

## 2. Report Detail — target hierarchy (LIVE direction)

Dari redesign Jul 2026 + extract components:

```
Context (judul, source, period label)
  → Controls SINGLE surface (ReportControlBar)
  → Summary KPI ≤ 6 typed (AnalyticsKpiStrip / MonthlyStockRingkasan)
  → Insight band (opsional)
  → Detail table (virtualized when large)
  → Advanced / Audit / SQL hover-only
```

**Pilot report:** `monthly-stock-account-movement-details` / RPTIN1000015  
**Komponen:**
- `ReportControlBar` — period month input, analysis group, movement window, item type segments 1+4/gudang/workshop, more filters  
- `MonthlyStockRingkasan` — ringkasan flow KPI  
- `AnalyticsKpiStrip` — generik strip `.rc-kpi-strip`

## 3. ReportControlBar (desain kontrol)

| Control | Label | Input |
|---------|-------|-------|
| Actual period | Actual period | `<input type="month">` |
| Analysis group | Analysis group | select field/label |
| Movement period | Movement period | window select |
| Item type | segments | 1+4 · Gudang · Workshop |
| More filters | button | buka panel filter lanjutan |

Visual: compact `h-8`, border white/10, active segment lime inset.

## 4. Primary KPI monthly (kontrak)

Jangan diubah tanpa bukti SQL/test:

1. OpeningAmount  
2. GoodsReceiveAmount  
3. IssuedTotalAmount  
4. ReturnAmount  
5. ClosingAmount  
6. TotalItem  

Hormati `placeholder_zero`. Secondary product-type walls = Advanced.

## 5. Table UX principles

| Prinsip | Implementasi arah |
|---------|-------------------|
| Density | dense enterprise, not marketing whitespace |
| Numbers | `format.ts` / `formatMetric` — kind-aware (currency vs period vs qty) |
| Sticky | header sticky; grand total careful when flow KPI ada |
| Subtotals | calm row class `rc-subtotal-row` |
| Filters | satu surface + chips applied; jangan 6 bar filter |
| Virtualization | large monthly streams |
| SQL debug | hover-only / group, bukan pill amber primer di KPI face |
| Export honesty | CSV/Excel ceilings · PDF preview · AI sample labeled |

## 6. Export / AI scope (3 layer — wajib di UI copy)

| Layer | Isi | Label jujur |
|-------|-----|-------------|
| 1 | `payload.summary` server terfilter | Ringkasan server |
| 2 | baris stream / window tabel | Baris termuat |
| 3 | AI compact ~50×40 | Sampel AI |

| Channel | Reality |
|---------|---------|
| CSV | server limitAll (monthly ≤100k, lain ≤20k) |
| Excel | client fetch-all + memory warn |
| PDF | ≤34×7 preview |
| AI | sample chips |

## 7. Inventory Overview (bukan table penuh)

**File:** `InventoryOverview.tsx`  
- Composition segments movement (clickable)  
- Exception list dead/slow/stale  
- Period + movement definition controls (bisa di-hide saat embedded)  
- Membuka report filtered, bukan render 10k rows di overview  

## 8. Accessibility targets

- Focus-visible ring forest green  
- Tab order: filters → KPI links → table  
- Don’t rely on color alone for net flow (+/− text)  
- Loading: `...` / skeleton, not layout collapse  

## 9. Performance budgets (UI)

| Surface | Budget |
|---------|--------|
| KPI deck first paint | skeleton immediate |
| 8 parallel summary | partial OK |
| Detail 10k rows | virtualize; memory caution Excel |
| Avoid | re-fetch all deck on every keystroke scope (debounce planned) |

---

**Next:** `05-DESIGN-SYSTEM-TOKENS.md`

## 6. 2026-07-23 Detail + table sync

- **LIVE:** report detail uses state-first header: loaded rows, period, analysis group, and trust state remain visible after title.
- **LIVE:** controls split into primary scope controls and secondary AI/SQL/manual filter surfaces. AbortController, 500-row first paint, stream status, fullscreen table, and virtualizer remain intact.
- **LIVE:** table toolbar keeps search/group/density/export/fullscreen primary, moves secondary actions into **Lainnya**, adds `aria-sort`, dark forest chips, and minimum 11px operational type.
- **PLANNED:** visual QA screenshots at 320/375/414/768 still need manual capture.

