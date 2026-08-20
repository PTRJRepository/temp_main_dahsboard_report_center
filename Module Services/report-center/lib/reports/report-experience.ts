export type ReportGlobalModuleId =
  | 'procurement'
  | 'payroll'
  | 'human-resources'
  | 'financial'
  | 'budget'

export type ReportCapabilityId =
  | 'semantic-filters'
  | 'interactive-kpis'
  | 'breakdowns'
  | 'drill-down'
  | 'detail-window'
  | 'ai-insight'
  | 'natural-language-filter'
  | 'export'

export type ReportValueFormat =
  | 'number'
  | 'currency'
  | 'quantity'
  | 'percentage'
  | 'date'
  | 'text'

export type ReportKpiScope =
  | 'full-scope'
  | 'filtered'
  | 'returned-window'
  | 'sample'

export type ReportFilterActionType =
  | 'set-filter'
  | 'set-column-filter'
  | 'set-group'
  | 'open-detail'
  | 'clear-filter'

export type ReportFilterAction = {
  type: ReportFilterActionType
  label?: string
  field?: string
  semanticDimensionId?: string
  operator?: 'contains' | 'equals' | 'notEquals' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'blank' | 'notBlank'
  value?: string | number | boolean
  valueTo?: string | number | boolean
}

export type ReportEvidenceMetadata = {
  source: 'summary' | 'rows' | 'chart' | 'server-aggregate' | 'metadata' | 'computed'
  valuePath?: string
  rowCount?: number
  totalRows?: number
  notes?: string[]
}

export type ReportKpiEntry = {
  id: string
  label: string
  value: string | number | null
  unit?: string
  format: ReportValueFormat
  scope: ReportKpiScope
  filterAction?: ReportFilterAction
  evidence: ReportEvidenceMetadata
}

export type ReportBreakdownEntry = {
  id: string
  label: string
  dimensionId?: string
  value: string | number | null
  unit?: string
  format?: ReportValueFormat
  scope: ReportKpiScope
  filterAction?: ReportFilterAction
  evidence: ReportEvidenceMetadata
}

export type ReportDetailWindowStrategy =
  | 'all'
  | 'page'
  | 'window'
  | 'balanced'
  | 'sample'

export type ReportDetailWindowMetadata = {
  totalRows: number
  filteredRows: number
  returnedRows: number
  loadedRows: number
  maxLoadedRows: number
  reachableRows: number
  pageCount: number
  strategy: ReportDetailWindowStrategy
  partial: boolean
  page?: number
  pageSize?: number
  reason?: string
}

export type ReportExperienceProfile = {
  id: string
  title: string
  globalModule: ReportGlobalModuleId
  moduleLabel: string
  submodule?: string
  submoduleLabel?: string
  capabilities: ReportCapabilityId[]
  primaryDimensions?: string[]
  defaultGroupBy?: string
  defaultDetailWindowStrategy?: ReportDetailWindowStrategy
}

export function defineReportExperienceProfile<T extends ReportExperienceProfile>(profile: T) {
  return profile
}

export function hasReportCapability(profile: Pick<ReportExperienceProfile, 'capabilities'> | undefined, capability: ReportCapabilityId) {
  return Boolean(profile?.capabilities.includes(capability))
}

export function isReportDetailWindowPartial(window: Pick<ReportDetailWindowMetadata, 'partial' | 'filteredRows' | 'returnedRows'>) {
  return window.partial || window.returnedRows < window.filteredRows
}
