# PRD: Optimasi Performa Halaman Report Detail

## Ringkasan

Halaman detail report inventory harus dibuat lebih ringan tanpa mengubah desain visual dan tanpa menghilangkan fitur utama. Masalah utama saat ini adalah halaman dapat memuat ribuan row sekaligus, lalu browser melakukan search, sort, group, subtotal, opsi filter, render tabel, dan AI analysis dari payload yang sama. Akibatnya halaman terasa berat terutama untuk report listing seperti `asset-stock-valuasi-listing` dan stock aging.

Target PRD ini adalah membuat halaman report detail terasa cepat, tetap akurat, dan menampilkan loading yang jelas sampai data tabel benar-benar siap dirender.

## Tujuan Produk

1. Halaman detail report tampil lebih cepat dan tidak freeze saat membuka report besar.
2. Desain existing tetap dipertahankan.
3. Data tabel yang tampil harus benar sesuai filter, periode, sort, dan source yang dipilih.
4. User melihat loading state yang jelas saat data belum siap.
5. Export CSV/Excel/PDF tetap bisa mengambil data lengkap.
6. AI analysis tidak boleh memblokir render tabel.

## Non-Goals

1. Tidak redesign tampilan halaman.
2. Tidak menghapus fitur filter, group, export, print, AI, atau table detail.
3. Tidak mengubah definisi bisnis report.
4. Tidak mengganti SQL Gateway.

## Masalah Saat Ini

### 1. Full payload terlalu besar

Beberapa report memakai mode `limit=all` agar data lengkap tersedia di client. Contoh asset stock valuation listing bisa memuat 7.539 row dengan banyak kolom. Untuk report lain jumlah row dapat lebih besar.

Dampak:

1. JSON response besar.
2. Parsing JSON berat.
3. React state menyimpan array besar.
4. Render tabel dan group lambat.

### 2. Banyak proses dilakukan di browser

Client melakukan beberapa proses di atas seluruh row:

1. Search lintas semua kolom.
2. Sort.
3. Grouping.
4. Subtotal.
5. Unique values untuk filter dropdown.
6. Perhitungan table total.

Ini membuat UI berat walaupun hanya 20 sampai 100 row yang terlihat.

### 3. Loading belum membedakan fase data

Loading saat ini bersifat umum. User belum mendapat sinyal jelas apakah:

1. Request API sedang jalan.
2. Data sudah diterima tapi masih diproses.
3. Table columns dan rows sudah valid.
4. Tabel aman dirender.

### 4. AI dan chart berpotensi ikut menambah beban

AI analysis sudah ditunda dan payload sample sudah dibatasi, tetapi harus tetap dipastikan tidak memblokir table readiness. Chart juga sebaiknya memakai data summary/chart dari server, bukan scanning semua row di client untuk report besar.

## Prinsip Solusi

1. Server menjadi sumber kebenaran untuk paging, search, sort, dan filter berat.
2. Client hanya merender page aktif, bukan seluruh dataset.
3. Summary dan KPI berasal dari query agregat server, bukan hasil subtotal row page aktif.
4. Export full data tetap melalui endpoint export khusus atau `limit=all` on demand, bukan saat halaman pertama dibuka.
5. Loading harus tampil sampai `payload.columns`, `payload.rows`, `payload.summary`, dan metadata request sudah konsisten.
6. Tidak ada perubahan visual besar. Komponen existing hanya diberi state loading, disabled state, dan lazy render.

## Functional Requirements

### FR-1: Initial Load Ringan

Halaman detail report pertama kali hanya memuat:

1. Metadata report.
2. Summary KPI.
3. Chart data ringkas.
4. Page pertama tabel.
5. Total row count.

Default page size tetap mengikuti UI saat ini, misalnya 20 atau 50 row.

### FR-2: Server-Side Table Query

Endpoint inventory report perlu mendukung parameter:

```text
page
pageSize
search
sortColumn
sortDirection
groupBy
columnFilters
period / accYear / accMonth
source
```

Response harus berisi:

```json
{
  "rows": [],
  "columns": [],
  "summary": {},
  "chart": [],
  "metadata": {
    "page": 1,
    "pageSize": 50,
    "totalRows": 7539,
    "filteredRows": 7539,
    "sortColumn": "actual_period",
    "sortDirection": "desc",
    "tableReady": true,
    "queryId": "..."
  }
}
```

### FR-3: Loading Gate Untuk Tabel

Tabel tidak boleh render sampai kondisi berikut terpenuhi:

1. `loading === false`
2. `payload !== null`
3. `payload.columns.length > 0`
4. `payload.rows` adalah array
5. `payload.metadata.tableReady === true` atau validasi client setara lolos
6. request terbaru sama dengan response terbaru, supaya response lama tidak menimpa data baru

Jika belum siap, tampilkan skeleton table dengan layout yang sama.

### FR-4: Stale Response Protection

Setiap fetch report harus memakai `requestId` atau `AbortController`.

Behavior:

1. Saat filter berubah, request lama dibatalkan.
2. Response lama yang datang terlambat diabaikan.
3. Loading tetap tampil sampai request terbaru selesai.

### FR-5: Server-Side Sorting

Sort header tetap ada seperti sekarang, tetapi klik sort mengirim request baru ke server. Client tidak perlu sort seluruh rows untuk report besar.

Fallback:

1. Untuk report kecil, client sort boleh tetap dipakai.
2. Untuk report besar atau profile `fullListing`, wajib server-side sort.

### FR-6: Server-Side Search

Search table menggunakan debounce tetap dipertahankan, tetapi query search dikirim ke server. Client tidak scanning seluruh object row.

Search harus memakai allowlist kolom per report, bukan semua kolom bebas.

### FR-7: Grouping Ringan

Default group tetap terlihat. Untuk report besar:

1. Group header dan subtotal dihitung server.
2. Client hanya render group yang muncul pada page aktif.
3. Expand/collapse tetap di client untuk page aktif.

Jika user butuh full grouped listing, export atau full table mode menjalankan request khusus.

### FR-8: Export Tetap Full Data

Tombol Excel, CSV, PDF tidak boleh tergantung row page aktif.

Behavior:

1. Export memanggil endpoint export dengan filter aktif.
2. Endpoint export mengambil data lengkap dari server.
3. UI menampilkan loading/progress export.
4. File hasil export tetap sama secara bisnis dengan report.

### FR-9: AI Tidak Memblokir Tabel

AI analysis berjalan setelah table ready.

Rules:

1. AI mulai minimal 1 sampai 2 detik setelah table ready.
2. AI hanya menerima summary, metadata, chart, dan sample maksimal 50 row.
3. Jika AI gagal, tabel tetap tampil.

### FR-10: Full Table Mode Aman

Mode full table tidak otomatis memuat semua row. Mode ini berarti table memakai viewport lebih besar, bukan full dataset.

Jika user butuh semua row, gunakan export.

## Loading UX Requirements

### State 1: Initial Loading

Tampil saat halaman pertama dibuka atau source/report berubah.

Copy:

```text
Memuat data report...
Menyiapkan summary dan tabel.
```

Visual:

1. KPI skeleton.
2. Filter disabled.
3. Table skeleton 8 sampai 12 row.
4. Tombol export disabled.

### State 2: Table Refresh Loading

Tampil saat filter/search/sort/page berubah.

Copy:

```text
Memperbarui tabel...
```

Visual:

1. Overlay ringan di area tabel.
2. Header dan kontrol tetap terlihat.
3. Row lama boleh tetap terlihat dengan opacity rendah, tetapi tidak boleh dianggap final.

### State 3: Table Ready

Tampil setelah validasi payload sukses.

Rules:

1. Row count harus muncul.
2. Period/source metadata harus muncul.
3. Tombol export aktif.
4. Sort indicator sesuai server response.

### State 4: Empty Result

Jika filter valid tapi row kosong:

```text
Tidak ada data untuk filter ini.
```

Metadata periode dan source tetap tampil supaya user tahu data mana yang sedang dicari.

### State 5: Error

Jika API gagal:

```text
Gagal memuat laporan.
```

Tampilkan error ringkas dan tombol retry.

## Technical Requirements

### TR-1: Report Payload Split

Pisahkan response menjadi dua mode:

1. `mode=page` untuk halaman detail.
2. `mode=export` untuk data lengkap.

Default halaman detail harus memakai `mode=page`.

### TR-2: Query Contract

Handler report wajib mengembalikan:

1. `rows`: hanya row page aktif.
2. `summary`: agregat seluruh filter.
3. `chart`: agregat ringkas.
4. `metadata.totalRows`: total semua data scope.
5. `metadata.filteredRows`: total setelah filter.
6. `metadata.tableReady`: boolean.
7. `metadata.queryId`: id unik request.

### TR-3: SQL Pagination

Gunakan pola SQL Server:

```sql
ORDER BY <safe_column> <direction>
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
```

Jika query existing memakai `TOP`, migrasi bertahap per report.

### TR-4: Safe Sort Allowlist

`sortColumn` dari client harus dipetakan ke allowlist kolom SQL. Jangan interpolasi kolom mentah dari query string.

Contoh:

```ts
const sortColumns = {
  total_amount: 'total_amount',
  item_code: 'RTRIM(i.ItemCode)',
  product_type_code: 'RTRIM(i.ProdTypeCode)',
}
```

### TR-5: Client Rendering Optimization

1. Render hanya `pageRows`.
2. Jangan build `tableGroups` dari seluruh dataset untuk report besar.
3. Jangan hitung unique filter values dari seluruh rows di client untuk report besar.
4. Memoize visible columns dan formatter.
5. Lazy render expanded row detail.
6. Pertimbangkan `react-window` atau simple row virtualization jika row page size di atas 100.

### TR-6: Data Correctness Guard

Tambahkan function client:

```ts
function isReportPayloadReady(payload) {
  return Boolean(
    payload &&
    Array.isArray(payload.rows) &&
    Array.isArray(payload.columns) &&
    payload.columns.length > 0 &&
    payload.summary &&
    payload.metadata
  )
}
```

Tabel hanya render jika guard true.

### TR-7: Observability

Tambahkan log metadata:

1. report id
2. source
3. period
4. page
5. pageSize
6. filteredRows
7. server query ms
8. response size estimate

## Report Prioritas

### Phase 1

1. `asset-stock-valuasi-listing`
2. `item-movement-update-tracking`
3. `monthly-stock-account-movement-details`

Alasan: report ini paling besar dan paling sering berat di browser.

### Phase 2

1. `penerimaan-barang`
2. `pengeluaran-barang`
3. `purchase-order-history`
4. `supplier-purchasing-performance`

### Phase 3

Report kecil lain tetap memakai pattern yang sama untuk konsistensi.

## Acceptance Criteria

1. Halaman detail report besar terbuka dengan skeleton dalam kurang dari 500 ms.
2. Tabel page pertama siap dalam target 2 sampai 5 detik tergantung query database.
3. Browser tidak freeze saat membuka report 7.000+ row.
4. Sort table tidak memproses seluruh dataset di client untuk report besar.
5. Search table tidak scanning seluruh dataset di client untuk report besar.
6. Export tetap menghasilkan seluruh data sesuai filter aktif.
7. KPI dan summary tetap menghitung seluruh data filtered scope, bukan hanya page aktif.
8. Table loading muncul sampai payload valid.
9. Response lama tidak bisa menimpa response baru setelah filter berubah cepat.
10. Desain visual tetap sama.

## Implementation Plan

### Step 1: Loading Guard dan Request Safety

1. Tambah `tableLoading`, `tableReady`, `requestId`, dan `AbortController`.
2. Tabel render skeleton sampai payload siap.
3. Disable export saat table belum ready.
4. Pastikan response lama diabaikan.

### Step 2: Page Mode API

1. Tambah `page` dan `pageSize` pada API inventory.
2. Tambah `metadata.totalRows` dan `metadata.filteredRows`.
3. Untuk report besar, default `limit=page`, bukan `limit=all`.

### Step 3: Server-Side Search dan Sort

1. Pindahkan search dan sort utama ke SQL allowlist.
2. Client klik sort trigger fetch baru.
3. Search debounce tetap 350 ms.

### Step 4: Server-Side Group Summary

1. Tambah endpoint atau payload `groups`.
2. Group subtotal dihitung SQL.
3. Client render group page aktif.

### Step 5: Export On Demand

1. Export button memanggil `mode=export`.
2. Tampilkan export loading.
3. Jangan simpan full export rows di state utama.

### Step 6: Optional Virtualization

1. Jika page size > 100, aktifkan virtualization.
2. Sticky header dan sticky first column tetap dijaga.

## Risks

1. SQL per report berbeda, sehingga pagination harus dibuat per handler dengan hati-hati.
2. Group subtotal harus tetap sama dengan full report, bukan hanya page aktif.
3. Export full data dapat berat di server jika tidak diberi timeout/progress.
4. Natural filter harus tetap compatible dengan server-side filter.

## Open Questions

1. Batas maksimal page size untuk UI: 50, 100, atau 200?
2. Export PDF harus full data atau mengikuti visible columns dan current filters saja?
3. Group subtotal harus tampil untuk semua group atau hanya group pada page aktif?
4. Perlu cache server per report + filter selama beberapa menit atau tidak?

## Definition of Done

1. PRD disetujui.
2. Phase 1 report memakai page mode.
3. Loading table-ready guard aktif.
4. Build dan typecheck lolos.
5. Total amount dan summary report tetap cocok dengan query SQL acuan.
6. Tidak ada perubahan desain visual yang signifikan.
