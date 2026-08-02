import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { actualToAccountingPeriod } from '@/lib/reports/accounting-period'
import { validateReadOnlySql } from '@/lib/reports/report-filtering'
import {
  gatewayOverrideFromRequest,
  resolveSqlGatewayApiKey,
  resolveSqlGatewayBase,
  sqlGatewayQueryUrl,
} from '@/lib/reports/sql-gateway-config'
import { fuelIssueDocumentDateExpression, fuelIssueStatusFilter } from '@/lib/reports/inventory/fuel-issue-sql'

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
 *
 * Mode demo: `?demo=1` menghasilkan matriks sintetis deterministik (tanpa DB) —
 * dipakai untuk verifikasi UI saat sumber data tak terjangkau. Tidak pernah
 * aktif tanpa param eksplisit.
 */

type ReportSource = 'estate' | 'pabrik'

type MatrixRow = {
  code: string
  name: string
  productType?: string
  /** qty/docs/amount = issue movement; valuation = stock value for category composition. */
  cells: { qty: number[]; amount: number[]; docs: number[]; valuation?: number[] }
}

/** Full-scope totals per period (not limited to top-N issue rows). */
type PeriodSummary = {
  period: string
  /** Stock valuation all items in scope (monthend / live). Includes no-movement. */
  valuation: number
  /** Issue qty (top universe + any issue activity in window). */
  issueQty: number
  /** Issue amount (flow, not valuation). */
  issueAmount: number
  /** Issue document count. */
  issueDocs: number
}

type MatrixResponse = {
  success: boolean
  periods: string[]
  rows: MatrixRow[]
  /** Full inventory valuation + issue activity by period for trend charts. */
  periodSummary?: PeriodSummary[]
  metric: 'qty' | 'amount'
  currentPeriod: string
  source: ReportSource
  productTypes?: Array<{ code: string; name: string }>
  filters?: { itemCode?: string; productType?: string; q?: string }
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

/** Kode inventory aman untuk SQL literal (ItemCode / ProdType). */
function cleanCode(raw: string, max = 40) {
  return raw.trim().replace(/[^A-Za-z0-9._\-\/ ]/g, '').replace(/'/g, '').slice(0, max)
}

function cleanLike(raw: string, max = 40) {
  return cleanCode(raw, max).replace(/%/g, '').replace(/_/g, '')
}

/** PRNG deterministik (mulberry32) — demo harus stabil antar request. */
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

/** Matriks sintetis: campuran pola fast-moving, reguler, slow-moving, dan seasonal. */
function demoMatrix(periods: string[], top: number): MatrixRow[] {
  const rand = mulberry32(20260724)
  const count = Math.min(top, DEMO_ITEMS.length)
  return DEMO_ITEMS.slice(0, count).map(([code, name], idx) => {
    const qty: number[] = []
    const amount: number[] = []
    const docs: number[] = []
    const valuation: number[] = []
    const unitCost = 25_000 + rand() * 2_400_000
    const stockBase = 80 + rand() * 1_200
    const regularity = idx < 3 ? 0.95 : idx < 8 ? 0.6 : 0.25
    periods.forEach((_, pIdx) => {
      const seasonal = 0.7 + 0.5 * Math.sin((pIdx / Math.max(1, periods.length - 1)) * Math.PI * 2 + idx)
      const active = rand() < regularity
      const d = active ? Math.max(1, Math.round(rand() * 6 * regularity + 1)) : 0
      const q = active ? Math.round((20 + rand() * 400) * seasonal) : 0
      const stockQty = Math.max(0, Math.round(stockBase * (0.85 + 0.3 * seasonal) - q * 0.15))
      docs.push(d)
      qty.push(q)
      amount.push(Math.round(q * unitCost))
      valuation.push(Math.round(stockQty * unitCost))
    })
    return { code, name, cells: { qty, amount, docs, valuation } }
  })
}

/** Build AccYear/AccMonth pairs for calendar periods (skip current month → live IN_ITEM). */
function monthendAccPairs(periods: string[], currentYm: string) {
  return periods
    .filter((p) => p !== currentYm)
    .map((period) => {
      const [y, m] = period.split('-').map(Number)
      const acc = actualToAccountingPeriod(y, m)
      return acc
        ? { period, accYear: acc.accYear, accMonth: acc.accMonth }
        : null
    })
    .filter((row): row is { period: string; accYear: number; accMonth: number } => Boolean(row))
}

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const source = getSource(request)
  const sp = request.nextUrl.searchParams
  // Match MovementAnalytics timeline custom max (3–120 bln).
  const months = clampInt(Number(sp.get('months')), 3, 120, 12)
  const top = clampInt(Number(sp.get('top')), 3, 80, 12)
  const itemType = (sp.get('itemType') ?? '').trim().toLowerCase()
  const itemCode = cleanCode(sp.get('itemCode') ?? '', 32)
  const productType = cleanCode(sp.get('productType') ?? '', 24)
  const q = cleanLike(sp.get('q') ?? '', 40)
  const includeGudang = !itemType || itemType === '1' || itemType === 'gudang'
  const includeWorkshop = !itemType || itemType === '4' || itemType === 'workshop'

  const periods = trailingPeriods(months)
  const firstPeriod = periods[0]
  const dateFrom = `${firstPeriod}-01`
  const server = sourceToServer(source)
  const database = databaseForServer(server)
  const DATABASE = database

  const cacheKey = `${source}|${months}|${top}|${itemType || 'all'}|${itemCode}|${productType}|${q}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true })
  }

  // Mode demo eksplisit — verifikasi UI tanpa DB (deterministik).
  if (sp.get('demo') === '1') {
    let rows = demoMatrix(periods, top)
    if (itemCode) rows = rows.filter((r) => r.code.toUpperCase() === itemCode.toUpperCase())
    if (q) {
      const qq = q.toLowerCase()
      rows = rows.filter((r) => r.code.toLowerCase().includes(qq) || r.name.toLowerCase().includes(qq))
    }
    const periodSummary = periods.map((period, i) => {
      let valuation = 0
      let issueQty = 0
      let issueAmount = 0
      let issueDocs = 0
      for (const row of rows) {
        valuation += Number(row.cells.valuation?.[i] ?? 0) || 0
        issueQty += Number(row.cells.qty[i] ?? 0) || 0
        issueAmount += Number(row.cells.amount[i] ?? 0) || 0
        issueDocs += Number(row.cells.docs[i] ?? 0) || 0
      }
      // Demo: inflate valuation slightly so "full stock" > issue-only rows
      return { period, valuation: Math.round(valuation * 1.35), issueQty, issueAmount, issueDocs }
    })
    return NextResponse.json({
      success: true,
      periods,
      rows,
      periodSummary,
      metric: 'qty',
      currentPeriod: periods[periods.length - 1],
      source,
      productTypes: [
        { code: 'PUPUK', name: 'Pupuk' },
        { code: 'SPARE', name: 'Sparepart' },
        { code: 'FUEL', name: 'BBM' },
      ],
      filters: { itemCode: itemCode || undefined, productType: productType || undefined, q: q || undefined },
    } satisfies MatrixResponse)
  }

  const itemFilterParts: string[] = []
  if (itemCode) {
    itemFilterParts.push(`RTRIM(ISNULL(i.ItemCode, '')) = '${itemCode}'`)
  }
  if (productType) {
    itemFilterParts.push(`RTRIM(ISNULL(i.ProdTypeCode, '')) = '${productType}'`)
  }
  if (q) {
    itemFilterParts.push(
      `(RTRIM(ISNULL(i.ItemCode, '')) LIKE N'%${q}%' OR RTRIM(ISNULL(i.Description, '')) LIKE N'%${q}%')`,
    )
  }
  const itemFilterSql = itemFilterParts.length ? ` AND ${itemFilterParts.join(' AND ')}` : ''
  // Saat filter product type / search: ambil lebih banyak item agar list terisi.
  const effectiveTop = itemCode ? 1 : productType || q ? Math.max(top, 40) : top

  // Pola issue_rows (lihat inventory/route.ts), diagregasi per barang×bulan.
  // Patokan tanggal & status diselaraskan dengan KPI utama inventory/route.ts
  // (CreateDate-utama + filter Status) agar angka satelit parity dengan KPI.
  const gudangTanggalExpr =
    "COALESCE(NULLIF(h.CreateDate, CONVERT(datetime, '1900-01-01')), NULLIF(h.PostDate, CONVERT(datetime, '1900-01-01')), h.UpdateDate)"
  const gudangQuery = `
      SELECT
        RTRIM(l.ItemCode) AS KodeBarang,
        RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
        RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProdTypeCode,
        ${gudangTanggalExpr} AS Tanggal,
        RTRIM(CONVERT(varchar(50), h.StockIssueID)) AS Dokumen,
        CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS DECIMAL(18,2)) AS Amount
      FROM [${DATABASE}].[dbo].[IN_STOCKISSUELN] l
      INNER JOIN [${DATABASE}].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
      LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE ${gudangTanggalExpr} >= '${dateFrom}'
        AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
        AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'
        ${itemFilterSql}
  `
  const workshopTanggalExpr =
    "COALESCE(NULLIF(s.CreateDate, CONVERT(datetime, '1900-01-01')), NULLIF(s.PostDate, CONVERT(datetime, '1900-01-01')), s.TransDate)"
  const workshopQuery = `
      SELECT
        RTRIM(s.ItemCode) AS KodeBarang,
        RTRIM(ISNULL(i.Description, s.ItemCode)) AS NamaBarang,
        RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProdTypeCode,
        ${workshopTanggalExpr} AS Tanggal,
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
      WHERE ${workshopTanggalExpr} >= '${dateFrom}'
        AND RTRIM(ISNULL(s.TransType, '')) = '1'
        AND COALESCE(
              NULLIF(RTRIM(CONVERT(varchar(10), i.ItemType)), ''),
              NULLIF(RTRIM(CONVERT(varchar(10), s.ItemType)), '')
            ) = '4'
        ${itemFilterSql}
  `
  const fuelQuery = `
      SELECT
        RTRIM(l.ItemCode) AS KodeBarang,
        RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
        RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProdTypeCode,
        ${fuelIssueDocumentDateExpression('h')} AS Tanggal,
        RTRIM(CONVERT(varchar(50), h.FuelIssueID)) AS Dokumen,
        CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS DECIMAL(18,2)) AS Amount
      FROM [${DATABASE}].[dbo].[IN_FUELISSUELN] l
      INNER JOIN [${DATABASE}].[dbo].[IN_FUELISSUE] h ON l.FuelIssueID = h.FuelIssueID
      LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE ${fuelIssueDocumentDateExpression('h')} >= '${dateFrom}'
        ${fuelIssueStatusFilter('h')}
        AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'
        ${itemFilterSql}
  `

  const queries: string[] = []
  if (includeGudang) {
    queries.push(gudangQuery)
    queries.push(fuelQuery)
  }
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
        MAX(ProdTypeCode) AS ProdTypeCode,
        CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS totalAmount,
        CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS totalQty
      FROM issue_rows
      WHERE Tanggal IS NOT NULL
      GROUP BY KodeBarang
    ),
    top_items AS (
      SELECT TOP ${effectiveTop} KodeBarang, NamaBarang, ProdTypeCode
      FROM per_item
      ORDER BY totalAmount DESC, totalQty DESC
    )
    SELECT
      t.NamaBarang AS name,
      i.KodeBarang AS code,
      t.ProdTypeCode AS productType,
      CONVERT(varchar(7), i.Tanggal, 120) AS period,
      COUNT(DISTINCT i.Dokumen) AS docs,
      CAST(SUM(ISNULL(i.Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(i.Amount, 0)) AS DECIMAL(18,2)) AS amount
    FROM issue_rows i
    INNER JOIN top_items t ON i.KodeBarang = t.KodeBarang
    WHERE i.Tanggal IS NOT NULL
    GROUP BY t.NamaBarang, i.KodeBarang, t.ProdTypeCode, CONVERT(varchar(7), i.Tanggal, 120)
    ORDER BY i.KodeBarang, period
  `

  const productTypesSql = `
    SELECT TOP 80
      RTRIM(pt.ProdTypeCode) AS code,
      RTRIM(ISNULL(pt.Description, pt.ProdTypeCode)) AS name
    FROM [${DATABASE}].[dbo].[IN_PRODTYPE] pt
    WHERE RTRIM(ISNULL(pt.ProdTypeCode, '')) <> ''
    ORDER BY RTRIM(ISNULL(pt.Description, pt.ProdTypeCode))
  `

  // Full-scope issue totals per period (TANPA batas TOP-N) — dipakai periodSummary
  // agar selaras KPI utama (handler stockIssue). `raw` (TOP-N) hanya untuk matriks UI.
  const summarySql = `
    WITH issue_rows AS (
      ${queries.join(' UNION ALL ')}
    )
    SELECT
      CONVERT(varchar(7), Tanggal, 120) AS period,
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount,
      COUNT(DISTINCT Dokumen) AS docs
    FROM issue_rows
    WHERE Tanggal IS NOT NULL
    GROUP BY CONVERT(varchar(7), Tanggal, 120)
  `

  const currentYm = periods[periods.length - 1]
  const accPairs = monthendAccPairs(periods, currentYm)
  const itemTypeSql =
    includeGudang && includeWorkshop
      ? `RTRIM(ISNULL(CONVERT(varchar(10), i.ItemType), '')) IN ('1','4')`
      : includeWorkshop
        ? `RTRIM(ISNULL(CONVERT(varchar(10), i.ItemType), '')) = '4'`
        : `RTRIM(ISNULL(CONVERT(varchar(10), i.ItemType), '')) = '1'`

  // Stock valuation by item×period (monthend for past, live IN_ITEM for current).
  // Used by movement-category composition Amount so Σ categories ≈ valuation, not issue flow.
  const valuationSql = `
    WITH item_scope AS (
      SELECT
        RTRIM(i.ItemCode) AS code,
        RTRIM(ISNULL(i.Description, i.ItemCode)) AS name,
        RTRIM(ISNULL(i.ProdTypeCode, '')) AS productType,
        CAST(ISNULL(i.QtyOnHand, 0) + ISNULL(i.QtyOnHold, 0) AS DECIMAL(18,2)) AS liveQty,
        CAST(ISNULL(i.AverageCost, 0) AS DECIMAL(18,4)) AS liveCost
      FROM [${DATABASE}].[dbo].[IN_ITEM] i
      WHERE ${itemTypeSql}
        AND RTRIM(ISNULL(i.Status, '0')) = '1'
        ${itemFilterSql}
    ),
    monthend_val AS (
      SELECT
        RTRIM(m.ItemCode) AS code,
        CASE
          ${accPairs.map((p) => `WHEN RTRIM(CONVERT(varchar(10), m.AccYear)) = '${p.accYear}' AND TRY_CONVERT(int, NULLIF(RTRIM(CONVERT(varchar(10), m.AccMonth)), '')) = ${p.accMonth} THEN '${p.period}'`).join('\n          ')}
          ELSE NULL
        END AS period,
        CAST(SUM(ISNULL(m.Qty, 0)) AS DECIMAL(18,2)) AS stockQty,
        CAST(
          SUM(
            ISNULL(m.Qty, 0) * COALESCE(
              NULLIF(m.AverageCost, 0),
              CASE WHEN ISNULL(m.Qty, 0) = 0 THEN 0 ELSE ISNULL(m.Amount, 0) / NULLIF(m.Qty, 0) END,
              0
            )
          ) AS DECIMAL(18,2)
        ) AS valuation
      FROM [${DATABASE}].[dbo].[IN_MTHENDITEM] m
      INNER JOIN item_scope s ON s.code = RTRIM(m.ItemCode)
      WHERE ${accPairs.length
        ? accPairs.map((p) => `(RTRIM(CONVERT(varchar(10), m.AccYear)) = '${p.accYear}' AND TRY_CONVERT(int, NULLIF(RTRIM(CONVERT(varchar(10), m.AccMonth)), '')) = ${p.accMonth})`).join(' OR ')
        : '1=0'}
      GROUP BY RTRIM(m.ItemCode),
        CASE
          ${accPairs.map((p) => `WHEN RTRIM(CONVERT(varchar(10), m.AccYear)) = '${p.accYear}' AND TRY_CONVERT(int, NULLIF(RTRIM(CONVERT(varchar(10), m.AccMonth)), '')) = ${p.accMonth} THEN '${p.period}'`).join('\n          ')}
          ELSE NULL
        END
    ),
    live_val AS (
      SELECT
        code,
        '${currentYm}' AS period,
        CAST(SUM(liveQty) AS DECIMAL(18,2)) AS stockQty,
        CAST(SUM(liveQty * liveCost) AS DECIMAL(18,2)) AS valuation
      FROM item_scope
      GROUP BY code
    )
    SELECT code, period, stockQty, valuation FROM monthend_val WHERE period IS NOT NULL
    UNION ALL
    SELECT code, period, stockQty, valuation FROM live_val
  `

  try {
    const [raw, productTypeRows, valuationRows, summaryRows] = await Promise.all([
      runQuery(server, database, sql),
      runQuery(server, database, productTypesSql).catch(() => [] as DbRow[]),
      runQuery(server, database, valuationSql).catch(() => [] as DbRow[]),
      runQuery(server, database, summarySql).catch(() => [] as DbRow[]),
    ])

    // Susun pivot: baris per barang, sel periode (urut kronologis).
    const periodIndex = new Map<string, number>(periods.map((p, i) => [p, i]))
    const byItem = new Map<string, MatrixRow & { total: number; productType?: string }>()
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
          productType: String(row.productType ?? '').trim() || undefined,
          cells: {
            qty: new Array<number>(periods.length).fill(0),
            amount: new Array<number>(periods.length).fill(0),
            docs: new Array<number>(periods.length).fill(0),
            valuation: new Array<number>(periods.length).fill(0),
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

    // Overlay stock valuation per item×period (for category composition Amount).
    // Also seed items that have stock but zero issue in window → Dead Stock with valuation.
    for (const row of valuationRows) {
      const code = String(row.code ?? '').trim()
      if (!code) continue
      const period = String(row.period ?? '').trim()
      const idx = periodIndex.get(period)
      if (idx === undefined) continue
      const valuation = Number(row.valuation ?? 0) || 0
      if (valuation <= 0) continue
      let entry = byItem.get(code)
      if (!entry) {
        entry = {
          code,
          name: code,
          productType: undefined,
          cells: {
            qty: new Array<number>(periods.length).fill(0),
            amount: new Array<number>(periods.length).fill(0),
            docs: new Array<number>(periods.length).fill(0),
            valuation: new Array<number>(periods.length).fill(0),
          },
          total: 0,
        }
        byItem.set(code, entry)
      }
      if (!entry.cells.valuation) {
        entry.cells.valuation = new Array<number>(periods.length).fill(0)
      }
      entry.cells.valuation[idx] = valuation
    }

    // Cap rows: prefer issue movers, then high-valuation dead stock.
    const ranked = Array.from(byItem.values()).sort((a, b) => {
      const va = (a.cells.valuation ?? []).reduce((s, v) => s + v, 0)
      const vb = (b.cells.valuation ?? []).reduce((s, v) => s + v, 0)
      return (b.total + vb * 0.01) - (a.total + va * 0.01)
    })
    const rows: MatrixRow[] = ranked
      .slice(0, Math.max(effectiveTop, top))
      .map(({ code, name, cells, productType: pt }) => ({
        code,
        name,
        productType: pt,
        cells,
      }))

    // Full-scope period summary: valuation from ALL valuationRows (entire stock universe),
    // issue metrics from full issue raw (not top-N only). Trend chart uses this.
    const periodSummary: PeriodSummary[] = periods.map((period) => ({
      period,
      valuation: 0,
      issueQty: 0,
      issueAmount: 0,
      issueDocs: 0,
    }))
    for (const row of valuationRows) {
      const period = String(row.period ?? '').trim()
      const idx = periodIndex.get(period)
      if (idx === undefined) continue
      periodSummary[idx].valuation += Number(row.valuation ?? 0) || 0
    }
    for (const row of summaryRows) {
      const period = String(row.period ?? '').trim()
      const idx = periodIndex.get(period)
      if (idx === undefined) continue
      periodSummary[idx].issueQty += Number(row.qty ?? 0) || 0
      periodSummary[idx].issueAmount += Number(row.amount ?? 0) || 0
      periodSummary[idx].issueDocs += Number(row.docs ?? 0) || 0
    }

    const productTypes = (productTypeRows ?? [])
      .map((row) => ({
        code: String(row.code ?? '').trim(),
        name: String(row.name ?? row.code ?? '').trim(),
      }))
      .filter((row) => row.code)

    const payload: MatrixResponse = {
      success: true,
      periods,
      rows,
      periodSummary,
      metric: 'qty',
      currentPeriod: periods[periods.length - 1],
      source,
      productTypes,
      filters: {
        itemCode: itemCode || undefined,
        productType: productType || undefined,
        q: q || undefined,
      },
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
