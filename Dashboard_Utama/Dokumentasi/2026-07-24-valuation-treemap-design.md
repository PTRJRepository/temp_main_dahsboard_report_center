# Desain — ValuationTreemap (Distribusi Valuasi per Product Type)

Tanggal: 2026-07-24
Status: Disetujui user (brainstorming)
Lokasi implementasi: `Dashboard_Utama/`

## 1. Tujuan

Menambahkan visualisasi distribusi valuasi stok per Product Type di command deck
Report Center (`InventoryOverview`), dengan gaya "heatmap pasar saham": estetik,
insightful, dan sangat visual. Fokus dimensi: **per Product Type** (keputusan user).
Bentuk visual: **Treemap murni** (keputusan user, pendekatan A).

## 2. Batasan keras (wajib dipatuhi)

- Tanpa mengubah SQL / endpoint / logika data lama. Data diambil dari endpoint
  yang SUDAH ADA: `GET /api/reports/inventory/product-type-kpi?mode=list`.
- Tidak mengubah nilai token `--rc-*` di `app/globals.css`.
- Tidak menambah `!important` baru.
- Tidak memecah / memodifikasi `ReportViewerClient.tsx`.
- Tidak ada git commit tanpa persetujuan eksplisit.
- Mengikuti gaya visual forest/gelap yang sudah dipakai komponen sekitar.

## 3. Sumber data

Endpoint list `product-type-kpi` (mode=list) mengembalikan per product type:
- `code` (string), `name` (string)
- `itemCount` (number)
- `valuasi` (number) — dari `IN_ITEM`: `(QtyOnHand + QtyOnHold) * AverageCost`
- `issueQty`, `issueAmount` (number)
- `fastCount`, `movingCount`, `slowCount`, `deadCount` (number)
- `lastMovement` (string | null)

Parameter query yang dipakai (mengikuti filter global dari props):
`source`, `months`, dan opsional `itemType`, `location`.

Tidak perlu endpoint baru. Tidak perlu mengubah endpoint yang ada.

## 4. Komponen baru

`components/report-center/ValuationTreemap.tsx` — client component (`'use client'`).

Props:
```ts
{
  filters: ProductTypeFilters   // reuse tipe dari ProductTypeAnalysisPanel
  onDrilldown: (code: string) => void
}
```

- Fetch mandiri ke endpoint list dengan `filters` (sama persis pola
  `ProductTypeAnalysisPanel`: `gatewayBase()`, `formatRupiah`).
- Dependensi: Recharts `Treemap` (sudah terpasang `recharts@^3.10.0`, komponen
  `Treemap` tersedia). Tidak ada dependensi baru.

## 5. Struktur visual (gaya pasar saham)

- **Luas kotak = `valuasi`** type. Makin besar valuasi, makin besar kotak.
- **Warna = skala hijau forest berdasarkan konsentrasi** (persentase terhadap
  total). Type terbesar = aksen terang (`#18b96b` / token success), makin kecil
  makin gelap memudar ke `var(--rc-surface-raised)`. Langsung terlihat type dominan.
- **Label di dalam kotak**: nama type + valuasi (`formatRupiah` → `Rp X M/jt`)
  + persentase dari total. Kotak yang terlalu kecil → tanpa teks (detail via tooltip).
- **Tooltip kaya** (kartu gelap, konsisten dengan `ProductTypeDrilldown`): nama
  type, valuasi penuh, % total, jumlah item, issue amount, badge count
  Fast/Moving/Slow/Dead.
- **Klik kotak** → `onDrilldown(code)` → membuka popup `ProductTypeDrilldown`
  yang sudah ada (reuse, tanpa duplikasi).
- Custom `content` renderer untuk tile Recharts agar bisa kontrol warna, radius,
  label, dan `onClick`.

## 6. Penempatan & wiring

Di `components/report-center/InventoryOverview.tsx`:
- Import `ValuationTreemap`.
- Render sebagai seksi di atas/berdampingan dengan `ProductTypeAnalysisPanel`,
  masih dalam `<section>` command deck (sebelum blok "Analisis lain").
- Teruskan `filters` yang identik dengan panel list dan `onDrilldown={setDrillType}`
  (state `drillType` sudah ada), sehingga klik tile membuka popup KPI yang sama.

## 7. Data flow & fallback

- Filter keluar baris dengan `valuasi <= 0` (tidak punya luas).
- `total = Σ valuasi` baris valid.
- Sort descending by `valuasi` sebelum masuk Treemap.
- Batasi ~Top-24 type; gabungkan sisanya menjadi satu kotak "Lainnya" agar tetap
  terbaca. (Klik "Lainnya" tidak melakukan drilldown.)
- State konsisten dengan panel list:
  - `loading` → skeleton bergaya `rc-panel`.
  - `error` → pesan + tombol retry.
  - `empty` → "Belum ada valuasi pada scope ini".

## 8. Error handling & testing

- Bungkus `Treemap` dalam `ResponsiveContainer` dengan tinggi tetap (misal
  `h-[340px]`).
- Risiko rendah: murni presentational, tidak menyentuh backend.
- Verifikasi: `npx tsc --noEmit -p tsconfig.json` (exit 0) + `npx eslint` pada
  `ValuationTreemap.tsx` dan `InventoryOverview.tsx` (0 error; warning unused-vars
  lama dibiarkan sesuai batasan).
- Uji render manual di halaman Report Center (bila server dev tersedia).

## 9. Yang TIDAK dikerjakan (out of scope)

- Tidak ada toggle dimensi (movement category / lokasi) — fokus per Product Type.
- Tidak ada panel Pareto/ABC terpisah (itu pendekatan C, tidak dipilih).
- Tidak mengubah endpoint, SQL, atau perhitungan valuasi.
- Tidak menambah dependensi baru.
