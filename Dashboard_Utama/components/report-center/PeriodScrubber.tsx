'use client'

import { useEffect, useMemo, useState } from 'react'

type AggregationStatus = {
  success: boolean
  currentPeriod: string
  closedPeriods: string[]
}

type PeriodScrubberProps = {
  /** Periode aktif saat ini (YYYY-MM). */
  value: string
  onSelect: (period: string) => void
  /** Jumlah titik bulan ke belakang (default 18). */
  months?: number
}

const MONTH_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function addMonths(period: string, delta: number) {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return period
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function label(period: string) {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return period
  return `${MONTH_ID[m - 1]} ${String(y).slice(2)}`
}

export default function PeriodScrubber({ value, onSelect, months = 18 }: PeriodScrubberProps) {
  const [status, setStatus] = useState<AggregationStatus | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/reports/inventory/aggregation?months=' + months, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (alive && json && json.success) setStatus(json as AggregationStatus)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [months])

  const current = status?.currentPeriod ?? value
  const closed = useMemo(() => new Set(status?.closedPeriods ?? []), [status])

  const ticks = useMemo(() => {
    const list: string[] = []
    for (let i = months - 1; i >= 0; i -= 1) list.push(addMonths(current, -i))
    return list
  }, [current, months])

  return (
    <div className="rounded-2xl border-[var(--rc-border)] bg-[rgba(3,14,10,.5)] px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="rc-data text-[10px] uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">Jelajah periode</span>
        <span className="rc-data text-[10px] text-[var(--rc-text-faint)]">titik penuh = instan (agregasi) · berongga = live</span>
      </div>
      <div className="rc-period-track flex items-end gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Pilih periode">
        {ticks.map((period) => {
          const active = period === value
          const isClosed = closed.has(period)
          return (
            <button
              key={period}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(period)}
              title={`${label(period)}${isClosed ? ' · instan' : ' · live'}`}
              className="group flex shrink-0 flex-col items-center gap-1 px-1"
            >
              <span
                className={`block h-2.5 w-2.5 rounded-full border transition ${
                  active
                    ? 'scale-125 border-[var(--rc-forest-accent)] bg-[var(--rc-forest-accent)]'
                    : isClosed
                      ? 'border-[var(--rc-forest-accent)]/60 bg-[var(--rc-forest-accent)]/50 group-hover:bg-[var(--rc-forest-accent)]'
                      : 'border-[var(--rc-text-faint)]/60 bg-transparent group-hover:border-[var(--rc-forest-accent)]'
                }`}
              />
              <span className={`rc-data text-[9px] uppercase tracking-wide ${active ? 'text-[var(--rc-text)]' : 'text-[var(--rc-text-faint)]'}`}>
                {label(period)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
