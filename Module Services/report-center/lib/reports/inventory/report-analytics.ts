import type { DbRow } from '../report-detail-performance'
import type {
  ReportBreakdownEntry,
  ReportDetailWindowMetadata,
  ReportDetailWindowStrategy,
  ReportEvidenceMetadata,
  ReportKpiEntry,
  ReportKpiScope,
  ReportValueFormat,
} from '../report-experience'
import {
  MOVEMENT_CATEGORY_ORDER,
  movementCategoryRank,
  normalizeMovementCategoryLabel,
} from '../movement-category'
import type {
  InventoryAnalyticsBasePayload,
  InventoryAnalyticsContract,
} from './analytics-contract'
import {
  getInventorySemanticDimension,
  getInventorySemanticDimensionAliases,
  type InventorySemanticDimensionId,
} from './semantic-dimensions'

type InventoryReportAnalyticsOptions = {
  reportId?: string
  sourcePayload?: InventoryAnalyticsBasePayload
}

type MetricSelection = {
  field?: string
  valuePath: string
  format: ReportValueFormat
  unit?: string
}

const DIMENSION_ORDER: InventorySemanticDimensionId[] = [
  'movement-category',
  'stock-analysis',
  'product-type',
  'product-category',
  'item-type',
  'location',
  'item-code',
]

const SUMMARY_AMOUNT_FIELDS = [
  'TotalAmount',
  'total_amount',
  'TotalAssetAmount',
  'TotalAmountItem',
  'NilaiPersediaan',
  'NilaiStok',
  'OnHandHoldAmount',
  'ClosingAmount',
  'TotalPOAmount',
  'POAmount',
]

const ROW_AMOUNT_FIELDS = [
  'AssetAmountRealTime',
  'AmountItem',
  'TotalAmount',
  'total_amount',
  'AmountCurrent',
  'NilaiStok',
  'NilaiPersediaan',
  'OnHandHoldAmount',
  'ClosingAmount',
  'POAmount',
  'Amount',
]

const SUMMARY_QUANTITY_FIELDS = [
  'TotalQty',
  'total_quantity',
  'TotalStok',
  'QtyOnHandHold',
  'ClosingQty',
  'TotalQuantityClosing',
]

const ROW_QUANTITY_FIELDS = [
  'Qty',
  'total_quantity',
  'TotalQty',
  'QuantityClosing',
  'QtyOnHandHold',
  'StokAkhir',
  'TotalStok',
  'ClosingQty',
]

const SUMMARY_ITEM_FIELDS = [
  'TotalItem',
  'total_item',
  'FilteredRows',
  'TotalRows',
  'TotalPupukItem',
  'TotalItemReorder',
  'TotalLine',
]

const ROW_COUNT_FIELDS = [
  'TotalItem',
  'total_item',
  'ItemCurrent',
  'Count',
  'JumlahItem',
  'TotalLine',
]

const SUMMARY_MOVEMENT_FIELDS = [
  'TotalStockIssueMovementCount',
  'TotalStockIssueEvent',
  'TotalStockIssueCount',
  'StockIssueMovementCount',
  'MovementEventCountAll',
]

const ROW_MOVEMENT_FIELDS = [
  'StockIssueMovementCount',
  'StockIssueEventCount',
  'MovementEventCountAll',
  'JumlahMovement',
  'JumlahStockIssue',
]

const SUMMARY_LOCATION_FIELDS = [
  'TotalGudang',
  'total_location',
  'TotalLocation',
  'TotalLokasi',
]

function normalizeToken(value: unknown) {
  return String(value ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function cleanLabel(value: unknown) {
  const label = String(value ?? '').trim()
  return label || '(Kosong)'
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const numeric = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(numeric) ? numeric : 0
  }
  return 0
}

function finiteNumber(value: unknown, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : fallback
}

function firstNumericValue(row: DbRow | undefined, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key]
    if (value === null || value === undefined || value === '') continue
    const numeric = toNumber(value)
    if (Number.isFinite(numeric)) return { key, value: numeric }
  }
  return undefined
}

function firstNumericField(rows: DbRow[], keys: string[]) {
  return keys.find((key) => rows.some((row) => row[key] !== null && row[key] !== undefined && row[key] !== '' && Number.isFinite(toNumber(row[key]))))
}

function collectFields(payload: InventoryAnalyticsBasePayload, rows: DbRow[], chart: DbRow[]) {
  return [
    ...(payload.columns ?? []),
    ...rows.flatMap((row) => Object.keys(row)),
    ...chart.flatMap((row) => Object.keys(row)),
  ]
}

function findField(fields: string[], aliases: string[]) {
  const normalized = new Map(fields.map((field) => [normalizeToken(field), field]))
  for (const alias of aliases) {
    const field = normalized.get(normalizeToken(alias))
    if (field) return field
  }
  return undefined
}

function semanticField(
  payload: InventoryAnalyticsBasePayload,
  rows: DbRow[],
  chart: DbRow[],
  id: InventorySemanticDimensionId,
  reportId?: string,
) {
  return findField(collectFields(payload, rows, chart), getInventorySemanticDimensionAliases(id, reportId))
}

function hasMovementCategoryChart(chart: DbRow[]) {
  return chart.some((row) => {
    const label = String(row.MovementCategory ?? row.Label ?? '').trim()
    return (MOVEMENT_CATEGORY_ORDER as readonly string[]).includes(String(normalizeMovementCategoryLabel(label)))
  })
}

function chartFieldForDimension(id: InventorySemanticDimensionId, chart: DbRow[], field?: string) {
  if (field && chart.some((row) => row[field] !== undefined)) return field
  if (id === 'movement-category' && hasMovementCategoryChart(chart)) return 'Label'
  return undefined
}

function rowScope(rows: DbRow[], detailWindow: ReportDetailWindowMetadata): ReportKpiScope {
  if (rows.length === 0) return 'sample'
  if (rows.length >= detailWindow.filteredRows) return 'filtered'
  if (rows.length >= detailWindow.returnedRows) return 'returned-window'
  return 'sample'
}

function slug(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56) || 'kosong'
}

function evidence(source: ReportEvidenceMetadata['source'], valuePath: string, rowCount?: number, totalRows?: number): ReportEvidenceMetadata {
  return {
    source,
    valuePath,
    rowCount,
    totalRows,
  }
}

function metricSelection(rows: DbRow[], sourceName: 'chart' | 'rows'): MetricSelection {
  const amount = firstNumericField(rows, ROW_AMOUNT_FIELDS)
  if (amount) return { field: amount, valuePath: `${sourceName}.${amount}`, format: 'currency', unit: 'IDR' }

  const quantity = firstNumericField(rows, ROW_QUANTITY_FIELDS)
  if (quantity) return { field: quantity, valuePath: `${sourceName}.${quantity}`, format: 'quantity' }

  const count = firstNumericField(rows, ROW_COUNT_FIELDS)
  if (count) return { field: count, valuePath: `${sourceName}.${count}`, format: 'number' }

  return { valuePath: `${sourceName}.rowCount`, format: 'number' }
}

function breakdownValue(row: DbRow, metric: MetricSelection) {
  return metric.field ? toNumber(row[metric.field]) : 1
}

function normalizeDimensionLabel(id: InventorySemanticDimensionId, value: unknown) {
  if (id === 'movement-category') return String(normalizeMovementCategoryLabel(value))
  return cleanLabel(value)
}

function aggregateBreakdownRows(
  rows: DbRow[],
  field: string,
  metric: MetricSelection,
  id: InventorySemanticDimensionId,
) {
  const groups = new Map<string, { label: string; value: number; count: number }>()
  rows.forEach((row) => {
    const label = normalizeDimensionLabel(id, row[field])
    const current = groups.get(label) ?? { label, value: 0, count: 0 }
    current.value += breakdownValue(row, metric)
    current.count += 1
    groups.set(label, current)
  })
  return [...groups.values()]
}

function sortBreakdownGroups(id: InventorySemanticDimensionId, groups: Array<{ label: string; value: number; count: number }>) {
  return groups.sort((left, right) => {
    if (id === 'movement-category') {
      return movementCategoryRank(left.label) - movementCategoryRank(right.label) || right.value - left.value
    }
    return right.value - left.value || left.label.localeCompare(right.label, 'id-ID')
  })
}

function filterActionForDimension(id: InventorySemanticDimensionId, field: string, value: string) {
  return {
    type: 'set-filter' as const,
    field,
    semanticDimensionId: id,
    operator: 'equals' as const,
    value,
  }
}

function buildDimensionBreakdowns(
  payload: InventoryAnalyticsBasePayload,
  rows: DbRow[],
  chart: DbRow[],
  id: InventorySemanticDimensionId,
  field: string,
  detailWindow: ReportDetailWindowMetadata,
) {
  const dimension = getInventorySemanticDimension(id)
  const chartField = chartFieldForDimension(id, chart, field)
  const sourceRows = chartField ? chart : rows.filter((row) => row[field] !== undefined)
  if (sourceRows.length === 0) return []

  const sourceName = chartField ? 'chart' : 'rows'
  const groupField = chartField ?? field
  const metric = metricSelection(sourceRows, sourceName)
  const scope: ReportKpiScope = chartField ? 'filtered' : rowScope(sourceRows, detailWindow)
  const groups = sortBreakdownGroups(id, aggregateBreakdownRows(sourceRows, groupField, metric, id)).slice(0, 8)

  return groups.map<ReportBreakdownEntry>((group) => ({
    id: `${id}-${slug(group.label)}`,
    label: `${dimension.label} - ${group.label}`,
    dimensionId: id,
    value: metric.field ? group.value : group.count,
    unit: metric.unit,
    format: metric.format,
    scope,
    filterAction: filterActionForDimension(id, field, group.label),
    evidence: evidence(chartField ? 'chart' : 'rows', metric.valuePath, group.count, detailWindow.totalRows),
  }))
}

function detailWindowStrategy(metadata: DbRow): ReportDetailWindowStrategy {
  const explicit = String(metadata.detailWindowStrategy ?? '').toLowerCase()
  if (explicit === 'all' || explicit === 'page' || explicit === 'window' || explicit === 'balanced' || explicit === 'sample') return explicit
  if (String(metadata.groupWindowStrategy ?? '').toLowerCase() === 'balanced') return 'balanced'
  if (metadata.windowed) return 'window'
  if (metadata.paginated) return 'page'
  return 'all'
}

function buildDetailWindow(payload: InventoryAnalyticsBasePayload): ReportDetailWindowMetadata {
  const metadata = payload.metadata ?? {}
  const returnedRows = finiteNumber(metadata.returnedRows ?? payload.rows.length, payload.rows.length)
  const loadedRows = finiteNumber(metadata.loadedRows ?? payload.rows.length, payload.rows.length)
  const filteredRows = Math.max(returnedRows, finiteNumber(metadata.filteredRows ?? metadata.totalRows ?? payload.rows.length, payload.rows.length))
  const totalRows = Math.max(filteredRows, finiteNumber(metadata.totalRows ?? metadata.totalRowsBeforeFilter ?? filteredRows, filteredRows))
  const maxLoadedRows = finiteNumber(metadata.maxLoadedRows ?? loadedRows, loadedRows)
  const reachableRows = finiteNumber(metadata.reachableRows ?? filteredRows, filteredRows)
  const pageSize = finiteNumber(metadata.pageSize ?? returnedRows, returnedRows || 1) || 1
  const pageCount = finiteNumber(metadata.totalPages ?? Math.ceil(Math.max(reachableRows, 1) / pageSize), 1)

  return {
    totalRows,
    filteredRows,
    returnedRows: Math.min(returnedRows, filteredRows),
    loadedRows,
    maxLoadedRows,
    reachableRows,
    pageCount,
    strategy: detailWindowStrategy(metadata),
    partial: Boolean(metadata.windowed) || Math.min(returnedRows, filteredRows) < filteredRows,
    page: finiteNumber(metadata.page, 1) || 1,
    pageSize,
    reason: typeof metadata.tableRowsScope === 'string' ? metadata.tableRowsScope : undefined,
  }
}

function kpiFromSummary(
  id: string,
  label: string,
  summary: DbRow,
  summaryFields: string[],
  format: ReportValueFormat,
  unit?: string,
) {
  const metric = firstNumericValue(summary, summaryFields)
  if (!metric) return undefined
  return {
    id,
    label,
    value: metric.value,
    unit,
    format,
    scope: 'full-scope' as const,
    evidence: evidence('summary', `summary.${metric.key}`),
  }
}

function kpiFromRows(
  id: string,
  label: string,
  rows: DbRow[],
  fields: string[],
  format: ReportValueFormat,
  detailWindow: ReportDetailWindowMetadata,
  unit?: string,
) {
  const field = firstNumericField(rows, fields)
  if (!field) return undefined
  return {
    id,
    label,
    value: rows.reduce((sum, row) => sum + toNumber(row[field]), 0),
    unit,
    format,
    scope: rowScope(rows, detailWindow),
    evidence: evidence('rows', `rows.${field}`, rows.length, detailWindow.totalRows),
  }
}

function pushKpi(target: ReportKpiEntry[], kpi: ReportKpiEntry | undefined) {
  if (kpi) target.push(kpi)
}

function buildKpis(payload: InventoryAnalyticsBasePayload, rows: DbRow[], detailWindow: ReportDetailWindowMetadata) {
  const kpis: ReportKpiEntry[] = []

  pushKpi(kpis, kpiFromSummary('inventory-total-valuation', 'Total valuasi', payload.summary, SUMMARY_AMOUNT_FIELDS, 'currency', 'IDR')
    ?? kpiFromRows('inventory-total-valuation', 'Total valuasi', rows, ROW_AMOUNT_FIELDS, 'currency', detailWindow, 'IDR'))

  const itemSummary = firstNumericValue(payload.summary, SUMMARY_ITEM_FIELDS)
  kpis.push({
    id: 'inventory-total-items',
    label: 'Jumlah item/baris',
    value: itemSummary?.value ?? detailWindow.filteredRows,
    format: 'number',
    scope: itemSummary ? 'full-scope' : 'filtered',
    evidence: itemSummary
      ? evidence('summary', `summary.${itemSummary.key}`)
      : evidence('metadata', 'metadata.filteredRows', rows.length, detailWindow.totalRows),
  })

  pushKpi(kpis, kpiFromSummary('inventory-total-quantity', 'Total quantity', payload.summary, SUMMARY_QUANTITY_FIELDS, 'quantity')
    ?? kpiFromRows('inventory-total-quantity', 'Total quantity', rows, ROW_QUANTITY_FIELDS, 'quantity', detailWindow))

  pushKpi(kpis, kpiFromSummary('inventory-movement-activity', 'Aktivitas movement', payload.summary, SUMMARY_MOVEMENT_FIELDS, 'number')
    ?? kpiFromRows('inventory-movement-activity', 'Aktivitas movement', rows, ROW_MOVEMENT_FIELDS, 'number', detailWindow))

  pushKpi(kpis, kpiFromSummary('inventory-locations', 'Lokasi/gudang', payload.summary, SUMMARY_LOCATION_FIELDS, 'number'))

  return kpis
}

export function buildInventoryReportAnalytics(
  payload: InventoryAnalyticsBasePayload,
  options: InventoryReportAnalyticsOptions = {},
): InventoryAnalyticsContract {
  const sourcePayload = options.sourcePayload ?? payload
  const sourceRows = sourcePayload.rows ?? payload.rows ?? []
  const sourceChart = sourcePayload.chart ?? payload.chart ?? []
  const reportId = options.reportId ?? String(payload.metadata?.reportId ?? '')
  const detailWindow = buildDetailWindow(payload)
  const semanticFields = new Map<InventorySemanticDimensionId, string>()

  DIMENSION_ORDER.forEach((id) => {
    const field = semanticField(sourcePayload, sourceRows, sourceChart, id, reportId)
    if (field) semanticFields.set(id, field)
  })

  const semanticDimensions = DIMENSION_ORDER.filter((id) => semanticFields.has(id))
  const breakdowns = semanticDimensions.flatMap((id) =>
    buildDimensionBreakdowns(
      sourcePayload,
      sourceRows,
      sourceChart,
      id,
      semanticFields.get(id) as string,
      detailWindow,
    ),
  )

  return {
    semanticDimensions,
    experienceProfile: {
      id: reportId || 'inventory-report',
      globalModule: 'procurement',
      submodule: 'inventory',
      capabilities: [
        'semantic-filters',
        'interactive-kpis',
        'breakdowns',
        'drill-down',
        'detail-window',
        'natural-language-filter',
        'ai-insight',
        'export',
      ],
    },
    detailWindow,
    kpis: buildKpis(sourcePayload, sourceRows, detailWindow),
    breakdowns,
  }
}
