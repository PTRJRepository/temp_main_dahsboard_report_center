import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, FileText, Layers3 } from 'lucide-react'
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

  return (
    <main className="min-h-full bg-transparent">
      <div className="mx-auto max-w-screen-2xl space-y-5 px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <section className="rc-panel rc-panel-active overflow-hidden rounded-3xl">
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:p-6">
            <div>
              <nav className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--rc-text-faint)]">
                <Link href={`/report-center?source=${source}`} className="hover:text-[var(--rc-forest-accent)]">Dashboard</Link>
                <span>/</span>
                <span className="text-[var(--rc-forest-accent)]">{panel.module.name}</span>
              </nav>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-[var(--rc-forest-accent)]">Module workspace</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--rc-text)] sm:text-4xl">
                {panel.module.name}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--rc-text-muted)]">
                {panel.module.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--rc-text-faint)]">Sub-modul</p>
                <p className="mt-2 text-2xl font-black text-[var(--rc-forest-accent)]">{panel.subModules.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--rc-text-faint)]">Report</p>
                <p className="mt-2 text-2xl font-black text-[var(--rc-text)]">{panel.reports.length}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--rc-forest-accent)]">Sub-module map</p>
              <h2 className="mt-1 text-base font-bold text-[var(--rc-text)]">Pilih area kerja</h2>
            </div>
            <Link
              href={`/report-center?source=${source}`}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--rc-border)] bg-white/5 px-3 py-2 text-xs font-bold text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)]"
            >
              <ArrowLeft size={14} />
              Dashboard
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {panel.subModules.map((subModule) => {
              const card = (
                <div className="group h-full rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-[var(--rc-border-strong)] hover:bg-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--rc-forest-border)] bg-[rgba(24,185,107,.1)] text-[var(--rc-forest-accent)]">
                      <Layers3 size={20} />
                    </div>
                    <span className="rounded-full border border-[var(--rc-forest-border)] bg-[rgba(24,185,107,.1)] px-2 py-1 text-[10px] font-black text-[var(--rc-forest-accent)]">
                      {subModule.count}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-black text-[var(--rc-text)]">{subModule.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--rc-text-muted)]">{subModule.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--rc-forest-accent)]">
                    {subModule.href ? 'Buka sub-modul' : 'Preview'}
                    <ArrowRight size={13} />
                  </span>
                </div>
              )

              return subModule.href ? (
                <Link key={subModule.id} href={subModule.href} className="block h-full">
                  {card}
                </Link>
              ) : (
                <div key={subModule.id} className="h-full opacity-75" aria-disabled="true">
                  {card}
                </div>
              )
            })}
          </div>
        </section>

        <section className="rc-panel overflow-hidden rounded-3xl">
          <div className="flex flex-col gap-3 border-b border-[var(--rc-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--rc-forest-accent)]">Report list</p>
              <h2 className="mt-1 text-base font-bold text-[var(--rc-text)]">Daftar laporan dalam modul</h2>
            </div>
            <span className="w-fit rounded-full border border-[var(--rc-border)] px-3 py-1 text-xs font-bold text-[var(--rc-text-muted)]">
              {panel.reports.length} laporan
            </span>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {panel.reports.map((report) => {
              const card = (
                <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-[var(--rc-border-strong)] hover:bg-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-[var(--rc-forest-accent)]">
                      <FileText size={18} />
                    </div>
                    <span className="rounded-full border border-[var(--rc-forest-border)] bg-[rgba(24,185,107,.1)] px-2 py-1 text-[10px] font-black uppercase text-[var(--rc-forest-accent)]">
                      {report.status}
                    </span>
                  </div>
                  <h3 className="mt-4 line-clamp-2 text-sm font-black text-[var(--rc-text)]">{report.title}</h3>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--rc-text-muted)]">{report.description}</p>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    <span className="truncate text-xs font-semibold text-[var(--rc-text-faint)]">{report.group}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--rc-forest-accent)]">
                      {report.href ? 'Buka report' : 'Preview'}
                      <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              )

              return report.href ? (
                <Link key={report.id} href={report.href} className="block h-full">
                  {card}
                </Link>
              ) : (
                <div key={report.id} className="h-full opacity-75" aria-disabled="true">
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
