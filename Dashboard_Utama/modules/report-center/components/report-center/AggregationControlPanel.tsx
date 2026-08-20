'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Control room panel untuk agregasi KPI bulanan pre-rendered.
 *
 * Menampilkan status periode closed × report KPI (built/belum), periode current
 * (selalu live, tidak bisa dibangun), dan tombol untuk membangun agregasi closed.
 * Mengikuti visual system technical-luxury: chip mono, hairline, tanpa eyebrow
 * dekoratif / glow berwarna (aturan Hallmark).
 */

type AggregationCell = {
  handlerKey: string
  periods: Array<{ period: string; built: boolean }>
}

type AggregationStatus = {
  success: boolean
  currentPeriod: string
  closedPeriods: string[]
  handlerKeys: string[]
  cells: AggregationCell[]
  built: Array<{ id: string; handlerKey: string; period: string; builtAt: string; rowCount: number }>
}

type AggregationControlPanelProps = {
  source: 'estate' | 'pabrik'
  /** Tampilkan versi ringkas (chip saja) tanpa grid detail. */
  compact?: boolean
}

const HANDLER_LABEL: Record<string, string> = {
  'asset-stock-valuasi-listing': 'Valuasi',
  'goods-receiving-receipt-activity': 'Receive',
  'purchase-order-history': 'PO',
  'purchase-request-inventory': 'PR',
  'all-stock-movement-analysis': 'Movement',
  'pengeluaran-barang': 'Usage',
  'return-barang': 'Return',
}

function formatPeriodShort(period: string) {
  const [year, month] = period.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const idx = Number(month) - 1
  return idx >= 0 && idx < 12 ? `${months[idx]} ${year}` : period
}

export default function AggregationControlPanel({ source, compact = false }: AggregationControlPanelProps) {
  const [status, setStatus] = useState<AggregationStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [building, setBuilding] = useState(false)
  const [message, setMessage] = useState<string>('')

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

  const build = useCallback(async () => {
    setBuilding(true)
    setMessage('')
    try {
      const response = await fetch('/api/reports/inventory/aggregation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, periods: status?.closedPeriods?.slice(0, 3) }),
      })
      const data = (await response.json()) as { success?: boolean; built?: number; failed?: number; rejected?: Array<{ period: string }> }
      if (data.success) {
        const rejectedNote = data.rejected && data.rejected.length > 0 ? ` · ${data.rejected.length} periode live dilewati` : ''
        setMessage(`Agregasi dibangun: ${data.built ?? 0} OK${data.failed ? ` · ${data.failed} gagal` : ''}${rejectedNote}`)
        await load()
      } else {
        setMessage('Gagal membangun agregasi')
      }
    } catch {
      setMessage('Gagal membangun agregasi')
    } finally {
      setBuilding(false)
    }
  }, [load, source, status?.closedPeriods])

  if (loading && !status) {
    return (
      <div className="rounded-2xl border-[var(--rc-border)] bg-black/20 px-3 py-2 text-[11px] font-semibold text-[var(--rc-text-faint)]">
        Memeriksa status agregasi…
      </div>
    )
  }

  if (!status) return null

  const totalClosed = status.closedPeriods.length
  const builtCount = status.built.length
  const anyBuilt = builtCount > 0

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border-[var(--rc-forest-border)] bg-[rgba(155,226,61,.06)] px-2.5 py-1 text-[10px] font-bold text-[var(--rc-forest-accent)]"
        title={`${builtCount} agregasi closed ter-render. Periode ${status.currentPeriod} live.`}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--rc-forest-accent)]" aria-hidden="true" />
        {anyBuilt ? `${builtCount} agregasi` : 'Live'}
      </span>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border-[var(--rc-forest-border)] bg-black/25 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--rc-text)]" style={{ fontFamily: 'var(--font-display)' }}>Ruang kontrol agregasi</p>
          <p className="mt-1 text-xs font-semibold text-[var(--rc-text-faint)]">
            Periode closed di-render sekali (immutable). Periode current{' '}
            <span className="text-[var(--rc-forest-accent)]">{formatPeriodShort(status.currentPeriod)}</span> selalu live.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void build()}
          disabled={building}
          className="h-10 rounded-xl border-[var(--rc-forest-border-strong)] bg-[rgba(155,226,61,.12)] px-4 text-xs font-bold text-[var(--rc-forest-accent)] outline-none transition hover:bg-[rgba(155,226,61,.2)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {building ? 'Membangun…' : 'Bangun agregasi closed'}
        </button>
      </div>

      <div className="mt-4 flex-col gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="text-[var(--rc-text-faint)]">Periode berjalan</span>
          <span className="inline-flex items-center gap-1 rounded-full border-[var(--rc-forest-border)] bg-[rgba(155,226,61,.08)] px-2 py-0.5 font-bold text-[var(--rc-forest-accent)]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--rc-forest-accent)]" aria-hidden="true" />
            {formatPeriodShort(status.currentPeriod)} · live
          </span>
        </div>

        <div className="grid gap-2">
          {status.cells.map((cell) => (
            <div key={cell.handlerKey} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="w-24 shrink-0 text-[11px] font-bold text-[var(--rc-text-faint)]">
                {HANDLER_LABEL[cell.handlerKey] ?? cell.handlerKey}
              </span>
              <div className="flex flex-1 flex-wrap gap-1">
                {cell.periods.map(({ period, built }) => (
                  <span
                    key={period}
                    title={built ? `${formatPeriodShort(period)} — pre-rendered` : `${formatPeriodShort(period)} — belum dibangun`}
                    className={
                      built
                        ? 'inline-flex items-center gap-1 rounded-md border-[var(--rc-forest-border)] bg-[rgba(155,226,61,.14)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--rc-forest-accent)]'
                        : 'inline-flex items-center gap-1 rounded-md border-[var(--rc-border)] bg-black/20 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--rc-text-faint)]'
                    }
                  >
                    {built && <span className="inline-block h-1 w-1 rounded-full bg-[var(--rc-forest-accent)]" aria-hidden="true" />}
                    {formatPeriodShort(period)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--rc-border)] pt-3">
          <p className="text-[11px] font-semibold text-[var(--rc-text-faint)]">
            {builtCount} dari {totalClosed * status.handlerKeys.length} sel KPI closed ter-render
          </p>
          {message ? <p className="text-[11px] font-bold text-[var(--rc-forest-accent)]">{message}</p> : null}
        </div>
      </div>
    </div>
  )
}
