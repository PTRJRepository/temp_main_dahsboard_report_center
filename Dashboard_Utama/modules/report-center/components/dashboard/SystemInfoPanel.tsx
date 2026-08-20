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

export default function SystemInfoPanel() {
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
  const rows = useMemo(
    () => [
      { label: 'Periode Aktif', value: 'Mei 2026', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
    { label: 'Scope Report', value: 'Estate / Kebun - Full Access', icon: Shield, color: 'text-blue-700 bg-blue-50' },
      { label: 'Database', value: status?.activeDatabase ?? 'db_ptrj_mill', icon: Database, color: 'text-emerald-700 bg-emerald-50' },
      {
        label: 'Integrasi Sistem',
        value: healthy ? 'SQL Gateway Terhubung' : status?.error ?? 'Menunggu status gateway',
        icon: Wifi,
        color: healthy ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50',
      },
      {
        label: 'Server Aktif',
        value: `${status?.activeServer ?? 'SERVER_PROFILE_3'}${healthy ? ' - sehat' : ' - perlu cek'}`,
        icon: Server,
        color: healthy ? 'text-slate-700 bg-slate-100' : 'text-red-700 bg-red-50',
      },
    ],
    [healthy, status?.activeDatabase, status?.activeServer, status?.error],
  )

  return (
    <section className="flex h-full min-h-[300px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-950">Informasi Sistem</h2>
        <p className="mt-1 text-xs text-slate-500">Terakhir cek gateway: {formatCheckedAt(status?.checkedAt)}</p>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
            <div className={`grid h-9 w-9 place-items-center rounded-xl ${row.color}`}>
              <row.icon size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">{row.label}</p>
              <p className="truncate text-sm font-semibold text-slate-950">{row.value}</p>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/report-center/inventory"
        className="mt-auto inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
      >
        Lihat Status Integrasi & Audit
      </Link>
    </section>
  )
}
