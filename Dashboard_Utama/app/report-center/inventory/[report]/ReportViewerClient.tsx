'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Expand,
  FileSpreadsheet,
  FileText,
  Loader2,
  Minimize2,
  Printer,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  XCircle,
} from 'lucide-react'
import AiDynamicDashboard from '@/components/report/AiDynamicDashboard'
import { getInventoryReport, liveInventoryReports, type InventoryReport } from '@/lib/reports/inventory/config'
import type { AiDashboardDefinition } from '@/lib/reports/ai-dashboard'
import {
  buildReportTableGroups,
  buildReportTableRows,
  compactReportPayloadForAi,
  normalizeReportTableWindow,
  selectSubtotalColumns,
  type ReportTableRenderRow,
} from '@/lib/reports/report-detail-performance'
import { useReportStore } from '@/store/reportStore'
import type { ReportColumnFilter, ReportColumnOperator, ReportFilterInput } from '@/lib/reports/report-filtering'

type DbRow = Record<string, unknown>

type ReportPayload = {
  title: string
  description: string
  rows: DbRow[]
  columns: string[]
  summary: DbRow
  chart?: DbRow[]
  metadata: DbRow
  totalRows?: number
}

type ApiResponse = {
  success: boolean
  data?: ReportPayload
  error?: string
}

type ReportSource = 'estate' | 'pabrik'
type InsightTab = 'ai' | 'charts' | 'quality' | 'metadata' | 'recommendations'
type TableDensity = 'compact' | 'comfortable'
const REPORT_SOURCE_STORAGE_KEY = 'report-center:last-source'

type ReportSchemaColumn = {
  field: string
  label?: string
  type?: string
  aggregatable?: boolean
}

type ManualColumnType = 'number' | 'date' | 'boolean' | 'string'

type DynamicFilterColumn = {
  field: string
  label: string
  type: ManualColumnType
  options: string[]
}

type ReportKpiCard = {
  label: string
  value: unknown
  description: string
  tone: string
}

type ReportPreset = {
  label: string
  description: string
  filters: ReportFilterInput
}

type ReportViewerProfile = {
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
  kpiBuilder: (payload: ReportPayload) => ReportKpiCard[]
  qualityBuilder: (payload: ReportPayload | null, rows: DbRow[]) => Array<[string, unknown]>
  topRowsBuilder: (rows: DbRow[]) => DbRow[]
}

type NaturalFilterResponse = {
  success: boolean
  filters?: ReportFilterInput
  explanation?: string
  provider?: string
  model?: string
  warning?: string
  error?: string
}

const columnOperators: Array<{ value: ReportColumnOperator; label: string }> = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: '=' },
  { value: 'notEquals', label: '!=' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'between', label: 'Between' },
  { value: 'blank', label: 'Kosong' },
  { value: 'notBlank', label: 'Tidak kosong' },
]

const AUTO_GROUP = '__auto__'
const NO_GROUP = '__none__'
const STOCK_AGING_REPORT_IDS = new Set(['item-movement-update-tracking', 'item-stale-update'])
const MOVEMENT_ANALYSIS_REPORT_IDS = new Set(['all-stock-movement-analysis'])
const ASSET_VALUATION_REPORT_IDS = new Set(['asset-stock-valuasi-listing'])
const EMPTY_COLUMNS: string[] = []
const TABLE_FIRST_LIMIT = 500

const genericTechnicalColumns = new Set([
  'raw_status',
  'technical_id',
  'source_table',
  'period_data_source',
  'ActualPeriodStart',
])

const periodContextColumns = [
  'report_id',
  'source_report_title',
  'accounting_period',
  'actual_period',
  'acc_year',
  'acc_month',
  'actual_year',
  'actual_month',
  'period_data_source',
]

const stockAgingBusinessColumns = [
  'RiskLevel',
  'AgingBucket',
  'MovementCategory',
  'KodeBarang',
  'NamaBarang',
  'RecommendedAction',
  'Gudang',
  'Kategori',
  'QuantityClosing',
  'MovementEventCountAll',
  'MovementQtyAll',
  'MovementAmountAll',
  'LastMovementDate',
  'StockIssueEventCount',
  'StockIssueQtyAllPeriod',
  'StockIssueAmountAllPeriod',
  'LastStockIssueDate',
  'MovementEvent1',
  'MovementEvent2',
  'StockIssueEvent1',
  'StockIssueEvent2',
  'StokAkhir',
  'NilaiStok',
  'TotalAmount',
  'UmurBulan',
  'LastUpdateDate',
  'IssueSummary',
]

const stockAgingTechnicalColumns = new Set([
  ...periodContextColumns,
  'FlagStokNol',
  'FlagTanpaKategori',
  'FlagTanpaIssueValid',
  'product_type_code',
  'product_type_description',
  'product_category_code',
  'stock_analysis_code',
  'location',
  'item_code',
  'description',
  'uom',
  'quantity_on_hand',
  'quantity_on_hold',
  'quantity_on_order',
  'total_quantity',
  'unit_cost',
  'total_amount',
  'raw_status',
  'technical_id',
  'source_table',
  'period_data_source',
  'ActualPeriodStart',
])

const stockAgingKpiPresetByLabel: Record<string, string> = {
  'Update <= 3 Bulan': 'Update <= 3 Bulan',
  'Update 6-12 Bulan': 'Update 6-12 Bulan',
  'Tidak Update > 12 Bulan': 'Tidak Update > 12 Bulan',
  'Tidak Update > 24 Bulan': 'Tidak Update > 24 Bulan',
  'Stok Nol': 'Stok Nol',
  'Tanpa Kategori': 'Tanpa Kategori',
}

const stockAgingVisibleColumns = [
  'RiskLevel',
  'AgingBucket',
  'UmurTahun',
  'UmurBulan',
  'KodeBarang',
  'NamaBarang',
  'Gudang',
  'KodeKategori',
  'ItemCurrent',
  'AmountCurrent',
  'QuantityClosing',
  'MovementCategory',
  'StaleMovementRelation',
  'StockIssueEventCount',
  'JumlahStockIssue',
  'StockIssueQtyAllPeriod',
  'JumlahQtyStockIssue',
  'StockIssueAmountAllPeriod',
  'JumlahAmountStockIssue',
  'LastStockIssueDate',
  'MovementEventCountAll',
  'JumlahMovement',
  'MovementQtyAll',
  'JumlahQtyMovement',
  'MovementAmountAll',
  'JumlahAmountMovement',
  'LastMovementDate',
  'MovementAgeDays',
  'MovementGapQty',
  'MovementEvent1',
  'MovementEvent2',
  'StockIssueEvent1',
  'StockIssueEvent2',
  'MovementGapQty',
  'LastMovementDate',
  'MovementEventCountAll',
  'MovementQtyAll',
  'MovementAmountAll',
  'MovementEvent1',
  'MovementEvent2',
  'StockIssueQtyAllPeriod',
  'StockIssueAmountAllPeriod',
  'StockIssueEventCount',
  'LastStockIssueDate',
  'StockIssueEvent1',
  'StockIssueEvent2',
  'HargaSatuan',
  'TotalAmount',
  'LastUpdateDate',
  'IssueSummary',
]

const stockAgingPresets: ReportPreset[] = [
  { label: 'Semua Item', description: 'Reset update aging', filters: { stale: 'semua' } },
  { label: 'Update <= 3 Bulan', description: 'Update terakhir <= 3 bulan', filters: { stale: 'active' } },
  { label: 'Update 3-6 Bulan', description: 'Update terakhir 3-6 bulan', filters: { stale: 'watch' } },
  { label: 'Update 6-12 Bulan', description: 'Update terakhir 6-12 bulan', filters: { stale: 'slow-moving' } },
  { label: 'Tidak Update > 12 Bulan', description: 'Update terakhir > 1 tahun', filters: { stale: 'lebih-1-tahun' } },
  { label: 'Tidak Update > 24 Bulan', description: 'Update terakhir > 2 tahun', filters: { stale: 'dead-stock' } },
  { label: 'Stok Nol', description: 'QuantityClosing = 0', filters: { stale: 'semua', columnFilters: [{ field: 'QuantityClosing', operator: 'equals', value: 0 }] } },
  { label: 'Tanpa Kategori', description: 'Kategori kosong/invalid', filters: { stale: 'semua', columnFilters: [{ field: 'KodeKategori', operator: 'blank' }] } },
  { label: 'Nilai Stok Tinggi', description: 'Prioritas nilai terbesar', filters: { stale: 'semua', sortColumn: 'TotalAmount', sortDirection: 'desc', resultLimit: 100 } },
  { label: 'Perlu Review', description: 'Risk score tertinggi', filters: { stale: 'lebih-1-tahun', sortColumn: 'RiskScore', sortDirection: 'desc', resultLimit: 100 } },
]

const stockAgingManualFilterColumns = [
  'RiskLevel',
  'AgingBucket',
  'Gudang',
  'KodeKategori',
  'KodeBarang',
  'NamaBarang',
  'UmurTahun',
  'ItemCurrent',
  'AmountCurrent',
  'QuantityClosing',
  'MovementCategory',
  'StaleMovementRelation',
  'StockIssueEventCount',
  'JumlahStockIssue',
  'StockIssueQtyAllPeriod',
  'JumlahQtyStockIssue',
  'StockIssueAmountAllPeriod',
  'JumlahAmountStockIssue',
  'LastStockIssueDate',
  'MovementEventCountAll',
  'JumlahMovement',
  'MovementQtyAll',
  'JumlahQtyMovement',
  'MovementAmountAll',
  'JumlahAmountMovement',
  'LastMovementDate',
  'MovementAgeDays',
  'MovementGapQty',
  'MovementEvent1',
  'MovementEvent2',
  'StockIssueEvent1',
  'StockIssueEvent2',
  'MovementGapQty',
  'LastMovementDate',
  'MovementEventCountAll',
  'MovementQtyAll',
  'MovementAmountAll',
  'MovementEvent1',
  'MovementEvent2',
  'StockIssueQtyAllPeriod',
  'StockIssueAmountAllPeriod',
  'StockIssueEventCount',
  'LastStockIssueDate',
  'StockIssueEvent1',
  'StockIssueEvent2',
  'HargaSatuan',
  'TotalAmount',
  'LastUpdateDate',
  'IssueSummary',
]

const movementAnalysisBusinessColumns = [
  'MovementCategory',
  'KodeBarang',
  'NamaBarang',
  'Gudang',
  'KodeKategori',
  'Kategori',
  'ItemTypeName',
  'Satuan',
  'QtyOnHand',
  'QtyOnHold',
  'QtyOnHandHold',
  'AverageCost',
  'AmountItem',
  'QuantityClosing',
  'StockIssueMovementCount',
  'StockIssueMovementQty',
  'StockIssueMovementAmount',
  'LastStockIssueMovementDate',
  'StockIssueMovementGapQty',
  'MovementAnalysis',
  'StockIssueMovementEvent1',
  'StockIssueMovementEvent2',
]

const movementAnalysisTechnicalColumns = new Set([
  ...periodContextColumns,
  'RiskLevel',
  'RiskScore',
  'RecommendedAction',
  'AgingBucket',
  'UmurBulan',
  'UmurTahun',
  'StaleMovementRelation',
  'StockIssueEventCount',
  'JumlahStockIssue',
  'StockIssueQtyAllPeriod',
  'JumlahQtyStockIssue',
  'StockIssueAmountAllPeriod',
  'JumlahAmountStockIssue',
  'LastStockIssueDate',
  'MovementEventCountAll',
  'JumlahMovement',
  'MovementQtyAll',
  'JumlahQtyMovement',
  'MovementAmountAll',
  'JumlahAmountMovement',
  'LastMovementDate',
  'MovementAgeDays',
  'MovementGapQty',
  'MovementEvent1',
  'MovementEvent2',
  'StockIssueEvent1',
  'StockIssueEvent2',
  'IssueSummary',
  'LastUpdateDate',
  'TerakhirUpdate',
  'HariTidakUpdate',
  'KelompokUpdate',
  'product_type_code',
  'product_type_description',
  'product_category_code',
  'stock_analysis_code',
  'location',
  'item_code',
  'description',
  'uom',
  'quantity_on_hand',
  'quantity_on_hold',
  'quantity_on_order',
  'total_quantity',
  'unit_cost',
  'total_amount',
  'raw_status',
  'technical_id',
  'source_table',
  'period_data_source',
  'ActualPeriodStart',
])
const assetValuationBusinessColumns = [
  'product_type_code',
  'product_type_description',
  'location',
  'item_code',
  'description',
  'uom',
  'quantity_on_hand',
  'quantity_on_hold',
  'total_quantity',
  'unit_cost',
  'differential_unit_cost',
  'total_amount',
  'product_category_code',
  'product_brand_code',
  'stock_analysis_code',
]

const assetValuationTechnicalColumns = new Set([
  ...genericTechnicalColumns,
  ...periodContextColumns,
])

function uniqueValues(rows: DbRow[], field: string, cache?: Map<string, string[]>) {
  if (cache) {
    const cached = cache.get(field)
    if (cached) return cached
  }
  const values = new Set<string>()
  rows.slice(0, 500).forEach((row) => {
    const value = row[field]
    if (value === null || value === undefined || value === '') return
    const text = String(value).trim()
    if (!text || text.length > 60) return
    values.add(text)
  })
  const result = [...values].sort((a, b) => a.localeCompare(b, 'id-ID', { numeric: true }))
  if (cache) cache.set(field, result)
  return result
}

function inferManualColumnType(field: string, schemaColumns: ReportSchemaColumn[], rows: DbRow[]): ManualColumnType {
  const schemaType = schemaColumns.find((column) => column.field === field)?.type
  if (schemaType === 'number' || schemaType === 'date' || schemaType === 'boolean') return schemaType
  if (/date|tanggal|update|periode|period|time/i.test(field)) return 'date'

  const sample = rows
    .slice(0, 30)
    .map((row) => row[field])
    .filter((value) => value !== null && value !== undefined && value !== '')
  if (sample.length > 0 && sample.every((value) => typeof value === 'number' || (typeof value === 'string' && /^-?\d+(?:[.,]\d+)?$/.test(value.trim())))) return 'number'
  return 'string'
}

function operatorsForManualType(type: ManualColumnType) {
  const allowed =
    type === 'number' || type === 'date'
      ? ['equals', 'gt', 'gte', 'lt', 'lte', 'between', 'blank', 'notBlank']
      : type === 'boolean'
        ? ['equals', 'notEquals', 'blank', 'notBlank']
        : ['contains', 'equals', 'notEquals', 'blank', 'notBlank']
  return columnOperators.filter((operator) => allowed.includes(operator.value))
}

function defaultOperatorForManualType(type: ManualColumnType, hasOptions = false): ReportColumnOperator {
  if (hasOptions) return 'equals'
  if (type === 'number' || type === 'date') return 'gte'
  return 'contains'
}

function coerceManualFilterValue(value: string, type: ManualColumnType) {
  if (!value) return undefined
  if (type !== 'number') return value
  const numeric = Number(value.replace(',', '.'))
  return Number.isFinite(numeric) ? numeric : undefined
}

function normalizeSource(value: string | null): ReportSource {
  return value === 'pabrik' ? 'pabrik' : 'estate'
}

function sourceLabel(source: ReportSource) {
  return source === 'pabrik' ? 'Pabrik' : 'Estate / Kebun'
}

function sourceDescription(source: ReportSource) {
  return source === 'pabrik' ? 'SERVER_PROFILE_3 / db_ptrj_mill' : 'SERVER_PROFILE_2 / db_ptrj'
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') return value.toLocaleString('id-ID')
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
    }
    return value
  }
  return String(value)
}

function displayColumnLabel(field: string) {
  if (field === 'acc_year') return 'AccYear'
  if (field === 'acc_month') return 'AccMonth'
  if (field === 'report_id') return 'Report ID'
  if (field === 'source_report_title') return 'Source Report'
  if (field === 'accounting_period') return 'Accounting Period'
  if (field === 'actual_year') return 'Actual Year'
  if (field === 'actual_month') return 'Actual Month'
  if (field === 'actual_period') return 'Actual Period'
  if (field === 'period_data_source') return 'Period Data Source'
  if (field === 'product_type_code') return 'Product Type Code'
  if (field === 'product_type_description') return 'Product Type Description'
  if (field === 'item_code') return 'Item Code'
  if (field === 'quantity_on_hand') return 'Quantity On Hand'
  if (field === 'quantity_on_hold') return 'Quantity On Hold'
  if (field === 'total_quantity') return 'Total Quantity'
  if (field === 'unit_cost') return 'Unit Cost'
  if (field === 'differential_unit_cost') return 'Differential Unit Cost'
  if (field === 'total_amount') return 'Total Amount'
  if (field === 'RecommendedAction') return 'Recommended Action'
  if (field === 'StokAkhir') return 'Stok Akhir'
  if (field === 'NilaiStok') return 'Nilai Stok'
  if (field === 'RiskLevel') return 'Risk Level'
  if (field === 'RiskScore') return 'Risk Score'
  if (field === 'AgingBucket') return 'Aging Bucket'
  if (field === 'UmurBulan') return 'Umur Bulan'
  if (field === 'KodeBarang') return 'Kode Barang'
  if (field === 'NamaBarang') return 'Nama Barang'
  if (field === 'KodeKategori') return 'Kode Kategori'
  if (field === 'IssueSummary') return 'Issue Summary'
  if (field === 'ItemCurrent') return 'Item Current'
  if (field === 'AmountCurrent') return 'Amount Current'
  if (field === 'AmountItem') return 'Asset Amount Real Time'
  if (field === 'QtyOnHand') return 'Qty On Hand'
  if (field === 'QtyOnHold') return 'Qty On Hold'
  if (field === 'QtyOnHandHold') return 'Qty On Hand + On Hold'
  if (field === 'AverageCost') return 'Average Cost'
  if (field === 'QuantityClosing') return 'Quantity Closing'
  if (field === 'MovementCategory') return 'Movement Category'
  if (field === 'StaleMovementRelation') return 'Movement Analysis'
  if (field === 'MovementAnalysis') return 'StockIssue Movement Analysis'
  if (field === 'StockIssueMovementCount') return 'StockIssue Movement Count'
  if (field === 'StockIssueMovementQty') return 'StockIssue Movement Qty'
  if (field === 'StockIssueMovementAmount') return 'StockIssue Movement Amount Transaksi'
  if (field === 'LastStockIssueMovementDate') return 'Last StockIssue Movement Date'
  if (field === 'StockIssueMovementAgeDays') return 'StockIssue Movement Age Days'
  if (field === 'StockIssueMovementGapQty') return 'StockIssue Movement Gap Qty'
  if (field === 'StockIssueMovementEvent1') return 'StockIssue Movement Event 1'
  if (field === 'StockIssueMovementEvent2') return 'StockIssue Movement Event 2'
  if (field === 'JumlahStockIssue') return 'Jumlah Stock Issue'
  if (field === 'JumlahQtyStockIssue') return 'Jumlah Qty Stock Issue'
  if (field === 'JumlahAmountStockIssue') return 'Jumlah Amount Stock Issue'
  if (field === 'JumlahMovement') return 'Jumlah Movement'
  if (field === 'JumlahQtyMovement') return 'Jumlah Qty Movement'
  if (field === 'JumlahAmountMovement') return 'Jumlah Amount Movement'
  if (field === 'MovementGapQty') return 'Movement Gap Qty'
  if (field === 'LastMovementDate') return 'Last Movement Date'
  if (field === 'MovementEventCountAll') return 'Movement Event All Period'
  if (field === 'MovementQtyAll') return 'Movement Qty All Period'
  if (field === 'MovementAmountAll') return 'Movement Amount All Period'
  if (field === 'MovementAgeDays') return 'Movement Age Days'
  if (field === 'MovementEvent1') return 'Latest Movement 1'
  if (field === 'MovementEvent2') return 'Latest Movement 2'
  if (field === 'StockIssueQtyAllPeriod') return 'Stock Issue Qty All Period'
  if (field === 'StockIssueAmountAllPeriod') return 'Stock Issue Amount All Period'
  if (field === 'StockIssueEventCount') return 'Stock Issue Event Count'
  if (field === 'LastStockIssueDate') return 'Last Stock Issue Date'
  if (field === 'StockIssueEvent1') return 'Stock Issue Event 1'
  if (field === 'StockIssueEvent2') return 'Stock Issue Event 2'
  return field
}

function compactMetric(value: unknown) {
  const numeric = toNumber(value)
  if (!numeric) return formatValue(value)
  const abs = Math.abs(numeric)
  if (abs >= 1_000_000_000) return `${(numeric / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}B`
  if (abs >= 1_000_000) return `${(numeric / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}M`
  if (abs >= 1_000) return `${(numeric / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}K`
  return numeric.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function stockAgingKpis(summary: DbRow, rows: DbRow[] = []) {
  const fromRows = summary.TotalItem === undefined && rows.length > 0
  const totalItem = fromRows ? rows.length : summary.TotalItem
  const itemAktif = fromRows ? rows.filter((row) => toNumber(row.UmurBulan) <= 3).length : summary.ItemAktif
  const slowMoving = fromRows ? rows.filter((row) => toNumber(row.UmurBulan) > 6 && toNumber(row.UmurBulan) <= 12).length : summary.SlowMoving
  const stale = fromRows ? rows.filter((row) => toNumber(row.UmurBulan) >= 12).length : summary.StaleLebih12Bulan
  const dead = fromRows ? rows.filter((row) => toNumber(row.UmurBulan) >= 24).length : summary.DeadStockLebih24Bulan
  const riskyValue = fromRows ? rows.filter((row) => toNumber(row.UmurBulan) >= 12).reduce((sum, row) => sum + (toNumber(row.TotalAmount) || toNumber(row.NilaiStok)), 0) : summary.NilaiStokBerisiko
  const zeroStock = fromRows ? rows.filter((row) => toNumber(row.QuantityClosing ?? row.StokAkhir) === 0).length : summary.ItemStokNol
  const fastMovement = rows.filter((row) => String(row.MovementCategory ?? '').toLowerCase().includes('fast')).length
  const slowMovement = rows.filter((row) => String(row.MovementCategory ?? '').toLowerCase().includes('slow')).length
  const deadMovement = rows.filter((row) => String(row.MovementCategory ?? '').toLowerCase().includes('dead')).length
  const noCategory = fromRows
    ? rows.filter((row) => {
        const category = String(row.KodeKategori ?? row.Kategori ?? '').trim()
        return !category || category === '-' || category === '0'
      }).length
    : summary.ItemTanpaKategori

  return [
    { label: 'Total Item', value: totalItem, description: 'Total item aktif', tone: 'border-blue-100 bg-blue-50 text-blue-700' },
    { label: 'Update <= 3 Bulan', value: itemAktif, description: 'Update terakhir <= 3 bulan', tone: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
    { label: 'Update 6-12 Bulan', value: slowMoving, description: 'Update terakhir 6-12 bulan', tone: 'border-yellow-100 bg-yellow-50 text-yellow-700' },
    { label: 'Tidak Update > 12 Bulan', value: stale, description: 'Update terakhir > 1 tahun', tone: 'border-orange-100 bg-orange-50 text-orange-700' },
    { label: 'Tidak Update > 24 Bulan', value: dead, description: 'Update terakhir > 2 tahun', tone: 'border-red-100 bg-red-50 text-red-700' },
    { label: 'Nilai Stok Berisiko', value: riskyValue, description: 'Nilai update aging berisiko', tone: 'border-red-100 bg-red-50 text-red-700' },
    { label: 'Stok Nol', value: zeroStock, description: 'Quantity closing 0', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
    { label: 'Fast Moving', value: fastMovement, description: 'Movement seluruh periode tinggi', tone: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
    { label: 'Slow Moving Qty', value: slowMovement, description: 'Movement seluruh periode rendah', tone: 'border-yellow-100 bg-yellow-50 text-yellow-700' },
    { label: 'Dead Movement', value: deadMovement, description: 'Last movement > 24 bulan', tone: 'border-red-100 bg-red-50 text-red-700' },
    { label: 'Tanpa Kategori', value: noCategory, description: 'Master kategori kosong', tone: 'border-purple-100 bg-purple-50 text-purple-700' },
  ]
}

function movementAnalysisKpis(summary: DbRow, rows: DbRow[] = []) {
  const countByCategory = (category: string) => rows.filter((row) => String(row.MovementCategory ?? '') === category).length
  const amountByCategory = (category: string) => rows
    .filter((row) => String(row.MovementCategory ?? '') === category)
    .reduce((sum, row) => sum + toNumber(row.AmountItem ?? row.TotalAmount), 0)
  const itemCount = (summary.TotalItem ?? rows.length) as unknown
  const categoryCard = (label: string, itemKey: string, amountKey: string, tone: string) => {
    const itemValue = summary[itemKey] ?? countByCategory(label)
    const amountValue = summary[amountKey] ?? amountByCategory(label)
    return {
      label,
      value: amountValue,
      description: `${formatValue(itemValue)} item | asset real-time`,
      tone,
    }
  }

  return [
    { label: 'Asset Amount Real Time', value: summary.TotalAssetAmount ?? summary.TotalAmount, description: `${formatValue(itemCount)} item dari IN_ITEM`, tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    { label: 'Total Item', value: itemCount, description: 'Semua ItemType 1 dan 4', tone: 'border-blue-100 bg-blue-50 text-blue-700' },
    categoryCard('Fast Moving', 'FastMovingItem', 'FastMovingAmount', 'border-emerald-100 bg-emerald-50 text-emerald-700'),
    categoryCard('Moving', 'MovingItem', 'MovingAmount', 'border-blue-100 bg-blue-50 text-blue-700'),
    categoryCard('Slow Moving', 'SlowMovingItem', 'SlowMovingAmount', 'border-yellow-100 bg-yellow-50 text-yellow-700'),
    categoryCard('Dead Stock', 'DeadMovementItem', 'DeadMovementAmount', 'border-red-100 bg-red-50 text-red-700'),
    categoryCard('No Movement', 'NoMovementItem', 'NoMovementAmount', 'border-slate-200 bg-slate-50 text-slate-700'),
    { label: 'StockIssue Movement', value: summary.TotalStockIssueMovementCount ?? rows.reduce((sum, row) => sum + toNumber(row.StockIssueMovementCount), 0), description: 'Jumlah transaksi movement', tone: 'border-amber-100 bg-amber-50 text-amber-700' },
  ]
}

function movementAnalysisQualityItems(payload: ReportPayload | null, rows: DbRow[]): Array<[string, unknown]> {
  return [
    ['Fast Moving', payload?.summary.FastMovingItem ?? rows.filter((row) => String(row.MovementCategory ?? '') === 'Fast Moving').length],
    ['Moving', payload?.summary.MovingItem ?? rows.filter((row) => String(row.MovementCategory ?? '') === 'Moving').length],
    ['Slow Moving', payload?.summary.SlowMovingItem ?? rows.filter((row) => String(row.MovementCategory ?? '') === 'Slow Moving').length],
    ['No Movement', payload?.summary.NoMovementItem ?? rows.filter((row) => String(row.MovementCategory ?? '') === 'No Movement').length],
    ['Dead Stock', payload?.summary.DeadMovementItem ?? rows.filter((row) => String(row.MovementCategory ?? '') === 'Dead Stock').length],
    ['Total StockIssue Movement', payload?.summary.TotalStockIssueMovementCount ?? rows.reduce((sum, row) => sum + toNumber(row.StockIssueMovementCount), 0)],
  ]
}

function movementAnalysisTopItems(rows: DbRow[]) {
  return [...rows]
    .sort((a, b) => toNumber(b.StockIssueMovementCount) - toNumber(a.StockIssueMovementCount))
    .slice(0, 10)
}
function assetValuationKpis(summary: DbRow, metadata: DbRow = {}, rows: DbRow[] = []) {
  const rowQtyOnHand = rows.reduce((sum, row) => sum + toNumber(row.quantity_on_hand), 0)
  const rowQtyOnHold = rows.reduce((sum, row) => sum + toNumber(row.quantity_on_hold), 0)
  const rowTotalQty = rowQtyOnHand + rowQtyOnHold
  return [
    { label: 'AccYear', value: summary.acc_year ?? metadata.accYear, description: 'Tahun accounting', tone: 'bg-[#1A1A1A] text-white' },
    { label: 'AccMonth', value: summary.acc_month ?? metadata.accMonth, description: 'Bulan accounting', tone: 'bg-[#1A1A1A] text-white' },
    { label: 'Actual Period', value: summary.actual_period ?? metadata.actualPeriod ?? metadata.period, description: 'Hasil konversi periode', tone: 'bg-[#0F2B1A] text-white' },
    { label: 'Total Quantity', value: summary.total_quantity ?? summary.TotalQty ?? rowTotalQty, description: 'On hand + on hold', tone: 'bg-emerald-50 text-emerald-800' },
    { label: 'Qty On Hand', value: summary.total_quantity_on_hand ?? rowQtyOnHand, description: 'Quantity on hand', tone: 'bg-blue-50 text-blue-800' },
    { label: 'Qty On Hold', value: summary.total_quantity_on_hold ?? rowQtyOnHold, description: 'Quantity on hold', tone: 'bg-amber-50 text-amber-800' },
    { label: 'Total Amount', value: summary.total_amount ?? summary.TotalAmount, description: 'Nilai valuasi stock', tone: 'bg-slate-100 text-slate-900' },
    { label: 'Total Item', value: summary.total_item ?? summary.FilteredRows, description: 'Item aktif 1/4', tone: 'bg-white text-slate-900' },
  ]
}

function genericKpis(payload: ReportPayload): ReportKpiCard[] {
  return Object.entries(payload.summary).slice(0, 8).map(([label, value]) => ({
    label: displayColumnLabel(label),
    value,
    description: 'Summary report',
    tone: 'border-white/10 bg-[#1A1A1A] text-white',
  }))
}

function genericQualityItems(payload: ReportPayload | null, rows: DbRow[]): Array<[string, unknown]> {
  return [
    ['Rows tampil', rows.length],
    ['Rows payload', payload?.rows.length ?? 0],
    ['Kolom', payload?.columns.length ?? 0],
    ['Filter aktif', payload?.metadata?.filteredRows ?? rows.length],
  ]
}

function genericTopRows(rows: DbRow[]) {
  return [...rows].sort((a, b) => numericValue(b) - numericValue(a)).slice(0, 10)
}

function stockAgingQualityItems(payload: ReportPayload | null, rows: DbRow[]): Array<[string, unknown]> {
  return [
    ['Stok Nol', payload?.summary.ItemStokNol ?? rows.filter((row) => toNumber(row.QuantityClosing ?? row.StokAkhir) === 0).length],
    ['Tanpa Kategori', payload?.summary.ItemTanpaKategori ?? rows.filter((row) => !String(row.KodeKategori ?? row.Kategori ?? '').trim()).length],
    ['Tidak Update > 12 Bulan', payload?.summary.StaleLebih12Bulan ?? rows.filter((row) => toNumber(row.UmurBulan) >= 12).length],
    ['Tidak Update > 24 Bulan', payload?.summary.DeadStockLebih24Bulan ?? rows.filter((row) => toNumber(row.UmurBulan) >= 24).length],
    ['Critical Risk', rows.filter((row) => String(row.RiskLevel ?? '').toLowerCase() === 'critical').length],
  ]
}

function getReportViewerProfile(reportId: string): ReportViewerProfile {
  const baseProfile: ReportViewerProfile = {
    presets: [],
    preferredGroupColumns: ['Gudang', 'Location', 'SupplierName', 'SupplierCode', 'Kendaraan', 'KodeBarang', 'ItemCode', 'item_code'],
    technicalColumns: genericTechnicalColumns,
    naturalPlaceholder: 'Contoh: Amount 1000 sampai 5000, sort Gudang desc, row 50-100',
    presetTitle: 'Quick Preset',
    rowDetail: 'generic',
    topRowsTitle: 'Priority Rows',
    kpiBuilder: genericKpis,
    qualityBuilder: genericQualityItems,
    topRowsBuilder: genericTopRows,
    defaultSort: (columns) => {
      const preferred = ['RiskScore', 'TotalAmount', 'total_amount', 'NilaiStok', 'Amount', 'amount'].find((column) => columns.includes(column))
      return preferred ? { column: preferred, direction: 'desc' as const } : null
    },
  }

  if (MOVEMENT_ANALYSIS_REPORT_IDS.has(reportId)) {
    return {
      ...baseProfile,
      reportIds: MOVEMENT_ANALYSIS_REPORT_IDS,
      businessColumns: movementAnalysisBusinessColumns,
      fallbackColumns: movementAnalysisBusinessColumns,
      technicalColumns: movementAnalysisTechnicalColumns,
      manualFilterColumns: movementAnalysisBusinessColumns,
      preferredGroupColumns: ['Gudang', 'KodeKategori', 'MovementCategory', 'KodeBarang', ...baseProfile.preferredGroupColumns],
      presets: [
        { label: 'Semua Item', description: 'Reset filter movement', filters: { stale: 'semua' } },
        { label: 'Fast Moving', description: 'StockIssue >= 6 event', filters: { stale: 'semua', columnFilters: [{ field: 'MovementCategory', operator: 'equals', value: 'Fast Moving' }] } },
        { label: 'Moving', description: 'StockIssue 2-5 event', filters: { stale: 'semua', columnFilters: [{ field: 'MovementCategory', operator: 'equals', value: 'Moving' }] } },
        { label: 'Slow Moving', description: 'StockIssue 1 event', filters: { stale: 'semua', columnFilters: [{ field: 'MovementCategory', operator: 'equals', value: 'Slow Moving' }] } },
        { label: 'Dead Stock', description: 'Stok ada, 0 movement', filters: { stale: 'semua', columnFilters: [{ field: 'MovementCategory', operator: 'equals', value: 'Dead Stock' }] } },
        { label: 'No Movement', description: 'Stok dan movement 0', filters: { stale: 'semua', columnFilters: [{ field: 'MovementCategory', operator: 'equals', value: 'No Movement' }] } },
        { label: 'Nilai Stok Tinggi', description: 'Prioritas nilai terbesar', filters: { stale: 'semua', sortColumn: 'AmountItem', sortDirection: 'desc', resultLimit: 100 } },
        { label: 'Gudang Tertentu', description: 'Filter per gudang/lokasi', filters: { stale: 'semua', groupBy: 'Gudang' } },
      ],
      maxInitialColumns: 32,
      showAccountingPeriodFilter: true,
      naturalPlaceholder: 'Contoh: group by movement category, fast moving, stock issue event > 5, sort movement event desc',
      presetTitle: 'Quick Preset Movement',
      rowDetail: 'movement',
      topRowsTitle: 'Top Movement Items',
      kpiBuilder: (payload) => movementAnalysisKpis(payload.summary, payload.rows),
      qualityBuilder: movementAnalysisQualityItems,
      topRowsBuilder: movementAnalysisTopItems,
      defaultSort: (columns) => columns.includes('StockIssueMovementCount') ? { column: 'StockIssueMovementCount', direction: 'desc' as const } : baseProfile.defaultSort?.(columns) ?? null,
    }
  }

  if (STOCK_AGING_REPORT_IDS.has(reportId)) {
    return {
      ...baseProfile,
      reportIds: STOCK_AGING_REPORT_IDS,
      businessColumns: stockAgingBusinessColumns,
      fallbackColumns: stockAgingVisibleColumns,
      technicalColumns: stockAgingTechnicalColumns,
      manualFilterColumns: stockAgingManualFilterColumns,
      presets: stockAgingPresets,
      kpiPresetByLabel: stockAgingKpiPresetByLabel,
      preferredGroupColumns: ['MovementCategory', 'AgingBucket', 'RiskLevel', 'Gudang', ...baseProfile.preferredGroupColumns],
      loadAllRows: false,
      showAccountingPeriodFilter: true,
      naturalPlaceholder: 'Contoh: tampilkan item yang lebih dari 1 tahun tidak update dan nilai stok terbesar',
      presetTitle: 'Quick Preset Stock Aging',
      rowDetail: 'movement',
      topRowsTitle: 'Top Critical Items',
      kpiBuilder: (payload) => stockAgingKpis(payload.summary, payload.rows),
      qualityBuilder: stockAgingQualityItems,
      topRowsBuilder: stockAgingTopItems,
      defaultSort: (columns) => columns.includes('RiskScore') ? { column: 'RiskScore', direction: 'desc' as const } : baseProfile.defaultSort?.(columns) ?? null,
    }
  }

  if (ASSET_VALUATION_REPORT_IDS.has(reportId)) {
    return {
      ...baseProfile,
      reportIds: ASSET_VALUATION_REPORT_IDS,
      businessColumns: assetValuationBusinessColumns,
      technicalColumns: assetValuationTechnicalColumns,
      tableContextColumns: ['report_id', 'source_report_title', 'acc_year', 'acc_month', 'accounting_period', 'actual_period', 'period_data_source'],
      preferredGroupColumns: ['product_type_code', 'product_type_description', 'actual_period', 'accounting_period', ...baseProfile.preferredGroupColumns],
      loadAllRows: false,
      naturalPlaceholder: 'Contoh: accyear 2027 accmonth 1 group by product type code total amount',
      kpiBuilder: (payload) => assetValuationKpis(payload.summary, payload.metadata, payload.rows),
      defaultSort: (columns) => columns.includes('total_amount')
        ? { column: 'total_amount', direction: 'desc' as const }
        : columns.includes('product_type_code')
          ? { column: 'product_type_code', direction: 'asc' as const }
          : baseProfile.defaultSort?.(columns) ?? null,
    }
  }

  return baseProfile
}

function preferredVisibleColumnsForProfile(profile: ReportViewerProfile, columns: string[]) {
  const preferred = (profile.businessColumns ?? []).filter((column) => columns.includes(column))
  const fallback = (profile.fallbackColumns ?? []).filter((column) => columns.includes(column) && !preferred.includes(column))
  const hidden = profile.technicalColumns ?? genericTechnicalColumns
  const rest = columns.filter((column) => !preferred.includes(column) && !fallback.includes(column) && !hidden.has(column))
  return [...preferred, ...fallback, ...rest].slice(0, profile.maxInitialColumns ?? 16)
}

const contextValueAliases: Record<string, string[]> = {
  report_id: ['report_id', 'sourceReportId', 'reportId'],
  source_report_title: ['source_report_title', 'sourceReportTitle'],
  accounting_period: ['accounting_period', 'accountingPeriod'],
  actual_period: ['actual_period', 'actualPeriod', 'period'],
  acc_year: ['acc_year', 'accYear'],
  acc_month: ['acc_month', 'accMonth'],
  actual_year: ['actual_year', 'actualYear'],
  actual_month: ['actual_month', 'actualMonth'],
  period_data_source: ['period_data_source', 'periodDataSource'],
}

function payloadContextValue(payload: ReportPayload | null, field: string) {
  if (!payload) return undefined
  const keys = contextValueAliases[field] ?? [field]
  for (const source of [payload.summary, payload.metadata]) {
    for (const key of keys) {
      const value = source[key]
      if (value !== null && value !== undefined && value !== '') return value
    }
  }
  return undefined
}

function bucketTone(value: unknown) {
  const text = String(value ?? '').toLowerCase()
  if (text.includes('dead')) return 'border-red-200 bg-red-50 text-red-700'
  if (text.includes('stale')) return 'border-orange-200 bg-orange-50 text-orange-700'
  if (text.includes('slow')) return 'border-yellow-200 bg-yellow-50 text-yellow-700'
  if (text.includes('pantau')) return 'border-blue-200 bg-blue-50 text-blue-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function riskTone(value: unknown) {
  const text = String(value ?? '').toLowerCase()
  if (text === 'critical') return 'border-red-200 bg-red-50 text-red-700'
  if (text === 'high') return 'border-orange-200 bg-orange-50 text-orange-700'
  if (text === 'medium') return 'border-yellow-200 bg-yellow-50 text-yellow-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function movementTone(value: unknown) {
  const text = String(value ?? '').toLowerCase()
  if (text.includes('fast')) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (text === 'moving') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (text.includes('slow')) return 'border-yellow-200 bg-yellow-50 text-yellow-700'
  if (text.includes('dead')) return 'border-red-200 bg-red-50 text-red-700'
  if (text.includes('no movement')) return 'border-slate-200 bg-slate-50 text-slate-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function renderReportCell(column: string, value: unknown) {
  if (column === 'RiskLevel') {
    return <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${riskTone(value)}`}>{formatValue(value)}</span>
  }
  if (column === 'AgingBucket') {
    return <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${bucketTone(value)}`}>{formatValue(value)}</span>
  }
  if (column === 'MovementCategory') {
    return <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${movementTone(value)}`}>{formatValue(value)}</span>
  }
  if (column === 'StaleMovementRelation') {
    return <span className="block max-w-[260px] whitespace-normal leading-5">{formatValue(value)}</span>
  }
  if (column === 'IssueSummary') {
    const issues = String(value ?? '')
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3)
    if (!issues.length) return <span className="text-slate-400">-</span>
    return (
      <span className="flex flex-wrap gap-1">
        {issues.map((issue) => (
          <span key={issue} className="rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">{issue}</span>
        ))}
      </span>
    )
  }
  if (/^(StockIssueEvent|MovementEvent)\d+$/.test(column)) {
    return <span className="block max-w-[360px] whitespace-normal leading-5">{formatValue(value)}</span>
  }
  return formatValue(value)
}

function movementRowKey(row: DbRow, fallback: string) {
  return [
    row.KodeBarang,
    row.Gudang,
    row.LastUpdateDate ?? row.TerakhirUpdate,
    row.LastMovementDate,
    fallback,
  ].map((value) => String(value ?? '').trim()).join('|')
}

function ReportRowDetail({ row, columns, colSpan, mode }: { row: DbRow; columns: string[]; colSpan: number; mode: ReportViewerProfile['rowDetail'] }) {
  const genericDetails: Array<[string, unknown]> = columns
    .filter((column) => row[column] !== null && row[column] !== undefined && row[column] !== '')
    .slice(0, 12)
    .map((column): [string, unknown] => [displayColumnLabel(column), row[column]])

  const movementMetrics = ([
    ['Movement Category', row.MovementCategory],
    ['Movement Analysis', row.MovementAnalysis ?? row.StaleMovementRelation],
    ['Movement Gap Qty', row.MovementGapQty],
    ['Last Movement Date', row.LastMovementDate],
    ['Movement Age Days', row.MovementAgeDays],
    ['StockIssue Movement Count', row.StockIssueMovementCount],
    ['StockIssue Movement Qty', row.StockIssueMovementQty],
    ['StockIssue Movement Amount', row.StockIssueMovementAmount],
  ] as Array<[string, unknown]>).filter(([, value]) => value !== null && value !== undefined && value !== '')

  const movementEvents = [
    ['StockIssue Movement Event 1', row.StockIssueMovementEvent1],
    ['StockIssue Movement Event 2', row.StockIssueMovementEvent2],
  ] as Array<[string, unknown]>
  const events = mode === 'movement'
    ? movementEvents.filter(([, value]) => value !== null && value !== undefined && value !== '')
    : []

  return (
    <tr className="bg-slate-50">
      <td colSpan={Math.max(colSpan, 1)} className="border-y border-slate-200 px-5 py-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-800">{mode === 'movement' ? 'Movement detail' : 'Row detail'}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(mode === 'movement' && movementMetrics.length > 0 ? movementMetrics : genericDetails).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{formatValue(value)}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-800">{mode === 'movement' ? 'Movement events' : 'Source fields'}</p>
            <div className="mt-3 space-y-2">
              {(events.length > 0 ? events : genericDetails.slice(0, 4)).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 whitespace-normal text-sm font-semibold leading-5 text-slate-800">{formatValue(value)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

function numericValue(row: DbRow) {
  const preferred = [
    'Amount',
    'amount',
    'NilaiFuel',
    'NilaiStok',
    'TotalAmount',
    'total_amount',
    'QtyFuel',
    'Qty',
    'qty',
    'total_quantity',
    'TotalRows',
    'TotalItem',
  ]
  for (const key of preferred) {
    const value = toNumber(row[key])
    if (value) return value
  }
  return Math.max(0, ...Object.values(row).map(toNumber))
}

function groupMetricTotal(rows: DbRow[], keys: string[]) {
  const key = keys.find((item) => rows.some((row) => row[item] !== undefined && row[item] !== null && row[item] !== ''))
  if (!key) return 0
  return rows.reduce((sum, row) => sum + toNumber(row[key]), 0)
}

function stockAgingTopItems(rows: DbRow[]) {
  return [...rows]
    .sort((a, b) => toNumber(b.RiskScore) - toNumber(a.RiskScore) || (toNumber(b.TotalAmount) || toNumber(b.NilaiStok)) - (toNumber(a.TotalAmount) || toNumber(a.NilaiStok)))
    .slice(0, 10)
}

function preferredGroupColumn(columns: string[], profile: ReportViewerProfile, filters: ReportFilterInput) {
  const preferred = [
    filters.groupBy,
    filters.chartDimension,
    ...profile.preferredGroupColumns,
  ].filter(Boolean) as string[]

  return preferred.find((column) => columns.includes(column))
}

function appendFilterParam(params: URLSearchParams, key: keyof ReportFilterInput, value: unknown) {
  if (value === undefined || value === null || value === '') return
  params.set(String(key), String(value))
}

function hasActionableFilters(filters?: ReportFilterInput) {
  if (!filters) return false
  return Object.entries(filters).some(([key, value]) => {
    if (key === 'naturalQuery') return false
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && value !== ''
  })
}

type FetchReportOptions = {
  page?: number
  pageSize?: number
  signal?: AbortSignal
  tableSortColumn?: string
  tableSortDirection?: 'asc' | 'desc'
}

function buildReportParams(report: InventoryReport, source: ReportSource, limit: number | 'all' = 500, filters: ReportFilterInput = {}, options: FetchReportOptions = {}) {
  const params = new URLSearchParams({ report: report.apiReport, limit: String(limit), source })
  if (options.page) params.set('page', String(options.page))
  if (options.pageSize) params.set('pageSize', String(options.pageSize))
  if (options.tableSortColumn) {
    params.set('tableSortColumn', options.tableSortColumn)
    params.set('tableSortDirection', options.tableSortDirection ?? 'asc')
  }
  appendFilterParam(params, 'search', filters.search)
  appendFilterParam(params, 'period', filters.period)
  appendFilterParam(params, 'accYear', filters.accYear)
  appendFilterParam(params, 'accMonth', filters.accMonth)
  appendFilterParam(params, 'actualYear', filters.actualYear)
  appendFilterParam(params, 'actualMonth', filters.actualMonth)
  appendFilterParam(params, 'dateFrom', filters.dateFrom)
  appendFilterParam(params, 'dateTo', filters.dateTo)
  appendFilterParam(params, 'location', filters.location)
  appendFilterParam(params, 'category', filters.category)
  appendFilterParam(params, 'supplier', filters.supplier)
  appendFilterParam(params, 'status', filters.status)
  appendFilterParam(params, 'vehicle', filters.vehicle)
  appendFilterParam(params, 'blankField', filters.blankField)
  appendFilterParam(params, 'minQty', filters.minQty)
  appendFilterParam(params, 'minAmount', filters.minAmount)
  appendFilterParam(params, 'sortMetric', filters.sortMetric)
  appendFilterParam(params, 'sortColumn', filters.sortColumn)
  appendFilterParam(params, 'sortDirection', filters.sortDirection)
  appendFilterParam(params, 'chartDimension', filters.chartDimension)
  appendFilterParam(params, 'groupBy', filters.groupBy)
  appendFilterParam(params, 'aggregateField', filters.aggregateField)
  appendFilterParam(params, 'aggregateFn', filters.aggregateFn)
  appendFilterParam(params, 'top', filters.top)
  appendFilterParam(params, 'resultLimit', filters.resultLimit)
  appendFilterParam(params, 'rowStart', filters.rowStart)
  appendFilterParam(params, 'rowEnd', filters.rowEnd)
  appendFilterParam(params, 'stale', filters.stale)
  appendFilterParam(params, 'analysis', filters.analysis)
  if (filters.columnFilters?.length) params.set('columnFilters', JSON.stringify(filters.columnFilters))
  appendFilterParam(params, 'naturalQuery', filters.naturalQuery)
  return params
}

async function fetchReport(report: InventoryReport, source: ReportSource, limit: number | 'all' = 500, filters: ReportFilterInput = {}, options: FetchReportOptions = {}) {
  const params = buildReportParams(report, source, limit, filters, options)
  const response = await fetch(`/api/reports/inventory?${params.toString()}`, { cache: 'no-store', signal: options.signal })
  const data = (await response.json()) as ApiResponse
  if (!response.ok || !data.success || !data.data) throw new Error(data.error ?? 'Gagal memuat laporan')
  return data.data
}

function isReportPayloadReady(payload: ReportPayload | null) {
  return Boolean(
    payload &&
      Array.isArray(payload.rows) &&
      Array.isArray(payload.columns) &&
      payload.columns.length > 0 &&
      payload.summary &&
      payload.metadata &&
      (payload.metadata.tableReady === undefined || payload.metadata.tableReady === true),
  )
}

function downloadCsv(report: InventoryReport, source: ReportSource, filters: ReportFilterInput) {
  const params = buildReportParams(report, source, 'all', filters)
  params.set('format', 'csv')
  const anchor = document.createElement('a')
  anchor.href = `/api/reports/inventory?${params.toString()}`
  anchor.download = `${report.id}.csv`
  anchor.click()
}

async function exportExcel(report: InventoryReport, source: ReportSource, filters: ReportFilterInput) {
  const payload = await fetchReport(report, source, 'all', filters)
  const rows = payload.rows
  if (rows.length === 0) return
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, report.title.slice(0, 31))
  XLSX.writeFile(workbook, `${report.id}.xlsx`)
}

async function exportPdf(report: InventoryReport, rows: DbRow[], columns: string[]) {
  const { default: JsPDF } = await import('jspdf')
  const doc = new JsPDF({ orientation: 'landscape', unit: 'pt' })
  let y = 46
  const visible = columns.slice(0, 7)
  doc.setFontSize(16)
  doc.text(report.title, 40, y)
  y += 24
  doc.setFontSize(8)
  doc.text(visible.join(' | '), 40, y)
  y += 16
  rows.slice(0, 34).forEach((row) => {
    doc.text(visible.map((column) => formatValue(row[column])).join(' | ').slice(0, 165), 40, y)
    y += 14
  })
  doc.save(`${report.id}.pdf`)
}

export default function ReportViewerClient({ reportId }: { reportId: string }) {
  const searchParams = useSearchParams()
  const report = getInventoryReport(reportId) ?? liveInventoryReports[0]
  const viewerProfile = useMemo(() => getReportViewerProfile(report.id), [report.id])
  const [selectedSource, setSelectedSource] = useState<ReportSource>(normalizeSource(searchParams.get('source')))
  const [payload, setPayload] = useState<ReportPayload | null>(null)
  const [aiDashboard, setAiDashboard] = useState<AiDashboardDefinition | null>(null)
  const [aiDashboardLoading, setAiDashboardLoading] = useState(false)
  const [aiDashboardError, setAiDashboardError] = useState<string | null>(null)
  const [aiRefreshKey, setAiRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tableReady, setTableReady] = useState(false)
  const [analysisReady, setAnalysisReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tableSearch, setTableSearch] = useState('')
  const [debouncedTableSearch, setDebouncedTableSearch] = useState('')
  const [remoteTableSearch, setRemoteTableSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [serverSort, setServerSort] = useState<{ column?: string; direction: 'asc' | 'desc' }>({ direction: 'asc' })
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [tableGroupMode, setTableGroupMode] = useState(AUTO_GROUP)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [manualFilters, setManualFilters] = useState<ReportFilterInput>({})
  const [appliedFilters, setAppliedFilters] = useState<ReportFilterInput>({})
  const [columnFilterDraft, setColumnFilterDraft] = useState<Partial<ReportColumnFilter>>({ operator: 'contains' })
  const [naturalQuery, setNaturalQuery] = useState('')
  const [naturalLoading, setNaturalLoading] = useState(false)
  const [filterMessage, setFilterMessage] = useState<string | null>(null)
  const [filterWarning, setFilterWarning] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [tableExpanded, setTableExpanded] = useState(false)
  const [manualFilterOpen, setManualFilterOpen] = useState(false)
  const [insightTab, setInsightTab] = useState<InsightTab>('charts')
  const [tableDensity, setTableDensity] = useState<TableDensity>('compact')
  const [expandedMovementRows, setExpandedMovementRows] = useState<Record<string, boolean>>({})
  const { favorites, toggleFavorite, addRecent } = useReportStore()
  const uniqueValuesCache = useRef<Map<string, string[]>>(new Map())
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const requestSeqRef = useRef(0)
  const sortColumnRef = useRef<string | null>(sortColumn)
  sortColumnRef.current = sortColumn

  const requestFilters = useMemo<ReportFilterInput>(() => {
    const search = remoteTableSearch.trim()
    return search ? { ...appliedFilters, search } : appliedFilters
  }, [appliedFilters, remoteTableSearch])

  const aiCacheKey = useMemo(
    () => `ai:${report.id}:${selectedSource}:${JSON.stringify(requestFilters)}`,
    [report.id, requestFilters, selectedSource],
  )
  const getCachedAi = useCallback(() => {
    try {
      const cached = sessionStorage.getItem(aiCacheKey)
      return cached ? (JSON.parse(cached) as AiDashboardDefinition) : null
    } catch { return null }
  }, [aiCacheKey])
  const setCachedAi = useCallback((data: AiDashboardDefinition) => {
    try { sessionStorage.setItem(aiCacheKey, JSON.stringify(data)) } catch {}
  }, [aiCacheKey])

  useEffect(() => {
    const sourceParam = searchParams.get('source')
    const storedSource = window.localStorage.getItem(REPORT_SOURCE_STORAGE_KEY)
    const nextSource = sourceParam ? normalizeSource(sourceParam) : normalizeSource(storedSource)
    window.localStorage.setItem(REPORT_SOURCE_STORAGE_KEY, nextSource)
    if (nextSource !== selectedSource) setSelectedSource(nextSource)
  }, [searchParams, selectedSource])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const search = tableSearch.trim()
      setDebouncedTableSearch(search)
      setRemoteTableSearch(search.length >= 2 ? search : '')
    }, 150)
    return () => window.clearTimeout(timer)
  }, [tableSearch])

  useEffect(() => {
    window.localStorage.setItem(REPORT_SOURCE_STORAGE_KEY, selectedSource)
    addRecent(report.id)
    let active = true
    const controller = new AbortController()
    const requestId = requestSeqRef.current + 1
    requestSeqRef.current = requestId
    const initialLimit = Math.min(pageSize, TABLE_FIRST_LIMIT)

    setLoading(true)
    setTableReady(false)
    setAnalysisReady(false)
    setError(null)
    setAiDashboard(null)
    setAiDashboardError(null)
    uniqueValuesCache.current.clear()

    fetchReport(report, selectedSource, initialLimit, requestFilters, {
      page,
      pageSize,
      signal: controller.signal,
      tableSortColumn: serverSort.column,
      tableSortDirection: serverSort.direction,
    })
      .then((data) => {
        if (!active || requestSeqRef.current !== requestId) return
        setPayload(data)
        setVisibleColumns(preferredVisibleColumnsForProfile(viewerProfile, data.columns))
        const defaultSort = viewerProfile.defaultSort?.(data.columns)
        const currentSortColumn = sortColumnRef.current
        const hasCurrentSort = Boolean(currentSortColumn && data.columns.includes(currentSortColumn))
        if (!hasCurrentSort && defaultSort) {
          setSortColumn(defaultSort.column)
          setSortDirection(defaultSort.direction)
        } else {
          setSortColumn((current) => (current && data.columns.includes(current) ? current : null))
        }
        const responsePage = Number(data.metadata?.page ?? page)
        if (Number.isFinite(responsePage) && responsePage !== page) setPage(responsePage)
        setTableReady(isReportPayloadReady(data))
      })
      .catch((err) => {
        if (!active || requestSeqRef.current !== requestId) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setTableReady(false)
        setError(err instanceof Error ? err.message : 'Gagal memuat laporan')
      })
      .finally(() => {
        if (active && requestSeqRef.current === requestId) setLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [report, addRecent, selectedSource, requestFilters, viewerProfile, page, pageSize, serverSort])

  useEffect(() => {
    if (!tableReady) {
      setAnalysisReady(false)
      return
    }

    setAnalysisReady(false)
    const timer = window.setTimeout(() => setAnalysisReady(true), 250)
    return () => window.clearTimeout(timer)
  }, [tableReady, payload, report.id, requestFilters, selectedSource])

  useEffect(() => {
    if (!payload || !tableReady || !analysisReady) {
      setAiDashboard(null)
      setAiDashboardError(null)
      setAiDashboardLoading(false)
      return
    }

    // Check cache first — skip API call if cached
    const cached = getCachedAi()
    if (cached) {
      setAiDashboard(cached)
      setAiDashboardLoading(false)
      return
    }

    let active = true
    // Delay AI analysis 2s so table renders first (non-blocking)
    const timer = window.setTimeout(async () => {
      setAiDashboardLoading(true)
      setAiDashboardError(null)
      try {
        const minimalPayload = compactReportPayloadForAi(payload, { sampleRows: 50, maxColumns: 40 })
        const response = await fetch(`/api/reports/${encodeURIComponent(report.id)}/ai-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filters: {
              ...requestFilters,
              source: selectedSource,
              reportId: report.id,
              apiReport: report.apiReport,
            },
            payload: minimalPayload,
            report: {
              code: report.code,
              name: report.title,
              description: report.description,
            },
            options: {
              maxCharts: 8,
              includePriorityTable: true,
              includeMissingFields: true,
              language: 'id',
            },
          }),
        })
        const result = await response.json()
        if (!active) return
        if (!response.ok || result.error) throw new Error(result.error ?? 'AI analysis gagal membaca payload report.')
        const aiResult = result as AiDashboardDefinition
        setAiDashboard(aiResult)
        setCachedAi(aiResult)
      } catch (err) {
        if (!active) return
        setAiDashboard(null)
        setAiDashboardError(err instanceof Error ? err.message : 'AI analysis gagal membaca payload report.')
      } finally {
        if (active) setAiDashboardLoading(false)
      }
    }, 2000)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [aiRefreshKey, requestFilters, payload, report.apiReport, report.code, report.description, report.id, report.title, selectedSource, getCachedAi, setCachedAi, tableReady, analysisReady])

  const serverPaged = Boolean(payload?.metadata?.paginated)
  const filteredRows = useMemo(() => {
    const rows = payload?.rows ?? []
    if (serverPaged) return rows
    const q = debouncedTableSearch.trim().toLowerCase()
    const searched = q
      ? rows.filter((row) => Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(q)))
      : rows
    if (!sortColumn) return searched
    return [...searched].sort((a, b) => {
      const av = a[sortColumn]
      const bv = b[sortColumn]
      const result = String(av ?? '').localeCompare(String(bv ?? ''), 'id-ID', { numeric: true })
      return sortDirection === 'asc' ? result : -result
    })
  }, [payload, serverPaged, debouncedTableSearch, sortColumn, sortDirection])

  const tableWindow = useMemo(
    () => normalizeReportTableWindow(payload?.metadata, filteredRows.length, pageSize),
    [filteredRows.length, pageSize, payload?.metadata],
  )
  const safeTotalTableRows = serverPaged ? tableWindow.totalRows : filteredRows.length
  const reachableTableRows = serverPaged ? tableWindow.reachableRows : filteredRows.length
  const pageCount = serverPaged
    ? tableWindow.pageCount
    : Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pageRows = serverPaged ? filteredRows : filteredRows.slice((page - 1) * pageSize, page * pageSize)
  const isFavorite = favorites.includes(report.id)
  const payloadColumns = payload?.columns ?? EMPTY_COLUMNS
  const autoGroupColumn = useMemo(
    () => preferredGroupColumn(payloadColumns, viewerProfile, requestFilters),
    [requestFilters, payloadColumns, viewerProfile],
  )
  const activeTableGroupColumn =
    tableGroupMode === NO_GROUP
      ? undefined
      : tableGroupMode === AUTO_GROUP
        ? autoGroupColumn
        : payloadColumns.includes(tableGroupMode)
          ? tableGroupMode
          : undefined
  const subtotalColumns = useMemo(
    () => selectSubtotalColumns(visibleColumns, filteredRows),
    [filteredRows, visibleColumns],
  )
  const tableGroups = useMemo(
    () => buildReportTableGroups(filteredRows, activeTableGroupColumn, visibleColumns, subtotalColumns),
    [activeTableGroupColumn, filteredRows, subtotalColumns, visibleColumns],
  )
  const tableTotals = useMemo(() => {
    if (tableExpanded || subtotalColumns.length === 0) return {}
    const totals: Record<string, number> = {}
    const preferredMovementTotals = ['AmountItem', 'QtyOnHandHold', 'QuantityClosing', 'StockIssueMovementCount', 'StockIssueMovementQty', 'StockIssueMovementAmount']
    const orderedColumns = report.id === 'all-stock-movement-analysis'
      ? [
          ...preferredMovementTotals.filter((column) => subtotalColumns.includes(column)),
          ...subtotalColumns.filter((column) => !preferredMovementTotals.includes(column)),
        ]
      : subtotalColumns
    orderedColumns.slice(0, 6).forEach((column) => {
      totals[column] = filteredRows.reduce((sum, row) => sum + toNumber(row[column]), 0)
    })
    return totals
  }, [filteredRows, report.id, subtotalColumns, tableExpanded])
  const groupedTableActive = Boolean(activeTableGroupColumn && tableGroups.length > 0)
  const shownTableRows = groupedTableActive
    ? tableGroups.reduce((total, group) => total + (collapsedGroups[group.key] ? 0 : group.rows.length), 0)
    : pageRows.length
  const tableRows = useMemo(
    () =>
      buildReportTableRows({
        grouped: groupedTableActive,
        groups: tableGroups,
        pageRows,
        page,
        collapsedGroups,
        expandedRows: expandedMovementRows,
        getRowKey: movementRowKey,
      }),
    [collapsedGroups, expandedMovementRows, groupedTableActive, page, pageRows, tableGroups],
  )
  const reportSchemaColumns = useMemo(() => {
    const reportSchema = payload?.metadata?.reportSchema as { columns?: ReportSchemaColumn[] } | undefined
    return Array.isArray(reportSchema?.columns) ? reportSchema.columns : []
  }, [payload?.metadata?.reportSchema])
  const reportSchemaByField = useMemo(
    () => new Map(reportSchemaColumns.map((column) => [column.field, column])),
    [reportSchemaColumns],
  )
  const metadataDistinctValues = useMemo(() => {
    const value = payload?.metadata?.distinctValues
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  }, [payload?.metadata?.distinctValues])
  const dynamicFilterColumns = useMemo<DynamicFilterColumn[]>(() => {
    const rows = payload?.rows ?? []
    const preferredSource = viewerProfile.manualFilterColumns ?? visibleColumns
    const preferred = preferredSource.filter((column) => payloadColumns.includes(column))
    const rest = payloadColumns.filter((column) => !preferred.includes(column))
    const cache = uniqueValuesCache.current
    return [...preferred, ...rest].map((field) => {
      const schema = reportSchemaByField.get(field)
      const type = inferManualColumnType(field, reportSchemaColumns, rows)
      const metadataOptions = metadataDistinctValues[field]
      const options = type === 'string' || type === 'boolean'
        ? (Array.isArray(metadataOptions) ? metadataOptions.map(String).slice(0, 80) : uniqueValues(rows, field, cache).slice(0, 80))
        : []
      return {
        field,
        label: schema?.label ?? displayColumnLabel(field),
        type,
        options,
      }
    })
  }, [metadataDistinctValues, payload?.rows, payloadColumns, reportSchemaByField, reportSchemaColumns, viewerProfile.manualFilterColumns, visibleColumns])
  const selectedFilterColumn = dynamicFilterColumns.find((column) => column.field === columnFilterDraft.field)
  const manualColumnOperators = operatorsForManualType(selectedFilterColumn?.type ?? 'string')
  const aggregatableColumns = reportSchemaColumns
    .filter((column) => column.aggregatable)
    .map((column) => column.field)
  const activeFilterChips = (() => {
    const chips: Array<{ key: keyof ReportFilterInput | 'safety'; label: string; columnFilterIndex?: number; locked?: boolean }> = [
      { key: 'safety', label: 'Read-only SELECT', locked: true },
    ]

    Object.entries(requestFilters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      if (key === 'columnFilters' && Array.isArray(value)) {
        value.forEach((item, index) => {
          const filter = item as ReportColumnFilter
          chips.push({
            key: 'columnFilters',
            columnFilterIndex: index,
            label: `${displayColumnLabel(filter.field ?? '')} ${filter.operator}${filter.value !== undefined ? ` ${filter.value}` : ''}${filter.valueTo !== undefined ? ` - ${filter.valueTo}` : ''}`,
          })
        })
        return
      }
      chips.push({ key: key as keyof ReportFilterInput, label: formatFilterChip(key, value) })
    })

    return chips
  })()
  const metadataEntries = useMemo(
    () =>
      Object.entries(payload?.metadata ?? {})
        .filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value))
        .slice(0, 8),
    [payload],
  )

  useEffect(() => {
    setCollapsedGroups({})
    setExpandedMovementRows({})
    setPage(1)
  }, [activeTableGroupColumn])

  useEffect(() => {
    setExpandedMovementRows({})
  }, [payload])

  function formatFilterChip(key: string, value: unknown) {
    if (key === 'stale') {
      const preset = viewerProfile.presets.find((item) => item.filters.stale === value)
      return `Update aging: ${preset?.label ?? String(value)}`
    }
    if (key === 'columnFilters' && Array.isArray(value)) {
      return value
        .map((item) => {
          const filter = item as ReportColumnFilter
          return `${displayColumnLabel(filter.field ?? '')} ${filter.operator}${filter.value !== undefined ? ` ${filter.value}` : ''}${filter.valueTo !== undefined ? ` - ${filter.valueTo}` : ''}`
        })
        .join(', ')
    }
    return `${key}: ${String(value)}`
  }

  const sortBy = (column: string) => {
    setPage(1)
    if (sortColumn === column) {
      const nextDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      setSortDirection(nextDirection)
      setServerSort({ column, direction: nextDirection })
    } else {
      setSortColumn(column)
      setSortDirection('asc')
      setServerSort({ column, direction: 'asc' })
    }
  }

  const toggleColumn = (column: string) => {
    setVisibleColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    )
  }

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }))
  }

  const toggleMovementRow = (rowKey: string) => {
    setExpandedMovementRows((current) => ({
      ...current,
      [rowKey]: !current[rowKey],
    }))
  }

  const toggleReportRow = (event: { preventDefault: () => void; stopPropagation: () => void }, rowKey: string) => {
    event.preventDefault()
    event.stopPropagation()
    toggleMovementRow(rowKey)
  }

  const setAllGroupsCollapsed = (collapsed: boolean) => {
    setCollapsedGroups(
      tableGroups.reduce<Record<string, boolean>>((next, group) => {
        next[group.key] = collapsed
        return next
      }, {}),
    )
  }

  const updateManualFilter = (key: keyof ReportFilterInput, value: string) => {
    setManualFilters((current) => ({
      ...current,
      [key]: value || undefined,
    }) as ReportFilterInput)
  }

  const updateManualNumber = (key: keyof ReportFilterInput, value: string) => {
    setManualFilters((current) => ({
      ...current,
      [key]: value ? Number(value) : undefined,
    }) as ReportFilterInput)
  }

  const updateActualPeriod = (value: string) => {
    setManualFilters((current) => ({
      ...current,
      period: value || undefined,
      accYear: undefined,
      accMonth: undefined,
      actualYear: undefined,
      actualMonth: undefined,
    }))
  }

  const updateAccountingPeriod = (key: 'accYear' | 'accMonth', value: string) => {
    setManualFilters((current) => ({
      ...current,
      period: undefined,
      actualYear: undefined,
      actualMonth: undefined,
      [key]: value ? Number(value) : undefined,
    }))
  }

  const updateColumnFilterDraft = (key: keyof ReportColumnFilter, value: string) => {
    if (key === 'field') {
      const nextColumn = dynamicFilterColumns.find((column) => column.field === value)
      setColumnFilterDraft({
        field: value || undefined,
        operator: nextColumn ? defaultOperatorForManualType(nextColumn.type, nextColumn.options.length > 0) : 'contains',
      })
      return
    }

    setColumnFilterDraft((current) => ({
      ...current,
      [key]: value || undefined,
    }))
  }

  const addColumnFilter = () => {
    if (!columnFilterDraft.field || !columnFilterDraft.operator) return
    const column = dynamicFilterColumns.find((item) => item.field === columnFilterDraft.field)
    const operator = columnFilterDraft.operator
    const nextFilter: ReportColumnFilter = {
      field: columnFilterDraft.field,
      operator,
      value: operator === 'blank' || operator === 'notBlank' ? undefined : coerceManualFilterValue(String(columnFilterDraft.value ?? ''), column?.type ?? 'string'),
      valueTo: operator === 'between' ? coerceManualFilterValue(String(columnFilterDraft.valueTo ?? ''), column?.type ?? 'string') : undefined,
    }

    setManualFilters((current) => ({
      ...current,
      columnFilters: [...(current.columnFilters ?? []), nextFilter].slice(0, 5),
    }))
    setColumnFilterDraft({ operator: 'contains' })
  }

  const removeColumnFilter = (index: number) => {
    setManualFilters((current) => ({
      ...current,
      columnFilters: (current.columnFilters ?? []).filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const applyManualFilters = () => {
    setPage(1)
    setAppliedFilters(manualFilters)
    setFilterWarning(null)
    setFilterError(null)
    setFilterMessage('Filter manual diterapkan ke payload read-only.')
  }

  const resetFilters = () => {
    setPage(1)
    setManualFilters({})
    setAppliedFilters({})
    setColumnFilterDraft({ operator: 'contains' })
    setNaturalQuery('')
    setTableSearch('')
    setRemoteTableSearch('')
    setFilterWarning(null)
    setFilterError(null)
    setFilterMessage(null)
  }

  const removeFilterChip = (chip: { key: keyof ReportFilterInput | 'safety'; columnFilterIndex?: number; locked?: boolean }) => {
    if (chip.locked || chip.key === 'safety') return
    const removeFrom = (current: ReportFilterInput): ReportFilterInput => {
      if (chip.key === 'columnFilters') {
        return {
          ...current,
          columnFilters: (current.columnFilters ?? []).filter((_, index) => index !== chip.columnFilterIndex),
        }
      }
      const next = { ...current }
      const key = chip.key as keyof ReportFilterInput
      delete next[key]
      return next
    }
    setManualFilters(removeFrom)
    setAppliedFilters(removeFrom)
    setPage(1)
    setFilterMessage('Filter chip dihapus.')
  }

  const applyKpiFilter = (label: string) => {
    const presetLabel = viewerProfile.kpiPresetByLabel?.[label]
    const preset = viewerProfile.presets.find((item) => item.label === presetLabel)
    if (preset) applyReportPreset(preset)
  }

  const applyReportPreset = (preset: ReportPreset) => {
    const nextFilters = preset.filters
    setPage(1)
    setManualFilters(nextFilters)
    setAppliedFilters(nextFilters)
    if (nextFilters.sortColumn) setSortColumn(nextFilters.sortColumn)
    if (nextFilters.sortDirection) setSortDirection(nextFilters.sortDirection)
    setFilterWarning(null)
    setFilterError(null)
    setFilterMessage(`Preset "${preset.label}" diterapkan sebagai filter read-only.`)
  }

  const applyNaturalFilter = async () => {
    const query = naturalQuery.trim()
    if (!query) return
    setNaturalLoading(true)
    setFilterError(null)
    setFilterWarning(null)
    setFilterMessage(null)
    try {
      const response = await fetch('/api/reports/natural-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          reportId: report.id,
          columns: payload?.columns ?? [],
        }),
      })
      const result = (await response.json()) as NaturalFilterResponse
      if (!response.ok || !result.success || !result.filters) {
        throw new Error(result.error ?? 'Natural filter gagal diproses.')
      }
      if (!hasActionableFilters(result.filters)) {
        throw new Error('Natural filter tidak menghasilkan filter yang bisa diterapkan.')
      }
      setPage(1)
      setManualFilters(result.filters)
      setAppliedFilters(result.filters)
      setFilterMessage(`${result.explanation ?? 'Natural filter diterapkan.'} Provider: ${result.provider ?? 'local-rule'}.`)
      setFilterWarning(result.warning ?? null)
    } catch (err) {
      setFilterWarning(null)
      setFilterError(err instanceof Error ? err.message : 'Natural filter gagal diproses.')
    } finally {
      setNaturalLoading(false)
    }
  }

  const kpiCards = payload ? viewerProfile.kpiBuilder(payload) : []
  const tableContextItems = (viewerProfile.tableContextColumns ?? [])
    .map((column) => [displayColumnLabel(column), payloadContextValue(payload, column)] as [string, unknown])
    .filter(([, value]) => value !== null && value !== undefined && value !== '')

  const jumpToAnalysis = (tab: InsightTab) => {
    setInsightTab(tab)
    window.requestAnimationFrame(() => {
      document.getElementById('analysis-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const enterFullTable = () => {
    setTableDensity('compact')
    setPageSize((current) => Math.max(current, 200))
    setTableExpanded(true)
  }

  const aiSections = [
    {
      label: 'Executive Summary',
      status: aiDashboard ? 'ready' : aiDashboardLoading ? 'generating' : 'waiting',
      content: aiDashboard?.summary.mainFinding ?? (payload ? `${formatValue(filteredRows.length)} row siap dibaca. AI analysis berjalan non-blocking setelah table.` : 'Menunggu payload report.'),
    },
    {
      label: 'Key Findings',
      status: aiDashboard ? 'ready' : aiDashboardLoading ? 'generating' : 'waiting',
      content: aiDashboard?.summary.recommendedFocus ?? 'Trend akan muncul setelah summary AI selesai.',
    },
    {
      label: 'Trend / Pattern',
      status: aiDashboard ? 'ready' : aiDashboardLoading ? 'waiting' : 'waiting',
      content: aiDashboard?.insights?.[0]?.finding ?? 'Pattern akan ditampilkan dari insight dan chart payload.',
    },
    {
      label: 'Risk / Anomaly',
      status: aiDashboard ? 'ready' : aiDashboardLoading ? 'waiting' : 'waiting',
      content: aiDashboard?.summary.businessRisk ?? 'Risk dan anomaly tidak memblokir table.',
    },
    {
      label: 'Data Quality',
      status: aiDashboard ? 'ready' : aiDashboardLoading ? 'waiting' : 'waiting',
      content: aiDashboard?.missingFields?.[0]?.reason ?? 'Indikator quality tersedia di tab Quality.',
    },
    {
      label: 'Recommendation',
      status: aiDashboard ? 'ready' : aiDashboardLoading ? 'waiting' : 'waiting',
      content: aiDashboard?.recommendedActions?.[0]?.action ?? 'Rekomendasi menyusul setelah AI selesai membaca summary, chart, dan sample rows.',
    },
    {
      label: 'Suggested Next Filters',
      status: aiDashboard ? 'ready' : aiDashboardLoading ? 'waiting' : 'waiting',
      content: viewerProfile.presets.length > 0 ? viewerProfile.presets.slice(0, 3).map((preset) => preset.label).join(', ') : 'Gunakan natural filter atau manual filter untuk drilldown lanjutan.',
    },
  ]

  const deferAnalysis = !tableReady || !analysisReady
  const qualityItems = useMemo(
    () => (deferAnalysis ? [] : viewerProfile.qualityBuilder(payload, filteredRows)),
    [deferAnalysis, filteredRows, payload, viewerProfile],
  )
  const aiDashboardReport = useMemo(
    () => ({
      code: report.code,
      name: report.title,
      description: report.description,
    }),
    [report.code, report.description, report.title],
  )
  const aiDashboardFilters = useMemo<DbRow>(
    () => ({
      ...requestFilters,
      source: selectedSource,
      reportId: report.id,
      apiReport: report.apiReport,
    }),
    [requestFilters, report.apiReport, report.id, selectedSource],
  )
  const aiChartPreview = aiDashboard?.charts?.[0] ?? null
  const aiChartTypes = [...new Set((aiDashboard?.charts ?? []).map((chart) => chart.type.replace('_', ' ')))]

  const insightTabLabels: Record<InsightTab, string> = {
    ai: 'AI Insight',
    charts: 'Charts',
    quality: 'Quality',
    metadata: 'Metadata',
    recommendations: 'Recommendations',
  }

  const effectiveTableDensity = tableExpanded ? 'compact' : tableDensity
  const headerPadding = tableExpanded
    ? 'px-2 py-1.5'
    : effectiveTableDensity === 'compact'
      ? 'px-3 py-2'
      : 'px-4 py-2.5'
  const cellPadding = tableExpanded
    ? 'px-2 py-2'
    : effectiveTableDensity === 'compact'
      ? 'px-3 py-2.5'
      : 'px-4 py-3'
  const headerCellClass = () => {
    const wrap = tableExpanded ? 'whitespace-nowrap' : 'whitespace-normal break-words'
    return `min-w-[136px] max-w-[300px] ${wrap} border-b-2 border-slate-300 bg-[#EFF4FB] ${headerPadding} align-bottom leading-tight font-extrabold text-slate-700`
  }

  const bodyCellClass = (columnIndex: number, subtotal = false) => {
    const text = subtotal ? 'text-sm font-black text-white' : columnIndex === 0 ? 'font-semibold text-slate-950' : 'text-slate-700'
    const wrap = tableExpanded ? 'whitespace-nowrap' : 'whitespace-normal break-words'
    return `min-w-[136px] max-w-[300px] ${wrap} ${cellPadding} align-top leading-snug ${text}`
  }
  const displayTableTotalRows = serverPaged && tableWindow.windowed ? reachableTableRows : safeTotalTableRows
  const estimateTableRowSize = useCallback((index: number) => {
    const row = tableRows[index]
    if (row?.type === 'detail') return tableExpanded ? 148 : 190
    if (row?.type === 'group-header') return tableExpanded ? 42 : 56
    if (row?.type === 'group-subtotal') return tableExpanded ? 34 : 42
    if (tableExpanded) return 34
    return effectiveTableDensity === 'compact' ? 44 : 54
  }, [effectiveTableDensity, tableExpanded, tableRows])
  const tableRowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: estimateTableRowSize,
    getItemKey: (index) => tableRows[index]?.key ?? index,
    overscan: tableExpanded ? 18 : 12,
  })
  const virtualRows = tableRowVirtualizer.getVirtualItems()
  const virtualPaddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const virtualPaddingBottom = virtualRows.length > 0
    ? Math.max(0, tableRowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end)
    : 0

  const renderTableRow = (rowModel: ReportTableRenderRow<DbRow>) => {
    if (rowModel.type === 'group-header') {
      const group = rowModel.group
      const collapsed = Boolean(collapsedGroups[group.key])
      const itemCurrent = groupMetricTotal(group.rows, ['ItemCurrent']) || group.rows.length
      const amountCurrent = groupMetricTotal(group.rows, ['AmountItem', 'AmountCurrent', 'TotalAmount', 'total_amount', 'NilaiStok'])
      const totalQuantity = groupMetricTotal(group.rows, ['total_quantity', 'quantity_on_hand', 'QuantityClosing', 'StockIssueMovementQty', 'TotalStok', 'Qty', 'qty'])
      const movementReport = report.id === 'all-stock-movement-analysis'
      const subtotalChips = group.subtotalColumns
        .filter((column) => !['ItemCurrent', 'AmountItem', 'AmountCurrent', 'TotalAmount', 'NilaiStok', 'NilaiPersediaan', 'Amount', 'QuantityClosing', 'StockIssueMovementQty', 'TotalStok', 'Qty'].includes(column))
        .slice(0, 2)

      return (
        <tr key={rowModel.key} className="bg-[#D1E8FA] text-slate-700">
          <td colSpan={Math.max(visibleColumns.length, 1)} className="border-y border-blue-200 px-4 py-3">
            <button
              type="button"
              onClick={() => toggleGroup(group.key)}
              className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
            >
              <span className="inline-flex min-w-0 items-center gap-2 font-black text-slate-950">
                {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                <span className="truncate">{displayColumnLabel(activeTableGroupColumn ?? '')}: {group.label}</span>
              </span>
              <span className="flex flex-wrap gap-1.5">
                <span className="rounded border border-emerald-200 bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-900">{movementReport ? 'Item' : 'Item Current'}: {formatValue(itemCurrent)}</span>
                <span className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600">{movementReport ? 'Asset Amount' : 'Amount Current'}: {formatValue(amountCurrent)}</span>
                <span className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500">{movementReport ? 'Stock Qty' : 'Total Qty'}: {formatValue(totalQuantity)}</span>
                {subtotalChips.map((column) => (
                  <span key={column} className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500">
                    {displayColumnLabel(column)}: {formatValue(group.totals[column])}
                  </span>
                ))}
              </span>
            </button>
          </td>
        </tr>
      )
    }

    if (rowModel.type === 'group-subtotal') {
      const group = rowModel.group
      return (
        <tr key={rowModel.key} className="bg-[#167A3A] text-white">
          {visibleColumns.map((column, columnIndex) => (
            <td
              key={column}
              className={bodyCellClass(columnIndex, true)}
            >
              {columnIndex === 0
                ? `Subtotal ${group.label}`
                : group.subtotalColumns.includes(column)
                  ? formatValue(group.totals[column])
                  : ''}
            </td>
          ))}
        </tr>
      )
    }

    if (rowModel.type === 'detail') {
      return <ReportRowDetail key={rowModel.key} row={rowModel.row} columns={visibleColumns} colSpan={visibleColumns.length} mode={viewerProfile.rowDetail} />
    }

    const movementExpanded = Boolean(expandedMovementRows[rowModel.rowKey])
    return (
      <tr key={rowModel.key} className={rowModel.rowIndex % 2 === 0 ? 'bg-white hover:bg-emerald-50' : 'bg-slate-50/80 hover:bg-emerald-50'}>
        {visibleColumns.map((column, columnIndex) => (
          <td key={column} className={bodyCellClass(columnIndex)}>
            {columnIndex === 0 ? (
              <button type="button" onClick={(event) => toggleReportRow(event, rowModel.rowKey)} className="inline-flex max-w-[420px] items-start gap-2 text-left leading-snug text-slate-950 hover:text-emerald-800">
                {movementExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <span className="whitespace-normal break-words">{renderReportCell(column, rowModel.row[column])}</span>
              </button>
            ) : (
              renderReportCell(column, rowModel.row[column])
            )}
          </td>
        ))}
      </tr>
    )
  }

  return (
    <main className="min-h-full bg-[#0F2B1A]">
      <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <nav className="text-xs font-medium text-white/30">
              <Link href={`/report-center?source=${selectedSource}`} className="hover:text-emerald-400">Dashboard</Link>
              <span className="mx-2">/</span>
              <Link href={`/report-center/inventory?source=${selectedSource}`} className="hover:text-emerald-400">Modules / Inventory</Link>
              <span className="mx-2">/</span>
              <span className="text-white/40">{report.title}</span>
            </nav>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">{report.title}</h1>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">Inventory</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                {report.status === 'live' ? 'LIVE' : 'Update'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-extrabold text-white">
                <FileSpreadsheet size={13} />
                {sourceLabel(selectedSource)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/40">
                {sourceDescription(selectedSource)}
              </span>
              <button
                type="button"
                onClick={() => toggleFavorite(report.id)}
                className={isFavorite ? 'rounded-xl bg-amber-500/20 p-2 text-amber-400' : 'rounded-xl border border-white/10 bg-white/5 p-2 text-white/40 hover:text-amber-400'}
                aria-label={isFavorite ? 'Hapus favorit' : 'Tambah favorit'}
              >
                <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
            </div>
            <p className="mt-1 max-w-5xl text-xs leading-5 text-white/35">{report.description}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                <ShieldCheck size={14} />
                Read-only SELECT
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 text-white/30">
                <Sparkles size={14} />
                AI baca payload saja
              </span>
              {payload?.metadata?.filteredRows !== undefined && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 text-white/30">
                  {formatValue(payload.metadata.filteredRows)} row filter
                </span>
              )}
            </div>
          </div>
          <Link href={`/report-center/inventory?source=${selectedSource}&report=${report.id}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10">
            <ArrowLeft size={16} />
            Kembali ke Modul
          </Link>
        </div>

        <section className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          {kpiCards.slice(0, 12).map((kpi) => {
            const canFilter = Boolean(viewerProfile.kpiPresetByLabel?.[kpi.label])
            return (
              <button
                key={kpi.label}
                type="button"
                onClick={() => canFilter && applyKpiFilter(kpi.label)}
                className={`min-h-[74px] rounded-xl border p-3 text-left transition ${kpi.tone} ${canFilter ? 'hover:-translate-y-0.5 hover:shadow-lg' : 'cursor-default'}`}
              >
                <span className="block truncate text-[10px] font-extrabold uppercase tracking-[0.14em] opacity-65">{kpi.label}</span>
                <span className="mt-1 block truncate text-xl font-black tracking-tight">{compactMetric(kpi.value)}</span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold opacity-70">{kpi.description}</span>
              </button>
            )
          })}
        </section>

        <section className="mt-4 text-white">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <label htmlFor="natural-filter" className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-emerald-300">
                <Sparkles size={13} />
                Natural Filter
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="natural-filter"
                  value={naturalQuery}
                  onChange={(event) => setNaturalQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applyNaturalFilter()
                  }}
                  placeholder={viewerProfile.naturalPlaceholder}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-emerald-500/20 bg-white/5 px-3 text-sm font-medium text-white placeholder-slate-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                />
                <button
                  type="button"
                  onClick={applyNaturalFilter}
                  disabled={naturalLoading || !naturalQuery.trim()}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {naturalLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  Jalankan
                </button>
              </div>
              {filterMessage && <p className="mt-2 text-xs font-medium text-emerald-300">{filterMessage}</p>}
              {filterWarning && <p className="mt-2 text-xs font-bold text-amber-300">{filterWarning}</p>}
              {filterError && <p className="mt-2 text-xs font-bold text-red-300">{filterError}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
                {activeFilterChips.map((chip) => (
                  <button
                    key={`${chip.key}-${chip.columnFilterIndex ?? chip.label}`}
                    type="button"
                    onClick={() => removeFilterChip(chip)}
                    className={`rounded-lg px-2 py-1 ${chip.locked ? 'cursor-default border border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border border-white/10 bg-white/5 text-white/60 hover:border-red-400/40 hover:text-red-200'}`}
                  >
                    {chip.label}{chip.locked ? '' : ' x'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/40">
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal size={13} />
                  Preset & Filter
                </span>
                <button
                  type="button"
                  onClick={() => setManualFilterOpen((current) => !current)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-white/60 hover:bg-white/10 hover:text-white"
                >
                  {manualFilterOpen ? 'Hide Manual' : 'Manual Filter'}
                </button>
              </div>
              {viewerProfile.presets.length > 0 && (
                <div className="mb-4 rounded-xl border border-white/5 bg-white/5 p-3">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">{viewerProfile.presetTitle}</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {viewerProfile.presets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyReportPreset(preset)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:border-emerald-500/40 hover:bg-emerald-500/10"
                      >
                        <span className="block text-sm font-bold text-white">{preset.label}</span>
                        <span className="mt-0.5 block text-xs font-medium text-white/40">{preset.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {manualFilterOpen && (
                <>
              {viewerProfile.showAccountingPeriodFilter && (
                <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Periode Valuasi</p>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_120px_auto]">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/40">Actual month/year</span>
                      <input
                        type="month"
                        value={manualFilters.period ?? ''}
                        onChange={(event) => updateActualPeriod(event.target.value)}
                        className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/40">AccYear</span>
                      <input
                        type="number"
                        min={1}
                        value={manualFilters.accYear ?? ''}
                        onChange={(event) => updateAccountingPeriod('accYear', event.target.value)}
                        placeholder="2027"
                        className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white placeholder-slate-400"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/40">AccMonth</span>
                      <select
                        value={manualFilters.accMonth ?? ''}
                        onChange={(event) => updateAccountingPeriod('accMonth', event.target.value)}
                        className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                      >
                        <option value="">Pilih</option>
                        {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                          <option key={month} value={month}>{month}</option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          setManualFilters((current) => ({
                            ...current,
                            period: undefined,
                            accYear: undefined,
                            accMonth: undefined,
                            actualYear: undefined,
                            actualMonth: undefined,
                          }))
                          setAppliedFilters((current) => ({
                            ...current,
                            period: undefined,
                            accYear: undefined,
                            accMonth: undefined,
                            actualYear: undefined,
                            actualMonth: undefined,
                          }))
                        }}
                        className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
                      >
                        Current
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-emerald-200/80">
                    Actual period dikonversi ke AccYear/AccMonth. Jika AccYear dan AccMonth diisi, field accounting dipakai sebagai prioritas.
                  </p>
                </div>
              )}
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/40 mb-3">Filter Kolom Report</p>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1.2fr)_140px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <select
                      value={columnFilterDraft.field ?? ''}
                      onChange={(event) => updateColumnFilterDraft('field', event.target.value)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    >
                      <option value="">Pilih kolom report</option>
                      {dynamicFilterColumns.map((column) => (
                        <option key={column.field} value={column.field}>{column.label}</option>
                      ))}
                    </select>
                    <select
                      value={columnFilterDraft.operator ?? defaultOperatorForManualType(selectedFilterColumn?.type ?? 'string', Boolean(selectedFilterColumn?.options.length))}
                      onChange={(event) => updateColumnFilterDraft('operator', event.target.value)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                      disabled={!selectedFilterColumn}
                    >
                      {manualColumnOperators.map((operator) => (
                        <option key={operator.value} value={operator.value}>{operator.label}</option>
                      ))}
                    </select>
                    {selectedFilterColumn?.options.length && !['gt', 'gte', 'lt', 'lte', 'between'].includes(String(columnFilterDraft.operator)) ? (
                      <select
                        value={String(columnFilterDraft.value ?? '')}
                        onChange={(event) => updateColumnFilterDraft('value', event.target.value)}
                        className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                        disabled={columnFilterDraft.operator === 'blank' || columnFilterDraft.operator === 'notBlank'}
                      >
                        <option value="">Pilih nilai</option>
                        {selectedFilterColumn.options.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={selectedFilterColumn?.type === 'number' ? 'number' : selectedFilterColumn?.type === 'date' ? 'date' : 'text'}
                        value={String(columnFilterDraft.value ?? '')}
                        onChange={(event) => updateColumnFilterDraft('value', event.target.value)}
                        placeholder={selectedFilterColumn ? `Nilai ${selectedFilterColumn.label}` : 'Pilih kolom dulu'}
                        disabled={!selectedFilterColumn || columnFilterDraft.operator === 'blank' || columnFilterDraft.operator === 'notBlank'}
                        className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white placeholder-slate-400 disabled:opacity-30"
                      />
                    )}
                    <input
                      type={selectedFilterColumn?.type === 'number' ? 'number' : selectedFilterColumn?.type === 'date' ? 'date' : 'text'}
                      value={String(columnFilterDraft.valueTo ?? '')}
                      onChange={(event) => updateColumnFilterDraft('valueTo', event.target.value)}
                      placeholder="Nilai akhir"
                      disabled={columnFilterDraft.operator !== 'between'}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white placeholder-slate-400 disabled:opacity-30"
                    />
                    <button type="button" onClick={addColumnFilter} disabled={!selectedFilterColumn} className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-30">
                      +
                    </button>
                  </div>
                {(manualFilters.columnFilters ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {manualFilters.columnFilters?.map((filter, index) => (
                      <button
                        key={`${filter.field}-${filter.operator}-${index}`}
                        type="button"
                        onClick={() => removeColumnFilter(index)}
                        className="rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300 hover:border-red-500/40"
                      >
                        {displayColumnLabel(filter.field ?? '')} {filter.operator}{filter.value !== undefined ? ` ${filter.value}` : ''}{filter.valueTo !== undefined ? ` - ${filter.valueTo}` : ''} x
                      </button>
                    ))}
                  </div>
                )}
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/40 mb-3">Sort / Limit / Chart</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {viewerProfile.presets.some((preset) => preset.filters.stale) && (
                      <select
                        value={manualFilters.stale ?? ''}
                        onChange={(event) => updateManualFilter('stale', event.target.value)}
                        className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                      >
                        <option value="">Update aging</option>
                        <option value="semua">Semua Item</option>
                        <option value="active">{'Update <= 3 bulan'}</option>
                        <option value="watch">Update 3-6 bulan</option>
                        <option value="slow-moving">Update 6-12 bulan</option>
                        <option value="lebih-1-tahun">{'Tidak update > 12 bulan'}</option>
                        <option value="dead-stock">{'Tidak update > 24 bulan'}</option>
                      </select>
                    )}
                    <select
                      value={manualFilters.sortColumn ?? ''}
                      onChange={(event) => updateManualFilter('sortColumn', event.target.value)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    >
                      <option value="">Sort kolom</option>
                      {dynamicFilterColumns.map((column) => (
                        <option key={column.field} value={column.field}>{column.label}</option>
                      ))}
                    </select>
                    <select
                      value={manualFilters.sortDirection ?? ''}
                      onChange={(event) => updateManualFilter('sortDirection', event.target.value)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    >
                      <option value="">Arah sort</option>
                      <option value="desc">Tertinggi</option>
                      <option value="asc">Terendah</option>
                    </select>
                    <select
                      value={manualFilters.groupBy ?? ''}
                      onChange={(event) => updateManualFilter('groupBy', event.target.value)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    >
                      <option value="">Group / chart per kolom</option>
                      {dynamicFilterColumns.map((column) => (
                        <option key={column.field} value={column.field}>{column.label}</option>
                      ))}
                    </select>
                    <select
                      value={manualFilters.aggregateField ?? ''}
                      onChange={(event) => updateManualFilter('aggregateField', event.target.value)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    >
                      <option value="">Field agregasi</option>
                      {(aggregatableColumns.length > 0 ? aggregatableColumns : dynamicFilterColumns.map((column) => column.field)).map((column) => (
                        <option key={column} value={column}>{displayColumnLabel(column)}</option>
                      ))}
                    </select>
                    <select
                      value={manualFilters.aggregateFn ?? ''}
                      onChange={(event) => updateManualFilter('aggregateFn', event.target.value)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    >
                      <option value="">Agregasi</option>
                      <option value="sum">Sum</option>
                      <option value="count">Count</option>
                      <option value="avg">Average</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={manualFilters.top ?? ''}
                      onChange={(event) => updateManualNumber('top', event.target.value)}
                      placeholder="Top N"
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white placeholder-slate-400"
                    />
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={manualFilters.resultLimit ?? ''}
                      onChange={(event) => updateManualNumber('resultLimit', event.target.value)}
                      placeholder="Limit row"
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>
                </>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={applyManualFilters} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500">
                  <SlidersHorizontal size={14} />
                  Terapkan
                </button>
                <button type="button" onClick={resetFilters} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white/60 hover:bg-white/10 hover:text-white">
                  <XCircle size={14} />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className={tableExpanded ? '' : 'mt-5'}>
        <section className={tableExpanded ? 'fixed inset-0 z-50 overflow-hidden bg-white p-2' : 'overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-white shadow-[0_24px_60px_rgba(0,0,0,0.22)]'}>
          <div className={`sticky top-0 z-40 flex flex-wrap items-center justify-between border-b border-emerald-500/20 bg-[#12351F] ${tableExpanded ? 'mb-1 gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-900 shadow-sm' : 'gap-3 px-5 py-4'}`}>
            <div className="flex flex-wrap items-center gap-2">
              {tableExpanded && (
                <button
                  type="button"
                  onClick={() => setTableExpanded(false)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-900 px-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <Minimize2 size={16} />
                  Exit
                </button>
              )}
              <div className={`relative w-full ${tableExpanded ? 'max-w-xs' : 'max-w-md'}`}>
                <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${tableExpanded ? 'text-slate-400' : 'text-white/40'}`} />
                <input
                  value={tableSearch}
                  onChange={(event) => {
                    setTableSearch(event.target.value)
                    setPage(1)
                  }}
                  placeholder="Search dalam table..."
                  className={tableExpanded ? 'h-8 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs font-semibold text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20' : 'h-11 w-full rounded-xl border border-white/20 bg-[#1A1A1A] pl-9 pr-3 text-sm font-medium text-white placeholder:text-white/40 outline-none focus:border-emerald-500 focus:bg-[#1A1A1A] focus:ring-4 focus:ring-emerald-500/20'}
                />
              </div>
              {tableExpanded && (
                <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600 md:inline-flex">
                  {shownTableRows} / {displayTableTotalRows} row{serverPaged && tableWindow.windowed ? ` dari ${safeTotalTableRows} total` : ''}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={tableGroupMode}
                onChange={(event) => {
                  setTableGroupMode(event.target.value)
                  setCollapsedGroups({})
                  setPage(1)
                }}
                className={tableExpanded ? 'h-8 max-w-[180px] rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20' : 'h-11 rounded-xl border border-white/20 bg-[#1A1A1A] px-3 text-sm font-semibold text-white outline-none hover:bg-[#252525] focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20'}
              >
                <option value={AUTO_GROUP}>Auto group</option>
                <option value={NO_GROUP}>Tanpa group</option>
                {payloadColumns.map((column) => (
                  <option key={column} value={column}>Group: {displayColumnLabel(column)}</option>
                ))}
              </select>
              {groupedTableActive && (
                <div className="flex rounded-xl border border-white/20 bg-[#1A1A1A] p-1">
                  <button
                    type="button"
                    onClick={() => setAllGroupsCollapsed(false)}
                    className="rounded-lg px-3 py-2 text-xs font-bold text-white/70 hover:bg-[#252525] hover:text-white"
                  >
                    Expand
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllGroupsCollapsed(true)}
                    className="rounded-lg px-3 py-2 text-xs font-bold text-white/70 hover:bg-[#252525] hover:text-white"
                  >
                    Collapse
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setTableDensity((current) => (current === 'compact' ? 'comfortable' : 'compact'))}
                className={tableExpanded ? 'inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 hover:bg-slate-50' : 'inline-flex h-11 items-center rounded-xl border border-white/20 bg-[#1A1A1A] px-4 text-sm font-bold text-white hover:bg-[#252525]'}
              >
                {tableDensity === 'compact' ? 'Comfort' : 'Compact'}
              </button>
              <details className="relative">
                <summary className={tableExpanded ? 'h-8 cursor-pointer rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50' : 'h-11 cursor-pointer rounded-xl border border-white/20 bg-[#1A1A1A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#252525]'}>
                  Columns
                </summary>
                <div className="absolute right-0 z-20 mt-2 max-h-80 w-64 overflow-y-auto rounded-xl border border-white/20 bg-[#1A1A1A] p-3 text-white shadow-2xl">
                  {(payload?.columns ?? []).map((column) => (
                    <label key={column} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/70 hover:bg-[#252525]">
                      <input type="checkbox" checked={visibleColumns.includes(column)} onChange={() => toggleColumn(column)} />
                      <span className="truncate">{displayColumnLabel(column)}</span>
                    </label>
                  ))}
                </div>
              </details>
              {tableExpanded && !groupedTableActive && (
                <div className="flex h-8 overflow-hidden rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700">
                  <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="px-2 hover:bg-slate-50 disabled:opacity-30">Prev</button>
                  <span className="border-x border-slate-200 px-2 py-1.5">{page}/{pageCount}</span>
                  <button type="button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="px-2 hover:bg-slate-50 disabled:opacity-30">Next</button>
                </div>
              )}
              {tableExpanded && !groupedTableActive && (
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value))
                    setPage(1)
                  }}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800"
                >
                  {[100, 200, 500].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              )}
              <button type="button" onClick={() => exportExcel(report, selectedSource, requestFilters)} className={tableExpanded ? 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-700/30 bg-emerald-50 px-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100' : 'inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20'}>
                <FileSpreadsheet size={16} />
                Excel
              </button>
              <button type="button" onClick={() => exportPdf(report, filteredRows, visibleColumns)} className={tableExpanded ? 'hidden' : 'inline-flex h-11 items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 text-sm font-bold text-amber-400 hover:bg-amber-500/20'}>
                <FileText size={16} />
                Export PDF
              </button>
              <button type="button" onClick={() => downloadCsv(report, selectedSource, requestFilters)} className={tableExpanded ? 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 hover:bg-slate-50' : 'inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-[#1A1A1A] px-4 text-sm font-bold text-white hover:bg-[#252525]'}>
                <Download size={16} />
                CSV
              </button>
              <button type="button" onClick={() => window.print()} className={tableExpanded ? 'hidden' : 'inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-[#1A1A1A] px-4 text-sm font-bold text-white hover:bg-[#252525]'}>
                <Printer size={16} />
                Print
              </button>
              <button type="button" onClick={() => navigator.clipboard.writeText(window.location.href)} className={tableExpanded ? 'hidden' : 'inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-[#1A1A1A] px-4 text-sm font-bold text-white hover:bg-[#252525]'}>
                <Copy size={16} />
                Copy Link
              </button>
              <button type="button" onClick={() => jumpToAnalysis('ai')} className={tableExpanded ? 'hidden' : 'inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20'}>
                <BarChart3 size={16} />
                Insight
              </button>
              <button type="button" onClick={() => jumpToAnalysis('charts')} className={tableExpanded ? 'hidden' : 'inline-flex h-11 items-center rounded-xl border border-white/20 bg-[#1A1A1A] px-4 text-sm font-bold text-white hover:bg-[#252525]'}>
                Charts
              </button>
              <button type="button" onClick={() => jumpToAnalysis('quality')} className={tableExpanded ? 'hidden' : 'inline-flex h-11 items-center rounded-xl border border-white/20 bg-[#1A1A1A] px-4 text-sm font-bold text-white hover:bg-[#252525]'}>
                Quality
              </button>
              <button type="button" onClick={enterFullTable} className={tableExpanded ? 'hidden' : 'inline-flex h-11 items-center gap-2 rounded-xl bg-[#167A3A] px-4 text-sm font-black text-white hover:bg-[#0f6a30]'}>
                <Expand size={16} />
                Full Table
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <Loader2 className="animate-spin text-emerald-700" size={16} />
                Memuat data tabel...
              </div>
              <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-12 animate-pulse rounded-xl bg-white/5" />
              <div className="h-12 animate-pulse rounded-xl bg-white/5" />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-lg font-bold text-red-400">Gagal memuat laporan</p>
              <p className="mt-2 text-sm text-red-500">{error}</p>
            </div>
          ) : (
            <>
              {!tableExpanded && tableContextItems.length > 0 && (
                <div className="border-b border-slate-200 bg-[#F0F4FA] px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {tableContextItems.map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                        <span className="block text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-500">{label}</span>
                        <span className="mt-0.5 block text-xs font-black text-slate-950">{formatValue(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className={`overflow-auto ${tableExpanded ? 'h-[calc(100vh-58px)] rounded-lg border border-slate-200 bg-white' : 'h-[76vh] min-h-[620px] max-h-[920px]'}`} ref={tableContainerRef}>
                <table className={`min-w-full table-auto border-separate border-spacing-0 text-left ${tableExpanded ? 'text-xs' : 'text-[13px]'}`}>
                  <thead className={`sticky top-0 z-30 border-b-2 border-slate-300 uppercase text-slate-700 ${tableExpanded ? 'text-[10px] tracking-[0.08em]' : 'text-[11px] tracking-[0.12em]'}`}>
                    <tr>
                      {visibleColumns.map((column) => (
                        <th
                          key={column}
                          className={headerCellClass()}
                        >
                          <button type="button" onClick={() => sortBy(column)} className="text-left font-bold leading-tight hover:text-emerald-700">
                            {displayColumnLabel(column)}{sortColumn === column ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={Math.max(visibleColumns.length, 1)} className="px-4 py-12 text-center text-slate-500">
                          Tidak ada report ditemukan. Coba ubah kata kunci atau filter.
                        </td>
                      </tr>
                    ) : (
                      <Fragment>
                        {virtualPaddingTop > 0 && (
                          <tr aria-hidden="true">
                            <td colSpan={Math.max(visibleColumns.length, 1)} style={{ height: virtualPaddingTop, padding: 0, border: 0 }} />
                          </tr>
                        )}
                        {virtualRows.map((virtualRow) => {
                          const rowModel = tableRows[virtualRow.index]
                          return rowModel ? renderTableRow(rowModel) : null
                        })}
                        {virtualPaddingBottom > 0 && (
                          <tr aria-hidden="true">
                            <td colSpan={Math.max(visibleColumns.length, 1)} style={{ height: virtualPaddingBottom, padding: 0, border: 0 }} />
                          </tr>
                        )}
                      </Fragment>
                    )}
                  </tbody>
                </table>
              </div>

              {!tableExpanded && Object.keys(tableTotals).length > 0 && (
                <div className="flex flex-wrap gap-3 border-t border-slate-200 bg-[#F0F4FA] px-5 py-3">
                  {Object.entries(tableTotals).map(([column, total]) => (
                    <div key={column} className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 shadow-sm ${report.id === 'all-stock-movement-analysis' && column === 'AmountItem' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                      <span className={`text-xs font-bold uppercase tracking-wide ${report.id === 'all-stock-movement-analysis' && column === 'AmountItem' ? 'text-emerald-700' : 'text-slate-500'}`}>{displayColumnLabel(column)}</span>
                      <span className={`text-sm font-black ${report.id === 'all-stock-movement-analysis' && column === 'AmountItem' ? 'text-emerald-950' : 'text-slate-950'}`}>{formatValue(total)}</span>
                    </div>
                  ))}
                </div>
              )}

              {!tableExpanded && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600">
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Menampilkan {shownTableRows} dari {displayTableTotalRows} row{serverPaged && tableWindow.windowed ? ` dari ${safeTotalTableRows} total` : ''}
                    {groupedTableActive ? ` dalam ${tableGroups.length} group (${activeTableGroupColumn})` : ''}
                  </span>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    Rows per page
                    <select
                      value={pageSize}
                      disabled={groupedTableActive}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value))
                        setPage(1)
                      }}
                      className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {[50, 100, 200].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {!groupedTableActive && (
                  <div className="flex gap-2">
                    <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30">
                      Prev
                    </button>
                    <span className="rounded-xl border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-black text-white">{page} / {pageCount}</span>
                    <button type="button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30">
                      Next
                    </button>
                  </div>
                )}
              </div>
              )}
            </>
          )}
        </section>
        {!tableExpanded && tableReady && !analysisReady && (
          <section id="analysis-workspace" className="mt-5 rounded-2xl border border-emerald-500/25 bg-[#12351F] p-5 text-white shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-emerald-300">Analysis Workspace</p>
                <p className="mt-1 text-xs font-semibold text-white/45">Chart, AI insight, quality, metadata, dan recommendations disiapkan setelah table.</p>
              </div>
              <Loader2 className="animate-spin text-emerald-300" size={18} />
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-[#0F2B1A] p-4 text-sm font-semibold text-white/60">
              Table sudah siap. Analysis Workspace sedang dimuat di background supaya table tetap ringan dulu.
            </div>
          </section>
        )}
        {!tableExpanded && tableReady && analysisReady && (
          <section id="analysis-workspace" className="mt-5 rounded-2xl border border-emerald-500/25 bg-[#12351F] p-5 text-white shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-emerald-300">Analysis Workspace</p>
                <p className="mt-1 text-xs font-semibold text-white/45">AI insight, chart analysis, quality, metadata, dan recommendations tetap lengkap setelah table.</p>
              </div>
            </div>

            <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-xl border border-white/10 bg-[#0F2B1A] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-white">AI Insight Preview</p>
                  <span className={
                    aiDashboard
                      ? 'rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300'
                      : aiDashboardLoading
                        ? 'rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300'
                        : 'rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black text-white/35'
                  }>
                    {aiDashboard ? 'Ready' : aiDashboardLoading ? 'Generating' : 'Waiting'}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-white/70">{aiSections[0]?.content}</p>
                <button
                  type="button"
                  onClick={() => setInsightTab('ai')}
                  className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20"
                >
                  Open AI Insight
                </button>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0F2B1A] p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{aiChartPreview?.title ?? 'AI Chart Preview'}</p>
                    <p className="mt-1 text-xs leading-5 text-white/45">
                      {aiChartPreview?.reason ?? 'AI akan menentukan chart, dimensi, metric, agregasi, dan alasan analisis dari payload report.'}
                    </p>
                  </div>
                  <BarChart3 className="shrink-0 text-emerald-300" size={18} />
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-white/35">Charts</p>
                    <p className="mt-1 text-lg font-black text-emerald-300">{aiDashboard?.charts?.length ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-white/35">Primary Type</p>
                    <p className="mt-1 truncate text-sm font-black text-white">{aiChartPreview?.type?.replace('_', ' ') ?? (aiDashboardLoading ? 'Generating' : 'Waiting')}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-white/35">Metric</p>
                    <p className="mt-1 truncate text-sm font-black text-white">{aiChartPreview?.valueField ?? aiChartPreview?.yField ?? 'AI selected'}</p>
                  </div>
                </div>
                {aiChartTypes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {aiChartTypes.slice(0, 7).map((type) => (
                      <span key={type} className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase text-emerald-200">
                        {type}
                      </span>
                    ))}
                  </div>
                )}
                {aiChartPreview && (
                  <p className="mt-3 text-xs leading-5 text-white/50">
                    {aiChartPreview.xField || aiChartPreview.categoryField ? `Dimension: ${aiChartPreview.xField ?? aiChartPreview.categoryField}` : 'Dimension dipilih dari payload'}
                    {aiChartPreview.aggregation ? ` - Aggregation: ${aiChartPreview.aggregation}` : ''}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setInsightTab('charts')}
                  className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/65 hover:bg-white/10 hover:text-white"
                >
                  Open Charts
                </button>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#0F2B1A] p-1 md:grid-cols-5">
              {(Object.keys(insightTabLabels) as InsightTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setInsightTab(tab)}
                  className={
                    insightTab === tab
                      ? 'rounded-lg bg-emerald-600 px-2 py-2 text-xs font-black text-white'
                      : 'rounded-lg px-2 py-2 text-xs font-bold text-white/45 hover:bg-white/5 hover:text-white'
                  }
                >
                  {insightTabLabels[tab]}
                </button>
              ))}
            </div>

            {insightTab === 'ai' && (
              <div className="space-y-3">
                {aiDashboardError && (
                  <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs font-semibold text-red-200">
                    {aiDashboardError}
                  </div>
                )}
                {aiSections.map((section) => (
                  <div key={section.label} className="rounded-xl border border-white/10 bg-[#0F2B1A] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-white">{section.label}</p>
                      <span className={
                        section.status === 'ready'
                          ? 'rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300'
                          : section.status === 'generating'
                            ? 'rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300'
                            : 'rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black text-white/35'
                      }>
                        {section.status === 'ready' ? 'Ready' : section.status === 'generating' ? 'Generating' : 'Waiting'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/58">{section.content}</p>
                  </div>
                ))}
                <div className="text-slate-950">
                  <AiDynamicDashboard
                    definition={aiDashboard}
                    payload={payload}
                    report={aiDashboardReport}
                    filters={aiDashboardFilters}
                    loading={aiDashboardLoading}
                    error={aiDashboardError}
                    focus="ai"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(aiSections.map((section) => `${section.label}: ${section.content}`).join('\n'))}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/65 hover:bg-white/10 hover:text-white"
                  >
                    Copy Insight
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAiDashboard(null)
                      setAiRefreshKey((current) => current + 1)
                    }}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            )}

            {insightTab === 'charts' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-white">AI-Generated Chart Analysis</p>
                    <p className="mt-1 text-xs text-white/45">
                      Chart, dimensi, metric, agregasi, dan alasan analisis diambil dari dashboard definition AI untuk report ini.
                    </p>
                  </div>
                </div>
                <div className="text-slate-950">
                  <AiDynamicDashboard
                    definition={aiDashboard}
                    payload={payload}
                    report={aiDashboardReport}
                    filters={aiDashboardFilters}
                    loading={aiDashboardLoading}
                    error={aiDashboardError}
                    focus="charts"
                  />
                </div>
              </div>
            )}

            {insightTab === 'quality' && (
              <div className="space-y-2">
                {qualityItems.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0F2B1A] px-3 py-2">
                    <span className="text-xs font-bold text-white/60">{label}</span>
                    <span className="text-sm font-black text-emerald-300">{formatValue(value)}</span>
                  </div>
                ))}
              </div>
            )}

            {insightTab === 'metadata' && (
              <div className="space-y-2">
                {metadataEntries.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 rounded-xl border border-white/10 bg-[#0F2B1A] px-3 py-2 text-xs">
                    <span className="text-white/40">{label}</span>
                    <span className="truncate text-right font-bold text-white">{formatValue(value)}</span>
                  </div>
                ))}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">Safety</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/55">
                    AI hanya membaca payload result. Query report tetap SELECT-only melalui backend allowlist.
                  </p>
                </div>
              </div>
            )}

            {insightTab === 'recommendations' && (
              <div className="space-y-4">
                <div className="text-slate-950">
                  <AiDynamicDashboard
                    definition={aiDashboard}
                    payload={payload}
                    report={aiDashboardReport}
                    filters={aiDashboardFilters}
                    loading={aiDashboardLoading}
                    error={aiDashboardError}
                    focus="recommendations"
                  />
                </div>
                {viewerProfile.presets.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-[#0F2B1A] p-4">
                    <p className="text-xs font-black text-white">Suggested Next Filters</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {viewerProfile.presets.slice(0, 6).map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => applyReportPreset(preset)}
                          className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
        </div>
      </div>
    </main>
  )
}
