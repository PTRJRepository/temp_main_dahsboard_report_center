# Report Detail — Target Wireframe (Monthly Stock Movement)

**Date:** 2026-07-21  
**Report:** `monthly-stock-account-movement-details` / RPTIN1000015  
**Status:** design target for implementors (not current production DOM)

Open the HTML mock in a browser:

`Dokumentasi/mocks/report-detail-monthly-wireframe-2026-07-21.html`

---

## 1. Design decisions locked by exploration

| Decision | Choice |
| --- | --- |
| Primary story | Saldo Awal → Penerimaan → Pengeluaran → Retur → Saldo Akhir + Jml Item |
| Sticky | Control bar + optional thin KPI strip only |
| Tabs | Ringkasan · Analisis · Detail Data · Audit |
| Filters | One bar + chips + drawer |
| SQL | Audit tab only |
| Theme | Forest dark (tokens), not rainbow step colors |
| Table | Own workspace; toolbar = table tools only |
| Export | Menu with honesty |
| AI | Optional, sample-labeled |

---

## 2. ASCII wireframe (desktop)

```
┌─ SHELL ──────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar: breadcrumb · search · [Estate|Pabrik] · user       │
│         ├────────────────────────────────────────────────────────────┤
│         │ HEADER                                                     │
│         │ MONTHLY STOCK ACCOUNT MOVEMENT DETAILS    RPTIN1000015     │
│         │ Rekonstruksi open→in→out→close per periode                 │
│         │ [★]  [Export ▾]  [⋯]                                       │
│         ├─ CONTROL sticky ───────────────────────────────────────────┤
│         │ Periode [2026-07 ▾]  Group [Stock Analysis ▾]              │
│         │ Window [All ▾]  🔍 Search…  [Filter lanjutan (2)]  Reset   │
│         ├─ CHIPS ────────────────────────────────────────────────────┤
│         │ [DEADS ×] [Sumber: Pabrik ×]                Clear all      │
│         ├─ TABS ─────────────────────────────────────────────────────┤
│         │ [ Ringkasan ]  Analisis  Detail Data  Audit                │
│         │                                                            │
│         │ ┌ KPI strip (1 row, 6) ──────────────────────────────────┐ │
│         │ │ Saldo Awal │ Penerimaan │ Pengeluaran │ Retur │        │ │
│         │ │ Saldo Akhir │ Jumlah Item                              │ │
│         │ │ chip: Ringkasan server terfilter · bukan sampel        │ │
│         │ └────────────────────────────────────────────────────────┘ │
│         │ Pengeluaran [Rincian Ledger|Station|Vehicle ▾] optional    │
│         │ Rekonsiliasi: verified formula OR "tidak langsung cocok"   │
│         │                                                            │
│         │ (Analisis/Detail/Audit content when tab selected)          │
└─────────┴────────────────────────────────────────────────────────────┘
```

### Detail Data tab

```
│ Toolbar: Search · Group · Columns · Density · ⋮ · Fullscreen         │
│ Footer line: 12.450 / 12.450 baris · stream selesai · KPI = summary  │
│ ┌ table sticky head + sticky ItemCode/Name ────────────────────────┐ │
│ │ group headers / calm subtotals / virtual rows                    │ │
│ └──────────────────────────────────────────────────────────────────┘ │
```

### Analisis tab

```
│ Dimension explorer: table Top N by Product Type / SA / Movement      │
│ NOT a wall of equal KPI cards                                        │
│ Exception queue: dead stock, variance flags                          │
```

### Audit tab

```
│ SQL statements · gateway · metadata · request params · lineage       │
```

---

## 3. Spacing scale

Use 4 / 8 / 12 / 16 / 24 / 32.  
Control bar height ~56–64px.  
KPI card min-height ~112–128px.  
Page padding clamp 16–32.

---

## 4. Copy deck (ID)

| EN legacy | Target |
| --- | --- |
| Opening | Saldo Awal |
| Inventory (aggregate zeros) | hide or “Lainnya (placeholder)” under Audit |
| Issued total | Pengeluaran |
| Purchasing | split: Penerimaan / Retur |
| Closing | Saldo Akhir |
| summary server · bukan sample | Ringkasan server (terfilter) · bukan sampel |
| More filters | Filter lanjutan |
| Full Table | Layar penuh |
| SQL Debug | (Audit only) SQL |

---

## 5. Interaction notes

- Period change: instant commit + URL  
- Filter lanjutan: drawer, Apply once  
- KPI strip not sticky if control bar already sticky (or single combined sticky ≤ 140px)  
- Tab switch does not refetch unless needed  
- Export opens preflight  

---

## 6. HTML mock

See sibling file under `Dokumentasi/mocks/`. Static, no build step. For visual alignment only.

---

**End wireframe notes.**
