import assert from 'node:assert/strict'
import {
  executeInventoryReadQuery,
  getInventoryQueryContext,
  normalizeInventoryQueryLimit,
  normalizeInventoryQueryTimeoutMs,
} from './query-gateway'

assert.equal(normalizeInventoryQueryLimit('0', { min: 5, max: 500, fallback: 100 }), 5)
assert.equal(normalizeInventoryQueryLimit('9999', { min: 5, max: 500, fallback: 100 }), 500)
assert.equal(normalizeInventoryQueryLimit('abc', { min: 5, max: 500, fallback: 100 }), 100)
assert.equal(normalizeInventoryQueryTimeoutMs('1000'), 5_000)
assert.equal(normalizeInventoryQueryTimeoutMs('9000000'), 120_000)

const estate = getInventoryQueryContext('estate', {})
assert.equal(estate.server, 'SERVER_PROFILE_2')
assert.equal(estate.database, 'db_ptrj')
assert.equal(estate.publicSourceId, 'estate-inventory-live')

const pabrik = getInventoryQueryContext('pabrik', { DATABASE_NAME: 'custom_db' })
assert.equal(pabrik.server, 'SERVER_PROFILE_3')
assert.equal(pabrik.database, 'custom_db')

async function main() {
  const blocked = await executeInventoryReadQuery(estate, 'DELETE FROM IN_ITEM', {
    env: {
      SQL_GATEWAY_API_KEY: 'test-key',
      SQL_GATEWAY_URL: 'https://gateway.example/query',
    },
    fetchFn: async () => {
      throw new Error('fetch should not run')
    },
  })
  assert.equal(blocked.success, false)
  assert.equal(typeof blocked.error, 'string')

  const missingConfig = await executeInventoryReadQuery(estate, 'SELECT 1', {
    env: {
      SQL_GATEWAY_URL: 'https://gateway.example/query',
    },
  })
  assert.equal(missingConfig.success, false)
  assert.equal(missingConfig.error, 'Konfigurasi query inventory belum lengkap.')

  // Missing SQL_GATEWAY_URL falls back to primary 10.0.0.110:8001 when key present
  let defaultBaseUrl = ''
  const withDefaultBase = await executeInventoryReadQuery(estate, 'SELECT 1', {
    env: {
      SQL_GATEWAY_API_KEY: 'test-key',
    },
    fetchFn: async (url) => {
      defaultBaseUrl = String(url)
      return new Response(JSON.stringify({ success: true, data: { recordset: [] } }), { status: 200 })
    },
  })
  assert.equal(withDefaultBase.success, true)
  assert.equal(defaultBaseUrl.startsWith('http://10.0.0.110:8001/'), true)

  let requestedUrl = ''
  let requestedBody: Record<string, unknown> = {}
  const success = await executeInventoryReadQuery(estate, 'SELECT 1 AS Value', {
    env: {
      SQL_GATEWAY_API_KEY: 'test-key',
      SQL_GATEWAY_URL: 'https://gateway.example/query/',
    },
    fetchFn: async (url, init) => {
      requestedUrl = String(url)
      requestedBody = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({
        success: true,
        execution_ms: 12,
        data: { recordset: [{ Value: 1 }] },
      }), { status: 200 })
    },
  })
  assert.equal(success.success, true)
  assert.equal(success.execution_ms, 12)
  assert.equal(success.data?.recordset?.[0].Value, 1)
  assert.equal(requestedUrl, 'https://gateway.example/query/v1/query')
  assert.equal(requestedBody.server, 'SERVER_PROFILE_2')
  assert.equal(requestedBody.database, 'db_ptrj')

  const providerError = await executeInventoryReadQuery(estate, 'SELECT 1', {
    env: {
      SQL_GATEWAY_API_KEY: 'test-key',
      SQL_GATEWAY_URL: 'https://gateway.example/query',
    },
    fetchFn: async () => new Response(JSON.stringify({ success: false, error: 'raw sql detail' }), { status: 500 }),
  })
  assert.equal(providerError.success, false)
  assert.equal(providerError.error?.includes('raw sql detail'), false)

  const timeout = await executeInventoryReadQuery(estate, 'SELECT 1', {
    env: {
      SQL_GATEWAY_API_KEY: 'test-key',
      SQL_GATEWAY_URL: 'https://gateway.example/query',
    },
    fetchFn: async () => {
      throw new DOMException('timeout', 'TimeoutError')
    },
  })
  assert.equal(timeout.success, false)
  assert.equal(timeout.error, 'Query inventory melewati batas waktu aman.')

  console.info('inventory query-gateway tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
