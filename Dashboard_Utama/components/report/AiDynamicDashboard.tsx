'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  Lightbulb,
  ListChecks,
  Maximize2,
  Sparkles,
  Table2,
  Target,
  X,
} from 'lucide-react'
import {
  buildReportAnalysisPayload,
  getDataSourceRows,
  toNumber,
  type AiChartDefinition,
  type AiDashboardDefinition,
  type AiFormat,
  type AiInsight,
  type AiPriorityTable,
  type DbRow,
  type ReportPayload,
} from '@/lib/reports/ai-dashboard'

type AiDynamicDashboardProps = {
  definition: AiDashboardDefinition | null
  payload: ReportPayload | null
  report: {
    code: string
    name: string
    description: string
  }
  filters?: DbRow
  loading?: boolean
  error?: string | null
  focus?: 'full' | 'ai' | 'charts' | 'recommendations'
}

type SegmentFilter = {
  chartId: string
  field: string
  value: string | number
}

const palette = ['#167A3A', '#2563EB', '#D99A00', '#DC2626', '#7C3AED', '#0D9488', '#EA580C', '#64748B']

function formatValue(value: unknown, format?: AiFormat | 'currency' | 'number' | 'percentage') {
  if (value === null || value === undefined || value === '') return '-'
  if (format === 'currency') {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(toNumber(value))
  }
  if (format === 'percentage') return `${toNumber(value).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`
  if (typeof value === 'number' || format === 'number') return toNumber(value).toLocaleString('id-ID', { maximumFractionDigits: 2 })
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
    }
    return value
  }
  return String(value)
}

function getPathValue(path: string, payload: ReportPayload | null) {
  if (!payload) return undefined
  if (path.startsWith('summary.')) return payload.summary?.[path.slice('summary.'.length)]
  return path.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object') return (current as DbRow)[part]
    return undefined
  }, payload as unknown)
}

function severityClass(severity: string) {
  if (severity === 'critical') return 'border-red-200 bg-red-50 text-red-700'
  if (severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (severity === 'info') return 'border-blue-200 bg-blue-50 text-blue-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function severityAccent(severity: string) {
  if (severity === 'critical') return '#DC2626'
  if (severity === 'warning') return '#D99A00'
  if (severity === 'info') return '#2563EB'
  return '#64748B'
}

function labelValue(row: DbRow, chart: AiChartDefinition) {
  const field = chart.xField ?? chart.categoryField
  if (field && row[field] !== undefined) return String(row[field])
  const firstText = Object.values(row).find((value) => typeof value === 'string' && value.trim())
  return firstText ? String(firstText) : 'Data'
}

function metricValue(row: DbRow, chart: AiChartDefinition) {
  if (chart.type === 'heatmap' && chart.valueField) return toNumber(row[chart.valueField])
  const field = chart.yField ?? chart.valueField
  if (field) return toNumber(row[field])
  return Math.max(0, ...Object.values(row).map(toNumber))
}

function prepareChartRows(chart: AiChartDefinition, analysisRows: DbRow[]) {
  const sorted = [...analysisRows]
  if (chart.sort?.field) {
    sorted.sort((a, b) => {
      const delta = toNumber(a[chart.sort!.field]) - toNumber(b[chart.sort!.field])
      return chart.sort!.direction === 'asc' ? delta : -delta
    })
  }
  return sorted.slice(0, chart.limit ?? 20)
}

function rowsToCsv(rows: DbRow[]) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escapeCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(','))].join('\n')
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function exportExcel(filename: string, rows: DbRow[]) {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'AI Chart')
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

async function exportPdf(title: string, filename: string, rows: DbRow[]) {
  const { default: JsPDF } = await import('jspdf')
  const doc = new JsPDF({ orientation: 'landscape', unit: 'pt' })
  const columns = rows[0] ? Object.keys(rows[0]).slice(0, 7) : []
  let y = 44
  doc.setFontSize(14)
  doc.text(title.slice(0, 90), 40, y)
  y += 24
  doc.setFontSize(8)
  doc.text(columns.join(' | '), 40, y)
  y += 14
  rows.slice(0, 30).forEach((row) => {
    doc.text(columns.map((column) => formatValue(row[column])).join(' | ').slice(0, 150), 40, y)
    y += 13
  })
  doc.save(`${filename}.pdf`)
}

function Tile({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-[#DDE6F0] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] ${className}`}>
      {children}
    </div>
  )
}

function chartPalette(chart: AiChartDefinition) {
  return chart.config?.colorPalette?.length ? chart.config.colorPalette : palette
}

function chartHeightClass(chart: AiChartDefinition, rowCount = 0) {
  if (chart.config?.height === 'compact' || rowCount <= 4) return 'h-36'
  if (chart.config?.height === 'tall') return 'h-64'
  return 'h-48'
}

function thresholdMatches(row: DbRow, chart: AiChartDefinition) {
  const threshold = chart.config?.threshold
  if (!threshold) return false
  const value = toNumber(row[threshold.field])
  if (threshold.operator === '>') return value > threshold.value
  if (threshold.operator === '>=') return value >= threshold.value
  if (threshold.operator === '<') return value < threshold.value
  if (threshold.operator === '<=') return value <= threshold.value
  if (threshold.operator === '=') return value === threshold.value
  if (threshold.operator === '!=') return value !== threshold.value
  return false
}

function chartColor(chart: AiChartDefinition, row: DbRow, index: number, value: number, max: number) {
  const colors = chartPalette(chart)
  if (thresholdMatches(row, chart)) return chart.config?.threshold?.color ?? '#DC2626'
  if (chart.config?.colorMode === 'single') return colors[0] ?? '#167A3A'
  if (chart.config?.colorMode === 'gradient') {
    const alpha = 0.28 + Math.min(0.72, Math.abs(value) / Math.max(1, max))
    return `rgba(22, 122, 58, ${alpha})`
  }
  return colors[index % colors.length]
}

function triggerSegment(chart: AiChartDefinition, row: DbRow, onSegment: (row: DbRow) => void) {
  if (chart.config?.interaction?.clickFilter === false) return
  onSegment(row)
}

function DonutChart({
  rows,
  chart,
  onSegment,
}: {
  rows: DbRow[]
  chart: AiChartDefinition
  onSegment: (row: DbRow) => void
}) {
  const colors = chartPalette(chart)
  const total = rows.reduce((sum, row) => sum + Math.max(0, metricValue(row, chart)), 0)
  let cursor = 0
  const gradient = rows.map((row, index) => {
    const value = total > 0 ? (Math.max(0, metricValue(row, chart)) / total) * 100 : 0
    const segment = `${chartColor(chart, row, index, value, total)} ${cursor}% ${cursor + value}%`
    cursor += value
    return segment
  }).join(', ')

  return (
    <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
      <button
        type="button"
        aria-label={chart.title}
        className="mx-auto h-40 w-40 rounded-full border border-slate-200 shadow-inner"
        style={{ background: total > 0 ? `conic-gradient(${gradient})` : '#E2E8F0' }}
      />
      <div className={chart.config?.showLegend === false ? 'hidden' : 'space-y-2'}>
        {rows.map((row, index) => (
          <button
            key={`${chart.id}-${index}`}
            type="button"
            onClick={() => triggerSegment(chart, row, onSegment)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-emerald-200 hover:bg-emerald-50"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
              <span className="truncate text-sm font-bold text-slate-700">{labelValue(row, chart)}</span>
            </span>
            {chart.config?.showValueLabels !== false && (
              <span className="text-sm font-extrabold text-slate-950">{formatValue(metricValue(row, chart), chart.format)}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function BarChart({
  rows,
  chart,
  onSegment,
}: {
  rows: DbRow[]
  chart: AiChartDefinition
  onSegment: (row: DbRow) => void
}) {
  const max = Math.max(1, ...rows.map((row) => Math.abs(metricValue(row, chart))))
  const vertical = chart.config?.orientation === 'vertical' || chart.type === 'column'
  if (vertical) {
    return (
      <div>
        <div className={`flex items-end gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-4 ${chartHeightClass(chart, rows.length)}`}>
          {rows.map((row, index) => {
            const value = metricValue(row, chart)
            const height = Math.max(7, (Math.abs(value) / max) * 100)
            return (
              <button key={`${chart.id}-${index}`} type="button" onClick={() => triggerSegment(chart, row, onSegment)} className="flex h-full min-w-10 flex-1 flex-col justify-end gap-2 text-center">
                {chart.config?.showValueLabels !== false && <span className="truncate text-[11px] font-bold text-slate-600">{formatValue(value, chart.format)}</span>}
                <span className="block rounded-t-xl" style={{ height: `${height}%`, backgroundColor: chartColor(chart, row, index, value, max) }} />
              </button>
            )
          })}
        </div>
        <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(rows.length || 1, 6)}, minmax(0,1fr))` }}>
          {rows.slice(0, 6).map((row, index) => (
            <span key={index} className="truncate text-center text-[11px] font-semibold text-slate-500">{labelValue(row, chart)}</span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const value = metricValue(row, chart)
        const width = Math.max(4, (Math.abs(value) / max) * 100)
        return (
          <button
            key={`${chart.id}-${index}`}
            type="button"
            onClick={() => triggerSegment(chart, row, onSegment)}
            className="block w-full rounded-xl border border-transparent p-1 text-left hover:border-emerald-200 hover:bg-emerald-50"
          >
            <div className="flex justify-between gap-3 text-sm">
              <span className="truncate font-bold text-slate-700">{labelValue(row, chart)}</span>
              {chart.config?.showValueLabels !== false && <span className="shrink-0 text-slate-500">{formatValue(value, chart.format)}</span>}
            </div>
            <div className="mt-1 h-3 rounded-full bg-slate-100">
              <div className="h-3 rounded-full" style={{ width: `${width}%`, backgroundColor: chartColor(chart, row, index, value, max) }} />
            </div>
          </button>
        )
      })}
    </div>
  )
}

function LineChart({ rows, chart }: { rows: DbRow[]; chart: AiChartDefinition }) {
  const colors = chartPalette(chart)
  const values = rows.map((row) => metricValue(row, chart))
  const max = Math.max(1, ...values)
  const min = Math.min(0, ...values)
  const range = Math.max(1, max - min)
  const points = values.map((value, index) => {
    const x = rows.length <= 1 ? 0 : (index / (rows.length - 1)) * 100
    const y = 100 - ((value - min) / range) * 88 - 6
    return `${x},${y}`
  }).join(' ')

  return (
    <div>
      <svg viewBox="0 0 100 110" className={`${chartHeightClass(chart, rows.length)} w-full overflow-visible rounded-xl border border-slate-100 bg-slate-50 p-2`}>
        {chart.config?.showGrid !== false && [25, 50, 75].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#CBD5E1" strokeWidth="0.4" />)}
        <polyline fill="none" stroke={colors[0] ?? '#167A3A'} strokeWidth="2.6" points={points} vectorEffect="non-scaling-stroke" />
        {values.map((value, index) => {
          const x = rows.length <= 1 ? 0 : (index / (rows.length - 1)) * 100
          const y = 100 - ((value - min) / range) * 88 - 6
          return <circle key={index} cx={x} cy={y} r="1.8" fill={colors[0] ?? '#167A3A'} />
        })}
      </svg>
      <div className="mt-3 flex justify-between gap-3 text-xs font-semibold text-slate-500">
        <span className="truncate">{rows[0] ? labelValue(rows[0], chart) : '-'}</span>
        <span className="truncate text-right">{rows[rows.length - 1] ? labelValue(rows[rows.length - 1], chart) : '-'}</span>
      </div>
    </div>
  )
}

function ScatterChart({ rows, chart }: { rows: DbRow[]; chart: AiChartDefinition }) {
  const xField = chart.xField ?? ''
  const yField = chart.yField ?? ''
  const xValues = rows.map((row) => toNumber(row[xField]))
  const yValues = rows.map((row) => toNumber(row[yField]))
  const xMin = Math.min(0, ...xValues)
  const xMax = Math.max(1, ...xValues)
  const yMin = Math.min(0, ...yValues)
  const yMax = Math.max(1, ...yValues)

  return (
    <svg viewBox="0 0 100 100" className={`${chartHeightClass(chart, rows.length)} w-full rounded-xl border border-slate-100 bg-slate-50`}>
      {chart.config?.showGrid !== false && [25, 50, 75].map((line) => (
        <g key={line}>
          <line x1={line} x2={line} y1="0" y2="100" stroke="#CBD5E1" strokeWidth="0.35" />
          <line x1="0" x2="100" y1={line} y2={line} stroke="#CBD5E1" strokeWidth="0.35" />
        </g>
      ))}
      {rows.map((row, index) => {
        const x = 8 + ((toNumber(row[xField]) - xMin) / Math.max(1, xMax - xMin)) * 84
        const y = 92 - ((toNumber(row[yField]) - yMin) / Math.max(1, yMax - yMin)) * 84
        return (
          <circle key={index} cx={x} cy={y} r="2.6" fill={chartColor(chart, row, index, toNumber(row[yField]), yMax)} opacity="0.82">
            <title>{`${labelValue(row, chart)}: ${formatValue(row[xField])}, ${formatValue(row[yField], chart.format)}`}</title>
          </circle>
        )
      })}
    </svg>
  )
}

function HeatmapChart({
  rows,
  chart,
  onSegment,
}: {
  rows: DbRow[]
  chart: AiChartDefinition
  onSegment: (row: DbRow) => void
}) {
  const max = Math.max(1, ...rows.map((row) => metricValue(row, chart)))
  const colors = chartPalette(chart)
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row, index) => {
        const value = metricValue(row, chart)
        const opacity = 0.12 + Math.min(0.78, value / max)
        return (
          <button
            key={`${chart.id}-${index}`}
            type="button"
            onClick={() => triggerSegment(chart, row, onSegment)}
            className="rounded-2xl border border-emerald-100 p-3 text-left hover:border-emerald-300"
            style={{ backgroundColor: chart.config?.colorMode === 'category' ? `${colors[index % colors.length]}26` : `rgba(22, 122, 58, ${opacity})` }}
          >
            <p className="truncate text-xs font-bold text-slate-900">{formatValue(row[chart.xField ?? ''])}</p>
            <p className="mt-1 truncate text-xs text-slate-700">{formatValue(row[chart.yField ?? ''])}</p>
            <p className="mt-2 text-sm font-extrabold text-slate-950">{formatValue(value, chart.format)}</p>
          </button>
        )
      })}
    </div>
  )
}

function DataTableChart({ rows }: { rows: DbRow[] }) {
  const columns = rows[0] ? Object.keys(rows[0]).slice(0, 7) : []
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>{columns.map((column) => <th key={column} className="whitespace-nowrap px-3 py-2 font-bold">{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.slice(0, 12).map((row, index) => (
            <tr key={index}>
              {columns.map((column) => <td key={column} className="whitespace-nowrap px-3 py-2 text-slate-700">{formatValue(row[column])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartTile({
  chart,
  rows,
  collapsed,
  highlighted,
  onToggle,
  onSegment,
}: {
  chart: AiChartDefinition
  rows: DbRow[]
  collapsed: boolean
  highlighted: boolean
  onToggle: () => void
  onSegment: (chart: AiChartDefinition, row: DbRow) => void
}) {
  const filename = `ai-chart-${chart.id}`
  const segmentHandler = (row: DbRow) => onSegment(chart, row)
  const exportEnabled = chart.config?.interaction?.exportEnabled !== false
  const dimension = chart.xField ?? chart.categoryField ?? '-'
  const metric = chart.yField ?? chart.valueField ?? '-'
  const insight = chart.dataNote ?? chart.description

  return (
    <Tile className={highlighted ? 'ring-4 ring-emerald-500/20' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">{chart.type.replace('_', ' ')}</span>
          <h3 className="mt-2 text-base font-extrabold leading-6 text-slate-950">{chart.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{insight}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
            <span className="rounded-md bg-slate-100 px-2 py-1">Rows: {rows.length.toLocaleString('id-ID')}</span>
            <span className="rounded-md bg-slate-100 px-2 py-1">Dimension: {dimension}</span>
            <span className="rounded-md bg-slate-100 px-2 py-1">Metric: {metric}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {exportEnabled && (
            <>
              <button type="button" onClick={() => downloadBlob(`${filename}.csv`, rowsToCsv(rows), 'text/csv;charset=utf-8')} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Export CSV" title="Export CSV">
                <Download size={15} />
              </button>
              <button type="button" onClick={() => void exportExcel(filename, rows)} className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" aria-label="Export Excel" title="Export Excel">
                <FileSpreadsheet size={15} />
              </button>
              <button type="button" onClick={() => void exportPdf(chart.title, filename, rows)} className="grid h-9 w-9 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" aria-label="Export PDF" title="Export PDF">
                <FileText size={15} />
              </button>
            </>
          )}
          <button type="button" onClick={onToggle} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label={collapsed ? 'Expand chart' : 'Collapse chart'}>
            {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
      </div>

      <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-xs font-black text-slate-700">Reason & action</summary>
        <p className="mt-2 text-xs leading-5 text-slate-500">{chart.reason}</p>
        {chart.dataNote && <p className="mt-2 text-xs font-semibold leading-5 text-emerald-700">{chart.dataNote}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
          {chart.config?.orientation && <span className="rounded-md bg-white px-2 py-1">Orientation: {chart.config.orientation}</span>}
          {chart.config?.colorMode && <span className="rounded-md bg-white px-2 py-1">Color: {chart.config.colorMode}</span>}
          {chart.config?.threshold && <span className="rounded-md bg-white px-2 py-1">Threshold: {chart.config.threshold.label}</span>}
        </div>
      </details>

      {!collapsed && (
        <div className="mt-4">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
              {chart.config?.emptyStateMessage ?? 'Data chart tidak tersedia pada payload ini.'}
            </div>
          ) : chart.type === 'donut' ? (
            <DonutChart rows={rows} chart={chart} onSegment={segmentHandler} />
          ) : chart.type === 'line' || chart.type === 'area' ? (
            <LineChart rows={rows} chart={chart} />
          ) : chart.type === 'scatter' ? (
            <ScatterChart rows={rows} chart={chart} />
          ) : chart.type === 'heatmap' ? (
            <HeatmapChart rows={rows} chart={chart} onSegment={segmentHandler} />
          ) : chart.type === 'table' ? (
            <DataTableChart rows={rows} />
          ) : (
            <BarChart rows={rows} chart={chart} onSegment={segmentHandler} />
          )}
          {(chart.config?.xAxisLabel || chart.config?.yAxisLabel) && (
            <div className="mt-3 flex flex-wrap justify-between gap-3 text-xs font-semibold text-slate-500">
              <span>{chart.config.xAxisLabel}</span>
              <span>{chart.config.yAxisLabel}</span>
            </div>
          )}
        </div>
      )}
    </Tile>
  )
}

function rowMatchesFilter(row: DbRow, filter: AiPriorityTable['filters'][number]) {
  const value = row[filter.field]
  const numericValue = toNumber(value)
  const filterValue = filter.value
  const numericFilter = Array.isArray(filterValue) ? 0 : toNumber(filterValue)
  if (filter.operator === '=') return String(value ?? '') === String(filterValue)
  if (filter.operator === '!=') return String(value ?? '') !== String(filterValue)
  if (filter.operator === '>') return numericValue > numericFilter
  if (filter.operator === '>=') return numericValue >= numericFilter
  if (filter.operator === '<') return numericValue < numericFilter
  if (filter.operator === '<=') return numericValue <= numericFilter
  if (filter.operator === 'contains') return String(value ?? '').toLowerCase().includes(String(filterValue).toLowerCase())
  if (filter.operator === 'in') {
    const values = Array.isArray(filterValue) ? filterValue : [filterValue]
    return values.map(String).includes(String(value ?? ''))
  }
  return true
}

function PriorityTableTile({
  table,
  rows,
  segmentFilter,
}: {
  table: AiPriorityTable
  rows: DbRow[]
  segmentFilter: SegmentFilter | null
}) {
  const [sort, setSort] = useState(table.sort[0])
  const filteredRows = useMemo(() => {
    let next = rows.filter((row) => table.filters.every((filter) => rowMatchesFilter(row, filter)))
    if (segmentFilter && table.columns.includes(segmentFilter.field)) {
      next = next.filter((row) => String(row[segmentFilter.field] ?? '') === String(segmentFilter.value))
    }
    const activeSort = sort ?? table.sort[0]
    if (activeSort) {
      next = [...next].sort((a, b) => {
        const delta = toNumber(a[activeSort.field]) - toNumber(b[activeSort.field])
        if (delta !== 0) return activeSort.direction === 'asc' ? delta : -delta
        return String(a[activeSort.field] ?? '').localeCompare(String(b[activeSort.field] ?? ''))
      })
    }
    return next.slice(0, table.limit)
  }, [rows, segmentFilter, sort, table])

  const toggleSort = (field: string) => {
    setSort((current) => ({
      field,
      direction: current?.field === field && current.direction === 'desc' ? 'asc' : 'desc',
    }))
  }

  return (
    <Tile>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Priority Table</p>
          <h3 className="mt-1 text-lg font-extrabold text-slate-950">{table.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{table.description}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
          <Table2 size={14} />
          {filteredRows.length} row
        </span>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {table.columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-3 py-2 font-bold">
                  <button type="button" onClick={() => toggleSort(column)} className="hover:text-emerald-700">
                    {column}{sort?.field === column ? (sort.direction === 'asc' ? ' ^' : ' v') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(table.columns.length, 1)} className="px-3 py-8 text-center text-slate-500">
                  Tidak ada item yang cocok dengan filter prioritas.
                </td>
              </tr>
            ) : filteredRows.map((row, index) => (
              <tr key={index} className="hover:bg-slate-50">
                {table.columns.map((column) => (
                  <td key={column} className="whitespace-nowrap px-3 py-2 text-slate-700">{formatValue(row[column])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Tile>
  )
}

function InsightTile({
  insight,
  onHighlight,
}: {
  insight: AiInsight
  onHighlight: (chartId?: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onHighlight(insight.relatedChartId)}
      className={`rounded-xl border p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 ${severityClass(insight.severity)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-75">{insight.severity}</p>
          <h3 className="mt-1 text-base font-extrabold">{insight.title}</h3>
        </div>
        <Lightbulb size={18} />
      </div>
      <p className="mt-3 text-sm leading-6"><span className="font-black">What happened:</span> {insight.finding}</p>
      <p className="mt-2 text-xs font-semibold leading-5"><span className="font-black">Why it matters:</span> {insight.businessImpact}</p>
      <p className="mt-2 text-xs font-extrabold leading-5"><span className="font-black">Recommended action:</span> {insight.recommendedAction}</p>
      <div className="mt-3 rounded-lg border border-white/50 bg-white/60 p-3 text-xs leading-5 text-slate-700">
        Evidence: {insight.evidence.source}.{insight.evidence.field}
        {insight.evidence.value !== undefined ? ` = ${formatValue(insight.evidence.value)}` : ''}
      </div>
    </button>
  )
}

export default function AiDynamicDashboard({
  definition,
  payload,
  report,
  filters = {},
  loading = false,
  error,
  focus = 'full',
}: AiDynamicDashboardProps) {
  const [collapsedCharts, setCollapsedCharts] = useState<Record<string, boolean>>({})
  const [highlightedChartId, setHighlightedChartId] = useState<string | null>(null)
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter | null>(null)

  const analysis = useMemo(() => {
    if (!payload) return null
    return buildReportAnalysisPayload({ reportCode: report.code, payload, filters })
  }, [filters, payload, report.code])

  const chartRows = useMemo(() => {
    if (!definition || !analysis) return new Map<string, DbRow[]>()
    return new Map(
      definition.charts.map((chart) => [
        chart.id,
        prepareChartRows(chart, chart.data?.length ? chart.data : getDataSourceRows(chart.dataSource, analysis, payload?.rows)),
      ]),
    )
  }, [analysis, definition, payload?.rows])

  const onSegment = (chart: AiChartDefinition, row: DbRow) => {
    const field = chart.xField ?? chart.categoryField
    if (!field) return
    setSegmentFilter({ chartId: chart.id, field, value: row[field] as string | number })
  }

  if (loading) {
    return (
      <Tile className="min-h-[320px]">
        <div className="flex items-center gap-3 text-slate-700">
          <Sparkles className="animate-pulse text-emerald-700" size={20} />
          <span className="text-sm font-bold">AI sedang membaca payload dan membuat dashboard definition...</span>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-[18px] bg-slate-100" />)}
        </div>
      </Tile>
    )
  }

  if (error) {
    return (
      <Tile className="border-red-200 bg-red-50">
        <div className="flex items-start gap-3 text-red-700">
          <AlertTriangle size={20} />
          <div>
            <p className="font-extrabold">AI dynamic dashboard gagal dibuat</p>
            <p className="mt-1 text-sm leading-6">{error}</p>
          </div>
        </div>
      </Tile>
    )
  }

  if (!definition || !payload || !analysis) {
    return (
      <Tile>
        <div className="flex items-start gap-3 text-slate-700">
          <Sparkles className="text-emerald-700" size={20} />
          <div>
            <p className="font-extrabold">AI Dynamic Report Analysis</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Dashboard adaptif akan tampil setelah payload live report tersedia.
            </p>
          </div>
        </div>
      </Tile>
    )
  }

  const showOverview = focus === 'full' || focus === 'ai'
  const showKpis = focus === 'full'
  const showCharts = focus === 'full' || focus === 'charts'
  const showInsights = focus === 'full' || focus === 'ai'
  const showPriorityTables = focus === 'full' || focus === 'recommendations'
  const showActions = focus === 'full' || focus === 'ai' || focus === 'recommendations'
  const showMissingFields = focus === 'full' || focus === 'ai'

  return (
    <section className="space-y-5">
      {showOverview && (
        <div className="overflow-hidden rounded-[18px] border border-emerald-900/25 bg-[#052E2B] shadow-[0_18px_44px_rgba(6,78,59,0.24)]">
          <div className="grid gap-5 p-[18px] text-white lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-200">AI Dynamic Analysis</p>
              <h2 className="mt-2 text-2xl font-extrabold">{definition.dashboardTitle}</h2>
              <p className="mt-3 max-w-5xl text-sm leading-7 text-emerald-50/90">{definition.summary.mainFinding}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[18px] border border-white/10 bg-white/10 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100/80">Business Risk</p>
                  <p className="mt-2 text-sm leading-6 text-slate-100">{definition.summary.businessRisk}</p>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/10 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100/80">Recommended Focus</p>
                  <p className="mt-2 text-sm leading-6 text-slate-100">{definition.summary.recommendedFocus}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[18px] border border-white/10 bg-white/10 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100/80">Type</p>
                <p className="mt-2 truncate text-sm font-extrabold">{definition.detectedReportType}</p>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/10 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100/80">Rows</p>
                <p className="mt-2 text-sm font-extrabold">{analysis.profile.totalRows.toLocaleString('id-ID')}</p>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/10 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100/80">Fields</p>
                <p className="mt-2 text-sm font-extrabold">{analysis.fields.length.toLocaleString('id-ID')}</p>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/10 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100/80">Safety</p>
                <p className="mt-2 text-sm font-extrabold">JSON only</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showKpis && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {definition.kpiCards.map((card) => {
            const value = getPathValue(card.valuePath, payload)
            return (
              <Tile key={card.id} className="min-h-[132px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{card.title}</p>
                    <p className="mt-2 truncate text-2xl font-extrabold text-slate-950">
                      {formatValue(value, card.format)}{card.suffix ? ` ${card.suffix}` : ''}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{card.description}</p>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{ backgroundColor: severityAccent(card.severity) }}>
                    <Target size={19} />
                  </span>
                </div>
              </Tile>
            )
          })}
        </div>
      )}

      {showCharts && segmentFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="font-bold">
            Table filter dari chart: {segmentFilter.field} = {formatValue(segmentFilter.value)}
          </span>
          <button type="button" onClick={() => setSegmentFilter(null)} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-emerald-700">
            <X size={14} />
            Clear
          </button>
        </div>
      )}

      {showCharts && (
        <div className="grid gap-5 xl:grid-cols-2">
          {definition.charts.map((chart) => (
            <ChartTile
              key={chart.id}
              chart={chart}
              rows={chartRows.get(chart.id) ?? []}
              collapsed={Boolean(collapsedCharts[chart.id])}
              highlighted={highlightedChartId === chart.id}
              onToggle={() => setCollapsedCharts((current) => ({ ...current, [chart.id]: !current[chart.id] }))}
              onSegment={onSegment}
            />
          ))}
        </div>
      )}

      {showInsights && (
        <div className="grid gap-4 lg:grid-cols-3">
          {definition.insights.map((insight) => (
            <InsightTile key={insight.id} insight={insight} onHighlight={(chartId) => setHighlightedChartId(chartId ?? null)} />
          ))}
        </div>
      )}

      {showPriorityTables && definition.priorityTables.map((table) => (
        <PriorityTableTile
          key={table.id}
          table={table}
          rows={table.dataSource === 'sampleRows' ? analysis.sampleRows : payload.rows ?? []}
          segmentFilter={segmentFilter}
        />
      ))}

      {showActions && (
      <div className={showMissingFields ? 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]' : 'grid gap-5'}>
        <Tile>
          <div className="mb-4 flex items-center gap-2">
            <ListChecks className="text-emerald-700" size={20} />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Recommended Action</p>
              <h3 className="text-lg font-extrabold text-slate-950">Aksi Praktis</h3>
            </div>
          </div>
          <div className="space-y-3">
            {definition.recommendedActions.map((action) => (
              <div key={`${action.priority}-${action.action}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span className="rounded-xl bg-emerald-700 px-2.5 py-1 text-xs font-extrabold text-white">{action.priority}</span>
                  <span className="text-xs font-bold text-slate-500">{action.ownerSuggestion}</span>
                </div>
                <p className="mt-3 text-sm font-extrabold text-slate-950">{action.action}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{action.reason}</p>
              </div>
            ))}
          </div>
        </Tile>

        {showMissingFields && (
        <Tile>
          <div className="mb-4 flex items-center gap-2">
            <Maximize2 className="text-amber-600" size={20} />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">Missing Fields</p>
              <h3 className="text-lg font-extrabold text-slate-950">Data Tambahan</h3>
            </div>
          </div>
          {definition.missingFields.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-700">
              Field utama cukup untuk analisa dashboard saat ini.
            </div>
          ) : (
            <div className="space-y-3">
              {definition.missingFields.map((field) => (
                <div key={field.field} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-extrabold text-amber-900">{field.field}</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">{field.reason}</p>
                  <p className="mt-2 text-xs font-bold leading-5 text-amber-700">{field.benefit}</p>
                </div>
              ))}
            </div>
          )}
        </Tile>
        )}
      </div>
      )}
    </section>
  )
}
