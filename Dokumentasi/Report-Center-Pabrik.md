# Report Center — Pabrik (Mill) Deep Dive

> Dokumentasi semua report center yang menarget **`db_ptrj_mill`** (pabrik/mill), dengan fokus tabel `WS_JOBSTOCK`, `IN_MTHENDITEM`, `IN_MTHENDTRX`, `IN_STOCKADJ`.
> Sumber SQL: `Dashboard_Utama/app/api/reports/inventory/route.ts` + `lib/reports/inventory/config.ts`.

## 0. ⚠️ Catatan Penting — Penamaan Tabel
Nama yang disebut (`WS_JOBSTOCK` cocok; `MTHTRX`, `SH`, `MONTHEND` **tidak ada verbatim** di codebase). Pemetaan sebenarnya:

| Nama di request | Tabel sebenarnya | Peran |
|-----------------|------------------|-------|
| `WS_JOBSTOCK` | `WS_JOBSTOCK` | Workshop job stock (issue/return) |
| `MONTHEND` | `IN_MTHENDITEM` (snapshot stok per item) + `IN_MTHENDTRX` (snapshot transaksi bulanan) | Month-end |
| `MTHTRX` | `IN_MTHENDTRX` (+ `IN_STOCKANALYSIS` sbg rekonstruksi header) | Month-end transaction |
| `SH` | `IN_STOCKADJ` (header di-alias `h`) + `IN_STOCKISSUE` + `PU_GOODSRCV` | Stock/header tables |

Semua report **source-agnostic**: dipilih DB lewat `?source=pabrik`, bukan hard-coded per report.

## 1. Source → `db_ptrj_mill` Mapping
- `databaseForServer` (`route.ts:37`): `SERVER_PROFILE_3 → 'db_ptrj_mill'`, `SERVER_PROFILE_2 → 'db_ptrj'`.
- `sourceToContext` (`route.ts:44`): `pabrik → SERVER_PROFILE_3 → db_ptrj_mill`, label `'Pabrik'`.
- `getSource` (`route.ts:56`): `?source=pabrik|mill|factory → 'pabrik'`, default `estate`.
- **Caveat doc**: `docs/SQL-QUERIES-INVENTORY-COMPLETE.md` label `SERVER_PROFILE_1` sudah stale — live code pakai `SERVER_PROFILE_3`.

## 2. Aturan Inti — ItemType & Workshop Movement
Workshop = **ItemType `'4'`**, gerak issue/return lewat **`WS_JOBSTOCK`**:
- `TransType = '1'` → **issue** (stock-out / pemakaian)
- `TransType = '2'` → **return** (stock-in)
- ItemType `'1'` (Stock) → `IN_STOCKISSUE` / `IN_STOCKISSUELN`.

Helpers (`route.ts`):
- `workshopStockIssueDateExpression` (`:282`): `COALESCE(NULLIF(s.PostDate,'1900-01-01'), s.TransDate)`
- `workshopStockIssueItemTypeExpression` (`:298`): `COALESCE(Item.ItemType, WS_JOBSTOCK.ItemType)`
- `workshopStockIssueAmountExpression` (`:294`): `COALESCE(Amount, PriceAmount, Qty*Price, 0)`

**`stockIssueUsageApply`** (`:310`) — canonical split (di-reuse banyak handler):
```sql
-- ItemType != 4
SELECT ... FROM IN_STOCKISSUELN l JOIN IN_STOCKISSUE h ON l.StockIssueID=h.StockIssueID
WHERE ISNULL(ItemType,'')<>'4' AND ... PostDate>= '2000-01-01' AND PostDate < GETDATE()
UNION ALL
-- ItemType = 4
SELECT ... FROM WS_JOBSTOCK s
WHERE ItemType='4' AND RTRIM(ISNULL(s.TransType,''))='1'
  AND s.ItemCode=i.ItemCode AND s.LocCode=i.LocCode
  AND <workshopDate> >= '2000-01-01' AND <workshopDate> < GETDATE()
```

> `TransType` punya **dua arti**: `WS_JOBSTOCK.TransType` (1=issue,2=return) vs `IN_STOCKADJ.TransType` (jenis penyesuaian). Jangan campur.

## 3. `WS_JOBSTOCK` per Handler
| Report (id / code) | Title | Handler | WS_JOBSTOCK usage |
|--------------------|-------|---------|-------------------|
| `stok-gudang` / INV-01 | Posisi Stok & Nilai Gudang | `stockSummary:1012` | via `stockIssueUsageApply` (`:1030`) |
| `asset-stock-valuasi-listing` / RPTIN1000011 | Asset Stock Valuasi | `assetStockValuationListing:1089` | via helper; `MovementSource: ItemType4=WS_JOBSTOCK` |
| `all-stock-movement-analysis` / INV-ALL | ALL Stock Movement | `allStockMovementAnalysis:1272` | blok `:1343` `TransType='1' AND ItemType='4'`; tags `WS_JOBSTOCK` |
| `kartu-stok` | Stock Card | `stockCard:1664` | via helper (`:1746`) |
| `mutasi-barang` / INV-03 | Movement Stock | `stockMovement:1757` | **×3**: detail `:1798`, summary `:1891`, chart `:1932` (TransType='1', ItemType 4) |
| `monthly-stock-account-movement-details` / RPTIN1000015 | Monthly Stock Account | CTE `:536` | `:643` split issue/return by `TransType` + `VehCode`/`BlkCode` (WS_JOB) |
| `pengeluaran-barang` / INV-04 | Pengeluaran Barang | `stockIssue:2251` | `:2294` `'WS_JOBSTOCK' AS SourceTable`, `TransType='1'`; `BarisWorkshop` counter `:2323` |
| `item-stale-update` / INV-12 | Item Tidak Update | `itemUpdateAge:2840` | `:2972` TransType='1', ItemType 4 |
| `reorder-level` | Reorder Level | `reorderLevel:2431` | `:2477` sama |
| `pupuk-stock-procurement` / INV-15 | Pupuk Stock | `fertilizerInventoryProcurement:3169` | `:3242` TransType='1', ItemType 4 (ProdCat CA2111) |
| `vehicle-running-workshop` / INV-16 | Vehicle/Workshop | `vehicleRunningWorkshop:3252` | `:3270` group by `VehCode` (fallback WS_JOB.VehCode); `COUNT(*)` `:3308`, `MAX(PostDate)` `:3311`, `SUM(Amount)` chart `:3318` |

## 4. `IN_MTHENDITEM` (month-end stok snapshot — "MONTHEND")
- `assetStockValuationListing` (`:1118`, `:1263`): histori `AmountItem = IN_MTHENDITEM.Qty * AverageCost`; current → `IN_ITEM`.
- `allStockMovementAnalysis` (`:1418`): histori `AmountItem = IN_MTHENDITEM.Qty * AverageCost`; current `TotalAssetAmount = SUM((QtyOnHand+QtyOnHold)*AverageCost)` dari `IN_ITEM` ItemType IN (1,4).
- `monthlyStockAccountMovementDetails` opening (`:615`): `FROM IN_MTHENDITEM WHERE LocCode='${location}' AND AccYear='${openingAccYear}' AND AccMonth='${openingAccMonth}'`.
- **Rule**: `IN_MTHENDITEM` = snapshot historis/periode; `IN_ITEM` = saldo live saat ini.

## 5. `IN_MTHENDTRX` (month-end transaction — "MTHTRX")
`transactionHistory` (INV-10, `:2484`):
```sql
SELECT RTRIM(DocId) Dokumen, RTRIM(DocType) TipeDokumen, RTRIM(Description) Deskripsi,
  CAST(ISNULL(Unit,0) AS DECIMAL(18,2)) Qty, CAST(ISNULL(Cost,0) AS DECIMAL(18,2)) Cost,
  CAST(ISNULL(Amount,0) AS DECIMAL(18,2)) Amount, RTRIM(AccCode), RTRIM(BlkCode), RTRIM(VehCode),
  RTRIM(AccYear), RIGHT('0'+RTRIM(AccMonth),2) AccMonth,
  RTRIM(AccYear)+'-'+RIGHT('0'+RTRIM(AccMonth),2) PeriodeAkuntansi, ...
FROM [${DATABASE}].[dbo].[IN_MTHENDTRX]
WHERE DocDate >= '2019-01-01' ... ORDER BY DocDate DESC, DocId DESC
```
- Kolom: `DocId, DocType, Description, Unit, Cost, Amount, AccCode, BlkCode, VehCode, AccYear, AccMonth, PeriodeAkuntansi`.
- Akuntansi: `AccMonth 1 = April`; AccYear fiscal (AccYear 2027 AccMonth 1 = 2026-04).

## 6. `IN_STOCKADJ` / `IN_STOCKADJLN` (stock opname/adjustment — header `h`)
`stockOpname` (INV-08, `:2360`):
```sql
SELECT TOP ${limit}
  RTRIM(h.StockAdjID) Dokumen, h.PostDate TanggalPosting, h.StockAdjDate TanggalOpname,
  RTRIM(h.AdjType) AdjType, RTRIM(h.TransType) TransType,
  RTRIM(l.ItemCode) KodeBarang, RTRIM(ISNULL(i.Description,l.ItemCode)) NamaBarang,
  CAST(ISNULL(l.Quantity,0) AS DECIMAL(18,2)) QtySebelum,
  CAST(ISNULL(l.N_Quantity,0) AS DECIMAL(18,2)) QtySesudah,
  CAST(ISNULL(l.D_Quantity,0) AS DECIMAL(18,2)) SelisihQty,
  CAST(ISNULL(l.D_TotalCost,0) AS DECIMAL(18,2)) SelisihNilai,
  RTRIM(l.AccCode), RTRIM(h.Remark), RTRIM(h.Status)
FROM IN_STOCKADJLN l
INNER JOIN IN_STOCKADJ h ON l.StockAdjID=h.StockAdjID
LEFT JOIN IN_ITEM i ON l.ItemCode=i.ItemCode AND i.LocCode=h.LocCode
WHERE h.PostDate >= '2000-01-01' ...
```
- `D_Quantity`/`D_TotalCost` = delta selisih. `TransType` di sini = jenis penyesuaian (beda arti dari WS_JOBSTOCK).

## 7. Report Pabrik Lengkap (status)
Semua dieksekusi di `db_ptrj_mill` saat `?source=pabrik`.

| id / code | Title | status | Tabel utama |
|-----------|-------|--------|-------------|
| `stok-gudang` / INV-01 | Posisi Stok & Nilai Gudang | live | IN_ITEM, IN_STOCKISSUE/LN, WS_JOBSTOCK |
| `asset-stock-valuasi-listing` / RPTIN1000011 | Asset Stock Valuasi | live | IN_ITEM, IN_MTHENDITEM, IN_PRODTYPE |
| `all-stock-movement-analysis` / INV-ALL | ALL Stock Movement | live | IN_ITEM, IN_MTHENDITEM, IN_STOCKISSUE/LN, WS_JOBSTOCK |
| `item-movement-update-tracking` / INV-STOCK-AGING | Stock Aging & Movement Health | live | IN_ITEM, IN_STOCKISSUE/LN, WS_JOBSTOCK |
| `mutasi-barang` / INV-03 | Movement Stock | live | IN_STOCKISSUE/LN, WS_JOBSTOCK, IN_STOCKRECEIVE/LN, PU_GOODSRCV/LN, IN_STOCKTRANSFER/LN |
| `monthly-stock-account-movement-details` / RPTIN1000015 | Monthly Stock Account | live | IN_ITEM, IN_MTHENDITEM, IN_STOCKANALYSIS, WS_JOBSTOCK, WS_JOB, PU_GOODSRCV/LN |
| `pengeluaran-barang` / INV-04 | Pengeluaran Barang | live | IN_STOCKISSUE/LN, WS_JOB, WS_JOBSTOCK, IN_STOCKISSUELN_ACC |
| `penerimaan-barang` / INV-05 | Goods Receiving | live | PU_GOODSRCV/LN, PU_POLN, PU_SUPPLIER, IN_ITEM |
| `purchase-request-inventory` / INV-06 | Purchase Request | live | IN_PR, IN_PRLN, IN_PRLN_ACC |
| `transfer-antar-gudang` / INV-07 | Transfer Antar Gudang | live | IN_STOCKTRANSFER/LN, IN_STOCKTRANSFERLN_ACC |
| `stock-opname` / INV-08 | Stock Opname & Adjustment | live | IN_STOCKADJ, IN_STOCKADJLN, IN_STOCKADJLN_ACC |
| `fuel-usage` / INV-09 | Fuel Usage | live | IN_FUELISSUE/LN, IN_FUELISSUELN_ACC |
| `riwayat-transaksi` / INV-10 | Riwayat Transaksi | live | IN_MTHENDTRX |
| `return-barang` / INV-11 | Return Barang | live | IN_STOCKRTN, IN_STOCKRTNLN (return WS_JOBSTOCK TransType 2 di CTE) |
| `item-stale-update` / INV-12 | Item Tidak Update & Aging | live | IN_ITEM, IN_STOCKISSUE/LN, WS_JOBSTOCK |
| `purchase-order-history` / INV-13 | PO History | live | PU_PO, PU_POLN, PU_SUPPLIER, IN_ITEM |
| `supplier-purchasing-performance` / INV-14 | Supplier Performance | live | PU_SUPPLIER, PU_PO/LN, PU_GOODSRCV/LN, AP_INVOICERCV |
| `pupuk-stock-procurement` / INV-15 | Pupuk Stock & Procurement | live | IN_ITEM, PU_PO/LN, IN_STOCKISSUE/LN, WS_JOBSTOCK |
| `vehicle-running-workshop` / INV-16 | Vehicle Running & Workshop | live | GL_VEHICLE, BD_VEHICLERUNNING, GL_VEHUSAGE/LN, WS_JOB, WS_JOBSTOCK |
| `expiry-inventory` / INV-H01 | Expiry Date | **hold** | IN_ITEMEXPDATE, IN_STOCKISSUE_EXDATE, IN_STOCKRECEIVE_EXDATE |

`live` = 19 (ink. yang di atas), `hold` = 1 (`expiry-inventory`). Tidak ada report `update`.

## 8. Endpoint & Auth
- `GET /api/reports/inventory?report=<kebab>&source=pabrik&limit=...`
- Auth: NextAuth (`payroll_auth_token` cookie). SQL divalidasi `validateReadOnlySql`.
- Gateway: `lib/api/sql-gateway.ts` → `http://10.0.0.110:3001/query` (`SQL_GATEWAY_URL`), DB `db_ptrj_mill`, server `SERVER_PROFILE_3`.

## 9. Caveats
1. **Nama tabel**: `MTHTRX`/`SH`/`MONTHEND` tidak literal — pakai `IN_MTHENDTRX`/`IN_STOCKADJ`/`IN_MTHENDITEM`.
2. **`source` runtime**: default = estate (`db_ptrj`). Harus `?source=pabrik` untuk mill.
3. **`TransType` dua arti**: WS_JOBSTOCK (1=issue,2=return) vs IN_STOCKADJ (jenis adj).
4. **ItemType 4 ≡ Workshop ≡ WS_JOBSTOCK** invariant di-enforce tiap handler; `MovementSource` (route.ts:1470) jadi audit check.
