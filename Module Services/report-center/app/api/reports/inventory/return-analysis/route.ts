import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { validateReadOnlySql } from '@modules/report-center/lib/reports/report-filtering'
import {
  gatewayOverrideFromRequest,
  resolveSqlGatewayApiKey,
  resolveSqlGatewayBase,
  sqlGatewayQueryUrl,
} from '@modules/report-center/lib/reports/sql-gateway-config'

/**
 * Return analysis — dua domain return dalam satu response:
 *
 * 1. PURCHASING (retur ke supplier) — PU_GOODSRET × PU_GOODSRETLN.
 *    Kolom TERVERIFIKASI (bukan karangan):
 *    - docs/database/Monthly-Stock-Account-Movement-Details/09-GOODS-RECEIVE.md
 *      (baris 112-130): header GoodsRetId/LocCode/AccYear/AccMonth/Status,
 *      line ItemCode/QtyReturn/ReturnStockQty/Amount/Cost/POLnID.
 *    - SQL terbukti jalan di `app/api/reports/inventory/route.ts:4471-4567`
 *      (`goodsReturnToSupplier`): doc-date COALESCE(PostDate, GoodsRetRefDate,
 *      UpdateDate, CreateDate), Status IN ('2','5','6'), qty =
 *      COALESCE(NULLIF(ReturnStockQty,0), QtyReturn, 0), amount = Amount
 *      fallback qty × COALESCE(NULLIF(Cost,0), PU_POLN.Cost).
 * 2. INVENTORY (return ke gudang) — IN_STOCKRTN × IN_STOCKRTNLN.
 *    Definisi kolom dari `app/api/reports/inventory/route.ts:1201-1214`
 *    (branch return monthly stock movement): doc-date accounting-period
 *    (AccYear+AccMonth → tanggal 1 bulan itu), Status IN ('2','5','6'),
 *    Qty, Amount = COALESCE(NULLIF(l.Amount,0), l.Qty*l.Cost, 0).
 *
 * Kedua blok dijalankan paralel & independen: kegagalan satu sumber hanya
 * mematikan bloknya sendiri (`available:false` + `note`), blok lain tetap
 * terisi. Error fatal (gateway down dsb.) → success:false dengan HTTP 200,
 * pola sama seperti fuel-usage / product-type-kpi.
 *
 * Response: `{ success, mode:'return-analysis', source, months, periods,
 *   purchasing:{available,note?,kpis,trend,top},
 *   inventory:{available,kpis,trend,top}, cached?, error? }`.
 */

type ReportSource = 'estate' | 'pabrik'

type ReturnKpis = { qty: number; amount: number; docs: number; itemCount: number }
type ReturnTrendRow = { period: string; qty: number; amount: number; docs: number }
type ReturnTopRow = { code: string; name: string; qty: number; amount: number }

type ReturnBlock = {
  available: boolean
  note?: string
  kpis: ReturnKpis
  trend: ReturnTrendRow[]
  top: ReturnTopRow[]
}

type ReturnAnalysisResponse = {
  success: boolean
  mode: 'return-analysis'
  source: ReportSource
  months: number
  periods: string[]
  purchasing: ReturnBlock
  inventory: ReturnBlock
  cached?: boolean
  error?: string
}

type DbRow = Record<string, unknown>

const TOKEN =
  resolveSqlGatewayApiKey() ||
  process.env.SQL_GATEWAY_API_KEY ||
  '2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6'

function databaseForServer(server: string) {
  if (process.env.DATABASE_NAME) return process.env.DATABASE_NAME
  if (server === 'SERVER_PROFILE_2') return 'db_ptrj'
  if (server === 'SERVER_PROFILE_3') return 'db_ptrj_mill'
  return 'db_ptrj'
}

function sourceToServer(source: ReportSource) {
  return source === 'pabrik' ? 'SERVER_PROFILE_3' : 'SERVER_PROFILE_2'
}

function getSource(request: NextRequest): ReportSource {
  const raw = (request.nextUrl.searchParams.get('source') ?? '').trim().toLowerCase()
  return raw === 'pabrik' || raw === 'mill' || raw === 'factory' ? 'pabrik' : 'estate'
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** Daftar 'YYYY-MM' kronologis untuk `months` bulan terakhir TERMASUK bulan berjalan. */
function trailingPeriods(months: number, now: Date = new Date()): string[] {
  const periods: string[] = []
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  for (let i = 0; i < months - 1; i += 1) {
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }
  let y = year
  let m = month
  for (let i = 0; i < months; i += 1) {
    periods.push(`${y}-${pad2(m)}`)
    m += 1
    if (m === 13) {
      m = 1
      y += 1
    }
  }
  return periods
}

const cache = new Map<string, { at: number; payload: ReturnAnalysisResponse }>()
const CACHE_TTL_MS = 60_000

import { AsyncLocalStorage } from 'node:async_hooks'
const gatewayOverrideFromRequestStorage = new AsyncLocalStorage<string | null>()

async function runQuery(server: string, database: string, sql: string): Promise<DbRow[]> {
  const validation = validateReadOnlySql(sql)
  if (!validation.safe) {
    throw new Error(validation.reason ?? 'Query non-read diblokir oleh validator report.')
  }
  const base = resolveSqlGatewayBase({ override: gatewayOverrideFromRequestStorage.getStore() })
  const response = await fetch(sqlGatewayQueryUrl(base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': TOKEN },
    body: JSON.stringify({ sql, server, database }),
    cache: 'no-store',
  })
  const result = (await response.json()) as {
    success?: boolean
    error?: string | null
    data?: { recordset?: DbRow[] } | null
  }
  if (!response.ok || result.success === false) {
    throw new Error(result.error ?? `SQL Gateway HTTP ${response.status}`)
  }
  return result.data?.recordset ?? []
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.trunc(value), min), max)
}

/** Kode inventory aman untuk SQL literal (ItemCode / LocCode). */
function cleanCode(raw: string, max = 40) {
  return raw.trim().replace(/[^A-Za-z0-9._\-\/ ]/g, '').replace(/'/g, '').slice(0, max)
}

/** Movement window: tanggal mulai inklusif dari `months` bulan trailing. */
function movementWindowStart(months: number): string {
  const first = trailingPeriods(months)[0]
  return `${first}-01`
}

/** Batas akhir eksklusif = tanggal 1 bulan SETELAH bulan berjalan. */
function movementWindowEndExclusive(now: Date = new Date()): string {
  const y = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
  const m = now.getMonth() === 11 ? 1 : now.getMonth() + 2
  return `${y}-${pad2(m)}-01`
}

/** Konversi rentang tanggal (YYYY-MM-DD) ke daftar (accYear, accMonth) kalender. */
function yearMonthPairsBetween(dateFrom: string, dateToExclusive: string) {
  const [fy, fm] = dateFrom.split('-').map(Number)
  const [ty, tm] = dateToExclusive.split('-').map(Number)
  const pairs: Array<{ year: number; month: number }> = []
  let y = fy
  let m = fm
  while (y < ty || (y === ty && m < tm)) {
    pairs.push({ year: y, month: m })
    m += 1
    if (m === 13) {
      m = 1
      y += 1
    }
  }
  return pairs
}

/** Filter tipe item gudang: '1'/'4' (atau 'gudang'/'workshop') via IN_ITEM.ItemType. */
function itemTypeScopeFilter(itemType: string, itemAlias: string) {
  if (itemType === '1' || itemType === 'gudang') {
    return `AND RTRIM(CONVERT(varchar(10), ${itemAlias}.ItemType)) = '1'`
  }
  if (itemType === '4' || itemType === 'workshop') {
    return `AND RTRIM(CONVERT(varchar(10), ${itemAlias}.ItemType)) = '4'`
  }
  return ''
}

/**
 * CTE baris PURCHASING return (retur ke supplier) — kolom & fallback SAMA
 * dengan `goodsReturnToSupplier` di inventory/route.ts (verified live):
 * tanggal dok = CreateDate → PostDate → GoodsRetDate → UpdateDate (patokan CreateDate),
 * status posted '2'/'5'/'6', qty = ReturnStockQty → QtyReturn,
 * amount = Amount → qty × (Cost → PU_POLN.Cost).
 */
function buildPurchasingReturnCte(
  database: string,
  dateFrom: string,
  dateToExclusive: string,
  opts: { itemType: string; locCode?: string },
) {
  // Patokan tanggal = CreateDate (selaras KPI utama); PostDate sering placeholder 1900.
  // Kolom yang benar adalah GoodsRetDate (bukan GoodsRetRefDate — kolom itu TIDAK ada
  // di PU_GOODSRET pada db_ptrj maupun db_ptrj_mill; terbukti error 'Invalid column name').
  const docDate = `COALESCE(NULLIF(h.CreateDate, CONVERT(datetime, '1900-01-01')), NULLIF(h.PostDate, CONVERT(datetime, '1900-01-01')), NULLIF(h.GoodsRetDate, CONVERT(datetime, '1900-01-01')), h.UpdateDate)`
  const loc = opts.locCode ? cleanCode(opts.locCode, 16) : ''
  const locFilter = loc ? ` AND RTRIM(h.LocCode) = '${loc}'` : ''
  const typeFilter = itemTypeScopeFilter(opts.itemType, 'i')
  return `WITH return_rows AS (
    SELECT
      RTRIM(l.ItemCode) AS ItemCode,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS ItemName,
      RTRIM(CONVERT(varchar(50), h.GoodsRetId)) AS Dokumen,
      ${docDate} AS Tanggal,
      CAST(COALESCE(NULLIF(l.ReturnStockQty, 0), l.QtyReturn, 0) AS DECIMAL(18,2)) AS Qty,
      CAST(COALESCE(
        NULLIF(l.Amount, 0),
        COALESCE(NULLIF(l.ReturnStockQty, 0), l.QtyReturn, 0) * COALESCE(NULLIF(l.Cost, 0), p.Cost, 0),
        0
      ) AS DECIMAL(18,2)) AS Amount
    FROM [${database}].[dbo].[PU_GOODSRET] h
    INNER JOIN [${database}].[dbo].[PU_GOODSRETLN] l ON h.GoodsRetId = l.GoodsRetId
    LEFT JOIN [${database}].[dbo].[PU_POLN] p ON l.POLnID = p.POLnID
    LEFT JOIN [${database}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
    WHERE ${docDate} >= '${dateFrom}'
      AND ${docDate} < '${dateToExclusive}'
      AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')${locFilter}${typeFilter}
  )`
}

/**
 * CTE baris INVENTORY return (return ke gudang) — definisi kolom SAMA dengan
 * branch IN_STOCKRTN di inventory/route.ts:1201-1214: doc-date accounting-
 * period (AccYear+AccMonth → tanggal 1), Status IN ('2','5','6'), Qty,
 * Amount = COALESCE(NULLIF(l.Amount,0), l.Qty*l.Cost, 0), nama item via
 * IN_ITEM (LocCode match).
 */
function buildInventoryReturnCte(
  database: string,
  dateFrom: string,
  dateToExclusive: string,
  opts: { itemType: string; locCode?: string },
) {
  const pairs = yearMonthPairsBetween(dateFrom, dateToExclusive)
  const docDate = `DATEFROMPARTS(CONVERT(int, h.AccYear), CONVERT(int, h.AccMonth), 1)`
  const periodFilter = pairs.length
    ? `(${pairs.map((p) => `(CONVERT(int, h.AccYear) = ${p.year} AND CONVERT(int, h.AccMonth) = ${p.month})`).join(' OR ')})`
    : '1 = 0'
  const loc = opts.locCode ? cleanCode(opts.locCode, 16) : ''
  const locFilter = loc ? ` AND RTRIM(h.LocCode) = '${loc}'` : ''
  const typeFilter = itemTypeScopeFilter(opts.itemType, 'i')
  return `WITH return_rows AS (
    SELECT
      RTRIM(l.ItemCode) AS ItemCode,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS ItemName,
      RTRIM(CONVERT(varchar(50), h.StockRtnID)) AS Dokumen,
      ${docDate} AS Tanggal,
      CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
      CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS DECIMAL(18,2)) AS Amount
    FROM [${database}].[dbo].[IN_STOCKRTN] h
    INNER JOIN [${database}].[dbo].[IN_STOCKRTNLN] l ON h.StockRtnID = l.StockRtnID
    LEFT JOIN [${database}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
    WHERE ${periodFilter}
      AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')${locFilter}${typeFilter}
  )`
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function emptyBlock(note?: string): ReturnBlock {
  return {
    available: false,
    note,
    kpis: { qty: 0, amount: 0, docs: 0, itemCount: 0 },
    trend: [],
    top: [],
  }
}

function buildBlockQueries(cte: string, top: number) {
  const kpiSql = `
    ${cte}
    SELECT
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount,
      COUNT(DISTINCT Dokumen) AS docs,
      COUNT(DISTINCT ItemCode) AS itemCount
    FROM return_rows
    WHERE Tanggal IS NOT NULL
  `
  const trendSql = `
    ${cte}
    SELECT
      CONVERT(varchar(7), Tanggal, 120) AS period,
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount,
      COUNT(DISTINCT Dokumen) AS docs
    FROM return_rows
    WHERE Tanggal IS NOT NULL
    GROUP BY CONVERT(varchar(7), Tanggal, 120)
    ORDER BY period
  `
  const topSql = `
    ${cte}
    SELECT TOP (${top})
      ItemCode AS code,
      MAX(ItemName) AS name,
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount
    FROM return_rows
    WHERE Tanggal IS NOT NULL
    GROUP BY ItemCode
    ORDER BY amount DESC, qty DESC
  `
  return { kpiSql, trendSql, topSql }
}

async function loadBlock(server: string, database: string, cte: string, top: number): Promise<ReturnBlock> {
  const { kpiSql, trendSql, topSql } = buildBlockQueries(cte, top)
  const [kpiRaw, trendRaw, topRaw] = await Promise.all([
    runQuery(server, database, kpiSql),
    runQuery(server, database, trendSql).catch(() => [] as DbRow[]),
    runQuery(server, database, topSql).catch(() => [] as DbRow[]),
  ])
  const k = kpiRaw[0] ?? {}
  return {
    available: true,
    kpis: {
      qty: toNumber(k.qty),
      amount: toNumber(k.amount),
      docs: toNumber(k.docs),
      itemCount: toNumber(k.itemCount),
    },
    trend: trendRaw.map((r) => ({
      period: String(r.period ?? '').trim(),
      qty: toNumber(r.qty),
      amount: toNumber(r.amount),
      docs: toNumber(r.docs),
    })),
    top: topRaw.map((r) => ({
      code: String(r.code ?? '').trim(),
      name: String(r.name ?? r.code ?? '').trim(),
      qty: toNumber(r.qty),
      amount: toNumber(r.amount),
    })),
  }
}

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const source = getSource(request)
  const sp = request.nextUrl.searchParams
  const months = clampInt(Number(sp.get('months')), 1, 120, 12)
  const top = clampInt(Number(sp.get('top')), 1, 100, 10)
  const location = cleanCode(sp.get('location') ?? sp.get('locCode') ?? '', 16)
  const itemType = (sp.get('itemType') ?? '').trim().toLowerCase()

  const server = sourceToServer(source)
  const database = databaseForServer(server)
  const periods = trailingPeriods(months)
  const dateFrom = movementWindowStart(months)
  const dateTo = movementWindowEndExclusive()

  const cacheKey = `${source}|${months}|${itemType || 'all'}|${location}|${top}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true })
  }

  const purchasingCte = buildPurchasingReturnCte(database, dateFrom, dateTo, {
    itemType,
    locCode: location || undefined,
  })
  const inventoryCte = buildInventoryReturnCte(database, dateFrom, dateTo, {
    itemType,
    locCode: location || undefined,
  })

  try {
    // Dua blok independen — kegagalan satu sumber tidak menjatuhkan sumber lain.
    const [purchasingSettled, inventorySettled] = await Promise.allSettled([
      loadBlock(server, database, purchasingCte, top),
      loadBlock(server, database, inventoryCte, top),
    ])

    const purchasing =
      purchasingSettled.status === 'fulfilled'
        ? purchasingSettled.value
        : emptyBlock(
            `Gagal memuat retur purchasing (PU_GOODSRET): ${
              purchasingSettled.reason instanceof Error
                ? purchasingSettled.reason.message
                : String(purchasingSettled.reason)
            }`,
          )
    const inventory =
      inventorySettled.status === 'fulfilled'
        ? inventorySettled.value
        : emptyBlock(
            `Gagal memuat return inventory (IN_STOCKRTN): ${
              inventorySettled.reason instanceof Error
                ? inventorySettled.reason.message
                : String(inventorySettled.reason)
            }`,
          )

    const payload: ReturnAnalysisResponse = {
      success: true,
      mode: 'return-analysis',
      source,
      months,
      periods,
      purchasing,
      inventory,
    }
    cache.set(cacheKey, { at: Date.now(), payload })
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        mode: 'return-analysis',
        source,
        months,
        periods,
        purchasing: emptyBlock('Endpoint error — blok tidak tersedia.'),
        inventory: emptyBlock('Endpoint error — blok tidak tersedia.'),
        error: message,
      } satisfies ReturnAnalysisResponse,
      { status: 200 },
    )
  }
}

export async function GET(request: NextRequest) {
  const gatewayOverride = gatewayOverrideFromRequest(request)
  return gatewayOverrideFromRequestStorage.run(gatewayOverride, () => handleGet(request))
}
