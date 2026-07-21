# IN_STOCKTRANSFERLN — Transfer Line

## Posisi dalam Arsitektur

**Domain:** Stock Flow / Transfer
**Alias yang digunakan:** `l`
**Parent:** `IN_STOCKTRANSFER` → FK `StockTransferID`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `StockTransferLnID` | `int` PK | Primary key |
| `StockTransferID` | `int` FK | FK → `IN_STOCKTRANSFER.StockTransferID` |
| `ItemCode` | `varchar` | FK → `IN_ITEM.ItemCode` |
| `Qty` | `decimal` | Quantity ditransfer |
| `Amount` | `decimal` | Total amount |
| `Cost` | `decimal` | Unit cost |
| `Status` | `varchar` | Status line |

## Output Columns (AS aliases)

```
StockTransferID, StockTransferLineID, ItemCode, Qty, Amount, Cost,
QtyTransfer, NilaiTransfer
```
