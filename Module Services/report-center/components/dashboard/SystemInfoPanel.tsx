'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Database, Server, Shield, Wifi } from 'lucide-react'

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

function currentPeriodLabel() {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date())
}

export default function SystemInfoPanel() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [periodLabel, setPeriodLabel] = useState('')

  useEffect(() => {
    let active = true
    setPeriodLabel(currentPeriodLabel())
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
  const rows = useMemo(
    () => [
      { label: 'Periode Aktif', value: periodLabel || 'Memuat…', icon: CheckCircle2, color: 'text-emerald-200 bg-emerald-400/10 border border-emerald-300/25' },
      { label: 'Scope Report', value: 'Estate / Kebun · Full Access', icon: Shield, color: 'text-sky-200 bg-sky-400/10 border border-sky-300/25' },
      { label: 'Database', value: status?.activeDatabase ?? 'db_ptrj_mill', icon: Database, color: 'text-[var(--rc-forest-accent)] bg-[rgba(155,226,61,.1)] border border-[rgba(155,226,61,.22)]' },
      {
        label: 'Integrasi Sistem',
        value: healthy ? 'SQL Gateway Terhubung' : status?.error ?? 'Menunggu status gateway',
        icon: Wifi,
        color: healthy
          ? 'text-emerald-200 bg-emerald-400/10 border border-emerald-300/25'
          : 'text-amber-200 bg-amber-400/10 border border-amber-300/25',
      },
      {
        label: 'Server Aktif',
        value: `${status?.activeServer ?? 'SERVER_PROFILE_3'}${healthy ? ' · sehat' : ' · perlu cek'}`,
        icon: Server,
        color: healthy
          ? 'text-[var(--rc-text-muted)] bg-white/5 border border-[var(--rc-forest-border)]'
          : 'text-rose-200 bg-rose-400/10 border border-rose-300/25',
      },
    ],
    [healthy, periodLabel, status?.activeDatabase, status?.activeServer, status?.error],
  )

  return (
    <section
      id="integration"
      className="flex h-full min-h-[300px] scroll-mt-24 flex-col rounded-[24px] border border-[var(--rc-forest-border)] bg-[rgba(7,26,20,.72)] p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black tracking-[-0.02em] text-[var(--rc-text)]">Informasi Sistem</h2>
          <p className="mt-0.5 text-xs font-semibold text-[var(--rc-text-faint)]">Cek gateway: {formatCheckedAt(status?.checkedAt)}</p>
        </div>
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            status === null ? 'bg-slate-500' : healthy ? 'bg-emerald-400' : 'bg-rose-400'
          }`}
          aria-hidden="true"
        />
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${row.color}`}>
              <row.icon size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--rc-text-faint)]">{row.label}</p>
              <p className="truncate text-sm font-bold text-[var(--rc-text)]">{row.value}</p>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/report-center/inventory"
        className="mt-auto inline-flex items-center justify-center rounded-2xl bg-[var(--rc-forest-primary)] px-4 py-3 text-sm font-black text-[#03130c] transition hover:bg-[var(--rc-forest-accent)]"
      >
        Lihat Status Integrasi &amp; Audit
      </Link>
    </section>
  )
}
