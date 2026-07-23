/**
 * SQL Check: IN_MTHENDTRX vs IN_STOCKISSUE Amount Issue
 * Run: node scripts/check-mthendtrx-amount.js
 */

const http = require('http');

const CONFIG = {
  gateway: 'http://10.0.0.110:8001',
  apiKey: '2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6',
  database: 'db_ptrj_mill',
  server: 'SERVER_PROFILE_1'
};

async function query(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ sql, database: CONFIG.database, server: CONFIG.server });
    const url = new URL(CONFIG.gateway + '/v1/query');
    const options = {
      hostname: url.hostname, port: url.port || 80, path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CONFIG.apiKey, 'Content-Length': Buffer.byteLength(body) }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  CHECK: IN_MTHENDTRX vs IN_STOCKISSUE Amount                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  const year = process.argv[2] || '2026';
  const month = process.argv[3] || '7';

  // 1. IN_MTHENDTRX column structure
  console.log('── 1. IN_MTHENDTRX Columns ──');
  try {
    const r = await query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'IN_MTHENDTRX' ORDER BY ORDINAL_POSITION`);
    const rows = r?.data?.recordset || [];
    rows.forEach(c => console.log(`  ${c.COLUMN_NAME.padEnd(20)} ${c.DATA_TYPE}`));
  } catch (e) { console.log(`  Error: ${e.message}`); }

  // 2. IN_MTHENDTRX DocType breakdown
  console.log(`\n── 2. IN_MTHENDTRX DocType Breakdown (${year}-${month}) ──`);
  try {
    const r = await query(`
      SELECT
        RTRIM(DocType) AS DocType,
        COUNT(*) AS cnt,
        CAST(SUM(ISNULL(Unit,0)) AS DECIMAL(18,2)) AS SumUnit,
        CAST(SUM(ISNULL(Amount,0)) AS DECIMAL(18,2)) AS SumAmount,
        CAST(SUM(ISNULL(Qty,0)) AS DECIMAL(18,2)) AS SumQty,
        CAST(SUM(ISNULL(Cost,0)) AS DECIMAL(18,2)) AS SumCost
      FROM IN_MTHENDTRX
      WHERE AccYear = '${year}' AND LTRIM(RTRIM(AccMonth)) = '${month}'
      GROUP BY RTRIM(DocType) ORDER BY RTRIM(DocType)
    `);
    const rows = r?.data?.recordset || [];
    console.log('  DocType | Count  | SumUnit          | SumAmount         | SumQty           | SumCost');
    rows.forEach(c => {
      console.log(`  ${String(c.DocType).padEnd(7)} | ${String(c.cnt).padEnd(6)} | ${String(c.SumUnit).padEnd(16)} | ${String(c.SumAmount).padEnd(17)} | ${String(c.SumQty).padEnd(16)} | ${c.SumCost}`);
    });
  } catch (e) { console.log(`  Error: ${e.message}`); }

  // 3. IN_STOCKISSUELN columns
  console.log('\n── 3. IN_STOCKISSUELN Columns ──');
  try {
    const r = await query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'IN_STOCKISSUELN' ORDER BY ORDINAL_POSITION`);
    const rows = r?.data?.recordset || [];
    rows.forEach(c => console.log(`  ${c.COLUMN_NAME.padEnd(20)} ${c.DATA_TYPE}`));
  } catch (e) { console.log(`  Error: ${e.message}`); }

  // 4. IN_STOCKISSUE sample data
  console.log('\n── 4. IN_STOCKISSUELN Sample Data (2026-7) ──');
  try {
    const r = await query(`
      SELECT TOP 15
        sil.ItemCode,
        sil.Qty,
        sil.Cost,
        sil.Amount,
        CAST(ISNULL(sil.Qty,0) * ISNULL(sil.Cost,0) AS DECIMAL(18,2)) AS QtyxCost
      FROM IN_STOCKISSUE h
      JOIN IN_STOCKISSUELN sil ON h.StockIssueID = sil.StockIssueID
      WHERE h.AccYear = '${year}' AND h.AccMonth = '${month}' AND h.Status IN ('2','5','6')
    `);
    const rows = r?.data?.recordset || [];
    console.log('  ItemCode       | Qty        | Cost        | Amount      | QtyxCost');
    rows.forEach(c => {
      console.log(`  ${String(c.ItemCode).padEnd(14)} | ${String(c.Qty).padEnd(10)} | ${String(c.Cost).padEnd(11)} | ${String(c.Amount).padEnd(11)} | ${c.QtyxCost}`);
    });
  } catch (e) { console.log(`  Error: ${e.message}`); }

  // 5. Compare totals per period
  console.log('\n── 5. Period Comparison (Last 6 Months) ──');
  try {
    const r = await query(`
      SELECT TOP 6
        h.AccYear + '-' + RIGHT('0'+h.AccMonth,2) AS Period,
        SUM(CASE WHEN h.Status IN ('2','5','6') THEN 1 ELSE 0 END) AS IssueCount,
        CAST(SUM(CASE WHEN h.Status IN ('2','5','6') THEN ISNULL(sil.Qty,0) ELSE 0 END) AS DECIMAL(18,2)) AS TotalQty,
        CAST(SUM(CASE WHEN h.Status IN ('2','5','6') THEN ISNULL(sil.Amount,0) ELSE 0 END) AS DECIMAL(18,2)) AS TotalAmount
      FROM IN_STOCKISSUE h
      JOIN IN_STOCKISSUELN sil ON h.StockIssueID = sil.StockIssueID
      WHERE h.AccYear >= '2026'
      GROUP BY h.AccYear, h.AccMonth
      ORDER BY h.AccYear DESC, h.AccMonth DESC
    `);
    const rows = r?.data?.recordset || [];
    console.log('  Period | IssueCount | TotalQty        | TotalAmount');
    rows.forEach(c => {
      console.log(`  ${String(c.Period).padEnd(7)} | ${String(c.IssueCount).padEnd(11)} | ${String(c.TotalQty).padEnd(15)} | ${c.TotalAmount}`);
    });
  } catch (e) { console.log(`  Error: ${e.message}`); }

  // 6. Check DocType 24/25 meaning (Opening/Closing?)
  console.log('\n── 6. DocType 24 vs 25 Sample Items ──');
  try {
    const r = await query(`
      SELECT TOP 10
        RTRIM(ItemCode) AS ItemCode,
        RTRIM(DocType) AS DocType,
        RTRIM(DocNo) AS DocNo,
        Unit,
        Qty,
        Amount
      FROM IN_MTHENDTRX
      WHERE AccYear = '${year}' AND LTRIM(RTRIM(AccMonth)) = '${month}' AND RTRIM(DocType) IN ('24','25')
      ORDER BY ItemCode, DocType
    `);
    const rows = r?.data?.recordset || [];
    console.log('  ItemCode       | DocType | DocNo              | Unit      | Qty       | Amount');
    rows.forEach(c => {
      console.log(`  ${String(c.ItemCode).padEnd(14)} | ${String(c.DocType).padEnd(7)} | ${String(c.DocNo).padEnd(18)} | ${String(c.Unit).padEnd(9)} | ${String(c.Qty).padEnd(9)} | ${c.Amount}`);
    });
  } catch (e) { console.log(`  Error: ${e.message}`); }

  // 7. Closing - Opening = Movement
  console.log('\n── 7. Opening + Issue = Closing Check (per Item) ──');
  try {
    const r = await query(`
      WITH opening AS (
        SELECT RTRIM(ItemCode) AS ItemCode, SUM(ISNULL(Unit,0)) AS OpeningQty
        FROM IN_MTHENDTRX
        WHERE AccYear = '${year}' AND LTRIM(RTRIM(AccMonth)) = '${month}' AND RTRIM(DocType) = '24'
        GROUP BY ItemCode
      ),
      closing AS (
        SELECT RTRIM(ItemCode) AS ItemCode, SUM(ISNULL(Unit,0)) AS ClosingQty
        FROM IN_MTHENDTRX
        WHERE AccYear = '${year}' AND LTRIM(RTRIM(AccMonth)) = '${month}' AND RTRIM(DocType) = '25'
        GROUP BY ItemCode
      ),
      issued AS (
        SELECT l.ItemCode, SUM(ISNULL(l.Qty,0)) AS IssuedQty
        FROM IN_STOCKISSUE h
        JOIN IN_STOCKISSUELN l ON h.StockIssueID = l.StockIssueID
        WHERE h.AccYear = '${year}' AND h.AccMonth = '${month}' AND h.Status IN ('2','5','6')
        GROUP BY l.ItemCode
      )
      SELECT TOP 15
        i.ItemCode,
        op.OpeningQty,
        iss.IssuedQty,
        cl.ClosingQty,
        CAST(ISNULL(op.OpeningQty,0) - ISNULL(iss.IssuedQty,0) - ISNULL(cl.ClosingQty,0) AS DECIMAL(18,2)) AS Balance
      FROM IN_ITEM i
      LEFT JOIN opening op ON RTRIM(i.ItemCode) = RTRIM(op.ItemCode)
      LEFT JOIN issued iss ON RTRIM(i.ItemCode) = RTRIM(iss.ItemCode)
      LEFT JOIN closing cl ON RTRIM(i.ItemCode) = RTRIM(cl.ItemCode)
      WHERE ISNULL(op.OpeningQty,0) + ISNULL(iss.IssuedQty,0) + ISNULL(cl.ClosingQty,0) > 0
      ORDER BY i.ItemCode
    `);
    const rows = r?.data?.recordset || [];
    console.log('  ItemCode       | Opening    | Issued      | Closing    | Balance');
    rows.forEach(c => {
      console.log(`  ${String(c.ItemCode).padEnd(14)} | ${String(c.OpeningQty).padEnd(10)} | ${String(c.IssuedQty).padEnd(11)} | ${String(c.ClosingQty).padEnd(10)} | ${c.Balance}`);
    });
  } catch (e) { console.log(`  Error: ${e.message}`); }

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  DONE                                                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
}

run().catch(e => console.error('Error:', e.message));
