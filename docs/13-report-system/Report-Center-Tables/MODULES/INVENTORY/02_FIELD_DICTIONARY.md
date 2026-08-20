# Inventory Field Dictionary

> Source schema: `db_ptrj_mill`.
> Example period: `AccYear = 2027`, `AccMonth = 1`.
> Free-text fields redacted when needed.

## 1. `IN_STOCKISSUE` — Header Issue

### Fungsi

Header dokumen barang keluar. Satu header punya banyak line di `IN_STOCKISSUELN`.

### Field Lengkap

| Field | Type | Nullable | Definisi | Contoh Real | Case / Catatan |
|---|---|---|---|---|---|
| `StockIssueID` | `char(20)` | NO | ID dokumen issue. | `SI26016036` | Join utama ke line dan jurnal. |
| `DNID` | `char(20)` | YES | Reference delivery note/internal. | blank | Tidak selalu terisi. |
| `BillPartyCode` | `char(20)` | YES | Kode pihak pembebanan/tagihan. | blank | Bisa kosong. |
| `IssueType` | `char(2)` | YES | Jenis issue. | `1` | Kode bisnis internal. |
| `TotalAmount` | `decimal(20,5)` | YES | Total amount header. | `7500.00` | Harus cocok dengan sum line untuk dokumen sederhana. |
| `Remark` | `nvarchar(500)` | YES | Catatan user/proses. | `[REDACTED_REMARK]` | Field bebas, jangan publish mentah bila ada nama/catatan internal. |
| `AccMonth` | `char(2)` | YES | Accounting month. | `1` | Pakai `CAST(RTRIM(AccMonth) AS int)`. |
| `AccYear` | `char(4)` | YES | Accounting year. | `2027` | Pakai `RTRIM(AccYear)`. |
| `LocCode` | `char(8)` | NO | Lokasi/gudang sumber. | `PTRJ` | Join ke snapshot location. |
| `Status` | `char(2)` | YES | Status dokumen. | `6` | Filter audit movement: `('2','5','6')`; periode ini status real `6`. |
| `PayrollPosted` | `char(2)` | YES | Flag posting payroll/interface. | `0` | Bukan indikator utama inventory. |
| `CreateDate` | `datetime` | YES | Tanggal dibuat. | `Apr 1 2026 7:38AM` | Tanggal input, bukan selalu periode akuntansi. |
| `UpdateDate` | `datetime` | YES | Tanggal update terakhir. | `Apr 5 2026 10:22AM` | Audit operasional. |
| `UpdateID` | `char(20)` | YES | User update internal. | `adm027` | User ID internal; jangan perluas ke data personal. |
| `PrintDate` | `datetime` | YES | Tanggal cetak. | `Jan 1 1900 12:00AM` | `1900-01-01` berarti default/not printed. |
| `TotalPrice` | `decimal(20,5)` | NO | Total price header. | `7500.00` | Sering sama dengan `TotalAmount`. |
| `ChargeLocCode` | `char(8)` | NO | Lokasi pembebanan. | `PTRJ` | Bisa beda dari `LocCode` pada case antar lokasi. |
| `PSEMPCODE` | `char(20)` | YES | Employee/PS code jika issue terkait person. | blank | Sensitive if populated. |
| `PostDate` | `datetime` | NO | Tanggal posting. | `May 1 2026 2:40AM` | Dipakai untuk event/movement recency. |
| `StockIssueRefDate` | `datetime` | YES | Tanggal referensi issue. | `Apr 1 2026 12:00AM` | Tanggal dokumen referensi. |
| `StockIssueRefNo` | `varchar(32)` | YES | Nomor referensi issue. | blank | Tidak selalu terisi. |

### Makna Bisnis

`IN_STOCKISSUE` menjawab pertanyaan:

```text
Dokumen apa?
Dari gudang/lokasi mana?
Periode akuntansi apa?
Statusnya sudah posting atau belum?
Total dokumen berapa?
```

---

## 2. `IN_STOCKISSUELN` — Detail Item Issue

### Fungsi

Line barang yang keluar/dipakai. Ini sumber utama nilai pemakaian barang.

### Field Lengkap

| Field | Type | Nullable | Definisi | Contoh Real | Case / Catatan |
|---|---|---|---|---|---|
| `StockIssueLNID` | `char(20)` | NO | ID line issue. | `SIL26031950` | Join ke `IN_MTHENDTRX.DocLnId`. |
| `StockIssueID` | `char(20)` | NO | ID header issue. | `SI26016036` | FK ke `IN_STOCKISSUE`. |
| `AccCode` | `char(32)` | YES | Akun pembebanan line. | `OC7318` | Biasanya akun expense/cost center. |
| `BlkCode` | `char(8)` | YES | Blok/station cost center. | `GEN01001` | Tujuan pemakaian barang. |
| `VehCode` | `char(8)` | YES | Vehicle code. | blank | Terisi bila issue ke kendaraan. |
| `VehExpCode` | `char(8)` | YES | Vehicle expense code. | blank | Terisi bila biaya kendaraan. |
| `PsEmpCode` | `char(20)` | YES | Employee/person code. | blank | Sensitive if populated. |
| `ItemCode` | `char(20)` | NO | Kode barang. | `MO03003` | Join ke item master, jurnal, snapshot. |
| `QtyReturn` | `decimal(20,5)` | YES | Qty return terhadap issue. | `0.00` | Perlu diperhitungkan bila audit net issue. |
| `Qty` | `decimal(20,5)` | YES | Qty barang keluar. | `2.00` | Satuan mengikuti item. |
| `Cost` | `decimal(20,5)` | YES | Cost per unit saat issue. | `3750.00` | Cost transaksi, bukan average cost closing. |
| `Amount` | `decimal(20,5)` | YES | Nilai uang barang dipakai/keluar. | `7500.00` | `Qty × Cost`; bukan valuasi seluruh stok. |
| `Price` | `decimal(20,5)` | NO | Price per unit. | `3750.00` | Sering sama dengan cost. |
| `PriceAmount` | `decimal(20,5)` | NO | `Qty × Price`. | `7500.00` | Nilai berbasis price. |
| `TotalPrice` | `decimal(20,5)` | NO | Total price tambahan. | `0.00` | Bisa tidak dipakai. |
| `TaxRate` | `decimal(5,2)` | YES | Rate pajak. | `NULL` | Tidak selalu ada. |
| `TaxRef` | `varchar(20)` | YES | Referensi pajak. | `NULL` | Tidak selalu ada. |
| `TaxInd` | `varchar(1)` | YES | Indikator pajak. | `0` | Kode internal. |
| `ExportHistoryID` | `bigint` | YES | ID history export/interface. | `0` | Audit integrasi. |

### Makna `Amount`

```text
IN_STOCKISSUELN.Amount = Qty yang dipakai × Cost transaksi
```

Contoh real:

```text
Qty    = 2
Cost   = 3,750
Amount = 7,500
```

Artinya barang senilai `7,500` dipakai/dikeluarkan dari inventory.

---

## 3. `IN_MTHENDTRX` — Month-End Transaction Journal

### Fungsi

Jurnal month-end inventory. Untuk issue barang (`DocType = 24`), satu line realtime issue menjadi dua row jurnal: positif dan negatif.

### Field Lengkap

| Field | Type | Nullable | Definisi | Contoh Real | Case / Catatan |
|---|---|---|---|---|---|
| `DocId` | `char(20)` | NO | ID dokumen sumber. | `SI26016036` | Untuk stock issue = `IN_STOCKISSUE.StockIssueID`. |
| `DocLnId` | `char(20)` | NO | ID line sumber. | `SIL26031950` | Untuk stock issue = `IN_STOCKISSUELN.StockIssueLNID`. |
| `DocType` | `char(3)` | YES | Tipe dokumen. | `24` | `24` stock issue, `25` fuel issue. |
| `DocDate` | `datetime` | NO | Tanggal transaksi sumber. | `Apr 1 2026` | Bukan selalu sama dengan `PostDate`. |
| `LocCode` | `char(8)` | NO | Lokasi/gudang. | `PTRJ` | Cocok dengan source issue. |
| `ModuleCode` | `char(8)` | NO | Module asal. | `3` | Inventory module. |
| `AccMonth` | `char(2)` | NO | Accounting month. | `1` | Pakai `CAST(RTRIM(...))`. |
| `AccYear` | `char(4)` | NO | Accounting year. | `2027` | Periode jurnal. |
| `EmpCode` | `char(20)` | NO | Employee code. | blank | Umumnya blank untuk stock issue. |
| `AccCode` | `char(32)` | NO | Akun jurnal. | `OC7318` / `CA2118` | Positif ke expense/cost, negatif ke inventory account. |
| `BlkCode` | `char(8)` | NO | Blok/station jurnal. | `GEN01001` / blank | Sisi inventory biasanya blank. |
| `VehCode` | `char(8)` | NO | Vehicle code. | blank | Terisi untuk vehicle issue. |
| `VehExpenseCode` | `char(8)` | NO | Expense kendaraan. | blank | Terisi untuk vehicle issue. |
| `ItemCode` | `char(20)` | NO | Kode barang. | `MO03003` | Harus sama dengan line issue. |
| `Unit` | `decimal(20,5)` | NO | Qty jurnal. | `2.00` | Muncul di kedua row debit/credit, sehingga total unit dobel. |
| `Cost` | `decimal(20,5)` | NO | Cost per unit jurnal. | `3750.00` / `-3750.00` | Sisi credit negatif. |
| `Amount` | `decimal(20,5)` | NO | Nilai jurnal. | `7500.00` / `-7500.00` | Net pair = 0. Ambil positive side untuk nilai pemakaian. |
| `Price` | `decimal(20,5)` | YES | Price/unit. | `3750.00` / `-3750.00` | Ikut sign jurnal. |
| `PriceAmount` | `decimal(20,5)` | YES | Amount berbasis price. | `7500.00` / `-7500.00` | Ikut sign jurnal. |
| `Description` | `nvarchar(1000)` | YES | Deskripsi transaksi. | `[REDACTED_DESCRIPTION]` | Bisa berisi nama/catatan internal. |

### Pola Debit/Credit

Untuk satu line `SI26016036 / SIL26031950`:

| Sisi | AccCode | Amount | Makna |
|---|---|---:|---|
| Debit | `OC7318` | 7,500 | nilai barang dipakai dibebankan ke cost center |
| Credit | `CA2118` | -7,500 | inventory/cost account berkurang |

Maka:

```text
SUM(Amount) = 0
SUM(Amount > 0) = nilai barang dipakai
ABS(SUM(Amount < 0)) = nilai inventory keluar
```

---

## 4. `IN_MTHENDITEM` — Month-End Item Snapshot

### Fungsi

Snapshot saldo akhir bulan per item/lokasi/periode. Ini adalah posisi/valuasi sisa stok, bukan transaksi keluar.

### Field Lengkap

| Field | Type | Nullable | Definisi | Contoh Real | Case / Catatan |
|---|---|---|---|---|---|
| `ItemCode` | `char(20)` | NO | Kode barang. | `MO03003` | Join ke issue line dan item master. |
| `LocCode` | `char(8)` | NO | Lokasi/gudang. | `PTRJ` | Join ke issue header `LocCode`. |
| `AccMonth` | `char(2)` | NO | Accounting month snapshot. | `1` | Closing period. |
| `AccYear` | `char(4)` | NO | Accounting year snapshot. | `2027` | Closing year. |
| `Qty` | `decimal(20,5)` | NO | Qty tersisa saat closing. | `0.00` | Bisa 0 walau ada issue. |
| `AverageCost` | `decimal(20,5)` | NO | Average cost closing. | `0.00` | Cost rata-rata saldo akhir. |
| `Amount` | `decimal(20,5)` | NO | Valuasi stok akhir. | `0.00` | `Qty × AverageCost`; bukan nilai barang dipakai. |

### Makna `Amount`

```text
IN_MTHENDITEM.Amount = nilai uang stok tersisa pada akhir bulan
```

Contoh real untuk item yang sama dengan issue:

```text
ItemCode = MO03003
Issue Amount periode ini = 7,500
Snapshot Qty akhir bulan = 0
Snapshot Amount akhir bulan = 0
```

Artinya item itu dipakai, lalu saldo akhir bulan habis.

---

## Ringkasan Makna `Amount`

| Table | Field | Makna | Jawaban Untuk Pertanyaan |
|---|---|---|---|
| `IN_STOCKISSUELN` | `Amount` | Nilai uang barang yang dipakai/keluar | “Berapa nilai barang yang digunakan?” |
| `IN_MTHENDTRX` | `Amount` | Nilai jurnal debit/credit dari transaksi | “Apakah transaksi sudah masuk jurnal month-end?” |
| `IN_MTHENDITEM` | `Amount` | Valuasi stok tersisa akhir bulan | “Berapa nilai stok/aset inventory yang masih ada?” |

## Contoh Konsep Barang A

```text
Barang A nilai awal: 10 juta
Barang A dipakai:   6 juta
Barang A sisa:      4 juta
```

Maka:

```text
IN_STOCKISSUELN.Amount = 6 juta
IN_MTHENDTRX.Amount    = +6 juta dan -6 juta
IN_MTHENDITEM.Amount   = 4 juta
```

Kalau ada receive/transfer/adjustment, closing bisa bukan `10 - 6`.
