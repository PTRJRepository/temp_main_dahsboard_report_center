/**
 * Baseline test: Gateway route smoke tests.
 * Verifies critical routes return expected status codes.
 *
 * Run with: node tests/baseline/gateway-routes.test.mjs
 * Requires: gateway running on port 3001 (or set GATEWAY_PORT)
 *
 * Exit codes: 0 = all pass, 1 = any failure
 */

import assert from 'node:assert/strict'
import http from 'node:http'

const PORT = parseInt(process.env.GATEWAY_PORT || '3001')
const BASE = `http://localhost:${PORT}`
const TIMEOUT = 5000

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE}${path}`, {
      method: options.method || 'GET',
      headers: options.headers,
      timeout: TIMEOUT,
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const headers = {}
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

async function run(label, fn) {
  try {
    await fn()
    console.log(`  ✓ ${label}`)
    return true
  } catch (e) {
    console.log(`  ✗ ${label}: ${e.message}`)
    return false
  }
}

// T1: Gateway root responds
const t1 = await run('GET / returns 200 or 302', async () => {
  const res = await request('/')
  assert.ok(res.status === 200 || res.status === 302, `expected 200 or 302, got ${res.status}`)
})

// T2: Public health endpoint
const t2 = await run('GET /api/ifess/health returns 200 + JSON', async () => {
  const res = await request('/api/ifess/health')
  assert.equal(res.status, 200, `got ${res.status}`)
  const data = JSON.parse(res.body)
  assert.ok(data.status, 'response must contain status field')
  assert.ok(data.serverTime, 'response must contain serverTime field')
})

// T3: Protected route redirects
const t3 = await run('GET /api/ifess/clients redirects 302 (unauthenticated)', async () => {
  const res = await request('/api/ifess/clients')
  assert.equal(res.status, 302, `got ${res.status}`)
})

// T4: Query templates (no auth required)
const t4 = await run('GET /api/query-gateway/templates returns 200 + array', async () => {
  const res = await request('/api/query-gateway/templates')
  assert.equal(res.status, 200, `got ${res.status}`)
  const data = JSON.parse(res.body)
  assert.ok(Array.isArray(data), 'must return an array')
})

// T5: Gateway info
const t5 = await run('GET /api/gateway/info returns 200', async () => {
  const res = await request('/api/gateway/info')
  assert.equal(res.status, 200, `got ${res.status}`)
  const data = JSON.parse(res.body)
  assert.ok(data.port, 'response must contain port')
  assert.ok(Array.isArray(data.routes), 'response must contain routes array')
})

// T6: Report center proxy
const t6 = await run('GET /report-center returns 200 (Dashboard proxy)', async () => {
  const res = await request('/report-center')
  assert.equal(res.status, 200, `got ${res.status}`)
  assert.ok(res.headers['content-type']?.includes('text/html'), 'should return HTML')
})

// T7: Network monitor static
const t7 = await run('GET /network-monitor returns 200 (static HTML)', async () => {
  const res = await request('/network-monitor')
  assert.equal(res.status, 200, `got ${res.status}`)
  assert.ok(res.headers['content-type']?.includes('text/html'), 'should return HTML')
})

// T8: exec-sync rejects without query
const t8 = await run('POST /api/query-gateway/exec-sync returns 400 without query', async () => {
  const res = await request('/api/query-gateway/exec-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  assert.equal(res.status, 400, `got ${res.status}`)
})

// Summary
const results = [t1, t2, t3, t4, t5, t6, t7, t8]
const passed = results.filter(Boolean).length
console.log(`\n${passed}/${results.length} smoke tests passed`)

if (passed < results.length) {
  console.log('\n❌ Baseline gateway smoke tests FAILED')
  console.log('   Ensure gateway is running: bun run server_bun.js')
  process.exit(1)
} else {
  console.log('✅ All baseline gateway smoke tests passed')
  console.log('   These tests verify gateway route behavior BEFORE any extraction refactor.')
}
