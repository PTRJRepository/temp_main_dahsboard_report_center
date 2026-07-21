'use client'

import type { ReportFilterInput } from '@/lib/reports/report-filtering'

export type ReportControlBarProps = {
  periodValue: string
  analysisGroupValue: string
  movementWindowValue: string
  analysisGroupOptions: ReadonlyArray<{ field: string; label: string }>
  movementWindowOptions: ReadonlyArray<{ value: string; label: string }>
  appliedFilters: ReportFilterInput
  onPeriodChange: (period: string | undefined) => void
  onAnalysisGroupChange: (groupBy: string) => void
  onMovementWindowChange: (window: string) => void
  onMoreFilters: () => void
  className?: string
}

export function ReportControlBar({
  periodValue,
  analysisGroupValue,
  movementWindowValue,
  analysisGroupOptions,
  movementWindowOptions,
  onPeriodChange,
  onAnalysisGroupChange,
  onMovementWindowChange,
  onMoreFilters,
  className,
}: ReportControlBarProps) {
  return (
    <div className={['grid gap-2 border-b border-white/10 px-1 pb-2 md:grid-cols-[minmax(130px,0.55fr)_minmax(170px,0.7fr)_minmax(170px,0.7fr)_auto]', className].filter(Boolean).join(' ')}>
      <label className="block min-w-0">
        <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-white/35">Actual period</span>
        <input
          type="month"
          value={periodValue}
          onChange={(event) => onPeriodChange(event.target.value || undefined)}
          className="h-8 w-full rounded-lg border border-white/10 bg-white/5 px-2 text-xs font-bold text-white"
        />
      </label>
      <label className="block min-w-0">
        <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-white/35">Analysis group</span>
        <select
          value={analysisGroupValue}
          onChange={(event) => onAnalysisGroupChange(event.target.value)}
          className="h-8 w-full rounded-lg border border-white/10 bg-white/5 px-2 text-xs font-bold text-white"
        >
          {analysisGroupOptions.map((option) => (
            <option key={option.field} value={option.field}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className="block min-w-0">
        <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-white/35">Movement period</span>
        <select
          value={movementWindowValue}
          onChange={(event) => onMovementWindowChange(event.target.value)}
          className="h-8 w-full rounded-lg border border-white/10 bg-white/5 px-2 text-xs font-bold text-white"
        >
          {movementWindowOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <div className="flex items-end">
        <button
          type="button"
          onClick={onMoreFilters}
          className="h-8 rounded-lg border border-white/10 bg-white/5 px-3 text-[10px] font-black text-white/65 hover:bg-white/10 hover:text-white"
        >
          More filters
        </button>
      </div>
    </div>
  )
}

export default ReportControlBar
