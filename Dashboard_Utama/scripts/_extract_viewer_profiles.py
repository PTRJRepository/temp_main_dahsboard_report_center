from pathlib import Path

src = Path('app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx')
lines = src.read_text(encoding='utf-8').splitlines(True)

out = Path('lib/reports/inventory/viewer-profiles')
out.mkdir(parents=True, exist_ok=True)

def sl(a: int, b: int) -> str:
    return ''.join(lines[a - 1:b])

types = """import type { ReportFilterInput } from '@/lib/reports/report-filtering'
import type { InventoryAnalyticsContract } from '@/lib/reports/inventory/analytics-contract'
import type { ReportFilterAction } from '@/lib/reports/report-experience'

export type DbRow = Record<string, unknown>

export type ReportPayload = {
  title: string
  description: string
  rows: DbRow[]
  columns: string[]
  summary: DbRow
  chart?: DbRow[]
  metadata: DbRow
  totalRows?: number
  analytics?: InventoryAnalyticsContract
}

export type ReportKpiCard = {
  label: string
  value: unknown
  description: string
  tone: string
  scope?: 'global' | 'flow' | 'breakdown' | 'sub' | 'movement'
  groupField?: string
  groupKey?: string
  flowSection?: string
  metrics?: Array<{ key: string; label: string; value: unknown; sourceTable?: string; sourceField?: string }>
  sourceTable?: string
  sourceField?: string
  simpleSql?: string
  filterAction?: ReportFilterAction
}

export type ReportPreset = {
  label: string
  description: string
  filters: ReportFilterInput
}

export type ReportViewerProfile = {
  reportIds?: Set<string>
  businessColumns?: string[]
  fallbackColumns?: string[]
  technicalColumns?: Set<string>
  tableContextColumns?: string[]
  manualFilterColumns?: string[]
  presets: ReportPreset[]
  kpiPresetByLabel?: Record<string, string>
  preferredGroupColumns: string[]
  loadAllRows?: boolean
  maxInitialColumns?: number
  showAccountingPeriodFilter?: boolean
  naturalPlaceholder: string
  presetTitle: string
  rowDetail: 'generic' | 'movement'
  topRowsTitle: string
  defaultSort?: (columns: string[]) => { column: string; direction: 'asc' | 'desc' } | null
  kpiBuilder: (payload: ReportPayload, filters?: ReportFilterInput) => ReportKpiCard[]
  qualityBuilder: (payload: ReportPayload | null, rows: DbRow[]) => Array<[string, unknown]>
  topRowsBuilder: (rows: DbRow[]) => DbRow[]
}

export type ProfileBuilders = {
  genericKpis: ReportViewerProfile['kpiBuilder']
  genericQualityItems: ReportViewerProfile['qualityBuilder']
  genericTopRows: ReportViewerProfile['topRowsBuilder']
  movementAnalysisKpis: (summary: DbRow, rows: DbRow[], groupBy?: string) => ReportKpiCard[]
  movementAnalysisQualityItems: ReportViewerProfile['qualityBuilder']
  movementAnalysisTopItems: ReportViewerProfile['topRowsBuilder']
  stockAgingKpis: (summary: DbRow, rows: DbRow[]) => ReportKpiCard[]
  stockAgingQualityItems: ReportViewerProfile['qualityBuilder']
  stockAgingTopItems: ReportViewerProfile['topRowsBuilder']
  assetValuationKpis: (summary: DbRow, metadata: DbRow, rows: DbRow[]) => ReportKpiCard[]
  monthlyStockMovementKpis: ReportViewerProfile['kpiBuilder']
  toNumber: (value: unknown) => number
}
"""
(out / 'types.ts').write_text(types, encoding='utf-8')

raw = sl(487, 490) + sl(507, 562) + sl(593, 602) + sl(615, 621) + sl(623, 936)
# Export profile constants so index can re-export them.
raw = raw.replace('\nconst ', '\nexport const ').replace('const STOCK_AGING_REPORT_IDS', 'export const STOCK_AGING_REPORT_IDS', 1)
constants = "import type { ReportPreset } from './types'\n\n" + raw
(out / 'constants.ts').write_text(constants, encoding='utf-8')

body = sl(2084, 2253)
sig_line = lines[2082]
assert 'function getReportViewerProfile' in sig_line, sig_line

get_profile = """import type { ProfileBuilders, ReportViewerProfile } from './types'
import {
  ASSET_VALUATION_REPORT_IDS,
  MONTHLY_CONTEXT_DETAIL_COLUMNS,
  MONTHLY_OFFICIAL_DETAIL_COLUMNS,
  MONTHLY_STOCK_MOVEMENT_REPORT_IDS,
  MOVEMENT_ANALYSIS_REPORT_IDS,
  STOCK_AGING_REPORT_IDS,
  assetValuationBusinessColumns,
  assetValuationTechnicalColumns,
  genericTechnicalColumns,
  movementAnalysisBusinessColumns,
  movementAnalysisTechnicalColumns,
  stockAgingBusinessColumns,
  stockAgingKpiPresetByLabel,
  stockAgingManualFilterColumns,
  stockAgingPresets,
  stockAgingTechnicalColumns,
  stockAgingVisibleColumns,
} from './constants'

export function getReportViewerProfile(reportId: string, builders: ProfileBuilders): ReportViewerProfile {
  const {
    genericKpis,
    genericQualityItems,
    genericTopRows,
    movementAnalysisKpis,
    movementAnalysisQualityItems,
    movementAnalysisTopItems,
    stockAgingKpis,
    stockAgingQualityItems,
    stockAgingTopItems,
    assetValuationKpis,
    monthlyStockMovementKpis,
    toNumber,
  } = builders
""" + body + "\n"
(out / 'get-profile.ts').write_text(get_profile, encoding='utf-8')

pref = sl(2254, 2271).replace(
    'function preferredVisibleColumnsForProfile',
    'export function preferredVisibleColumnsForProfile',
    1,
)
pref_mod = """import type { ReportViewerProfile } from './types'
import { genericTechnicalColumns } from './constants'

""" + pref
(out / 'preferred-columns.ts').write_text(pref_mod, encoding='utf-8')

index = """export type {
  DbRow,
  ProfileBuilders,
  ReportKpiCard,
  ReportPayload,
  ReportPreset,
  ReportViewerProfile,
} from './types'
export {
  ASSET_VALUATION_REPORT_IDS,
  MONTHLY_CONTEXT_DETAIL_COLUMNS,
  MONTHLY_OFFICIAL_DETAIL_COLUMNS,
  MONTHLY_STOCK_MOVEMENT_REPORT_IDS,
  MOVEMENT_ANALYSIS_REPORT_IDS,
  PERIOD_SCOPED_REPORT_IDS,
  STOCK_AGING_REPORT_IDS,
  assetValuationBusinessColumns,
  assetValuationTechnicalColumns,
  genericTechnicalColumns,
  movementAnalysisBusinessColumns,
  movementAnalysisTechnicalColumns,
  stockAgingBusinessColumns,
  stockAgingKpiPresetByLabel,
  stockAgingManualFilterColumns,
  stockAgingPresets,
  stockAgingTechnicalColumns,
  stockAgingVisibleColumns,
} from './constants'
export { getReportViewerProfile } from './get-profile'
export { preferredVisibleColumnsForProfile } from './preferred-columns'
"""
(out / 'index.ts').write_text(index, encoding='utf-8')

test = """import assert from 'node:assert/strict'
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
"""
(out / 'viewer-profiles.test.ts').write_text(test, encoding='utf-8')

print('wrote:')
for p in sorted(out.iterdir()):
    print(' ', p.name, p.stat().st_size)
