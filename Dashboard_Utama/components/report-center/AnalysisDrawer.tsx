'use client'

import { useEffect, useMemo, useRef } from 'react'
import { X } from 'lucide-react'

type Option = { value: string; label: string }

type SelectedGroup = { label: string; placeholder: string }

type TrendRow = { qty?: number; quantity?: number; amount?: number }

type PreviewData = {
  trend: TrendRow[]
  insightItems: string[]
}

export type AnalysisDrawerFilters = {
  period: string
  periodMode?: 'month' | 'year'
  customYear?: string
  movementWindow: string
  groupBy: string
  itemType: string
  location: string
  scopeCode: string
}

type AnalysisDrawerProps = {
  open: boolean
  onClose: () => void
  filters: AnalysisDrawerFilters
  onFilter: (key: string, value: string) => void
  scopeDraft: string
  onScopeDraft: (value: string) => void
  onReset: () => void
  onApply: () => void
  periods: Option[]
  movementWindowOptions: Option[]
  analysisGroupOptions: Option[]
  selectedGroup: SelectedGroup
  preview: PreviewData
}

function trendPoint(row: TrendRow): number {
  return Number(row?.qty ?? row?.quantity ?? row?.amount ?? 0) || 0
}

function Sparkline({ trend }: { trend: TrendRow[] }) {
  const points = useMemo(() => (Array.isArray(trend) ? trend.map(trendPoint) : []), [trend])
  if (points.length < 2) {
    return <div className="flex h-16 items-center justify-center rc-data text-[10px] text-[var(--rc-text-faint)]">Belum ada data trend</div>
  }
  const W = 360
  const H = 64
  const PAD = 6
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const step = (W - PAD * 2) / (points.length - 1)
  const d = points
    .map((p, i) => {
      const x = PAD + i * step
      const y = H - PAD - ((p - min) / span) * (H - PAD * 2)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" role="img" aria-label="Preview trend">
      <path d={d} fill="none" stroke="#34d399" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const inputCls =
  'h-10 w-full rounded-xl border-[var(--rc-forest-border)] bg-[#06120d] px-3 text-xs font-black text-[var(--rc-text)] outline-none placeholder:text-[var(--rc-text-faint)] focus:border-[var(--rc-forest-accent)]'
const labelCls = 'text-[10px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]'

export default function AnalysisDrawer({
  open,
  onClose,
  filters,
  onFilter,
  scopeDraft,
  onScopeDraft,
  onReset,
  onApply,
  periods,
  movementWindowOptions,
  analysisGroupOptions,
  selectedGroup,
  preview,
}: AnalysisDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const isYearMode = filters.periodMode === 'year' && /^\d{4}$/.test((filters.customYear ?? '').trim())

  const applyYear = (year: number) => {
    onFilter('periodMode', 'year')
    onFilter('customYear', String(year))
  }

  const presets = useMemo(() => {
    const now = new Date().getFullYear()
    return [
      { label: 'Tahun ini', run: () => applyYear(now) },
      { label: 'Tahun lalu', run: () => applyYear(now - 1) },
      { label: '2 tahun lalu', run: () => applyYear(now - 2) },
      { label: 'Mode bulan', run: () => onFilter('periodMode', 'month') },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Ruang Analisis">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        data-open={open}
        className="rc-drawer absolute inset-y-0 right-0 flex w-[min(430px,94vw)] flex-col border-l border-[var(--rc-forest-border)] bg-[#04120c] shadow-[-24px_0_60px_rgba(0,0,0,.45)] outline-none"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--rc-border)] px-4 py-3">
          <h2 className="rc-display text-sm font-bold text-[var(--rc-text)]">Ruang Analisis</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup drawer"
            className="rounded-lg border-[var(--rc-forest-border)] p-1.5 text-[var(--rc-text-faint)] transition hover:text-[var(--rc-text)]"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {/* Preset */}
          <section>
            <p className={labelCls}>Preset cepat</p>
            <div className="mt-2 flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={preset.run}
                  className="rounded-full border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-1.5 rc-data text-[10px] uppercase tracking-[0.08em] text-[var(--rc-text-muted)] transition hover:border-[var(--rc-forest-accent)] hover:text-[var(--rc-text)]"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>

          {/* Periode */}
          <section className="space-y-2">
            <p className={labelCls}>Periode usage/receive</p>
            <div className="flex h-10 overflow-hidden rounded-xl border-[var(--rc-forest-border)] bg-[#06120d]">
              <div className="flex shrink-0 items-center border-r border-[var(--rc-forest-border)]">
                {(['month', 'year'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onFilter('periodMode', mode)}
                    className={`h-full px-3 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                      (filters.periodMode ?? 'month') === mode
                        ? 'bg-[var(--rc-forest-accent)] text-[#04130c]'
                        : 'text-[var(--rc-text-faint)] hover:text-[var(--rc-text)]'
                    }`}
                  >
                    {mode === 'month' ? 'Bulan' : 'Tahun'}
                  </button>
                ))}
              </div>
              {isYearMode ? (
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  placeholder="2025"
                  value={filters.customYear ?? ''}
                  onChange={(event) => onFilter('customYear', event.target.value)}
                  className="h-full w-full min-w-0 flex-1 bg-transparent px-3 text-xs font-black text-[var(--rc-text)] outline-none placeholder:text-[var(--rc-text-faint)]"
                />
              ) : (
                <select
                  value={filters.period}
                  onChange={(event) => onFilter('period', event.target.value)}
                  className="h-full w-full min-w-0 flex-1 bg-transparent px-3 text-xs font-black text-[var(--rc-text)] outline-none"
                >
                  {periods.map((period) => (
                    <option key={period.value} value={period.value}>{period.label}</option>
                  ))}
                </select>
              )}
            </div>
            {filters.periodMode === 'year' && !isYearMode ? (
              <p className="rc-data text-[10px] text-amber-200/80">Isi 4 digit tahun (mis. 2025) untuk mode Tahun.</p>
            ) : null}
          </section>

          {/* Jendela aging */}
          <section className="space-y-2">
            <p className={labelCls}>Jendela aging movement</p>
            <select
              value={filters.movementWindow}
              onChange={(event) => onFilter('movementWindow', event.target.value)}
              className={inputCls}
            >
              {movementWindowOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </section>

          {/* Analysis group */}
          <section className="space-y-2">
            <p className={labelCls}>Analysis Group</p>
            <select
              value={filters.groupBy}
              onChange={(event) => onFilter('groupBy', event.target.value)}
              className={inputCls}
            >
              {analysisGroupOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </section>

          {/* Kode filter */}
          <section className="space-y-2">
            <p className={labelCls}>Kode Filter</p>
            <input
              value={scopeDraft}
              onChange={(event) => onScopeDraft(event.target.value)}
              placeholder={selectedGroup.placeholder}
              className={inputCls}
            />
          </section>

          {/* Item scope */}
          <section className="space-y-2">
            <p className={labelCls}>Item Scope</p>
            <select
              value={filters.itemType}
              onChange={(event) => onFilter('itemType', event.target.value)}
              className={inputCls}
            >
              <option value="">Inventory 1+4</option>
              <option value="gudang">Gudang</option>
              <option value="workshop">Workshop/Mesin</option>
            </select>
          </section>

          {/* Lokasi */}
          <section className="space-y-2">
            <p className={labelCls}>Lokasi</p>
            <input
              value={filters.location}
              onChange={(event) => onFilter('location', event.target.value)}
              placeholder="PTRJ / lokasi"
              className={inputCls}
            />
          </section>

          {/* Preview */}
          <section className="space-y-2 rounded-2xl border-[var(--rc-border)] bg-[rgba(3,14,10,.5)] p-3">
            <p className={labelCls}>Preview</p>
            <Sparkline trend={preview.trend} />
            {preview.insightItems.length > 0 ? (
              <ul className="space-y-1 pt-1">
                {preview.insightItems.slice(0, 3).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 rc-data text-[11px] text-[var(--rc-text)]">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--rc-forest-accent)]" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>

        <div className="flex items-center gap-2 border-t border-[var(--rc-border)] px-4 py-3">
          <button
            type="button"
            onClick={onReset}
            className="h-10 flex-1 rounded-xl border-[var(--rc-forest-border)] bg-white/[0.045] px-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--rc-text-muted)] transition hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.08] hover:text-[var(--rc-text)]"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onApply}
            className="h-10 flex-1 rounded-xl border-[var(--rc-forest-accent)] bg-[var(--rc-forest-accent)] px-3 text-xs font-black uppercase tracking-[0.12em] text-[#04130c] transition hover:brightness-110"
          >
            Terapkan
          </button>
        </div>
      </div>
    </div>
  )
}
