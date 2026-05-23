# Inventory Relationship Map

Sumber: `SERVER_PROFILE_2 / db_ptrj`

Tidak ada foreign key eksplisit yang terbaca untuk domain `IN_*`. Peta berikut adalah relasi logis untuk kebutuhan report, berdasarkan primary key dan kolom dokumen.

## Master Data

```text
IN_ITEMCODE.ItemCode
  -> IN_ITEM.ItemCode
  -> IN_STOCKISSUELN.ItemCode
  -> IN_STOCKRECEIVELN.ItemCode
  -> IN_STOCKADJLN.ItemCode
  -> IN_STOCKTRANSFERLN.ItemCode
  -> IN_STOCKRTNLN.ItemCode
  -> IN_FUELISSUELN.ItemCode
  -> IN_FUELRTNLN.ItemCode
  -> IN_PRLN.ItemCode
  -> IN_MTHENDITEM.ItemCode
  -> IN_MTHENDTRX.ItemCode
```

`IN_ITEM` adalah item per lokasi, jadi join paling aman ke transaksi memakai `ItemCode` dan `LocCode` dari header transaksi.

Master referensi:

- `IN_PRODCAT.ProdCatCode` -> `IN_ITEM.ProdCatCode`
- `IN_PRODTYPE.ProdTypeCode` -> `IN_ITEM.ProdTypeCode`
- `IN_PRODBRAND.ProdBrandCode` -> `IN_ITEM.ProdBrandCode`
- `IN_PRODMODEL.ProdModelCode` -> `IN_ITEM.ProdModelCode`
- `IN_PRODMAT.ProdMatCode` -> `IN_ITEM.ProdMatCode`
- `IN_STOCKANALYSIS.StockAnalysisCode` -> `IN_ITEM.StockAnalysisCode`

## Barang Keluar

```text
IN_STOCKISSUE.StockIssueID + LocCode
  -> IN_STOCKISSUELN.StockIssueID
  -> IN_STOCKISSUELN_ACC.TrxID or DocID (perlu validasi data per report)
  -> IN_STOCKISSUE_EXDATE.StockIssueLNID
```

Kolom penting:

- Header: `PostDate`, `AccMonth`, `AccYear`, `LocCode`, `Status`, `PayrollPosted`, `IssueType`, `TotalAmount`.
- Detail: `ItemCode`, `Qty`, `Cost`, `Amount`, `AccCode`, `BlkCode`, `VehCode`, `VehExpCode`, `PsEmpCode`.

Report kandidat:

- Pengeluaran barang per periode.
- Pemakaian barang per account/block/vehicle.
- Barang keluar per item.
- Payroll posted vs belum posted.

## Barang Masuk

```text
IN_STOCKRECEIVE.StockReceiveID + LocCode
  -> IN_STOCKRECEIVELN.StockReceiveID
  -> IN_STOCKRECEIVELN_ACC.TrxID or DocID (perlu validasi data per report)
  -> IN_STOCKRECEIVE_EXDATE.StockReceiveLNID
```

Kolom penting:

- Header: `StockDocType`, `StockRefNo`, `StockRefDate`, `PostDate`, `LocCode`, `TotalAmount`, `Status`.
- Detail: `DocType`, `DocID`, `ItemCode`, `Qty`, `Cost`, `Amount`, `FromLocCode`, `ChargeLocCode`.

Report kandidat:

- Penerimaan barang per periode.
- Barang masuk per supplier/dokumen referensi jika `DocID` bisa dihubungkan ke modul purchasing/AP.
- Penerimaan per gudang dan item.

## Purchase Request

```text
IN_PR.PRID + LocCode
  -> IN_PRLN.PRID
  -> IN_PRLN_ACC.TrxID or DocID (perlu validasi data per report)
  -> IN_PR_APPROVERLIST.PRID
```

Kolom penting:

- Header: `PRID`, `PRType`, `TotalAmount`, `LocCode`, `Status`, `PRDate`, `BillToHQ`, `AGCode`.
- Detail: `ItemCode`, `QtyReq`, `QtyRcv`, `QtyOutstanding`, `Cost`, `Amount`, `BudgetInd`, `PRLnID`.

Interpretasi:

- Ini jembatan Inventory ke purchasing/procurement.
- `QtyOutstanding` bisa dipakai untuk report PR belum terpenuhi.
- `QtyRcv` bisa dipakai untuk tracking PR yang sudah diterima.

## Adjustment / Opname

```text
IN_STOCKADJ.StockAdjID + LocCode
  -> IN_STOCKADJLN.StockAdjID
  -> IN_STOCKADJLN_ACC.TrxID or DocID (perlu validasi data per report)
```

Kolom penting:

- Header: `AdjType`, `TransType`, `PostDate`, `StockAdjDate`, `TotalAmount`, `Status`.
- Detail: `ItemCode`, `Quantity`, `N_Quantity`, `D_Quantity`, `TotalCost`, `N_TotalCost`, `D_TotalCost`.

Report kandidat:

- Stock opname / adjustment.
- Selisih stok per item.
- Adjustment value per account/block.

## Transfer Antar Lokasi

```text
IN_STOCKTRANSFER.StockTransferID + LocCode
  -> IN_STOCKTRANSFERLN.StockTransferID
  -> IN_STOCKTRANSFERLN_ACC.TrxID or DocID (perlu validasi data per report)
```

Kolom penting:

- Header: `LocCode` asal, `ToLocCode` tujuan, `PostDate`, `StockTransferDate`, `TotalAmount`.
- Detail: `ItemCode`, `Qty`, `Cost`, `Amount`.

Report kandidat:

- Transfer antar gudang.
- Mutasi antar lokasi.
- Item paling sering ditransfer.

## Return Barang dan Fuel

Stock return:

```text
IN_STOCKRTN.StockRtnID + LocCode
  -> IN_STOCKRTNLN.StockRtnID
  -> IN_STOCKRTNLN.StockIssueID / StockIssueLNID
```

Fuel issue/return:

```text
IN_FUELISSUE.FuelIssueID + LocCode
  -> IN_FUELISSUELN.FuelIssueID

IN_FUELRTN.FuelRtnID
  -> IN_FUELRTNLN.FuelRtnID
  -> IN_FUELRTNLN.FuelIssueID / FuelIssueLNID
```

Fuel penting karena masih memakai struktur inventory tetapi konteks report berbeda: BBM, kendaraan, employee, dan cost center.

## Monthly Snapshot dan Histori

```text
IN_MTHENDITEM(ItemCode, LocCode, AccMonth, AccYear)
IN_MTHENDTRX(DocId, DocLnId, DocType, DocDate, LocCode, ItemCode)
```

Gunakan:

- `IN_MTHENDITEM` untuk saldo/nilai inventory bulanan.
- `IN_MTHENDTRX` untuk histori transaksi lintas jenis dokumen.

Rule chart:

- Jangan hitung `DocDate` atau `PostDate` tahun 1900 sebagai periode bisnis.
- Untuk trend periodik, filter `DocDate >= '2000-01-01'` atau `PostDate >= '2000-01-01'`.

