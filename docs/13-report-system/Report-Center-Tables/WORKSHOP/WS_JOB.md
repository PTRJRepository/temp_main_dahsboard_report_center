# WS_JOB — Workshop Job Header

## Posisi dalam Arsitektur

**Domain:** Workshop
**Alias yang digunakan:** `j`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Deskripsi

Header transaksi pekerjaan bengkel/workshop kendaraan. Setiap `JobID` = satu pekerjaan servicing. Kolom `BlkCode` dan `VehCode` menunjukkan kendaraan yang diservis. Workshop menggunakan `ItemType = '4'`.

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `JobID` | `int` PK | Primary key |
| `VehCode` | `varchar` | FK → `BD_VEHICLERUNNING.VehCode` |
| `BlkCode` | `varchar` | Kode blok/estate |
| `TransDate` | `date` | Tanggal transaksi |
| `PostDate` | `date` | Tanggal posting |
| `Status` | `varchar` | Status job |

## Join Pattern

```sql
-- Dari IN_STOCKISSUE (issue ke workshop)
LEFT JOIN [db].[dbo].[WS_JOB] j ON h.BlkCode = j.BlkCode

-- Dari WS_JOBSTOCK
LEFT JOIN [db].[dbo].[WS_JOB] j ON s.JobID = j.JobID
LEFT JOIN [db].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
```

## Output Columns (AS aliases)

```
JobID, VehCode, BlkCode, TransDate, PostDate, Status,
WorkshopItem, WorkshopLine, WorkshopQty, WorkshopAmount,
LastWorkshopDate, TotalJob, NamaKendaraan
```
