# Report Center — Tabel Database Lengkap

> **Folder:** `Dokumentasi/Report-Center-Tables/`
> **Source:** Analyzed dari `app/api/reports/inventory/route.ts` (4,234 baris) + seluruh `app/api/reports/`
> **Database:** MSSQL — `db_ptrj` (estate) dan `db_ptrj_mill` (pabrik)

---

## Struktur Folder

```
Dokumentasi/Report-Center-Tables/
├── README.md                          ← File ini (overview + index)
├── MASTER/
│   ├── IN_ITEM.md                     ← Master item table
│   └── PU_SUPPLIER.md                 ← Supplier master
├── MONTHLY_END/
│   ├── IN_STOCK.md                    ← Monthly snapshot
│   ├── IN_MTHENDITEM.md               ← Month-end item balance
│   └── IN_MTHENDTRX.md                ← Month-end transaction log
├── STOCK_FLOW/
│   ├── IN_STOCKRECEIVE.md             ← Stock receipt header
│   ├── IN_STOCKRECEIVELN.md           ← Stock receipt line
│   ├── IN_STOCKISSUE.md               ← Stock issue header
│   ├── IN_STOCKISSUELN.md             ← Stock issue line
│   ├── IN_STOCKTRANSFER.md             ← Transfer header
│   ├── IN_STOCKTRANSFERLN.md          ← Transfer line
│   ├── IN_STOCKADJ.md                  ← Adjustment header
│   ├── IN_STOCKADJLN.md                ← Adjustment line
│   ├── IN_STOCKRTN.md                  ← Return header
│   ├── IN_STOCKRTNLN.md                ← Return line
│   └── IN_FUELISSUE.md                ← Fuel issue (header+line)
├── WORKSHOP/
│   ├── WS_JOB.md                      ← Workshop job header
│   └── WS_JOBSTOCK.md                 ← Workshop job material
├── PURCHASING/
│   ├── IN_PR.md                       ← Purchase request header
│   ├── IN_PRLN.md                     ← Purchase request line
│   ├── PU_PO.md                       ← Purchase order header
│   ├── PU_POLN.md                     ← Purchase order line
│   ├── PU_GOODSRCV.md                 ← Goods receiving header
│   └── PU_GOODSRCVLN.md               ← Goods receiving line
├── VEHICLE_GL/
│   ├── BD_VEHICLERUNNING.md           ← Vehicle running summary
│   ├── GL_VEHICLE.md                  ← GL vehicle master
│   ├── GL_VEHUSAGE.md                 ← GL vehicle usage header
│   ├── GL_VEHUSAGELN.md               ← GL vehicle usage line
│   └── AP_INVOICERCV.md               ← AP invoice receipt
└── LOOKUP/
    ├── IN_PRODTYPE.md                  ← Product type lookup
    ├── IN_PRODCAT.md                   ← Product category lookup
    └── IN_STOCKANALYSIS.md             ← Stock analysis lookup
```

---

## Ringkasan 33 Tabel

| # | Table | Domain | Purpose |
|---|---|---|---|
| 1 | `IN_ITEM` | Master | Master item/barang |
| 2 | `PU_SUPPLIER` | Master | Master supplier |
| 3 | `IN_STOCK` | Monthly End | Snapshot stok bulanan |
| 4 | `IN_MTHENDITEM` | Monthly End | Saldo akhir bulan per item |
| 5 | `IN_MTHENDTRX` | Monthly End | Transaksi akhir bulan |
| 6 | `IN_STOCKRECEIVE` | Stock Flow | Header penerimaan barang |
| 7 | `IN_STOCKRECEIVELN` | Stock Flow | Line penerimaan barang |
| 8 | `IN_STOCKISSUE` | Stock Flow | Header pengeluaran barang |
| 9 | `IN_STOCKISSUELN` | Stock Flow | Line pengeluaran barang |
| 10 | `IN_STOCKTRANSFER` | Stock Flow | Header transfer antar gudang |
| 11 | `IN_STOCKTRANSFERLN` | Stock Flow | Line transfer |
| 12 | `IN_STOCKADJ` | Stock Flow | Header penyesuaian stok |
| 13 | `IN_STOCKADJLN` | Stock Flow | Line penyesuaian |
| 14 | `IN_STOCKRTN` | Stock Flow | Header return barang |
| 15 | `IN_STOCKRTNLN` | Stock Flow | Line return |
| 16 | `IN_FUELISSUE` | Stock Flow | Header pengeluaran BBM |
| 17 | `IN_FUELISSUELN` | Stock Flow | Line pengeluaran BBM |
| 18 | `WS_JOB` | Workshop | Header pekerjaan bengkel |
| 19 | `WS_JOBSTOCK` | Workshop | Material pekerjaan bengkel |
| 20 | `IN_PR` | Purchasing | Header purchase request |
| 21 | `IN_PRLN` | Purchasing | Line purchase request |
| 22 | `PU_PO` | Purchasing | Header purchase order |
| 23 | `PU_POLN` | Purchasing | Line purchase order |
| 24 | `PU_GOODSRCV` | Purchasing | Header goods receiving |
| 25 | `PU_GOODSRCVLN` | Purchasing | Line goods receiving |
| 26 | `BD_VEHICLERUNNING` | Vehicle | Summary running kendaraan |
| 27 | `GL_VEHICLE` | Vehicle | Vehicle di GL |
| 28 | `GL_VEHUSAGE` | Vehicle | Header penggunaan kendaraan GL |
| 29 | `GL_VEHUSAGELN` | Vehicle | Line penggunaan kendaraan GL |
| 30 | `AP_INVOICERCV` | Vehicle | AP invoice receipt |
| 31 | `IN_PRODTYPE` | Lookup | Lookup tipe produk |
| 32 | `IN_PRODCAT` | Lookup | Lookup kategori produk |
| 33 | `IN_STOCKANALYSIS` | Lookup | Lookup analisis stok |

---

## Alias yang Digunakan

| Alias | Table | Context |
|---|---|---|
| `i` | `IN_ITEM` | Item master utama |
| `issueItem` | `IN_ITEM` | Item di konteks issue |
| `m` | `IN_STOCK` | Monthly snapshot |
| `h` | \*\_HEADER tables | Header transaction |
| `l` | \*LN tables | Line transaction |
| `gl` | `PU_GOODSRCVLN` | Goods receiving line |
| `p` | `PU_POLN` | PO line |
| `s` | `PU_SUPPLIER` | Supplier |
| `pt` | `IN_PRODTYPE` | Product type |
| `sa` | `IN_STOCKANALYSIS` | Stock analysis |
| `j` | `WS_JOB` | Workshop job |
| `ws` | `WS_JOBSTOCK` | Workshop job stock |
| `v` | `GL_VEHICLE` | GL vehicle |

---

## CTEs (Common Table Expressions)

```
base              — Base query untuk asset valuation
asset_valuation   — Asset valuation computation
stock_flags       — Flagging stok (stale, zero, etc.)
keluar            — Intermediate stock keluar aggregation
MovementRaw       — Raw movement data untuk movement analysis
issue_rows        — Issue rows untuk event text formatting
po                — PO summary aggregation
usage             — Vehicle usage aggregation
workshop          — Workshop job aggregation
```

---

## Computed Columns (OUTER APPLY)

Kolom-kolom ini dihitung via subquery/OUTER APPLY, bukan kolom fisik:

| Column | Source | Description |
|---|---|---|
| `StockIssueEventCount` | `issueUsage` APPLY | Jumlah event issue distinct |
| `StockIssueQtyAllPeriod` | `issueUsage` APPLY | Total qty issue semua periode |
| `StockIssueAmountAllPeriod` | `issueUsage` APPLY | Total amount issue |
| `LastStockIssueDate` | `issueUsage` APPLY | Tanggal issue terakhir |
| `MovementEventCountAll` | `movement12` APPLY | Event count 12 bulan |
| `MovementQtyAll` | `movement12` APPLY | Qty 12 bulan |
| `MovementAmountAll` | `movement12` APPLY | Amount 12 bulan |
| `MovementAgeDays` | Computed | Hari sejak last movement |
| `MovementCategory` | CASE WHEN | Fast/Moving/Slow/Dead/Stale |
| `MovementLastIssueDate` | `latestMovement` APPLY | Tanggal last issue |
| `StockIssueEvent1` | `issueEvents` APPLY | Event text terakhir |
| `StockIssueEvent2` | `issueEvents` APPLY | Event text sebelumnya |
| `LastGRDate` | `gr` APPLY | Tanggal GR terakhir |
| `ReceiveAmount` | `gr` APPLY | Total GR amount |
| `InvoiceAmount` | `inv` APPLY | Total invoice |
| `LastInvoiceDate` | `inv` APPLY | Tanggal invoice terakhir |
| `OutstandingAmount` | `inv` APPLY | Amount outstanding |
| `MovementIssueCountActual` | CTE `movement_issue_docs` | Count dari CTE |
| `MovementIssueQtyActual` | CTE `movement_issue_docs` | Qty dari CTE |
| `MovementIssueAmountActual` | CTE `movement_issue_docs` | Amount dari CTE |
| `WorkshopAmount` | `w` APPLY | Total workshop amount |
| `WorkshopItem` | `w` APPLY | Total workshop item |
| `WorkshopLine` | `w` APPLY | Total workshop line |
| `LastWorkshopDate` | `w` APPLY | Tanggal workshop terakhir |
| `TotalInvoice` | `inv` APPLY | Total invoice count |
| `LastPOAmount` | `lastpo` APPLY | Amount PO terakhir |
| `LastPODate` | `lastpo` APPLY | Tanggal PO terakhir |
| `LastUsageDate` | `u` APPLY | Tanggal usage terakhir |
| `UsageAmount` | `u` APPLY | Total usage amount |
| `UsageLine` | `u` APPLY | Total usage line |
| `UsageUnit` | `u` APPLY | Total usage unit |
| `VehTypeCode` | `v` APPLY | Vehicle type code |
| `NextServiceMaintenanceDate` | `v` APPLY | Next service date |
| `NextRenewRoadTaxDate` | `v` APPLY | Next road tax renewal |
| `ItemType4WorkshopSourceValid` | CTE `summary` | Workshop item with valid loc |
| `ItemType4WorkshopSourceInvalid` | CTE `summary` | Workshop item with invalid loc |
| `MovementSourceMissing` | CTE `summary` | Items without movement data |
| `MovementSourceInvalid` | CTE `summary` | Invalid movement source |
