import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { actualToAccountingPeriod } from '@/lib/reports/accounting-period'
import { validateReadOnlySql } from '@/lib/reports/report-filtering'
import {
  MOVEMENT_CATEGORY_ORDER,
  normalizeMovementCategoryThresholds,
  type MovementCategory,
  type MovementCategoryThresholds,
} from '@/lib/reports/movement-category'
import {
  gatewayOverrideFromRequest,
  resolveSqlGatewayApiKey,
  resolveSqlGatewayBase,
  sqlGatewayQueryUrl,
} from '@/lib/reports/sql-gateway-config'

/**
 * Movement category evolution — stacked history of item count / qty / amount
 * per category (Fast/Moving/Slow/Dead) across trailing months, plus a
 * movers table showing items whose first-vs-last active category changed.
 *
 * Full-scope counterpart to the client-side helper in
 * `lib/reports/movement-category-evolution.ts`. Used by InventoryOverview.
 */

type ReportSource = 'estate' | 'pabrik'

type CategoryBucket = { count: number; qty: number; amount: number }

type CategoryEvolutionPoint = {
  period: string
  categories: Record<MovementCategory, CategoryBucket>
}

type MovementMover = {
  code: string
  name: string
  fromCategory: MovementCategory
  toCategory: MovementCategory
  firstPeriod: string
  lastPeriod: string
  /** Periode pertama barang mencapai Fast Moving to-date (khusus mode akumulasi). */
  firstFastPeriod?: string | null
  totalQty: number
  totalAmount: number
}

type EvolutionResponse = {
  success: boolean
  periods: string[]
  byPeriod: CategoryEvolutionPoint[]
  movers: MovementMover[]
  totals: { qty: number; amount: number; docs: number; itemCount: number }
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

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), min), max) : fallback
}

function parseAnchorPeriod(value?: string | null): Date {
  const match = String(value ?? '').trim().match(/^(\d{4})-(\d{1,2})$/)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    if (month >= 1 && month <= 12) return new Date(year, month - 1, 1)
  }
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

/** Parse 'YYYY-MM' jadi Date hari pertama bulan itu; null bila tidak valid. */
function parseMonthPeriod(value?: string | null): Date | null {
  const match = String(value ?? '').trim().match(/^(\d{4})-(\d{1,2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return new Date(year, month - 1, 1)
}

/** Returns chronological 'YYYY-MM' periods dari `from` s/d `anchor` (inklusif). */
function periodsInRange(from: Date, anchor: Date): string[] {
  const periods: string[] = []
  let year = from.getFullYear()
  let month = from.getMonth() + 1
  const endYear = anchor.getFullYear()
  const endMonth = anchor.getMonth() + 1
  while (year < endYear || (year === endYear && month <= endMonth)) {
    periods.push(`${year}-${pad2(month)}`)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return periods.length > 0 ? periods : [`${endYear}-${pad2(endMonth)}`]
}

/** Returns `months` chronological 'YYYY-MM' periods ending at `anchor` (inclusive). */
function trailingPeriods(months: number, anchor: Date): string[] {
  const periods: string[] = []
  let year = anchor.getFullYear()
  let month = anchor.getMonth() + 1
  for (let i = 0; i < months; i += 1) {
    periods.unshift(`${year}-${pad2(month)}`)
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }
  return periods
}

const cache = new Map<string, { at: number; payload: EvolutionResponse }>()
const CACHE_TTL_MS = 60_000

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

import { AsyncLocalStorage } from 'node:async_hooks'
const gatewayOverrideFromRequestStorage = new AsyncLocalStorage<string | null>()

function emptyCategories(): Record<MovementCategory, CategoryBucket> {
  return {
    'Fast Moving': { count: 0, qty: 0, amount: 0 },
    Moving: { count: 0, qty: 0, amount: 0 },
    'Slow Moving': { count: 0, qty: 0, amount: 0 },
    'Dead Stock': { count: 0, qty: 0, amount: 0 },
  }
}

function itemTypeScopeFromParam(itemType: string): '1' | '4' | 'all' {
  if (itemType === '1' || itemType === 'gudang') return '1'
  if (itemType === '4' || itemType === 'workshop') return '4'
  return 'all'
}

function buildIssueRowsCte(
  database: string,
  dateFrom: string,
  dateToExclusive: string,
  itemTypeScope: '1' | '4' | 'all',
): string {
  const includeGudang = itemTypeScope !== '4'
  const includeWorkshop = itemTypeScope !== '1'

  // Gudang (IN_STOCKISSUE) — patokan tanggal CreateDate-utama + status posted (2/5/6),
  // selaras KPI utama di app/api/reports/inventory/route.ts (stockIssueDocumentDateExpression).
  const gudangDocDate = `COALESCE(NULLIF(h.CreateDate, CONVERT(datetime, '1900-01-01')), NULLIF(h.PostDate, CONVERT(datetime, '1900-01-01')), h.UpdateDate)`
  const gudangQuery = `
    SELECT
      RTRIM(l.ItemCode) AS KodeBarang,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
      RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProductType,
      ${gudangDocDate} AS Tanggal,
      RTRIM(CONVERT(varchar(50), h.StockIssueID)) AS Dokumen,
      CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
      CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS DECIMAL(18,2)) AS Amount
    FROM [${database}].[dbo].[IN_STOCKISSUELN] l
    INNER JOIN [${database}].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
    LEFT JOIN [${database}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
    WHERE ${gudangDocDate} >= '${dateFrom}' AND ${gudangDocDate} < '${dateToExclusive}'
      AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
      AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'
  `

  // Workshop (WS_JOBSTOCK) — patokan tanggal CreateDate-utama, fallback PostDate(≠1900) → TransDate.
  // Tanpa filter status: cakupan sudah dibatasi TransType = '1' (selaras KPI utama).
  const workshopDocDate = `COALESCE(NULLIF(s.CreateDate, CONVERT(datetime, '1900-01-01')), NULLIF(s.PostDate, CONVERT(datetime, '1900-01-01')), s.TransDate)`
  const workshopQuery = `
    SELECT
      RTRIM(s.ItemCode) AS KodeBarang,
      RTRIM(ISNULL(i.Description, s.ItemCode)) AS NamaBarang,
      RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProductType,
      ${workshopDocDate} AS Tanggal,
      COALESCE(
        NULLIF(RTRIM(CONVERT(varchar(50), s.JobStockIssueID)), ''),
        NULLIF(RTRIM(CONVERT(varchar(50), s.JobStockID)), ''),
        NULLIF(RTRIM(CONVERT(varchar(50), s.JobID)), '')
      ) AS Dokumen,
      CAST(ISNULL(s.Qty, 0) AS DECIMAL(18,2)) AS Qty,
      CAST(COALESCE(s.Amount, s.PriceAmount, ISNULL(s.Qty, 0) * ISNULL(s.Price, 0), 0) AS DECIMAL(18,2)) AS Amount
    FROM [${database}].[dbo].[WS_JOBSTOCK] s
    LEFT JOIN [${database}].[dbo].[WS_JOB] j ON s.JobID = j.JobID
    LEFT JOIN [${database}].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
    WHERE ${workshopDocDate} >= '${dateFrom}'
      AND ${workshopDocDate} < '${dateToExclusive}'
      AND RTRIM(ISNULL(s.TransType, '')) = '1'
      AND COALESCE(
            NULLIF(RTRIM(CONVERT(varchar(10), i.ItemType)), ''),
            NULLIF(RTRIM(CONVERT(varchar(10), s.ItemType)), '')
          ) = '4'
  `

  // Fuel BBM (IN_FUELISSUE/LN) — patokan tanggal CreateDate-utama + status posted (2/6),
  // selaras fuelIssueDocumentDateExpression/fuelIssueStatusFilter di lib/reports/inventory/fuel-issue-sql.ts.
  // Non-workshop (ItemType <> '4'), orphan lines ikut (LEFT JOIN master).
  const fuelDocDate = `COALESCE(NULLIF(h.CreateDate, CONVERT(datetime, '1900-01-01')), NULLIF(h.PostDate, CONVERT(datetime, '1900-01-01')), NULLIF(h.FuelIssueRefDate, CONVERT(datetime, '1900-01-01')), h.UpdateDate)`
  const fuelQuery = `
    SELECT
      RTRIM(l.ItemCode) AS KodeBarang,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
      RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProductType,
      ${fuelDocDate} AS Tanggal,
      RTRIM(CONVERT(varchar(50), h.FuelIssueID)) AS Dokumen,
      CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
      CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS DECIMAL(18,2)) AS Amount
    FROM [${database}].[dbo].[IN_FUELISSUELN] l
    INNER JOIN [${database}].[dbo].[IN_FUELISSUE] h ON l.FuelIssueID = h.FuelIssueID
    LEFT JOIN [${database}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
    WHERE ${fuelDocDate} >= '${dateFrom}' AND ${fuelDocDate} < '${dateToExclusive}'
      AND RTRIM(ISNULL(h.Status, '')) IN ('2', '6')
      AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'
  `

  const parts: string[] = []
  if (includeGudang) parts.push(gudangQuery, fuelQuery)
  if (includeWorkshop) parts.push(workshopQuery)
  if (parts.length === 0) parts.push('SELECT NULL AS KodeBarang WHERE 1=0')

  return parts.join(' UNION ALL ')
}

function buildEvolutionSql(
  database: string,
  dateFrom: string,
  dateToExclusive: string,
  thresholds: MovementCategoryThresholds,
  itemTypeScope: '1' | '4' | 'all',
): string {
  const issueRows = buildIssueRowsCte(database, dateFrom, dateToExclusive, itemTypeScope)
  return `
    WITH issue_rows AS (
      ${issueRows}
    ),
    item_period AS (
      SELECT
        KodeBarang,
        MAX(NamaBarang) AS NamaBarang,
        CONVERT(varchar(7), Tanggal, 120) AS period,
        COUNT(DISTINCT Dokumen) AS docs,
        CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
        CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount
      FROM issue_rows
      WHERE Tanggal IS NOT NULL
      GROUP BY KodeBarang, CONVERT(varchar(7), Tanggal, 120)
    ),
    classified AS (
      SELECT
        KodeBarang,
        NamaBarang,
        period,
        docs,
        qty,
        amount,
        CASE
          WHEN docs >= ${thresholds.fastMinIssueCount} THEN 'Fast Moving'
          WHEN docs BETWEEN ${thresholds.movingMinIssueCount} AND ${thresholds.movingMaxIssueCount} THEN 'Moving'
          WHEN docs = ${thresholds.slowIssueCount} THEN 'Slow Moving'
          ELSE 'Dead Stock'
        END AS category
      FROM item_period
    )
    SELECT
      period,
      category,
      COUNT(DISTINCT KodeBarang) AS itemCount,
      CAST(SUM(qty) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(amount) AS DECIMAL(18,2)) AS amount
    FROM classified
    GROUP BY period, category
    ORDER BY period, category
  `
}

/**
 * Mode akumulasi to-date: klasifikasi bulan X dihitung dari total dokumen issue
 * sejak dateFrom s/d akhir bulan X (running sum), bukan dari bulan itu saja.
 * Karena to-date monoton naik, kategori barang cenderung naik (Dead→Slow→Moving→Fast).
 */
function buildCumulativeEvolutionSql(
  database: string,
  dateFrom: string,
  dateToExclusive: string,
  thresholds: MovementCategoryThresholds,
  itemTypeScope: '1' | '4' | 'all',
): string {
  const issueRows = buildIssueRowsCte(database, dateFrom, dateToExclusive, itemTypeScope)
  return `
    WITH issue_rows AS (
      ${issueRows}
    ),
    item_period AS (
      SELECT
        KodeBarang,
        MAX(NamaBarang) AS NamaBarang,
        CONVERT(varchar(7), Tanggal, 120) AS period,
        COUNT(DISTINCT Dokumen) AS docs,
        CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
        CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount
      FROM issue_rows
      WHERE Tanggal IS NOT NULL
      GROUP BY KodeBarang, CONVERT(varchar(7), Tanggal, 120)
    ),
    cumulative AS (
      SELECT
        KodeBarang,
        NamaBarang,
        period,
        qty,
        amount,
        SUM(docs) OVER (PARTITION BY KodeBarang ORDER BY period ROWS UNBOUNDED PRECEDING) AS cum_docs
      FROM item_period
    ),
    classified AS (
      SELECT
        KodeBarang,
        period,
        qty,
        amount,
        CASE
          WHEN cum_docs >= ${thresholds.fastMinIssueCount} THEN 'Fast Moving'
          WHEN cum_docs BETWEEN ${thresholds.movingMinIssueCount} AND ${thresholds.movingMaxIssueCount} THEN 'Moving'
          WHEN cum_docs = ${thresholds.slowIssueCount} THEN 'Slow Moving'
          ELSE 'Dead Stock'
        END AS category
      FROM cumulative
    )
    SELECT
      period,
      category,
      COUNT(DISTINCT KodeBarang) AS itemCount,
      CAST(SUM(qty) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(amount) AS DECIMAL(18,2)) AS amount
    FROM classified
    GROUP BY period, category
    ORDER BY period, category
  `
}

/**
 * Movers to-date: kategori pertama vs terakhir berdasar running docs, plus
 * periode saat barang mencapai Fast Moving (akumulasi >= fastMin).
 */
function buildCumulativeMoversSql(
  database: string,
  dateFrom: string,
  dateToExclusive: string,
  thresholds: MovementCategoryThresholds,
  itemTypeScope: '1' | '4' | 'all',
): string {
  const issueRows = buildIssueRowsCte(database, dateFrom, dateToExclusive, itemTypeScope)
  return `
    WITH issue_rows AS (
      ${issueRows}
    ),
    item_period AS (
      SELECT
        KodeBarang,
        MAX(NamaBarang) AS NamaBarang,
        CONVERT(varchar(7), Tanggal, 120) AS period,
        COUNT(DISTINCT Dokumen) AS docs,
        CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
        CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount
      FROM issue_rows
      WHERE Tanggal IS NOT NULL
      GROUP BY KodeBarang, CONVERT(varchar(7), Tanggal, 120)
    ),
    cumulative AS (
      SELECT
        KodeBarang,
        NamaBarang,
        period,
        qty,
        amount,
        SUM(docs) OVER (PARTITION BY KodeBarang ORDER BY period ROWS UNBOUNDED PRECEDING) AS cum_docs
      FROM item_period
    ),
    classified AS (
      SELECT
        KodeBarang,
        NamaBarang,
        period,
        qty,
        amount,
        cum_docs,
        CASE
          WHEN cum_docs >= ${thresholds.fastMinIssueCount} THEN 'Fast Moving'
          WHEN cum_docs BETWEEN ${thresholds.movingMinIssueCount} AND ${thresholds.movingMaxIssueCount} THEN 'Moving'
          WHEN cum_docs = ${thresholds.slowIssueCount} THEN 'Slow Moving'
          ELSE 'Dead Stock'
        END AS category
      FROM cumulative
    ),
    ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY KodeBarang ORDER BY period ASC) AS rn_asc,
        ROW_NUMBER() OVER (PARTITION BY KodeBarang ORDER BY period DESC) AS rn_desc
      FROM classified
    )
    SELECT
      KodeBarang AS code,
      MAX(NamaBarang) AS name,
      MAX(CASE WHEN rn_asc = 1 THEN category END) AS fromCategory,
      MAX(CASE WHEN rn_desc = 1 THEN category END) AS toCategory,
      MAX(CASE WHEN rn_asc = 1 THEN period END) AS firstPeriod,
      MAX(CASE WHEN rn_desc = 1 THEN period END) AS lastPeriod,
      MIN(CASE WHEN cum_docs >= ${thresholds.fastMinIssueCount} THEN period END) AS firstFastPeriod,
      CAST(SUM(qty) AS DECIMAL(18,2)) AS totalQty,
      CAST(SUM(amount) AS DECIMAL(18,2)) AS totalAmount
    FROM ranked
    GROUP BY KodeBarang
    ORDER BY totalAmount DESC
  `
}

function buildMoversSql(
  database: string,
  dateFrom: string,
  dateToExclusive: string,
  thresholds: MovementCategoryThresholds,
  itemTypeScope: '1' | '4' | 'all',
): string {
  const issueRows = buildIssueRowsCte(database, dateFrom, dateToExclusive, itemTypeScope)
  return `
    WITH issue_rows AS (
      ${issueRows}
    ),
    item_period AS (
      SELECT
        KodeBarang,
        MAX(NamaBarang) AS NamaBarang,
        CONVERT(varchar(7), Tanggal, 120) AS period,
        COUNT(DISTINCT Dokumen) AS docs,
        CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
        CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount
      FROM issue_rows
      WHERE Tanggal IS NOT NULL
      GROUP BY KodeBarang, CONVERT(varchar(7), Tanggal, 120)
    ),
    classified AS (
      SELECT
        KodeBarang,
        NamaBarang,
        period,
        docs,
        qty,
        amount,
        CASE
          WHEN docs >= ${thresholds.fastMinIssueCount} THEN 'Fast Moving'
          WHEN docs BETWEEN ${thresholds.movingMinIssueCount} AND ${thresholds.movingMaxIssueCount} THEN 'Moving'
          WHEN docs = ${thresholds.slowIssueCount} THEN 'Slow Moving'
          ELSE 'Dead Stock'
        END AS category
      FROM item_period
    ),
    ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY KodeBarang ORDER BY period ASC) AS rn_asc,
        ROW_NUMBER() OVER (PARTITION BY KodeBarang ORDER BY period DESC) AS rn_desc
      FROM classified
    )
    SELECT
      code,
      name,
      fromCategory,
      toCategory,
      firstPeriod,
      lastPeriod,
      totalQty,
      totalAmount
    FROM (
      SELECT
        KodeBarang AS code,
        MAX(NamaBarang) AS name,
        MAX(CASE WHEN rn_asc = 1 THEN category END) AS fromCategory,
        MAX(CASE WHEN rn_desc = 1 THEN category END) AS toCategory,
        MAX(CASE WHEN rn_asc = 1 THEN period END) AS firstPeriod,
        MAX(CASE WHEN rn_desc = 1 THEN period END) AS lastPeriod,
        CAST(SUM(qty) AS DECIMAL(18,2)) AS totalQty,
        CAST(SUM(amount) AS DECIMAL(18,2)) AS totalAmount
      FROM ranked
      GROUP BY KodeBarang
      HAVING MAX(CASE WHEN rn_asc = 1 THEN category END) <> MAX(CASE WHEN rn_desc = 1 THEN category END)
    ) m
    ORDER BY totalAmount DESC
  `
}

/**
 * Analisis per Product Type (per bulan, mandiri): klasifikasi product-type per
 * bulan dari total docs seluruh item di type itu bulan itu. Movers = product
 * type yang kategorinya berubah antara bulan aktif pertama vs terakhir.
 */
function buildProductTypeEvolutionSql(
  database: string,
  dateFrom: string,
  dateToExclusive: string,
  thresholds: MovementCategoryThresholds,
  itemTypeScope: '1' | '4' | 'all',
): string {
  const issueRows = buildIssueRowsCte(database, dateFrom, dateToExclusive, itemTypeScope)
  return `
    WITH issue_rows AS (
      ${issueRows}
    ),
    type_period AS (
      SELECT
        NULLIF(ProductType, '') AS ProductType,
        CONVERT(varchar(7), Tanggal, 120) AS period,
        COUNT(DISTINCT Dokumen) AS docs,
        COUNT(DISTINCT KodeBarang) AS itemCount,
        CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
        CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount
      FROM issue_rows
      WHERE Tanggal IS NOT NULL AND NULLIF(ProductType, '') IS NOT NULL
      GROUP BY NULLIF(ProductType, ''), CONVERT(varchar(7), Tanggal, 120)
    ),
    classified AS (
      SELECT
        ProductType,
        period,
        docs,
        itemCount,
        qty,
        amount,
        CASE
          WHEN docs >= ${thresholds.fastMinIssueCount} THEN 'Fast Moving'
          WHEN docs BETWEEN ${thresholds.movingMinIssueCount} AND ${thresholds.movingMaxIssueCount} THEN 'Moving'
          WHEN docs = ${thresholds.slowIssueCount} THEN 'Slow Moving'
          ELSE 'Dead Stock'
        END AS category
      FROM type_period
    )
    SELECT
      period,
      category,
      COUNT(DISTINCT ProductType) AS itemCount,
      CAST(SUM(qty) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(amount) AS DECIMAL(18,2)) AS amount
    FROM classified
    GROUP BY period, category
    ORDER BY period, category
  `
}

function buildProductTypeMoversSql(
  database: string,
  dateFrom: string,
  dateToExclusive: string,
  thresholds: MovementCategoryThresholds,
  itemTypeScope: '1' | '4' | 'all',
  accumulate: boolean,
): string {
  const issueRows = buildIssueRowsCte(database, dateFrom, dateToExclusive, itemTypeScope)
  const docsExpr = accumulate
    ? 'SUM(docs) OVER (PARTITION BY ProductType ORDER BY period ROWS UNBOUNDED PRECEDING)'
    : 'docs'
  return `
    WITH issue_rows AS (
      ${issueRows}
    ),
    type_period AS (
      SELECT
        NULLIF(ProductType, '') AS ProductType,
        CONVERT(varchar(7), Tanggal, 120) AS period,
        COUNT(DISTINCT Dokumen) AS docs,
        CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
        CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount
      FROM issue_rows
      WHERE Tanggal IS NOT NULL AND NULLIF(ProductType, '') IS NOT NULL
      GROUP BY NULLIF(ProductType, ''), CONVERT(varchar(7), Tanggal, 120)
    ),
    measured AS (
      SELECT
        ProductType,
        period,
        qty,
        amount,
        ${docsExpr} AS measure_docs
      FROM type_period
    ),
    classified AS (
      SELECT
        ProductType,
        period,
        qty,
        amount,
        measure_docs,
        CASE
          WHEN measure_docs >= ${thresholds.fastMinIssueCount} THEN 'Fast Moving'
          WHEN measure_docs BETWEEN ${thresholds.movingMinIssueCount} AND ${thresholds.movingMaxIssueCount} THEN 'Moving'
          WHEN measure_docs = ${thresholds.slowIssueCount} THEN 'Slow Moving'
          ELSE 'Dead Stock'
        END AS category
      FROM measured
    ),
    ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY ProductType ORDER BY period ASC) AS rn_asc,
        ROW_NUMBER() OVER (PARTITION BY ProductType ORDER BY period DESC) AS rn_desc
      FROM classified
    )
    SELECT
      ProductType AS code,
      ProductType AS name,
      MAX(CASE WHEN rn_asc = 1 THEN category END) AS fromCategory,
      MAX(CASE WHEN rn_desc = 1 THEN category END) AS toCategory,
      MAX(CASE WHEN rn_asc = 1 THEN period END) AS firstPeriod,
      MAX(CASE WHEN rn_desc = 1 THEN period END) AS lastPeriod,
      MIN(CASE WHEN measure_docs >= ${thresholds.fastMinIssueCount} THEN period END) AS firstFastPeriod,
      CAST(SUM(qty) AS DECIMAL(18,2)) AS totalQty,
      CAST(SUM(amount) AS DECIMAL(18,2)) AS totalAmount
    FROM ranked
    GROUP BY ProductType
    ORDER BY totalAmount DESC
  `
}

function buildTotalItemsSql(database: string, itemTypeScope: '1' | '4' | 'all'): string {
  const itemTypeFilter =
    itemTypeScope === 'all'
      ? `RTRIM(CONVERT(varchar(10), ItemType)) IN ('1', '4')`
      : `RTRIM(CONVERT(varchar(10), ItemType)) = '${itemTypeScope}'`
  return `SELECT COUNT(*) AS totalItemCount FROM [${database}].[dbo].[IN_ITEM] WHERE ${itemTypeFilter}`
}

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

const DEMO_ITEMS: Array<[string, string]> = [
  ['FE025', 'BUAMAX / NPK 13/6/27/4+0.65B'],
  ['MFE012', 'PUPUK COMPOS'],
  ['FE023', 'NPK 12/12/17/2 + TE'],
  ['FE012', 'MOP'],
  ['FE039', 'NPK 15/15/6/4'],
  ['OL003', 'OLI MESRAN SAE 40'],
  ['PS057', 'SPAREPART POMPA IRIGASI'],
  ['CH001', 'GLYPHOSATE 480 SL'],
  ['SP110', 'BEARING 6310 ZZ'],
  ['FUEL01', 'SOLAR INDUSTRI HSD'],
  ['FE001', 'UREA 46% N'],
  ['PS052', 'V-BELT B-65'],
]

function demoEvolution(periods: string[], thresholds: MovementCategoryThresholds): EvolutionResponse {
  const rand = mulberry32(20260724)
  const byPeriod: CategoryEvolutionPoint[] = periods.map((period) => ({
    period,
    categories: emptyCategories(),
  }))
  const itemHistory = new Map<string, { name: string; categories: MovementCategory[]; periods: string[]; qty: number; amount: number }>()

  for (const [code, name] of DEMO_ITEMS) {
    const regularity = (rand() * 0.7 + 0.2)
    const baseAmount = 50_000 + rand() * 1_500_000
    const categories: MovementCategory[] = []
    const activePeriods: string[] = []
    let totalQty = 0
    let totalAmount = 0

    periods.forEach((period, pIdx) => {
      const drift = pIdx / Math.max(1, periods.length - 1)
      const active = rand() < regularity + drift * 0.2
      if (!active) {
        categories.push('Dead Stock')
        return
      }
      const docs = Math.max(1, Math.round(rand() * 8 + 1))
      const qty = Math.round((10 + rand() * 200) * (1 + drift))
      const amount = Math.round(qty * baseAmount / 1000)
      totalQty += qty
      totalAmount += amount
      activePeriods.push(period)

      if (docs >= thresholds.fastMinIssueCount) categories.push('Fast Moving')
      else if (docs >= thresholds.movingMinIssueCount) categories.push('Moving')
      else if (docs === thresholds.slowIssueCount) categories.push('Slow Moving')
      else categories.push('Dead Stock')
    })

    itemHistory.set(code, { name, categories, periods: activePeriods, qty: totalQty, amount: totalAmount })

    categories.forEach((category, idx) => {
      byPeriod[idx].categories[category].count += 1
    })

    periods.forEach((period, idx) => {
      if (categories[idx] === 'Dead Stock') return
      const qty = Math.round((10 + rand() * 200) * (1 + idx / Math.max(1, periods.length - 1)))
      const amount = Math.round(qty * baseAmount / 1000)
      byPeriod[idx].categories[categories[idx]].qty += qty
      byPeriod[idx].categories[categories[idx]].amount += amount
    })
  }

  const movers: MovementMover[] = []
  for (const [code, history] of itemHistory) {
    const active = history.categories
      .map((category, idx) => ({ category, period: periods[idx] }))
      .filter((p) => p.category !== 'Dead Stock')
    if (active.length >= 2 && active[0].category !== active[active.length - 1].category) {
      movers.push({
        code,
        name: history.name,
        fromCategory: active[0].category,
        toCategory: active[active.length - 1].category,
        firstPeriod: active[0].period,
        lastPeriod: active[active.length - 1].period,
        totalQty: history.qty,
        totalAmount: history.amount,
      })
    }
  }

  const totals = {
    qty: byPeriod.reduce((sum, p) => sum + Object.values(p.categories).reduce((s, c) => s + c.qty, 0), 0),
    amount: byPeriod.reduce((sum, p) => sum + Object.values(p.categories).reduce((s, c) => s + c.amount, 0), 0),
    docs: DEMO_ITEMS.length * periods.length * 3,
    itemCount: DEMO_ITEMS.length,
  }

  return {
    success: true,
    periods,
    byPeriod,
    movers: movers.slice(0, 12),
    totals,
  }
}

function normalizeCategory(value: unknown): MovementCategory {
  const label = String(value ?? '').trim()
  if ((MOVEMENT_CATEGORY_ORDER as readonly string[]).includes(label)) return label as MovementCategory
  return 'Dead Stock'
}

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const source = getSource(request)
  const sp = request.nextUrl.searchParams
  const monthsParam = clampInt(sp.get('months'), 1, 120, 12)
  const anchor = parseAnchorPeriod(sp.get('period'))
  const itemType = (sp.get('itemType') ?? '').trim().toLowerCase()
  const itemTypeScope = itemTypeScopeFromParam(itemType)

  const thresholds = normalizeMovementCategoryThresholds({
    fastMinIssueCount: sp.get('movementFastMin'),
    movingMinIssueCount: sp.get('movementMovingMin'),
    movingMaxIssueCount: sp.get('movementMovingMax'),
    slowIssueCount: sp.get('movementSlowCount'),
  })

  // Mode akumulasi to-date: klasifikasi bulan X dari running total docs sejak dateFrom.
  const accumulate = sp.get('accumulate') === '1' || sp.get('cumulative') === '1'
  // Dimensi analisis movers/evolusi: per item code vs per product type.
  const dimension = (sp.get('dimension') ?? 'item').trim().toLowerCase() === 'product-type' ? 'product-type' : 'item'
  // Top-N movers yang dikembalikan (atur berapa baris barang/type yang ditampilkan).
  const topN = clampInt(sp.get('top'), 1, 200, 12)

  // Custom range dari timeline (dateFrom/dateTo 'YYYY-MM') menimpa preset months.
  const customFrom = parseMonthPeriod(sp.get('dateFrom'))
  const customTo = parseMonthPeriod(sp.get('dateTo'))
  const customRange = customFrom && customTo && customFrom.getTime() <= customTo.getTime()
  const rangeAnchor = customRange ? (customTo ?? anchor) : anchor
  const periods = customRange
    ? periodsInRange(customFrom ?? anchor, rangeAnchor)
    : trailingPeriods(monthsParam, rangeAnchor)
  const firstPeriod = periods[0]
  const lastPeriod = periods[periods.length - 1]
  const dateFrom = `${firstPeriod}-01`
  const nextMonth = new Date(rangeAnchor.getFullYear(), rangeAnchor.getMonth() + 1, 1)
  const dateToExclusive = `${nextMonth.getFullYear()}-${pad2(nextMonth.getMonth() + 1)}-01`
  const server = sourceToServer(source)
  const database = databaseForServer(server)

  const cacheKey = `${source}|${firstPeriod}|${lastPeriod}|${itemTypeScope}|${accumulate ? 'cum' : 'monthly'}|${dimension}|${topN}|${thresholds.fastMinIssueCount}|${thresholds.movingMinIssueCount}|${thresholds.movingMaxIssueCount}|${thresholds.slowIssueCount}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true })
  }

  if (sp.get('demo') === '1') {
    return NextResponse.json(demoEvolution(periods, thresholds))
  }

  try {
    let evolutionSql: string
    let moversSql: string
    if (dimension === 'product-type') {
      evolutionSql = buildProductTypeEvolutionSql(database, dateFrom, dateToExclusive, thresholds, itemTypeScope)
      moversSql = buildProductTypeMoversSql(database, dateFrom, dateToExclusive, thresholds, itemTypeScope, accumulate)
    } else {
      evolutionSql = accumulate
        ? buildCumulativeEvolutionSql(database, dateFrom, dateToExclusive, thresholds, itemTypeScope)
        : buildEvolutionSql(database, dateFrom, dateToExclusive, thresholds, itemTypeScope)
      moversSql = accumulate
        ? buildCumulativeMoversSql(database, dateFrom, dateToExclusive, thresholds, itemTypeScope)
        : buildMoversSql(database, dateFrom, dateToExclusive, thresholds, itemTypeScope)
    }
    const totalItemsSql = buildTotalItemsSql(database, itemTypeScope)

    // Valuation by item×calendar period (monthend past + live current) so Amount ≈ stock valuation.
    const currentYm = lastPeriod
    const accPairs = periods
      .filter((p) => p !== currentYm)
      .map((period) => {
        const [y, m] = period.split('-').map(Number)
        const acc = actualToAccountingPeriod(y, m)
        return acc ? { period, accYear: acc.accYear, accMonth: acc.accMonth } : null
      })
      .filter((row): row is { period: string; accYear: number; accMonth: number } => Boolean(row))
    const itemTypeSql =
      itemTypeScope === '4'
        ? `RTRIM(ISNULL(CONVERT(varchar(10), i.ItemType), '')) = '4'`
        : itemTypeScope === '1'
          ? `RTRIM(ISNULL(CONVERT(varchar(10), i.ItemType), '')) = '1'`
          : `RTRIM(ISNULL(CONVERT(varchar(10), i.ItemType), '')) IN ('1','4')`
    const valuationSql = `
      WITH item_scope AS (
        SELECT RTRIM(i.ItemCode) AS code,
          CAST(ISNULL(i.QtyOnHand, 0) + ISNULL(i.QtyOnHold, 0) AS DECIMAL(18,2)) AS liveQty,
          CAST(ISNULL(i.AverageCost, 0) AS DECIMAL(18,4)) AS liveCost
        FROM [${database}].[dbo].[IN_ITEM] i
        WHERE ${itemTypeSql} AND RTRIM(ISNULL(i.Status, '0')) = '1'
      ),
      monthend_val AS (
        SELECT RTRIM(m.ItemCode) AS code,
          CASE
            ${accPairs.map((p) => `WHEN RTRIM(CONVERT(varchar(10), m.AccYear)) = '${p.accYear}' AND TRY_CONVERT(int, NULLIF(RTRIM(CONVERT(varchar(10), m.AccMonth)), '')) = ${p.accMonth} THEN '${p.period}'`).join('\n            ')}
            ELSE NULL
          END AS period,
          CAST(SUM(
            ISNULL(m.Qty, 0) * COALESCE(
              NULLIF(m.AverageCost, 0),
              CASE WHEN ISNULL(m.Qty, 0) = 0 THEN 0 ELSE ISNULL(m.Amount, 0) / NULLIF(m.Qty, 0) END,
              0
            )
          ) AS DECIMAL(18,2)) AS valuation
        FROM [${database}].[dbo].[IN_MTHENDITEM] m
        INNER JOIN item_scope s ON s.code = RTRIM(m.ItemCode)
        WHERE ${accPairs.length
          ? accPairs.map((p) => `(RTRIM(CONVERT(varchar(10), m.AccYear)) = '${p.accYear}' AND TRY_CONVERT(int, NULLIF(RTRIM(CONVERT(varchar(10), m.AccMonth)), '')) = ${p.accMonth})`).join(' OR ')
          : '1=0'}
        GROUP BY RTRIM(m.ItemCode),
          CASE
            ${accPairs.map((p) => `WHEN RTRIM(CONVERT(varchar(10), m.AccYear)) = '${p.accYear}' AND TRY_CONVERT(int, NULLIF(RTRIM(CONVERT(varchar(10), m.AccMonth)), '')) = ${p.accMonth} THEN '${p.period}'`).join('\n            ')}
            ELSE NULL
          END
      ),
      live_val AS (
        SELECT code, '${currentYm}' AS period, CAST(SUM(liveQty * liveCost) AS DECIMAL(18,2)) AS valuation
        FROM item_scope GROUP BY code
      )
      SELECT code, period, valuation FROM monthend_val WHERE period IS NOT NULL
      UNION ALL
      SELECT code, period, valuation FROM live_val
    `

    // Item×period docs for category + valuation join (full universe for Dead Stock with stock).
    const itemDocsSql = `
      WITH issue_rows AS (
        ${buildIssueRowsCte(database, dateFrom, dateToExclusive, itemTypeScope)}
      )
      SELECT
        RTRIM(KodeBarang) AS code,
        CONVERT(varchar(7), Tanggal, 120) AS period,
        COUNT(DISTINCT Dokumen) AS docs,
        CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty
      FROM issue_rows
      WHERE Tanggal IS NOT NULL
      GROUP BY RTRIM(KodeBarang), CONVERT(varchar(7), Tanggal, 120)
    `

    const [evolutionRows, moversRows, totalItemsRows, valuationRows, itemDocsRows] = await Promise.all([
      runQuery(server, database, evolutionSql),
      runQuery(server, database, moversSql),
      runQuery(server, database, totalItemsSql),
      runQuery(server, database, valuationSql).catch(() => [] as DbRow[]),
      runQuery(server, database, itemDocsSql).catch(() => [] as DbRow[]),
    ])

    const byPeriod: CategoryEvolutionPoint[] = periods.map((period) => ({
      period,
      categories: emptyCategories(),
    }))
    const periodIndex = new Map<string, number>(periods.map((p, i) => [p, i]))
    let totalQty = 0
    let totalAmount = 0
    let totalDocs = 0

    // Prefer valuation-based amount composition when valuation rows available.
    const valuationByKey = new Map<string, number>()
    for (const row of valuationRows) {
      const code = String(row.code ?? '').trim()
      const period = String(row.period ?? '').trim()
      if (!code || !period) continue
      valuationByKey.set(`${code}|${period}`, Number(row.valuation ?? 0) || 0)
    }
    const docsByKey = new Map<string, { docs: number; qty: number }>()
    for (const row of itemDocsRows) {
      const code = String(row.code ?? '').trim()
      const period = String(row.period ?? '').trim()
      if (!code || !period) continue
      docsByKey.set(`${code}|${period}`, {
        docs: Number(row.docs ?? 0) || 0,
        qty: Number(row.qty ?? 0) || 0,
      })
    }

    if (valuationByKey.size > 0) {
      // Rebuild count/qty/amount from item docs + stock valuation.
      const seenCount = new Map<string, Set<string>>() // period|category -> item codes
      for (const [key, valuation] of valuationByKey) {
        const [code, period] = key.split('|')
        const idx = periodIndex.get(period)
        if (idx === undefined) continue
        const issue = docsByKey.get(key)
        const docs = issue?.docs ?? 0
        const qty = issue?.qty ?? 0
        let category: MovementCategory = 'Dead Stock'
        if (docs >= thresholds.fastMinIssueCount) category = 'Fast Moving'
        else if (docs >= thresholds.movingMinIssueCount && docs <= thresholds.movingMaxIssueCount) category = 'Moving'
        else if (docs === thresholds.slowIssueCount) category = 'Slow Moving'
        const bucket = byPeriod[idx].categories[category]
        const countKey = `${period}|${category}`
        if (!seenCount.has(countKey)) seenCount.set(countKey, new Set())
        if (!seenCount.get(countKey)!.has(code)) {
          seenCount.get(countKey)!.add(code)
          bucket.count += 1
        }
        bucket.qty += qty
        bucket.amount += valuation
        totalQty += qty
        totalAmount += valuation
      }
      // Keep issue-based evolutionRows as fallback for periods with no valuation coverage.
      for (const row of evolutionRows) {
        const period = String(row.period ?? '').trim()
        const idx = periodIndex.get(period)
        if (idx === undefined) continue
        // If this period already has valuation amount, skip issue-amount overwrite.
        const periodHasVal = periods[idx] && Array.from(valuationByKey.keys()).some((k) => k.endsWith(`|${period}`))
        if (periodHasVal) continue
        const category = normalizeCategory(row.category)
        byPeriod[idx].categories[category].count += Number(row.itemCount ?? 0)
        byPeriod[idx].categories[category].qty += Number(row.qty ?? 0)
        byPeriod[idx].categories[category].amount += Number(row.amount ?? 0)
      }
    } else {
      for (const row of evolutionRows) {
        const period = String(row.period ?? '').trim()
        const category = normalizeCategory(row.category)
        const idx = periodIndex.get(period)
        if (idx === undefined) continue
        const count = Number(row.itemCount ?? 0)
        const qty = Number(row.qty ?? 0)
        const amount = Number(row.amount ?? 0)
        byPeriod[idx].categories[category].count += count
        byPeriod[idx].categories[category].qty += qty
        byPeriod[idx].categories[category].amount += amount
        totalQty += qty
        totalAmount += amount
      }
    }

    // Docs total isn't returned by the evolution aggregation; derive from movers or keep 0.
    totalDocs = 0

    const movers: MovementMover[] = moversRows.map((row) => ({
      code: String(row.code ?? '').trim(),
      name: String(row.name ?? row.code ?? '').trim(),
      fromCategory: normalizeCategory(row.fromCategory),
      toCategory: normalizeCategory(row.toCategory),
      firstPeriod: String(row.firstPeriod ?? '').trim(),
      lastPeriod: String(row.lastPeriod ?? '').trim(),
      firstFastPeriod: row.firstFastPeriod ? String(row.firstFastPeriod).trim() : null,
      totalQty: Number(row.totalQty ?? 0),
      totalAmount: Number(row.totalAmount ?? 0),
    }))

    const totalItemCount = Number(totalItemsRows[0]?.totalItemCount ?? 0)

    const payload: EvolutionResponse = {
      success: true,
      periods,
      byPeriod,
      movers: movers.slice(0, topN),
      totals: {
        qty: totalQty,
        amount: totalAmount,
        docs: totalDocs,
        itemCount: totalItemCount,
      },
    }
    cache.set(cacheKey, { at: Date.now(), payload })
    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        periods,
        byPeriod: periods.map((period) => ({ period, categories: emptyCategories() })),
        movers: [],
        totals: { qty: 0, amount: 0, docs: 0, itemCount: 0 },
        error: error instanceof Error ? error.message : String(error),
      } satisfies EvolutionResponse,
      { status: 200 },
    )
  }
}

export async function GET(request: NextRequest) {
  const gatewayOverride = gatewayOverrideFromRequest(request)
  return gatewayOverrideFromRequestStorage.run(gatewayOverride, () => handleGet(request))
}
