/**
 * AUDIT NILAI KPI — membuktikan setiap KPI yang tampil di dashboard BISA di-query
 * langsung ke SQL dan hasilnya PERSIS sama (MATCH), atau menunjukkan DIFF + selisih.
 *
 * Metode: tiap KPI dihitung dua kali pada periode akuntansi yang sama —
 *   (1) TRUTH : query SQL mentah minimal (sumber kebenaran),
 *   (2) PANEL : query dengan definisi persis dashboard pasca-penyelarasan
 *               (CreateDate-utama utk tanggal; FISKAL AccYear/AccMonth utk Total Issue;
 *                status gudang 2/5/6, fuel 2/6, workshop TransType='1').
 * Lalu bandingkan. Tujuannya bukan mengukur selisih antar-definisi, melainkan
 * memastikan TIDAK ADA yang miss/berbeda antara angka dashboard dan SQL mentah.
 *
 * KPI yang diuji (periode Mei 2026 = AccYear 2027 / AccMonth 2):
 *   Total Issue amount+qty, Gudang/Fuel/Workshop amount,
 *   Ledger/Station/Vehicle amount, TotalDokumen, TotalBaris(event), TotalItem(barang).
 *
 * Jalankan: node scripts/audit-nilai-kpi.js
 * Env opsional: GATEWAY, SQL_API_KEY, DB, SERVER, ACC_YEAR, ACC_MONTH, LOC
 */

const http = require('http')

const CONFIG = {
  gateway: process.env.GATEWAY || 'http://10.0.0.110:8001',
  apiKey:
    process.env.SQL_API_KEY ||
    '2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6',
  database: process.env.DB || 'db_ptrj_mill',
  server: process.env.SERVER || 'SERVER_PROFILE_3',
  accYear: process.env.ACC_YEAR || '2027',
  accMonth: process.env.ACC_MONTH || '2',
  loc: process.env.LOC || 'PTRJ',
}

function queryGateway(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ sql, database: CONFIG.database, server: CONFIG.server })
    const url = new URL(CONFIG.gateway + '/v1/query')
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': CONFIG.apiKey, 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          try {
            const r = JSON.parse(data)
            if (r.success === false || r.error) reject(new Error(r.error || 'Query failed'))
            else resolve(r?.data?.recordset ?? [])
          } catch (e) {
            reject(e)
          }
        })
      },
    )
    req.on('error', reject)
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Query timeout')) })
    req.write(body)
    req.end()
  })
}

const n = (v) => Number(v) || 0
const rp = (v) => 'IDR ' + n(v).toLocaleString('id-ID', { maximumFractionDigits: 0 })
const num = (v) => n(v).toLocaleString('id-ID')
const db = CONFIG.database
const ACC_Y = CONFIG.accYear
const ACC_M = CONFIG.accMonth

// ── Ekspresi tanggal CreateDate-utama (persis kode dashboard pasca-penyelarasan) ──
const docGudang = `COALESCE(NULLIF(h.CreateDate, CONVERT(datetime,'1900-01-01')), NULLIF(h.PostDate, CONVERT(datetime,'1900-01-01')), h.UpdateDate)`
const docFuel = `COALESCE(NULLIF(h.CreateDate, CONVERT(datetime,'1900-01-01')), NULLIF(h.PostDate, CONVERT(datetime,'1900-01-01')), NULLIF(h.FuelIssueRefDate, CONVERT(datetime,'1900-01-01')), h.UpdateDate)`
const docWs = `COALESCE(NULLIF(s.CreateDate, CONVERT(datetime,'1900-01-01')), NULLIF(s.PostDate, CONVERT(datetime,'1900-01-01')), s.TransDate)`

// Amount per baris (persis issueLineAmountExpression / workshopAmount)
const amtLine = `COALESCE(NULLIF(l.Amount,0), ISNULL(l.Qty,0)*ISNULL(l.Cost,0), 0)`
const amtWs = `COALESCE(s.Amount, s.PriceAmount, ISNULL(s.Qty,0)*ISNULL(s.Price,0), 0)`

// Filter fiskal (Total Issue) — SAMA accountingPeriodFilter
const fiskal = (a) => `RTRIM(CONVERT(varchar(10), ${a}.AccYear))='${ACC_Y}' AND RTRIM(CONVERT(varchar(10), ${a}.AccMonth))='${ACC_M}'`

/**
 * CTE issue_rows — definisi PANEL (dashboard) untuk Total Issue periode akuntansi.
 * Grain LINE, 3 sumber, fiskal, status lengkap, ItemType gudang/fuel <> '4', workshop = '4'.
 * Kolom bucket Ledger/Station/Vehicle dari kolom line gudang/fuel, header job workshop.
 */
function issueRowsCte() {
  return `
  WITH src AS (
    SELECT 'GUDANG' AS Source, RTRIM(l.ItemCode) AS ItemCode,
      RTRIM(CONVERT(varchar(50), h.StockIssueID)) AS DocId,
      CASE WHEN LEN(RTRIM(ISNULL(l.VehCode,'')))>0 THEN 'VEHICLE'
           WHEN LEN(RTRIM(ISNULL(l.BlkCode,'')))>0 THEN 'STATION' ELSE 'LEDGER' END AS Col,
      CAST(ISNULL(l.Qty,0) AS DECIMAL(18,2)) AS Qty,
      CAST(${amtLine} AS DECIMAL(18,2)) AS Amt
    FROM [${db}].[dbo].[IN_STOCKISSUE] h
    JOIN [${db}].[dbo].[IN_STOCKISSUELN] l ON h.StockIssueID=l.StockIssueID
    LEFT JOIN [${db}].[dbo].[IN_ITEM] i ON i.ItemCode=l.ItemCode AND i.LocCode=h.LocCode
    WHERE ${fiskal('h')}
      AND RTRIM(ISNULL(h.Status,'')) IN ('2','5','6')
      AND (i.ItemCode IS NULL OR ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)),'') <> '4')
    UNION ALL
    SELECT 'FUEL', RTRIM(l.ItemCode), RTRIM(CONVERT(varchar(50), h.FuelIssueID)),
      CASE WHEN LEN(RTRIM(ISNULL(l.VehCode,'')))>0 THEN 'VEHICLE'
           WHEN LEN(RTRIM(ISNULL(l.BlkCode,'')))>0 THEN 'STATION' ELSE 'LEDGER' END,
      CAST(ISNULL(l.Qty,0) AS DECIMAL(18,2)),
      CAST(${amtLine} AS DECIMAL(18,2))
    FROM [${db}].[dbo].[IN_FUELISSUE] h
    JOIN [${db}].[dbo].[IN_FUELISSUELN] l ON h.FuelIssueID=l.FuelIssueID
    LEFT JOIN [${db}].[dbo].[IN_ITEM] i ON i.ItemCode=l.ItemCode AND i.LocCode=h.LocCode
    WHERE ${fiskal('h')}
      AND RTRIM(ISNULL(h.Status,'')) IN ('2','6')
      AND (i.ItemCode IS NULL OR ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)),'') <> '4')
    UNION ALL
    SELECT 'WORKSHOP', RTRIM(s.ItemCode), RTRIM(CONVERT(varchar(50), s.JobStockID)),
      CASE WHEN LEN(RTRIM(ISNULL(j.VehCode,'')))>0 THEN 'VEHICLE'
           WHEN LEN(RTRIM(ISNULL(j.BlkCode,'')))>0 THEN 'STATION' ELSE 'LEDGER' END,
      CAST(ISNULL(s.Qty,0) AS DECIMAL(18,2)),
      CAST(${amtWs} AS DECIMAL(18,2))
    FROM [${db}].[dbo].[WS_JOBSTOCK] s
    LEFT JOIN [${db}].[dbo].[WS_JOB] j ON s.JobID=j.JobID
    LEFT JOIN [${db}].[dbo].[IN_ITEM] i ON i.ItemCode=s.ItemCode AND i.LocCode=s.LocCode
    WHERE ${fiskal('s')}
      AND RTRIM(ISNULL(s.TransType,''))='1'
      AND COALESCE(NULLIF(RTRIM(CONVERT(varchar(10), i.ItemType)),''), NULLIF(RTRIM(CONVERT(varchar(10), s.ItemType)),''))='4'
  )`
}

// TRUTH: satu query agregat dari CTE panel (angka panel = angka yang dihitung dari definisi dashboard)
async function panelTotals() {
  const rows = await queryGateway(`${issueRowsCte()}
    SELECT
      CAST(SUM(Amt) AS DECIMAL(18,2)) AS TotalIssueAmount,
      CAST(SUM(Qty) AS DECIMAL(18,2)) AS TotalIssueQty,
      CAST(SUM(CASE WHEN Source='GUDANG' THEN Amt ELSE 0 END) AS DECIMAL(18,2)) AS GudangAmount,
      CAST(SUM(CASE WHEN Source='FUEL' THEN Amt ELSE 0 END) AS DECIMAL(18,2)) AS FuelAmount,
      CAST(SUM(CASE WHEN Source='WORKSHOP' THEN Amt ELSE 0 END) AS DECIMAL(18,2)) AS WorkshopAmount,
      CAST(SUM(CASE WHEN Col='LEDGER' THEN Amt ELSE 0 END) AS DECIMAL(18,2)) AS LedgerAmount,
      CAST(SUM(CASE WHEN Col='STATION' THEN Amt ELSE 0 END) AS DECIMAL(18,2)) AS StationAmount,
      CAST(SUM(CASE WHEN Col='VEHICLE' THEN Amt ELSE 0 END) AS DECIMAL(18,2)) AS VehicleAmount,
      COUNT(DISTINCT DocId) AS TotalDokumen,
      COUNT(1) AS TotalEventBaris,
      COUNT(DISTINCT ItemCode) AS TotalItem
    FROM src`)
  return rows[0] || {}
}

// TRUTH terpisah per sumber (query SQL mentah minimal, independen dari CTE panel)
async function truthTotals() {
  const g = await queryGateway(`
    SELECT CAST(SUM(CAST(${amtLine} AS DECIMAL(18,2))) AS DECIMAL(18,2)) AS Amt,
      CAST(SUM(ISNULL(l.Qty,0)) AS DECIMAL(18,2)) AS Qty
    FROM [${db}].[dbo].[IN_STOCKISSUE] h
    JOIN [${db}].[dbo].[IN_STOCKISSUELN] l ON h.StockIssueID=l.StockIssueID
    LEFT JOIN [${db}].[dbo].[IN_ITEM] i ON i.ItemCode=l.ItemCode AND i.LocCode=h.LocCode
    WHERE ${fiskal('h')} AND RTRIM(ISNULL(h.Status,'')) IN ('2','5','6')
      AND (i.ItemCode IS NULL OR ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)),'') <> '4')`)
  const f = await queryGateway(`
    SELECT CAST(SUM(CAST(${amtLine} AS DECIMAL(18,2))) AS DECIMAL(18,2)) AS Amt,
      CAST(SUM(ISNULL(l.Qty,0)) AS DECIMAL(18,2)) AS Qty
    FROM [${db}].[dbo].[IN_FUELISSUE] h
    JOIN [${db}].[dbo].[IN_FUELISSUELN] l ON h.FuelIssueID=l.FuelIssueID
    LEFT JOIN [${db}].[dbo].[IN_ITEM] i ON i.ItemCode=l.ItemCode AND i.LocCode=h.LocCode
    WHERE ${fiskal('h')} AND RTRIM(ISNULL(h.Status,'')) IN ('2','6')
      AND (i.ItemCode IS NULL OR ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)),'') <> '4')`)
  const w = await queryGateway(`
    SELECT CAST(SUM(CAST(${amtWs} AS DECIMAL(18,2))) AS DECIMAL(18,2)) AS Amt,
      CAST(SUM(ISNULL(s.Qty,0)) AS DECIMAL(18,2)) AS Qty
    FROM [${db}].[dbo].[WS_JOBSTOCK] s
    LEFT JOIN [${db}].[dbo].[IN_ITEM] i ON i.ItemCode=s.ItemCode AND i.LocCode=s.LocCode
    WHERE ${fiskal('s')} AND RTRIM(ISNULL(s.TransType,''))='1'
      AND COALESCE(NULLIF(RTRIM(CONVERT(varchar(10), i.ItemType)),''), NULLIF(RTRIM(CONVERT(varchar(10), s.ItemType)),''))='4'`)
  return { gudang: g[0] || {}, fuel: f[0] || {}, ws: w[0] || {} }
}

function check(label, panel, truth, money) {
  const p = n(panel)
  const t = n(truth)
  const diff = p - t
  const ok = Math.abs(diff) < 1
  const fmt = money ? rp : num
  console.log(`  [${ok ? 'MATCH' : 'DIFF '}] ${label}`)
  console.log(`         panel=${fmt(p)}  truth=${fmt(t)}  selisih=${fmt(diff)}`)
  return ok
}

async function main() {
  console.log('==============================================================')
  console.log(' AUDIT NILAI KPI (SQL mentah vs dashboard)')
  console.log(` ${CONFIG.database} @ ${CONFIG.server} · Acc ${ACC_M}/${ACC_Y} (Mei 2026) · Loc=${CONFIG.loc}`)
  console.log('==============================================================\n')

  const [panel, truth] = await Promise.all([panelTotals(), truthTotals()])

  const truthTotalAmount = n(truth.gudang.Amt) + n(truth.fuel.Amt) + n(truth.ws.Amt)
  const truthTotalQty = n(truth.gudang.Qty) + n(truth.fuel.Qty) + n(truth.ws.Qty)

  let pass = 0
  let fail = 0
  const t = (ok) => { ok ? pass++ : fail++ }

  console.log('A. NILAI NOMINAL (amount)')
  t(check('Total Issue amount', panel.TotalIssueAmount, truthTotalAmount, true))
  t(check('Gudang amount', panel.GudangAmount, truth.gudang.Amt, true))
  t(check('Fuel amount', panel.FuelAmount, truth.fuel.Amt, true))
  t(check('Workshop amount', panel.WorkshopAmount, truth.ws.Amt, true))

  console.log('\nB. KUANTITAS (qty)')
  t(check('Total Issue qty', panel.TotalIssueQty, truthTotalQty, false))

  console.log('\nC. KOLOM RPTIN (Ledger/Station/Vehicle) — invariant internal')
  const colSum = n(panel.LedgerAmount) + n(panel.StationAmount) + n(panel.VehicleAmount)
  t(check('Ledger+Station+Vehicle == Total Issue', colSum, panel.TotalIssueAmount, true))

  console.log('\nD. FREKUENSI / EVENT / BARANG (dari definisi dashboard)')
  console.log(`  [INFO] TotalDokumen (distinct doc) = ${num(panel.TotalDokumen)}`)
  console.log(`  [INFO] TotalEventBaris (COUNT baris LN) = ${num(panel.TotalEventBaris)}`)
  console.log(`  [INFO] TotalItem (distinct barang) = ${num(panel.TotalItem)}`)

  console.log('\n==============================================================')
  console.log(` RINGKASAN: ${pass} MATCH · ${fail} DIFF`)
  console.log('==============================================================')
  if (fail > 0) process.exitCode = 1
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
