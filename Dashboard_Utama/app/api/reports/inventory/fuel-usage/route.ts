import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { validateReadOnlySql } from '@/lib/reports/report-filtering'
import {
  gatewayOverrideFromRequest,
  resolveSqlGatewayApiKey,
  resolveSqlGatewayBase,
  sqlGatewayQueryUrl,
} from '@/lib/reports/sql-gateway-config'

/**
 * Fuel usage — pemakaian BBM (solar) dari IN_FUELISSUE/LN saja.
 *
 * Sumber: satu branch FUEL yang sama dengan `buildIssueRowsCte` di
 * `movement-category-evolution/route.ts` (join, doc-date, status, qty/amount
 * identik) — dikhususkan untuk item fuel (ItemType <> '4' di sisi gudang).
 *
 * Kolom kendaraan (`l.VehCode`) ADA di skema IN_FUELISSUELN (verified via
 * `Dokumentasi/FUEL_TABLES_DEEP_DIVE.md` — nilai seperti BE002/VN008), tetapi
 * response `top` tetap per item (KodeBarang/NamaBarang) sesuai spesifikasi;
 * kolom unit/kendaraan tidak ikut digrup agar bentuk response stabil.
 *
 * Response: `{ success, mode:'fuel-usage', periods, kpis, trend, top, error? }`.
 * Error → `success:false` dengan HTTP 200 (pola sama seperti product-type-kpi).
 */

type ReportSource = 'estate' | 'pabrik'

type FuelKpis = { qty: number; amount: number; docs: number; itemCount: number }
type FuelTrendRow = { period: string; qty: number; amount: number; docs: number }
type FuelTopRow = { code: string; name: string; qty: number; amount: number }
/** Fuel issue di-charge/dikelompokkan per product type item (IN_ITEM.ProdTypeCode). */
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
  mode: 'fuel-usage'
  source: ReportSource
  months: number
  periods: string[]
  kpis: FuelKpis
  trend: FuelTrendRow[]
  top: FuelTopRow[]
  byProductType: FuelProductTypeRow[]
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

const cache = new Map<string, { at: number; payload: FuelUsageResponse }>()
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

/** Ekspresi tanggal dokumen fuel — sama persis dengan fuelQuery di movement-category-evolution. */
function fuelDate(alias: string) {
  return `COALESCE(NULLIF(${alias}.PostDate, CONVERT(datetime, '1900-01-01')), NULLIF(${alias}.FuelIssueRefDate, CONVERT(datetime, '1900-01-01')), ${alias}.UpdateDate, ${alias}.CreateDate)`
}

/**
 * CTE baris fuel issue — definisi kolom SAMA dengan branch FUEL di
 * `movement-category-evolution/buildIssueRowsCte` (join, status, qty/amount).
 * itemType:
 *   - '4' / 'workshop' → tidak ada baris fuel (fuel itu item gudang) → kosong
 *   - selain itu       → semua baris fuel (ItemType <> '4')
 */
function buildFuelCte(
  database: string,
  dateFrom: string,
  dateToExclusive: string,
  opts: { includeFuel: boolean; locCode?: string },
) {
  if (!opts.includeFuel) {
    // Selalu-kosong agar query hilir tetap valid saat scope = workshop.
    return `WITH fuel_rows AS (
      SELECT
        CONVERT(varchar(20), NULL) AS ItemCode,
        CONVERT(nvarchar(200), NULL) AS ItemName,
        CONVERT(varchar(40), NULL) AS ProductTypeCode,
        CONVERT(nvarchar(200), NULL) AS ProductTypeName,
        CONVERT(varchar(50), NULL) AS Dokumen,
        CONVERT(datetime, NULL) AS Tanggal,
        CONVERT(DECIMAL(18,2), 0) AS Qty,
        CONVERT(DECIMAL(18,2), 0) AS Amount
      WHERE 1 = 0
    )`
  }
  const loc = opts.locCode ? cleanCode(opts.locCode, 16) : ''
  const fuelLoc = loc ? ` AND RTRIM(h.LocCode) = '${loc}'` : ''
  return `WITH fuel_rows AS (
    SELECT
      RTRIM(l.ItemCode) AS ItemCode,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS ItemName,
      RTRIM(COALESCE(NULLIF(RTRIM(i.ProdTypeCode), ''), '-')) AS ProductTypeCode,
      RTRIM(COALESCE(NULLIF(RTRIM(pt.Description), ''), NULLIF(RTRIM(i.ProdTypeCode), ''), '-')) AS ProductTypeName,
      RTRIM(CONVERT(varchar(50), h.FuelIssueID)) AS Dokumen,
      ${fuelDate('h')} AS Tanggal,
      CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
      CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS DECIMAL(18,2)) AS Amount
    FROM [${database}].[dbo].[IN_FUELISSUELN] l
    INNER JOIN [${database}].[dbo].[IN_FUELISSUE] h ON l.FuelIssueID = h.FuelIssueID
    LEFT JOIN [${database}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
    LEFT JOIN [${database}].[dbo].[IN_PRODTYPE] pt ON pt.ProdTypeCode = i.ProdTypeCode
    WHERE ${fuelDate('h')} >= '${dateFrom}'
      AND ${fuelDate('h')} < '${dateToExclusive}'
      AND RTRIM(ISNULL(h.Status, '')) IN ('2', '6')
      AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'${fuelLoc}
  )`
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const source = getSource(request)
  const sp = request.nextUrl.searchParams
  const months = clampInt(Number(sp.get('months')), 1, 120, 12)
  const top = clampInt(Number(sp.get('top')), 1, 100, 10)
  const location = cleanCode(sp.get('location') ?? sp.get('locCode') ?? '', 16)
  const itemType = (sp.get('itemType') ?? '').trim().toLowerCase()
  // Fuel adalah item gudang — scope 'workshop' berarti tidak ada data fuel.
  const includeFuel = !(itemType === '4' || itemType === 'workshop')

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

  const cte = buildFuelCte(database, dateFrom, dateTo, { includeFuel, locCode: location || undefined })

  // (a) KPI total pada rentang periode.
  const kpiSql = `
    ${cte}
    SELECT
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount,
      COUNT(DISTINCT Dokumen) AS docs,
      COUNT(DISTINCT ItemCode) AS itemCount
    FROM fuel_rows
    WHERE Tanggal IS NOT NULL
  `
  // (b) Tren per bulan (YYYY-MM).
  const trendSql = `
    ${cte}
    SELECT
      CONVERT(varchar(7), Tanggal, 120) AS period,
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount,
      COUNT(DISTINCT Dokumen) AS docs
    FROM fuel_rows
    WHERE Tanggal IS NOT NULL
    GROUP BY CONVERT(varchar(7), Tanggal, 120)
    ORDER BY period
  `
  // (c) Top konsumen per item (KodeBarang/NamaBarang).
  const topSql = `
    ${cte}
    SELECT TOP (${top})
      ItemCode AS code,
      MAX(ItemName) AS name,
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount
    FROM fuel_rows
    WHERE Tanggal IS NOT NULL
    GROUP BY ItemCode
    ORDER BY amount DESC, qty DESC
  `
  // (d) Breakdown charge/kelompok per Product Type item fuel.
  const byProductTypeSql = `
    ${cte}
    SELECT TOP (${Math.max(top, 25)})
      ProductTypeCode AS code,
      MAX(ProductTypeName) AS name,
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount,
      COUNT(DISTINCT Dokumen) AS docs,
      COUNT(DISTINCT ItemCode) AS itemCount
    FROM fuel_rows
    WHERE Tanggal IS NOT NULL
    GROUP BY ProductTypeCode
    ORDER BY amount DESC, qty DESC
  `

  try {
    const [kpiRaw, trendRaw, topRaw, byPtRaw] = await Promise.all([
      runQuery(server, database, kpiSql),
      runQuery(server, database, trendSql).catch(() => [] as DbRow[]),
      runQuery(server, database, topSql).catch(() => [] as DbRow[]),
      runQuery(server, database, byProductTypeSql).catch(() => [] as DbRow[]),
    ])

    const k = kpiRaw[0] ?? {}
    const totalAmount = toNumber(k.amount)
    const byProductType: FuelProductTypeRow[] = byPtRaw.map((r) => {
      const amount = toNumber(r.amount)
      return {
        code: String(r.code ?? '').trim() || '-',
        name: String(r.name ?? r.code ?? '-').trim() || '-',
        qty: toNumber(r.qty),
        amount,
        docs: toNumber(r.docs),
        itemCount: toNumber(r.itemCount),
        pctAmount: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
      }
    })
    const payload: FuelUsageResponse = {
      success: true,
      mode: 'fuel-usage',
      source,
      months,
      periods,
      kpis: {
        qty: toNumber(k.qty),
        amount: totalAmount,
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
      byProductType,
    }
    cache.set(cacheKey, { at: Date.now(), payload })
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        mode: 'fuel-usage',
        source,
        months,
        periods,
        kpis: { qty: 0, amount: 0, docs: 0, itemCount: 0 },
        trend: [],
        top: [],
        byProductType: [],
        error: message,
      } satisfies FuelUsageResponse,
      { status: 200 },
    )
  }
}

export async function GET(request: NextRequest) {
  const gatewayOverride = gatewayOverrideFromRequest(request)
  return gatewayOverrideFromRequestStorage.run(gatewayOverride, () => handleGet(request))
}
