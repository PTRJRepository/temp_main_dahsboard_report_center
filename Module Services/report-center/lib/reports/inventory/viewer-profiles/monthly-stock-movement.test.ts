import assert from 'node:assert/strict'
import { monthlyStockMovementKpis } from './monthly-stock-movement'
import type { ReportPayload } from './types'

const basePayload: ReportPayload = {
  title: 'Monthly stock movement',
  description: 'Smoke',
  rows: [
    { ProductTypeCode: 'PT-01', ProductTypeDescription: 'Product type 1', ClosingAmount: 200, OpeningAmount: 100, TotalItem: 1, MovementCategory: 'Fast Moving' },
  ],
  columns: ['ProductTypeCode', 'ProductTypeDescription', 'OpeningAmount', 'ClosingAmount', 'TotalItem'],
  summary: {
    OpeningAmount: 100,
    OpeningQty: 10,
    ReceivedAmount: 30,
    ReceivedQty: 3,
    ReturnAdviceAmount: 0,
    ReturnAdviceQty: 0,
    TransferredAmount: 0,
    TransferredQty: 0,
    AdjustmentAmount: 0,
    AdjustmentQty: 0,
    LedgerAmount: 40,
    LedgerQty: 4,
    IssuedStationAmount: 20,
    IssuedStationQty: 2,
    IssuedVehicleAmount: 10,
    IssuedVehicleQty: 1,
    IssuedTotalAmount: 0,
    IssuedTotalQty: 7,
    ReturnAmount: 5,
    ReturnQty: 1,
    GoodsReceiveAmount: 15,
    GoodsReceiveQty: 1,
    GoodsReturnAmount: 0,
    GoodsReturnQty: 0,
    DispatchAdvAmount: 0,
    DispatchAdvQty: 0,
    ClosingAmount: 200,
    ClosingQty: 20,
    TotalItem: 5,
    TotalAmount: 200,
  },
  metadata: { actualPeriod: '2026-07', accountingPeriod: '2026-07' },
}

const monthlyCards = monthlyStockMovementKpis(basePayload, { groupBy: 'ProductTypeCode', chartDimension: 'ProductTypeCode' }, 'ProductTypeCode')
const flowLabels = monthlyCards.filter((card) => card.scope === 'flow').map((card) => card.label)
assert.deepEqual(flowLabels, [
  'Opening',
  'Received',
  'Return Advice',
  'Transferred',
  'Adjustment',
  'Issued - Ledger',
  'Issued - Station',
  'Issued - Vehicle',
  'Issued - Total',
  'Purchasing - Return',
  'Purchasing - Goods Receive',
  'Purchasing - Goods Return',
  'Purchasing - Dispatch Advice',
  'Closing',
  'Jumlah Item',
])
assert.equal(monthlyCards[8].value, 70)
assert.ok(monthlyCards.length > flowLabels.length)

const directPayload: ReportPayload = {
  ...basePayload,
  summary: {
    ...basePayload.summary,
    IssuedTotalAmount: 99,
  },
}
const directCards = monthlyStockMovementKpis(directPayload, { groupBy: 'ProductTypeCode' }, 'ProductTypeCode')
assert.equal(directCards[8].value, 99)

const subGroupedCards = monthlyStockMovementKpis(
  {
    ...basePayload,
    chart: [
      { DimensionId: 'product-type', DimensionValue: 'PT-01', Label: 'PT-01', ProductTypeCode: 'PT-01', ProductTypeDescription: 'Product type 1', TotalItem: 4, ClosingAmount: 200 },
    ],
  },
  { groupBy: 'StockAnalysisCode', chartDimension: 'StockAnalysisCode', stockAnalysis: 'DEADS', category: 'DEADS' },
  'StockAnalysisCode',
)
assert.ok(subGroupedCards.some((card) => card.scope === 'sub' && card.groupField === 'ProductTypeCode'))
assert.ok(!subGroupedCards.some((card) => card.groupField === 'StockAnalysisCode'))

console.log('monthly-stock-movement extract ok')
