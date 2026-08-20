import assert from 'node:assert/strict'
import {
  attachInventoryAnalytics,
  validateInventoryAnalyticsPayload,
  type InventoryAnalyticsContract,
  type InventoryAnalyticsPayload,
} from './analytics-contract'

const payload = {
  title: 'ALL Stock Movement Analysis Real Time',
  description: 'Movement payload',
  rows: [
    { ItemCode: 'A', MovementCategory: 'Fast Moving', StockIssueMovementCount: 8, AmountItem: 1000 },
    { ItemCode: 'B', MovementCategory: 'Dead Stock', StockIssueMovementCount: 0, AmountItem: 500 },
  ],
  columns: ['ItemCode', 'MovementCategory', 'StockIssueMovementCount', 'AmountItem'],
  summary: {
    TotalAmount: 1500,
    FilteredRows: 2,
  },
  chart: [
    { Label: 'Fast Moving', Amount: 1000 },
    { Label: 'Dead Stock', Amount: 500 },
  ],
  metadata: {
    reportId: 'all-stock-movement-analysis',
  },
}

const analytics: InventoryAnalyticsContract = {
  semanticDimensions: ['item-code', 'location', 'movement-category'],
  experienceProfile: {
    id: 'all-stock-movement-analysis',
    globalModule: 'procurement',
    submodule: 'inventory',
    capabilities: ['semantic-filters', 'interactive-kpis', 'breakdowns', 'detail-window'],
  },
  detailWindow: {
    totalRows: 100,
    filteredRows: 40,
    returnedRows: 25,
    loadedRows: 25,
    maxLoadedRows: 50,
    reachableRows: 40,
    pageCount: 2,
    strategy: 'window',
    partial: true,
    page: 1,
    pageSize: 25,
  },
  kpis: [
    {
      id: 'total-stock-value',
      label: 'Total Stock Value',
      value: 1500,
      unit: 'IDR',
      format: 'currency',
      scope: 'full-scope',
      filterAction: {
        type: 'set-filter',
        semanticDimensionId: 'movement-category',
        field: 'MovementCategory',
        value: 'Dead Stock',
      },
      evidence: {
        source: 'server-aggregate',
        valuePath: 'summary.TotalAmount',
        totalRows: 100,
      },
    },
  ],
  breakdowns: [
    {
      id: 'dead-stock-value',
      label: 'Dead Stock Value',
      dimensionId: 'movement-category',
      value: 500,
      unit: 'IDR',
      format: 'currency',
      scope: 'filtered',
      filterAction: {
        type: 'set-filter',
        semanticDimensionId: 'movement-category',
        field: 'MovementCategory',
        value: 'Dead Stock',
      },
      evidence: {
        source: 'chart',
        valuePath: 'chart[1].Amount',
        rowCount: 1,
      },
    },
  ],
}

const extended = attachInventoryAnalytics(payload, analytics)

assert.equal(extended.title, payload.title)
assert.equal(extended.rows, payload.rows)
assert.equal(extended.columns, payload.columns)
assert.equal(extended.summary, payload.summary)
assert.equal(extended.metadata.reportId, 'all-stock-movement-analysis')
assert.deepEqual(extended.metadata.analytics?.kpiIds, ['total-stock-value'])
assert.deepEqual(extended.metadata.semanticDimensions, ['item-code', 'location', 'movement-category'])
assert.equal(extended.metadata.detailWindow?.strategy, 'window')
assert.equal(extended.analytics?.kpis[0].evidence.source, 'server-aggregate')
assert.equal(extended.analytics?.breakdowns[0].filterAction?.semanticDimensionId, 'movement-category')

assert.deepEqual(validateInventoryAnalyticsPayload(extended).issues, [])
assert.equal(validateInventoryAnalyticsPayload(extended).valid, true)

const invalid: InventoryAnalyticsPayload = {
  ...extended,
  analytics: {
    ...analytics,
    kpis: [
      {
        ...analytics.kpis[0],
        id: '',
        value: undefined as unknown as number,
      },
    ],
  },
}

const invalidResult = validateInventoryAnalyticsPayload(invalid)
assert.equal(invalidResult.valid, false)
assert.equal(invalidResult.issues.some((issue) => issue.includes('kpis[0].id')), true)
assert.equal(invalidResult.issues.some((issue) => issue.includes('kpis[0].value')), true)

console.info('inventory analytics-contract tests passed')
