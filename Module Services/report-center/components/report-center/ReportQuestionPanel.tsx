'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Clipboard, Loader2, RefreshCw, Send, ShieldCheck, StopCircle } from 'lucide-react'
import type { InventoryAnalyticsContract } from '@modules/report-center/lib/reports/inventory/analytics-contract'
import type { InsightContent } from '@modules/report-center/lib/reports/intelligence'
import type { ReportBreakdownEntry } from '@modules/report-center/lib/reports/report-experience'
import type { ReportFilterInput } from '@modules/report-center/lib/reports/report-filtering'

type DbRow = Record<string, unknown>

export type ReportQuestionRequest = {
  id: number
  question: string
}

export type ReportQuestionPayload = {
  title?: string
  description?: string
  rows?: DbRow[]
  columns?: string[]
  summary?: DbRow
  chart?: DbRow[]
  metadata?: DbRow
  analytics?: InventoryAnalyticsContract
}

type ReportQuestionPanelProps = {
  reportId: string
  reportTitle: string
  reportDescription?: string
  sourceLabel: string
  sourceDescription: string
  payload: ReportQuestionPayload | null
  activeFilters: ReportFilterInput
  questionRequest?: ReportQuestionRequest | null
}

type AiInsightResponse = {
  success?: boolean
  provider?: string
  providerEngine?: string
  model?: string
  insight?: InsightContent
  warning?: string
  error?: string
}

const sensitiveKeyPattern = /(authorization|cookie|credential|password|secret|token|api[_-]?key|sql|query)/i

const fallbackInsight: InsightContent = {
  summary: 'Payload report sudah tersedia, tetapi AI provider belum memberikan jawaban.',
  trendDetection: 'Gunakan ranking KPI dan breakdown pada scope aktif sebagai pembanding utama.',
  anomalyDetection: 'Risiko dibaca dari KPI risiko, movement category, stock analysis, lokasi, dan quality signal yang tersedia.',
  recommendation: 'Persempit scope dengan klik breakdown, lalu ulangi pertanyaan AI jika perlu.',
  dataQualityNote: 'Insight lokal memakai payload UI yang sudah disanitasi, bukan query baru.',
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function clip(value: unknown, max = 180): string | number | boolean | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value
  const text = String(value).replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 3).trim()}...` : text
}

function safeRecord(row: DbRow | undefined, preferredColumns?: string[]) {
  const compact: DbRow = {}
  const entries = preferredColumns?.length
    ? preferredColumns.map((key) => [key, row?.[key]] as const)
    : Object.entries(row ?? {})

  entries.forEach(([key, value]) => {
    if (sensitiveKeyPattern.test(key)) return
    compact[key] = clip(value)
  })

  return compact
}

function filterCount(filters: ReportFilterInput) {
  return Object.entries(filters).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '').length
}

function formatMetric(value: unknown) {
  const numeric = toNumber(value)
  if (!numeric && typeof value === 'string') return value
  // Amount-like KPI chips: always 4 decimals (no compact).
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(numeric)
}

function cleanBreakdownLabel(entry: ReportBreakdownEntry) {
  return entry.label.replace(/^[^-]+-\s*/, '').trim()
}

function topBreakdowns(payload: ReportQuestionPayload | null) {
  return [...(payload?.analytics?.breakdowns ?? [])]
    .sort((left, right) => toNumber(right.value) - toNumber(left.value))
    .slice(0, 5)
}

function buildQuestionSuggestions(payload: ReportQuestionPayload | null, reportTitle: string) {
  const breakdowns = topBreakdowns(payload)
  const movement = breakdowns.find((entry) => entry.dimensionId === 'movement-category')
  const stockAnalysis = breakdowns.find((entry) => entry.dimensionId === 'stock-analysis')
  const location = breakdowns.find((entry) => entry.dimensionId === 'location')
  const productType = breakdowns.find((entry) => entry.dimensionId === 'product-type' || entry.dimensionId === 'product-category')
  const questions = [
    movement ? `Apa penyebab dan tindakan untuk movement category ${cleanBreakdownLabel(movement)} pada scope ini?` : undefined,
    productType ? `Product type atau kategori ${cleanBreakdownLabel(productType)} punya risiko/nilai terbesar apa?` : undefined,
    location ? `Gudang ${cleanBreakdownLabel(location)} perlu prioritas item apa dan kenapa?` : undefined,
    stockAnalysis ? `Bedakan stock analysis code ${cleanBreakdownLabel(stockAnalysis)} dengan movement category periodik di report ini.` : undefined,
    `Item detail mana di ${reportTitle} yang paling material untuk dicek sebelum export?`,
  ].filter((question): question is string => Boolean(question))

  return [...new Set(questions)].slice(0, 5)
}

function localInsight(payload: ReportQuestionPayload | null, question: string, activeFilters: ReportFilterInput): InsightContent {
  const kpis = payload?.analytics?.kpis ?? []
  const breakdowns = topBreakdowns(payload)
  const topKpi = kpis[0]
  const topBreakdown = breakdowns[0]
  const riskBreakdown = breakdowns.find((entry) => /dead|stale|slow|risk/i.test(entry.label))
  const scope = payload?.analytics?.detailWindow
  const filterText = filterCount(activeFilters) > 0 ? `${filterCount(activeFilters)} filter aktif` : 'full scope'

  return {
    summary: question
      ? `Menjawab "${question}": ${topKpi ? `${topKpi.label} terbaca ${formatMetric(topKpi.value)}` : 'KPI utama belum tersedia'} pada ${filterText}.`
      : fallbackInsight.summary,
    trendDetection: topBreakdown
      ? `${cleanBreakdownLabel(topBreakdown)} adalah breakdown terbesar (${formatMetric(topBreakdown.value)}) pada dimensi ${topBreakdown.dimensionId ?? 'report'}.`
      : fallbackInsight.trendDetection,
    anomalyDetection: riskBreakdown
      ? `Sinyal risiko yang perlu dicek: ${cleanBreakdownLabel(riskBreakdown)} dengan nilai ${formatMetric(riskBreakdown.value)}.`
      : 'Belum ada breakdown risiko eksplisit; cek movement category, stock analysis, dan item bernilai besar.',
    recommendation: topBreakdown
      ? `Klik breakdown ${cleanBreakdownLabel(topBreakdown)}, buka row detail item terbesar, lalu export setelah scope sudah sesuai.`
      : fallbackInsight.recommendation,
    dataQualityNote: `Jawaban lokal memakai ${scope?.returnedRows ?? payload?.rows?.length ?? 0} returned row dari ${scope?.filteredRows ?? payload?.rows?.length ?? 0} filtered row. AI tidak menjalankan SQL baru.`,
  }
}

function safeErrorMessage() {
  return 'AI question gagal dijalankan. Insight lokal dipakai supaya kontrol report tetap bisa digunakan.'
}

export function ReportQuestionPanel({
  reportId,
  reportTitle,
  reportDescription,
  sourceLabel,
  sourceDescription,
  payload,
  activeFilters,
  questionRequest,
}: ReportQuestionPanelProps) {
  const suggestions = useMemo(() => buildQuestionSuggestions(payload, reportTitle), [payload, reportTitle])
  const [draftQuestion, setDraftQuestion] = useState(() => suggestions[0] ?? `Apa insight utama dari ${reportTitle}?`)
  const [activeQuestion, setActiveQuestion] = useState('')
  const [insight, setInsight] = useState<InsightContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastQuestionRef = useRef('')

  useEffect(() => {
    if (!draftQuestion && suggestions[0]) setDraftQuestion(suggestions[0])
  }, [draftQuestion, suggestions])

  const runQuestion = useCallback(async (questionInput?: string) => {
    const question = (questionInput ?? draftQuestion).trim()
    if (!question || !payload) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    lastQuestionRef.current = question
    setDraftQuestion(question)
    setActiveQuestion(question)
    setLoading(true)
    setError(null)
    setWarning(null)
    setProvider(null)

    const columns = (payload.columns ?? Object.keys(payload.rows?.[0] ?? {}))
      .filter((column) => !sensitiveKeyPattern.test(column))
      .slice(0, 24)
    const safeSummary = safeRecord(payload.summary)
    const safeMetadata = {
      ...safeRecord(payload.metadata),
      filters: safeRecord(activeFilters as DbRow),
      detailWindow: payload.analytics?.detailWindow,
      analytics: {
        kpiIds: payload.analytics?.kpis.map((kpi) => kpi.id).slice(0, 12) ?? [],
        breakdownIds: payload.analytics?.breakdowns.map((breakdown) => breakdown.id).slice(0, 20) ?? [],
        semanticDimensions: payload.analytics?.semanticDimensions ?? [],
      },
    }
    const safeRows = (payload.rows ?? []).slice(0, 40).map((row) => safeRecord(row, columns))
    const safeChart = (payload.chart ?? []).slice(0, 40).map((row) => safeRecord(row))
    const local = localInsight(payload, question, activeFilters)

    try {
      const response = await fetch('/api/reports/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          title: `AI Question - ${reportTitle}`,
          fallbackInsight: local,
          context: {
            moduleId: reportId,
            moduleName: 'Procurement / Inventory',
            reportName: reportTitle,
            reportDescription,
            dataSource: `${sourceLabel} | ${sourceDescription}`,
            analysisQuestion: question,
            analysisQuestions: suggestions,
            summary: safeSummary,
            metadata: safeMetadata,
            sampleRows: safeRows,
            chart: safeChart,
            alerts: topBreakdowns(payload).map((entry) => `${entry.dimensionId ?? 'breakdown'}: ${cleanBreakdownLabel(entry)} ${formatMetric(entry.value)}`),
          },
        }),
      })
      const result = (await response.json()) as AiInsightResponse
      if (!response.ok || !result.success || !result.insight) {
        throw new Error(result.error ?? 'AI insight failed')
      }
      setInsight(result.insight)
      setWarning(result.warning ?? null)
      setProvider(result.provider ? `${result.provider}${result.model ? ` / ${result.model}` : ''}` : null)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setInsight(local)
      setProvider('local-rule')
      setWarning(null)
      setError(safeErrorMessage())
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [activeFilters, draftQuestion, payload, reportDescription, reportId, reportTitle, sourceDescription, sourceLabel, suggestions])

  useEffect(() => {
    if (!questionRequest?.question) return
    void runQuestion(questionRequest.question)
  }, [questionRequest?.id, questionRequest?.question, runQuestion])

  const cancelQuestion = () => {
    abortRef.current?.abort()
    setLoading(false)
    setWarning('Pertanyaan dibatalkan. Scope report tidak berubah.')
  }

  const retryQuestion = () => {
    void runQuestion(lastQuestionRef.current || draftQuestion)
  }

  const scope = payload?.analytics?.detailWindow
  const canAsk = Boolean(payload && draftQuestion.trim() && !loading)

  return (
    <section className="rounded-xl border border-white/10 bg-[#0F2B1A] p-4" aria-label="AI report question panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
            <Bot size={14} />
            AI Question
          </p>
          <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-white">Tanya berdasarkan evidence scope aktif</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-white/45">
            Panel ini membaca payload, KPI, breakdown, filters, dan sample row yang disanitasi. Tidak menjalankan SQL baru.
          </p>
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">
          {provider ?? (loading ? 'generating' : 'ready')}
        </span>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
        <textarea
          value={draftQuestion}
          onChange={(event) => setDraftQuestion(event.target.value)}
          rows={3}
          placeholder={`Contoh: apa item paling berisiko di ${reportTitle}?`}
          className="min-h-[86px] rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold leading-6 text-white placeholder:text-white/30 outline-none focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/20"
        />
        <button
          type="button"
          onClick={() => runQuestion()}
          disabled={!canAsk}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          Jalankan
        </button>
        <button
          type="button"
          onClick={loading ? cancelQuestion : retryQuestion}
          disabled={!loading && !lastQuestionRef.current}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-black text-white/65 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          {loading ? <StopCircle size={16} /> : <RefreshCw size={16} />}
          {loading ? 'Cancel' : 'Retry'}
        </button>
      </div>

      {suggestions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => runQuestion(question)}
              disabled={loading}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-bold text-white/58 hover:border-emerald-300/30 hover:bg-emerald-400/10 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {question}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {[
          ['Filters', filterCount(activeFilters)],
          ['Returned', scope?.returnedRows ?? payload?.rows?.length ?? 0],
          ['Filtered', scope?.filteredRows ?? payload?.rows?.length ?? 0],
          ['Sample sent', Math.min(payload?.rows?.length ?? 0, 40)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/35">{label}</p>
            <p className="mt-1 text-sm font-black text-emerald-200">{formatMetric(value)}</p>
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs font-semibold leading-5 text-amber-100">
          {error}
        </div>
      ) : null}
      {warning ? (
        <div className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-400/10 p-3 text-xs font-semibold leading-5 text-cyan-100">
          {warning}
        </div>
      ) : null}

      {insight ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {[
            ['Insight utama', insight.summary],
            ['Pembanding terbesar', insight.trendDetection],
            ['Risiko / outlier', insight.anomalyDetection],
            ['Aksi berikutnya', insight.recommendation],
            ['Evidence note', insight.dataQualityNote],
          ].map(([label, content], index) => (
            <article
              key={label}
              className={cx(
                'rounded-xl border bg-white/[0.04] p-3',
                index === 0 ? 'border-emerald-300/25 lg:col-span-2' : 'border-white/10',
              )}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/72">{content}</p>
            </article>
          ))}
          <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-100">
              <ShieldCheck size={14} />
              Evidence: {activeQuestion || 'scope aktif'}
            </span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(Object.values(insight).join('\n'))}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-white/58 hover:bg-white/10 hover:text-white"
            >
              <Clipboard size={14} />
              Copy jawaban
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold leading-6 text-white/45">
          Pilih pertanyaan atau tulis sendiri. Jawaban akan memakai scope filter yang sama dengan tabel dan export.
        </div>
      )}
    </section>
  )
}

export default ReportQuestionPanel
