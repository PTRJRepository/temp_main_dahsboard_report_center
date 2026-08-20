'use client'

import { useEffect, useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import MicroReportHeader from './MicroReportHeader'
import ScrollArea from './ScrollArea'
import TopNSelect from './TopNSelect'
import type { ProductTypeFilters } from './ProductTypeAnalysisPanel'

type ReturnKpis = { qty: number; amount: number; docs: number; itemCount: number }
type ReturnTrendRow = { period: string; qty: number; amount: number; docs: number }
type ReturnTopRow = { code: string; name: string; qty: number; amount: number }

type ReturnBlock = {
  available: boolean
  note?: string
  kpis?: ReturnKpis
  trend?: ReturnTrendRow[]
  top?: ReturnTopRow[]
}

type ReturnAnalysisResponse = {
  success: boolean
  periods?: string[]
  purchasing?: ReturnBlock
  inventory?: ReturnBlock
  error?: string
}

const MONTH_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function formatRupiah(value: number) {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`
  if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`
  return `Rp ${value.toLocaleString('id-ID')}`
}

function formatQty(value: number) {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} jt`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)} rb`
  return value.toLocaleString('id-ID')
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)} M`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)} jt`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)} rb`
  return String(Math.round(value))
}

function formatCount(value: number) {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('id-ID')
}

function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  return `${MONTH_ID[(Number(m) - 1) % 12] ?? m} ${String(y).slice(2)}`
}

function gatewayBase() {
  if (typeof window === 'undefined') return 'http://10.0.0.110:8001'
  return window.localStorage.getItem('report-center:sql-gateway-base') || 'http://10.0.0.110:8001'
}

type TrendPoint = { period: string; label: string; qty: number; amount: number; docs: number }

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload?: TrendPoint }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  return (
    <div className="min-w-[190px] rounded-xl border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.95)] px-3 py-2 text-xs shadow-xl">
      <p className="font-black text-[var(--rc-text)]">{label}</p>
      <div className="mt-1.5 space-y-0.5">
        <p className="flex items-center justify-between gap-3">
          <span className="text-[var(--rc-text-muted)]">Qty</span>
          <span className="rc-metric font-semibold text-[var(--rc-text)]">{formatQty(point.qty)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span className="text-[var(--rc-text-muted)]">Nilai</span>
          <span className="rc-metric font-semibold text-[var(--rc-text)]">{formatRupiah(point.amount)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span className="text-[var(--rc-text-muted)]">Dokumen</span>
          <span className="rc-metric font-semibold text-[var(--rc-text)]">{formatCount(point.docs)}</span>
        </p>
      </div>
    </div>
  )
}

function ReturnBlockSection({
  eyebrow,
  accent,
  block,
  loading,
}: {
  eyebrow: string
  /** Kelas warna eyebrow/bar — beda tipis antar dua blok (token forest yang sudah ada). */
  accent: 'premium' | 'accent'
  block: ReturnBlock | undefined
  loading: boolean
}) {
  const accentText = accent === 'premium' ? 'text-[var(--rc-forest-premium)]' : 'text-[var(--rc-forest-accent)]'
  const accentBar = accent === 'premium' ? 'bg-[var(--rc-forest-premium)]' : 'bg-[var(--rc-forest-accent)]'
  const barFill = accent === 'premium' ? 'var(--rc-forest-premium)' : 'var(--rc-forest-accent)'

  const points = useMemo<TrendPoint[]>(
    () => (block?.trend ?? []).map((t) => ({ period: t.period, label: periodLabel(t.period), qty: t.qty, amount: t.amount, docs: t.docs })),
    [block?.trend],
  )
  const top = useMemo(() => block?.top ?? [], [block?.top])
  const kpis = block?.kpis
  const maxTopAmount = useMemo(() => top.reduce((m, r) => Math.max(m, r.amount), 0), [top])

  return (
    <div className="rounded-2xl border-[var(--rc-forest-border)] bg-white/[0.02] p-3">
      <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${accentText}`}>{eyebrow}</p>

      {block && !block.available ? (
        <div className="mt-3 grid min-h-[180px] place-items-center rounded-2xl bg-white/[0.04] px-4 py-6">
          <p className="text-center text-xs leading-5 text-[var(--rc-text-faint)]">
            {block.note ?? 'Sumber data blok ini belum tersedia.'}
          </p>
        </div>
      ) : (
        <>
          {/* KPI ringkas */}
          <div className="mt-3 grid-cols-2 gap-2">
            {[
              { label: 'Qty return', value: kpis ? formatQty(kpis.qty) : '—' },
              { label: 'Nilai', value: kpis ? formatRupiah(kpis.amount) : '—' },
              { label: 'Dokumen', value: kpis ? formatCount(kpis.docs) : '—' },
              { label: 'Item', value: kpis ? formatCount(kpis.itemCount) : '—' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">{kpi.label}</p>
                <p className="rc-metric mt-1 text-sm font-black text-[var(--rc-text)]">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Mini tren qty per bulan */}
          <div className="mt-3">
            {loading && points.length === 0 ? (
              <div className="grid h-[140px] place-items-center rounded-2xl bg-white/[0.04]">
                <p className="text-xs text-[var(--rc-text-faint)]">Memuat tren return…</p>
              </div>
            ) : points.length === 0 ? (
              <div className="grid h-[140px] place-items-center rounded-2xl bg-white/[0.04]">
                <p className="text-xs text-[var(--rc-text-faint)]">Belum ada return pada scope ini.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#8fa89c', fontSize: 10, fontWeight: 700 }} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} tickLine={false} minTickGap={16} />
                  <YAxis tick={{ fill: '#8fa89c', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(Number(v))} width={40} />
                  <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="qty" fill={barFill} maxBarSize={26} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top item return */}
          <div className="mt-3">
            <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${accentText}`}>Top item</p>
            <ScrollArea thin className="mt-2 max-h-[200px]">
              {top.length === 0 ? (
                <p className="px-1 py-3 text-xs text-[var(--rc-text-faint)]">
                  {loading ? 'Memuat top item…' : 'Tidak ada item return pada rentang ini.'}
                </p>
              ) : (
                <ul className="space-y-2 pr-2">
                  {top.map((row) => (
                    <li
                      key={row.code}
                      className="rounded-2xl border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-2"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-xs font-black text-[var(--rc-text)]">{row.name}</span>
                        <span className="rc-metric text-xs font-semibold text-[var(--rc-forest-premium)]">{formatRupiah(row.amount)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-[var(--rc-text-faint)]">
                        <span className="rc-data">{row.code}</span>
                        <span className="rc-data text-[var(--rc-text-muted)]">{formatQty(row.qty)}</span>
                      </span>
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                        <span
                          className={`block h-full rounded-full ${accentBar}`}
                          style={{ width: `${maxTopAmount > 0 ? Math.max(4, (row.amount / maxTopAmount) * 100) : 0}%` }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * ReturnAnalysisPanel — dua domain return berdampingan:
 * purchasing (retur ke supplier, PU_GOODSRET) vs inventory (return ke gudang,
 * IN_STOCKRTN). Fetch sendiri ke endpoint return-analysis, mengikuti filter
 * global inventory (source/months/itemType/location).
 */
export default function ReturnAnalysisPanel({ filters }: { filters: ProductTypeFilters }) {
  const [purchasing, setPurchasing] = useState<ReturnBlock | null>(null)
  const [inventory, setInventory] = useState<ReturnBlock | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [topN, setTopN] = useState(10)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const params = new URLSearchParams({
      source: filters.source,
      months: String(filters.months),
      top: String(topN),
    })
    if (filters.itemType) params.set('itemType', filters.itemType)
    if (filters.location) params.set('location', filters.location)

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/reports/inventory/return-analysis?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { 'x-sql-gateway-base': gatewayBase() },
        })
        const result = (await response.json()) as ReturnAnalysisResponse
        if (!response.ok || !result.success) throw new Error(result.error ?? 'Gagal memuat analisis return.')
        if (active) {
          setPurchasing(result.purchasing ?? null)
          setInventory(result.inventory ?? null)
        }
      } catch (err) {
        if (!active || controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Gagal memuat analisis return.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void Promise.resolve().then(load)
    return () => {
      active = false
      controller.abort()
    }
  }, [filters.source, filters.months, filters.itemType, filters.location, topN])

  const totalAmount = (purchasing?.kpis?.amount ?? 0) + (inventory?.kpis?.amount ?? 0)
  const totalDocs = (purchasing?.kpis?.docs ?? 0) + (inventory?.kpis?.docs ?? 0)

  const subtitle = error
    ? 'Gagal memuat analisis return.'
    : totalDocs > 0
      ? `Gabungan ${formatRupiah(totalAmount)} · ${formatCount(totalDocs)} dokumen return`
      : 'Perbandingan retur ke supplier vs return ke gudang pada rentang periode.'

  return (
    <div className="rounded-[26px] border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.66)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <MicroReportHeader
            ticker="Analisis return"
            title="Return: purchasing vs inventory"
            subtitle={subtitle}
            accent="forest"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <TopNSelect value={topN} onChange={setTopN} ariaLabel="Jumlah top item return" />
          <RotateCcw size={20} className="text-[var(--rc-forest-accent)]" />
        </div>
      </div>

      {error ? (
        <div className="mt-4 grid h-[120px] place-items-center rounded-2xl bg-white/[0.04]">
          <p className="px-3 text-center text-sm text-[var(--rc-danger)]">{error}</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ReturnBlockSection
            eyebrow="Purchasing · retur ke supplier"
            accent="premium"
            block={purchasing ?? undefined}
            loading={loading}
          />
          <ReturnBlockSection
            eyebrow="Inventory · return ke gudang"
            accent="accent"
            block={inventory ?? undefined}
            loading={loading}
          />
        </div>
      )}
    </div>
  )
}
