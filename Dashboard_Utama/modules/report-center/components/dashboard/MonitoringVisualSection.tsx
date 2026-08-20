'use client'

import { AlertTriangle, BarChart3, LineChart, PieChart, Trophy } from 'lucide-react'
import type { IntelligenceModule, VisualPoint } from '@/modules/report-center/lib/reports/intelligence'
import { overviewIntelligence } from '@/modules/report-center/lib/reports/intelligence'
import type { MonitoringVisualData } from '@/modules/report-center/lib/reports/monitoring'

type MonitoringVisualSectionProps = {
  module?: IntelligenceModule | null
  data?: MonitoringVisualData | null
  title?: string
  description?: string
  className?: string
  loading?: boolean
  error?: string | null
}

function toneClass(tone: string) {
  switch (tone) {
    case 'green':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'blue':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'gold':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'red':
      return 'border-red-200 bg-red-50 text-red-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}

function maxValue(data: VisualPoint[]) {
  return Math.max(1, ...data.map((item) => item.value), ...data.map((item) => item.secondary ?? 0))
}

function AreaChart({ data, accent }: { data: VisualPoint[]; accent: string }) {
  const max = maxValue(data)
  const width = 420
  const height = 190
  const points = data.map((item, index) => {
    const x = data.length <= 1 ? 0 : (index / (data.length - 1)) * width
    const y = height - (item.value / max) * (height - 24) - 8
    return { x, y, label: item.label, value: item.value }
  })
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `0,${height} ${line} ${width},${height}`

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Tren Utama</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Trend Monitor</h3>
        </div>
        <LineChart size={22} style={{ color: accent }} />
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[210px] w-full overflow-visible">
        <defs>
          <linearGradient id={`area-${accent.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((y) => (
          <line key={y} x1="0" x2={width} y1={height * y} y2={height * y} stroke="#E2E8F0" strokeDasharray="5 5" />
        ))}
        <polygon points={area} fill={`url(#area-${accent.replace('#', '')})`} />
        <polyline points={line} fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="#fff" stroke={accent} strokeWidth="3" />
            <text x={point.x} y={height + 13} textAnchor="middle" fontSize="12" fill="#64748B">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function BarChart({ data, accent }: { data: VisualPoint[]; accent: string }) {
  const max = maxValue(data)
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Breakdown Kategori</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Category Breakdown</h3>
        </div>
        <BarChart3 size={22} style={{ color: accent }} />
      </div>
      <div className="space-y-3">
        {data.slice(0, 7).map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-semibold text-slate-700">{item.label}</span>
              <span className="text-slate-500">{item.value.toLocaleString('id-ID')}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100">
              <div
                className="h-3 rounded-full"
                style={{ width: `${Math.max(8, (item.value / max) * 100)}%`, backgroundColor: accent }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DonutChart({ data, accent }: { data: VisualPoint[]; accent: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1
  const colors = [accent, '#2563EB', '#D9A514', '#7C3AED', '#EA8A13', '#64748B']
  let cursor = 0
  const gradient = data
    .map((item, index) => {
      const start = cursor
      cursor += (item.value / total) * 100
      return `${colors[index % colors.length]} ${start}% ${cursor}%`
    })
    .join(', ')

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Komposisi Data</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Composition</h3>
        </div>
        <PieChart size={22} style={{ color: accent }} />
      </div>
      <div className="grid gap-5 sm:grid-cols-[150px_1fr] sm:items-center">
        <div className="relative mx-auto h-36 w-36 rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
          <div className="absolute inset-5 grid place-items-center rounded-full bg-white text-center">
            <span className="text-2xl font-semibold text-slate-950">{total.toLocaleString('id-ID')}</span>
            <span className="-mt-1 text-xs font-semibold text-slate-500">total</span>
          </div>
        </div>
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                <span className="truncate text-slate-700">{item.label}</span>
              </span>
              <span className="font-semibold text-slate-950">{item.value.toLocaleString('id-ID')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MonitoringVisualSection({
  module,
  data: realData,
  title = 'Monitoring Visual',
  description = 'Grafik berubah mengikuti modul atau report yang dipilih.',
  className = '',
  loading = false,
  error = null,
}: MonitoringVisualSectionProps) {
  const moduleData = module ?? null
  const active = realData
    ? realData
    : moduleData
    ? {
        kpis: moduleData.kpis,
        trend: moduleData.trend,
        breakdown: moduleData.breakdown,
        composition: moduleData.composition,
        ranking: moduleData.ranking,
        alerts: moduleData.alerts,
        accent: moduleData.accent,
        title: moduleData.name,
        badge: moduleData.available ? 'Live monitoring view' : 'Preview catalog',
      }
    : {
        ...overviewIntelligence,
        accent: '#167A3A',
        title: 'All Modules Overview',
        badge: 'Catalog overview',
      }

  return (
    <section className={className}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">{title}</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">{active.title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
          {active.badge ?? 'Live monitoring view'}
        </span>
      </div>

      {loading && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-3xl border border-slate-200 bg-white shadow-sm" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white shadow-sm" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <p className="text-lg font-semibold text-red-700">Gagal memuat monitoring real</p>
          <p className="mt-2 text-sm leading-6 text-red-600">{error}</p>
          <p className="mt-3 text-xs font-semibold text-red-500">
            Chart tidak memakai mock. Monitoring akan tampil setelah query real berhasil.
          </p>
        </div>
      )}

      {(loading || error) ? null : (
        <>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {active.kpis.map((kpi) => (
          <div key={kpi.label} className={`rounded-3xl border p-4 shadow-sm ${toneClass(kpi.tone)}`}>
            <p className="text-2xl font-semibold">{kpi.value}</p>
            <p className="mt-1 text-sm font-medium opacity-80">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.9fr)]">
        <AreaChart data={active.trend} accent={active.accent} />
        <BarChart data={active.breakdown} accent={active.accent} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1fr)_minmax(320px,0.8fr)]">
        <DonutChart data={active.composition} accent={active.accent} />
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Top Ranking</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">Operational Ranking</h3>
            </div>
            <Trophy size={22} style={{ color: active.accent }} />
          </div>
          <div className="space-y-3">
            {active.ranking.map((item, index) => (
              <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-sm font-bold text-slate-700 shadow-sm">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">{item.label}</p>
                  <p className="truncate text-xs text-slate-500">{item.note}</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Perlu Perhatian</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">Alert Summary</h3>
            </div>
            <AlertTriangle size={22} className="text-amber-600" />
          </div>
          <div className="space-y-3">
            {active.alerts.map((alert) => (
              <div key={alert.title} className={`rounded-2xl border p-3 ${toneClass(alert.tone)}`}>
                <p className="text-sm font-semibold">{alert.title}</p>
                <p className="mt-1 text-xs leading-5 opacity-80">{alert.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
      )}
    </section>
  )
}
