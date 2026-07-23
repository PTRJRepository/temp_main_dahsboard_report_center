# 01 - Overview

## Report Purpose

**MONTHLY STOCK ACCOUNT MOVEMENT DETAILS** (RPTIN1000015) adalah report inventory yang menampilkan pergerakan stock bulanan per item. Report ini berguna untuk:

1. **Stock Control** - Monitoring saldo awal, movement, dan saldo akhir
2. **Cost Tracking** - Valuasi stock dalam IDR untuk setiap movement
3. **Audit Trail** - Jejak transaksi stock per periode akuntansi
4. **Cost Center Allocation** - Pemisahan issued ke Ledger, Station, dan Vehicle

## Report Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MONTHLY STOCK MOVEMENT FLOW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐      ┌─────────────────────────────────────────────┐      │
│  │   OPENING   │      │              MONTHLY MOVEMENT                 │      │
│  │  (Saldo     │      │  ┌─────────┐  ┌──────────────┐  ┌─────────┐ │      │
│  │   Awal)     │      │  │ RECEIVE │  │   ISSUE      │  │ RETURN  │ │      │
│  │             │      │  │ (Belum  │  │ Ledger      │  │ ( dari  │ │      │
│  │ IN_MTHEND   │      │  │ impl)   │  │ Station     │  │ operas) │ │      │
│  │ ITEM prev   │      │  │         │  │ Vehicle     │  │         │ │      │
│  │ period      │      │  │         │  └──────────────┘  │ WS_     │ │      │
│  └──────┬──────┘      │  └─────────┘                   │ JOBSTOCK│ │      │
│         │             │                                  │ TType=2 │ │      │
│         ▼             │                                  └────┬────┘ │      │
│  ┌─────────────┐      │                                        │       │      │
│  │   CLOSING   │      │  ┌──────────────────────────────────────┴────┐  │      │
│  │  (Saldo     │      │  │           GOODS RECEIVE                  │  │      │
│  │   Akhir)     │◄─────┼──│ PU_GOODSRCV × PU_POLN.Cost             │  │      │
│  │             │      │  └───────────────────────────────────────────┘  │      │
│  │ IN_MTHEND   │      │                                              │      │
│  │ ITEM curr   │      │  ┌───────────────────────────────────────────┐  │      │
│  │ period      │      │  │           GOODS RETURN                    │  │      │
│  │ (if exist) │      │  │ PU_GOODSRET × Cost                       │  │      │
│  └──────┬──────┘      │  └───────────────────────────────────────────┘  │      │
│         │             └─────────────────────────────────────────────┘      │
│         ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │ FORMULA:                                                         │     │
│  │ Closing = Opening + In - Out + Return + GoodsReceive - GoodsRet │     │
│  │         = Opening + Received + ReturnAdvice + Transferred +      │     │
│  │             Adjustment - (Ledger + Station + Vehicle) +           │     │
│  │             Return + GoodsReceive - GoodsReturn - DispatchAdvice  │     │
│  └─────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Sources by Period

### Snapshot Mode (Periode Lampau)
Untuk periode yang sudah lewat (bukan bulan berjalan):
- **Base CTE:** `IN_MTHENDITEM` period-end snapshot (Qty/Amount akhir bulan)
- **Closing:** Ambil dari `IN_MTHENDITEM` periode tersebut jika ada

### Live Mode (Bulan Berjalan)
Untuk periode berjalan (bulan ini):
- **Base CTE:** `IN_ITEM` live balance
- **Closing:** Dihitung dari formula (belum ada snapshot)

## Key Characteristics

| Attribute | Description |
|-----------|-------------|
| **Report ID** | RPTIN1000015 |
| **Analysis Group** | Product Type Code (ProductTypeCode) |
| **Item Scope** | ItemType 1 (Stock) dan 4 (Workshop) |
| **Location** | PTRJ (default) |
| **Currency** | IDR |
| **Period Type** | Accounting Period (AccYear/AccMonth) |

## Movement Measure Status

| Status | Meaning | Count |
|--------|---------|-------|
| ✅ Implemented | Data aktual dari source table | 8 |
| ⚠️ Placeholder | 0, belum diimplementasi | 6 |

**Implemented (8):**
1. Opening
2. Issued - Ledger / Station / Vehicle / Total
3. Return
4. Purchasing - Goods Receive / Goods Return
5. Closing

**Placeholder (6):**
1. Received
2. Return Advice
3. Transferred
4. Adjustment
5. Purchasing - Dispatch Advice

## Navigation

**Previous:** [README](./README.md)
**Next:** [Tables Reference](./02-TABLES-REFERENCE.md)
