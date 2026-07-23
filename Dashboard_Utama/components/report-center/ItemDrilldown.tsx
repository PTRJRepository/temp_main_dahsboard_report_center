'use client'

import { useEffect, useMemo } from 'react'
import Sparkline, { MomentumDelta } from './Sparkline'

/**
 * ItemDrilldown — pop-up analisis SATU barang (pola issue movement).
 * Menampilkan: sparkline besar pola issue periode, statistik ringkas
 * (total qty/amount, frekuensi dok, rata-rata periode, puncak), momentum,
 * dan mini-heatmap strip periode. Pop-up (bukan filter inline) sesuai keputusan
 * UX: backdrop blur klik-tutup + ESC, role="dialog".
 * Calm-minimal: emerald untuk nilai, amber untuk perhatian (periode nol beruntun).
 */

type DrilldownItem = {
  code: string
  name: string
}

type ItemDrilldownProps = {
  item: DrilldownItem | null
  periods: string[]
  /** Deret pola issue periode (selaras dgn `periods`). */
  qtySeries: number[]
  amountSeries: number[]
  docsSeries: number[]
  metric: 'qty' | 'amount'
  onClose: () => void
  /** Buka report detail issue untuk barang ini. */
  onOpenDetail?: (item: DrilldownItem) => void
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}rb`
  return `${Math.round(value)}`
}

function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const mi = Number(m) - 1
  return `${months[mi] ?? m} ${y}`
}

export default function ItemDrilldown({
  item,
  periods,
  qtySeries,
  amountSeries,
  docsSeries,
  metric,
  onClose,
  onOpenDetail,
}: ItemDrilldownProps) {
  // ESC untuk tutup.
  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose])

  const stats = useMemo(() => {
    const series = metric === 'qty' ? qtySeries : amountSeries
    const totalQty = qtySeries.reduce((a, b) => a + b, 0)
    const totalAmount = amountSeries.reduce((a, b) => a + b, 0)
    const totalDocs = docsSeries.reduce((a, b) => a + b, 0)
    const active = series.filter((v) => v > 0).length
    const peak = Math.max(...series, 0)
    const peakIdx = series.indexOf(peak)
    const avg = active > 0 ? series.reduce((a, b) => a + b, 0) / active : 0
    // Deteksi periode nol beruntun terakhir (perlambatan) → penanda amber.
    let trailingZero = 0
    for (let i = series.length - 1; i >= 0; i -= 1) {
      if (series[i] > 0) break
      trailingZero += 1
    }
    return { totalQty, totalAmount, totalDocs, active, peak, peakIdx, avg, trailingZero, series }
  }, [qtySeries, amountSeries, docsSeries, metric])

  if (!item) return null

  const maxSeries = Math.max(...stats.series, 1)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Analisis movement ${item.name}`}
        className="w-full max-w-[560px] overflow-hidden rounded-[24px] border-[var(--rc-border)] bg-[linear-gradient(160deg,rgba(4,18,12,.98),rgba(2,10,7,.97))] shadow-[0_30px_90px_rgba(0,0,0,.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
          <div className="min-w-0">
            <p className="rc-data text-[9px] uppercase tracking-[0.18em] text-[var(--rc-text-faint)]">Analisis movement barang</p>
            <h3 className="mt-1 truncate text-base font-bold text-[var(--rc-text)]">{item.name}</h3>
            <p className="rc-data mt-0.5 text-[10px] text-[var(--rc-text-faint)]">{item.code}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-white/10 bg-white/[0.04] text-[var(--rc-text-muted)] transition hover:bg-white/[0.08] hover:text-[var(--rc-text)]"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto px-4 py-3">
          {/* Sparkline besar + momentum */}
          <div className="rounded-2xl border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <p className="rc-data text-[9px] uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">
                Pola issue {metric === 'qty' ? 'qty' : 'amount'} · {periods.length} periode
              </p>
              <MomentumDelta values={stats.series} />
            </div>
            <div className="mt-2">
              <Sparkline values={stats.series} width={520} height={72} className="w-full" />
            </div>
            {/* Mini heatmap strip */}
            <div className="mt-2 flex gap-[3px]">
              {stats.series.map((v, i) => (
                <div
                  key={i}
                  title={`${periodLabel(periods[i] ?? '')}: ${metric === 'qty' ? formatCompact(v) : `Rp ${formatCompact(v)}`}`}
                  className="h-2.5 flex-1 rounded-[2px]"
                  style={{
                    backgroundColor: v > 0 ? `rgba(52,211,153,${0.15 + (v / maxSeries) * 0.75})` : 'rgba(255,255,255,0.04)',
                  }}
                />
              ))}
            </div>
            <div className="rc-data mt-1 flex justify-between text-[9px] text-[var(--rc-text-faint)]">
              <span>{periodLabel(periods[0] ?? '')}</span>
              <span>{periodLabel(periods[periods.length - 1] ?? '')}</span>
            </div>
          </div>

          {/* Statistik ringkas */}
          <div className="mt-3 grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Total qty', value: formatCompact(stats.totalQty) },
              { label: 'Total amount', value: `Rp ${formatCompact(stats.totalAmount)}` },
              { label: 'Frekuensi dok', value: formatCompact(stats.totalDocs) },
              { label: 'Rata-rata/periode', value: metric === 'qty' ? formatCompact(stats.avg) : `Rp ${formatCompact(stats.avg)}` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border-white/10 bg-white/[0.03] px-2.5 py-2">
                <p className="rc-data text-[9px] uppercase tracking-[0.12em] text-[var(--rc-text-faint)]">{s.label}</p>
                <p className="rc-metric mt-1 truncate text-sm font-semibold text-[var(--rc-text)]">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Insight singkat */}
          <div className="mt-3 space-y-1.5">
            {stats.peakIdx >= 0 && stats.peak > 0 ? (
              <p className="rc-data text-[11px] text-[var(--rc-text-muted)]">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
                Puncak {metric === 'qty' ? 'issue' : 'nilai'} di <strong className="text-[var(--rc-text)]">{periodLabel(periods[stats.peakIdx] ?? '')}</strong> — {metric === 'qty' ? formatCompact(stats.peak) : `Rp ${formatCompact(stats.peak)}`}.
              </p>
            ) : null}
            <p className="rc-data text-[11px] text-[var(--rc-text-muted)]">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
              Aktif di <strong className="text-[var(--rc-text)]">{stats.active}</strong> dari {periods.length} periode.
            </p>
            {stats.trailingZero >= 2 ? (
              <p className="rc-data text-[11px] text-amber-200/90">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-300/80" />
                Tidak ada issue {stats.trailingZero} periode terakhir — kemungkinan melambat / stagnan.
              </p>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-3">
          <p className="rc-data text-[9px] text-[var(--rc-text-faint)]">Data dari matriks movement (issue gudang + workshop).</p>
          {onOpenDetail ? (
            <button
              type="button"
              onClick={() => onOpenDetail(item)}
              className="rounded-xl border-[var(--rc-forest-border-strong)] bg-emerald-400/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-400/25"
            >
              Buka detail issue →
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
