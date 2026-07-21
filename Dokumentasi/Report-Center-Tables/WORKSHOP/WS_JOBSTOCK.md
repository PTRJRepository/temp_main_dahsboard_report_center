# WS_JOBSTOCK — Workshop Job Material

## Posisi dalam Arsitektur

**Domain:** Workshop
**Alias yang digunakan:** `s`, `ws`
**Parent:** `WS_JOB` → FK `JobID`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Deskripsi

Material/sparepart yang digunakan dalam pekerjaan workshop. Setiap material di-issue dari gudang workshop (ItemType = '4'). Kolom `TransType` menunjukkan tipe transaksi (pemakaian, return, dll).

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `JobStockID` | `int` PK | Primary key |
| `JobID` | `int` FK | FK → `WS_JOB.JobID` |
| `ItemCode` | `varchar` | FK → `IN_ITEM.ItemCode` |
| `LocCode` | `varchar` | Lokasi gudang |
| `TransType` | `varchar` | Tipe transaksi |
| `Qty` | `decimal` | Quantity |
| `Cost` | `decimal` | Unit cost |
| `Amount` | `decimal` | Total amount |
| `VehCode` | `varchar` | Vehicle code |
| `SupplierCode` | `varchar` | Supplier code |
| `ReferenceNo` | `varchar` | Referensi |
| `UpdateDate` | `datetime` | Tanggal update |
| `PostDate` | `date` | Tanggal posting |

## Join Pattern

```sql
LEFT JOIN [db].[dbo].[WS_JOB] j ON s.JobID = j.JobID
LEFT JOIN [db].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
```

## Output Columns (AS aliases)

```
JobStockID, JobID, ItemCode, LocCode, TransType, Qty, Cost, Amount,
VehCode, SupplierCode, ReferenceNo, UpdateDate, PostDate,
WorkshopItem, WorkshopLine, WorkshopQty, WorkshopAmount, WorkshopStockLine
```
