# Spec: Redesign Report Center (Terminal Gelap Premium) + Drill-Down KPI per Product Type

Tanggal: 2026-07-24
Status: Disetujui (menunggu rencana implementasi)
Bahasa artefak repo: mengikuti konvensi repo (dok ini memakai istilah UI Indonesia yang sudah dipakai di codebase).

## Ringkasan

Dua halaman Report Center direstyle total ke gaya "terminal gelap premium" ala aplikasi
keuangan profesional internasional, tanpa mengubah logika/data — dan satu fitur baru
ditambahkan: drill-down KPI per product type.

Tiga permukaan yang disentuh:

1. Halaman pemilihan modul Report Center (landing).
2. Halaman report detail (`ReportViewerClient`).
3. Fitur baru: panel + popup drill-down KPI per product type di command deck inventory.

Batasan keras (dari keputusan user):

- **Restyle visual penuh, TANPA mengubah logika/data.** Tidak ada pemecahan 5117 baris
  logika `ReportViewerClient`, tidak ada perubahan query SQL, tidak ada perubahan
  progressive stream / tabel virtual / AI Q&A / export.
- **Tidak mengubah nilai token `--rc-*` global** (dipakai 261 referensi di banyak halaman).
  Konsolidasi warna dilakukan dengan mengganti sumber class/hex di komponen, bukan mengubah
  token.
- **Kartu modul = langsung navigasi** (bukan select-then-detail).
- Mood: **terminal gelap premium** (lanjutkan forest dark yang ada, dirapikan total).

## Keputusan desain (terkunci)

| Pertanyaan | Keputusan |
| --- | --- |
| Kedalaman redesign | Restyle visual penuh (tanpa ubah logika) |
| Interaksi kartu modul | Klik kartu = langsung navigasi ke `module.route` |
| Arah estetika | Terminal gelap premium (forest dark dirapikan) |
| Titik masuk product type | Panel baru di command deck (`InventoryOverview`) |
| Isi popup product type | Valuasi + Total Usage, Movement category, Top items, Trend bulanan |
| Scope data product type | Ikut filter global (period, movementWindow, itemType, location) |
| List vs popup | List ringkas, popup lengkap |
| Backend product type | Endpoint baru + kolom `Source` di CTE issue |

## Bagian A — Fondasi desain bersama ("Terminal Gelap Premium")

Prinsip yang dipakai di ketiga permukaan:

- **Konsolidasi ke token forest `--rc-*`** sebagai satu-satunya sumber warna. Hilangkan
  kebutuhan override `!important` untuk halaman yang direstyle dengan cara **mengganti tone
  pastel Tailwind langsung di sumbernya** (`KPI_TONES`, banner hardcode) menjadi kelas/token
  forest — BUKAN menambah override baru. Override `!important` lama di `globals.css` dibiarkan
  (agar halaman lain tidak rusak), cukup tidak dipakai lagi oleh halaman yang direstyle.
- **Hierarki tipografi financial**: judul/angka utama `rc-display` (Sora); semua angka/KPI
  `rc-metric`/`rc-data` (JetBrains Mono, `tabular-nums`); label kecil `rc-eyebrow` (mono
  uppercase letter-spacing lebar).
- **Permukaan berlapis**: canvas `rc-bg` → panel `rc-panel` → kartu `rc-kpi-surface`/
  `rc-forest-card` dengan hairline `rc-border`. Tanpa shadow berat; kedalaman dari border +
  lapisan surface, bukan efek glow berlebihan.
- **Aksen hemat**: emerald `#18b96b` untuk aksi utama, lime `#9be23d` untuk fokus/highlight,
  gold `#d6b85c` untuk angka premium/total. Status (Live/Preview/Restricted) pakai
  `rc-success`/`rc-warning`/`rc-danger`.
- **Segmentasi jelas** (sesuai permintaan sebelumnya): tiap blok (KPI deck, grafik,
  micro-report) dipisah `rc-eyebrow` + hairline, seperti panel terminal saham.

## Bagian B — Halaman Pemilihan Modul (Landing)

File utama: `components/ReportCenterPage.tsx` + `components/report-center/GlobalModuleNavigator.tsx`.
Data tetap statis dari `lib/reports/module-registry.ts` (tidak perlu API).

- **Hero command bar**: satu baris atas — `rc-eyebrow` "GLOBAL REPORT CENTER" + judul
  `rc-display` + mini-stats (Modul / Live / Preview) sebagai chip `rc-chip` mono. Rapi,
  tidak lagi H1 `text-7xl` yang memekik.
- **Grid kartu modul = langsung navigasi**: tiap modul jadi `<Link>` besar (`rc-forest-card`)
  ke `module.route`. Isi kartu: strip warna `module.color` di atas, ikon lucide dalam kotak
 48px, badge availability (Live/Preview/Restricted, warna `rc-success`/`rc-warning`/
  `rc-danger`), nama + bintang favorit (tombol terpisah agar tidak ikut navigasi), deskripsi
  `line-clamp-2`, footer 2 stat (sub-modul, laporan) dalam `rc-data`.
- **Sub-modul jadi chip di dalam kartu** (bukan aside terpisah) — klik sub-modul langsung ke
  report-nya. Aside detail dihapus; karena kartu sudah navigasi, aside jadi redundan. Modul
  locked: `cursor-not-allowed` + ikon `Lock`, tidak bisa diklik.
- **KPI strip landing** (5 kartu) dirapikan ke `rc-kpi-surface` + `rc-metric`, sparkline pakai
  komponen `Sparkline.tsx` (ganti SVG hardcode inline).
- **Rapikan aksen amber** warisan di `[module]/page.tsx` → token forest, sekaligus.

## Bagian C — Halaman Report Detail (`ReportViewerClient.tsx`)

Restyle visual penuh TANPA memecah 5117 baris logika — yang disentuh hanya lapisan presentasi.

- **Konsolidasi warna (perbaikan terbesar)**: ganti `KPI_TONES` dari pastel Tailwind
  (`bg-emerald-50` dst) menjadi varian token forest, dan ganti hex hardcode banner/panel
  (`#0F2B1A`, `#12351F`, `#0a2416`, `#071426`, `#0c1a12`, `#1A1A1A`, `#102b1b`, dst) ke
  `var(--rc-*)`.
- **Report identity banner** (`:3561`): ganti gradient hardcode jadi `rc-panel` + hairline:
  breadcrumb `rc-eyebrow`, pill "Report {code}" `rc-chip`, judul `rc-display`, 4 report state
  cards → `rc-kpi-surface`, chip bar (LIVE pulse, source, Read-only, Periode) → `rc-chip` mono.
  Aksi kanan (Tampilkan Filter / Kembali) jadi tombol sekunder `rc-forest-badge`.
- **KPI deck (`MonthlyStockRingkasan`)**: semua kartu ke `rc-kpi-surface` + `rc-metric`
  (JetBrains, `tabular-nums`), scope rails (global/flow/breakdown/sub/movement) dipisah
  `rc-eyebrow` + `rc-hairline` sesuai permintaan segmentasi ala pasar saham. `ReportControlBar`
  (period/group/window/item-type) dirapikan jadi satu baris kontrol kompak.
- **Blok filter** (`:3767–4428`): satu panel `rc-panel` dengan seksi ber-eyebrow: Natural
  Filter, Preset, Manual (period/window/threshold/limit), Aksi (Terapkan/Reset). Tidak ubah
  logika filter.
- **Tabel data** (`:4430`): `ReportTableToolbar` + `ReportDataTable` diselaraskan ke hairline
  forest, grand-total strip pakai `rc-subtotal-row` (gold tint), densitas & angka `rc-data`.
- **Analysis/Audit workspace** (`:4598–5025`): tab internal (ai/charts/quality/metadata/sql)
  dalam `rc-panel` bersegmentasi; SQL audit viewer tetap `rc-sql-debug` (demoted sampai hover).
- **Tidak menyentuh**: progressive stream (`TABLE_FIRST_LIMIT`/`TABLE_STREAM_CHUNK`), tabel
  virtualized `@tanstack/react-virtual`, AI Q&A, export — semua logika utuh.

## Bagian D — Drill-Down KPI per Product Type (fitur baru)

### Backend — endpoint baru

`GET /api/reports/inventory/product-type-kpi`

- Reuse CTE `issue_docs` (3-sumber: gudang `IN_STOCKISSUE/LN` ItemType<>'4', fuel
  `IN_FUELISSUE/LN` ItemType<>'4', workshop `WS_JOBSTOCK` TransType='1' ItemType='4') +
  tambah kolom `Source` ('GUDANG'|'FUEL'|'WORKSHOP'), lalu `GROUP BY product_type_code`.
- Join `IN_ITEM` (ItemCode+LocCode) + `IN_PRODTYPE` (ProdTypeCode → Description).
- Ikut filter global: `period`, `movementWindow`, `itemType`, `location`, `source`.
- Valuasi per type: `SUM((QtyOnHand+QtyOnHold)*AverageCost)` dari `IN_ITEM` live.
- Pertahankan `validateReadOnlySql`, sanitasi `cleanInventoryCode`, cache TTL 60 dtk, pola
  `?demo=1` (mengikuti `movement-matrix`).

Mode response:

- **List ringkas** (tanpa `productType`): array semua type —
  `{ code, name, itemCount, valuasi, issueQty, issueAmount, movementCategoryDistribution }`.
- **Detail** (dengan `productType=X`): tambah `split { gudang, fuel, workshop }`
  (qty+amount per sumber, dari kolom `Source`), `topItems[]` (per item code dalam type),
  `trendBulanan[]` (issue qty/amount per bulan dalam movementWindow).

### Frontend — panel + popup

- **Panel baru** `ProductTypeAnalysisPanel` dirender di `InventoryOverview`: daftar product
  type sebagai baris bisa-klik (`ScrollArea`, bukan scroll bawaan), masing-masing tampil nama +
  valuasi + total issue (ringkas). Klik → buka popup.
- **Popup** `ProductTypeDrilldown` — tiru pola `ItemDrilldown`: backdrop blur + ESC +
  `ScrollArea max-h-[70vh]` + footer aksi "Buka report →". Isi: semua KPI lengkap (valuasi,
  usage + split 3-sumber, movement category, top items yang bisa diklik lanjut ke drill-down
  barang `ItemDrilldown`, trend bulanan Recharts), semua dalam gaya token forest (konsisten
  dengan Bagian A).
- **Pola fetch**: mengikuti `InventoryOverview` — `useEffect` + `AbortController` + flag
  `active`, `URLSearchParams`, `fetch(..., { cache: 'no-store', signal, headers: {
  'x-sql-gateway-base': ... } })`, state payload/loading/error, tombol refresh via
  `refreshKey`. Parent memegang `const [drillType, setDrillType] = useState(null)` dan merender
  popup kondisional (pola `MovementAnalytics` → `drillItem`).

## File yang disentuh (perkiraan)

Baru:

- `app/api/reports/inventory/product-type-kpi/route.ts`
- `components/report-center/ProductTypeAnalysisPanel.tsx`
- `components/report-center/ProductTypeDrilldown.tsx`

Diubah (restyle / wiring):

- `components/ReportCenterPage.tsx`
- `components/report-center/GlobalModuleNavigator.tsx`
- `app/(report-center)/report-center/[module]/page.tsx` (aksen amber → forest)
- `app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx` (restyle)
- `components/report-center/MonthlyStockRingkasan.tsx` (restyle)
- `components/report-center/ReportControlBar.tsx` (restyle)
- `components/report-center/ReportTableToolbar.tsx`, `ReportDataTable.tsx` (selaras forest)
- `components/report-center/InventoryOverview.tsx` (render panel product type baru)
- `app/globals.css` (hanya TAMBAH kelas/token baru bila perlu; TIDAK mengubah nilai token ada)

## Yang TIDAK dilakukan (out of scope)

- Tidak mengubah query SQL logika bisnis (kecuali penambahan kolom `Source` + endpoint baru).
- Tidak memecah `ReportViewerClient` menjadi komponen lebih kecil (hanya restyle).
- Tidak mengubah nilai token `--rc-*` global.
- Tidak re-theme halaman report-center lain di luar 2 halaman ini.
- Tidak ada git commit (butuh persetujuan eksplisit terpisah).

## Verifikasi

- `npx tsc --noEmit -p tsconfig.json` → bersih.
- `npx eslint <file yang diubah>` → 0 error (warning pre-existing dibiarkan).
- Endpoint `product-type-kpi` divalidasi `validateReadOnlySql` + coba mode list & detail.
- Verifikasi visual: landing, report detail, popup product type konsisten token forest;
  tidak ada regresi fungsi (filter, stream tabel, export, AI Q&A tetap jalan).

## Catatan

- Server `:3000` berjalan sebagai `next start` (build produksi lama) — perubahan terlihat
  setelah `npm run build` + restart.
