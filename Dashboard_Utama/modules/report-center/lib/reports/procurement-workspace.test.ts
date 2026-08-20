import assert from 'node:assert/strict'
import {
  createProcurementGroupHref,
  createProcurementReportHref,
  getProcurementWorkspace,
  normalizeProcurementStockGroup,
} from './procurement-workspace'

assert.equal(normalizeProcurementStockGroup(undefined), 'inventory')
assert.equal(normalizeProcurementStockGroup('semua'), 'inventory')
assert.equal(normalizeProcurementStockGroup('stock-gudang'), 'gudang')
assert.equal(normalizeProcurementStockGroup('stock-workshop'), 'workshop')
assert.equal(normalizeProcurementStockGroup('proses'), 'process')

assert.equal(
  createProcurementGroupHref('inventory', 'pabrik'),
  '/report-center/procurement?source=pabrik&stockGroup=inventory',
)
assert.equal(
  createProcurementGroupHref('workshop', 'pabrik'),
  '/report-center/procurement?source=pabrik&stockGroup=workshop',
)

const workshopHref = createProcurementReportHref('all-stock-movement-analysis', 'estate', {
  groupBy: 'MovementCategory',
  itemType: 'workshop',
  movementWindow: 'all',
})
assert.equal(workshopHref.startsWith('/report-center/inventory/all-stock-movement-analysis?'), true)
assert.equal(workshopHref.includes('source=estate'), true)
assert.equal(workshopHref.includes('groupBy=MovementCategory'), true)
assert.equal(workshopHref.includes('itemType=workshop'), true)
assert.equal(workshopHref.includes('movementWindow=all'), true)

const processWorkspace = getProcurementWorkspace('estate', 'process')
assert.equal(processWorkspace.activeGroup, 'process')
assert.equal(processWorkspace.groups.find((group) => group.id === 'process')?.active, true)
assert.equal(processWorkspace.activeGroupDetail.reports[0]?.id, 'purchase-request-inventory')
assert.equal(processWorkspace.processStages.length, 6)
assert.equal(processWorkspace.totalProcessReports >= 3, true)

const inventoryWorkspace = getProcurementWorkspace('pabrik')
assert.equal(inventoryWorkspace.activeGroup, 'inventory')
assert.equal(inventoryWorkspace.groups[0]?.id, 'inventory')
assert.equal(inventoryWorkspace.groups.find((group) => group.id === 'inventory')?.active, true)
assert.equal(
  inventoryWorkspace.activeGroupDetail.reports.some((report) => report.id === 'asset-stock-valuasi-listing' && !report.href.includes('itemType=')),
  true,
)
assert.equal(
  inventoryWorkspace.activeGroupDetail.reports.some((report) => report.id === 'all-stock-movement-analysis' && !report.href.includes('itemType=') && report.href.includes('groupBy=MovementCategory') && report.href.includes('movementWindow=all')),
  true,
)

const gudangWorkspace = getProcurementWorkspace('estate', 'gudang')
assert.equal(gudangWorkspace.activeGroupDetail.reports[0]?.href.includes('itemType=gudang'), true)
assert.equal(
  gudangWorkspace.activeGroupDetail.reports.some((report) => report.id === 'all-stock-movement-analysis' && report.href.includes('itemType=gudang') && report.href.includes('groupBy=MovementCategory') && report.href.includes('movementWindow=all')),
  true,
)
assert.equal(
  gudangWorkspace.activeGroupDetail.reports.some((report) => report.id === 'asset-stock-valuasi-listing' && report.href.includes('itemType=gudang')),
  true,
)
assert.equal(
  gudangWorkspace.activeGroupDetail.reports.find((report) => report.id === 'asset-stock-valuasi-listing')?.href.includes('groupBy='),
  false,
)

const workshopWorkspace = getProcurementWorkspace('pabrik', 'workshop')
assert.equal(workshopWorkspace.activeGroupDetail.reports[0]?.id, 'vehicle-running-workshop')
assert.equal(workshopWorkspace.activeGroupDetail.reports.every((report) => report.href.includes('source=pabrik')), true)
assert.equal(
  workshopWorkspace.activeGroupDetail.reports.some((report) => report.id === 'asset-stock-valuasi-listing' && report.href.includes('itemType=workshop')),
  true,
)
assert.equal(
  workshopWorkspace.activeGroupDetail.reports.some((report) => report.id === 'all-stock-movement-analysis' && report.href.includes('itemType=workshop') && report.href.includes('groupBy=MovementCategory') && report.href.includes('movementWindow=all')),
  true,
)
assert.equal(
  workshopWorkspace.activeGroupDetail.reports.find((report) => report.id === 'asset-stock-valuasi-listing')?.href.includes('groupBy='),
  false,
)

console.info('procurement workspace tests passed')
