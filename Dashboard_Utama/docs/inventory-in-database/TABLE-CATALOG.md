# IN_* Table Catalog

Sumber: `SERVER_PROFILE_2 / db_ptrj`

Catatan: row count dibaca dari metadata SQL Server (`sys.dm_db_partition_stats`). Foreign key eksplisit untuk tabel `IN_*` tidak ditemukan, jadi relasi di bawah adalah interpretasi berdasarkan primary key dan nama kolom.

## Ringkasan Tabel

| Table | Rows | PK / Key | Peran |
|---|---:|---|---|
| `IN_FUELISSUE` | 76,706 | `FuelIssueID, LocCode` | Header pengeluaran fuel/BBM. Mirip stock issue tetapi khusus item fuel. Berisi lokasi, periode, status, payroll posting, employee reference, tanggal posting, total amount/price. |
| `IN_FUELISSUE_TEMP` | 0 | `ID` | Staging sementara untuk fuel issue. Tidak dipakai sebagai sumber report utama. |
| `IN_FUELISSUELN` | 93,450 | `FuelIssueLNID, FuelIssueID` | Detail pengeluaran fuel per item/account/block/vehicle/employee. Sumber report pemakaian BBM. |
| `IN_FUELISSUELN_ACC` | 93,450 | `ID` | Alokasi akuntansi/cost dimension untuk fuel issue line. |
| `IN_FUELISSUELN_TEMP` | 0 | `ID` | Staging sementara untuk detail fuel issue. |
| `IN_FUELRTN` | 127 | `ID` | Header return fuel. Berisi lokasi, periode, status, total, tanggal posting, CNID. |
| `IN_FUELRTN_TEMP` | 0 | `ID` | Staging sementara return fuel. |
| `IN_FUELRTNLN` | 138 | `FuelRtnLNID` | Detail return fuel yang mereferensikan `FuelIssueID` dan `FuelIssueLNID`. |
| `IN_FUELRTNLN_ACC` | 138 | `ID` | Alokasi akuntansi/cost dimension untuk return fuel. |
| `IN_FUELRTNLN_TEMP` | 0 | `ID` | Staging sementara detail return fuel. |
| `IN_ITEM` | 7,483 | `ItemCode, LocCode` | Master stok aktif per item dan lokasi. Sumber utama stok gudang, valuasi stok, reorder level, last issue/order. |
| `IN_ITEM_ACC` | 3,941 | `ID` | Alokasi akuntansi/cost dimension terkait item. |
| `IN_ITEMCODE` | 7,179 | `ItemCode` | Master item global tanpa lokasi. Cocok untuk referensi nama/kategori item lintas gudang. |
| `IN_ITEMEXPDATE` | 0 | `ID` | Expiry date per item. Saat ini kosong. |
| `IN_ITEMPART` | 0 | `PartNo` | Mapping part number ke item. Saat ini kosong. |
| `IN_ITEMRETADV` | 0 | `ItemRetAdvID, LocCode` | Header item return advice. Saat ini kosong. |
| `IN_ITEMRETADV_TEMP` | 0 | `ID` | Staging item return advice. |
| `IN_ITEMRETADVLN` | 0 | `ItemRetAdvLnID, ItemRetAdvID` | Detail item return advice. Saat ini kosong. |
| `IN_ITEMRETADVLN_ACC` | 0 | `ID` | Alokasi akuntansi untuk item return advice. |
| `IN_ITEMRETADVLN_TEMP` | 0 | `ID` | Staging detail item return advice. |
| `IN_MTHENDITEM` | 103,742 | `ItemCode, LocCode, AccMonth, AccYear` | Snapshot saldo item per bulan. Sumber report monthly closing, trend saldo, valuasi per periode. |
| `IN_MTHENDTRX` | 105,512 | Tidak ada PK eksplisit terbaca | Histori transaksi inventory bulanan. Berisi doc, tanggal, lokasi, item, qty, cost, amount, account, block, vehicle, employee. |
| `IN_PR` | 11,616 | `PRID, LocCode` | Header purchase request inventory. Hubungan utama ke purchasing/procurement. |
| `IN_PR_APPROVERLIST` | 0 | `PRID, AGCode, UserID, SeqNo` | Approval chain purchase request. Saat ini kosong. |
| `IN_PR_TEMP` | 0 | `ID` | Staging purchase request. |
| `IN_PRLN` | 43,774 | `PRID, ItemCode, PRLnID` | Detail purchase request per item, qty request, qty receive, outstanding, cost, amount. |
| `IN_PRLN_ACC` | 44,922 | `ID` | Alokasi account/dimensi untuk PR line. |
| `IN_PRLN_NURSERY` | 0 | `ID` | Detail nursery untuk PR. Saat ini kosong. |
| `IN_PRLN_TEMP` | 0 | `ID` | Staging PR line. |
| `IN_PRODBRAND` | 6 | `ProdBrandCode` | Master brand produk. |
| `IN_PRODCAT` | 6 | `ProdCatCode` | Master kategori produk. Join ke `IN_ITEM.ProdCatCode`. |
| `IN_PRODMAT` | 1 | `ProdMatCode` | Master material produk. |
| `IN_PRODMODEL` | 6 | `ProdModelCode` | Master model produk. |
| `IN_PRODTYPE` | 44 | `ProdTypeCode` | Master tipe produk. Join ke `IN_ITEM.ProdTypeCode`. |
| `IN_STOCKADJ` | 345 | `StockAdjID, LocCode` | Header adjustment/opname stok. Berisi tanggal posting, tipe adjustment, total amount. |
| `IN_STOCKADJ_TEMP` | 0 | `ID` | Staging adjustment. |
| `IN_STOCKADJLN` | 1,001 | `StockAdjLNID, StockAdjID` | Detail adjustment stok: qty lama, qty baru, selisih qty, selisih nilai, account/block/vehicle. |
| `IN_STOCKADJLN_ACC` | 1,003 | `ID` | Alokasi account/dimensi untuk adjustment line. |
| `IN_STOCKADJLN_TEMP` | 0 | `ID` | Staging adjustment line. |
| `IN_STOCKANALYSIS` | 4 | `StockAnalysisCode` | Master stock analysis code. Join ke `IN_ITEM.StockAnalysisCode`. |
| `IN_STOCKISSUE` | 72,244 | `StockIssueID, LocCode` | Header pengeluaran barang. Sumber utama report barang keluar/pemakaian. |
| `IN_STOCKISSUE_EXDATE` | 0 | `ID` | Expiry split untuk stock issue line. Saat ini kosong. |
| `IN_STOCKISSUE_EXDATE_TEMP` | 0 | `ID` | Staging expiry split stock issue. |
| `IN_STOCKISSUE_TEMP` | 0 | `ID` | Staging stock issue. |
| `IN_STOCKISSUELN` | 119,603 | `StockIssueLNID, StockIssueID` | Detail pengeluaran barang per item/account/block/vehicle/employee. |
| `IN_STOCKISSUELN_ACC` | 120,812 | `ID` | Alokasi akuntansi/cost dimension untuk stock issue line. |
| `IN_STOCKISSUELN_TEMP` | 0 | `ID` | Staging stock issue line. |
| `IN_STOCKRECEIVE` | 4,612 | `StockReceiveID, LocCode` | Header penerimaan barang. Sumber utama report barang masuk. |
| `IN_STOCKRECEIVE_EXDATE` | 0 | `ID` | Expiry split untuk stock receive line. Saat ini kosong. |
| `IN_STOCKRECEIVE_EXDATE_TEMP` | 0 | `ID` | Staging expiry split stock receive. |
| `IN_STOCKRECEIVE_TEMP` | 0 | `ID` | Staging stock receive. |
| `IN_STOCKRECEIVELN` | 9,669 | `StockReceiveLNID, StockReceiveID` | Detail penerimaan barang per item, doc reference, qty, cost, amount, account/block/vehicle. |
| `IN_STOCKRECEIVELN_ACC` | 6,721 | `ID` | Alokasi akuntansi/cost dimension untuk receive line. |
| `IN_STOCKRECEIVELN_TEMP` | 0 | `ID` | Staging receive line. |
| `IN_STOCKRTN` | 302 | `StockRtnId, LocCode` | Header return barang keluar. Berhubungan balik ke stock issue. |
| `IN_STOCKRTN_TEMP` | 0 | `ID` | Staging stock return. |
| `IN_STOCKRTNLN` | 421 | `StockRtnLNID, StockRtnID` | Detail return barang; punya referensi `StockIssueID` dan `StockIssueLNID`. |
| `IN_STOCKRTNLN_ACC` | 425 | `ID` | Alokasi akuntansi/cost dimension untuk stock return line. |
| `IN_STOCKRTNLN_EXDATE` | 0 | `ID` | Expiry split untuk stock return line. Saat ini kosong. |
| `IN_STOCKRTNLN_EXDATE_TEMP` | 0 | `ID` | Staging expiry split stock return. |
| `IN_STOCKRTNLN_TEMP` | 0 | `ID` | Staging stock return line. |
| `IN_STOCKTRANSFER` | 3,096 | `StockTransferID, LocCode` | Header transfer stok antar lokasi. Berisi `LocCode` asal dan `ToLocCode` tujuan. |
| `IN_STOCKTRANSFER_EXDATE` | 0 | `ID` | Expiry split untuk stock transfer line. Saat ini kosong. |
| `IN_STOCKTRANSFER_EXDATE_TEMP` | 0 | `ID` | Staging expiry split transfer. |
| `IN_STOCKTRANSFER_TEMP` | 0 | `ID` | Staging stock transfer. |
| `IN_STOCKTRANSFERLN` | 6,644 | `StockTransferID, ItemCode, Qty` | Detail transfer stok per item, qty, cost, amount. |
| `IN_STOCKTRANSFERLN_ACC` | 6,639 | `ID` | Alokasi account/dimensi untuk transfer line. |
| `IN_STOCKTRANSFERLN_TEMP` | 0 | `ID` | Staging transfer line. |

## Kolom Inti Yang Harus Diingat

| Domain | Kolom kunci |
|---|---|
| Item | `ItemCode`, `LocCode`, `Description`, `ProdCatCode`, `ProdTypeCode`, `UOMCode`, `Status` |
| Stok | `QtyOnHand`, `QtyOnHold`, `QtyOnOrder`, `ReOrderLevel`, `AverageCost`, `LatestCost` |
| Periode | `AccMonth`, `AccYear`, `PostDate`, `DocDate`, `UpdateDate` |
| Dokumen | `StockIssueID`, `StockReceiveID`, `StockAdjID`, `StockTransferID`, `StockRtnID`, `FuelIssueID`, `FuelRtnID`, `PRID` |
| Pembebanan biaya | `AccCode`, `BlkCode`, `VehCode`, `VehExpCode`, `ChargeLocCode`, `PsEmpCode`, `PSEMPCODE`, `EmpCode` |
| Purchasing | `PRID`, `PRLnID`, `QtyReq`, `QtyRcv`, `QtyOutstanding`, `BillToHQ`, `AGCode` |

