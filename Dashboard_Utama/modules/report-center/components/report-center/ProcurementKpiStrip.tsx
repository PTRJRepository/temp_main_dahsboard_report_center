'use client'

import Link from 'next/link'
import { startTransition, useEffect, useState } from 'react'
import { ArrowRight, CircleDollarSign, ClipboardList, Copy, Fuel, Gauge, Layers3, Package, SlidersHorizontal, TrendingUp, Truck, Wrench, X } from 'lucide-react'
import { frequencyPerDay, poFillRate, returnRate } from '@/modules/report-center/lib/reports/procurement-kpi-math'
import KpiCarousel from './KpiCarousel'
import MovementTrendChart from './MovementTrendChart'
import TopMovementScatter from './TopMovementScatter'
import StockRiverChart from './StockRiverChart'
import ValuationBridgeChart from './ValuationBridgeChart'
import AnalysisDrawer from './AnalysisDrawer'
import PeriodScrubber from './PeriodScrubber'
import MovementAnalytics from './MovementAnalytics'
import Sparkline, { MomentumDelta } from './Sparkline'
import InsightTicker from './InsightTicker'
import MarketTicker, { type MarketTickerItem } from './MarketTicker'
import ProcurementFlowStrip, { type FlowStage } from './ProcurementFlowStrip'
import type { ReportSource } from '@/modules/report-center/lib/reports/procurement-workspace'

type DeckSection = 'valuasi' | 'proses' | 'movement'

type DbRow = Record<string, unknown>

type KpiKey = 'stock' | 'receive' | 'po' | 'pr' | 'workshop' | 'movement' | 'movementMonthly' | 'usage' | 'fuel' | 'return'

type TopListItem = {
  code?: string
  name?: string
  events?: number
  qty?: number
  amount?: number
}

type TrendPoint = {
  month?: string
  events?: number
  qty?: number
  amount?: number
}

type Snapshot = {
  ok: boolean
  summary: DbRow
  chart?: DbRow[]
  topLists?: {
    items?: TopListItem[]
    costCenters?: TopListItem[]
    vehicles?: TopListItem[]
    blocks?: TopListItem[]
  }
  trend?: TrendPoint[]
  issueFrequency?: {
    byMonth?: Array<{ month?: string; docs?: number | string; activeDays?: number | string; qty?: number | string }>
    topItems?: Array<{ code?: string; name?: string; docs?: number | string; events?: number | string; qty?: number | string }>
  }
  updatedAt?: string
}

type KpiState = {
  source: ReportSource
  loading: boolean
  snapshots: Partial<Record<KpiKey, Snapshot>>
}

type ProcurementAnalysisGroup =
  | 'StockAnalysisCode'
  | 'ProductTypeCode'
  | 'ProductCategoryCode'
  | 'ProductBrandCode'
  | 'ProductModelCode'
  | 'ProductMaterialCode'

export type ProcurementKpiFilters = {
  period: string
  movementWindow: string
  groupBy: ProcurementAnalysisGroup
  scopeCode: string
  itemType: '' | 'gudang' | 'workshop'
  location: string
  /** Mode periode: bulan tunggal (default) atau satu tahun penuh (custom). */
  periodMode?: 'month' | 'year'
  /** Tahun custom (YYYY) saat periodMode === 'year'. */
  customYear?: string
}

type ProcurementKpiStripProps = {
  source: ReportSource
  links: Record<'stock' | 'receive' | 'process' | 'workshop' | 'movement' | 'usage' | 'fuel' | 'return', string>
  /** Parent-owned filters → one scope for all KPI + sibling overview. */
  filters?: ProcurementKpiFilters
  onFiltersChange?: (next: ProcurementKpiFilters) => void
}

type ProcurementKpiBreakdown = {
  label: string
  value: string
}

type ProcurementKpiCard = {
  id: string
  label: string
  value: string
  /** Full-precision value for title/aria when value is compact. */
  valueExact?: string
  description: string
  formula: string
  source: string
  breakdown: ProcurementKpiBreakdown[]
  href: string
  icon: typeof Package
  className: string
  /** Deret nilai tren untuk sparkline mini (opsional). */
  spark?: number[]
  /** SQL sederhana untuk cek data yang dipakai kartu ini. */
  checkSql?: string
  /** Native hover tooltip — penjelasan detail kartu. */
  tooltip?: string
}

function cardTooltip(card: Pick<ProcurementKpiCard, 'label' | 'valueExact' | 'value' | 'description' | 'formula' | 'source' | 'breakdown' | 'checkSql' | 'tooltip'>) {
  if (card.tooltip) return card.tooltip
  const chips = (card.breakdown ?? []).map((b) => `${b.label}: ${b.value}`).join(' · ')
  return [
    `${card.label}: ${card.valueExact ?? card.value}`,
    card.description,
    `Rumus: ${card.formula}`,
    `Sumber: ${card.source}`,
    chips ? `Rincian: ${chips}` : '',
    card.checkSql ? `Cek SQL: ${card.checkSql}` : '',
  ].filter(Boolean).join('\n')
}

/** SQL paste-ready SSMS — sketsa grain/tabel KPI (bukan 1:1 full handler filter scope). */
function kpiCheckSql(cardId: string, opts: { periodFrom: string; periodTo: string; accYear: number; accMonth: number; isCurrentPeriod: boolean; database: string }): string {
  const { periodFrom, periodTo, database } = opts
  const db = database || 'db_ptrj'
  const d = (s: string) => `'${s}'`
  const lineAmt = 'COALESCE(NULLIF(l.Amount, 0), l.Qty * l.Cost, 0)'
  const wsAmt = 'COALESCE(NULLIF(s.Amount, 0), s.Qty * ISNULL(s.Cost, s.Price), 0)'
  const wsDate = 'COALESCE(s.PostDate, s.TransDate)'
  const hdr = (title: string, fields: string) =>
    `-- KPI: ${title}\n-- DB: [${db}] · window ${periodFrom} .. ${periodTo}\n-- Fields: ${fields}\n`

  switch (cardId) {
    case 'total-usage':
          return `${hdr('Total Usage (Issue)', 'IssuedTotalAmount monthly = Ledger+Station+Vehicle (stock Acc + fuel DocDate + ws Acc)')}
    -- KPI money source: monthly-stock-account-movement-details.summary.IssuedTotalAmount
    -- Audit split: pengeluaran-barang (Gudang/Fuel/Workshop) · grain line
SELECT
  CAST(SUM(CASE WHEN src = 'STOCK' THEN Amt ELSE 0 END) AS decimal(18,2)) AS GudangIssueAmount,
  CAST(SUM(CASE WHEN src = 'FUEL' THEN Amt ELSE 0 END) AS decimal(18,2)) AS FuelIssueAmount,
  CAST(SUM(CASE WHEN src = 'WS' THEN Amt ELSE 0 END) AS decimal(18,2)) AS WorkshopIssueAmount,
  CAST(SUM(Amt) AS decimal(18,2)) AS TotalUsageAmount
FROM (
  SELECT 'STOCK' AS src, ${lineAmt} AS Amt
  FROM [${db}].dbo.IN_STOCKISSUELN l
  INNER JOIN [${db}].dbo.IN_STOCKISSUE h ON l.StockIssueID = h.StockIssueID
  WHERE h.PostDate >= ${d(periodFrom)} AND h.PostDate < DATEADD(DAY, 1, CONVERT(date, ${d(periodTo)}))
  UNION ALL
  SELECT 'FUEL', ${lineAmt}
  FROM [${db}].dbo.IN_FUELISSUELN l
  INNER JOIN [${db}].dbo.IN_FUELISSUE h ON l.FuelIssueID = h.FuelIssueID
  WHERE COALESCE(NULLIF(h.PostDate, CONVERT(datetime, '1900-01-01')), NULLIF(h.FuelIssueRefDate, CONVERT(datetime, '1900-01-01')), h.UpdateDate, h.CreateDate) >= ${d(periodFrom)}
    AND COALESCE(NULLIF(h.PostDate, CONVERT(datetime, '1900-01-01')), NULLIF(h.FuelIssueRefDate, CONVERT(datetime, '1900-01-01')), h.UpdateDate, h.CreateDate) < DATEADD(DAY, 1, CONVERT(date, ${d(periodTo)}))
  UNION ALL
  SELECT 'WS', ${wsAmt}
  FROM [${db}].dbo.WS_JOBSTOCK s
  WHERE RTRIM(ISNULL(s.TransType, '')) = '1'
    AND ${wsDate} >= ${d(periodFrom)} AND ${wsDate} < DATEADD(DAY, 1, CONVERT(date, ${d(periodTo)}))
) u;`

    case 'movement-amount':
      return `${hdr('Issue Amount (movement)', 'same issue universe as movement analysis · stock+fuel+ws · window period-locked di deck')}
-- Report: all-stock-movement-analysis · field summary.TotalStockIssueMovementAmount
-- Issue universe movement = stock+fuel+ws (sama dgn Total Usage); beda = model agregasi per item/window
SELECT
  CAST(SUM(Amt) AS decimal(18,2)) AS IssueAmountApprox
FROM (
  SELECT ${lineAmt} AS Amt
  FROM [${db}].dbo.IN_STOCKISSUELN l
  INNER JOIN [${db}].dbo.IN_STOCKISSUE h ON l.StockIssueID = h.StockIssueID
  WHERE h.PostDate >= ${d(periodFrom)} AND h.PostDate < DATEADD(DAY, 1, CONVERT(date, ${d(periodTo)}))
    AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
  UNION ALL
  SELECT ${lineAmt}
  FROM [${db}].dbo.IN_FUELISSUELN l
  INNER JOIN [${db}].dbo.IN_FUELISSUE h ON l.FuelIssueID = h.FuelIssueID
  WHERE h.PostDate >= ${d(periodFrom)} AND h.PostDate < DATEADD(DAY, 1, CONVERT(date, ${d(periodTo)}))
  UNION ALL
  SELECT ${wsAmt}
  FROM [${db}].dbo.WS_JOBSTOCK s
  WHERE RTRIM(ISNULL(s.TransType, '')) = '1'
    AND ${wsDate} >= ${d(periodFrom)} AND ${wsDate} < DATEADD(DAY, 1, CONVERT(date, ${d(periodTo)}))
) m;`

    case 'movement-qty':
      return `${hdr('Issue Qty', 'SUM(Qty) stock(+fuel/ws di path movement)')}
SELECT CAST(SUM(l.Qty) AS decimal(18,2)) AS IssueQty
FROM [${db}].dbo.IN_STOCKISSUELN l
INNER JOIN [${db}].dbo.IN_STOCKISSUE h ON l.StockIssueID = h.StockIssueID
WHERE h.PostDate >= ${d(periodFrom)} AND h.PostDate < DATEADD(DAY, 1, CONVERT(date, ${d(periodTo)}))
  AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6');`

    case 'movement-frequency':
      return `${hdr('Frekuensi Issue', 'COUNT DISTINCT dokumen IN_STOCKISSUE.StockIssueID')}
SELECT COUNT(DISTINCT h.StockIssueID) AS IssueDocuments
FROM [${db}].dbo.IN_STOCKISSUE h
WHERE h.PostDate >= ${d(periodFrom)} AND h.PostDate < DATEADD(DAY, 1, CONVERT(date, ${d(periodTo)}));`

    case 'movement-total':
      return `${hdr('Total Issue Movement (event)', 'COUNT baris line issue = event, BUKAN Rupiah')}
SELECT COUNT(*) AS IssueEvents
FROM [${db}].dbo.IN_STOCKISSUELN l
INNER JOIN [${db}].dbo.IN_STOCKISSUE h ON l.StockIssueID = h.StockIssueID
WHERE h.PostDate >= ${d(periodFrom)} AND h.PostDate < DATEADD(DAY, 1, CONVERT(date, ${d(periodTo)}))
  AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6');`

    case 'movement-top-frequency':
      return `${hdr('Top frekuensi issue', 'ItemCode + COUNT DISTINCT StockIssueID')}
SELECT TOP 10 RTRIM(l.ItemCode) AS ItemCode,
  COUNT(DISTINCT h.StockIssueID) AS Docs,
  COUNT(*) AS Lines,
  CAST(SUM(${lineAmt}) AS decimal(18,2)) AS Amount
FROM [${db}].dbo.IN_STOCKISSUELN l
INNER JOIN [${db}].dbo.IN_STOCKISSUE h ON l.StockIssueID = h.StockIssueID
WHERE h.PostDate >= ${d(periodFrom)} AND h.PostDate < DATEADD(DAY, 1, CONVERT(date, ${d(periodTo)}))
GROUP BY RTRIM(l.ItemCode)
ORDER BY Docs DESC, Amount DESC;`

    case 'movement-gr-qty':
      return `${hdr('Goods Receive Qty (monthly path)', 'PU_GOODSRCV + PU_GOODSRCVLN.StockQty · cost dari PU_POLN')}
SELECT CAST(SUM(ISNULL(gl.StockQty, 0)) AS decimal(18,2)) AS GoodsReceiveQty,
  CAST(SUM(ISNULL(gl.StockQty, 0) * ISNULL(p.Cost, 0)) AS decimal(18,2)) AS GoodsReceiveAmount
FROM [${db}].dbo.PU_GOODSRCV g
INNER JOIN [${db}].dbo.PU_GOODSRCVLN gl ON g.GoodsRcvID = gl.GoodsRcvID
LEFT JOIN [${db}].dbo.PU_POLN p ON gl.POLnID = p.POLnID
WHERE g.GoodsRcvRefDate >= ${d(periodFrom)}
  AND g.GoodsRcvRefDate < DATEADD(DAY, 1, CONVERT(date, ${d(periodTo)}))
  AND RTRIM(ISNULL(g.Status, '')) IN ('2', '5', '6');`

    case 'movement-open-close-qty':
      return `${hdr('Opening vs Closing Qty', 'IN_MTHENDITEM snapshot · AccYear/AccMonth accounting (bukan cuma kalender)')}
-- Ganti AccYear/AccMonth sesuai mapping period UI (helper accounting-period di app)
SELECT
  CAST(SUM(ISNULL(m.Qty, 0)) AS decimal(18,2)) AS SnapshotQty,
  CAST(SUM(ISNULL(m.Amount, ISNULL(m.Qty, 0) * ISNULL(m.AverageCost, 0))) AS decimal(18,2)) AS SnapshotAmount
FROM [${db}].dbo.IN_MTHENDITEM m
WHERE RTRIM(CONVERT(varchar(10), m.AccYear)) = '${opts.accYear}'
  AND RTRIM(CONVERT(varchar(10), m.AccMonth)) = '${opts.accMonth}';`

    case 'movement-issued-split':
      return `${hdr('Issued split Ledger/Station/Vehicle', 'IN_STOCKISSUELN BlkCode/VehCode · monthly IssuedTotal = sum 3 bucket (+fuel/ws di RPTIN)')}
SELECT
  CAST(SUM(CASE WHEN LEN(RTRIM(ISNULL(l.BlkCode,'')))=0 AND LEN(RTRIM(ISNULL(l.VehCode,'')))=0 THEN ${lineAmt} ELSE 0 END) AS decimal(18,2)) AS LedgerAmount,
  CAST(SUM(CASE WHEN LEN(RTRIM(ISNULL(l.VehCode,'')))=0 AND LEN(RTRIM(ISNULL(l.BlkCode,'')))>0 THEN ${lineAmt} ELSE 0 END) AS decimal(18,2)) AS StationAmount,
  CAST(SUM(CASE WHEN LEN(RTRIM(ISNULL(l.VehCode,'')))>0 THEN ${lineAmt} ELSE 0 END) AS decimal(18,2)) AS VehicleAmount,
  CAST(SUM(${lineAmt}) AS decimal(18,2)) AS StockIssueOnlyTotal
FROM [${db}].dbo.IN_STOCKISSUELN l
INNER JOIN [${db}].dbo.IN_STOCKISSUE h ON l.StockIssueID = h.StockIssueID
WHERE h.PostDate >= ${d(periodFrom)} AND h.PostDate < DATEADD(DAY, 1, CONVERT(date, ${d(periodTo)}))
  AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6');
-- Monthly IssuedTotalAmount juga + IN_FUELISSUE + WS_JOBSTOCK (lihat report monthly-stock-account-movement-details)`

    case 'stock':
    case 'gudang-value':
    case 'workshop':
    case 'stock-gudang':
    case 'stock-workshop':
      return `${hdr('Valuasi inventory', 'IN_ITEM live (QtyOnHand+QtyOnHold)*AverageCost · opening dari IN_MTHENDITEM')}
SELECT
  CAST(SUM((ISNULL(i.QtyOnHand,0)+ISNULL(i.QtyOnHold,0))*ISNULL(i.AverageCost,0)) AS decimal(18,2)) AS CurrentValuation,
  CAST(SUM(CASE WHEN RTRIM(ISNULL(i.ItemType,''))='1' THEN (ISNULL(i.QtyOnHand,0)+ISNULL(i.QtyOnHold,0))*ISNULL(i.AverageCost,0) ELSE 0 END) AS decimal(18,2)) AS Gudang,
  CAST(SUM(CASE WHEN RTRIM(ISNULL(i.ItemType,''))='4' THEN (ISNULL(i.QtyOnHand,0)+ISNULL(i.QtyOnHold,0))*ISNULL(i.AverageCost,0) ELSE 0 END) AS decimal(18,2)) AS Workshop
FROM [${db}].dbo.IN_ITEM i;
-- Opening: IN_MTHENDITEM AccYear/AccMonth = accounting month SEBELUM period UI`

    case 'receive':
    case 'receive-value':
      return `${hdr('Goods Receive Amount', 'PU_GOODSRCV + LN + PU_POLN.Cost')}
SELECT CAST(SUM(ISNULL(gl.StockQty,0)*ISNULL(p.Cost,0)) AS decimal(18,2)) AS GrAmount,
  COUNT(DISTINCT g.GoodsRcvID) AS Docs
FROM [${db}].dbo.PU_GOODSRCV g
INNER JOIN [${db}].dbo.PU_GOODSRCVLN gl ON g.GoodsRcvID = gl.GoodsRcvID
LEFT JOIN [${db}].dbo.PU_POLN p ON gl.POLnID = p.POLnID
WHERE g.GoodsRcvRefDate >= ${d(periodFrom)}
  AND g.GoodsRcvRefDate < DATEADD(DAY, 1, CONVERT(date, ${d(periodTo)}));`

    case 'pr-outstanding':
      return `${hdr('PR Outstanding', 'report purchase-request-inventory · qty outstanding lines')}
-- Lihat report purchase-request-inventory (bukan single table sederhana).
SELECT TOP 20 * FROM [${db}].dbo.PU_PR ORDER BY 1 DESC; -- placeholder schema probe`

    case 'po-outstanding':
      return `${hdr('PO Outstanding', 'report purchase-order-history · QtyOrder − QtyReceive')}
-- Lihat report purchase-order-history.
SELECT TOP 20 * FROM [${db}].dbo.PU_PO ORDER BY 1 DESC; -- placeholder schema probe`

    default:
      return `${hdr(cardId, 'fallback valuasi / monthend')}
SELECT CAST(SUM((ISNULL(i.QtyOnHand,0)+ISNULL(i.QtyOnHold,0))*ISNULL(i.AverageCost,0)) AS decimal(18,2)) AS Amount
FROM [${db}].dbo.IN_ITEM i;`
  }
}

const DECK_SECTIONS: Array<{ id: DeckSection; label: string; tone: string }> = [
  { id: 'valuasi', label: 'Valuasi', tone: 'text-emerald-100/80 border-emerald-300/30 data-[active=true]:bg-emerald-400/15 data-[active=true]:text-emerald-50' },
  { id: 'proses', label: 'Proses', tone: 'text-sky-100/80 border-sky-300/30 data-[active=true]:bg-sky-400/15 data-[active=true]:text-sky-50' },
  { id: 'movement', label: 'Movement', tone: 'text-rose-100/80 border-rose-300/30 data-[active=true]:bg-rose-400/15 data-[active=true]:text-rose-50' },
]

const kpiRequests: Array<{ key: KpiKey; report: string }> = [
  { key: 'stock', report: 'asset-stock-valuasi-listing' },
  { key: 'receive', report: 'goods-receiving-receipt-activity' },
  { key: 'po', report: 'purchase-order-history' },
  { key: 'pr', report: 'purchase-request-inventory' },
  { key: 'workshop', report: 'asset-stock-valuasi-listing' },
  { key: 'movement', report: 'all-stock-movement-analysis' },
  { key: 'usage', report: 'pengeluaran-barang' },
  { key: 'fuel', report: 'fuel-usage' },
  { key: 'return', report: 'return-barang' },
]

const analysisGroupOptions: Array<{ value: ProcurementAnalysisGroup; label: string; placeholder: string }> = [
  { value: 'StockAnalysisCode', label: 'Stock Analysis', placeholder: 'DEADS / MEMOV / SLMOV' },
  { value: 'ProductTypeCode', label: 'Product Type', placeholder: 'Contoh: SP / FUEL' },
  { value: 'ProductCategoryCode', label: 'Product Category', placeholder: 'Kode kategori produk' },
  { value: 'ProductBrandCode', label: 'Product Brand', placeholder: 'Kode brand' },
  { value: 'ProductModelCode', label: 'Product Model', placeholder: 'Kode model' },
  { value: 'ProductMaterialCode', label: 'Product Material', placeholder: 'Kode material' },
]

const movementWindowOptions = [
  { value: 'all', label: 'All period' },
  { value: '1m', label: '1 bulan' },
  { value: '3m', label: '3 bulan' },
  { value: '6m', label: '6 bulan' },
  { value: '12m', label: '12 bulan / 1 tahun' },
  { value: '2y', label: '2 tahun' },
  { value: '5y', label: '5 tahun' },
  { value: '10y', label: '10 tahun' },
]

function toNumber(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function firstNumber(summary: DbRow | undefined, keys: string[]) {
  if (!summary) return 0
  const entries = Object.entries(summary)
  for (const want of keys) {
    const hit = entries.find(([k, v]) => k.toLowerCase() === want.toLowerCase() && v !== undefined && v !== null && v !== '')
    if (hit) return toNumber(hit[1])
  }
  return 0
}

function firstText(summary: DbRow | undefined, keys: string[]) {
  if (!summary) return ''
  const entries = Object.entries(summary)
  for (const want of keys) {
    const hit = entries.find(([k, v]) => k.toLowerCase() === want.toLowerCase() && v !== undefined && v !== null && v !== '')
    if (hit) return String(hit[1])
  }
  return ''
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value)
}

function formatCurrency(value: number) {
  // Amount / valuasi: always 4 decimals (id-ID), no compact.
  if (!Number.isFinite(value)) return 'Rp0,0000'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value)
}

function formatCurrencyCompact(value: number) {
  if (!Number.isFinite(value)) return 'Rp0'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000_000_000) return `${sign}Rp${(abs / 1_000_000_000_000).toFixed(2)} T`
  if (abs >= 1_000_000_000) return `${sign}Rp${(abs / 1_000_000_000).toFixed(2)} M`
  if (abs >= 1_000_000) return `${sign}Rp${(abs / 1_000_000).toFixed(1)} jt`
  return formatCurrency(value)
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%'
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`
}

function percentOf(value: number, total: number) {
  if (!total) return 0
  return (value / total) * 100
}

function currentPeriod(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriodLabel(period: string) {
  const [year, month] = period.split('-').map(Number)
  if (!year || !month) return period || 'Bulan berjalan'
  return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function periodOptions(now = new Date()) {
  return Array.from({ length: 18 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const value = currentPeriod(date)
    return {
      value,
      label: date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
    }
  })
}

function cleanFilterValue(value: string) {
  return value.trim()
}

function appendParam(params: Record<string, string>, key: string, value: string | undefined) {
  if (value) params[key] = value
}

function analysisScopeParams(filters: ProcurementKpiFilters) {
  const value = cleanFilterValue(filters.scopeCode)
  const params: Record<string, string> = {}
  if (!value) return params

  if (filters.groupBy === 'StockAnalysisCode') {
    params.stockAnalysis = value
    params.category = value
  } else if (filters.groupBy === 'ProductTypeCode') {
    params.productType = value
  } else if (filters.groupBy === 'ProductCategoryCode') {
    params.productCategory = value
    params.category = value
  } else if (filters.groupBy === 'ProductBrandCode') {
    params.productBrand = value
  } else if (filters.groupBy === 'ProductModelCode') {
    params.productModel = value
  } else if (filters.groupBy === 'ProductMaterialCode') {
    params.productMaterial = value
  }

  return params
}

function procurementFilterParams(filters: ProcurementKpiFilters, options: { includeGroupBy?: boolean; includeMovement?: boolean } = {}) {
  const params: Record<string, string> = {
    period: filters.period,
    ...analysisScopeParams(filters),
  }
  appendParam(params, 'location', cleanFilterValue(filters.location))
  appendParam(params, 'itemType', filters.itemType)
  if (options.includeMovement) appendParam(params, 'movementWindow', filters.movementWindow || 'all')
  if (options.includeGroupBy) {
    params.groupBy = filters.groupBy
    params.chartDimension = filters.groupBy
  }
  return params
}

function hrefWithFilters(
  href: string,
  filters: ProcurementKpiFilters,
  options: { forceMovement?: boolean; includeGroupBy?: boolean } = {},
) {
  const [path, rawQuery = ''] = href.split('?')
  const params = new URLSearchParams(rawQuery)
  const filterParams = procurementFilterParams(filters, {
    includeGroupBy: options.includeGroupBy !== false,
    includeMovement: options.forceMovement,
  })
  Object.entries(filterParams).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  return `${path}?${params.toString()}`
}

type CardTitleTone = {
  pillClass: string
  dotClass: string
}

function cardTitleTone(cardId: string): CardTitleTone {
  // Calm-minimal: dua warna fungsional saja.
  // emerald = nilai/positif, amber = perhatian/anomali, sisanya neutral.
  switch (cardId) {
    case 'stock':
    case 'gudang-value':
    case 'receive-value':
      return { pillClass: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100/90', dotClass: 'bg-emerald-300/70' }
    case 'pr-outstanding':
    case 'po-outstanding':
      return { pillClass: 'border-amber-300/25 bg-amber-400/10 text-amber-100/90', dotClass: 'bg-amber-300/70' }
    default:
      return { pillClass: 'border-white/10 bg-white/[0.045] text-[var(--rc-text)]', dotClass: 'bg-white/40' }
  }
}

function sqlGatewayBase() {
  return window.localStorage.getItem('report-center:sql-gateway-base') || 'http://10.0.0.110:8001'
}

async function fetchSummary(
  source: ReportSource,
  report: string,
  signal: AbortSignal,
  extra: Record<string, string> = {},
): Promise<Snapshot> {
  const params = new URLSearchParams({
    report,
    source,
    page: '1',
    pageSize: '5',
    limit: '5',
    ...extra,
  })
  const response = await fetch(`/api/reports/inventory?${params.toString()}`, {
    cache: 'no-store',
    signal,
    headers: { 'x-sql-gateway-base': sqlGatewayBase() },
  })
  const data = await response.json().catch(() => ({})) as {
    success?: boolean
    data?: {
      summary?: DbRow
      chart?: DbRow[]
      topLists?: Snapshot['topLists']
      trend?: Snapshot['trend']
      issueFrequency?: Snapshot['issueFrequency']
    }
  }
  if (!response.ok || data.success !== true || !data.data?.summary) {
    return { ok: false, summary: {} }
  }
  const summary = data.data.summary
  return {
    ok: true,
    summary,
    chart: data.data.chart ?? [],
    topLists: data.data.topLists,
    trend: data.data.trend,
    issueFrequency: data.data.issueFrequency,
    updatedAt: firstText(summary, ['TerakhirUpdate', 'LastMovementDate', 'LastUsageDate', 'LastRunningUpdate']),
  }
}

/** Fallback: jalur 8-fetch paralel lama (dipakai bila composite endpoint gagal). */
async function fetchDeckLegacy(
  source: ReportSource,
  filters: ProcurementKpiFilters,
  signal: AbortSignal,
): Promise<Partial<Record<KpiKey, Snapshot>>> {
  const baseParams = procurementFilterParams(filters)
  const isYear = filters.periodMode === 'year' && /^\d{4}$/.test((filters.customYear ?? '').trim())
  const yearRange = isYear
    ? {
        dateFrom: `${(filters.customYear ?? '').trim()}-01-01`,
        dateTo: `${(filters.customYear ?? '').trim()}-12-31`,
      }
    : null
  const results = await Promise.allSettled(kpiRequests.map(async (request) => {
    let extra: Record<string, string> = { ...baseParams }
    // GUARDRAIL(procurement-kpi-inventory-scope):
    // Stock KPI is the Procurement > Inventory master value, not Gudang-only.
    // Leave stock/movement without itemType so API uses ItemType IN ('1','4').
    if (request.key === 'workshop') {
      extra = {
        ...extra,
        itemType: filters.itemType === 'gudang' ? 'gudang' : 'workshop',
      }
    } else if (request.key === 'movement') {
      // Samakan timeline movement KPI dengan period (bukan MC all).
      extra = {
        ...extra,
        ...analysisScopeParams(filters),
        groupBy: 'MovementCategory',
        chartDimension: 'MovementCategory',
        movementWindow: isYear ? 'custom' : '1m',
        ...(yearRange ?? { period: filters.period }),
      }
    } else if (
      // Alur proses + usage/fuel: ikut periode terpilih (month period atau year range).
      yearRange
      && (request.key === 'usage'
        || request.key === 'fuel'
        || request.key === 'receive'
        || request.key === 'return'
        || request.key === 'po'
        || request.key === 'pr'
        || request.key === 'movementMonthly')
    ) {
      extra = {
        ...extra,
        ...yearRange,
      }
      delete extra.period
    }
    return [request.key, await fetchSummary(source, request.report, signal, extra)] as const
  }))
  const snapshots: Partial<Record<KpiKey, Snapshot>> = {}
  results.forEach((result, index) => {
    const key = kpiRequests[index].key
    snapshots[key] = result.status === 'fulfilled'
      ? result.value[1]
      : { ok: false, summary: {} }
  })
  return snapshots
}

/**
 * Jalur utama: SATU fetch ke composite command-deck endpoint (server menjalankan
 * 8 report secara server-side). Fallback ke jalur 8-fetch lama bila endpoint gagal.
 */
async function fetchDeck(
  source: ReportSource,
  filters: ProcurementKpiFilters,
  signal: AbortSignal,
): Promise<Partial<Record<KpiKey, Snapshot>>> {
  const params = new URLSearchParams({
    source,
    period: filters.period,
    // Deck KPI: movement selalu di-lock ke period (1m / custom year), bukan MC bebas.
    movementWindow: '1m',
    groupBy: filters.groupBy,
    scopeCode: cleanFilterValue(filters.scopeCode),
    itemType: filters.itemType,
    location: cleanFilterValue(filters.location),
  })
  // Mode tahun custom: override period dengan rentang tanggal setahun penuh
  // (usage + movement custom window; valuasi bulanan tetap period-aware di server).
  const customYear = (filters.customYear ?? '').trim()
  if (filters.periodMode === 'year' && /^\d{4}$/.test(customYear)) {
    params.set('dateFrom', `${customYear}-01-01`)
    params.set('dateTo', `${customYear}-12-31`)
    params.set('movementWindow', 'custom')
    params.delete('period')
  }
  try {
    const response = await fetch(`/api/reports/procurement/command-deck?${params.toString()}`, {
      cache: 'no-store',
      signal,
      headers: { 'x-sql-gateway-base': sqlGatewayBase() },
    })
    if (!response.ok) throw new Error(`command-deck ${response.status}`)
    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean
      snapshots?: Partial<Record<KpiKey, Snapshot>>
    }
    if (data.success !== true || !data.snapshots) throw new Error('command-deck payload invalid')
    return data.snapshots
  } catch (error) {
    if (signal.aborted) throw error
    return fetchDeckLegacy(source, filters, signal)
  }
}

const DEFAULT_PROCUREMENT_KPI_FILTERS: ProcurementKpiFilters = {
  period: '', // filled at runtime via currentPeriod()
  // Default 1m = selaras period bulanan (bukan all-history).
  movementWindow: '1m',
  groupBy: 'ProductTypeCode',
  scopeCode: '',
  itemType: '',
  location: '',
  periodMode: 'month',
  customYear: '',
}

export function createDefaultProcurementKpiFilters(now = new Date()): ProcurementKpiFilters {
  return {
    ...DEFAULT_PROCUREMENT_KPI_FILTERS,
    period: currentPeriod(now),
  }
}

export default function ProcurementKpiStrip({
  source,
  links,
  filters: controlledFilters,
  onFiltersChange,
}: ProcurementKpiStripProps) {
  const [localFilters, setLocalFilters] = useState<ProcurementKpiFilters>(() => createDefaultProcurementKpiFilters())
  const filters = controlledFilters ?? localFilters
  const setFilters = (next: ProcurementKpiFilters | ((current: ProcurementKpiFilters) => ProcurementKpiFilters)) => {
    const resolved = typeof next === 'function' ? next(filters) : next
    if (onFiltersChange) onFiltersChange(resolved)
    else setLocalFilters(resolved)
  }
  const [state, setState] = useState<KpiState>(() => ({
    source,
    loading: true,
    snapshots: {},
  }))
  const [scopeDraft, setScopeDraft] = useState(filters.scopeCode)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [glance, setGlance] = useState(true)
  const [openSection, setOpenSection] = useState<DeckSection>('valuasi')
  const [topDimension, setTopDimension] = useState<'items' | 'costCenters' | 'vehicles'>('items')
  const [kpiSqlView, setKpiSqlView] = useState<{ label: string; sql: string; source: string; formula: string } | null>(null)
  const [kpiSqlCopied, setKpiSqlCopied] = useState(false)
  const selectedGroup = analysisGroupOptions.find((option) => option.value === filters.groupBy) ?? analysisGroupOptions[0]
  const periods = periodOptions()
  const isYearMode = filters.periodMode === 'year' && /^\d{4}$/.test((filters.customYear ?? '').trim())
  const activePeriodLabel = isYearMode
    ? `Tahun ${(filters.customYear ?? '').trim()}`
    : formatPeriodLabel(filters.period)
  // KPI atas = HANYA periode terpilih (bukan MC lookback multi-bulan).
  const kpiTimelineRange = (() => {
    if (isYearMode) {
      const y = (filters.customYear ?? '').trim()
      return { from: `${y}-01-01`, to: `${y}-12-31`, label: `1 Jan ${y} s/d 31 Des ${y}` }
    }
    const m = String(filters.period ?? '').trim().match(/^(\d{4})-(\d{1,2})/)
    if (!m) return { from: '—', to: '—', label: 'Periode belum dipilih' }
    const y = Number(m[1])
    const mo = Number(m[2])
    const last = new Date(y, mo, 0).getDate()
    const from = `${y}-${String(mo).padStart(2, '0')}-01`
    const to = `${y}-${String(mo).padStart(2, '0')}-${String(last).padStart(2, '0')}`
    return { from, to, label: `${from} s/d ${to}` }
  })()
  const kpiTimelineBadge = `KPI · ${activePeriodLabel} · ${kpiTimelineRange.label}`
  // Penanda periode berjalan vs lampau — menentukan sumber data (live vs monthend).
  const now = new Date()
  const isCurrentPeriod = isYearMode
    ? Number((filters.customYear ?? '').trim()) === now.getFullYear()
    : (() => {
        const m = String(filters.period ?? '').trim().match(/^(\d{4})-(\d{1,2})/)
        return m ? Number(m[1]) === now.getFullYear() && Number(m[2]) === now.getMonth() + 1 : false
      })()
  const periodKindBadge = isCurrentPeriod
    ? {
        label: 'CURRENT · periode berjalan · live balance',
        short: 'CURRENT',
        tone: 'border-sky-300/45 bg-sky-400/20 text-sky-50 shadow-[0_0_14px_rgba(56,189,248,0.18)]',
      }
    : {
        label: 'PAST · periode lampau · snapshot monthend',
        short: 'PAST',
        tone: 'border-amber-300/45 bg-amber-400/20 text-amber-50 shadow-[0_0_14px_rgba(245,158,11,0.16)]',
      }

  // Parameter SQL cek data kartu — mengikuti periode terpilih.
  const kpiPeriodMatch = String(filters.period ?? '').trim().match(/^(\d{4})-(\d{1,2})/)
  const kpiAccYear = isYearMode ? Number((filters.customYear ?? '').trim()) : kpiPeriodMatch ? Number(kpiPeriodMatch[1]) : now.getFullYear()
  const kpiAccMonth = isYearMode ? 12 : kpiPeriodMatch ? Number(kpiPeriodMatch[2]) : now.getMonth() + 1
  const checkSqlOpts = {
    periodFrom: kpiTimelineRange.from,
    periodTo: kpiTimelineRange.to,
    accYear: kpiAccYear,
    accMonth: kpiAccMonth,
    isCurrentPeriod,
    database: source === 'pabrik' ? 'db_ptrj_mill' : 'db_ptrj',
  }
  const withCheckSql = (card: ProcurementKpiCard): ProcurementKpiCard =>
    card.checkSql ? card : { ...card, checkSql: kpiCheckSql(card.id, checkSqlOpts) }
  const openKpiSql = (
    event: { preventDefault: () => void; stopPropagation: () => void },
    card: ProcurementKpiCard,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const full = withCheckSql(card)
    setKpiSqlCopied(false)
    setKpiSqlView({
      label: full.label,
      sql: full.checkSql || kpiCheckSql(full.id, checkSqlOpts),
      source: full.source,
      formula: full.formula,
    })
  }
  const filteredLinks = {
    stock: hrefWithFilters(links.stock, filters, { includeGroupBy: false }),
    receive: hrefWithFilters(links.receive, filters, { includeGroupBy: false }),
    process: hrefWithFilters(links.process, filters, { includeGroupBy: false }),
    workshop: hrefWithFilters(links.workshop, {
      ...filters,
      itemType: filters.itemType === 'gudang' ? 'gudang' : 'workshop',
    }, { includeGroupBy: false }),
    movement: hrefWithFilters(links.movement, filters, { forceMovement: true, includeGroupBy: false }),
    usage: hrefWithFilters(links.usage, filters, { includeGroupBy: false }),
    fuel: hrefWithFilters(links.fuel, filters, { includeGroupBy: false }),
    return: hrefWithFilters(links.return, filters, { includeGroupBy: false }),
  }
  const updateFilter = <K extends keyof ProcurementKpiFilters>(key: K, value: ProcurementKpiFilters[K]) => {
    setFilters((current) => {
      const next = { ...current, [key]: value }
      if (key === 'groupBy') {
        next.scopeCode = ''
        setScopeDraft('')
      }
      return next
    })
  }
  const resetFilters = () => {
    const defaults = createDefaultProcurementKpiFilters()
    setScopeDraft(defaults.scopeCode)
    setFilters(defaults)
  }

  useEffect(() => {
    setScopeDraft(filters.scopeCode)
  }, [filters.scopeCode])

  useEffect(() => {
    if (scopeDraft === filters.scopeCode) return
    const timer = window.setTimeout(() => {
      updateFilter('scopeCode', scopeDraft)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [scopeDraft, filters.scopeCode])

  useEffect(() => {
    const controller = new AbortController()
    startTransition(() => setState((current) => ({
      source,
      loading: true,
      snapshots: current.source === source ? current.snapshots : {},
    })))

    fetchDeck(source, filters, controller.signal)
      .then((snapshots) => {
        if (controller.signal.aborted) return
        startTransition(() => setState({ source, loading: false, snapshots }))
      })
      .catch(() => {
        if (controller.signal.aborted) return
        // Keep previous snapshots on error — empty wipe made charts vanish mid-session.
        startTransition(() => setState((current) => ({
          source,
          loading: false,
          snapshots: current.source === source ? current.snapshots : {},
        })))
      })

    return () => controller.abort()
  }, [filters, source])

  const loading = state.source !== source || state.loading
  useEffect(() => {
    if (loading || !glance) return
    const idle = window.setTimeout(() => setGlance(false), 1400)
    return () => window.clearTimeout(idle)
  }, [loading, glance])
  const snapshots = state.source === source ? state.snapshots : {}
  const stock = snapshots.stock?.summary
  const receive = snapshots.receive?.summary
  const po = snapshots.po?.summary
  const pr = snapshots.pr?.summary
  const workshop = snapshots.workshop?.summary
  const movement = snapshots.movement?.summary
  const movementMonthly = snapshots.movementMonthly?.summary
  const usage = snapshots.usage?.summary
    const fuel = snapshots.fuel?.summary
    const stockReturn = snapshots.return?.summary
    const topUsageItems = (snapshots.usage?.chart ?? []).slice(0, 5)
    // Fuel chart dari command-deck = product type breakdown (inventory fuelUsage report).
    const fuelProductTypeRows = (snapshots.fuel?.chart ?? [])
      .map((row) => {
        const code = firstText(row, ['ProductTypeCode', 'code', 'KodeFuel'])
        const name = firstText(row, ['ProductTypeName', 'name', 'NamaFuel', 'ProductTypeCode']) || code
        const amount = firstNumber(row, ['NilaiFuel', 'amount', 'TotalAmount', 'Amount'])
        const qty = firstNumber(row, ['QtyFuel', 'qty', 'TotalQtyFuel'])
        const docs = firstNumber(row, ['Docs', 'docs', 'TotalDokumen'])
        const itemCount = firstNumber(row, ['ItemCount', 'itemCount', 'TotalItem'])
        return { code, name, amount, qty, docs, itemCount }
      })
      .filter((row) => row.amount > 0 || row.qty > 0)
      .sort((a, b) => b.amount - a.amount)
    const topFuelProductType = fuelProductTypeRows[0]

  const poCount = firstNumber(po, ['TotalPO'])
  const prCount = firstNumber(pr, ['TotalPR'])
  const processOutstanding = firstNumber(pr, ['TotalQtyOutstanding']) + firstNumber(po, ['TotalQtyOutstanding'])
  const gudangValue = firstNumber(stock, ['GudangTotalAmount'])
  const workshopValueFromStock = firstNumber(stock, ['WorkshopTotalAmount'])
  const workshopValue = filters.itemType === 'gudang'
    ? workshopValueFromStock
    : workshopValueFromStock || firstNumber(workshop, ['total_amount', 'WorkshopTotalAmount', 'NilaiPersediaan', 'TotalAmount'])
  const inventoryValue = firstNumber(stock, ['total_amount', 'TotalAssetAmount', 'NilaiPersediaan', 'TotalAmount']) || gudangValue + workshopValue
  const totalInventoryItem = firstNumber(stock, ['total_item', 'TotalItem'])
  const gudangItem = firstNumber(stock, ['GudangItemCount'])
  const workshopItem = firstNumber(stock, ['WorkshopItemCount'])
  const totalQuantity = firstNumber(stock, ['total_quantity', 'TotalQty', 'TotalStok'])
  const totalOnHand = firstNumber(stock, ['total_quantity_on_hand'])
  const totalOnHold = firstNumber(stock, ['total_quantity_on_hold'])
  const gudangOnHand = firstNumber(stock, ['GudangQuantityOnHand']) || (filters.itemType === 'workshop' ? 0 : totalOnHand)
  const gudangOnHold = firstNumber(stock, ['GudangQuantityOnHold']) || (filters.itemType === 'workshop' ? 0 : totalOnHold)
  const workshopOnHand = firstNumber(stock, ['WorkshopQuantityOnHand'])
    || firstNumber(workshop, ['total_quantity_on_hand', 'WorkshopQuantityOnHand', 'total_quantity'])
  const workshopOnHold = firstNumber(stock, ['WorkshopQuantityOnHold'])
    || firstNumber(workshop, ['total_quantity_on_hold', 'WorkshopQuantityOnHold'])
  const workshopQty = firstNumber(stock, ['WorkshopTotalQuantity'])
    || workshopOnHand + workshopOnHold
    || firstNumber(workshop, ['total_quantity', 'TotalQty', 'TotalStok'])
  // Opening = previous accounting period (IN_MTHENDITEM). Current = selected/live balance.
  const openingValue = firstNumber(stock, ['OpeningTotalAmount'])
  const openingGudangValue = firstNumber(stock, ['OpeningGudangTotalAmount'])
  const openingWorkshopValue = firstNumber(stock, ['OpeningWorkshopTotalAmount'])
  const valuationDelta = Object.entries(stock ?? {}).some(([k]) => k.toLowerCase() === 'valuationdeltaamount')
    ? firstNumber(stock, ['ValuationDeltaAmount'])
    : (inventoryValue - openingValue)
  const valuationDeltaPctRaw = stock?.ValuationDeltaPct
  const valuationDeltaPct = valuationDeltaPctRaw === null || valuationDeltaPctRaw === undefined || valuationDeltaPctRaw === ''
    ? (openingValue !== 0 ? (valuationDelta / openingValue) * 100 : null)
    : toNumber(valuationDeltaPctRaw)
  const openingActualPeriod = firstText(stock, ['OpeningActualPeriod'])
  const openingAccountingPeriod = firstText(stock, ['OpeningAccountingPeriod'])
  const currentActualPeriod = firstText(stock, ['actual_period', 'ActualPeriod'])
  const openingPeriodLabel = openingActualPeriod || (openingAccountingPeriod ? `Acc ${openingAccountingPeriod}` : 'periode sebelumnya')
  const currentPeriodLabel = currentActualPeriod || filters.period || 'periode terpilih'
  // Default inventory scope = Gudang (1) + Workshop (4). Filter itemType narrows it.
  const inventoryScope =
    filters.itemType === 'gudang' ? 'gudang'
      : filters.itemType === 'workshop' ? 'workshop'
        : 'both'
  const inventoryScopeLabel =
    inventoryScope === 'gudang' ? 'Gudang saja (ItemType 1)'
      : inventoryScope === 'workshop' ? 'Workshop saja (ItemType 4)'
        : 'Gudang + Workshop (ItemType 1+4 · default)'
  const inventoryScopeShort =
    inventoryScope === 'gudang' ? 'Gudang'
      : inventoryScope === 'workshop' ? 'Workshop'
        : 'Gudang + Workshop'
  const usageWorkshopLines = firstNumber(usage, ['BarisWorkshop'])
  const gudangIssueAmount = firstNumber(usage, ['GudangIssueAmount'])
  const gudangIssueQty = firstNumber(usage, ['GudangIssueQty'])
  const gudangIssueDocs = firstNumber(usage, ['GudangIssueDocuments'])
  const workshopIssueAmount = firstNumber(usage, ['WorkshopIssueAmount'])
  const workshopIssueQty = firstNumber(usage, ['WorkshopIssueQty'])
  const workshopIssueDocs = firstNumber(usage, ['WorkshopIssueDocuments'])
  // Fuel yang dijumlahkan ke Total Usage (dari pengeluaran-barang, selaras monthly IssuedTotal).
    const usageFuelIssueAmount = firstNumber(usage, ['FuelIssueAmount'])
    const usageFuelIssueQty = firstNumber(usage, ['FuelIssueQty'])
    const usageFuelIssueDocs = firstNumber(usage, ['FuelIssueDocuments'])
    const fuelSnapshotOk = snapshots.fuel?.ok === true
    const fuelIssueAmount = firstNumber(fuel, ['TotalAmount', 'TotalFuelAmount', 'NilaiFuel', 'Aggregate'])
    const fuelIssueQty = firstNumber(fuel, ['TotalQtyFuel', 'TotalQty', 'QtyFuel'])
    const fuelIssueDocs = firstNumber(fuel, ['TotalDokumen', 'TotalFuelDocuments', 'TotalBaris'])
    const fuelIssueLines = firstNumber(fuel, ['TotalBaris', 'TotalLineRows'])
    const fuelHasRows = fuelSnapshotOk && (fuelIssueDocs > 0 || fuelIssueLines > 0 || fuelIssueAmount > 0)
    const usageScopeNote =
      inventoryScope === 'gudang' ? 'Issue gudang (IN_STOCKISSUE)'
        : inventoryScope === 'workshop' ? 'Issue workshop (WS_JOBSTOCK)'
          : 'Issue gudang + workshop (default)'
    const receiveDocs = firstNumber(receive, ['TotalGoodsReceive', 'TotalBaris'])
    const receiveQty = firstNumber(receive, ['TotalQuantity'])
    const receiveAmount = firstNumber(receive, ['TotalAmount'])
    const receiveSupplier = firstNumber(receive, ['TotalSupplier'])
    const poAmount = firstNumber(po, ['TotalPOAmount'])
    const poQtyOrder = firstNumber(po, ['TotalQtyOrder'])
    const poQtyReceive = firstNumber(po, ['TotalQtyReceive'])
    const poQtyOutstanding = firstNumber(po, ['TotalQtyOutstanding'])
    const prAmount = firstNumber(pr, ['TotalAmount'])
    const prQtyRequest = firstNumber(pr, ['TotalQtyRequest'])
    const prQtyReceived = firstNumber(pr, ['TotalQtyReceived'])
    const prQtyOutstanding = firstNumber(pr, ['TotalQtyOutstanding'])
    const movementEvent = firstNumber(movement, ['TotalStockIssueMovementCount', 'TotalStockIssueEvent'])
    const movementQty = firstNumber(movement, ['TotalStockIssueMovementQty', 'TotalStockIssueQty'])
    const movementAmount = firstNumber(movement, ['TotalStockIssueMovementAmount', 'TotalStockIssueAmount'])
    // Source of truth = monthly RPTIN IssuedTotal (same report KPI "Issued total").
    const monthlyIssuedTotalAmount = firstNumber(movementMonthly, ['IssuedTotalAmount', 'IssuedAmount'])
    const monthlyIssuedTotalQtyRaw = firstNumber(movementMonthly, ['IssuedTotalQty'])
    const usageDocuments = firstNumber(usage, ['TotalDokumen', 'TotalIssueDocuments'])
    // Events/docs detail still from pengeluaran-barang; amount/qty lock ke monthly IssuedTotal.
    // Catatan: movement.TotalItem = total item stok, BUKAN item dipakai → jangan fallback items ke situ.
    const usageEventsRaw = firstNumber(usage, ['TotalBaris', 'TotalIssueEvents', 'totalbaris'])
    const usageEvents = usageEventsRaw
      || firstNumber(movement, ['TotalStockIssueMovementCount', 'TotalStockIssueEvent'])
    const usageItems = firstNumber(usage, ['TotalItem', 'TotalItemsUsed', 'totalitem', 'total_item'])
    const usageAmountFromUsage = firstNumber(usage, ['TotalAmount', 'TotalIssueAmount', 'totalamount'])
    const usageQtyFromUsage = firstNumber(usage, ['TotalQty', 'TotalIssueQty', 'totalqty'])
    // CEO: Total Usage = Issued total monthly stock movement analysis (bukan movement window).
    const usageAmount = monthlyIssuedTotalAmount || usageAmountFromUsage || movementAmount
    const usageQty = monthlyIssuedTotalQtyRaw || usageQtyFromUsage || movementQty
    // Proporsi per sumber tabel thd total (IN_STOCKISSUE / IN_FUELISSUE / WS_JOBSTOCK).
    const usageSourceSplit = usageAmount > 0
      ? {
          gudangPct: percentOf(gudangIssueAmount, usageAmountFromUsage || usageAmount),
          fuelPct: percentOf(usageFuelIssueAmount, usageAmountFromUsage || usageAmount),
          workshopPct: percentOf(workshopIssueAmount, usageAmountFromUsage || usageAmount),
        }
      : null
    // KPI return source = monthly inventory return (IN_STOCKRTN/LN + WS_JOBSTOCK TransType=2), not purchasing supplier return.
    const monthlyInventoryReturnAmount = firstNumber(movementMonthly, ['ReturnAmount'])
    const monthlyInventoryReturnQty = firstNumber(movementMonthly, ['ReturnQty'])
    const returnAmount = monthlyInventoryReturnAmount || firstNumber(stockReturn, ['TotalAmount', 'TotalReturnAmount'])
        const returnQty = monthlyInventoryReturnQty || firstNumber(stockReturn, ['TotalQtyReturn', 'TotalQty', 'TotalReturnQty'])
        const returnDocs = firstNumber(stockReturn, ['TotalDokumen', 'TotalReturnDocuments', 'TotalBaris'])
        const returnItems = firstNumber(stockReturn, ['TotalItem', 'TotalItems'])
        const returnRateValue = returnRate(returnAmount, usageAmount)
        const returnRatePct = formatPercent(returnRateValue * 100)
        const returnVsIssueQtyPct = usageQty > 0 ? formatPercent((returnQty / usageQty) * 100) : '0%'
        const returnVsIssueDocPct = usageDocuments > 0 ? formatPercent((returnDocs / usageDocuments) * 100) : '0%'
        const fuelProductTypeShare = fuelIssueAmount > 0 && topFuelProductType
          ? formatPercent((topFuelProductType.amount / fuelIssueAmount) * 100)
          : '0%'
        const regularMovement = firstNumber(movement, ['RegularStockIssueMovementCount'])
        const workshopMovement = firstNumber(movement, ['WorkshopStockIssueMovementCount'])
        const activeIssueDays = firstNumber(usage, ['ActiveIssueDays', 'activeissuedays'])
        const usageFreqPerDay = frequencyPerDay(usageEvents, activeIssueDays)
        const usageItemsLabel = usageItems > 0
          ? formatNumber(usageItems)
          : (snapshots.usage?.ok ? '0' : '—')
        const usageFreqLabel = activeIssueDays > 0
          ? `${formatNumber(usageEvents)} event · ${formatQuantity(usageFreqPerDay)}/hari`
          : `${formatNumber(usageEvents)} event`
  const topLists = snapshots.usage?.topLists
  const topDimensionRows = topLists?.[topDimension] ?? []
  const topRows = topDimensionRows.length > 0 ? topDimensionRows.slice(0, 5) : topUsageItems
  const TOP_DIMENSIONS: { id: 'items' | 'costCenters' | 'vehicles'; label: string }[] = [
    { id: 'items', label: 'Item' },
    { id: 'costCenters', label: 'Dept' },
    { id: 'vehicles', label: 'Kendaraan' },
  ]
  const usageTrend = snapshots.usage?.trend ?? []
  // Only mark failed after fetch finished and usage snapshot explicitly not ok.
  // During first load (no snapshot yet) charts should show loading, not fail banner.
  const usageFailed = !loading && snapshots.usage ? !snapshots.usage.ok : false
  const issueFrequency = snapshots.usage?.issueFrequency
  const issueFrequencyTop = (issueFrequency?.topItems ?? []).slice(0, 5)
  const monthlyOpeningQty = firstNumber(movementMonthly, ['OpeningQty'])
    const monthlyClosingQty = firstNumber(movementMonthly, ['ClosingQty'])
    const monthlyGoodsReceiveQty = firstNumber(movementMonthly, ['GoodsReceiveQty'])
    const monthlyLedgerQty = firstNumber(movementMonthly, ['LedgerQty'])
    const monthlyIssuedStationQty = firstNumber(movementMonthly, ['IssuedStationQty'])
    const monthlyIssuedVehicleQty = firstNumber(movementMonthly, ['IssuedVehicleQty'])
    const monthlyIssuedTotalQty = monthlyIssuedTotalQtyRaw || firstNumber(movementMonthly, ['IssuedTotalQty'])
    const monthlyQtyDelta = monthlyClosingQty - monthlyOpeningQty
    const hasMovementMonthly = monthlyOpeningQty + monthlyGoodsReceiveQty + monthlyLedgerQty + monthlyIssuedStationQty + monthlyIssuedVehicleQty + monthlyClosingQty > 0
  const insightItems = (() => {
    const items: string[] = []
    const trend = Array.isArray(usageTrend) ? usageTrend : []
    const last = trend.length > 0 ? Number((trend[trend.length - 1] as { qty?: number; quantity?: number })?.qty ?? (trend[trend.length - 1] as { quantity?: number })?.quantity ?? 0) : 0
    const prev3 = trend.slice(-4, -1).map((row) => Number((row as { qty?: number; quantity?: number })?.qty ?? (row as { quantity?: number })?.quantity ?? 0))
    const avg3 = prev3.length > 0 ? prev3.reduce((a, b) => a + b, 0) / prev3.length : 0
    if (avg3 > 0 && last > 0) {
      const pct = Math.round(((last - avg3) / avg3) * 100)
      if (pct !== 0) items.push(`Qty issue ${pct > 0 ? '+' : ''}${pct}% vs rata-rata 3 bulan`)
    }
    if (monthlyClosingQty > 0 && monthlyOpeningQty > 0 && monthlyClosingQty < monthlyOpeningQty) {
      items.push('Closing qty di bawah opening periode ini')
    }
    const topNames = new Set((topLists?.items ?? []).map((it) => String((it as { name?: string })?.name ?? '')))
    const fresh = (issueFrequency?.topItems ?? []).filter((it) => !topNames.has(String((it as { name?: string })?.name ?? '')))
    if (fresh.length > 0 && topNames.size > 0) items.push(`${fresh.length} item baru masuk Top movement`)
    if (usageDocuments > 0) items.push(`${formatNumber(usageDocuments)} dokumen issue · ${formatNumber(activeIssueDays)} hari aktif`)
    return items.slice(0, 5)
  })()

  const topIssueFreq = issueFrequencyTop[0]
  const topIssueFreqDocs = topIssueFreq ? Number(topIssueFreq.docs) || 0 : 0
  const flowStages: FlowStage[] = [
    {
      id: 'pr',
      label: 'PR',
      value: loading ? '…' : formatNumber(prCount),
      hint: `Req ${formatQuantity(prQtyRequest)} · Out ${formatQuantity(prQtyOutstanding)}`,
      tone: 'pr',
    },
    {
      id: 'po',
      label: 'PO',
      value: loading ? '…' : formatNumber(poCount),
      hint: `Order ${formatQuantity(poQtyOrder)} · Fill ${formatPercent(poFillRate(poQtyReceive, poQtyOrder) * 100)}`,
      tone: 'po',
    },
    {
      id: 'gr',
      label: 'Receive',
      value: loading ? '…' : formatNumber(receiveDocs),
      hint: `Qty ${formatQuantity(receiveQty)} · ${formatCurrencyCompact(receiveAmount)}`,
      tone: 'gr',
    },
    {
      id: 'issue',
      label: 'Issue',
      value: loading ? '…' : formatNumber(usageDocuments),
      hint: `Qty ${formatQuantity(usageQty)} · ${formatCurrencyCompact(usageAmount)}`,
      tone: 'issue',
    },
    {
      id: 'return',
      label: 'Return',
      value: loading ? '…' : formatCurrencyCompact(returnAmount),
      hint: `Rate ${formatPercent(returnRateValue * 100)} · ${activePeriodLabel}`,
      tone: 'return',
    },
  ]
  const flowLinks: Record<string, string> = {
    pr: filteredLinks.process,
    po: filteredLinks.process,
    gr: filteredLinks.receive,
    issue: filteredLinks.usage,
    return: filteredLinks.return,
  }

  const valuationDeltaLabel = openingValue > 0 || inventoryValue > 0
    ? `${valuationDelta >= 0 ? '+' : ''}${formatCurrency(valuationDelta)}${valuationDeltaPct === null ? '' : ` (${valuationDeltaPct >= 0 ? '+' : ''}${valuationDeltaPct.toFixed(2)}%)`}`
    : '—'
  const valuationDeltaTone = valuationDelta > 0
    ? 'text-emerald-200'
    : valuationDelta < 0
      ? 'text-rose-200'
      : 'text-[var(--rc-text-muted)]'
  const valuationCards: ProcurementKpiCard[] = [
    {
      id: 'stock',
      label: 'Total Valuasi Inventory',
      value: formatCurrency(inventoryValue),
      valueExact: formatCurrency(inventoryValue),
      description: `Current ${currentPeriodLabel} vs Opening ${openingPeriodLabel} · ${inventoryScopeLabel}. Balance, bukan pemakaian.`,
      formula: 'Current = SUM((QtyOnHand+QtyOnHold)×AvgCost). Opening = IN_MTHENDITEM periode sebelumnya.',
      source: `asset-stock-valuasi · ${inventoryScopeShort}`,
      tooltip: [
        `CURRENT (${currentPeriodLabel}) = ${formatCurrency(inventoryValue)}`,
        `OPENING (${openingPeriodLabel}) = ${formatCurrency(openingValue)}`,
        `DELTA = Current − Opening = ${formatCurrency(valuationDelta)}${valuationDeltaPct === null ? '' : ` (${valuationDeltaPct.toFixed(2)}%)`}`,
        '',
        `Scope: ${inventoryScopeLabel}`,
        'INI SISA STOK (balance), BUKAN pemakaian.',
        'Current: live IN_ITEM (bulan berjalan) atau IN_MTHENDITEM (histori).',
        'Opening: snapshot IN_MTHENDITEM accounting month sebelumnya.',
        '',
        `Gudang current: ${formatCurrency(gudangValue)} | opening: ${formatCurrency(openingGudangValue)}`,
        `Workshop current: ${formatCurrency(workshopValue)} | opening: ${formatCurrency(openingWorkshopValue)}`,
        '',
        'Beda dari Total Usage: valuasi = barang masih di rak; usage = barang sudah keluar periode.',
      ].join('\n'),
      breakdown: [
        { label: 'Current', value: `${formatCurrency(inventoryValue)} · ${currentPeriodLabel}` },
        { label: 'Opening', value: `${formatCurrency(openingValue)} · ${openingPeriodLabel}` },
        { label: 'Delta', value: valuationDeltaLabel },
        { label: 'Gudang', value: `${formatCurrency(gudangValue)} · OH ${formatQuantity(gudangOnHand)} / Hold ${formatQuantity(gudangOnHold)}` },
        { label: 'Workshop', value: `${formatCurrency(workshopValue)} · OH ${formatQuantity(workshopOnHand)} / Hold ${formatQuantity(workshopOnHold)}` },
        { label: 'Item valuasi', value: formatNumber(totalInventoryItem) },
      ],
      href: filteredLinks.stock,
      icon: Package,
      className: 'border-white/10 bg-white/[0.045] text-[var(--rc-text)]',
    },
    {
      id: 'gudang-value',
      label: 'Valuasi Gudang',
      value: formatCurrency(gudangValue),
      description: 'Hanya Gudang · ItemType 1. Sisa stok gudang, bukan issue.',
      formula: 'SUM((QtyOnHand+QtyOnHold)×AvgCost) where ItemType=1.',
      source: 'asset-stock-valuasi · Gudang saja',
      tooltip: [
        `VALUASI GUDANG = ${formatCurrency(gudangValue)}`,
        'Scope: Gudang saja (ItemType 1) — bukan workshop.',
        '',
        `On hand: ${formatQuantity(gudangOnHand)} = qty siap pakai di rak gudang.`,
        `On hold: ${formatQuantity(gudangOnHold)} = qty tertahan/reserved.`,
        `Item: ${formatNumber(gudangItem)}`,
        '',
        'Ini balance stok gudang. Bukan qty yang dipakai periode (itu di Total Usage).',
      ].join('\n'),
      breakdown: [
        { label: 'Scope', value: 'Gudang saja' },
        { label: 'Item Gudang', value: formatNumber(gudangItem) },
        { label: 'On hand', value: formatQuantity(gudangOnHand) },
        { label: 'On hold', value: formatQuantity(gudangOnHold) },
      ],
      href: filteredLinks.stock,
      icon: Layers3,
      className: 'border-white/10 bg-white/[0.045] text-[var(--rc-text)]',
    },
    {
      id: 'workshop',
      label: 'Valuasi Workshop',
      value: formatCurrency(workshopValue),
      description: 'Hanya Workshop · ItemType 4. Sisa stok workshop, bukan issue.',
      formula: 'SUM((QtyOnHand+QtyOnHold)×AvgCost) where ItemType=4.',
      source: 'asset-stock-valuasi · Workshop saja',
      tooltip: [
        `VALUASI WORKSHOP = ${formatCurrency(workshopValue)}`,
        'Scope: Workshop/Mesin saja (ItemType 4) — bukan gudang.',
        '',
        `On hand: ${formatQuantity(workshopOnHand)}`,
        `On hold: ${formatQuantity(workshopOnHold)}`,
        `Total qty: ${formatQuantity(workshopQty)} = OH + Hold workshop`,
        `Item: ${formatNumber(workshopItem || firstNumber(workshop, ['total_item', 'WorkshopItemCount', 'TotalItem']))}`,
        '',
        'Sisa stok workshop. Issue workshop (pemakaian) dihitung di Total Usage via WS_JOBSTOCK.',
      ].join('\n'),
      breakdown: [
        { label: 'Scope', value: 'Workshop saja' },
        { label: 'Item Workshop', value: formatNumber(workshopItem || firstNumber(workshop, ['total_item', 'WorkshopItemCount', 'TotalItem'])) },
        { label: 'On hand', value: formatQuantity(workshopOnHand) },
        { label: 'On hold', value: formatQuantity(workshopOnHold) },
        { label: 'Total qty', value: formatQuantity(workshopQty) },
      ],
      href: filteredLinks.workshop,
      icon: Wrench,
      className: 'border-white/10 bg-white/[0.045] text-[var(--rc-text)]',
    },
  ]

  const processCards: ProcurementKpiCard[] = [
    {
      id: 'receive-value',
      label: 'Nilai Goods Receive',
      value: formatCurrency(receiveAmount),
      description: 'Nilai barang MASUK dari supplier di periode (bukan issue).',
      formula: 'GR Amount = SUM(ReceiveQty × PO Cost).',
      source: 'goods-receiving-receipt-activity',
      tooltip: [
        `GOODS RECEIVE = ${formatCurrency(receiveAmount)}`,
        'Arah: MASUK gudang dari supplier — lawan dari Usage/Issue.',
        '',
        `Qty receive: ${formatQuantity(receiveQty)} unit fisik diterima.`,
        `Dokumen: ${formatNumber(receiveDocs)} · Supplier: ${formatNumber(receiveSupplier)}`,
        '',
        'Amount = qty × cost PO. Beda item/harga → amount & qty tidak sebanding 1:1.',
        'Ini bukan pemakaian. Pemakaian = Total Usage / Issue Amount.',
      ].join('\n'),
      breakdown: [
        { label: 'Dokumen receive', value: formatNumber(receiveDocs) },
        { label: 'Qty receive', value: formatQuantity(receiveQty) },
        { label: 'Supplier aktif', value: formatNumber(receiveSupplier) },
      ],
      href: filteredLinks.receive,
      icon: Truck,
      className: 'border-white/10 bg-white/[0.045] text-[var(--rc-text)]',
    },
    {
      id: 'pr-outstanding',
      label: 'PR Outstanding',
      value: formatQuantity(prQtyOutstanding),
      description: 'Sisa qty PR belum terpenuhi (proses, bukan stok/issue).',
      formula: 'PR Outstanding = SUM(Qty Outstanding) PR lines.',
      source: 'purchase-request-inventory',
      tooltip: [
        `PR OUTSTANDING QTY = ${formatQuantity(prQtyOutstanding)}`,
        'Antrian permintaan — belum stok, belum issue.',
        '',
        `Total PR: ${formatNumber(prCount)} · Qty request: ${formatQuantity(prQtyRequest)}`,
        `Nilai PR: ${formatCurrency(prAmount)}`,
        '',
        'Angka utama = QTY outstanding, bukan Rupiah.',
      ].join('\n'),
      breakdown: [
        { label: 'Total PR', value: formatNumber(prCount) },
        { label: 'Qty request', value: formatQuantity(prQtyRequest) },
        { label: 'Nilai PR', value: formatCurrency(prAmount) },
      ],
      href: filteredLinks.process,
      icon: ClipboardList,
      className: 'border-white/10 bg-white/[0.045] text-[var(--rc-text)]',
    },
    {
      id: 'po-outstanding',
      label: 'PO Outstanding',
      value: formatQuantity(poQtyOutstanding),
      description: 'Sisa qty PO belum diterima (proses, bukan issue).',
      formula: 'PO Outstanding = SUM(QtyOrder − QtyReceive). Fill = Receive/Order.',
      source: 'purchase-order-history',
      tooltip: [
        `PO OUTSTANDING QTY = ${formatQuantity(poQtyOutstanding)}`,
        'Sudah dipesan, belum masuk gudang.',
        '',
        `Order: ${formatQuantity(poQtyOrder)} · Receive: ${formatQuantity(poQtyReceive)}`,
        `Fill rate: ${formatPercent(poFillRate(poQtyReceive, poQtyOrder) * 100)}`,
        `Nilai PO: ${formatCurrency(poAmount)}`,
        '',
        'Bukan usage/issue. Setelah GR masuk, baru jadi stok on hand.',
      ].join('\n'),
      breakdown: [
        { label: 'Total PO', value: formatNumber(poCount) },
        { label: 'Qty order', value: formatQuantity(poQtyOrder) },
        { label: 'Nilai PO', value: formatCurrency(poAmount) },
        { label: 'Fill rate', value: formatPercent(poFillRate(poQtyReceive, poQtyOrder) * 100) },
      ],
      href: filteredLinks.process,
      icon: CircleDollarSign,
      className: 'border-white/10 bg-white/[0.045] text-[var(--rc-text)]',
    },
  ]

  const movementCards: ProcurementKpiCard[] = [
    {
          id: 'movement-total',
          label: 'Total Issue Movement',
          value: formatNumber(movementEvent),
          description: 'Jumlah EVENT/baris issue (bukan Rupiah, bukan qty fisik).',
          formula: 'Event = SUM(StockIssueEventCount) per item di window movement.',
          source: 'all-stock-movement-analysis · total event',
          tooltip: [
            `TOTAL ISSUE MOVEMENT = ${formatNumber(movementEvent)} EVENT`,
            'Ini HITUNGAN KEJADIAN, bukan amount & bukan qty.',
            '',
            `Regular (gudang): ${formatNumber(regularMovement)} event`,
            `Workshop: ${formatNumber(workshopMovement)} event`,
            `Dokumen usage: ${formatNumber(usageDocuments)}`,
            '',
            '=== ANALISIS RETURN ===',
            `Return docs: ${formatNumber(returnDocs)} · ${returnVsIssueDocPct} vs issue docs`,
            `Return amount: ${formatCurrency(returnAmount)} · rate ${returnRatePct} vs usage`,
            `Return qty: ${formatQuantity(returnQty)} · ${returnVsIssueQtyPct} vs issue qty`,
            '',
            '1 event ≈ 1 baris/transaksi issue per item di window movement.',
          ].join('\n'),
          breakdown: [
            { label: 'Regular', value: formatNumber(regularMovement) },
            { label: 'Workshop', value: formatNumber(workshopMovement) },
            { label: 'Return docs', value: `${formatNumber(returnDocs)} (${returnVsIssueDocPct})` },
            { label: 'Return rate', value: returnRatePct },
          ],
          href: filteredLinks.movement,
          icon: Gauge,
          className: 'border-white/10 bg-white/[0.045] text-[var(--rc-text)]',
        },
    {
          id: 'movement-qty',
          label: 'Issue Qty',
          value: formatQuantity(usageQty),
          description: 'Qty FISIK keluar (unit) = IssuedTotalQty monthly. Bukan Rupiah.',
          formula: 'Issue Qty = IssuedTotalQty (Ledger+Station+Vehicle) monthly-stock-account-movement-details.',
          source: 'monthly-stock-account-movement-details · IssuedTotalQty',
          tooltip: [
            `ISSUE QTY = ${formatQuantity(usageQty)} UNIT FISIK`,
            '= monthly IssuedTotalQty (sama sumber Total Usage amount).',
            '',
            `Issued monthly qty: ${formatQuantity(monthlyIssuedTotalQtyRaw)}`,
            `pengeluaran-barang qty: ${formatQuantity(usageQtyFromUsage)}`,
            `Movement window qty (MC): ${formatQuantity(movementQty)}`,
            `Event line: ${formatNumber(usageEvents)} · Docs: ${formatNumber(usageDocuments)}`,
          ].join('\n'),
          breakdown: [
                      { label: 'Issued monthly qty', value: formatQuantity(monthlyIssuedTotalQtyRaw) },
                      { label: 'Usage line qty', value: formatQuantity(usageQtyFromUsage) },
                      { label: 'Return qty', value: `${formatQuantity(returnQty)} (${returnVsIssueQtyPct})` },
                      { label: 'Issue docs', value: formatNumber(usageDocuments) },
                    ],
          href: filteredLinks.movement,
          icon: Package,
          className: 'border-white/10 bg-white/[0.045] text-[var(--rc-text)]',
        },
    {
          id: 'movement-amount',
          label: 'Issue Amount',
          value: formatCurrency(usageAmount),
          description: 'Nilai UANG issue (Rp) = IssuedTotal monthly RPTIN. Sama Total Usage.',
          formula: 'Issue Amount = IssuedTotalAmount (Ledger+Station+Vehicle+fuel+ws) dari monthly-stock-account-movement-details.',
          source: `monthly-stock-account-movement-details · IssuedTotalAmount · ${kpiTimelineRange.label}`,
          tooltip: [
            `ISSUE AMOUNT = ${formatCurrency(usageAmount)}`,
            `= Total Usage = monthly IssuedTotalAmount`,
            `Timeline KPI: ${kpiTimelineRange.label}`,
            '',
            `IssuedTotal monthly: ${formatCurrency(monthlyIssuedTotalAmount)}`,
            `pengeluaran-barang (detail split): ${formatCurrency(usageAmountFromUsage)}`,
            `Movement window (MC only): ${formatCurrency(movementAmount)}`,
            `Qty issued monthly: ${formatQuantity(usageQty)}`,
            '',
            '=== SPLIT DETAIL (pengeluaran-barang) ===',
            `Gudang · IN_STOCKISSUE: ${formatCurrency(gudangIssueAmount)}`,
            `Fuel BBM · IN_FUELISSUE: ${formatCurrency(usageFuelIssueAmount)}`,
            `Workshop · WS_JOBSTOCK: ${formatCurrency(workshopIssueAmount)}`,
            '',
            'MC / all-stock-movement-analysis amount = klasifikasi Fast/Slow saja — bukan KPI money.',
          ].join('\n'),
          breakdown: [
                      { label: 'IssuedTotal monthly', value: formatCurrency(monthlyIssuedTotalAmount) },
                      { label: 'Return amount', value: `${formatCurrency(returnAmount)} (${returnRatePct})` },
                      { label: 'Gudang · IN_STOCKISSUE', value: formatCurrency(gudangIssueAmount) },
                      { label: 'Fuel · IN_FUELISSUE', value: formatCurrency(usageFuelIssueAmount) },
                      { label: 'Workshop · WS_JOBSTOCK', value: formatCurrency(workshopIssueAmount) },
                    ],
          href: filteredLinks.movement,
          icon: CircleDollarSign,
          className: 'border-white/10 bg-white/[0.045] text-[var(--rc-text)]',
        },
    {
          id: 'movement-frequency',
          label: 'Frekuensi Issue',
          value: formatNumber(usageDocuments),
          description: 'Jumlah DOKUMEN issue unik + frekuensi return (bukan amount).',
          formula: 'Docs issue = COUNT(DISTINCT Dokumen); return docs = COUNT(DISTINCT StockRtnID).',
          source: 'pengeluaran-barang + return-barang · frekuensi',
          tooltip: [
            `FREKUENSI ISSUE = ${formatNumber(usageDocuments)} DOKUMEN`,
            `FREKUENSI RETURN = ${formatNumber(returnDocs)} DOKUMEN (${returnVsIssueDocPct} vs issue)`,
            '',
            `Hari aktif issue: ${formatNumber(activeIssueDays)}`,
            `Doc/hari: ${formatQuantity(activeIssueDays > 0 ? usageDocuments / activeIssueDays : 0)}`,
            `Event line issue: ${formatNumber(usageEvents)}`,
            `Return qty: ${formatQuantity(returnQty)} · amount ${formatCurrency(returnAmount)}`,
            '',
            'Return = IN_STOCKRTN (kembali ke gudang), bukan retur supplier.',
          ].join('\n'),
          breakdown: [
            { label: 'Issue docs', value: formatNumber(usageDocuments) },
            { label: 'Return docs', value: `${formatNumber(returnDocs)} (${returnVsIssueDocPct})` },
            { label: 'Return qty', value: formatQuantity(returnQty) },
            { label: 'Doc/hari', value: formatQuantity(activeIssueDays > 0 ? usageDocuments / activeIssueDays : 0) },
          ],
          href: filteredLinks.return,
          icon: Gauge,
          className: 'border-white/10 bg-white/[0.045] text-[var(--rc-text)]',
        },
    {
      id: 'movement-open-close-qty',
      label: 'Opening vs Closing Qty',
      value: formatQuantity(monthlyClosingQty),
      description: 'Saldo qty bulanan (ledger), bukan issue amount.',
      formula: 'Delta = ClosingQty − OpeningQty (monthly stock movement).',
      source: 'monthly-stock-account-movement-details',
      tooltip: [
        `CLOSING QTY = ${formatQuantity(monthlyClosingQty)}`,
        `Opening: ${formatQuantity(monthlyOpeningQty)} · Delta: ${monthlyQtyDelta >= 0 ? '+' : ''}${formatQuantity(monthlyQtyDelta)}`,
        '',
        'Ini saldo qty bulan (opening→closing), unit fisik.',
        'Bukan Issue Amount (Rp) dan bukan frekuensi dokumen.',
      ].join('\n'),
      breakdown: [
        { label: 'Opening qty', value: formatQuantity(monthlyOpeningQty) },
        { label: 'Closing qty', value: formatQuantity(monthlyClosingQty) },
        { label: 'Delta', value: `${monthlyQtyDelta >= 0 ? '+' : ''}${formatQuantity(monthlyQtyDelta)}` },
      ],
      href: filteredLinks.movement,
      icon: Layers3,
      className: 'border-white/10 bg-white/[0.045] text-[var(--rc-text)]',
    },
    {
      id: 'movement-gr-qty',
      label: 'Goods Receive Qty',
      value: formatQuantity(monthlyGoodsReceiveQty),
      description: 'Qty MASUK bulanan (unit), dari ledger movement.',
      formula: 'GoodsReceiveQty monthly; net ≈ GR − IssuedTotal.',
      source: 'monthly-stock-account-movement-details',
      tooltip: [
        `GR QTY (monthly) = ${formatQuantity(monthlyGoodsReceiveQty)} UNIT`,
        `Issued total: ${formatQuantity(monthlyIssuedTotalQty)}`,
        `Net (GR − issued): ${formatQuantity(monthlyGoodsReceiveQty - monthlyIssuedTotalQty)}`,
        '',
        'Qty masuk ledger bulan. Bukan nilai Rupiah receive card proses.',
      ].join('\n'),
      breakdown: [
        { label: 'Issued total qty', value: formatQuantity(monthlyIssuedTotalQty) },
        { label: 'Net qty (GR − issued)', value: formatQuantity(monthlyGoodsReceiveQty - monthlyIssuedTotalQty) },
      ],
      href: filteredLinks.movement,
      icon: Truck,
      className: 'border-white/10 bg-white/[0.045] text-[var(--rc-text)]',
    },
    {
      id: 'movement-issued-split',
      label: 'Issued Qty Split',
      value: formatQuantity(monthlyIssuedTotalQty),
      description: 'Pecahan qty issue: ledger / station / vehicle.',
      formula: 'IssuedTotal = Ledger + Station + Vehicle (qty).',
      source: 'monthly-stock-account-movement-details',
      tooltip: [
        `ISSUED TOTAL QTY = ${formatQuantity(monthlyIssuedTotalQty)}`,
        `Ledger: ${formatQuantity(monthlyLedgerQty)}`,
        `Station: ${formatQuantity(monthlyIssuedStationQty)}`,
        `Vehicle: ${formatQuantity(monthlyIssuedVehicleQty)}`,
        '',
        'Semua unit fisik. Untuk nilai uang lihat Issue Amount / Total Usage.',
      ].join('\n'),
      breakdown: [
        { label: 'Ledger qty', value: formatQuantity(monthlyLedgerQty) },
        { label: 'Station qty', value: formatQuantity(monthlyIssuedStationQty) },
        { label: 'Vehicle qty', value: formatQuantity(monthlyIssuedVehicleQty) },
      ],
      href: filteredLinks.movement,
      icon: Package,
      className: 'border-white/10 bg-white/[0.045] text-[var(--rc-text)]',
    },
    {
      id: 'movement-top-frequency',
      label: 'Paling Sering Di-issue',
      value: topIssueFreq ? (topIssueFreq.code ?? topIssueFreq.name ?? '—') : '—',
      description: 'Item tersering by COUNT dokumen (bukan amount terbesar).',
      formula: 'Top = item dengan COUNT(DISTINCT Dokumen) issue tertinggi.',
      source: 'pengeluaran-barang · issueFrequency.topItems',
      tooltip: [
        `TOP FREQUENCY = ${topIssueFreq ? (topIssueFreq.code ?? topIssueFreq.name ?? '—') : '—'}`,
        `Nama: ${topIssueFreq?.name ?? '—'}`,
        `Doc issue: ${formatNumber(topIssueFreqDocs)} · Event: ${formatNumber(topIssueFreq ? Number(topIssueFreq.events) || 0 : 0)}`,
        '',
        'Diurut frekuensi dokumen, BUKAN amount.',
        'Item sering keluar kecil-kecil bisa kalah amount vs item jarang tapi mahal.',
      ].join('\n'),
      breakdown: [
        { label: 'Doc issue', value: formatNumber(topIssueFreqDocs) },
        { label: 'Nama item', value: topIssueFreq?.name ?? '—' },
        { label: 'Event line', value: formatNumber(topIssueFreq ? Number(topIssueFreq.events) || 0 : 0) },
      ],
      href: filteredLinks.movement,
      icon: TrendingUp,
      className: 'border-white/10 bg-white/[0.045] text-[var(--rc-text)]',
    },
  ]

  const usageOnHand = inventoryScope === 'gudang' ? gudangOnHand
    : inventoryScope === 'workshop' ? workshopOnHand
      : totalOnHand
  const usageOnHold = inventoryScope === 'gudang' ? gudangOnHold
    : inventoryScope === 'workshop' ? workshopOnHold
      : totalOnHold

  const heroCards: ProcurementKpiCard[] = [
    valuationCards[0],
    {
          id: 'total-usage',
          label: 'Total Usage (Stock + Fuel + Job)',
          value: formatCurrency(usageAmount),
          valueExact: formatCurrency(usageAmount),
          description: `= IssuedTotal monthly RPTIN · ${usageScopeNote}. Sama Issue Amount KPI.`,
          formula: 'Total Usage = IssuedTotalAmount monthly-stock-account-movement-details (Ledger+Station+Vehicle; stock Acc + fuel DocDate + ws Acc).',
          source: `monthly-stock-account-movement-details · IssuedTotalAmount · ${kpiTimelineRange.label}`,
          tooltip: [
                      `TOTAL USAGE = ${formatCurrency(usageAmount)}`,
                      '= monthly IssuedTotalAmount (report monthly stock account movement).',
                      `Scope: ${inventoryScopeLabel}`,
                      `Timeline KPI: ${kpiTimelineRange.label}`,
                      '',
                      `IssuedTotal monthly: ${formatCurrency(monthlyIssuedTotalAmount)}`,
                      `pengeluaran-barang (line audit): ${formatCurrency(usageAmountFromUsage)}`,
                      '',
                      '=== SPLIT DETAIL (pengeluaran-barang, audit) ===',
                      `1) Gudang · IN_STOCKISSUE: ${formatCurrency(gudangIssueAmount)} (${formatPercent(usageSourceSplit?.gudangPct ?? 0)}) · Qty ${formatQuantity(gudangIssueQty)} · Dok ${formatNumber(gudangIssueDocs)}`,
                      `2) Fuel BBM · IN_FUELISSUE: ${formatCurrency(usageFuelIssueAmount)} (${formatPercent(usageSourceSplit?.fuelPct ?? 0)}) · Qty ${formatQuantity(usageFuelIssueQty)} · Dok ${formatNumber(usageFuelIssueDocs)}`,
                      `3) Workshop · WS_JOBSTOCK: ${formatCurrency(workshopIssueAmount)} (${formatPercent(usageSourceSplit?.workshopPct ?? 0)}) · Qty ${formatQuantity(workshopIssueQty)} · Dok ${formatNumber(workshopIssueDocs)}`,
                      '',
                      '=== ANALISIS RETURN INVENTORY (monthly ReturnAmount) ===',
                      `Return amount: ${formatCurrency(returnAmount)} · rate ${returnRatePct} vs usage`,
                      `Return qty: ${formatQuantity(returnQty)} · ${returnVsIssueQtyPct} vs issue qty`,
                      'Source KPI: monthly-stock-account-movement-details.ReturnAmount = IN_STOCKRTN/LN + WS_JOBSTOCK TransType=2.',
                      `Return-barang drilldown docs: ${formatNumber(returnDocs)} · item ${formatNumber(returnItems)}`,
                      '',
                      `Qty issue: ${formatQuantity(usageQty)} · Item: ${usageItemsLabel} · ${usageFreqLabel}`,
                    ].join('\n'),
                    breakdown: [
                      { label: 'IssuedTotal monthly', value: formatCurrency(monthlyIssuedTotalAmount) },
                      { label: 'Return', value: `${formatCurrency(returnAmount)} (${returnRatePct})` },
                      { label: 'Gudang', value: `${formatCurrency(gudangIssueAmount)} (${formatPercent(usageSourceSplit?.gudangPct ?? 0)})` },
                      { label: 'Fuel BBM', value: `${formatCurrency(usageFuelIssueAmount)} (${formatPercent(usageSourceSplit?.fuelPct ?? 0)})` },
                      { label: 'Workshop', value: `${formatCurrency(workshopIssueAmount)} (${formatPercent(usageSourceSplit?.workshopPct ?? 0)})` },
                      { label: 'Return qty/docs', value: `${formatQuantity(returnQty)} · ${formatNumber(returnDocs)} dok` },
                    ],
          href: filteredLinks.usage,
          icon: Package,
          className: 'border-emerald-300/20 bg-emerald-400/[0.06] text-[var(--rc-text)]',
          spark: (Array.isArray(usageTrend) ? usageTrend : []).map((t) => Number(t?.amount ?? 0)).filter((v) => Number.isFinite(v)),
        },
    {
          id: 'fuel-issue',
          label: 'Fuel Issue (BBM)',
          value: !fuelSnapshotOk && !loading ? '—' : formatCurrency(fuelIssueAmount),
          valueExact: formatCurrency(fuelIssueAmount),
          description: !fuelSnapshotOk && !loading
            ? `Snapshot fuel gagal · cek source ${source} / gateway. Bukan Total Usage.`
            : fuelHasRows
              ? `Product type top: ${topFuelProductType ? `${topFuelProductType.code} · ${fuelProductTypeShare}` : '—'} · ${source} · ${kpiTimelineRange.label}.`
              : `0 baris fuel di ${source} · ${kpiTimelineRange.label}${filters.location ? ` · loc ${filters.location}` : ''}.`,
          formula: 'Fuel Issue = SUM(line Amount) DocDate. Breakdown KPI = chart product type (IN_ITEM.ProdTypeCode).',
          source: `fuel-usage · product type · ${source} · ${kpiTimelineRange.label}${filters.location ? ` · ${filters.location}` : ''}`,
          tooltip: [
            `FUEL ISSUE = ${formatCurrency(fuelIssueAmount)}`,
            `Snapshot ok: ${fuelSnapshotOk ? 'yes' : 'no'} · Source: ${source}`,
            `Timeline: ${kpiTimelineRange.label}`,
            filters.location ? `Location filter: ${filters.location}` : 'Location filter: (all)',
            '',
            `Qty fuel: ${formatQuantity(fuelIssueQty)}`,
            `Dokumen: ${formatNumber(fuelIssueDocs)} · Baris: ${formatNumber(fuelIssueLines)}`,
            '',
            '=== PRODUCT TYPE (charge item fuel) ===',
            ...(fuelProductTypeRows.length > 0
              ? fuelProductTypeRows.slice(0, 8).map((row, idx) => {
                  const share = fuelIssueAmount > 0 ? formatPercent((row.amount / fuelIssueAmount) * 100) : '0%'
                  return `${idx + 1}) ${row.code} · ${row.name}: ${formatCurrency(row.amount)} (${share}) · qty ${formatQuantity(row.qty)} · ${formatNumber(row.docs)} dok`
                })
              : ['(belum ada baris product type di chart fuel)']),
            '',
            'Sudah digabung ke Total Usage. Product type = master item, bukan Blk/Veh charge.',
          ].join('\n'),
          breakdown: [
            {
              label: 'Top product type',
              value: topFuelProductType
                ? `${topFuelProductType.code} · ${fuelProductTypeShare}`
                : (fuelSnapshotOk ? '—' : 'snapshot fail'),
            },
            {
              label: topFuelProductType ? topFuelProductType.name : 'Product types',
              value: topFuelProductType
                ? formatCurrency(topFuelProductType.amount)
                : formatNumber(fuelProductTypeRows.length),
            },
            { label: 'Qty fuel', value: formatQuantity(fuelIssueQty) },
            { label: 'Dokumen', value: formatNumber(fuelIssueDocs) },
            ...(fuelProductTypeRows.slice(1, 3).map((row) => ({
              label: row.code || row.name,
              value: `${formatCurrencyCompact(row.amount)} (${fuelIssueAmount > 0 ? formatPercent((row.amount / fuelIssueAmount) * 100) : '0%'})`,
            }))),
          ],
          href: filteredLinks.fuel,
          icon: Fuel,
          className: fuelHasRows
            ? 'border-amber-300/25 bg-amber-400/[0.07] text-[var(--rc-text)]'
            : 'border-rose-300/25 bg-rose-400/[0.06] text-[var(--rc-text)]',
        },
      ]

      const partial = Object.values(snapshots).some((snapshot) => snapshot && !snapshot.ok)
      const headlineCard = heroCards[0] ? withCheckSql(heroCards[0]) : heroCards[0]
      const heroSideCards = heroCards.slice(1).filter((card) => card.id === 'total-usage')
      const fuelIssueCards = heroCards.filter((card) => card.id === 'fuel-issue')
      const valuationSideCards = valuationCards.slice(1)
      // Panel "Jumlah Issue" yang selalu terlihat — ringkasan hitungan issue periode terpilih.
      const issueCountCards: ProcurementKpiCard[] = [
        movementCards[0], // Total Issue Movement (event)
        movementCards[1], // Issue Qty (unit fisik)
        movementCards[3], // Frekuensi Issue (dokumen) + return
        movementCards[7], // Paling Sering Di-issue
      ].filter(Boolean)

      // Pita KPI berjalan ala bursa — jumlah issue + metrik utama periode terpilih.
      const usageSpark = (Array.isArray(usageTrend) ? usageTrend : []).map((t) => Number(t?.amount ?? 0)).filter((v) => Number.isFinite(v))
      const usageDeltaPct = usageSpark.length > 1 && usageSpark[usageSpark.length - 2] !== 0
        ? ((usageSpark[usageSpark.length - 1] - usageSpark[usageSpark.length - 2]) / Math.abs(usageSpark[usageSpark.length - 2])) * 100
        : undefined
      const marketTickerItems: MarketTickerItem[] = [
        { label: 'Issue Event', value: formatNumber(movementEvent) },
        { label: 'Issue Qty', value: formatQuantity(usageQty) },
        { label: 'Issue Amount', value: formatCurrencyCompact(usageAmount) },
        { label: 'Dokumen', value: formatNumber(usageDocuments) },
        { label: 'Return', value: formatCurrencyCompact(returnAmount), deltaPct: returnRateValue * 100 },
        { label: 'Return docs', value: formatNumber(returnDocs) },
        { label: 'Total Usage', value: formatCurrencyCompact(usageAmount), deltaPct: usageDeltaPct },
        { label: 'Fuel Issue', value: formatCurrencyCompact(fuelIssueAmount) },
        { label: 'Fuel PT', value: topFuelProductType ? (topFuelProductType.code || topFuelProductType.name) : '—' },
        { label: 'Top', value: topIssueFreq ? (topIssueFreq.code ?? topIssueFreq.name ?? '—') : '—' },
      ]
  const gudangShare = Math.min(Math.max(percentOf(gudangValue, inventoryValue), 0), 100)
  const workshopShare = Math.min(Math.max(percentOf(workshopValue, inventoryValue), 0), 100)

  const renderCardItems = (cards: ProcurementKpiCard[], variant: 'headline' | 'standard' = 'standard') =>
    cards.map((card, cardIndex) => {
        const Icon = card.icon
        const tone = cardTitleTone(card.id)
        const exact = card.valueExact ?? card.value
        const isHeadline = variant === 'headline'
        const cardWithSql = withCheckSql(card)
        const radius = isHeadline ? 'rounded-[24px]' : 'rounded-[22px]'
        return (
          <Link
            key={card.id}
            href={card.href}
            title={cardTooltip(cardWithSql)}
            aria-label={`${card.label}: ${exact}. ${card.description}`}
            className={isHeadline
              ? `rc-kpi-surface rc-reveal group/card relative isolate flex h-full min-h-[168px] min-w-0 max-w-full flex-col overflow-hidden ${radius} p-4 pt-5`
              : `rc-kpi-surface rc-reveal group/card relative isolate flex h-full min-h-[156px] min-w-0 max-w-full flex-col overflow-hidden ${radius} p-3 pt-4`}
            style={{ '--reveal-order': cardIndex } as React.CSSProperties}
          >
            <button
              type="button"
              onClick={(event) => openKpiSql(event, cardWithSql)}
              title="Lihat SQL / tabel / field KPI ini"
              className="rc-sql-debug absolute right-2 top-2 z-[5] rounded-md border border-white/15 bg-black/60 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/75 opacity-0 transition-opacity hover:bg-black/75 hover:text-white focus-visible:opacity-100 group-hover/card:opacity-100 group-focus-within/card:opacity-100"
            >
              SQL
            </button>
            <span className="rc-kpi-glow" aria-hidden="true">
              <span className="absolute -right-6 -top-8 h-16 w-16 rounded-full bg-white/10 blur-2xl transition group-hover/card:bg-[var(--rc-forest-primary)]/20" />
            </span>
            <span className="relative z-[1] flex min-w-0 items-start justify-between gap-2 pr-8">
              <span className="min-w-0 flex-1 overflow-hidden">
                {isHeadline ? (
                  <span className="rc-data inline-flex max-w-full items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[var(--rc-text-faint)]">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dotClass}`} />
                    <span className="truncate">{card.label}</span>
                  </span>
                ) : (
                  <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold normal-case tracking-normal ${tone.pillClass}`}>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dotClass}`} />
                    <span className="truncate">{card.label}</span>
                  </span>
                )}
                <strong
                  className={isHeadline
                    ? 'rc-display mt-2 block min-w-0 break-words text-[1.85rem] font-bold leading-none text-[var(--rc-text)] sm:text-[2.1rem]'
                    : 'rc-metric mt-1.5 block min-w-0 break-words text-[1.02rem] font-semibold leading-tight text-[var(--rc-text)] sm:text-[1.1rem]'}
                  title={cardTooltip(card)}
                >
                  {loading ? '...' : card.value}
                </strong>
              </span>
              <span className={isHeadline
                ? `grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${card.className}`
                : `grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${card.className}`}>
                <Icon size={isHeadline ? 20 : 15} />
              </span>
            </span>
            <span className={isHeadline
              ? 'relative z-[1] mt-2 line-clamp-2 min-w-0 text-xs leading-4 text-[var(--rc-text-muted)]'
              : 'relative z-[1] mt-1.5 line-clamp-2 min-w-0 text-[11px] leading-4 text-[var(--rc-text-muted)]'}>
              {loading ? 'Menunggu response gateway' : card.description}
            </span>
            {card.spark && card.spark.length > 1 ? (
              <span className="relative z-[1] mt-2 flex min-w-0 items-center gap-2 overflow-hidden">
                <Sparkline values={card.spark} width={isHeadline ? 120 : 88} height={isHeadline ? 28 : 22} />
                {(() => {
                  const last = card.spark[card.spark.length - 1]
                  const prev = card.spark[card.spark.length - 2]
                  if (!Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) return null
                  const pct = ((last - prev) / Math.abs(prev)) * 100
                  const up = pct >= 0
                  return (
                    <span
                      className={`rc-data inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        up ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'
                      }`}
                      title={`Perubahan vs periode sebelumnya (${formatPercent(Math.abs(pct))})`}
                    >
                      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
                    </span>
                  )
                })()}
                <MomentumDelta values={card.spark} />
              </span>
            ) : null}
            <span className="relative z-[1] mt-2 flex min-w-0 flex-wrap content-start gap-1 overflow-hidden">
              {(isHeadline ? card.breakdown.slice(0, 6) : card.breakdown.slice(0, 5)).map((item) => (
                <span key={item.label} className="rc-chip max-w-[100%]">
                  <span className="shrink-0">{item.label}: </span>
                  <strong className="min-w-0 truncate" title={String(item.value)}>{loading ? '...' : item.value}</strong>
                </span>
              ))}
            </span>
            <span className="rc-hairline rc-data relative z-[1] mt-auto flex min-w-0 items-center justify-between gap-2 pt-2 text-[10px] text-[var(--rc-text-faint)]">
              <span className="min-w-0 truncate">{loading ? 'Loading' : card.source}</span>
              <ArrowRight size={13} className="shrink-0 text-[var(--rc-forest-accent)]" />
            </span>
          </Link>
        )
      })

  const renderCardGrid = (cards: ProcurementKpiCard[]) => (
    <div className={`rc-kpi-grid ${
      cards.length <= 1
        ? 'grid-cols-1'
        : cards.length === 2
          ? 'grid-cols-1 sm:grid-cols-2'
          : cards.length === 4
            ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-2'
            : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
    }`}>
      {renderCardItems(cards)}
    </div>
  )

  const sectionCards = (
    openSection === 'proses' ? processCards
      : openSection === 'movement' ? movementCards
        : valuationSideCards
  ).map(withCheckSql)

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[var(--rc-forest-border)] bg-[radial-gradient(circle_at_8%_0%,rgba(155,226,61,.18),transparent_28%),radial-gradient(circle_at_90%_8%,rgba(41,199,200,.16),transparent_25%),linear-gradient(135deg,rgba(2,10,7,.94),rgba(7,25,17,.9)_46%,rgba(10,14,7,.92))] shadow-[0_26px_90px_rgba(0,0,0,.34)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,.08),transparent_18%,transparent_72%,rgba(155,226,61,.08))]" aria-hidden="true" />
      <div className="relative z-10 flex flex-col gap-2 border-b border-[var(--rc-border)] bg-black/10 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="rc-display text-xl font-bold text-[var(--rc-text)] sm:text-2xl">Procurement command deck</h2>
          <p className="mt-1 max-w-4xl text-xs font-semibold leading-5 text-[var(--rc-text-muted)]">
            KPI atas = periode terpilih saja ({kpiTimelineRange.label}). Movement Category di bawah = lookback terpisah (bukan KPI).
          </p>
        </div>
        <span className="w-fit rounded-full border border-[var(--rc-forest-border-strong)] bg-[rgba(155,226,61,.08)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--rc-forest-accent)]">
          {loading ? 'Mengambil summary live' : partial ? 'Live sebagian, fallback aktif' : 'Live dari SQL Gateway'}
        </span>
        <Link
          href={`/report-center/control?source=${source}`}
          className="inline-flex w-fit items-center gap-1.5 rounded-full border-[var(--rc-forest-border)] bg-[rgba(155,226,61,.06)] px-3 py-1.5 text-[11px] font-bold text-[var(--rc-forest-accent)] transition hover:bg-[rgba(155,226,61,.14)]"
          title="Bangun & kelola agregasi KPI bulanan pre-rendered"
        >
          Ruang kontrol agregasi
          <ArrowRight size={12} />
        </Link>
      </div>

      <div className="relative z-10 border-b border-[var(--rc-border)] bg-[rgba(2,10,7,.42)] px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-[var(--rc-text-faint)]">Filter analisis dipindah ke ruang khusus agar deck tetap fokus ke insight.</p>
          <button
            type="button"
            onClick={() => setAnalysisOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border-[var(--rc-forest-accent)] bg-[var(--rc-forest-accent)] px-4 text-xs font-black uppercase tracking-[0.12em] text-[#04130c] transition hover:brightness-110"
          >
            <SlidersHorizontal size={14} />
            Ruang Analisis
          </button>
        </div>

        {!isYearMode ? (
          <div className="mt-2">
            <PeriodScrubber
              value={filters.period}
              onSelect={(period) => updateFilter('period', period)}
              isCurrentPeriod={isCurrentPeriod}
            />
          </div>
        ) : null}

        <div
          className={`mt-2 rounded-2xl border px-3 py-2 ${
            isCurrentPeriod
              ? 'border-sky-300/30 bg-sky-400/[0.10]'
              : 'border-amber-300/30 bg-amber-400/[0.10]'
          }`}
          role="status"
          aria-label="Timeline KPI aktif"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-[10px] font-black uppercase tracking-[0.14em] ${isCurrentPeriod ? 'text-sky-100/85' : 'text-amber-100/85'}`}>
              Timeline KPI atas (wajib seperiode)
            </p>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${periodKindBadge.tone}`}>
              <span className={`h-2 w-2 rounded-full ${isCurrentPeriod ? 'bg-sky-300 animate-pulse' : 'bg-amber-300'}`} />
              {periodKindBadge.short}
            </span>
          </div>
          <p className={`mt-1 text-sm font-bold ${isCurrentPeriod ? 'text-sky-50' : 'text-amber-50'}`}>{kpiTimelineBadge}</p>
          <p className={`mt-0.5 text-[11px] font-semibold ${isCurrentPeriod ? 'text-sky-100/75' : 'text-amber-100/75'}`}>
            {isCurrentPeriod
              ? 'CURRENT aktif: live balance. Total Usage · Issue · Receive · PR/PO ikut period ini.'
              : 'PAST aktif: snapshot monthend. Total Usage · Issue · Receive · PR/PO ikut period ini.'}
            {' '}Movement Category (bawah) lookback terpisah.
          </p>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--rc-text-faint)]" aria-label="Active filter context">
          <span
            className={`rounded-full border px-2.5 py-1 ${
              isCurrentPeriod
                ? 'border-sky-300/30 bg-sky-400/15 text-sky-100'
                : 'border-amber-300/30 bg-amber-400/15 text-amber-100'
            }`}
            title={`KPI period: ${kpiTimelineRange.label}`}
          >
            Period {activePeriodLabel}{isYearMode ? '' : ` · ${filters.period}`}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 font-black ${periodKindBadge.tone}`}
            title={isCurrentPeriod
              ? 'Periode CURRENT: KPI memakai balance live (monthend belum terbentuk).'
              : 'Periode PAST: KPI memakai snapshot monthend (IN_MTHENDITEM) — data sudah closing.'}
          >
            {periodKindBadge.label}
          </span>
          <span
            className="rounded-full border border-sky-300/25 bg-sky-400/10 px-2.5 py-1 text-sky-100"
            title={`KPI timeline locked: ${kpiTimelineRange.from} → ${kpiTimelineRange.to}`}
          >
            KPI {kpiTimelineRange.from} → {kpiTimelineRange.to}
          </span>
          <span
            className="rounded-full border border-violet-300/25 bg-violet-400/10 px-2.5 py-1 text-violet-100"
            title="Movement Category analysis di section bawah — lookback multi-bulan terpisah dari KPI."
          >
            MC analysis · lookback terpisah
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">Group {selectedGroup.label}</span>
          <span
            className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-emerald-100"
            title="Default analisis = Gudang + Workshop. Filter itemType mempersempit ke salah satu."
          >
            {inventoryScopeLabel}
          </span>
          {filters.scopeCode ? <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">Code {filters.scopeCode}</span> : null}
          {filters.location ? <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">Lokasi {filters.location}</span> : null}
        </div>

        {insightItems.length > 0 ? (
          <div className="mt-2">
            <InsightTicker items={insightItems} />
          </div>
        ) : null}
      </div>

      <div className="relative z-10 border-b border-[var(--rc-border)] px-3 py-3">
        <p className="mb-2 text-[11px] font-semibold text-[var(--rc-text-faint)]">
          Alur proses · periode {activePeriodLabel} · klik tahap untuk buka detail
        </p>
        <ProcurementFlowStrip
          stages={flowStages}
          onSelect={(stageId) => {
            const href = flowLinks[stageId]
            if (href) window.location.href = href
          }}
        />
      </div>

      <div className="relative z-10 grid min-w-0 items-stretch gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          {headlineCard ? (
            <Link
              href={headlineCard.href}
              title={cardTooltip(headlineCard)}
              aria-label={`${headlineCard.label}: ${headlineCard.valueExact ?? headlineCard.value}. ${headlineCard.description}`}
              className="rc-kpi-surface rc-reveal group/card relative isolate flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-[24px] border border-emerald-300/25 bg-[linear-gradient(145deg,rgba(24,185,107,.2),rgba(4,18,12,.72)_52%,rgba(214,184,92,.13))] p-3.5 pt-5 shadow-[inset_0_1px_0_rgba(255,255,255,.12)] transition hover:border-[var(--rc-forest-border-strong)]"
            >
              <button
                type="button"
                onClick={(event) => openKpiSql(event, headlineCard)}
                title="Lihat SQL / tabel / field KPI valuasi"
                className="rc-sql-debug absolute right-2.5 top-2.5 z-[5] rounded-md border border-white/15 bg-black/60 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/75 opacity-0 transition-opacity hover:bg-black/75 hover:text-white focus-visible:opacity-100 group-hover/card:opacity-100 group-focus-within/card:opacity-100"
              >
                SQL
              </button>
              <span className="rc-kpi-glow" aria-hidden="true">
                <span className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-emerald-300/18 blur-3xl transition group-hover/card:bg-lime-300/22" />
              </span>

              <span className="relative z-[1] flex min-w-0 items-start justify-between gap-2 pr-8">
                <span className="min-w-0 flex-1 overflow-hidden">
                  <span className="rc-data block truncate text-[11px] uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">
                    Master KPI Global · {inventoryScopeShort}
                  </span>
                  <strong
                    className="rc-display mt-2 block min-w-0 max-w-full break-all text-[clamp(1.7rem,3vw,2.35rem)] font-bold leading-[0.95] text-[var(--rc-text)]"
                    title={cardTooltip(headlineCard)}
                  >
                    {loading ? '...' : headlineCard.value}
                  </strong>
                  <span className="mt-2 inline-flex max-w-full truncate rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
                    {inventoryScopeLabel} · {kpiTimelineRange.label}
                  </span>
                </span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-200/25 bg-emerald-300/10 text-emerald-100">
                  <Package size={17} />
                </span>
              </span>

              <span className="relative z-[1] mt-3 overflow-hidden rounded-2xl border border-emerald-300/20 bg-[linear-gradient(160deg,rgba(16,185,129,0.16),rgba(0,0,0,0.28)_55%,rgba(245,158,11,0.10))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <span className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-100/85">Current vs Opening</span>
                  <span className={`max-w-[58%] break-all rounded-full border px-2.5 py-1 text-[11px] font-black ${valuationDelta > 0 ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100' : valuationDelta < 0 ? 'border-rose-300/30 bg-rose-400/15 text-rose-100' : 'border-white/10 bg-white/5 text-[var(--rc-text-muted)]'}`}>
                    {loading ? '...' : valuationDeltaLabel}
                  </span>
                </span>
                <span className="grid min-w-0 gap-2">
                  <span className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200/85">Current</span>
                      <span className="mt-1 block truncate text-[12px] font-semibold text-emerald-100/75">{currentPeriodLabel}</span>
                    </span>
                    <span className="max-w-[62%] shrink-0 break-all text-right text-sm font-black leading-snug text-emerald-50 sm:text-[15px]" title={formatCurrency(inventoryValue)}>
                      {loading ? '...' : formatCurrency(inventoryValue)}
                    </span>
                  </span>
                  <span className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-amber-200/85">Opening</span>
                      <span className="mt-1 block truncate text-[12px] font-semibold text-amber-100/75">{openingPeriodLabel}</span>
                    </span>
                    <span className="max-w-[62%] shrink-0 break-all text-right text-sm font-black leading-snug text-amber-50 sm:text-[15px]" title={formatCurrency(openingValue)}>
                      {loading ? '...' : formatCurrency(openingValue)}
                    </span>
                  </span>
                </span>
              </span>

              <span className="relative z-[1] mt-2.5 grid min-w-0 gap-1.5">
                <span className="flex min-w-0 items-center justify-between gap-2 text-[11px] font-semibold text-[var(--rc-text-muted)]">
                  <span className="shrink-0">Gudang</span>
                  <span className="min-w-0 truncate text-right" title={`Current ${formatCurrency(gudangValue)} · Opening ${formatCurrency(openingGudangValue)}`}>
                    {loading ? '...' : `${formatCurrency(gudangValue)} · ${formatPercent(gudangShare)}`}
                  </span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full max-w-full rounded-full bg-[linear-gradient(90deg,#18b96b,#9be23d)]" style={{ width: `${Math.min(100, Math.max(0, gudangShare))}%` }} />
                </span>
                <span className="flex min-w-0 items-center justify-between gap-2 text-[11px] font-semibold text-[var(--rc-text-muted)]">
                  <span className="shrink-0">Workshop</span>
                  <span className="min-w-0 truncate text-right" title={`Current ${formatCurrency(workshopValue)} · Opening ${formatCurrency(openingWorkshopValue)}`}>
                    {loading ? '...' : `${formatCurrency(workshopValue)} · ${formatPercent(workshopShare)}`}
                  </span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full max-w-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#d6b85c)]" style={{ width: `${Math.min(100, Math.max(0, workshopShare))}%` }} />
                </span>
              </span>

              <span className="rc-data relative z-[1] mt-auto flex min-w-0 items-center justify-between gap-2 border-t border-white/10 pt-2 text-[10px] text-[var(--rc-text-faint)]">
                <span className="min-w-0 truncate">{headlineCard.source}</span>
                <ArrowRight size={13} className="shrink-0 text-[var(--rc-forest-accent)]" />
              </span>
            </Link>
          ) : null}

          {/* Opening → Current visual bridge under Master KPI */}
          <div className="min-w-0">
            <p className="rc-data mb-2 text-[11px] uppercase tracking-[0.16em] text-emerald-100/75">
              Visual valuasi · Opening vs Current · {activePeriodLabel}
            </p>
            <ValuationBridgeChart
              opening={openingValue}
              current={inventoryValue}
              openingGudang={openingGudangValue}
              openingWorkshop={openingWorkshopValue}
              currentGudang={gudangValue}
              currentWorkshop={workshopValue}
              openingLabel={openingPeriodLabel}
              currentLabel={currentPeriodLabel}
              loading={loading}
            />
          </div>

          {/* Fill leftover height under Master KPI with split valuation analysis */}
          <div className="min-w-0">
            <p className="rc-data mb-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">
              Analisis valuasi · Gudang vs Workshop
            </p>
            <div className="rc-kpi-grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {renderCardItems(valuationSideCards.map(withCheckSql))}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="min-w-0">
            <MarketTicker items={marketTickerItems} />
          </div>

          <div className="min-w-0">
            <p className="rc-data mb-1.5 text-[10px] uppercase tracking-[0.16em] text-emerald-100/70">
              Total Usage · Stock Issue + Fuel BBM + Job Stock · {kpiTimelineRange.label}
            </p>
            <p className="mb-1.5 text-[10px] font-semibold leading-4 text-[var(--rc-text-faint)]">
              Keterangan: angka ini = IN_STOCKISSUE + IN_FUELISSUE + WS_JOBSTOCK, selaras IssuedTotal monthly detail (include fuel).
            </p>
            {renderCardGrid(heroSideCards.map(withCheckSql))}
          </div>

          <div className="min-w-0">
            <p className="rc-data mb-1.5 text-[10px] uppercase tracking-[0.16em] text-amber-100/75">
                          Fuel Issue · product type · {source} · {kpiTimelineRange.label}
                        </p>
                        <p className="mb-1.5 text-[10px] font-semibold leading-4 text-[var(--rc-text-faint)]">
                          Breakdown ringkas di kartu KPI: top product type (+ share). Hover kartu = full list.
                          {fuelHasRows
                            ? ` Live: ${formatNumber(fuelIssueDocs)} dok · ${formatQuantity(fuelIssueQty)} qty${topFuelProductType ? ` · top ${topFuelProductType.code}` : ''}.`
                            : ' Jika 0: cek source estate/pabrik + period.'}
                        </p>
            {renderCardGrid(fuelIssueCards.map(withCheckSql))}
          </div>

          <div className="min-w-0">
            <p className="rc-data mb-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">
              Jumlah Issue · {inventoryScopeShort} · {kpiTimelineRange.label}
            </p>
            {renderCardGrid(issueCountCards.map(withCheckSql))}
          </div>

          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="KPI secondary sections">
              {DECK_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  role="tab"
                  aria-selected={openSection === section.id}
                  data-active={openSection === section.id}
                  onClick={() => setOpenSection(section.id)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold normal-case tracking-normal transition hover:bg-white/[0.06] ${section.tone}`}
                >
                  {section.label}
                </button>
              ))}
            </div>
            <div role="tabpanel" aria-label={`Section ${openSection}`}>
              <KpiCarousel ariaLabel={`KPI section ${openSection}`} autoScroll>
                {renderCardItems(sectionCards)}
              </KpiCarousel>
            </div>
          </div>
        </div>
      </div>

      {glance ? (
        <div className="relative z-10 border-t border-[var(--rc-border)] px-3 py-4">
          <button
            type="button"
            onClick={() => setGlance(false)}
            className="flex w-full items-center justify-between gap-2 rounded-2xl border-[var(--rc-border)] bg-[rgba(3,14,10,.5)] px-4 py-3 text-left transition hover:border-[var(--rc-forest-accent)]"
          >
            <span className="rc-data text-xs text-[var(--rc-text-faint)]">Grafik & analisis lengkap dimuat bertahap agar angka utama tampil duluan.</span>
            <span className="shrink-0 rounded-full border-[var(--rc-forest-accent)] px-3 py-1 text-[11px] font-semibold text-[var(--rc-forest-accent)]">Lihat semua</span>
          </button>
        </div>
      ) : (
      <div className="relative z-10 border-t border-[var(--rc-border)] px-3 py-3">
        <div className="rc-reveal min-h-[190px] rounded-[28px] p-1" style={{ '--reveal-order': 2 } as React.CSSProperties}>
          <div className="h-[240px]">
            <MovementTrendChart trend={usageTrend} frequency={issueFrequency?.byMonth} loading={loading} failed={usageFailed} />
          </div>
        </div>
      </div>
      )}

      <div className="relative z-10 border-t border-[var(--rc-border)] px-3 py-3">
        <div className="rc-reveal min-h-[190px] rounded-[28px] p-1" style={{ '--reveal-order': 3 } as React.CSSProperties}>
          <div className="h-[260px]">
            <TopMovementScatter
              items={issueFrequencyTop.length > 0 ? issueFrequencyTop : (topLists?.items ?? [])}
              loading={loading}
              failed={usageFailed}
              top={10}
            />
          </div>
        </div>
      </div>

      {hasMovementMonthly ? (
        <div className="relative z-10 border-t border-[var(--rc-border)] px-3 py-3">
          <div className="rc-reveal min-h-[190px] rounded-[28px] p-1" style={{ '--reveal-order': 4 } as React.CSSProperties}>
            <div className="h-[280px]">
              <StockRiverChart
                opening={monthlyOpeningQty}
                goodsReceive={monthlyGoodsReceiveQty}
                ledger={monthlyLedgerQty}
                station={monthlyIssuedStationQty}
                vehicle={monthlyIssuedVehicleQty}
                closing={monthlyClosingQty}
                loading={loading}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative z-10 border-t border-[var(--rc-border)] px-3 py-3">
        <div className="mb-2 rounded-2xl border border-violet-300/20 bg-violet-400/[0.07] px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-100/80">
            Section terpisah · Movement Category analysis
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-violet-100/75">
            Lookback multi-bulan di sini (6/12/24/… bln) hanya untuk pola Movement Category.
            Tidak mengubah angka KPI atas. KPI atas tetap: <strong className="text-violet-50">{kpiTimelineRange.label}</strong>.
          </p>
        </div>
        <div className="rc-reveal rounded-[28px] p-1" style={{ '--reveal-order': 5 } as React.CSSProperties}>
          <MovementAnalytics
            source={source}
            itemType={filters.itemType}
            active={!glance}
            months={12}
            top={12}
            allowTimeline
            costCenters={topLists?.costCenters}
            vehicles={topLists?.vehicles}
            blocks={topLists?.blocks}
            stationAmount={firstNumber(usage, ['ChargeStationAmount', 'chargestationamount'])}
            ledgerAmount={firstNumber(usage, ['ChargeLedgerAmount', 'chargeledgeramount'])}
            vehicleAmount={firstNumber(usage, ['ChargeVehicleAmount', 'chargevehicleamount'])}
            stationQty={
              firstNumber(usage, ['ChargeStationQty', 'chargestationqty']) || monthlyIssuedStationQty
            }
            ledgerQty={
              firstNumber(usage, ['ChargeLedgerQty', 'chargeledgerqty']) || monthlyLedgerQty
            }
            vehicleQty={
              firstNumber(usage, ['ChargeVehicleQty', 'chargevehicleqty']) || monthlyIssuedVehicleQty
            }
            onFocusPeriod={(period) => updateFilter('period', period)}
            onOpenDetail={() => { window.location.href = filteredLinks.usage }}
          />
        </div>
      </div>

      {topRows.length > 0 ? (
        <div className="relative z-10 border-t border-[var(--rc-border)] bg-black/15 px-3 py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-cyan-100/70">Top usage periode</p>
              <p className="mt-0.5 text-xs font-semibold text-[var(--rc-text-muted)]">Top 5 dari report pengeluaran-barang. AccCode dibaca sebagai cost center / dept.</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Dimensi top usage">
              {TOP_DIMENSIONS.map((dim) => (
                <button
                  key={dim.id}
                  type="button"
                  role="tab"
                  aria-selected={topDimension === dim.id}
                  data-active={topDimension === dim.id}
                  onClick={() => setTopDimension(dim.id)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold normal-case tracking-normal transition hover:bg-white/[0.06] ${
                    topDimension === dim.id
                      ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-100'
                      : 'border-white/10 bg-white/[0.04] text-[var(--rc-text-muted)]'
                  }`}
                >
                  {dim.label}
                </button>
              ))}
            </div>
            <Link href={filteredLinks.usage} className="inline-flex w-fit items-center gap-1.5 rounded-xl border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-semibold text-[var(--rc-text)] hover:bg-white/[0.08]">
              Buka detail issue
              <ArrowRight size={13} />
            </Link>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {topRows.map((item, index) => {
              const amount = firstNumber(item, ['amount', 'NilaiKeluar', 'Amount', 'TotalAmount'])
              const qty = firstNumber(item, ['qty', 'QtyKeluar', 'Qty', 'TotalQty'])
              const label = firstText(item, ['name', 'NamaBarang', 'ItemName', 'KodeBarang', 'code']) || `${topDimension === 'items' ? 'Item' : topDimension === 'costCenters' ? 'Dept' : 'Kendaraan'} ${index + 1}`
              const code = firstText(item, ['code', 'KodeBarang'])
              return (
                <Link
                  key={`${topDimension}-${index}-${label}`}
                  href={filteredLinks.usage}
                  className="rounded-2xl border-white/10 bg-white/[0.045] p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-300/10"
                >
                  <span className="block truncate text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/60">#{index + 1} · {code || (topDimension === 'items' ? 'item' : topDimension === 'costCenters' ? 'dept' : 'unit')}</span>
                  <strong className="mt-1 block line-clamp-2 text-sm font-black leading-5 text-[var(--rc-text)]">{label}</strong>
                  <span className="mt-2 block text-xs font-bold text-cyan-100">{formatCurrency(amount)}</span>
                  <span className="text-[11px] font-semibold text-[var(--rc-text-faint)]">
                    {topDimension === 'items' ? `Qty ${formatQuantity(qty)}` : `${formatNumber(firstNumber(item, ['events']))} event`}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      ) : null}
    
      <AnalysisDrawer
        open={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        filters={filters}
        onFilter={(key, value) => updateFilter(key as keyof ProcurementKpiFilters, value as never)}
        scopeDraft={scopeDraft}
        onScopeDraft={setScopeDraft}
        onReset={resetFilters}
        onApply={() => setAnalysisOpen(false)}
        periods={periods}
        movementWindowOptions={movementWindowOptions}
        analysisGroupOptions={analysisGroupOptions}
        selectedGroup={selectedGroup}
        preview={{ trend: usageTrend, insightItems }}
      />

      {kpiSqlView ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`SQL KPI ${kpiSqlView.label}`}
          onClick={() => setKpiSqlView(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-[28px] border border-emerald-300/25 bg-[linear-gradient(160deg,#07140f,#0a1a12_55%,#06100c)] shadow-[0_30px_100px_rgba(0,0,0,.55)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="rc-data text-[10px] uppercase tracking-[0.18em] text-emerald-100/70">SQL KPI · paste SSMS</p>
                <p className="mt-1 truncate text-base font-black text-white sm:text-lg">{kpiSqlView.label}</p>
                <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-white/55">{kpiSqlView.formula}</p>
                <p className="mt-1 truncate text-[10px] text-white/40">{kpiSqlView.source}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-bold text-emerald-100 hover:bg-emerald-400/20"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        [`-- KPI: ${kpiSqlView.label}`, `-- Source: ${kpiSqlView.source}`, kpiSqlView.sql].join('\n'),
                      )
                      setKpiSqlCopied(true)
                      window.setTimeout(() => setKpiSqlCopied(false), 1500)
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  <Copy size={13} />
                  {kpiSqlCopied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                  onClick={() => setKpiSqlView(null)}
                  aria-label="Tutup"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="max-h-[min(60vh,520px)] overflow-auto px-4 py-3 sm:px-5">
              <p className="mb-2 text-[11px] font-semibold leading-5 text-amber-100/80">
                Sketsa grain/tabel/field. Bukan 1:1 full handler (filter scope/location/itemType bisa beda). Angka UI = API report.
              </p>
              <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-3 text-[11px] leading-5 text-emerald-50/90">
                <code>{kpiSqlView.sql}</code>
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
