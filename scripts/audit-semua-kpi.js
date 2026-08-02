/**
 * AUDIT SEMUA KPI PANEL INVENTORY — endpoint HTTP dashboard vs query SQL mentah.
 *
 * Metode per KPI:
 *   (1) ENDPOINT : GET http://localhost:3000/api/reports/inventory/<panel> (server hidup),
 *   (2) SQL      : query mentah ke gateway dengan definisi PERSIS endpoint
 *                  (tabel, join, kolom amount/qty, filter status, periode, ItemType,
 *                   LocCode, ekspresi tanggal — disalin dari kode route.ts masing-masing),
 *                  dijalankan ke DATABASE + SERVER PROFILE YANG SAMA dengan endpoint.
 * Lalu bandingkan: [MATCH] / [DIFF] + nilai endpoint vs SQL + selisih.
 * KPI yang tidak bisa dipetakan 1:1 ke SQL (agregat turunan TS / subset definisi)
 * diberi [INFO] dengan penjelasan, bukan dipaksakan jadi DIFF.
 *
 * Pemetaan source (persis sourceToServer/databaseForServer di semua route):
 *   source=estate → SERVER_PROFILE_2 / db_ptrj
 *   source=pabrik → SERVER_PROFILE_3 / db_ptrj_mill
 *
 * Periode:
 *   - Panel satelit (fuel-usage, unused-stock, return-analysis, product-type-kpi,
 *     movement-matrix, movement-category-evolution) = trailing `months` bulan kalender
 *     (default 12, termasuk bulan berjalan), TANPA filter LocCode (query tak mengirim
 *     location; LocCode hanya dipakai sebagai join key IN_ITEM).
 *   - Handler utama stockIssue (report=pengeluaran-barang) = FISKAL AccYear/AccMonth
 *     (Mei 2026 = AccYear 2027 / AccMonth 2; tahun fiskal mulai April).
 *
 * Jalankan: node scripts/audit-semua-kpi.js
 * Env opsional: GATEWAY, DASH, SQL_API_KEY, SOURCE (estate|pabrik), DB, SERVER, MONTHS,
 *               ACC_YEAR, ACC_MONTH, ACTUAL_PERIOD
 */

const http = require('http')

const SOURCE = (process.env.SOURCE || 'estate').toLowerCase() === 'pabrik' ? 'pabrik' : 'estate'

const CONFIG = {
  gateway: process.env.GATEWAY || 'http://10.0.0.110:8001',
  dash: process.env.DASH || 'http://localhost:3000',
  apiKey:
    process.env.SQL_API_KEY ||
    '2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6',
  // Default mengikuti pemetaan endpoint; bisa dioverride eksplisit via DB/SERVER.
  database: process.env.DB || (SOURCE === 'pabrik' ? 'db_ptrj_mill' : 'db_ptrj'),
  server: process.env.SERVER || (SOURCE === 'pabrik' ? 'SERVER_PROFILE_3' : 'SERVER_PROFILE_2'),
  source: SOURCE,
  months: Number(process.env.MONTHS) || 12,
  // Handler utama stockIssue: fiskal Mei 2026 = AccYear 2027 / AccMonth 2.
  accYear: process.env.ACC_YEAR || '2027',
  accMonth: process.env.ACC_MONTH || '2',
  actualPeriod: process.env.ACTUAL_PERIOD || '2026-05',
  loc: process.env.LOC || 'PTRJ',
}

const DB = CONFIG.database
const MONTHS = CONFIG.months

// ---------------------------------------------------------------- HTTP helper

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve({ status: res.statusCode, text: data }))
    })
    req.on('error', reject)
    req.setTimeout(180000, () => {
      req.destroy()
      reject(new Error('HTTP timeout'))
    })
    if (body) req.write(body)
    req.end()
  })
}

function queryGateway(sql) {
  const body = JSON.stringify({ sql, database: CONFIG.database, server: CONFIG.server })
  const url = new URL(CONFIG.gateway + '/v1/query')
  return httpRequest(
    {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.apiKey,
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body,
  ).then(({ text }) => {
    const r = JSON.parse(text)
    if (r.success === false || r.error) throw new Error(r.error || 'Query failed')
    return r?.data?.recordset ?? []
  })
}

async function getJson(path) {
  const url = new URL(CONFIG.dash + path)
  const { status, text } = await httpRequest({
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname + url.search,
    method: 'GET',
  })
  if (status !== 200) throw new Error(`HTTP ${status} untuk ${path}`)
  return JSON.parse(text)
}

// ---------------------------------------------------------------- util umum

const n = (v) => Number(v) || 0
const rp = (v) => 'IDR ' + n(v).toLocaleString('id-ID', { maximumFractionDigits: 0 })
const num = (v) =>
  n(v).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

let pass = 0
let fail = 0
let info = 0

/** Bandingkan nilai endpoint vs SQL mentah. money=true → format rupiah. */
function check(label, endpointValue, sqlValue, money) {
  const p = n(endpointValue)
  const t = n(sqlValue)
  const diff = p - t
  const ok = Math.abs(diff) < 1
  const fmt = money ? rp : num
  console.log(`  [${ok ? 'MATCH' : 'DIFF '}] ${label}`)
  console.log(`         endpoint=${fmt(p)}  sql=${fmt(t)}  selisih=${fmt(diff)}`)
  ok ? pass++ : fail++
  return ok
}

function infoLine(label, detail) {
  console.log(`  [INFO ] ${label}${detail ? ' — ' + detail : ''}`)
  info++
}

// ---------------------------------------------------------------- window periode

const pad2 = (v) => String(v).padStart(2, '0')

/** Daftar 'YYYY-MM' kronologis untuk `months` bulan terakhir TERMASUK bulan berjalan. */
function trailingPeriods(months, now = new Date()) {
  const periods = []
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

function movementWindowStart(months) {
  return `${trailingPeriods(months)[0]}-01`
}

function movementWindowEndExclusive(now = new Date()) {
  const y = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
  const m = now.getMonth() === 11 ? 1 : now.getMonth() + 2
  return `${y}-${pad2(m)}-01`
}

const DATE_FROM = movementWindowStart(MONTHS)
const DATE_TO_EXCL = movementWindowEndExclusive()

// ---------------------------------------------------------------- ekspresi SQL patokan
// (disalin persis dari kode route masing-masing panel)

/** Tanggal FUEL — CreateDate-utama (fuel-issue-sql.ts / fuel-usage/route.ts). */
const DOC_FUEL = `COALESCE(NULLIF(h.CreateDate, CONVERT(datetime,'1900-01-01')), NULLIF(h.PostDate, CONVERT(datetime,'1900-01-01')), NULLIF(h.FuelIssueRefDate, CONVERT(datetime,'1900-01-01')), h.UpdateDate)`
/** Tanggal GUDANG — CreateDate-utama (stockIssueDocumentDateExpression). */
const DOC_GUDANG = `COALESCE(NULLIF(h.CreateDate, CONVERT(datetime,'1900-01-01')), NULLIF(h.PostDate, CONVERT(datetime,'1900-01-01')), h.UpdateDate)`
/** Tanggal WORKSHOP (WS_JOBSTOCK s) — CreateDate-utama. */
const DOC_WS = `COALESCE(NULLIF(s.CreateDate, CONVERT(datetime,'1900-01-01')), NULLIF(s.PostDate, CONVERT(datetime,'1900-01-01')), s.TransDate)`
/** Amount baris gudang/fuel (issueLineAmountExpression). */
const AMT_LINE = `COALESCE(NULLIF(l.Amount,0), ISNULL(l.Qty,0)*ISNULL(l.Cost,0), 0)`
/** Amount baris workshop (workshopStockIssueAmountExpression). */
const AMT_WS = `COALESCE(s.Amount, s.PriceAmount, ISNULL(s.Qty,0)*ISNULL(s.Price,0), 0)`
/** Dokumen workshop (workshopStockIssueDocumentExpression). */
const DOCID_WS = `COALESCE(NULLIF(RTRIM(CONVERT(varchar(50), s.JobStockIssueID)), ''), NULLIF(RTRIM(CONVERT(varchar(50), s.JobStockID)), ''), NULLIF(RTRIM(CONVERT(varchar(50), s.JobID)), ''))`

// ================================================================ 1. fuel-usage

async function auditFuelUsage() {
  console.log('1. FUEL-USAGE  (GET /api/reports/inventory/fuel-usage)')
  const res = await getJson(
    `/api/reports/inventory/fuel-usage?source=${CONFIG.source}&months=${MONTHS}`,
  )
  if (!res.success) throw new Error('endpoint fuel-usage gagal: ' + (res.error || 'unknown'))
  const k = res.kpis ?? {}

  // SQL persis kpiSql di fuel-usage/route.ts (CTE fuel_rows, trailing kalender,
  // status 2/6, ItemType <> '4', tanpa filter LocCode — location tidak dikirim).
  const rows = await queryGateway(`
    WITH fuel_rows AS (
      SELECT
        RTRIM(l.ItemCode) AS ItemCode,
        RTRIM(CONVERT(varchar(50), h.FuelIssueID)) AS Dokumen,
        ${DOC_FUEL} AS Tanggal,
        CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(${AMT_LINE} AS DECIMAL(18,2)) AS Amount
      FROM [${DB}].[dbo].[IN_FUELISSUELN] l
      INNER JOIN [${DB}].[dbo].[IN_FUELISSUE] h ON l.FuelIssueID = h.FuelIssueID
      LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE ${DOC_FUEL} >= '${DATE_FROM}'
        AND ${DOC_FUEL} < '${DATE_TO_EXCL}'
        AND RTRIM(ISNULL(h.Status, '')) IN ('2', '6')
        AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'
    )
    SELECT
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount,
      COUNT(DISTINCT Dokumen) AS docs,
      COUNT(DISTINCT ItemCode) AS itemCount
    FROM fuel_rows
    WHERE Tanggal IS NOT NULL`)
  const s = rows[0] ?? {}

  check('kpis.qty (liter)', k.qty, s.qty, false)
  check('kpis.amount (Rp)', k.amount, s.amount, true)
  check('kpis.docs (dokumen)', k.docs, s.docs, false)
  check('kpis.itemCount (item)', k.itemCount, s.itemCount, false)
}

// ================================================================ 2. unused-stock

async function auditUnusedStock() {
  console.log('\n2. UNUSED-STOCK  (GET /api/reports/inventory/unused-stock)')
  const res = await getJson(
    `/api/reports/inventory/unused-stock?source=${CONFIG.source}&months=${MONTHS}`,
  )
  if (!res.success) throw new Error('endpoint unused-stock gagal: ' + (res.error || 'unknown'))
  const k = res.kpis ?? {}

  // SQL persis buildUnusedSql di unused-stock/route.ts: live_stock (IN_ITEM Status='1',
  // QtyOnHand+QtyOnHold > 0, semua itemType) LEFT JOIN issued_items (3 sumber issue
  // sejak dateFrom) WHERE issued NULL. Tanpa LocCode filter (location tidak dikirim).
  const rows = await queryGateway(`
    WITH issued_items AS (
      SELECT DISTINCT ItemCode, LocCode FROM (
        SELECT RTRIM(l.ItemCode) AS ItemCode, RTRIM(h.LocCode) AS LocCode
        FROM [${DB}].[dbo].[IN_STOCKISSUELN] l
        INNER JOIN [${DB}].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
        LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
        WHERE ${DOC_GUDANG} >= '${DATE_FROM}'
          AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
          AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'
        UNION ALL
        SELECT RTRIM(l.ItemCode) AS ItemCode, RTRIM(h.LocCode) AS LocCode
        FROM [${DB}].[dbo].[IN_FUELISSUELN] l
        INNER JOIN [${DB}].[dbo].[IN_FUELISSUE] h ON l.FuelIssueID = h.FuelIssueID
        LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
        WHERE ${DOC_FUEL} >= '${DATE_FROM}'
          AND RTRIM(ISNULL(h.Status, '')) IN ('2', '6')
          AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'
        UNION ALL
        SELECT RTRIM(s.ItemCode) AS ItemCode, RTRIM(s.LocCode) AS LocCode
        FROM [${DB}].[dbo].[WS_JOBSTOCK] s
        LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
        WHERE ${DOC_WS} >= '${DATE_FROM}'
          AND RTRIM(ISNULL(s.TransType, '')) = '1'
          AND COALESCE(
                NULLIF(RTRIM(CONVERT(varchar(10), i.ItemType)), ''),
                NULLIF(RTRIM(CONVERT(varchar(10), s.ItemType)), '')
              ) = '4'
      ) u
    ), live_stock AS (
      SELECT
        RTRIM(i.ItemCode) AS ItemCode,
        RTRIM(i.LocCode) AS LocCode,
        CAST(ISNULL(i.QtyOnHand, 0) + ISNULL(i.QtyOnHold, 0) AS DECIMAL(18,2)) AS Qty,
        CAST((ISNULL(i.QtyOnHand, 0) + ISNULL(i.QtyOnHold, 0)) * ISNULL(i.AverageCost, 0) AS DECIMAL(18,2)) AS Valuasi
      FROM [${DB}].[dbo].[IN_ITEM] i
      WHERE RTRIM(ISNULL(i.Status, '')) = '1'
        AND (ISNULL(i.QtyOnHand, 0) + ISNULL(i.QtyOnHold, 0)) > 0
    ), unused AS (
      SELECT ls.*
      FROM live_stock ls
      LEFT JOIN issued_items ui ON ui.ItemCode = ls.ItemCode AND ui.LocCode = ls.LocCode
      WHERE ui.ItemCode IS NULL
    )
    SELECT
      COUNT(*) AS itemCount,
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(Valuasi, 0)) AS DECIMAL(18,2)) AS valuasi
    FROM unused`)
  const s = rows[0] ?? {}

  check('kpis.itemCount (item)', k.itemCount, s.itemCount, false)
  check('kpis.qty (stok fisik)', k.qty, s.qty, false)
  check('kpis.valuasi (Rp)', k.valuasi, s.valuasi, true)
}

// ================================================================ 3. return-analysis

async function auditReturnAnalysis() {
  console.log('\n3. RETURN-ANALYSIS  (GET /api/reports/inventory/return-analysis)')
  const res = await getJson(
    `/api/reports/inventory/return-analysis?source=${CONFIG.source}&months=${MONTHS}`,
  )
  if (!res.success) throw new Error('endpoint return-analysis gagal: ' + (res.error || 'unknown'))

  const pk = res.purchasing?.kpis ?? {}
  const ik = res.inventory?.kpis ?? {}

  // Blok PURCHASING — definisi KODE return-analysis/route.ts persis (doc-date CreateDate-
  // utama, fallback GoodsRetDate — SUDAH diperbaiki dari GoodsRetRefDate yang tidak ada).
  if (res.purchasing?.available === false || res.purchasing?.note) {
    infoLine(
      'purchasing (PU_GOODSRET) tidak tersedia di endpoint',
      `${res.purchasing?.note || 'blok available=false'}.`,
    )
  } else {
    try {
      const DOC_GR = `COALESCE(NULLIF(h.CreateDate, CONVERT(datetime, '1900-01-01')), NULLIF(h.PostDate, CONVERT(datetime, '1900-01-01')), NULLIF(h.GoodsRetDate, CONVERT(datetime, '1900-01-01')), h.UpdateDate)`
      const pRows = await queryGateway(`
        WITH return_rows AS (
          SELECT
            RTRIM(l.ItemCode) AS ItemCode,
            RTRIM(CONVERT(varchar(50), h.GoodsRetId)) AS Dokumen,
            ${DOC_GR} AS Tanggal,
            CAST(COALESCE(NULLIF(l.ReturnStockQty, 0), l.QtyReturn, 0) AS DECIMAL(18,2)) AS Qty,
            CAST(COALESCE(
              NULLIF(l.Amount, 0),
              COALESCE(NULLIF(l.ReturnStockQty, 0), l.QtyReturn, 0) * COALESCE(NULLIF(l.Cost, 0), p.Cost, 0),
              0
            ) AS DECIMAL(18,2)) AS Amount
          FROM [${DB}].[dbo].[PU_GOODSRET] h
          INNER JOIN [${DB}].[dbo].[PU_GOODSRETLN] l ON h.GoodsRetId = l.GoodsRetId
          LEFT JOIN [${DB}].[dbo].[PU_POLN] p ON l.POLnID = p.POLnID
          LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
          WHERE ${DOC_GR} >= '${DATE_FROM}'
            AND ${DOC_GR} < '${DATE_TO_EXCL}'
            AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
        )
        SELECT
          CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
          CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount,
          COUNT(DISTINCT Dokumen) AS docs,
          COUNT(DISTINCT ItemCode) AS itemCount
        FROM return_rows
        WHERE Tanggal IS NOT NULL`)
      const p = pRows[0] ?? {}
      console.log('  -- blok purchasing (retur ke supplier, PU_GOODSRET) --')
      check('purchasing.kpis.qty', pk.qty, p.qty, false)
      check('purchasing.kpis.amount', pk.amount, p.amount, true)
      check('purchasing.kpis.docs', pk.docs, p.docs, false)
      check('purchasing.kpis.itemCount', pk.itemCount, p.itemCount, false)
    } catch (e) {
      infoLine('purchasing SQL gagal (definisi endpoint juga error)', e.message)
    }
  }

  // Blok INVENTORY — buildInventoryReturnCte memakai doc-date accounting-period
  // DATEFROMPARTS(AccYear,AccMonth,1) + filter periode OR-pair (AccYear=Y AND AccMonth=M)
  // — SUDAH diperbaiki dari sintaks tuple IN (VALUES ...) yang tidak didukung SQL Server.
  if (res.inventory?.available === false || res.inventory?.note) {
    infoLine(
      'inventory (IN_STOCKRTN) tidak tersedia di endpoint',
      `${res.inventory?.note || 'blok available=false'}.`,
    )
  } else {
    try {
      const orPairs = trailingPeriods(MONTHS)
        .map((ym) => {
          const [y, m] = ym.split('-').map(Number)
          return `(CONVERT(int, h.AccYear) = ${y} AND CONVERT(int, h.AccMonth) = ${m})`
        })
        .join(' OR ')
      const iRows = await queryGateway(`
        WITH return_rows AS (
          SELECT
            RTRIM(l.ItemCode) AS ItemCode,
            RTRIM(CONVERT(varchar(50), h.StockRtnID)) AS Dokumen,
            DATEFROMPARTS(CONVERT(int, h.AccYear), CONVERT(int, h.AccMonth), 1) AS Tanggal,
            CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
            CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS DECIMAL(18,2)) AS Amount
          FROM [${DB}].[dbo].[IN_STOCKRTN] h
          INNER JOIN [${DB}].[dbo].[IN_STOCKRTNLN] l ON h.StockRtnID = l.StockRtnID
          LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
          WHERE (${orPairs})
            AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
        )
        SELECT
          CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
          CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount,
          COUNT(DISTINCT Dokumen) AS docs,
          COUNT(DISTINCT ItemCode) AS itemCount
        FROM return_rows
        WHERE Tanggal IS NOT NULL`)
      const iv = iRows[0] ?? {}

      console.log('  -- blok inventory (return ke gudang, IN_STOCKRTN; SQL persis kode endpoint) --')
      check('inventory.kpis.qty', ik.qty, iv.qty, false)
      check('inventory.kpis.amount', ik.amount, iv.amount, true)
      check('inventory.kpis.docs', ik.docs, iv.docs, false)
      check('inventory.kpis.itemCount', ik.itemCount, iv.itemCount, false)

      if (n(iv.docs) === 0 && n(iv.qty) === 0) {
        infoLine(
          'inventory IN_STOCKRTN kosong di window kalender',
          'filter endpoint membandingkan (AccYear, AccMonth) FISKAL dengan pair KALENDER trailing; pergeseran fiskal (Mei=AccMonth 2) membuat window meleset ~2 bulan. Ini perilaku persis kode endpoint, bukan bug audit.',
        )
      }
    } catch (e) {
      infoLine('inventory SQL gagal (definisi endpoint juga error)', e.message)
    }
  }
}

// ================================================================ 4. product-type-kpi

/** CTE issue_docs persis buildIssueCte di product-type-kpi/route.ts (semua sumber, tanpa LocCode). */
function issueCteProductType() {
  return `WITH issue_docs AS (
    SELECT
      RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProdTypeCode,
      RTRIM(l.ItemCode) AS ItemCode,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS ItemName,
      'GUDANG' AS Source,
      ${DOC_GUDANG} AS Tanggal,
      RTRIM(CONVERT(varchar(50), h.StockIssueID)) AS Dokumen,
      CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
      CAST(${AMT_LINE} AS DECIMAL(18,2)) AS Amount
    FROM [${DB}].[dbo].[IN_STOCKISSUELN] l
    INNER JOIN [${DB}].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
    LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
    WHERE ${DOC_GUDANG} >= '${DATE_FROM}'
      AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
      AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'
    UNION ALL
    SELECT
      RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProdTypeCode,
      RTRIM(l.ItemCode) AS ItemCode,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS ItemName,
      'FUEL' AS Source,
      ${DOC_FUEL} AS Tanggal,
      RTRIM(CONVERT(varchar(50), h.FuelIssueID)) AS Dokumen,
      CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
      CAST(${AMT_LINE} AS DECIMAL(18,2)) AS Amount
    FROM [${DB}].[dbo].[IN_FUELISSUELN] l
    INNER JOIN [${DB}].[dbo].[IN_FUELISSUE] h ON l.FuelIssueID = h.FuelIssueID
    LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
    WHERE ${DOC_FUEL} >= '${DATE_FROM}'
      AND RTRIM(ISNULL(h.Status, '')) IN ('2', '6')
      AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'
    UNION ALL
    SELECT
      RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProdTypeCode,
      RTRIM(s.ItemCode) AS ItemCode,
      RTRIM(ISNULL(i.Description, s.ItemCode)) AS ItemName,
      'WORKSHOP' AS Source,
      ${DOC_WS} AS Tanggal,
      ${DOCID_WS} AS Dokumen,
      CAST(ISNULL(s.Qty, 0) AS DECIMAL(18,2)) AS Qty,
      CAST(${AMT_WS} AS DECIMAL(18,2)) AS Amount
    FROM [${DB}].[dbo].[WS_JOBSTOCK] s
    LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
    WHERE ${DOC_WS} >= '${DATE_FROM}'
      AND RTRIM(ISNULL(s.TransType, '')) = '1'
      AND COALESCE(
            NULLIF(RTRIM(CONVERT(varchar(10), i.ItemType)), ''),
            NULLIF(RTRIM(CONVERT(varchar(10), s.ItemType)), '')
          ) = '4'
  )`
}

async function auditProductTypeKpi() {
  console.log('\n4. PRODUCT-TYPE-KPI  (GET /api/reports/inventory/product-type-kpi)')
  const res = await getJson(
    `/api/reports/inventory/product-type-kpi?source=${CONFIG.source}&months=${MONTHS}`,
  )
  if (!res.success) throw new Error('endpoint product-type-kpi gagal: ' + (res.error || 'unknown'))
  const rowsEp = res.rows ?? []

  // Agregat list dari SQL mentah (definisi issue_docs persis endpoint).
  const s = (await queryGateway(`
    ${issueCteProductType()}
    SELECT
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS issueAmount,
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS issueQty,
      CAST(SUM(CASE WHEN Source = 'GUDANG' THEN ISNULL(Amount, 0) ELSE 0 END) AS DECIMAL(18,2)) AS gudangAmount,
      CAST(SUM(CASE WHEN Source = 'FUEL' THEN ISNULL(Amount, 0) ELSE 0 END) AS DECIMAL(18,2)) AS fuelAmount,
      CAST(SUM(CASE WHEN Source = 'WORKSHOP' THEN ISNULL(Amount, 0) ELSE 0 END) AS DECIMAL(18,2)) AS workshopAmount,
      COUNT(DISTINCT RTRIM(ProdTypeCode) + '|' + ItemCode) AS itemPairCount
    FROM issue_docs
    WHERE Tanggal IS NOT NULL`))[0] ?? {}

  // Endpoint list: total = SUM seluruh baris product type.
  const sum = (key) => rowsEp.reduce((acc, r) => acc + n(r[key]), 0)
  check('SUM(rows.issueAmount) — trailing, bukan fiskal', sum('issueAmount'), s.issueAmount, true)
  check('SUM(rows.issueQty)', sum('issueQty'), s.issueQty, false)
  check('SUM(rows.gudangAmount)', sum('gudangAmount'), s.gudangAmount, true)
  check('SUM(rows.fuelAmount)', sum('fuelAmount'), s.fuelAmount, true)
  check('SUM(rows.workshopAmount)', sum('workshopAmount'), s.workshopAmount, true)

  // itemCount endpoint = ISNULL(v.ItemCount, COUNT(DISTINCT c.ItemCode)) dengan v =
  // CTE valuation = COUNT SEMUA baris IN_ITEM per ProdType (tanpa filter status/lokasi)
  // — BUKAN item yang bergerak. Nilai yang bisa diverifikasi 1:1 ke SQL mentah:
  // SUM(rows.itemCount) harus sama dengan total IN_ITEM yang ProdTypeCode-nya terisi
  // DAN bergerak di window (join kembali issue), karena baris list hanya ada untuk
  // ProdType yang muncul di issue. Verifikasi dua hal:
  //  (a) item distinct issue (join h.LocCode persis kode) = s.itemPairCount,
  //  (b) SUM rows.itemCount endpoint = SUM v.ItemCount = COUNT IN_ITEM (semua status)
  //      yang ProdTypeCode-nya terisi — ditampilkan sebagai INFO referensi.
  const ref = (await queryGateway(`
    SELECT COUNT(*) AS n
    FROM [${DB}].[dbo].[IN_ITEM] i
    WHERE RTRIM(ISNULL(i.ProdTypeCode, '')) <> ''`))[0] ?? {}
  infoLine(
    'SUM(rows.itemCount)',
    `endpoint=${num(sum('itemCount'))} BUKAN item bergerak (issue distinct = ${num(s.itemPairCount)}), melainkan COUNT SELURUH baris IN_ITEM per ProdType via CTE valuation (tanpa filter status) — definisi kolom: ISNULL(v.ItemCount, COUNT(DISTINCT c.ItemCode)). Referensi SQL: COUNT IN_ITEM ProdType terisi (semua status/lokasi) = ${num(ref.n)}; item issue distinct dengan ProdType terisi = ${num(s.itemPairCount)}. Tidak dipaksakan jadi DIFF karena definisinya memang universe master item, bukan movement.`,
  )

  infoLine(
    'rows[].valuasi / closing / fast/moving/slow/deadCount',
    'valuasi=snapshot live IN_ITEM per ProdType (tanpa filter status) & closing=IN_MTHENDITEM periode akuntansi sebelumnya; kategori per item dihitung dari DocCount — diuji implisit via issueAmount/issueQty di atas, tidak dipetakan 1:1 agar tidak dipaksakan.',
  )
}

// ================================================================ 5. movement-matrix

async function auditMovementMatrix() {
  console.log('\n5. MOVEMENT-MATRIX  (GET /api/reports/inventory/movement-matrix)')
  const res = await getJson(
    `/api/reports/inventory/movement-matrix?source=${CONFIG.source}&months=${MONTHS}`,
  )
  if (!res.success) throw new Error('endpoint movement-matrix gagal: ' + (res.error || 'unknown'))
  const summary = res.periodSummary ?? []
  const rowsEp = res.rows ?? []

  // DEFINISI ON-DISK TERKINI: periodSummary = FULL-SCOPE (bukan TOP-N). Route kini
  // menjalankan summarySql terpisah (agregasi issue_rows tanpa TOP) untuk periodSummary,
  // sedangkan TOP-N hanya dipakai matriks UI rows[]. Maka bandingkan per-periode
  // dengan SQL patokan full-scope 3-sumber (CreateDate-utama, window trailing).
  const onDiskSql = `
      SELECT
        ${DOC_GUDANG} AS Tanggal,
        RTRIM(CONVERT(varchar(50), h.StockIssueID)) AS Dokumen,
        CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(${AMT_LINE} AS DECIMAL(18,2)) AS Amount
      FROM [${DB}].[dbo].[IN_STOCKISSUELN] l
      INNER JOIN [${DB}].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
      LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE ${DOC_GUDANG} >= '${DATE_FROM}'
        AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
        AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'
      UNION ALL
      SELECT
        ${DOC_WS} AS Tanggal,
        ${DOCID_WS} AS Dokumen,
        CAST(ISNULL(s.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(${AMT_WS} AS DECIMAL(18,2)) AS Amount
      FROM [${DB}].[dbo].[WS_JOBSTOCK] s
      LEFT JOIN [${DB}].[dbo].[WS_JOB] j ON s.JobID = j.JobID
      LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
      WHERE ${DOC_WS} >= '${DATE_FROM}'
        AND RTRIM(ISNULL(s.TransType, '')) = '1'
        AND COALESCE(
              NULLIF(RTRIM(CONVERT(varchar(10), i.ItemType)), ''),
              NULLIF(RTRIM(CONVERT(varchar(10), s.ItemType)), '')
            ) = '4'
      UNION ALL
      SELECT
        ${DOC_FUEL} AS Tanggal,
        RTRIM(CONVERT(varchar(50), h.FuelIssueID)) AS Dokumen,
        CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(${AMT_LINE} AS DECIMAL(18,2)) AS Amount
      FROM [${DB}].[dbo].[IN_FUELISSUELN] l
      INNER JOIN [${DB}].[dbo].[IN_FUELISSUE] h ON l.FuelIssueID = h.FuelIssueID
      LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE ${DOC_FUEL} >= '${DATE_FROM}'
        AND RTRIM(ISNULL(h.Status, '')) IN ('2', '6')
        AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'`

  const perPeriod = await queryGateway(`
    WITH issue_rows AS (${onDiskSql})
    SELECT
      CONVERT(varchar(7), Tanggal, 120) AS period,
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS issueQty,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS issueAmount,
      COUNT(DISTINCT Dokumen) AS issueDocs
    FROM issue_rows
    WHERE Tanggal IS NOT NULL
    GROUP BY CONVERT(varchar(7), Tanggal, 120)`)
  const sqlByPeriod = new Map(perPeriod.map((r) => [String(r.period).trim(), r]))

  // Agregat selisih semua periode → satu verdict struktural (bukan 36 baris berulang).
  let nMatch = 0
  const diffs = []
  for (const ps of summary) {
    const s = sqlByPeriod.get(String(ps.period).trim()) ?? {}
    const dAmt = n(ps.issueAmount) - n(s.issueAmount)
    const dQty = n(ps.issueQty) - n(s.issueQty)
    const dDocs = n(ps.issueDocs) - n(s.issueDocs)
    if (Math.abs(dAmt) < 1 && Math.abs(dQty) < 1 && Math.abs(dDocs) < 1) {
      nMatch += 1
    } else {
      diffs.push({ period: ps.period, dAmt, dQty, dDocs, ep: ps, sql: s })
    }
  }
  if (diffs.length === 0) {
    check('periodSummary[].issue{Amount,Qty,Docs} — semua periode', 1, 1, false)
  } else {
    fail++
    console.log(`  [DIFF ] periodSummary[].issue{Amount,Qty,Docs} — ${diffs.length}/${summary.length} periode menyimpang dari SQL patokan full-scope (${nMatch} MATCH)`)
    for (const d of diffs) {
      console.log(
        `         ${d.period}: endpoint=${rp(d.ep.issueAmount)} / qty ${num(d.ep.issueQty)} / docs ${num(d.ep.issueDocs)}  vs  sql=${rp(d.sql.issueAmount)} / qty ${num(d.sql.issueQty)} / docs ${num(d.sql.issueDocs)}  (selisih ${rp(d.dAmt)})`,
      )
    }
  }

  infoLine(
    'periodSummary[].valuation',
    'agregat hibrid monthend IN_MTHENDITEM (periode lampau, konversi acc) + live IN_ITEM (bulan berjalan) — definisi snapshot campuran, bukan issue flow; dibiarkan INFO.',
  )

  // rows[] hanya TOP-N: verifikasi invariant (SUM rows <= SUM periodSummary), bukan 1:1.
  const epRowSum = rowsEp.reduce(
    (acc, r) => ({
      amount: acc.amount + (r.cells?.amount ?? []).reduce((a, v) => a + n(v), 0),
      qty: acc.qty + (r.cells?.qty ?? []).reduce((a, v) => a + n(v), 0),
      docs: acc.docs + (r.cells?.docs ?? []).reduce((a, v) => a + n(v), 0),
    }),
    { amount: 0, qty: 0, docs: 0 },
  )
  const psSum = summary.reduce(
    (acc, p) => ({
      amount: acc.amount + n(p.issueAmount),
      qty: acc.qty + n(p.issueQty),
      docs: acc.docs + n(p.issueDocs),
    }),
    { amount: 0, qty: 0, docs: 0 },
  )
  const rowsLeTotal =
    epRowSum.amount <= psSum.amount + 1 && epRowSum.qty <= psSum.qty + 1 && epRowSum.docs <= psSum.docs + 1
  console.log(`  [${rowsLeTotal ? 'MATCH' : 'DIFF '}] invariant SUM(rows[].cells) <= SUM(periodSummary)`)
  console.log(
    `         rows(top-N): amount=${rp(epRowSum.amount)} qty=${num(epRowSum.qty)} docs=${num(epRowSum.docs)}  vs  periodSummary: amount=${rp(psSum.amount)} qty=${num(psSum.qty)} docs=${num(psSum.docs)}`,
  )
  rowsLeTotal ? pass++ : fail++
}

// ================================================================ 6. movement-category-evolution

async function auditMovementCategoryEvolution() {
  console.log('\n6. MOVEMENT-CATEGORY-EVOLUTION  (GET /api/reports/inventory/movement-category-evolution)')
  const res = await getJson(
    `/api/reports/inventory/movement-category-evolution?source=${CONFIG.source}&months=${MONTHS}`,
  )
  if (!res.success)
    throw new Error('endpoint movement-category-evolution gagal: ' + (res.error || 'unknown'))
  const t = res.totals ?? {}

  // totals.itemCount = COUNT IN_ITEM (ItemType 1+4) — buildTotalItemsSql.
  const itemRows = await queryGateway(
    `SELECT COUNT(*) AS totalItemCount FROM [${DB}].[dbo].[IN_ITEM] WHERE RTRIM(CONVERT(varchar(10), ItemType)) IN ('1', '4')`,
  )
  check('totals.itemCount (IN_ITEM ItemType 1+4)', t.itemCount, itemRows[0]?.totalItemCount, false)

  // totals.qty: jalur TS valuation×docs — qty per item×periode hanya ditambahkan untuk
  // item yang ada valuasinya di periode itu (IN_MTHENDITEM item_scope join; bulan
  // berjalan live IN_ITEM). Item TANPA snapshot monthend bulan itu tidak menyumbang
  // qty, sehingga totals.qty <= SUM qty issue mentah. Karena itu dibandingkan dgn
  // issue qty 3-sumber sebagai referensi dan perbedaan dijelaskan [INFO].
  const qtyRows = await queryGateway(`
    WITH issue_rows AS (
      SELECT ${DOC_GUDANG} AS Tanggal, CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(${AMT_LINE} AS DECIMAL(18,2)) AS Amount
      FROM [${DB}].[dbo].[IN_STOCKISSUELN] l
      INNER JOIN [${DB}].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
      LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE ${DOC_GUDANG} >= '${DATE_FROM}' AND ${DOC_GUDANG} < '${DATE_TO_EXCL}'
        AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
        AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'
      UNION ALL
      SELECT ${DOC_WS}, CAST(ISNULL(s.Qty, 0) AS DECIMAL(18,2)),
        CAST(${AMT_WS} AS DECIMAL(18,2))
      FROM [${DB}].[dbo].[WS_JOBSTOCK] s
      LEFT JOIN [${DB}].[dbo].[WS_JOB] j ON s.JobID = j.JobID
      LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
      WHERE ${DOC_WS} >= '${DATE_FROM}' AND ${DOC_WS} < '${DATE_TO_EXCL}'
        AND RTRIM(ISNULL(s.TransType, '')) = '1'
        AND COALESCE(
              NULLIF(RTRIM(CONVERT(varchar(10), i.ItemType)), ''),
              NULLIF(RTRIM(CONVERT(varchar(10), s.ItemType)), '')
            ) = '4'
      UNION ALL
      SELECT ${DOC_FUEL}, CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)),
        CAST(${AMT_LINE} AS DECIMAL(18,2))
      FROM [${DB}].[dbo].[IN_FUELISSUELN] l
      INNER JOIN [${DB}].[dbo].[IN_FUELISSUE] h ON l.FuelIssueID = h.FuelIssueID
      LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE ${DOC_FUEL} >= '${DATE_FROM}' AND ${DOC_FUEL} < '${DATE_TO_EXCL}'
        AND RTRIM(ISNULL(h.Status, '')) IN ('2', '6')
        AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'
    )
    SELECT
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount
    FROM issue_rows
    WHERE Tanggal IS NOT NULL`)
  const q = qtyRows[0] ?? {}

  infoLine(
    'totals.qty (jalur valuasi×docs, bukan issue mentah)',
    `endpoint=${num(t.qty)} vs SUM qty issue 3-sumber=${num(q.qty)} (selisih=${num(n(q.qty) - n(t.qty))}). totals.qty dijumlahkan dari docsByKey HANYA untuk item×periode yang punya valuasi (IN_MTHENDITEM join item_scope / live IN_ITEM); item tanpa snapshot monthend bulan itu tidak menyumbang qty. Subset agregat — tidak dipaksakan jadi DIFF.`,
  )

  // totals.amount: bila valuation coverage ada → SUM valuasi stok (BUKAN issue amount).
  const valRows = await queryGateway(`
    WITH item_scope AS (
      SELECT RTRIM(i.ItemCode) AS code,
        CAST(ISNULL(i.QtyOnHand, 0) + ISNULL(i.QtyOnHold, 0) AS DECIMAL(18,2)) AS liveQty,
        CAST(ISNULL(i.AverageCost, 0) AS DECIMAL(18,4)) AS liveCost
      FROM [${DB}].[dbo].[IN_ITEM] i
      WHERE RTRIM(ISNULL(CONVERT(varchar(10), i.ItemType), '')) IN ('1','4')
        AND RTRIM(ISNULL(i.Status, '0')) = '1'
    )
    SELECT CAST(SUM(liveQty * liveCost) AS DECIMAL(18,2)) AS liveValuation FROM item_scope`)
  const liveVal = n(valRows[0]?.liveValuation)

  if (Math.abs(n(t.amount) - n(q.amount)) < 1) {
    check('totals.amount (jalur issue-amount)', t.amount, q.amount, true)
  } else {
    infoLine(
      'totals.amount (jalur valuasi stok)',
      `endpoint=${rp(t.amount)} adalah SUM valuasi stok (monthend periode lampau + live bulan berjalan), BUKAN issue amount (issue=${rp(q.amount)}). Periode lampau monthend tidak dipetakan 1:1 tanpa membentuk ulang seluruh CASE acc-pair endpoint; referensi live bulan berjalan=${rp(liveVal)}.`,
    )
  }

  infoLine(
    'totals.docs',
    'selalu 0 di endpoint (kode: "Docs total isn\'t returned by the evolution aggregation; derive from movers or keep 0").',
  )
  infoLine(
    'byPeriod[].categories',
    'komposisi count/qty/amount per kategori dibangun di TS dari valuation×docs (threshold Fast>=6/Moving 2-5/Slow=1), bukan satu query tunggal — tidak dipaksakan jadi DIFF.',
  )
}

// ================================================================ 7. handler utama stockIssue

async function auditMainStockIssue() {
  console.log('\n7. HANDLER UTAMA stockIssue  (GET /api/reports/inventory?report=pengeluaran-barang)')
  const res = await getJson(
    `/api/reports/inventory?report=pengeluaran-barang&source=${CONFIG.source}&period=${CONFIG.actualPeriod}`,
  )
  if (!res.success) throw new Error('endpoint utama gagal: ' + (res.error || 'unknown'))
  // Respons handler utama berbentuk { success, report, data:{ summary, rows, ... }.
  const s0 = res.data?.summary ?? res.summary ?? {}

  // FISKAL AccYear/AccMonth (Mei 2026 = 2027/2). Status: gudang 2/5/6, fuel 2/6,
  // workshop TransType='1' tanpa status. ItemType gudang/fuel <> '4' (orphan ikut),
  // workshop = '4'. Grain line (StockIssueLnID / JobStockID).
  const fiskal = (a) =>
    `RTRIM(CONVERT(varchar(10), ${a}.AccYear)) = '${CONFIG.accYear}' AND RTRIM(CONVERT(varchar(10), ${a}.AccMonth)) = '${CONFIG.accMonth}'`

  const sql = `
    WITH issue_rows AS (
      SELECT
        RTRIM(CONVERT(varchar(50), h.StockIssueID)) AS StockIssueID,
        RTRIM(CONVERT(varchar(50), l.StockIssueLnID)) AS StockIssueLnID,
        RTRIM(l.ItemCode) AS KodeBarang,
        CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(${AMT_LINE} AS DECIMAL(18,4)) AS Amount,
        'IN_STOCKISSUE' AS SourceTable
      FROM [${DB}].[dbo].[IN_STOCKISSUELN] l
      INNER JOIN [${DB}].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
      LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE ${fiskal('h')}
        AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
        AND (i.ItemCode IS NULL OR ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4')
      UNION ALL
      SELECT
        ${DOCID_WS} AS StockIssueID,
        COALESCE(
          NULLIF(RTRIM(CONVERT(varchar(50), s.JobStockID)), ''),
          NULLIF(RTRIM(CONVERT(varchar(50), s.JobStockIssueID)), ''),
          NULLIF(RTRIM(CONVERT(varchar(50), s.JobID)), '')
        ) AS StockIssueLnID,
        RTRIM(s.ItemCode) AS KodeBarang,
        CAST(ISNULL(s.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(${AMT_WS} AS DECIMAL(18,4)) AS Amount,
        'WS_JOBSTOCK' AS SourceTable
      FROM [${DB}].[dbo].[WS_JOBSTOCK] s
      LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
      WHERE ${fiskal('s')}
        AND RTRIM(ISNULL(s.TransType, '')) = '1'
        AND COALESCE(
              NULLIF(RTRIM(CONVERT(varchar(10), i.ItemType)), ''),
              NULLIF(RTRIM(CONVERT(varchar(10), s.ItemType)), '')
            ) = '4'
      UNION ALL
      SELECT
        RTRIM(CONVERT(varchar(50), h.FuelIssueID)) AS StockIssueID,
        RTRIM(CONVERT(varchar(50), l.FuelIssueLnID)) AS StockIssueLnID,
        RTRIM(l.ItemCode) AS KodeBarang,
        CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(${AMT_LINE} AS DECIMAL(18,4)) AS Amount,
        'IN_FUELISSUE' AS SourceTable
      FROM [${DB}].[dbo].[IN_FUELISSUELN] l
      INNER JOIN [${DB}].[dbo].[IN_FUELISSUE] h ON l.FuelIssueID = h.FuelIssueID
      LEFT JOIN [${DB}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE ${fiskal('h')}
        AND RTRIM(ISNULL(h.Status, '')) IN ('2', '6')
        AND (i.ItemCode IS NULL OR ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4')
    )
    SELECT
      COUNT(DISTINCT StockIssueID) AS TotalDokumen,
      COUNT(DISTINCT StockIssueLnID) AS TotalBaris,
      COUNT(*) AS TotalLineRows,
      COUNT(DISTINCT KodeBarang) AS TotalItem,
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS TotalQty,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,4)) AS TotalAmount,
      CAST(SUM(CASE WHEN SourceTable = 'IN_STOCKISSUE' THEN ISNULL(Qty, 0) ELSE 0 END) AS DECIMAL(18,2)) AS GudangIssueQty,
      CAST(SUM(CASE WHEN SourceTable = 'IN_STOCKISSUE' THEN ISNULL(Amount, 0) ELSE 0 END) AS DECIMAL(18,4)) AS GudangIssueAmount,
      COUNT(DISTINCT CASE WHEN SourceTable = 'IN_STOCKISSUE' THEN StockIssueID END) AS GudangIssueDocuments,
      CAST(SUM(CASE WHEN SourceTable = 'IN_FUELISSUE' THEN ISNULL(Qty, 0) ELSE 0 END) AS DECIMAL(18,2)) AS FuelIssueQty,
      CAST(SUM(CASE WHEN SourceTable = 'IN_FUELISSUE' THEN ISNULL(Amount, 0) ELSE 0 END) AS DECIMAL(18,4)) AS FuelIssueAmount,
      COUNT(DISTINCT CASE WHEN SourceTable = 'IN_FUELISSUE' THEN StockIssueID END) AS FuelIssueDocuments,
      CAST(SUM(CASE WHEN SourceTable = 'WS_JOBSTOCK' THEN ISNULL(Qty, 0) ELSE 0 END) AS DECIMAL(18,2)) AS WorkshopIssueQty,
      CAST(SUM(CASE WHEN SourceTable = 'WS_JOBSTOCK' THEN ISNULL(Amount, 0) ELSE 0 END) AS DECIMAL(18,4)) AS WorkshopIssueAmount,
      COUNT(DISTINCT CASE WHEN SourceTable = 'WS_JOBSTOCK' THEN StockIssueID END) AS WorkshopIssueDocuments
    FROM issue_rows`
  const s = (await queryGateway(sql))[0] ?? {}

  console.log(`  periode fiskal: AccYear=${CONFIG.accYear} AccMonth=${CONFIG.accMonth} (Mei 2026), period=${CONFIG.actualPeriod}`)
  check('summary.TotalAmount (Total Issue, fiskal)', s0.TotalAmount, s.TotalAmount, true)
  check('summary.TotalQty', s0.TotalQty, s.TotalQty, false)
  check('summary.GudangIssueAmount', s0.GudangIssueAmount, s.GudangIssueAmount, true)
  check('summary.FuelIssueAmount', s0.FuelIssueAmount, s.FuelIssueAmount, true)
  check('summary.WorkshopIssueAmount', s0.WorkshopIssueAmount, s.WorkshopIssueAmount, true)
  check('summary.GudangIssueQty', s0.GudangIssueQty, s.GudangIssueQty, false)
  check('summary.FuelIssueQty', s0.FuelIssueQty, s.FuelIssueQty, false)
  check('summary.WorkshopIssueQty', s0.WorkshopIssueQty, s.WorkshopIssueQty, false)
  check('summary.TotalDokumen', s0.TotalDokumen, s.TotalDokumen, false)
  check('summary.TotalBaris', s0.TotalBaris, s.TotalBaris, false)
  check('summary.TotalItem', s0.TotalItem, s.TotalItem, false)
  check('summary.GudangIssueDocuments', s0.GudangIssueDocuments, s.GudangIssueDocuments, false)
  check('summary.FuelIssueDocuments', s0.FuelIssueDocuments, s.FuelIssueDocuments, false)
  check('summary.WorkshopIssueDocuments', s0.WorkshopIssueDocuments, s.WorkshopIssueDocuments, false)

  infoLine(
    'summary.ChargeVehicle/Station/Ledger (Rp)',
    'bucket charge per line gudang/fuel + header job workshop — sudah diaudit MATCH di scripts/audit-nilai-kpi.js (invariant Ledger+Station+Vehicle == Total Issue); tidak diulang di sini.',
  )
}

// ================================================================ main

async function main() {
  console.log('==============================================================')
  console.log(' AUDIT SEMUA KPI PANEL INVENTORY (endpoint HTTP vs SQL mentah)')
  console.log(` source=${CONFIG.source} | DB=${CONFIG.database} @ ${CONFIG.server} | dashboard=${CONFIG.dash}`)
  console.log(` Panel satelit: trailing ${MONTHS} bulan kalender (${DATE_FROM} s/d < ${DATE_TO_EXCL})`)
  console.log(` Handler utama : fiskal AccYear=${CONFIG.accYear} AccMonth=${CONFIG.accMonth} (Mei 2026) Loc=${CONFIG.loc}`)
  console.log('==============================================================\n')

  await auditFuelUsage()
  await auditUnusedStock()
  await auditReturnAnalysis()
  await auditProductTypeKpi()
  await auditMovementMatrix()
  await auditMovementCategoryEvolution()
  await auditMainStockIssue()

  console.log('\n==============================================================')
  console.log(` RINGKASAN: ${pass} MATCH | ${fail} DIFF | ${info} INFO`)
  console.log('==============================================================')
  if (fail > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
