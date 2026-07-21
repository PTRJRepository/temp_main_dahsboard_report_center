'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ClipboardList,
  FileText,
  GitBranch,
  Layers3,
  Package,
  ShieldCheck,
  Warehouse,
  Wrench,
} from 'lucide-react'
import {
  createProcurementReportHref,
  getProcurementWorkspace,
  type ProcurementStockGroup,
  type ReportSource,
} from '@/lib/reports/procurement-workspace'
import InventoryOverview from './InventoryOverview'
import ProcurementKpiStrip, {
  createDefaultProcurementKpiFilters,
  type ProcurementKpiFilters,
} from './ProcurementKpiStrip'

type ProcurementModuleWorkspaceProps = {
  source: ReportSource
  stockGroup?: string | null
}

const sourceCopy: Record<ReportSource, { label: string; description: string }> = {
  estate: {
    label: 'Estate / Kebun',
    description: 'db_ptrj melalui SERVER_PROFILE_2',
  },
  pabrik: {
    label: 'Pabrik',
    description: 'db_ptrj_mill melalui SERVER_PROFILE_3',
  },
}

const groupIcon = {
  inventory: Package,
  gudang: Warehouse,
  workshop: Wrench,
  process: ClipboardList,
} satisfies Record<ProcurementStockGroup, typeof Warehouse>

const priorityTone = {
  critical: 'border-rose-300/25 bg-rose-400/10 text-rose-100',
  high: 'border-amber-300/25 bg-amber-400/10 text-amber-100',
  medium: 'border-slate-300/20 bg-slate-400/10 text-slate-100',
}

function sourceHref(source: ReportSource) {
  return `/report-center/procurement?source=${source}`
}

export default function ProcurementModuleWorkspace({ source, stockGroup }: ProcurementModuleWorkspaceProps) {
  const workspace = getProcurementWorkspace(source, stockGroup)
  const activeGroup = workspace.activeGroupDetail
  const sourceInfo = sourceCopy[source]
  const overviewItemType = activeGroup.id === 'gudang'
    ? 'gudang'
    : activeGroup.id === 'workshop'
      ? 'workshop'
      : undefined
  const [moduleFilters, setModuleFilters] = useState<ProcurementKpiFilters>(() => createDefaultProcurementKpiFilters())

  const kpiLinks = {
    stock: createProcurementReportHref('asset-stock-valuasi-listing', source),
    receive: createProcurementReportHref('goods-receiving-receipt-activity', source),
    process: createProcurementReportHref('purchase-request-inventory', source),
    workshop: createProcurementReportHref('asset-stock-valuasi-listing', source, { itemType: 'workshop' }),
    movement: createProcurementReportHref('all-stock-movement-analysis', source, {
      groupBy: 'MovementCategory',
      itemType: overviewItemType,
      movementWindow: moduleFilters.movementWindow || 'all',
    }),
  }

  return (
    <main className="min-h-full bg-transparent">
      <div className="mx-auto max-w-screen-2xl space-y-5 px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[34px] border border-[var(--rc-forest-border)] bg-[radial-gradient(circle_at_18%_18%,rgba(65,231,139,.22),transparent_30%),linear-gradient(135deg,rgba(3,18,11,.96),rgba(8,34,23,.92)_48%,rgba(21,14,7,.9))] shadow-[0_28px_100px_rgba(0,0,0,.32)]">
          <div className="pointer-events-none absolute -right-24 top-8 h-72 w-72 rounded-full border border-amber-300/20 bg-amber-300/10 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-28 w-full bg-[linear-gradient(90deg,rgba(65,231,139,.08),transparent,rgba(245,158,11,.08))]" aria-hidden="true" />

          <div className="relative z-10 grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_430px] lg:p-7">
            <div>
              <nav className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--rc-text-faint)]">
                <Link href={`/report-center?source=${source}`} className="hover:text-[var(--rc-forest-accent)]">Dashboard</Link>
                <span>/</span>
                <span className="text-[var(--rc-forest-accent)]">Procurement</span>
              </nav>

              <div className="mt-6 inline-flex flex-wrap items-center gap-2 rounded-full border border-[var(--rc-forest-border)] bg-black/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--rc-forest-accent)]">
                <Package size={14} />
                Procurement control tower
              </div>

              <h1 className="mt-5 max-w-5xl text-[2.35rem] font-black leading-[1.05] tracking-[-0.025em] text-[var(--rc-text)] sm:text-5xl sm:leading-[0.98] sm:tracking-[-0.05em] lg:text-7xl lg:leading-[0.94] lg:tracking-[-0.06em]">
                Procurement global: Inventory dan proses dalam satu layar.
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-7 text-[var(--rc-text-muted)] sm:text-base">
                Procurement adalah modul global. Di dalamnya, Inventory adalah master stock yang terdiri dari Gudang
                dan Workshop/Mesin. Proses procurement tetap terpisah untuk PR, PO, receiving, issue, dan supplier.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/report-center?source=${source}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)]"
                >
                  <ArrowLeft size={16} />
                  Dashboard
                </Link>
                <Link
                  href={`/report-center/inventory?source=${source}`}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[var(--rc-forest-primary)] px-4 py-3 text-sm font-black text-[#03130c] hover:bg-[var(--rc-forest-accent)]"
                >
                  Buka inventory live
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <aside className="rounded-[28px] border border-[var(--rc-forest-border)] bg-[rgba(1,12,7,.58)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--rc-text-faint)]">Active source</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--rc-text)]">{sourceInfo.label}</h2>
                  <p className="mt-1 text-xs font-semibold text-[var(--rc-text-faint)]">{sourceInfo.description}</p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-200">
                  <ShieldCheck size={22} />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {(['estate', 'pabrik'] as const).map((item) => (
                  <Link
                    key={item}
                    href={sourceHref(item)}
                    className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${
                      item === source
                        ? 'border-[var(--rc-forest-border-strong)] bg-[var(--rc-forest-primary)] text-[#03130c]'
                        : 'border-white/10 bg-white/[0.04] text-[var(--rc-text-muted)] hover:bg-white/[0.08] hover:text-[var(--rc-text)]'
                    }`}
                  >
                    {sourceCopy[item].label}
                  </Link>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-[var(--rc-border)] bg-white/[0.04] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--rc-text-faint)]">Workspace scope</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-black/20 p-3">
                    <strong className="block text-xl text-[var(--rc-forest-accent)]">{workspace.totalLiveReports}</strong>
                    <span className="text-[var(--rc-text-faint)]">live report</span>
                  </div>
                  <div className="rounded-xl bg-black/20 p-3">
                    <strong className="block text-xl text-[var(--rc-forest-accent)]">{workspace.totalStockReports}</strong>
                    <span className="text-[var(--rc-text-faint)]">stock view</span>
                  </div>
                  <div className="rounded-xl bg-black/20 p-3">
                    <strong className="block text-xl text-[var(--rc-forest-accent)]">{workspace.totalProcessReports}</strong>
                    <span className="text-[var(--rc-text-faint)]">process</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <ProcurementKpiStrip
          source={source}
          links={kpiLinks}
          filters={moduleFilters}
          onFiltersChange={setModuleFilters}
        />

        <InventoryOverview
          source={source}
          itemType={moduleFilters.itemType || overviewItemType}
          period={moduleFilters.period}
          onPeriodChange={(period) => setModuleFilters((current) => ({ ...current, period }))}
          movementWindow={moduleFilters.movementWindow}
          onMovementWindowChange={(movementWindow) => setModuleFilters((current) => ({ ...current, movementWindow }))}
          hideScopeControls
        />

        <section className="rc-panel overflow-hidden rounded-[28px] border border-[var(--rc-forest-border)]">
          <div className="grid gap-0 lg:grid-cols-[380px_minmax(0,1fr)]">
            <aside className="border-b border-[var(--rc-border)] bg-[rgba(5,17,10,.74)] p-4 lg:border-b-0 lg:border-r">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--rc-forest-accent)]">Pilih grup kerja</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--rc-text)]">Inventory, Gudang, Workshop, atau Process</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--rc-text-muted)]">
                Default Inventory membaca Gudang + Workshop. Gunakan Gudang atau Workshop hanya kalau ingin isolasi scope.
              </p>

              <div className="mt-5 space-y-3">
                {workspace.groups.map((group) => {
                  const Icon = groupIcon[group.id]
                  return (
                    <Link
                      key={group.id}
                      href={group.href}
                      className={`group block rounded-3xl border p-4 transition hover:-translate-y-0.5 ${
                        group.active
                          ? 'border-[var(--rc-forest-border-strong)] bg-[rgba(24,185,107,.14)]'
                          : 'border-white/10 bg-white/[0.04] hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${
                          group.active
                            ? 'border-[var(--rc-forest-border-strong)] bg-[var(--rc-forest-primary)] text-[#03130c]'
                            : 'border-white/10 bg-black/20 text-[var(--rc-forest-accent)]'
                        }`}>
                          <Icon size={21} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-[var(--rc-text-faint)]">{group.eyebrow}</span>
                          <strong className="mt-1 block text-base font-black text-[var(--rc-text)]">{group.label}</strong>
                          <span className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--rc-text-muted)]">{group.description}</span>
                        </span>
                        <span className="ml-auto rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black text-[var(--rc-text-muted)]">
                          {group.count}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </aside>

            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--rc-forest-accent)]">
                    <GitBranch size={14} />
                    {activeGroup.label}
                  </div>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] text-[var(--rc-text)]">{activeGroup.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--rc-text-muted)]">{activeGroup.description}</p>
                </div>
                <Link
                  href={`/report-center/inventory?source=${source}`}
                  className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)]"
                >
                  Semua inventory
                  <ArrowRight size={15} />
                </Link>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {activeGroup.reports.map((report) => (
                  <Link
                    key={`${activeGroup.id}-${report.id}-${report.metricLabel}`}
                    href={report.href}
                    className="group flex min-h-[255px] flex-col rounded-3xl border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,.025))] p-4 transition hover:-translate-y-1 hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.08]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--rc-forest-border)] bg-black/20 text-[var(--rc-forest-accent)]">
                        <FileText size={19} />
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${priorityTone[report.priority]}`}>
                          {report.priority}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold uppercase text-[var(--rc-text-faint)]">
                          {report.cadence}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--rc-text-faint)]">{report.code} / {report.metricLabel}</p>
                      <h3 className="mt-2 line-clamp-2 text-base font-black leading-6 text-[var(--rc-text)]">{report.title}</h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--rc-text-muted)]">{report.purpose}</p>
                    </div>

                    <div className="mt-4 rounded-2xl border border-[var(--rc-border)] bg-black/15 p-3">
                      <p className="text-xs font-semibold leading-5 text-[var(--rc-text-muted)]">{report.signal}</p>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      <span className="truncate text-xs font-semibold text-[var(--rc-text-faint)]">{report.owner}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-black text-[var(--rc-forest-accent)]">
                        Buka report
                        <ArrowRight size={13} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="rc-panel overflow-hidden rounded-[28px] border border-[var(--rc-forest-border)]">
            <div className="border-b border-[var(--rc-border)] bg-[rgba(5,17,10,.62)] px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--rc-forest-accent)]">Procurement process map</p>
              <h2 className="mt-1 text-lg font-black text-[var(--rc-text)]">Alur dari request sampai stock terpakai</h2>
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {workspace.processStages.map((stage, index) => (
                <Link
                  key={stage.id}
                  href={stage.href}
                  className="group relative min-h-[170px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] p-4 transition hover:-translate-y-1 hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.075]"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--rc-forest-border)] bg-black/20 text-[var(--rc-forest-accent)]">
                      {index + 1}
                    </span>
                    <ArrowRight size={16} className="text-[var(--rc-text-faint)] transition group-hover:text-[var(--rc-forest-accent)]" />
                  </span>
                  <strong className="mt-4 block text-lg font-black text-[var(--rc-text)]">{stage.label}</strong>
                  <p className="mt-2 text-sm leading-6 text-[var(--rc-text-muted)]">{stage.description}</p>
                  <p className="mt-3 line-clamp-1 text-xs font-bold text-[var(--rc-text-faint)]">{stage.reportTitle}</p>
                </Link>
              ))}
            </div>
          </div>

          <aside className="rc-panel rounded-[28px] border border-[var(--rc-forest-border)] p-5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-200">
              <BarChart3 size={23} />
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-[var(--rc-forest-accent)]">Cara baca module</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--rc-text)]">Mulai dari KPI, lalu drill down.</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--rc-text-muted)]">
              <p>
                KPI atas menjawab ringkasan besar: total inventory stock, receive activity, PR/PO process, movement category, dan workshop usage.
              </p>
              <p>
                Inventory adalah master stock gabungan. Tab Gudang dan Workshop hanya memisahkan stock regular dari sparepart atau vehicle stock saat user perlu isolasi.
              </p>
              <p>
                Tab Process dipakai untuk procurement flow: PR, PO, supplier, receiving, dan rekonsiliasi movement bulanan.
              </p>
            </div>
            <Link
              href={createProcurementReportHref('all-stock-movement-analysis', source, {
                groupBy: 'MovementCategory',
                itemType: overviewItemType,
                movementWindow: 'all',
              })}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--rc-forest-primary)] px-4 py-3 text-sm font-black text-[#03130c] hover:bg-[var(--rc-forest-accent)]"
            >
              Lihat movement category
              <Layers3 size={16} />
            </Link>
          </aside>
        </section>
      </div>
    </main>
  )
}
