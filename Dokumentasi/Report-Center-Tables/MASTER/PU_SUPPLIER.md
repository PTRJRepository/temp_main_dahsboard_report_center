# PU_SUPPLIER — Supplier Master

## Posisi dalam Arsitektur

**Domain:** Master
**Alias yang digunakan:** `s`
**Database:** `db_ptrj`, `db_ptrj_mill`

## Kolom

| Kolom | Type | Description |
|---|---|---|
| `SupplierCode` | `varchar` PK | Kode supplier — primary key |
| `Name` | `varchar` | Nama supplier |
| `ContactPerson` | `varchar` | Nama kontak |
| `TelNo` | `varchar` | Nomor telepon |
| `Email` | `varchar` | Email address |
| `Town` | `varchar` | Kota/lokasi |
| `BlkCode` | `varchar` | Kode blok/estate |
| `Status` | `varchar` | Active / Inactive |
| `AccCode` | `varchar` | Kode akun GL |
| `UpdateDate` | `datetime` | Tanggal update terakhir |

## Relasi / Join Pattern

```sql
-- Supplier dari PO line
LEFT JOIN [db].[dbo].[PU_SUPPLIER] s ON h.SupplierCode = s.SupplierCode

-- Supplier dari IN_ITEM (default supplier)
LEFT JOIN [db].[dbo].[PU_SUPPLIER] s ON i.SupplierCode = s.SupplierCode
```

## Cara Dipakai di Report

```sql
SELECT
  RTRIM(s.SupplierCode) AS SupplierCode,
  RTRIM(s.Name)         AS SupplierName,
  RTRIM(s.ContactPerson) AS ContactPerson,
  RTRIM(s.TelNo)        AS Telp,
  RTRIM(s.Town)         AS Kota,
  s.Status
FROM [db].[dbo].[PU_SUPPLIER] s
```
