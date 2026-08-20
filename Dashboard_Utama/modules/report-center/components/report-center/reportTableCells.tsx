'use client'

import { formatInventoryQuantityBreakdown } from '@/modules/report-center/lib/reports/report-detail-performance'
import { formatMetric, inferMetricKind } from '@/utils/format'

export type ReportTableDbRow = Record<string, unknown>

export function isAmountField(field?: string) {
  return inferMetricKind(field) === 'currency'
}

export function formatTableValue(value: unknown, field?: string) {
  return formatMetric(value, field)
}

export function bucketTone(value: unknown) {
  const text = String(value ?? '').toLowerCase()
  if (text.includes('dead')) return 'border-red-200 bg-red-50 text-red-700'
  if (text.includes('stale')) return 'border-orange-200 bg-orange-50 text-orange-700'
  if (text.includes('slow')) return 'border-yellow-200 bg-yellow-50 text-yellow-700'
  if (text.includes('pantau')) return 'border-blue-200 bg-blue-50 text-blue-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

export function riskTone(value: unknown) {
  const text = String(value ?? '').toLowerCase()
  if (text === 'critical') return 'border-red-200 bg-red-50 text-red-700'
  if (text === 'high') return 'border-orange-200 bg-orange-50 text-orange-700'
  if (text === 'medium') return 'border-yellow-200 bg-yellow-50 text-yellow-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

export function movementTone(value: unknown) {
  const text = String(value ?? '').toLowerCase()
  if (text.includes('fast')) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (text === 'moving') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (text.includes('slow')) return 'border-yellow-200 bg-yellow-50 text-yellow-700'
  if (text.includes('dead') || text.includes('stale') || text.includes('no movement')) {
    return 'border-red-200 bg-red-50 text-red-700'
  }
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

export function renderReportCell(column: string, value: unknown, row?: ReportTableDbRow) {
  if (column === 'QtyOnHandHold') {
    return (
      <span className="inline-flex max-w-full truncate whitespace-nowrap rounded border border-emerald-200 bg-emerald-50 px-1 py-0.5 text-[11px] font-semibold text-emerald-800">
        {row ? formatInventoryQuantityBreakdown(row) : formatTableValue(value, column)}
      </span>
    )
  }
  if (isAmountField(column)) {
    return (
      <span className="block max-w-full truncate text-right font-mono text-[11px] font-bold tabular-nums" title={String(formatTableValue(value, column))}>
        {formatTableValue(value, column)}
      </span>
    )
  }
  if (column === 'RiskLevel') {
    return <span className={`inline-block max-w-full truncate rounded border px-1 py-0.5 text-[10px] font-bold ${riskTone(value)}`}>{formatTableValue(value, column)}</span>
  }
  if (column === 'AgingBucket') {
    return <span className={`inline-block max-w-full truncate rounded border px-1 py-0.5 text-[10px] font-bold ${bucketTone(value)}`}>{formatTableValue(value, column)}</span>
  }
  if (column === 'MovementCategory') {
    return (
      <span className={`inline-block max-w-full truncate rounded border px-1 py-0.5 text-[10px] font-bold ${movementTone(value)}`} title={String(formatTableValue(value, column))}>
        {formatTableValue(value, column)}
      </span>
    )
  }
  if (column === 'StaleMovementRelation') {
    return <span className="block max-w-full whitespace-normal leading-4 line-clamp-2 text-[11px]" title={String(formatTableValue(value, column))}>{formatTableValue(value, column)}</span>
  }
  if (column === 'IssueSummary') {
    const issues = String(value ?? '')
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 2)
    if (!issues.length) return <span className="text-slate-400">-</span>
    return (
      <span className="flex max-w-full flex-wrap gap-0.5">
        {issues.map((issue) => (
          <span key={issue} className="max-w-full truncate rounded border border-amber-100 bg-amber-50 px-1 py-0.5 text-[10px] font-semibold text-amber-800">
            {issue}
          </span>
        ))}
      </span>
    )
  }
  if (/^(StockIssueEvent|MovementEvent)\d+$/.test(column) || /^StockIssueMovementEvent\d+$/.test(column)) {
    return <span className="block max-w-full whitespace-normal leading-4 line-clamp-2 text-[11px]" title={String(formatTableValue(value, column))}>{formatTableValue(value, column)}</span>
  }
  return formatTableValue(value, column)
}
