# 09 — Catalog Area Kerja & Process Map (LIVE)

## 1. Area kerja (tabs)

**Parent:** `ProcurementModuleWorkspace.tsx`  
Tabs (Link, bukan client-only tab state):

| Tab UI | Group id | Isi body |
|--------|----------|----------|
| Semua | `inventory` | `InventoryReportsClient` embedded, no itemType force |
| Gudang | `gudang` | catalog embedded `itemType=gudang` |
| Workshop | `workshop` | catalog embedded `itemType=workshop` |
| Ordering | `process` | **card grid** dari `procurement-workspace` process reports (bukan full catalog) |

Active tab: forest primary fill, text dark.

### Ordering cards (process group)

Tiap card min-height ~255px:
- icon FileText
- priority + cadence pills
- code / metricLabel
- title, purpose
- signal box
- owner + “Buka report”

Reports process (dari workspace config):
1. purchase-request-inventory  
2. purchase-order-history  
3. goods-receiving-receipt-activity  
4. supplier-purchasing-performance  
5. monthly-stock-account-movement-details  

---

## 2. InventoryReportsClient (embedded catalog)

Saat non-process tabs:
- `embedded`
- `fixedSource={source}`
- optional itemType dari tab

Catalog menampilkan inventory live reports dengan **stage taxonomy** (request→receive→movement→usage→valuation→audit) — lihat file monolit untuk search/tags.

**Suspense fallback:** “Memuat inventory catalog…”

---

## 3. Procurement process map

Section bawah workspace:

**Title:** Alur dari request sampai stock terpakai  

Stages (6) dari `processStages` di `procurement-workspace.ts`:

| # | Label | Report |
|---|-------|--------|
| 1 | PR | purchase-request-inventory |
| 2 | PO | purchase-order-history |
| 3 | Receive | goods-receiving-receipt-activity |
| 4 | Stock | stok-gudang |
| 5 | Issue | pengeluaran-barang |
| 6 | Workshop | vehicle-running-workshop |

Card stage: nomor, label, description, reportTitle, hover lift.

### Aside “Cara baca module”
- Mulai dari KPI, lalu drill down  
- Inventory = master 1+4; Gudang/Workshop isolasi  
- Process = PR/PO/supplier/receiving/monthly recon  

---

## 4. KPI links from workspace

```ts
stock   → asset-stock-valuasi-listing
receive → goods-receiving-receipt-activity
process → purchase-request-inventory
workshop→ asset-stock-valuasi-listing?itemType=workshop
movement→ all-stock-movement-analysis (MovementCategory + window)
usage   → pengeluaran-barang   // required by strip
return  → return-barang        // required by strip
```

Pastikan parent `kpiLinks` selalu menyediakan key yang diminta `ProcurementKpiStrip` props type.

---

## 5. Hero workspace (atas sekali)

- Breadcrumb Dashboard / Procurement  
- Title control tower  
- Source toggle Estate | Pabrik  
- Counts: live report · stock view · process  

---

**Next:** `10-MONTHLY-DETAIL-RINGKASAN.md`
