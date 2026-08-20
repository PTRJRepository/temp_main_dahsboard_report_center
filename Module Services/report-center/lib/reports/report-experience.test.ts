import assert from 'node:assert/strict'
import {
  defineReportExperienceProfile,
  hasReportCapability,
  isReportDetailWindowPartial,
  type ReportBreakdownEntry,
  type ReportKpiEntry,
} from './report-experience'

const profile = defineReportExperienceProfile({
  id: 'inventory-movement-cockpit',
  title: 'Inventory Movement Cockpit',
  globalModule: 'procurement',
  moduleLabel: 'Procurement',
  submodule: 'inventory',
  submoduleLabel: 'Inventory',
  capabilities: ['semantic-filters', 'interactive-kpis', 'breakdowns', 'detail-window', 'ai-insight'],
  primaryDimensions: ['item-code', 'location', 'movement-category'],
  defaultGroupBy: 'movement-category',
  defaultDetailWindowStrategy: 'balanced',
})

assert.equal(profile.globalModule, 'procurement')
assert.equal(hasReportCapability(profile, 'interactive-kpis'), true)
assert.equal(hasReportCapability(profile, 'export'), false)

const kpi: ReportKpiEntry = {
  id: 'total-stock-value',
  label: 'Total Stock Value',
  value: 1200000,
  unit: 'IDR',
  format: 'currency',
  scope: 'full-scope',
  filterAction: {
    type: 'set-filter',
    semanticDimensionId: 'movement-category',
    field: 'MovementCategory',
    value: 'Dead Stock',
  },
  evidence: {
    source: 'server-aggregate',
    valuePath: 'summary.TotalAmount',
    totalRows: 100,
  },
}

assert.equal(kpi.filterAction?.semanticDimensionId, 'movement-category')
assert.equal(kpi.evidence.source, 'server-aggregate')

const breakdown: ReportBreakdownEntry = {
  id: 'movement-category-value',
  label: 'Value by Movement Category',
  dimensionId: 'movement-category',
  value: 300000,
  format: 'currency',
  scope: 'filtered',
  filterAction: {
    type: 'set-filter',
    semanticDimensionId: 'movement-category',
    field: 'MovementCategory',
    value: 'Fast Moving',
  },
  evidence: {
    source: 'chart',
    valuePath: 'chart[0].Amount',
    rowCount: 1,
  },
}

assert.equal(breakdown.dimensionId, 'movement-category')
assert.equal(breakdown.scope, 'filtered')

assert.equal(isReportDetailWindowPartial({
  filteredRows: 80,
  returnedRows: 25,
  partial: false,
}), true)
assert.equal(isReportDetailWindowPartial({
  filteredRows: 80,
  returnedRows: 80,
  partial: false,
}), false)

console.info('report-experience tests passed')
