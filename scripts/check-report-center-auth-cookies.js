const fs = require('fs');
const crypto = require('crypto');

const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
const privateKey = fs.readFileSync('keys/private.pem', 'utf8');

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

async function assertReportAccess(cookieName, token) {
  const response = await fetch(`${baseUrl}/report-center/inventory/stock-card?source=estate`, {
    redirect: 'manual',
    headers: { cookie: `${cookieName}=${token}` },
  });

  if (response.status === 302 && (response.headers.get('location') || '').startsWith('/login')) {
    throw new Error(`${cookieName} was redirected to login`);
  }

  if (response.status >= 400) {
    throw new Error(`${cookieName} returned HTTP ${response.status}`);
  }
}

(async () => {
  const token = signTestToken();
  await assertReportAccess('auth-token', token);
  await assertReportAccess('payroll_auth_token', token);
  console.log('Report Center accepts auth-token and payroll_auth_token cookies');
})().catch(error => {
  console.error(error.message);
  process.exit(1);
});
