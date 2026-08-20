# PU_GOODSRCV — Goods Receiving Header

## Posisi dalam Arsitektur

**Domain:** Purchasing / Goods Receipt
**Alias yang digunakan:** `h`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Deskripsi

Header untuk transaksi Goods Receiving (GRN) — penerimaan barang dari supplier berdasarkan Purchase Order. Berbeda dari `IN_STOCKRECEIVE`: `PU_GOODSRCV` dikelola via modul Purchasing dan lebih detail (ada `InvoiceNo`, `CommAmount` untuk landed cost).

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `GoodsRcvID` | `int` PK | Primary key |
| `SupplierCode` | `varchar` | FK → `PU_SUPPLIER.SupplierCode` |
| `CreateDate` | `datetime` | Tanggal dibuat/diterima |
| `GoodsRcvRefDate` | `date` | Tanggal reference |
| `GoodsRcvRefNo` | `varchar` | Nomor GRN |
| `InvoiceNo` | `varchar` | Nomor invoice supplier |
| `PODate` | `date` | Tanggal PO |
| `POID` | `int` | FK → `PU_PO.POID` |
| `Status` | `varchar` | Status |

## Join Pattern

```sql
INNER JOIN [db].[dbo].[PU_GOODSRCV] h ON l.GoodsRcvID = h.GoodsRcvID
JOIN      [db].[dbo].[PU_GOODSRCVLN] l ON l.GoodsRcvID = h.GoodsRcvID
LEFT JOIN [db].[dbo].[PU_POLN] p ON l.POLnID = p.POLnID
LEFT JOIN [db].[dbo].[PU_SUPPLIER] s ON h.SupplierCode = s.SupplierCode
LEFT JOIN [db].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
```

## Output Columns (AS aliases)

```
GoodsRcvID, GoodsRcvRefDate, GoodsRcvRefNo, SupplierCode, CreateDate,
InvoiceNo, PODate, POID, Status,
TotalGR, GoodsReceiveAmount, GoodsReceiveQty, LastGRDate, ReceiveAmount,
OutstandingInvoice, LastInvoiceDate, TotalInvoice
```
