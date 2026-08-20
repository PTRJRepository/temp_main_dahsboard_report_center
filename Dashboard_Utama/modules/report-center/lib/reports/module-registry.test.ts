import assert from 'node:assert/strict'
import {
  REPORT_GLOBAL_MODULES,
  REPORT_GLOBAL_MODULE_IDS,
  getReportModuleConfig,
  getReportSubmoduleConfig,
  normalizeReportModuleId,
  validateReportModuleRegistry,
} from './module-registry'

assert.deepEqual(REPORT_GLOBAL_MODULE_IDS, [
  'procurement',
  'payroll',
  'human-resources',
  'financial',
  'budget',
])

assert.equal(validateReportModuleRegistry().valid, true)
assert.deepEqual(validateReportModuleRegistry().issues, [])

assert.equal(getReportModuleConfig('procurement')?.permissionKey, 'reports')
assert.equal(getReportModuleConfig('payroll')?.permissionKey, 'payroll')
assert.equal(getReportModuleConfig('human-resources')?.permissionKey, 'reports')

assert.equal(normalizeReportModuleId('hr'), 'human-resources')
assert.equal(normalizeReportModuleId('payroll-report'), 'payroll')
assert.equal(normalizeReportModuleId('inventory'), 'procurement')

assert.equal(getReportSubmoduleConfig('procurement', 'inventory')?.availability, 'live')
assert.equal(getReportSubmoduleConfig('procurement', 'inventory')?.name, 'Inventory')
assert.equal(getReportSubmoduleConfig('procurement', 'stock-gudang')?.name, 'Inventory: Gudang')
assert.equal(getReportSubmoduleConfig('procurement', 'stock-workshop')?.name, 'Inventory: Workshop/Mesin')
assert.equal(getReportSubmoduleConfig('payroll', 'wage-register')?.availability, 'preview')
assert.equal(getReportModuleConfig('human-resources')?.submodules.some((submodule) => submodule.id === 'payroll'), false)

const routeSet = new Set(REPORT_GLOBAL_MODULES.map((module) => module.route))
assert.equal(routeSet.size, REPORT_GLOBAL_MODULES.length)

console.info('module-registry tests passed')
