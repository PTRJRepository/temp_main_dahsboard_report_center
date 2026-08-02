import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { actualToAccountingPeriod, sqlIntegerExpression } from '@/lib/reports/accounting-period'
import { validateReadOnlySql } from '@/lib/reports/report-filtering'
import {
  gatewayOverrideFromRequest,
  resolveSqlGatewayApiKey,
  resolveSqlGatewayBase,
  sqlGatewayQueryUrl,
} from '@/lib/reports/sql-gateway-config'

/**
 * KPI per product type — drill-down satu level di atas item.
 *
 * Agregasi gabungan issue 3-sumber (mengikuti patokan yang sama dengan
 * `inventory/route.ts` / `movement-matrix`):
 *   - gudang   : IN_STOCKISSUE/LN   (ItemType <> '4')
 *   - fuel/BBM : IN_FUELISSUE/LN    (ItemType <> '4')
 *   - workshop : WS_JOBSTOCK        (TransType='1', ItemType='4')
 * Tiap baris issue diberi penanda `Source` ('GUDANG'|'FUEL'|'WORKSHOP') agar bisa
 * di-split per sumber, lalu di-GROUP BY product_type_code.
 *
 * Mode:
 *   - tanpa `productType`  → mode 'list'   : array semua product type (ringkas).
 *   - dengan `productType` → mode 'detail' : satu type + split sumber + topItems + trend.
 *
 * Filter global yang diikuti: `months` (movementWindow), `location`, `itemType`.
 * Cache in-memory TTL pendek agar buka-tutup panel tidak memukul DB.
 *
 * Mode demo: `?demo=1` menghasilkan data sintetis deterministik (tanpa DB).
 */

type ReportSource = 'estate' | 'pabrik'

type ProductTypeKpiRow = {
  code: string
  name: string
  itemCount: number
  valuasi: number
  closing: number
  issueQty: number
  issueAmount: number
  /** Pemecah Total Issue per sumber tabel (RPTIN: issueAmount = gudang+fuel+workshop). */
  gudangAmount: number
  fuelAmount: number
  workshopAmount: number
  fastCount: number
  movingCount: number
  slowCount: number
  deadCount: number
  lastMovement: string | null
}

type SourceSplit = { qty: number; amount: number }

type ProductTypeDetail = ProductTypeKpiRow & {
  split: { gudang: SourceSplit; fuel: SourceSplit; workshop: SourceSplit }
  topItems: Array<{ code: string; name: string; qty: number; amount: number }>
  trend: Array<{ period: string; qty: number; amount: number }>
}

type ListResponse = {
  success: boolean
  mode: 'list'
  source: ReportSource
  months: number
  closingPeriod?: string
  rows: ProductTypeKpiRow[]
  cached?: boolean
  error?: string
}

type DetailResponse = {
  success: boolean
  mode: 'detail'
  source: ReportSource
  months: number
  closingPeriod?: string
  row: ProductTypeDetail | null
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

const cache = new Map<string, { at: number; payload: ListResponse | DetailResponse }>()
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

/** Kode inventory aman untuk SQL literal (ItemCode / ProdType / LocCode). */
function cleanCode(raw: string, max = 40) {
  return raw.trim().replace(/[^A-Za-z0-9._\-\/ ]/g, '').replace(/'/g, '').slice(0, max)
}

/** Movement window: tanggal mulai inklusif dari `months` bulan trailing. */
function movementWindowStart(months: number): string {
  const first = trailingPeriods(months)[0]
  return `${first}-01`
}

/** Periode accounting (AccYear/AccMonth) mundur satu bulan. */
function previousAccountingPeriod(accYear: number, accMonth: number) {
  if (accMonth <= 1) return { accYear: accYear - 1, accMonth: 12 }
  return { accYear, accMonth: accMonth - 1 }
}

/**
 * Periode snapshot closing (IN_MTHENDITEM) — mengikuti pola resolveAssetValuationPeriod
 * di inventory/route.ts: periode accounting dari bulan berjalan, lalu mundur SATU bulan
 * karena bulan berjalan umumnya belum punya snapshot month-end.
 * Nilainya dihitung sekali di TS dan di-inject sebagai literal SQL.
 */
function resolveClosingSnapshotPeriod(now: Date = new Date()) {
  const current = actualToAccountingPeriod(now.getFullYear(), now.getMonth() + 1)
  if (!current) throw new Error('Periode accounting saat ini tidak valid')
  const snapshot = previousAccountingPeriod(current.accYear, current.accMonth)
  return {
    accYear: snapshot.accYear,
    accMonth: snapshot.accMonth,
    closingPeriod: `${snapshot.accYear}-${pad2(snapshot.accMonth)}`,
  }
}

/**
 * CTE closing per product type dari IN_MTHENDITEM (snapshot periode akuntansi).
 * Per item: Amount jika > 0, else Qty * AverageCost. Join IN_ITEM untuk ProdTypeCode
 * dan filter LocCode. Filter periode pakai ekspresi integer toleran-tipe
 * (pola yang sama dengan inventory/route.ts via sqlIntegerExpression).
 */
function buildClosingCte(
  database: string,
  snapshot: { accYear: number; accMonth: number },
  opts: { locCode?: string },
) {
  const loc = opts.locCode ? cleanCode(opts.locCode, 16) : ''
  const mthendLoc = loc ? ` AND RTRIM(m.LocCode) = '${loc}'` : ''
  return `closing AS (
      SELECT
        RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProdTypeCode,
        CAST(SUM(
          CASE WHEN ISNULL(m.Amount, 0) > 0
            THEN ISNULL(m.Amount, 0)
            ELSE ISNULL(m.Qty, 0) * ISNULL(m.AverageCost, 0)
          END
        ) AS DECIMAL(18,2)) AS Closing
      FROM [${database}].[dbo].[IN_MTHENDITEM] m
      INNER JOIN [${database}].[dbo].[IN_ITEM] i
        ON i.ItemCode = m.ItemCode AND i.LocCode = m.LocCode
      WHERE ${sqlIntegerExpression('m.AccYear')} = ${snapshot.accYear}
        AND ${sqlIntegerExpression('m.AccMonth')} = ${snapshot.accMonth}${mthendLoc}
      GROUP BY RTRIM(ISNULL(i.ProdTypeCode, ''))
    )`
}

/**
 * Ekspresi tanggal dokumen stock issue (gudang) — patokan CreateDate-utama,
 * SAMA dengan stockIssueDocumentDateExpression di inventory/route.ts.
 * PostDate sering placeholder 1900; fallback: CreateDate → PostDate(≠1900) → UpdateDate.
 */
function stockIssueDate(alias: string) {
  return `COALESCE(NULLIF(${alias}.CreateDate, CONVERT(datetime, '1900-01-01')), NULLIF(${alias}.PostDate, CONVERT(datetime, '1900-01-01')), ${alias}.UpdateDate)`
}

/** Filter status posted stock issue (gudang) — sama dengan inventory/route.ts. */
function stockIssueStatusFilter(alias: string) {
  return `AND RTRIM(ISNULL(${alias}.Status, '')) IN ('2', '5', '6')`
}

/** Ekspresi tanggal dokumen fuel — CreateDate-utama, sama dengan fuelIssueDocumentDateExpression. */
function fuelDate(alias: string) {
  return `COALESCE(NULLIF(${alias}.CreateDate, CONVERT(datetime, '1900-01-01')), NULLIF(${alias}.PostDate, CONVERT(datetime, '1900-01-01')), NULLIF(${alias}.FuelIssueRefDate, CONVERT(datetime, '1900-01-01')), ${alias}.UpdateDate)`
}

/** Filter status posted fuel — sama dengan fuelIssueStatusFilter. */
function fuelStatusFilter(alias: string) {
  return `AND RTRIM(ISNULL(${alias}.Status, '')) IN ('2', '6')`
}

/** Ekspresi tanggal workshop — CreateDate-utama, mengikuti workshopStockIssueDateExpression di inventory/route.ts. */
function workshopDate(alias: string) {
  return `COALESCE(NULLIF(${alias}.CreateDate, CONVERT(datetime, '1900-01-01')), NULLIF(${alias}.PostDate, CONVERT(datetime, '1900-01-01')), ${alias}.TransDate)`
}

/** Ekspresi amount workshop — mengikuti helper di inventory/route.ts. */
function workshopAmount(alias: string) {
  return `COALESCE(${alias}.Amount, ${alias}.PriceAmount, ISNULL(${alias}.Qty, 0) * ISNULL(${alias}.Price, 0), 0)`
}

/**
 * CTE issue 3-sumber dengan kolom Source. Filter itemType:
 *   - '1' / 'gudang'    → hanya gudang + fuel
 *   - '4' / 'workshop'  → hanya workshop
 *   - kosong            → ketiganya
 */
function buildIssueCte(
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
      SELECT
        RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProdTypeCode,
        RTRIM(l.ItemCode) AS ItemCode,
        RTRIM(ISNULL(i.Description, l.ItemCode)) AS ItemName,
        'GUDANG' AS Source,
        ${stockIssueDate('h')} AS Tanggal,
        RTRIM(CONVERT(varchar(50), h.StockIssueID)) AS Dokumen,
        CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS DECIMAL(18,2)) AS Amount
      FROM [${database}].[dbo].[IN_STOCKISSUELN] l
      INNER JOIN [${database}].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
      LEFT JOIN [${database}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE ${stockIssueDate('h')} >= '${dateFrom}'
        ${stockIssueStatusFilter('h')}
        AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'${gudangLoc}
    `)
    branches.push(`
      SELECT
        RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProdTypeCode,
        RTRIM(l.ItemCode) AS ItemCode,
        RTRIM(ISNULL(i.Description, l.ItemCode)) AS ItemName,
        'FUEL' AS Source,
        ${fuelDate('h')} AS Tanggal,
        RTRIM(CONVERT(varchar(50), h.FuelIssueID)) AS Dokumen,
        CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS DECIMAL(18,2)) AS Amount
      FROM [${database}].[dbo].[IN_FUELISSUELN] l
      INNER JOIN [${database}].[dbo].[IN_FUELISSUE] h ON l.FuelIssueID = h.FuelIssueID
      LEFT JOIN [${database}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE ${fuelDate('h')} >= '${dateFrom}'
        ${fuelStatusFilter('h')}
        AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'${gudangLoc}
    `)
  }
  if (opts.includeWorkshop) {
    branches.push(`
      SELECT
        RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProdTypeCode,
        RTRIM(s.ItemCode) AS ItemCode,
        RTRIM(ISNULL(i.Description, s.ItemCode)) AS ItemName,
        'WORKSHOP' AS Source,
        ${workshopDate('s')} AS Tanggal,
        COALESCE(
          NULLIF(RTRIM(CONVERT(varchar(50), s.JobStockIssueID)), ''),
          NULLIF(RTRIM(CONVERT(varchar(50), s.JobStockID)), ''),
          NULLIF(RTRIM(CONVERT(varchar(50), s.JobID)), '')
        ) AS Dokumen,
        CAST(ISNULL(s.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(${workshopAmount('s')} AS DECIMAL(18,2)) AS Amount
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
    return buildIssueCte(database, dateFrom, { ...opts, includeGudang: true })
  }
  return `WITH issue_docs AS (${branches.join(' UNION ALL ')})`
}

/** Kategori movement per item dari distinct issue doc dalam window (threshold patokan). */
function categoryCase(countExpr: string) {
  return `CASE
    WHEN ${countExpr} >= 6 THEN 'FAST'
    WHEN ${countExpr} BETWEEN 2 AND 5 THEN 'MOVING'
    WHEN ${countExpr} = 1 THEN 'SLOW'
    ELSE 'DEAD' END`
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function toRow(r: DbRow): ProductTypeKpiRow {
  return {
    code: String(r.code ?? '').trim(),
    name: String(r.name ?? r.code ?? '').trim(),
    itemCount: toNumber(r.itemCount),
    valuasi: toNumber(r.valuasi),
    closing: toNumber(r.closing),
    issueQty: toNumber(r.issueQty),
    issueAmount: toNumber(r.issueAmount),
    gudangAmount: toNumber(r.gudangAmount),
    fuelAmount: toNumber(r.fuelAmount),
    workshopAmount: toNumber(r.workshopAmount),
    fastCount: toNumber(r.fastCount),
    movingCount: toNumber(r.movingCount),
    slowCount: toNumber(r.slowCount),
    deadCount: toNumber(r.deadCount),
    lastMovement: r.lastMovement ? String(r.lastMovement) : null,
  }
}

// ---------- demo deterministik ----------
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function demoList(months: number): ProductTypeKpiRow[] {
  const rand = mulberry32(20260724)
  const defs: Array<[string, string]> = [
    ['PUPUK', 'Pupuk'],
    ['SPARE', 'Sparepart'],
    ['FUEL', 'BBM'],
    ['KIMIA', 'Bahan Kimia'],
    ['ALAT', 'Alat & Perlengkapan'],
  ]
  return defs.map(([code, name]) => {
    const itemCount = 8 + Math.round(rand() * 40)
    const valuasi = Math.round(rand() * 4_000_000_000 + 250_000_000)
    const closing = Math.round(valuasi * (0.8 + rand() * 0.3))
    const issueAmount = Math.round(valuasi * (0.1 + rand() * 0.6))
    const issueQty = Math.round(issueAmount / (50_000 + rand() * 400_000))
    const fast = Math.round(itemCount * rand() * 0.3)
    const moving = Math.round(itemCount * rand() * 0.4)
    const slow = Math.round(itemCount * rand() * 0.2)
    const dead = Math.max(0, itemCount - fast - moving - slow)
    const gudangAmount = Math.round(issueAmount * 0.5)
    const fuelAmount = Math.round(issueAmount * 0.3)
    const workshopAmount = issueAmount - gudangAmount - fuelAmount
    void months
    return {
      code, name, itemCount, valuasi, closing, issueQty, issueAmount,
      gudangAmount, fuelAmount, workshopAmount,
      fastCount: fast, movingCount: moving, slowCount: slow, deadCount: dead,
      lastMovement: new Date().toISOString().slice(0, 10),
    }
  })
}

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const source = getSource(request)
  const sp = request.nextUrl.searchParams
  const months = clampInt(Number(sp.get('months')), 3, 120, 12)
  const productType = cleanCode(sp.get('productType') ?? '', 24)
  const location = cleanCode(sp.get('location') ?? sp.get('locCode') ?? '', 16)
  const itemType = (sp.get('itemType') ?? '').trim().toLowerCase()
  const includeGudang = !itemType || itemType === '1' || itemType === 'gudang'
  const includeWorkshop = !itemType || itemType === '4' || itemType === 'workshop'
  const isDetail = productType.length > 0

  const server = sourceToServer(source)
  const database = databaseForServer(server)
  const dateFrom = movementWindowStart(months)
  const closingSnapshot = resolveClosingSnapshotPeriod()

  const cacheKey = `${source}|${months}|${itemType || 'all'}|${location}|${productType || 'list'}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true })
  }

  // Mode demo eksplisit.
  if (sp.get('demo') === '1') {
    if (isDetail) {
      const base = demoList(months).find((r) => r.code === productType) ?? demoList(months)[0]
      const total = base.issueAmount || 1
      const row: ProductTypeDetail = {
        ...base,
        split: {
          gudang: { qty: Math.round(base.issueQty * 0.5), amount: Math.round(total * 0.5) },
          fuel: { qty: Math.round(base.issueQty * 0.3), amount: Math.round(total * 0.3) },
          workshop: { qty: Math.round(base.issueQty * 0.2), amount: Math.round(total * 0.2) },
        },
        topItems: [
          { code: 'FE025', name: 'BUAMAX / NPK 13/6/27/4', qty: 120, amount: Math.round(total * 0.2) },
          { code: 'FE012', name: 'MOP', qty: 90, amount: Math.round(total * 0.15) },
          { code: 'OL003', name: 'OLI MESRAN SAE 40', qty: 60, amount: Math.round(total * 0.1) },
        ],
        trend: trailingPeriods(months).map((period, i) => ({
          period,
          qty: Math.round(base.issueQty / months * (0.7 + 0.5 * Math.sin(i))),
          amount: Math.round(total / months * (0.7 + 0.5 * Math.sin(i))),
        })),
      }
      const payload: DetailResponse = { success: true, mode: 'detail', source, months, closingPeriod: closingSnapshot.closingPeriod, row }
      return NextResponse.json(payload)
    }
    const payload: ListResponse = { success: true, mode: 'list', source, months, closingPeriod: closingSnapshot.closingPeriod, rows: demoList(months) }
    return NextResponse.json(payload)
  }

  const typeFilter = isDetail ? ` AND c.ProdTypeCode = '${productType}'` : ''

  // Query LIST: agregasi per product type + valuasi live (IN_ITEM) + closing snapshot (IN_MTHENDITEM).
  const listSql = `
    ${buildIssueCte(database, dateFrom, { includeGudang, includeWorkshop, locCode: location || undefined })},
    base AS (
      SELECT * FROM issue_docs WHERE Tanggal IS NOT NULL
    ),
    per_item AS (
      SELECT
        ProdTypeCode,
        ItemCode,
        MAX(ItemName) AS ItemName,
        COUNT(DISTINCT Dokumen) AS DocCount,
        CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS Qty,
        CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS Amount,
        MAX(Tanggal) AS LastMovement
      FROM base
      GROUP BY ProdTypeCode, ItemCode
    ),
    categorized AS (
      SELECT
        ProdTypeCode,
        ItemCode,
        ItemName,
        Qty,
        Amount,
        LastMovement,
        ${categoryCase('DocCount')} AS Category
      FROM per_item
    ),
    valuation AS (
      SELECT
        RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProdTypeCode,
        COUNT(*) AS ItemCount,
        CAST(SUM((ISNULL(i.QtyOnHand, 0) + ISNULL(i.QtyOnHold, 0)) * ISNULL(i.AverageCost, 0)) AS DECIMAL(18,2)) AS Valuasi
      FROM [${database}].[dbo].[IN_ITEM] i
      ${location ? `WHERE RTRIM(i.LocCode) = '${location}'` : ''}
      GROUP BY RTRIM(ISNULL(i.ProdTypeCode, ''))
    ),
    ${buildClosingCte(database, closingSnapshot, { locCode: location || undefined })},
    per_source AS (
      SELECT
        ProdTypeCode,
        CAST(SUM(CASE WHEN Source = 'GUDANG' THEN ISNULL(Amount, 0) ELSE 0 END) AS DECIMAL(18,2)) AS gudangAmount,
        CAST(SUM(CASE WHEN Source = 'FUEL' THEN ISNULL(Amount, 0) ELSE 0 END) AS DECIMAL(18,2)) AS fuelAmount,
        CAST(SUM(CASE WHEN Source = 'WORKSHOP' THEN ISNULL(Amount, 0) ELSE 0 END) AS DECIMAL(18,2)) AS workshopAmount
      FROM base
      GROUP BY ProdTypeCode
    )
    SELECT
      c.ProdTypeCode AS code,
      RTRIM(ISNULL(pt.Description, c.ProdTypeCode)) AS name,
      ISNULL(v.ItemCount, COUNT(DISTINCT c.ItemCode)) AS itemCount,
      ISNULL(v.Valuasi, 0) AS valuasi,
      ISNULL(cl.Closing, 0) AS closing,
      CAST(SUM(ISNULL(c.Qty, 0)) AS DECIMAL(18,2)) AS issueQty,
      CAST(SUM(ISNULL(c.Amount, 0)) AS DECIMAL(18,2)) AS issueAmount,
      ISNULL(src.gudangAmount, 0) AS gudangAmount,
      ISNULL(src.fuelAmount, 0) AS fuelAmount,
      ISNULL(src.workshopAmount, 0) AS workshopAmount,
      SUM(CASE WHEN c.Category = 'FAST' THEN 1 ELSE 0 END) AS fastCount,
      SUM(CASE WHEN c.Category = 'MOVING' THEN 1 ELSE 0 END) AS movingCount,
      SUM(CASE WHEN c.Category = 'SLOW' THEN 1 ELSE 0 END) AS slowCount,
      SUM(CASE WHEN c.Category = 'DEAD' THEN 1 ELSE 0 END) AS deadCount,
      MAX(c.LastMovement) AS lastMovement
    FROM categorized c
    LEFT JOIN [${database}].[dbo].[IN_PRODTYPE] pt ON RTRIM(pt.ProdTypeCode) = c.ProdTypeCode
    LEFT JOIN valuation v ON v.ProdTypeCode = c.ProdTypeCode
    LEFT JOIN closing cl ON cl.ProdTypeCode = c.ProdTypeCode
    LEFT JOIN per_source src ON src.ProdTypeCode = c.ProdTypeCode
    WHERE c.ProdTypeCode <> ''${typeFilter}
    GROUP BY c.ProdTypeCode, pt.Description, v.ItemCount, v.Valuasi, cl.Closing, src.gudangAmount, src.fuelAmount, src.workshopAmount
    ORDER BY issueAmount DESC
  `

  try {
    if (!isDetail) {
      const raw = await runQuery(server, database, listSql)
      const payload: ListResponse = {
        success: true, mode: 'list', source, months, closingPeriod: closingSnapshot.closingPeriod, rows: raw.map(toRow),
      }
      cache.set(cacheKey, { at: Date.now(), payload })
      return NextResponse.json(payload)
    }

    // DETAIL: baris KPI utama (list difilter type) + split sumber + topItems + trend.
    const splitSql = `
      ${buildIssueCte(database, dateFrom, { includeGudang, includeWorkshop, locCode: location || undefined })}
      SELECT
        Source,
        CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
        CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount
      FROM issue_docs
      WHERE Tanggal IS NOT NULL AND ProdTypeCode = '${productType}'
      GROUP BY Source
    `
    const topItemsSql = `
      ${buildIssueCte(database, dateFrom, { includeGudang, includeWorkshop, locCode: location || undefined })}
      SELECT TOP 8
        ItemCode AS code,
        MAX(ItemName) AS name,
        CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
        CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount
      FROM issue_docs
      WHERE Tanggal IS NOT NULL AND ProdTypeCode = '${productType}'
      GROUP BY ItemCode
      ORDER BY amount DESC, qty DESC
    `
    const trendSql = `
      ${buildIssueCte(database, dateFrom, { includeGudang, includeWorkshop, locCode: location || undefined })}
      SELECT
        CONVERT(char(7), Tanggal, 120) AS period,
        CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
        CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount
      FROM issue_docs
      WHERE Tanggal IS NOT NULL AND ProdTypeCode = '${productType}'
      GROUP BY CONVERT(char(7), Tanggal, 120)
      ORDER BY period
    `

    const [listRaw, splitRaw, topRaw, trendRaw] = await Promise.all([
      runQuery(server, database, listSql),
      runQuery(server, database, splitSql).catch(() => [] as DbRow[]),
      runQuery(server, database, topItemsSql).catch(() => [] as DbRow[]),
      runQuery(server, database, trendSql).catch(() => [] as DbRow[]),
    ])

    const base = listRaw.map(toRow)[0] ?? null
    const splitMap = new Map<string, SourceSplit>()
    for (const r of splitRaw) {
      splitMap.set(String(r.Source ?? '').toUpperCase(), { qty: toNumber(r.qty), amount: toNumber(r.amount) })
    }
    const row: ProductTypeDetail | null = base
      ? {
          ...base,
          split: {
            gudang: splitMap.get('GUDANG') ?? { qty: 0, amount: 0 },
            fuel: splitMap.get('FUEL') ?? { qty: 0, amount: 0 },
            workshop: splitMap.get('WORKSHOP') ?? { qty: 0, amount: 0 },
          },
          topItems: topRaw.map((r) => ({
            code: String(r.code ?? '').trim(),
            name: String(r.name ?? r.code ?? '').trim(),
            qty: toNumber(r.qty),
            amount: toNumber(r.amount),
          })),
          trend: trendRaw.map((r) => ({
            period: String(r.period ?? '').trim(),
            qty: toNumber(r.qty),
            amount: toNumber(r.amount),
          })),
        }
      : null

    const payload: DetailResponse = { success: true, mode: 'detail', source, months, closingPeriod: closingSnapshot.closingPeriod, row }
    cache.set(cacheKey, { at: Date.now(), payload })
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isDetail) {
      return NextResponse.json(
        { success: false, mode: 'detail', source, months, row: null, error: message } satisfies DetailResponse,
        { status: 200 },
      )
    }
    return NextResponse.json(
      { success: false, mode: 'list', source, months, rows: [], error: message } satisfies ListResponse,
      { status: 200 },
    )
  }
}

export async function GET(request: NextRequest) {
  const gatewayOverride = gatewayOverrideFromRequest(request)
  return gatewayOverrideFromRequestStorage.run(gatewayOverride, () => handleGet(request))
}
