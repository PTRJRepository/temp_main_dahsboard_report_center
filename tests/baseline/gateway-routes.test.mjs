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

// T1: Canonical /health/live endpoint (Phase 1)
const t1 = await run('GET /health/live returns 200 + ok', async () => {
  const res = await request('/health/live')
  assert.equal(res.status, 200, `got ${res.status}`)
  const data = JSON.parse(res.body)
  assert.equal(data.ok, true, 'ok must be true')
  assert.equal(data.service, 'bun-gateway', 'service field')
  assert.ok(data.timestamp, 'must have timestamp')
  assert.ok(res.headers['x-request-id'], 'must return X-Request-ID header')
})

// T2: /health/ready endpoint (Phase 1)
const t2 = await run('GET /health/ready returns 200 + version', async () => {
  const res = await request('/health/ready')
  assert.equal(res.status, 200, `got ${res.status}`)
  const data = JSON.parse(res.body)
  assert.equal(data.ok, true)
  assert.ok(data.version, 'must have version')
  assert.equal(data.initialized, true)
})

// T3: /version endpoint (Phase 1)
const t3 = await run('GET /version returns 200 + gateway version', async () => {
  const res = await request('/version')
  assert.equal(res.status, 200, `got ${res.status}`)
  const data = JSON.parse(res.body)
  assert.ok(data.gateway, 'must have gateway version')
  assert.ok(data.bun, 'must have bun version')
})

// T4: Legacy /health alias
const t4 = await run('GET /health returns 200 (legacy compat)', async () => {
  const res = await request('/health')
  assert.equal(res.status, 200, `got ${res.status}`)
})

// T5: IFESS public health endpoint
const t5 = await run('GET /api/ifess/health returns 200 + JSON', async () => {
  const res = await request('/api/ifess/health')
  assert.equal(res.status, 200, `got ${res.status}`)
  const data = JSON.parse(res.body)
  assert.ok(data.status, 'response must contain status field')
  assert.ok(data.serverTime, 'response must contain serverTime field')
})

// T6: IFESS protected endpoint → 401 without API key
const t6 = await run('GET /api/ifess/clients returns 401 (API key required)', async () => {
  const res = await request('/api/ifess/clients')
  assert.equal(res.status, 401, `got ${res.status}`)
  const data = JSON.parse(res.body)
  assert.ok(data.error || data.message, 'must have error field')
})

// T7: Query templates (no auth required)
const t7 = await run('GET /api/query-gateway/templates returns 200 + array', async () => {
  const res = await request('/api/query-gateway/templates')
  assert.equal(res.status, 200, `got ${res.status}`)
  const data = JSON.parse(res.body)
  assert.ok(Array.isArray(data), 'must return an array')
})

// T8: exec-sync with invalid JSON body → error status
const t8 = await run('POST /api/query-gateway/exec-sync rejects bad JSON', async () => {
  const res = await request('/api/query-gateway/exec-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  assert.ok(res.status >= 400, `expected >= 400, got ${res.status}`)
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
}
