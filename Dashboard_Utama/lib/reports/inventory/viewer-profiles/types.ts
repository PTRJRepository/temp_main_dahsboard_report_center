import type { ReportFilterInput } from '@/lib/reports/report-filtering'
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
  monthlyStockMovementKpis: (payload: ReportPayload, filters?: import('@/lib/reports/report-filtering').ReportFilterInput, tableGroupField?: string) => ReportKpiCard[]
  toNumber: (value: unknown) => number
}
