import assert from 'node:assert/strict'
import {
  callAnthropicMessages,
  clampAnthropicTimeoutMs,
  getAnthropicProviderConfig,
  normalizeAnthropicMessagesUrl,
  normalizeAnthropicModel,
} from './ai-provider'

assert.equal(normalizeAnthropicMessagesUrl('https://gateway.example/anthropic'), 'https://gateway.example/anthropic/v1/messages')
assert.equal(normalizeAnthropicMessagesUrl('https://gateway.example/anthropic/v1'), 'https://gateway.example/anthropic/v1/messages')
assert.equal(normalizeAnthropicMessagesUrl('https://gateway.example/anthropic/v1/messages'), 'https://gateway.example/anthropic/v1/messages')
assert.equal(normalizeAnthropicMessagesUrl('file:///tmp/anthropic'), undefined)

assert.equal(clampAnthropicTimeoutMs(undefined), 60_000)
assert.equal(clampAnthropicTimeoutMs('1000'), 5_000)
assert.equal(clampAnthropicTimeoutMs('9000000'), 120_000)
assert.equal(clampAnthropicTimeoutMs('70000'), 70_000)

assert.equal(normalizeAnthropicModel('claude-test-20260101'), 'claude-test-20260101')
assert.equal(normalizeAnthropicModel('bad model with spaces'), 'claude-sonnet-4-20250514')

const missing = getAnthropicProviderConfig({})
assert.equal(missing.configured, false)
assert.equal(missing.publicMessage?.includes('server'), true)

async function main() {
  let requestedUrl = ''
  let requestedBody: Record<string, unknown> = {}
  let requestedHeaders: Headers | undefined
  const success = await callAnthropicMessages({
    env: {
      ANTHROPIC_AUTH_TOKEN: 'test-token',
      ANTHROPIC_BASE_URL: 'https://gateway.example/anthropic',
      ANTHROPIC_MODEL: 'claude-test-20260101',
      API_TIMEOUT_MS: '9000000',
    },
    messages: [{ role: 'user', content: 'Buat insight' }],
    maxTokens: 1200,
    fetchFn: async (url, init) => {
      requestedUrl = String(url)
      requestedHeaders = new Headers(init?.headers)
      requestedBody = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"ok":true}' }] }), { status: 200 })
    },
  })
  assert.equal(success.ok, true)
  assert.equal(success.content, '{"ok":true}')
  assert.equal(success.provider, 'anthropic')
  assert.equal(requestedUrl, 'https://gateway.example/anthropic/v1/messages')
  assert.equal(requestedHeaders?.get('x-api-key'), 'test-token')
  assert.equal(requestedHeaders?.get('anthropic-version'), '2023-06-01')
  assert.equal(requestedBody.model, 'claude-test-20260101')
  assert.equal(requestedBody.max_tokens, 1200)

  const noConfig = await callAnthropicMessages({
    env: {},
    messages: [{ role: 'user', content: 'x' }],
    fetchFn: async () => {
      throw new Error('fetch should not run')
    },
  })
  assert.equal(noConfig.ok, false)
  assert.equal(noConfig.status, 'missing-config')
  assert.equal(noConfig.publicMessage?.includes('test-token'), false)

  const abortedController = new AbortController()
  abortedController.abort()
  const aborted = await callAnthropicMessages({
    env: {
      ANTHROPIC_AUTH_TOKEN: 'test-token',
      ANTHROPIC_BASE_URL: 'https://gateway.example/anthropic',
    },
    signal: abortedController.signal,
    messages: [{ role: 'user', content: 'x' }],
  })
  assert.equal(aborted.status, 'aborted')

  const timeout = await callAnthropicMessages({
    env: {
      ANTHROPIC_AUTH_TOKEN: 'test-token',
      ANTHROPIC_BASE_URL: 'https://gateway.example/anthropic',
    },
    messages: [{ role: 'user', content: 'x' }],
    fetchFn: async () => {
      throw new DOMException('timeout', 'TimeoutError')
    },
  })
  assert.equal(timeout.status, 'timeout')
  assert.equal(timeout.retryable, true)

  const malformed = await callAnthropicMessages({
    env: {
      ANTHROPIC_AUTH_TOKEN: 'test-token',
      ANTHROPIC_BASE_URL: 'https://gateway.example/anthropic',
    },
    messages: [{ role: 'user', content: 'x' }],
    fetchFn: async () => new Response(JSON.stringify({ content: [] }), { status: 200 }),
  })
  assert.equal(malformed.status, 'malformed-response')

  const badRequest = await callAnthropicMessages({
    env: {
      ANTHROPIC_AUTH_TOKEN: 'test-token',
      ANTHROPIC_BASE_URL: 'https://gateway.example/anthropic',
    },
    messages: [{ role: 'user', content: 'x' }],
    fetchFn: async () => new Response(JSON.stringify({ error: { message: 'raw provider body' } }), { status: 400 }),
  })
  assert.equal(badRequest.status, 'provider-error')
  assert.equal(badRequest.retryable, false)
  assert.equal(badRequest.publicMessage?.includes('raw provider body'), false)

  const busy = await callAnthropicMessages({
    env: {
      ANTHROPIC_AUTH_TOKEN: 'test-token',
      ANTHROPIC_BASE_URL: 'https://gateway.example/anthropic',
    },
    messages: [{ role: 'user', content: 'x' }],
    fetchFn: async () => new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 503 }),
  })
  assert.equal(busy.retryable, true)
  assert.equal(busy.publicMessage?.includes('https://gateway.example'), false)

  console.info('ai-provider tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
