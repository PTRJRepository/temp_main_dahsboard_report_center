# IN_FUELISSUE — Fuel Issue

## Posisi dalam Arsitektur

**Domain:** Stock Flow / Fuel
**Alias yang digunakan:** `h`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Deskripsi

Transaksi pengeluaran BBM Solar. Setiap issue BBM terkait dengan kendaraan tertentu (`VehCode`). Fuel item biasanya `ItemType = '1'` (gudang) dengan jenis item Solar/diesel.

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `FuelIssueID` | `int` PK | Primary key |
| `LocCode` | `varchar` | Lokasi gudang |
| `TransDate` | `date` | Tanggal pengeluaran |
| `ReferenceNo` | `varchar` | Nomor referensi |
| `VehCode` | `varchar` | FK → `BD_VEHICLERUNNING.VehCode` |
| `DriverName` | `varchar` | Nama driver |
| `Status` | `varchar` | Status |

## Join Pattern

```sql
INNER JOIN [db].[dbo].[IN_FUELISSUE] h ON l.FuelIssueID = h.FuelIssueID
JOIN      [db].[dbo].[IN_FUELISSUELN] l ON l.FuelIssueID = h.FuelIssueID
```

## Output Columns (AS aliases)

```
FuelIssueID, LocCode, TransDate, ReferenceNo, VehCode, DriverName,
Status, KodeFuel, NamaFuel, QtyFuel, NilaiFuel, Kendaraan
```
