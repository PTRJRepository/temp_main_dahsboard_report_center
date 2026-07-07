'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Database, RefreshCw, Server } from 'lucide-react'

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
    <section className="relative overflow-hidden rounded-3xl border border-white/20 bg-[#071426] shadow-[0_28px_80px_rgba(7,20,38,0.24)]">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/assets/kebun sawit.webp')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#071426]/95 via-[#0B1D35]/84 to-[#167A3A]/78" />
      <div className="relative grid min-h-[270px] gap-8 p-7 text-white lg:grid-cols-[1fr_360px] lg:p-8">
        <div className="flex max-w-3xl flex-col justify-center">
          <span className="mb-4 inline-flex w-fit rounded-full border border-emerald-300/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">
            Report Intelligence Center
          </span>
          <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">Operational Report Center</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
            Pantau laporan, tren, dan insight operasional dalam satu dashboard dengan visual monitoring dan preview data per modul.
          </p>
          <div className="mt-7 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['9', 'Modul'],
              ['151', 'Katalog report'],
              ['8', 'Inventory live'],
              ['AI', 'Insight preview'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-2xl font-semibold">{value}</p>
                <p className="mt-1 text-xs font-medium text-slate-300">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="self-center rounded-2xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
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
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/20 text-emerald-100">
                  <item.icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-300">{item.label}</p>
                  <p className="truncate text-sm font-semibold text-white">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl border border-[#D9A514]/30 bg-[#D9A514]/15 px-3 py-2 text-xs font-medium text-amber-100">
            Terakhir cek: {formatCheckedAt(status?.checkedAt)}. {healthy ? 'Sistem berjalan normal.' : 'Server aktif belum sehat.'}
          </p>
        </aside>
      </div>
    </section>
  )
}
