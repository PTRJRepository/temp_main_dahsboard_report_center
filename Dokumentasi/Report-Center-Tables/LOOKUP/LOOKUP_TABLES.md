# LOOKUP Tables

## IN_PRODTYPE — Product Type

| Kolom | Type | Description |
|---|---|---|
| `ProdTypeCode` | `varchar` PK | Primary key |
| `Description` | `varchar` | Deskripsi tipe produk |

**Alias:** `pt`
**Join:** `LEFT JOIN [db].[dbo].[IN_PRODTYPE] pt ON i.ProdTypeCode = pt.ProdTypeCode`

---

## IN_PRODCAT — Product Category

| Kolom | Type | Description |
|---|---|---|
| `ProdCatCode` | `varchar` PK | Primary key |
| `ProdTypeCode` | `varchar` | FK → `IN_PRODTYPE.ProdTypeCode` |
| `Description` | `varchar` | Deskripsi kategori |

**Join:** `LEFT JOIN [db].[dbo].[IN_PRODCAT] pc ON i.ProdCatCode = pc.ProdCatCode`

---

## IN_STOCKANALYSIS — Stock Analysis

| Kolom | Type | Description |
|---|---|---|
| `StockAnalysisCode` | `varchar` PK | Primary key |
| `Description` | `varchar` | Deskripsi analisis stok |

**Alias:** `sa`
**Join:** `LEFT JOIN [db].[dbo].[IN_STOCKANALYSIS] sa ON i.StockAnalysisCode = sa.StockAnalysisCode`

## Output Columns

```
ProdTypeCode, ProdTypeDescription, ProductTypeCode, ProductTypeDescription,
ProdCatCode (indirect), ProductCategoryCode, ProductCategoryDescription,
StockAnalysisCode, StockAnalysisName
```
