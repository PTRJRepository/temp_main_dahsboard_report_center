/**
 * Audit Script: IN_MTHENDTRX vs IN_STOCKISSUE Comparison
 * Compare transaction data between snapshot table and live transactions
 */

const http = require('http');

const CONFIG = {
  gateway: 'http://10.0.0.110:8001',
  apiKey: '2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6',
  database: 'db_ptrj_mill',
  server: 'SERVER_PROFILE_1'
};

async function queryGateway(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      sql,
      database: CONFIG.database,
      server: CONFIG.server
    });

    const url = new URL(CONFIG.gateway + '/v1/query');
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.apiKey,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.success === false || result.error) {
            reject(new Error(result.error || 'Query failed'));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Query timeout'));
    });
    req.write(body);
    req.end();
  });
}

async function runAudit() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('    AUDIT: IN_MTHENDTRX vs IN_STOCKISSUE Comparison');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    console.log(`Gateway: ${CONFIG.gateway}`);
    console.log(`Database: ${CONFIG.database}`);
    console.log(`Server: ${CONFIG.server}\n`);

    // Step 1: Check IN_MTHENDTRX existence and periods
    console.log('─── Step 1: Checking IN_MTHENDTRX ───');

    let periodRows = [];
    try {
      const allPeriods = await queryGateway(`
        SELECT DISTINCT AccYear, AccMonth, COUNT(*) as cnt
        FROM IN_MTHENDTRX
        GROUP BY AccYear, AccMonth
        ORDER BY AccYear DESC, AccMonth DESC
      `);
      periodRows = allPeriods?.data?.recordset || [];
      console.log(`✅ IN_MTHENDTRX exists with ${periodRows.length} periods`);
      if (periodRows.length > 0) {
        console.log('   Available periods:');
        for (const p of periodRows.slice(0, 12)) {
          console.log(`     ${p.AccYear}-${String(p.AccMonth).padStart(2, '0')}: ${p.cnt} rows`);
        }
      }
    } catch (e) {
      console.log(`❌ IN_MTHENDTRX query failed: ${e.message}`);
    }

    // Step 2: Check IN_STOCKISSUE periods
    console.log('\n─── Step 2: Checking IN_STOCKISSUE ───');

    let siPeriodRows = [];
    try {
      const siPeriods = await queryGateway(`
        SELECT DISTINCT AccYear, AccMonth, COUNT(*) as cnt
        FROM IN_STOCKISSUE h
        JOIN IN_STOCKISSUELN l ON h.StockIssueID = l.StockIssueID
        WHERE h.AccYear >= '2025' AND h.Status IN ('2', '5', '6')
        GROUP BY h.AccYear, h.AccMonth
        ORDER BY h.AccYear DESC, h.AccMonth DESC
      `);
      siPeriodRows = siPeriods?.data?.recordset || [];
      console.log(`✅ IN_STOCKISSUE has ${siPeriodRows.length} periods`);
      if (siPeriodRows.length > 0) {
        console.log('   Available periods:');
        for (const p of siPeriodRows.slice(0, 12)) {
          console.log(`     ${p.AccYear}-${String(p.AccMonth).padStart(2, '0')}: ${p.cnt} rows`);
        }
      }
    } catch (e) {
      console.log(`❌ IN_STOCKISSUE query failed: ${e.message}`);
    }

    // Step 3: Compare available periods
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('    PERIOD AVAILABILITY COMPARISON');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (periodRows.length > 0 && siPeriodRows.length > 0) {
      // Find common periods
      const mthendtrxPeriods = new Set(periodRows.map(p => `${p.AccYear}-${p.AccMonth}`));
      const commonPeriods = siPeriodRows.filter(p => mthendtrxPeriods.has(`${p.AccYear}-${p.AccMonth}`));

      console.log(`IN_MTHENDTRX periods: ${periodRows.length}`);
      console.log(`IN_STOCKISSUE periods: ${siPeriodRows.length}`);
      console.log(`Common periods: ${commonPeriods.length}`);

      if (commonPeriods.length > 0) {
        console.log('\n─── Comparing Common Periods ───');

        for (const period of commonPeriods.slice(0, 6)) {
          console.log(`\nPeriod: ${period.AccYear}-${String(period.AccMonth).padStart(2, '0')}`);

          // Query IN_MTHENDTRX
          const mthendtrx = await queryGateway(`
            SELECT
              COUNT(*) AS Transaksi,
              CAST(SUM(ISNULL(Unit, 0)) AS DECIMAL(18,2)) AS TotalQty,
              CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS TotalAmount
            FROM IN_MTHENDTRX
            WHERE AccYear = '${period.AccYear}' AND AccMonth = '${String(period.AccMonth).padStart(2, '0')}'
          `);
          const mthendtrxData = mthendtrx?.data?.recordset?.[0] || {};

          // Query IN_STOCKISSUE
          const stockissue = await queryGateway(`
            SELECT
              COUNT(*) AS Transaksi,
              CAST(SUM(ISNULL(l.Qty, 0)) AS DECIMAL(18,2)) AS TotalQty,
              CAST(SUM(ISNULL(l.Amount, 0)) AS DECIMAL(18,2)) AS TotalAmount
            FROM IN_STOCKISSUE h
            JOIN IN_STOCKISSUELN l ON h.StockIssueID = l.StockIssueID
            WHERE h.AccYear = '${period.AccYear}'
              AND h.AccMonth = '${String(period.AccMonth).padStart(2, '0')}'
              AND h.Status IN ('2', '5', '6')
          `);
          const stockissueData = stockissue?.data?.recordset?.[0] || {};

          const mthendtrxQty = Number(mthendtrxData.TotalQty) || 0;
          const mthendtrxAmt = Number(mthendtrxData.TotalAmount) || 0;
          const siQty = Number(stockissueData.TotalQty) || 0;
          const siAmt = Number(stockissueData.TotalAmount) || 0;

          const qtyDiff = siQty - mthendtrxQty;
          const amtDiff = siAmt - mthendtrxAmt;

          const isMatch = Math.abs(qtyDiff) < 0.01 && Math.abs(amtDiff) < 1;

          if (isMatch) {
            console.log(`  ✅ MATCH`);
            console.log(`     IN_MTHENDTRX: Qty=${mthendtrxQty.toLocaleString()}, Amount=IDR ${mthendtrxAmt.toLocaleString()}`);
            console.log(`     IN_STOCKISSUE: Qty=${siQty.toLocaleString()}, Amount=IDR ${siAmt.toLocaleString()}`);
          } else {
            console.log(`  ❌ DIFFERENCE`);
            console.log(`     IN_MTHENDTRX:   Qty=${mthendtrxQty.toLocaleString()}, Amount=IDR ${mthendtrxAmt.toLocaleString()}`);
            console.log(`     IN_STOCKISSUE:  Qty=${siQty.toLocaleString()}, Amount=IDR ${siAmt.toLocaleString()}`);
            console.log(`     Difference:     Qty=${qtyDiff.toLocaleString()}, Amount=IDR ${amtDiff.toLocaleString()}`);
          }
        }
      }
    }

    // Step 4: Detailed breakdown for latest common period
    if (periodRows.length > 0 && siPeriodRows.length > 0) {
      const latestPeriod = periodRows[0];
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log(`    DETAILED BREAKDOWN: ${latestPeriod.AccYear}-${String(latestPeriod.AccMonth).padStart(2, '0')}`);
      console.log('═══════════════════════════════════════════════════════════════\n');

      // IN_MTHENDTRX by DocType
      console.log('─── IN_MTHENDTRX by DocType ───');
      const byDocType = await queryGateway(`
        SELECT TOP 10
          RTRIM(DocType) AS DocType,
          COUNT(*) AS Transaksi,
          CAST(SUM(ISNULL(Unit, 0)) AS DECIMAL(18,2)) AS TotalQty,
          CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS TotalAmount
        FROM IN_MTHENDTRX
        WHERE AccYear = '${latestPeriod.AccYear}' AND AccMonth = '${String(latestPeriod.AccMonth).padStart(2, '0')}'
        GROUP BY DocType
        ORDER BY TotalAmount DESC
      `);
      const docTypeRows = byDocType?.data?.recordset || [];
      if (docTypeRows.length > 0) {
        for (const row of docTypeRows) {
          console.log(`  ${String(row.DocType).padEnd(15)} | Qty: ${String(row.TotalQty).padStart(12)} | Amount: IDR ${Number(row.TotalAmount).toLocaleString()}`);
        }
      } else {
        console.log('  No data');
      }

      // IN_STOCKISSUE by Status
      console.log('\n─── IN_STOCKISSUE by Status ───');
      const byStatus = await queryGateway(`
        SELECT TOP 10
          h.Status,
          COUNT(*) AS Transaksi,
          CAST(SUM(ISNULL(l.Qty, 0)) AS DECIMAL(18,2)) AS TotalQty,
          CAST(SUM(ISNULL(l.Amount, 0)) AS DECIMAL(18,2)) AS TotalAmount
        FROM IN_STOCKISSUE h
        JOIN IN_STOCKISSUELN l ON h.StockIssueID = l.StockIssueID
        WHERE h.AccYear = '${latestPeriod.AccYear}' AND h.AccMonth = '${String(latestPeriod.AccMonth).padStart(2, '0')}'
        GROUP BY h.Status
        ORDER BY h.Status
      `);
      const statusRows = byStatus?.data?.recordset || [];
      if (statusRows.length > 0) {
        for (const row of statusRows) {
          const statusDesc = { '1': 'Draft', '2': 'Approved', '5': 'Cancelled', '6': 'Posted' }[String(row.Status)] || 'Unknown';
          console.log(`  Status ${row.Status} (${String(statusDesc).padEnd(10)}) | Qty: ${String(row.TotalQty).padStart(12)} | Amount: IDR ${Number(row.TotalAmount).toLocaleString()}`);
        }
      } else {
        console.log('  No data');
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('    AUDIT COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

runAudit();
