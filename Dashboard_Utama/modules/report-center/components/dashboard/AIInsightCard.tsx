'use client'

import { useEffect, useState } from 'react'
import { Brain, Clipboard, Send, Sparkles } from 'lucide-react'
import type { InsightContent } from '@/lib/reports/intelligence'

export type AIInsightRequestContext = {
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

type AIInsightCardProps = {
  title?: string
  insight: InsightContent
  compact?: boolean
  className?: string
  requestContext?: AIInsightRequestContext
  variant?: 'dark' | 'light'
}

export default function AIInsightCard({
  title = 'AI Insight Preview',
  insight,
  compact = false,
  className = '',
  requestContext,
  variant = 'dark',
}: AIInsightCardProps) {
  const [generatedInsight, setGeneratedInsight] = useState<InsightContent | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generateWarning, setGenerateWarning] = useState<string | null>(null)
  const questions = requestContext?.analysisQuestions ?? []
  const [selectedQuestion, setSelectedQuestion] = useState(requestContext?.analysisQuestion ?? '')
  const [questionInput, setQuestionInput] = useState(requestContext?.analysisQuestion ?? '')
  const activeInsight = generatedInsight ?? insight
  const hasQueryContext = Boolean(
    requestContext &&
      (Object.keys(requestContext.summary ?? {}).length > 0 ||
        Object.keys(requestContext.metadata ?? {}).length > 0 ||
        Boolean(requestContext.sampleRows?.length) ||
        Boolean(requestContext.chart?.length)),
  )

  useEffect(() => {
    const nextQuestion = requestContext?.analysisQuestion ?? ''
    setSelectedQuestion(nextQuestion)
    setQuestionInput(nextQuestion)
    setGeneratedInsight(null)
    setGenerateError(null)
    setGenerateWarning(null)
  }, [requestContext?.analysisQuestion, requestContext?.analysisQuestions, requestContext?.reportName])

  const copyInsight = async () => {
    const text = [
      `Insight utama: ${activeInsight.summary}`,
      `Terbesar / pembanding: ${activeInsight.trendDetection}`,
      `Risiko: ${activeInsight.anomalyDetection}`,
      `Aksi: ${activeInsight.recommendation}`,
      `Catatan data: ${activeInsight.dataQualityNote}`,
    ].join('\n')
    await navigator.clipboard.writeText(text).catch(() => null)
  }

  const generateInsight = async () => {
    if (!hasQueryContext) {
      setGenerateError('AI menunggu payload hasil query. AI tidak menjalankan query sendiri.')
      return
    }
    const question = questionInput.trim()
    setGenerating(true)
    setGenerateError(null)
    try {
      const response = await fetch('/api/reports/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          context: {
            ...requestContext,
            analysisQuestion: question || requestContext?.analysisQuestion,
          },
          fallbackInsight: activeInsight,
        }),
      })
      const result = (await response.json()) as {
        success?: boolean
        insight?: InsightContent
        warning?: string
        error?: string
      }
      if (!response.ok || !result.success || !result.insight) {
        throw new Error(result.error ?? 'Gagal generate insight.')
      }
      setSelectedQuestion(question)
      setGeneratedInsight(result.insight)
      setGenerateWarning(result.warning ?? null)
    } catch (error) {
      setGenerateWarning(null)
      setGenerateError(error instanceof Error ? error.message : 'Gagal generate insight.')
    } finally {
      setGenerating(false)
    }
  }

  const light = variant === 'light'

  return (
    <section
      className={[
        'overflow-hidden rounded-3xl border shadow-[0_4px_14px_rgba(15,23,42,0.06)]',
        light
          ? 'border-[#E2E8F0] bg-white text-[#0F172A]'
          : 'border-emerald-200 bg-gradient-to-br from-[#071426] via-[#0B1D35] to-[#0f5132] text-white shadow-[0_24px_60px_rgba(7,20,38,0.18)]',
        className,
      ].join(' ')}
    >
      <div className={light ? 'flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4' : 'flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4'}>
        <div className="flex items-center gap-3">
          <div className={light ? 'grid h-10 w-10 place-items-center rounded-2xl bg-[#EAF7EF] text-[#16834A]' : 'grid h-10 w-10 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-100'}>
            <Brain size={20} />
          </div>
          <div>
            <p className={light ? 'text-xs font-semibold uppercase tracking-[0.22em] text-[#16834A]' : 'text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200'}>AI Insight</p>
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
        </div>
        <span className={light ? 'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600' : 'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200'}>
          <Sparkles size={13} />
          READ-ONLY
        </span>
      </div>

      <div className="grid gap-3 p-5">
        <div className={light ? 'rounded-2xl border border-slate-100 bg-slate-50 p-4' : 'rounded-2xl border border-white/10 bg-white/10 p-4'}>
          <p className={light ? 'text-xs font-semibold uppercase tracking-[0.18em] text-[#16834A]' : 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200'}>Insight Utama</p>
          {generatedInsight && selectedQuestion && (
            <p className={light ? 'mt-2 text-xs font-semibold leading-5 text-emerald-700' : 'mt-2 text-xs font-semibold leading-5 text-emerald-100'}>
              Menjawab: {selectedQuestion}
            </p>
          )}
          <p className={light ? 'mt-2 text-sm leading-6 text-slate-700' : 'mt-2 text-sm leading-6 text-slate-100'}>{activeInsight.summary}</p>
        </div>

        <div className={compact ? 'grid gap-3' : 'grid gap-3 md:grid-cols-2'}>
          {[
            ['Terbesar / Pembanding', activeInsight.trendDetection],
            ['Risiko / Outlier', activeInsight.anomalyDetection],
            ['Aksi Berikutnya', activeInsight.recommendation],
            ['Catatan Data', activeInsight.dataQualityNote],
          ].map(([label, value]) => (
            <div key={label} className={light ? 'rounded-2xl border border-slate-100 bg-white p-3' : 'rounded-2xl border border-white/10 bg-white/[0.07] p-3'}>
              <p className={light ? 'text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500' : 'text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300'}>{label}</p>
              <p className={light ? 'mt-1 text-sm leading-5 text-slate-700' : 'mt-1 text-sm leading-5 text-slate-100'}>{value}</p>
            </div>
          ))}
        </div>

        <div className={light ? 'rounded-2xl border border-emerald-100 bg-emerald-50 p-3' : 'rounded-2xl border border-white/10 bg-white/[0.07] p-3'}>
          <div className="flex items-center justify-between gap-3">
            <p className={light ? 'text-[11px] font-semibold uppercase tracking-[0.16em] text-[#16834A]' : 'text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200'}>Tanya AI</p>
            {questions.length > 0 && (
              <select
                value=""
                onChange={(event) => {
                  const question = event.target.value
                  setQuestionInput(question)
                  setGeneratedInsight(null)
                  setGenerateError(null)
                  setGenerateWarning(null)
                }}
                className={light ? 'h-9 max-w-[180px] rounded-xl border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-800 outline-none' : 'h-9 max-w-[180px] rounded-xl border border-white/10 bg-white/10 px-2 text-xs font-semibold text-emerald-50 outline-none'}
              >
                <option value="">Contoh pertanyaan</option>
                {questions.map((question) => (
                  <option key={question} value={question}>{question}</option>
                ))}
              </select>
            )}
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <textarea
              value={questionInput}
              onChange={(event) => {
                setQuestionInput(event.target.value)
                setGeneratedInsight(null)
                setGenerateError(null)
                setGenerateWarning(null)
              }}
              rows={2}
              placeholder="Tulis pertanyaan spesifik dari payload report..."
              className={light ? 'min-h-20 flex-1 resize-none rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/10' : 'min-h-20 flex-1 resize-none rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white outline-none placeholder:text-emerald-50/45 focus:border-emerald-300/70 focus:ring-4 focus:ring-emerald-300/10'}
            />
            <button
              type="button"
              onClick={generateInsight}
              disabled={generating || !hasQueryContext}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#16834A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#116b3c] disabled:cursor-wait disabled:opacity-70 sm:self-stretch"
            >
              <Send size={15} />
              {generating ? 'Membaca...' : hasQueryContext ? 'Tanya' : 'Menunggu'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={copyInsight}
            className={light ? 'inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50' : 'inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/15'}
          >
            <Clipboard size={15} />
            Copy Insight
          </button>
        </div>
        {generateError && (
          <p className={light ? 'rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700' : 'rounded-2xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100'}>
            {generateError}
          </p>
        )}
        {generateWarning && !generateError && (
          <p className={light ? 'rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700' : 'rounded-2xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100'}>
            {generateWarning}
          </p>
        )}
        {!hasQueryContext && !generateError && (
          <p className={light ? 'rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700' : 'rounded-2xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100'}>
            AI hanya membaca data hasil query report. Jalankan atau pilih report sampai payload query tersedia.
          </p>
        )}
      </div>
    </section>
  )
}
