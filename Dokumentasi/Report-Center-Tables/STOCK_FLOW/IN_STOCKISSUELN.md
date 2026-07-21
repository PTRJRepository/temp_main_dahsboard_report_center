# IN_STOCKISSUELN — Stock Issue Line

## Posisi dalam Arsitektur

**Domain:** Stock Flow / Issue
**Alias yang digunakan:** `l`
**Parent:** `IN_STOCKISSUE` → FK `StockIssueID`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Deskripsi

Detail barang yang dikeluarkan per transaksi issue. Qty dan Amount adalah nilai moneter barang yang keluar. Kolom `Cost` adalah harga per unit saat issue.

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `StockIssueLnID` | `int` PK | Primary key |
| `StockIssueID` | `int` FK | FK → `IN_STOCKISSUE.StockIssueID` |
| `ItemCode` | `varchar` | FK → `IN_ITEM.ItemCode` |
| `Qty` | `decimal` | Quantity keluar |
| `Amount` | `decimal` | Total amount (Qty × Cost) |
| `Cost` | `decimal` | Unit cost saat issue |
| `UnitCode` | `varchar` | Unit code |
| `Status` | `varchar` | Status line |
| `TransactDate` | `date` | Tanggal transaksi |

## Join Pattern

```sql
INNER JOIN [db].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
JOIN      [db].[dbo].[IN_STOCKISSUELN] l ON l.StockIssueID = h.StockIssueID
LEFT JOIN [db].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
```

## Output Columns (AS aliases)

```
StockIssueID, StockIssueLineID, ItemCode, Qty, Amount, Cost,
QtyKeluar, NilaiKeluar, Gudang, GudangTujuan
```
