'use client'

import { useEffect, useState } from 'react'
import { Boxes, ChevronRight } from 'lucide-react'
import MicroReportHeader from './MicroReportHeader'
import ProductTypeFocusSelect from './ProductTypeFocusSelect'
import ScrollArea from './ScrollArea'
import TopNSelect from './TopNSelect'

type ReportSource = 'estate' | 'pabrik'

type ProductTypeKpiRow = {
  code: string
  name: string
  itemCount: number
  valuasi: number
  closing: number
  issueQty: number
  issueAmount: number
  gudangAmount: number
  fuelAmount: number
  workshopAmount: number
  fastCount: number
  movingCount: number
  slowCount: number
  deadCount: number
  lastMovement: string | null
}

type ListResponse = {
  success: boolean
  mode: 'list'
  rows: ProductTypeKpiRow[]
  error?: string
}

export type ProductTypeFilters = {
  source: ReportSource
  months: number
  itemType?: string
  location?: string
}

function formatRupiah(value: number) {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`
  if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`
  return `Rp ${value.toLocaleString('id-ID')}`
}

function gatewayBase() {
  if (typeof window === 'undefined') return 'http://10.0.0.110:8001'
  return window.localStorage.getItem('report-center:sql-gateway-base') || 'http://10.0.0.110:8001'
}

/** Ringkasan sumber issue padat: "G 60% · F 30% · W 10%" (Gudang/Fuel/Workshop). */
function sourceSummary(row: ProductTypeKpiRow): string {
  const total = row.gudangAmount + row.fuelAmount + row.workshopAmount
  if (!Number.isFinite(total) || total <= 0) return ''
  const pct = (v: number) => Math.round((v / total) * 100)
  return `G ${pct(row.gudangAmount)}% · F ${pct(row.fuelAmount)}% · W ${pct(row.workshopAmount)}%`
}

/**
 * Panel daftar product type (ringkas) di command deck inventory.
 * Klik satu type → `onDrilldown(code)` untuk membuka popup KPI lengkap.
 * Fetch sendiri ke endpoint product-type-kpi (mode list), mengikuti filter global.
 */
export default function ProductTypeAnalysisPanel({
  filters,
  onDrilldown,
}: {
  filters: ProductTypeFilters
  onDrilldown: (code: string) => void
}) {
  const [rows, setRows] = useState<ProductTypeKpiRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [topN, setTopN] = useState(12)
  const [focus, setFocus] = useState<string[]>([])

  // Fokus product type (client-side): tanpa pilihan → semua type tampil.
  const visibleRows = focus.length === 0 ? rows : rows.filter((row) => focus.includes(row.code))

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const params = new URLSearchParams({
      source: filters.source,
      months: String(filters.months),
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
        const result = (await response.json()) as ListResponse
        if (!response.ok || !result.success) throw new Error(result.error ?? 'Gagal memuat product type.')
        if (active) setRows(result.rows ?? [])
      } catch (err) {
        if (!active || controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Gagal memuat product type.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void Promise.resolve().then(load)
    return () => {
      active = false
      controller.abort()
    }
  }, [filters.source, filters.months, filters.itemType, filters.location])

  return (
    <div className="rounded-[26px] border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.66)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <MicroReportHeader
            ticker="Analisis per product type"
            title="Drill-down KPI product type"
            subtitle="Klik satu type untuk membuka seluruh KPI terkait."
            accent="forest"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ProductTypeFocusSelect
            options={rows.map((row) => ({ code: row.code, name: row.name }))}
            selected={focus}
            onChange={setFocus}
            disabled={rows.length === 0}
          />
          <TopNSelect value={topN} onChange={setTopN} ariaLabel="Jumlah product type ditampilkan" />
          <Boxes size={20} className="text-[var(--rc-forest-accent)]" />
        </div>
      </div>

      <ScrollArea className="mt-4 max-h-[420px]">
        {loading && rows.length === 0 ? (
          <p className="px-1 py-6 text-sm text-[var(--rc-text-faint)]">Memuat product type…</p>
        ) : error ? (
          <p className="px-1 py-6 text-sm text-[var(--rc-danger)]">{error}</p>
        ) : rows.length === 0 ? (
          <p className="px-1 py-6 text-sm text-[var(--rc-text-faint)]">Tidak ada product type pada rentang ini.</p>
        ) : visibleRows.length === 0 ? (
          <p className="px-1 py-6 text-sm text-[var(--rc-text-faint)]">
            Tidak ada product type yang cocok dengan fokus terpilih.{' '}
            <button
              type="button"
              onClick={() => setFocus([])}
              className="font-semibold text-[var(--rc-forest-accent)] underline-offset-2 hover:underline"
            >
              Reset fokus
            </button>
          </p>
        ) : (
          <ul className="space-y-2 pr-2">
            {visibleRows.slice(0, topN).map((row) => (
              <li key={row.code}>
                <button
                  type="button"
                  onClick={() => onDrilldown(row.code)}
                  className="rc-forest-focus group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-2.5 text-left transition hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.07]"
                >
                  <span className="min-w-0">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-black text-[var(--rc-text)]">{row.name}</span>
                      <span className="rc-metric text-sm font-semibold text-[var(--rc-forest-premium)]">{formatRupiah(row.valuasi)}</span>
                    </span>
                    <span className="mt-1 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--rc-text-faint)]">
                      <span className="rc-data">{row.itemCount} item</span>
                      <span>·</span>
                      <span>Closing <span className="rc-data text-[var(--rc-text-muted)]">{formatRupiah(row.closing)}</span></span>
                      <span>·</span>
                      <span>Issue <span className="rc-data text-[var(--rc-text-muted)]">{formatRupiah(row.issueAmount)}</span></span>
                      {sourceSummary(row) && (
                        <>
                          <span>·</span>
                          <span className="rc-data text-[var(--rc-forest-accent)]" title="Pemecah sumber: Gudang (IN_STOCKISSUE) · Fuel (IN_FUELISSUE) · Workshop (WS_JOBSTOCK)">
                            {sourceSummary(row)}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span className="rc-data">F{row.fastCount} M{row.movingCount} S{row.slowCount} D{row.deadCount}</span>
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-[var(--rc-text-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--rc-forest-accent)]" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  )
}
