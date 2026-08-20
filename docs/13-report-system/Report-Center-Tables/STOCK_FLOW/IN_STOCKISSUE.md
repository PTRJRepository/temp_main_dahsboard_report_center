# IN_STOCKISSUE — Stock Issue Header

## Posisi dalam Arsitektur

**Domain:** Stock Flow / Issue
**Alias yang digunakan:** `h`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Deskripsi

Header untuk transaksi pengeluaran barang dari gudang. Issue adalah inti dari movement category — setiap issue event menambah `StockIssueEventCount`. `BlkCode` dan `VehCode` menunjukkan tujuan pengeluaran (ke blok estate atau ke kendaraan).

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `StockIssueID` | `int` PK | Primary key |
| `LocCode` | `varchar` | Gudang pengirim |
| `TransDate` | `date` | Tanggal transaksi |
| `PostDate` | `date` | Tanggal posting |
| `ReferenceNo` | `varchar` | Nomor referensi |
| `TransType` | `varchar` | Tipe issue |
| `BlkCode` | `varchar` | Kode blok tujuan (estate) |
| `VehCode` | `varchar` | Kode kendaraan tujuan |
| `Remarks` | `varchar` | Catatan |
| `Status` | `varchar` | Status |
| `AccYear` | `int` | Accounting year |
| `AccMonth` | `int` | Accounting month |

## Join Pattern

```sql
-- Standard issue join
JOIN [db].[dbo].[IN_STOCKISSUELN] l ON l.StockIssueID = h.StockIssueID
JOIN [db].[dbo].[IN_ITEM] issueItem ON l.ItemCode = issueItem.ItemCode
LEFT JOIN [db].[dbo].[WS_JOB] j ON h.BlkCode = j.BlkCode
LEFT JOIN [db].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
```

## Output Columns (AS aliases)

```
StockIssueID, LocCode, TransDate, PostDate, ReferenceNo, TransType,
BlkCode, VehCode, Remarks, Status, AccYear, AccMonth,
ReferensiIssue, Dokumen, Gudang, GudangTujuan, Transaksi
```

## Peran dalam Movement Category

`StockIssueID` + `PostDate` adalah dasar penghitungan `StockIssueEventCount`. Setiap dokumen issue distinct di-COUNT:

```sql
COUNT(DISTINCT issueDocs.StockIssueID) AS StockIssueEventCount
```
