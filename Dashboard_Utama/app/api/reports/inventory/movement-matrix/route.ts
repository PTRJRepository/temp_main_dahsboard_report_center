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
 * Movement matrix — heatmap barang (Y) × periode bulan (X).
 *
 * Satu query read-only GROUP BY KodeBarang × tahun × bulan dari gabungan issue
 * gudang (IN_STOCKISSUE/LN) + workshop (WS_JOBSTOCK, TransType='1'), mengikuti
 * pola `issue_rows` di `inventory/route.ts` (pengeluaran-barang). Dipakai untuk
 * infografis movement: matriks intensitas movement per barang periode.
 *
 * Periode current dihitung live (data berubah terus); rentang default 12 bulan
 * terakhir. Cache in-memory TTL pendek agar buka-tutup section tidak memukul DB.
 */

type ReportSource = 'estate' | 'pabrik'

type MatrixRow = {
  code: string
  name: string
  cells: { qty: number[]; amount: number[]; docs: number[] }
}

type MatrixResponse = {
  success: boolean
  periods: string[]
  rows: MatrixRow[]
  metric: 'qty' | 'amount'
  currentPeriod: string
  source: ReportSource
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
  // mundur (months-1) bulan dari bulan berjalan
  for (let i = 0; i < months - 1; i += 1) {
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }
  // maju lagi untuk urutan kronologis
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

/** In-memory cache TTL pendek per key (source+months+top+metric-independent). */
const cache = new Map<string, { at: number; payload: MatrixResponse }>()
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

// AsyncLocalStorage ringan untuk override gateway base dari header (konsisten dgn inventory route).
import { AsyncLocalStorage } from 'node:async_hooks'
const gatewayOverrideFromRequestStorage = new AsyncLocalStorage<string | null>()

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.trunc(value), min), max)
}

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const source = getSource(request)
  const sp = request.nextUrl.searchParams
  const months = clampInt(Number(sp.get('months')), 3, 36, 12)
  const top = clampInt(Number(sp.get('top')), 3, 40, 12)
  const itemType = (sp.get('itemType') ?? '').trim().toLowerCase()
  const includeGudang = !itemType || itemType === '1' || itemType === 'gudang'
  const includeWorkshop = !itemType || itemType === '4' || itemType === 'workshop'

  const periods = trailingPeriods(months)
  const firstPeriod = periods[0]
  const dateFrom = `${firstPeriod}-01`
  const server = sourceToServer(source)
  const database = databaseForServer(server)
  const DATABASE = database

  const cacheKey = `${source}|${months}|${top}|${itemType || 'all'}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true })
  }

  // Pola issue_rows (lihat inventory/route.ts:3315-3370), tapi diagregasi per barang×bulan.
  // Ekspresi tanggal/dokumen/amount/itemType workshop PERSIS mengikuti helper aslinya:
  //   workshopStockIssueDateExpression('s')      = COALESCE(NULLIF(s.PostDate,'1900-01-01'), s.TransDate)
  //   workshopStockIssueDocumentExpression('s')  = COALESCE(JobStockIssueID, JobStockID, JobID)
  //   workshopStockIssueAmountExpression('s')    = COALESCE(s.Amount, s.PriceAmount, s.Qty*s.Price, 0)
  //   workshopStockIssueItemTypeExpression('i','s') = COALESCE(i.ItemType, s.ItemType)
  const gudangQuery = `
      SELECT
        RTRIM(l.ItemCode) AS KodeBarang,
        RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
        h.PostDate AS Tanggal,
        RTRIM(CONVERT(varchar(50), h.StockIssueID)) AS Dokumen,
        CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS DECIMAL(18,2)) AS Amount
      FROM [${DATABASE}].[dbo].[IN_STOCKISSUELN] l
      INNER JOIN [${DATABASE}].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
      LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE h.PostDate >= '${dateFrom}'
        AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'
  `
  const workshopQuery = `
      SELECT
        RTRIM(s.ItemCode) AS KodeBarang,
        RTRIM(ISNULL(i.Description, s.ItemCode)) AS NamaBarang,
        COALESCE(NULLIF(s.PostDate, CONVERT(datetime, '1900-01-01')), s.TransDate) AS Tanggal,
        COALESCE(
          NULLIF(RTRIM(CONVERT(varchar(50), s.JobStockIssueID)), ''),
          NULLIF(RTRIM(CONVERT(varchar(50), s.JobStockID)), ''),
          NULLIF(RTRIM(CONVERT(varchar(50), s.JobID)), '')
        ) AS Dokumen,
        CAST(ISNULL(s.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(COALESCE(s.Amount, s.PriceAmount, ISNULL(s.Qty, 0) * ISNULL(s.Price, 0), 0) AS DECIMAL(18,2)) AS Amount
      FROM [${DATABASE}].[dbo].[WS_JOBSTOCK] s
      LEFT JOIN [${DATABASE}].[dbo].[WS_JOB] j ON s.JobID = j.JobID
      LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
      WHERE COALESCE(NULLIF(s.PostDate, CONVERT(datetime, '1900-01-01')), s.TransDate) >= '${dateFrom}'
        AND RTRIM(ISNULL(s.TransType, '')) = '1'
        AND COALESCE(
              NULLIF(RTRIM(CONVERT(varchar(10), i.ItemType)), ''),
              NULLIF(RTRIM(CONVERT(varchar(10), s.ItemType)), '')
            ) = '4'
  `

  const queries: string[] = []
  if (includeGudang) queries.push(gudangQuery)
  if (includeWorkshop) queries.push(workshopQuery)
  if (queries.length === 0) queries.push(gudangQuery)

  const sql = `
    WITH issue_rows AS (
      ${queries.join(' UNION ALL ')}
    ),
    per_item AS (
      SELECT
        KodeBarang,
        MAX(NamaBarang) AS NamaBarang,
        CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS totalAmount,
        CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS totalQty
      FROM issue_rows
      WHERE Tanggal IS NOT NULL
      GROUP BY KodeBarang
    ),
    top_items AS (
      SELECT TOP ${top} KodeBarang, NamaBarang
      FROM per_item
      ORDER BY totalAmount DESC, totalQty DESC
    )
    SELECT
      t.NamaBarang AS name,
      i.KodeBarang AS code,
      CONVERT(varchar(7), i.Tanggal, 120) AS period,
      COUNT(DISTINCT i.Dokumen) AS docs,
      CAST(SUM(ISNULL(i.Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(i.Amount, 0)) AS DECIMAL(18,2)) AS amount
    FROM issue_rows i
    INNER JOIN top_items t ON i.KodeBarang = t.KodeBarang
    WHERE i.Tanggal IS NOT NULL
    GROUP BY t.NamaBarang, i.KodeBarang, CONVERT(varchar(7), i.Tanggal, 120)
    ORDER BY i.KodeBarang, period
  `

  try {
    const raw = await runQuery(server, database, sql)

    // Susun pivot: baris per barang, sel periode (urut kronologis).
    const periodIndex = new Map<string, number>(periods.map((p, i) => [p, i]))
    const byItem = new Map<string, MatrixRow & { total: number }>()
    for (const row of raw) {
      const code = String(row.code ?? '').trim()
      if (!code) continue
      const period = String(row.period ?? '').trim()
      const idx = periodIndex.get(period)
      if (idx === undefined) continue
      let entry = byItem.get(code)
      if (!entry) {
        entry = {
          code,
          name: String(row.name ?? code).trim() || code,
          cells: {
            qty: new Array<number>(periods.length).fill(0),
            amount: new Array<number>(periods.length).fill(0),
            docs: new Array<number>(periods.length).fill(0),
          },
          total: 0,
        }
        byItem.set(code, entry)
      }
      const qty = Number(row.qty ?? 0)
      const amount = Number(row.amount ?? 0)
      const docs = Number(row.docs ?? 0)
      entry.cells.qty[idx] = qty
      entry.cells.amount[idx] = amount
      entry.cells.docs[idx] = docs
      entry.total += amount
    }

    const rows: MatrixRow[] = Array.from(byItem.values())
      .sort((a, b) => b.total - a.total)
      .map(({ code, name, cells }) => ({ code, name, cells }))

    const payload: MatrixResponse = {
      success: true,
      periods,
      rows,
      metric: 'qty',
      currentPeriod: periods[periods.length - 1],
      source,
    }
    cache.set(cacheKey, { at: Date.now(), payload })
    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        periods,
        rows: [],
        metric: 'qty',
        currentPeriod: periods[periods.length - 1],
        source,
        error: error instanceof Error ? error.message : String(error),
      } satisfies MatrixResponse,
      { status: 200 },
    )
  }
}

export async function GET(request: NextRequest) {
  const gatewayOverride = gatewayOverrideFromRequest(request)
  return gatewayOverrideFromRequestStorage.run(gatewayOverride, () => handleGet(request))
}
