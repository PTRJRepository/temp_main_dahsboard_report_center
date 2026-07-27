# Design: Movement Category Evolution + Qty/Total Issue Analytics

## 1. Konteks & Tujuan

Pengguna ingin memantau perubahan kategori movement barang dari waktu ke waktu — misalnya 5 tahun ke belakang — agar bisa melihat pergeseran seperti "dulu Moving, sekarang Fast Moving". Selain distribusi jumlah item per kategori, fitur ini juga harus menampilkan **quantity** dan **total issue amount** per kategori per periode.

Fitur ini akan muncul di dua permukaan yang sudah ada:

1. **MovementAnalytics section** (`components/report-center/MovementAnalytics.tsx`) — turunan dari matriks barang × periode yang sudah tersedia.
2. **InventoryOverview panel** (`components/report-center/InventoryOverview.tsx`) — full-scope dengan endpoint backend baru.

## 2. Scope

**In scope:**
- Klasifikasi kategori periode (per bulan) berdasarkan jumlah dokumen issue di bulan tersebut.
- Visualisasi stacked chart jumlah item / quantity / amount per kategori per periode.
- Tabel "Movers" — barang yang berpindah kategori dari periode aktif pertama ke periode aktif terakhir.
- Integrasi di MovementAnalytics (client-side) dan InventoryOverview (backend endpoint).
- Threshold Fast/Moving/Slow/Dead yang sama dengan Movement Category yang ada, dan bisa diubah di InventoryOverview.
- Mode demo untuk verifikasi UI tanpa DB.

**Out of scope:**
- Rolling-window classification per periode (misal trailing 12 bulan untuk setiap bulan).
- Prediksi kategori di masa depan.
- Notifikasi/alert saat barang berpindah kategori.
- Export chart/table ke file.

## 3. Prinsip Klasifikasi Per Periode

Kategori untuk satu barang di satu periode ditentukan dari **jumlah dokumen issue unik** di periode tersebut:

| Kategori | Dokumen issue di periode |
|----------|--------------------------|
| Fast Moving | ≥ `fastMinIssueCount` (default 6) |
| Moving | antara `movingMinIssueCount` dan `movingMaxIssueCount` (default 2–5) |
| Slow Moving | = `slowIssueCount` (default 1) |
| Dead Stock | 0 |

Catatan: ini adalah **periode classification**, bukan rolling window. Periode kosong akan masuk Dead Stock.

## 4. Pendekatan: Hybrid

- **MovementAnalytics**: derive kategori dari `cells.docs` matriks yang sudah di-fetch (`/api/reports/inventory/movement-matrix`). Hanya barang yang masuk top-N matriks yang ikut dihitung.
- **InventoryOverview**: gunakan endpoint backend baru `/api/reports/inventory/movement-category-evolution` agar hasilnya full-scope (semua item aktif, termasuk Dead Stock).

Alasan: MovementAnalytics sudah punya data periode × barang, jadi turunan client-side paling natural. InventoryOverview butuh snapshot Movement Mix yang full-scope, sehingga endpoint baru lebih tepat.

## 5. Data Model

### 5.1 `CategoryEvolutionPoint`

```ts
type CategoryEvolutionPoint = {
  period: string // 'YYYY-MM'
  categories: Record<
    MovementCategory,
    { count: number; qty: number; amount: number }
  >
}
```

### 5.2 `MovementMover`

```ts
type MovementMover = {
  code: string
  name: string
  fromCategory: MovementCategory
  toCategory: MovementCategory
  firstPeriod: string
  lastPeriod: string
  totalQty: number
  totalAmount: number
}
```

### 5.3 API Response

```ts
type MovementCategoryEvolutionResponse = {
  success: boolean
  source: 'estate' | 'pabrik'
  periods: string[]
  byPeriod: CategoryEvolutionPoint[]
  movers: MovementMover[]
  totals: {
    qty: number
    amount: number
    docs: number
    itemCount: number
  }
  thresholds: MovementCategoryThresholds
  cached?: boolean
  error?: string
}
```

## 6. Backend — Endpoint Baru

### 6.1 Route

`app/api/reports/inventory/movement-category-evolution/route.ts`

### 6.2 Query Parameters

| Param | Tipe | Default | Keterangan |
|-------|------|---------|------------|
| `source` | `'estate' \| 'pabrik'` | `'estate'` | Sumber DB |
| `months` | number (1–120) | `12` | Jumlah bulan lookback |
| `period` | `'YYYY-MM'` | bulan berjalan | Anchor akhir rentang |
| `itemType` | `'gudang' \| 'workshop'` | — | Filter ItemType 1 atau 4 |
| `movementFastMin` | number | 6 | Threshold Fast Moving |
| `movementMovingMin` | number | 2 | Threshold Moving min |
| `movementMovingMax` | number | 5 | Threshold Moving max |
| `movementSlowCount` | number | 1 | Threshold Slow Moving |
| `demo` | `'1' \| ''` | — | Mode demo sintetis |

### 6.3 Periode Anchor

Rentang dihitung mundur dari `period` (atau bulan berjalan bila kosong), sama seperti `resolveMovementWindowScope` di `movement-period.ts`:

```text
endExclusive = first day of month setelah anchor
startInclusive = mundur `months` bulan dari anchor
periods = [YYYY-MM] dari startInclusive sampai anchor
```

### 6.4 SQL (sketsa)

```sql
WITH issue_rows AS (
  /* UNION ALL issue gudang (IN_STOCKISSUE/LN) dan workshop (WS_JOBSTOCK TransType='1')
     dengan filter Tanggal >= startInclusive AND Tanggal < endExclusive */
),
item_period AS (
  SELECT
    KodeBarang,
    MAX(NamaBarang) AS NamaBarang,
    CONVERT(varchar(7), Tanggal, 120) AS period,
    COUNT(DISTINCT Dokumen) AS docs,
    CAST(SUM(Qty) AS DECIMAL(18,2)) AS qty,
    CAST(SUM(Amount) AS DECIMAL(18,2)) AS amount
  FROM issue_rows
  GROUP BY KodeBarang, CONVERT(varchar(7), Tanggal, 120)
),
classified AS (
  SELECT
    KodeBarang,
    NamaBarang,
    period,
    docs,
    qty,
    amount,
    CASE
      WHEN docs >= ${fastMin} THEN 'Fast Moving'
      WHEN docs BETWEEN ${movingMin} AND ${movingMax} THEN 'Moving'
      WHEN docs = ${slowCount} THEN 'Slow Moving'
      ELSE 'Dead Stock'
    END AS category
  FROM item_period
),
period_category AS (
  SELECT
    period,
    category,
    COUNT(DISTINCT KodeBarang) AS itemCount,
    CAST(SUM(qty) AS DECIMAL(18,2)) AS qty,
    CAST(SUM(amount) AS DECIMAL(18,2)) AS amount
  FROM classified
  GROUP BY period, category
),
item_bookends AS (
  SELECT
    KodeBarang,
    NamaBarang,
    period,
    category,
    qty,
    amount,
    ROW_NUMBER() OVER (PARTITION BY KodeBarang ORDER BY period ASC) AS rn_asc,
    ROW_NUMBER() OVER (PARTITION BY KodeBarang ORDER BY period DESC) AS rn_desc,
    SUM(qty) OVER (PARTITION BY KodeBarang) AS totalQty,
    SUM(amount) OVER (PARTITION BY KodeBarang) AS totalAmount
  FROM classified
),
movers AS (
  SELECT
    f.KodeBarang,
    f.NamaBarang,
    f.category AS fromCategory,
    l.category AS toCategory,
    f.period AS firstPeriod,
    l.period AS lastPeriod,
    f.totalQty,
    f.totalAmount
  FROM item_bookends f
  INNER JOIN item_bookends l
    ON f.KodeBarang = l.KodeBarang
  WHERE f.rn_asc = 1 AND l.rn_desc = 1 AND f.category <> l.category
)
/* Dua statement terpisah dieksekusi dalam satu request gateway,
   atau dibungkus sebagai dua result-set. UNION ALL di atas hanya ilustrasi
   karena kolom period_category dan movers berbeda. */
SELECT period, category, itemCount, qty, amount FROM period_category ORDER BY period, category;
SELECT KodeBarang, NamaBarang, fromCategory, toCategory, firstPeriod, lastPeriod, totalQty, totalAmount FROM movers ORDER BY totalAmount DESC;
```

Catatan: di implementasi, kedua query di atas dieksekusi terpisah (atau digabung dengan kolom sentinel) agar shape hasil tetap valid. Yang penting hasil akhir:
- aggregate per kategori per periode,
- daftar item yang berpindah kategori.

### 6.5 Total Item & Dead Stock

Total item aktif (untuk menghitung Dead Stock) diambil dari `IN_ITEM` dengan filter `ItemType IN ('1','4')` (atau sesuai `itemType`). Di setiap periode:

```text
Dead Stock count = totalItemCount - sum(count kategori aktif di periode tersebut)
Dead Stock qty/amount = 0
```

### 6.6 Cache

Cache in-memory dengan key:

```text
{source}|{months}|{period}|{itemType}|{fastMin}|{movingMin}|{movingMax}|{slowCount}
```

TTL 60 detik, sama dengan `movement-matrix`.

### 6.7 Demo Mode

Bila `demo=1`, endpoint menghasilkan data sintetis deterministik tanpa query DB. Ini memudahkan verifikasi UI saat koneksi DB sedang bermasalah.

## 7. Helper Client-Side

### 7.1 File

`lib/reports/movement-category-evolution.ts`

### 7.2 Fungsi Utama

```ts
export function buildCategoryEvolutionFromMatrix(
  rows: ApiMatrixRow[],
  periods: string[],
  thresholds: MovementCategoryThresholds,
): {
  byPeriod: CategoryEvolutionPoint[]
  movers: MovementMover[]
  totals: { qty: number; amount: number; docs: number; itemCount: number }
}
```

Logika:
1. Inisialisasi `byPeriod` dengan semua `periods`, masing-masing kategori count/qty/amount = 0.
2. Untiap baris matriks, iterasi setiap periode:
   - klasifikasikan berdasarkan `cells.docs[i]` dan threshold,
   - tambahkan count/qty/amount ke kategori periode tersebut.
3. Movers: bandingkan kategori pertama non-Dead dengan kategori terakhir non-Dead. Jika berbeda, masukkan daftar.
4. Totals: jumlahkan semua qty/amount/docs dan jumlah baris.

### 7.3 Test

`lib/reports/movement-category-evolution.test.ts` berisi matriks deterministik dan asersi:
- jumlah kategori per periode sesuai,
- movers terdeteksi benar,
- total qty/amount sesuai.

## 8. Komponen UI Baru

### 8.1 `MovementCategoryEvolution`

File: `components/report-center/MovementCategoryEvolution.tsx`

Props:

```ts
type MovementCategoryEvolutionProps = {
  periods: string[]
  byPeriod: CategoryEvolutionPoint[]
  movers: MovementMover[]
  totals: { qty: number; amount: number; docs: number; itemCount: number }
  metric?: 'count' | 'qty' | 'amount'
  onMetricChange?: (metric: 'count' | 'qty' | 'amount') => void
  loading?: boolean
  onDrilldown?: (item: { code: string; name: string }) => void
}
```

Tampilan:
- **Header**: judul, toggle metrik [Count | Qty | Amount], ringkasan total qty/amount/docs.
- **Stacked chart** (area atau bar) dengan sumbu X periode dan sumbu Y metrik terpilih, stacked by kategori. Warna mengikuti tone `MovementComposition`:
  - Fast Moving = emerald
  - Moving = cyan
  - Slow Moving = amber
  - Dead Stock = rose/slate
- **Tabel Movers** (max 10–15 baris): kode, nama, dari → ke, total qty, total amount. Klik baris memicu `onDrilldown`.
- **Empty state** netral saat `periods.length === 0` atau tidak ada data.

## 9. Integrasi di Dua Permukaan

### 9.1 MovementAnalytics

File: `components/report-center/MovementAnalytics.tsx`

- Panggil `buildCategoryEvolutionFromMatrix(matrixRows, periods, DEFAULT_MOVEMENT_THRESHOLDS)`.
- Sisipkan `<MovementCategoryEvolution>` di bawah `<MovementTrend>`, dalam satu baris penuh.
- Threshold pakai default; tidak menambah editor baru agar UI tetap ringkas.

### 9.2 InventoryOverview

File: `components/report-center/InventoryOverview.tsx`

- Tambahkan state `evolutionPayload` dan `evolutionLoading`.
- Fetch ke `/api/reports/inventory/movement-category-evolution` saat dependensi berubah: `source`, `period`, `movementWindow`, `itemType`, `movementDefinition`.
- Mapping `movementWindow` ke `months`:
  - `1m` → 1
  - `3m` → 3
  - `6m` → 6
  - `12m` → 12
  - `2y` → 24
  - `5y` → 60
  - `10y` → 120
  - `all` → 120 (maksimum yang didukung endpoint, dengan label "≤10 tahun")
- Tampilkan `<MovementCategoryEvolution>` di bawah grid MovementComposition/ExceptionQueue.
- Gunakan threshold dari `movementDefinition` yang sudah ada.

## 10. Error Handling

- Endpoint gagal: kembalikan `success: false` + `error`, tetapi UI tetap render empty-state, bukan crash.
- Matriks kosong: `MovementCategoryEvolution` menampilkan pesan "Belum ada data evolusi kategori untuk filter ini".
- Periode tanpa issue: kategori Dead Stock tetap ditampilkan dengan count total item (InventoryOverview) atau count barang matriks (MovementAnalytics).

## 11. Testing & Verifikasi

1. Unit test helper: `lib/reports/movement-category-evolution.test.ts`.
2. Manual check endpoint dengan `?demo=1`.
3. Jalankan `npx tsc --noEmit` dari `Dashboard_Utama/`.
4. Jalankan `npm run lint` dari `Dashboard_Utama/`.
5. Verifikasi UI di MovementAnalytics dan InventoryOverview saat DB terhubung dan saat demo mode.

## 12. Daftar File yang Diubah/Dibuat

**Baru:**
- `Dashboard_Utama/lib/reports/movement-category-evolution.ts`
- `Dashboard_Utama/lib/reports/movement-category-evolution.test.ts`
- `Dashboard_Utama/app/api/reports/inventory/movement-category-evolution/route.ts`
- `Dashboard_Utama/components/report-center/MovementCategoryEvolution.tsx`

**Modifikasi:**
- `Dashboard_Utama/components/report-center/MovementAnalytics.tsx`
- `Dashboard_Utama/components/report-center/InventoryOverview.tsx`

## 13. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Query 10 tahun berat di DB | Batasi `months` maksimum 120, cache TTL 60s, dan filter itemType. |
| MovementAnalytics hanya top-N, sehingga Dead Stock terlihat kurang | Dokumentasikan di UI sebagai "evolusi barang aktif"; full-scope ada di InventoryOverview. |
| Kategori per periode berbeda dengan kategori rolling window yang sudah familiar | Tambahkan keterangan tooltip/empty-state: "Kategori dihitung dari issue per bulan, bukan akumulasi window." |

## 14. Rencana Implementasi (abstrak)

1. Buat helper + unit test.
2. Buat endpoint backend + mode demo.
3. Buat komponen `MovementCategoryEvolution`.
4. Integrasikan ke `MovementAnalytics`.
5. Integrasikan ke `InventoryOverview` dengan fetch endpoint.
6. Jalankan TypeScript + lint checks.
7. Verifikasi visual demo mode dan data nyata.

---

*Spec disetujui untuk dilanjutkan ke implementation plan.*
