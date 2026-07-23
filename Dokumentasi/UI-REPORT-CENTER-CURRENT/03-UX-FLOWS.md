# 03 — UX Flows

## Flow A — CEO 30 detik (happy path)

```
Login
  → /report-center
  → Procurement (sidebar / module)
  → Pilih source Estate | Pabrik
  → Baca Master Valuation (kiri)
  → Baca Net Flow + Total Usage (hero kanan)
  → Scan GR / PR out / PO out
  → Scan Movement KPI
  → Lihat Top 5 item usage
  → Klik 1 top item / Total Usage → detail issue
  → (opsional) buka monthly movement untuk closing
```

**Success:** tanpa buka 10 report, user tahu stok, arus, pemakaian, outstanding.

## Flow B — Analis gudang

```
Procurement → scope Gudang
  → valuasi gudang + on hand/hold
  → Inventory Overview movement composition
  → klik segment Dead/Slow
  → report all-stock-movement-analysis filtered
  → export CSV bila perlu (detail)
```

## Flow C — Workshop

```
Tab Workshop | Item Scope Workshop
  → valuasi IT4
  → vehicle-running / pengeluaran workshop
  → usage top items sparepart
```

## Flow D — Ordering (PR/PO/GR)

```
Area Ordering
  → KPI: GR value, PR/PO outstanding
  → catalog: purchase-request / PO history / goods receive
  → detail filters period
```

## Flow E — Filter ownership (penting)

```
moduleFilters (Workspace state)
    ├── ProcurementKpiStrip (read/write)
    └── InventoryOverview (period, movementWindow, itemType partial)
```

Ganti period di KPI bar → overview ikut (via props).  
Hindari **dua period control** yang tidak sinkron (anti-redundancy rule detail redesign).

## Flow F — Drill-down contract

Setiap KPI card = `Link` dengan `hrefWithFilters`:
- path report detail
- query: period, location, itemType, groupBy, movementWindow, scope codes

User expectation: **filter tidak hilang** saat masuk detail.

## Flow G — Partial failure

```
1..n summary fetch
  → some reject
  → badge "Live sebagian"
  → missing numbers → 0 / empty top strip
  → jangan blank full page
```

## Flow H — Auth

```
Unauthed /report-center/procurement
  → 302 /login?returnTo=...
  → after login → returnTo
```

Dokumentasi visual/screenshot butuh session login manusia.

## Microcopy patterns (LIVE)

| Area | Tone |
|------|------|
| Eyebrow | uppercase tracking wide forest accent |
| Title | font-black tracking tight |
| Helper | text-muted 1–2 baris |
| Badge live | pill forest border |
| Source footer | 10px faint + arrow |

## Anti-patterns UX (jangan diulang)

1. Period control 3× di detail  
2. KPI issue double tanpa sync (deck vs overview)  
3. Label AccCode = “GL”  
4. Menyamakan movement window dengan bulan usage  
5. PDF/export disamakan “full data” tanpa honesty layer  

---

**Next:** `04-TABLE-AND-DETAIL-DESIGN.md`
