# IN_ITEM — Master Item Table

## Posisi dalam Arsitektur

**Domain:** Master Data
**Alias yang digunakan:** `i`, `issueItem`, `item`, `b`
**Database:** `db_ptrj` (estate), `db_ptrj_mill` (pabrik)

## Deskripsi

Tabel utama (master) yang menyimpan semua data item/barang inventaris. Setiap row = satu SKU. Kolom `QtyOnHand`, `QtyOnHold`, `QtyOnOrder` menyimpan stok real-time. Kolom `AverageCost` menyimpan weighted average cost yang dihitung dari setiap transaksi receipt.

## Kolom

### Identitas
| Kolom | Type | Description |
|---|---|---|
| `ItemCode` | `varchar` PK | Kode item — primary key |
| `Description` | `varchar` | Nama/deskripsi item |
| `ItemType` | `varchar` | Tipe: `'1'` = Gudang, `'4'` = Workshop |
| `Status` | `varchar` | Status: Active / Inactive |

### Lokasi & Organisasi
| Kolom | Type | Description |
|---|---|---|
| `LocCode` | `varchar` | Lokasi/gudang default |
| `ProdTypeCode` | `varchar` | FK → `IN_PRODTYPE.ProdTypeCode` — tipe produk |
| `ProdCatCode` | `varchar` | FK → `IN_PRODCAT.ProdCatCode` — kategori produk |
| `ProdBrandCode` | `varchar` | Kode brand/merek |
| `ProdModelCode` | `varchar` | Kode model |
| `ProdMatCode` | `varchar` | Kode material |
| `StockAnalysisCode` | `varchar` | FK → `IN_STOCKANALYSIS.StockAnalysisCode` |
| `SupplierCode` | `varchar` | Supplier default, FK → `PU_SUPPLIER.SupplierCode` |

### Satuan & Akun
| Kolom | Type | Description |
|---|---|---|
| `UOMCode` | `varchar` | Unit of Measure (Satuan) |
| `AccountCode` | `varchar` | Kode akun GL |

### Kuantitas
| Kolom | Type | Description |
|---|---|---|
| `QtyOnHand` | `decimal` | Stok tersedia saat ini |
| `QtyOnHold` | `decimal` | Stok yang di-hold |
| `QtyOnOrder` | `decimal` | Stok yang sedang dipesan (on-order) |
| `ReOrderLevel` | `decimal` | Minimum reorder point |

### Cost & Harga
| Kolom | Type | Description |
|---|---|---|
| `AverageCost` | `decimal(18,6)` | Weighted average cost |
| `DiffAverageCost` | `decimal` | Differential/correction cost |
| `UnitCost` | `decimal` | Unit cost |
| `UnitPrice` | `decimal` | Unit price (harga jual) |
| `StockValue` | `decimal` | Nilai stok (QtyOnHand × UnitCost) |
| `StockValueReal` | `decimal` | Nilai stok riil |

### Timestamps
| Kolom | Type | Description |
|---|---|---|
| `UpdateDate` | `datetime` | Tanggal update terakhir |
| `CreateDate` | `datetime` | Tanggal dibuat |

## Relasi / Join Pattern

```sql
-- Tipe produk
LEFT JOIN [db].[dbo].[IN_PRODTYPE] pt ON i.ProdTypeCode = pt.ProdTypeCode

-- Kategori produk
LEFT JOIN [db].[dbo].[IN_PRODCAT] pc ON i.ProdCatCode = pc.ProdCatCode

-- Stock analysis
LEFT JOIN [db].[dbo].[IN_STOCKANALYSIS] sa ON i.StockAnalysisCode = sa.StockAnalysisCode

-- Supplier
LEFT JOIN [db].[dbo].[PU_SUPPLIER] s ON i.SupplierCode = s.SupplierCode

-- Item dari konteks issue (join ke LocCode header)
LEFT JOIN [db].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
```

## Cara Dipakai di Report

### Contoh — Ambil Kolom Item
```sql
SELECT
  RTRIM(i.ItemCode)    AS ItemCode,
  RTRIM(i.Description) AS Description,
  RTRIM(i.UOMCode)     AS UOM,
  RTRIM(i.LocCode)     AS Location,
  CAST(ISNULL(i.QtyOnHand, 0) AS decimal(18,6)) AS QtyOnHand,
  CAST(ISNULL(i.AverageCost, 0) AS decimal(18,6)) AS AverageCost,
  CAST((ISNULL(i.QtyOnHand, 0) + ISNULL(i.QtyOnHold, 0))
       * ISNULL(i.AverageCost, 0) AS decimal(18,6)) AS OnHandHoldAmount
FROM [db].[dbo].[IN_ITEM] i
```

### ItemType Classification
```sql
RTRIM(i.ItemType) = '1'   -- Gudang (Warehouse item)
RTRIM(i.ItemType) = '4'   -- Workshop item
RTRIM(i.ItemType) != '4'  -- Non-workshop (gudang)
```

### Filter Stok
```sql
-- Item yang punya stok
QtyOnHand > 0
-- Item tanpa stok
QtyOnHand = 0 OR QtyOnHand IS NULL
-- Item di bawah reorder level
QtyOnHand < ReOrderLevel AND ReOrderLevel > 0
```

## Columns yang Dihasilkan Report

Dari `SELECT ... AS` pattern di route.ts:

```
ItemCode, Description, Location, UOM, StockAnalysisCode, StockAnalysisName,
ProductTypeCode, ProductCategoryCode, ProductBrandCode, ProductModelCode,
ProductMaterialCode, QtyOnHand, QtyOnHold, AverageCost, OnHandHoldAmount,
ItemType, Status, ReOrderLevel, LocCode, UpdateDate, LatestCost,
LastIssueDate, LastOrderDate, ProdTypeCode, ProdCatCode, ProdBrandCode,
ProdModelCode, ProdMatCode, ProdTypeDescription
```
