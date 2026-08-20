export type AnthropicTextMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AnthropicProviderConfig = {
  configured: boolean
  authToken?: string
  baseUrl?: string
  messagesUrl?: string
  model: string
  timeoutMs: number
  publicMessage?: string
}

export type AnthropicProviderStatus =
  | 'success'
  | 'missing-config'
  | 'timeout'
  | 'aborted'
  | 'malformed-response'
  | 'provider-error'

export type AnthropicProviderResult = {
  ok: boolean
  status: AnthropicProviderStatus
  content?: string
  model: string
  provider: 'anthropic' | 'local-rule'
  providerEngine: 'anthropic-messages' | 'deterministic-local'
  retryable: boolean
  publicMessage?: string
  httpStatus?: number
}

export type AnthropicProviderEnv = Partial<Record<string, string | undefined>>

export type AnthropicProviderRequest = {
  system?: string
  messages: AnthropicTextMessage[]
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
  env?: AnthropicProviderEnv
  config?: AnthropicProviderConfig
  fetchFn?: typeof fetch
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_TIMEOUT_MS = 60_000
const MIN_TIMEOUT_MS = 5_000
const MAX_TIMEOUT_MS = 120_000
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL_PATTERN = /^claude-[a-z0-9][a-z0-9_.:-]*$/i

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function clampAnthropicTimeoutMs(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_TIMEOUT_MS
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.trunc(numeric)))
}

export function normalizeAnthropicModel(value: unknown) {
  const model = cleanText(value)
  if (!model) return DEFAULT_MODEL
  return MODEL_PATTERN.test(model) ? model : DEFAULT_MODEL
}

export function normalizeAnthropicMessagesUrl(value: unknown) {
  const raw = cleanText(value).replace(/\/+$/, '')
  if (!raw) return undefined

  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    if (/\/messages$/i.test(url.pathname)) return url.toString()
    if (/\/v1$/i.test(url.pathname)) {
      url.pathname = `${url.pathname.replace(/\/+$/, '')}/messages`
    } else {
      url.pathname = `${url.pathname.replace(/\/+$/, '')}/v1/messages`
    }
    return url.toString()
  } catch {
    return undefined
  }
}

export function getAnthropicProviderConfig(env: AnthropicProviderEnv = process.env): AnthropicProviderConfig {
  const authToken = cleanText(env.ANTHROPIC_AUTH_TOKEN)
  const baseUrl = cleanText(env.ANTHROPIC_BASE_URL)
  const messagesUrl = normalizeAnthropicMessagesUrl(baseUrl)
  const model = normalizeAnthropicModel(env.ANTHROPIC_MODEL)
  const timeoutMs = clampAnthropicTimeoutMs(env.API_TIMEOUT_MS)
  const configured = Boolean(authToken && messagesUrl)

  return {
    configured,
    authToken: authToken || undefined,
    baseUrl: baseUrl || undefined,
    messagesUrl,
    model,
    timeoutMs,
    publicMessage: configured
      ? undefined
      : 'AI belum dikonfigurasi di server. Insight lokal dipakai.',
  }
}

function providerMessage(status: AnthropicProviderStatus, httpStatus?: number) {
  if (status === 'missing-config') return 'AI belum dikonfigurasi di server. Insight lokal dipakai.'
  if (status === 'timeout') return 'AI melewati batas waktu aman. Insight lokal dipakai.'
  if (status === 'aborted') return 'Permintaan AI dibatalkan. Insight lokal dipakai.'
  if (status === 'malformed-response') return 'AI mengembalikan format tidak valid. Insight lokal dipakai.'
  if (httpStatus === 401 || httpStatus === 403) return 'Konfigurasi akses AI tidak dapat dipakai. Insight lokal dipakai.'
  if (httpStatus === 429) return 'AI sedang dibatasi sementara. Insight lokal dipakai.'
  if (httpStatus && httpStatus >= 500) return 'AI sedang tidak tersedia. Insight lokal dipakai.'
  return 'AI tidak dapat memproses permintaan. Insight lokal dipakai.'
}

function isRetryableHttpStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500
}

function contentToString(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (Array.isArray(value)) {
    const text = value
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          const entry = item as Record<string, unknown>
          return contentToString(entry.text ?? entry.content ?? entry.output_text)
        }
        return undefined
      })
      .filter(Boolean)
      .join('')
      .trim()
    return text || undefined
  }
  if (value && typeof value === 'object') {
    const entry = value as Record<string, unknown>
    return contentToString(entry.content ?? entry.text ?? entry.message ?? entry.output_text ?? entry.response)
  }
  return undefined
}

function extractAnthropicContent(result: unknown) {
  if (!result || typeof result !== 'object') return undefined
  const entry = result as Record<string, unknown>
  return (
    contentToString(entry.content) ??
    contentToString(entry.output_text) ??
    contentToString(entry.response) ??
    contentToString(entry.message) ??
    contentToString(entry.data)
  )
}

function failedResult(
  status: Exclude<AnthropicProviderStatus, 'success'>,
  model: string,
  options: { httpStatus?: number; retryable?: boolean } = {},
): AnthropicProviderResult {
  return {
    ok: false,
    status,
    model,
    provider: 'local-rule',
    providerEngine: 'deterministic-local',
    retryable: options.retryable ?? false,
    publicMessage: providerMessage(status, options.httpStatus),
    httpStatus: options.httpStatus,
  }
}

function classifyProviderException(error: unknown, timedOut: boolean): Exclude<AnthropicProviderStatus, 'success'> {
  const name = error && typeof error === 'object' ? String((error as { name?: unknown }).name ?? '') : ''
  if (timedOut || name === 'TimeoutError') return 'timeout'
  if (name === 'AbortError') return 'aborted'
  return 'provider-error'
}

export async function callAnthropicMessages(request: AnthropicProviderRequest): Promise<AnthropicProviderResult> {
  const config = request.config ?? getAnthropicProviderConfig(request.env)
  if (!config.configured || !config.authToken || !config.messagesUrl) {
    return failedResult('missing-config', config.model)
  }

  if (request.signal?.aborted) {
    return failedResult('aborted', config.model)
  }

  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort(new DOMException('AI timeout', 'TimeoutError'))
  }, config.timeoutMs)
  const abort = () => controller.abort(request.signal?.reason)
  request.signal?.addEventListener('abort', abort, { once: true })

  try {
    const response = await (request.fetchFn ?? fetch)(config.messagesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': ANTHROPIC_VERSION,
        'x-api-key': config.authToken,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: Math.min(Math.max(Math.trunc(Number(request.maxTokens ?? 1800)), 1), 8192),
        temperature: Math.min(Math.max(Number(request.temperature ?? 0.1), 0), 1),
        system: request.system,
        messages: request.messages,
      }),
      cache: 'no-store',
      signal: controller.signal,
    })

    const result = await response.json().catch(() => undefined)
    const content = extractAnthropicContent(result)

    if (!response.ok) {
      return failedResult('provider-error', config.model, {
        httpStatus: response.status,
        retryable: isRetryableHttpStatus(response.status),
      })
    }

    if (!content) {
      return failedResult('malformed-response', config.model)
    }

    return {
      ok: true,
      status: 'success',
      content,
      model: config.model,
      provider: 'anthropic',
      providerEngine: 'anthropic-messages',
      retryable: false,
    }
  } catch (error) {
    const status = classifyProviderException(error, timedOut)
    return failedResult(status, config.model, {
      retryable: status === 'timeout' || status === 'provider-error',
    })
  } finally {
    clearTimeout(timeout)
    request.signal?.removeEventListener('abort', abort)
  }
}
