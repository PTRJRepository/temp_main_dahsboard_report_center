import assert from 'node:assert/strict'
import {
  buildReportTableGroups,
  buildReportTableRows,
  buildReportSummaryTotals,
  buildReportDetailWindowMetadata,
  compactReportPayloadForAi,
  formatInventoryQuantityBreakdown,
  mergeReportFilterAction,
  normalizeReportTableWindow,
  selectSubtotalColumns,
  type DbRow,
} from './report-detail-performance'
import { buildMovementCategoryBalancedRows } from './movement-category'

const rows: DbRow[] = [
  { id: 'A-1', group: 'A', item: 'Bearing', Qty: 2, Amount: 100, unit_cost: 50 },
  { id: 'A-2', group: 'A', item: 'Oil', Qty: 3, Amount: 150, unit_cost: 50 },
  { id: 'B-1', group: 'B', item: 'Seal', Qty: 4, Amount: 200, unit_cost: 50 },
]

const subtotalColumns = selectSubtotalColumns(['item', 'Qty', 'Amount', 'unit_cost'], rows)
assert.deepEqual(subtotalColumns, ['Qty', 'Amount'])

const groups = buildReportTableGroups(rows, 'group', ['item', 'Qty', 'Amount', 'unit_cost'], subtotalColumns)
assert.equal(groups.length, 2)
assert.equal(groups[0].label, 'A')
assert.equal(groups[0].totals.Qty, 5)
assert.equal(groups[0].totals.Amount, 250)
assert.deepEqual(groups[0].subtotalColumns, ['Qty', 'Amount'])

const ungrouped = buildReportTableRows({
  grouped: false,
  groups: [],
  pageRows: rows.slice(0, 2),
  page: 1,
  expandedRows: { 'A-1': true },
  getRowKey: (row, fallback) => String(row.id ?? fallback),
})
assert.deepEqual(ungrouped.map((row) => row.type), ['data', 'detail', 'data'])

const grouped = buildReportTableRows({
  grouped: true,
  groups,
  pageRows: [],
  page: 1,
  collapsedGroups: { 'group:A': true },
  expandedRows: { 'B-1': true },
  getRowKey: (row, fallback) => String(row.id ?? fallback),
})
assert.deepEqual(grouped.map((row) => row.type), [
  'group-header',
  'group-subtotal',
  'group-header',
  'data',
  'detail',
  'group-subtotal',
])

const compact = compactReportPayloadForAi({
  rows,
  columns: ['id', 'group', 'item', 'Qty', 'Amount', 'unit_cost'],
  chart: rows,
  summary: { total: 3 },
  metadata: { reportId: 'test' },
}, {
  sampleRows: 2,
  maxColumns: 3,
})
assert.equal(compact.rows?.length, 2)
assert.deepEqual(compact.columns, ['id', 'group', 'item'])
assert.deepEqual(Object.keys(compact.rows?.[0] ?? {}), ['id', 'group', 'item'])
assert.equal(compact.chart?.length, 0)
const compactMetadata = compact.metadata as DbRow
assert.equal(compactMetadata.aiPayloadCompacted, true)
assert.equal(compactMetadata.aiOriginalRows, 3)

const windowed = normalizeReportTableWindow({ totalRows: 1234, filteredRows: 1234, maxLoadedRows: 500, windowed: true }, 100, 100)
assert.equal(windowed.totalRows, 1234)
assert.equal(windowed.reachableRows, 500)
assert.equal(windowed.pageCount, 5)
assert.equal(windowed.windowed, true)

const empty = normalizeReportTableWindow(undefined, 0, 100)
assert.equal(empty.totalRows, 0)
assert.equal(empty.pageCount, 1)

const detailWindow = buildReportDetailWindowMetadata({
  metadata: { totalRows: 200, filteredRows: 120, maxLoadedRows: 50, windowed: true },
  returnedRows: 25,
  pageSize: 25,
  page: 2,
  strategy: 'window',
  reason: 'bounded-detail-window',
})
assert.equal(detailWindow.totalRows, 200)
assert.equal(detailWindow.filteredRows, 120)
assert.equal(detailWindow.returnedRows, 25)
assert.equal(detailWindow.reachableRows, 50)
assert.equal(detailWindow.partial, true)
assert.equal(detailWindow.strategy, 'window')

const movementRows: DbRow[] = [
  { id: 'dead-1', MovementCategory: 'Dead Stock', StockIssueMovementCount: 0, AmountItem: 500 },
  { id: 'dead-2', MovementCategory: 'Dead Stock', StockIssueMovementCount: 0, AmountItem: 400 },
  { id: 'fast-1', MovementCategory: 'Fast Moving', StockIssueMovementCount: 8, AmountItem: 300 },
  { id: 'slow-1', MovementCategory: 'Slow Moving', StockIssueMovementCount: 1, AmountItem: 200 },
  { id: 'stale-1', MovementCategory: 'Stale', StockIssueMovementCount: 0, AmountItem: 100 },
]
const balancedMovementRows = buildMovementCategoryBalancedRows(
  movementRows,
  4,
  (row) => row.MovementCategory,
  (left, right) => Number(right.AmountItem) - Number(left.AmountItem),
)
assert.deepEqual(balancedMovementRows.map((row) => row.MovementCategory), [
  'Fast Moving',
  'Slow Moving',
  'Dead Stock',
  'Stale',
])

const movementGroups = buildReportTableGroups(
  balancedMovementRows,
  'MovementCategory',
  ['MovementCategory', 'StockIssueMovementCount', 'AmountItem'],
  ['StockIssueMovementCount', 'AmountItem'],
)
assert.deepEqual(movementGroups.map((group) => group.label), ['Fast Moving', 'Slow Moving', 'Dead Stock', 'Stale'])
assert.equal(movementGroups.length, 4)

const summaryTotals = buildReportSummaryTotals(
  {
    TotalAssetAmount: 1000,
    total_quantity: 60,
    TotalStockIssueMovementCount: 12,
  },
  [
    { AmountItem: 10, QtyOnHandHold: 2, StockIssueMovementCount: 1 },
    { AmountItem: 20, QtyOnHandHold: 3, StockIssueMovementCount: 2 },
  ],
  ['AmountItem', 'QtyOnHandHold', 'StockIssueMovementCount'],
  { fallbackToRows: false },
)
assert.deepEqual(summaryTotals, {
  AmountItem: 1000,
  QtyOnHandHold: 60,
  StockIssueMovementCount: 12,
})
assert.deepEqual(
  buildReportSummaryTotals(
    { TotalAmount: 2600, TotalQty: 190 },
    [{ Amount: 1200, QtyFuel: 80 }],
    ['Amount', 'QtyFuel'],
    { fallbackToRows: false },
  ),
  { Amount: 2600, QtyFuel: 190 },
)
// Scoped filter: preferRows must use filtered row sums, not global summary.
assert.deepEqual(
  buildReportSummaryTotals(
    { TotalAssetAmount: 9999, total_quantity: 999 },
    [
      { AmountItem: 100, QtyOnHandHold: 4 },
      { AmountItem: 50, QtyOnHandHold: 2 },
    ],
    ['AmountItem', 'QtyOnHandHold'],
    { preferRows: true },
  ),
  { AmountItem: 150, QtyOnHandHold: 6 },
)
assert.equal(formatInventoryQuantityBreakdown({ QtyOnHandHold: 6, QtyOnHand: 4, QtyOnHold: 2 }), '6(4+2)')
assert.equal(formatInventoryQuantityBreakdown({ total_quantity: 7, quantity_on_hand: 7, quantity_on_hold: 0 }), '7(7+0)')

const scopedMovementFilter = mergeReportFilterAction(
  { period: '2026-07', stale: 'semua', groupBy: 'MovementCategory' },
  {
    type: 'set-filter',
    semanticDimensionId: 'movement-category',
    field: 'MovementCategory',
    value: 'Slow Moving',
  },
)
assert.equal(scopedMovementFilter.period, '2026-07')
assert.equal(scopedMovementFilter.stale, 'semua')
assert.equal(scopedMovementFilter.groupBy, 'MovementCategory')
assert.equal(scopedMovementFilter.movementCategory, 'Slow Moving')

const scopedStockAnalysisFilter = mergeReportFilterAction(
  {
    period: '2026-07',
    movementCategory: 'Slow Moving',
    columnFilters: [{ field: 'Gudang', operator: 'equals', value: 'ARA' }],
  },
  {
    type: 'set-filter',
    semanticDimensionId: 'stock-analysis',
    field: 'StockAnalysisCode',
    value: 'DEADS',
  },
)
assert.equal(scopedStockAnalysisFilter.movementCategory, 'Slow Moving')
assert.deepEqual(scopedStockAnalysisFilter.columnFilters, [
  { field: 'Gudang', operator: 'equals', value: 'ARA', valueTo: undefined },
  { field: 'StockAnalysisCode', operator: 'equals', value: 'DEADS', valueTo: undefined },
])
assert.equal(scopedStockAnalysisFilter.stockAnalysis, undefined)

const clearedFilter = mergeReportFilterAction(scopedStockAnalysisFilter, { type: 'clear-filter' })
assert.equal(clearedFilter.period, undefined)
assert.equal(clearedFilter.movementCategory, undefined)
assert.equal(clearedFilter.columnFilters, undefined)

console.log('report-detail-performance tests passed')
