import assert from 'node:assert/strict'
import {
  INVENTORY_METRICS,
  getInventoryMetric,
  metricHelpText,
  TOTAL_ISSUE,
  TOTAL_VALUATION,
  MOVEMENT_CATEGORY_VALUE,
  INVENTORY_RETURN,
} from './metric-glossary'

// Lookup by id
assert.equal(getInventoryMetric('total-issue')?.id, 'total-issue')
assert.equal(getInventoryMetric('TOTAL-ISSUE')?.id, 'total-issue', 'lookup case-insensitive')
assert.equal(getInventoryMetric('total_issue')?.id, 'total-issue', 'lookup toleran underscore')
assert.equal(getInventoryMetric('tidak-ada'), undefined)

// Alias
assert.equal(getInventoryMetric('total-usage')?.id, 'total-issue', 'alias Total Usage → total-issue')
assert.equal(getInventoryMetric('issue-amount')?.id, 'total-issue')
assert.equal(getInventoryMetric('pengeluaran')?.id, 'total-issue')
assert.equal(getInventoryMetric('issued-total')?.id, 'total-issue')

// Definisi kanonik
assert.equal(TOTAL_ISSUE.label, 'Total Issue')
assert.ok(TOTAL_ISSUE.aka.includes('Total Usage'), 'Total Usage tercat sebagai alias')
assert.ok(TOTAL_ISSUE.formula.includes('IN_FUELISSUE'), 'fuel masuk universe issue')
assert.ok(TOTAL_ISSUE.formula.includes('WS_JOBSTOCK'), 'job stock masuk universe issue')
assert.ok(TOTAL_ISSUE.formula.includes('TT=1'), 'hanya TT=1 (issue), return TT=2 dikecualikan')

assert.ok(TOTAL_ISSUE.notEquals.length >= 2, 'total-issue punya daftar notEquals')
assert.ok(
  TOTAL_ISSUE.notEquals.some((s) => s.includes('Total Valuasi')),
  'total-issue explicitly ≠ Total Valuasi',
)
assert.ok(
  TOTAL_ISSUE.notEquals.some((s) => s.includes('Return')),
  'total-issue explicitly exclude Return',
)

assert.equal(TOTAL_VALUATION.id, 'total-valuation')
assert.ok(TOTAL_VALUATION.formula.includes('QtyOnHand'))
assert.ok(TOTAL_VALUATION.source.includes('IN_MTHENDITEM'))

assert.equal(MOVEMENT_CATEGORY_VALUE.id, 'movement-category-value')
assert.ok(
  MOVEMENT_CATEGORY_VALUE.description.includes('Total Issue'),
  'category value jelas beda dari Total Issue',
)

assert.equal(INVENTORY_RETURN.module, 'inventory')
assert.ok(INVENTORY_RETURN.description.includes('IN_STOCKRTN'))
assert.ok(INVENTORY_RETURN.description.includes('PU_GOODSRET'), 'jelas bukan retur supplier')

// Help text memuat label + formula + sumber
const help = metricHelpText('total-issue')
assert.ok(help.includes('Total Issue'), 'help memuat label')
assert.ok(help.includes('Formula:'), 'help memuat formula')
assert.ok(help.includes('Sumber:'), 'help memuat sumber')
assert.equal(metricHelpText('tidak-ada'), '')

// Semua entri valid
for (const entry of INVENTORY_METRICS) {
  assert.ok(entry.id.length > 2, `id valid: ${entry.id}`)
  assert.ok(entry.label.length > 0, `label valid: ${entry.id}`)
  assert.ok(entry.description.length > 10, `description valid: ${entry.id}`)
  assert.ok(entry.source.length > 0, `source valid: ${entry.id}`)
}

// Tidak ada id duplikat
const ids = INVENTORY_METRICS.map((m) => m.id)
assert.equal(new Set(ids).size, ids.length, 'tidak ada id duplikat')

console.info('metric glossary tests passed')
