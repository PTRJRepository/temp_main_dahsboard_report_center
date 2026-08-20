import assert from 'node:assert/strict'
import { liveInventoryReports } from './inventory/config'
import { intelligenceModules } from './intelligence'
import { getModulePanel } from './module-panel'

const panel = getModulePanel('procurement', 'estate')

assert.equal(panel?.module.id, 'procurement')
assert.equal(panel?.reports.length, liveInventoryReports.length)
assert.equal(panel?.reports[0]?.href, `/report-center/inventory/${liveInventoryReports[0].id}?source=estate`)
assert.equal(panel?.subModules[0]?.name, 'Inventory')
assert.equal(panel?.subModules[0]?.href, '/report-center/procurement?stockGroup=inventory&source=estate')
assert.equal(panel?.subModules.some((submodule) => submodule.id === 'procurement-process'), true)
assert.equal(panel?.subModules.find((submodule) => submodule.id === 'stock-gudang')?.name, 'Inventory: Gudang')
assert.equal(panel?.subModules.find((submodule) => submodule.id === 'stock-workshop')?.name, 'Inventory: Workshop/Mesin')
assert.equal(panel?.subModules.find((submodule) => submodule.id === 'stock-workshop')?.href, '/report-center/procurement?stockGroup=workshop&source=estate')
assert.equal(getModulePanel(null, 'estate'), null)
assert.equal(getModulePanel('payroll', 'estate')?.module.id, 'payroll')
assert.equal(getModulePanel('payroll', 'estate')?.subModules[0]?.name, 'Payroll Run')
assert.equal(getModulePanel('human-resources', 'estate')?.subModules.some((submodule) => submodule.id === 'payroll'), false)
assert.deepEqual(
  intelligenceModules.map((module) => module.route),
  ['/report-center/procurement', '/report-center/payroll', '/report-center/financial', '/report-center/human-resources', '/report-center/budget'],
)

console.log('module panel links ok')
