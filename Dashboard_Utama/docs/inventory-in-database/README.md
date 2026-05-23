# Inventory IN_* Database Notes

Tanggal analisis: 2026-05-18

Sumber yang dibaca:

- Estate / Kebun: `SERVER_PROFILE_2`, database `db_ptrj`
- Pabrik: `SERVER_PROFILE_3`, database `db_ptrj_mill`

Status saat analisis:

- `SERVER_PROFILE_2 / db_ptrj`: online, query metadata dan data inventory berhasil.
- `SERVER_PROFILE_3 / db_ptrj_mill`: tidak berhasil dibaca karena timeout koneksi `103.127.66.32:1888`.

Semua query yang dipakai untuk analisis adalah read-only. Tidak ada `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, atau operasi tulis lain.

## Kesimpulan Modul

Prefix `IN_*` adalah domain Inventory. Di database estate, prefix ini tidak hanya menyimpan stok barang, tetapi juga transaksi pemakaian, penerimaan, transfer, return, fuel, purchase request, expiry date, dan alokasi akuntansi/cost center.

Kelompok utama:

- Master item: `IN_ITEM`, `IN_ITEMCODE`, `IN_PRODCAT`, `IN_PRODTYPE`, `IN_PRODBRAND`, `IN_PRODMODEL`, `IN_PRODMAT`, `IN_STOCKANALYSIS`.
- Saldo dan histori: `IN_MTHENDITEM`, `IN_MTHENDTRX`.
- Stock issue / barang keluar: `IN_STOCKISSUE`, `IN_STOCKISSUELN`.
- Stock receive / barang masuk: `IN_STOCKRECEIVE`, `IN_STOCKRECEIVELN`.
- Stock adjustment / opname: `IN_STOCKADJ`, `IN_STOCKADJLN`.
- Stock transfer: `IN_STOCKTRANSFER`, `IN_STOCKTRANSFERLN`.
- Stock return: `IN_STOCKRTN`, `IN_STOCKRTNLN`.
- Fuel issue/return: `IN_FUELISSUE`, `IN_FUELISSUELN`, `IN_FUELRTN`, `IN_FUELRTNLN`.
- Purchase request: `IN_PR`, `IN_PRLN`, `IN_PR_APPROVERLIST`.
- Accounting allocation: tabel dengan suffix `_ACC`.
- Temporary/staging: tabel dengan suffix `_TEMP`.
- Expiry detail: tabel dengan suffix `_EXDATE`.

## Interpretasi Bisnis

Inventory berhubungan dengan purchasing melalui `IN_PR` dan `IN_PRLN` sebagai purchase request, lalu penerimaan barang dicatat pada `IN_STOCKRECEIVE` dan `IN_STOCKRECEIVELN`.

Inventory berhubungan dengan operasional/payroll secara tidak langsung melalui:

- `PayrollPosted` pada dokumen issue/return/fuel.
- `PSEMPCODE`, `PsEmpCode`, dan `EmpCode` pada issue/fuel/transaction history.
- `AccCode`, `BlkCode`, `VehCode`, `VehExpCode`, dan tabel `_ACC` untuk pembebanan biaya ke account, blok, kendaraan, karyawan, budget, job, dan kontrak.

Database tidak menampilkan foreign key eksplisit untuk tabel `IN_*`. Relasi harus diinfer dari primary key dan kolom dokumen yang sama, misalnya:

- `IN_ITEM.ItemCode + LocCode`
- `IN_STOCKISSUE.StockIssueID + LocCode`
- `IN_STOCKISSUELN.StockIssueID`
- `IN_STOCKRECEIVE.StockReceiveID + LocCode`
- `IN_STOCKRECEIVELN.StockReceiveID`
- `IN_STOCKADJ.StockAdjID + LocCode`
- `IN_STOCKADJLN.StockAdjID`
- `IN_PR.PRID + LocCode`
- `IN_PRLN.PRID + ItemCode + PRLnID`

## Catatan Kualitas Data

- Banyak tabel transaksi memiliki nilai tanggal `1900-01-01`. Itu harus dianggap placeholder, bukan tanggal operasional valid.
- Untuk chart periode, filter tanggal sebaiknya memakai `PostDate >= '2000-01-01'` atau rule setara.
- `IN_ITEM` adalah sumber stok real-time per lokasi, sedangkan `IN_MTHENDITEM` dan `IN_MTHENDTRX` adalah snapshot/histori periode.
- Tabel `_TEMP` mayoritas kosong dan bukan kandidat utama report.
- Tabel `_ACC` penting untuk report pembebanan biaya, tetapi bukan sumber utama stok fisik.

## File Dokumentasi

- [TABLE-CATALOG.md](./TABLE-CATALOG.md): dokumentasi tiap tabel `IN_*`.
- [RELATIONSHIP-MAP.md](./RELATIONSHIP-MAP.md): peta relasi dan join yang aman untuk report.
- [REPORT-AND-CHART-MAPPING.md](./REPORT-AND-CHART-MAPPING.md): rancangan report dan chart yang bisa dibuat dari data real.

