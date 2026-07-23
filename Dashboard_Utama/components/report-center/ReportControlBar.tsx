'use client'

import type { ReportFilterInput } from '@/lib/reports/report-filtering'

export type ItemTypeScope = 'inventory' | 'gudang' | 'workshop'

export type ReportControlBarProps = {
  periodValue: string
  analysisGroupValue: string
  movementWindowValue: string
  /** Default inventory = ItemType 1+4 (Gudang + Workshop). */
  itemTypeValue?: ItemTypeScope
  analysisGroupOptions: ReadonlyArray<{ field: string; label: string }>
  movementWindowOptions: ReadonlyArray<{ value: string; label: string }>
  appliedFilters: ReportFilterInput
  onPeriodChange: (period: string | undefined) => void
  onAnalysisGroupChange: (groupBy: string) => void
  onMovementWindowChange: (window: string) => void
  onItemTypeChange?: (itemType: ItemTypeScope) => void
  onMoreFilters: () => void
  className?: string
}

function resolveItemTypeScope(value?: string): ItemTypeScope {
  if (value === 'gudang' || value === '1') return 'gudang'
  if (value === 'workshop' || value === '4') return 'workshop'
  return 'inventory'
}

const ITEM_TYPE_SEGMENTS: Array<{ value: ItemTypeScope; label: string; hint: string }> = [
  { value: 'inventory', label: '1+4', hint: 'Gudang + Workshop' },
  { value: 'gudang', label: 'Gudang', hint: 'ItemType 1' },
  { value: 'workshop', label: 'Workshop', hint: 'ItemType 4' },
]

function segmentBtnClass(active: boolean) {
  return [
    'min-w-0 flex-1 px-2 py-1.5 text-center text-[10px] font-black uppercase tracking-[0.08em] transition',
    active
      ? 'bg-lime-400/20 text-lime-100 shadow-[inset_0_0_0_1px_rgba(163,230,53,0.35)]'
      : 'bg-transparent text-white/45 hover:bg-white/5 hover:text-white/80',
  ].join(' ')
}

export function ReportControlBar({
  periodValue,
  analysisGroupValue,
  movementWindowValue,
  itemTypeValue = 'inventory',
  analysisGroupOptions,
  movementWindowOptions,
  onPeriodChange,
  onAnalysisGroupChange,
  onMovementWindowChange,
  onItemTypeChange,
  onMoreFilters,
  className,
}: ReportControlBarProps) {
  const itemType = resolveItemTypeScope(itemTypeValue)

  return (
    <div
      className={[
        'grid gap-3 border-b border-white/10 px-1 pb-3',
        'lg:grid-cols-[minmax(0,1fr)_auto]',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <label className="block min-w-0">
        <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-white/35">Actual period</span>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <input
            type="month"
            value={periodValue}
            onChange={(event) => onPeriodChange(event.target.value || undefined)}
            className="h-8 w-full rounded-[10px] border-0 bg-transparent px-2 text-xs font-bold text-white outline-none"
          />
        </div>
      </label>

      <label className="block min-w-0">
        <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-white/35">Analysis group</span>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <select
            value={analysisGroupValue}
            onChange={(event) => onAnalysisGroupChange(event.target.value)}
            className="h-8 w-full rounded-[10px] border-0 bg-transparent px-2 text-xs font-bold text-white outline-none"
          >
            {analysisGroupOptions.map((option) => (
              <option key={option.field} value={option.field}>{option.label}</option>
            ))}
          </select>
        </div>
      </label>

      <label className="block min-w-0">
        <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-white/35">Movement period</span>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <select
            value={movementWindowValue}
            onChange={(event) => onMovementWindowChange(event.target.value)}
            className="h-8 w-full rounded-[10px] border-0 bg-transparent px-2 text-xs font-bold text-white outline-none"
          >
            {movementWindowOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </label>

      <div className="min-w-0">
        <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-white/35">
          Item type
          <span className="ml-1 font-bold normal-case tracking-normal text-white/30">
            {itemType === 'inventory' ? 'Gudang+Workshop' : itemType === 'gudang' ? 'Gudang only' : 'Workshop only'}
          </span>
        </span>
        {/* Segmented box frame — exclusive scope for monthly inventory analysis */}
        <div
          role="radiogroup"
          aria-label="Item type scope"
          className="flex overflow-hidden rounded-xl border border-white/10 bg-[#06101d]/90 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        >
          {ITEM_TYPE_SEGMENTS.map((segment, index) => {
            const active = itemType === segment.value
            return (
              <button
                key={segment.value}
                type="button"
                role="radio"
                aria-checked={active}
                title={segment.hint}
                onClick={() => onItemTypeChange?.(segment.value)}
                className={[
                  segmentBtnClass(active),
                  index > 0 ? 'border-l border-white/10' : '',
                  index === 0 ? 'rounded-l-[10px]' : '',
                  index === ITEM_TYPE_SEGMENTS.length - 1 ? 'rounded-r-[10px]' : '',
                ].join(' ')}
              >
                <span className="block leading-none">{segment.label}</span>
                <span className={['mt-0.5 block text-[8px] font-bold normal-case tracking-normal', active ? 'text-lime-100/70' : 'text-white/25'].join(' ')}>
                  {segment.hint}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-end lg:justify-end">
        <button
          type="button"
          onClick={onMoreFilters}
          className="h-[42px] rounded-xl border border-lime-300/25 bg-lime-300/10 px-4 text-[11px] font-black text-lime-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-lime-300/18"
        >
          More filters
        </button>
        <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-[11px] font-semibold leading-4 text-white/45">
          Primary controls stay visible. AI, SQL, and manual filters remain secondary.
        </div>
      </div>
    </div>
  )
}

export default ReportControlBar
