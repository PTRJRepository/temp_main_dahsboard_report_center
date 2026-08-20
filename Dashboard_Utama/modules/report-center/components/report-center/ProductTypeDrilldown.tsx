'use client'

import { useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ScrollArea from './ScrollArea'

type ReportSource = 'estate' | 'pabrik'

type SourceSplit = { qty: number; amount: number }

type ProductTypeDetail = {
  code: string
  name: string
  itemCount: number
  valuasi: number
  closing: number
  issueQty: number
  issueAmount: number
  fastCount: number
  movingCount: number
  slowCount: number
  deadCount: number
  lastMovement: string | null
  split: { gudang: SourceSplit; fuel: SourceSplit; workshop: SourceSplit }
  topItems: Array<{ code: string; name: string; qty: number; amount: number }>
  trend: Array<{ period: string; qty: number; amount: number }>
}

type DetailResponse = {
  success: boolean
  mode: 'detail'
  closingPeriod?: string
  row: ProductTypeDetail | null
  error?: string
}

function formatRupiah(value: number) {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`
  if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`
  return `Rp ${value.toLocaleString('id-ID')}`
}

function formatQty(value: number) {
  if (!Number.isFinite(value)) return '0'
  return value.toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

function gatewayBase() {
  if (typeof window === 'undefined') return 'http://10.0.0.110:8001'
  return window.localStorage.getItem('report-center:sql-gateway-base') || 'http://10.0.0.110:8001'
}

function SectionLabel({ children }: { children: string }) {
  return <p className="rc-eyebrow text-[var(--rc-forest-accent)]">{children}</p>
}

/**
 * Pop-up drill-down KPI lengkap SATU product type.
 * Pola ItemDrilldown: backdrop blur klik-tutup + ESC, role="dialog", ScrollArea.
 * Fetch sendiri ke endpoint product-type-kpi (mode detail).
 */
export default function ProductTypeDrilldown({
  code,
  filters,
  onClose,
  onOpenItem,
}: {
  code: string | null
  filters: { source: ReportSource; months: number; itemType?: string; location?: string }
  onClose: () => void
  onOpenItem?: (itemCode: string) => void
}) {
  const [row, setRow] = useState<ProductTypeDetail | null>(null)
  const [closingPeriod, setClosingPeriod] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ESC untuk tutup.
  useEffect(() => {
    if (!code) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [code, onClose])

  useEffect(() => {
    if (!code) return
    const controller = new AbortController()
    let active = true
    const params = new URLSearchParams({
      source: filters.source,
      months: String(filters.months),
      productType: code,
    })
    if (filters.itemType) params.set('itemType', filters.itemType)
    if (filters.location) params.set('location', filters.location)

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/reports/inventory/product-type-kpi?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { 'x-sql-gateway-base': gatewayBase() },
        })
        const result = (await response.json()) as DetailResponse
        if (!response.ok || !result.success) throw new Error(result.error ?? 'Gagal memuat detail product type.')
        if (active) {
          setRow(result.row)
          setClosingPeriod(result.closingPeriod ?? null)
        }
      } catch (err) {
        if (!active || controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Gagal memuat detail product type.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void Promise.resolve().then(load)
    return () => {
      active = false
      controller.abort()
    }
  }, [code, filters.source, filters.months, filters.itemType, filters.location])

  if (!code) return null

  const splitTotal = row ? row.split.gudang.amount + row.split.fuel.amount + row.split.workshop.amount : 0
  const splitPct = (amount: number) => (splitTotal > 0 ? Math.round((amount / splitTotal) * 100) : 0)
  const categoryTotal = row ? row.fastCount + row.movingCount + row.slowCount + row.deadCount : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`KPI product type ${row?.name ?? code}`}
        className="w-full max-w-[680px] overflow-hidden rounded-[24px] border-[var(--rc-border)] bg-[linear-gradient(160deg,rgba(4,18,12,.98),rgba(2,10,7,.97))] shadow-[0_30px_90px_rgba(0,0,0,.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
          <div className="min-w-0">
            <p className="rc-data text-[9px] uppercase tracking-[0.18em] text-[var(--rc-text-faint)]">KPI product type</p>
            <h3 className="mt-1 truncate text-base font-bold text-[var(--rc-text)]">{row?.name ?? code}</h3>
            <p className="rc-data mt-0.5 text-[10px] text-[var(--rc-text-faint)]">{code} · {filters.months} bulan</p>
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

        <ScrollArea className="max-h-[70vh] px-4 py-3">
          {loading && !row ? (
            <p className="py-8 text-center text-sm text-[var(--rc-text-faint)]">Memuat KPI product type…</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-[var(--rc-danger)]">{error}</p>
          ) : !row ? (
            <p className="py-8 text-center text-sm text-[var(--rc-text-faint)]">Tidak ada data untuk product type ini.</p>
          ) : (
            <div className="space-y-4">
              {/* KPI utama */}
              <div>
                <SectionLabel>Valuasi & total usage</SectionLabel>
                <div className="mt-2 grid-cols-2 gap-2 sm:grid grid-cols-4">
                  {[
                    { label: 'Valuasi', value: formatRupiah(row.valuasi), tone: 'text-[var(--rc-forest-premium)]' },
                    { label: 'Issue amount', value: formatRupiah(row.issueAmount), tone: 'text-[var(--rc-text)]' },
                    { label: 'Issue qty', value: formatQty(row.issueQty), tone: 'text-[var(--rc-text)]' },
                    { label: 'Item', value: String(row.itemCount), tone: 'text-[var(--rc-text)]' },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rc-kpi-surface rounded-2xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--rc-text-faint)]">{kpi.label}</p>
                      <p className={`rc-metric mt-1 text-base font-semibold ${kpi.tone}`}>{kpi.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Closing snapshot */}
              <div>
                <SectionLabel>Closing (snapshot)</SectionLabel>
                <div className="mt-2">
                  <div className="rc-kpi-surface rounded-2xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--rc-text-faint)]">Closing (snapshot)</p>
                    <p className="rc-metric mt-1 text-base font-semibold text-[var(--rc-forest-premium)]">{formatRupiah(row.closing)}</p>
                    <p className="rc-data mt-1 text-[10px] text-[var(--rc-text-faint)]">
                      IN_MTHENDITEM{closingPeriod ? ` · ${closingPeriod}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Split 3-sumber */}
              <div>
                <SectionLabel>Sumber issue</SectionLabel>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([
                    ['Gudang', row.split.gudang, '#18b96b'],
                    ['Fuel / BBM', row.split.fuel, '#29c7c8'],
                    ['Workshop', row.split.workshop, '#9be23d'],
                  ] as const).map(([label, split, color]) => (
                    <div key={label} className="rounded-2xl border-white/[0.07] bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold text-[var(--rc-text-muted)]">{label}</p>
                        <span className="rc-data text-[10px] font-semibold" style={{ color }}>{splitPct(split.amount)}%</span>
                      </div>
                      <p className="rc-metric mt-1 text-sm font-semibold text-[var(--rc-text)]">{formatRupiah(split.amount)}</p>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full" style={{ width: `${splitPct(split.amount)}%`, backgroundColor: color }} />
                      </div>
                      <p className="rc-data mt-1 text-[10px] text-[var(--rc-text-faint)]">{formatQty(split.qty)} qty</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Movement category */}
              <div>
                <SectionLabel>Movement category</SectionLabel>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {([
                    ['Fast', row.fastCount, 'var(--rc-success)'],
                    ['Moving', row.movingCount, 'var(--rc-forest-accent)'],
                    ['Slow', row.slowCount, 'var(--rc-warning)'],
                    ['Dead', row.deadCount, 'var(--rc-danger)'],
                  ] as const).map(([label, count, color]) => (
                    <div key={label} className="rounded-2xl border-white/[0.07] bg-white/[0.03] p-3 text-center">
                      <p className="rc-metric text-xl font-semibold" style={{ color }}>{count}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--rc-text-faint)]">{label}</p>
                      <p className="rc-data text-[9px] text-[var(--rc-text-faint)]">
                        {categoryTotal > 0 ? `${Math.round((count / categoryTotal) * 100)}%` : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trend bulanan */}
              <div>
                <SectionLabel>Trend issue bulanan</SectionLabel>
                <div className="mt-2 h-[180px] rounded-2xl border-white/[0.07] bg-white/[0.03] p-2">
                  {row.trend.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={row.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="ptAmount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#18b96b" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="#18b96b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(172,255,188,0.08)" vertical={false} />
                        <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={54}
                          tickFormatter={(v: number) => formatRupiah(v).replace('Rp ', '')} />
                        <Tooltip
                          contentStyle={{ background: '#0a1711', border: '1px solid rgba(172,255,188,0.16)', borderRadius: 12, fontSize: 12 }}
                          labelStyle={{ color: '#e5e7eb' }}
                          formatter={(value) => [formatRupiah(Number(value ?? 0)), 'Issue']}
                        />
                        <Area type="monotone" dataKey="amount" stroke="#18b96b" strokeWidth={2} fill="url(#ptAmount)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="py-10 text-center text-xs text-[var(--rc-text-faint)]">Trend belum cukup data.</p>
                  )}
                </div>
              </div>

              {/* Top items */}
              <div>
                <SectionLabel>Top items di type ini</SectionLabel>
                <ul className="mt-2 space-y-1.5">
                  {row.topItems.map((item) => (
                    <li key={item.code}>
                      <button
                        type="button"
                        onClick={() => onOpenItem?.(item.code)}
                        className="rc-forest-focus grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border-white/[0.06] bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/[0.06]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-[var(--rc-text)]">{item.name}</span>
                          <span className="rc-data text-[10px] text-[var(--rc-text-faint)]">{item.code} · {formatQty(item.qty)} qty</span>
                        </span>
                        <span className="rc-metric text-xs font-semibold text-[var(--rc-text-muted)]">{formatRupiah(item.amount)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-4 py-3">
          <p className="rc-data text-[10px] text-[var(--rc-text-faint)]">
            {row?.lastMovement ? `Movement terakhir ${row.lastMovement}` : 'Tidak ada movement pada rentang ini'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rc-forest-focus rounded-xl bg-[var(--rc-forest-primary)] px-4 py-2 text-xs font-black text-[#03130c] transition hover:bg-[var(--rc-forest-accent)]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
