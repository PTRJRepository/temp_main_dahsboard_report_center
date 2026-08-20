# Report Center — Detail Semua Report (Per-Modul)

> Dokumentasi LENGKAP semua report di Report Center. 19 report `live` (modul **Procurement / Inventory**, DB `db_ptrj` estate / `db_ptrj_mill` pabrik) + module katalog (Financial / HR / Budget, `available:false`). SQL verbatim dari `Dashboard_Utama/app/api/reports/inventory/route.ts`, metadata dari `lib/reports/inventory/config.ts`.
> Lihat juga: `Report-Center-Overview.md` (arsitektur), `Report-Center-Pabrik.md` (SQL pabrik + WS_JOBSTOCK/MTHEND).

## Daftar Modul
| Modul | available | Report | DB |
|-------|-----------|--------|-----|
| **Procurement** (Inventory) | ✅ | 19 live + 1 hold | db_ptrj / db_ptrj_mill |
| Financial | ❌ katalog | 16 (preview) | — |
| Human Resources | ❌ katalog | 94 (preview) | — |
| Budget | ❌ katalog | 12 (preview) | — |

Semua report di bawah menarget `db_ptrj_mill` saat `?source=pabrik`, `db_ptrj` saat `?source=estate` (default).

---

# MODUL PROCUREMENT — 19 Report Live

## Group: Executive
### INV-01 `stok-gudang` — Posisi Stok & Nilai Gudang
- **Handler** `stockSummary` (`route.ts:1012`). **sourceTables**: IN_ITEM, IN_PRODCAT, IN_STOCKISSUE/LN, WS_JOBSTOCK.
- **SQL inti**: `SELECT ... QuantityClosing = (QtyOnHand+QtyOnHold+QtyOnOrder), NilaiStok = QuantityClosing*AverageCost FROM IN_ITEM` + issue usage via `stockIssueUsageApply` (ItemType 4 → WS_JOBSTOCK TransType='1').
- **Chart**: stock-value-by-warehouse (bar, LocCode), stock-value-by-category (donut), top-stock-value-items (ranking), stock-quality-flags (quality).

### RPTIN1000011 `asset-stock-valuasi-listing` — Asset Stock Valuasi Listing
- **Handler** `assetStockValuationListing` (`route.ts:1089`). **sourceTables**: IN_ITEM, IN_MTHENDITEM, IN_PRODTYPE.
- **SQL**: `useMonthEnd` → `AmountItem = IN_MTHENDITEM.Qty * AverageCost`; else `TotalAssetAmount = SUM((QtyOnHand+QtyOnHold)*AverageCost) FROM IN_ITEM WHERE ItemType IN (1,4)`.
- **MovementSource**: ItemType 4 = WS_JOBSTOCK, ItemType 1 = STOCK_ISSUE_REGULAR.

## Group: Master
### `kartu-stok` — Stock Card / Kualitas Master Item
- **Handler** `stockCard` (`route.ts:1664`). **sourceTables**: IN_ITEM, IN_ITEMCODE, IN_PRODCAT, IN_STOCKISSUELN, IN_STOCKISSUE, WS_JOBSTOCK.
- Workshop issue via `stockIssueUsageApply`. Tidak ada scan WS_JOBSTOCK mandiri.

## Group: Aging
### INV-ALL `all-stock-movement-analysis` — ALL Stock Movement Analysis
- **Handler** `allStockMovementAnalysis` (`route.ts:1272`). **sourceTables**: IN_ITEM, IN_MTHENDITEM, IN_PRODTYPE, IN_STOCKISSUE/LN, WS_JOBSTOCK.
- **SQL**: pivots tiap item, tags `MovementSource = 'WS_JOBSTOCK'` saat ItemType 4. Workshop block (`route.ts:1343`): `FROM WS_JOBSTOCK s WHERE TransType='1' AND ItemType='4'`.
- Special viewer profile `MOVEMENT_ANALYSIS_REPORT_IDS` (rowDetail 'movement', presets per MovementCategory).

### INV-STOCK-AGING `item-movement-update-tracking` — Stock Aging & Movement Health
- **Handler** `itemUpdateAge` (`route.ts:2840`). **sourceTables**: IN_ITEM, IN_STOCKISSUE/LN, WS_JOBSTOCK.
- WS_JOBSTOCK via `stockIssueUsageApply` (TransType='1', ItemType 4). Special profile `STOCK_AGING_REPORT_IDS`.

### INV-12 `item-stale-update` — Item Tidak Update & Aging
- **Handler** `itemUpdateAge` (sama, `route.ts:2840`). **sourceTables**: IN_ITEM, IN_STOCKISSUE/LN, WS_JOBSTOCK (`route.ts:2972`).
- WS_JOBSTOCK TransType='1', ItemType 4. Special profile `STOCK_AGING_REPORT_IDS`.

## Group: Transaction
### INV-03 `mutasi-barang` — Movement Stock
- **Handler** `stockMovement` (`route.ts:1757`). **sourceTables**: IN_STOCKISSUE/LN, WS_JOBSTOCK, IN_STOCKRECEIVE/LN, PU_GOODSRCVLN, IN_STOCKTRANSFER/LN, IN_ITEM.
- **reportRows** (5 UNION ALL): Keluar (IN_STOCKISSUELN, non-workshop), Keluar Workshop (WS_JOBSTOCK TransType='1' ItemType 4), Masuk (IN_STOCKRECEIVELN), Masuk Good Receipt (PU_GOODSRCVLN), Transfer (IN_STOCKTRANSFERLN). Kolom: `JenisMutasi, Dokumen, Tanggal, Gudang, KodeBarang, NamaBarang, Qty, Amount, AccCode, BlkCode, VehCode`.
- **summary** CTE `keluar` (IN_STOCKISSUE + WS_JOBSTOCK TransType='1'). **chart** CTE `MovementRaw` (5 branch) → per-bulan Keluar/Masuk.
- WS_JOBSTOCK date = `COALESCE(NULLIF(PostDate,'1900-01-01'),TransDate)`; amount = `COALESCE(Amount,PriceAmount,Qty*Price,0)`; VehCode/BlkCode fallback dari WS_JOB.

### INV-04 `pengeluaran-barang` — Pengeluaran Barang Operasional
- **Handler** `stockIssue` (`route.ts:2251`). **sourceTables**: IN_STOCKISSUE/LN, WS_JOBSTOCK, WS_JOB, IN_STOCKISSUELN_ACC.
- **CTE issue_rows**: IN_STOCKISSUELN (non-workshop) UNION WS_JOBSTOCK (`route.ts:2294`, `TransType='1'`, ItemType 4, `SourceTable='WS_JOBSTOCK'`). Kolom: `Dokumen, Tanggal, KodeBarang, NamaBarang, Kategori, Qty, Cost, Amount, VehCode, AccCode, BlkCode, Remark, Status, SourceTable`. summary hitung `BarisWorkshop`.

### INV-05 `penerimaan-barang` — Goods Receiving & Receipt Activity
- **Handler** `stockReceive` (`route.ts:2092`). **sourceTables**: PU_GOODSRCV/LN, PU_POLN, PU_SUPPLIER, IN_ITEM, IN_PRODTYPE. **Tidak** sentuh WS_JOBSTOCK.
- **SQL**: `TotalAmount = ReceiveQty * PU_POLN.Cost`. Kolom luas: GoodsReceiveID, ReferenceNo, CreateDate, Location, POID, PONumber, Status, SupplierCode/Name, ItemCode, Quantity, UnitCost, TotalAmount, ChartOfAccountCode, AssetCode, FieldNoCode, VehicleCode, dll.

### INV-10 `riwayat-transaksi` — Riwayat Transaksi Inventory
- **Handler** `transactionHistory` (`route.ts:2484`). **sourceTables**: IN_MTHENDTRX (satu-satunya).
- **SQL**: `FROM IN_MTHENDTRX WHERE DocDate >= '2019-01-01'`. Kolom: `Dokumen, Baris, Tipe, Tanggal, Gudang, KodeBarang, Deskripsi, Qty, Cost, Amount, AccCode, BlkCode, VehCode, AccYear, AccMonth, PeriodeAkuntansi, PeriodeAktual`.
- Akuntansi: `AccMonth 1 = April`; AccYear fiscal (AccYear 2027 AccMonth 1 = 2026-04).

### INV-11 `return-barang` — Return Barang
- **Handler** `stockReturn` (`route.ts:2771`). **sourceTables**: IN_STOCKRTN, IN_STOCKRTNLN. (Return WS_JOBSTOCK TransType='2' ada di CTE bulanan, bukan di sini.)
- **SQL**: `FROM IN_STOCKRTNLN l JOIN IN_STOCKRTN h`. Kolom: `DokumenReturn, Tanggal, Gudang, ReferensiIssue, ReferensiIssueLine, KodeBarang, NamaBarang, QtyReturn, Cost, Amount, Status`.

### RPTIN1000015 `monthly-stock-account-movement-details` — Monthly Stock Account Movement
- **Handler** (CTE `monthlyStockAccountMovementCtes` `route.ts:536` + wrapper `route.ts:1986`). **sourceTables**: IN_ITEM, IN_STOCKANALYSIS, IN_MTHENDITEM, IN_STOCKISSUE/LN, WS_JOBSTOCK, WS_JOB, PU_GOODSRCV/LN, PU_POLN.
- **CTE `base`**: `FROM IN_ITEM WHERE LocCode='${location}' AND Status='1' AND StockAnalysisCode IN ('DEADS','MEMOV','SLMOV') AND ProdTypeCode<>'DC' AND ItemCode LIKE 'M%'`.
- **CTE `movements`** (4 branch):
  1. Opening dari **IN_MTHENDITEM** (opening AccYear/AccMonth).
  2. Stock issue/adjustment IN_STOCKISSUE/LN non-workshop → split station/vehicle/block by VehCode/BlkCode.
  3. **WS_JOBSTOCK** (`route.ts:643`): `TransType='1'` → issued_station/issued_vehicle (by VehCode/BlkCode); `TransType='2'` → return_qty/return_amt. Tidak ada filter TransType di WHERE — dipisah via CASE.
  4. Goods receive PU_GOODSRCV/LN (`StockQty * PU_POLN.Cost`).
- **Closing** dihitung: `opening + received + return_advice + transferred + adjustment - (ledger + issued_station + issued_vehicle) + return + goods_receive - goods_return - dispatch_adv`. Valuasi on-hand = `(QtyOnHand+QtyOnHold)*AverageCost` dari IN_ITEM.
- **Kolom**: ActualPeriod, Opening*, Received*, Transferred*, Adjustment*, Ledger*, IssuedStation*, IssuedVehicle*, IssuedTotal*, Return*, GoodsReceive*, Closing* (qty + amount mirror).

## Group: Purchasing
### INV-06 `purchase-request-inventory` — Purchase Request
- **Handler** `purchaseRequestInventory` (`route.ts:2553`). **sourceTables**: IN_PR, IN_PRLN, IN_PRLN_ACC.
- **SQL**: `FROM IN_PRLN l JOIN IN_PR h`. Kolom: `DokumenPR, TanggalPR, Gudang, TipePR, StatusPR, BarisPR, KodeBarang, NamaBarang, QtyRequest, QtyReceived, QtyOutstanding, Cost, Amount, StatusLine, BudgetInd`. Chart: top-outstanding-pr (ranking), pr-status (donut).

### INV-07 `transfer-antar-gudang` — Transfer Antar Gudang
- **Handler** `transferWarehouse` (`route.ts:2631`). **sourceTables**: IN_STOCKTRANSFER, IN_STOCKTRANSFERLN, IN_STOCKTRANSFERLN_ACC. (Catatan: config group = `transaction`, bukan purchasing.)
- **SQL**: `FROM IN_STOCKTRANSFERLN l JOIN IN_STOCKTRANSFER h`. Kolom: `DokumenTransfer, Tanggal, GudangAsal, GudangTujuan, KodeBarang, NamaBarang, Qty, Cost, Amount, Status`. Chart: transfer-route (route LocCode→ToLocCode), top-transfer-items (ranking).

### INV-13 `purchase-order-history` — PO History
- **Handler** `purchaseOrderHistory` (`route.ts:2991`). **sourceTables**: PU_PO, PU_POLN, PU_SUPPLIER, IN_ITEM.
- **SQL**: agregat per ItemCode+Supplier (`COUNT(DISTINCT POID), SUM(QtyOrder/Receive/Invoice/Amount)`). Kolom: `KodeBarang, NamaBarang, SupplierCode, SupplierName, TotalPO, QtyOrder, QtyReceive, QtyInvoice, POAmount, FirstPODate, LastPODate, LastStatusPO`.

### INV-14 `supplier-purchasing-performance` — Supplier Performance
- **Handler** `supplierPerformance` (`route.ts:3066`). **sourceTables**: PU_SUPPLIER, PU_PO/LN, PU_GOODSRCV/LN, **AP_INVOICERCV**.
- **SQL** 3 CTE: `po` (PU_PO/LN), `gr` (PU_GOODSRCV/LN), `inv` (AP_INVOICERCV: COUNT InvoiceRcvID, SUM GrandTotal/TotalAmount, SUM OutstandingAmount). Kolom: `SupplierCode, SupplierName, ContactPerson, Kota, Telp, Email, StatusSupplier, TotalPO, TotalPOLine, TotalItem, POAmount, QtyOrder, QtyReceive, TotalGoodsReceive, ReceiveAmount, TotalInvoice, InvoiceAmount, OutstandingInvoice, LastPODate, LastGRDate, LastInvoiceDate, SupplierUpdateDate`.

## Group: Control
### INV-08 `stock-opname` — Stock Opname & Adjustment
- **Handler** `stockOpname` (`route.ts:2360`). **sourceTables**: IN_STOCKADJ, IN_STOCKADJLN, IN_STOCKADJLN_ACC.
- **SQL**: `FROM IN_STOCKADJLN l JOIN IN_STOCKADJ h`. Header `h` di-alias = "SH". Kolom: `Dokumen, TanggalPosting, TanggalOpname, AdjType, TransType, KodeBarang, NamaBarang, QtySebelum, QtySesudah, SelisihQty, SelisihNilai, AccCode, Remark, Status`. `D_Quantity`/`D_TotalCost` = delta. TransType di sini = jenis penyesuaian (beda arti dari WS_JOBSTOCK). Chart: adjustment-by-type (bar), top-adjustment-items (ranking).

## Group: Fuel
### INV-09 `fuel-usage` — Fuel Usage
- **Handler** `fuelUsage` (`route.ts:2698`). **sourceTables**: IN_FUELISSUE, IN_FUELISSUELN, IN_FUELISSUELN_ACC.
- **SQL**: `FROM IN_FUELISSUELN l JOIN IN_FUELISSUE h`. Kolom: `DokumenFuel, Tanggal, Gudang, KodeFuel, NamaFuel, Kendaraan, Blok, AccCode, QtyFuel, Cost, Amount, Status`. Chart: fuel-by-vehicle (ranking), fuel-by-month (line).

## Group: Fertilizer
### INV-15 `pupuk-stock-procurement` — Pupuk Stock & Procurement
- **Handler** `fertilizerInventoryProcurement` (`route.ts:3169`). **sourceTables**: IN_ITEM, PU_PO/LN, PU_SUPPLIER, IN_STOCKISSUE/LN, **WS_JOBSTOCK**.
- **SQL**: `FROM IN_ITEM i WHERE ProdCatCode='CA2111' AND Status='1'` + `OUTER APPLY` last PO (PU_PO/LN/SUPPLIER) + `stockIssueUsageApply` (WS_JOBSTOCK ItemType 4 TransType='1'). Kolom: KodeBarang, NamaPupuk, Gudang, Satuan, QuantityClosing, + semua kolom `stockIssueUsageColumns` (StockIssueEventCount, MovementCategory, LastMovementDate, dll), AverageCost, NilaiStok, LastSupplierCode/Name, LastPODate, LastPOAmount.

## Group: Vehicle
### INV-16 `vehicle-running-workshop` — Vehicle Running & Workshop
- **Handler** `vehicleRunningWorkshop` (`route.ts:3252`). **sourceTables**: GL_VEHICLE, BD_VEHICLERUNNING, GL_VEHUSAGE/LN, WS_JOB, WS_JOBSTOCK.
- **SQL** 2 CTE: `usage` (GL_VEHUSAGE/LN), `workshop` (WS_JOBSTOCK js LEFT JOIN WS_JOB, key `COALESCE(NULLIF(js.VehCode,''),NULLIF(j.VehCode,''))` — fallback karena WS_JOBSTOCK.VehCode sering kosong). Kolom: `Kendaraan, NamaKendaraan, TipeKendaraan, Lokasi, StatusKendaraan, TotalUsageUnit, UsageLine, UsageAmount, TotalWorkshopJob, WorkshopStockLine, WorkshopItem, WorkshopQty, WorkshopAmount, LastUsageDate, LastWorkshopDate, NextServiceMaintenanceDate, NextRenewRoadTaxDate`. Chart: vehicle-workshop-cost (SUM WS_JOBSTOCK.Amount), vehicle-usage-unit, workshop-stock-concentration.

---

# MODUL KATALOG (available: false — belum ada SQL live)

## Financial (`intelligence.ts:92`)
- reportCount 16. Sub-modul preview: **produktivitas** (16, "Produktivitas Panen Harian"), **cost** (4, "Cost per KG", "Efisiensi Man Hour").
- Status: `Query: Preview` — query real belum diaktifkan.

## Human Resources (`intelligence.ts:139`)
- reportCount 94. Sub-modul preview: **payroll** (24), **absensi** (18), **premi-lembur** (17), plus daftar upah (15), summary/wages/dampak (20).
- Status: katalog; query payroll/absensi belum di-wire.

## Budget (`intelligence.ts:189`)
- reportCount 12. Sub-modul preview: **planning** (4), **realization** (4), **variance** (4).
- Status: katalog; mapping budget belum disambungkan ke query.

> Semua modul katalog render kartu "Preview" (dimmed, no href) di landing & module detail. Hanya `procurement` yang membuka report nyata.

---

# Cross-Cutting: WS_JOBSTOCK / MTHEND / TransType

- **WS_JOBSTOCK.TransType**: `'1'` = issue (stock-out), `'2'` = return (stock-in). ItemType 4 = Workshop.
- Report yang baca WS_JOBSTOCK TransType='1': INV-01, RPTIN1000011, INV-ALL, kartu-stok, INV-03, INV-04, INV-12, INV-15, INV-16. Report yang baca TransType='2': RPTIN1000015 (CTE bulanan) saja.
- **IN_MTHENDTRX** (INV-10) = ledger transaksi bulanan posted. **IN_MTHENDITEM** (RPTIN1000015) = opening balance stok bulanan. Keduanya snapshot, bukan tabel live.
- **IN_STOCKADJ** (INV-08) = stock opname/adjustment; header alias `h`. TransType = jenis penyesuaian (beda arti).
- **IN_STOCKRTN** (INV-11) = dokumen return native (beda dari WS_JOBSTOCK return).

# Aturan Validasi
- Semua report `readOnly:true` + `validated:true`. `validateReadOnlySql` (`route.ts:871`) + gateway SQL Bridge 2-lapis.
- `expiry-inventory` (INV-H01) `status:'hold'` — tidak di landing live.
- Source default = estate (`db_ptrj`); `?source=pabrik` → `db_ptrj_mill`.

# Referensi File
- SQL: `Dashboard_Utama/app/api/reports/inventory/route.ts`
- Metadata: `Dashboard_Utama/lib/reports/inventory/config.ts`
- Modul/UI: `lib/reports/intelligence.ts`, `lib/reports/module-panel.ts`, `components/ReportCenterPage.tsx`, `components/dashboard/ModuleCard.tsx`, `InventoryReportsClient.tsx`, `ReportViewerClient.tsx`
- AI: `app/api/reports/[reportCode]/ai-analysis/route.ts`
