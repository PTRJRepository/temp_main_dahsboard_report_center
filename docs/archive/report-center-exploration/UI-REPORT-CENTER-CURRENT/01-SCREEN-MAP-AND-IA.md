# 01 — Screen Map & Information Architecture

## 1. Entry & routing (LIVE)

| Route | Peran | Catatan |
|-------|--------|---------|
| `/` atau `/report-center` | Report Center home / modul | Forest shell |
| `/report-center/procurement?source=estate\|pabrik` | **Procurement control tower** | KPI deck + overview + catalog area |
| `/report-center/inventory?...` | Redirect / alias ke inventory dalam procurement | Prefer tetap di procurement path |
| `/report-center/inventory/[report]` | Report detail viewer | Monolit `ReportViewerClient` |
| `/login?returnTo=...` | Auth gate | Production memblok akses anonim |

**Source switch:** Estate (`db_ptrj` / SP2) vs Pabrik (`db_ptrj_mill` / SP3) di hero workspace.

## 2. Hirarki layar Procurement (atas → bawah)

```
┌──────────────────────────────────────────────────────────┐
│  A. Hero workspace                                       │
│     Control tower title · source estate/pabrik · counts  │
├──────────────────────────────────────────────────────────┤
│  B. Procurement Command Deck (KPI)  ★                    │
│     Filter bar · Master valuation · Hero · Rails · Top5  │
├──────────────────────────────────────────────────────────┤
│  C. Inventory Overview                                   │
│     Movement composition · exceptions · period sync      │
├──────────────────────────────────────────────────────────┤
│  D. Area kerja / tabs scope                              │
│     Semua | Gudang | Workshop | Ordering                 │
├──────────────────────────────────────────────────────────┤
│  E. Catalog / report cards (InventoryReportsClient)      │
│     Stage flow · search · open report detail             │
└──────────────────────────────────────────────────────────┘
         │ klik report
         ▼
┌──────────────────────────────────────────────────────────┐
│  F. Report Detail Viewer                                 │
│     Context → Controls → KPI ≤6 → Insight → Table → Audit│
└──────────────────────────────────────────────────────────┘
```

## 3. Dual monolith (arsitektur UI)

| Monolith | File | ~Lines | Tanggung jawab |
|----------|------|--------|----------------|
| Catalog | `InventoryReportsClient.tsx` | ~2.5k | daftar report, stage, search |
| Viewer | `ReportViewerClient.tsx` | ~6k+ | detail, filter, table, export, AI |

**Shell components (shared):**
- `ProcurementModuleWorkspace.tsx` — orkestrasi halaman procurement  
- `ProcurementKpiStrip.tsx` — command deck KPI  
- `InventoryOverview.tsx` — analytics overview movement  
- `ReportControlBar.tsx` — control bar di detail/monthly  
- `MonthlyStockRingkasan.tsx` — ringkasan monthly RPTIN1000015  
- `AnalyticsKpiStrip.tsx` — strip KPI generik detail (`.rc-kpi-strip`)

## 4. Scope model (ItemType)

| UI label | ItemType | Arti |
|----------|----------|------|
| Inventory 1+4 | (kosong / inventory) | Gudang + Workshop **default master** |
| Gudang | `gudang` / `1` | Stock regular |
| Workshop/Mesin | `workshop` / `4` | Sparepart / job stock |

**Guardrail:** KPI valuasi master = full 1+4 kecuali user menyempitkan scope.

## 5. Process stages (catalog IA)

Catalog mengelompokkan report mirip alur:

`request → receive → movement → usage → valuation → audit`

Ini **taxonomy UI**, bisa beda dari `group` di `config.ts` (executive/transaction/purchasing/…).  
Saat ubah catalog, petakan kedua taxonomy (lihat registry snapshot).

## 6. Audience & jobs-to-be-done

| Persona | Job di layar |
|---------|----------------|
| CEO | 5 detik: stock, net flow, usage, risk |
| Gudang | valuasi, receive, issue, transfer, opname |
| Workshop | IT4, vehicle, sparepart usage |
| Finance | monthly movement, closing, receive cost honesty |
| Engineer | SQL hover, partial live, gateway |

## 7. Apa yang “baru” vs pack Jul 2026

| Area | Jul 2026 exploration | Status UI 2026-07-22 (kode) |
|------|----------------------|-----------------------------|
| Detail monthly IA | PRD + extract A→B→C | Sebagian LIVE (`ReportControlBar`, `MonthlyStockRingkasan`) |
| Procurement KPI deck | Plan wow | **LIVE partial-advanced**: usage + return fetch, net flow, top items, movement cards |
| Tabs Issue Analysis full | Planned | **Belum** full tab system — masih section grids |
| Composite command-deck API | Planned | **Belum** — multi parallel fetch client |

---

**Next:** `02-KPI-COMMAND-DECK.md`
