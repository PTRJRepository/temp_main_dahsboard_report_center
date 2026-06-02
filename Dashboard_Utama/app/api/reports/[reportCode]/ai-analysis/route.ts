import { NextRequest, NextResponse } from 'next/server'
import {
  buildReportAnalysisPayload,
  generateLocalDashboardDefinition,
  parseDashboardJson,
  sanitizeDashboardDefinition,
  type AiDashboardOptions,
  type DbRow,
  type ReportPayload,
} from '@/lib/reports/ai-dashboard'
import { compactReportPayloadForAi } from '@/lib/reports/report-detail-performance'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DISPLAY_PROVIDER = 'local-llm'
const PROVIDER_ENGINE = '9router'
const ADACODE_URL = process.env.ADACODE_BASE_URL ?? process.env.LOCAL_LLM_BASE_URL ?? 'https://api.local-llm.ai/v1/chat/completions'
const rawAdaCodeModel = (process.env.ADACODE_MODEL ?? process.env.LOCAL_LLM_MODEL ?? '').trim()
const ADACODE_MODEL =
  ['minimax m2.5', 'minimax/minimax-m2.5', 'minimax-m2.5'].includes(rawAdaCodeModel.toLowerCase())
    ? 'minimax-m2.5'
    : rawAdaCodeModel || 'minimax-m2.5'
const ADACODE_API_KEY = process.env.ADACODE_API_KEY ?? process.env.LOCAL_LLM_API_KEY

type AiAnalysisRequestBody = {
  filters?: DbRow
  payload?: ReportPayload
  options?: AiDashboardOptions
  report?: {
    code?: string
    name?: string
    description?: string
  }
}

type AdaCodeResponse = {
  choices?: Array<{
    finish_reason?: string
    text?: string
    content?: string
    message?: {
      content?: unknown
    }
  }>
  error?: {
    message?: string
  }
  content?: unknown
  message?: unknown
  output_text?: unknown
  response?: unknown
  data?: unknown
}

function compactJson(value: unknown) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === 'string' && item.length > 220) return `${item.slice(0, 220)}...`
    return item
  })
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

function extractAdaCodeContent(result: AdaCodeResponse) {
  const choice = result.choices?.[0]
  return (
    contentToString(choice?.message?.content) ??
    contentToString(choice?.text) ??
    contentToString(choice?.content) ??
    contentToString(result.output_text) ??
    contentToString(result.content) ??
    contentToString(result.response) ??
    contentToString(result.message) ??
    contentToString(result.data)
  )
}

function adaCodeErrorMessage(result: AdaCodeResponse, status: number) {
  const finishReason = result.choices?.[0]?.finish_reason
  if (finishReason === 'length') return 'AI output terpotong karena batas token.'
  return result.error?.message ?? `AdaCode API HTTP ${status}${finishReason ? ` (${finishReason})` : ''}`
}

function reportCodeFromPath(request: NextRequest) {
  const parts = request.nextUrl.pathname.split('/').filter(Boolean)
  const reportsIndex = parts.findIndex((part) => part === 'reports')
  return reportsIndex >= 0 ? decodeURIComponent(parts[reportsIndex + 1] ?? 'dynamic-report') : 'dynamic-report'
}

function hasPayload(payload?: ReportPayload) {
  return Boolean(
    payload &&
      ((payload.rows?.length ?? 0) > 0 ||
        Object.keys(payload.summary ?? {}).length > 0 ||
        (payload.chart?.length ?? 0) > 0),
  )
}

async function callAdaCode(messages: Array<{ role: 'system' | 'user'; content: string }>, maxTokens = 5200) {
  if (!ADACODE_API_KEY) return { content: undefined, warning: 'ADACODE_API_KEY/LOCAL_LLM_API_KEY belum dikonfigurasi.' }

  const response = await fetch(ADACODE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADACODE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ADACODE_MODEL,
      temperature: 0.1,
      max_tokens: maxTokens,
      messages,
    }),
    cache: 'no-store',
  })

  const result = (await response.json().catch(() => ({}))) as AdaCodeResponse
  const content = extractAdaCodeContent(result)
  if (!response.ok || !content) return { content: undefined, warning: adaCodeErrorMessage(result, response.status) }
  return { content }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as AiAnalysisRequestBody
  const reportCode = body.report?.code ?? reportCodeFromPath(request)
  const rawPayload: ReportPayload = {
    ...(body.payload ?? {}),
    title: body.report?.name ?? body.payload?.title,
    description: body.report?.description ?? body.payload?.description,
  }
  const options: AiDashboardOptions = {
    maxCharts: 5,
    includePriorityTable: true,
    includeMissingFields: true,
    language: 'id',
    ...(body.options ?? {}),
  }

  if (!hasPayload(rawPayload)) {
    return NextResponse.json(
      {
        error: 'Payload report belum tersedia. Endpoint ini hanya membaca hasil query report, bukan menjalankan SQL baru.',
      },
      { status: 400 },
    )
  }

  const payload = compactReportPayloadForAi(rawPayload, { sampleRows: 50, maxColumns: 40 })
  const analysisPayload = buildReportAnalysisPayload({
    reportCode,
    payload,
    filters: body.filters ?? {},
  })
  const fallback = generateLocalDashboardDefinition(analysisPayload, options)

  if (!ADACODE_API_KEY) {
    return NextResponse.json(sanitizeDashboardDefinition(fallback, analysisPayload, options, undefined, payload.rows))
  }

  const schemaInstruction = `
Output wajib JSON valid tanpa markdown, tanpa komentar, tanpa field tambahan.
Schema:
{
  "detectedReportType": "string",
  "dashboardTitle": "string",
  "summary": {
    "mainFinding": "string",
    "businessRisk": "string",
    "recommendedFocus": "string"
  },
  "kpiCards": [
    {
      "id": "string",
      "title": "string",
      "valuePath": "summary.existingFieldOnly",
      "format": "number | currency | percentage | text",
      "suffix": "string optional",
      "severity": "neutral | info | warning | critical",
      "description": "string"
    }
  ],
  "charts": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "type": "bar | column | donut | line | area | stacked_bar | heatmap | scatter | table",
      "priority": 1,
      "dataSource": "groupings.byField | sampleRows | chart | rows | summary",
      "xField": "field optional",
      "yField": "field optional",
      "categoryField": "field optional",
      "valueField": "field optional",
      "seriesField": "field optional",
      "aggregation": "count | sum | avg | min | max",
      "format": "number | currency | percentage optional",
      "sort": { "field": "existingFieldOnly", "direction": "asc | desc" },
      "limit": 20,
      "config": {
        "orientation": "horizontal | vertical",
        "height": "compact | normal | tall",
        "colorMode": "single | category | severity | gradient",
        "colorPalette": ["#167A3A", "#2563EB"],
        "showLegend": true,
        "showValueLabels": true,
        "showGrid": true,
        "xAxisLabel": "string optional",
        "yAxisLabel": "string optional",
        "emptyStateMessage": "string optional",
        "threshold": {
          "field": "existingFieldOnly",
          "operator": "> | >= | < | <= | = | !=",
          "value": 0,
          "label": "string",
          "color": "#DC2626"
        },
        "interaction": {
          "clickFilter": true,
          "highlightOnInsight": true,
          "exportEnabled": true
        }
      },
      "reason": "string",
      "insightRule": "string"
    }
  ],
  "insights": [
    {
      "id": "string",
      "severity": "info | warning | critical",
      "title": "string",
      "finding": "string",
      "evidence": { "source": "string", "field": "string", "value": "string or number", "metric": "string optional" },
      "businessImpact": "string",
      "recommendedAction": "string",
      "relatedChartId": "string optional"
    }
  ],
  "priorityTables": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "dataSource": "rows | sampleRows | other",
      "columns": ["existingFieldOnly"],
      "filters": [{ "field": "existingFieldOnly", "operator": "= | != | > | >= | < | <= | contains | in", "value": "string or number" }],
      "sort": [{ "field": "existingFieldOnly", "direction": "asc | desc" }],
      "limit": 20
    }
  ],
  "recommendedActions": [
    { "priority": "P1 | P2 | P3", "action": "string", "ownerSuggestion": "string", "reason": "string" }
  ],
  "missingFields": [
    { "field": "string", "reason": "string", "benefit": "string" }
  ]
}`.trim()

  const analysisPlaybook = `
Deep analysis playbook:
1. Jangan hanya menjawab KPI. Baca pola dari field payload dan buat insight yang berbeda sudut pandang.
2. Jika ada field nama barang seperti NamaBarang, ItemName, Description, NamaFuel:
   - cari pola kata/kelompok barang yang dominan dari nama barang;
   - contoh: bearing, filter, oil, seal, rubber, coupling, tyre, hose, belt, bolt, pump, valve;
   - jelaskan kelompok nama barang mana yang paling sering muncul atau paling besar nilainya;
   - buat chart Pareto/ranking dari nama barang atau kata dominan jika field tersedia.
3. Jika ada gudang/lokasi:
   - cari sebaran per lokasi;
   - cari hotspot lokasi yang paling banyak item risk/aging atau nilai inventory;
   - gunakan heatmap kalau bisa dipasangkan dengan RiskLevel/AgingBucket.
4. Jika ada Amount/Nilai/Cost:
   - cari konsentrasi nilai, Pareto, outlier amount, dan dampak finansial;
   - insight harus menjelaskan kenapa nilai itu penting untuk prioritas.
5. Jika ada Qty/Stok:
   - bedakan item banyak secara volume dan item besar secara nilai;
   - jangan menganggap qty besar selalu paling kritikal jika amount kecil.
6. Jika ada UmurBulan/AgingBucket/LastMovementDate/LastUpdateDate:
   - cari aging distribution, dead stock, slow moving, outlier umur;
   - kombinasikan umur tinggi + nilai tinggi untuk prioritas.
7. Jika ada RiskLevel/QualityFlag/IssueSummary:
   - cari komposisi risiko dan quality issue paling dominan;
   - jelaskan dampaknya pada closing, audit, atau keputusan operasional.
8. Buat insight minimal 4 jika data cukup, dan setiap insight harus berbeda angle:
   - item/name pattern;
   - lokasi/gudang;
   - aging/risk;
   - amount/financial exposure;
   - outlier/priority item;
   - data quality.
9. Jangan membuat insight generik seperti "data perlu dianalisis". Sebut field, source, value, metric, dan action yang konkret.
10. Jangan memakai pertanyaan template. Anggap kamu sedang membuat report baru hasil analisis data query aktif.`.trim()

  const systemPrompt = [
    'Kamu adalah AI data analyst untuk dashboard report perusahaan.',
    'Baca payload report, profil field, summary, groupings, dan sampleRows.',
    'Tentukan KPI, chart, insight, priority table, recommended action, dan missingFields secara adaptif berdasarkan field yang tersedia.',
    'Boleh usulkan chart baru yang belum ada di report lama selama semua field-nya tersedia dalam payload. Chart baru ini adalah report hasil analisis AI.',
    'Utamakan gaya data science/data analyst: distribusi, ranking/Pareto, scatter dua metric, heatmap dua dimensi kategori, trend jika ada tanggal/periode, dan tabel outlier/prioritas.',
    'Untuk report aging atau inventory health, cari pola dominan, konsentrasi nilai, outlier umur tinggi + amount tinggi, lokasi berisiko, dan quality issue.',
    analysisPlaybook,
    'Jangan mengisi chart.data dan jangan menghitung angka sendiri; backend akan menghitung dataset chart dari rows payload agar angka tidak dikarang.',
    'Untuk setiap chart, generate config visual yang situasional berdasarkan payload: orientasi, tinggi chart, palette, legend, value label, grid, axis label, threshold, dan interaction.',
    'Config chart harus menjelaskan cara frontend merender chart; jangan hardcode semua report memakai config yang sama.',
    'Jangan gunakan pertanyaan tetap dan jangan membuat analisa template.',
    'Jangan mengarang angka, field, source, atau chart. Semua valuePath dan field chart wajib ada di payload yang diberikan.',
    'AI hanya membuat dashboard definition JSON. Jangan membuat SQL, query write, instruksi edit data, sync manual, insert, update, atau delete.',
    'Insight harus punya finding, evidence, businessImpact, dan recommendedAction.',
    'Jika data kurang, isi missingFields, bukan mengarang insight.',
    'Gunakan Bahasa Indonesia.',
    schemaInstruction,
  ].join(' ')

  const userPrompt = [
    `Report payload compact: ${compactJson(analysisPayload)}`,
    `Fallback local yang sudah valid dan bisa dipakai jika ragu: ${compactJson(fallback)}`,
    `Provider display: ${DISPLAY_PROVIDER}; engine: ${PROVIDER_ENGINE}; model: ${ADACODE_MODEL}.`,
  ].join('\n\n')

  try {
    const first = await callAdaCode([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    if (!first.content) {
      return NextResponse.json(sanitizeDashboardDefinition(fallback, analysisPayload, options, undefined, payload.rows))
    }

    try {
      const parsed = parseDashboardJson(first.content)
      return NextResponse.json(sanitizeDashboardDefinition(parsed, analysisPayload, options, fallback, payload.rows))
    } catch (parseError) {
      const repair = await callAdaCode(
        [
          { role: 'system', content: `Perbaiki output menjadi JSON valid saja. ${schemaInstruction}` },
          {
            role: 'user',
            content: [
              `Output sebelumnya error: ${parseError instanceof Error ? parseError.message : 'JSON invalid'}`,
              `Output sebelumnya: ${first.content.slice(0, 8000)}`,
              `Field dan dataSource valid: ${compactJson({
                fields: analysisPayload.fields,
                summaryFields: Object.keys(analysisPayload.summary),
                groupings: Object.fromEntries(Object.entries(analysisPayload.groupings).map(([key, rows]) => [key, Object.keys(rows[0] ?? {})])),
                chartFields: Object.keys(analysisPayload.chart[0] ?? {}),
              })}`,
              `Fallback valid: ${compactJson(fallback)}`,
            ].join('\n\n'),
          },
        ],
        5200,
      )

      if (!repair.content) {
        return NextResponse.json(sanitizeDashboardDefinition(fallback, analysisPayload, options, undefined, payload.rows))
      }

      const repaired = parseDashboardJson(repair.content)
      return NextResponse.json(sanitizeDashboardDefinition(repaired, analysisPayload, options, fallback, payload.rows))
    }
  } catch {
    return NextResponse.json(sanitizeDashboardDefinition(fallback, analysisPayload, options, undefined, payload.rows))
  }
}
