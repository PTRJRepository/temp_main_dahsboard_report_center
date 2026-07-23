const fs = require('fs');
const crypto = require('crypto');

const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
const privateKey = fs.readFileSync('keys/private.pem', 'utf8');
const liveReports = [
  'stok-gudang',
  'asset-stock-valuasi-listing',
  'all-stock-movement-analysis',
  'item-movement-update-tracking',
  'movement-stock',
  'monthly-stock-account-movement-details',
  'pengeluaran-barang',
  'goods-receiving-receipt-activity',
  'purchase-request-inventory',
  'transfer-antar-gudang',
  'stock-opname',
  'fuel-usage',
  'riwayat-transaksi',
  'return-barang',
  'item-stale-update',
  'purchase-order-history',
  'supplier-purchasing-performance',
  'pupuk-stock-procurement',
  'vehicle-running-workshop',
];

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function signTestToken() {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    userId: 1,
    email: 'report-check@example.com',
    name: 'Report Check',
    role: 'ADMIN',
    exp: Math.floor(Date.now() / 1000) + 300,
  }));
  const data = `${header}.${payload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url');
  return `${data}.${signature}`;
}

async function checkReport(source, report, token) {
  const url = `${baseUrl}/api/reports/inventory?report=${encodeURIComponent(report)}&source=${source}&page=1&pageSize=5`;
  const response = await fetch(url, {
    headers: { cookie: `auth-token=${token}` },
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success !== true) {
    throw new Error(`${source}/${report}: HTTP ${response.status} ${data.error || 'invalid response'}`);
  }
}

(async () => {
  const token = signTestToken();
  const failures = [];
  for (const source of ['estate', 'pabrik']) {
    for (const report of liveReports) {
      try {
        await checkReport(source, report, token);
      } catch (error) {
        failures.push(error.message);
      }
    }
  }

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }

  console.log(`Report Center live reports OK: ${liveReports.length} reports x 2 sources`);
})();
