# IN_STOCKTRANSFER — Transfer Header

## Posisi dalam Arsitektur

**Domain:** Stock Flow / Transfer
**Alias yang digunakan:** `h`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `StockTransferID` | `int` PK | Primary key |
| `FromLocCode` | `varchar` | Gudang asal |
| `ToLocCode` | `varchar` | Gudang tujuan |
| `TransDate` | `date` | Tanggal transfer |
| `ReferenceNo` | `varchar` | Nomor referensi |
| `Status` | `varchar` | Status |

## Join Pattern

```sql
INNER JOIN [db].[dbo].[IN_STOCKTRANSFER] h ON l.StockTransferID = h.StockTransferID
JOIN      [db].[dbo].[IN_STOCKTRANSFERLN] l ON l.StockTransferID = h.StockTransferID
LEFT JOIN [db].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
```

## Output Columns (AS aliases)

```
StockTransferID, FromLocCode, ToLocCode, TransDate, ReferenceNo, Status,
GudangAsal, GudangTujuan, Tanggal, Dokumen, QtyTransfer, NilaiTransfer
```
