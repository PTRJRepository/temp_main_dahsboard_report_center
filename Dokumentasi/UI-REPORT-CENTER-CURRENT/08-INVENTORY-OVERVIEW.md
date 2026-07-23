# 08 — Inventory Overview Panel (LIVE)

**Komponen:** `Dashboard_Utama/components/report-center/InventoryOverview.tsx`  
**Posisi:** di bawah KPI Command Deck, di atas Area Kerja  
**Status:** LIVE

---

## 1. Peran di IA

Overview **bukan** pengganti KPI deck. Copy di UI:

> KPI valuasi/item/quantity/movement ada di Procurement command deck di atas… Panel ini fokus **movement mix + exception queue**.

Tujuan: keputusan inventory dulu (Fast/Slow/Dead), baru buka report detail.

---

## 2. Layout

```
┌──────────────────────────────┬────────────────────┐
│ Header + copy                │ ExceptionQueue     │
│ Scope box (amber)            │ (dead/slow/stale)  │
│ Status pills                 │                    │
├──────────────────────────────┴────────────────────┤
│ MovementComposition (segments) │ Fast actions     │
└───────────────────────────────────────────────────┘
```

Grid: `xl:grid-cols-[1fr_390px]` dua kali (atas & bawah).

---

## 3. Data source

- Report: `all-stock-movement-analysis`
- `groupBy=MovementCategory`
- Params: `source`, `period`, `movementWindow`, optional `itemType`
- **Movement definition thresholds** (user-tunable):
  - Fast >= N
  - Slow = N
  - Moving min / max
- Bukan dari preview rows lokasi — full-scope API grouping.

---

## 4. Embedded mode (di Procurement)

Parent set `hideScopeControls`:
- Period & MC window **tidak** ditampilkan ganda (diambil dari module filters)
- Box amber tetap menampilkan: `period · MC {window}` + refresh
- Threshold Fast/Slow/Moving **tetap editable** di overview
- Refresh button (spin saat loading)

---

## 5. UI blocks

| Block | Isi |
|-------|-----|
| Title | “Lihat keputusan inventory dulu, baru buka report.” |
| Scope box | amber border kuat; MC window helper: *All/1/3/6/12 untuk Fast-Moving dll. Bukan valuasi stok.* |
| Status pills | source, period, Generated time / Refreshing / API error / Empty |
| ExceptionQueue | top dead/slow/stale sorted by value; severity critical/warning/watch |
| MovementComposition | segments max 6, share %, click → open report + movementCategory |
| Fast actions | Movement analysis · Dead stock focus · Slow moving focus |

---

## 6. State honesty

| State | UI |
|-------|-----|
| loading first | loading flags on children |
| stale refresh | “Refreshing, previous data retained” |
| error | “API error, context retained” + retry |
| empty | “Empty movement scope” |
| partial | metadata windowed → “partial detail, full KPI” |

---

## 7. Drill-down

`openReport` → `/report-center/inventory/{reportId}?source&period&itemType&movementWindow&groupBy&movementCategory…`

Default report = movement analysis.

---

**Next:** `09-CATALOG-AND-PROCESS-MAP.md`
