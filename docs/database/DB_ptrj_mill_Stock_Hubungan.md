# Hubungan Tabel Stock `db_ptrj_mill` (SERVER_PROFILE_1 / 10.0.0.110)

> Explore live via SQL Bridge Gateway `http://localhost:8001/v1/query`, server `SERVER_PROFILE_1`,
> database `db_ptrj_mill`. Diverifikasi dengan trace `ItemCode = MG19006` (Oksigen isi ulang).

## Kesimpulan Singkat

Keempat tabel **bukan sama** (struktur & isi berbeda), tapi **terhubung lewat item stock**:

- **Pivot:** `ItemCode` + `AccMonth` + `AccYear` + `LocCode`
- **Bukan** linked by ID (verifikasi: `WS_JOBSTOCK.JobStockID` TIDAK muncul di `WS_MTHENDTRX.DocId`, overlap = 0)
- `SH_MTHEND` tidak ikut di-link `ItemCode` — ia tabel kontrol periode (determinasi `AccMonth`/`AccYear`/`LocCode` yang dipakai filter)

## Rantai Hubungan

```
IN_ITEM  (master: QtyOnHand, AverageCost, UOMCode)        ← 1 baris per ItemCode
   ▲ ItemCode
   │
WS_JOBSTOCK  (detail HARIAN workshop issue)
   │  ItemType='4', TransType='1', Amount penuh (nyata)
   │  MG19006: 3904 baris, qty 5727, amt 684.589.150
   ▼  (direkap per ItemCode + periode)
WS_MTHENDTRX  (rekap BULANAN, DocType='56' = workshop)
   │  MG19006: 7772 baris, Unit ≈ 2× jobstock, Amount = 0 (TIDAK simpan rupiah)
   ▼  (snapshot nilai stok)
IN_MTHENDITEM  (snapshot nilai stok per ItemCode + Loc + periode)
      MG19006: 82 periode, Qty 638, Amount 78.057.489
```

`SH_MTHEND` = kontrol tutup buku (`ModuleCode` + `LocCode` + `CurrAccMonth/Year` + `CloseInd`/`PostedInd`).
`SH_MTHENDTRX` (2 juta row) = history SEMUA modul, axis sama (`ItemCode`+periode+`LocCode`+`ModuleCode`), lebih luas dari `WS_MTHENDTRX` (cuma workshop).

## Profil Tiap Tabel (live, SERVER_PROFILE_1)

| Tabel | Rows | Peran | Kolom Kunci |
|---|---|---|---|
| `WS_JOBSTOCK` | 72.356 | Detail harian workshop issue | `JobStockID[P], JobID[P], ItemCode[P], Qty, Cost, Amount, TransDate, TransType, ItemType, AccMonth, AccYear, LocCode` |
| `WS_MTHENDTRX` | 210.050 | Rekap bulanan (DocType `56`=workshop, `9`=lain) | `DocId, DocLnId, DocType, ItemCode, Unit, Cost, Amount(=0), AccMonth, AccYear, LocCode, ModuleCode` |
| `SH_MTHEND` | 10 | Kontrol periode tutup buku | `ModuleCode[P], LocCode[P], CurrAccMonth, CurrAccYear, CloseInd, PostedInd` |
| `IN_MTHENDITEM` | 626.553 | Snapshot nilai stok bulanan | `ItemCode, LocCode, AccMonth, AccYear, Qty, AverageCost, Amount` |
| `IN_ITEM` | 11.571 | Master barang | `ItemCode, Description, QtyOnHand, AverageCost, UOMCode, Status` |

## Fakta Penting (hasil trace MG19006)

1. **`WS_MTHENDTRX.Amount` = 0 di semua periode**, padahal `WS_JOBSTOCK.Amount` penuh nilai.
   → Jangan pakai `WS_MTHENDTRX` kalau butuh nilai rupiah; pakai `WS_JOBSTOCK`.
2. **`WS_MTHENDTRX.Unit` ≈ 2× `WS_JOBSTOCK.Qty`** per periode → `WS_MTHENDTRX` menggabungkan beberapa sumber transaksi (bukan 1:1 copy jobstock).
3. **`IN_MTHENDITEM`** terpisah: simpan `Qty` + `Amount` (nilai stok), bukan transaksi.
4. Char field padding (`ItemType:'1       '`, `Status:'1 '`, `AccMonth:'10'`) → selalu `RTRIM` saat filter/join.

## Contoh Query (ItemType 4 = workshop, TransType '1' = issue)

```sql
-- Detail harian workshop issue per item
SELECT JobStockID, JobID, Qty, Cost, Amount, TransDate, AccMonth, AccYear
FROM WS_JOBSTOCK
WHERE ItemCode = @ItemCode AND TransType = '1 ' AND ItemType = '4 '
ORDER BY TransDate DESC;

-- Rekap bulanan (workshop) — catatan: Amount = 0
SELECT AccYear, AccMonth, COUNT(*) n, SUM(Unit) qty
FROM WS_MTHENDTRX
WHERE ItemCode = @ItemCode AND DocType = '56 '
GROUP BY AccYear, AccMonth;

-- Snapshot nilai stok
SELECT ItemCode, LocCode, AccMonth, AccYear, Qty, AverageCost, Amount
FROM IN_MTHENDITEM
WHERE ItemCode = @ItemCode
ORDER BY AccYear DESC, AccMonth DESC;

-- Kontrol periode (filter AccMonth/AccYear valid)
SELECT ModuleCode, LocCode, CurrAccMonth, CurrAccYear, CloseInd, PostedInd
FROM SH_MTHEND;
```

## Ketidak-Sinkronan WS_JOBSTOCK vs WS_MTHENDTRX (temuan 2026-07-08)

Cek live bulan **AccMonth `6 ` (Juni) / AccYear 2026**, server `SERVER_PROFILE_1`:

| Sumber | Baris | Amount (Rp) | Qty |
|---|---|---|---|
| `WS_JOBSTOCK` (ALL) | 993 | 2.878.953.629 | 7.423 |
| `WS_JOBSTOCK` (ItemType 4, TransType 1 = workshop issue) | 969 | 2.851.295.275 | — |
| `WS_MTHENDTRX` (DocType 56 = workshop rekap) | 48 | **0** | 2.294 |

- **Selisih amount = 2.851.295.275 ≈ 2,85 Miliar** (jobstock − rekap).
- Item unik WS_JOBSTOCK = 388, WS_MTHENDTRX(DocType56) = 24 → **364 item workshop issue sama sekali tidak masuk rekap**.
- Dari 24 yang ada, `mt_qty` jauh di bawah `js_qty` (MG19006: 2 vs 141). Rekap parsial.
- `WS_MTHENDTRX.Amount` = 0 di SEMUA periode (bukan cuma Juni).

**Penyebab:** bulan 06/2026 **belum di-month-end / posting**. `SH_MTHEND.CurrAccMonth = '9 '`
(periode tutup buku terakhir = Sept 2026). Rekap bulanan hanya akurat untuk periode yang
sudah `CloseInd='1'` di `SH_MTHEND`.

**Rekomendasi report:** untuk nilai riil pakai `WS_JOBSTOCK.Amount`; jangan pakai `WS_MTHENDTRX`
(amount=0 & belum lengkap di bulan berjalan).

## Debug: Navigasi Report-Center "Stuck" (2026-07-08)

**Gejala:** hampir semua navigasi di report-center tidak responsif / stuck saat ditekan.

**Root cause (terbukti, bukan tebakan):** `next start -p 3100` (Next.js PRODUCTION server)
dijalankan dari **build LAMA** dan memegang manifest HTML di memory. Setelah `next build`
dijalankan ulang berkali-kali, file `.next` di disk sudah build baru & benar, tapi server
production TIDAK auto-restart → ia serve HTML lama yang mereferensikan chunk
(`51cafa3b453f56d4.js`) yang sudah tidak ada di disk → browser dapat **500** saat minta
chunk → React gagal mount → semua tombol (sidebar + daftar report) mati = "stuck".

**Bukti:**
- Console: `Failed to load chunk /_next/static/chunks/51cafa3b453f56d4.js → 500`
- `curl localhost:3100/_next/static/chunks/51cafa3b453f56d4.js` → 500, body "Internal Server Error"
- File chunk **TIDAK ADA** di disk `.next/static/chunks/`
- Manifest di disk (`grep 51cafa3b` di `.next/`) → **0 match** (disk benar, memory stale)

**Fix:** restart `next start` agar serve `.next` terbaru.
```
taskkill /PID <next_start_pid> /F
npx next start -p 3100 --hostname 127.0.0.1
```
Setelah restart: chunk → 200, console bersih, halaman load normal (redirect ke /login).

**Pelajaran:** Setelah setiap `next build`, **HARUS restart `next start`** (atau jalankan
ulang gateway `server_bun.js` dengan `START_DASHBOARD=true`). `next start` tidak hot-reload.
Bug "stuck navigasi" = hampir selalu server production stale, BUKAN logic kode report-center.

**Catatan:** timeout 30s di `fetchReport` (ReportViewerClient + InventoryReportsClient) tetap
berguna sebagai defense-in-depth kalau gateway :3001 benar-benar hang.

## Catatan vs Cache Lama

Cache `Services/module/inventory/db_ptrj_mill/tables/tables.json` berlabel `SERVER_PROFILE_3`
(host `103.127.66.32:1888`). Row count berbeda dari live profil-1 (mis. `IN_MTHENDITEM`
626.553 vs cache 673.053). Cache tersebut **stale / dari server mill**, bukan estate (profil-1).
Gunakan hasil explore ini untuk profil-1.
