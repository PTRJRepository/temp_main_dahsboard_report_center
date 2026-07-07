import assert from 'node:assert/strict'
import { liveInventoryReports } from './inventory/config'
import { intelligenceModules } from './intelligence'
import { getModulePanel } from './module-panel'

const panel = getModulePanel('procurement', 'estate')

assert.equal(panel?.module.id, 'procurement')
assert.equal(panel?.reports.length, liveInventoryReports.length)
assert.equal(panel?.reports[0]?.href, `/report-center/inventory/${liveInventoryReports[0].id}?source=estate`)
assert.equal(panel?.subModules[0]?.name, 'Inventory')
assert.equal(panel?.subModules[0]?.href, '/report-center/inventory?source=estate')
assert.equal(getModulePanel(null, 'estate'), null)
assert.deepEqual(
  intelligenceModules.map((module) => module.route),
  ['/report-center/procurement', '/report-center/financial', '/report-center/human-resources', '/report-center/budget'],
)

console.log('module panel links ok')
