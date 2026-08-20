# IN_STOCKRECEIVELN — Stock Receipt Line

## Posisi dalam Arsitektur

**Domain:** Stock Flow / Receipt
**Alias yang digunakan:** `l`
**Parent:** `IN_STOCKRECEIVE` → FK `StockReceiveID`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Deskripsi

Detail/baris untuk setiap item yang diterima dalam satu transaksi receipt. Qty dan Amount di-record per item.

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `StockReceiveLnID` | `int` PK | Primary key |
| `StockReceiveID` | `int` FK | FK → `IN_STOCKRECEIVE.StockReceiveID` |
| `ItemCode` | `varchar` | FK → `IN_ITEM.ItemCode` |
| `Qty` | `decimal` | Quantity diterima |
| `Amount` | `decimal` | Total amount |
| `Cost` | `decimal` | Unit cost |
| `Status` | `varchar` | Status line |
| `ReferenceNo` | `varchar` | Referensi per line |
| `TransactDate` | `date` | Tanggal transaksi |

## Join Pattern

```sql
INNER JOIN [db].[dbo].[IN_STOCKRECEIVE] h ON l.StockReceiveID = h.StockReceiveID
JOIN      [db].[dbo].[IN_STOCKRECEIVELN] l ON l.StockReceiveID = h.StockReceiveID
LEFT JOIN [db].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
```

## Output Columns (AS aliases)

```
StockReceiveID, StockReceiveLineID, ItemCode, Qty, Amount, Cost,
QtyReceive, ReceiveQty, ReferenceNo, Gudang, GudangAsal
```
