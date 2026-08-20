import type { DbRow, ReportPayloadLike } from '../report-detail-performance'
import type {
  ReportBreakdownEntry,
  ReportDetailWindowMetadata,
  ReportExperienceProfile,
  ReportKpiEntry,
} from '../report-experience'
import type { InventorySemanticDimensionId } from './semantic-dimensions'

export type InventoryAnalyticsContract = {
  semanticDimensions: InventorySemanticDimensionId[]
  experienceProfile?: Pick<ReportExperienceProfile, 'id' | 'globalModule' | 'submodule' | 'capabilities'>
  kpis: ReportKpiEntry[]
  breakdowns: ReportBreakdownEntry[]
  detailWindow?: ReportDetailWindowMetadata
}

export type InventoryAnalyticsBasePayload<T extends DbRow = DbRow> = ReportPayloadLike & {
  rows: T[]
  columns: string[]
  summary: DbRow
  metadata: DbRow
}

export type InventoryAnalyticsPayload<T extends DbRow = DbRow> = InventoryAnalyticsBasePayload<T> & {
  analytics?: InventoryAnalyticsContract
  metadata: DbRow & {
    analytics?: {
      kpiIds: string[]
      breakdownIds: string[]
      semanticDimensions: InventorySemanticDimensionId[]
      experienceProfileId?: string
    }
    semanticDimensions?: InventorySemanticDimensionId[]
    detailWindow?: ReportDetailWindowMetadata
  }
}

function isPresent(value: unknown) {
  return value !== undefined && value !== null && value !== ''
}

function validateEvidence(prefix: string, evidence: unknown, issues: string[]) {
  if (!evidence || typeof evidence !== 'object') {
    issues.push(`${prefix}.evidence is required`)
    return
  }

  if (!isPresent((evidence as { source?: unknown }).source)) {
    issues.push(`${prefix}.evidence.source is required`)
  }
}

function validateKpi(kpi: ReportKpiEntry, index: number, issues: string[]) {
  const prefix = `kpis[${index}]`
  if (!isPresent(kpi.id)) issues.push(`${prefix}.id is required`)
  if (!isPresent(kpi.label)) issues.push(`${prefix}.label is required`)
  if (kpi.value === undefined) issues.push(`${prefix}.value is required`)
  if (!isPresent(kpi.format)) issues.push(`${prefix}.format is required`)
  if (!isPresent(kpi.scope)) issues.push(`${prefix}.scope is required`)
  validateEvidence(prefix, kpi.evidence, issues)
}

function validateBreakdown(breakdown: ReportBreakdownEntry, index: number, issues: string[]) {
  const prefix = `breakdowns[${index}]`
  if (!isPresent(breakdown.id)) issues.push(`${prefix}.id is required`)
  if (!isPresent(breakdown.label)) issues.push(`${prefix}.label is required`)
  if (breakdown.value === undefined) issues.push(`${prefix}.value is required`)
  if (!isPresent(breakdown.scope)) issues.push(`${prefix}.scope is required`)
  validateEvidence(prefix, breakdown.evidence, issues)
}

export function attachInventoryAnalytics<T extends InventoryAnalyticsBasePayload>(
  payload: T,
  analytics: InventoryAnalyticsContract,
): T & InventoryAnalyticsPayload {
  return {
    ...payload,
    analytics,
    metadata: {
      ...payload.metadata,
      analytics: {
        kpiIds: analytics.kpis.map((kpi) => kpi.id),
        breakdownIds: analytics.breakdowns.map((breakdown) => breakdown.id),
        semanticDimensions: analytics.semanticDimensions,
        experienceProfileId: analytics.experienceProfile?.id,
      },
      semanticDimensions: analytics.semanticDimensions,
      detailWindow: analytics.detailWindow ?? (payload.metadata.detailWindow as ReportDetailWindowMetadata | undefined),
    },
  }
}

export function validateInventoryAnalyticsPayload(payload: InventoryAnalyticsPayload) {
  const issues: string[] = []

  if (!Array.isArray(payload.rows)) issues.push('rows must remain an array')
  if (!Array.isArray(payload.columns)) issues.push('columns must remain an array')
  if (!payload.summary || typeof payload.summary !== 'object') issues.push('summary must remain an object')
  if (!payload.metadata || typeof payload.metadata !== 'object') issues.push('metadata must remain an object')

  payload.analytics?.kpis.forEach((kpi, index) => validateKpi(kpi, index, issues))
  payload.analytics?.breakdowns.forEach((breakdown, index) => validateBreakdown(breakdown, index, issues))

  if (payload.analytics?.detailWindow) {
    const detailWindow = payload.analytics.detailWindow
    if (detailWindow.totalRows < detailWindow.filteredRows) {
      issues.push('detailWindow.totalRows must be greater than or equal to filteredRows')
    }
    if (detailWindow.returnedRows > detailWindow.filteredRows) {
      issues.push('detailWindow.returnedRows cannot exceed filteredRows')
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}
