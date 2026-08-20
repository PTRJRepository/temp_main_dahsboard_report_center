import assert from 'node:assert/strict'
import {
  getReportViewerProfile,
  preferredVisibleColumnsForProfile,
  MONTHLY_OFFICIAL_DETAIL_COLUMNS,
  type ProfileBuilders,
} from './index'

const builders: ProfileBuilders = {
  genericKpis: () => [],
  genericQualityItems: () => [],
  genericTopRows: (rows) => rows.slice(0, 10),
  movementAnalysisKpis: () => [],
  movementAnalysisQualityItems: () => [],
  movementAnalysisTopItems: (rows) => rows.slice(0, 10),
  stockAgingKpis: () => [],
  stockAgingQualityItems: () => [],
  stockAgingTopItems: (rows) => rows.slice(0, 10),
  assetValuationKpis: () => [],
  monthlyStockMovementKpis: () => [],
  toNumber: (value) => Number(value) || 0,
}

const monthly = getReportViewerProfile('monthly-stock-account-movement-details', builders)
assert.equal(monthly.rowDetail, 'movement')
assert.equal(monthly.maxInitialColumns, 36)
assert.equal(monthly.businessColumns?.[0], 'ItemCode')
assert.equal(monthly.businessColumns?.[1], 'ItemDescription')
assert.equal(monthly.businessColumns?.[2], 'UOM')
assert.equal(monthly.businessColumns?.[3], 'OpeningQty')
assert.equal(monthly.businessColumns?.[4], 'OpeningAmount')
assert.deepEqual(monthly.businessColumns?.slice(0, 5), MONTHLY_OFFICIAL_DETAIL_COLUMNS.slice(0, 5))
assert.ok(!monthly.preferredGroupColumns.includes('StockAnalysisCode'))
assert.equal(monthly.preferredGroupColumns[0], 'ProductTypeCode')

const cols = preferredVisibleColumnsForProfile(monthly, [
  'ItemCode', 'ItemDescription', 'UOM', 'OpeningQty', 'OpeningAmount', 'raw_status', 'MovementCategory',
])
assert.equal(cols[0], 'ItemCode')
assert.ok(cols.includes('OpeningAmount'))

const generic = getReportViewerProfile('unknown-report', builders)
assert.equal(generic.rowDetail, 'generic')
assert.equal(generic.presets.length, 0)

console.log('viewer-profiles smoke ok')
