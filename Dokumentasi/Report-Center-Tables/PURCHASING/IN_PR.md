# IN_PR — Purchase Request Header

## Posisi dalam Arsitektur

**Domain:** Purchasing / Purchase Request
**Alias yang digunakan:** `h`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `PRID` | `int` PK | Primary key |
| `PRDate` | `date` | Tanggal PR |
| `PRType` | `varchar` | Tipe PR |
| `ReferenceNo` | `varchar` | Nomor referensi |
| `LocCode` | `varchar` | Lokasi yang request |
| `Status` | `varchar` | Status PR |

## Output Columns (AS aliases)

```
PRID, PRDate, PRType, ReferenceNo, LocCode, Status,
TanggalPR, TipePR, QtyRequest, NilaiPR, TotalPR
```
