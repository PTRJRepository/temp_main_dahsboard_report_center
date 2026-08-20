/**
 * Ad-hoc asserts for fuel-issue-sql helpers (no test runner dependency).
 * Run: npx tsx lib/reports/inventory/fuel-issue-sql.test.ts
 */
import assert from 'node:assert/strict'
import {
  FUEL_ISSUE_PERIOD_RULE,
  fuelIssueDateRangeFilter,
  fuelIssueDocumentDateExpression,
  fuelIssueSelectedPeriodFilter,
  fuelIssueStatusFilter,
} from './fuel-issue-sql'

const doc = fuelIssueDocumentDateExpression('h')
assert.match(doc, /CreateDate/)
assert.match(doc, /PostDate/)
assert.match(doc, /FuelIssueRefDate/)
assert.match(doc, /1900-01-01/)
// CreateDate harus jadi patokan UTAMA: muncul SEBELUM PostDate di dalam COALESCE.
assert.ok(doc.indexOf('CreateDate') < doc.indexOf('PostDate'), 'CreateDate must come before PostDate (patokan utama)')

assert.match(fuelIssueStatusFilter('h'), /'2'/)
assert.match(fuelIssueStatusFilter('h'), /'6'/)

const jul = fuelIssueSelectedPeriodFilter('h', '2026-07')
assert.match(jul, /2026-07-01/)
assert.match(jul, /2026-08-01/)
assert.equal(fuelIssueSelectedPeriodFilter('h', ''), '')
assert.equal(fuelIssueSelectedPeriodFilter('h', 'bad'), '')

const range = fuelIssueDateRangeFilter('h', '2026-06-01', '2026-07-01')
assert.match(range, /2026-06-01/)
assert.match(range, /2026-07-01/)
assert.equal(fuelIssueDateRangeFilter('h', null, '2026-07-01'), '')

assert.ok(FUEL_ISSUE_PERIOD_RULE.includes('DocDate'))

console.log('fuel-issue-sql tests passed')
