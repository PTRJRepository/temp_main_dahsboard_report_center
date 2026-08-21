'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Layers3,
  ShieldCheck,
} from 'lucide-react'
import {
  createProcurementReportHref,
  getProcurementWorkspace,
  type ReportSource,
} from '@modules/report-center/lib/reports/procurement-workspace'
import InventoryOverview from './InventoryOverview'
import type { MovementWindowValue } from './MovementWindowTimeline'
import ProcurementHierarchyNav from './ProcurementHierarchyNav'
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

function sourceHref(source: ReportSource) {
  return `/report-center/procurement?source=${source}`
}

function formatPeriodLabel(period: string) {
  const [year, month] = period.split('-').map(Number)
  if (!year || !month) return period || 'Bulan berjalan'
  return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1))
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
  const [movementWindowRange, setMovementWindowRange] = useState<MovementWindowValue>({ start: null, end: null })
  const activePeriodLabel = formatPeriodLabel(moduleFilters.period)

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('report-center-period-change', {
      detail: { period: moduleFilters.period, label: activePeriodLabel },
    }))
  }, [activePeriodLabel, moduleFilters.period])

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
    usage: createProcurementReportHref('pengeluaran-barang', source),
    fuel: createProcurementReportHref('fuel-usage', source),
    return: createProcurementReportHref('return-barang', source),
  }

  return (
    <main className="min-h-full bg-transparent">
      <div className="mx-auto max-w-screen-2xl space-y-5 px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <section className="rounded-[24px] border border-[var(--rc-forest-border)] bg-[linear-gradient(135deg,rgba(3,18,11,.94),rgba(8,34,23,.9))] px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <nav className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-[var(--rc-text-faint)]">
                <Link href={`/report-center?source=${source}`} className="hover:text-[var(--rc-forest-accent)]">Dashboard</Link>
                <span>/</span>
                <span className="text-[var(--rc-forest-accent)]">Procurement</span>
              </nav>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black tracking-[-0.04em] text-[var(--rc-text)] sm:text-2xl">
                  Procurement · {activeGroup.id === 'process' ? 'Ordering' : activeGroup.id === 'gudang' ? 'Gudang' : activeGroup.id === 'workshop' ? 'Workshop' : 'Inventory'}
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rc-forest-border)] bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--rc-forest-accent)]">
                  <ShieldCheck size={12} />
                  {sourceInfo.label}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--rc-text-faint)]" title={sourceInfo.description}>
                  {sourceInfo.description}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-[var(--rc-text-muted)]">
                Period {activePeriodLabel} · MC {moduleFilters.movementWindow}
                {moduleFilters.movementWindow === 'custom' && movementWindowRange.start && movementWindowRange.end
                  ? ` (${movementWindowRange.start.slice(0, 7)} → ${movementWindowRange.end.slice(0, 7)})`
                  : ''}
                {moduleFilters.itemType ? ` · Scope ${moduleFilters.itemType}` : ' · Scope Inventory 1+4'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
                {(['estate', 'pabrik'] as const).map((item) => (
                  <Link
                    key={item}
                    href={sourceHref(item)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                      item === source
                        ? 'bg-[var(--rc-forest-primary)] text-[#03130c]'
                        : 'text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)]'
                    }`}
                  >
                    {sourceCopy[item].label}
                  </Link>
                ))}
              </div>
              <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-[var(--rc-text-faint)] sm:flex" title="Workspace report counts">
                <span><strong className="text-[var(--rc-forest-accent)]">{workspace.totalLiveReports}</strong> live</span>
                <span className="text-white/20">·</span>
                <span><strong className="text-[var(--rc-forest-accent)]">{workspace.totalStockReports}</strong> stock</span>
                <span className="text-white/20">·</span>
                <span><strong className="text-[var(--rc-forest-accent)]">{workspace.totalProcessReports}</strong> process</span>
              </div>
              <Link
                href={`/report-center?source=${source}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)]"
              >
                <ArrowLeft size={14} />
                Dashboard
              </Link>
              <Link
                href={`/report-center/inventory?source=${source}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rc-forest-primary)] px-3 py-2 text-xs font-black text-[#03130c] hover:bg-[var(--rc-forest-accent)]"
              >
                Inventory live
                <ArrowRight size={14} />
              </Link>
            </div>
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
          movementWindowRange={movementWindowRange}
          onMovementWindowRangeChange={setMovementWindowRange}
          hideScopeControls
        />

<section className="rc-panel overflow-hidden rounded-[28px] border-[var(--rc-forest-border)]">
          <div className="border-b border-[var(--rc-border)] bg-[rgba(5,17,10,.74)] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--rc-forest-accent)]">Area kerja</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--rc-text)]">
              Struktur modul procurement
            </h2>
          </div>

          <div className="p-4 sm:p-5">
            <ProcurementHierarchyNav
              source={source}
              initialSubModule={activeGroup.id === 'process' ? 'purchasing' : 'inventory'}
              initialScope={activeGroup.id === 'gudang' ? 'gudang' : activeGroup.id === 'workshop' ? 'workshop' : 'all'}
            />
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
