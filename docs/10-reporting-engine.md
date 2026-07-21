# 10 — Reporting Engine

**Last verified:** 2026-07-21

## Purpose

Serve **read-only** operational inventory/procurement analytics for estate and mill MSSQL data, with optional AI insight over already-fetched payloads.

## Catalog source of truth

- `Dashboard_Utama/lib/reports/inventory/config.ts` — `inventoryReports`, `liveInventoryReports`
- Experience profile marks global module as **procurement** / submodule inventory

Reports include valuation, movement, aging, PR/PO, goods receive, fuel, workshop vehicle, and **monthly-stock-account-movement-details** (`RPTIN1000015`).

## Pipeline

```mermaid
flowchart LR
  UI[Report UI filters] --> API[/api/reports/inventory]
  API --> H[Handler SQL builder]
  H --> RO[validateReadOnlySql]
  RO --> DB[(MSSQL)]
  DB --> P[Payload rows/summary/chart]
  P --> F[applyReportFilters]
  F --> UI
  P --> AI[ai-insight / ai-analysis]
```

## Filter model

Implemented in `lib/reports/report-filtering.ts`:

| Capability | Notes |
|---|---|
| Period / accounting | `period`, `accYear`/`accMonth`, actual months |
| Movement window | `movementWindow` for category windows |
| Dimensions | product type/category/brand/model/material, stock analysis, movement category |
| Search / column filters | columnFilters max 5 |
| Sort / group / aggregate / top | top clamped 1..50; limits 1..500 in places |
| Natural language | `parseNaturalFilterLocally` + `/api/reports/natural-filter` |
| Safety | Blocks INSERT/UPDATE/DELETE/DDL/EXEC/SELECT INTO |

## Source parameter

| Value | DB profile |
|---|---|
| `estate` / `kebun` | estate (`db_ptrj`) |
| `pabrik` (default often) | mill (`db_ptrj_mill`) |

## Movement categories

From project conventions / `movement-category.ts`:

| StockIssueEventCount | Category |
|---|---|
| >= 6 | Fast Moving |
| 2–5 | Moving |
| 1 | Slow Moving |
| 0 stock>0 | Dead Stock |
| 0 stock=0 | No Movement / related stale handling |

## Procurement workspace

- Route family: `/report-center/procurement?source=&stockGroup=`
- Stock groups: inventory / gudang / workshop / process (ordering)
- KPI strip groups: valuation · process · movement/quality
- Catalog component: `InventoryReportsClient` (embedded)

## Export

- Client Excel (`xlsx`) and PDF (`jspdf`) from fetched rows
- Limits via `EXPORT_MAX_ROWS` / timeouts when configured
- Viewer also supports richer export toolbar components

## AI layer

- Does **not** run arbitrary DB writes
- Consumes payload + metadata
- Local LLM or Anthropic-compatible config via env
- Fallback local dashboard definitions exist (`ai-dashboard.ts`)

## Related

- [11-report-detail-experience.md](./11-report-detail-experience.md)
- [07-api-reference.md](./07-api-reference.md)
