'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'

/**
 * MovementMatrix — heatmap barang (Y) × periode bulan (X).
 * Sel = intensitas movement (qty atau amount) per barang periode.
 * Calm-minimal: satu hue (emerald) untuk nilai, intensitas via opacity;
 * sel kosong = garis tipis netral. Klik sel → onSelect(barang, periode).
 * Data di-fetch lazy dari /api/reports/inventory/movement-matrix.
 */

type MatrixMetric = 'qty' | 'amount' | 'freq'

type ApiMatrixRow = {
  code: string
  name: string
  cells: { qty: number[]; amount: number[]; docs: number[] }
}

type ApiMatrixResponse = {
  success: boolean
  periods: string[]
  rows: ApiMatrixRow[]
  currentPeriod: string
  error?: string
}

type MovementMatrixProps = {
  source: 'estate' | 'pabrik'
  months?: number
  top?: number
  itemType?: string
  /** Aktifkan fetch (false saat glance/tersembunyi agar lazy). */
  active?: boolean
  metric: MatrixMetric
  onMetricChange: (metric: MatrixMetric) => void
  onSelect?: (item: { code: string; name: string }, period: string) => void
  onDrilldown?: (item: { code: string; name: string }) => void
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}rb`
  return `${Math.round(value)}`
}

function formatCurrency(value: number): string {
  return `Rp ${formatCompact(value)}`
}

function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const mi = Number(m) - 1
  return `${months[mi] ?? m} ${y.slice(2)}`
}

export default function MovementMatrix({
  source,
  months = 12,
  top = 12,
  itemType = '',
  active = true,
  metric,
  onMetricChange,
  onSelect,
  onDrilldown,
}: MovementMatrixProps) {
  const [data, setData] = useState<ApiMatrixResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const params = new URLSearchParams({ source, months: String(months), top: String(top) })
    if (itemType) params.set('itemType', itemType)
    queueMicrotask(() => {
      if (!cancelled) setLoading(true)
    })
    fetch(`/api/reports/inventory/movement-matrix?${params.toString()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json: ApiMatrixResponse) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) setData({ success: false, periods: [], rows: [], currentPeriod: '', error: 'Gagal memuat matriks' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [active, source, months, top, itemType])

  const periods = data?.periods ?? []
  const rows = data?.rows ?? []

  // Nilai maksimum untuk normalisasi intensitas (per metrik terpilih).
  const maxValue = useMemo(() => {
    let max = 0
    for (const row of rows) {
      const series = metric === 'qty' ? row.cells.qty : metric === 'freq' ? row.cells.docs : row.cells.amount
      for (const v of series) if (v > max) max = v
    }
    return max
  }, [rows, metric])

  const cellValue = (row: ApiMatrixRow, colIdx: number) =>
    metric === 'qty' ? row.cells.qty[colIdx] : metric === 'freq' ? row.cells.docs[colIdx] : row.cells.amount[colIdx]

  if (loading && !data) {
    return (
      <div className="grid h-full place-items-center rounded-[24px] border-white/10 bg-white/[0.03]">
        <p className="rc-data text-[11px] text-[var(--rc-text-faint)]">Memuat matriks movement…</p>
      </div>
    )
  }

  if (!data || !data.success || rows.length === 0) {
    return (
      <div className="grid h-full place-items-center rounded-[24px] border-white/10 bg-white/[0.03] px-4">
        <p className="rc-data text-center text-[11px] text-[var(--rc-text-faint)]">
          {data?.error ?? 'Belum ada data movement untuk rentang periode ini.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[24px] border-white/10 bg-[rgba(3,14,10,.4)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--rc-text)]">Matriks movement</p>
          <p className="rc-data mt-0.5 text-[10px] text-[var(--rc-text-faint)]">
            Barang × periode · intensitas = {metric === 'qty' ? 'quantity' : metric === 'freq' ? 'frekuensi (jml dok)' : 'amount'}
          </p>
        </div>
        <div className="flex shrink-0 gap-1 rounded-full border-white/10 bg-white/[0.04] p-0.5" role="tablist" aria-label="Metrik matriks">
          {(['qty', 'amount', 'freq'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={metric === m}
              onClick={() => onMetricChange(m)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                metric === m ? 'bg-emerald-400/20 text-emerald-100' : 'text-[var(--rc-text-muted)] hover:bg-white/[0.06]'
              }`}
            >
              {m === 'qty' ? 'Qty' : m === 'amount' ? 'Amount' : 'Freq'}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `minmax(120px,1.4fr) repeat(${periods.length}, minmax(30px,1fr))` }}
        >
          {/* Header kolom periode */}
          <div className="rc-data sticky left-0 flex items-end pb-1 text-[9px] uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">
            Barang
          </div>
          {periods.map((p) => (
            <div key={p} className="rc-data flex items-end justify-center pb-1 text-center text-[9px] text-[var(--rc-text-faint)]">
              {periodLabel(p)}
            </div>
          ))}

          {/* Baris barang */}
          {rows.map((row, r) => (
            <Fragment key={row.code}>
              <button
                type="button"
                onClick={() => onDrilldown?.({ code: row.code, name: row.name })}
                title={`${row.code} — ${row.name}`}
                className="group sticky left-0 flex min-w-0 items-center gap-1.5 rounded-md pr-1 text-left transition hover:bg-white/[0.05]"
              >
                <span className="rc-data shrink-0 text-[9px] text-[var(--rc-text-faint)]">{r + 1}</span>
                <span className="truncate text-[10px] font-semibold text-[var(--rc-text)] group-hover:text-emerald-200">
                  {row.name}
                </span>
              </button>
              {periods.map((p, c) => {
                const value = cellValue(row, c)
                const intensity = maxValue > 0 ? value / maxValue : 0
                const isHover = hover?.r === r && hover?.c === c
                return (
                  <button
                    key={`${row.code}-${p}`}
                    type="button"
                    aria-label={`${row.name} ${periodLabel(p)}: ${metric === 'qty' ? formatCompact(value) : metric === 'freq' ? `${formatCompact(value)} dok` : formatCurrency(value)}`}
                    onMouseEnter={() => setHover({ r, c })}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover({ r, c })}
                    onBlur={() => setHover(null)}
                    onClick={() => onSelect?.({ code: row.code, name: row.name }, p)}
                    className={`aspect-square w-full rounded-[4px] border transition ${
                      isHover ? 'border-emerald-300/60' : 'border-white/[0.04]'
                    }`}
                    style={{
                      backgroundColor:
                        value > 0
                          ? `rgba(52,211,153,${0.12 + intensity * 0.75})`
                          : 'rgba(255,255,255,0.02)',
                    }}
                  />
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Tooltip bar (bawah) */}
      <div className="rc-data mt-2 flex min-h-[18px] items-center justify-between gap-2 border-t border-white/[0.06] pt-2 text-[10px] text-[var(--rc-text-muted)]">
        {hover ? (
          (() => {
            const row = rows[hover.r]
            const p = periods[hover.c]
            const qty = row.cells.qty[hover.c]
            const amount = row.cells.amount[hover.c]
            const docs = row.cells.docs[hover.c]
            return (
              <>
                <span className="truncate">
                  <strong className="text-[var(--rc-text)]">{row.name}</strong> · {periodLabel(p)}
                </span>
                <span className="shrink-0">
                  Qty {formatCompact(qty)} · {formatCurrency(amount)} · <strong className={metric === 'freq' ? 'text-emerald-200' : undefined}>{docs} dok</strong>
                </span>
              </>
            )
          })()
        ) : (
          <span className="text-[var(--rc-text-faint)]">Arahkan kursor ke sel untuk detail · klik sel untuk fokus periode, klik nama barang untuk drill-down.</span>
        )}
        <span className="hidden shrink-0 items-center gap-1 sm:flex">
          <span className="text-[var(--rc-text-faint)]">rendah</span>
          <span className="h-2 w-16 overflow-hidden rounded-full bg-white/[0.06]">
            <span className="block h-full w-full bg-[linear-gradient(90deg,rgba(52,211,153,0.12),rgba(52,211,153,0.9))]" />
          </span>
          <span className="text-[var(--rc-text-faint)]">tinggi</span>
        </span>
      </div>
    </div>
  )
}
