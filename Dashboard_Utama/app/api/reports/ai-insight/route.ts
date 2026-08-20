import { NextRequest, NextResponse } from 'next/server'
import { buildAiEvidenceBundle, formatAiEvidenceForPrompt } from '@/modules/report-center/lib/reports/ai-evidence'
import { callAnthropicMessages, getAnthropicProviderConfig } from '@/modules/report-center/lib/reports/ai-provider'
import type { InsightContent } from '@/modules/report-center/lib/reports/intelligence'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DISPLAY_PROVIDER = 'anthropic'
const PROVIDER_ENGINE = 'anthropic-messages'

type InsightRequestContext = {
  moduleId?: string
  moduleName?: string
  reportName?: string
  reportDescription?: string
  dataSource?: string
  analysisQuestion?: string
  analysisQuestions?: string[]
  summary?: Record<string, unknown>
  metadata?: Record<string, unknown>
  sampleRows?: Array<Record<string, unknown>>
  chart?: Array<Record<string, unknown>>
  alerts?: string[]
}

type InsightRequestBody = {
  title?: string
  context?: InsightRequestContext
  fallbackInsight?: Partial<InsightContent>
}

const emptyInsight: InsightContent = {
  summary: 'Insight belum tersedia karena payload belum cukup untuk dibaca.',
  trendDetection: 'Belum ada pembanding nilai terbesar dari payload.',
  anomalyDetection: 'Belum ada risiko atau outlier yang dapat dibaca dari payload.',
  recommendation: 'Gunakan preview dan metadata report sebelum export.',
  dataQualityNote: 'Kualitas data mengikuti sumber database aktif.',
}

function compactJson(value: unknown) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === 'string' && item.length > 180) return `${item.slice(0, 180)}...`
    return item
  })
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatMetric(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}M`
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}K`
  return value.toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

function labelValue(row: Record<string, unknown>) {
  const labelKeys = [
    'Label',
    'NamaBarang',
    'NamaFuel',
    'KodeBarang',
    'KodeFuel',
    'SupplierName',
    'SupplierCode',
    'Gudang',
    'Lokasi',
    'Kendaraan',
    'NamaKendaraan',
    'QualityFlag',
    'JenisMutasi',
    'Dokumen',
  ]
  for (const key of labelKeys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  const firstText = Object.values(row).find((item) => typeof item === 'string' && item.trim())
  return firstText ? String(firstText).trim() : 'Data'
}

function isMetricKey(key: string) {
  return /(amount|nilai|harga|qty|stok|total|jumlah|count|baris|row|transaksi|item|po|gr|invoice|outstanding|receive|order|pemakaian|usage|biaya|cost|selisih|shortage|reorder|minimum|aggregate)/i.test(key)
}

function isIgnoredMetricKey(key: string) {
  return /(date|tanggal|time|update|periode|period|year|month|id$|code$|kode$|status)/i.test(key)
}

function topMetricFromRow(row: Record<string, unknown>) {
  return Object.entries(row)
    .map(([key, value]) => ({ key, value: toNumber(value) }))
    .filter((item) => item.value > 0 && isMetricKey(item.key) && !isIgnoredMetricKey(item.key))
    .sort((a, b) => b.value - a.value)[0]
}

function topRows(rows: Array<Record<string, unknown>> = [], limit = 8) {
  return rows
    .map((row) => {
      const metric = topMetricFromRow(row)
      if (!metric) return null
      return {
        label: labelValue(row),
        metric: metric.key,
        value: metric.value,
        displayValue: formatMetric(metric.value),
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

const QUESTION_DIMENSIONS = [
  {
    key: 'gudang/lokasi',
    pattern: /(gudang|warehouse|lokasi|bin|location)/i,
    labelKeys: ['Gudang', 'LocCode', 'Lokasi', 'Warehouse', 'Location', 'Bin'],
  },
  {
    key: 'item/barang',
    pattern: /(item|barang|material|fuel|bbm|solar|stok|stock)/i,
    labelKeys: ['NamaBarang', 'KodeBarang', 'ItemCode', 'ItemName', 'NamaFuel', 'KodeFuel', 'Description'],
  },
  {
    key: 'kategori',
    pattern: /(kategori|category|jenis|tipe)/i,
    labelKeys: ['Kategori', 'KodeKategori', 'ProdCatCode', 'Category', 'Tipe', 'JenisMutasi', 'QualityFlag'],
  },
  {
    key: 'supplier',
    pattern: /(supplier|vendor|pemasok)/i,
    labelKeys: ['SupplierName', 'SupplierCode', 'Supplier', 'VendorName', 'NamaSupplier'],
  },
  {
    key: 'dokumen',
    pattern: /(dokumen|document|po|grn|invoice|request|pr|receive|penerimaan|retur)/i,
    labelKeys: ['Dokumen', 'DocNo', 'PONo', 'NoPO', 'GRN', 'InvoiceNo', 'PRNo', 'ReferenceNo', 'DocumentNo'],
  },
  {
    key: 'kendaraan/unit',
    pattern: /(kendaraan|vehicle|unit|alat)/i,
    labelKeys: ['Kendaraan', 'NamaKendaraan', 'VehicleCode', 'VehicleNo', 'Unit', 'Equipment'],
  },
  {
    key: 'cost center/blok',
    pattern: /(cost center|costcenter|blok|block|divisi|division|estate)/i,
    labelKeys: ['CostCenter', 'CostCenterCode', 'Blok', 'Block', 'Divisi', 'Division', 'Estate'],
  },
] as const

function pickText(row: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return undefined
}

function questionDimension(question = '') {
  return QUESTION_DIMENSIONS.find((dimension) => dimension.pattern.test(question))
}

function metricRegexForQuestion(question = '') {
  if (/(nilai|aset|valuasi|amount|cost|biaya|harga|rp|rupiah)/i.test(question)) return /(nilai|amount|cost|value|harga|valuation|biaya)/i
  if (/(qty|quantity|jumlah|stok|stock|saldo|terima|diterima|pakai|pemakaian|order|pesanan)/i.test(question)) return /(qty|quantity|stok|stock|jumlah|receive|received|pemakaian|usage|order|saldo|total)/i
  if (/(selisih|gap|variance|beda|koreksi|adjustment)/i.test(question)) return /(selisih|gap|variance|beda|adjustment|koreksi|shortage|difference)/i
  if (/(outstanding|pending|belum|sisa|open)/i.test(question)) return /(outstanding|pending|sisa|open|remain|balance|qty|amount|nilai)/i
  if (/(risiko|risk|quality|flag|stale|nol|kosong|validasi|audit)/i.test(question)) return /(flag|quality|stale|nol|kosong|invalid|tanpa|minimum|reorder|selisih|outstanding|count|total)/i
  return undefined
}

function topMetricFromRowForQuestion(row: Record<string, unknown>, question = '') {
  const metricRegex = metricRegexForQuestion(question)
  const candidates = Object.entries(row)
    .map(([key, value]) => ({ key, value: toNumber(value) }))
    .filter((item) => item.value > 0 && isMetricKey(item.key) && !isIgnoredMetricKey(item.key))
  const focused = metricRegex ? candidates.filter((item) => metricRegex.test(item.key)) : candidates
  return (focused.length ? focused : candidates).sort((a, b) => b.value - a.value)[0]
}

function questionTopRows(context: InsightRequestContext, question = '', limit = 8) {
  const dimension = questionDimension(question)
  const rows = [...(context.chart ?? []), ...(context.sampleRows ?? [])]
  const grouped = new Map<string, { label: string; metric: string; value: number }>()

  rows.forEach((row) => {
    const metric = topMetricFromRowForQuestion(row, question)
    if (!metric) return
    const label = dimension ? pickText(row, dimension.labelKeys) ?? labelValue(row) : labelValue(row)
    const current = grouped.get(label)
    grouped.set(label, {
      label,
      metric: current?.metric ?? metric.key,
      value: (current?.value ?? 0) + metric.value,
    })
  })

  return [...grouped.values()]
    .map((item) => ({ ...item, displayValue: formatMetric(item.value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

function summaryMetrics(summary: Record<string, unknown> = {}) {
  return Object.entries(summary)
    .map(([key, value]) => ({ key, value: toNumber(value) }))
    .filter((item) => item.value > 0 && isMetricKey(item.key) && !/(date|tanggal|update|time)/i.test(item.key))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map((item) => ({ ...item, displayValue: formatMetric(item.value) }))
}

function qualitySignals(summary: Record<string, unknown> = {}, alerts: string[] = []) {
  const summarySignals = Object.entries(summary)
    .map(([key, value]) => ({ key, value: toNumber(value) }))
    .filter((item) => item.value > 0 && /(kosong|blank|null|flag|stale|nol|minimum|reorder|outstanding|selisih|invalid|tanpa|quality|error)/i.test(item.key))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map((item) => `${item.key}: ${formatMetric(item.value)}`)

  return [...summarySignals, ...alerts.slice(0, 4)]
}

function comparisonText(items: ReturnType<typeof topRows>) {
  const [first, second] = items
  if (!first) return undefined
  if (!second || second.value <= 0) return `${first.label} paling besar pada ${first.metric} (${first.displayValue}).`
  const gap = first.value - second.value
  const ratio = second.value > 0 ? first.value / second.value : 0
  return `${first.label} paling besar pada ${first.metric} (${first.displayValue}), di atas ${second.label} (${second.displayValue}) dengan selisih ${formatMetric(gap)}${ratio > 1 ? ` atau ${ratio.toLocaleString('id-ID', { maximumFractionDigits: 1 })}x` : ''}.`
}

function isStockAgingContext(context: InsightRequestContext) {
  const metadata = context.metadata ?? {}
  return Boolean(metadata.stockAgingReport) || /stock\s+aging|item\s+movement\s+health|umur\s+stok/i.test(`${context.reportName ?? ''} ${context.reportDescription ?? ''}`)
}

function summaryMetric(context: InsightRequestContext, key: string) {
  return toNumber(context.summary?.[key])
}

function topStockAgingWarehouse(chart: Array<Record<string, unknown>> = []) {
  return [...chart]
    .map((row) => ({
      gudang: String(row.Gudang ?? row.Label ?? '-'),
      nilai: toNumber(row.NilaiStale ?? row.TotalAmount ?? row.NilaiStok ?? row.Amount ?? row.Aggregate),
      item: toNumber(row.StaleLebih1Tahun ?? row.TotalItem ?? row.TotalRows),
    }))
    .filter((row) => row.nilai > 0 || row.item > 0)
    .sort((a, b) => b.nilai - a.nilai || b.item - a.item)[0]
}

function topStockAgingItem(rows: Array<Record<string, unknown>> = []) {
  const row = [...rows]
    .sort((a, b) => {
      const riskDelta = toNumber(b.RiskScore) - toNumber(a.RiskScore)
      if (riskDelta) return riskDelta
      return (toNumber(b.TotalAmount) || toNumber(b.NilaiStok)) - (toNumber(a.TotalAmount) || toNumber(a.NilaiStok))
    })[0]
  if (!row) return undefined
  return {
    label: labelValue(row),
    risk: String(row.RiskLevel ?? '-'),
    gudang: String(row.Gudang ?? '-'),
    umur: toNumber(row.UmurTahun) || toNumber(row.UmurBulan) / 12,
    nilai: toNumber(row.TotalAmount) || toNumber(row.NilaiStok),
    action: 'Review item Critical/High berdasarkan umur stok, gudang, dan total amount.',
  }
}

function buildStockAgingPayloadInsight(context: InsightRequestContext, hints: ReturnType<typeof buildPayloadHints>): InsightContent {
  const reportName = context.reportName ?? 'Stock Aging'
  const source = context.dataSource ?? hints.dataSource ?? 'sumber data aktif'
  const total = summaryMetric(context, 'TotalItem') || summaryMetric(context, 'FilteredRows') || (context.sampleRows?.length ?? 0)
  const stale = summaryMetric(context, 'StaleLebih12Bulan')
  const dead = summaryMetric(context, 'DeadStockLebih24Bulan')
  const riskyValue = summaryMetric(context, 'NilaiStokBerisiko')
  const zeroStock = summaryMetric(context, 'ItemStokNol')
  const noCategory = summaryMetric(context, 'ItemTanpaKategori')
  const noIssue = summaryMetric(context, 'ItemTanpaIssueValid')
  const topWarehouse = topStockAgingWarehouse(context.chart)
  const topItem = topStockAgingItem(context.sampleRows)

  return {
    summary: `${reportName}: ${formatMetric(stale || total)} item masuk area stale dalam payload${dead ? `, termasuk ${formatMetric(dead)} dead stock` : ''}${riskyValue ? ` dengan nilai stok berisiko ${formatMetric(riskyValue)}` : ''}.`,
    trendDetection: topWarehouse
      ? `Gudang ${topWarehouse.gudang} menjadi konsentrasi risiko terbesar: ${formatMetric(topWarehouse.nilai)} nilai stale dari ${formatMetric(topWarehouse.item)} item.`
      : hints.biggestComparison ?? 'Belum ada ranking gudang yang cukup kuat; gunakan distribusi aging dan top item sebagai pembanding utama.',
    anomalyDetection: topItem
      ? `Prioritas review: ${topItem.label} di gudang ${topItem.gudang}, risiko ${topItem.risk}, umur ${formatMetric(topItem.umur)} tahun, total amount ${formatMetric(topItem.nilai)}.`
      : 'Tidak ada item prioritas yang cukup jelas dari sample row payload.',
    recommendation: topItem
      ? `${topItem.action} Mulai dari item Critical/High bernilai stok terbesar, lalu validasi kebutuhan operasional, stock opname, disposal, atau write-off.`
      : 'Prioritaskan bucket Dead Stock bernilai stok terbesar, lalu lanjutkan ke issue master data.',
    dataQualityNote: `Data quality dari payload: stok nol ${formatMetric(zeroStock)}, tanpa kategori ${formatMetric(noCategory)}, tanpa issue valid ${formatMetric(noIssue)}. AI hanya membaca payload UI, bukan menjalankan SQL baru. Sumber: ${source}.`,
  }
}

function buildPayloadHints(context: InsightRequestContext) {
  const chartRank = topRows(context.chart, 8)
  const sampleRank = topRows(context.sampleRows, 8)
  const strongestRank = chartRank.length ? chartRank : sampleRank
  const question = context.analysisQuestion ?? ''
  const focusedRank = questionTopRows(context, question, 8)
  const dimension = questionDimension(question)

  return {
    reportName: context.reportName,
    dataSource: context.dataSource,
    analysisQuestion: context.analysisQuestion,
    analysisQuestions: context.analysisQuestions?.slice(0, 8),
    focusedDimension: dimension?.key,
    focusedRows: focusedRank.map((item) => ({
      label: item.label,
      metric: item.metric,
      value: item.displayValue,
      numericValue: item.value,
    })),
    summaryMetrics: summaryMetrics(context.summary),
    largestRows: strongestRank.map((item) => ({
      label: item.label,
      metric: item.metric,
      value: item.displayValue,
      numericValue: item.value,
    })),
    biggestComparison: comparisonText(strongestRank),
    qualitySignals: qualitySignals(context.summary, context.alerts),
    sampleRowCount: context.sampleRows?.length ?? 0,
    chartPointCount: context.chart?.length ?? 0,
  }
}

function buildPayloadInsight(context: InsightRequestContext, hints: ReturnType<typeof buildPayloadHints>): InsightContent {
  if (isStockAgingContext(context)) return buildStockAgingPayloadInsight(context, hints)

  const reportName = context.reportName ?? context.moduleName ?? 'Report ini'
  const question = context.analysisQuestion?.trim()
  const focusedRows = hints.focusedRows.length ? hints.focusedRows : hints.largestRows
  const topRow = focusedRows[0]
  const secondRow = focusedRows[1]
  const topSummary = hints.summaryMetrics[0]
  const qualitySignal = hints.qualitySignals[0]
  const source = context.dataSource ?? hints.dataSource ?? 'sumber data aktif'
  const focusLabel = hints.focusedDimension ? ` berdasarkan ${hints.focusedDimension}` : ''
  const riskQuestion = Boolean(question && /(risiko|risk|quality|flag|stale|nol|kosong|validasi|audit|outlier)/i.test(question))

  const mainFindingBase = riskQuestion && qualitySignal
    ? `Risiko paling jelas di ${reportName} adalah ${qualitySignal}.`
    : topRow
    ? `${topRow.label} adalah titik paling material${focusLabel} di ${reportName}: ${topRow.metric} sebesar ${topRow.value}.`
    : topSummary
      ? `${topSummary.key} adalah angka summary paling besar di ${reportName}: ${topSummary.displayValue}.`
      : `${reportName} sudah punya payload, tetapi tidak ada metrik numerik yang cukup kuat untuk ranking.`
  const mainFinding = question ? `Menjawab "${question}": ${mainFindingBase}` : mainFindingBase

  const focusedComparison = hints.focusedRows.length
    ? comparisonText(
        hints.focusedRows.map((item) => ({
          label: item.label,
          metric: item.metric,
          value: item.numericValue,
          displayValue: item.value,
        })),
      )
    : undefined
  const comparison = focusedComparison
    ? focusedComparison
    : hints.biggestComparison
    ? hints.biggestComparison
    : topRow && secondRow
      ? `${topRow.label} berada di atas ${secondRow.label} pada ${topRow.metric}.`
      : topRow
        ? `${topRow.label} menjadi fokus utama karena muncul sebagai nilai terbesar dalam payload.`
        : 'Payload belum punya pembanding ranking yang cukup jelas.'

  const risk = qualitySignal
    ? `Sinyal risiko terbesar dari payload: ${qualitySignal}. Ini perlu dicek sebelum data dipakai untuk keputusan atau export.`
    : topRow
      ? `Risiko utama ada pada konsentrasi nilai${focusLabel}: jika ${topRow.label} tidak valid, pembacaan ${reportName} akan ikut bias.`
      : 'Tidak ada quality signal eksplisit di payload; risiko utama adalah keterbatasan sample/chart yang tersedia.'

  const actionBase = qualitySignal
    ? `Mulai dari baris/kelompok terkait ${qualitySignal.split(':')[0]}, lalu cek item terbesar dan metadata sumber sebelum export.`
    : topRow
      ? `Cek detail ${topRow.label} terlebih dahulu, bandingkan dengan ranking berikutnya, lalu gunakan filter yang relevan dengan ${hints.focusedDimension ?? 'pertanyaan'} untuk mempersempit penyebab nilai besar tersebut.`
      : 'Buka tabel preview dan metadata untuk mencari kolom nominal/qty yang bisa dijadikan dasar ranking berikutnya.'
  const action = question ? `${actionBase} Prioritaskan jawaban untuk pertanyaan bisnis yang dipilih, bukan membuat query baru.` : actionBase

  return {
    summary: mainFinding,
    trendDetection: comparison,
    anomalyDetection: risk,
    recommendation: action,
    dataQualityNote: `Insight ini dihitung dari payload yang diterima UI, bukan query baru. ${question ? `Pertanyaan aktif: ${question}. ` : ''}Sumber: ${source}. Sample row: ${hints.sampleRowCount.toLocaleString('id-ID')}; chart point: ${hints.chartPointCount.toLocaleString('id-ID')}.`,
  }
}

function hasPayloadEvidence(insight: InsightContent, hints: ReturnType<typeof buildPayloadHints>) {
  const text = Object.values(insight).join(' ').toLowerCase()
  const hasNumber = /\d/.test(text)
  const hasLabel = hints.largestRows.some((item) => item.label && text.includes(item.label.toLowerCase()))
  const hasSummaryMetric = hints.summaryMetrics.some((item) => text.includes(item.key.toLowerCase()))
  const generic = /belum ada|tidak ada tren|gunakan preview|insight belum tersedia/i.test(text)
  return (hasNumber || hasLabel || hasSummaryMetric) && !generic
}

function clipSentence(value: string, fallback: string, max = 260) {
  const text = value.trim().replace(/\s+/g, ' ')
  if (!text) return fallback
  return text.length > max ? `${text.slice(0, max - 3).trim()}...` : text
}

function normalizeFinalInsight(insight: InsightContent, fallback: InsightContent): InsightContent {
  return {
    summary: clipSentence(insight.summary, fallback.summary),
    trendDetection: clipSentence(insight.trendDetection, fallback.trendDetection),
    anomalyDetection: clipSentence(insight.anomalyDetection, fallback.anomalyDetection),
    recommendation: clipSentence(insight.recommendation, fallback.recommendation),
    dataQualityNote: clipSentence(insight.dataQualityNote, fallback.dataQualityNote, 320),
  }
}

function normalizeInsight(value: Partial<InsightContent>, fallback?: Partial<InsightContent>): InsightContent {
  const alternate = value as Record<string, unknown>
  return {
    summary: String(
      value.summary ??
        alternate.insightUtama ??
        alternate.insight_utama ??
        alternate.mainInsight ??
        alternate.temuanUtama ??
        fallback?.summary ??
        emptyInsight.summary,
    ),
    trendDetection: String(
      value.trendDetection ??
        alternate.trend_detection ??
        alternate.terbesar ??
        alternate.largestFinding ??
        alternate.biggestComparison ??
        alternate.pembanding ??
        fallback?.trendDetection ??
        emptyInsight.trendDetection,
    ),
    anomalyDetection: String(
      value.anomalyDetection ??
        alternate.anomaly_detection ??
        alternate.risiko ??
        alternate.riskFinding ??
        alternate.outlier ??
        fallback?.anomalyDetection ??
        emptyInsight.anomalyDetection,
    ),
    recommendation: String(
      value.recommendation ?? alternate.aksi ?? alternate.action ?? alternate.nextAction ?? fallback?.recommendation ?? emptyInsight.recommendation,
    ),
    dataQualityNote: String(
      value.dataQualityNote ??
        alternate.data_quality_note ??
        alternate.catatanData ??
        alternate.dataNote ??
        fallback?.dataQualityNote ??
        emptyInsight.dataQualityNote,
    ),
  }
}

function parseInsight(content: string, fallback?: Partial<InsightContent>) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as Partial<InsightContent>
    return normalizeInsight(parsed, fallback)
  } catch {
    const lines = cleaned
      .split('\n')
      .map((line) => line.replace(/^[-*\d.\s:]+/, '').trim())
      .filter(Boolean)

    return normalizeInsight(
      {
        summary: lines[0],
        trendDetection: lines[1],
        anomalyDetection: lines[2],
        recommendation: lines[3],
        dataQualityNote: lines[4],
      },
      fallback,
    )
  }
}

function hasQueryResult(context: InsightRequestContext) {
  return (
    Object.keys(context.summary ?? {}).length > 0 ||
    Object.keys(context.metadata ?? {}).length > 0 ||
    Boolean(context.sampleRows?.length) ||
    Boolean(context.chart?.length)
  )
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as InsightRequestBody
  const context = body.context ?? {}
  const payloadHints = buildPayloadHints(context)
  const payloadInsight = buildPayloadInsight(context, payloadHints)
  const contextFilters = context.metadata?.filters
  const evidence = buildAiEvidenceBundle({
    title: context.reportName ?? body.title,
    description: context.reportDescription,
    rows: context.sampleRows ?? [],
    summary: context.summary ?? {},
    chart: context.chart ?? [],
    metadata: context.metadata ?? {},
  }, {
    filters: contextFilters && typeof contextFilters === 'object' && !Array.isArray(contextFilters)
      ? (contextFilters as Record<string, unknown>)
      : {},
    question: context.analysisQuestion,
    reportCode: context.moduleId,
    sampleRows: 12,
    maxColumns: 24,
  })
  const providerConfig = getAnthropicProviderConfig()

  if (!hasQueryResult(context)) {
    return NextResponse.json(
      {
        success: false,
        error: 'AI hanya boleh membaca payload hasil query. Jalankan query report terlebih dahulu.',
      },
      { status: 400 },
    )
  }

  if (!providerConfig.configured) {
    return NextResponse.json({
      success: true,
      provider: 'local-rule',
      providerEngine: PROVIDER_ENGINE,
      model: 'payload-insight',
      insight: payloadInsight,
      warning: providerConfig.publicMessage,
    })
  }

  const systemPrompt = [
    'Kamu adalah asisten analitik untuk PT Rebinmas Jaya Report Intelligence Center.',
    'Buat insight operasional ringkas dalam Bahasa Indonesia berdasarkan payload report untuk pembaca audit, CFO/CEO, manager, dan inventory control.',
    'Gunakan Bahasa Indonesia saja, tanpa bahasa Inggris atau Mandarin.',
    'Fokus pada insight, bukan ringkasan template. Jawab apa yang paling besar, apa yang lebih besar dibanding yang lain, gap material, konsentrasi nilai, risiko, outstanding, kualitas data, atau outlier.',
    'Jika context.analysisQuestion tersedia, jawab pertanyaan itu secara langsung berdasarkan payloadHints. Jangan mengganti pertanyaan dan jangan menjawab hal di luar payload.',
    'Jika context.analysisQuestions tersedia, anggap itu daftar pertanyaan resmi untuk report tersebut. Gunakan hanya analysisQuestion aktif sebagai fokus jawaban.',
    'Gaya bahasa harus langsung dan berguna: satu temuan kuat per field, tidak memakai frasa generik seperti "belum ada tren" atau "gunakan preview" jika payloadHints punya angka.',
    'Wajib sebutkan nama item/gudang/kategori/dokumen dan angka dari payloadHints jika tersedia.',
    'Jika tidak ada tren waktu, jangan menulis "belum ada tren"; isi field trendDetection dengan perbandingan terbesar atau ranking terbesar dari payload.',
    'Bedakan temuan operasional dari temuan quality data. Jangan membuat alarm palsu jika payload menunjukkan nilai 0 atau data kosong.',
    'Kamu tidak boleh membuat query, meminta query baru, atau mengasumsikan data di luar payload yang diberikan.',
    'Jika data kurang, jelaskan keterbatasan berdasarkan payload yang ada tanpa meminta data tambahan.',
    'Jangan menyarankan tambah data, edit data, delete data, input data, atau sync manual.',
    'Output harus stabil meskipun model berubah: selalu isi 5 field yang sama, satu sampai dua kalimat pendek per field, tidak menambah field baru, tidak mengubah nama key.',
    'Jangan mengubah angka, label, nama item, atau nama gudang dari payloadHints. Jika ragu, pakai insight hitung lokal apa adanya.',
    'Balas hanya JSON valid tanpa markdown dengan key: summary, trendDetection, anomalyDetection, recommendation, dataQualityNote.',
    'Makna key: summary = insight utama; trendDetection = terbesar/pembanding/gap; anomalyDetection = risiko/outlier/quality signal; recommendation = aksi konkret berikutnya; dataQualityNote = batasan payload/sumber data.',
  ].join(' ')

  const userPrompt = [
    `Judul kartu: ${body.title ?? 'AI Insight Preview'}`,
    `Konteks report: ${compactJson({
      ...context,
      sampleRows: context.sampleRows?.slice(0, 8),
      chart: context.chart?.slice(0, 8),
    })}`,
    `Payload hints terhitung: ${compactJson(payloadHints)}`,
    `Evidence scope terbatas: ${formatAiEvidenceForPrompt(evidence)}`,
    `Insight hitung lokal yang harus dipertajam, bukan diabaikan: ${compactJson(payloadInsight)}`,
  ].join('\n\n')

  try {
    const providerResult = await callAnthropicMessages({
      config: providerConfig,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1800,
      temperature: 0.1,
    })

    if (!providerResult.ok || !providerResult.content) {
      return NextResponse.json({
        success: true,
        provider: 'local-rule',
        providerEngine: PROVIDER_ENGINE,
        model: 'payload-insight',
        insight: payloadInsight,
        warning: providerResult.publicMessage,
      })
    }

    const modelInsight = normalizeFinalInsight(parseInsight(providerResult.content, payloadInsight), payloadInsight)
    const insight = hasPayloadEvidence(modelInsight, payloadHints) ? modelInsight : payloadInsight

    return NextResponse.json({
      success: true,
      provider: DISPLAY_PROVIDER,
      providerEngine: PROVIDER_ENGINE,
      model: providerResult.model,
      insight,
      warning: insight === payloadInsight ? 'AI tidak memberikan evidence payload yang cukup, insight lokal dipakai.' : undefined,
    })
  } catch {
    return NextResponse.json({
      success: true,
      provider: 'local-rule',
      providerEngine: PROVIDER_ENGINE,
      model: 'payload-insight',
      insight: payloadInsight,
      warning: 'AI tidak dapat dihubungi. Insight lokal dipakai.',
    })
  }
}
