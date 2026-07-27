# 04 - Movement Definitions

## Overview

Report memiliki **14 kolom movement** yang，分为三类:
1. **Balance columns** - Opening dan Closing
2. **Incoming** - Received, Return Advice, Transferred, Adjustment, Goods Receive, Goods Return, Dispatch Advice
3. **Outgoing** - Issued (Ledger, Station, Vehicle, Total), Return

## Movement Column Definitions

### Balance Columns

#### 1. Opening (Saldo Awal)
| Property | Value |
|----------|-------|
| **Key** | `opening` |
| **Label** | Opening |
| **Status** | ✅ Implemented |
| **Unit** | item unit |
| **Currency** | IDR |
| **Source** | `IN_MTHENDITEM` previous accounting period |

**SQL Column:** `opening_qty`, `opening_amt`

**Source:**
```sql
SELECT Qty AS opening_qty, Amount AS opening_amt
FROM IN_MTHENDITEM
WHERE LocCode = '${scope.location}'
  AND AccYear = '${scope.openingAccYear}'
  AND AccMonth = '${scope.openingAccMonth}'
```

---

#### 2. Closing (Saldo Akhir)
| Property | Value |
|----------|-------|
| **Key** | `closing` |
| **Label** | Closing |
| **Status** | ✅ Implemented |
| **Unit** | item unit |
| **Currency** | IDR |
| **Source** | Computed (or IN_MTHENDITEM if snapshot exists) |

**Formula:**
```
Closing = Opening + Received + ReturnAdvice + Transferred + Adjustment
        - (Ledger + Station + Vehicle)
        + Return + GoodsReceive - GoodsReturn - DispatchAdvice
```

**SQL:**
```sql
CASE WHEN has_period_closing = 1 THEN period_closing_qty
  ELSE opening_qty + received_qty + return_advice_qty + transferred_qty + adjustment_qty
    - (ledger_qty + issued_station_qty + issued_vehicle_qty)
    + return_qty + goods_receive_qty - goods_return_qty - dispatch_adv_qty
END AS ClosingQty
```

---

### Incoming Movements

#### 3. Received (Penerimaan)
| Property | Value |
|----------|-------|
| **Key** | `received` |
| **Label** | Received |
| **Status** | ⚠️ Placeholder Zero |
| **Unit** | item unit |
| **Currency** | IDR |
| **Source** | Not implemented |

**Note:** Di report ini selalu 0. Mungkin dari `IN_STOCKRECEIVE` tapi belum divalidasi.

---

#### 4. Return Advice (Nota Retur)
| Property | Value |
|----------|-------|
| **Key** | `return_advice` |
| **Label** | Return Advice |
| **Status** | ⚠️ Placeholder Zero |
| **Unit** | item unit |
| **Currency** | IDR |
| **Source** | Not implemented |

**Note:** Mungkin dari `IN_ITEMRETADV`/`IN_ITEMRETADVLN`.

---

#### 5. Transferred (Transfer)
| Property | Value |
|----------|-------|
| **Key** | `transferred` |
| **Label** | Transferred |
| **Status** | ⚠️ Placeholder Zero |
| **Unit** | item unit |
| **Currency** | IDR |
| **Source** | Not implemented |

**Note:** Mungkin dari `IN_STOCKTRANSFER`/`IN_STOCKTRANSFERLN`.

---

#### 6. Adjustment (Penyesuaian)
| Property | Value |
|----------|-------|
| **Key** | `adjustment` |
| **Label** | Adjustment |
| **Status** | ⚠️ Placeholder Zero |
| **Unit** | item unit |
| **Currency** | IDR |
| **Source** | Not implemented |

**Note:** Mungkin dari `IN_STOCKADJ`/`IN_STOCKADJLN`.

---

#### 7. Purchasing - Goods Receive (Penerimaan Pembelian)
| Property | Value |
|----------|-------|
| **Key** | `purchasing_goods_receive` |
| **Label** | Purchasing - Goods Receive |
| **Status** | ✅ Implemented |
| **Unit** | item unit |
| **Currency** | IDR |
| **Source** | `PU_GOODSRCV`/`PU_GOODSRCVLN` × `PU_POLN.Cost` |

**Valuation:**
```sql
GoodsReceiveQty = PU_GOODSRCVLN.StockQty
GoodsReceiveAmt = StockQty × PU_POLN.Cost
```

**Filters:**
```sql
WHERE PU_GOODSRCV.Status = '2'  -- Approved
  AND AccYear = '${scope.accYear}'
  AND AccMonth = '${scope.accMonth}'
  AND LocCode = '${scope.location}'
```

---

#### 8. Purchasing - Goods Return (Retur Pembelian)
| Property | Value |
|----------|-------|
| **Key** | `purchasing_goods_return` |
| **Label** | Purchasing - Goods Return |
| **Status** | ✅ Implemented |
| **Unit** | item unit |
| **Currency** | IDR |
| **Source** | `PU_GOODSRET`/`PU_GOODSRETLN` × Cost |

**Valuation:**
```sql
GoodsReturnQty = COALESCE(ReturnStockQty, QtyReturn, 0)
GoodsReturnAmt = COALESCE(
  Amount,
  ReturnStockQty × Cost,
  QtyReturn × Cost,
  0
)
```

**Note:** Jika Amount=0, fallback ke quantity × cost. Reducing closing.

---

#### 9. Purchasing - Dispatch Advice
| Property | Value |
|----------|-------|
| **Key** | `purchasing_dispatch_advice` |
| **Label** | Purchasing - Dispatch Advice |
| **Status** | ⚠️ Placeholder Zero |
| **Unit** | item unit |
| **Currency** | IDR |
| **Source** | Not implemented |

---

### Outgoing Movements

#### 10. Issued - Ledger
| Property | Value |
|----------|-------|
| **Key** | `issued_ledger` |
| **Label** | Issued - Ledger |
| **Status** | ✅ Implemented |
| **Unit** | item unit |
| **Currency** | IDR |
| **Source** | `IN_STOCKISSUE` + **`IN_FUELISSUE`** + `WS_JOBSTOCK` (no block, no vehicle) |

**Period:** stock/ws = AccYear/AccMonth; **fuel = calendar DocDate** (see `FUEL_ISSUE_SELECTED_PERIOD.md`).

**Classification:**
```
BlkCode = empty AND VehCode = empty
```

**SQL (IN_STOCKISSUE):**
```sql
CASE WHEN LEN(RTRIM(ISNULL(l.BlkCode, ''))) = 0
     AND LEN(RTRIM(ISNULL(l.VehCode, ''))) = 0
     THEN ISNULL(l.Qty, 0) ELSE 0 END AS ledger_qty
```

**SQL (WS_JOBSTOCK):**
```sql
CASE WHEN TransType = '1'
     AND LEN(RTRIM(ISNULL(j.VehCode, ''))) = 0
     AND LEN(RTRIM(ISNULL(j.BlkCode, ''))) = 0
     THEN ISNULL(s.Qty, 0) ELSE 0 END AS ledger_qty
```

---

#### 11. Issued - Station
| Property | Value |
|----------|-------|
| **Key** | `issued_station` |
| **Label** | Issued - Station |
| **Status** | ✅ Implemented |
| **Unit** | item unit |
| **Currency** | IDR |
| **Source** | `IN_STOCKISSUE` + **`IN_FUELISSUE`** + `WS_JOBSTOCK` (has block, no vehicle) |

**Classification:**
```
BlkCode = has_value AND VehCode = empty
```

**Cost Center Context:** Issue ke station/cost center, bukan ke kendaraan.

---

#### 12. Issued - Vehicle
| Property | Value |
|----------|-------|
| **Key** | `issued_vehicle` |
| **Label** | Issued - Vehicle |
| **Status** | ✅ Implemented |
| **Unit** | item unit |
| **Currency** | IDR |
| **Source** | `IN_STOCKISSUE` + **`IN_FUELISSUE`** (majority BBM) + `WS_JOBSTOCK` (has vehicle) |

**Classification:**
```
VehCode = has_value
```

**Cost Center Context:** Expense kendaraan (BBM, spare part). Fuel lines often land here.

---

#### 13. Issued - Total
| Property | Value |
|----------|-------|
| **Key** | `issued_total` |
| **Label** | Issued - Total |
| **Status** | ✅ Implemented |
| **Unit** | item unit |
| **Currency** | IDR |
| **Source** | Computed |

**Formula:**
```
IssuedTotal = Ledger + Station + Vehicle
```

Includes stock + fuel + workshop issue (rules above). **≠ Total Usage** (usage excludes fuel).

---

#### 14. Return (Retur dari Operasional)
| Property | Value |
|----------|-------|
| **Key** | `return` |
| **Label** | Return |
| **Status** | ✅ Implemented |
| **Unit** | item unit |
| **Currency** | IDR |
| **Source** | `WS_JOBSTOCK` TransType = '2' |

**Classification:**
```
WS_JOBSTOCK.TransType = '2' (Return)
```

**Context:** Barang yang dikembalikan dari operasional workshop ke inventory.

---

## Movement Measure Status Summary

| Key | Label | Status | Source Table |
|-----|-------|--------|--------------|
| `opening` | Opening | ✅ | IN_MTHENDITEM prev |
| `received` | Received | ⚠️ | Placeholder |
| `return_advice` | Return Advice | ⚠️ | Placeholder |
| `transferred` | Transferred | ⚠️ | Placeholder |
| `adjustment` | Adjustment | ⚠️ | Placeholder |
| `issued_ledger` | Issued - Ledger | ✅ | IN_STOCKISSUE + IN_FUELISSUE + WS |
| `issued_station` | Issued - Station | ✅ | IN_STOCKISSUE + IN_FUELISSUE + WS |
| `issued_vehicle` | Issued - Vehicle | ✅ | IN_STOCKISSUE + IN_FUELISSUE + WS |
| `issued_total` | Issued - Total | ✅ | Computed (L+S+V) |
| `return` | Return | ✅ | WS_JOBSTOCK TType=2 |
| `purchasing_goods_receive` | Goods Receive | ✅ | PU_GOODSRCV |
| `purchasing_goods_return` | Goods Return | ✅ | PU_GOODSRET |
| `purchasing_dispatch_advice` | Dispatch Advice | ⚠️ | Placeholder |
| `closing` | Closing | ✅ | Computed/IN_MTHENDITEM |

**Legend:**
- ✅ Implemented = Data aktual dari source table
- ⚠️ Placeholder = Selalu 0, belum diimplementasi

---

## Navigation

**Previous:** [03-SQL CTE Structure](./03-SQL-CTE-STRUCTURE.md)
**Next:** [05-Filters & Parameters](./05-FILTERS-PARAMETERS.md)
