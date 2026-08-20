'use client'

import { useMemo, useRef, useState } from 'react'

/**
 * MovementWindowTimeline — range slider bulan gaya "time slider Google Earth"
 * untuk rentang perhitungan Movement Category. Satu sumber kebenaran: klien
 * mengirim movementWindow=preset (anchor ke period) ATAU movementWindow=custom
 * + dateFrom/dateTo (batas tanggal eksplisit dari slider).
 */

export type MovementWindowValue = {
  /** Date-from inklusif (YYYY-MM-01). Null = all-period (tanpa batas awal). */
  start: string | null
  /** Date-to inklusif (YYYY-MM dengan hari terakhir bulan itu). Null = sampai period/bulan berjalan. */
  end: string | null
}

type MovementWindowTimelineProps = {
  /** Periode aktual terpilih (YYYY-MM) — anchor kanan default. */
  period: string
  value: MovementWindowValue
  onChange: (next: { startMonth: string; endMonth: string }) => void
  /** Periode analisis: preset trailing months ATAU custom range timeline. */
  analysisPeriods?: string[]
  /** Label rentang analisis (mis. "2026-01 → 2026-04 · 4 bulan"). */
  analysisRangeLabel?: string
  /** Mode periode analisis. */
  analysisMode?: 'auto' | 'manual'
  onAnalysisPeriodsChange?: (periods: string[]) => void
  className?: string
}

const MONTH_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
/** Rentang jelajah timeline: 10 tahun ke belakang dari anchor (selaras preset MC maksimal). */
const TIMELINE_MONTHS_BACK = 119

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function monthIndexFromPeriod(period: string): number | null {
  const match = String(period ?? '').trim().match(/^(\d{4})-(\d{1,2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return year * 12 + (month - 1)
}

function periodFromMonthIndex(index: number) {
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return `${year}-${pad2(month)}`
}

function monthLabel(index: number) {
  return `${MONTH_ID[index % 12]} ${String(Math.floor(index / 12)).slice(2)}`
}

function monthShortLabel(index: number) {
  return MONTH_ID[index % 12]
}

export function lastDayOfMonthPeriod(period: string) {
  const index = monthIndexFromPeriod(period)
  if (index == null) return period
  const last = new Date(Math.floor(index / 12), (index % 12) + 1, 0)
  return `${period}-${pad2(last.getDate())}`
}

export default function MovementWindowTimeline({
  period,
  value,
  onChange,
  analysisPeriods,
  analysisRangeLabel,
  analysisMode = 'auto',
  onAnalysisPeriodsChange,
  className,
}: MovementWindowTimelineProps) {
  const anchorIndex = useMemo(() => {
    return monthIndexFromPeriod(period) ?? monthIndexFromPeriod(
      (() => {
        const now = new Date()
        return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
      })(),
    ) ?? 0
  }, [period])

  const firstIndex = anchorIndex - TIMELINE_MONTHS_BACK
  const trackRef = useRef<HTMLDivElement>(null)
  const dragMode = useRef<'start' | 'end' | 'window' | null>(null)
  const dragGrabOffset = useRef(0)
  const [dragging, setDragging] = useState(false)

  const startIndex = monthIndexFromPeriod(value.start ?? '') ?? firstIndex
  const endIndex = monthIndexFromPeriod(value.end ?? '') ?? anchorIndex

  const clamp = (index: number) => Math.min(Math.max(index, firstIndex), anchorIndex)

  const indexFromClientX = (clientX: number) => {
    const track = trackRef.current
    if (!track) return firstIndex
    const rect = track.getBoundingClientRect()
    const ratio = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width
    const raw = firstIndex + Math.round(ratio * (anchorIndex - firstIndex))
    return clamp(raw)
  }

  const emit = (nextStart: number, nextEnd: number) => {
    const s = clamp(Math.min(nextStart, nextEnd))
    const e = clamp(Math.max(nextStart, nextEnd))
    onChange({ startMonth: periodFromMonthIndex(s), endMonth: periodFromMonthIndex(e) })
  }

  const handlePointer = (event: React.PointerEvent) => {
    if (dragMode.current == null) return
    const index = indexFromClientX(event.clientX)
    if (dragMode.current === 'start') emit(index, endIndex)
    else if (dragMode.current === 'end') emit(startIndex, index)
    else {
      const width = endIndex - startIndex
      let nextStart = index - dragGrabOffset.current
      nextStart = Math.min(Math.max(nextStart, firstIndex), anchorIndex - width)
      emit(nextStart, nextStart + width)
    }
  }

  const beginDrag = (mode: 'start' | 'end' | 'window') => (event: React.PointerEvent) => {
    event.preventDefault()
    dragMode.current = mode
    if (mode === 'window') {
      const index = indexFromClientX(event.clientX)
      dragGrabOffset.current = Math.min(Math.max(index - startIndex, 0), endIndex - startIndex)
    }
    setDragging(true)
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }

  const endDrag = (event: React.PointerEvent) => {
    if (dragMode.current == null) return
    dragMode.current = null
    setDragging(false)
    ;(event.target as Element).releasePointerCapture?.(event.pointerId)
  }

  const handleTrackClick = (event: React.PointerEvent) => {
    if (dragMode.current != null) return
    const index = indexFromClientX(event.clientX)
    // Klik di track: pindahkan handle terdekat.
    if (Math.abs(index - startIndex) <= Math.abs(index - endIndex)) emit(index, endIndex)
    else emit(startIndex, index)
  }

  const spanMonths = endIndex - startIndex + 1
  const leftPct = ((startIndex - firstIndex) / (anchorIndex - firstIndex)) * 100
  const rightPct = ((anchorIndex - endIndex) / (anchorIndex - firstIndex)) * 100
  const windowPct = Math.max(0, 100 - leftPct - rightPct)
  const allSelected = startIndex === firstIndex && endIndex === anchorIndex
  const rangeLabel = allSelected
    ? `All period → ${periodFromMonthIndex(anchorIndex)}`
    : `${periodFromMonthIndex(startIndex)} → ${periodFromMonthIndex(endIndex)} · ${spanMonths} bulan`

  const ticks = useMemo(() => {
    const list: Array<{ index: number; major: boolean }> = []
    for (let index = firstIndex; index <= anchorIndex; index += 1) {
      list.push({ index, major: index % 12 === 0 })
    }
    return list
  }, [firstIndex, anchorIndex])

  const yearLabels = useMemo(() => {
    const years = new Map<number, { from: number; to: number }>()
    for (let index = firstIndex; index <= anchorIndex; index += 1) {
      const year = Math.floor(index / 12)
      const entry = years.get(year) ?? { from: index, to: index }
      entry.to = index
      years.set(year, entry)
    }
    const total = anchorIndex - firstIndex
    return [...years.entries()].map(([year, span]) => ({
      year,
      left: ((span.from - firstIndex) / total) * 100,
      width: ((span.to - span.from + 1) / total) * 100,
    }))
  }, [firstIndex, anchorIndex])

  return (
    <div
      className={['rounded-2xl border-[var(--rc-forest-border)] bg-[rgba(3,14,10,.5)] px-3 py-2', className ?? ''].join(' ')}
      aria-label="Timeline rentang perhitungan movement category"
    >
      <div className="mb-1.5 flex-wrap items-center justify-between gap-2">
        <span className="rc-data text-[10px] uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">
          Timeline rentang MC
        </span>
        <span className="rc-data text-[11px] font-bold text-[var(--rc-forest-accent)]" aria-live="polite">
          {rangeLabel}
        </span>
      </div>

      <div
        ref={trackRef}
        className={`relative h-12 select-none touch-none ${dragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
        onPointerDown={handleTrackClick}
        onPointerMove={handlePointer}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="group"
        aria-label={`Rentang movement category ${rangeLabel}`}
      >
        {/* rail */}
        <div className="absolute inset-x-0 top-5 h-2 rounded-full bg-white/[0.07]" />
        {/* tick marks */}
        {ticks.map((tick) => {
          const left = ((tick.index - firstIndex) / (anchorIndex - firstIndex)) * 100
          return (
            <span
              key={tick.index}
              className={`absolute top-3.5 w-px ${tick.major ? 'h-5 bg-white/30' : 'h-3 bg-white/15'}`}
              style={{ left: `${left}%` }}
              aria-hidden
            />
          )
        })}
        {/* selected window */}
        <div
          className="absolute top-5 h-2 rounded-full bg-[var(--rc-forest-accent)]/70 shadow-[0_0_12px_rgba(74,222,128,.35)]"
          style={{ left: `${leftPct}%`, width: `${windowPct}%` }}
          onPointerDown={beginDrag('window')}
          role="slider"
          aria-label="Geser seluruh rentang"
          aria-valuemin={firstIndex}
          aria-valuemax={anchorIndex}
          aria-valuenow={startIndex}
          aria-valuetext={rangeLabel}
          title="Geser untuk memindahkan rentang"
        />
        {/* start handle */}
        <button
          type="button"
          className="absolute top-2.5 z-10 grid h-7 w-4 -translate-x-1/2 cursor-ew-resize place-items-center rounded-md border-[var(--rc-forest-accent)]/70 bg-[#05130c] shadow hover:bg-[var(--rc-forest-accent)]/20"
          style={{ left: `${leftPct}%` }}
          onPointerDown={beginDrag('start')}
          onPointerMove={handlePointer}
          onPointerUp={endDrag}
          role="slider"
          aria-label="Batas awal rentang"
          aria-valuemin={firstIndex}
          aria-valuemax={endIndex}
          aria-valuenow={startIndex}
          aria-valuetext={periodFromMonthIndex(startIndex)}
          title={`Awal: ${monthLabel(startIndex)}`}
        >
          <span className="block h-3 w-0.5 rounded bg-[var(--rc-forest-accent)]" />
        </button>
        {/* end handle */}
        <button
          type="button"
          className="absolute top-2.5 z-10 grid h-7 w-4 -translate-x-1/2 cursor-ew-resize place-items-center rounded-md border-[var(--rc-forest-accent)]/70 bg-[#05130c] shadow hover:bg-[var(--rc-forest-accent)]/20"
          style={{ left: `${100 - rightPct}%` }}
          onPointerDown={beginDrag('end')}
          onPointerMove={handlePointer}
          onPointerUp={endDrag}
          role="slider"
          aria-label="Batas akhir rentang"
          aria-valuemin={startIndex}
          aria-valuemax={anchorIndex}
          aria-valuenow={endIndex}
          aria-valuetext={periodFromMonthIndex(endIndex)}
          title={`Akhir: ${monthLabel(endIndex)}`}
        >
          <span className="block h-3 w-0.5 rounded bg-[var(--rc-forest-accent)]" />
        </button>
        {/* month dots for other analyses (evolution trend points) */}
        {analysisPeriods && analysisPeriods.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-9 h-4">
            {Array.from({ length: anchorIndex - firstIndex + 1 }).map((_, offset) => {
              const index = firstIndex + offset
              const per = periodFromMonthIndex(index)
              const inAnalysis = analysisPeriods.includes(per)
              if (!inAnalysis) return null
              const left = ((index - firstIndex) / (anchorIndex - firstIndex)) * 100
              return (
                <span
                  key={per}
                  className="absolute h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-sky-300"
                  style={{ left: `${left}%` }}
                  title={`Analisis: ${monthLabel(index)}`}
                  aria-hidden
                />
              )
            })}
          </div>
        ) : null}
        {/* year + month scale */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0">
          {yearLabels.map((entry) => (
            <span
              key={entry.year}
              className="absolute bottom-3 border-l border-white/15 pl-1 text-[9px] font-black uppercase tracking-wide text-white/40"
              style={{ left: `${entry.left}%`, width: `${entry.width}%` }}
            >
              {entry.year}
            </span>
          ))}
          <div className="absolute inset-x-0 bottom-0 flex justify-between text-[8px] font-bold uppercase tracking-wide text-white/25">
            <span>{monthShortLabel(startIndex)}</span>
            <span>{monthShortLabel(endIndex)}</span>
          </div>
        </div>
      </div>

      {analysisPeriods && analysisPeriods.length > 0 ? (
        <div className="mt-2 flex-wrap items-center gap-2 rounded-xl border-white/10 bg-white/[0.03] px-2.5 py-1.5" aria-label="Periode analisis trend dan analisis lain">
          <span className="rc-data text-[10px] uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">
            Periode analisis lain (trend, breakdown)
          </span>
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5 rounded-full border-white/10 bg-white/[0.04] p-0.5" role="tablist" aria-label="Mode periode analisis">
              {(['auto', 'manual'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={analysisMode === mode}
                  onClick={() => {
                    if (mode === analysisMode) return
                    // auto → ikuti timeline; manual → bebaskan (kembali ke preset MC window)
                    onAnalysisPeriodsChange?.(mode === 'auto' ? analysisPeriods : [])
                  }}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                    analysisMode === mode ? 'bg-sky-400/20 text-sky-100' : 'text-[var(--rc-text-muted)] hover:bg-white/[0.06]'
                  }`}
                >
                  {mode === 'auto' ? 'Otomatis (ikuti timeline)' : 'Manual (preset)'}
                </button>
              ))}
            </div>
            <span className="rc-data text-[10px] font-semibold text-sky-200" aria-live="polite">
              {analysisRangeLabel ?? `${analysisPeriods.length} periode`}
            </span>
          </div>
        </div>
      ) : null}

      <p className="mt-1 text-[10px] font-semibold leading-4 text-[var(--rc-text-faint)]">
        Seret handle atau jendela tengah untuk mengubah rentang hitung Fast/Moving/Slow/Dead — gaya timeline Google Earth.
      </p>
    </div>
  )
}
