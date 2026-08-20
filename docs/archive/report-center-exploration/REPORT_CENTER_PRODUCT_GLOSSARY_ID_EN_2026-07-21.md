# Report Center — Product Glossary (ID / EN / Code)

**Date:** 2026-07-21  
**Use:** UI copy + agent naming consistency. Prefer **ID in UI**; EN/code in Audit/tooltips.

---

## Navigation / chrome

| ID (UI) | EN | Code / route |
| --- | --- | --- |
| Pusat laporan | Report Center | `/report-center` |
| Inventory Live | Inventory live catalog | `/report-center/inventory` |
| Sumber data | Report source | `source=estate\|pabrik` |
| Estate / Kebun | Estate | SERVER_PROFILE_2 / db_ptrj |
| Pabrik | Mill | SERVER_PROFILE_3 / db_ptrj_mill |
| Favorit | Favorites | reportStore.favorites |
| Terakhir dibuka | Recent | reportStore.recent |
| Filter lanjutan | Advanced filters | drawer |
| Filter aktif | Active filters | chips |
| Hapus semua filter | Clear all | resetFilters |

## Workspaces

| ID | EN | Role |
| --- | --- | --- |
| Ringkasan | Summary | ≤6 KPIs |
| Analisis | Analysis | dimensions / exceptions |
| Detail Data | Data detail | table |
| Audit Data | Audit | SQL / metadata |

## Monthly movement metrics

| ID | EN (legacy UI) | Field |
| --- | --- | --- |
| Saldo Awal | Opening | OpeningAmount |
| Penerimaan | Goods receive / Purchasing GR | GoodsReceiveAmount |
| Pengeluaran | Issued total | IssuedTotalAmount |
| Ledger | Ledger | LedgerAmount |
| Stasiun | Station | IssuedStationAmount |
| Kendaraan | Vehicle | IssuedVehicleAmount |
| Retur | Return | ReturnAmount |
| Saldo Akhir | Closing | ClosingAmount |
| Jumlah Item | Total items | TotalItem |
| Periode aktual | Actual period | period / ActualPeriod |
| Periode akuntansi | Accounting period | AccYear/AccMonth |
| Analisis stok (master) | Stock analysis code | DEADS/MEMOV/SLMOV |
| Kategori mutasi aktual | Movement category | Fast/Moving/Slow/Dead/Stale |
| Jendela mutasi | Movement window | movementWindow |

## Scope honesty phrases

| ID | When to use |
| --- | --- |
| Ringkasan server (terfilter) | KPI from SQL summary |
| Baris termuat | Table loaded/stream rows |
| Sampel AI | AI compact payload |
| Pratinjau PDF (bukan laporan penuh) | PDF export |
| Hingga N baris (batas sistem) | CSV/Excel ceiling |

## Status

| ID | EN |
| --- | --- |
| Live | live |
| Pratinjau | preview |
| Mapping DB | mapping_db |
| Perlu validasi | need_validation |
| Direncanakan | planned |
| Ditahan | hold |

## Avoid in executive UI

- Raw SQL table names as primary labels  
- `full scope` without definition  
- `Inventory` aggregate of placeholder zeros as hero KPI  
- English-only section titles on CEO path  

---

**End glossary.**
