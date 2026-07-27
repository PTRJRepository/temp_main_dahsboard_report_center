# Fuel issue — selected period rule (canonical)

**Status:** LIVE 2026-07-24  
**Code:** `Dashboard_Utama/lib/reports/inventory/fuel-issue-sql.ts`  
**Consumers:** `fuel-usage`, `pengeluaran-barang` (Total Usage fuel branch), monthly stock movement CTE (fuel UNION), movement windows (DocDate expr).

## Rule

```
DocDate = COALESCE(
  NULLIF(PostDate, 1900-01-01),
  NULLIF(FuelIssueRefDate, 1900-01-01),
  UpdateDate,
  CreateDate
)
```

- Filter: `DocDate >= period start` AND `DocDate < next month` (UI `period=YYYY-MM` or dateFrom/dateTo).
- Status: `2` or `6`.
- Optional: `LocCode`.
- **Not** AccYear/AccMonth for fuel (IFESS Acc tag often ≠ calendar month of slip).

## Total Usage = Issued monthly (parity)

`pengeluaran-barang` Total Usage:

| Branch | Period axis | Status |
|--------|-------------|--------|
| Stock `IN_STOCKISSUE` | **AccYear/AccMonth** (same monthly) | 2/5/6 |
| Workshop `WS_JOBSTOCK` TT=1 | **AccYear/AccMonth** | ItemType 4 |
| Fuel `IN_FUELISSUE` | **calendar DocDate** | 2/6 |

```
TotalUsage = GudangIssueAmount + FuelIssueAmount + WorkshopIssueAmount
           ≈ monthly IssuedTotalAmount  (same filters: source, period, location)
```

Verified live estate P1A `2026-07`: both **2,347,542,968.79** (diff 0).

Explicit `dateFrom`/`dateTo` → stock/ws fall back to calendar (parity with monthly only for period=YYYY-MM mode).

## Why

- `PostDate = 1900` = belum post; SSMS `ORDER BY CreateDate` shows rows report would skip if filter only PostDate.
- KPI **Fuel Issue** = report `fuel-usage` (always live).
- KPI **Total Usage** includes fuel; **Issued monthly** same three sources.

## Outdated docs

- Prefer this file + `fuel-issue-sql.ts` + `stockIssue` in `route.ts` over notes that say Usage excludes fuel or uses PostDate-only for stock.
- Agent index: `Dokumentasi/AGENT_INDEX_REPORT_CENTER_UI.md` → section Fuel / Metric confusion.
