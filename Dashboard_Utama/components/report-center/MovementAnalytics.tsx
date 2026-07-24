'use client'

import { useEffect, useMemo, useState } from 'react'
import MovementMatrix from './MovementMatrix'
import MovementTrend from './MovementTrend'
import ChargeBreakdown from './ChargeBreakdown'
import MovementTable from './MovementTable'
import FrequencyInsights from './FrequencyInsights'
import ItemDrilldown from './ItemDrilldown'
import MovementCategoryEvolution from './MovementCategoryEvolution'
import { buildCategoryEvolutionFromMatrix } from '@/lib/reports/movement-category-evolution'
import { MOVEMENT_CATEGORY_THRESHOLDS } from '@/lib/reports/movement-category'

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
  /** Bolehkan user menyetel rentang timeline (jumlah bulan lookback). */
  allowTimeline?: boolean
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

const TIMELINE_OPTIONS = [6, 12, 24, 60, 120] as const
const TIMELINE_CUSTOM_MIN_MONTHS = 3
const TIMELINE_CUSTOM_MAX_MONTHS = 120
/** Custom diisi dalam TAHUN — patokannya mundur dari periode berjalan (bulan ini). */
const TIMELINE_CUSTOM_MIN_YEARS = 1
const TIMELINE_CUSTOM_MAX_YEARS = TIMELINE_CUSTOM_MAX_MONTHS / 12

export default function MovementAnalytics({
  source,
  itemType = '',
  active = true,
  months = 12,
  top = 12,
  allowTimeline = false,
  costCenters,
  vehicles,
  stationQty = 0,
  ledgerQty = 0,
  vehicleQty = 0,
  onFocusPeriod,
  onOpenDetail,
}: MovementAnalyticsProps) {
  const [metric, setMetric] = useState<'qty' | 'amount' | 'freq'>('amount')
  const [evolutionMetric, setEvolutionMetric] = useState<'count' | 'qty' | 'amount'>('count')
  const [data, setData] = useState<ApiMatrixResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [drillItem, setDrillItem] = useState<{ code: string; name: string } | null>(null)
  const [timelineMonths, setTimelineMonths] = useState<number>(months)
  const [customYears, setCustomYears] = useState<string>('')

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const params = new URLSearchParams({ source, months: String(timelineMonths), top: String(top) })
    if (itemType) params.set('itemType', itemType)
    queueMicrotask(() => {
      if (!cancelled) setLoading(true)
    })
    fetch(`/api/reports/inventory/movement-matrix?${params.toString()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json: ApiMatrixResponse) => {
        if (cancelled) return
        // Keep prior matrix if response empty/failed — stops freq/trend charts from vanishing.
        if (json?.success === false || !Array.isArray(json?.periods) || json.periods.length === 0) {
          setData((prev) => prev ?? { success: false, periods: [], rows: [], currentPeriod: '', error: json?.error ?? 'Matriks kosong' })
          return
        }
        setData(json)
      })
      .catch(() => {
        if (cancelled) return
        setData((prev) => prev ?? { success: false, periods: [], rows: [], currentPeriod: '', error: 'Gagal memuat matriks' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [active, source, timelineMonths, top, itemType])

  const periods = data?.periods ?? []
  const matrixRows = useMemo(() => data?.rows ?? [], [data])

  const evolution = useMemo(
    () => buildCategoryEvolutionFromMatrix(matrixRows, data?.periods ?? [], MOVEMENT_CATEGORY_THRESHOLDS),
    [matrixRows, data],
  )

  // Baris tabel: dari matriks (punya series pola) — paling informatif.
  const tableRows = useMemo(
    () =>
      matrixRows.map((row) => ({
        code: row.code,
        name: row.name,
        qty: row.cells.qty.reduce((a, b) => a + b, 0),
        amount: row.cells.amount.reduce((a, b) => a + b, 0),
        docs: row.cells.docs.reduce((a, b) => a + b, 0),
        series: metric === 'qty' ? row.cells.qty : metric === 'freq' ? row.cells.docs : row.cells.amount,
        freqSeries: row.cells.docs,
      })),
    [matrixRows, metric],
  )

  const drillRow = drillItem ? matrixRows.find((r) => r.code === drillItem.code) : undefined

  return (
    <div className="space-y-3">
      {allowTimeline ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[20px] border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="rc-data text-[10px] uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Timeline</span>
            <div className="flex gap-1 rounded-full border-white/10 bg-white/[0.04] p-0.5" role="tablist" aria-label="Rentang timeline">
              {TIMELINE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={timelineMonths === option && customYears === ''}
                  onClick={() => {
                    setTimelineMonths(option)
                    setCustomYears('')
                  }}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    timelineMonths === option && customYears === '' ? 'bg-emerald-400/20 text-emerald-100' : 'text-[var(--rc-text-muted)] hover:bg-white/[0.06]'
                  }`}
                >
                  {option} bln
                </button>
              ))}
            </div>
          </div>
          <form
            className="flex flex-wrap items-center gap-1.5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              const parsed = Number(customYears)
              if (Number.isFinite(parsed) && parsed >= TIMELINE_CUSTOM_MIN_YEARS && parsed <= TIMELINE_CUSTOM_MAX_YEARS) {
                const monthsBack = Math.round(parsed * 12)
                setTimelineMonths(Math.min(TIMELINE_CUSTOM_MAX_MONTHS, Math.max(TIMELINE_CUSTOM_MIN_MONTHS, monthsBack)))
              }
            }}
          >
            <label htmlFor="rc-custom-years" className="text-[10px] uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">
              Tahun
            </label>
            <input
              id="rc-custom-years"
              type="number"
              min={TIMELINE_CUSTOM_MIN_YEARS}
              max={TIMELINE_CUSTOM_MAX_YEARS}
              value={customYears}
              onChange={(event) => setCustomYears(event.target.value)}
              placeholder={`${TIMELINE_CUSTOM_MIN_YEARS}–${TIMELINE_CUSTOM_MAX_YEARS}`}
              aria-label="Rentang tahun kustom (mundur dari sekarang)"
              className="rc-data h-7 w-14 rounded-lg border-white/10 bg-black/25 px-2 text-[11px] text-[var(--rc-text)] outline-none placeholder:text-[var(--rc-text-faint)] focus:border-emerald-300/40"
            />
            <button
              type="button"
              onClick={() => {
                const parsed = Number(customYears)
                if (Number.isFinite(parsed) && parsed >= TIMELINE_CUSTOM_MIN_YEARS && parsed <= TIMELINE_CUSTOM_MAX_YEARS) {
                  const monthsBack = Math.round(parsed * 12)
                  setTimelineMonths(Math.min(TIMELINE_CUSTOM_MAX_MONTHS, Math.max(TIMELINE_CUSTOM_MIN_MONTHS, monthsBack)))
                }
              }}
              className="rounded-lg border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-[var(--rc-text-muted)] transition hover:bg-white/[0.09] hover:text-[var(--rc-text)]"
            >
              Terapkan
            </button>
            <span className="rc-data text-[10px] text-[var(--rc-text-faint)]">
              {timelineMonths} bln ke belakang
              {periods.length > 0 ? ` · ${periods[0]} → ${periods[periods.length - 1]}` : ''}
            </span>
          </form>
          <p className="w-full text-[10px] leading-snug text-[var(--rc-text-faint)]">
            Periode movement = <span className="font-semibold text-[var(--rc-text-muted)]">{timelineMonths} bulan</span> mundur dari periode berjalan
            {periods.length > 0 ? (
              <>
                {' '}— dari <span className="font-semibold text-[var(--rc-text-muted)]">{periods[0]}</span> sampai{' '}
                <span className="font-semibold text-[var(--rc-text-muted)]">{periods[periods.length - 1]}</span>
              </>
            ) : (
              ' (bulan ini)'
            )}
            . Isi kolom Tahun (mis. 15) lalu Terapkan untuk melihat 15 tahun ke belakang.
          </p>
        </div>
      ) : null}

      {/* Tren agregat dinamis — protagonis; mengikuti metric toggle yang sama. */}
      <div className="h-[260px]">
        <MovementTrend
          periods={periods}
          rows={matrixRows}
          metric={metric}
          onMetricChange={setMetric}
          loading={loading && !data}
        />
      </div>

      {/* Evolusi kategori movement — stacked count/qty/amount + movers */}
      <div className="h-[320px]">
        <MovementCategoryEvolution
          periods={periods}
          byPeriod={evolution.byPeriod}
          movers={evolution.movers}
          totals={evolution.totals}
          metric={evolutionMetric}
          onMetricChange={setEvolutionMetric}
          loading={loading && !data}
          onDrilldown={(item) => setDrillItem(item)}
        />
      </div>

      {/* Grid: matriks (lebar) + charge (sempit) */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="h-[340px]">
          <MovementMatrix
            source={source}
            months={timelineMonths}
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
            metric={metric === 'freq' ? 'amount' : metric}
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

      {/* Analisis frekuensi issue agregat: ritme, top dok, sebaran kerutinan */}
      <div className="h-[280px]">
        <FrequencyInsights
          periods={periods}
          rows={matrixRows}
          onDrilldown={(item) => setDrillItem(item)}
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
