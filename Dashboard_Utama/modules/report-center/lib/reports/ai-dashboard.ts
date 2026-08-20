export type DbRow = Record<string, unknown>

export type ReportPayload = {
  title?: string
  description?: string
  rows?: DbRow[]
  columns?: string[]
  summary?: DbRow
  chart?: DbRow[]
  metadata?: DbRow
}

export type AiFieldType = 'text' | 'number' | 'category' | 'date'
export type AiFieldRole = 'dimension' | 'metric' | 'action'
export type AiSeverity = 'neutral' | 'info' | 'warning' | 'critical'
export type AiChartType = 'bar' | 'column' | 'donut' | 'line' | 'area' | 'stacked_bar' | 'heatmap' | 'scatter' | 'table'
export type AiFormat = 'number' | 'currency' | 'percentage' | 'text'
export type AiAggregation = 'count' | 'sum' | 'avg' | 'min' | 'max'

export type AiField = {
  name: string
  label: string
  type: AiFieldType
  role: AiFieldRole
  format?: AiFormat
}

export type AiFieldProfile = {
  name: string
  type: AiFieldType
  nullCount: number
  uniqueCount: number
  min?: number
  max?: number
  avg?: number
  topValues?: Array<{ value: string; count: number }>
}

export type AiAnalysisProfile = {
  totalRows: number
  numericFields: string[]
  categoryFields: string[]
  textFields: string[]
  dateFields: string[]
  missingValueFields: string[]
  fieldProfiles: AiFieldProfile[]
}

export type AiAnalysisPayload = {
  report: {
    code: string
    name: string
    description: string
    generatedAt: string
    filters: DbRow
  }
  fields: AiField[]
  profile: AiAnalysisProfile
  summary: DbRow
  groupings: Record<string, DbRow[]>
  sampleRows: DbRow[]
  chart: DbRow[]
}

export type AiKpiCard = {
  id: string
  title: string
  valuePath: string
  format: AiFormat
  suffix?: string
  severity: AiSeverity
  description: string
}

export type AiChartDefinition = {
  id: string
  title: string
  description: string
  type: AiChartType
  priority: number
  dataSource: string
  xField?: string
  yField?: string
  categoryField?: string
  valueField?: string
  seriesField?: string
  aggregation: AiAggregation
  format?: Exclude<AiFormat, 'text'>
  sort?: {
    field: string
    direction: 'asc' | 'desc'
  }
  limit?: number
  config?: AiChartVisualConfig
  data?: DbRow[]
  dataStatus?: 'computed' | 'empty'
  dataNote?: string
  reason: string
  insightRule: string
}

export type AiChartVisualConfig = {
  orientation?: 'horizontal' | 'vertical'
  height?: 'compact' | 'normal' | 'tall'
  colorMode?: 'single' | 'category' | 'severity' | 'gradient'
  colorPalette?: string[]
  showLegend?: boolean
  showValueLabels?: boolean
  showGrid?: boolean
  xAxisLabel?: string
  yAxisLabel?: string
  emptyStateMessage?: string
  threshold?: {
    field: string
    operator: '>' | '>=' | '<' | '<=' | '=' | '!='
    value: number
    label: string
    color: string
  }
  interaction?: {
    clickFilter?: boolean
    highlightOnInsight?: boolean
    exportEnabled?: boolean
  }
}

export type AiInsight = {
  id: string
  severity: Exclude<AiSeverity, 'neutral'>
  title: string
  finding: string
  evidence: {
    source: string
    field: string
    value?: string | number
    metric?: string
  }
  businessImpact: string
  recommendedAction: string
  relatedChartId?: string
}

export type AiPriorityTable = {
  id: string
  title: string
  description: string
  dataSource: 'rows' | 'sampleRows' | 'other'
  columns: string[]
  filters: Array<{
    field: string
    operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'in'
    value: string | number | Array<string | number>
  }>
  sort: Array<{
    field: string
    direction: 'asc' | 'desc'
  }>
  limit: number
}

export type AiRecommendedAction = {
  priority: 'P1' | 'P2' | 'P3'
  action: string
  ownerSuggestion: string
  reason: string
}

export type AiMissingField = {
  field: string
  reason: string
  benefit: string
}

export type AiDashboardDefinition = {
  detectedReportType: string
  dashboardTitle: string
  summary: {
    mainFinding: string
    businessRisk: string
    recommendedFocus: string
  }
  kpiCards: AiKpiCard[]
  charts: AiChartDefinition[]
  insights: AiInsight[]
  priorityTables: AiPriorityTable[]
  recommendedActions: AiRecommendedAction[]
  missingFields: AiMissingField[]
}

export type AiDashboardOptions = {
  maxCharts?: number
  includePriorityTable?: boolean
  includeMissingFields?: boolean
  language?: 'id' | 'en' | string
}

type BuildAnalysisArgs = {
  reportCode: string
  payload: ReportPayload
  filters?: DbRow
}

const numberPattern = /^-?\d+(\.\d+)?$/
const allowedChartTypes = new Set<AiChartType>(['bar', 'column', 'donut', 'line', 'area', 'stacked_bar', 'heatmap', 'scatter', 'table'])
const allowedFormats = new Set<AiFormat>(['number', 'currency', 'percentage', 'text'])
const allowedSeverity = new Set<AiSeverity>(['neutral', 'info', 'warning', 'critical'])
const allowedInsightSeverity = new Set(['info', 'warning', 'critical'])
const allowedAggregations = new Set<AiAggregation>(['count', 'sum', 'avg', 'min', 'max'])

export function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const clean = value.trim().replace(/[^\d.-]/g, '')
    if (!clean || !numberPattern.test(clean)) return 0
    const parsed = Number(clean)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function isBlank(value: unknown) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

function asText(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function looksLikeDate(value: unknown) {
  if (value instanceof Date) return Number.isFinite(value.getTime())
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}/.test(value.trim())) return false
  return !Number.isNaN(new Date(value).getTime())
}

function isCodeLikeField(field: string) {
  return /(code|kode|id$|no$|doc|dokumen|status|level|bucket|category|kategori|gudang|loc|location|supplier|kendaraan|vehicle|blok|block|uom|satuan)/i.test(field)
}

function isCurrencyField(field: string) {
  return /(amount|nilai|value|cost|harga|biaya|valuation|persediaan)/i.test(field)
}

function isQtyField(field: string) {
  return /(qty|quantity|stok|stock|jumlah|baris|rows|count|item|receive|usage|order|saldo)/i.test(field)
}

function labelFromField(field: string) {
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function safeId(value: string) {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

function pascal(value: string) {
  const parts = value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
  return parts.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join('')
}

function collectColumns(payload: ReportPayload) {
  const fields = new Set<string>()
  ;(payload.columns ?? []).forEach((column) => fields.add(column))
  ;[...(payload.rows ?? []).slice(0, 50), ...(payload.chart ?? []).slice(0, 20)].forEach((row) => {
    Object.keys(row).forEach((field) => fields.add(field))
  })
  return [...fields]
}

function inferFieldType(field: string, rows: DbRow[]): AiFieldType {
  const values = rows.map((row) => row[field]).filter((value) => !isBlank(value)).slice(0, 100)
  if (values.length === 0) return 'text'
  if (values.filter(looksLikeDate).length / values.length >= 0.7) return 'date'

  const numericCount = values.filter((value) => {
    if (typeof value === 'number') return Number.isFinite(value)
    if (typeof value !== 'string') return false
    return numberPattern.test(value.trim().replace(/[^\d.-]/g, ''))
  }).length

  if (!isCodeLikeField(field) && numericCount / values.length >= 0.75) return 'number'

  const uniqueCount = new Set(values.map(asText)).size
  if (uniqueCount <= Math.max(12, Math.ceil(values.length * 0.45)) || isCodeLikeField(field)) return 'category'
  return 'text'
}

function inferFieldRole(field: string, type: AiFieldType): AiFieldRole {
  if (/(recommendedaction|action|aksi|recommend|issue|note|catatan)/i.test(field)) return 'action'
  if (type === 'number') return 'metric'
  return 'dimension'
}

function inferFormat(field: string, type: AiFieldType): AiFormat | undefined {
  if (type !== 'number') return undefined
  if (isCurrencyField(field)) return 'currency'
  if (/(percent|percentage|persen|rate|ratio)/i.test(field)) return 'percentage'
  return 'number'
}

export function profileRows(rows: DbRow[], columns: string[]): { fields: AiField[]; profile: AiAnalysisProfile } {
  const fields = columns.map((name) => {
    const type = inferFieldType(name, rows)
    return {
      name,
      label: labelFromField(name),
      type,
      role: inferFieldRole(name, type),
      format: inferFormat(name, type),
    }
  })

  const fieldProfiles: AiFieldProfile[] = fields.map((field) => {
    const values = rows.map((row) => row[field.name])
    const nonBlank = values.filter((value) => !isBlank(value))
    const unique = new Map<string, number>()
    nonBlank.forEach((value) => {
      const key = asText(value)
      unique.set(key, (unique.get(key) ?? 0) + 1)
    })

    const profile: AiFieldProfile = {
      name: field.name,
      type: field.type,
      nullCount: values.length - nonBlank.length,
      uniqueCount: unique.size,
    }

    if (field.type === 'number') {
      const numeric = nonBlank.map(toNumber).filter((value) => Number.isFinite(value))
      if (numeric.length) {
        profile.min = Math.min(...numeric)
        profile.max = Math.max(...numeric)
        profile.avg = numeric.reduce((sum, value) => sum + value, 0) / numeric.length
      }
    }

    if (field.type === 'category' || field.type === 'text') {
      profile.topValues = [...unique.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({ value, count }))
    }

    return profile
  })

  return {
    fields,
    profile: {
      totalRows: rows.length,
      numericFields: fields.filter((field) => field.type === 'number').map((field) => field.name),
      categoryFields: fields.filter((field) => field.type === 'category').map((field) => field.name),
      textFields: fields.filter((field) => field.type === 'text').map((field) => field.name),
      dateFields: fields.filter((field) => field.type === 'date').map((field) => field.name),
      missingValueFields: fieldProfiles.filter((field) => field.nullCount > 0).map((field) => field.name),
      fieldProfiles,
    },
  }
}

function fieldExists(fields: string[], preferred: RegExp) {
  return fields.find((field) => preferred.test(field))
}

function groupingKey(field: string) {
  return `by${pascal(field) || 'Category'}`
}

function summarizeByCategory(rows: DbRow[], categoryField: string, amountField?: string, qtyField?: string, ageField?: string) {
  const map = new Map<string, DbRow>()
  rows.forEach((row) => {
    const label = asText(row[categoryField]) || '(Kosong)'
    const current = map.get(label) ?? { [categoryField]: label, itemCount: 0 }
    current.itemCount = toNumber(current.itemCount) + 1
    if (amountField) current.totalAmount = toNumber(current.totalAmount) + toNumber(row[amountField])
    if (qtyField) current.totalQty = toNumber(current.totalQty) + toNumber(row[qtyField])
    if (ageField) {
      current.totalAgeMonth = toNumber(current.totalAgeMonth) + toNumber(row[ageField])
      current.averageAgeMonth = toNumber(current.totalAgeMonth) / toNumber(current.itemCount)
    }
    map.set(label, current)
  })

  return [...map.values()]
    .map((row) => {
      const { totalAgeMonth: _totalAgeMonth, ...rest } = row
      return rest
    })
    .sort((a, b) => toNumber(b.totalAmount) - toNumber(a.totalAmount) || toNumber(b.itemCount) - toNumber(a.itemCount))
    .slice(0, 30)
}

function summarizeByTwoCategories(rows: DbRow[], firstField: string, secondField: string, amountField?: string) {
  const map = new Map<string, DbRow>()
  rows.forEach((row) => {
    const first = asText(row[firstField]) || '(Kosong)'
    const second = asText(row[secondField]) || '(Kosong)'
    const key = `${first}::${second}`
    const current = map.get(key) ?? { [firstField]: first, [secondField]: second, itemCount: 0 }
    current.itemCount = toNumber(current.itemCount) + 1
    if (amountField) current.totalAmount = toNumber(current.totalAmount) + toNumber(row[amountField])
    map.set(key, current)
  })
  return [...map.values()].sort((a, b) => toNumber(b.totalAmount) - toNumber(a.totalAmount) || toNumber(b.itemCount) - toNumber(a.itemCount)).slice(0, 80)
}

export function buildGroupings(rows: DbRow[], fields: AiField[]) {
  const groupings: Record<string, DbRow[]> = {}
  const numericFields = fields.filter((field) => field.type === 'number').map((field) => field.name)
  const categoryFields = fields.filter((field) => field.type === 'category').map((field) => field.name)
  const amountField = fieldExists(numericFields, /(amount|nilai|value|cost|harga|biaya|valuation|persediaan)/i)
  const qtyField = fieldExists(numericFields, /(qty|quantity|stok|stock|jumlah|receive|usage|order|saldo)/i)
  const ageField = fieldExists(numericFields, /(umur|age|aging|bulan|month)/i)

  const priorityCategories = [
    fieldExists(categoryFields, /agingbucket/i),
    fieldExists(categoryFields, /risklevel/i),
    fieldExists(categoryFields, /loccode|gudang|warehouse|location/i),
    fieldExists(categoryFields, /supplier|vendor/i),
    fieldExists(categoryFields, /jenis|type|doctype|mutasi|status/i),
    fieldExists(categoryFields, /kategori|category|prodcat/i),
    fieldExists(categoryFields, /kendaraan|vehicle|vehcode|unit/i),
    fieldExists(categoryFields, /blok|block|costcenter|acc/i),
  ].filter((field): field is string => Boolean(field))

  ;[...new Set([...priorityCategories, ...categoryFields])].slice(0, 10).forEach((field) => {
    const profileRows = summarizeByCategory(rows, field, amountField, qtyField, ageField)
    if (profileRows.length > 0) groupings[groupingKey(field)] = profileRows
  })

  const locField = fieldExists(categoryFields, /loccode|gudang|warehouse|location/i)
  const agingField = fieldExists(categoryFields, /agingbucket/i)
  const riskField = fieldExists(categoryFields, /risklevel/i)
  if (locField && agingField) groupings[`${groupingKey(locField)}And${pascal(agingField)}`] = summarizeByTwoCategories(rows, locField, agingField, amountField)
  if (locField && riskField) groupings[`${groupingKey(locField)}And${pascal(riskField)}`] = summarizeByTwoCategories(rows, locField, riskField, amountField)

  return groupings
}

export function buildReportAnalysisPayload({ reportCode, payload, filters = {} }: BuildAnalysisArgs): AiAnalysisPayload {
  const rows = payload.rows ?? []
  const chartRows = payload.chart ?? []
  const columns = collectColumns(payload)
  const { fields, profile } = profileRows(rows, columns)
  const summary = {
    totalRows: rows.length,
    ...(payload.summary ?? {}),
  }

  return {
    report: {
      code: reportCode,
      name: payload.title ?? reportCode,
      description: payload.description ?? '',
      generatedAt: new Date().toISOString(),
      filters,
    },
    fields,
    profile,
    summary,
    groupings: buildGroupings(rows, fields),
    sampleRows: rows.slice(0, 20),
    chart: chartRows.slice(0, 50),
  }
}

export function getDataSourceRows(dataSource: string, analysis: AiAnalysisPayload, fullRows?: DbRow[]) {
  const normalized = dataSource.trim()
  if (normalized === 'rows') return fullRows ?? analysis.sampleRows
  if (normalized === 'sampleRows') return analysis.sampleRows
  if (normalized === 'chart') return analysis.chart
  if (normalized === 'summary') return [analysis.summary]
  const groupingName = normalized.replace(/^groupings\./, '')
  return analysis.groupings[groupingName] ?? []
}

function dataSourceFields(dataSource: string, analysis: AiAnalysisPayload) {
  if (dataSource === 'rows' || dataSource === 'sampleRows') return analysis.fields.map((field) => field.name)
  if (dataSource === 'summary') return Object.keys(analysis.summary)
  if (dataSource === 'chart') return analysis.chart[0] ? Object.keys(analysis.chart[0]) : []
  const groupingName = dataSource.replace(/^groupings\./, '')
  const rows = analysis.groupings[groupingName] ?? []
  return rows[0] ? Object.keys(rows[0]) : []
}

function normalizeDataSource(dataSource: unknown, analysis: AiAnalysisPayload) {
  const raw = typeof dataSource === 'string' && dataSource.trim() ? dataSource.trim() : 'sampleRows'
  if (raw === 'rows' || raw === 'sampleRows' || raw === 'chart' || raw === 'summary') return raw
  const groupingName = raw.replace(/^groupings\./, '')
  if (analysis.groupings[groupingName]) return `groupings.${groupingName}`
  return 'sampleRows'
}

function firstValidField(fields: string[], patterns: RegExp[]) {
  for (const pattern of patterns) {
    const field = fields.find((item) => pattern.test(item))
    if (field) return field
  }
  return fields[0]
}

function normalizeChartConfig(config: unknown, fields: string[], type: AiChartType): AiChartVisualConfig {
  const raw = config && typeof config === 'object' ? (config as Partial<AiChartVisualConfig>) : {}
  const palette = Array.isArray(raw.colorPalette)
    ? raw.colorPalette
        .filter((color) => typeof color === 'string' && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(color))
        .slice(0, 10)
    : []
  const threshold = raw.threshold && typeof raw.threshold === 'object' && fields.includes(raw.threshold.field)
    ? {
        field: raw.threshold.field,
        operator: ['>', '>=', '<', '<=', '=', '!='].includes(raw.threshold.operator ?? '') ? raw.threshold.operator! : '>=',
        value: toNumber(raw.threshold.value),
        label: String(raw.threshold.label ?? 'Threshold'),
        color: typeof raw.threshold.color === 'string' && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(raw.threshold.color) ? raw.threshold.color : '#DC2626',
      }
    : undefined

  return {
    orientation: raw.orientation === 'vertical' ? 'vertical' : 'horizontal',
    height: raw.height === 'compact' || raw.height === 'tall' ? raw.height : 'normal',
    colorMode: raw.colorMode === 'single' || raw.colorMode === 'severity' || raw.colorMode === 'gradient' ? raw.colorMode : 'category',
    colorPalette: palette.length ? palette : undefined,
    showLegend: raw.showLegend ?? type === 'donut',
    showValueLabels: raw.showValueLabels ?? true,
    showGrid: raw.showGrid ?? (type === 'line' || type === 'area' || type === 'scatter'),
    xAxisLabel: raw.xAxisLabel ? String(raw.xAxisLabel).slice(0, 80) : undefined,
    yAxisLabel: raw.yAxisLabel ? String(raw.yAxisLabel).slice(0, 80) : undefined,
    emptyStateMessage: raw.emptyStateMessage ? String(raw.emptyStateMessage).slice(0, 160) : undefined,
    threshold,
    interaction: {
      clickFilter: raw.interaction?.clickFilter ?? true,
      highlightOnInsight: raw.interaction?.highlightOnInsight ?? true,
      exportEnabled: raw.interaction?.exportEnabled ?? true,
    },
  }
}

function normalizeChart(chart: unknown, analysis: AiAnalysisPayload): AiChartDefinition | null {
  if (!chart || typeof chart !== 'object') return null
  const raw = chart as Partial<AiChartDefinition>
  const dataSource = normalizeDataSource(raw.dataSource, analysis)
  const fields = dataSourceFields(dataSource, analysis)
  if (fields.length === 0) return null

  const type = raw.type && allowedChartTypes.has(raw.type) ? raw.type : 'bar'
  const candidate: AiChartDefinition = {
    id: safeId(String(raw.id ?? raw.title ?? `chart_${Date.now()}`)),
    title: String(raw.title ?? 'Chart payload'),
    description: String(raw.description ?? 'Visualisasi berdasarkan payload report.'),
    type,
    priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : 99,
    dataSource,
    xField: raw.xField,
    yField: raw.yField,
    categoryField: raw.categoryField,
    valueField: raw.valueField,
    seriesField: raw.seriesField,
    aggregation: raw.aggregation && allowedAggregations.has(raw.aggregation) ? raw.aggregation : 'sum',
    format: raw.format === 'currency' || raw.format === 'percentage' || raw.format === 'number' ? raw.format : undefined,
    sort: raw.sort && fields.includes(raw.sort.field) ? { field: raw.sort.field, direction: raw.sort.direction === 'asc' ? 'asc' : 'desc' } : undefined,
    limit: Math.min(Math.max(Math.trunc(Number(raw.limit ?? 12)), 3), 50),
    config: normalizeChartConfig(raw.config, fields, type),
    reason: String(raw.reason ?? 'Chart dipilih karena field tersedia dalam payload.'),
    insightRule: String(raw.insightRule ?? 'Sorot nilai terbesar dari chart.'),
  }

  if (!candidate.xField && candidate.categoryField) candidate.xField = candidate.categoryField
  if (!candidate.yField && candidate.valueField) candidate.yField = candidate.valueField
  if (!candidate.categoryField && candidate.xField) candidate.categoryField = candidate.xField
  if (!candidate.valueField && candidate.yField) candidate.valueField = candidate.yField

  const hasField = (field?: string) => !field || fields.includes(field) || (field === 'itemCount' && candidate.aggregation === 'count')
  if (!hasField(candidate.xField) || !hasField(candidate.yField) || !hasField(candidate.categoryField) || !hasField(candidate.valueField) || !hasField(candidate.seriesField)) return null

  if (candidate.type === 'donut' && (!candidate.categoryField || !candidate.valueField)) return null
  if ((candidate.type === 'bar' || candidate.type === 'column' || candidate.type === 'line' || candidate.type === 'area' || candidate.type === 'stacked_bar') && (!candidate.xField || !candidate.yField)) return null
  if ((candidate.type === 'scatter' || candidate.type === 'heatmap') && (!candidate.xField || !candidate.yField)) return null

  return candidate
}

function aggregateValues(values: number[], count: number, aggregation: AiAggregation) {
  if (aggregation === 'count') return count
  if (values.length === 0) return 0
  if (aggregation === 'avg') return values.reduce((sum, value) => sum + value, 0) / values.length
  if (aggregation === 'min') return Math.min(...values)
  if (aggregation === 'max') return Math.max(...values)
  return values.reduce((sum, value) => sum + value, 0)
}

function chartMetricField(chart: AiChartDefinition) {
  if (chart.type === 'heatmap' && chart.valueField) return chart.valueField
  return chart.yField ?? chart.valueField
}

function computedMetricField(chart: AiChartDefinition) {
  if (chart.type === 'heatmap') return chart.valueField ?? 'itemCount'
  return chart.yField ?? chart.valueField ?? 'value'
}

function sortAndLimitChartRows(chart: AiChartDefinition, rows: DbRow[]) {
  const sorted = [...rows]
  if (chart.sort?.field) {
    sorted.sort((a, b) => {
      const av = a[chart.sort!.field]
      const bv = b[chart.sort!.field]
      const numericDelta = toNumber(av) - toNumber(bv)
      const delta = numericDelta !== 0 ? numericDelta : String(av ?? '').localeCompare(String(bv ?? ''))
      return chart.sort!.direction === 'asc' ? delta : -delta
    })
  } else if (chart.type === 'line' || chart.type === 'area') {
    const field = chart.xField ?? chart.categoryField
    if (field) sorted.sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')))
  } else {
    const metric = computedMetricField(chart)
    sorted.sort((a, b) => toNumber(b[metric]) - toNumber(a[metric]))
  }
  return sorted.slice(0, chart.limit ?? 20)
}

function computeGroupedChartData(chart: AiChartDefinition, rows: DbRow[]) {
  const xField = chart.xField ?? chart.categoryField
  const metricSourceField = chartMetricField(chart)
  const metricOutputField = computedMetricField(chart)
  if (!xField) return []

  const secondDimension = chart.type === 'heatmap' ? chart.yField : chart.seriesField
  const groups = new Map<string, { row: DbRow; values: number[]; count: number }>()

  rows.forEach((sourceRow) => {
    const xValue = sourceRow[xField]
    const secondValue = secondDimension ? sourceRow[secondDimension] : undefined
    const key = secondDimension ? `${String(xValue ?? '(Kosong)')}::${String(secondValue ?? '(Kosong)')}` : String(xValue ?? '(Kosong)')
    const current = groups.get(key) ?? {
      row: {
        [xField]: xValue ?? '(Kosong)',
        ...(secondDimension ? { [secondDimension]: secondValue ?? '(Kosong)' } : {}),
      },
      values: [],
      count: 0,
    }

    current.count += 1
    if (chart.aggregation !== 'count' && metricSourceField) {
      current.values.push(toNumber(sourceRow[metricSourceField]))
    }
    groups.set(key, current)
  })

  return [...groups.values()].map((group) => ({
    ...group.row,
    itemCount: group.count,
    [metricOutputField]: aggregateValues(group.values, group.count, chart.aggregation),
  }))
}

function computeRowChartData(chart: AiChartDefinition, rows: DbRow[]) {
  if (chart.type === 'table' || chart.type === 'scatter') return sortAndLimitChartRows(chart, rows)
  if (chart.dataSource === 'summary' || chart.dataSource === 'chart' || chart.dataSource.startsWith('groupings.')) {
    return sortAndLimitChartRows(chart, rows)
  }
  return sortAndLimitChartRows(chart, computeGroupedChartData(chart, rows))
}

function attachComputedChartData(chart: AiChartDefinition, analysis: AiAnalysisPayload, fullRows?: DbRow[]): AiChartDefinition {
  const sourceRows = getDataSourceRows(chart.dataSource, analysis, fullRows)
  const computedRows = computeRowChartData(chart, sourceRows)
  return {
    ...chart,
    valueField: chart.type === 'heatmap' ? chart.valueField ?? 'itemCount' : chart.valueField,
    data: computedRows,
    dataStatus: computedRows.length > 0 ? 'computed' : 'empty',
    dataNote:
      computedRows.length > 0
        ? `Dataset chart dihitung backend dari ${sourceRows.length.toLocaleString('id-ID')} row payload.`
        : 'Dataset chart kosong setelah field, grouping, sort, dan limit diterapkan.',
  }
}

function normalizeKpi(card: unknown, analysis: AiAnalysisPayload): AiKpiCard | null {
  if (!card || typeof card !== 'object') return null
  const raw = card as Partial<AiKpiCard>
  const valuePath = String(raw.valuePath ?? '')
  const summaryField = valuePath.startsWith('summary.') ? valuePath.slice('summary.'.length) : ''
  if (!summaryField || !(summaryField in analysis.summary)) return null
  return {
    id: safeId(String(raw.id ?? summaryField)),
    title: String(raw.title ?? labelFromField(summaryField)),
    valuePath: `summary.${summaryField}`,
    format: raw.format && allowedFormats.has(raw.format) ? raw.format : inferFormat(summaryField, 'number') ?? 'number',
    suffix: raw.suffix ? String(raw.suffix) : undefined,
    severity: raw.severity && allowedSeverity.has(raw.severity) ? raw.severity : 'neutral',
    description: String(raw.description ?? descriptionForSummaryField(summaryField)),
  }
}

function normalizeInsight(insight: unknown, chartIds: Set<string>): AiInsight | null {
  if (!insight || typeof insight !== 'object') return null
  const raw = insight as Partial<AiInsight>
  if (!raw.evidence || typeof raw.evidence !== 'object') return null
  const severity = raw.severity && allowedInsightSeverity.has(raw.severity) ? raw.severity : 'info'
  const relatedChartId = raw.relatedChartId && chartIds.has(raw.relatedChartId) ? raw.relatedChartId : undefined
  return {
    id: safeId(String(raw.id ?? raw.title ?? 'insight')),
    severity,
    title: String(raw.title ?? 'Insight payload'),
    finding: String(raw.finding ?? ''),
    evidence: {
      source: String(raw.evidence.source ?? 'summary'),
      field: String(raw.evidence.field ?? 'totalRows'),
      value: typeof raw.evidence.value === 'number' || typeof raw.evidence.value === 'string' ? raw.evidence.value : undefined,
      metric: raw.evidence.metric ? String(raw.evidence.metric) : undefined,
    },
    businessImpact: String(raw.businessImpact ?? ''),
    recommendedAction: String(raw.recommendedAction ?? ''),
    relatedChartId,
  }
}

function normalizePriorityTable(table: unknown, analysis: AiAnalysisPayload): AiPriorityTable | null {
  if (!table || typeof table !== 'object') return null
  const raw = table as Partial<AiPriorityTable>
  const source = raw.dataSource === 'sampleRows' ? 'sampleRows' : raw.dataSource === 'other' ? 'other' : 'rows'
  const fields = source === 'other' ? analysis.fields.map((field) => field.name) : dataSourceFields(source, analysis)
  const columns = (Array.isArray(raw.columns) ? raw.columns : []).filter((field) => fields.includes(field))
  if (columns.length === 0) return null
  return {
    id: safeId(String(raw.id ?? raw.title ?? 'priority_table')),
    title: String(raw.title ?? 'Priority Table'),
    description: String(raw.description ?? 'Daftar item prioritas dari payload report.'),
    dataSource: source,
    columns: columns.slice(0, 12),
    filters: (Array.isArray(raw.filters) ? raw.filters : [])
      .filter((filter) => filter && fields.includes(filter.field))
      .map((filter) => ({
        field: filter.field,
        operator: filter.operator ?? 'contains',
        value: filter.value,
      })),
    sort: (Array.isArray(raw.sort) ? raw.sort : [])
      .filter((sort) => sort && fields.includes(sort.field))
      .map((sort) => ({ field: sort.field, direction: sort.direction === 'asc' ? 'asc' : 'desc' })),
    limit: Math.min(Math.max(Math.trunc(Number(raw.limit ?? 20)), 5), 100),
  }
}

function normalizeAction(action: unknown): AiRecommendedAction | null {
  if (!action || typeof action !== 'object') return null
  const raw = action as Partial<AiRecommendedAction>
  return {
    priority: raw.priority === 'P1' || raw.priority === 'P2' || raw.priority === 'P3' ? raw.priority : 'P3',
    action: String(raw.action ?? ''),
    ownerSuggestion: String(raw.ownerSuggestion ?? 'Inventory Control'),
    reason: String(raw.reason ?? ''),
  }
}

function normalizeMissingField(field: unknown): AiMissingField | null {
  if (!field || typeof field !== 'object') return null
  const raw = field as Partial<AiMissingField>
  if (!raw.field) return null
  return {
    field: String(raw.field),
    reason: String(raw.reason ?? 'Field ini belum tersedia dalam payload.'),
    benefit: String(raw.benefit ?? 'Membuat analisa lebih tajam.'),
  }
}

export function sanitizeDashboardDefinition(
  value: unknown,
  analysis: AiAnalysisPayload,
  options: AiDashboardOptions = {},
  fallback?: AiDashboardDefinition,
  fullRows?: DbRow[],
): AiDashboardDefinition {
  const raw = value && typeof value === 'object' ? (value as Partial<AiDashboardDefinition>) : {}
  const maxCharts = Math.min(Math.max(Math.trunc(Number(options.maxCharts ?? 5)), 1), 8)
  const fallbackCards = fallback?.kpiCards ?? []
  const fallbackCharts = fallback?.charts ?? []
  const fallbackInsights = fallback?.insights ?? []
  const fallbackTables = fallback?.priorityTables ?? []

  const kpiCards = (Array.isArray(raw.kpiCards) ? raw.kpiCards : [])
    .map((card) => normalizeKpi(card, analysis))
    .filter((card): card is AiKpiCard => Boolean(card))
  fallbackCards.forEach((card) => {
    if (!kpiCards.some((item) => item.id === card.id)) kpiCards.push(card)
  })

  const charts = (Array.isArray(raw.charts) ? raw.charts : [])
    .map((chart) => normalizeChart(chart, analysis))
    .filter((chart): chart is AiChartDefinition => Boolean(chart))
    .sort((a, b) => a.priority - b.priority)
  fallbackCharts.forEach((chart) => {
    if (charts.length < maxCharts && !charts.some((item) => item.id === chart.id)) charts.push(chart)
  })
  const finalCharts = charts.slice(0, maxCharts).map((chart) => attachComputedChartData(chart, analysis, fullRows))
  const chartIds = new Set(finalCharts.map((chart) => chart.id))

  const insights = (Array.isArray(raw.insights) ? raw.insights : [])
    .map((insight) => normalizeInsight(insight, chartIds))
    .filter((insight): insight is AiInsight => insight !== null && Boolean(insight.finding))
  fallbackInsights.forEach((insight) => {
    if (insights.length < 5 && !insights.some((item) => item.id === insight.id)) insights.push(insight)
  })

  const priorityTables = options.includePriorityTable === false
    ? []
    : (Array.isArray(raw.priorityTables) ? raw.priorityTables : [])
        .map((table) => normalizePriorityTable(table, analysis))
        .filter((table): table is AiPriorityTable => Boolean(table))
  fallbackTables.forEach((table) => {
    if (!priorityTables.some((item) => item.id === table.id)) priorityTables.push(table)
  })

  const recommendedActions = (Array.isArray(raw.recommendedActions) ? raw.recommendedActions : [])
    .map(normalizeAction)
    .filter((action): action is AiRecommendedAction => action !== null && Boolean(action.action))

  const fallbackActions = fallback?.recommendedActions ?? []
  fallbackActions.forEach((action) => {
    if (recommendedActions.length < 5 && !recommendedActions.some((item) => item.action === action.action)) recommendedActions.push(action)
  })

  return {
    detectedReportType: String(raw.detectedReportType ?? fallback?.detectedReportType ?? detectReportType(analysis)),
    dashboardTitle: String(raw.dashboardTitle ?? fallback?.dashboardTitle ?? `${analysis.report.name} Analysis`),
    summary: {
      mainFinding: String(raw.summary?.mainFinding ?? fallback?.summary.mainFinding ?? 'Payload report sudah dibaca dan diprofilkan.'),
      businessRisk: String(raw.summary?.businessRisk ?? fallback?.summary.businessRisk ?? 'Risiko utama mengikuti field dan angka yang tersedia dalam payload.'),
      recommendedFocus: String(raw.summary?.recommendedFocus ?? fallback?.summary.recommendedFocus ?? 'Fokus pada KPI, chart ranking, dan tabel prioritas.'),
    },
    kpiCards: kpiCards.slice(0, 6),
    charts: finalCharts,
    insights: insights.slice(0, 5),
    priorityTables,
    recommendedActions: recommendedActions.slice(0, 5),
    missingFields: options.includeMissingFields === false
      ? []
      : (Array.isArray(raw.missingFields) ? raw.missingFields : [])
          .map(normalizeMissingField)
          .filter((field): field is AiMissingField => Boolean(field))
          .concat(fallback?.missingFields ?? [])
          .filter((field, index, list) => list.findIndex((item) => item.field === field.field) === index)
          .slice(0, 8),
  }
}

export function parseDashboardJson(content: string) {
  const cleaned = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('Output AI bukan JSON valid.')
  }
}

function detectReportType(analysis: AiAnalysisPayload) {
  const fieldText = analysis.fields.map((field) => field.name).join(' ')
  const text = `${analysis.report.code} ${analysis.report.name} ${analysis.report.description} ${fieldText}`.toLowerCase()
  if (/aging|umur|risklevel|dead stock|stale/.test(text)) return 'stock_aging'
  if (/movement|mutasi|issue|receive|transfer/.test(text)) return 'inventory_movement'
  if (/fuel|bbm|solar|kendaraan/.test(text)) return 'fuel_usage'
  if (/supplier|purchase|po|goods receive|penerimaan/.test(text)) return 'procurement_inventory'
  if (/valuation|nilai|persediaan|stock position|stok/.test(text)) return 'inventory_valuation'
  return 'dynamic_report'
}

function summaryMetricKeys(summary: DbRow) {
  return Object.keys(summary).filter((key) => typeof summary[key] === 'number' || (typeof summary[key] === 'string' && toNumber(summary[key]) !== 0))
}

function severityForKey(key: string): AiSeverity {
  if (/(critical|dead|risk|stale|selisih|outstanding|kosong|nol|invalid|error|lebih12|lebih24)/i.test(key)) return 'critical'
  if (/(amount|nilai|cost|aging|umur|warning|minimum|pending)/i.test(key)) return 'warning'
  if (/(total|count|qty|stok|item)/i.test(key)) return 'info'
  return 'neutral'
}

function formatForKey(key: string): AiFormat {
  if (isCurrencyField(key)) return 'currency'
  if (/(percent|percentage|ratio|rate|persen)/i.test(key)) return 'percentage'
  return 'number'
}

function descriptionForSummaryField(field: string) {
  const label = labelFromField(field)
  if (isCurrencyField(field)) return `${label} amount in IDR from report summary.`
  if (isQtyField(field)) return `${label} count/quantity from report summary.`
  if (/period|bulan|month/i.test(field)) return `${label} period from report summary.`
  return `${label} from report summary.`
}

function topRow(rows: DbRow[], valueField = 'itemCount') {
  return [...rows].sort((a, b) => toNumber(b[valueField]) - toNumber(a[valueField]))[0]
}

function firstGrouping(analysis: AiAnalysisPayload, fieldPattern: RegExp) {
  return Object.entries(analysis.groupings).find(([key]) => fieldPattern.test(key))
}

const itemTokenStopwords = new Set([
  'dan',
  'untuk',
  'assy',
  'assembly',
  'unit',
  'set',
  'pcs',
  'pc',
  'buah',
  'the',
  'with',
  'type',
  'model',
  'part',
  'spare',
  'new',
  'old',
])

function topItemNameTokenInsight(analysis: AiAnalysisPayload) {
  const fields = analysis.fields.map((field) => field.name)
  const itemNameField = fieldExists(fields, /namabarang|itemname|description|namafuel|itemdescription/i)
  if (!itemNameField) return undefined
  const amountField = fieldExists(fields, /(amount|nilai|value|cost|harga|persediaan)/i)
  const map = new Map<string, { token: string; count: number; amount: number }>()

  analysis.sampleRows.forEach((row) => {
    String(row[itemNameField] ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !itemTokenStopwords.has(token) && !/^\d+$/.test(token))
      .slice(0, 8)
      .forEach((token) => {
        const current = map.get(token) ?? { token, count: 0, amount: 0 }
        current.count += 1
        if (amountField) current.amount += toNumber(row[amountField])
        map.set(token, current)
      })
  })

  return [...map.values()].sort((a, b) => b.amount - a.amount || b.count - a.count)[0]
}

function topAgeAmountOutlier(analysis: AiAnalysisPayload) {
  const fields = analysis.fields.map((field) => field.name)
  const amountField = fieldExists(fields, /(amount|nilai|value|cost|harga|persediaan)/i)
  const ageField = fieldExists(fields, /(umurbulan|umur|age|aging|bulan|month)/i)
  const labelField = fieldExists(fields, /namabarang|itemname|description|kodebarang|itemcode|namafuel/i)
  if (!amountField || !ageField) return undefined

  const row = [...analysis.sampleRows]
    .map((item) => ({
      row: item,
      amount: toNumber(item[amountField]),
      age: toNumber(item[ageField]),
      score: toNumber(item[amountField]) * Math.max(1, toNumber(item[ageField])),
    }))
    .filter((item) => item.amount > 0 || item.age > 0)
    .sort((a, b) => b.score - a.score)[0]

  if (!row) return undefined
  return {
    ...row,
    amountField,
    ageField,
    label: labelField ? asText(row.row[labelField]) : 'Item prioritas',
  }
}

function buildKpis(analysis: AiAnalysisPayload): AiKpiCard[] {
  const preferred = [
    'totalRows',
    'TotalItem',
    'totalItems',
    'CriticalItems',
    'criticalItems',
    'DeadStockLebih24Bulan',
    'deadStockItems',
    'StaleLebih12Bulan',
    'NilaiStokBerisiko',
    'NilaiPersediaan',
    'AmountCurrent',
    'totalAmount',
    'TotalAmount',
    'TotalStok',
    'ItemCurrent',
    'QuantityClosing',
    'MovementGapQty',
    'MovementEventCountAll',
    'MovementQtyAll',
    'MovementAmountAll',
    'StockIssueQtyAllPeriod',
    'StockIssueAmountAllPeriod',
    'StockIssueEventCount',
    'oldestAgeMonth',
    'averageAgeMonth',
  ]
  const keys = [...preferred.filter((key) => key in analysis.summary), ...summaryMetricKeys(analysis.summary)].filter(
    (key, index, list) => list.indexOf(key) === index,
  )

  return keys.slice(0, 6).map((key) => ({
    id: safeId(key),
    title: labelFromField(key),
    valuePath: `summary.${key}`,
    format: formatForKey(key),
    suffix: /umur|age|bulan|month/i.test(key) ? 'bulan' : undefined,
    severity: severityForKey(key),
    description: descriptionForSummaryField(key),
  }))
}

function buildCharts(analysis: AiAnalysisPayload, maxCharts: number): AiChartDefinition[] {
  const charts: AiChartDefinition[] = []
  const numericFields = analysis.fields.filter((field) => field.type === 'number').map((field) => field.name)
  const allFields = analysis.fields.map((field) => field.name)
  const amountField = fieldExists(numericFields, /(amount|nilai|value|cost|harga|biaya|persediaan)/i)
  const ageField = fieldExists(numericFields, /(umurbulan|umur|age|aging|bulan|month)/i)
  const itemLabelField = fieldExists(allFields, /namabarang|itemname|description|kodebarang|itemcode|kodefuel|namafuel/i)
  const agingGrouping = firstGrouping(analysis, /AgingBucket/i)
  const riskGrouping = firstGrouping(analysis, /RiskLevel/i)
  const locationGrouping = firstGrouping(analysis, /LocCode|Gudang|Warehouse|Location/i)
  const heatmapGrouping = Object.entries(analysis.groupings).find(([key]) => /And(AgingBucket|RiskLevel)/i.test(key))

  if (agingGrouping) {
    const [key, rows] = agingGrouping
    const category = Object.keys(rows[0] ?? {}).find((field) => /agingbucket/i.test(field)) ?? Object.keys(rows[0] ?? {})[0]
    charts.push({
      id: 'aging_bucket_distribution',
      title: 'Distribusi Item Berdasarkan Aging Bucket',
      description: 'Menunjukkan jumlah item pada setiap kategori aging.',
      type: 'bar',
      priority: 1,
      dataSource: `groupings.${key}`,
      xField: category,
      yField: 'itemCount',
      aggregation: 'count',
      sort: { field: 'itemCount', direction: 'desc' },
      limit: 12,
      config: {
        orientation: 'horizontal',
        height: 'normal',
        colorMode: 'severity',
        colorPalette: ['#16A34A', '#2563EB', '#D99A00', '#EA580C', '#DC2626'],
        showLegend: false,
        showValueLabels: true,
        showGrid: false,
        xAxisLabel: 'Aging Bucket',
        yAxisLabel: 'Jumlah Item',
        interaction: { clickFilter: true, highlightOnInsight: true, exportEnabled: true },
      },
      reason: 'Aging bucket tersedia sehingga risiko umur stock bisa dibaca langsung.',
      insightRule: 'Highlight bucket dengan jumlah item terbesar.',
    })
    if (rows.some((row) => row.totalAmount !== undefined)) {
      charts.push({
        id: 'amount_by_aging_bucket',
        title: 'Nilai Inventory per Aging Bucket',
        description: 'Menunjukkan nilai inventory pada setiap kategori aging.',
        type: 'bar',
        priority: 3,
        dataSource: `groupings.${key}`,
        xField: category,
        yField: 'totalAmount',
        aggregation: 'sum',
        format: 'currency',
        sort: { field: 'totalAmount', direction: 'desc' },
        limit: 12,
        config: {
          orientation: 'horizontal',
          height: 'normal',
          colorMode: 'gradient',
          colorPalette: ['#167A3A', '#D99A00', '#DC2626'],
          showLegend: false,
          showValueLabels: true,
          showGrid: false,
          xAxisLabel: 'Aging Bucket',
          yAxisLabel: 'Nilai Inventory',
          interaction: { clickFilter: true, highlightOnInsight: true, exportEnabled: true },
        },
        reason: 'Amount tersedia sehingga prioritas bisa dibaca dari dampak finansial.',
        insightRule: 'Highlight bucket dengan totalAmount terbesar.',
      })
    }
  }

  if (riskGrouping) {
    const [key, rows] = riskGrouping
    const category = Object.keys(rows[0] ?? {}).find((field) => /risklevel/i.test(field)) ?? Object.keys(rows[0] ?? {})[0]
    charts.push({
      id: 'risk_level_distribution',
      title: 'Komposisi Risk Level',
      description: 'Menunjukkan proporsi item berdasarkan tingkat risiko.',
      type: 'donut',
      priority: 2,
      dataSource: `groupings.${key}`,
      categoryField: category,
      valueField: 'itemCount',
      aggregation: 'count',
      config: {
        orientation: 'horizontal',
        height: 'normal',
        colorMode: 'severity',
        colorPalette: ['#DC2626', '#EA580C', '#D99A00', '#2563EB', '#16A34A'],
        showLegend: true,
        showValueLabels: true,
        showGrid: false,
        interaction: { clickFilter: true, highlightOnInsight: true, exportEnabled: true },
      },
      reason: 'Risk level adalah kategori kecil sehingga cocok sebagai donut.',
      insightRule: 'Highlight jika Critical atau High mendominasi.',
    })
  }

  if (ageField && charts.length < maxCharts) {
    charts.push({
      id: 'age_month_distribution',
      title: 'Distribusi Item per Umur Bulan',
      description: 'Histogram sederhana untuk melihat konsentrasi umur item dalam payload.',
      type: 'column',
      priority: 3.5,
      dataSource: 'rows',
      xField: ageField,
      yField: 'itemCount',
      aggregation: 'count',
      sort: { field: ageField, direction: 'asc' },
      limit: 30,
      config: {
        orientation: 'vertical',
        height: 'normal',
        colorMode: 'gradient',
        colorPalette: ['#2563EB', '#D99A00', '#DC2626'],
        showLegend: false,
        showValueLabels: false,
        showGrid: true,
        xAxisLabel: labelFromField(ageField),
        yAxisLabel: 'Jumlah Item',
        threshold: { field: ageField, operator: '>=', value: 24, label: 'Dead stock threshold', color: '#DC2626' },
        interaction: { clickFilter: true, highlightOnInsight: true, exportEnabled: true },
      },
      reason: 'Field umur tersedia sehingga distribusi aging bisa dianalisis seperti histogram.',
      insightRule: 'Highlight umur bulan dengan jumlah item terbesar dan umur >= 24 bulan.',
    })
  }

  if (amountField && itemLabelField && charts.length < maxCharts) {
    charts.push({
      id: 'pareto_top_value_items',
      title: 'Pareto Top Item Berdasarkan Nilai',
      description: 'Ranking item bernilai terbesar untuk membaca konsentrasi nilai inventory.',
      type: 'bar',
      priority: 3.7,
      dataSource: 'rows',
      xField: itemLabelField,
      yField: amountField,
      aggregation: 'sum',
      format: 'currency',
      sort: { field: amountField, direction: 'desc' },
      limit: 15,
      config: {
        orientation: 'horizontal',
        height: 'tall',
        colorMode: 'gradient',
        colorPalette: ['#167A3A', '#D99A00', '#DC2626'],
        showLegend: false,
        showValueLabels: true,
        showGrid: false,
        xAxisLabel: labelFromField(itemLabelField),
        yAxisLabel: labelFromField(amountField),
        interaction: { clickFilter: true, highlightOnInsight: true, exportEnabled: true },
      },
      reason: 'Analisis Pareto membantu menemukan item kecil yang membawa nilai inventory terbesar.',
      insightRule: 'Highlight item dengan kontribusi nilai terbesar untuk review prioritas.',
    })
  }

  if (locationGrouping && charts.length < maxCharts) {
    const [key, rows] = locationGrouping
    const category = Object.keys(rows[0] ?? {}).find((field) => /loccode|gudang|warehouse|location/i.test(field)) ?? Object.keys(rows[0] ?? {})[0]
    const value = rows.some((row) => row.totalAmount !== undefined) ? 'totalAmount' : 'itemCount'
    charts.push({
      id: 'location_concentration',
      title: 'Konsentrasi Item per Lokasi',
      description: 'Menunjukkan lokasi atau gudang dengan konsentrasi item terbesar.',
      type: 'bar',
      priority: 4,
      dataSource: `groupings.${key}`,
      xField: category,
      yField: value,
      aggregation: value === 'totalAmount' ? 'sum' : 'count',
      format: value === 'totalAmount' ? 'currency' : 'number',
      sort: { field: value, direction: 'desc' },
      limit: 12,
      config: {
        orientation: 'horizontal',
        height: 'normal',
        colorMode: value === 'totalAmount' ? 'gradient' : 'category',
        colorPalette: ['#167A3A', '#2563EB', '#D99A00', '#DC2626'],
        showLegend: false,
        showValueLabels: true,
        showGrid: false,
        xAxisLabel: labelFromField(category),
        yAxisLabel: labelFromField(value),
        interaction: { clickFilter: true, highlightOnInsight: true, exportEnabled: true },
      },
      reason: 'Lokasi tersedia sehingga distribusi risiko per gudang bisa dipantau.',
      insightRule: 'Highlight lokasi dengan nilai atau jumlah item terbesar.',
    })
  }

  if (heatmapGrouping && charts.length < maxCharts) {
    const [key, rows] = heatmapGrouping
    const fields = Object.keys(rows[0] ?? {})
    charts.push({
      id: 'location_risk_heatmap',
      title: 'Heatmap Lokasi vs Risiko',
      description: 'Membandingkan dua dimensi kategori dari payload.',
      type: 'heatmap',
      priority: 5,
      dataSource: `groupings.${key}`,
      xField: fields[0],
      yField: fields[1],
      valueField: rows.some((row) => row.totalAmount !== undefined) ? 'totalAmount' : 'itemCount',
      aggregation: rows.some((row) => row.totalAmount !== undefined) ? 'sum' : 'count',
      format: rows.some((row) => row.totalAmount !== undefined) ? 'currency' : 'number',
      limit: 30,
      config: {
        orientation: 'horizontal',
        height: 'tall',
        colorMode: 'gradient',
        colorPalette: ['#DCFCE7', '#D99A00', '#DC2626'],
        showLegend: false,
        showValueLabels: true,
        showGrid: false,
        xAxisLabel: labelFromField(fields[0]),
        yAxisLabel: labelFromField(fields[1]),
        interaction: { clickFilter: true, highlightOnInsight: true, exportEnabled: true },
      },
      reason: 'Dua dimensi kategori tersedia sehingga pola konsentrasi bisa dipindai cepat.',
      insightRule: 'Highlight kombinasi lokasi dan risiko dengan nilai tertinggi.',
    })
  }

  if (ageField && amountField && charts.length < maxCharts) {
    charts.push({
      id: 'age_amount_scatter',
      title: 'Umur Stock vs Nilai Inventory',
      description: 'Membandingkan umur item dengan nilai inventory.',
      type: 'scatter',
      priority: 6,
      dataSource: 'sampleRows',
      xField: ageField,
      yField: amountField,
      aggregation: 'sum',
      format: 'currency',
      limit: 20,
      config: {
        orientation: 'horizontal',
        height: 'tall',
        colorMode: 'gradient',
        colorPalette: ['#2563EB', '#D99A00', '#DC2626'],
        showLegend: false,
        showValueLabels: false,
        showGrid: true,
        xAxisLabel: labelFromField(ageField),
        yAxisLabel: labelFromField(amountField),
        threshold: { field: ageField, operator: '>=', value: 24, label: 'Dead stock threshold', color: '#DC2626' },
        interaction: { clickFilter: true, highlightOnInsight: true, exportEnabled: true },
      },
      reason: 'Umur dan amount tersedia sehingga item bernilai besar dengan umur tinggi bisa ditemukan.',
      insightRule: 'Highlight titik dengan umur dan amount terbesar.',
    })
  }

  if (analysis.chart.length > 0 && charts.length < maxCharts) {
    const fields = Object.keys(analysis.chart[0])
    const xField = firstValidField(fields, [/label|nama|gudang|loc|supplier|kendaraan|category|kategori|jenis|status/i])
    const yField = firstValidField(fields.filter((field) => field !== xField), [/amount|nilai|qty|total|count|item|rows|jumlah/i])
    if (xField && yField) {
      charts.push({
        id: 'payload_chart_preview',
        title: 'Chart Payload Utama',
        description: 'Visualisasi dari chart payload yang sudah disiapkan backend report.',
        type: 'bar',
        priority: 7,
        dataSource: 'chart',
        xField,
        yField,
        aggregation: isCurrencyField(yField) ? 'sum' : 'count',
        format: isCurrencyField(yField) ? 'currency' : 'number',
        sort: { field: yField, direction: 'desc' },
        limit: 12,
        reason: 'Backend sudah menyediakan chart payload ringkas.',
        insightRule: 'Highlight baris chart dengan nilai terbesar.',
      })
    }
  }

  Object.entries(analysis.groupings).forEach(([key, rows]) => {
    if (charts.length >= maxCharts || charts.some((chart) => chart.dataSource === `groupings.${key}`)) return
    const fields = Object.keys(rows[0] ?? {})
    const category = fields.find((field) => !/(count|total|amount|qty|average)/i.test(field))
    const value = rows.some((row) => row.totalAmount !== undefined) ? 'totalAmount' : 'itemCount'
    if (!category || !fields.includes(value)) return
    charts.push({
      id: `${safeId(key)}_ranking`,
      title: `Ranking ${labelFromField(category)}`,
      description: `Perbandingan ${labelFromField(category)} berdasarkan ${labelFromField(value)}.`,
      type: 'bar',
      priority: 20 + charts.length,
      dataSource: `groupings.${key}`,
      xField: category,
      yField: value,
      aggregation: value === 'totalAmount' ? 'sum' : 'count',
      format: value === 'totalAmount' ? 'currency' : 'number',
      sort: { field: value, direction: 'desc' },
      limit: 12,
      reason: 'Kategori ini tersedia dalam payload dan punya agregasi pembanding.',
      insightRule: 'Highlight kategori dengan nilai terbesar.',
    })
  })

  return charts.slice(0, maxCharts)
}

function buildInsights(analysis: AiAnalysisPayload, charts: AiChartDefinition[]): AiInsight[] {
  const insights: AiInsight[] = []
  const agingGrouping = firstGrouping(analysis, /AgingBucket/i)
  const riskGrouping = firstGrouping(analysis, /RiskLevel/i)
  const locationGrouping = firstGrouping(analysis, /LocCode|Gudang|Warehouse|Location/i)
  const summaryKeys = summaryMetricKeys(analysis.summary)
    .map((key) => ({ key, value: toNumber(analysis.summary[key]) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)

  if (agingGrouping) {
    const [key, rows] = agingGrouping
    const top = topRow(rows, rows.some((row) => row.totalAmount !== undefined) ? 'totalAmount' : 'itemCount')
    const bucketField = Object.keys(top ?? {}).find((field) => /agingbucket/i.test(field)) ?? 'AgingBucket'
    insights.push({
      id: 'aging_focus',
      severity: /dead|stale|24|critical/i.test(asText(top?.[bucketField])) ? 'critical' : 'warning',
      title: 'Aging stock menjadi fokus utama',
      finding: `${asText(top?.[bucketField]) || 'Aging bucket terbesar'} menjadi bucket paling material dengan ${toNumber(top?.itemCount).toLocaleString('id-ID')} item${top?.totalAmount !== undefined ? ` dan nilai ${toNumber(top.totalAmount).toLocaleString('id-ID')}` : ''}.`,
      evidence: { source: `groupings.${key}`, field: bucketField, value: asText(top?.[bucketField]), metric: top?.totalAmount !== undefined ? 'totalAmount' : 'itemCount' },
      businessImpact: 'Stock yang terlalu lama tidak bergerak dapat menahan modal dan menaikkan risiko write-off.',
      recommendedAction: 'Prioritaskan review item pada bucket aging paling material sebelum export atau closing.',
      relatedChartId: charts.find((chart) => /aging/i.test(chart.id))?.id,
    })
  }

  const topToken = topItemNameTokenInsight(analysis)
  if (topToken) {
    insights.push({
      id: 'item_name_pattern',
      severity: topToken.amount > 0 ? 'warning' : 'info',
      title: 'Pola nama barang dominan terlihat',
      finding: `Kata "${topToken.token}" paling menonjol dalam sample nama barang dengan ${topToken.count.toLocaleString('id-ID')} kemunculan${topToken.amount > 0 ? ` dan nilai terkait ${topToken.amount.toLocaleString('id-ID')}` : ''}.`,
      evidence: { source: 'sampleRows', field: 'NamaBarang / ItemName', value: topToken.token, metric: topToken.amount > 0 ? 'amount' : 'count' },
      businessImpact: 'Pola nama barang membantu melihat kelompok material yang berulang, bukan hanya item individual.',
      recommendedAction: `Filter nama barang yang mengandung "${topToken.token}", lalu cek apakah kelompok ini perlu konsolidasi stok, disposal, atau validasi kebutuhan.`,
      relatedChartId: charts.find((chart) => /pareto|item|value/i.test(chart.id))?.id,
    })
  }

  const outlier = topAgeAmountOutlier(analysis)
  if (outlier) {
    insights.push({
      id: 'age_amount_outlier',
      severity: outlier.age >= 24 ? 'critical' : 'warning',
      title: 'Outlier umur dan nilai perlu diturunkan ke item',
      finding: `${outlier.label || 'Item prioritas'} memiliki kombinasi ${labelFromField(outlier.ageField)} ${outlier.age.toLocaleString('id-ID')} dan ${labelFromField(outlier.amountField)} ${outlier.amount.toLocaleString('id-ID')}.`,
      evidence: { source: 'sampleRows', field: `${outlier.ageField} + ${outlier.amountField}`, value: outlier.label, metric: 'age_amount_score' },
      businessImpact: 'Kombinasi umur tinggi dan nilai besar biasanya menjadi prioritas review karena modal tertahan dan risiko write-off lebih tinggi.',
      recommendedAction: 'Turunkan ke daftar item prioritas, cek histori movement, validasi kebutuhan user, lalu tentukan keep, transfer, return, disposal, atau write-off.',
      relatedChartId: charts.find((chart) => /scatter|age_amount|pareto/i.test(chart.id))?.id,
    })
  }

  if (riskGrouping) {
    const [key, rows] = riskGrouping
    const top = topRow(rows, 'itemCount')
    const riskField = Object.keys(top ?? {}).find((field) => /risklevel/i.test(field)) ?? 'RiskLevel'
    insights.push({
      id: 'risk_level_focus',
      severity: /critical|high/i.test(asText(top?.[riskField])) ? 'critical' : 'warning',
      title: 'Risk level perlu diprioritaskan',
      finding: `${asText(top?.[riskField]) || 'Risk terbesar'} memiliki ${toNumber(top?.itemCount).toLocaleString('id-ID')} item dalam payload.`,
      evidence: { source: `groupings.${key}`, field: riskField, value: asText(top?.[riskField]), metric: 'itemCount' },
      businessImpact: 'Kelompok risiko terbesar menentukan urutan validasi operasional dan audit data.',
      recommendedAction: 'Mulai dari item Critical/High, lalu urutkan berdasarkan nilai dan umur tertinggi.',
      relatedChartId: charts.find((chart) => /risk/i.test(chart.id))?.id,
    })
  }

  if (locationGrouping) {
    const [key, rows] = locationGrouping
    const metric = rows.some((row) => row.totalAmount !== undefined) ? 'totalAmount' : 'itemCount'
    const top = topRow(rows, metric)
    const locationField = Object.keys(top ?? {}).find((field) => /loccode|gudang|warehouse|location/i.test(field)) ?? Object.keys(top ?? {})[0]
    insights.push({
      id: 'location_concentration',
      severity: metric === 'totalAmount' ? 'warning' : 'info',
      title: 'Konsentrasi per lokasi terlihat jelas',
      finding: `${asText(top?.[locationField]) || 'Lokasi terbesar'} menjadi lokasi paling material dengan ${toNumber(top?.[metric]).toLocaleString('id-ID')} pada ${metric}.`,
      evidence: { source: `groupings.${key}`, field: locationField, value: asText(top?.[locationField]), metric },
      businessImpact: 'Konsentrasi pada satu lokasi membantu tim warehouse menentukan area review pertama.',
      recommendedAction: 'Filter lokasi tersebut, cek item bernilai besar, lalu validasi status fisik dan kebutuhan user department.',
      relatedChartId: charts.find((chart) => /location/i.test(chart.id))?.id,
    })
  }

  if (summaryKeys[0]) {
    const top = summaryKeys[0]
    insights.push({
      id: 'summary_metric_priority',
      severity: severityForKey(top.key) === 'critical' ? 'critical' : 'warning',
      title: 'KPI terbesar perlu dijadikan prioritas',
      finding: `${labelFromField(top.key)} adalah angka summary paling besar dengan nilai ${top.value.toLocaleString('id-ID')}.`,
      evidence: { source: 'summary', field: top.key, value: top.value, metric: formatForKey(top.key) },
      businessImpact: 'KPI terbesar menjadi titik awal untuk memeriksa dampak bisnis report.',
      recommendedAction: 'Gunakan KPI ini sebagai filter prioritas sebelum membuka tabel detail.',
      relatedChartId: charts[0]?.id,
    })
  }

  if (insights.length === 0) {
    insights.push({
      id: 'payload_profile_ready',
      severity: 'info',
      title: 'Payload siap diprofilkan',
      finding: `Payload memiliki ${analysis.profile.totalRows.toLocaleString('id-ID')} row dan ${analysis.fields.length.toLocaleString('id-ID')} field.`,
      evidence: { source: 'profile', field: 'totalRows', value: analysis.profile.totalRows, metric: 'rowCount' },
      businessImpact: 'Analisa masih bergantung pada field yang tersedia di payload saat ini.',
      recommendedAction: 'Gunakan search dan preview table untuk menemukan kolom metric atau kategori yang paling relevan.',
      relatedChartId: charts[0]?.id,
    })
  }

  return insights.slice(0, 5)
}

function buildPriorityTables(analysis: AiAnalysisPayload): AiPriorityTable[] {
  if (analysis.sampleRows.length === 0) return []
  const fields = analysis.fields.map((field) => field.name)
  const columns = [
    'KodeBarang',
    'NamaBarang',
    'ItemCode',
    'ItemName',
    'Gudang',
    'LocCode',
    'Qty',
    'ItemCurrent',
    'AmountCurrent',
    'QuantityClosing',
    'MovementCategory',
    'StaleMovementRelation',
    'MovementGapQty',
    'LastMovementDate',
    'MovementEventCountAll',
    'MovementQtyAll',
    'StockIssueQtyAllPeriod',
    'StockIssueEventCount',
    'StokAkhir',
    'MovementEvent1',
    'MovementEvent2',
    'StockIssueEvent1',
    'StockIssueEvent2',
    'UmurBulan',
    'AgingBucket',
    'RiskLevel',
    'Amount',
    'TotalAmount',
    'NilaiStok',
    'RecommendedAction',
    'IssueSummary',
  ].filter((field) => fields.includes(field))

  const amountField = fieldExists(fields, /(amount|nilai|value|cost|harga|persediaan)/i)
  const ageField = fieldExists(fields, /(umurbulan|umur|age|aging|bulan|month)/i)
  const riskField = fieldExists(fields, /risklevel/i)
  const agingField = fieldExists(fields, /agingbucket/i)

  const filters: AiPriorityTable['filters'] = []
  if (riskField) filters.push({ field: riskField, operator: 'in', value: ['Critical', 'High'] })
  else if (agingField) filters.push({ field: agingField, operator: 'contains', value: 'Dead' })

  const sort: AiPriorityTable['sort'] = []
  if (amountField) sort.push({ field: amountField, direction: 'desc' })
  if (ageField) sort.push({ field: ageField, direction: 'desc' })

  return [{
    id: 'top_priority_items',
    title: 'Top Priority Items',
    description: 'Daftar item yang perlu ditindaklanjuti berdasarkan risiko, umur, dan nilai jika field tersedia.',
    dataSource: 'rows',
    columns: (columns.length ? columns : fields.slice(0, 10)).slice(0, 12),
    filters,
    sort,
    limit: 20,
  }]
}

function buildMissingFields(analysis: AiAnalysisPayload) {
  const fields = new Set(analysis.fields.map((field) => field.name.toLowerCase()))
  const hasPattern = (pattern: RegExp) => [...fields].some((field) => pattern.test(field))
  const missing: AiMissingField[] = []

  if (!hasPattern(/lastmovementdate|lastissuedate|terakhirissue|lastupdate|updatedate/)) {
    missing.push({
      field: 'LastMovementDate',
      reason: 'Dibutuhkan untuk memastikan kapan barang terakhir benar-benar bergerak.',
      benefit: 'Membedakan item slow moving dan no movement.',
    })
  }
  if (!hasPattern(/amount|nilai|value|cost|harga|persediaan/)) {
    missing.push({
      field: 'Amount',
      reason: 'Dibutuhkan untuk menentukan prioritas berdasarkan nilai inventory.',
      benefit: 'Membantu melihat dampak finansial dari risiko operasional.',
    })
  }
  if (!hasPattern(/loccode|gudang|warehouse|location/)) {
    missing.push({
      field: 'LocCode',
      reason: 'Dibutuhkan untuk melihat lokasi atau gudang yang paling terdampak.',
      benefit: 'Membantu tim warehouse menentukan area review pertama.',
    })
  }
  if (/stock_aging/.test(detectReportType(analysis)) && !hasPattern(/agingbucket|risklevel|umurbulan|umur/)) {
    missing.push({
      field: 'AgingBucket / RiskLevel',
      reason: 'Dibutuhkan untuk membaca prioritas aging dan dead stock.',
      benefit: 'Membuat chart dan insight risiko stock lebih tajam.',
    })
  }

  return missing
}

export function generateLocalDashboardDefinition(analysis: AiAnalysisPayload, options: AiDashboardOptions = {}): AiDashboardDefinition {
  const maxCharts = Math.min(Math.max(Math.trunc(Number(options.maxCharts ?? 5)), 1), 8)
  const kpiCards = buildKpis(analysis)
  const charts = buildCharts(analysis, maxCharts)
  const insights = buildInsights(analysis, charts)

  return {
    detectedReportType: detectReportType(analysis),
    dashboardTitle: `${analysis.report.name} - AI Dynamic Analysis`,
    summary: {
      mainFinding: insights[0]?.finding ?? `Payload ${analysis.report.name} memiliki ${analysis.profile.totalRows.toLocaleString('id-ID')} row untuk dianalisis.`,
      businessRisk: insights.find((insight) => insight.severity === 'critical')?.businessImpact ?? 'Risiko bisnis mengikuti konsentrasi nilai, aging, quality flag, dan kategori terbesar dalam payload.',
      recommendedFocus: insights[0]?.recommendedAction ?? 'Fokus pada KPI terbesar, chart ranking, dan priority table.',
    },
    kpiCards,
    charts,
    insights,
    priorityTables: options.includePriorityTable === false ? [] : buildPriorityTables(analysis),
    recommendedActions: [
      {
        priority: 'P1',
        action: 'Review item atau kategori paling material dari chart dan priority table.',
        ownerSuggestion: 'Inventory Control / Warehouse',
        reason: 'Nilai terbesar atau risiko tertinggi harus divalidasi terlebih dahulu.',
      },
      {
        priority: 'P2',
        action: 'Pisahkan prioritas berdasarkan nilai finansial dan umur stock.',
        ownerSuggestion: 'Finance / Inventory Accounting',
        reason: 'Keputusan write-off, disposal, atau replenishment perlu mempertimbangkan dampak nilai.',
      },
      {
        priority: 'P3',
        action: 'Validasi kebutuhan operasional dengan user department.',
        ownerSuggestion: 'User Department / Procurement',
        reason: 'Item lama atau bernilai besar mungkin masih dibutuhkan sebagai sparepart kritikal.',
      },
    ],
    missingFields: options.includeMissingFields === false ? [] : buildMissingFields(analysis),
  }
}
