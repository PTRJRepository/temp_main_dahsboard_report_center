# Audit Relasi Month-End vs Stock Issue — AccYear 2027, AccMonth 1

> Scope: `db_ptrj_mill`, periode `AccYear = 2027`, `AccMonth = 1`.
> Query mode: read-only.
> Catatan privasi: `Remark`, `Description`, dan field bebas lain yang berpotensi berisi nama orang/catatan internal disensor sebagian. ID dokumen, item, akun, qty, dan amount tetap real.

## Ringkasan Cepat

`IN_STOCKISSUE` + `IN_STOCKISSUELN` adalah transaksi realtime pengeluaran barang.  
`IN_MTHENDTRX` adalah jurnal month-end untuk transaksi tersebut.  
`IN_MTHENDITEM` adalah snapshot/saldo akhir bulan per item.

Relasi inti:

```text
IN_STOCKISSUE.StockIssueID
  1 ── n IN_STOCKISSUELN.StockIssueID
          1 line issue ── 2 rows IN_MTHENDTRX
                          DocType = '24'
                          DocId   = StockIssueID
                          DocLnId = StockIssueLNID
                          ItemCode sama
                          periode sama

IN_MTHENDITEM
  snapshot closing stock per ItemCode + LocCode + AccYear + AccMonth
```

Audit periode `2027-1`:

| Layer | Real Result |
|---|---:|
| `IN_STOCKISSUE` header approved/posted | 270 dokumen |
| `IN_STOCKISSUELN` issue line | 537 line |
| `IN_STOCKISSUELN` total qty | 72,873.80 |
| `IN_STOCKISSUELN` total amount | 747,041,642.31 |
| `IN_MTHENDTRX` DocType `24` rows | 1,074 rows |
| `IN_MTHENDTRX` distinct DocId | 270 dokumen |
| `IN_MTHENDTRX` distinct DocLnId | 537 line |
| `IN_MTHENDTRX` positive amount | 747,041,642.31 |
| `IN_MTHENDTRX` negative amount | -747,041,642.31 |
| `IN_MTHENDTRX` net amount | 0.00 |
| `IN_MTHENDITEM` snapshot rows | 11,760 item-location rows |
| `IN_MTHENDITEM` snapshot qty | 316,050.18 |
| `IN_MTHENDITEM` snapshot amount | 132,439,078,100.92 |

Kesimpulan audit: `IN_STOCKISSUELN.Amount` cocok dengan sisi positif `IN_MTHENDTRX.Amount` untuk `DocType = '24'`. `IN_MTHENDTRX` net selalu 0 karena satu line issue dibuat menjadi pasangan debit/credit. `IN_MTHENDITEM` tidak boleh dibanding totalnya langsung dengan issue, karena snapshot adalah saldo akhir setelah semua movement, bukan total transaksi keluar.

---

## 1. `IN_STOCKISSUE` — Header Transaksi Keluar Barang

### Fungsi

Header dokumen issue/pengeluaran barang dari gudang. Satu row header bisa punya banyak line di `IN_STOCKISSUELN`.

### Kolom Lengkap

| Kolom | Type | Nullable | Fungsi |
|---|---|---|---|
| `StockIssueID` | `char(20)` | NO | Primary business ID dokumen issue. Join ke `IN_STOCKISSUELN.StockIssueID` dan `IN_MTHENDTRX.DocId`. |
| `DNID` | `char(20)` | YES | Delivery note/reference internal. |
| `BillPartyCode` | `char(20)` | YES | Kode pihak pembebanan/tagihan. |
| `IssueType` | `char(2)` | YES | Jenis issue. |
| `TotalAmount` | `decimal(20,5)` | YES | Total amount header. Umumnya sum line amount. |
| `Remark` | `nvarchar(500)` | YES | Catatan bebas; bisa berisi nama/catatan internal. |
| `AccMonth` | `char(2)` | YES | Bulan akuntansi, char padded. Pakai `RTRIM()` saat filter. |
| `AccYear` | `char(4)` | YES | Tahun akuntansi. |
| `LocCode` | `char(8)` | NO | Gudang/lokasi sumber barang. |
| `Status` | `char(2)` | YES | Status dokumen. Data periode ini hanya status `6`. |
| `PayrollPosted` | `char(2)` | YES | Flag posting payroll/interface. |
| `CreateDate` | `datetime` | YES | Tanggal dibuat. |
| `UpdateDate` | `datetime` | YES | Tanggal update. |
| `UpdateID` | `char(20)` | YES | User update internal. |
| `PrintDate` | `datetime` | YES | Tanggal cetak. |
| `TotalPrice` | `decimal(20,5)` | NO | Total price header. |
| `ChargeLocCode` | `char(8)` | NO | Lokasi pembebanan. |
| `PSEMPCODE` | `char(20)` | YES | Kode employee/PS bila ada. |
| `PostDate` | `datetime` | NO | Tanggal posting. |
| `StockIssueRefDate` | `datetime` | YES | Tanggal referensi issue. |
| `StockIssueRefNo` | `varchar(32)` | YES | Nomor referensi issue. |

### Contoh 1 Data Real

| Field | Value |
|---|---|
| `StockIssueID` | `SI26016036` |
| `IssueType` | `1` |
| `TotalAmount` | `7500.00` |
| `Remark` | `[REDACTED_REMARK]` |
| `AccMonth` | `1` |
| `AccYear` | `2027` |
| `LocCode` | `PTRJ` |
| `Status` | `6` |
| `PayrollPosted` | `0` |
| `CreateDate` | `Apr 1 2026 7:38AM` |
| `UpdateDate` | `Apr 5 2026 10:22AM` |
| `UpdateID` | `adm027` |
| `PrintDate` | `Jan 1 1900 12:00AM` |
| `TotalPrice` | `7500.00` |
| `ChargeLocCode` | `PTRJ` |
| `PostDate` | `May 1 2026 2:40AM` |
| `StockIssueRefDate` | `Apr 1 2026 12:00AM` |

---

## 2. `IN_STOCKISSUELN` — Line Transaksi Keluar Barang

### Fungsi

Detail item yang keluar. Satu `StockIssueID` bisa punya satu atau banyak `StockIssueLNID`.

### Kolom Lengkap

| Kolom | Type | Nullable | Fungsi |
|---|---|---|---|
| `StockIssueLNID` | `char(20)` | NO | Primary business ID line issue. Join ke `IN_MTHENDTRX.DocLnId`. |
| `StockIssueID` | `char(20)` | NO | FK ke `IN_STOCKISSUE.StockIssueID`. |
| `AccCode` | `char(32)` | YES | Akun pembebanan line. |
| `BlkCode` | `char(8)` | YES | Blok/station cost center line. |
| `VehCode` | `char(8)` | YES | Kode kendaraan bila issue ke kendaraan. |
| `VehExpCode` | `char(8)` | YES | Kode expense kendaraan. |
| `PsEmpCode` | `char(20)` | YES | Kode employee/PS bila ada. |
| `ItemCode` | `char(20)` | NO | Kode item keluar. Join ke `IN_MTHENDTRX.ItemCode` dan `IN_MTHENDITEM.ItemCode`. |
| `QtyReturn` | `decimal(20,5)` | YES | Qty return terkait line. |
| `Qty` | `decimal(20,5)` | YES | Qty keluar. |
| `Cost` | `decimal(20,5)` | YES | Cost/unit saat issue. |
| `Amount` | `decimal(20,5)` | YES | `Qty × Cost`. |
| `Price` | `decimal(20,5)` | NO | Price/unit. |
| `PriceAmount` | `decimal(20,5)` | NO | `Qty × Price`. |
| `TotalPrice` | `decimal(20,5)` | NO | Total price tambahan. |
| `TaxRate` | `decimal(5,2)` | YES | Rate pajak. |
| `TaxRef` | `varchar(20)` | YES | Referensi pajak. |
| `TaxInd` | `varchar(1)` | YES | Flag pajak. |
| `ExportHistoryID` | `bigint` | YES | ID history export/interface. |

### Contoh 1 Data Real

| Field | Value |
|---|---|
| `StockIssueLNID` | `SIL26031950` |
| `StockIssueID` | `SI26016036` |
| `AccCode` | `OC7318` |
| `BlkCode` | `GEN01001` |
| `VehCode` | blank |
| `VehExpCode` | blank |
| `PsEmpCode` | blank |
| `ItemCode` | `MO03003` |
| `QtyReturn` | `0.00` |
| `Qty` | `2.00` |
| `Cost` | `3750.00` |
| `Amount` | `7500.00` |
| `Price` | `3750.00` |
| `PriceAmount` | `7500.00` |
| `TotalPrice` | `0.00` |
| `TaxRate` | `NULL` |
| `TaxInd` | `0` |
| `ExportHistoryID` | `0` |

---

## 3. `IN_MTHENDTRX` — Jurnal Month-End Transaksi Inventory

### Fungsi

Jurnal month-end untuk transaksi inventory. Untuk stock issue (`DocType = '24'`), satu line issue masuk menjadi dua row jurnal:

1. Row positif: pembebanan expense/cost center.
2. Row negatif: pengurangan inventory/cost account.

Karena pasangan debit/credit, net amount per `DocId + DocLnId` = 0.

### Kolom Lengkap

| Kolom | Type | Nullable | Fungsi |
|---|---|---|---|
| `DocId` | `char(20)` | NO | ID dokumen sumber. Untuk stock issue = `IN_STOCKISSUE.StockIssueID`. |
| `DocLnId` | `char(20)` | NO | ID line sumber. Untuk stock issue = `IN_STOCKISSUELN.StockIssueLNID`. |
| `DocType` | `char(3)` | YES | Tipe dokumen. `24` = stock issue, `25` = fuel issue. |
| `DocDate` | `datetime` | NO | Tanggal transaksi/jurnal. |
| `LocCode` | `char(8)` | NO | Lokasi/gudang. |
| `ModuleCode` | `char(8)` | NO | Module asal. Untuk data ini `3` = inventory. |
| `AccMonth` | `char(2)` | NO | Bulan akuntansi. |
| `AccYear` | `char(4)` | NO | Tahun akuntansi. |
| `EmpCode` | `char(20)` | NO | Employee code bila ada. Umumnya blank untuk stock issue. |
| `AccCode` | `char(32)` | NO | Akun jurnal. Contoh `OC*`, `GA*`, `CA*`. |
| `BlkCode` | `char(8)` | NO | Blok/station cost center jurnal. |
| `VehCode` | `char(8)` | NO | Vehicle code bila ada. |
| `VehExpenseCode` | `char(8)` | NO | Vehicle expense code bila ada. |
| `ItemCode` | `char(20)` | NO | Item. Sama dengan line issue. |
| `Unit` | `decimal(20,5)` | NO | Qty jurnal. Untuk issue = `IN_STOCKISSUELN.Qty`; muncul dua kali. |
| `Cost` | `decimal(20,5)` | NO | Cost/unit. Sisi negatif memakai cost negatif. |
| `Amount` | `decimal(20,5)` | NO | Amount jurnal. Sisi debit positif, sisi credit negatif. |
| `Price` | `decimal(20,5)` | YES | Price/unit. |
| `PriceAmount` | `decimal(20,5)` | YES | Amount dari price. |
| `Description` | `nvarchar(1000)` | YES | Deskripsi bebas; bisa berisi nama/catatan internal. |

### Contoh 1 Transaksi Real — 2 Row Jurnal Untuk 1 Line Issue

Source line: `SI26016036 / SIL26031950 / MO03003 / Qty 2 / Amount 7,500`.

| DocId | DocLnId | DocType | ItemCode | AccCode | BlkCode | Unit | Cost | Amount | Makna |
|---|---|---:|---|---|---|---:|---:|---:|---|
| `SI26016036` | `SIL26031950` | `24` | `MO03003` | `OC7318` | `GEN01001` | 2.00 | 3,750.00 | 7,500.00 | Debit/pembebanan |
| `SI26016036` | `SIL26031950` | `24` | `MO03003` | `CA2118` | blank | 2.00 | -3,750.00 | -7,500.00 | Credit/pengurang inventory |

Field lain pada dua row ini sama: `DocDate = Apr 1 2026`, `LocCode = PTRJ`, `ModuleCode = 3`, `AccMonth = 1`, `AccYear = 2027`, `EmpCode = blank`, `VehCode = blank`, `VehExpenseCode = blank`, `Description = [REDACTED_DESCRIPTION]`.

---

## 4. `IN_MTHENDITEM` — Snapshot Month-End / Saldo Akhir Item

### Fungsi

Snapshot closing stock per `ItemCode + LocCode + AccYear + AccMonth`. Ini bukan transaksi realtime. Ini hasil akhir setelah semua movement periode berjalan diproses.

> Catatan nama tabel: beberapa dokumentasi lama menyebut `IN_STOCK`; di database `db_ptrj_mill` yang terverifikasi untuk audit ini, snapshot month-end yang ada dan dipakai adalah `IN_MTHENDITEM`.

### Kolom Lengkap

| Kolom | Type | Nullable | Fungsi |
|---|---|---|---|
| `ItemCode` | `char(20)` | NO | Item snapshot. |
| `LocCode` | `char(8)` | NO | Lokasi/gudang snapshot. |
| `AccMonth` | `char(2)` | NO | Bulan akuntansi. |
| `AccYear` | `char(4)` | NO | Tahun akuntansi. |
| `Qty` | `decimal(20,5)` | NO | Closing qty pada akhir bulan. |
| `AverageCost` | `decimal(20,5)` | NO | Average cost saat closing. |
| `Amount` | `decimal(20,5)` | NO | Closing inventory value. |

### Contoh 1 Data Real, Item Yang Sama Dengan Issue

| Field | Value |
|---|---|
| `ItemCode` | `MO03003` |
| `LocCode` | `PTRJ` |
| `AccMonth` | `1` |
| `AccYear` | `2027` |
| `Qty` | `0.00` |
| `AverageCost` | `0.00` |
| `Amount` | `0.00` |

Interpretasi: item `MO03003` punya issue realtime pada periode ini (`Qty 2`, `Amount 7,500`), tetapi closing snapshot akhir bulan = 0. Ini normal kalau stok item tersebut habis setelah movement periode berjalan.

---

## Relasi Real Antar Tabel

### A. Header ke Line

```sql
SELECT
  RTRIM(h.StockIssueID) AS StockIssueID,
  RTRIM(l.StockIssueLNID) AS StockIssueLNID,
  RTRIM(l.ItemCode) AS ItemCode,
  CAST(l.Qty AS decimal(18,2)) AS Qty,
  CAST(l.Amount AS decimal(18,2)) AS Amount
FROM IN_STOCKISSUE h
JOIN IN_STOCKISSUELN l ON h.StockIssueID = l.StockIssueID
WHERE RTRIM(h.AccYear) = '2027'
  AND CAST(RTRIM(h.AccMonth) AS int) = 1
  AND RTRIM(ISNULL(h.Status, '')) IN ('2','5','6');
```

Output real periode `2027-1`: `270` header, `537` line, `72,873.80` qty, `747,041,642.31` amount.

### B. Line Issue ke Jurnal Month-End

```sql
SELECT
  RTRIM(h.StockIssueID) AS StockIssueID,
  RTRIM(l.StockIssueLNID) AS StockIssueLNID,
  RTRIM(l.ItemCode) AS ItemCode,
  CAST(l.Qty AS decimal(18,2)) AS IssueQty,
  CAST(l.Amount AS decimal(18,2)) AS IssueAmount,
  RTRIM(t.DocType) AS DocType,
  RTRIM(t.AccCode) AS TrxAccCode,
  RTRIM(t.BlkCode) AS TrxBlkCode,
  CAST(t.Unit AS decimal(18,2)) AS TrxUnit,
  CAST(t.Amount AS decimal(18,2)) AS TrxAmount
FROM IN_STOCKISSUE h
JOIN IN_STOCKISSUELN l ON h.StockIssueID = l.StockIssueID
JOIN IN_MTHENDTRX t
  ON RTRIM(t.DocId) = RTRIM(h.StockIssueID)
 AND RTRIM(t.DocLnId) = RTRIM(l.StockIssueLNID)
 AND RTRIM(t.ItemCode) = RTRIM(l.ItemCode)
 AND RTRIM(t.DocType) = '24'
 AND RTRIM(t.AccYear) = RTRIM(h.AccYear)
 AND CAST(RTRIM(t.AccMonth) AS int) = CAST(RTRIM(h.AccMonth) AS int)
WHERE RTRIM(h.AccYear) = '2027'
  AND CAST(RTRIM(h.AccMonth) AS int) = 1
  AND RTRIM(ISNULL(h.Status, '')) IN ('2','5','6');
```

Audit match:

| Check | Result |
|---|---:|
| Joined journal rows | 1,074 |
| Joined issue lines | 537 |
| Joined trx unit | 145,747.60 |
| Joined net amount | 0.00 |
| Joined positive amount | 747,041,642.31 |
| Joined negative amount | -747,041,642.31 |

Kenapa `JoinedTrxUnit = 145,747.60`, bukan `72,873.80`? Karena setiap line issue muncul dua kali di jurnal: debit dan credit. Audit qty issue harus ambil dari `IN_STOCKISSUELN.Qty`; audit nilai issue terhadap jurnal harus pakai `SUM(CASE WHEN t.Amount > 0 THEN t.Amount ELSE 0 END)` atau absolute per pair.

### C. Realtime Issue ke Snapshot Month-End

```sql
SELECT
  RTRIM(m.ItemCode) AS ItemCode,
  RTRIM(m.LocCode) AS LocCode,
  CAST(m.Qty AS decimal(18,2)) AS SnapshotQty,
  CAST(m.Amount AS decimal(18,2)) AS SnapshotAmount,
  CAST(SUM(ISNULL(l.Qty,0)) AS decimal(18,2)) AS IssueQty,
  CAST(SUM(ISNULL(l.Amount,0)) AS decimal(18,2)) AS IssueAmount,
  COUNT(DISTINCT h.StockIssueID) AS IssueDocs,
  COUNT(*) AS IssueLines
FROM IN_MTHENDITEM m
JOIN IN_STOCKISSUELN l ON RTRIM(l.ItemCode) = RTRIM(m.ItemCode)
JOIN IN_STOCKISSUE h
  ON h.StockIssueID = l.StockIssueID
 AND RTRIM(h.LocCode) = RTRIM(m.LocCode)
WHERE RTRIM(m.AccYear) = '2027'
  AND CAST(RTRIM(m.AccMonth) AS int) = 1
  AND RTRIM(h.AccYear) = '2027'
  AND CAST(RTRIM(h.AccMonth) AS int) = 1
  AND RTRIM(ISNULL(h.Status, '')) IN ('2','5','6')
GROUP BY m.ItemCode, m.LocCode, m.Qty, m.Amount
ORDER BY IssueAmount DESC;
```

Contoh audit item real:

| ItemCode | LocCode | SnapshotQty | SnapshotAmount | IssueQty | IssueAmount | IssueDocs | IssueLines |
|---|---|---:|---:|---:|---:|---:|---:|
| `MO04164` | `PTRJ` | 105,000.00 | 246,749,888.74 | 60,000.00 | 140,999,919.80 | 11 | 11 |
| `MC02018` | `PTRJ` | 0.00 | 0.00 | 100.00 | 108,750,000.00 | 1 | 1 |
| `MO09285` | `PTRJ` | 0.00 | 0.00 | 21.00 | 105,525,000.00 | 2 | 2 |
| `MO04036` | `PTRJ` | 767.00 | 65,109,358.57 | 241.00 | 20,439,118.93 | 22 | 22 |
| `MC01005` | `PTRJ` | 727.00 | 16,575,420.88 | 570.00 | 12,995,859.54 | 25 | 25 |

Interpretasi penting: snapshot qty/amount tidak sama dengan issue qty/amount. Snapshot adalah posisi akhir. Issue adalah salah satu komponen movement. Audit lengkap closing harus memasukkan opening snapshot periode sebelumnya + receive + return + transfer + adjustment + fuel/workshop movement sesuai scope report.

---

## Audit Antar Tabel Periode `2027-1`

### 1. Realtime Stock Issue

```sql
SELECT
  COUNT(DISTINCT h.StockIssueID) AS IssueDocs,
  COUNT(*) AS IssueLines,
  COUNT(DISTINCT RTRIM(l.ItemCode)) AS IssueItems,
  CAST(SUM(l.Qty) AS decimal(18,2)) AS IssueQty,
  CAST(SUM(l.Amount) AS decimal(18,2)) AS IssueAmount
FROM IN_STOCKISSUE h
JOIN IN_STOCKISSUELN l ON h.StockIssueID = l.StockIssueID
WHERE RTRIM(h.AccYear) = '2027'
  AND CAST(RTRIM(h.AccMonth) AS int) = 1
  AND RTRIM(ISNULL(h.Status, '')) IN ('2','5','6');
```

Result:

| IssueDocs | IssueLines | IssueItems | IssueQty | IssueAmount |
|---:|---:|---:|---:|---:|
| 270 | 537 | 137 | 72,873.80 | 747,041,642.31 |

### 2. Month-End Journal

```sql
SELECT
  RTRIM(DocType) AS DocType,
  COUNT(*) AS TotalRows,
  COUNT(DISTINCT RTRIM(DocId)) AS DistinctDocs,
  COUNT(DISTINCT RTRIM(DocLnId)) AS DistinctLines,
  CAST(SUM(Unit) AS decimal(18,2)) AS SumUnit,
  CAST(SUM(Amount) AS decimal(18,2)) AS NetAmount,
  CAST(SUM(CASE WHEN Amount > 0 THEN Amount ELSE 0 END) AS decimal(18,2)) AS PositiveAmount,
  CAST(SUM(CASE WHEN Amount < 0 THEN Amount ELSE 0 END) AS decimal(18,2)) AS NegativeAmount
FROM IN_MTHENDTRX
WHERE RTRIM(AccYear) = '2027'
  AND CAST(RTRIM(AccMonth) AS int) = 1
GROUP BY RTRIM(DocType)
ORDER BY RTRIM(DocType);
```

Result:

| DocType | TotalRows | DistinctDocs | DistinctLines | SumUnit | NetAmount | PositiveAmount | NegativeAmount |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 24 | 1,074 | 270 | 537 | 145,747.60 | 0.00 | 747,041,642.31 | -747,041,642.31 |
| 25 | 262 | 123 | 131 | 20,290.00 | 0.00 | 171,913,818.43 | -171,913,818.43 |

`DocType = 24` sama dengan stock issue. `DocType = 25` adalah fuel issue, jangan digabung jika audit khusus `IN_STOCKISSUE`.

### 3. Month-End Snapshot

```sql
SELECT
  COUNT(*) AS SnapshotRows,
  COUNT(DISTINCT RTRIM(ItemCode)) AS SnapshotItems,
  CAST(SUM(Qty) AS decimal(18,2)) AS SnapshotQty,
  CAST(SUM(Amount) AS decimal(18,2)) AS SnapshotAmount
FROM IN_MTHENDITEM
WHERE RTRIM(AccYear) = '2027'
  AND CAST(RTRIM(AccMonth) AS int) = 1;
```

Result:

| SnapshotRows | SnapshotItems | SnapshotQty | SnapshotAmount |
|---:|---:|---:|---:|
| 11,760 | 11,760 | 316,050.18 | 132,439,078,100.92 |

### 4. Reconciliation Rule

Gunakan rule ini:

```text
Realtime stock issue amount
= SUM(IN_STOCKISSUELN.Amount)
= SUM(IN_MTHENDTRX.Amount WHERE DocType='24' AND Amount > 0)
= ABS(SUM(IN_MTHENDTRX.Amount WHERE DocType='24' AND Amount < 0))

Month-end snapshot amount
= SUM(IN_MTHENDITEM.Amount)
= closing inventory value
≠ realtime issue amount
```

Untuk periode `2027-1`:

```text
747,041,642.31 = 747,041,642.31 = ABS(-747,041,642.31)
132,439,078,100.92 adalah saldo akhir inventory, bukan nilai issue.
```

---

## Query Audit Mismatch Yang Disarankan

### Issue line belum punya jurnal month-end `DocType = 24`

```sql
SELECT TOP 50
  RTRIM(h.StockIssueID) AS StockIssueID,
  RTRIM(l.StockIssueLNID) AS StockIssueLNID,
  RTRIM(l.ItemCode) AS ItemCode,
  CAST(l.Qty AS decimal(18,2)) AS Qty,
  CAST(l.Amount AS decimal(18,2)) AS Amount
FROM IN_STOCKISSUE h
JOIN IN_STOCKISSUELN l ON h.StockIssueID = l.StockIssueID
LEFT JOIN IN_MTHENDTRX t
  ON RTRIM(t.DocId) = RTRIM(h.StockIssueID)
 AND RTRIM(t.DocLnId) = RTRIM(l.StockIssueLNID)
 AND RTRIM(t.ItemCode) = RTRIM(l.ItemCode)
 AND RTRIM(t.DocType) = '24'
 AND RTRIM(t.AccYear) = RTRIM(h.AccYear)
 AND CAST(RTRIM(t.AccMonth) AS int) = CAST(RTRIM(h.AccMonth) AS int)
WHERE RTRIM(h.AccYear) = '2027'
  AND CAST(RTRIM(h.AccMonth) AS int) = 1
  AND RTRIM(ISNULL(h.Status, '')) IN ('2','5','6')
GROUP BY h.StockIssueID, l.StockIssueLNID, l.ItemCode, l.Qty, l.Amount
HAVING COUNT(t.DocId) = 0;
```

Expected untuk periode sehat: 0 rows.

### Jurnal `DocType = 24` tanpa source issue line

```sql
SELECT TOP 50
  RTRIM(t.DocId) AS DocId,
  RTRIM(t.DocLnId) AS DocLnId,
  RTRIM(t.ItemCode) AS ItemCode,
  CAST(t.Unit AS decimal(18,2)) AS Unit,
  CAST(t.Amount AS decimal(18,2)) AS Amount
FROM IN_MTHENDTRX t
LEFT JOIN IN_STOCKISSUE h
  ON RTRIM(h.StockIssueID) = RTRIM(t.DocId)
 AND RTRIM(h.AccYear) = RTRIM(t.AccYear)
 AND CAST(RTRIM(h.AccMonth) AS int) = CAST(RTRIM(t.AccMonth) AS int)
LEFT JOIN IN_STOCKISSUELN l
  ON RTRIM(l.StockIssueID) = RTRIM(t.DocId)
 AND RTRIM(l.StockIssueLNID) = RTRIM(t.DocLnId)
 AND RTRIM(l.ItemCode) = RTRIM(t.ItemCode)
WHERE RTRIM(t.AccYear) = '2027'
  AND CAST(RTRIM(t.AccMonth) AS int) = 1
  AND RTRIM(t.DocType) = '24'
  AND l.StockIssueLNID IS NULL;
```

Expected untuk periode sehat: 0 rows.

### Snapshot item yang punya issue tapi closing zero

```sql
SELECT TOP 50
  RTRIM(m.ItemCode) AS ItemCode,
  RTRIM(m.LocCode) AS LocCode,
  CAST(m.Qty AS decimal(18,2)) AS SnapshotQty,
  CAST(m.Amount AS decimal(18,2)) AS SnapshotAmount,
  CAST(SUM(l.Qty) AS decimal(18,2)) AS IssueQty,
  CAST(SUM(l.Amount) AS decimal(18,2)) AS IssueAmount
FROM IN_MTHENDITEM m
JOIN IN_STOCKISSUELN l ON RTRIM(l.ItemCode) = RTRIM(m.ItemCode)
JOIN IN_STOCKISSUE h
  ON h.StockIssueID = l.StockIssueID
 AND RTRIM(h.LocCode) = RTRIM(m.LocCode)
WHERE RTRIM(m.AccYear) = '2027'
  AND CAST(RTRIM(m.AccMonth) AS int) = 1
  AND RTRIM(h.AccYear) = '2027'
  AND CAST(RTRIM(h.AccMonth) AS int) = 1
  AND RTRIM(ISNULL(h.Status, '')) IN ('2','5','6')
  AND m.Qty = 0
GROUP BY m.ItemCode, m.LocCode, m.Qty, m.Amount
ORDER BY IssueAmount DESC;
```

Ini bukan otomatis error. Ini daftar item yang keluar di periode berjalan dan saldo akhirnya 0.

---

## Hal Yang Jangan Dilakukan

- Jangan samakan `SUM(IN_MTHENDITEM.Amount)` dengan `SUM(IN_STOCKISSUELN.Amount)`. Snapshot ≠ transaction.
- Jangan audit `IN_MTHENDTRX.DocType = 24` memakai `SUM(Amount)` net; hasilnya 0 karena debit/credit. Pakai `PositiveAmount` atau `ABS(NegativeAmount)`.
- Jangan join char field tanpa `RTRIM()`. `AccMonth`, `AccYear`, `DocId`, `DocLnId`, `ItemCode` adalah `char`, banyak trailing spaces.
- Jangan gabungkan `DocType = 25` saat audit khusus `IN_STOCKISSUE`; itu fuel issue.
- Jangan masukkan `Status = 1` bila hanya ingin posted/approved movement. Periode ini data real yang relevan adalah `Status = 6`.
