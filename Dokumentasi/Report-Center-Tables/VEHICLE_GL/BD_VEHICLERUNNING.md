# BD_VEHICLERUNNING — Vehicle Running Summary

## Posisi dalam Arsitektur

**Domain:** Vehicle / GL
**Alias yang digunakan:** `v`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Deskripsi

Master kendaraan dengan summary data running. `VehCode` adalah primary key dan FK dari `WS_JOB.VehCode`, `IN_STOCKISSUE.VehCode`, `IN_FUELISSUE.VehCode`.

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `VehCode` | `varchar` PK | Kode kendaraan — primary key |

Kolom lain (yang dipakai di output): `Status`, `VehTypeCode`, `Description`

## Relasi

```
WS_JOB.VehCode      → BD_VEHICLERUNNING.VehCode
IN_STOCKISSUE.VehCode → BD_VEHICLERUNNING.VehCode
IN_FUELISSUE.VehCode  → BD_VEHICLERUNNING.VehCode
WS_JOBSTOCK.VehCode → BD_VEHICLERUNNING.VehCode
GL_VEHUSAGE.VehCode → BD_VEHICLERUNNING.VehCode
```

## Output Columns (AS aliases)

```
VehCode, Status, Description, VehTypeCode, NamaKendaraan, TipeKendaraan,
StatusKendaraan, NextServiceMaintenanceDate, NextRenewRoadTaxDate,
WorkshopItem, WorkshopLine, LastWorkshopDate, TotalJob,
UsageAmount, UsageLine, UsageUnit, LastUsageDate, TotalKendaraan
```
