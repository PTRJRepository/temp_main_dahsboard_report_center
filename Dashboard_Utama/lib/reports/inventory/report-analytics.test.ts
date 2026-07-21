import assert from 'node:assert/strict'
import { attachInventoryAnalytics, validateInventoryAnalyticsPayload } from './analytics-contract'
import { buildInventoryReportAnalytics } from './report-analytics'

const payload = {
  title: 'Inventory movement sample',
  description: 'Sample report with computed movement and stored taxonomy fields.',
  rows: [
    {
      KodeBarang: 'A001',
      NamaBarang: 'Bearing',
      MovementCategory: 'Fast Moving',
      ProductTypeCode: 'SP',
      StockAnalysisCode: 'MEMOV',
      Gudang: 'PTRJ',
      AmountItem: 1000,
      QuantityClosing: 4,
      StockIssueMovementCount: 8,
    },
    {
      KodeBarang: 'A002',
      NamaBarang: 'Seal',
      MovementCategory: 'Dead Stock',
      ProductTypeCode: 'SP',
      StockAnalysisCode: 'DEADS',
      Gudang: 'PTRJ',
      AmountItem: 500,
      QuantityClosing: 1,
      StockIssueMovementCount: 0,
    },
  ],
  columns: [
    'KodeBarang',
    'NamaBarang',
    'MovementCategory',
    'ProductTypeCode',
    'StockAnalysisCode',
    'Gudang',
    'AmountItem',
    'QuantityClosing',
    'StockIssueMovementCount',
  ],
  summary: {
    TotalAmount: 1500,
    TotalItem: 2,
    TotalQty: 5,
    TotalStockIssueMovementCount: 8,
    TotalGudang: 1,
  },
  chart: [
    {
      MovementCategory: 'Fast Moving',
      AssetAmountRealTime: 1000,
      TotalItem: 1,
    },
    {
      MovementCategory: 'Dead Stock',
      AssetAmountRealTime: 500,
      TotalItem: 1,
    },
  ],
  metadata: {
    reportId: 'all-stock-movement-analysis',
    totalRows: 2,
    filteredRows: 2,
    returnedRows: 2,
    loadedRows: 2,
    maxLoadedRows: 2,
    totalPages: 1,
    paginated: false,
  },
}

const analytics = buildInventoryReportAnalytics(payload, {
  reportId: 'all-stock-movement-analysis',
  sourcePayload: payload,
})

assert.equal(analytics.kpis.find((kpi) => kpi.id === 'inventory-total-valuation')?.value, 1500)
assert.equal(analytics.kpis.find((kpi) => kpi.id === 'inventory-total-valuation')?.evidence.source, 'summary')
assert.equal(analytics.kpis.find((kpi) => kpi.id === 'inventory-movement-activity')?.value, 8)
assert.equal(analytics.detailWindow?.totalRows, 2)
assert.equal(analytics.detailWindow?.strategy, 'all')
assert.equal(analytics.semanticDimensions.includes('movement-category'), true)
assert.equal(analytics.semanticDimensions.includes('stock-analysis'), true)
assert.equal(analytics.semanticDimensions.includes('product-type'), true)
assert.equal(analytics.semanticDimensions.includes('location'), true)
assert.equal(analytics.semanticDimensions.includes('item-code'), true)

const fastMoving = analytics.breakdowns.find((entry) => entry.id === 'movement-category-fast-moving')
assert.equal(fastMoving?.value, 1000)
assert.equal(fastMoving?.evidence.source, 'chart')
assert.equal(fastMoving?.filterAction?.semanticDimensionId, 'movement-category')
assert.equal(fastMoving?.filterAction?.field, 'MovementCategory')

const deadStock = analytics.breakdowns.find((entry) => entry.id === 'movement-category-dead-stock')
assert.equal(deadStock?.value, 500)
assert.equal(deadStock?.filterAction?.value, 'Dead Stock')

const stockAnalysis = analytics.breakdowns.find((entry) => entry.id === 'stock-analysis-deads')
assert.equal(stockAnalysis?.value, 500)
assert.equal(stockAnalysis?.evidence.source, 'rows')
assert.equal(stockAnalysis?.filterAction?.semanticDimensionId, 'stock-analysis')
assert.equal(stockAnalysis?.filterAction?.field, 'StockAnalysisCode')

const productType = analytics.breakdowns.find((entry) => entry.id === 'product-type-sp')
assert.equal(productType?.value, 1500)
assert.equal(productType?.filterAction?.semanticDimensionId, 'product-type')
assert.equal(productType?.filterAction?.field, 'ProductTypeCode')

const extended = attachInventoryAnalytics(payload, analytics)
assert.equal(validateInventoryAnalyticsPayload(extended).valid, true)
assert.deepEqual(validateInventoryAnalyticsPayload(extended).issues, [])
assert.equal(extended.metadata.analytics?.breakdownIds.includes('movement-category-fast-moving'), true)

console.info('inventory report-analytics tests passed')
