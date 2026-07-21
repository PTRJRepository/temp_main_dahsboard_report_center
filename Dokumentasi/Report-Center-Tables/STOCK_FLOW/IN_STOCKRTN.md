# IN_STOCKRTN — Return Header

## Posisi dalam Arsitektur

**Domain:** Stock Flow / Return
**Alias yang digunakan:** `h`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `StockRtnID` | `int` PK | Primary key |
| `LocCode` | `varchar` | Lokasi gudang |
| `TransDate` | `date` | Tanggal return |
| `ReferenceNo` | `varchar` | Nomor referensi return |
| `Status` | `varchar` | Status |

## Output Columns (AS aliases)

```
StockRtnID, LocCode, TransDate, ReferenceNo, Status,
Tanggal, DokumenReturn, QtyReturn, NilaiReturn
```
