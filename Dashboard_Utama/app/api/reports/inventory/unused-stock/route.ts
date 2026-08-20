import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { validateReadOnlySql } from '@/modules/report-center/lib/reports/report-filtering'
import {
  gatewayOverrideFromRequest,
  resolveSqlGatewayApiKey,
  resolveSqlGatewayBase,
  sqlGatewayQueryUrl,
} from '@/modules/report-center/lib/reports/sql-gateway-config'

/**
 * Unused stock — analisis barang TIDAK JADI DIGUNAKAN dari inventory stock.
 *
 * Definisi (kanonik, selaras glosarium `lib/reports/inventory/metric-glossary.ts`):
 *   item LIVE di IN_ITEM (Status='1') dengan stok fisik > 0
 *   (ISNULL(QtyOnHand,0) + ISNULL(QtyOnHold,0) > 0) TAPI tidak punya SATU PUN
 *   dokumen issue dalam window analisis.
 *
 * Universe issue = 3 sumber yang sama dengan `buildIssueCte` di
 * `product-type-kpi/route.ts` (join & itemType identik); doc-date & status
 * selaras definisi BARU KPI utama `app/api/reports/inventory/route.ts`
 * (patokan CreateDate-utama, parity Rp 0 dgn monthly report RPTIN):
 *   - IN_STOCKISSUE/LN   (gudang, Status 2/5/6, ItemType <> '4')
 *   - IN_FUELISSUE/LN    (fuel,   Status 2/6, ItemType <> '4')
 *   - WS_JOBSTOCK        (workshop, TransType='1', ItemType = '4')
 * Return TIDAK dihitung sebagai issue (return itu penerimaan kembali, bukan pemakaian).
 *
 * Valuasi per item = (QtyOnHand + QtyOnHold) × AverageCost — definisi sama
 * dengan Total Valuasi di glosarium (snapshot IN_ITEM live, BUKAN Total Issue).
 *
 * Response: `{ success, mode:'unused-stock', kpis, byProductType, top, error? }`.
 * Error → `success:false` dengan HTTP 200 (pola sama seperti fuel-usage).
 */

type ReportSource = 'estate' | 'pabrik'

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
  mode: 'unused-stock'
  source: ReportSource
  months: number
  dateFrom: string
  kpis: UnusedKpis
  byProductType: UnusedProductTypeRow[]
  top: UnusedTopRow[]
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

/** 'YYYY-MM-01' tanggal mulai inklusif dari `months` bulan trailing (termasuk bulan berjalan). */
function movementWindowStart(months: number, now: Date = new Date()): string {
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  for (let i = 0; i < months - 1; i += 1) {
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }
  return `${year}-${pad2(month)}-01`
}

const cache = new Map<string, { at: number; payload: UnusedStockResponse }>()
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

/**
 * Ekspresi tanggal dokumen fuel — IDENTIK dengan `fuelIssueDocumentDateExpression`
 * di lib/reports/inventory/fuel-issue-sql.ts (dipakai KPI utama inventory/route.ts).
 * Ditulis inline agar file ini tidak menambah import baru.
 * Patokan CreateDate-utama: CreateDate → PostDate(≠1900) → FuelIssueRefDate(≠1900) → UpdateDate.
 */
function fuelDate(alias: string) {
  return `COALESCE(NULLIF(${alias}.CreateDate, CONVERT(datetime, '1900-01-01')), NULLIF(${alias}.PostDate, CONVERT(datetime, '1900-01-01')), NULLIF(${alias}.FuelIssueRefDate, CONVERT(datetime, '1900-01-01')), ${alias}.UpdateDate)`
}

/**
 * Ekspresi tanggal gudang (IN_STOCKISSUE) — sama dengan `stockIssueDocumentDateExpression`
 * di inventory/route.ts. Patokan CreateDate-utama: CreateDate → PostDate(≠1900) → UpdateDate.
 */
function stockIssueDate(alias: string) {
  return `COALESCE(NULLIF(${alias}.CreateDate, CONVERT(datetime, '1900-01-01')), NULLIF(${alias}.PostDate, CONVERT(datetime, '1900-01-01')), ${alias}.UpdateDate)`
}

/**
 * Ekspresi tanggal workshop — sama dengan `workshopDocumentDateExpression`
 * di inventory/route.ts. Patokan CreateDate-utama: CreateDate → PostDate(≠1900) → TransDate.
 */
function workshopDate(alias: string) {
  return `COALESCE(NULLIF(${alias}.CreateDate, CONVERT(datetime, '1900-01-01')), NULLIF(${alias}.PostDate, CONVERT(datetime, '1900-01-01')), ${alias}.TransDate)`
}

/**
 * CTE universe issue (per ItemCode + LocCode) — 3 sumber yang sama dengan
 * `buildIssueCte` di product-type-kpi/route.ts, tapi hanya kolom kunci
 * (ItemCode, LocCode) karena yang dipakai hanya EXISTENCE (ada/tidak issue).
 * Filter periode & status selaras definisi BARU KPI utama inventory/route.ts:
 *   - gudang: tanggal stockIssueDate(h), Status 2/5/6
 *   - fuel:   tanggal fuelDate(h), Status 2/6
 *   - workshop: tanggal workshopDate(s), TransType='1' (tanpa filter status)
 * itemType:
 *   - '1' / 'gudang'    → hanya gudang + fuel
 *   - '4' / 'workshop'  → hanya workshop
 *   - kosong            → ketiganya
 */
function buildIssuedItemCte(
  database: string,
  dateFrom: string,
  opts: { includeGudang: boolean; includeWorkshop: boolean; locCode?: string },
) {
  const loc = opts.locCode ? cleanCode(opts.locCode, 16) : ''
  const gudangLoc = loc ? ` AND RTRIM(h.LocCode) = '${loc}'` : ''
  const workshopLoc = loc ? ` AND RTRIM(s.LocCode) = '${loc}'` : ''

  const branches: string[] = []
  if (opts.includeGudang) {
    branches.push(`
      SELECT RTRIM(l.ItemCode) AS ItemCode, RTRIM(h.LocCode) AS LocCode
      FROM [${database}].[dbo].[IN_STOCKISSUELN] l
      INNER JOIN [${database}].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
      LEFT JOIN [${database}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE ${stockIssueDate('h')} >= '${dateFrom}'
        AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
        AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'${gudangLoc}
    `)
    branches.push(`
      SELECT RTRIM(l.ItemCode) AS ItemCode, RTRIM(h.LocCode) AS LocCode
      FROM [${database}].[dbo].[IN_FUELISSUELN] l
      INNER JOIN [${database}].[dbo].[IN_FUELISSUE] h ON l.FuelIssueID = h.FuelIssueID
      LEFT JOIN [${database}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE ${fuelDate('h')} >= '${dateFrom}'
        AND RTRIM(ISNULL(h.Status, '')) IN ('2', '6')
        AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'${gudangLoc}
    `)
  }
  if (opts.includeWorkshop) {
    branches.push(`
      SELECT RTRIM(s.ItemCode) AS ItemCode, RTRIM(s.LocCode) AS LocCode
      FROM [${database}].[dbo].[WS_JOBSTOCK] s
      LEFT JOIN [${database}].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
      WHERE ${workshopDate('s')} >= '${dateFrom}'
        AND RTRIM(ISNULL(s.TransType, '')) = '1'
        AND COALESCE(
              NULLIF(RTRIM(CONVERT(varchar(10), i.ItemType)), ''),
              NULLIF(RTRIM(CONVERT(varchar(10), s.ItemType)), '')
            ) = '4'${workshopLoc}
    `)
  }
  if (branches.length === 0) {
    // fallback defensif: selalu minimal gudang+fuel
    return buildIssuedItemCte(database, dateFrom, { ...opts, includeGudang: true })
  }
  return `WITH issued_items AS (
    SELECT DISTINCT ItemCode, LocCode FROM (${branches.join(' UNION ALL ')}) u
  )`
}

/**
 * CTE item live berstok (kandidat unused). itemType:
 *   - '1' / 'gudang'    → hanya ItemType <> '4'
 *   - '4' / 'workshop'  → hanya ItemType = '4'
 *   - kosong            → semua
 */
function buildLiveStockCte(database: string, opts: { itemType?: string; locCode?: string }) {
  const loc = opts.locCode ? cleanCode(opts.locCode, 16) : ''
  const it = (opts.itemType ?? '').trim().toLowerCase()
  const itFilter =
    it === '4' || it === 'workshop'
      ? ` AND RTRIM(CONVERT(varchar(10), i.ItemType)) = '4'`
      : it === '1' || it === 'gudang'
        ? ` AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'`
        : ''
  const locFilter = loc ? ` AND RTRIM(i.LocCode) = '${loc}'` : ''
  return `, live_stock AS (
    SELECT
      RTRIM(i.ItemCode) AS ItemCode,
      RTRIM(ISNULL(i.Description, i.ItemCode)) AS ItemName,
      RTRIM(i.LocCode) AS LocCode,
      RTRIM(COALESCE(NULLIF(RTRIM(i.ProdTypeCode), ''), '-')) AS ProductTypeCode,
      RTRIM(COALESCE(NULLIF(RTRIM(pt.Description), ''), NULLIF(RTRIM(i.ProdTypeCode), ''), '-')) AS ProductTypeName,
      CAST(ISNULL(i.QtyOnHand, 0) + ISNULL(i.QtyOnHold, 0) AS DECIMAL(18,2)) AS Qty,
      CAST((ISNULL(i.QtyOnHand, 0) + ISNULL(i.QtyOnHold, 0)) * ISNULL(i.AverageCost, 0) AS DECIMAL(18,2)) AS Valuasi
    FROM [${database}].[dbo].[IN_ITEM] i
    LEFT JOIN [${database}].[dbo].[IN_PRODTYPE] pt ON pt.ProdTypeCode = i.ProdTypeCode
    WHERE RTRIM(ISNULL(i.Status, '')) = '1'
      AND (ISNULL(i.QtyOnHand, 0) + ISNULL(i.QtyOnHold, 0)) > 0${itFilter}${locFilter}
  )`
}

/** Gabungan: live stock TANPA dokumen issue dalam window. */
function buildUnusedSql(
  database: string,
  dateFrom: string,
  opts: { includeGudang: boolean; includeWorkshop: boolean; itemType?: string; locCode?: string },
) {
  const issued = buildIssuedItemCte(database, dateFrom, opts)
  const live = buildLiveStockCte(database, { itemType: opts.itemType, locCode: opts.locCode })
  return `${issued}${live}, unused AS (
    SELECT ls.*
    FROM live_stock ls
    LEFT JOIN issued_items ui ON ui.ItemCode = ls.ItemCode AND ui.LocCode = ls.LocCode
    WHERE ui.ItemCode IS NULL
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
  const includeGudang = !(itemType === '4' || itemType === 'workshop')
  const includeWorkshop = !(itemType === '1' || itemType === 'gudang')

  const server = sourceToServer(source)
  const database = databaseForServer(server)
  const dateFrom = movementWindowStart(months)

  const cacheKey = `${source}|${months}|${itemType || 'all'}|${location}|${top}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true })
  }

  const baseCte = buildUnusedSql(database, dateFrom, {
    includeGudang,
    includeWorkshop,
    itemType,
    locCode: location || undefined,
  })

  // (a) KPI total: jumlah item, qty fisik, valuasi.
  const kpiSql = `
    ${baseCte}
    SELECT
      COUNT(*) AS itemCount,
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(Valuasi, 0)) AS DECIMAL(18,2)) AS valuasi
    FROM unused
  `
  // (b) Breakdown per product type.
  const byProductTypeSql = `
    ${baseCte}
    SELECT
      ProductTypeCode AS code,
      MAX(ProductTypeName) AS name,
      COUNT(*) AS itemCount,
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(Valuasi, 0)) AS DECIMAL(18,2)) AS valuasi
    FROM unused
    GROUP BY ProductTypeCode
    ORDER BY valuasi DESC, itemCount DESC
  `
  // (c) Top item terbesar menurut valuasi.
  const topSql = `
    ${baseCte}
    SELECT TOP (${top})
      ItemCode AS code,
      MAX(ItemName) AS name,
      MAX(ProductTypeName) AS productType,
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(Valuasi, 0)) AS DECIMAL(18,2)) AS valuasi
    FROM unused
    GROUP BY ItemCode
    ORDER BY valuasi DESC, qty DESC
  `

  try {
    const [kpiRaw, byPtRaw, topRaw] = await Promise.all([
      runQuery(server, database, kpiSql),
      runQuery(server, database, byProductTypeSql).catch(() => [] as DbRow[]),
      runQuery(server, database, topSql).catch(() => [] as DbRow[]),
    ])

    const k = kpiRaw[0] ?? {}
    const totalValuasi = toNumber(k.valuasi)
    const byProductType: UnusedProductTypeRow[] = byPtRaw.map((r) => {
      const valuasi = toNumber(r.valuasi)
      return {
        code: String(r.code ?? '').trim() || '-',
        name: String(r.name ?? r.code ?? '-').trim() || '-',
        itemCount: toNumber(r.itemCount),
        qty: toNumber(r.qty),
        valuasi,
        pctValuasi: totalValuasi > 0 ? (valuasi / totalValuasi) * 100 : 0,
      }
    })
    const payload: UnusedStockResponse = {
      success: true,
      mode: 'unused-stock',
      source,
      months,
      dateFrom,
      kpis: {
        itemCount: toNumber(k.itemCount),
        qty: toNumber(k.qty),
        valuasi: totalValuasi,
      },
      byProductType,
      top: topRaw.map((r) => ({
        code: String(r.code ?? '').trim(),
        name: String(r.name ?? r.code ?? '').trim(),
        productType: String(r.productType ?? '-').trim() || '-',
        qty: toNumber(r.qty),
        valuasi: toNumber(r.valuasi),
      })),
    }
    cache.set(cacheKey, { at: Date.now(), payload })
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        mode: 'unused-stock',
        source,
        months,
        dateFrom,
        kpis: { itemCount: 0, qty: 0, valuasi: 0 },
        byProductType: [],
        top: [],
        error: message,
      } satisfies UnusedStockResponse,
      { status: 200 },
    )
  }
}

export async function GET(request: NextRequest) {
  const gatewayOverride = gatewayOverrideFromRequest(request)
  return gatewayOverrideFromRequestStorage.run(gatewayOverride, () => handleGet(request))
}
