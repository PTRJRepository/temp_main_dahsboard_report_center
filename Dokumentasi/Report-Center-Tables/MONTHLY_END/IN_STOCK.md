# IN_STOCK — Monthly Stock Snapshot

## Posisi dalam Arsitektur

**Domain:** Monthly End
**Alias yang digunakan:** `m`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Deskripsi

Menyimpan snapshot stok per item per lokasi per bulan akuntansi. Setiap bulan berjalan, nilai `Qty` dan `AverageCost` di-freeze untuk keperluan laporan periodik. Kolom `AccYear` + `AccMonth` mengikuti fiscal year April→March.

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `ItemCode` | `varchar` FK | FK → `IN_ITEM.ItemCode` |
| `LocCode` | `varchar` | Lokasi/gudang |
| `Qty` | `decimal` | Quantity closing bulan tersebut |
| `AverageCost` | `decimal(18,6)` | Average cost saat month-end |
| `AccYear` | `int` | Accounting year |
| `AccMonth` | `int` | Accounting month (1=Apr ... 12=Mar) |
| `Amount` | `decimal` | Qty × AverageCost |

## Relasi / Join Pattern

```sql
-- Snapshot untuk item tertentu
LEFT JOIN [db].[dbo].[IN_STOCK] m
  ON i.ItemCode = m.ItemCode AND i.LocCode = m.LocCode
  AND m.AccYear = @accYear AND m.AccMonth = @accMonth
```

## Cara Dipakai di Report

```sql
SELECT
  m.AccYear,
  m.AccMonth,
  RTRIM(m.ItemCode) AS ItemCode,
  RTRIM(m.LocCode)  AS Location,
  CAST(m.Qty AS decimal(18,6))        AS Qty,
  CAST(m.AverageCost AS decimal(18,6)) AS AverageCost,
  CAST(m.Amount AS decimal(18,2))     AS Amount
FROM [db].[dbo].[IN_STOCK] m
WHERE m.AccYear = ${accYear} AND m.AccMonth = ${accMonth}
```

## Fiscal Year Mapping (AccMonth → Actual Month)

```
AccMonth 1  (Apr) → Actual Jun, accYear-1
AccMonth 2  (May) → Actual Jul, accYear-1
AccMonth 3  (Jun) → Actual Aug, accYear-1
AccMonth 4  (Jul) → Actual Sep, accYear-1
AccMonth 5  (Aug) → Actual Oct, accYear-1
AccMonth 6  (Sep) → Actual Nov, accYear-1
AccMonth 7  (Oct) → Actual Dec, accYear-1
AccMonth 8  (Nov) → Actual Jan, accYear
AccMonth 9  (Dec) → Actual Feb, accYear
AccMonth 10 (Jan) → Actual Mar, accYear
AccMonth 11 (Feb) → Actual Apr, accYear+1
AccMonth 12 (Mar) → Actual May, accYear+1
```
