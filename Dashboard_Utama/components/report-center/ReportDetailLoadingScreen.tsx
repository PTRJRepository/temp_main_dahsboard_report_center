'use client'

/* Hallmark · component: loading-screen · genre: atmospheric · theme: forest-report-center
 * states: default · hover(n/a) · focus · active(n/a) · disabled(n/a) · loading · error(n/a) · success
 * contrast: pass · seamless overlay while summary/KPI/table fetch
 */

import { useEffect, useMemo, useState } from 'react'
import { Leaf, Loader2 } from 'lucide-react'

export type ReportDetailLoadingMode = 'initial' | 'refresh'

type ReportDetailLoadingScreenProps = {
  open: boolean
  mode?: ReportDetailLoadingMode
  reportTitle?: string
  reportCode?: string
  sourceLabel?: string
  periodLabel?: string
  /** Optional elapsed ms from parent; else self-timed while open */
  startedAt?: number
}

const PHASES = [
  { id: 'connect', label: 'Connect DB', hint: 'Gateway + source' },
  { id: 'aggregate', label: 'Aggregate', hint: 'Summary & chart groups' },
  { id: 'detail', label: 'Detail window', hint: 'Table first page' },
  { id: 'sync', label: 'Sync KPI', hint: 'Grand total = full scope' },
] as const

function formatElapsed(ms: number) {
  const sec = Math.max(0, ms / 1000)
  if (sec < 10) return `${sec.toFixed(1)}s`
  return `${Math.floor(sec)}s`
}

export default function ReportDetailLoadingScreen({
  open,
  mode = 'initial',
  reportTitle,
  reportCode,
  sourceLabel,
  periodLabel,
  startedAt,
}: ReportDetailLoadingScreenProps) {
  const [now, setNow] = useState(() => Date.now())
  const [internalStart] = useState(() => Date.now())
  const origin = startedAt ?? internalStart

  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [open])

  const elapsed = Math.max(0, now - origin)
  // Soft phase advance — honest progress feel, not fake 100% completion.
  const phaseIndex = useMemo(() => {
    if (elapsed < 900) return 0
    if (elapsed < 2400) return 1
    if (elapsed < 5000) return 2
    return 3
  }, [elapsed])

  const barPct = useMemo(() => {
    // Asymptotic bar — never claims finished before open=false.
    const t = elapsed / 1000
    return Math.min(92, Math.round(18 + 74 * (1 - Math.exp(-t / 4.2))))
  }, [elapsed])

  if (!open) return null

  const isRefresh = mode === 'refresh'
  const title = isRefresh ? 'Memperbarui scope report' : 'Menyiapkan report detail'
  const subtitle = isRefresh
    ? 'KPI & grand total di-hold sampai summary server selesai — hindari angka setengah jadi.'
    : 'Summary full-scope dulu, baru tabel. Tunggu sebentar agar Closing cocok export.'

  return (
    <div
      className="mt-4 overflow-hidden rounded-2xl border border-lime-400/30 bg-gradient-to-br from-[#0c2418] via-[#071426] to-[#040b14] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)] sm:p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={title}
    >
      <div className="mx-auto w-full max-w-md text-center">
        <div className="relative mx-auto mb-4 h-16 w-16" aria-hidden="true">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-lime-300 border-r-lime-300/30" />
          <span className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-b-emerald-400/60 border-t-emerald-300 [animation-direction:reverse] [animation-duration:1.8s]" />
          <span className="absolute inset-3.5 grid place-items-center rounded-full bg-gradient-to-br from-emerald-700 to-[#0f2b1a] text-lime-300 shadow-[0_0_20px_rgba(163,230,53,0.35)]">
            <Leaf size={20} strokeWidth={2.25} />
          </span>
        </div>

        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-300/90">
          Report Center · {isRefresh ? 'Refresh' : 'Loading'}
        </p>
        <h2 className="mt-2 text-lg font-black tracking-tight text-white sm:text-xl">{title}</h2>
        <p className="mt-2 text-xs font-semibold leading-relaxed text-white/60 sm:text-sm">{subtitle}</p>

        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {reportTitle ? (
            <span className="max-w-full truncate rounded-full border border-lime-300/30 bg-lime-400/10 px-2.5 py-1 text-[10px] font-extrabold text-lime-100" title={reportTitle}>
              {reportTitle}
            </span>
          ) : null}
          {reportCode ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white/70">{reportCode}</span> : null}
          {sourceLabel ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white/70">{sourceLabel}</span> : null}
          {periodLabel ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white/70">{periodLabel}</span> : null}
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-lime-300 to-emerald-400 transition-[width] duration-300 ease-out"
            style={{ width: `${barPct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] font-extrabold uppercase tracking-wide text-white/45">
          <span className="inline-flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin text-lime-300" aria-hidden="true" />
            {PHASES[phaseIndex].label}
          </span>
          <span>{formatElapsed(elapsed)}</span>
        </div>

        <ol className="mt-4 space-y-1.5 text-left">
          {PHASES.map((phase, index) => {
            const state = index < phaseIndex ? 'done' : index === phaseIndex ? 'active' : 'todo'
            return (
              <li
                key={phase.id}
                className={`grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded-lg border px-2.5 py-2 ${
                  state === 'active'
                    ? 'border-lime-300/40 bg-lime-400/10'
                    : state === 'done'
                      ? 'border-white/5 bg-white/[0.03] opacity-75'
                      : 'border-transparent opacity-40'
                }`}
              >
                <span
                  className={`mt-1 h-2 w-2 rounded-full ${
                    state === 'active' ? 'bg-lime-300 shadow-[0_0_0_3px_rgba(163,230,53,0.25)]' : state === 'done' ? 'bg-emerald-400' : 'bg-white/25'
                  }`}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-extrabold text-white">{phase.label}</span>
                  <span className="block text-[11px] font-semibold text-white/50">{phase.hint}</span>
                </span>
              </li>
            )
          })}
        </ol>

        <p className="mt-4 text-[11px] font-semibold leading-snug text-amber-200/90">
          Grand total Closing uses full server scope — wait until this panel closes before reading KPI.
        </p>
      </div>
    </div>
  )
}
