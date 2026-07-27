'use client'

import { useEffect, useMemo, useState } from 'react'
import { Fuel } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import MicroReportHeader from './MicroReportHeader'
import ScrollArea from './ScrollArea'
import TopNSelect from './TopNSelect'
import type { ProductTypeFilters } from './ProductTypeAnalysisPanel'

type FuelKpis = { qty: number; amount: number; docs: number; itemCount: number }
type FuelTrendRow = { period: string; qty: number; amount: number; docs: number }
type FuelTopRow = { code: string; name: string; qty: number; amount: number }
type FuelProductTypeRow = {
  code: string
  name: string
  qty: number
  amount: number
  docs: number
  itemCount: number
  pctAmount: number
}

type FuelUsageResponse = {
  success: boolean
  periods?: string[]
  kpis?: FuelKpis
  trend?: FuelTrendRow[]
  top?: FuelTopRow[]
  byProductType?: FuelProductTypeRow[]
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

function formatLiter(value: number) {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} jt L`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)} rb L`
  return `${value.toLocaleString('id-ID')} L`
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
          <span className="rc-metric font-semibold text-[var(--rc-text)]">{formatLiter(point.qty)}</span>
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

/**
 * FuelUsagePanel — pemakaian BBM (solar) dari IN_FUELISSUE/LN.
 * KPI ringkas + tren qty per bulan + top konsumen per item.
 * Fetch sendiri ke endpoint fuel-usage, mengikuti filter global inventory.
 */
export default function FuelUsagePanel({ filters }: { filters: ProductTypeFilters }) {
  const [kpis, setKpis] = useState<FuelKpis | null>(null)
  const [trend, setTrend] = useState<FuelTrendRow[]>([])
  const [top, setTop] = useState<FuelTopRow[]>([])
  const [byProductType, setByProductType] = useState<FuelProductTypeRow[]>([])
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
        const response = await fetch(`/api/reports/inventory/fuel-usage?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { 'x-sql-gateway-base': gatewayBase() },
        })
        const result = (await response.json()) as FuelUsageResponse
        if (!response.ok || !result.success) throw new Error(result.error ?? 'Gagal memuat fuel usage.')
        if (active) {
          setKpis(result.kpis ?? { qty: 0, amount: 0, docs: 0, itemCount: 0 })
          setTrend(result.trend ?? [])
          setTop(result.top ?? [])
          setByProductType(result.byProductType ?? [])
        }
      } catch (err) {
        if (!active || controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Gagal memuat fuel usage.')
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

  const points = useMemo<TrendPoint[]>(
    () => trend.map((t) => ({ period: t.period, label: periodLabel(t.period), qty: t.qty, amount: t.amount, docs: t.docs })),
    [trend],
  )

  const maxTopAmount = useMemo(() => top.reduce((m, r) => Math.max(m, r.amount), 0), [top])
  const maxPtAmount = useMemo(() => byProductType.reduce((m, r) => Math.max(m, r.amount), 0), [byProductType])

  const subtitle =
    kpis && (kpis.qty > 0 || kpis.amount > 0)
      ? `${formatLiter(kpis.qty)} · ${formatRupiah(kpis.amount)} · ${formatCount(kpis.docs)} dokumen`
      : 'Total pemakaian BBM pada rentang periode.'

  const empty = !loading && !error && top.length === 0 && byProductType.length === 0 && points.every((p) => p.qty === 0 && p.amount === 0)

  return (
    <div className="rounded-[26px] border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.66)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <MicroReportHeader
            ticker="Fuel usage"
            title="Pemakaian BBM (solar)"
            subtitle={subtitle}
            accent="forest"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <TopNSelect value={topN} onChange={setTopN} ariaLabel="Jumlah top item fuel" />
          <Fuel size={20} className="text-[var(--rc-forest-accent)]" />
        </div>
      </div>

      {/* KPI ringkas */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Total liter', value: kpis ? formatLiter(kpis.qty) : '—' },
          { label: 'Total nilai', value: kpis ? formatRupiah(kpis.amount) : '—' },
          { label: 'Dokumen', value: kpis ? formatCount(kpis.docs) : '—' },
          { label: 'Item fuel', value: kpis ? formatCount(kpis.itemCount) : '—' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-2.5">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">{kpi.label}</p>
            <p className="rc-metric mt-1 text-sm font-black text-[var(--rc-text)]">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tren qty per bulan */}
      <div className="mt-4">
        {loading && points.length === 0 ? (
          <div className="grid h-[180px] place-items-center rounded-2xl bg-white/[0.04]">
            <p className="text-sm text-[var(--rc-text-faint)]">Memuat tren pemakaian BBM…</p>
          </div>
        ) : error ? (
          <div className="grid h-[180px] place-items-center rounded-2xl bg-white/[0.04]">
            <p className="px-3 text-center text-sm text-[var(--rc-danger)]">{error}</p>
          </div>
        ) : empty ? (
          <div className="grid h-[180px] place-items-center rounded-2xl bg-white/[0.04]">
            <p className="text-sm text-[var(--rc-text-faint)]">Belum ada pemakaian BBM pada scope ini.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#8fa89c', fontSize: 10, fontWeight: 700 }} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} tickLine={false} minTickGap={16} />
              <YAxis tick={{ fill: '#8fa89c', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(Number(v))} width={44} />
              <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Bar dataKey="qty" fill="var(--rc-forest-accent)" maxBarSize={30} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Breakdown charge per Product Type */}
      <div className="mt-4">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--rc-forest-accent)]">
          Charge by Product Type
        </p>
        <p className="mt-1 text-[11px] text-[var(--rc-text-faint)]">
          Fuel issue dikelompokkan lewat IN_ITEM.ProdTypeCode (bukan charge Blk/Veh).
        </p>
        <ScrollArea thin className="mt-2 max-h-[240px]">
          {byProductType.length === 0 ? (
            <p className="px-1 py-4 text-sm text-[var(--rc-text-faint)]">
              {loading ? 'Memuat product type…' : 'Tidak ada product type fuel pada rentang ini.'}
            </p>
          ) : (
            <ul className="space-y-2 pr-2">
              {byProductType.map((row) => (
                <li
                  key={row.code}
                  className="rounded-2xl border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-2.5"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-black text-[var(--rc-text)]">{row.name}</span>
                    <span className="rc-metric text-sm font-semibold text-[var(--rc-forest-premium)]">{formatRupiah(row.amount)}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--rc-text-faint)]">
                    <span className="rc-data">{row.code}</span>
                    <span className="rc-data text-[var(--rc-text-muted)]">
                      {formatLiter(row.qty)} · {formatCount(row.docs)} dok · {formatCount(row.itemCount)} item · {row.pctAmount.toFixed(1)}%
                    </span>
                  </span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-[var(--rc-forest-accent)]"
                      style={{ width: `${maxPtAmount > 0 ? Math.max(4, (row.amount / maxPtAmount) * 100) : 0}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>

      {/* Top konsumen per item */}
      <div className="mt-4">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--rc-forest-accent)]">Top konsumen (item)</p>
        <ScrollArea thin className="mt-2 max-h-[220px]">
          {top.length === 0 ? (
            <p className="px-1 py-4 text-sm text-[var(--rc-text-faint)]">
              {loading ? 'Memuat top konsumen…' : 'Tidak ada item fuel pada rentang ini.'}
            </p>
          ) : (
            <ul className="space-y-2 pr-2">
              {top.map((row) => (
                <li
                  key={row.code}
                  className="rounded-2xl border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-2.5"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-black text-[var(--rc-text)]">{row.name}</span>
                    <span className="rc-metric text-sm font-semibold text-[var(--rc-forest-premium)]">{formatRupiah(row.amount)}</span>
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[var(--rc-text-faint)]">
                    <span className="rc-data">{row.code}</span>
                    <span className="rc-data text-[var(--rc-text-muted)]">{formatLiter(row.qty)}</span>
                  </span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-[var(--rc-forest-accent)]"
                      style={{ width: `${maxTopAmount > 0 ? Math.max(4, (row.amount / maxTopAmount) * 100) : 0}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
