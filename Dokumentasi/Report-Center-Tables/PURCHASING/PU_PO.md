# PU_PO — Purchase Order Header

## Posisi dalam Arsitektur

**Domain:** Purchasing
**Alias yang digunakan:** `po`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `POID` | `int` PK | Primary key |
| `PONumber` | `varchar` | Nomor PO |
| `SupplierCode` | `varchar` | FK → `PU_SUPPLIER.SupplierCode` |
| `PODate` | `date` | Tanggal PO |
| `Status` | `varchar` | Status PO |
| `DocumentNo` | `varchar` | Nomor dokumen |

## Output Columns (AS aliases)

```
POID, PONumber, SupplierCode, PODate, Status, DocumentNo,
POAmount, TotalPO, TotalItem, TotalPOLine
```
