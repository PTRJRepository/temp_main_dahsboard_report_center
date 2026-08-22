'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowRight, Boxes, Database, FileText, Layers3, ShieldCheck, Sparkles } from 'lucide-react'
import GlobalSearch from '@modules/report-center/components/dashboard/GlobalSearch'
import FavoritesPanel from '@modules/report-center/components/dashboard/FavoritesPanel'
import RecentPanel from '@modules/report-center/components/dashboard/RecentPanel'
import SystemInfoPanel from '@modules/report-center/components/dashboard/SystemInfoPanel'
import GlobalModuleNavigator from '@modules/report-center/components/report-center/GlobalModuleNavigator'
import InsightTicker from '@modules/report-center/components/report-center/InsightTicker'
import { REPORT_GLOBAL_MODULES } from '@modules/report-center/lib/reports/module-registry'

/** Delay bertahap untuk entrance animation (fade-up dari tokens.css). */
function reveal(delayMs: number): React.CSSProperties {
  return {
    animation: `fade-up 640ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms both`,
  }
}

export default function ReportCenterPage() {
  const { stats, tickerItems } = useMemo(() => {
    const totalSubmodules = REPORT_GLOBAL_MODULES.reduce((sum, module) => sum + module.submodules.length, 0)
    const totalReports = REPORT_GLOBAL_MODULES.reduce((sum, module) => sum + module.reportCount, 0)
    const liveReports = REPORT_GLOBAL_MODULES
      .filter((module) => module.availability === 'live')
      .reduce((sum, module) => sum + module.reportCount, 0)
    const previewReports = totalReports - liveReports

    return {
      stats: [
        { icon: Layers3, value: REPORT_GLOBAL_MODULES.length.toLocaleString('id-ID'), label: 'Modul global', note: `${totalSubmodules} sub-modul` },
        { icon: FileText, value: totalReports.toLocaleString('id-ID'), label: 'Total laporan', note: 'Registry resmi' },
        { icon: Boxes, value: liveReports.toLocaleString('id-ID'), label: 'Report live', note: 'Query aktif' },
        { icon: Database, value: previewReports.toLocaleString('id-ID'), label: 'Preview', note: 'Katalog siap' },
      ] as const,
      tickerItems: [
        `${liveReports} report inventory live — query read-only siap dibuka`,
        'Procurement workspace: KPI, valuasi, movement, dan audit dalam satu halaman',
        'Payroll · Human Resources · Financial · Budget — katalog preview terstruktur',
        'Sumber ganda aktif: Estate (db_ptrj) dan Pabrik (db_ptrj_mill)',
        'Semua report read-only — SQL write diblokir di layer API',
      ],
    }
  }, [])

  return (
    <>
      <GlobalSearch />
      <main className="mx-auto max-w-screen-2xl space-y-5 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-[32px] border border-[var(--rc-forest-border)] bg-[linear-gradient(140deg,#04120b_0%,#082014_52%,#03100a_100%)] px-6 py-10 sm:px-10 sm:py-14">
          {/* Lapisan ambien: grid referensi + orb cahaya yang mengapung */}
          <div className="pointer-events-none absolute inset-0 rc-reference-grid opacity-80" aria-hidden="true" />
          <div
            className="pointer-events-none absolute -left-28 -top-36 h-[440px] w-[440px] rounded-full bg-[radial-gradient(circle,rgba(24,185,107,.24),transparent_62%)] [animation:drift_16s_ease-in-out_infinite_alternate]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-44 right-[-9rem] h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(155,226,61,.14),transparent_60%)] [animation:drift_20s_ease-in-out_infinite_alternate-reverse]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute right-[24%] top-[-10rem] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(41,199,200,.1),transparent_58%)]"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <span
                className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200"
                style={reveal(0)}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/50 [animation-duration:1.8s]" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300/90" />
                </span>
                Live · SQL Read-only
                <Sparkles size={12} className="text-emerald-300/70" />
              </span>

              <h1
                className="mt-5 text-[clamp(34px,5.4vw,58px)] font-black leading-[1.02] tracking-[-0.05em] text-[var(--rc-text)]"
                style={reveal(90)}
              >
                Satu pintu untuk
                <br />
                <span className="bg-gradient-to-r from-emerald-300 via-lime-200 to-emerald-400 bg-clip-text text-transparent">
                  semua laporan perusahaan.
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--rc-text-muted)] sm:text-base" style={reveal(180)}>
                Procurement sudah live dengan report inventory real — KPI, valuasi, movement,
                sampai audit kualitas data. Modul lain menunggamu di katalog preview.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3" style={reveal(270)}>
                <Link
                  href="/report-center/procurement?stockGroup=inventory"
                  className="group inline-flex items-center gap-2 rounded-2xl bg-[var(--rc-forest-primary)] px-5 py-3 text-sm font-black text-[#03130c] shadow-[0_12px_38px_-10px_rgba(24,185,107,.55)] transition hover:bg-[var(--rc-forest-accent)] hover:shadow-[0_16px_46px_-10px_rgba(155,226,61,.5)]"
                >
                  Buka report live
                  <ArrowRight size={16} className="transition group-hover:translate-x-1" />
                </Link>
                <a
                  href="#modules"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-black text-[var(--rc-text-muted)] backdrop-blur transition hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.09] hover:text-[var(--rc-text)]"
                >
                  Jelajahi modul
                  <Layers3 size={15} />
                </a>
              </div>
            </div>

            {/* Kartu statistik kaca di sisi kanan hero */}
            <aside
              className="hidden w-[290px] shrink-0 rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-md lg:block"
              style={reveal(360)}
              aria-label="Ringkasan registry cepat"
            >
              <div className="space-y-5">
                {stats.slice(0, 3).map((item, index) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className={index > 0 ? 'border-t border-white/[0.07] pt-5' : ''}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="rc-metric text-[30px] leading-none tracking-[-0.04em] text-[var(--rc-text)]">{item.value}</span>
                        <span className="grid h-9 w-9 place-items-center rounded-xl border border-[rgba(155,226,61,.22)] bg-[rgba(24,185,107,.1)] text-[var(--rc-forest-accent)]">
                          <Icon size={17} strokeWidth={1.9} />
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--rc-text-muted)]">{item.label}</p>
                      <p className="text-[11px] font-semibold text-[var(--rc-text-faint)]">{item.note}</p>
                    </div>
                  )
                })}
              </div>
            </aside>
          </div>
        </section>

        {/* ── TICKER LIVE ──────────────────────────────────────── */}
        <InsightTicker items={tickerItems} />

        {/* ── STATISTIK REGISTRY ───────────────────────────────── */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Ringkasan registry report center">
          {stats.map((item, index) => {
            const Icon = item.icon
            return (
              <article key={item.label} className="rc-kpi-card min-h-[124px] p-[18px]" style={reveal(index * 90)}>
                <div className="relative z-10 flex items-start gap-3">
                  <div className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[13px] border border-[rgba(155,226,61,.22)] bg-[rgba(24,185,107,.1)] text-[var(--rc-forest-accent)]">
                    <Icon size={21} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <strong className="rc-metric block text-[28px] leading-none tracking-[-0.04em] text-[var(--rc-text)]">{item.value}</strong>
                    <p className="mt-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[var(--rc-text-muted)]">{item.label}</p>
                    <p className="mt-1 text-[11px] font-semibold leading-4 text-[var(--rc-text-faint)]">{item.note}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </section>

        {/* ── GRID MODUL ───────────────────────────────────────── */}
        <div id="modules" className="scroll-mt-24">
          <GlobalModuleNavigator />
        </div>

        {/* ── WORKSPACE PRIBADI ────────────────────────────────── */}
        <section className="grid gap-5 xl:grid-cols-3" aria-label="Workspace pribadi">
          <FavoritesPanel />
          <RecentPanel />
          <SystemInfoPanel />
        </section>

        {/* Footer kecil status keamanan */}
        <footer className="flex flex-wrap items-center justify-center gap-2 pb-2 pt-1 text-[11px] font-bold text-[var(--rc-text-faint)]">
          <ShieldCheck size={13} className="text-[var(--rc-forest-accent)]" />
          PT Rebinmas Jaya · Report Center — semua query read-only, diaudit di layer gateway
        </footer>
      </main>
    </>
  )
}
