# PU_POLN — Purchase Order Line

## Posisi dalam Arsitektur

**Domain:** Purchasing
**Alias yang digunakan:** `p`, `v`
**Parent:** `PU_PO` → FK `POID`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Deskripsi

Detail item per Purchase Order. `POLnID` adalah link utama untuk tracking outstanding — JOINS ke `PU_GOODSRCVLN.POLnID` untuk menghitung qty received vs ordered.

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `POLnID` | `int` PK | Primary key |
| `POID` | `int` FK | FK → `PU_PO.POID` |
| `ItemCode` | `varchar` | FK → `IN_ITEM.ItemCode` |
| `ProdTypeCode` | `varchar` | Product type |
| `Qty` | `decimal` | Quantity ordered |
| `QtyOrder` | `decimal` | Quantity order (alias) |
| `QtyOutstanding` | `decimal` | Quantity belum diterima |
| `Cost` | `decimal` | Unit cost |
| `Status` | `varchar` | Status line |

## Join Pattern

```sql
LEFT JOIN [db].[dbo].[PU_POLN] p ON l.POLnID = p.POLnID
-- Digunakan di:
--   Goods Receiving: link GR line ke PO line
--   Purchase Order History: join PO ke item
--   Purchase Request: link PR line ke PO line
```

## Output Columns (AS aliases)

```
POLnID, POID, ItemCode, ProdTypeCode, Qty, QtyOrder, QtyOutstanding,
Cost, Status, Description, QtyReceive, QtyRcv
```
