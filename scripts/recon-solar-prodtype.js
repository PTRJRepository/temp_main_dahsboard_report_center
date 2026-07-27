/**
 * REKONSILIASI SOLAR (MF01001) — menjawab secara pasti:
 *   1. ProdTypeCode sebenarnya dari MF01001 (Solar): BLSTA atau type sendiri?
 *   2. Persentase fuel ber-BlkCode / ber-VehCode / keduanya kosong.
 *   3. Apakah fuel masuk BLSTA sama sekali (barang FUEL bernilai BLSTA vs non-BLSTA).
 *
 * Jalankan: node scripts/recon-solar-prodtype.js
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
const pct = (a, b) => (b > 0 ? ((100 * a) / b).toFixed(2) + '%' : '-')
const db = CONFIG.database

async function main() {
  console.log('==============================================================')
  console.log(' REKONSILIASI SOLAR MF01001 (live)')
  console.log(` ${CONFIG.database} @ ${CONFIG.server} · Loc=${CONFIG.loc} · Acc ${CONFIG.accMonth}/${CONFIG.accYear}`)
  console.log('==============================================================\n')

  // 1. ProdTypeCode solar di IN_ITEM (boleh ada di banyak Loc)
  const itemRows = await queryGateway(`
    SELECT RTRIM(i.ItemCode) AS ItemCode, RTRIM(i.LocCode) AS LocCode,
      RTRIM(ISNULL(i.ProdTypeCode,'')) AS PT,
      RTRIM(ISNULL(i.Description,'')) AS Descr,
      RTRIM(ISNULL(pt.Description,'')) AS PTDescr
    FROM [${db}].[dbo].[IN_ITEM] i
    LEFT JOIN [${db}].[dbo].[IN_PRODTYPE] pt ON pt.ProdTypeCode=i.ProdTypeCode
    WHERE RTRIM(i.ItemCode)='MF01001'`)
  console.log('1. IN_ITEM untuk MF01001 (Solar):')
  if (itemRows.length === 0) console.log('   (tidak ditemukan di IN_ITEM)')
  const ptSet = new Set()
  for (const r of itemRows) {
    ptSet.add(String(r.PT))
    console.log(`   ${r.ItemCode} · Loc=${r.LocCode} · PT='${r.PT}' (${r.PTDescr || '-'}) · ${r.Descr}`)
  }
  const solarIsBLSTA = [...ptSet].some((p) => p === 'BLSTA')
  console.log(`   => Distinct ProdTypeCode: [${[...ptSet].map((p) => `'${p}'`).join(', ')}]`)
  console.log(`   => Solar ${solarIsBLSTA ? 'MASUK BLSTA' : 'BUKAN BLSTA (type sendiri)'}\n`)

  // 2. Deskripsi BLSTA sendiri (kalau ada)
  const blsta = await queryGateway(`
    SELECT RTRIM(pt.ProdTypeCode) AS PT,
      RTRIM(ISNULL(pt.Description,'')) AS Descr
    FROM [${db}].[dbo].[IN_PRODTYPE] pt WHERE RTRIM(pt.ProdTypeCode)='BLSTA'`)
  console.log('2. Definisi ProdType BLSTA:')
  for (const r of blsta) console.log(`   BLSTA · ${r.Descr}`)
  console.log('')

  // 3. Sebaran FUEL (periode akuntansi fiskal, status 2/6) per prodtype & kolom
  const fuelByPT = await queryGateway(`
    WITH fuel AS (
      SELECT RTRIM(l.ItemCode) AS ItemCode,
        RTRIM(ISNULL(i.ProdTypeCode,'')) AS PT,
        CASE WHEN LEN(RTRIM(ISNULL(l.VehCode,'')))>0 THEN 'VEHICLE'
             WHEN LEN(RTRIM(ISNULL(l.BlkCode,'')))>0 THEN 'STATION' ELSE 'LEDGER' END AS Col,
        CAST(COALESCE(NULLIF(l.Amount,0), ISNULL(l.Qty,0)*ISNULL(l.Cost,0),0) AS DECIMAL(18,2)) AS Amt
      FROM [${db}].[dbo].[IN_FUELISSUE] h
      JOIN [${db}].[dbo].[IN_FUELISSUELN] l ON h.FuelIssueID=l.FuelIssueID
      LEFT JOIN [${db}].[dbo].[IN_ITEM] i ON i.ItemCode=l.ItemCode AND i.LocCode=h.LocCode
      WHERE RTRIM(h.LocCode)='${CONFIG.loc}'
        AND RTRIM(CONVERT(varchar(10), h.AccYear))='${CONFIG.accYear}'
        AND RTRIM(CONVERT(varchar(10), h.AccMonth))='${CONFIG.accMonth}'
        AND RTRIM(ISNULL(h.Status,'')) IN ('2','6')
    )
    SELECT PT, Col, CAST(SUM(Amt) AS DECIMAL(18,2)) AS Amt, COUNT(1) AS Lines
    FROM fuel GROUP BY PT, Col ORDER BY PT, Col`)
  console.log('3. Sebaran FUEL (fiskal, status 2/6) per ProdType x kolom:')
  let fuelTotal = 0
  let fuelBLSTA = 0
  const colAgg = { LEDGER: 0, STATION: 0, VEHICLE: 0 }
  for (const r of fuelByPT) {
    fuelTotal += n(r.Amt)
    if (String(r.PT) === 'BLSTA') fuelBLSTA += n(r.Amt)
    colAgg[String(r.Col)] = (colAgg[String(r.Col)] || 0) + n(r.Amt)
    console.log(`   PT='${String(r.PT).padEnd(8)}' ${String(r.Col).padEnd(8)} ${rp(r.Amt).padStart(24)}  (${r.Lines} baris)`)
  }
  console.log(`   --------------------------------------------------`)
  console.log(`   Total FUEL          ${rp(fuelTotal).padStart(24)}`)
  console.log(`   FUEL ber-PT BLSTA   ${rp(fuelBLSTA).padStart(24)}  (${pct(fuelBLSTA, fuelTotal)} dari total fuel)`)
  console.log(`   FUEL bukan BLSTA    ${rp(fuelTotal - fuelBLSTA).padStart(24)}  (${pct(fuelTotal - fuelBLSTA, fuelTotal)})\n`)

  // 4. Persentase fuel ber-Blk / ber-Veh / kosong
  const blk = colAgg.STATION || 0
  const veh = colAgg.VEHICLE || 0
  const led = colAgg.LEDGER || 0
  console.log('4. Persentase fuel berdasar penempatan kolom (BlkCode/VehCode):')
  console.log(`   ber-VehCode (VEHICLE) : ${rp(veh).padStart(24)}  (${pct(veh, fuelTotal)})`)
  console.log(`   ber-BlkCode (STATION) : ${rp(blk).padStart(24)}  (${pct(blk, fuelTotal)})`)
  console.log(`   keduanya kosong(LEDGER): ${rp(led).padStart(24)}  (${pct(led, fuelTotal)})`)
  console.log(`   => Fuel mayoritas di kolom: ${veh >= blk && veh >= led ? 'VEHICLE' : blk >= led ? 'STATION' : 'LEDGER'}\n`)

  // 5. Jawaban tegas
  console.log('==============================================================')
  console.log(' JAWABAN')
  console.log('==============================================================')
  console.log(` [${solarIsBLSTA ? 'OK' : 'X'}] Solar MF01001 ProdTypeCode = ${[...ptSet].join('/')} -> ${solarIsBLSTA ? 'MASUK BLSTA' : 'TYPE SENDIRI'}`)
  console.log(` [INFO] Fuel masuk BLSTA: ${rp(fuelBLSTA)} dari total fuel ${rp(fuelTotal)} (${pct(fuelBLSTA, fuelTotal)})`)
  console.log(` [INFO] Fuel tersebar: Veh ${pct(veh, fuelTotal)} · Blk ${pct(blk, fuelTotal)} · Kosong ${pct(led, fuelTotal)}`)
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
