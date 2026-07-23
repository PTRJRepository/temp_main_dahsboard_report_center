# Inventory Business Cases

## Case 1 — Barang Dipakai Dari Gudang

### Pertanyaan Bisnis

```text
Barang apa yang dipakai?
Berapa qty dipakai?
Berapa nilai uang barang yang dipakai?
Dibebankan ke cost center/akun apa?
```

### Tabel Jawaban

| Pertanyaan | Tabel | Field |
|---|---|---|
| dokumen apa | `IN_STOCKISSUE` | `StockIssueID`, `IssueType`, `Status`, `PostDate` |
| item apa | `IN_STOCKISSUELN` | `ItemCode` |
| qty dipakai | `IN_STOCKISSUELN` | `Qty` |
| nilai dipakai | `IN_STOCKISSUELN` | `Amount` |
| akun/blok pembebanan | `IN_STOCKISSUELN` | `AccCode`, `BlkCode`, `VehCode`, `VehExpCode` |

### Contoh Real

```text
StockIssueID   = SI26016036
StockIssueLNID = SIL26031950
ItemCode       = MO03003
Qty            = 2
Cost           = 3,750
Amount         = 7,500
AccCode        = OC7318
BlkCode        = GEN01001
```

Interpretasi:

```text
Barang MO03003 dipakai 2 unit.
Nilai uang yang dipakai = 2 × 3,750 = 7,500.
Biaya dibebankan ke OC7318 / GEN01001.
```

---

## Case 2 — Barang Dipakai Masuk Jurnal Month-End

### Pertanyaan Bisnis

```text
Apakah issue realtime sudah diposting ke month-end?
Apakah nilai issue sama dengan jurnal?
```

### Tabel Jawaban

| Pertanyaan | Tabel | Field |
|---|---|---|
| source dokumen | `IN_STOCKISSUE` | `StockIssueID` |
| source line | `IN_STOCKISSUELN` | `StockIssueLNID`, `ItemCode`, `Amount` |
| jurnal month-end | `IN_MTHENDTRX` | `DocId`, `DocLnId`, `DocType`, `Amount` |

### Join Real

```text
IN_MTHENDTRX.DocId   = IN_STOCKISSUE.StockIssueID
IN_MTHENDTRX.DocLnId = IN_STOCKISSUELN.StockIssueLNID
IN_MTHENDTRX.ItemCode = IN_STOCKISSUELN.ItemCode
IN_MTHENDTRX.DocType = '24'
periode sama
```

### Contoh Real

| Row | Table | Amount | Makna |
|---:|---|---:|---|
| 1 | `IN_STOCKISSUELN` | 7,500 | nilai barang dipakai |
| 2 | `IN_MTHENDTRX` | 7,500 | debit/pembebanan |
| 3 | `IN_MTHENDTRX` | -7,500 | credit/inventory berkurang |

Interpretasi:

```text
Realtime issue senilai 7,500 sudah masuk jurnal.
Jurnal net 0 karena double-entry.
Nilai pemakaian tetap 7,500, bukan 0.
```

---

## Case 3 — Cek Valuasi Stok Akhir Bulan

### Pertanyaan Bisnis

```text
Setelah semua transaksi bulan ini, stok tersisa berapa?
Nilai uang stok tersisa berapa?
```

### Tabel Jawaban

| Pertanyaan | Tabel | Field |
|---|---|---|
| qty tersisa | `IN_MTHENDITEM` | `Qty` |
| average cost closing | `IN_MTHENDITEM` | `AverageCost` |
| nilai stok akhir | `IN_MTHENDITEM` | `Amount` |

### Contoh Real

```text
ItemCode     = MO03003
LocCode      = PTRJ
AccYear      = 2027
AccMonth     = 1
Qty          = 0
AverageCost  = 0
Amount       = 0
```

Interpretasi:

```text
MO03003 dipakai pada periode ini, tapi closing stock = 0.
Berarti tidak ada nilai stok tersisa untuk item itu pada akhir bulan.
```

---

## Case 4 — “Barang A Total Valuasi 10, Dipakai 6”

### Jawaban Bisnis

Kalau stok barang A bernilai 10 juta, lalu yang digunakan 6 juta:

```text
nilai barang dipakai = 6 juta
nilai stok tersisa   = 4 juta
```

Mapping tabel:

| Konsep | Tabel | Amount |
|---|---|---:|
| Barang yang dipakai | `IN_STOCKISSUELN` | 6 juta |
| Jurnal pemakaian | `IN_MTHENDTRX` | +6 juta dan -6 juta |
| Stok tersisa akhir bulan | `IN_MTHENDITEM` | 4 juta |

### Kenapa Bisa Tidak Persis 4 Juta?

Karena closing snapshot dipengaruhi semua movement:

```text
Closing stock value
= Opening stock value
+ Receive value
+ Transfer-in value
+ Adjustment-plus value
+ Return-in value
- Issue value
- Transfer-out value
- Adjustment-minus value
- Other inventory movement
```

Jadi jangan simpulkan `IN_MTHENDITEM.Amount = opening - stock issue` tanpa menghitung movement lain.

---

## Case 5 — Kenapa `IN_MTHENDTRX` Net Amount 0?

`IN_MTHENDTRX` adalah jurnal, bukan report pemakaian langsung.

Untuk setiap line issue:

```text
Debit  expense/cost center       +Amount
Credit inventory/cost account    -Amount
```

Maka:

```text
SUM(IN_MTHENDTRX.Amount) = 0
```

Ini benar. Kalau mau nilai barang dipakai:

```sql
SUM(CASE WHEN Amount > 0 THEN Amount ELSE 0 END)
```

atau dari realtime:

```sql
SUM(IN_STOCKISSUELN.Amount)
```

---

## Case 6 — Item Punya Issue Tapi Snapshot 0

Contoh real:

```text
ItemCode = MC02018
SnapshotQty = 0
SnapshotAmount = 0
IssueQty = 100
IssueAmount = 108,750,000
```

Interpretasi:

```text
Barang keluar/dipakai selama bulan berjalan.
Pada akhir bulan, saldo item itu 0.
```

Ini bukan otomatis bug.

Kemungkinan:

1. stok awal ada, lalu habis dipakai;
2. barang diterima lalu langsung dipakai;
3. ada adjustment/transfer yang menutup saldo;
4. item memang tidak punya saldo akhir.

---

## Case 7 — Item Punya Snapshot Besar Dan Issue Besar

Contoh real:

```text
ItemCode        = MO04164
SnapshotQty     = 105,000
SnapshotAmount  = 246,749,888.74
IssueQty        = 60,000
IssueAmount     = 140,999,919.80
IssueDocs       = 11
```

Interpretasi:

```text
Barang ini masih punya stok akhir besar.
Selama periode juga ada pemakaian besar.
```

Jangan baca `SnapshotAmount` sebagai pemakaian. Itu nilai sisa.

---

## Decision Guide

| Kalau mau tahu... | Pakai |
|---|---|
| nilai barang yang dipakai | `IN_STOCKISSUELN.Amount` |
| qty barang yang dipakai | `IN_STOCKISSUELN.Qty` |
| transaksi sudah masuk month-end belum | join ke `IN_MTHENDTRX` `DocType = '24'` |
| nilai pemakaian menurut jurnal | `IN_MTHENDTRX.Amount > 0` untuk `DocType = '24'` |
| inventory berkurang menurut jurnal | `ABS(IN_MTHENDTRX.Amount < 0)` untuk `DocType = '24'` |
| stok akhir bulan | `IN_MTHENDITEM.Qty` |
| nilai stok akhir bulan/aset inventory | `IN_MTHENDITEM.Amount` |
| audit closing lengkap | opening snapshot + semua movement + closing snapshot |
