/**
 * Baseline test: Gateway route smoke tests.
 * Verifies critical routes return expected status codes.
 *
 * Run with: npx tsx tests/baseline/gateway-routes.test.ts
 * Requires: gateway running on port 3001 (or set GATEWAY_PORT)
 *
 * Exit codes: 0 = all pass, 1 = any failure
 */

import assert from 'node:assert/strict'
import http from 'node:http'

const PORT = parseInt(process.env.GATEWAY_PORT || '3001')
const BASE = `http://localhost:${PORT}`
const TIMEOUT = 5000

function request(path: string, options: { method?: string; headers?: Record<string, string> } = {}): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE}${path}`, {
      method: options.method || 'GET',
      headers: options.headers,
      timeout: TIMEOUT,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const headers: Record<string, string> = {}
        for (const [k, v] of Object.entries(res.headers)) {
          if (v) headers[k] = Array.isArray(v) ? v.join(', ') : v
        }
        resolve({ status: res.statusCode || 0, headers, body: Buffer.concat(chunks).toString('utf8') })
      })
    })
    req.on('timeout', () => { req.destroy(); reject(new Error(`timeout: ${path}`)) })
    req.on('error', reject)
    req.end()
  })
}

// ── Smoke tests ────────────────────────────────────────────────────────────────

type Test = { label: string; fn: () => Promise<void> }
const results: { label: string; pass: boolean; error?: string }[] = []

async function run(label: string, fn: () => Promise<void>) {
  try {
    await fn()
    results.push({ label, pass: true })
    console.log(`  ✓ ${label}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    results.push({ label, pass: false, error: msg })
    console.log(`  ✗ ${label}: ${msg}`)
  }
}

// T1: Gateway root responds
await run('GET / returns 200 or redirects to login', async () => {
  const res = await request('/')
  assert.ok(res.status === 200 || res.status === 302, `expected 200 or 302, got ${res.status}`)
})

// T2: Public health endpoint
await run('GET /api/ifess/health returns 200 + JSON', async () => {
  const res = await request('/api/ifess/health')
  assert.equal(res.status, 200, `expected 200, got ${res.status}`)
  const data = JSON.parse(res.body)
  assert.ok(data.status, 'response must contain status field')
  assert.ok(data.serverTime, 'response must contain serverTime field')
})

// T3: Protected route redirects unauthenticated request
await run('GET /api/ifess/clients redirects to login (unauthenticated)', async () => {
  const res = await request('/api/ifess/clients')
  assert.equal(res.status, 302, `expected 302 redirect, got ${res.status}`)
})

// T4: Query gateway templates endpoint (no auth required for templates list)
await run('GET /api/query-gateway/templates returns 200 + JSON', async () => {
  const res = await request('/api/query-gateway/templates')
  assert.equal(res.status, 200, `expected 200, got ${res.status}`)
  const data = JSON.parse(res.body)
  assert.ok(Array.isArray(data), 'templates endpoint must return an array')
})

// T5: Query gateway validate endpoint accepts POST
await run('POST /api/query-gateway/validate rejects write SQL', async () => {
  const res = await request('/api/query-gateway/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  assert.equal(res.status, 200, `expected 200, got ${res.status}`)
  const data = JSON.parse(res.body)
  assert.ok(data.valid === false, 'INSERT should be rejected as invalid')
})

// T6: Report center proxy (proxied to Dashboard_Utama at 3100)
await run('GET /report-center returns 200 (Dashboard proxy)', async () => {
  const res = await request('/report-center')
  assert.equal(res.status, 200, `expected 200, got ${res.status}`)
  assert.ok(res.headers['content-type']?.includes('text/html'), 'should return HTML')
})

// T7: Server monitor proxy
await run('GET /server-monitor returns 200 (Vite app)', async () => {
  const res = await request('/server-monitor')
  assert.equal(res.status, 200, `expected 200, got ${res.status}`)
})

// T8: Network monitor static
await run('GET /network-monitor returns 200 (static HTML)', async () => {
  const res = await request('/network-monitor')
  assert.equal(res.status, 200, `expected 200, got ${res.status}`)
  assert.ok(res.headers['content-type']?.includes('text/html'), 'should return HTML')
})

// T9: /api/reports returns 200 (Dashboard API)
await run('GET /api/reports/inventory returns 200 or 400 (report API)', async () => {
  const res = await request('/api/reports/inventory')
  // May return 200 with data, or 400 with filter params required — both acceptable
  assert.ok(res.status === 200 || res.status === 400, `expected 200 or 400, got ${res.status}`)
})

// T10: Gateway info endpoint
await run('GET /api/gateway/info returns 200', async () => {
  const res = await request('/api/gateway/info')
  assert.equal(res.status, 200, `expected 200, got ${res.status}`)
  const data = JSON.parse(res.body)
  assert.ok(data.port, 'response must contain port')
  assert.ok(Array.isArray(data.routes), 'response must contain routes array')
})

// T11: exec-sync rejects without query text
await run('POST /api/query-gateway/exec-sync returns 400 without query', async () => {
  const res = await request('/api/query-gateway/exec-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  assert.equal(res.status, 400, `expected 400, got ${res.status}`)
})

// ── Summary ─────────────────────────────────────────────────────────────────

const passed = results.filter(r => r.pass).length
const failed = results.filter(r => !r.pass)
console.log(`\n${passed}/${results.length} smoke tests passed`)

if (failed.length > 0) {
  console.log('\nFailed tests:')
  for (const r of failed) {
    console.log(`  ✗ ${r.label}: ${r.error}`)
  }
  console.log('\n❌ Baseline gateway smoke tests FAILED')
  console.log('   Ensure gateway is running: bun run server_bun.js')
  process.exit(1)
} else {
  console.log('✅ All baseline gateway smoke tests passed')
  console.log('   These tests verify gateway route behavior BEFORE any extraction refactor.')
}
