'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Database, Leaf, RefreshCw, Server } from 'lucide-react'

type SystemStatus = {
  success?: boolean
  gatewayOnline?: boolean
  activeServer?: string
  activeDatabase?: string
  activeConnected?: boolean
  activeHealthy?: boolean
  checkedAt?: string
  error?: string
}

function formatCheckedAt(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function HeroBanner() {
  const [status, setStatus] = useState<SystemStatus | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/reports/system-status', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: SystemStatus) => {
        if (active) setStatus(data)
      })
      .catch((error) => {
        if (active) setStatus({ success: false, error: error instanceof Error ? error.message : 'Gagal membaca status' })
      })
    return () => {
      active = false
    }
  }, [])

  const healthy = Boolean(status?.gatewayOnline && status.activeConnected && status.activeHealthy)

  return (
    <section className="rc-forest-card relative overflow-hidden rounded-3xl p-0">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <svg className="absolute right-0 top-0 h-full w-[58%] text-[var(--rc-forest-accent)]" viewBox="0 0 520 320" fill="none" aria-hidden="true">
          <path d="M38 270C112 178 168 190 228 118C277 59 342 55 479 36" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.5" />
          <path d="M76 297C146 232 200 224 265 154C320 95 387 86 505 72" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1.5" />
          <path d="M118 315C188 279 256 244 330 190C389 147 431 132 512 118" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1.5" />
          <circle cx="228" cy="118" r="5" fill="currentColor" fillOpacity="0.34" />
          <circle cx="330" cy="190" r="4" fill="currentColor" fillOpacity="0.28" />
          <circle cx="479" cy="36" r="6" fill="currentColor" fillOpacity="0.32" />
        </svg>
        <div className="absolute right-10 top-10 hidden h-44 w-44 rounded-[2rem] border border-[var(--rc-forest-border)] bg-[var(--rc-forest-primary-soft)] blur-[1px] lg:block" />
      </div>
      <div className="relative grid min-h-[270px] gap-8 p-7 text-white lg:grid-cols-[1fr_360px] lg:p-8">
        <div className="flex max-w-3xl flex-col justify-center">
          <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full rc-forest-badge px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
            <Leaf size={14} />
            Forest Intelligence UI
          </span>
          <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">Report Center Perkebunan & Pabrik</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--rc-text-muted)]">
            Pusat intelijen laporan untuk menemukan modul, sub-modul, dan runner data operasional dalam alur yang jelas dan terarah.
          </p>
          <div className="mt-7 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['11', 'Kategori bisnis'],
              ['151', 'Katalog report'],
              ['Estate', 'Source context'],
              ['AI', 'Insight preview'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-[var(--rc-forest-border)] bg-[var(--rc-forest-primary-soft)] p-4 backdrop-blur">
                <p className="text-2xl font-semibold text-[var(--rc-forest-accent)]">{value}</p>
                <p className="mt-1 text-xs font-medium text-[var(--rc-text-muted)]">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="self-center rounded-2xl border border-[var(--rc-forest-border)] bg-[rgba(7,26,20,0.76)] p-5 shadow-2xl backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Status Sistem</p>
              <p className="mt-1 text-xs text-slate-300">Server inventory read-only</p>
            </div>
            <span
              className={[
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                healthy ? 'bg-emerald-400/20 text-emerald-100' : 'bg-amber-400/20 text-amber-100',
              ].join(' ')}
            >
              <CheckCircle2 size={14} />
              {status ? (healthy ? 'Normal' : 'Perlu Cek') : 'Checking'}
            </span>
          </div>
          <div className="space-y-3">
            {[
              { icon: Database, label: 'Database', value: status?.activeDatabase ?? 'db_ptrj_mill' },
              { icon: Server, label: 'Server', value: status?.activeServer ?? 'SERVER_PROFILE_3' },
              {
                icon: RefreshCw,
                label: 'Integrasi',
                value: healthy ? 'SQL Gateway terhubung' : status?.error ?? 'Menunggu status gateway',
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--rc-forest-primary-soft)] text-[var(--rc-forest-accent)]">
                  <item.icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-300">{item.label}</p>
                  <p className="truncate text-sm font-semibold text-white">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl border border-[var(--rc-forest-premium)]/30 bg-[var(--rc-forest-premium-soft)] px-3 py-2 text-xs font-medium text-amber-100">
            Terakhir cek: {formatCheckedAt(status?.checkedAt)}. {healthy ? 'Sistem berjalan normal.' : 'Server aktif belum sehat.'}
          </p>
        </aside>
      </div>
    </section>
  )
}
