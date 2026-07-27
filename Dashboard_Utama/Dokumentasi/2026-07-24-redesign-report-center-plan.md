# Redesign Report Center + Product Type Drill-Down — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Eksekusi task berurutan; tiap task berdiri sendiri dan berakhir pada deliverable yang bisa diverifikasi.

**Goal:** Restyle total 2 halaman Report Center ke gaya "terminal gelap premium" tanpa mengubah logika, plus tambah fitur drill-down KPI per product type (endpoint baru + panel + popup).

**Architecture:** Konsolidasi warna ke token forest `--rc-*` dengan mengganti sumber class/hex di komponen (BUKAN mengubah nilai token global, BUKAN menambah override `!important` baru). Fitur product type memakai endpoint baru yang reuse CTE `issue_docs` 3-sumber + kolom `Source`, lalu `GROUP BY product_type_code`; frontend mengikuti pola `InventoryOverview` (fetch + AbortController) dan pola popup `ItemDrilldown`.

**Tech Stack:** Next.js App Router, React, TypeScript (strict), Tailwind CSS v4 + `app/globals.css` (token `--rc-*`), Recharts, lucide-react, SQL Server (mssql) via `validateReadOnlySql`.

## Global Constraints

- **Jangan ubah logika/data.** Tidak memecah `ReportViewerClient.tsx`, tidak mengubah query SQL bisnis lama, tidak menyentuh progressive stream / tabel virtual / AI Q&A / export.
- **Jangan ubah nilai token `--rc-*` global** di `globals.css`. Hanya boleh MENAMBAH kelas/token baru bila perlu.
- **Jangan tambah override `!important` baru.** Konsolidasi dilakukan di sumber class/hex komponen.
- **Kartu modul = `<Link>` langsung navigasi** ke `module.route`.
- **Tidak ada git commit** tanpa persetujuan eksplisit user. Abaikan langkah "Commit" pada template; verifikasi saja, laporkan, dan biarkan user yang commit.
- Indentasi 2 spasi, single quotes di TS/TSX, komponen `PascalCase`, helper `camelCase`, route/endpoint kebab-case.
- Jalankan semua perintah dari `D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama`.
- Verifikasi tiap task: `npx tsc --noEmit -p tsconfig.json` (harus exit 0) dan `npx eslint <file berubah>` (0 error; warning unused-vars pre-existing dibiarkan).
- Server `:3000` adalah `next start` (build produksi lama); perubahan terlihat setelah `npm run build` + restart — jangan hentikan prosesnya.

---

### Task 1: Endpoint `product-type-kpi` (list + detail)

**Files:**
- Create: `app/api/reports/inventory/product-type-kpi/route.ts`

**Interfaces:**
- Consumes: helper yang sudah ada di `app/api/reports/inventory/route.ts` — `fuelIssueDocumentDateExpression`, `fuelIssueStatusFilter`, `nonWorkshopItemTypeFilter`, `workshopStockIssueDateExpression`, `workshopStockIssueAmountExpression`, `workshopStockIssueItemTypeExpression`, `issueLineAmountExpression`, `validateReadOnlySql`; pola `cleanInventoryCode` dari `lib/reports/report-filtering.ts`.
- Produces: `GET /api/reports/inventory/product-type-kpi` mengembalikan:
  - Mode list (tanpa `productType`): `{ success, mode: 'list', rows: ProductTypeKpiRow[] }` dengan `ProductTypeKpiRow = { code, name, itemCount, valuasi, issueQty, issueAmount, fastCount, movingCount, slowCount, deadCount, lastMovement }`.
  - Mode detail (`productType=X`): `{ success, mode: 'detail', row: ProductTypeKpiRow & { split, topItems, trend }` dengan `split = { gudang:{qty,amount}, fuel:{qty,amount}, workshop:{qty,amount} }`, `topItems: { code, name, qty, amount }[]`, `trend: { period, qty, amount }[]`.

Catatan: karena helper diekspor dari `route.ts` yang sama foldernya, impor langsung atau salin pola SQL persis seperti CTE `issue_docs` (baris ~2369–2483) dengan tambahan kolom `Source`.

- [ ] **Step 1: Buat route dengan CTE issue 3-sumber + kolom Source**

Bangun CTE `issue_docs` sebagai `UNION ALL` 3 cabang, tiap cabang menyertakan literal penanda sumber dan kolom `product_type_code` via join `IN_ITEM`:

```sql
WITH issue_docs AS (
  SELECT i.ProdTypeCode AS product_type_code, l.ItemCode, 'GUDANG' AS Source,
         h.PostDate AS Tanggal, ISNULL(l.Qty,0) AS Qty,
         COALESCE(NULLIF(l.Amount,0), ISNULL(l.Qty,0)*ISNULL(l.Cost,0), 0) AS Amount
  FROM [DB].[dbo].[IN_STOCKISSUELN] l
  INNER JOIN [DB].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
  LEFT JOIN [DB].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
  WHERE h.PostDate >= @from AND h.PostDate < @to AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)),'') <> '4'
  UNION ALL
  SELECT i.ProdTypeCode, l.ItemCode, 'FUEL',
         <fuelIssueDocumentDateExpression h>, ISNULL(l.Qty,0),
         COALESCE(NULLIF(l.Amount,0), ISNULL(l.Qty,0)*ISNULL(l.Cost,0), 0)
  FROM [DB].[dbo].[IN_FUELISSUELN] l
  INNER JOIN [DB].[dbo].[IN_FUELISSUE] h ON l.FuelIssueID = h.FuelIssueID
  LEFT JOIN [DB].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
  WHERE <fuelIssueDocumentDateExpression h> >= @from AND <...> < @to
    AND <fuelIssueStatusFilter h> AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)),'') <> '4'
  UNION ALL
  SELECT i.ProdTypeCode, s.ItemCode, 'WORKSHOP',
         <workshopStockIssueDateExpression s>, ISNULL(s.Qty,0), <workshopStockIssueAmountExpression s>
  FROM [DB].[dbo].[WS_JOBSTOCK] s
  LEFT JOIN [DB].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
  WHERE <workshopStockIssueDateExpression s> >= @from AND <...> < @to
    AND RTRIM(ISNULL(s.TransType,'')) = '1' AND <workshopStockIssueItemTypeExpression i s> = '4'
)
```

`@from`/`@to` berasal dari `movementWindow` (sama seperti route lain); filter `location`/`itemType` diterapkan di WHERE tiap cabang.

- [ ] **Step 2: Agregasi per product type + valuasi**

Di atas CTE, `GROUP BY product_type_code`, join `IN_PRODTYPE pt` untuk nama, dan valuasi dari subquery `IN_ITEM` (`SUM((QtyOnHand+QtyOnHold)*AverageCost)`, `COUNT(*)`). Movement category distribution dihitung dari jumlah item per kategori (kategori per item dari distinct issue doc dalam window — pakai threshold yang sama dengan route utama: Fast>=6, Moving 2-5, Slow=1, Dead=0). Detail menambah `SUM(CASE WHEN Source='GUDANG' THEN ... END)` untuk split, `TOP N` item untuk `topItems`, dan `GROUP BY CONVERT(char(7), Tanggal, 120)` untuk `trend`.

- [ ] **Step 3: Terapkan `validateReadOnlySql` + cache TTL 60 dtk + pola `?demo=1`**

Ikuti persis pola `movement-matrix/route.ts` (cache key dari source+params, TTL, `?demo=1` deterministik). Validasi semua SQL lewat `validateReadOnlySql` sebelum eksekusi.

- [ ] **Step 4: Verifikasi**

Run: `npx tsc --noEmit -p tsconfig.json` → exit 0.
Run: `npx eslint app/api/reports/inventory/product-type-kpi/route.ts` → 0 error.

---

### Task 2: Panel `ProductTypeAnalysisPanel` + wiring di `InventoryOverview`

**Files:**
- Create: `components/report-center/ProductTypeAnalysisPanel.tsx`
- Modify: `components/report-center/InventoryOverview.tsx` (render panel + state `drillType`)

**Interfaces:**
- Consumes: endpoint Task 1 (mode list), komponen `ScrollArea.tsx`, pola fetch `InventoryOverview.tsx:455-503`, filter global dari props `InventoryOverview`.
- Produces: `ProductTypeAnalysisPanel` menerima props `{ filters, onDrilldown: (code: string) => void }`. `InventoryOverview` mengekspor state `drillType: string | null` yang dipakai Task 3.

- [ ] **Step 1: Buat `ProductTypeAnalysisPanel.tsx`**

Client component. `useEffect` + `AbortController` + flag `active`, bangun `URLSearchParams` dari `filters` (period, movementWindow, itemType, location, source), `fetch('/api/reports/inventory/product-type-kpi?...', { cache: 'no-store', signal, headers: { 'x-sql-gateway-base': ... } })`, simpan `payload/loading/error`. Render header `rc-eyebrow` "ANALIS PER PRODUCT TYPE", lalu daftar baris dalam `<ScrollArea className="max-h-80">`. Tiap baris: nama type (`rc-data`), valuasi + total issue (`rc-metric` tabular-nums), `button` yang memanggil `onDrilldown(code)`. State loading/error pakai `ReportStatePanel`.

- [ ] **Step 2: Wiring di `InventoryOverview`**

Tambah `const [drillType, setDrillType] = useState<string | null>(null)` dan render `<ProductTypeAnalysisPanel filters={moduleFilters} onDrilldown={setDrillType} />` di slot yang konsisten (setelah `MovementComposition` / `OtherAnalyses`).

- [ ] **Step 3: Verifikasi**

`tsc --noEmit` exit 0; `eslint` kedua file 0 error.

---

### Task 3: Popup `ProductTypeDrilldown`

**Files:**
- Create: `components/report-center/ProductTypeDrilldown.tsx`
- Modify: `components/report-center/InventoryOverview.tsx` (render popup kondisional)

**Interfaces:**
- Consumes: endpoint Task 1 (mode detail), `ScrollArea`, Recharts (AreaChart untuk trend), `ItemDrilldown` (untuk lanjut drill ke barang), `drillType` + `setDrillType` dari Task 2.
- Produces: `ProductTypeDrilldown` props `{ code: string, filters, onClose: () => void, onOpenItem: (itemCode: string) => void }`.

- [ ] **Step 1: Buat popup dengan pola `ItemDrilldown`**

`fixed inset-0 z-50`, backdrop blur klik-tutup, handler ESC (`useEffect` keydown), konten dibungkus `<ScrollArea className="max-h-[70vh]">`, footer aksi "Buka report →". Saat `code` berubah, fetch mode detail.

- [ ] **Step 2: Isi KPI lengkap (gaya forest)**

Kartu KPI `rc-kpi-surface` + `rc-metric`: Valuasi, Total Issue (qty+amount). Blok split 3-sumber (Gudang/Fuel/Workshop, qty+amount, `rc-data`). Blok movement category (Fast/Moving/Slow/Dead, jumlah item). Blok `topItems` (daftar bisa-klik → `onOpenItem`). Blok `trend` Recharts AreaChart (qty/amount per bulan). Tiap blok dipisah `rc-eyebrow` + `rc-hairline` (segmentasi ala pasar saham).

- [ ] **Step 3: Wiring di `InventoryOverview`**

Render `{drillType && <ProductTypeDrilldown code={drillType} filters={moduleFilters} onClose={() => setDrillType(null)} onOpenItem={(item) => { /* buka ItemDrilldown */ }} />}`.

- [ ] **Step 4: Verifikasi**

`tsc --noEmit` exit 0; `eslint` 0 error.

---

### Task 4: Restyle Landing Modul (kartu = navigasi langsung)

**Files:**
- Modify: `components/report-center/GlobalModuleNavigator.tsx`
- Modify: `components/ReportCenterPage.tsx`
- Modify: `app/(report-center)/report-center/[module]/page.tsx` (aksen amber → forest)

**Interfaces:**
- Consumes: `REPORT_GLOBAL_MODULES` dari `lib/reports/module-registry.ts`, `Sparkline.tsx`, token forest, lucide-react.
- Produces: kartu modul `<Link>` ke `module.route`; sub-modul chip `<Link>` ke report; aside dihapus.

- [ ] **Step 1: Ubah kartu modul jadi `<Link>`**

Ganti `<button>` kartu menjadi `<Link href={module.route} className="rc-forest-card ...">`. Bintang favorit jadi `<button type="button">` terpisah dengan `e.preventDefault()` + `e.stopPropagation()` agar tidak ikut navigasi. Sub-modul dirender sebagai chip `<Link>` ke report masing-masing. Modul locked: `cursor-not-allowed` + ikon `Lock`, render sebagai `<div>` (bukan Link).

- [ ] **Step 2: Hapus aside detail + rapikan hero**

Hapus blok `<aside>` detail (kartu sudah navigasi). Hero jadi satu baris: `rc-eyebrow` "GLOBAL REPORT CENTER" + judul `rc-display` + mini-stats chip `rc-chip` (ganti H1 `text-7xl`).

- [ ] **Step 3: Rapikan KPI strip landing + aksen amber**

5 kartu KPI ke `rc-kpi-surface` + `rc-metric`; sparkline pakai `<Sparkline />` (ganti SVG inline hardcode). Di `[module]/page.tsx` ganti aksen `amber-300` hardcode ke token forest.

- [ ] **Step 4: Verifikasi**

`tsc --noEmit` exit 0; `eslint` ketiga file 0 error.

---

### Task 5: Restyle Report Detail (konsolidasi warna forest)

**Files:**
- Modify: `app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx`
- Modify: `components/report-center/MonthlyStockRingkasan.tsx`
- Modify: `components/report-center/ReportControlBar.tsx`
- Modify: `components/report-center/ReportTableToolbar.tsx`
- Modify: `components/report-center/ReportDataTable.tsx`

**Interfaces:**
- Consumes: token forest `--rc-*`, kelas `rc-panel`/`rc-kpi-surface`/`rc-chip`/`rc-display`/`rc-metric`/`rc-data`/`rc-eyebrow`/`rc-hairline`/`rc-subtotal-row`/`rc-sql-debug`.
- Produces: tidak ada perubahan logika; hanya class/hex presentasi diganti ke token forest.

- [ ] **Step 1: Ganti `KPI_TONES` pastel → varian forest**

Di `ReportViewerClient.tsx` (~`:1176`), ganti setiap tone `bg-emerald-50 border-emerald-100 text-emerald-700` (dan varian warna lain) menjadi kelas/token forest yang setara. Jangan menambah override `!important`; ganti nilai string di sumbernya.

- [ ] **Step 2: Ganti hex hardcode banner/panel → `var(--rc-*)`**

Ganti `#0F2B1A`, `#12351F`, `#0a2416`, `#071426`, `#0c1a12`, `#1A1A1A`, `#102b1b`, `#0b1018` (banner `:3561`, section ringkasan `:3668`, workspace `:4598`) ke `var(--rc-surface*)`/`var(--rc-bg*)` yang sesuai. Banner gradient → `rc-panel` + hairline.

- [ ] **Step 3: Restyle KPI deck, filter, tabel, workspace**

`MonthlyStockRingkasan`: kartu → `rc-kpi-surface` + `rc-metric`, scope rails dipisah `rc-eyebrow` + `rc-hairline`. `ReportControlBar`: satu baris kontrol kompak. Blok filter `:3767–4428` → satu `rc-panel` dengan seksi ber-eyebrow. `ReportTableToolbar`/`ReportDataTable` → hairline forest, grand-total → `rc-subtotal-row`. Workspace analisis → `rc-panel` bersegmentasi.

- [ ] **Step 4: Verifikasi**

`tsc --noEmit` exit 0; `eslint` semua file berubah 0 error. Konfirmasi tidak ada perubahan perilaku: filter, stream tabel, export, AI Q&A tetap berfungsi.

---

## Self-Review

- **Spec coverage:** Bagian A (fondasi) → Task 4+5; Bagian B (landing) → Task 4; Bagian C (report detail) → Task 5; Bagian D (product type) → Task 1+2+3. Semua ter-cover.
- **Placeholder scan:** tidak ada TBD/TODO; setiap langkah berisi perintah/SQL/struktur nyata. Langkah agregasi SQL Task 1 merujuk CTE konkret yang sudah ada di codebase.
- **Type consistency:** `ProductTypeKpiRow`, `split`, `topItems`, `trend`, props `onDrilldown`/`onOpenItem`/`drillType` konsisten lintas Task 1–3.
- **Penyesuaian repo:** tanpa test runner terkonfigurasi, TDD klasik diganti verifikasi `tsc`+`eslint`+visual; tidak ada langkah `git commit` (butuh persetujuan eksplisit user).
