'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Database, Factory, LayoutDashboard, TreePine, Zap } from 'lucide-react'
import AggregationControlPanel from '@modules/report-center/components/report-center/AggregationControlPanel'

/**
 * Halaman ruang kontrol agregasi KPI bulanan pre-rendered.
 * Dipisah dari deck utama agar operator bisa membangun/melihat status agregasi
 * tanpa membongkar deck KPI. Mengikuti visual system technical-luxury forest.
 */

type ReportSource = 'estate' | 'pabrik'

type AggregationStatus = {
  success: boolean
  currentPeriod: string
  closedPeriods: string[]
  handlerKeys: string[]
  built: Array<{ id: string; handlerKey: string; period: string; builtAt: string; rowCount: number }>
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function formatPeriodShort(period: string) {
  const [year, month] = period.split('-')
  const idx = Number(month) - 1
  return idx >= 0 && idx < 12 ? `${MONTHS_ID[idx]} ${year}` : period
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function ControlRoomClient({ source }: { source: ReportSource }) {
  const [status, setStatus] = useState<AggregationStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/reports/inventory/aggregation?months=18', { cache: 'no-store' })
      const data = (await response.json()) as AggregationStatus
      if (data.success) setStatus(data)
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const builtCount = status?.built?.length ?? 0
  const totalCells = (status?.closedPeriods?.length ?? 0) * (status?.handlerKeys?.length ?? 0)
  const totalRows = status?.built?.reduce((sum, row) => sum + (Number(row.rowCount) || 0), 0) ?? 0

  const sourceToggle = (
    <div className="inline-flex items-center gap-1 rounded-2xl border-[var(--rc-border)] bg-black/20 p-1">
      {(
        [
          { key: 'estate', label: 'Estate', icon: TreePine },
          { key: 'pabrik', label: 'Pabrik', icon: Factory },
        ] as const
      ).map(({ key, label, icon: Icon }) => (
        <Link
          key={key}
          href={`/report-center/control?source=${key}`}
          className={
            source === key
              ? 'inline-flex items-center gap-1.5 rounded-xl border-[var(--rc-forest-border-strong)] bg-[rgba(155,226,61,.12)] px-3 py-1.5 text-[11px] font-bold text-[var(--rc-forest-accent)]'
              : 'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-[var(--rc-text-faint)] transition hover:text-[var(--rc-text)]'
          }
        >
          <Icon size={13} />
          {label}
        </Link>
      ))}
    </div>
  )

  return (
    <main className="min-h-full bg-transparent">
      <div className="mx-auto max-w-screen-2xl space-y-5 px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <section className="rc-panel rc-panel-active overflow-hidden rounded-3xl">
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:p-6">
            <div>
              <nav className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--rc-text-faint)]">
                <Link href={`/report-center?source=${source}`} className="hover:text-amber-300">
                  Dashboard
                </Link>
                <span>/</span>
                <span className="text-amber-300">Ruang Kontrol</span>
              </nav>
              <h1
                className="mt-4 text-3xl font-black tracking-tight text-[var(--rc-text)] sm:text-4xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Ruang Kontrol Agregasi
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--rc-text-muted)]">
                Data periode yang sudah closing bersifat immutable — render sekali, simpan, dan sajikan
                ulang tanpa menghitung ulang. Periode berjalan selalu diambil live karena datanya masih
                berubah. Bangun agregasi di sini agar deck KPI tetap ringan.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border-white/10 bg-white/5 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--rc-text-faint)]">Ter-render</p>
                <p className="mt-2 text-2xl font-black text-[var(--rc-forest-accent)]" style={{ fontFamily: 'var(--font-display)' }}>
                  {builtCount}
                </p>
              </div>
              <div className="rounded-2xl border-white/10 bg-white/5 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--rc-text-faint)]">Sel KPI</p>
                <p className="mt-2 text-2xl font-black text-[var(--rc-text)]" style={{ fontFamily: 'var(--font-display)' }}>
                  {totalCells}
                </p>
              </div>
              <div className="rounded-2xl border-white/10 bg-white/5 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--rc-text-faint)]">Baris</p>
                <p className="mt-2 text-2xl font-black text-[var(--rc-text)]" style={{ fontFamily: 'var(--font-display)' }}>
                  {totalRows.toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                href={`/report-center?source=${source}`}
                className="inline-flex items-center gap-2 rounded-xl border-[var(--rc-border)] bg-white/5 px-3 py-2 text-xs font-bold text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)]"
              >
                <ArrowLeft size={14} />
                Dashboard
              </Link>
              <Link
                href={`/report-center/procurement?source=${source}`}
                className="inline-flex items-center gap-2 rounded-xl border-[var(--rc-border)] bg-white/5 px-3 py-2 text-xs font-bold text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)]"
              >
                <LayoutDashboard size={14} />
                Deck KPI
              </Link>
            </div>
            {sourceToggle}
          </div>

          <AggregationControlPanel source={source} />
        </section>

        <section className="rc-panel overflow-hidden rounded-3xl">
          <div className="flex flex-col gap-3 border-b border-[var(--rc-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Data ter-render</p>
              <h2 className="mt-1 text-base font-bold text-[var(--rc-text)]">Agregasi closed yang sudah tersimpan</h2>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex w-fit items-center gap-2 rounded-xl border-[var(--rc-border)] bg-white/5 px-3 py-2 text-xs font-bold text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)] disabled:opacity-50"
            >
              <Zap size={13} />
              {loading ? 'Memuat…' : 'Muat ulang'}
            </button>
          </div>

          <div className="p-4">
            {!status ? (
              <p className="px-2 py-6 text-sm font-semibold text-[var(--rc-text-faint)]">
                {loading ? 'Memuat status agregasi…' : 'Status agregasi tidak tersedia.'}
              </p>
            ) : status.built.length === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl border-dashed border-[var(--rc-border)] bg-black/20 px-4 py-6">
                <Database size={18} className="shrink-0 text-[var(--rc-text-faint)]" />
                <p className="text-sm font-semibold text-[var(--rc-text-faint)]">
                  Belum ada agregasi yang dibangun. Gunakan tombol &quot;Bangun agregasi closed&quot; di panel atas.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] text-[10px] font-black uppercase tracking-[0.18em] text-[var(--rc-text-faint)]">
                      <th className="px-3 py-2">Report</th>
                      <th className="px-3 py-2">Periode</th>
                      <th className="px-3 py-2 text-right">Baris</th>
                      <th className="px-3 py-2">Dibangun</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.built
                      .slice()
                      .sort((a, b) => (a.period < b.period ? 1 : -1))
                      .map((row) => (
                        <tr key={row.id} className="border-b border-[var(--rc-border)]/60 last:border-0">
                          <td className="px-3 py-2 text-xs font-bold text-[var(--rc-text)]">{row.handlerKey}</td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1 rounded-md border-[var(--rc-forest-border)] bg-[rgba(155,226,61,.14)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--rc-forest-accent)]">
                              <span className="inline-block h-1 w-1 rounded-full bg-[var(--rc-forest-accent)]" aria-hidden="true" />
                              {formatPeriodShort(row.period)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-[var(--rc-text-muted)]" style={{ fontFamily: 'var(--font-data)' }}>
                            {(Number(row.rowCount) || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="px-3 py-2 text-xs font-semibold text-[var(--rc-text-faint)]">
                            {formatDateTime(row.builtAt)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
