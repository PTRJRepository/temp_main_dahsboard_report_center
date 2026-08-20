import {
  compactReportRowsForAiEvidence,
  type DbRow,
  type ReportPayloadLike,
} from './report-detail-performance'
import type { ReportBreakdownEntry, ReportKpiEntry, ReportValueFormat } from './report-experience'

export type AiEvidenceMetric = {
  id: string
  label: string
  value: string | number | boolean | null
  format?: ReportValueFormat
  scope?: string
  source?: string
  valuePath?: string
}

export type AiEvidenceFieldDefinition = {
  name: string
  type: 'text' | 'number' | 'boolean' | 'date' | 'empty'
}

export type AiEvidenceBundle = {
  report: {
    code?: string
    title?: string
    description?: string
    question?: string
  }
  activeFilters: DbRow
  scope: {
    totalRows: number
    filteredRows: number
    returnedRows: number
    sampleRows: number
    columns: number
    partial: boolean
    source?: string
    generatedAt?: string
  }
  kpis: AiEvidenceMetric[]
  breakdowns: AiEvidenceMetric[]
  fieldDefinitions: AiEvidenceFieldDefinition[]
  sampleRows: DbRow[]
  limits: {
    sampleRows: number
    columns: number
    kpis: number
    breakdowns: number
  }
}

export type BuildAiEvidenceOptions = {
  reportCode?: string
  question?: string
  filters?: DbRow
  sampleRows?: number
  maxColumns?: number
  maxKpis?: number
  maxBreakdowns?: number
}

type AnalyticsLike = {
  kpis?: ReportKpiEntry[]
  breakdowns?: ReportBreakdownEntry[]
  detailWindow?: {
    totalRows?: number
    filteredRows?: number
    returnedRows?: number
    partial?: boolean
  }
}

type PayloadWithAnalytics = ReportPayloadLike & {
  analytics?: AnalyticsLike
}

const SENSITIVE_KEY_PATTERN = /(authorization|cookie|credential|password|secret|token|api[_-]?key|sql|query)/i
const DEFAULT_SAMPLE_ROWS = 12
const DEFAULT_MAX_COLUMNS = 24
const DEFAULT_MAX_KPIS = 12
const DEFAULT_MAX_BREAKDOWNS = 24

function finiteNumber(value: unknown, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : fallback
}

function isSafeEvidenceKey(key: string) {
  return !SENSITIVE_KEY_PATTERN.test(key)
}

function clipText(value: string, max = 180) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > max ? `${normalized.slice(0, max - 3).trim()}...` : normalized
}

function sanitizeValue(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return clipText(value)
  return clipText(JSON.stringify(value))
}

function sanitizeRecord(row: DbRow | undefined, preferredColumns?: string[]) {
  const compact: DbRow = {}
  const entries = preferredColumns?.length
    ? preferredColumns.map((key) => [key, row?.[key]] as const)
    : Object.entries(row ?? {})

  entries.forEach(([key, value]) => {
    if (!isSafeEvidenceKey(key)) return
    compact[key] = sanitizeValue(value)
  })

  return compact
}

function firstPresentNumber(...values: unknown[]) {
  for (const value of values) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return Math.max(0, Math.trunc(numeric))
  }
  return undefined
}

function fieldType(values: unknown[]): AiEvidenceFieldDefinition['type'] {
  const present = values.filter((value) => value !== undefined && value !== null && value !== '')
  if (present.length === 0) return 'empty'
  if (present.every((value) => typeof value === 'number' && Number.isFinite(value))) return 'number'
  if (present.every((value) => typeof value === 'boolean')) return 'boolean'
  if (present.every((value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(new Date(value).getTime()))) return 'date'
  return 'text'
}

function metricFromKpi(kpi: ReportKpiEntry): AiEvidenceMetric {
  return {
    id: kpi.id,
    label: kpi.label,
    value: sanitizeValue(kpi.value),
    format: kpi.format,
    scope: kpi.scope,
    source: kpi.evidence.source,
    valuePath: kpi.evidence.valuePath,
  }
}

function metricFromBreakdown(breakdown: ReportBreakdownEntry): AiEvidenceMetric {
  return {
    id: breakdown.id,
    label: breakdown.label,
    value: sanitizeValue(breakdown.value),
    format: breakdown.format,
    scope: breakdown.scope,
    source: breakdown.evidence.source,
    valuePath: breakdown.evidence.valuePath,
  }
}

function fallbackSummaryKpis(summary: DbRow | undefined, limit: number): AiEvidenceMetric[] {
  return Object.entries(summary ?? {})
    .filter(([key, value]) => isSafeEvidenceKey(key) && (typeof value === 'number' || typeof value === 'string'))
    .slice(0, limit)
    .map(([key, value]) => ({
      id: key,
      label: key,
      value: sanitizeValue(value),
      source: 'summary',
      valuePath: `summary.${key}`,
    }))
}

function metadataSource(metadata: DbRow | undefined) {
  const source = metadata?.dataSource ?? metadata?.source ?? metadata?.serverProfile ?? metadata?.reportSource
  return typeof source === 'string' && isSafeEvidenceKey(source) ? clipText(source, 80) : undefined
}

export function buildAiEvidenceBundle(payload: PayloadWithAnalytics, options: BuildAiEvidenceOptions = {}): AiEvidenceBundle {
  const rows = Array.isArray(payload.rows) ? payload.rows : []
  const sourceColumns = (Array.isArray(payload.columns) && payload.columns.length > 0
    ? payload.columns
    : Object.keys(rows[0] ?? {})).filter(isSafeEvidenceKey)
  const maxColumns = Math.min(Math.max(finiteNumber(options.maxColumns, DEFAULT_MAX_COLUMNS), 1), 40)
  const sampleLimit = Math.min(Math.max(finiteNumber(options.sampleRows, DEFAULT_SAMPLE_ROWS), 1), 25)
  const maxKpis = Math.min(Math.max(finiteNumber(options.maxKpis, DEFAULT_MAX_KPIS), 1), 20)
  const maxBreakdowns = Math.min(Math.max(finiteNumber(options.maxBreakdowns, DEFAULT_MAX_BREAKDOWNS), 1), 40)
  const selectedColumns = sourceColumns.slice(0, maxColumns)
  const sampleRows = compactReportRowsForAiEvidence(rows, selectedColumns, {
    sampleRows: sampleLimit,
    maxColumns,
  }).map((row) => sanitizeRecord(row, selectedColumns))
  const metadata = payload.metadata ?? {}
  const detailWindow = payload.analytics?.detailWindow ?? (metadata.detailWindow as AnalyticsLike['detailWindow'] | undefined)
  const filteredRows = firstPresentNumber(detailWindow?.filteredRows, metadata.filteredRows, metadata.totalRows, rows.length) ?? rows.length
  const returnedRows = firstPresentNumber(detailWindow?.returnedRows, metadata.returnedRows, rows.length) ?? rows.length
  const totalRows = firstPresentNumber(detailWindow?.totalRows, metadata.totalRows, filteredRows, rows.length) ?? filteredRows
  const kpis = payload.analytics?.kpis?.slice(0, maxKpis).map(metricFromKpi) ?? fallbackSummaryKpis(payload.summary, maxKpis)
  const breakdowns = payload.analytics?.breakdowns?.slice(0, maxBreakdowns).map(metricFromBreakdown) ?? []

  return {
    report: {
      code: options.reportCode,
      title: payload.title ? clipText(payload.title, 120) : undefined,
      description: payload.description ? clipText(payload.description, 220) : undefined,
      question: options.question ? clipText(options.question, 220) : undefined,
    },
    activeFilters: sanitizeRecord(options.filters),
    scope: {
      totalRows: Math.max(totalRows, filteredRows),
      filteredRows,
      returnedRows: Math.min(returnedRows, filteredRows),
      sampleRows: sampleRows.length,
      columns: selectedColumns.length,
      partial: Boolean(detailWindow?.partial) || returnedRows < filteredRows,
      source: metadataSource(metadata),
      generatedAt: typeof metadata.generatedAt === 'string' ? clipText(metadata.generatedAt, 80) : undefined,
    },
    kpis,
    breakdowns,
    fieldDefinitions: selectedColumns.map((name) => ({
      name,
      type: fieldType(rows.slice(0, 20).map((row) => row[name])),
    })),
    sampleRows,
    limits: {
      sampleRows: sampleLimit,
      columns: maxColumns,
      kpis: maxKpis,
      breakdowns: maxBreakdowns,
    },
  }
}

export function formatAiEvidenceForPrompt(evidence: AiEvidenceBundle) {
  return JSON.stringify(evidence)
}
