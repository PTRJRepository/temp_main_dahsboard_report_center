'use client'

import { formatInventoryQuantityBreakdown } from '@modules/report-center/lib/reports/report-detail-performance'
import { formatMetric } from '@/utils/format'
import { movementTone } from '@modules/report-center/components/report-center/reportTableCells'

type DbRow = Record<string, unknown>

export type ReportRowDetailProps = {
  row: DbRow
  columns: string[]
  colSpan: number
  mode: 'generic' | 'movement'
  displayColumnLabel: (column: string) => string
}

function formatValue(value: unknown, field?: string) {
  return formatMetric(value, field)
}

export function ReportRowDetail({ row, columns, colSpan, mode, displayColumnLabel }: ReportRowDetailProps) {
  const genericDetails: Array<[string, unknown]> = columns
    .filter((column) => row[column] !== null && row[column] !== undefined && row[column] !== '')
    .slice(0, 12)
    .map((column): [string, unknown] => [displayColumnLabel(column), row[column]])

  const itemCode = row.KodeBarang ?? row.item_code ?? row.ItemCode ?? '-'
  const itemName = row.NamaBarang ?? row.description ?? row.ItemDescription ?? '-'
  const category = row.MovementCategory ?? row.RiskLevel ?? row.AgingBucket
  const categoryText = String(category ?? '').toLowerCase()
  const accentClass = categoryText.includes('dead')
    ? 'border-l-red-400'
    : categoryText.includes('slow') || categoryText.includes('stale')
      ? 'border-l-amber-400'
      : 'border-l-emerald-400'
  const movementMetrics = ([
    ['Real-Time Qty', formatInventoryQuantityBreakdown(row)],
    ['Asset Amount', row.AmountItem ?? row.AmountCurrent ?? row.TotalAssetAmount ?? row.TotalAmount],
    ['SI Count', row.StockIssueMovementCount ?? row.StockIssueEventCount],
    ['SI Qty', row.StockIssueMovementQty ?? row.StockIssueQtyAllPeriod],
    ['SI Amount', row.StockIssueMovementAmountTransaksi ?? row.StockIssueMovementAmount ?? row.StockIssueAmountAllPeriod],
    ['Gap Qty', row.StockIssueMovementGapQty ?? row.MovementGapQty],
  ] as Array<[string, unknown]>).filter(([, value]) => value !== null && value !== undefined && value !== '')

  const movementFacts = ([
    ['Gudang', row.Gudang ?? row.location ?? row.Location],
    ['Last Movement', row.LastStockIssueMovementDate ?? row.LastMovementDate],
    ['Movement Source', row.MovementSource],
    ['Item Type', row.ItemTypeName ?? row.ItemType],
  ] as Array<[string, unknown]>).filter(([, value]) => value !== null && value !== undefined && value !== '')

  const analysis = row.MovementAnalysis ?? row.StaleMovementRelation ?? row.IssueSummary
  const movementEvents = ([
    ['StockIssue Movement Event 1', row.StockIssueMovementEvent1 ?? row.MovementEvent1],
    ['StockIssue Movement Event 2', row.StockIssueMovementEvent2 ?? row.MovementEvent2],
  ] as Array<[string, unknown]>).filter(([, value]) => value !== null && value !== undefined && value !== '')

  const genericRows = mode === 'movement' ? [] : genericDetails
  const metricRows = movementMetrics.length > 0 ? movementMetrics : genericRows.slice(0, 6)
  const factRows = movementFacts.length > 0 ? movementFacts : genericRows.slice(6, 10)

  return (
    <tr className="bg-[#FBFDFF]">
      <td colSpan={Math.max(colSpan, 1)} className="border-b border-slate-200 p-0">
        <div className={`border-l-4 ${accentClass} bg-[#FBFDFF] px-2.5 py-2 shadow-inner`}>
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{mode === 'movement' ? 'Movement detail' : 'Row detail'}</p>
              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs font-black text-slate-950">{formatValue(itemCode)}</span>
                <span className="min-w-0 max-w-full text-xs font-bold leading-4 text-slate-800 line-clamp-2">{formatValue(itemName)}</span>
              </div>
            </div>
            {category !== undefined && (
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${movementTone(category)}`}>
                {formatValue(category)}
              </span>
            )}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {metricRows.map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5">
                <p className="truncate text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-0.5 truncate text-xs font-black text-slate-950">{formatValue(value)}</p>
              </div>
            ))}
          </div>

          {(analysis || factRows.length > 0 || movementEvents.length > 0) && (
            <div className="mt-2 grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_minmax(200px,0.45fr)]">
              <div className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5">
                <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">Analysis</p>
                <p className="mt-0.5 text-xs font-semibold leading-4 text-slate-800 line-clamp-3">{formatValue(analysis ?? movementEvents[0]?.[1] ?? '-')}</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {factRows.map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5">
                    <p className="truncate text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-0.5 truncate text-[11px] font-bold text-slate-800">{formatValue(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export default ReportRowDetail
