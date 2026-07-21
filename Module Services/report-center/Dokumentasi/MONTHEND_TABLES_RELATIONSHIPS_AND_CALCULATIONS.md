# Month-End Tables — Relasi & Kalkulasi

> **Folder:** `Module Services/report-center/Dokumentasi/`
> **Scope:** `db_ptrj_mill` (pabrik) — semua penjelasan merujuk ke `SERVER_PROFILE_1` (10.0.0.110)
> **Source:** `monthly-stock-account-movement.ts`, `DB_ptrj_mill_Stock_Hubungan.md`, `IN_STOCK.md`
> **Accounting Year:** April-based (April = AccMonth 1, March = AccMonth 12)

---

## 1. Overview — Empat Tabel Month-End

| # | Table | Rows (live) | Peran |
|---|---|---|---|
| 1 | `IN_MTHENDITEM` | 626.553 | **Snapshot nilai stok** per ItemCode + LocCode + periode. Qty × AverageCost frozen di akhir bulan. |
| 2 | `WS_MTHENDTRX` | 210.050 | **Rekap bulanan workshop** — DocType `56` = workshop. Unit ≠ 0, **Amount = 0** (trap!). |
| 3 | `IN_MTHENDTRX` | — | **Month-end transaction log** — header/link pair (tidak digunakan langsung di RPTIN1000015). |
| 4 | `SH_MTHEND` | 10 | **Kontrol periode tutup buku** — menentukan AccMonth/AccYear yang valid dan sudah di-posting. |

Pivot key untuk semua: `ItemCode` + `LocCode` + `AccMonth` + `AccYear`.

---

## 2. Rantai Relasi

```
IN_ITEM  (master: QtyOnHand live, AverageCost, UOMCode, ItemType, StockAnalysisCode)
   │ ItemCode + LocCode
   │
WS_JOBSTOCK  (detail harian — TransDate, Qty, Cost, Amount, TransType, ItemType)
   │  ItemType='4' (workshop), TransType='1' (issue) atau '2' (return)
   │  AccMonth/AccYear di level baris
   │  ✅ Amount BERISI nilai rupiah nyata
   │
   │  ↓ direkap per ItemCode + periode
   │
WS_MTHENDTRX  (rekap bulanan workshop — DocType '56')
   │  Amount = 0 di SEMUA periode (TIDAK menyimpan rupiah)
   │  Unit ≈ 2× WS_JOBSTOCK.Qty (gabungan dari berbagai sumber)
   │  ❌ JANGAN pakai untuk nilai Amount
   │
   │  ↓ snapshot akhir bulan
   │
IN_MTHENDITEM  (snapshot closing balance per item)
   │  Qty, AverageCost, Amount = Qty × AverageCost
   │  Ter-generate saat month-end process jalan
   │
   │  ↓ frozen per periode
   │
IN_STOCK  (snapshot alternatif — Qty, AverageCost, AccYear, AccMonth)
   │  Relasi serupa IN_MTHENDITEM tapi tidak semua kolom
   │
   │  ↓ kontrol posting
   │
SH_MTHEND  (periode tutup buku)
   │  ModuleCode + LocCode → AccMonth + AccYear
   │  CloseInd='1' + PostedInd='1' → periode resmi closed
   │  Menentukan periode mana yang "past" vs "current"
```

**Catatan:** `SH_MTHEND` tidak di-link lewat `ItemCode`. `WS_MTHENDTRX.DocId` TIDAK mereferensikan `WS_JOBSTOCK.JobStockID` (overlap = 0). Relasi berdasarkan aggregate, bukan ID.

---

## 3. Tabel Detail

### 3.1 IN_MTHENDITEM — Snapshot Nilai Stok Bulanan

**Peran:** Menyimpan closing balance per item per lokasi per bulan akuntansi.

**Pivot key:** `ItemCode` + `LocCode` + `AccMonth` + `AccYear`

**Kolom utama:**

| Kolom | Type | Description |
|---|---|---|
| `ItemCode` | `varchar` | Kode item |
| `LocCode` | `varchar` | Lokasi/gudang |
| `AccYear` | `int` | Accounting year (April-based) |
| `AccMonth` | `int` | Accounting month (1=Apr … 12=Mar) |
| `Qty` | `decimal` | Quantity closing di akhir periode |
| `AverageCost` | `decimal(18,6)` | Average cost saat month-end |
| `Amount` | `decimal` | `Qty × AverageCost` |

**Alias di SQL:** `m`

**Join pattern:**
```sql
LEFT JOIN [db].[dbo].[IN_MTHENDITEM] m
  ON i.ItemCode = m.ItemCode AND i.LocCode = m.LocCode
  AND m.AccYear = @accYear AND m.AccMonth = @accMonth
```

**Fiscal year mapping:**

| AccMonth | Actual Month | AccYear Relation |
|---|---|---|
| 1 | Apr (prev year) | AccYear - 1 |
| 2 | May | AccYear - 1 |
| 3 | Jun | AccYear - 1 |
| 4 | Jul | AccYear - 1 |
| 5 | Aug | AccYear - 1 |
| 6 | Sep | AccYear - 1 |
| 7 | Oct | AccYear - 1 |
| 8 | Nov | AccYear - 1 |
| 9 | Dec | AccYear - 1 |
| 10 | Jan | AccYear |
| 11 | Feb | AccYear |
| 12 | Mar | AccYear |

**Contoh:** Actual Jan 2026 = AccMonth 10, AccYear 2025.

---

### 3.2 WS_MTHENDTRX — Rekap Bulanan Workshop

**Peran:** Menyimpan rekap bulanan transaksi workshop per item. Digunakan untuk audit trail workshop di level bulanan.

**Pivot key:** `ItemCode` + `LocCode` + `AccMonth` + `AccYear` + `DocType` + `ModuleCode`

**Kolom utama:**

| Kolom | Type | Description |
|---|---|---|
| `DocId` | `varchar` | Dokumen ID |
| `DocLnId` | `varchar` | Line ID |
| `DocType` | `varchar` | `56` = workshop, `9` = lain |
| `ItemCode` | `varchar` | Kode item |
| `Unit` | `decimal` | Quantity rekap (≠ 0) |
| `Cost` | `decimal` | Unit cost |
| `Amount` | `decimal` | ❌ SELALU 0 di semua periode |
| `AccYear` | `int` | Accounting year |
| `AccMonth` | `int` | Accounting month |
| `ModuleCode` | `varchar` | Kode modul |

**⚠️ TRAP — WS_MTHENDTRX.Amount = 0:**
- `WS_JOBSTOCK.Amount` menyimpan nilai rupiah nyata (contoh: MG19006 Rp 684.589.150).
- `WS_MTHENDTRX.Amount` = 0 di **semua periode** (verified live: AccMonth 6/2026).
- Penyebab: bulan berjalan belum di-month-end / posting. `SH_MTHEND.CurrAccMonth = '9 '` (tutup buku terakhir = Sept).
- **Rekomendasi:** Untuk nilai riil, gunakan `WS_JOBSTOCK.Amount` langsung, bukan `WS_MTHENDTRX`.

**⚠️ TRAP — WS_MTHENDTRX.Unit ≠ WS_JOBSTOCK.Qty:**
- `WS_MTHENDTRX.Unit` ≈ 2× `WS_JOBSTOCK.Qty` per periode (MG19006: 141 jobstock rows vs 2 MTHENDTRX rows).
- `WS_MTHENDTRX` menggabungkan dari berbagai sumber transaksi, bukan 1:1 copy jobstock.

**Contoh query:**
```sql
SELECT AccYear, AccMonth, COUNT(*) n, SUM(Unit) qty, SUM(Amount) amt
FROM WS_MTHENDTRX
WHERE ItemCode = 'MG19006' AND DocType = '56'
GROUP BY AccYear, AccMonth
ORDER BY AccYear DESC, AccMonth DESC;
-- Result: amt = 0 di semua periode
```

---

### 3.3 IN_MTHENDTRX — Month-End Transaction Log

**Peran:** Header + line pair untuk month-end transaction log. Digunakan sebagai audit trail transaksi akhir bulan, bukan untuk komputasi nilai.

**Struktur:** Mirip pattern header-line lain (`IN_STOCKISSUE`/`IN_STOCKISSUELN`). `IN_MTHENDTRX` = header, `IN_MTHENDTRX` line di tabel terpisah (umumnya `IN_MTHENDTRXLN` atau pattern serupa).

**Pivot key:** `ItemCode` + `AccMonth` + `AccYear` + `LocCode`

**⚠️ CATATAN:** Tabel ini **tidak digunakan secara langsung** di kalkulasi `RPTIN1000015`. Yang dipakai adalah `IN_MTHENDITEM` untuk closing dan `WS_JOBSTOCK` untuk detail workshop.

---

### 3.4 SH_MTHEND — Kontrol Periode Tutup Buku

**Peran:** Menyimpan status periode tutup buku per modul per lokasi. Menentukan periode mana yang sudah resmi di-close dan di-post.

**Pivot key:** `ModuleCode` + `LocCode` (composite primary key)

**Kolom utama:**

| Kolom | Type | Description |
|---|---|---|
| `ModuleCode` | `varchar [P]` | Kode modul (mis. `IN`, `WS`, `PU`) |
| `LocCode` | `varchar [P]` | Lokasi |
| `CurrAccMonth` | `varchar` | Current accounting month (padded, mis. `'9 '`) |
| `CurrAccYear` | `varchar` | Current accounting year |
| `CloseInd` | `char` | `1` = closed, `0` = open |
| `PostedInd` | `char` | `1` = posted, `0` = unposted |

**Contoh query:**
```sql
SELECT ModuleCode, LocCode, CurrAccMonth, CurrAccYear, CloseInd, PostedInd
FROM SH_MTHEND;
-- Hasil: hanya 10 baris, tiap modul × lokasi
-- CurrAccMonth = '9 ' → tutup buku terakhir = AccMonth 9 (Dec)
```

**Kegunaan:** Snapshot mode detection — periode diminta vs `CurrAccMonth` menentukan apakah `IN_MTHENDITEM` sudah ada untuk periode tersebut.

---

## 4. IN_STOCK vs IN_MTHENDITEM

Kedua tabel menyimpan snapshot bulanan tapi berbeda struktur:

| Aspek | `IN_STOCK` | `IN_MTHENDITEM` |
|---|---|---|
| Primary key | `ItemCode` + `LocCode` + `AccYear` + `AccMonth` | `ItemCode` + `LocCode` + `AccYear` + `AccMonth` |
| Amount | `Qty × AverageCost` | `Amount` (kolom fisik, bisa berbeda dari Qty × AverageCost karena cost update mid-month) |
| StockAnalysisCode | Tidak ada | Ada |
| Description | Tidak ada | Tidak ada |

**Pilih `IN_MTHENDITEM`** untuk RPTIN1000015 karena:
1. Ada kolom `Amount` fisik (lebih akurat dari computed `Qty × AverageCost`)
2. Ada `StockAnalysisCode` untuk filtering analisis stok

---

## 5. Kalkulasi Opening & Closing

### 5.1 Opening Balance

**Selalu dari `IN_MTHENDITEM` periode sebelumnya.**

```
Opening = IN_MTHENDITEM[AccMonth = reportAccMonth - 1, AccYear = reportAccYear]
```

Jika `AccMonth = 1` (April), maka `AccMonth - 1 = 0` → roll-over ke AccMonth 12, AccYear - 1.

**Contoh:** Report periode AccMonth 2 (May), AccYear 2025
```
Opening = IN_MTHENDITEM WHERE AccMonth = 1 AND AccYear = 2025
```

**SQL di `monthly-stock-account-movement.ts` (movements CTE, UNION ALL pertama):**
```sql
SELECT
  RTRIM(ItemCode) AS ItemCode,
  Qty AS opening_qty,
  CAST(ISNULL(Amount, ISNULL(Qty, 0) * ISNULL(AverageCost, 0)) AS decimal(18,6)) AS opening_amt,
  -- semua movement columns = 0
FROM [db].[dbo].[IN_MTHENDITEM]
WHERE RTRIM(LocCode) = 'PTRJ'
  AND RTRIM(CONVERT(varchar(10), AccYear)) = '2025'   -- openingAccYear
  AND RTRIM(CONVERT(varchar(10), AccMonth)) = '1'       -- openingAccMonth
```

**Key insight:** Opening **TIDAK PERNAH** dari `IN_ITEM.QtyOnHand`. `IN_ITEM` adalah live balance yang terus berubah. `IN_MTHENDITEM` previous period adalah frozen snapshot.

---

### 5.2 Closing Balance — Dua Path

**Path 1: IN_MTHENDITEM (periode lampau / sudah di-close)**

Jika `IN_MTHENDITEM` sudah ada untuk periode laporan (periode sudah di-month-end), closing langsung dibaca dari `IN_MTHENDITEM` periode tersebut.

```
Closing = IN_MTHENDITEM[AccMonth = reportAccMonth, AccYear = reportAccYear]
```

**Path 2: Reconstructed Formula (periode berjalan / belum di-close)**

Jika `IN_MTHENDITEM` belum ada untuk periode laporan (bulan berjalan), closing dihitung ulang dari movement transactions.

```
Closing =
  Opening
+ Received
+ ReturnAdvice
+ Transferred
+ Adjustment
- IssuedTotal
+ Return
+ GoodsReceive
- GoodsReturn
- DispatchAdvice
```

**Decision logic di SQL:**
```sql
CASE WHEN has_period_closing = 1
     THEN period_closing_qty   -- Path 1: IN_MTHENDITEM
     ELSE opening_qty
        + received_qty
        + return_advice_qty
        + transferred_qty
        + adjustment_qty
        - (ledger_qty + issued_station_qty + issued_vehicle_qty)
        + return_qty
        + goods_receive_qty
        - goods_return_qty
        - dispatch_adv_qty
END AS ClosingQty
```

Kolom `has_period_closing` berasal dari:
```sql
CASE WHEN pc.ItemCode IS NULL THEN 0 ELSE 1 END AS has_period_closing
-- pc = period_closing CTE, membaca IN_MTHENDITEM periode laporan
```

Kolom `ClosingSource` menunjukkan path yang dipakai:
- `'IN_MTHENDITEM'` → Path 1 (periode lampau, data resmi)
- `'reconstructed'` → Path 2 (periode berjalan, estimasi)

---

## 6. Snapshot Mode Logic

**Definisi:** Snapshot mode aktif ketika periode yang diminta adalah bulan lampau (bukan bulan berjalan).

**Deteksi:**
```typescript
const snapshotMode =
  requestedYear < currentYear ||
  (requestedYear === currentYear && requestedMonth < currentMonth)
```

**Contoh:**
- Hari ini: Jul 2026 (actual month 7)
- Requested period: Feb 2026 → snapshotMode = true
- Requested period: Jul 2026 → snapshotMode = false

**Effect pada SQL:**

| Mode | Base CTE | AvgCost Source | QtyOnHand Source |
|---|---|---|---|
| Snapshot (past) | `buildSnapshotBaseCte` | `IN_MTHENDITEM.AverageCost` | `IN_MTHENDITEM.Qty` |
| Non-snapshot (current) | `buildLiveBaseCte` | `IN_ITEM.AverageCost` | `IN_ITEM.QtyOnHand` |

**Base CTE snapshot:**
```sql
SELECT
  RTRIM(m.ItemCode) AS ItemCode,
  CAST(ISNULL(m.Qty, 0) AS decimal(18,6)) AS QtyOnHand,
  CAST(ISNULL(m.AverageCost, 0) AS decimal(18,6)) AS AverageCost,
  CAST(ISNULL(m.Amount, ...) AS decimal(18,6)) AS OnHandHoldAmount
FROM [db].[dbo].[IN_MTHENDITEM] m
WHERE m.AccYear = @reportAccYear AND m.AccMonth = @reportAccMonth
UNION ALL
-- Item baru yang belum ada di IN_MTHENDITEM bulan tsb → 0
```

**Base CTE non-snapshot (live):**
```sql
SELECT
  RTRIM(i.ItemCode) AS ItemCode,
  CAST(ISNULL(i.QtyOnHand, 0) AS decimal(18,6)) AS QtyOnHand,
  CAST(ISNULL(i.AverageCost, 0) AS decimal(18,6)) AS AverageCost,
  CAST((ISNULL(i.QtyOnHand,0) + ISNULL(i.QtyOnHold,0)) * ISNULL(i.AverageCost,0) AS decimal(18,6)) AS OnHandHoldAmount
FROM [db].[dbo].[IN_ITEM] i
```

---

## 7. Movement Window & Period Scope

**Movement scope** ditentukan dari filter laporan:

1. `actualYear` + `actualMonth` → dikonversi ke accounting period
2. Accounting period → date bounds (`actualPeriodStart`, `transactionAsOf`)
3. Opening period = accounting period - 1 bulan

**Movement sources per ItemType:**

| ItemType | Source Table | Movement Type |
|---|---|---|
| 1 (Stock/Gudang) | `IN_STOCKISSUE` / `IN_STOCKISSUELN` | Issue ledger, station, vehicle |
| 1 (Stock/Gudang) | `IN_FUELISSUE` / `IN_FUELISSUELN` | Fuel issue |
| 1 (Stock/Gudang) | `IN_STOCKRECEIVE` / `IN_STOCKRECEIVELN` | Received (placeholder = 0 di RPTIN1000015) |
| 1 (Stock/Gudang) | `IN_ITEMRETADV` / `IN_ITEMRETADVLN` | Return advice (placeholder = 0) |
| 1 (Stock/Gudang) | `IN_STOCKTRANSFER` / `IN_STOCKTRANSFERLN` | Transferred (placeholder = 0) |
| 1 (Stock/Gudang) | `IN_STOCKADJ` / `IN_STOCKADJLN` | Adjustment (placeholder = 0) |
| 4 (Workshop/Mesin) | `WS_JOBSTOCK` (TransType '1') | Issue ledger, station, vehicle |
| 4 (Workshop/Mesin) | `WS_JOBSTOCK` (TransType '2') | Return |
| Purchasing | `PU_GOODSRCV` / `PU_GOODSRCVLN` + `PU_POLN` | Goods Receive |
| Purchasing | `PU_GOODSRET` / `PU_GOODSRETLN` | Goods Return |
| Purchasing | `PU_DISPADV` / `PU_DISPADVLN` | Dispatch Advice (placeholder = 0) |

---

## 8. Issue Classification Logic

**Transaksi issue ke tiga bucket:**

```
issued_ledger    = BlkCode EMPTY + VehCode EMPTY  (ke gudang/laboratorium)
issued_station   = BlkCode PRESENT + VehCode EMPTY  (ke blok/stasiun)
issued_vehicle   = VehCode PRESENT                   (ke kendaraan)
issued_total     = ledger + station + vehicle
```

**Sumber issue:**

1. `IN_STOCKISSUE` / `IN_STOCKISSUELN` — ItemType ≠ '4'
2. `IN_FUELISSUE` / `IN_FUELISSUELN` — Status IN ('2', '6'), ItemType ≠ '4'
3. `WS_JOBSTOCK` — ItemType = '4', TransType = '1'

**Workshop return:** `WS_JOBSTOCK` TransType = '2'

**Goods Receive:** `PU_GOODSRCV.Status = '2'` + `PU_POLN.Cost` × `StockQty`

**Goods Return:** `PU_GOODSRET.Status = '2'` + `ReturnStockQty × Cost` fallback

---

## 9. Decision Matrix — Tabel Mana yang Dipakai

| Kebutuhan | Table | Alasan |
|---|---|---|
| Opening balance (selalu) | `IN_MTHENDITEM` previous period | Frozen snapshot, tidak berubah |
| Closing balance — periode lampau | `IN_MTHENDITEM` periode laporan | Official close, data resmi |
| Closing balance — periode berjalan | Reconstructed formula | `IN_MTHENDITEM` belum ada |
| Workshop issue detail | `WS_JOBSTOCK` | `Amount` nyata, `WS_MTHENDTRX.Amount = 0` |
| Workshop rekap audit | `WS_MTHENDTRX` | Count/unit per periode, bukan nilai |
| Fuel issue | `IN_FUELISSUE` / `IN_FUELISSUELN` | Fuel khusus ada tabel sendiri |
| Goods receive | `PU_GOODSRCV` / `PU_GOODSRCVLN` + `PU_POLN` | Cost dari PO line |
| Goods return | `PU_GOODSRET` / `PU_GOODSRETLN` | Return quantity + amount |
| Stock valuation | `IN_ITEM` (live) atau `IN_STOCK` | QtyOnHand × AverageCost |
| Periode status | `SH_MTHEND` | CloseInd, PostedInd |
| Movement category | `WS_JOBSTOCK.StockIssueEventCount` (1m/3m/6m/12m) | Fast/Moving/Slow/Dead/No Movement |

---

## 10. Contoh Kalkulasi Lengkap

**Scenario:** Report `RPTIN1000015` — Monthly Stock Account Movement, Periode Feb 2026 (AccMonth 11, AccYear 2025), LocCode = PTRJ

### Step 1: Scope Resolution
```
actualYear = 2026, actualMonth = 2
accounting: AccMonth 11, AccYear 2025
opening: AccMonth 10, AccYear 2025 (previous accounting period)
snapshotMode: Feb 2026 < Jul 2026 (current) → true
```

### Step 2: Opening (dari IN_MTHENDITEM AccMonth 10, AccYear 2025)
```sql
SELECT ItemCode, Qty, Amount
FROM IN_MTHENDITEM
WHERE AccMonth = 10 AND AccYear = 2025 AND LocCode = 'PTRJ'
-- Contoh MG03167: Qty = 15.00, Amount = 1,125,000.00
```

### Step 3: Movement Transactions (Feb 2026 = AccMonth 11, AccYear 2025)
```sql
-- Workshop issue
SELECT ItemCode, SUM(Qty) qty, SUM(Amount) amt
FROM WS_JOBSTOCK
WHERE AccMonth = 11 AND AccYear = 2025 AND LocCode = 'PTRJ'
  AND TransType = '1' AND ItemType = '4'
GROUP BY ItemCode;

-- Goods Receive
SELECT ItemCode, SUM(gl.StockQty) qty, SUM(gl.StockQty * p.Cost) amt
FROM PU_GOODSRCV g
JOIN PU_GOODSRCVLN gl ON g.GoodsRcvID = gl.GoodsRcvID
LEFT JOIN PU_POLN p ON gl.POLnID = p.POLnID
WHERE AccMonth = 11 AND AccYear = 2025 AND LocCode = 'PTRJ'
  AND g.Status = '2'
GROUP BY ItemCode;
```

### Step 4: Closing
- `has_period_closing` dari `IN_MTHENDITEM WHERE AccMonth=11 AND AccYear=2025` → 1 (sudah di-close)
- `ClosingQty = IN_MTHENDITEM.Qty` (Path 1)
- `ClosingSource = 'IN_MTHENDITEM'`

### Step 5: Full Formula Applied
```
ClosingQty =
  OpeningQty           (15.00)
+ ReceivedQty          (0)
+ ReturnAdviceQty      (0)
+ TransferredQty       (0)
+ AdjustmentQty        (0)
- IssuedTotalQty       (2.50)
+ ReturnQty            (1.00)
+ GoodsReceiveQty      (3.00)
- GoodsReturnQty       (0)
- DispatchAdviceQty    (0)
= 16.50
```

---

## 11. ws_mthendtrx Amount = 0 — Penjelasan Detail

**Fenomena:** `WS_MTHENDTRX` menyimpan `Amount = 0` untuk semua baris, termasuk periode yang sudah di-close.

**Verified live (SERVER_PROFILE_1, MG19006):**

| Sumber | Baris | Qty | Amount |
|---|---|---|---|
| `WS_JOBSTOCK` (ItemType 4, TransType 1) | 3.904 | 5.727 | 684.589.150 |
| `WS_MTHENDTRX` (DocType 56) | 7.772 | ~11.454 | **0** |

**Verified live (SERVER_PROFILE_1, AccMonth 6/2026):**

| Sumber | Baris | Amount |
|---|---|---|
| `WS_JOBSTOCK` ALL | 993 | 2.878.953.629 |
| `WS_JOBSTOCK` (workshop issue) | 969 | 2.851.295.275 |
| `WS_MTHENDTRX` (DocType 56) | 48 | **0** |

**Selisih:** 2.851.295.275 (seluruh amount tidak masuk rekap bulanan).

**Root cause:** Bulan berjalan (AccMonth 6/2026) belum di-close di `SH_MTHEND`. `WS_MTHENDTRX` hanya terisi penuh setelah month-end process berjalan dan `SH_MTHEND.PostedInd = '1'`.

**Workaround:**
- Untuk amount riil workshop → gunakan `WS_JOBSTOCK.Amount` langsung
- `WS_MTHENDTRX` hanya aman untuk `Unit` (qty count), bukan `Amount`

---

## 12. File Source Reference

| File | Line | Fungsi |
|---|---|---|
| `monthly-stock-account-movement.ts` | 267-271 | `previousAccountingPeriod()` — hitung AccMonth-1 dengan year roll |
| `monthly-stock-account-movement.ts` | 310-365 | `resolveMonthlyStockMovementScope()` — snapshot mode detection |
| `monthly-stock-account-movement.ts` | 414-471 | `buildSnapshotBaseCte()` — base untuk periode lampau |
| `monthly-stock-account-movement.ts` | 473-499 | `buildLiveBaseCte()` — base untuk periode berjalan |
| `monthly-stock-account-movement.ts` | 502-807 | `buildMonthlyStockAccountMovementCte()` — full CTE |
| `monthly-stock-account-movement.ts` | 545-548 | Opening dari `IN_MTHENDITEM` previous period |
| `monthly-stock-account-movement.ts` | 693-701 | `period_closing` CTE — closing dari `IN_MTHENDITEM` |
| `monthly-stock-account-movement.ts` | 781-804 | Closing formula dengan `has_period_closing` decision |
| `DB_ptrj_mill_Stock_Hubungan.md` | — | Hubungan live verification + WS_MTHENDTRX trap |
| `IN_STOCK.md` | — | Fiscal year mapping + IN_STOCK vs IN_MTHENDITEM |
