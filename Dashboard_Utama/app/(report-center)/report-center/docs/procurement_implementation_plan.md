# Procurement & Inventory Dashboard - Documentation & Plan

## 1. Konteks Bisnis
Sistem Dashboard Rebinmas menangani pelaporan dan metrik untuk dua bagian esensial dari proses suplai perusahaan:
1. **Procurement (Pengadaan)**: Proses yang mencakup siklus pembuatan dokumen dari Purchase Request (PR), Purchase Order (PO), hingga ke penerimaan barang (Goods Receipt / GR).
2. **Inventory (Stok)**: Melacak kuantitas dan nilai persediaan barang. Stok dipisahkan berdasarkan grup:
   - **Gudang (General/Regular Inventory)**: Menggunakan barang bertipe reguler. (`ItemType = '1'`)
   - **Workshop (Maintenance/Job Stock)**: Menggunakan barang bertipe workshop. (`ItemType = '4'`)

## 2. Struktur Data & Relasi (Database MS SQL)

Sistem membaca langsung dari database MS SQL sistem akuntansi/ERP. Karakteristik utama yang perlu diperhatikan adalah seluruh *string* berbentuk `CHAR` sehingga diperlukan `RTRIM()` saat melakukan pencocokan atau filter kondisi di query.

### Tabel Procurement:
- **`PU_PR` & `PU_PRLN`**: Tabel *Purchase Request* (Header & Detail). 
- **`PU_PO` & `PU_POLN`**: Tabel *Purchase Order*. Status order ('1' = Active/Approval, '3' = Closed/Received).
- **`PU_GOODSRCV` & `PU_GOODSRCVLN`**: Tabel *Goods Receipt*. Dokumen bukti barang masuk ke gudang/workshop.

### Tabel Inventory:
- **`IN_ITEM`**: Master data stok/aset. Di sini kita menentukan relasi gudang (`LocCode`), tipe item (`ItemType`), dan kuantitas tersisa (`QtyOnHand`, `QtyOnHold`, `QtyOnOrder`). 
- **`IN_STOCKISSUE` & `IN_STOCKISSUELN`**: Mencatat *stock out* (barang keluar) spesifik untuk Gudang (ItemType = '1').
- **`WS_JOBSTOCK`**: Mencatat pemakaian stok untuk keperluan Workshop/Bengkel (ItemType = '4', *filter TransType = 1*).
- **`IN_MTHENDITEM`**: Mencatat *snapshot* posisi stok pada akhir bulan (Historical balance).

## 3. Implementasi Saat Ini (Selesai)

Kita telah menyelesaikan fondasi dari pelaporan inventaris untuk membedakan antara stok Gudang dan stok Workshop.

### Filter `itemType`
- Telah ditambahkan parameter `itemType` pada `ReportFilterInput` (di `lib/reports/report-filtering.ts`).
- Pengguna (Frontend) sekarang bisa mem-passing tipe stok: `?itemType=1` (Gudang) atau `?itemType=4` (Workshop).

### Pembaruan API Laporan (`app/api/reports/inventory/route.ts`)
Semua API report inventori di bawah ini telah disesuaikan agar membaca parameter filter `itemType` secara dinamis:
1. **`stockSummary`**: Memfilter query summary (Total Stok, Nilai, Grafik) berdasarkan ItemType yang dikirimkan.
2. **`stockIssue`**: Memisahkan query pergerakan barang. Bila user mem-filter gudang, query yang berjalan adalah tabel `IN_STOCKISSUE`. Jika workshop, tabel `WS_JOBSTOCK`. Jika tidak dipilih (all), kedua tabel di-UNION.
3. **`assetStockValuationListing`**: Mengaplikasikan `itemTypeSql` ke query utama untuk validasi harga/nilai per item type.
4. **`allStockMovementAnalysis`**: Menerapkan filtering dinamis per-kategori pergerakan sesuai tipe item.

*Catatan: Seluruh proses pengecekan kode TypeScript sudah dilakukan tanpa error (`npx tsc --noEmit`).*

## 4. Rencana ke Depan (Future Plan)

Untuk agen AI / developer selanjutnya yang memegang tugas mengenai Procurement & Inventory, ikuti roadmap ini:

### Fase 1: Integrasi Laporan Procurement (PO & GR)
- **Tujuan**: Membuat laporan/endpoint untuk metrik Procurement (misal: "PO vs GR Ratio", "Lead Time Penerimaan", "Outstanding PR").
- **Tindakan**:
  - Implementasikan endpoint baru (misal di `app/api/reports/procurement/route.ts`).
  - Lakukan kueri JOIN dari `PU_PRLN` -> `PU_POLN` -> `PU_GOODSRCVLN` menggunakan identitas `POID` / `PRID`.
  - Harap berhati-hati dengan skema relasi one-to-many antara PO ke GR (karena satu PO bisa diterima berkali-kali - *partial receipt*). Gunakan CTE atau agresi kuantitas saat menghitung rasio penerimaan.

### Fase 2: Implementasi Dashboard UI Procurement
- **Tujuan**: Membangun tampilan tabel, grafik bar/pie, atau kartu informasi di frontend (`Dashboard_Utama`).
- **Tindakan**:
  - Gunakan komponen Recharts / tabel yang sudah ada di proyek untuk memvisualisasikan data Procurement (Lead Time, Outstanding Item).
  - Pastikan UI menyediakan Toggle / Dropdown untuk filter **"Gudang" (ItemType = 1)** dan **"Workshop" (ItemType = 4)** agar API inventori yang sudah dibuat sebelumnya dapat disajikan dalam tab atau mode yang terpisah secara visual.

### Fase 3: Peningkatan Analisis & Export (Opsional)
- Menambahkan kapabilitas download ke Excel (Export) dengan menyematkan format data mentah pada endpoint Procurement/Inventory.

---
**Peringatan Penting Saat Mengkoding**: 
- Selalu uji perubahan query SQL di script terpisah / exploration folder (`_dev_utils/explorations/`) jika membuat JOIN yang kompleks sebelum menerapkannya di `route.ts`.
- Gunakan `RTRIM()` untuk membandingkan string.
- Perhatikan penggunaan `NULLIF` dan `ISNULL` jika field mungkin bernilai kosong/spasi.
