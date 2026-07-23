'use client'

import { useEffect, useMemo, useState } from 'react'
import MovementMatrix from './MovementMatrix'
import ChargeBreakdown from './ChargeBreakdown'
import MovementTable from './MovementTable'
import ItemDrilldown from './ItemDrilldown'

/**
 * MovementAnalytics — pembungkus section analisis movement.
 * Satu fetch matriks (lazy, `active`) dipakai bersama oleh:
 *   - MovementMatrix (heatmap barang × periode)
 *   - MovementTable (tabel per barang + sparkline pola)
 *   - ItemDrilldown (pop-up analisis satu barang)
 * ChargeBreakdown memakai topLists + split monthly yang sudah ada (tanpa fetch baru).
 *
 * Menjaga strip tetap ramping: state metric + drillItem + data matriks ada di sini.
 * Calm-minimal; hirarki: header ringkas → grid [matriks | charge] → tabel.
 */

type TopListItem = {
  code?: string
  name?: string
  events?: number
  qty?: number
  amount?: number
}

type ApiMatrixRow = {
  code: string
  name: string
  cells: { qty: number[]; amount: number[]; docs: number[] }
}

type ApiMatrixResponse = {
  success: boolean
  periods: string[]
  rows: ApiMatrixRow[]
  currentPeriod: string
  error?: string
}

type MovementAnalyticsProps = {
  source: 'estate' | 'pabrik'
  itemType?: string
  active?: boolean
  months?: number
  top?: number
  costCenters?: TopListItem[]
  vehicles?: TopListItem[]
  stationQty?: number
  ledgerQty?: number
  vehicleQty?: number
  /** Fokus deck ke (barang, periode) saat sel matriks diklik. */
  onFocusPeriod?: (period: string) => void
  /** Buka report detail issue untuk barang (dari drill-down). */
  onOpenDetail?: (item: { code: string; name: string }) => void
}

export default function MovementAnalytics({
  source,
  itemType = '',
  active = true,
  months = 12,
  top = 12,
  costCenters,
  vehicles,
  stationQty = 0,
  ledgerQty = 0,
  vehicleQty = 0,
  onFocusPeriod,
  onOpenDetail,
}: MovementAnalyticsProps) {
  const [metric, setMetric] = useState<'qty' | 'amount'>('amount')
  const [data, setData] = useState<ApiMatrixResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [drillItem, setDrillItem] = useState<{ code: string; name: string } | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const params = new URLSearchParams({ source, months: String(months), top: String(top) })
    if (itemType) params.set('itemType', itemType)
    queueMicrotask(() => {
      if (!cancelled) setLoading(true)
    })
    fetch(`/api/reports/inventory/movement-matrix?${params.toString()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json: ApiMatrixResponse) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) setData({ success: false, periods: [], rows: [], currentPeriod: '', error: 'Gagal memuat matriks' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [active, source, months, top, itemType])

  const periods = data?.periods ?? []
  const matrixRows = useMemo(() => data?.rows ?? [], [data])

  // Baris tabel: dari matriks (punya series pola) — paling informatif.
  const tableRows = useMemo(
    () =>
      matrixRows.map((row) => ({
        code: row.code,
        name: row.name,
        qty: row.cells.qty.reduce((a, b) => a + b, 0),
        amount: row.cells.amount.reduce((a, b) => a + b, 0),
        docs: row.cells.docs.reduce((a, b) => a + b, 0),
        series: metric === 'qty' ? row.cells.qty : row.cells.amount,
      })),
    [matrixRows, metric],
  )

  const drillRow = drillItem ? matrixRows.find((r) => r.code === drillItem.code) : undefined

  return (
    <div className="space-y-3">
      {/* Grid: matriks (lebar) + charge (sempit) */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="h-[340px]">
          <MovementMatrix
            source={source}
            months={months}
            top={top}
            itemType={itemType}
            active={active}
            metric={metric}
            onMetricChange={setMetric}
            onSelect={(item, period) => {
              onFocusPeriod?.(period)
              setDrillItem(item)
            }}
            onDrilldown={(item) => setDrillItem(item)}
          />
        </div>
        <div className="h-[340px]">
          <ChargeBreakdown
            costCenters={costCenters}
            vehicles={vehicles}
            stationQty={stationQty}
            ledgerQty={ledgerQty}
            vehicleQty={vehicleQty}
            metric={metric}
          />
        </div>
      </div>

      {/* Tabel analisis per barang */}
      <div className="h-[300px]">
        <MovementTable
          rows={tableRows}
          metric={metric}
          onMetricChange={setMetric}
          onDrilldown={(item) => setDrillItem(item)}
          loading={loading && !data}
          periodCount={periods.length}
        />
      </div>

      {/* Pop-up drill-down satu barang */}
      <ItemDrilldown
        item={drillItem}
        periods={periods}
        qtySeries={drillRow?.cells.qty ?? []}
        amountSeries={drillRow?.cells.amount ?? []}
        docsSeries={drillRow?.cells.docs ?? []}
        metric={metric}
        onClose={() => setDrillItem(null)}
        onOpenDetail={onOpenDetail}
      />
    </div>
  )
}
