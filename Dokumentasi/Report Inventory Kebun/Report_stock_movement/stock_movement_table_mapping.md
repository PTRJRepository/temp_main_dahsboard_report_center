# Stock Movement Report Table Mapping

Source JSON: `stock_movement_extracted.json`

Report:
- Title: `MONTHLY STOCK ACCOUNT MOVEMENT DETAILS`
- Report ID: `RPTIN1000015`
- Location: `PTRJ`
- Period: `02/2027`
- Server: `SERVER_PROFILE_3`
- Database: `db_ptrj_mill`
- Company: `PT. REBINMAS JAYA OIL MILL`

## Result

The PDF/JSON can be reproduced from pabrik tables with these rules:

1. Base item list comes from `IN_ITEM`.
2. Opening comes from prior month `IN_MTHENDITEM`.
3. Current month movement comes from live transaction tables, not from `IN_MTHENDTRX`.
4. Closing is calculated from opening plus/minus movement, not taken directly from `IN_ITEM`.

`IN_MTHENDTRX` has no `2027/02` rows in the live pabrik DB, so it is not the source for this report period.

## Base Item Filter

The item list exactly matches 290 JSON rows with:

```sql
FROM [db_ptrj_mill].[dbo].[IN_ITEM]
WHERE RTRIM(LocCode) = 'PTRJ'
  AND RTRIM(Status) = '1'
  AND RTRIM(StockAnalysisCode) IN ('DEADS', 'MEMOV', 'SLMOV')
  AND RTRIM(ProdTypeCode) <> 'DC'
  AND RTRIM(ItemCode) COLLATE Latin1_General_BIN LIKE 'M%'
```

Validation count:

| StockAnalysisCode | Rows |
|---|---:|
| DEADS | 1 |
| MEMOV | 164 |
| SLMOV | 125 |
| Total | 290 |

Important: the uppercase binary `LIKE 'M%'` matters. It excludes direct-charge `DC*` items and one lowercase `mg03167`, matching the PDF list.

## Column Mapping

| Report column | Source table(s) | Rule |
|---|---|---|
| opening | `IN_MTHENDITEM` | Previous accounting month, `2027/01`, by `ItemCode + LocCode`. |
| received | `IN_STOCKRECEIVE`, `IN_STOCKRECEIVELN` | Zero in this report. Tables are empty for this case. |
| return_advice | `IN_ITEMRETADV`, `IN_ITEMRETADVLN` | Zero in this report. |
| transferred | `IN_STOCKTRANSFER`, `IN_STOCKTRANSFERLN` | Zero in this report. |
| adjustment | `IN_STOCKADJ`, `IN_STOCKADJLN` | Zero in this report. |
| ledger | `WS_JOBSTOCK` + `WS_JOB`; also possible `IN_STOCKISSUELN` fallback | Current month stock issue with no vehicle and no station/block. |
| issued_station | `IN_STOCKISSUE`, `IN_STOCKISSUELN`, `WS_JOBSTOCK`, `WS_JOB` | Stock issue to station/block. `IN_STOCKISSUE.Status = '2'`; `WS_JOBSTOCK.TransType = '1'` and `WS_JOB.BlkCode` present. |
| issued_vehicle | `WS_JOBSTOCK`, `WS_JOB` | `WS_JOBSTOCK.TransType = '1'` and `WS_JOB.VehCode` present. |
| issued_total | calculated | `ledger + issued_station + issued_vehicle`. |
| return | `WS_JOBSTOCK`, `WS_JOB` | `WS_JOBSTOCK.TransType = '2'`. |
| goods_receive | `PU_GOODSRCV`, `PU_GOODSRCVLN`, `PU_POLN` | `PU_GOODSRCV.Status = '2'`; quantity = `PU_GOODSRCVLN.StockQty`; amount = `StockQty * PU_POLN.Cost`. |
| goods_return | `PU_GOODSRET`, `PU_GOODSRETLN` | Zero in this report. |
| dispatch_adv | `PU_DISPADV`, `PU_DISPADVLN` | Zero in this report. |
| closing | calculated | `opening - issued_total + return + goods_receive`, plus other zero movement columns. |

## Status Rules Observed

- `IN_STOCKISSUE.Status = '2'` is included.
- `IN_STOCKISSUE.Status = '1'` is excluded. Example: open `MO04022` issue exists in DB, but the PDF excludes it.
- `WS_JOBSTOCK.Status = '1'` rows are included for the current period. These drive workshop station, vehicle, ledger, and return values.
- `PU_GOODSRCV.Status = '2'` is included.

## Validation Totals

The reconstructed SQL matches the JSON totals:

| Column | Qty | Amount |
|---|---:|---:|
| opening | 18,108.35 | 1,149,035,841.71 |
| ledger | 1.00 | 825,000.00 |
| issued_station | 4,993.40 | 76,338,231.30 |
| issued_vehicle | 5.00 | 1,371,600.00 |
| issued_total | 4,999.40 | 78,534,831.30 |
| return | 10.00 | 1,942,170.73 |
| goods_receive | 95.00 | 15,950,000.00 |
| closing | 13,213.95 | 1,088,393,181.14 |

Formula:

```text
closing =
  opening
  + received
  + return_advice
  + transferred
  + adjustment
  - issued_total
  + return
  + goods_receive
  - goods_return
  - dispatch_adv
```

For this PDF, the zero columns are `received`, `return_advice`, `transferred`, `adjustment`, `goods_return`, and `dispatch_adv`.

