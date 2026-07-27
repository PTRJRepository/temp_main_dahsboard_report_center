/**
 * AUDIT KONSISTENSI INVENTORY — membuktikan setiap invariant dengan SQL live.
 *
 * Tujuan: jangan ada nilai yang miss/berbeda antar panel/report.
 * Invariant yang dicek (untuk periode akuntansi Mei 2026 = AccYear/AccMonth 2/2027):
 *   A. Total Issue  = Gudang + Fuel + Workshop
 *   B. Total Issue  = Ledger + Station + Vehicle  (kolom RPTIN)
 *   C. Fuel         = FuelLedger + FuelStation + FuelVehicle  (fuel tersebar, bukan sub-kolom)
 *   D. Efek status  : dampak Status '5' (Cancelled) thd Total Issue
 *   E. Efek periode : fuel DocDate(kalender) vs AccYear/AccMonth(fiskal)
 *   F. Product type solar (MF01001) — apakah masuk BLSTA atau type sendiri
 *
 * Jalankan: node scripts/audit-inventory-consistency.js
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
  accMonth: process.env.ACC_MONTH || '2', // Mei 2026 = 2/2027
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
const db = CONFIG.database

// Kalender untuk periode akuntansi 2/2027 → Mei 2026 (dipakai utk fuel DocDate)
const CAL_FROM = '2026-05-01'
const CAL_TO = '2026-06-01' // eksklusif

function fuelDoc(alias) {
  // SAMA dengan fuelIssueDocumentDateExpression di kode dashboard: CreateDate utama.
  return `COALESCE(NULLIF(${alias}.CreateDate, CONVERT(datetime,'1900-01-01')), NULLIF(${alias}.PostDate, CONVERT(datetime,'1900-01-01')), NULLIF(${alias}.FuelIssueRefDate, CONVERT(datetime,'1900-01-01')), ${alias}.UpdateDate)`
}

// ── CTE 3 sumber, FILTER STATUS 2/5/6 (persis RPTIN/dashboard saat ini) ──
function issueCte(statusStock, statusFuel, fuelPeriodMode) {
  const fuelPeriod =
    fuelPeriodMode === 'fiscal'
      ? `AND RTRIM(CONVERT(varchar(10), h.AccYear)) = '${CONFIG.accYear}' AND RTRIM(CONVERT(varchar(10), h.AccMonth)) = '${CONFIG.accMonth}'`
      : `AND ${fuelDoc('h')} >= '${CAL_FROM}' AND ${fuelDoc('h')} < '${CAL_TO}'`
  return `
  WITH src AS (
    SELECT 'GUDANG' AS Source, RTRIM(l.ItemCode) AS ItemCode,
      RTRIM(ISNULL(i.ProdTypeCode,'')) AS PT,
      CASE WHEN LEN(RTRIM(ISNULL(l.VehCode,'')))>0 THEN 'VEHICLE'
           WHEN LEN(RTRIM(ISNULL(l.BlkCode,'')))>0 THEN 'STATION' ELSE 'LEDGER' END AS Col,
      CAST(COALESCE(NULLIF(l.Amount,0), ISNULL(l.Qty,0)*ISNULL(l.Cost,0),0) AS DECIMAL(18,2)) AS Amt
    FROM [${db}].[dbo].[IN_STOCKISSUE] h
    JOIN [${db}].[dbo].[IN_STOCKISSUELN] l ON h.StockIssueID=l.StockIssueID
    LEFT JOIN [${db}].[dbo].[IN_ITEM] i ON i.ItemCode=l.ItemCode AND i.LocCode=h.LocCode
    WHERE RTRIM(h.LocCode)='${CONFIG.loc}'
      AND RTRIM(CONVERT(varchar(10), h.AccYear))='${CONFIG.accYear}'
      AND RTRIM(CONVERT(varchar(10), h.AccMonth))='${CONFIG.accMonth}'
      AND RTRIM(ISNULL(h.Status,'')) IN (${statusStock})
      AND (i.ItemCode IS NULL OR ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)),'') <> '4')
    UNION ALL
    SELECT 'FUEL', RTRIM(l.ItemCode), RTRIM(ISNULL(i.ProdTypeCode,'')),
      CASE WHEN LEN(RTRIM(ISNULL(l.VehCode,'')))>0 THEN 'VEHICLE'
           WHEN LEN(RTRIM(ISNULL(l.BlkCode,'')))>0 THEN 'STATION' ELSE 'LEDGER' END,
      CAST(COALESCE(NULLIF(l.Amount,0), ISNULL(l.Qty,0)*ISNULL(l.Cost,0),0) AS DECIMAL(18,2))
    FROM [${db}].[dbo].[IN_FUELISSUE] h
    JOIN [${db}].[dbo].[IN_FUELISSUELN] l ON h.FuelIssueID=l.FuelIssueID
    LEFT JOIN [${db}].[dbo].[IN_ITEM] i ON i.ItemCode=l.ItemCode AND i.LocCode=h.LocCode
    WHERE RTRIM(h.LocCode)='${CONFIG.loc}'
      ${fuelPeriod}
      AND RTRIM(ISNULL(h.Status,'')) IN (${statusFuel})
      AND (i.ItemCode IS NULL OR ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)),'') <> '4')
    UNION ALL
    SELECT 'WORKSHOP', RTRIM(s.ItemCode), RTRIM(ISNULL(i.ProdTypeCode,'')),
      CASE WHEN LEN(RTRIM(ISNULL(j.VehCode,'')))>0 THEN 'VEHICLE'
           WHEN LEN(RTRIM(ISNULL(j.BlkCode,'')))>0 THEN 'STATION' ELSE 'LEDGER' END,
      CAST(COALESCE(s.Amount, s.PriceAmount, ISNULL(s.Qty,0)*ISNULL(s.Price,0),0) AS DECIMAL(18,2))
    FROM [${db}].[dbo].[WS_JOBSTOCK] s
    LEFT JOIN [${db}].[dbo].[WS_JOB] j ON s.JobID=j.JobID
    LEFT JOIN [${db}].[dbo].[IN_ITEM] i ON i.ItemCode=s.ItemCode AND i.LocCode=s.LocCode
    WHERE RTRIM(s.LocCode)='${CONFIG.loc}'
      AND RTRIM(CONVERT(varchar(10), s.AccYear))='${CONFIG.accYear}'
      AND RTRIM(CONVERT(varchar(10), s.AccMonth))='${CONFIG.accMonth}'
      AND RTRIM(ISNULL(s.TransType,''))='1'
      AND COALESCE(NULLIF(RTRIM(CONVERT(varchar(10), i.ItemType)),''), NULLIF(RTRIM(CONVERT(varchar(10), s.ItemType)),''))='4'
  )`
}

async function main() {
  console.log('==============================================================')
  console.log(' AUDIT KONSISTENSI INVENTORY (live)')
  console.log(` ${CONFIG.database} @ ${CONFIG.server} · Loc=${CONFIG.loc} · Acc ${CONFIG.accMonth}/${CONFIG.accYear} (Mei 2026)`)
  console.log('==============================================================\n')

  const cte = issueCte(`'2','5','6'`, `'2','6'`, 'calendar')

  // A. Total Issue = Gudang + Fuel + Workshop
  const bySource = await queryGateway(`${cte}
    SELECT Source, CAST(SUM(Amt) AS DECIMAL(18,2)) AS Amt FROM src GROUP BY Source`)
  const m = Object.fromEntries(bySource.map((r) => [String(r.Source), n(r.Amt)]))
  const gudang = m.GUDANG || 0, fuel = m.FUEL || 0, ws = m.WORKSHOP || 0
  const totalIssue = gudang + fuel + ws
  console.log('A. Total Issue = Gudang + Fuel + Workshop')
  console.log(`   Gudang   ${rp(gudang)}`)
  console.log(`   Fuel     ${rp(fuel)}`)
  console.log(`   Workshop ${rp(ws)}`)
  console.log(`   TOTAL    ${rp(totalIssue)}\n`)

  // B. Total Issue = Ledger + Station + Vehicle
  const byCol = await queryGateway(`${cte}
    SELECT Col, CAST(SUM(Amt) AS DECIMAL(18,2)) AS Amt FROM src GROUP BY Col`)
  const c = Object.fromEntries(byCol.map((r) => [String(r.Col), n(r.Amt)]))
  const ledger = c.LEDGER || 0, station = c.STATION || 0, vehicle = c.VEHICLE || 0
  const colTotal = ledger + station + vehicle
  console.log('B. Total Issue = Ledger + Station + Vehicle (kolom RPTIN)')
  console.log(`   Ledger   ${rp(ledger)}`)
  console.log(`   Station  ${rp(station)}`)
  console.log(`   Vehicle  ${rp(vehicle)}`)
  console.log(`   TOTAL    ${rp(colTotal)}`)
  console.log(`   => ${Math.abs(totalIssue - colTotal) < 1 ? 'MATCH' : 'DIFF ' + rp(totalIssue - colTotal)}\n`)

  // C. Fuel tersebar ke ledger/station/vehicle (bukan sub-kolom)
  const fuelByCol = await queryGateway(`${cte}
    SELECT Col, CAST(SUM(Amt) AS DECIMAL(18,2)) AS Amt FROM src WHERE Source='FUEL' GROUP BY Col`)
  console.log('C. Fuel tersebar ke kolom (membuktikan fuel != station):')
  for (const r of fuelByCol) console.log(`   Fuel→${String(r.Col).padEnd(8)} ${rp(r.Amt)}`)
  const fuelStation = n((fuelByCol.find((r) => r.Col === 'STATION') || {}).Amt)
  console.log(`   Total Fuel ${rp(fuel)}  vs  Fuel→Station saja ${rp(fuelStation)}\n`)

  // D. Efek Status '5' (Cancelled) pada Total Issue
  const cteNoCancelled = issueCte(`'2','6'`, `'2','6'`, 'calendar')
  const t26 = await queryGateway(`${cteNoCancelled}
    SELECT CAST(SUM(Amt) AS DECIMAL(18,2)) AS Amt FROM src`)
  const totalNoCancelled = n((t26[0] || {}).Amt)
  console.log('D. Efek Status 5 (Cancelled) pada Total Issue')
  console.log(`   Status 2/5/6 : ${rp(totalIssue)}`)
  console.log(`   Status 2/6   : ${rp(totalNoCancelled)}`)
  console.log(`   Selisih (Cancelled) : ${rp(totalIssue - totalNoCancelled)}\n`)

  // E. Fuel kalender vs fiskal
  const cteFuelFiscal = issueCte(`'2','5','6'`, `'2','6'`, 'fiscal')
  const fFiscal = await queryGateway(`${cteFuelFiscal}
    SELECT CAST(SUM(CASE WHEN Source='FUEL' THEN Amt ELSE 0 END) AS DECIMAL(18,2)) AS Amt FROM src`)
  const fuelFiscal = n((fFiscal[0] || {}).Amt)
  console.log('E. Fuel: kalender DocDate vs fiskal AccYear/AccMonth')
  console.log(`   Fuel kalender : ${rp(fuel)}`)
  console.log(`   Fuel fiskal   : ${rp(fuelFiscal)}`)
  console.log(`   Selisih       : ${rp(fuel - fuelFiscal)}\n`)

  // F. Product type solar MF01001
  const solar = await queryGateway(`
    SELECT RTRIM(i.ItemCode) AS ItemCode, RTRIM(ISNULL(i.ProdTypeCode,'')) AS PT,
      RTRIM(ISNULL(i.Description,'')) AS Descr
    FROM [${db}].[dbo].[IN_ITEM] i WHERE RTRIM(i.ItemCode)='MF01001'`)
  console.log('F. Product type solar (MF01001):')
  if (solar.length === 0) console.log('   (tidak ditemukan di IN_ITEM)')
  for (const r of solar) console.log(`   ${r.ItemCode} · PT='${r.PT}' · ${r.Descr}`)
  console.log(`   => solar ${solar.some((r) => String(r.PT) === 'BLSTA') ? 'MASUK BLSTA' : 'BUKAN BLSTA (type sendiri)'}\n`)

  // Ringkasan invariant
  console.log('==============================================================')
  console.log(' RINGKASAN INVARIANT')
  console.log('==============================================================')
  console.log(` [${Math.abs(totalIssue - colTotal) < 1 ? 'OK' : 'X'}] TotalIssue(G+F+W) == TotalIssue(L+S+V)`)
  console.log(` [${Math.abs(totalIssue - totalNoCancelled) < 1 ? 'OK' : 'X'}] TotalIssue tak terpengaruh status 5 (Cancelled)`)
  console.log(` [${Math.abs(fuel - fuelFiscal) < 1 ? 'OK' : 'X'}] Fuel kalender == Fuel fiskal`)
  console.log(` [INFO] Fuel→Station ${rp(fuelStation)} harus != Fuel total ${rp(fuel)} (fuel tersebar)`)
}

main().catch((e) => { console.error('AUDIT ERROR:', e.message); process.exit(1) })
