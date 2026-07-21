import assert from 'node:assert/strict'
import {
  buildMovementPeriodMetadata,
  classifyPeriodMovement,
  isValidMovementDate,
  movementSourceForItemType,
  normalizeMovementWindowPreset,
  resolveMovementPeriodScope,
  resolveMovementWindowScope,
} from './movement-period'

const actualScope = resolveMovementPeriodScope({ period: '2026-07', now: new Date('2026-07-19T00:00:00Z') })
assert.equal(actualScope.actualPeriod, '2026-07')
assert.equal(actualScope.accountingPeriod, '2027-04')
assert.equal(actualScope.periodStartInclusive, '2026-07-01')
assert.equal(actualScope.periodEndExclusive, '2026-08-01')
assert.equal(actualScope.timezone, 'Asia/Jakarta')

const accountingScope = resolveMovementPeriodScope({ accYear: 2027, accMonth: 1 })
assert.equal(accountingScope.actualPeriod, '2026-04')
assert.equal(accountingScope.accountingPeriod, '2027-01')
assert.equal(accountingScope.inputMode, 'accounting')

assert.deepEqual(movementSourceForItemType('1'), {
  itemType: '1',
  source: 'STOCK_ISSUE_REGULAR',
  dateField: 'IN_STOCKISSUE.PostDate',
})
assert.equal(movementSourceForItemType('4').source, 'WS_JOBSTOCK')
assert.equal(movementSourceForItemType('4').validTransType, '1')
assert.equal(movementSourceForItemType('9').source, 'UNSUPPORTED')

assert.equal(isValidMovementDate('2026-07-10', actualScope, new Date('2026-07-19T00:00:00Z')), true)
assert.equal(isValidMovementDate('1999-12-31', actualScope, new Date('2026-07-19T00:00:00Z')), false)
assert.equal(isValidMovementDate('2026-08-01', actualScope, new Date('2026-08-02T00:00:00Z')), false)
assert.equal(isValidMovementDate('2026-07-20', actualScope, new Date('2026-07-19T00:00:00Z')), false)

assert.deepEqual(classifyPeriodMovement({
  itemType: '1',
  regularIssueCount: 6,
  workshopIssueCount: 0,
  quantityClosing: 0,
}), {
  source: movementSourceForItemType('1'),
  issueCount: 6,
  category: 'Fast Moving',
})

assert.equal(classifyPeriodMovement({ itemType: '4', regularIssueCount: 8, workshopIssueCount: 1, quantityClosing: 10 }).category, 'Slow Moving')
assert.equal(classifyPeriodMovement({ itemType: '4', workshopIssueCount: 0, quantityClosing: 10 }).category, 'Dead Stock')
assert.equal(classifyPeriodMovement({ itemType: '4', workshopIssueCount: 0, quantityClosing: 0 }).category, 'Stale')

const metadata = buildMovementPeriodMetadata(actualScope)
assert.equal(metadata.classificationVersion, 'movement-category:v4-periodic-window')
assert.equal(metadata.periodScope, 'all-period')
assert.equal(metadata.movementWindow, 'all')
assert.match(String(metadata.movementWindowRule), /All valid stock-issue/)
assert.equal(metadata.contextPeriodStartInclusive, '2026-07-01')
assert.equal(metadata.thresholds.fastMinIssueCount, 6)
assert.equal(metadata.sourceSet.some((source) => source.source === 'WS_JOBSTOCK'), true)

assert.equal(normalizeMovementWindowPreset('3-bulan'), '3m')
assert.equal(normalizeMovementWindowPreset(undefined), 'all')
const allWindow = resolveMovementWindowScope({ movementWindow: 'all', now: new Date('2026-07-19T00:00:00') })
assert.equal(allWindow.startInclusive, '2000-01-01')
assert.equal(allWindow.endExclusive, '2026-07-20')
const three = resolveMovementWindowScope({ movementWindow: '3m', now: new Date('2026-07-19T00:00:00') })
assert.equal(three.startInclusive, '2026-05-01')
assert.equal(three.endExclusive, '2026-07-20')
const custom = resolveMovementWindowScope({
  movementWindow: 'custom',
  dateFrom: '2026-01-01',
  dateTo: '2026-03-15',
  now: new Date('2026-07-19T00:00:00'),
})
assert.equal(custom.startInclusive, '2026-01-01')
assert.equal(custom.endExclusive, '2026-03-16')

console.info('inventory movement-period tests passed')
