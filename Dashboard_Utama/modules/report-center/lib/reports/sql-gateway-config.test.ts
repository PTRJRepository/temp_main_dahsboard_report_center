import assert from 'node:assert/strict'
import {
  SQL_GATEWAY_FALLBACK,
  SQL_GATEWAY_PRIMARY,
  gatewayOverrideFromRequest,
  isAllowedSqlGatewayBase,
  normalizeSqlGatewayBase,
  resolveSqlGatewayBase,
  sqlGatewayQueryUrl,
} from './sql-gateway-config'

assert.equal(normalizeSqlGatewayBase('http://10.0.0.110:8001/'), 'http://10.0.0.110:8001')
assert.equal(normalizeSqlGatewayBase('http://localhost:8001/v1/query'), 'http://localhost:8001')
assert.equal(isAllowedSqlGatewayBase('http://evil.example'), false)
assert.equal(isAllowedSqlGatewayBase(SQL_GATEWAY_PRIMARY), true)
assert.equal(isAllowedSqlGatewayBase(SQL_GATEWAY_FALLBACK), true)

assert.equal(resolveSqlGatewayBase({ env: {} }), SQL_GATEWAY_PRIMARY)
assert.equal(
  resolveSqlGatewayBase({ env: { SQL_GATEWAY_URL: 'http://localhost:8001/v1/query' } }),
  'http://localhost:8001',
)
assert.equal(
  resolveSqlGatewayBase({
    env: { SQL_GATEWAY_URL: 'http://localhost:8001' },
    override: SQL_GATEWAY_PRIMARY,
  }),
  SQL_GATEWAY_PRIMARY,
)
assert.equal(
  resolveSqlGatewayBase({
    env: {},
    override: 'http://evil.example',
  }),
  SQL_GATEWAY_PRIMARY,
)

assert.equal(sqlGatewayQueryUrl('http://10.0.0.110:8001/'), 'http://10.0.0.110:8001/v1/query')

const allowed = gatewayOverrideFromRequest({
  headers: { get: (n) => (n.toLowerCase() === 'x-sql-gateway-base' ? SQL_GATEWAY_FALLBACK : null) },
})
assert.equal(allowed, SQL_GATEWAY_FALLBACK)

const blocked = gatewayOverrideFromRequest({
  headers: { get: () => 'http://evil.example' },
})
assert.equal(blocked, null)

console.log('sql-gateway-config.test.ts: ok')
