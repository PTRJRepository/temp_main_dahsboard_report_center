# GL_VEHICLE — GL Vehicle

## Posisi dalam Arsitektur

**Domain:** Vehicle / GL
**Alias yang digunakan:** `v`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `VehCode` | `varchar` PK | Kode kendaraan — primary key |

## GL Vehicle Usage (Header + Line)

**`GL_VEHUSAGE`** — Header penggunaan kendaraan di GL
**`GL_VEHUSAGELN`** (alias: `l`) — Line detail penggunaan

Digunakan di: vehicle running workshop report untuk menggabungkan workshop cost + operational cost dari GL.

## Output Columns (AS aliases)

```
VehCode, VehUsageID, VehExpenseCode, UsageUnit, TotalAmount,
LastUsageDate, UsageLine, UsageAmount, UsageUnit
```
