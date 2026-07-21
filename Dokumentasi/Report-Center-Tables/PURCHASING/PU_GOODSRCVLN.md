# PU_GOODSRCVLN — Goods Receiving Line

## Posisi dalam Arsitektur

**Domain:** Purchasing / Goods Receipt
**Alias yang digunakan:** `gl`, `l`
**Parent:** `PU_GOODSRCV` → FK `GoodsRcvID`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Deskripsi

Detail barang yang diterima per GRN. Kolom `POLnID` link ke PO line untuk tracking apakah barang sudah di-gr-kan atau belum (outstanding). `CommAmount` adalah landed cost (biaya tambahan seperti freight, insurance, dll).

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `GoodsRcvLnID` | `int` PK | Primary key |
| `GoodsRcvID` | `int` FK | FK → `PU_GOODSRCV.GoodsRcvID` |
| `POLnID` | `int` FK | FK → `PU_POLN.POLnID` (optional) |
| `ItemCode` | `varchar` | FK → `IN_ITEM.ItemCode` |
| `ReceiveQty` | `decimal` | Quantity diterima |
| `StockQty` | `decimal` | Quantity stok |
| `Amount` | `decimal` | Total amount |
| `Cost` | `decimal` | Unit cost |
| `CommAmount` | `decimal` | Commission/landed cost |

## Join Pattern

```sql
JOIN [db].[dbo].[PU_GOODSRCV] h ON l.GoodsRcvID = h.GoodsRcvID
JOIN [db].[dbo].[PU_GOODSRCVLN] l ON l.GoodsRcvID = h.GoodsRcvID
LEFT JOIN [db].[dbo].[PU_POLN] p ON l.POLnID = p.POLnID
LEFT JOIN [db].[dbo].[PU_SUPPLIER] s ON h.SupplierCode = s.SupplierCode
```

## Output Columns (AS aliases)

```
GoodsRcvID, GoodsRcvLnID, POLnID, ItemCode, ReceiveQty, StockQty,
Amount, Cost, CommAmount, GoodsReceiveQty, GoodsReceiveAmount,
QtyReceive, ReceiveQty, LineDescription, QtyRcv, QtyOrder, QtyOutstanding
```
