import {
  filtersFromReportFilterAction,
  normalizeReportFilters,
  type ReportColumnFilter,
  type ReportFilterInput,
} from './report-filtering'
import type { ReportDetailWindowMetadata, ReportDetailWindowStrategy, ReportFilterAction } from './report-experience'

export type DbRow = Record<string, unknown>

export type ReportPayloadLike = {
  title?: string
  description?: string
  rows?: DbRow[]
  columns?: string[]
  summary?: DbRow
  chart?: DbRow[]
  metadata?: DbRow
}

export type ReportTableGroup<T extends DbRow = DbRow> = {
  key: string
  label: string
  rows: T[]
  totals: Record<string, number>
  subtotalColumns: string[]
}

export type ReportTableRenderRow<T extends DbRow = DbRow> =
  | { type: 'group-header'; key: string; group: ReportTableGroup<T>; groupIndex: number }
  | { type: 'data'; key: string; row: T; rowKey: string; rowIndex: number; groupKey?: string }
  | { type: 'detail'; key: string; row: T; rowKey: string; groupKey?: string }
  | { type: 'group-subtotal'; key: string; group: ReportTableGroup<T>; groupIndex: number }

export type ReportTableWindow = {
  totalRows: number
  loadedRows: number
  maxLoadedRows: number
  reachableRows: number
  pageCount: number
  windowed: boolean
}

const DEFAULT_AI_SAMPLE_ROWS = 50
const DEFAULT_AI_COLUMN_LIMIT = 40
const DEFAULT_AI_CHART_ROWS = 0

function finiteNumber(value: unknown, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : fallback
}

function numericValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0
  const normalized = value.replace(/[^\d.-]/g, '')
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : 0
}

function optionalNumericValue(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string') return undefined
  const normalized = value.replace(/[^\d.-]/g, '')
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : undefined
}

function firstNumericValue(row: DbRow | undefined, keys: string[]) {
  for (const key of keys) {
    const value = optionalNumericValue(row?.[key])
    if (value !== undefined) return value
  }
  return undefined
}

function formatQuantityPart(value: number) {
  return value.toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

function isNumericCell(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'string' || !value.trim()) return false
  return Number.isFinite(Number(value.replace(/[^\d.-]/g, '')))
}

function groupLabel<T extends DbRow>(row: T, column: string) {
  const text = String(row[column] ?? '').trim()
  return text || '(Kosong)'
}

function pickRowColumns(row: DbRow, columns: string[]) {
  const compact: DbRow = {}
  columns.forEach((column) => {
    if (Object.prototype.hasOwnProperty.call(row, column)) {
      compact[column] = row[column]
    }
  })
  return compact
}

export function compactReportRowsForAiEvidence(
  rows: DbRow[],
  columns: string[],
  options: { sampleRows?: number; maxColumns?: number } = {},
) {
  const sampleRows = options.sampleRows ?? DEFAULT_AI_SAMPLE_ROWS
  const maxColumns = options.maxColumns ?? DEFAULT_AI_COLUMN_LIMIT
  const selectedColumns = columns.slice(0, maxColumns)
  return rows.slice(0, sampleRows).map((row) => pickRowColumns(row, selectedColumns))
}

export function compactReportPayloadForAi<T extends ReportPayloadLike>(
  payload: T,
  options: { sampleRows?: number; maxColumns?: number; chartRows?: number } = {},
): T {
  const rows = Array.isArray(payload.rows) ? payload.rows : []
  const sourceColumns = Array.isArray(payload.columns) && payload.columns.length > 0
    ? payload.columns
    : Object.keys(rows[0] ?? {})
  const maxColumns = options.maxColumns ?? DEFAULT_AI_COLUMN_LIMIT
  const sampleRows = options.sampleRows ?? DEFAULT_AI_SAMPLE_ROWS
  const chartRows = options.chartRows ?? DEFAULT_AI_CHART_ROWS
  const columns = sourceColumns.slice(0, maxColumns)

  return {
    ...payload,
    rows: compactReportRowsForAiEvidence(rows, columns, { sampleRows, maxColumns }),
    columns,
    chart: Array.isArray(payload.chart) && chartRows > 0 ? payload.chart.slice(0, chartRows) : [],
    metadata: {
      ...(payload.metadata ?? {}),
      aiPayloadCompacted: true,
      aiOriginalRows: rows.length,
      aiOriginalColumns: sourceColumns.length,
      aiSampleRows: Math.min(rows.length, sampleRows),
      aiSampleColumns: columns.length,
    },
  }
}

export function isSubtotalColumn(column: string, rows: DbRow[], sampleSize = 20) {
  if (/^(unit[_ ]?cost|diff(?:erential)?[_ ]?unit[_ ]?cost|cost|average[_ ]?cost|harga[_ ]?satuan|rate|price)$/i.test(column)) return false
  if (!/(amount|total|nilai|qty|quantity|stok|baris|rows|count|jumlah|receive|usage)/i.test(column)) return false

  const sample = rows
    .map((row) => row[column])
    .filter((value) => value !== null && value !== undefined && value !== '')
    .slice(0, sampleSize)

  return sample.length > 0 && sample.every(isNumericCell)
}

export function selectSubtotalColumns(visibleColumns: string[], rows: DbRow[], sampleSize = 20) {
  return visibleColumns.filter((column) => isSubtotalColumn(column, rows, sampleSize))
}

export function buildReportTableGroups<T extends DbRow>(
  rows: T[],
  groupColumn: string | undefined,
  visibleColumns: string[],
  subtotalColumns = selectSubtotalColumns(visibleColumns, rows),
): ReportTableGroup<T>[] {
  if (!groupColumn) return []
  const map = new Map<string, ReportTableGroup<T>>()

  rows.forEach((row) => {
    const label = groupLabel(row, groupColumn)
    const key = `${groupColumn}:${label}`
    const group = map.get(key) ?? {
      key,
      label,
      rows: [],
      totals: {},
      subtotalColumns,
    }

    group.rows.push(row)
    subtotalColumns.forEach((column) => {
      group.totals[column] = (group.totals[column] ?? 0) + numericValue(row[column])
    })
    map.set(key, group)
  })

  return [...map.values()]
}

const subtotalSummaryAliases: Record<string, string[]> = {
  Amount: ['TotalAmount', 'total_amount', 'NilaiPersediaan', 'TotalAssetAmount'],
  amount: ['TotalAmount', 'total_amount', 'NilaiPersediaan', 'TotalAssetAmount'],
  AmountItem: ['TotalAssetAmount', 'TotalAmountItem', 'TotalAmount', 'total_amount', 'AssetAmountRealTime'],
  AmountCurrent: ['TotalAmount', 'NilaiPersediaan', 'total_amount', 'TotalAssetAmount'],
  TotalAmount: ['TotalAmount', 'total_amount', 'NilaiPersediaan', 'TotalAssetAmount'],
  total_amount: ['total_amount', 'TotalAmount', 'TotalAssetAmount'],
  NilaiStok: ['NilaiPersediaan', 'TotalAmount', 'total_amount'],
  NilaiPersediaan: ['NilaiPersediaan', 'TotalAmount', 'total_amount'],
  Qty: ['TotalQty', 'total_quantity'],
  qty: ['TotalQty', 'total_quantity'],
  Quantity: ['TotalQty', 'total_quantity'],
  QtyOnHandHold: ['total_quantity', 'TotalQtyOnHandHold', 'TotalQty', 'Qty'],
  total_quantity: ['total_quantity', 'TotalQtyOnHandHold', 'TotalQty', 'Qty'],
  QuantityClosing: ['TotalQty', 'total_quantity', 'TotalQuantityClosing'],
  StokAkhir: ['TotalQty', 'total_quantity', 'TotalQuantityClosing'],
  QtyOnHand: ['total_quantity_on_hand', 'TotalQtyOnHand'],
  quantity_on_hand: ['total_quantity_on_hand', 'TotalQtyOnHand'],
  QtyOnHold: ['total_quantity_on_hold', 'TotalQtyOnHold'],
  quantity_on_hold: ['total_quantity_on_hold', 'TotalQtyOnHold'],
  StockIssueMovementCount: ['TotalStockIssueMovementCount', 'TotalStockIssueEvent'],
  StockIssueMovementQty: ['TotalStockIssueMovementQty', 'TotalStockIssueQty'],
  StockIssueMovementAmount: ['TotalStockIssueMovementAmount', 'TotalStockIssueAmount'],
  StockIssueEventCount: ['TotalStockIssueMovementCount', 'TotalStockIssueEvent'],
  StockIssueQtyAllPeriod: ['TotalStockIssueMovementQty', 'TotalStockIssueQty'],
  StockIssueAmountAllPeriod: ['TotalStockIssueMovementAmount', 'TotalStockIssueAmount'],
  ItemCurrent: ['TotalItem', 'total_item'],
}

function dynamicSummaryAliases(column: string) {
  if (/(amount|nilai|cost|biaya)/i.test(column)) return ['TotalAmount', 'total_amount', 'NilaiPersediaan', 'TotalAssetAmount']
  if (/(qty|quantity|stok)/i.test(column)) return ['TotalQty', 'total_quantity']
  if (/(count|jumlah|rows|baris)/i.test(column)) return ['FilteredRows', 'TotalItem', 'total_item']
  return []
}

export function buildReportSummaryTotals(
  summary: DbRow | undefined,
  rows: DbRow[],
  columns: string[],
  options: { fallbackToRows?: boolean; preferRows?: boolean } = {},
) {
  const fallbackToRows = options.fallbackToRows ?? true
  // preferRows=true when active dimension filter scopes the page (e.g. location/productType)
  // but sticky grand totals must not keep showing unscoped server summary.
  const preferRows = options.preferRows === true && rows.length > 0
  const totals: Record<string, number> = {}

  columns.forEach((column) => {
    if (preferRows) {
      totals[column] = rows.reduce((sum, row) => sum + numericValue(row[column]), 0)
      return
    }

    const summaryValue = firstNumericValue(summary, [
      column,
      ...(subtotalSummaryAliases[column] ?? []),
      ...dynamicSummaryAliases(column),
    ])
    if (summaryValue !== undefined) {
      totals[column] = summaryValue
      return
    }

    if (fallbackToRows) {
      totals[column] = rows.reduce((sum, row) => sum + numericValue(row[column]), 0)
    }
  })

  return totals
}

function hasFilterValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && value !== ''
}

function compactFilterInput(filters: ReportFilterInput) {
  const compact: Partial<Record<keyof ReportFilterInput, unknown>> = {}
  Object.entries(filters).forEach(([key, value]) => {
    if (hasFilterValue(value)) compact[key as keyof ReportFilterInput] = value
  })
  return compact
}

function mergeColumnFilters(current: ReportColumnFilter[] = [], incoming: ReportColumnFilter[] = []) {
  if (incoming.length === 0) return current
  const incomingFields = new Set(incoming.map((filter) => filter.field))
  return [
    ...current.filter((filter) => !incomingFields.has(filter.field)),
    ...incoming,
  ].slice(-5)
}

export function mergeReportFilterAction(currentFilters: ReportFilterInput, action: ReportFilterAction): ReportFilterInput {
  const actionFilters = filtersFromReportFilterAction(action)
  if (action.type === 'clear-filter') return actionFilters

  const next = compactFilterInput(currentFilters)
  Object.entries(actionFilters).forEach(([key, value]) => {
    if (key === 'columnFilters') return
    if (hasFilterValue(value)) next[key as keyof ReportFilterInput] = value
  })

  if (actionFilters.columnFilters?.length) {
    next.columnFilters = mergeColumnFilters(currentFilters.columnFilters, actionFilters.columnFilters)
  }

  return normalizeReportFilters(next)
}

export function formatInventoryQuantityBreakdown(row: DbRow) {
  const onHand = firstNumericValue(row, ['QtyOnHand', 'quantity_on_hand'])
  const onHold = firstNumericValue(row, ['QtyOnHold', 'quantity_on_hold'])
  const total = firstNumericValue(row, ['QtyOnHandHold', 'total_quantity'])

  if (onHand !== undefined || onHold !== undefined) {
    const safeOnHand = onHand ?? 0
    const safeOnHold = onHold ?? 0
    return `${formatQuantityPart(total ?? safeOnHand + safeOnHold)}(${formatQuantityPart(safeOnHand)}+${formatQuantityPart(safeOnHold)})`
  }

  if (total !== undefined) return formatQuantityPart(total)
  return '-'
}

export function buildReportTableRows<T extends DbRow>(options: {
  grouped: boolean
  groups: ReportTableGroup<T>[]
  pageRows: T[]
  page: number
  collapsedGroups?: Record<string, boolean>
  expandedRows?: Record<string, boolean>
  getRowKey: (row: T, fallback: string) => string
}): ReportTableRenderRow<T>[] {
  const expandedRows = options.expandedRows ?? {}
  const collapsedGroups = options.collapsedGroups ?? {}

  if (!options.grouped) {
    return options.pageRows.flatMap((row, index) => {
      const rowKey = options.getRowKey(row, `page-${options.page}-${index}`)
      const dataRow: ReportTableRenderRow<T> = { type: 'data', key: `row:${rowKey}`, row, rowKey, rowIndex: index }
      return expandedRows[rowKey]
        ? [dataRow, { type: 'detail', key: `detail:${rowKey}`, row, rowKey }]
        : [dataRow]
    })
  }

  return options.groups.flatMap((group, groupIndex) => {
    const rows: ReportTableRenderRow<T>[] = [
      { type: 'group-header', key: `group:${group.key}:header`, group, groupIndex },
    ]

    if (!collapsedGroups[group.key]) {
      group.rows.forEach((row, index) => {
        const rowKey = options.getRowKey(row, `${group.key}-${index}`)
        rows.push({ type: 'data', key: `group:${group.key}:row:${rowKey}`, row, rowKey, rowIndex: index, groupKey: group.key })
        if (expandedRows[rowKey]) {
          rows.push({ type: 'detail', key: `group:${group.key}:detail:${rowKey}`, row, rowKey, groupKey: group.key })
        }
      })
    }

    rows.push({ type: 'group-subtotal', key: `group:${group.key}:subtotal`, group, groupIndex })
    return rows
  })
}

export function normalizeReportTableWindow(metadata: DbRow | undefined, loadedRowsLength: number, pageSize: number): ReportTableWindow {
  const totalRows = finiteNumber(metadata?.filteredRows ?? metadata?.totalRows, loadedRowsLength)
  const loadedRows = finiteNumber(metadata?.loadedRows, loadedRowsLength)
  const maxLoadedRows = finiteNumber(metadata?.maxLoadedRows, totalRows)
  const reachableRows = Math.min(totalRows, maxLoadedRows)
  const safePageSize = Math.max(1, finiteNumber(pageSize, 1))

  return {
    totalRows,
    loadedRows,
    maxLoadedRows,
    reachableRows,
    pageCount: Math.max(1, Math.ceil(reachableRows / safePageSize)),
    windowed: Boolean(metadata?.windowed) || reachableRows < totalRows,
  }
}

export function buildReportDetailWindowMetadata(options: {
  metadata?: DbRow
  returnedRows: number
  pageSize: number
  page?: number
  strategy?: ReportDetailWindowStrategy
  reason?: string
}): ReportDetailWindowMetadata {
  const tableWindow = normalizeReportTableWindow(options.metadata, options.returnedRows, options.pageSize)
  const filteredRows = finiteNumber(options.metadata?.filteredRows ?? options.metadata?.totalRows, tableWindow.totalRows)
  const totalRows = finiteNumber(options.metadata?.totalRows, filteredRows)
  const returnedRows = Math.min(finiteNumber(options.returnedRows), filteredRows)
  const strategy = options.strategy ?? (tableWindow.windowed ? 'window' : 'all')

  return {
    totalRows: Math.max(totalRows, filteredRows),
    filteredRows,
    returnedRows,
    loadedRows: tableWindow.loadedRows,
    maxLoadedRows: tableWindow.maxLoadedRows,
    reachableRows: tableWindow.reachableRows,
    pageCount: tableWindow.pageCount,
    strategy,
    partial: strategy !== 'all' || returnedRows < filteredRows || tableWindow.windowed,
    page: options.page,
    pageSize: Math.max(1, finiteNumber(options.pageSize, 1)),
    reason: options.reason,
  }
}
