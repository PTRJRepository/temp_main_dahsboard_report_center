import { NextRequest, NextResponse } from 'next/server'
import { getInventoryReport } from '@modules/report-center/lib/reports/inventory/config'
import {
  normalizeReportFilters,
  parseNaturalFilterLocally,
  validateNaturalLanguageReadOnly,
  type ReportColumnFilter,
  type ReportFilterInput,
} from '@modules/report-center/lib/reports/report-filtering'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DISPLAY_PROVIDER = 'local-llm'
const PROVIDER_ENGINE = '9router'
const ADACODE_URL = process.env.ADACODE_BASE_URL ?? process.env.LOCAL_LLM_BASE_URL ?? 'http://localhost:20128/v1/chat/completions'
const rawAdaCodeModel = (process.env.ADACODE_MODEL ?? process.env.LOCAL_LLM_MODEL ?? '').trim()
const ADACODE_MODEL =
  ['minimax m2.5', 'minimax/minimax-m2.5', 'minimax-m2.5'].includes(rawAdaCodeModel.toLowerCase())
    ? 'minimax-m2.5'
    : rawAdaCodeModel || 'minimax-m2.5'
const ADACODE_API_KEY = process.env.ADACODE_API_KEY ?? process.env.LOCAL_LLM_API_KEY

type NaturalFilterBody = {
  query?: string
  reportId?: string
  columns?: string[]
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
    if (typeof item === 'string' && item.length > 140) return `${item.slice(0, 140)}...`
    return item
  })
}

function extractJsonObject(content: string) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  const json = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
  return JSON.parse(json) as Record<string, unknown>
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
      .filter((item): item is string => Boolean(item))
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
  if (finishReason === 'length') {
    return 'AdaCode mengembalikan output kosong karena batas max_tokens habis sebelum JSON selesai.'
  }
  return result.error?.message ?? `AdaCode API HTTP ${status}${finishReason ? ` (${finishReason})` : ''}`
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function normalizeColumnToken(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function hasColumn(columns: string[], field: string) {
  const target = normalizeColumnToken(field)
  return columns.some((column) => normalizeColumnToken(column) === target)
}

function columnOperator(value: unknown): ReportColumnFilter['operator'] | undefined {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === '>' || normalized === 'gt' || normalized === 'greater_than' || normalized === 'greaterthan') return 'gt'
  if (normalized === '>=' || normalized === 'gte' || normalized === 'min' || normalized === 'minimal') return 'gte'
  if (normalized === '<' || normalized === 'lt' || normalized === 'less_than' || normalized === 'lessthan') return 'lt'
  if (normalized === '<=' || normalized === 'lte' || normalized === 'max' || normalized === 'maksimal') return 'lte'
  if (normalized === '=' || normalized === '==' || normalized === 'eq' || normalized === 'equals' || normalized === 'equal') return 'equals'
  if (normalized === '!=' || normalized === '<>' || normalized === 'neq' || normalized === 'not_equals' || normalized === 'notequals') return 'notEquals'
  if (normalized === 'contains' || normalized === 'contain' || normalized === 'like' || normalized === 'includes') return 'contains'
  if (normalized === 'between' || normalized === 'range') return 'between'
  if (normalized === 'blank' || normalized === 'empty' || normalized === 'null') return 'blank'
  if (normalized === 'notblank' || normalized === 'not_blank' || normalized === 'not null' || normalized === 'notnull') return 'notBlank'
  return undefined
}

function staleValue(value: unknown) {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return undefined
  if (/dead\s*stock|2\s*tahun|24\s*bulan/.test(text)) return 'dead-stock'
  if (/perlu\s+dipantau|watch|3\s*-\s*6|3\s*(?:bulan|month)\s*(?:sampai|hingga|to|-)\s*6/.test(text)) return 'watch'
  if (/slow\s*moving|6\s*bulan|6\s*-\s*12/.test(text)) return 'slow-moving'
  if (/aktif|active|3\s*bulan/.test(text)) return 'active'
  if (/kurang|bawah|under|below/.test(text)) return 'kurang-1-tahun'
  if (/semua|all/.test(text)) return 'semua'
  if (/lebih|atas|stale|1\s*tahun|12\s*bulan|setahun/.test(text)) return 'lebih-1-tahun'
  return undefined
}

function staleFromText(text: string) {
  const normalized = text.toLowerCase()
  if (!/\b(stale|dead\s*stock|update|tidak\s+update|belum\s+update|tidak\s+bergerak|slow\s+moving|perlu\s+dipantau|watch|umur|berumur|aging|age)\b/i.test(normalized)) return undefined
  if (/\b(dead\s*stock|2\s*(?:tahun|year)|24\s*(?:bulan|month)|lebih\s+dari\s+2\s*(?:tahun|year))\b/i.test(normalized)) return 'dead-stock'
  if (/\b(perlu\s+dipantau|watch|3\s*-\s*6\s*(?:bulan|month)|3\s*(?:bulan|month)\s*(?:sampai|hingga|to|-)\s*6\s*(?:bulan|month))\b/i.test(normalized)) return 'watch'
  if (/\b(slow\s*moving|6\s*(?:bulan|month)|6\s*-\s*12\s*(?:bulan|month))\b/i.test(normalized)) return 'slow-moving'
  if (/\b(aktif|active|3\s*(?:bulan|month))\b/i.test(normalized)) return 'active'
  if (/\b(kurang|bawah|di\s+bawah|under|below)\s+(?:dari\s+)?1\s*(?:tahun|year)\b/i.test(normalized)) return 'kurang-1-tahun'
  if (/\b(semua|all)\b/i.test(normalized)) return 'semua'
  if (/\b(1\s*(?:tahun|year)|12\s*(?:bulan|month)|setahun|lebih\s+dari\s+1\s*(?:tahun|year)|di\s+atas\s+1\s*(?:tahun|year)|ke\s+atas)\b/i.test(normalized)) return 'lebih-1-tahun'
  return undefined
}

function stockQualityScopeFromText(text: string) {
  const normalized = text.toLowerCase()
  if (
    /\b(?:stok|stock)\s+(?:nol|0|ada|tersedia|negatif|minus)\b/i.test(normalized) ||
    /\b(?:ada|punya|memiliki)\s+(?:stok|stock)\b/i.test(normalized) ||
    /\b(?:tanpa|tidak\s+punya|belum\s+ada)\s+kategori\b/i.test(normalized) ||
    /\bkategori\s+(?:kosong|blank|null)\b/i.test(normalized) ||
    /\b(?:tanpa|tidak\s+punya|belum\s+ada)\s+issue\s+valid\b/i.test(normalized) ||
    /\bissue\s+(?:tidak\s+valid|kosong|blank|null)\b/i.test(normalized) ||
    /\bnilai\s+stok\s+(?:terbesar|tertinggi|tinggi|paling\s+besar|paling\s+tinggi|di\s+atas|lebih\s+dari|>=|>|minimal|min)\b/i.test(normalized) ||
    /\b(?:top|ranking|peringkat)\s*\d*[\w\s-]*\b(?:berdasarkan|by)\s+nilai\s+stok\b/i.test(normalized)
  ) {
    return 'semua'
  }
  return undefined
}

function valueForOperator(entry: Record<string, unknown>, operator: string) {
  if (entry.value !== undefined) return entry.value
  if (operator === 'gt') return entry.gt ?? entry.greaterThan
  if (operator === 'gte') return entry.gte ?? entry.min ?? entry.minimum
  if (operator === 'lt') return entry.lt ?? entry.lessThan
  if (operator === 'lte') return entry.lte ?? entry.max ?? entry.maximum
  if (operator === 'equals') return entry.eq ?? entry.equals
  if (operator === 'notEquals') return entry.neq ?? entry.notEquals
  return undefined
}

function filterValue(value: unknown): string | number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return undefined
    const numeric = Number(text.replace(',', '.'))
    return Number.isFinite(numeric) && /^-?\d+(?:[.,]\d+)?$/.test(text) ? numeric : text
  }
  return undefined
}

function coerceColumnFilters(value: unknown, columns: string[] = []): ReportColumnFilter[] | undefined {
  let source = value
  if (typeof source === 'string' && source.trim()) {
    try {
      source = JSON.parse(source) as unknown
    } catch {
      return undefined
    }
  }

  if (Array.isArray(source)) {
    const filters = source
      .map((item): ReportColumnFilter | null => {
        if (!item || typeof item !== 'object') return null
        const entry = item as Record<string, unknown>
        const operator = columnOperator(entry.operator ?? entry.op)
        const field = stringValue(entry.field)
        if (!field || !operator) return null
        const normalizedField = normalizeColumnToken(field)
        if ((normalizedField === 'umurbulan' || normalizedField === 'umurstock' || normalizedField === 'umurstok') && hasColumn(columns, 'HariTidakUpdate')) {
          return {
            field: 'HariTidakUpdate',
            operator: operator === 'gt' ? 'gte' : operator,
            value: 365,
            valueTo: undefined,
          }
        }
        return {
          field,
          operator,
          value: filterValue(valueForOperator(entry, operator) ?? entry.value),
          valueTo: filterValue(entry.valueTo ?? entry.to ?? entry.end),
        }
      })
      .filter((item): item is ReportColumnFilter => Boolean(item))
    return filters.length ? filters : undefined
  }

  if (source && typeof source === 'object') {
    const filters = Object.entries(source as Record<string, unknown>)
      .map(([field, raw]): ReportColumnFilter | null => {
        if (raw && typeof raw === 'object') {
          const entry = raw as Record<string, unknown>
          const operator =
            columnOperator(entry.operator ?? entry.op) ??
            columnOperator(Object.keys(entry).find((key) => columnOperator(key))) ??
            'equals'
          const normalizedField = normalizeColumnToken(stringValue(entry.field) ?? field)
          if ((normalizedField === 'umurbulan' || normalizedField === 'umurstock' || normalizedField === 'umurstok') && hasColumn(columns, 'HariTidakUpdate')) {
            return {
              field: 'HariTidakUpdate',
              operator: 'gte',
              value: 365,
              valueTo: undefined,
            }
          }
          return {
            field: stringValue(entry.field) ?? field,
            operator,
            value: filterValue(valueForOperator(entry, operator) ?? entry.value),
            valueTo: filterValue(entry.valueTo ?? entry.to ?? entry.end),
          }
        }
        return {
          field,
          operator: 'equals',
          value: filterValue(raw),
        }
      })
      .filter((item): item is ReportColumnFilter => Boolean(item && item.field && item.operator))
    return filters.length ? filters : undefined
  }

  return undefined
}

function removeVirtualAgeFilters(filters: ReturnType<typeof coerceColumnFilters>, columns: string[] = []) {
  if (!filters?.length) return undefined
  const cleaned = filters.filter((filter) => {
    const field = normalizeColumnToken(String(filter.field))
    if (field === 'umurbulan' || field === 'umurstock' || field === 'umurstok') return false
    if (field === 'haritidakupdate' && !hasColumn(columns, 'HariTidakUpdate')) return false
    return true
  })
  return cleaned.length ? cleaned : undefined
}

function hasExecutableFilters(filters: ReportFilterInput) {
  return Object.entries(filters).some(([key, value]) => {
    if (key === 'naturalQuery') return false
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && value !== ''
  })
}

function noExecutableFilterError(llmIssue?: string) {
  const prefix = llmIssue
    ? `AdaCode tidak tersedia (${llmIssue}) dan `
    : !ADACODE_API_KEY
      ? 'ADACODE_API_KEY/LOCAL_LLM_API_KEY belum dikonfigurasi dan '
      : ''

  return `${prefix}parser lokal belum menemukan filter yang bisa diterapkan. Pakai nama kolom/operator eksplisit seperti "Gudang = ARA", "Amount > 1000", atau "tanggal 1 sampai 15 Mei 2026".`
}

function coerceLlmFilters(value: Record<string, unknown>, naturalQuery: string, columns: string[] = []): ReportFilterInput {
  const source = typeof value.filters === 'object' && value.filters !== null
    ? (value.filters as Record<string, unknown>)
    : value
  const columnFilters = coerceColumnFilters(source.columnFilters, columns)
  const stale =
    staleValue(source.stale ?? source.updateAgeScope ?? source.ageScope) ??
    staleFromText(naturalQuery) ??
    (columnFilters?.some((filter) => {
      const field = normalizeColumnToken(String(filter.field))
      return field === 'haritidakupdate' || field === 'umurbulan' || field === 'umurstock' || field === 'umurstok'
    })
      ? 'lebih-1-tahun'
      : undefined) ??
    stockQualityScopeFromText(naturalQuery)

  return normalizeReportFilters({
    search: stringValue(source.search),
    period: stringValue(source.period),
    accYear: numberValue(source.accYear),
    accMonth: numberValue(source.accMonth),
    actualYear: numberValue(source.actualYear),
    actualMonth: numberValue(source.actualMonth),
    dateFrom: stringValue(source.dateFrom),
    dateTo: stringValue(source.dateTo),
    location: stringValue(source.location),
    category: stringValue(source.category),
    supplier: stringValue(source.supplier),
    status: stringValue(source.status),
    vehicle: stringValue(source.vehicle),
    itemType: stringValue(source.itemType),
    movementCategory: stringValue(source.movementCategory),
    movementWindow: stringValue(source.movementWindow),
    movementFastMin: numberValue(source.movementFastMin),
    movementMovingMin: numberValue(source.movementMovingMin),
    movementMovingMax: numberValue(source.movementMovingMax),
    movementSlowCount: numberValue(source.movementSlowCount),
    stockAnalysis: stringValue(source.stockAnalysis),
    blankField: stringValue(source.blankField),
    minQty: numberValue(source.minQty),
    minAmount: numberValue(source.minAmount),
    sortMetric: stringValue(source.sortMetric) as ReportFilterInput['sortMetric'],
    sortColumn: stringValue(source.sortColumn),
    sortDirection: stringValue(source.sortDirection) as ReportFilterInput['sortDirection'],
    chartDimension: stringValue(source.chartDimension),
    groupBy: stringValue(source.groupBy),
    aggregateField: stringValue(source.aggregateField),
    aggregateFn: stringValue(source.aggregateFn) as ReportFilterInput['aggregateFn'],
    top: numberValue(source.top),
    resultLimit: numberValue(source.resultLimit),
    rowStart: numberValue(source.rowStart),
    rowEnd: numberValue(source.rowEnd),
    stale,
    analysis: stringValue(source.analysis) as ReportFilterInput['analysis'],
    columnFilters: removeVirtualAgeFilters(columnFilters, columns),
    naturalQuery,
  })
}

function filterExplanation(filters: ReportFilterInput, parsed: Record<string, unknown>) {
  if (filters.stale === 'lebih-1-tahun') {
    return 'Filter diterapkan sebagai scope item tidak update lebih dari 1 tahun (stale=lebih-1-tahun), menggunakan aturan UpdateDate report.'
  }
  if (filters.stale === 'kurang-1-tahun') {
    return 'Filter diterapkan sebagai scope item update kurang dari 1 tahun (stale=kurang-1-tahun), menggunakan aturan UpdateDate report.'
  }
  return stringValue(parsed.explanation) ?? 'Filter dibuat oleh AdaCode dalam mode read-only.'
}

async function parseWithLlm(query: string, body: NaturalFilterBody) {
  if (!ADACODE_API_KEY) return null

  const report = body.reportId ? getInventoryReport(body.reportId) : undefined
  const systemPrompt = [
    'Kamu adalah parser filter read-only untuk PT Rebinmas Jaya Report Center.',
    'Tugasmu hanya mengubah bahasa natural user menjadi JSON filter. Jangan buat SQL.',
    'Jangan mengusulkan INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, MERGE, EXEC, schema change, permission change, atau stored procedure.',
    'Jika user meminta aksi non-read, balas JSON dengan safe false dan reason singkat.',
    'Balas hanya JSON valid dengan key safe, filters, explanation.',
    'filters hanya boleh punya key search, period, accYear, accMonth, actualYear, actualMonth, dateFrom, dateTo, location, category, supplier, status, vehicle, itemType, movementCategory, movementWindow, movementFastMin, movementMovingMin, movementMovingMax, movementSlowCount, stockAnalysis, blankField, minQty, minAmount, sortMetric, sortColumn, sortDirection, chartDimension, groupBy, aggregateField, aggregateFn, top, resultLimit, rowStart, rowEnd, stale, analysis, columnFilters.',
    'Untuk period aktual, isi period sebagai YYYY-MM atau actualYear dan actualMonth. Untuk accounting period, isi accYear dan accMonth.',
    'Untuk umur stock/stok 1 tahun, stale item, tidak update 1 tahun, atau tidak bergerak 1 tahun, isi stale dengan "lebih-1-tahun". Jangan pakai field UmurBulan kecuali kolom itu diberikan.',
    'Untuk stok nol, stok ada, stok negatif, tanpa kategori, tanpa issue valid, atau nilai stok tinggi tanpa scope aging, isi stale dengan "semua" supaya seluruh item ikut dicari.',
    'columnFilters adalah array objek { field, operator, value, valueTo }. field harus sama dengan salah satu kolom yang diberikan. operator hanya contains, equals, notEquals, gt, gte, lt, lte, between, blank, notBlank.',
    'Untuk command seperti group by/per/bandingkan, isi groupBy dengan nama kolom. Untuk sum/total/avg/min/max, isi aggregateField dan aggregateFn.',
    'sortMetric hanya amount, qty, date, atau rows. sortDirection hanya asc atau desc.',
    'analysis hanya ranking, compare, anomaly, quality, atau trend.',
  ].join(' ')

  const userPrompt = compactJson({
    query,
    report: report
      ? {
          id: report.id,
          title: report.title,
          description: report.description,
          sourceTables: report.sourceTables,
          charts: report.chartDefinitions.map((chart) => chart.title),
        }
      : { id: body.reportId },
    columns: body.columns?.slice(0, 30),
  })

  const response = await fetch(ADACODE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADACODE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ADACODE_MODEL,
      temperature: 0,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    cache: 'no-store',
  })

  const result = (await response.json().catch(() => ({}))) as AdaCodeResponse
  const content = extractAdaCodeContent(result)

  if (!response.ok || !content) {
    throw new Error(adaCodeErrorMessage(result, response.status))
  }

  const parsed = extractJsonObject(content)
  if (parsed.safe === false) {
    return {
      safe: false,
      filters: normalizeReportFilters({ naturalQuery: query }),
      explanation: stringValue(parsed.reason) ?? stringValue(parsed.explanation) ?? 'Permintaan non-read diblokir.',
    }
  }

  const filters = coerceLlmFilters(parsed, query, body.columns ?? [])

  return {
    safe: true,
    filters,
    explanation: filterExplanation(filters, parsed),
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as NaturalFilterBody
  const query = body.query?.trim() ?? ''

  if (!query) {
    return NextResponse.json({ success: false, error: 'Natural filter kosong.' }, { status: 400 })
  }

  const safety = validateNaturalLanguageReadOnly(query)
  if (!safety.safe) {
    return NextResponse.json(
      {
        success: false,
        error: safety.reason ?? 'Permintaan non-read diblokir.',
        safety,
      },
      { status: 400 },
    )
  }

  const fallback = parseNaturalFilterLocally(query, new Date(), body.columns ?? [])

  try {
    const llm = await parseWithLlm(query, body)
    if (llm) {
      if (!llm.safe) {
        return NextResponse.json(
          {
            success: false,
            error: llm.explanation,
            safety: { safe: false, reason: llm.explanation },
          },
          { status: 400 },
        )
      }

      if (!hasExecutableFilters(llm.filters)) {
        if (hasExecutableFilters(fallback.filters)) {
          return NextResponse.json({
            success: true,
            provider: 'local-rule',
            providerEngine: PROVIDER_ENGINE,
            model: 'fallback-parser',
            filters: fallback.filters,
            explanation: fallback.explanation,
            warning: 'AdaCode tidak menghasilkan filter yang bisa diterapkan. Parser lokal dipakai.',
            safety: fallback.safety,
          })
        }

        return NextResponse.json(
          {
            success: false,
            provider: DISPLAY_PROVIDER,
            providerEngine: PROVIDER_ENGINE,
            model: ADACODE_MODEL,
            error: 'Natural filter tidak menghasilkan filter yang bisa diterapkan.',
            filters: llm.filters,
            explanation: llm.explanation,
            safety: { safe: true, mode: 'filter-json-only' },
          },
          { status: 422 },
        )
      }

      console.info('[report-natural-filter]', {
        reportId: body.reportId,
        provider: PROVIDER_ENGINE,
        displayProvider: DISPLAY_PROVIDER,
        safe: true,
        filters: llm.filters,
      })

      return NextResponse.json({
        success: true,
        provider: DISPLAY_PROVIDER,
        providerEngine: PROVIDER_ENGINE,
        model: ADACODE_MODEL,
        filters: llm.filters,
        explanation: llm.explanation,
        safety: { safe: true, mode: 'filter-json-only' },
      })
    }
  } catch (error) {
    const fallbackReason = error instanceof Error ? error.message : 'unknown error'

    console.info('[report-natural-filter]', {
      reportId: body.reportId,
      provider: 'local-rule',
      safe: true,
      fallbackReason,
      filters: fallback.filters,
    })

    if (!hasExecutableFilters(fallback.filters)) {
      return NextResponse.json(
        {
          success: false,
          provider: 'local-rule',
          providerEngine: PROVIDER_ENGINE,
          model: 'fallback-parser',
          error: noExecutableFilterError(fallbackReason),
          filters: fallback.filters,
          explanation: fallback.explanation,
          safety: fallback.safety,
        },
        { status: 422 },
      )
    }

    return NextResponse.json({
      success: true,
      provider: 'local-rule',
      providerEngine: PROVIDER_ENGINE,
      model: 'fallback-parser',
      filters: fallback.filters,
      explanation: fallback.explanation,
      warning: `AdaCode tidak tersedia: ${fallbackReason}. Parser lokal dipakai.`,
      safety: fallback.safety,
    })
  }

  if (!hasExecutableFilters(fallback.filters)) {
    return NextResponse.json(
      {
        success: false,
        provider: 'local-rule',
        providerEngine: PROVIDER_ENGINE,
        model: 'fallback-parser',
        error: noExecutableFilterError(),
        filters: fallback.filters,
        explanation: fallback.explanation,
        safety: fallback.safety,
      },
      { status: 422 },
    )
  }

  console.info('[report-natural-filter]', {
    reportId: body.reportId,
    provider: 'local-rule',
    providerEngine: PROVIDER_ENGINE,
    safe: true,
    filters: fallback.filters,
  })

  return NextResponse.json({
    success: true,
    provider: 'local-rule',
    providerEngine: PROVIDER_ENGINE,
    model: 'fallback-parser',
    filters: fallback.filters,
    explanation: fallback.explanation,
    warning: !ADACODE_API_KEY ? 'ADACODE_API_KEY/LOCAL_LLM_API_KEY belum dikonfigurasi. Parser lokal dipakai.' : undefined,
    safety: fallback.safety,
  })
}
