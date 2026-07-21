# IN_STOCKRECEIVE — Stock Receipt Header

## Posisi dalam Arsitektur

**Domain:** Stock Flow / Receipt
**Alias yang digunakan:** `h`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Deskripsi

Header untuk transaksi penerimaan barang ke gudang. Setiap `StockReceiveID` merepresentasikan satu slip/DO penerimaan. Kolom-kolom `StockRefDate` dan `ReferenceNo` biasanya merujuk ke dokumen delivery order atau GRN reference.

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `StockReceiveID` | `int` PK | Primary key |
| `LocCode` | `varchar` | Lokasi gudang penerima |
| `TransDate` | `date` | Tanggal transaksi |
| `StockRefDate` | `date` | Tanggal referensi/DO |
| `ReferenceNo` | `varchar` | Nomor referensi/DO |
| `SupplierCode` | `varchar` | Kode supplier (optional) |
| `Status` | `varchar` | Status receipt |
| `Remark` | `varchar` | Catatan/keterangan |

## Join Pattern

```sql
INNER JOIN [db].[dbo].[IN_STOCKRECEIVE] h
  ON l.StockReceiveID = h.StockReceiveID

LEFT JOIN [db].[dbo].[IN_ITEM] i
  ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
```

## Output Columns (AS aliases)

```
StockReceiveID, LocCode, TransDate, StockRefDate, ReferenceNo,
SupplierCode, Status, Tanggal, Dokumen, Gudang
```
