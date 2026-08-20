# Metric dictionary — MONTHLY STOCK ACCOUNT MOVEMENT DETAILS

Report: `monthly-stock-account-movement-details` / `RPTIN1000015`  
Source of truth: code (`monthly-stock-account-movement.ts`, inventory route, payload summary), not stale docs.

## Scope semantics

| Scope | Meaning | Safe for “full scope” label? |
| --- | --- | --- |
| `summary.*` server aggregates | Totals from SQL summary for current filters | Yes, when `metadata` says full/filtered |
| Loaded table window | Rows currently in browser | No — label “loaded rows” |
| Client-filtered window | Filter applied only on loaded rows | No |
| AI sample | Compacted rows for insight | No |

## Primary KPI set (Ringkasan — max 6)

| Key | User label | Kind | Source field | Notes |
| --- | --- | --- | --- | --- |
| opening_amount | Saldo Awal | currency | `OpeningAmount` | Implemented |
| goods_receive_amount | Purchasing GR | currency | `GoodsReceiveAmount` | **PU_GOODSRCV** only (bukan inventory receive) |
| issued_total_amount | Pengeluaran | currency | `IssuedTotalAmount` | Ledger+Station+Vehicle |
| return_amount | Inventory Return | currency | `ReturnAmount` | **IN_STOCKRTN + WS TT2** (bukan PU_GOODSRET) |
| closing_amount | Saldo Akhir | currency | `ClosingAmount` | Implemented |
| item_count | Jumlah Item | count | `TotalItem` / row count | Integer |

Context (not KPI cards): `ActualPeriod` → period, `accountingPeriod` → period, Source estate|pabrik → text.

## Istilah receive / return (WAJIB)

| Istilah UI | Modul | Tabel | Bukan |
| --- | --- | --- | --- |
| **Inventory Received** (`Received*`) | Inventory | `IN_STOCKRECEIVE` / `LN` | Purchasing GR |
| **Purchasing Goods Receive** (`GoodsReceive*`) | Purchasing | `PU_GOODSRCV` / `LN` × `PU_POLN.Cost` | Inventory receive |
| **Inventory Return** (`Return*`) | Inventory | `IN_STOCKRTN` / `LN` + `WS_JOBSTOCK` TT=2 | Retur supplier |
| **Purchasing Goods Return** (`GoodsReturn*`) | Purchasing | `PU_GOODSRET` / `LN` | Stock return gudang |

GR purchasing: Status **`2/5/6`** (Status=`2` saja → amount 0; mayoritas posted = `5`).

## Movement measures (from `MONTHLY_MOVEMENT_DEFINITIONS`)

| key | label | status |
| --- | --- | --- |
| opening | Opening | implemented |
| received | Inventory Received | implemented |
| return_advice | Return Advice | placeholder_zero |
| transferred | Transferred | placeholder_zero |
| adjustment | Adjustment | placeholder_zero |
| issued_ledger | Issued - Ledger | implemented |
| issued_station | Issued - Station | implemented |
| issued_vehicle | Issued - Vehicle | implemented |
| issued_total | Issued - Total | implemented |
| return | Inventory Return | implemented |
| purchasing_goods_receive | Purchasing Goods Receive | implemented |
| purchasing_goods_return | Purchasing Goods Return | implemented |
| purchasing_dispatch_advice | Purchasing - Dispatch Advice | placeholder_zero |
| closing | Closing | implemented |

Do not present placeholder_zero as proven business movement without status badge.

## Formatting rules

Use `utils/format.ts` → `formatMetric` / `formatKpiValue` / `inferMetricKind`.

- currency → `Rp` + 4 decimals (id-ID)
- quantity → number, no `Rp`
- count → integer, no `Rp`
- period → plain text (`2025-07`), never `Rp 0`
- date → medium date+time id-ID

## Reconciliation

Only show waterfall if calculated closing matches reported closing within verified tolerance.  
Otherwise show variance + “not directly reconcilable” with component list. Do not invent equation.

## Agent consistency

Any agent changing Report Detail MUST:

1. Keep this dictionary in sync when fields change.
2. Pass field/key into formatters (never bare `formatCurrency` for unknown fields).
3. Keep SQL/debug out of default Ringkasan.
4. Prefer CSS tokens in `globals.css` (`.rc-kpi-value`, `.rc-subtotal-row`, `.rc-sql-debug`).
