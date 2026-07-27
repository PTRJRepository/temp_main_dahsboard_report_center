'use client'

import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts'
import { LayoutGrid } from 'lucide-react'
import MicroReportHeader from './MicroReportHeader'
import type { ProductTypeFilters } from './ProductTypeAnalysisPanel'

type ProductTypeKpiRow = {
  code: string
  name: string
  itemCount: number
  valuasi: number
  issueQty: number
  issueAmount: number
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

type TreemapNode = {
  name: string
  code: string
  size: number
  valuasi: number
  share: number
  itemCount: number
  issueAmount: number
  fastCount: number
  movingCount: number
  slowCount: number
  deadCount: number
  /** Kotak gabungan "Lainnya" — tidak bisa di-drilldown. */
  isOther?: boolean
}

/** Batasi jumlah kotak agar tetap terbaca; sisanya digabung jadi "Lainnya". */
const MAX_TILES = 24

function formatRupiah(value: number) {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`
  if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`
  return `Rp ${value.toLocaleString('id-ID')}`
}

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} M`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} jt`
  return String(Math.round(value))
}

function gatewayBase() {
  if (typeof window === 'undefined') return 'http://10.0.0.110:8001'
  return window.localStorage.getItem('report-center:sql-gateway-base') || 'http://10.0.0.110:8001'
}

/** Skala hijau forest berdasarkan konsentrasi (0..1) — gaya heatmap saham. */
function tileFill(share: number, isOther?: boolean) {
  if (isOther) return 'rgba(120,144,132,.28)'
  const t = Math.max(0, Math.min(1, share / 100))
  // share terbesar → aksen terang (#18b96b); makin kecil makin gelap memudar.
  const light = [36, 209, 128]
  const dark = [10, 46, 28]
  const mix = (i: number) => Math.round(dark[i] + (light[i] - dark[i]) * Math.pow(t, 0.6))
  return `rgb(${mix(0)},${mix(1)},${mix(2)})`
}

function TileContent(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: TreemapNode
  onSelect?: (code: string) => void
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload, onSelect } = props
  if (!payload || width <= 0 || height <= 0) return null
  const pad = 2
  const rx = x + pad
  const ry = y + pad
  const rw = Math.max(0, width - pad * 2)
  const rh = Math.max(0, height - pad * 2)
  const showName = rw > 64 && rh > 34
  const showValue = rw > 78 && rh > 52
  return (
    <g
      onClick={() => !payload.isOther && onSelect?.(payload.code)}
      style={{ cursor: payload.isOther ? 'default' : 'pointer' }}
    >
      <rect
        x={rx}
        y={ry}
        width={rw}
        height={rh}
        rx={8}
        fill={tileFill(payload.share, payload.isOther)}
        stroke="rgba(3,14,10,.55)"
        strokeWidth={1.5}
      />
      {showName ? (
        <text x={rx + 8} y={ry + 18} fill="#eafff2" fontSize={11} fontWeight={800}>
          {payload.name.length > rw / 7 ? `${payload.name.slice(0, Math.max(3, Math.floor(rw / 7)))}…` : payload.name}
        </text>
      ) : null}
      {showValue ? (
        <>
          <text x={rx + 8} y={ry + 34} fill="#bdf3d4" fontSize={11} fontWeight={700}>
            {formatCompact(payload.valuasi)}
          </text>
          <text x={rx + 8} y={ry + 48} fill="rgba(234,255,242,.72)" fontSize={10} fontWeight={700}>
            {payload.share.toFixed(1)}%
          </text>
        </>
      ) : null}
    </g>
  )
}

function RichTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TreemapNode }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="max-w-[240px] rounded-xl border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.95)] px-3 py-2 text-xs shadow-xl">
      <p className="font-black text-[var(--rc-text)]">{d.name}</p>
      <p className="mt-1 rc-metric text-sm font-semibold text-[var(--rc-forest-premium)]">{formatRupiah(d.valuasi)}</p>
      <p className="mt-0.5 font-semibold text-[var(--rc-forest-accent)]">{d.share.toFixed(1)}% dari total valuasi</p>
      <div className="mt-1.5 space-y-0.5 text-[11px] text-[var(--rc-text-muted)]">
        <p>{d.itemCount} item · Issue {formatRupiah(d.issueAmount)}</p>
        <p className="rc-data">
          Fast {d.fastCount} · Moving {d.movingCount} · Slow {d.slowCount} · Dead {d.deadCount}
        </p>
      </div>
      {!d.isOther ? <p className="mt-1.5 text-[10px] font-semibold text-[var(--rc-text-faint)]">Klik untuk drilldown KPI</p> : null}
    </div>
  )
}

/**
 * ValuationTreemap — distribusi valuasi stok per Product Type (gaya heatmap saham).
 * Luas kotak = valuasi, warna = konsentrasi, klik kotak = drilldown KPI product type.
 * Data dari endpoint product-type-kpi (mode=list) — tanpa mengubah SQL/backend.
 */
export default function ValuationTreemap({
  filters,
  onDrilldown,
}: {
  filters: ProductTypeFilters
  onDrilldown: (code: string) => void
}) {
  const [rows, setRows] = useState<ProductTypeKpiRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        if (!response.ok || !result.success) throw new Error(result.error ?? 'Gagal memuat valuasi.')
        if (active) setRows(result.rows ?? [])
      } catch (err) {
        if (!active || controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Gagal memuat valuasi.')
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

  const nodes = useMemo<TreemapNode[]>(() => {
    const valid = rows.filter((r) => Number(r.valuasi) > 0)
    const total = valid.reduce((sum, r) => sum + Number(r.valuasi), 0)
    if (total <= 0) return []
    const sorted = [...valid].sort((a, b) => Number(b.valuasi) - Number(a.valuasi))
    const top = sorted.slice(0, MAX_TILES)
    const rest = sorted.slice(MAX_TILES)
    const toNode = (r: ProductTypeKpiRow): TreemapNode => ({
      name: r.name || r.code,
      code: r.code,
      size: Number(r.valuasi),
      valuasi: Number(r.valuasi),
      share: (Number(r.valuasi) / total) * 100,
      itemCount: r.itemCount,
      issueAmount: Number(r.issueAmount),
      fastCount: r.fastCount,
      movingCount: r.movingCount,
      slowCount: r.slowCount,
      deadCount: r.deadCount,
    })
    const list = top.map(toNode)
    if (rest.length > 0) {
      const restVal = rest.reduce((sum, r) => sum + Number(r.valuasi), 0)
      list.push({
        name: `Lainnya (${rest.length})`,
        code: '__other__',
        size: restVal,
        valuasi: restVal,
        share: (restVal / total) * 100,
        itemCount: rest.reduce((s, r) => s + r.itemCount, 0),
        issueAmount: rest.reduce((s, r) => s + Number(r.issueAmount), 0),
        fastCount: rest.reduce((s, r) => s + r.fastCount, 0),
        movingCount: rest.reduce((s, r) => s + r.movingCount, 0),
        slowCount: rest.reduce((s, r) => s + r.slowCount, 0),
        deadCount: rest.reduce((s, r) => s + r.deadCount, 0),
        isOther: true,
      })
    }
    return list
  }, [rows])

  const totalValuasi = useMemo(() => nodes.reduce((sum, n) => sum + n.valuasi, 0), [nodes])
  const empty = !loading && !error && nodes.length === 0

  return (
    <div className="rounded-[26px] border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.66)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <MicroReportHeader
            ticker="Distribusi valuasi"
            title="Peta valuasi per product type"
            subtitle={`Luas kotak = valuasi · warna = konsentrasi · total ${formatRupiah(totalValuasi)}`}
            accent="forest"
          />
        </div>
        <LayoutGrid size={20} className="text-[var(--rc-forest-accent)]" />
      </div>

      <div className="mt-4">
        {loading && nodes.length === 0 ? (
          <div className="grid h-[340px] place-items-center rounded-2xl bg-white/[0.04]">
            <p className="text-sm text-[var(--rc-text-faint)]">Memuat peta valuasi…</p>
          </div>
        ) : error ? (
          <div className="grid h-[340px] place-items-center rounded-2xl bg-white/[0.04]">
            <p className="text-sm text-[var(--rc-danger)]">{error}</p>
          </div>
        ) : empty ? (
          <div className="grid h-[340px] place-items-center rounded-2xl bg-white/[0.04]">
            <p className="text-sm text-[var(--rc-text-faint)]">Belum ada valuasi pada scope ini.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <Treemap
              data={nodes}
              dataKey="size"
              nameKey="name"
              isAnimationActive
              animationDuration={500}
              content={<TileContent onSelect={onDrilldown} />}
            >
              <Tooltip content={<RichTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-2 text-center text-[10px] font-semibold text-[var(--rc-text-muted)]">
        Klik kotak untuk membuka seluruh KPI product type
      </p>
    </div>
  )
}
