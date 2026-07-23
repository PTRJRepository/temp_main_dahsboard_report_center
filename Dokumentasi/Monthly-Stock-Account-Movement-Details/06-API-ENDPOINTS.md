# 06 - API Endpoints

## Endpoint Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      API ENDPOINT FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Browser                                                        │
│    │                                                           │
│    ▼                                                           │
│  /api/reports/inventory?report=monthly-stock-account-movement  │
│    │                                                           │
│    ▼                                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Route Handler (route.ts)                                  │   │
│  │ - Validates parameters                                    │   │
│  │ - Gets query context                                     │   │
│  │ - Calls service function                                  │   │
│  └─────────────────────┬───────────────────────────────────┘   │
│                        │                                       │
│                        ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Service (monthly-stock-account-movement.ts)              │   │
│  │ - Builds CTE SQL                                         │   │
│  │ - Executes 3 queries (detail, summary, chart)           │   │
│  │ - Builds analytics/breakdowns                            │   │
│  └─────────────────────┬───────────────────────────────────┘   │
│                        │                                       │
│                        ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Query Gateway (MSSQL)                                    │   │
│  │ - db_ptrj_mill (pabrik)                                │   │
│  │ - db_ptrj (estate)                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Standard Inventory Endpoint

### Request
```
GET /api/reports/inventory?report=monthly-stock-account-movement-details
```

### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `report` | string | Yes | - | Must be `monthly-stock-account-movement-details` |
| `source` | string | No | `pabrik` | `pabrik` or `estate` |
| `location` | string | No | `PTRJ` | Location code |
| `period` | string | No | Current month | `YYYY-MM` or `acc:YYYY-MM` |
| `search` | string | No | - | Item search |
| `limit` | number | No | 500 | Max rows (1-20000) |
| `dateTo` | string | No | - | Transaction as-of date |

### Response Structure
```json
{
  "title": "MONTHLY STOCK ACCOUNT MOVEMENT DETAILS",
  "description": "Rekonstruksi RPTIN1000015...",
  "rows": [...],
  "columns": [...],
  "summary": {
    "Location": "PTRJ",
    "ActualPeriod": "2026-07",
    "AccountingPeriod": "2027-04",
    "TotalItem": 290,
    "ClosingAmount": 1088393181.14,
    ...
  },
  "chart": [...],
  "metadata": {
    "source": "pabrik",
    "reportReference": "RPTIN1000015",
    "snapshotMode": true,
    ...
  }
}
```

### Row Structure
```json
{
  "ActualPeriod": "2026-07",
  "AccountingPeriod": "2027-04",
  "Location": "PTRJ",
  "ProductTypeCode": "M",
  "ProductTypeDescription": "SPARE PART - MECHANICAL",
  "No": 1,
  "ItemCode": "MO04022",
  "ItemDescription": "Pisau potong rumput 16\"",
  "UOM": "PCS",
  "QtyOnHand": 6,
  "QtyOnHold": 0,
  "QtyOnHandHold": 6,
  "AverageCost": 50000,
  "OnHandHoldAmount": 300000,
  "OpeningQty": 8,
  "OpeningAmount": 400000,
  "IssuedStationQty": 2,
  "IssuedStationAmount": 100000,
  "IssuedTotalQty": 2,
  "IssuedTotalAmount": 100000,
  "ReturnQty": 0,
  "ReturnAmount": 0,
  "GoodsReceiveQty": 0,
  "GoodsReceiveAmount": 0,
  "ClosingQty": 6,
  "ClosingAmount": 300000,
  "ClosingSource": "IN_MTHENDITEM"
}
```

---

## Nested JSON Endpoint

### Request
```
GET /api/reports/monthly-stock-account-movement-details-json
```

### Response Structure
```json
{
  "metadata": {
    "report_id": "RPTIN1000015",
    "report_title": "MONTHLY STOCK ACCOUNT MOVEMENT DETAILS",
    "company": "PT. REBINMAS JAYA OIL MILL",
    "site_code": "PTRJ",
    "location": "PTRJ",
    "accounting_period_from": "4/2027 (Jul 2026)",
    "accounting_period_to": "4/2027 (Jul 2026)",
    "analysis_group": "Product Type Code",
    "total_rows": 290,
    "source": "pabrik"
  },
  "column_definitions": [
    { "key": "opening", "label": "Opening", "status": "implemented", ... },
    { "key": "received", "label": "Received", "status": "placeholder_zero", ... },
    ...
  ],
  "product_types": [
    {
      "code": "M",
      "description": "SPARE PART - MECHANICAL",
      "item_count": 45,
      "reported_total": { ... },
      "calculated_total": { ... },
      "totals_source": "full_scope_product_type_query"
    }
  ],
  "items": [
    {
      "product_type_code": "M",
      "product_type_name": "SPARE PART - MECHANICAL",
      "sequence_in_group": 1,
      "item_code": "MO04022",
      "description": "Pisau potong rumput 16\"",
      "unit": "PCS",
      "description_as_printed": "Pisau potong rumput 16\" (PCS)",
      "movements": {
        "opening": { "quantity": 8, "amount_idr": 400000 },
        "received": { "quantity": 0, "amount_idr": 0 },
        ...
        "closing": { "quantity": 6, "amount_idr": 300000 }
      },
      "source_page": 2
    }
  ]
}
```

### Item Movements Structure
```typescript
interface MonthlyMovementTotals {
  opening: { quantity: number; amount_idr: number }
  received: { quantity: number; amount_idr: number }
  return_advice: { quantity: number; amount_idr: number }
  transferred: { quantity: number; amount_idr: number }
  adjustment: { quantity: number; amount_idr: number }
  issued_ledger: { quantity: number; amount_idr: number }
  issued_station: { quantity: number; amount_idr: number }
  issued_vehicle: { quantity: number; amount_idr: number }
  issued_total: { quantity: number; amount_idr: number }
  return: { quantity: number; amount_idr: number }
  purchasing_goods_receive: { quantity: number; amount_idr: number }
  purchasing_goods_return: { quantity: number; amount_idr: number }
  purchasing_dispatch_advice: { quantity: number; amount_idr: number }
  closing: { quantity: number; amount_idr: number }
}
```

---

## Data Source Configuration

### Source: Pabrik (Default)
```typescript
// query-gateway.ts
getInventoryQueryContext('pabrik')
// → server: SERVER_PROFILE_3
// → database: db_ptrj_mill
```

### Source: Estate
```typescript
getInventoryQueryContext('estate')
// → server: (estate server)
// → database: db_ptrj
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Parameter periode tidak valid"
}
```

### 500 Internal Server Error
```json
{
  "error": "Query monthly stock movement gagal diproses."
}
```

### Error Scenarios
| Scenario | Error Message |
|----------|--------------|
| Invalid period format | "Parameter periode tidak valid" |
| SQL execution failure | "Query monthly stock movement gagal diproses." |
| Invalid location | Uses default PTRJ |
| Limit out of range | Bounded to 1-20000 |

---

## Execution Flow

```typescript
export async function createMonthlyStockAccountMovementPayload({
  ctx,           // InventoryQueryContext (source, database)
  filters,      // ReportFilterInput
  search,        // string
  limit,         // number
  now,           // Date (optional, default: now)
  executeQuery,  // QueryExecutor function
}) {
  // 1. Resolve scope from filters
  const scope = resolveMonthlyStockMovementScope({ filters, search, limit, now })

  // 2. Build CTE SQL
  const cte = buildMonthlyStockAccountMovementCte(scope, ctx.database)

  // 3. Execute 3 queries in parallel
  const [reportRows, summaryRows, chartRows] = await Promise.all([
    executeQuery(ctx, monthlyStockMovementDetailSql(cte, scope.limit)),
    executeQuery(ctx, monthlyStockMovementSummarySql(cte)),
    executeQuery(ctx, monthlyStockMovementBreakdownSql(cte)),
  ])

  // 4. Build payload
  return {
    title: MONTHLY_STOCK_MOVEMENT_REPORT_TITLE,
    rows: reportRows,
    columns: Object.keys(reportRows[0] ?? {}),
    summary: normalizeSummary(summaryRows[0], scope),
    chart: chartRows,
    metadata: buildMetadata(ctx, scope, summary, chartRows),
  }
}
```

---

## Navigation

**Previous:** [05-Filters & Parameters](./05-FILTERS-PARAMETERS.md)
**Next:** [07-Accounting Period](./07-ACCOUNTING-PERIOD.md)
