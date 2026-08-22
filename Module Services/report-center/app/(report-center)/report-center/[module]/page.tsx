import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BellRing,
  CheckCircle2,
  FileText,
  Layers3,
  Lightbulb,
  ShieldCheck,
} from 'lucide-react'
import { getModulePanel } from '@modules/report-center/lib/reports/module-panel'
import ProcurementModuleWorkspace from '@modules/report-center/components/report-center/ProcurementModuleWorkspace'

export const dynamic = 'force-dynamic'
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

type ReportSource = 'estate' | 'pabrik'

type PageProps = {
  params: Promise<{ module: string }>
  searchParams?: Promise<{ source?: string; stockGroup?: string; group?: string }>
}

function normalizeSource(value?: string): ReportSource {
  return value === 'pabrik' ? 'pabrik' : 'estate'
}

function toneClasses(tone: string) {
  const classes: Record<string, string> = {
    green: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200',
    blue: 'border-sky-300/25 bg-sky-400/10 text-sky-200',
    gold: 'border-amber-300/25 bg-amber-400/10 text-amber-200',
    red: 'border-rose-300/25 bg-rose-400/10 text-rose-200',
    slate: 'border-[var(--rc-forest-border)] bg-white/5 text-[var(--rc-text-muted)]',
  }
  return classes[tone] ?? classes.slate
}

function alertIcon(tone: string) {
  if (tone === 'green') return CheckCircle2
  if (tone === 'red') return AlertTriangle
  return BellRing
}

export default async function ModuleDetailPage({ params, searchParams }: PageProps) {
  const { module } = await params
  const query = await searchParams
  const source = normalizeSource(query?.source)

  if (module === 'inventory') {
    redirect(`/report-center/procurement?source=${source}&stockGroup=inventory`)
  }
  if (module === 'procurement') {
    return <ProcurementModuleWorkspace source={source} stockGroup={query?.stockGroup ?? query?.group} />
  }

  const panel = getModulePanel(module, source)
  if (!panel) notFound()

  const mod = panel.module
  const availabilityBadge = mod.available
    ? { label: 'Live', className: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200' }
    : { label: 'Preview', className: 'border-amber-300/25 bg-amber-400/10 text-amber-200' }
  const maxBreakdown = Math.max(...mod.breakdown.map((item) => item.value), 1)

  return (
    <main className="min-h-full bg-transparent">
      <div className="mx-auto max-w-screen-2xl space-y-5 px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        {/* Hero band modul */}
        <section className="relative overflow-hidden rounded-[24px] border border-[var(--rc-forest-border)] bg-[linear-gradient(135deg,rgba(3,18,11,.94),rgba(8,34,23,.9))] px-4 py-4 sm:px-5 sm:py-5">
          <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: mod.accent }} aria-hidden="true" />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <nav className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-[var(--rc-text-faint)]">
                <Link href={`/report-center?source=${source}`} className="hover:text-[var(--rc-forest-accent)]">Dashboard</Link>
                <span>/</span>
                <span className="text-[var(--rc-forest-accent)]">{mod.name}</span>
              </nav>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black tracking-[-0.04em] text-[var(--rc-text)] sm:text-2xl">{mod.name}</h1>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${availabilityBadge.className}`}>
                  <ShieldCheck size={12} />
                  {availabilityBadge.label}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--rc-text-muted)]">{mod.description}</p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-col lg:items-end">
              <div className="flex rounded-xl border border-white/10 bg-black/20 p-1" title="Workspace report counts">
                <span className="rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--rc-text-muted)]">
                  <strong className="text-[var(--rc-forest-accent)]">{panel.subModules.length}</strong> sub-modul
                </span>
                <span className="rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--rc-text-muted)]">
                  <strong className="text-[var(--rc-forest-accent)]">{mod.reportCount}</strong> laporan
                </span>
              </div>
              <Link
                href={`/report-center?source=${source}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)]"
              >
                <ArrowLeft size={14} />
                Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* KPI strip dari intelligence registry */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={`Ringkasan modul ${mod.name}`}>
          {mod.kpis.map((kpi) => (
            <article key={kpi.label} className="rc-kpi-card p-[18px]">
              <div className="relative z-10 flex h-full min-h-[86px] flex-col justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">{kpi.label}</p>
                <span className={`w-fit rounded-full border px-2.5 py-1 text-sm font-black ${toneClasses(kpi.tone)}`}>
                  {kpi.value}
                </span>
              </div>
            </article>
          ))}
        </section>

        {/* Peta sub-modul + aside cara baca */}
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="rc-panel overflow-hidden rounded-[24px] border border-[var(--rc-forest-border)]">
            <div className="border-b border-[var(--rc-border)] bg-[rgba(5,17,10,.62)] px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--rc-forest-accent)]">Sub-module map</p>
              <h2 className="mt-1 text-lg font-black text-[var(--rc-text)]">Pilih area kerja</h2>
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {panel.subModules.map((subModule) => {
                const card = (
                  <>
                    <span className="flex items-start justify-between gap-3">
                      <span
                        className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-black/20"
                        style={{ color: mod.accent }}
                      >
                        <Layers3 size={20} />
                      </span>
                      <span className="rounded-full border border-[var(--rc-forest-border)] bg-white/[0.04] px-2 py-0.5 text-[11px] font-black tabular-nums text-[var(--rc-forest-accent)]">
                        {subModule.count}
                      </span>
                    </span>
                    <strong className="mt-4 block text-base font-black tracking-[-0.02em] text-[var(--rc-text)]">{subModule.name}</strong>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--rc-text-muted)]">{subModule.description}</p>
                    <span className={`mt-4 inline-flex items-center gap-1.5 text-xs font-black ${subModule.href ? 'text-[var(--rc-forest-accent)]' : 'cursor-not-allowed text-[var(--rc-text-faint)]'}`}>
                      {subModule.href ? 'Buka sub-modul' : 'Preview'}
                      {subModule.href ? <ArrowRight size={13} /> : <LockGlyph />}
                    </span>
                  </>
                )

                return subModule.href ? (
                  <Link
                    key={subModule.id}
                    href={subModule.href}
                    className="group relative min-h-[168px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition hover:-translate-y-1 hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.075]"
                  >
                    {card}
                  </Link>
                ) : (
                  <div key={subModule.id} className="relative min-h-[168px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 opacity-80" aria-disabled="true">
                    {card}
                  </div>
                )
              })}
            </div>
          </div>

          <aside className="rc-panel rounded-[24px] border border-[var(--rc-forest-border)] p-5">
            <div
              className="grid h-12 w-12 place-items-center rounded-2xl border"
              style={{
                color: mod.accent,
                borderColor: `${mod.accent}44`,
                backgroundColor: `${mod.accent}1a`,
              }}
            >
              <Lightbulb size={22} />
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-[var(--rc-forest-accent)]">Cara baca modul</p>
            <h2 className="mt-2 text-xl font-black leading-snug tracking-[-0.03em] text-[var(--rc-text)]">{mod.insight.summary}</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--rc-text-muted)]">
              <p>{mod.insight.trendDetection}</p>
              <p>{mod.insight.recommendation}</p>
            </div>

            {mod.alerts.length > 0 && (
              <div className="mt-4 space-y-2">
                {mod.alerts.map((alert) => {
                  const Icon = alertIcon(alert.tone)
                  return (
                    <div key={alert.title} className={`flex items-start gap-2.5 rounded-2xl border p-3 ${toneClasses(alert.tone)}`}>
                      <Icon size={15} className="mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.08em]">{alert.title}</p>
                        <p className="mt-0.5 text-xs font-semibold leading-5 opacity-85">{alert.detail}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="mt-4 rounded-xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-2 text-[11px] font-semibold leading-4 text-[var(--rc-text-faint)]">
              Catatan data: {mod.insight.dataQualityNote}
            </p>

            <Link
              href={`/report-center?source=${source}#modules`}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--rc-forest-primary)] px-4 py-3 text-sm font-black text-[#03130c] transition hover:bg-[var(--rc-forest-accent)]"
            >
              Lihat modul lain
              <Layers3 size={16} />
            </Link>
          </aside>
        </section>

        {/* Distribusi katalog + daftar laporan prioritas */}
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="rc-panel overflow-hidden rounded-[24px] border border-[var(--rc-forest-border)]">
            <div className="border-b border-[var(--rc-border)] bg-[rgba(5,17,10,.62)] px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--rc-forest-accent)]">Distribusi katalog</p>
              <h2 className="mt-1 text-lg font-black text-[var(--rc-text)]">Sebaran report per area</h2>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              {mod.breakdown.map((item) => (
                <div key={item.label}>
                  <div className="flex items-baseline justify-between gap-3 text-xs font-bold">
                    <span className="truncate text-[var(--rc-text-muted)]">{item.label}</span>
                    <span className="tabular-nums text-[var(--rc-forest-accent)]">{item.value}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(6, Math.round((item.value / maxBreakdown) * 100))}%`,
                        background: `linear-gradient(90deg, ${mod.accent}, var(--rc-forest-accent))`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rc-panel overflow-hidden rounded-[24px] border border-[var(--rc-forest-border)]">
            <div className="border-b border-[var(--rc-border)] bg-[rgba(5,17,10,.62)] px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--rc-forest-accent)]">Laporan prioritas</p>
              <h2 className="mt-1 text-lg font-black text-[var(--rc-text)]">Mulai dari sini</h2>
            </div>
            <div className="space-y-2 p-4 sm:p-5">
              {mod.ranking.map((report, index) => (
                <div key={`${report.label}-${index}`} className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[var(--rc-text)]">{report.label}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-[var(--rc-text-faint)]">{report.note}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${toneClasses(mod.available ? 'green' : 'gold')}`}>
                    {report.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Daftar lengkap laporan dalam modul */}
        <section className="rc-panel overflow-hidden rounded-[24px] border border-[var(--rc-forest-border)]">
          <div className="flex flex-col gap-3 border-b border-[var(--rc-border)] bg-[rgba(5,17,10,.74)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--rc-forest-accent)]">Report list</p>
              <h2 className="mt-1 text-lg font-black text-[var(--rc-text)]">Daftar laporan dalam modul</h2>
            </div>
            <span className="w-fit rounded-full border border-[var(--rc-border)] px-3 py-1 text-xs font-bold text-[var(--rc-text-muted)]">
              {panel.reports.length} laporan
            </span>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {panel.reports.map((report) => {
              const card = (
                <>
                  <span className="flex items-start justify-between gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/20 text-[var(--rc-forest-accent)]">
                      <FileText size={18} />
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${toneClasses(report.status === 'Live' ? 'green' : 'gold')}`}>
                      {report.status}
                    </span>
                  </span>
                  <h3 className="mt-3 line-clamp-2 text-sm font-black leading-5 text-[var(--rc-text)]">{report.title}</h3>
                  <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-[var(--rc-text-muted)]">{report.description}</p>
                  <span className="mt-auto flex items-center justify-between gap-3 pt-3 text-[11px] font-bold">
                    <span className="truncate text-[var(--rc-text-faint)]">{report.group}</span>
                    <span className={`inline-flex shrink-0 items-center gap-1 ${report.href ? 'text-[var(--rc-forest-accent)]' : 'text-[var(--rc-text-faint)]'}`}>
                      {report.href ? 'Buka report' : 'Preview'}
                      {report.href ? <ArrowRight size={12} /> : <LockGlyph />}
                    </span>
                  </span>
                </>
              )

              return report.href ? (
                <Link
                  key={report.id}
                  href={report.href}
                  className="group flex min-h-[150px] flex-col rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition hover:-translate-y-0.5 hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.075]"
                >
                  {card}
                </Link>
              ) : (
                <div key={report.id} className="flex min-h-[150px] flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 opacity-80" aria-disabled="true">
                  {card}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}

/** Glyph kecil untuk status preview/locked (server component, tanpa state). */
function LockGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
