import assert from 'node:assert/strict'
import { buildAiEvidenceBundle, formatAiEvidenceForPrompt } from './ai-evidence'
import type { ReportKpiEntry } from './report-experience'

const kpis: ReportKpiEntry[] = [
  {
    id: 'total-valuation',
    label: 'Total Valuasi',
    value: 1250000,
    format: 'currency',
    scope: 'full-scope',
    evidence: { source: 'server-aggregate', valuePath: 'summary.TotalAmount', totalRows: 100 },
  },
]

const evidence = buildAiEvidenceBundle({
  title: 'Inventory Movement',
  description: 'Analisis movement barang',
  rows: Array.from({ length: 30 }, (_, index) => ({
    ItemCode: `ITM-${index}`,
    ItemName: `Bearing ${index}`,
    Amount: index * 100,
    Authorization: 'Bearer hidden',
    sqlText: 'select * from private_table',
  })),
  columns: ['ItemCode', 'ItemName', 'Amount', 'Authorization', 'sqlText'],
  summary: { TotalAmount: 1250000, TotalRows: 30 },
  metadata: {
    totalRows: 30,
    filteredRows: 24,
    returnedRows: 12,
    detailWindow: { totalRows: 30, filteredRows: 24, returnedRows: 12, partial: true },
    dataSource: 'inventory-live',
  },
  analytics: {
    kpis,
    breakdowns: [
      {
        id: 'movement-fast',
        label: 'Fast Moving',
        value: 10,
        format: 'number',
        scope: 'full-scope',
        evidence: { source: 'server-aggregate', valuePath: 'breakdowns.movement.fast' },
      },
    ],
  },
}, {
  filters: { period: '2026-07', token: 'hidden' },
  reportCode: 'all-stock-movement-analysis',
  question: 'Barang mana yang paling cepat bergerak?',
  sampleRows: 8,
  maxColumns: 4,
})

assert.equal(evidence.report.code, 'all-stock-movement-analysis')
assert.equal(evidence.scope.totalRows, 30)
assert.equal(evidence.scope.filteredRows, 24)
assert.equal(evidence.scope.returnedRows, 12)
assert.equal(evidence.scope.partial, true)
assert.equal(evidence.sampleRows.length, 8)
assert.equal(evidence.fieldDefinitions.length, 3)
assert.deepEqual(Object.keys(evidence.sampleRows[0]), ['ItemCode', 'ItemName', 'Amount'])
assert.equal(evidence.activeFilters.period, '2026-07')
assert.equal(evidence.activeFilters.token, undefined)
assert.equal(evidence.kpis[0].scope, 'full-scope')
assert.equal(evidence.breakdowns[0].label, 'Fast Moving')

const prompt = formatAiEvidenceForPrompt(evidence)
assert.equal(prompt.includes('Bearer hidden'), false)
assert.equal(prompt.includes('private_table'), false)
assert.equal(prompt.includes('Total Valuasi'), true)

const fallback = buildAiEvidenceBundle({
  rows: [{ a: 1, b: 'text' }],
  columns: ['a', 'b'],
  summary: { TotalRows: 1 },
})
assert.equal(fallback.kpis[0].id, 'TotalRows')
assert.equal(fallback.scope.sampleRows, 1)

console.info('ai-evidence tests passed')
