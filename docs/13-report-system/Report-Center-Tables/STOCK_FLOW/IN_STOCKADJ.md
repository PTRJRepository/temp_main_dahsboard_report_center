# IN_STOCKADJ — Adjustment Header

## Posisi dalam Arsitektur

**Domain:** Stock Flow / Adjustment
**Alias yang digunakan:** `h`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `StockAdjID` | `int` PK | Primary key |
| `LocCode` | `varchar` | Lokasi gudang |
| `StockAdjDate` | `date` | Tanggal penyesuaian |
| `ReferenceNo` | `varchar` | Nomor referensi |
| `Remark` | `varchar` | Alasan penyesuaian |
| `AdjType` | `varchar` | Tipe adjustment (+/-) |
| `Status` | `varchar` | Status |

## Join Pattern

```sql
INNER JOIN [db].[dbo].[IN_STOCKADJ] h ON l.StockAdjID = h.StockAdjID
JOIN      [db].[dbo].[IN_STOCKADJLN] l ON l.StockAdjID = h.StockAdjID
LEFT JOIN [db].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
```

## Output Columns (AS aliases)

```
StockAdjID, LocCode, StockAdjDate, ReferenceNo, Remark, AdjType, Status,
TanggalPosting, Dokumen, AdjustmentQty, AdjustmentAmount
```
