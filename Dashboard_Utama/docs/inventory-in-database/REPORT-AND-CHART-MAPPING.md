# Inventory Report And Chart Mapping

Sumber utama: `SERVER_PROFILE_2 / db_ptrj`

Mode sumber report:

- `source=estate`: `SERVER_PROFILE_2 / db_ptrj`
- `source=pabrik`: `SERVER_PROFILE_3 / db_ptrj_mill`
- Chart dan AI insight tidak boleh membaca source berbeda dari pilihan dashboard.

Tujuan file ini adalah menjaga agar report dan chart Inventory dibuat dari tabel yang benar, bukan dari mock data.

## Dashboard KPI

| KPI | Sumber utama | Formula awal |
|---|---|---|
| Total Item Aktif | `IN_ITEM` | `COUNT(*) WHERE Status = '1'` |
| Total Stok | `IN_ITEM` | `SUM(QtyOnHand)` |
| Nilai Persediaan | `IN_ITEM` | `SUM(QtyOnHand * AverageCost)` |
| Gudang Aktif | `IN_ITEM` | `COUNT(DISTINCT LocCode)` |
| Reorder Alert | `IN_ITEM` | `QtyOnHand < ReOrderLevel AND ReOrderLevel > 0` |
| PR Outstanding | `IN_PRLN` | `SUM(QtyOutstanding)` atau count line outstanding |
| Barang Keluar | `IN_STOCKISSUE` + `IN_STOCKISSUELN` | `SUM(Qty/Amount)` per periode |
| Barang Masuk | `IN_STOCKRECEIVE` + `IN_STOCKRECEIVELN` | `SUM(Qty/Amount)` per periode |
| Item Tidak Update | `IN_ITEM` | `COUNT(*)` dan `SUM(QtyOnHand * AverageCost)` per bucket `UpdateDate` |
| PO Amount | `PU_PO` + `PU_POLN` | `SUM(PU_POLN.Amount)` per supplier/item |
| Supplier Quality | `PU_SUPPLIER` | count email/telp/credit limit kosong |
| Nilai Stok Pupuk | `IN_ITEM` | `SUM(QtyOnHand * AverageCost) WHERE ProdCatCode='CA2111'` |
| Vehicle Workshop Cost | `WS_JOBSTOCK` + `WS_JOB` | `SUM(Amount)` per `VehCode` |

## Chart Command Center

| Chart | Sumber | Dimensi | Metric |
|---|---|---|---|
| Stok per Gudang | `IN_ITEM` | `LocCode` | `SUM(QtyOnHand)`, `SUM(QtyOnHand * AverageCost)` |
| Kategori Barang | `IN_ITEM` + `IN_PRODCAT` | `ProdCatCode` / category description | item count, qty, value |
| Mutasi Masuk vs Keluar | `IN_STOCKRECEIVE/LN`, `IN_STOCKISSUE/LN` | month from `PostDate` | qty and amount |
| Top Barang Bergerak | `IN_MTHENDTRX` or issue/receive lines | `ItemCode` | transaction count, qty, amount |
| PR Outstanding | `IN_PR` + `IN_PRLN` | `PRDate`, `Status`, `LocCode` | qty outstanding, amount |
| Stock Opname Delta | `IN_STOCKADJ` + `IN_STOCKADJLN` | `PostDate`, `AdjType` | `D_Quantity`, `D_TotalCost` |
| Transfer Antar Gudang | `IN_STOCKTRANSFER` + `IN_STOCKTRANSFERLN` | `LocCode -> ToLocCode` | qty, amount |
| Fuel Usage | `IN_FUELISSUE` + `IN_FUELISSUELN` | `VehCode`, `BlkCode`, `PsEmpCode` | qty, amount |
| Item Stale Update | `IN_ITEM` | `LocCode`, update bucket | count item, stock value |
| PO History Supplier | `PU_PO` + `PU_POLN` + `PU_SUPPLIER` | `ItemCode`, `SupplierCode` | qty order/receive/invoice, amount |
| Supplier Performance | `PU_SUPPLIER`, PO, GR, AP invoice | `SupplierCode` | PO amount, GR amount, invoice amount, quality flags |
| Pupuk Executive | `IN_ITEM` + PO supplier | `ItemCode`, `LocCode`, `SupplierCode` | stock value, last PO amount |
| Vehicle Running | `GL_VEHUSAGE/LN`, `WS_JOB/STOCK` | `VehCode` | usage unit, workshop amount |

## Report Inventory Prioritas

### 1. Stok Gudang

- Sumber: `IN_ITEM`
- Join opsional: `IN_PRODCAT`, `IN_PRODTYPE`
- Filter: `LocCode`, `ProdCatCode`, `Status`, search item.
- Output: item, gudang, satuan, qty, average cost, nilai stok, kategori, last update.

### 2. Kartu Stok

- Sumber: `IN_ITEM`, `IN_MTHENDTRX`
- Join: `ItemCode`, `LocCode`
- Output: saldo awal/snapshot, transaksi masuk/keluar, saldo akhir per item.
- Catatan: perlu definisi periodisasi karena `IN_MTHENDTRX` adalah histori bulanan.

### 3. Mutasi Barang

- Sumber keluar: `IN_STOCKISSUE` + `IN_STOCKISSUELN`
- Sumber masuk: `IN_STOCKRECEIVE` + `IN_STOCKRECEIVELN`
- Filter wajib: `PostDate >= '2000-01-01'`
- Output: tanggal, dokumen, tipe, item, qty, cost, amount, lokasi, account/block/vehicle.

### 4. Penerimaan Barang

- Sumber: `IN_STOCKRECEIVE`, `IN_STOCKRECEIVELN`
- Relasi purchasing: `DocType`, `DocID`, dan `StockRefNo` perlu validasi ke modul purchasing/AP.
- Output: dokumen receive, tanggal, item, qty, cost, amount, sumber dokumen.

### 5. Pengeluaran Barang

- Sumber: `IN_STOCKISSUE`, `IN_STOCKISSUELN`
- Relasi payroll/operasional: `PayrollPosted`, `PSEMPCODE`, `PsEmpCode`, `AccCode`, `BlkCode`, `VehCode`.
- Output: dokumen issue, tanggal, item, qty, amount, cost center.

### 6. Stock Opname / Adjustment

- Sumber: `IN_STOCKADJ`, `IN_STOCKADJLN`
- Output: item, qty sebelum/sesudah, selisih qty, selisih nilai, tipe adjustment.

### 7. Reorder Level

- Sumber: `IN_ITEM`
- Formula: `QtyOnHand < ReOrderLevel AND ReOrderLevel > 0`
- Output: item, gudang, qty on hand, reorder level, shortage, latest cost.

### 8. Purchase Request Inventory

- Sumber: `IN_PR`, `IN_PRLN`
- Output: PR, tanggal PR, lokasi, status, item, qty request, qty received, outstanding, amount.
- Ini harus masuk sub-report Inventory karena prefix-nya `IN_*` dan menjadi jembatan ke purchasing.

### 9. Transfer Antar Gudang

- Sumber: `IN_STOCKTRANSFER`, `IN_STOCKTRANSFERLN`
- Output: asal, tujuan, item, qty, amount, tanggal transfer.

### 10. Fuel Usage

- Sumber: `IN_FUELISSUE`, `IN_FUELISSUELN`
- Output: item fuel, kendaraan, block/account, employee, qty, amount.
- Ini bisa menjadi report Inventory khusus BBM atau subkategori Fuel.

### 11. Item Tidak Update / Aging Master

- Sumber: `IN_ITEM`
- Filter: `stale=lebih-1-tahun`, `stale=kurang-1-tahun`, `stale=semua`.
- Output: item, gudang, kategori, stok, nilai stok, `LastIssueDate`, `LastOrderDate`, `UpdateDate`, hari tidak update.
- Chart: nilai stale per gudang, top stale item by value, bucket update age.

### 12. Purchasing Order History per Item & Supplier

- Sumber: `PU_PO`, `PU_POLN`, `PU_SUPPLIER`, `IN_ITEM`.
- Join: `PU_POLN.POID = PU_PO.POID`, `PU_PO.SupplierCode = PU_SUPPLIER.SupplierCode`, `PU_POLN.ItemCode = IN_ITEM.ItemCode`.
- Output: item, supplier, total PO, qty order/receive/invoice, PO amount, first/last PO date.
- Chart: top supplier by amount, supplier diversity by item, status PO composition.

### 13. Supplier Performance & Master Quality

- Sumber: `PU_SUPPLIER`, `PU_PO/POLN`, `PU_GOODSRCV/GOODSRCVLN`, `AP_INVOICERCV`.
- Agregasi: PO, GR, dan invoice dihitung di CTE terpisah per supplier.
- Output: supplier master, total PO, receive amount, invoice amount, outstanding invoice, quality flag kontak.
- Chart: top supplier by PO amount, supplier quality flags, receive vs invoice coverage.

### 14. Pupuk: Stock, Issue Readiness & Procurement

- Sumber: `IN_ITEM`, `PU_PO`, `PU_POLN`, `PU_SUPPLIER`.
- Definisi pupuk: `ProdCatCode = 'CA2111'`.
- Output: item pupuk, gudang, stok, nilai stok, last issue, last order, last supplier PO.
- Chart: top pupuk by stock value, PO pupuk by supplier, pupuk stale/invalid issue.

### 15. Vehicle Running & Workshop Inventory Usage

- Sumber: `GL_VEHICLE`, `BD_VEHICLERUNNING`, `GL_VEHUSAGE`, `GL_VEHUSAGELN`, `WS_JOB`, `WS_JOBSTOCK`.
- Join: `WS_JOBSTOCK.JobID = WS_JOB.JobID`; jika `WS_JOBSTOCK.VehCode` kosong pakai fallback `WS_JOB.VehCode`.
- Output: kendaraan, tipe, usage unit, usage amount, workshop job, workshop stock item, workshop amount, service/road tax date.
- Chart: top vehicle by workshop amount, usage unit ranking, workshop stock concentration.

## Query Rules

- Semua query harus read-only.
- Gunakan `RTRIM()` untuk kolom `char`.
- Gunakan `ISNULL()` untuk numeric nullable.
- Tanggal `1900-01-01` harus dianggap placeholder.
- Untuk data real-time stok gunakan `IN_ITEM`.
- Untuk histori gunakan `IN_MTHENDTRX`, `IN_MTHENDITEM`, atau pasangan header/line transaksi.
- Untuk AI Insight, payload yang dikirim hanya hasil query final. AI tidak boleh membuat query sendiri.
- Untuk report source switch, semua endpoint harus menerima `source=estate|pabrik` dan metadata harus mengembalikan `sourceServer` serta `sourceDatabase`.
