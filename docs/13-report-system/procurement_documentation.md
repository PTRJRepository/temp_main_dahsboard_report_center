# Dokumentasi Komprehensif Modul Procurement (Purchasing)
**Dashboard Utama — PT Rebinmas Jaya**
**Database:** `db_ptrj` (SERVER_PROFILE_2, Estate) & `db_ptrj_mill` (SERVER_PROFILE_3, Mill) pada SQL Server

Dokumen ini mendokumentasikan seluruh aspek terkait modul **Procurement (Pembelian/Purchasing)** pada sistem dashboard, mencakup koneksi gateway, skema database, korelasi antar-tabel (ERD), kueri (queries) SQL utama, alur kerja (workflow) data, serta peringatan penting bagi pengembang (developer rules & warnings).

---

## 1. Detail Koneksi & Arsitektur Gateway
Sistem dashboard utama (Next.js) tidak melakukan koneksi langsung ke SQL Server via TCP. Sebagai gantinya, koneksi dilakukan melalui **SQL Query Gateway** berbasis Express/Bun proxy.
* **Base URL Gateway:** `http://localhost:8001/v1/query`
* **API Key:** `2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6`
* **Database Target:** 
  * `db_ptrj` (SERVER_PROFILE_2) untuk data Kebun (Estate/P1A).
  * `db_ptrj_mill` (SERVER_PROFILE_3) untuk data Pabrik (Mill).

> [!NOTE]
> Semua kueri SQL dijalankan secara dinamis menggunakan raw T-SQL yang dikirimkan via POST request ke endpoint gateway di atas.

---

## 2. Skema Database Procurement

Modul Procurement terdiri dari tiga pilar utama: **Purchase Requisition (PR)**, **Purchase Order (PO)**, dan **Goods Receipt (GR)**, yang didukung oleh tabel Master Supplier dan Master Item.

```
                  ┌─────────────────┐
                  │   PU_SUPPLIER   │ (Vendor Master)
                  └────────┬────────┘
                           │ 1
                           │
                           │ N
┌───────────┐ 1   N ┌──────▼──────┐ 1   N ┌──────────────┐
│   IN_PR   ├──────►│   IN_PRLN   ├──────►│ IN_PRLN_ACC  │ (Purchase Requisition)
└───────────┘       └──────┬──────┘       └──────────────┘
                           │
                           │ (Proses Order & Approval)
                           ▼
┌───────────┐ 1   N ┌─────────────┐
│   PU_PO   ├──────►│   PU_POLN   │ (Purchase Order - Menyimpan Harga!)
└─────┬─────┘       └──────▲──────┘
      │                    │
      │ 1                  │ 1
      │                    │
      │ N                  │ N
┌─────▼─────┐ 1   N ┌──────┴──────┐
│PU_GOODSRCV├──────►│PU_GOODSRCVLN│ (Goods Receipt / Penerimaan Barang)
└───────────┘       └─────────────┘
```

### 2.1 Kelompok Tabel Purchase Requisition (PR)
Digunakan untuk mencatat permintaan pembelian barang dari divisi/lapangan sebelum disetujui untuk dipesan.

#### A. `IN_PR` (Header Purchase Requisition)
Menyimpan informasi utama dokumen PR.
* **Primary Key:** `(PRID, LocCode)` - Composite PK.
* **Kolom Penting:**
  * `PRID` (char, 100): Nomor dokumen PR. Format: `PR` + YY + 6-digit sequence (contoh: `PR26009918`).
  * `LocCode` (char, 8): Kode lokasi asal PR (contoh: `PTRJ    `).
  * `PRType` (char, 3): Tipe PR:
    * `'1 '` = General / Non-Stock
    * `'2 '` = Stock Item
    * `'4 '` = Workshop / Maintenance
    * `'6 '` = Nursery
  * `Status` (char, 2): Status alur dokumen PR:
    * `'1 '` = Open / Draft / Pending Approval
    * `'2 '` = Approved / Confirmed
    * `'3 '` = Partially Fulfilled
    * `'4 '` = Fulfilled / Completed
    * `'6 '` = Closed / Archived / Canceled
  * `PRDate` (datetime): Tanggal dokumen PR dibuat.
  * `TotalAmount` (decimal): Total nilai estimasi (sering bernilai 0 pada tabel ini karena harga final diikat di PO).

#### B. `IN_PRLN` (Line Item Purchase Requisition)
Menyimpan detail barang yang diminta dalam satu PR.
* **Primary Key:** `(PRID, ItemCode, PRLnID)` - Composite PK.
* **Kolom Penting:**
  * `PRID` (char, 20): FK ke `IN_PR.PRID`.
  * `ItemCode` (char, 20): Kode barang yang diminta.
  * `PRLnID` (char, 20): ID unik baris PR. Format: `PRLN` + YY + 6-digit sequence.
  * `QtyReq` (decimal): Jumlah barang yang diminta.
  * `QtyRcv` (decimal): Jumlah barang yang sudah diterima/terpenuhi.
  * `QtyOutstanding` (decimal): Sisa barang yang belum terpenuhi (`QtyReq` - `QtyRcv`).
  * `Cost` (decimal): Estimasi biaya satuan.
  * `Amount` (decimal): Total estimasi biaya baris (`QtyReq` * `Cost`).
  * `Status` (char, 2): Status baris (`'1 '` = Open, `'2 '` = Closed/Fulfilled).

#### C. `IN_PRLN_ACC` (PR Accounting / Cost Allocation)
Mengatur alokasi anggaran dan pembebanan biaya untuk setiap baris PR.
* **Primary Key:** `ID` (bigint, Auto-Increment).
* **Kolom Penting:**
  * `TrxID` (varchar, 20): FK ke `IN_PRLN.PRLnID`.
  * `AccCode` (varchar, 20): Kode Akun GL (General Ledger) pembebanan biaya.
  * `BlkCode` (varchar, 20): Kode Blok Kebun atau Station Pabrik (contoh: `STN-BLR` untuk Boiler).
  * `SubBlkCode` (varchar, 20): Sub-blok/sub-station.
  * `WsJobCode` (varchar, 20): Kode pekerjaan bengkel (jika `PRType = '4'`).
  * `Dim19` (varchar, 20): Kode lokasi pembebanan (bernilai `'PTRJ'` pada data contoh).

---

### 2.2 Kelompok Tabel Purchase Order (PO)
Mencatat pemesanan resmi kepada Supplier yang telah disetujui. **Di sinilah harga barang dikunci.**

#### A. `PU_PO` (Header Purchase Order)
Menyimpan informasi utama dokumen PO.
* **Primary Key:** `POID` (varchar).
* **Kolom Penting:**
  * `POID` (varchar): Nomor dokumen PO. Format: `00/PRP/LOK/YY/M/Seq` (contoh: `00/PRP/LOK/26/4/7694`).
  * `PODate` (datetime): Tanggal dokumen PO dibuat.
  * `SupplierCode` (varchar): FK ke `PU_SUPPLIER.SupplierCode`.
  * `LocCode` (varchar): Lokasi pembuatan PO (contoh: `P1A`).
  * `Status` (char): Status dokumen PO.

#### B. `PU_POLN` (Line Item Purchase Order)
Menyimpan detail barang dan harga pemesanan. **Ini adalah tabel krusial karena merupakan satu-satunya tempat penyimpanan harga beli satuan.**
* **Primary Key:** `POLnID` (varchar).
* **Kolom Penting:**
  * `POLnID` (varchar): ID unik baris PO (contoh: `NPOL26044335`).
  * `POID` (varchar): FK ke `PU_PO.POID`.
  * `ItemCode` (varchar): Kode barang yang dipesan.
  * `QtyOrder` (decimal): Jumlah barang yang dipesan.
  * `QtyDelv` (decimal): Jumlah barang yang sudah dikirim/diterima.
  * `Cost` (decimal): **Harga Satuan Barang** (Unit Price).
  * `Amount` (decimal): Nilai Kotor (`Cost` * `QtyOrder`).
  * `NetAmt` (decimal): Nilai Bersih setelah diskon dan pajak (`Amount` - `DiscAmt` + `TaxAmt`).

---

### 2.3 Kelompok Tabel Goods Receipt (GR)
Mencatat penerimaan fisik barang dari Supplier berdasarkan PO yang telah dikirimkan.

#### A. `PU_GOODSRCV` (Header Goods Receipt)
Menyimpan data pengiriman barang masuk.
* **Primary Key:** `GoodsRcvID` (varchar).
* **Kolom Penting:**
  * `GoodsRcvID` (varchar): Nomor dokumen GR. Format: `GCP1A` + YY + 6-digit sequence. Contoh: `GCP1A26009896`.
  * `GoodsRcvRefNo` (varchar): Nomor Surat Jalan / Referensi dari supplier.
  * `GoodsRcvRefDate` (datetime): Tanggal diterimanya barang di lokasi.
  * `LocCode` (varchar): Lokasi penerimaan (contoh: `P1A`).
  * `SupplierCode` (varchar): FK ke `PU_SUPPLIER.SupplierCode`.
  * `POID` (varchar): FK ke `PU_PO.POID`.
  * `Status` (char): Status dokumen GR (`'1'` = Draft, `'2'` = Confirmed, `'3'` = Pending, `'5'` = Posted/Final).
  * `AccMonth` / `AccYear` (int): Bulan dan Tahun periode pembukuan akuntansi saat barang diterima.

#### B. `PU_GOODSRCVLN` (Line Item Goods Receipt)
Menyimpan detail kuantitas barang yang diterima secara fisik.
* **Primary Key:** `GoodsRcvLnID` (varchar).
* **Kolom Penting:**
  * `GoodsRcvLnID` (varchar): ID unik baris GR. Format: `GCLP1A` + YY + 6-digit sequence.
  * `GoodsRcvID` (varchar): FK ke `PU_GOODSRCV.GoodsRcvID`.
  * `ItemCode` (varchar): Kode barang yang diterima.
  * `ReceiveQty` (decimal): Kuantitas barang yang diterima secara fisik.
  * `POLnID` (varchar): FK ke `PU_POLN.POLnID`. **Kunci utama untuk mendapatkan data harga!**
  * `AccCode` (varchar): Kode Akun pembebanan biaya.
  * `ChargeTo` (varchar): Lokasi pembebanan biaya.

> [!CAUTION]
> **Peringatan Keras:** Kolom `Cost` dan `Amount` **TIDAK ADA** di tabel `PU_GOODSRCVLN`! 
> Untuk mendapatkan harga satuan dan total nilai transaksi Goods Receipt, Anda **wajib** melakukan JOIN ke tabel `PU_POLN` menggunakan relasi `PU_GOODSRCVLN.POLnID = PU_POLN.POLnID`, lalu mengalikan `PU_GOODSRCVLN.ReceiveQty * PU_POLN.Cost`.

---

### 2.4 Master Pendukung
* **`PU_SUPPLIER` (Master Supplier):** Menyimpan data lengkap vendor (SupplierCode (PK), Name, Address, Email, TelNo, Status, CreditLimit, dll).
* **`IN_ITEM` (Master Item):** Menyimpan katalog barang (ItemCode (PK), Description, UOMCode, ProdTypeCode, ProdCatCode, ReorderLevel, QtyOnHand).
* **`IN_PRODTYPE` (Master Tipe Produk):** Kategori tipe barang (ProdTypeCode (PK), Description, ParentCode). Contoh: `PUPUK` = Pupuk, `BBMIN` = Bahan Bakar Minyak, `INVTR` = Inventaris Perumahan & Kantor.

---

## 3. Query SQL Utama pada API Dashboard

Berikut adalah query-query SQL penting yang digunakan untuk menyajikan data laporan procurement di Dashboard.

### 3.1 Outstanding Purchase Requisition (PR)
Query ini menyajikan laporan detail baris PR yang belum terpenuhi (`QtyOutstanding > 0`) beserta status dokumennya.

```sql
SELECT TOP 100
  RTRIM(h.PRID) AS DokumenPR,
  h.PRDate AS TanggalPR,
  RTRIM(h.LocCode) AS Gudang,
  RTRIM(h.PRType) AS TipePR,
  RTRIM(h.Status) AS StatusPR,
  RTRIM(l.PRLnID) AS BarisPR,
  RTRIM(l.ItemCode) AS KodeBarang,
  RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
  CAST(ISNULL(l.QtyReq, 0) AS DECIMAL(18,2)) AS QtyRequest,
  CAST(ISNULL(l.QtyRcv, 0) AS DECIMAL(18,2)) AS QtyReceived,
  CAST(ISNULL(l.QtyOutstanding, 0) AS DECIMAL(18,2)) AS QtyOutstanding,
  CAST(ISNULL(l.Cost, 0) AS DECIMAL(18,2)) AS Cost,
  CAST(ISNULL(l.Amount, 0) AS DECIMAL(18,2)) AS Amount,
  RTRIM(l.Status) AS StatusLine
FROM [db_ptrj_mill].[dbo].[IN_PRLN] l
INNER JOIN [db_ptrj_mill].[dbo].[IN_PR] h ON l.PRID = h.PRID
LEFT JOIN [db_ptrj_mill].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
WHERE h.PRDate >= '2000-01-01'
ORDER BY ISNULL(l.QtyOutstanding, 0) DESC, h.PRDate DESC
```

### 3.2 Goods Receipt Listing (Aktivitas Penerimaan Barang)
Query ini digunakan untuk memantau barang masuk dari supplier beserta total nilainya. Perhatikan join ke `PU_POLN` untuk mengambil harga satuan (`Cost`).

```sql
SELECT TOP 100
  h.GoodsRcvID AS [No. Goods Receipt],
  h.GoodsRcvRefNo AS [No. Referensi / Surat Jalan],
  CONVERT(VARCHAR, h.GoodsRcvRefDate, 23) AS [Tgl. Penerimaan],
  h.LocCode AS [Lokasi],
  RTRIM(h.SupplierCode) AS [Kode Supplier],
  RTRIM(s.Name) AS [Nama Supplier],
  h.POID AS [No. PO],
  CASE h.Status
    WHEN '1' THEN 'Draft'
    WHEN '2' THEN 'Confirmed'
    WHEN '3' THEN 'Pending'
    WHEN '5' THEN 'Posted / Final'
  END AS [Status Document],
  RTRIM(l.ItemCode) AS [Kode Barang],
  RTRIM(i.Description) AS [Nama Barang],
  l.ReceiveQty AS [Qty Diterima],
  p.Cost AS [Harga Satuan (PO)],
  CAST((l.ReceiveQty * p.Cost) AS DECIMAL(18,2)) AS [Total Nilai GR]
FROM [db_ptrj].[dbo].[PU_GOODSRCVLN] l
INNER JOIN [db_ptrj].[dbo].[PU_GOODSRCV] h ON l.GoodsRcvID = h.GoodsRcvID
LEFT JOIN [db_ptrj].[dbo].[PU_SUPPLIER] s ON RTRIM(h.SupplierCode) = RTRIM(s.SupplierCode)
LEFT JOIN [db_ptrj].[dbo].[PU_POLN] p ON l.POLnID = p.POLnID
LEFT JOIN [db_ptrj].[dbo].[IN_ITEM] i ON RTRIM(l.ItemCode) = RTRIM(i.ItemCode)
WHERE h.LocCode = 'P1A' 
  AND h.Status = '5' -- Posted saja
ORDER BY h.GoodsRcvRefDate DESC
```

### 3.3 Histori Pemesanan Barang per Supplier (PO History)
Query ini digunakan untuk melihat track record harga beli dan volume barang tertentu yang dipasok oleh supplier dari waktu ke waktu.

```sql
SELECT TOP 100
  RTRIM(l.ItemCode) AS KodeBarang,
  RTRIM(ISNULL(i.Description, l.LineDescription)) AS NamaBarang,
  RTRIM(h.SupplierCode) AS SupplierCode,
  RTRIM(ISNULL(s.Name, h.SupplierCode)) AS SupplierName,
  COUNT(DISTINCT h.POID) AS TotalPO,
  CAST(SUM(ISNULL(l.QtyOrder, 0)) AS DECIMAL(18,2)) AS QtyOrder,
  CAST(SUM(ISNULL(l.QtyReceive, 0)) AS DECIMAL(18,2)) AS QtyReceive,
  CAST(SUM(ISNULL(l.Amount, 0)) AS DECIMAL(18,2)) AS TotalPOAmount,
  MIN(h.PODate) AS PODatePertama,
  MAX(h.PODate) AS PODateTerakhir
FROM [db_ptrj].[dbo].[PU_PO] h
INNER JOIN [db_ptrj].[dbo].[PU_POLN] l ON l.POID = h.POID
LEFT JOIN [db_ptrj].[dbo].[PU_SUPPLIER] s ON s.SupplierCode = h.SupplierCode
LEFT JOIN [db_ptrj].[dbo].[IN_ITEM] i ON i.ItemCode = l.ItemCode AND i.LocCode = h.LocCode
WHERE h.PODate >= '2000-01-01'
GROUP BY 
  RTRIM(l.ItemCode), 
  RTRIM(ISNULL(i.Description, l.LineDescription)), 
  RTRIM(h.SupplierCode), 
  RTRIM(ISNULL(s.Name, h.SupplierCode))
ORDER BY TotalPOAmount DESC
```

### 3.4 Kinerja Supplier Terintegrasi (Supplier Performance)
Query ini menggabungkan data transaksi PO, GR, dan Invoice Hutang Dagang (`AP_INVOICERCV`) menggunakan CTE untuk mengukur performa supplier.

```sql
WITH po_summary AS (
  SELECT h.SupplierCode, COUNT(DISTINCT h.POID) AS TotalPO, SUM(ISNULL(l.Amount,0)) AS POAmount,
    SUM(ISNULL(l.QtyOrder,0)) AS QtyOrder, SUM(ISNULL(l.QtyReceive,0)) AS QtyReceive, MAX(h.PODate) AS LastPODate
  FROM [db_ptrj].[dbo].[PU_PO] h
  JOIN [db_ptrj].[dbo].[PU_POLN] l ON l.POID = h.POID
  WHERE h.PODate >= '2000-01-01'
  GROUP BY h.SupplierCode
),
gr_summary AS (
  SELECT h.SupplierCode, COUNT(DISTINCT h.GoodsRcvID) AS TotalGR, SUM(ISNULL(l.ReceiveQty,0)) AS ReceiveQty,
    SUM(ISNULL(l.CommAmount,0)) AS ReceiveAmount, MAX(h.PostDate) AS LastGRDate
  FROM [db_ptrj].[dbo].[PU_GOODSRCV] h
  JOIN [db_ptrj].[dbo].[PU_GOODSRCVLN] l ON l.GoodsRcvID = h.GoodsRcvID
  WHERE h.PostDate >= '2000-01-01'
  GROUP BY h.SupplierCode
),
inv_summary AS (
  SELECT SupplierCode, COUNT(DISTINCT InvoiceRcvID) AS TotalInvoice,
    SUM(ISNULL(GrandTotal, ISNULL(TotalAmount,0))) AS InvoiceAmount,
    SUM(ISNULL(OutstandingAmount,0)) AS OutstandingInvoiceAmount
  FROM [db_ptrj].[dbo].[AP_INVOICERCV]
  WHERE PostDate >= '2000-01-01'
  GROUP BY SupplierCode
)
SELECT TOP 100
  RTRIM(s.SupplierCode) AS SupplierCode,
  RTRIM(s.Name) AS SupplierName,
  ISNULL(po.TotalPO, 0) AS TotalPO,
  CAST(ISNULL(po.POAmount, 0) AS DECIMAL(18,2)) AS POAmount,
  ISNULL(gr.TotalGR, 0) AS TotalGoodsReceive,
  CAST(ISNULL(gr.ReceiveAmount, 0) AS DECIMAL(18,2)) AS ReceiveAmount,
  ISNULL(inv.TotalInvoice, 0) AS TotalInvoice,
  CAST(ISNULL(inv.InvoiceAmount, 0) AS DECIMAL(18,2)) AS InvoiceAmount,
  CAST(ISNULL(inv.OutstandingInvoiceAmount, 0) AS DECIMAL(18,2)) AS OutstandingInvoice
FROM [db_ptrj].[dbo].[PU_SUPPLIER] s
LEFT JOIN po_summary po ON po.SupplierCode = s.SupplierCode
LEFT JOIN gr_summary gr ON gr.SupplierCode = s.SupplierCode
LEFT JOIN inv_summary inv ON inv.SupplierCode = s.SupplierCode
ORDER BY POAmount DESC
```

---

## 4. Alur Kerja (Workflow) Data Procurement

Proses pengadaan barang di PT Rebinmas Jaya mengikuti siklus berikut di dalam database:

```
[1. Purchase Requisition]
  ├── User di divisi kebun/pabrik membuat daftar permintaan barang.
  ├── Tersimpan di IN_PR (Header) & IN_PRLN (Detail).
  └── Alokasi budget didefinisikan di IN_PRLN_ACC (BlkCode, AccCode).
            │
            ▼
[2. Purchase Order]
  ├── PR yang disetujui ditarik menjadi dokumen Purchase Order resmi.
  ├── Tersimpan di PU_PO (Header) & PU_POLN (Detail).
  └── Nilai harga unit final (Cost) dan kuantitas dipesan diikat pada PU_POLN.
            │
            ▼
[3. Goods Receive (Penerimaan Barang)]
  ├── Barang tiba secara fisik dari Supplier.
  ├── Tercatat di PU_GOODSRCV (Header) & PU_GOODSRCVLN (Detail).
  ├── ReceiveQty mencatat kuantitas fisik yang benar-benar masuk gudang.
  └── Harga unit dirujuk kembali ke baris PO asal via POLnID.
            │
            ▼
[4. Invoice & Account Payable (Hutang Dagang)]
  ├── Supplier mengirim tagihan/invoice atas Goods Receipt yang sudah posted.
  ├── Tercatat di AP_INVOICERCV dengan referensi SupplierCode.
  └── Mencakup total tagihan (GrandTotal) dan sisa hutang (OutstandingAmount).
```

---

## 5. Peringatan & "Gotchas" Penting bagi Developer

Jika Anda menulis kueri atau modul baru untuk Procurement di aplikasi ini, harap patuhi aturan ketat berikut:

> [!IMPORTANT]
> **1. Masalah Karakter Padded (Spasi Kanan):**
> Hampir seluruh kode identifikasi (`ItemCode`, `SupplierCode`, `LocCode`, `PRID`, `Status`, `AccCode`) bertipe data `CHAR` dan di-pad dengan spasi di sebelah kanan.
> * **Aturan:** Selalu gunakan fungsi `RTRIM()` saat melakukan seleksi kolom untuk API JSON.
> * **Aturan:** Selalu gunakan `RTRIM(a.Col) = RTRIM(b.Col)` saat melakukan `JOIN` or filter `WHERE` untuk memastikan perbandingan string berhasil tanpa hambatan spasi kosong.
> 
> **2. Menghitung Nilai Goods Receipt:**
> Kolom `Cost` pada tabel `PU_GOODSRCVLN` tidak ada. 
> * **Aturan:** Lakukan `LEFT JOIN PU_POLN p ON l.POLnID = p.POLnID` dan hitung nilai dengan rumus: `l.ReceiveQty * p.Cost`. Jangan pernah berasumsi nilai tersimpan secara langsung di tabel GR Line.
> 
> **3. Komposit Primary Key pada PR:**
> Tabel `IN_PR` menggunakan komposit primary key `(PRID, LocCode)`. Dokumen dengan ID yang sama secara teoretis dapat ada di lokasi (kebun/pabrik) berbeda.
> * **Aturan:** Ketika menghubungkan `IN_ITEM` atau detail transaksi lain ke header PR, selalu sertakan parameter lokasi (`LocCode`) sebagai bagian dari join condition.
> 
> **4. Status Dokumen vs Status Baris:**
> Baik tabel Header (`IN_PR`, `PU_GOODSRCV`) maupun tabel Line (`IN_PRLN`, `PU_GOODSRCVLN`) memiliki kolom `Status` secara terpisah.
> * **Aturan:** Dokumen yang sudah disetujui atau diposting (posted) ditandai dengan status tertentu di tingkat header (contoh: `h.Status = '5'` untuk GR Posted). Selalu filter status header untuk memastikan keabsahan data laporan keuangan/operasional.
