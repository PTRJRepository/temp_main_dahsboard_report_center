'use client'

import { useMemo } from 'react'
import ScrollArea from './ScrollArea'

/**
 * FrequencyInsights — analisis frekuensi issue level deck (agregat).
 *
 * Melengkapi analisis frekuensi per-barang (ItemDrilldown) dengan pandangan
 * menyeluruh yang menjawab: "pada rentang ini, ritme issue-nya bagaimana?"
 * - Ritme dokumen periode (bar strip; hover = detail).
 * - Statistik: total dok, rata/periode, periode teramai & tersepi, konsistensi
 *   (% periode yang ada issue).
 * - Top 5 barang paling sering di-issue (by jumlah dok + share %).
 * - Sebaran kerutinan: fast-moving (≥80% periode aktif) / reguler (≥40%) /
 *   slow-moving (<40%) — jumlah barang per kelompok.
 *
 * Data: rows matriks yang sama (tanpa fetch baru) — cells.docs periode.
 * Calm-minimal: emerald = frekuensi utama; amber = perhatian (slow-moving).
 */

type ApiMatrixRow = {
  code: string
  name: string
  cells: { qty: number[]; amount: number[]; docs: number[] }
}

type FrequencyInsightsProps = {
  periods: string[]
  rows: ApiMatrixRow[]
  onDrilldown?: (item: { code: string; name: string }) => void
}

const MONTH_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  const mi = Number(m) - 1
  return `${MONTH_ID[mi] ?? m} ${String(y).slice(2)}`
}

export default function FrequencyInsights({ periods, rows, onDrilldown }: FrequencyInsightsProps) {
  const model = useMemo(() => {
    const docsByPeriod = periods.map((_, i) => rows.reduce((s, r) => s + (r.cells.docs[i] ?? 0), 0))
    const totalDocs = docsByPeriod.reduce((a, b) => a + b, 0)
    const activePeriods = docsByPeriod.filter((v) => v > 0).length
    const avgPerPeriod = periods.length > 0 ? totalDocs / periods.length : 0
    let peakIdx = -1
    let quietIdx = -1
    docsByPeriod.forEach((v, i) => {
      if (peakIdx < 0 || v > docsByPeriod[peakIdx]) peakIdx = i
      if (quietIdx < 0 || v < docsByPeriod[quietIdx]) quietIdx = i
    })
    const maxDocs = Math.max(1, ...docsByPeriod)

    const itemDocs = rows
      .map((r) => ({ code: r.code, name: r.name, docs: r.cells.docs.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.docs - a.docs)
    const topItems = itemDocs.slice(0, 5)

    let fast = 0
    let regular = 0
    let slow = 0
    for (const r of rows) {
      const active = r.cells.docs.filter((v) => v > 0).length
      const pct = periods.length > 0 ? (active / periods.length) * 100 : 0
      if (pct >= 80) fast += 1
      else if (pct >= 40) regular += 1
      else slow += 1
    }

    return {
      docsByPeriod,
      totalDocs,
      activePeriods,
      avgPerPeriod,
      peakIdx,
      quietIdx,
      maxDocs,
      topItems,
      itemDocs,
      fast,
      regular,
      slow,
    }
  }, [periods, rows])

  if (periods.length === 0) {
    return (
      <div className="grid h-full min-h-[200px] place-items-center rounded-[24px] border-white/10 bg-white/[0.03] p-4 text-center">
        <div>
          <p className="text-sm font-bold text-[var(--rc-text-muted)]">Analisis frekuensi issue</p>
          <p className="rc-data mt-1 text-[11px] text-[var(--rc-text-faint)]">
            Menunggu matriks movement (periode × barang). Ubah timeline atau coba lagi saat DB siap.
          </p>
        </div>
      </div>
    )
  }

  const consistencyPct = periods.length > 0 ? Math.round((model.activePeriods / periods.length) * 100) : 0
  const totalAllItemsDocs = model.itemDocs.reduce((a, b) => a + b.docs, 0)

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[24px] border-white/10 bg-[rgba(3,14,10,.4)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--rc-text)]">Analisis frekuensi issue</p>
          <p className="rc-data mt-0.5 text-[10px] text-[var(--rc-text-faint)]">
            {model.totalDocs} dok · {model.activePeriods}/{periods.length} periode aktif ({consistencyPct}% konsisten)
            {rows.length === 0 ? ' · belum ada barang di top list' : ''}
          </p>
        </div>
        <span className="rc-data shrink-0 rounded-full border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-[var(--rc-text-muted)]">
          rata {model.avgPerPeriod.toFixed(1)} dok/periode
        </span>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Ritme dokumen periode */}
        <div className="flex min-h-0 flex-col rounded-2xl border-white/[0.07] bg-black/20 p-2.5">
          <p className="rc-data text-[9px] uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Ritme dokumen issue</p>
          <div className="mt-2 flex min-h-0 flex-1 items-end gap-[3px]">
            {model.docsByPeriod.map((v, i) => (
              <div
                key={periods[i]}
                title={`${periodLabel(periods[i])}: ${v} dok`}
                className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
              >
                <span className="rc-data pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-emerald-200 opacity-0 transition group-hover:opacity-100">
                  {v}
                </span>
                <div
                  className={`w-full rounded-t-[3px] transition ${i === model.peakIdx ? 'bg-emerald-300/85' : 'bg-emerald-400/40 group-hover:bg-emerald-400/60'}`}
                  style={{ height: `${v > 0 ? Math.max(6, (v / model.maxDocs) * 100) : 3}%` }}
                />
              </div>
            ))}
          </div>
          <div className="rc-data mt-1.5 flex justify-between text-[9px] text-[var(--rc-text-faint)]">
            <span>{periodLabel(periods[0])}</span>
            <span>
              teramai {periodLabel(periods[model.peakIdx] ?? '')} · tersepi {periodLabel(periods[model.quietIdx] ?? '')}
            </span>
            <span>{periodLabel(periods[periods.length - 1])}</span>
          </div>
        </div>

        {/* Sebaran kerutinan + top frekuensi */}
        <div className="flex min-h-0 flex-col gap-2">
          <div className="rounded-2xl border-white/[0.07] bg-black/20 p-2.5">
            <p className="rc-data text-[9px] uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Sebaran kerutinan barang</p>
            <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
              {model.fast > 0 && <div className="bg-emerald-400/80" style={{ width: `${(model.fast / rows.length) * 100}%` }} title={`Fast-moving: ${model.fast}`} />}
              {model.regular > 0 && <div className="bg-emerald-200/45" style={{ width: `${(model.regular / rows.length) * 100}%` }} title={`Reguler: ${model.regular}`} />}
              {model.slow > 0 && <div className="bg-amber-300/55" style={{ width: `${(model.slow / rows.length) * 100}%` }} title={`Slow-moving: ${model.slow}`} />}
            </div>
            <div className="rc-data mt-1.5 flex-wrap gap-x-3 gap-y-0.5 text-[9.5px] text-[var(--rc-text-muted)]">
              <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/80" />Fast {model.fast}</span>
              <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-200/45" />Reguler {model.regular}</span>
              <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-300/55" />Slow {model.slow}</span>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1 rounded-2xl border-white/[0.07] bg-black/20 p-2.5">
            <p className="rc-data text-[9px] uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Paling sering di-issue</p>
            <div className="mt-1.5 space-y-1">
              {model.topItems.map((item, idx) => {
                const share = totalAllItemsDocs > 0 ? Math.round((item.docs / totalAllItemsDocs) * 100) : 0
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => onDrilldown?.({ code: item.code, name: item.name })}
                    className="group flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-white/[0.05]"
                  >
                    <span className="rc-data w-3 shrink-0 text-[9px] text-[var(--rc-text-faint)]">{idx + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[var(--rc-text)] group-hover:text-emerald-200">
                      {item.name}
                    </span>
                    <span className="rc-data shrink-0 text-[10px] text-[var(--rc-text-muted)]">
                      {item.docs} dok · {share}%
                    </span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
