# 12 - Nested Response Format

## Overview

Nested JSON response adalah format alternatif yang mengembalikan data dalam struktur hierarkis, lebih cocok untuk rendering PDF atau tampilan terorganisir.

```
┌─────────────────────────────────────────────────────────────────┐
│                    RESPONSE FORMAT COMPARISON                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  STANDARD (Flat Rows)           NESTED (Hierarchical)          │
│  ───────────────────────        ──────────────────────────     │
│                                                                 │
│  rows: [                    product_types: [                    │
│    {ItemCode, ...},            {                                  │
│    {ItemCode, ...},              code: "M",                      │
│    {ItemCode, ...},              items: [                       │
│  ]                               {ItemCode, movements},         │
│                                   {ItemCode, movements},        │
│                                   ...                           │
│                                 ]                               │
│                               }                                 │
│                             ]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Nested Response Structure

```typescript
interface MonthlyStockMovementNestedResponse {
  metadata: {
    report_id: string
    report_title: string
    company: string
    site_code: string
    location: string
    accounting_period_from: string
    accounting_period_to: string
    analysis_group: string
    stock_analysis_code_filter: string
    account_code_filter: string
    number_of_decimals: number
    suppress_zero_balance: string
    include_workshop_item: string
    printed_by: string
    printed_at: string
    page_count: number
    currency: string
    source: string
    source_label: string
    public_source_id: string
    actual_period: string
    accounting_period: string
    opening_actual_period: string
    opening_accounting_period: string
    total_rows: number
    totals_source: string
    movement_measure_status: Array<{
      key: string
      label: string
      status: 'implemented' | 'placeholder_zero'
      source: string
    }>
  }

  column_definitions: Array<{
    key: string
    label: string
    quantity_unit: string
    amount_currency: string
    status: 'implemented' | 'placeholder_zero'
  }>

  product_types: Array<{
    code: string
    description: string
    item_count: number
    reported_total: MonthlyMovementTotals
    calculated_total: MonthlyMovementTotals
    totals_source: string
  }>

  items: Array<{
    product_type_code: string
    product_type_name: string
    sequence_in_group: number
    item_code: string
    description: string
    unit: string
    description_as_printed: string
    movements: MonthlyMovementTotals
    source_page: number
  }>
}
```

## Example Response

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
    "source": "pabrik",
    "movement_measure_status": [
      { "key": "opening", "label": "Opening", "status": "implemented", "source": "IN_MTHENDITEM previous accounting period" },
      { "key": "received", "label": "Received", "status": "placeholder_zero", "source": "Not implemented" },
      ...
    ]
  },

  "column_definitions": [
    { "key": "opening", "label": "Opening", "quantity_unit": "item unit", "amount_currency": "IDR", "status": "implemented" },
    { "key": "received", "label": "Received", "quantity_unit": "item unit", "amount_currency": "IDR", "status": "placeholder_zero" },
    ...
  ],

  "product_types": [
    {
      "code": "M",
      "description": "SPARE PART - MECHANICAL",
      "item_count": 45,
      "reported_total": {
        "opening": { "quantity": 1000, "amount_idr": 50000000 },
        "received": { "quantity": 0, "amount_idr": 0 },
        ...
      },
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
        "return_advice": { "quantity": 0, "amount_idr": 0 },
        "transferred": { "quantity": 0, "amount_idr": 0 },
        "adjustment": { "quantity": 0, "amount_idr": 0 },
        "issued_ledger": { "quantity": 0, "amount_idr": 0 },
        "issued_station": { "quantity": 2, "amount_idr": 100000 },
        "issued_vehicle": { "quantity": 0, "amount_idr": 0 },
        "issued_total": { "quantity": 2, "amount_idr": 100000 },
        "return": { "quantity": 0, "amount_idr": 0 },
        "purchasing_goods_receive": { "quantity": 0, "amount_idr": 0 },
        "purchasing_goods_return": { "quantity": 0, "amount_idr": 0 },
        "purchasing_dispatch_advice": { "quantity": 0, "amount_idr": 0 },
        "closing": { "quantity": 6, "amount_idr": 300000 }
      },
      "source_page": 2
    }
  ]
}
```

## Movement Totals Structure

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

## Conversion from Flat Rows

```typescript
export function movementTotalsFromRow(row: DbRow): MonthlyMovementTotals {
  return Object.fromEntries(
    MONTHLY_MOVEMENT_DEFINITIONS.map((definition) => [
      definition.key,
      {
        quantity: numberValue(row[`${definition.sqlPrefix}Qty`]),
        amount_idr: numberValue(row[`${definition.sqlPrefix}Amount`]),
      },
    ])
  ) as MonthlyMovementTotals
}
```

## Product Type Aggregation

Product types di-aggregate dari breakdown query:

```typescript
product_types: payload.chart
  .filter(isMonthlyProductTypeChartRow)
  .map((row) => ({
    code: String(row.ProductTypeCode ?? row.DimensionValue ?? ''),
    description: String(row.ProductTypeDescription ?? row.Label ?? ''),
    item_count: numberValue(row.TotalItem),
    reported_total: movementTotalsFromRow(row),
    calculated_total: movementTotalsFromRow(row),
    totals_source: 'full_scope_product_type_query'
  }))
```

## API Endpoint

```
GET /api/reports/monthly-stock-account-movement-details-json
```

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `source` | string | `pabrik` | Data source |
| `location` | string | `PTRJ` | Location |
| `period` | string | Current | Period YYYY-MM |
| `limit` | number | 500 | Max items |

### Example
```
GET /api/reports/monthly-stock-account-movement-details-json?source=pabrik&period=2026-07
```

## Use Cases

### 1. PDF Generation
Nested format lebih mudah untuk mapping ke template PDF karena:
- Hierarchical structure matches PDF sections
- `description_as_printed` siap untuk print
- `source_page` untuk pagination

### 2. Grouped Display
Frontend dapat render grouped table:
```
▼ M - SPARE PART - MECHANICAL (45 items)
  ├── MO04022 - Pisau potong rumput 16" (PCS)
  ├── MO04023 - ...
  └── ...
```

### 3. Report Export
Nested format lebih compact untuk export karena:
- Product type tidak di-repetisi per item
- Metadata централизованный
- Movements dalam object terpisah

## Navigation

**Previous:** [11-Validation Rules](./11-VALIDATION-RULES.md)
**Back to:** [README](./README.md)
