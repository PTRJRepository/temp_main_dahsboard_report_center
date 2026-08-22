import assert from 'node:assert/strict'
import { POST } from './route'

const providerEnvKeys = [
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL',
  'API_TIMEOUT_MS',
] as const

type ProviderEnvKey = (typeof providerEnvKeys)[number]

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/reports/ai-insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0]
}

async function withProviderEnv<T>(env: Partial<Record<ProviderEnvKey, string>>, callback: () => Promise<T>) {
  const previous = Object.fromEntries(providerEnvKeys.map((key) => [key, process.env[key]])) as Partial<Record<ProviderEnvKey, string | undefined>>

  providerEnvKeys.forEach((key) => {
    const value = env[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  })

  try {
    return await callback()
  } finally {
    providerEnvKeys.forEach((key) => {
      const value = previous[key]
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    })
  }
}

const reportContext = {
  reportName: 'Inventory Movement',
  reportDescription: 'Movement report',
  dataSource: 'Estate / Kebun',
  analysisQuestion: 'Apa movement paling berisiko?',
  summary: {
    TotalItem: 12,
    TotalAmount: 4500000,
    DeadMovementAmount: 900000,
  },
  metadata: {
    filters: { movementCategory: 'Dead Stock' },
    detailWindow: { totalRows: 12, filteredRows: 4, returnedRows: 4, partial: false },
  },
  sampleRows: [
    { KodeBarang: 'BRG-001', NamaBarang: 'Bearing', MovementCategory: 'Dead Stock', AmountItem: 900000 },
  ],
  chart: [
    { MovementCategory: 'Dead Stock', Amount: 900000, TotalItem: 4 },
  ],
}

const fallbackInsight = {
  summary: 'Fallback summary',
  trendDetection: 'Fallback trend',
  anomalyDetection: 'Fallback anomaly',
  recommendation: 'Fallback recommendation',
  dataQualityNote: 'Fallback data quality',
}

async function main() {
  await withProviderEnv({}, async () => {
    const response = await POST(jsonRequest({ title: 'No payload' }))
    const result = await response.json()
    assert.equal(response.status, 400)
    assert.equal(result.success, false)
    assert.match(result.error, /payload hasil query/i)
  })

  await withProviderEnv({}, async () => {
    const response = await POST(jsonRequest({
      title: 'Inventory Movement',
      context: reportContext,
      fallbackInsight,
    }))
    const result = await response.json()
    assert.equal(response.status, 200)
    assert.equal(result.success, true)
    assert.equal(result.provider, 'local-rule')
    assert.equal(result.insight.summary.includes('Inventory Movement'), true)
  })

  await withProviderEnv({
    ANTHROPIC_AUTH_TOKEN: 'test-token',
    ANTHROPIC_BASE_URL: 'https://gateway.example/anthropic',
    ANTHROPIC_MODEL: 'claude-test-20260101',
    API_TIMEOUT_MS: '5000',
  }, async () => {
    const originalFetch = globalThis.fetch
    let requestedUrl = ''
    let requestedApiKey = ''
    const mockedFetch: typeof fetch = async (input, init) => {
      requestedUrl = String(input)
      requestedApiKey = String((init?.headers as Record<string, string> | undefined)?.['x-api-key'] ?? '')
      return new Response(JSON.stringify({
        content: JSON.stringify({
          summary: 'Bearing menjadi item utama dengan AmountItem 900K.',
          trendDetection: 'Dead Stock bernilai 900K menjadi pembanding terbesar.',
          anomalyDetection: 'Risiko utama ada pada Bearing Dead Stock 900K.',
          recommendation: 'Cek detail Bearing sebelum export.',
          dataQualityNote: 'Evidence memakai sample row Bearing dan summary TotalAmount.',
        }),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    globalThis.fetch = mockedFetch

    try {
      const response = await POST(jsonRequest({
        title: 'Inventory Movement',
        context: reportContext,
        fallbackInsight,
      }))
      const result = await response.json()
      const serialized = JSON.stringify(result)

      assert.equal(response.status, 200)
      assert.equal(requestedUrl, 'https://gateway.example/anthropic/v1/messages')
      assert.equal(requestedApiKey, 'test-token')
      assert.equal(result.provider, 'anthropic')
      assert.equal(result.model, 'claude-test-20260101')
      assert.equal(result.insight.summary, 'Bearing menjadi item utama dengan AmountItem 900K.')
      assert.equal(serialized.includes('test-token'), false)
      assert.equal(serialized.includes('gateway.example'), false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  console.info('ai-insight route tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
