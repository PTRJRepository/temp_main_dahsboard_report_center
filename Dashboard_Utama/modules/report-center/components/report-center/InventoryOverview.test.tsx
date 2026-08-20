import assert from 'node:assert/strict'
import { inventoryKpiValue, inventoryMovementBreakdowns } from './InventoryOverview'

type InventoryKpiPayload = Parameters<typeof inventoryKpiValue>[0]

const pabrikMovementPayload = {
  summary: {
    total_amount: 40861813700.41138,
    total_item: 7756,
    total_quantity: 149669.04,
    total_location: 1,
  },
  chart: [],
  metadata: {},
} satisfies InventoryKpiPayload

assert.equal(
  inventoryKpiValue(pabrikMovementPayload, 'total-valuation', ['total_amount', 'TotalAssetAmount']),
  40861813700.41138,
)
assert.equal(inventoryKpiValue(pabrikMovementPayload, 'unique-item-count', ['total_item', 'TotalItem']), 7756)
assert.equal(inventoryKpiValue(pabrikMovementPayload, 'total-quantity', ['total_quantity', 'TotalQty']), 149669.04)
assert.equal(inventoryKpiValue(pabrikMovementPayload, 'location-count', ['total_location', 'TotalGudang']), 1)

const analyticsPayload = {
  ...pabrikMovementPayload,
  analytics: {
    kpis: [
      {
        id: 'total-valuation',
        label: 'Total valuasi',
        value: 99,
        format: 'currency',
        scope: 'full-scope',
      },
    ],
    breakdowns: [],
  },
} satisfies InventoryKpiPayload

assert.equal(inventoryKpiValue(analyticsPayload, 'total-valuation', ['total_amount']), 99)

const locationChartPayload = {
  summary: {
    FastMovingItem: 2,
    FastMovingAmount: 1000,
    DeadMovementItem: 1,
    DeadMovementAmount: 2500,
  },
  chart: [
    { Label: 'PTRJ', TotalAmount: 999999 },
  ],
  metadata: {},
} satisfies InventoryKpiPayload

const movementBreakdowns = inventoryMovementBreakdowns(locationChartPayload)
assert.deepEqual(movementBreakdowns.map((breakdown) => breakdown.label), ['Fast Moving', 'Dead Stock'])
assert.equal(movementBreakdowns.some((breakdown) => breakdown.label === 'PTRJ'), false)

console.info('inventory overview KPI fallback tests passed')
