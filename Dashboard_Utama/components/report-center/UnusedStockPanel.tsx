'use client'

import { useEffect, useMemo, useState } from 'react'
import { PackageX } from 'lucide-react'
import MicroReportHeader from './MicroReportHeader'
import ScrollArea from './ScrollArea'
import TopNSelect from './TopNSelect'
import type { ProductTypeFilters } from './ProductTypeAnalysisPanel'

type UnusedKpis = { itemCount: number; qty: number; valuasi: number }
type UnusedProductTypeRow = {
  code: string
  name: string
  itemCount: number
  qty: number
  valuasi: number
  pctValuasi: number
}
type UnusedTopRow = {
  code: string
  name: string
  productType: string
  qty: number
  valuasi: number
}

type UnusedStockResponse = {
  success: boolean
  months?: number
  dateFrom?: string
  kpis?: UnusedKpis
  byProductType?: UnusedProductTypeRow[]
  top?: UnusedTopRow[]
  error?: string
}

function formatRupiah(value: number) {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`
  if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`
  return `Rp ${value.toLocaleString('id-ID')}`
}

function formatCount(value: number) {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('id-ID')
}

function formatQty(value: number) {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} jt`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)} rb`
  return value.toLocaleString('id-ID')
}

function gatewayBase() {
  if (typeof window === 'undefined') return 'http://10.0.0.110:8001'
  return window.localStorage.getItem('report-center:sql-gateway-base') || 'http://10.0.0.110:8001'
}

/**
 * UnusedStockPanel — analisis barang TIDAK JADI DIGUNAKAN dari inventory stock.
 * Definisi: item live (Status='1') dengan stok fisik > 0, TAPI tanpa SATU PUN
 * dokumen issue (IN_STOCKISSUE + IN_FUELISSUE + WS_JOBSTOCK TT=1) dalam window.
 * Valuasi = (QtyOnHand + QtyOnHold) × AverageCost — selaras Total Valuasi,
 * BUKAN Total Issue (lihat glosarium lib/reports/inventory/metric-glossary.ts).
 * Fetch sendiri ke endpoint unused-stock, mengikuti filter global inventory.
 */
export default function UnusedStockPanel({ filters }: { filters: ProductTypeFilters }) {
  const [kpis, setKpis] = useState<UnusedKpis | null>(null)
  const [byProductType, setByProductType] = useState<UnusedProductTypeRow[]>([])
  const [top, setTop] = useState<UnusedTopRow[]>([])
  const [dateFrom, setDateFrom] = useState<string | null>(null)
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
        const response = await fetch(`/api/reports/inventory/unused-stock?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { 'x-sql-gateway-base': gatewayBase() },
        })
        const result = (await response.json()) as UnusedStockResponse
        if (!response.ok || !result.success) throw new Error(result.error ?? 'Gagal memuat unused stock.')
        if (active) {
          setKpis(result.kpis ?? { itemCount: 0, qty: 0, valuasi: 0 })
          setByProductType(result.byProductType ?? [])
          setTop(result.top ?? [])
          setDateFrom(result.dateFrom ?? null)
        }
      } catch (err) {
        if (!active || controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Gagal memuat unused stock.')
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

  const maxPtValuasi = useMemo(() => byProductType.reduce((m, r) => Math.max(m, r.valuasi), 0), [byProductType])
  const maxTopValuasi = useMemo(() => top.reduce((m, r) => Math.max(m, r.valuasi), 0), [top])

  const subtitle =
    kpis && kpis.itemCount > 0
      ? `${formatCount(kpis.itemCount)} item · ${formatRupiah(kpis.valuasi)} tanpa issue sejak ${dateFrom ?? '…'}`
      : 'Item berstok tanpa satu pun dokumen issue pada window analisis.'

  const empty = !loading && !error && byProductType.length === 0 && top.length === 0 && (kpis?.itemCount ?? 0) === 0

  return (
    <div className="rounded-[26px] border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.66)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <MicroReportHeader
            ticker="Unused stock"
            title="Barang tidak terpakai"
            subtitle={subtitle}
            accent="forest"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--rc-text-faint)]">
            Stok fisik &gt; 0 tanpa issue (IN_STOCKISSUE + IN_FUELISSUE + WS_JOBSTOCK) pada window. Valuasi = (OnHand +
            OnHold) × AverageCost — selaras Total Valuasi, bukan Total Issue.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <TopNSelect value={topN} onChange={setTopN} ariaLabel="Jumlah top item tidak terpakai" />
          <PackageX size={20} className="text-[var(--rc-forest-accent)]" />
        </div>
      </div>

      {/* KPI ringkas */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: 'Item tidak terpakai', value: kpis ? formatCount(kpis.itemCount) : '—' },
          { label: 'Qty fisik', value: kpis ? formatQty(kpis.qty) : '—' },
          { label: 'Valuasi mengendap', value: kpis ? formatRupiah(kpis.valuasi) : '—' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-2.5">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">{kpi.label}</p>
            <p className="rc-metric mt-1 text-sm font-black text-[var(--rc-text)]">{kpi.value}</p>
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-4 grid h-[120px] place-items-center rounded-2xl bg-white/[0.04]">
          <p className="px-3 text-center text-sm text-[var(--rc-danger)]">{error}</p>
        </div>
      ) : empty ? (
        <div className="mt-4 grid h-[120px] place-items-center rounded-2xl bg-white/[0.04]">
          <p className="text-sm text-[var(--rc-text-faint)]">
            {loading ? 'Memuat analisis…' : 'Semua item berstok punya issue pada window ini — tidak ada barang mengendap.'}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Breakdown per product type */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--rc-forest-accent)]">
              Per Product Type
            </p>
            <ScrollArea thin className="mt-2 max-h-[260px]">
              {byProductType.length === 0 ? (
                <p className="px-1 py-4 text-sm text-[var(--rc-text-faint)]">
                  {loading ? 'Memuat product type…' : 'Tidak ada data.'}
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
                        <span className="rc-metric text-sm font-semibold text-[var(--rc-forest-premium)]">
                          {formatRupiah(row.valuasi)}
                        </span>
                      </span>
                      <span className="mt-1 flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--rc-text-faint)]">
                        <span className="rc-data">{row.code}</span>
                        <span className="rc-data text-[var(--rc-text-muted)]">
                          {formatCount(row.itemCount)} item · {formatQty(row.qty)} · {row.pctValuasi.toFixed(1)}%
                        </span>
                      </span>
                      <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                        <span
                          className="block h-full rounded-full bg-[var(--rc-forest-accent)]"
                          style={{ width: `${maxPtValuasi > 0 ? Math.max(4, (row.valuasi / maxPtValuasi) * 100) : 0}%` }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          {/* Top item terbesar menurut valuasi */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--rc-forest-accent)]">
              Top item (valuasi)
            </p>
            <ScrollArea thin className="mt-2 max-h-[260px]">
              {top.length === 0 ? (
                <p className="px-1 py-4 text-sm text-[var(--rc-text-faint)]">
                  {loading ? 'Memuat top item…' : 'Tidak ada item.'}
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
                        <span className="rc-metric text-sm font-semibold text-[var(--rc-forest-premium)]">
                          {formatRupiah(row.valuasi)}
                        </span>
                      </span>
                      <span className="mt-1 flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--rc-text-faint)]">
                        <span className="rc-data">{row.code}</span>
                        <span className="truncate rc-data text-[var(--rc-text-muted)]">
                          {row.productType} · {formatQty(row.qty)}
                        </span>
                      </span>
                      <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                        <span
                          className="block h-full rounded-full bg-[var(--rc-forest-accent)]"
                          style={{ width: `${maxTopValuasi > 0 ? Math.max(4, (row.valuasi / maxTopValuasi) * 100) : 0}%` }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  )
}
