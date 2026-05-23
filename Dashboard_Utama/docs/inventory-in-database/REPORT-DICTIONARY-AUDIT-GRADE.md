# Inventory Audit-Grade Report Dictionary

Sumber validasi utama: `SERVER_PROFILE_2 / db_ptrj`

Mode sumber report:

- `estate`: `SERVER_PROFILE_2 / db_ptrj`
- `pabrik`: `SERVER_PROFILE_3 / db_ptrj_mill`
- Dashboard dan seluruh API report wajib membawa parameter `source=estate|pabrik` agar chart, metadata, dan AI insight membaca database yang sama.

Prinsip:

- Report hanya dianggap live jika tabel sumber punya data dan relasi logisnya kuat.
- Tabel kosong seperti `_TEMP`, `_EXDATE`, `IN_ITEMRETADV`, `IN_ITEMRETADVLN`, dan `IN_PR_APPROVERLIST` tidak dipaksakan menjadi report live.
- Tanggal `1900-01-01` dianggap placeholder dan harus dikeluarkan dari chart periode.
- AI Insight hanya membaca payload hasil query, termasuk summary, chart, sample row, metadata, dan quality flags.

## Executive Summary Findings

| Area | Temuan validasi |
|---|---|
| Stok aktif | 7.483 item aktif dari `IN_ITEM`. |
| Nilai persediaan | Rp45,10B dari `SUM(QtyOnHand * AverageCost)`. |
| Konsentrasi gudang | P1A Rp23,32B, HQ Rp14,92B, ARA Rp5,39B, DME Rp1,43B. |
| Stok nol | 6.183 item aktif punya `QtyOnHand = 0`; ini quality/risk flag penting. |
| Kategori kosong | 407 item aktif tanpa kategori valid; nilainya material karena kategori kosong/tanpa kategori termasuk top value. |
| Tidak pernah issue valid | 5.534 item aktif punya `LastIssueDate` kosong atau placeholder. |
| Update stale | 5.269 item aktif update lebih dari 12 bulan. |
| Reorder alert | 0 item di bawah reorder level saat validasi; bisa berarti stok aman atau master `ReOrderLevel` belum dimanfaatkan. |
| Transaksi keluar | 118.690 baris valid sejak 2000, nilai keluar Rp607,21B. |
| Transaksi masuk | 6.632 baris valid sejak 2000, nilai masuk Rp390,73B. |
| PR outstanding | 43.701 line PR valid sejak 2000, outstanding qty besar dan perlu report terpisah. |
| Fuel issue | 92.949 line valid sejak 2000, layak jadi report Inventory/Fuel. |
| Periode chart | Bulan tertentu tidak muncul pada 12 bulan terakhir, jadi chart harus menampilkan missing-period note. |
| PO inventory | 7.712 PO valid, 44.379 line, 5.722 item, 140 supplier, nilai line PO Rp1,22T. |
| Supplier master | 591 supplier; 554 email kosong, 229 telepon kosong, 585 credit limit nol. |
| Pupuk | 106 item aktif `CA2111`; 21 item ada stok; nilai stok sekitar Rp13,43B. |
| Vehicle/workshop | 1.809 vehicle master, 248.813 vehicle usage line, 47.409 workshop stock line. |

## Report Live Yang Layak Dibuat

### INV-01: Posisi Stok & Nilai Gudang

- Tujuan: CEO/executive melihat nilai inventory, stok, dan distribusi gudang.
- Sumber: `IN_ITEM`, opsional `IN_PRODCAT`.
- Grain: item per lokasi/gudang.
- Chart wajib:
  - Bar: nilai persediaan per gudang.
  - Donut: komposisi nilai persediaan per kategori.
  - Ranking: top item berdasarkan nilai stok.
- Insight utama:
  - Gudang yang mendominasi nilai persediaan.
  - Item bernilai terbesar.
  - Rasio item stok nol.
  - Nilai tanpa kategori.
- Quality flags:
  - `QtyOnHand = 0`.
  - kategori kosong/null/0.
  - `LastIssueDate < 2000-01-01`.
  - update lebih dari 12 bulan.

### INV-02: Kualitas Master Item & Slow Moving

- Tujuan: audit master data item, dead stock, slow moving, dan item stale.
- Sumber: `IN_ITEM`, `IN_ITEMCODE`, opsional master category/type.
- Grain: item per lokasi/gudang.
- Chart wajib:
  - Bar: item stale per gudang/kategori.
  - Ranking: item bernilai besar tanpa issue valid.
  - Donut: status kualitas master item.
- Insight utama:
  - item aktif yang belum pernah issue valid.
  - item bernilai besar dengan `LastIssueDate` placeholder.
  - item update lama.
- Quality flags:
  - banyak tanggal `1900-01-01`.
  - kategori kosong.
  - item aktif tetapi stok nol.

### INV-03: Mutasi Masuk vs Keluar

- Tujuan: executive melihat tren barang masuk, barang keluar, transfer, dan gap periodik.
- Sumber: `IN_STOCKISSUE/LN`, `IN_STOCKRECEIVE/LN`, `IN_STOCKTRANSFER/LN`.
- Grain: bulan + jenis mutasi.
- Chart wajib:
  - Line/area: qty masuk vs keluar per bulan.
  - Bar: amount masuk vs keluar per bulan.
  - Alert: bulan yang tidak muncul pada periode analisis.
- Insight utama:
  - bulan dengan nilai keluar tertinggi.
  - gap masuk vs keluar.
  - periode hilang.
- Quality flags:
  - `PostDate < 2000-01-01`.
  - bulan kosong bukan otomatis nol operasional.

### INV-04: Pengeluaran Barang Operasional

- Tujuan: audit pemakaian barang ke operasional, cost center, blok, kendaraan, dan employee.
- Sumber: `IN_STOCKISSUE`, `IN_STOCKISSUELN`, opsional `IN_STOCKISSUELN_ACC`.
- Grain: line issue per dokumen.
- Chart wajib:
  - Ranking: top barang keluar by amount.
  - Bar: nilai keluar per `BlkCode` atau `AccCode`.
  - Bar: nilai keluar per kendaraan jika `VehCode` terisi.
- Insight utama:
  - item dengan nilai keluar terbesar.
  - cost center/block yang dominan.
  - status payroll posting jika diperlukan.
- Quality flags:
  - tanggal placeholder pada header.
  - `BlkCode`, `AccCode`, `VehCode` blank.

### INV-05: Penerimaan Barang

- Tujuan: audit barang masuk, nilai receipt, dan referensi dokumen.
- Sumber: `IN_STOCKRECEIVE`, `IN_STOCKRECEIVELN`.
- Grain: line receive per dokumen.
- Chart wajib:
  - Trend: nilai penerimaan per bulan.
  - Ranking: top item diterima by amount.
  - Bar: penerimaan per gudang.
- Insight utama:
  - item penerimaan terbesar.
  - pola penerimaan per bulan.
  - dokumen receive terbaru.
- Quality flags:
  - tanggal placeholder.
  - referensi dokumen kosong.

### INV-06: Purchase Request Inventory & Outstanding

- Tujuan: report jembatan Inventory ke purchasing.
- Sumber: `IN_PR`, `IN_PRLN`, opsional `IN_PRLN_ACC`.
- Grain: line PR per item.
- Chart wajib:
  - Ranking: top outstanding item by qty.
  - Bar: outstanding per gudang/lokasi.
  - Donut: status PR.
- Insight utama:
  - item outstanding terbesar.
  - PR bernilai besar yang belum terpenuhi.
  - item dengan qty request besar tetapi `NilaiPR = 0`.
- Quality flags:
  - `PRDate < 2000-01-01`.
  - amount 0 pada outstanding besar.

### INV-07: Transfer Antar Gudang

- Tujuan: melihat pergerakan stok antar lokasi.
- Sumber: `IN_STOCKTRANSFER`, `IN_STOCKTRANSFERLN`.
- Grain: line transfer per item.
- Chart wajib:
  - Sankey/logical route: `LocCode -> ToLocCode` jika UI mendukung.
  - Bar fallback: top route by amount.
  - Ranking: top item transfer.
- Insight utama:
  - route transfer paling material.
  - item transfer terbesar.
  - apakah transfer lebih seperti replenishment antar gudang.
- Quality flags:
  - tanggal placeholder.
  - lokasi asal/tujuan kosong.

### INV-08: Stock Opname & Adjustment

- Tujuan: audit selisih stok, adjustment, dan potensi koreksi material.
- Sumber: `IN_STOCKADJ`, `IN_STOCKADJLN`.
- Grain: line adjustment per item.
- Chart wajib:
  - Bar: selisih nilai per adjustment type.
  - Ranking: item dengan selisih nilai terbesar.
  - Trend: adjustment amount per bulan.
- Insight utama:
  - adjustment bernilai besar.
  - selisih qty dan nilai.
  - tipe adjustment dominan.
- Quality flags:
  - tanggal placeholder.
  - `D_Quantity` dan `D_TotalCost` perlu dibaca sebagai delta.

### INV-09: Fuel Usage Inventory

- Tujuan: audit pemakaian BBM sebagai bagian dari Inventory.
- Sumber: `IN_FUELISSUE`, `IN_FUELISSUELN`.
- Grain: line fuel issue per kendaraan/blok/item.
- Chart wajib:
  - Ranking: kendaraan dengan nilai fuel tertinggi.
  - Bar: fuel usage per vehicle/block.
  - Trend: fuel amount per bulan.
- Insight utama:
  - kendaraan dengan konsumsi terbesar.
  - item fuel dominan, biasanya `OL006/DIESEL`.
  - block usage jika `BlkCode` terisi.
- Quality flags:
  - kendaraan atau blok kosong.
  - tanggal placeholder.

### INV-10: Riwayat Transaksi Inventory

- Tujuan: audit trail lintas tipe dokumen dari monthly transaction.
- Sumber: `IN_MTHENDTRX`.
- Grain: transaction line.
- Chart wajib:
  - Bar/donut: transaksi per `DocType`.
  - Trend: amount per bulan.
  - Ranking: item/doc dengan amount terbesar.
- Insight utama:
  - tipe dokumen paling dominan.
  - total transaksi dan nilai.
  - perbedaan terhadap source detail bila ada.
- Quality flags:
  - `DocDate < 2000-01-01`.
  - amount negatif/zero jika ditemukan.

### INV-11: Return Barang

- Tujuan: audit pengembalian barang dari issue.
- Sumber: `IN_STOCKRTN`, `IN_STOCKRTNLN`.
- Grain: line return.
- Chart wajib:
  - Trend: return amount per bulan.
  - Ranking: top item return.
  - Bar: return per lokasi.
- Insight utama:
  - item return terbesar.
  - hubungan ke `StockIssueID`.
  - apakah return material atau minor.
- Quality flags:
  - data lebih kecil dari transaksi utama.
  - tanggal placeholder.

### INV-12: Item Tidak Update & Aging Master

- Tujuan: audit `IN_ITEM.UpdateDate` untuk item yang lama tidak berubah tetapi masih aktif atau bernilai.
- Sumber: `IN_ITEM`.
- Grain: item aktif per gudang.
- Filter wajib:
  - `stale=lebih-1-tahun`: `UpdateDate < DATEADD(YEAR, -1, GETDATE())`.
  - `stale=kurang-1-tahun`: `UpdateDate >= DATEADD(YEAR, -1, GETDATE())`.
  - `stale=semua`: semua item aktif.
- Chart wajib:
  - Bar: nilai item stale per gudang.
  - Ranking: top stale item by value.
  - Quality: bucket update lebih dari 1 tahun, kurang dari 1 tahun, lebih dari 2 tahun.
- Insight utama:
  - item bernilai besar yang tidak update lebih dari 1 tahun.
  - gudang dengan nilai stale terbesar.
  - rasio stale terhadap total item aktif.
- Quality flags:
  - `UpdateDate` adalah freshness master, bukan tanggal movement transaksi.
  - item stale bernilai besar harus direview bersama `LastIssueDate` dan `LastOrderDate`.

### INV-13: Purchasing Order History per Item & Supplier

- Tujuan: melihat histori supplier untuk setiap item dan konsentrasi nilai PO.
- Sumber: `PU_PO`, `PU_POLN`, `PU_SUPPLIER`, `IN_ITEM`.
- Grain: item + supplier dari line PO.
- Chart wajib:
  - Bar: top supplier by PO amount.
  - Ranking: item dengan jumlah supplier terbanyak.
  - Donut/bar: komposisi status PO.
- Insight utama:
  - supplier utama per item.
  - item dengan banyak alternatif supplier.
  - gap qty order vs qty receive sebagai outstanding indikatif.
- Quality flags:
  - `PODate < 2000-01-01` dikeluarkan.
  - outstanding memakai line PO, bukan klaim final AP.

### INV-14: Supplier Performance & Master Quality

- Tujuan: audit supplier dari sisi PO, goods receive, invoice, outstanding, dan master-data quality.
- Sumber: `PU_SUPPLIER`, `PU_PO`, `PU_POLN`, `PU_GOODSRCV`, `PU_GOODSRCVLN`, `AP_INVOICERCV`.
- Grain: supplier master dengan agregat PO/GR/invoice.
- Chart wajib:
  - Ranking: top supplier by PO amount.
  - Quality: email/telp/credit limit kosong.
  - Bar: receive vs invoice coverage per supplier.
- Insight utama:
  - supplier paling material.
  - supplier aktif yang master datanya belum lengkap.
  - supplier dengan invoice outstanding.
- Quality flags:
  - agregasi PO, GR, invoice dipisah per supplier untuk menghindari double counting.
  - email/telp kosong adalah quality flag, bukan error transaksi.

### INV-15: Pupuk: Stock, Issue Readiness & Procurement

- Tujuan: executive/audit view khusus pupuk.
- Sumber: `IN_ITEM`, `PU_PO`, `PU_POLN`, `PU_SUPPLIER`.
- Definisi: `IN_ITEM.ProdCatCode = 'CA2111'`.
- Grain: item pupuk per gudang dengan last supplier PO.
- Chart wajib:
  - Ranking: top pupuk by stock value.
  - Bar: PO pupuk by supplier.
  - Quality: pupuk stale dan `LastIssueDate` tidak valid.
- Insight utama:
  - pupuk bernilai stok terbesar.
  - supplier utama untuk pupuk.
  - pupuk yang stoknya ada tetapi `LastIssueDate` placeholder.
- Quality flags:
  - `LastIssueDate = 1900-01-01` dianggap placeholder.
  - kategori pupuk hanya yang terbukti `CA2111`.

### INV-16: Vehicle Running & Workshop Inventory Usage

- Tujuan: menghubungkan kendaraan, running/usage unit, dan pemakaian stock workshop.
- Sumber: `GL_VEHICLE`, `BD_VEHICLERUNNING`, `GL_VEHUSAGE`, `GL_VEHUSAGELN`, `WS_JOB`, `WS_JOBSTOCK`.
- Grain: kendaraan dengan agregat usage dan workshop stock.
- Chart wajib:
  - Ranking: top vehicle by workshop stock amount.
  - Bar: usage unit ranking.
  - Quality: konsentrasi item workshop per kendaraan.
- Insight utama:
  - kendaraan dengan workshop cost paling besar.
  - kendaraan dengan usage/running unit tertinggi.
  - kendaraan dengan potensi maintenance perhatian.
- Quality flags:
  - `WS_JOBSTOCK.VehCode` banyak kosong, gunakan fallback ke `WS_JOB.VehCode`.
  - `GL_VEHFUELUSAGE` kosong saat validasi; fuel detail tetap memakai `IN_FUELISSUE`.

## Report Hold / Jangan Dibuat Live Dulu

| Report kandidat | Sumber | Alasan hold |
|---|---|---|
| Expiry Date Inventory | `IN_ITEMEXPDATE`, `*_EXDATE` | tabel kosong saat validasi. |
| Return Advice | `IN_ITEMRETADV`, `IN_ITEMRETADVLN` | tabel kosong saat validasi. |
| PR Approval Chain | `IN_PR_APPROVERLIST` | tabel kosong saat validasi. |
| Item Part Mapping | `IN_ITEMPART` | tabel kosong saat validasi. |

## Module-Level Chart Yang Layak Tampil

Untuk dashboard modul Inventory, chart utama yang layak adalah:

1. Nilai persediaan per gudang.
2. Komposisi nilai per kategori.
3. Top item berdasarkan nilai stok.
4. Mutasi masuk vs keluar per bulan.
5. PR outstanding top item.
6. Quality flags: stok nol, kategori kosong, no issue valid, stale update, placeholder date.
7. Purchasing exposure: top supplier, PO amount, item-supplier history.
8. Pupuk: stock value, supplier linkage, stale/invalid issue.
9. Vehicle/workshop: workshop stock amount dan usage unit.

Chart ini menjawab kebutuhan executive/audit: posisi, risiko, movement, dan kualitas data.
