'use client'

import { useMemo, useState } from 'react'
import Sparkline, { MomentumDelta } from './Sparkline'

/**
 * MovementTable — tabel analisis per barang.
 * Kolom: Barang | Pola issue (sparkline) | Qty | Amount | Frekuensi (docs) | momentum.
 * Sumber pola: deret periode dari matriks (cells) bila tersedia; jika tidak,
 * baris tetap tampil dari topLists/issueFrequency tanpa sparkline.
 * Klik baris → onDrilldown(barang). Calm-minimal; header meta mono redup.
 */

type RowInput = {
  code: string
  name: string
  qty?: number
  amount?: number
  docs?: number
  events?: number
  /** Deret pola issue periode (opsional, dari matriks). */
  series?: number[]
}

type MovementTableProps = {
  rows: RowInput[]
  metric: 'qty' | 'amount'
  onMetricChange?: (metric: 'qty' | 'amount') => void
  onDrilldown?: (item: { code: string; name: string }) => void
  loading?: boolean
  periodCount?: number
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}rb`
  return `${Math.round(value)}`
}

export default function MovementTable({
  rows,
  metric,
  onMetricChange,
  onDrilldown,
  loading,
  periodCount,
}: MovementTableProps) {
  const [sortKey, setSortKey] = useState<'amount' | 'qty' | 'docs'>('amount')

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => Number(b[sortKey] ?? 0) - Number(a[sortKey] ?? 0))
    return copy
  }, [rows, sortKey])

  if (loading) {
    return (
      <div className="grid h-full place-items-center rounded-[24px] border-white/10 bg-white/[0.03]">
        <p className="rc-data text-[11px] text-[var(--rc-text-faint)]">Memuat tabel analisis…</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="grid h-full place-items-center rounded-[24px] border-white/10 bg-white/[0.03] px-4">
        <p className="rc-data text-center text-[11px] text-[var(--rc-text-faint)]">Belum ada barang dengan movement pada konteks ini.</p>
      </div>
    )
  }

  const headerBtn = (key: 'amount' | 'qty' | 'docs', label: string) => (
    <button
      type="button"
      onClick={() => setSortKey(key)}
      className={`rc-data text-[9px] uppercase tracking-[0.12em] transition ${
        sortKey === key ? 'text-emerald-200' : 'text-[var(--rc-text-faint)] hover:text-[var(--rc-text-muted)]'
      }`}
      aria-label={`Urutkan berdasarkan ${label}`}
    >
      {label}
      {sortKey === key ? ' ↓' : ''}
    </button>
  )

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[24px] border-white/10 bg-[rgba(3,14,10,.4)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--rc-text)]">Analisis per barang</p>
          <p className="rc-data mt-0.5 text-[10px] text-[var(--rc-text-faint)]">
            Pola issue periode{periodCount ? ` · ${periodCount} periode` : ''} · klik baris untuk drill-down
          </p>
        </div>
        {onMetricChange ? (
          <div className="flex shrink-0 gap-1 rounded-full border-white/10 bg-white/[0.04] p-0.5" role="tablist" aria-label="Metrik tabel">
            {(['qty', 'amount'] as const).map((m) => (
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
                {m === 'qty' ? 'Qty' : 'Amount'}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Header */}
      <div className="grid grid-cols-[minmax(0,1.6fr)_70px_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_56px] items-center gap-2 border-b border-white/[0.07] pb-1.5">
        <span className="rc-data text-[9px] uppercase tracking-[0.12em] text-[var(--rc-text-faint)]">Barang</span>
        <span className="rc-data text-[9px] uppercase tracking-[0.12em] text-[var(--rc-text-faint)]">Pola</span>
        <span className="text-right">{headerBtn('qty', 'Qty')}</span>
        <span className="text-right">{headerBtn('amount', 'Amount')}</span>
        <span className="text-right">{headerBtn('docs', 'Freq')}</span>
        <span className="rc-data text-right text-[9px] uppercase tracking-[0.12em] text-[var(--rc-text-faint)]">Mom.</span>
      </div>

      {/* Baris */}
      <div className="min-h-0 flex-1 overflow-auto">
        <ul className="divide-y divide-white/[0.05]">
          {sorted.map((row) => {
            const series = metric === 'qty' ? row.series : row.series
            const value = metric === 'qty' ? Number(row.qty ?? 0) : Number(row.amount ?? 0)
            return (
              <li key={row.code}>
                <button
                  type="button"
                  onClick={() => onDrilldown?.({ code: row.code, name: row.name })}
                  className="group grid w-full grid-cols-[minmax(0,1.6fr)_70px_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_56px] items-center gap-2 px-1 py-1.5 text-left transition hover:bg-white/[0.04]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold text-[var(--rc-text)] group-hover:text-emerald-200">
                      {row.name}
                    </span>
                    <span className="rc-data block truncate text-[9px] text-[var(--rc-text-faint)]">{row.code}</span>
                  </span>
                  <span className="flex items-center justify-center">
                    {series && series.length > 1 ? (
                      <Sparkline values={series} width={64} height={20} />
                    ) : (
                      <span className="rc-data text-[9px] text-[var(--rc-text-faint)]">—</span>
                    )}
                  </span>
                  <span className={`rc-data text-right text-[10px] ${metric === 'qty' ? 'font-bold text-[var(--rc-text)]' : 'text-[var(--rc-text-muted)]'}`}>
                    {formatCompact(Number(row.qty ?? 0))}
                  </span>
                  <span className={`rc-data text-right text-[10px] ${metric === 'amount' ? 'font-bold text-[var(--rc-text)]' : 'text-[var(--rc-text-muted)]'}`}>
                    Rp {formatCompact(Number(row.amount ?? 0))}
                  </span>
                  <span className="rc-data text-right text-[10px] text-[var(--rc-text-muted)]">
                    {row.docs != null ? formatCompact(Number(row.docs)) : '—'}
                  </span>
                  <span className="flex justify-end">
                    {series && series.length > 1 ? <MomentumDelta values={series} /> : <span className="rc-data text-[9px] text-[var(--rc-text-faint)]">—</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
