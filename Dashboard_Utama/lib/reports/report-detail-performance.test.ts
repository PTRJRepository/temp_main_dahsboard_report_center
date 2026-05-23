import assert from 'node:assert/strict'
import {
  buildReportTableGroups,
  buildReportTableRows,
  compactReportPayloadForAi,
  normalizeReportTableWindow,
  selectSubtotalColumns,
  type DbRow,
} from './report-detail-performance'

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

console.log('report-detail-performance tests passed')
