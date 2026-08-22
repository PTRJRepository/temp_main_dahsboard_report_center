import assert from 'node:assert/strict'
import {
  formatCurrency,
  formatKpiValue,
  formatMetric,
  inferMetricKind,
} from './format'

assert.equal(inferMetricKind('OpeningAmount'), 'currency')
assert.equal(inferMetricKind('ClosingQty'), 'quantity')
assert.equal(inferMetricKind('TotalItem'), 'count')
assert.equal(inferMetricKind('ActualPeriod'), 'period')
assert.equal(inferMetricKind('AccPeriod', 'Acc Period'), 'period')
assert.equal(inferMetricKind('StockIssueEventCount'), 'count')
assert.equal(inferMetricKind('IssuedTotalAmount'), 'currency')
assert.equal(inferMetricKind('FilteredRows'), 'count')

// Period must never become Rp
assert.equal(formatMetric('2025-07', 'ActualPeriod'), '2025-07')
assert.equal(formatKpiValue(202507, 'ActualPeriod', 'Actual Period'), '202507')
assert.equal(formatMetric(0, 'AccPeriod', 'Acc Period'), '0')

// Count / qty never get currency prefix
const qty = formatMetric(12.5, 'ClosingQty')
assert.ok(!qty.includes('Rp'), `qty should not use Rp: ${qty}`)
const count = formatMetric(42, 'TotalItem')
assert.ok(!count.includes('Rp'), `count should not use Rp: ${count}`)

// Currency keeps Rp + 4 decimals
const money = formatCurrency(1000)
assert.ok(money.includes('Rp'), `currency must include Rp: ${money}`)
assert.ok(money.includes('1.000') || money.includes('1000'), money)

// Null / empty
assert.equal(formatMetric(null, 'OpeningAmount'), '-')
assert.equal(formatMetric('', 'ClosingQty'), '-')

console.log('format.test.ts: ok')
