# MONTHLY STOCK ACCOUNT MOVEMENT DETAILS

**Report ID:** RPTIN1000015
**Source context:** Inventory query gateway (`source=pabrik` default untuk nested adapter, database mengikuti registry/gateway)
**Primary API:** `/api/reports/inventory?report=monthly-stock-account-movement-details`
**Status:** Live | Priority: Critical

## Implementasi Report Center

Logika RPTIN1000015 sekarang dimiliki oleh satu service:

`Dashboard_Utama/lib/reports/inventory/monthly-stock-account-movement.ts`

- Canonical Inventory API dan nested JSON endpoint memakai service yang sama.
- Endpoint tidak lagi memiliki hard-coded token, localhost gateway, server profile, atau database khusus.
- Summary, chart, dan `stock_analyses[]` berasal dari query full-scope.
- `items[]` tetap boleh dibatasi `limit`, tetapi subtotal nested tidak dihitung dari item rows yang sudah di-TOP/limit.

## Deskripsi Report

Rekonstruksi stock account movement bulanan untuk item movement pabrik PTRJ. Report menampilkan:
- **Opening:** Saldo awal dari IN_MTHENDITEM periode sebelumnya
- **Movement:** Receive, Return Advice, Transferred, Adjustment
- **Issued:** Ledger, Station, Vehicle (dipisah untuk tracking cost center)
- **Return:** Barang kembali dari operasional
- **Purchasing:** Goods Receive, Goods Return, Dispatch Advice
- **Closing:** Saldo akhir = Opening + Movement In - Issued + Return - Purchasing Out

## Struktur Output

```json
{
  "metadata": {
    "report_id": "RPTIN1000015",
    "report_title": "MONTHLY STOCK ACCOUNT MOVEMENT DETAILS",
    "company": "PT. REBINMAS JAYA OIL MILL",
    "location": "PTRJ",
    "accounting_period_from": "4/2027 (Jul 2026)",
    "analysis_group": "Stock Analysis Code"
  },
  "column_definitions": [
    { "key": "opening", "label": "Opening", "quantity_unit": "item unit", "amount_currency": "IDR" },
    { "key": "received", "label": "Received", ... },
    { "key": "return_advice", "label": "Return Advice", ... },
    { "key": "transferred", "label": "Transferred", ... },
    { "key": "adjustment", "label": "Adjustment", ... },
    { "key": "issued_ledger", "label": "Issued - Ledger", ... },
    { "key": "issued_station", "label": "Issued - Station", ... },
    { "key": "issued_vehicle", "label": "Issued - Vehicle", ... },
    { "key": "issued_total", "label": "Issued - Total", ... },
    { "key": "return", "label": "Return", ... },
    { "key": "purchasing_goods_receive", "label": "Purchasing - Goods Receive", ... },
    { "key": "purchasing_goods_return", "label": "Purchasing - Goods Return", ... },
    { "key": "purchasing_dispatch_advice", "label": "Purchasing - Dispatch Advice", ... },
    { "key": "closing", "label": "Closing", ... }
  ],
  "stock_analyses": [
    {
      "code": "DEADS",
      "description": "DEAD STOCK",
      "item_count": 1,
      "reported_total": { "opening": { "quantity": 8, "amount_idr": 400000 }, ... },
      "calculated_total": { "opening": { "quantity": 8, "amount_idr": 400000 }, ... }
    },
    { "code": "MEMOV", "description": "MEDIUM MOVING", "item_count": 33, ... },
    { "code": "SLMOV", "description": "SLOW MOVING", "item_count": 24, ... }
  ],
  "items": [
    {
      "stock_analysis_code": "DEADS",
      "item_code": "MO04022",
      "description_as_printed": "Pisau potong rumput 16\" (PCS)",
      "movements": {
        "opening": { "quantity": 8, "amount_idr": 400000 },
        "issued_station": { "quantity": 2, "amount_idr": 100000 },
        "closing": { "quantity": 6, "amount_idr": 300000 }
      }
    }
  ]
}
```

## Stock Analysis Codes

Stock Analysis Code adalah klasifikasi master/tersimpan dari item, bukan computed Movement Category periodik.

| Code | Description | Kriteria |
|------|-------------|----------|
| DEADS | DEAD STOCK | Stored `IN_ITEM.StockAnalysisCode` |
| MEMOV | MEDIUM MOVING | Stored `IN_ITEM.StockAnalysisCode` |
| SLMOV | SLOW MOVING | Stored `IN_ITEM.StockAnalysisCode` |

Computed Movement Category (`Fast Moving`, `Moving`, `Slow Moving`, `Dead Stock`, `Stale`) tetap terpisah dan dihitung periodik di report movement lain berdasarkan event issue valid dalam periode terpilih.

## Filter Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `source` | string | `pabrik` | Koneksi ke db_ptrj_mill |
| `location` | string | `PTRJ` | Lokasi gudang |
| `period` | string | Current month | Periode accounting (YYYY-MM) |
| `category` | string | All (DEADS, MEMOV, SLMOV) | Stock Analysis Code filter |
| `search` | string | - | Pencarian: ItemCode, Description |

## Source Tables

| Table | Usage |
|-------|-------|
| `IN_ITEM` | Base item master (LocCode, Status, StockAnalysisCode, QtyOnHand, QtyOnHold, AverageCost) |
| `IN_STOCKANALYSIS` | Stock Analysis descriptions |
| `IN_MTHENDITEM` | Opening balance dari periode sebelumnya |
| `IN_STOCKISSUE` / `IN_STOCKISSUELN` | Issue non-workshop items (TransType 1) |
| `WS_JOBSTOCK` / `WS_JOB` | Issue workshop items (ItemType 4, TransType 1=issue, 2=return) |
| `PU_GOODSRCV` / `PU_GOODSRCVLN` | Goods receipt dari purchasing |
| `PU_POLN` | Unit cost untuk valuasi goods receive |

## Movement Calculation Rules

### Movement Measure Status

| Measure | Status | Source |
|---------|--------|--------|
| Opening | Implemented | `IN_MTHENDITEM` periode accounting sebelumnya |
| Issued - Ledger/Station/Vehicle | Implemented | `IN_STOCKISSUE` untuk non-workshop dan `WS_JOBSTOCK.TransType=1` untuk workshop |
| Return | Implemented | `WS_JOBSTOCK.TransType=2` |
| Purchasing - Goods Receive | Implemented | `PU_GOODSRCV` / `PU_GOODSRCVLN` x `PU_POLN.Cost` |
| Closing | Implemented | Formula closing report |
| Received, Return Advice, Transferred, Adjustment, Goods Return, Dispatch Advice | Placeholder zero | Belum direkonstruksi dari source table yang tervalidasi |

### Closing Formula
```
Closing = Opening + Received + ReturnAdvice + Transferred + Adjustment
        - (Ledger + Station + Vehicle)
        + Return + GoodsReceive - GoodsReturn - DispatchAdvice
```

### ItemType Classification
- **ItemType 1-3:** Non-workshop → pakai IN_STOCKISSUE
- **ItemType 4 (Workshop):** → pakai WS_JOBSTOCK.TransType

### Issue Classification
| BlkCode | VehCode | Classification |
|---------|---------|----------------|
| Empty | Empty | Ledger |
| Has value | Empty | Station (cost center issue) |
| Any | Has value | Vehicle (vehicle expense) |

## Accounting Period Conversion

Periode aktual (YYYY-MM) dikonversi ke AccYear/AccMonth:
- April (04) → AccMonth 1, AccYear +1 (fiscal year starts April)
- July (07) → AccMonth 4, AccYear yang sama

```typescript
// Helper functions
actualToAccountingPeriod('2026-07') → { accYear: 2027, accMonth: 4 }
accountingToActualPeriod(2027, 4) → { actualPeriod: '2026-07', fiscalYearStart: '2026-04' }
```

## API Endpoints

### Standard JSON (flat rows)
```
GET /api/reports/inventory?report=monthly-stock-account-movement-details
```

### JSON Format (grouped, ASMA format)
```
GET /api/reports/monthly-stock-account-movement-details-json
```

Format ini menghasilkan output terstruktur dengan:
- `stock_analyses[]` - grouped subtotal per StockAnalysisCode
- `items[]` - detail items dengan `description_as_printed`
- Kolom `description` (nama item/asma) included
- `movement_measure_status` - menandai kolom yang sudah implemented dan placeholder zero

### Query Parameters
```
?source=pabrik
&location=PTRJ
&period=2026-07
&category=DEADS,MEMOV,SLMOV
&search=nalco
&limit=500
```

### Response Fields

| Field | Description |
|-------|-------------|
| `stock_analyses[].reported_total` | Total full-scope dari stock-analysis query, bukan sum dari `items[]` yang dibatasi limit |
| `stock_analyses[].calculated_total` | Total yang dihitung ulang untuk verifikasi |
| `items[].description_as_printed` | Format: "Description (UOM)" |
| `items[].movements.*.quantity` | Quantity dalam unit item |
| `items[].movements.*.amount_idr` | Nilai dalam IDR (2 desimal) |

## Workshop Items

Item workshop (ItemType 4) menggunakan WS_JOBSTOCK dengan logika khusus:

- **Issue Station:** TransType=1, VehCode empty, BlkCode has value
- **Issue Vehicle:** TransType=1, VehCode has value
- **Return:** TransType=2

## Goods Receive Valuation

```
GoodsReceiveAmount = PU_GOODSRCVLN.StockQty × PU_POLN.Cost
```

Jika PU_POLN.Cost NULL, cost dianggap 0.

## Quality Notes

1. **Opening dari IN_MTHENDITEM** - bukan dari IN_ITEM.QtyOnHand
2. **Closing dihitung** - bukan diambil dari IN_ITEM (yang showing current balance)
3. **Period filter** - gunakan AccYear/AccMonth hasil konversi, bukan tanggal transaksi langsung
4. **Workshop items** - harus difilter ItemType=4, bukan dari LocCode
5. **Missing period** - item tanpa movement di periode berjalan tetap muncul dengan qty 0
6. **Subtotal nested** - `stock_analyses[].reported_total` berasal dari full-scope stock-analysis query, bukan dari `items[]` yang sudah dibatasi `limit`
7. **Placeholder movement** - measure placeholder zero harus diberi label eksplisit dan tidak boleh dipresentasikan sebagai data transaksi lengkap

## Related Documentation

- [Report Center Documentation](./Report-Center-Documentation.md)
- [DB_PTRJ_MILL Stock Relations](./DB_ptrj_mill_Stock_Hubungan.md)
- Movement Category: [movement-category.ts](../../Dashboard_Utama/lib/reports/movement-category.ts)
- Accounting Period: [accounting-period.ts](../../Dashboard_Utama/lib/reports/accounting-period.ts)
