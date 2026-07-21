'use client'

import Link from 'next/link'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { ArrowRight, BarChart3, Clock3, Eye, Layers3, Lock, Package, ShieldCheck, Star, Users, Wallet } from 'lucide-react'
import {
  REPORT_GLOBAL_MODULES,
  type ReportGlobalModuleConfig,
  type ReportGlobalModuleId,
  type ReportModuleAvailability,
  type ReportModuleIcon,
} from '@/lib/reports/module-registry'
import { useReportStore } from '@/store/reportStore'

type ReportSource = 'estate' | 'pabrik'

type GlobalModuleNavigatorProps = {
  source?: ReportSource
  className?: string
}

const iconMap = {
  Package,
  Wallet,
  Users,
  BarChart3,
} satisfies Record<ReportModuleIcon, typeof Package>

const availabilityCopy: Record<ReportModuleAvailability, { label: string; detail: string; className: string }> = {
  live: {
    label: 'Live',
    detail: 'Data aktif',
    className: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200',
  },
  preview: {
    label: 'Preview',
    detail: 'Katalog siap dipetakan',
    className: 'border-amber-300/25 bg-amber-400/10 text-amber-200',
  },
  restricted: {
    label: 'Restricted',
    detail: 'Perlu akses',
    className: 'border-rose-300/25 bg-rose-400/10 text-rose-200',
  },
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function withSource(route: string | undefined, source: ReportSource) {
  if (!route) return undefined
  const separator = route.includes('?') ? '&' : '?'
  return route.includes('source=') ? route : `${route}${separator}source=${source}`
}

function moduleStorageId(module: ReportGlobalModuleConfig) {
  return `module:${module.id}`
}

function initialSource(): ReportSource {
  if (typeof window === 'undefined') return 'estate'
  return window.localStorage.getItem('report-center:last-source') === 'pabrik' ? 'pabrik' : 'estate'
}

function subscribeSource(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined
  const handleStorage = (event: StorageEvent) => {
    if (event.key === 'report-center:last-source') callback()
  }
  window.addEventListener('storage', handleStorage)
  return () => window.removeEventListener('storage', handleStorage)
}

function serverSource(): ReportSource {
  return 'estate'
}

export function GlobalModuleNavigator({ source, className }: GlobalModuleNavigatorProps) {
  const storedSource = useSyncExternalStore<ReportSource>(subscribeSource, initialSource, serverSource)
  const activeSource = source ?? storedSource
  const [selectedModuleId, setSelectedModuleId] = useState<ReportGlobalModuleId>(REPORT_GLOBAL_MODULES[0].id)
  const { favorites, recent, toggleFavorite, addRecent, setActiveModule } = useReportStore()

  const selectedModule = useMemo<ReportGlobalModuleConfig>(
    () => REPORT_GLOBAL_MODULES.find((module) => module.id === selectedModuleId) ?? REPORT_GLOBAL_MODULES[0],
    [selectedModuleId],
  )
  const liveModules = REPORT_GLOBAL_MODULES.filter((module) => module.availability === 'live').length
  const previewModules = REPORT_GLOBAL_MODULES.filter((module) => module.availability === 'preview').length
  const recentModules = recent.filter((entry) => entry.id.startsWith('module:')).slice(0, 3)

  const openModule = (module: ReportGlobalModuleConfig) => {
    setSelectedModuleId(module.id)
    setActiveModule(module.id)
    addRecent(moduleStorageId(module))
  }

  return (
    <section className={cx('rc-panel rc-panel-active overflow-hidden rounded-[28px]', className)} aria-label="Global report modules">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 rc-reference-grid opacity-80" aria-hidden="true" />
          <div className="relative z-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-4xl">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--rc-forest-accent)]">
                  Global report center
                </p>
                <h1 className="mt-3 max-w-4xl text-4xl font-black leading-[0.94] tracking-[-0.065em] text-[var(--rc-text)] sm:text-5xl lg:text-7xl">
                  Pilih modul bisnis, bukan tumpukan report.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--rc-text-muted)] sm:text-base">
                  Procurement, Payroll, Human Resources, Financial, dan Budget sekarang jadi pintu utama.
                  Status live/preview mengikuti registry, jadi user tahu mana yang siap dipakai dan mana yang masih katalog.
                </p>
              </div>
              <div className="grid min-w-[220px] grid-cols-3 gap-2 rounded-2xl border border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.6)] p-2">
                {[
                  ['Modul', REPORT_GLOBAL_MODULES.length],
                  ['Live', liveModules],
                  ['Preview', previewModules],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white/[0.04] p-3 text-center">
                    <strong className="block text-xl text-[var(--rc-text)]">{value}</strong>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--rc-text-faint)]">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-5">
              {REPORT_GLOBAL_MODULES.map((module) => {
                const Icon = iconMap[module.icon]
                const availability = availabilityCopy[module.availability]
                const active = selectedModule.id === module.id
                const favorite = favorites.includes(moduleStorageId(module))

                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => openModule(module)}
                    className={cx(
                      'rc-forest-focus group relative min-h-[214px] overflow-hidden rounded-2xl border p-4 text-left transition hover:-translate-y-1',
                      active
                        ? 'border-[var(--rc-forest-border-strong)] bg-[rgba(24,185,107,.13)] shadow-[0_22px_70px_rgba(0,0,0,.28)]'
                        : 'border-[var(--rc-forest-border)] bg-[rgba(7,26,20,.72)] hover:border-[var(--rc-forest-border-strong)] hover:bg-[rgba(11,36,25,.9)]',
                    )}
                    aria-pressed={active}
                  >
                    <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: module.color }} aria-hidden="true" />
                    <span className="flex items-start justify-between gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.05]" style={{ color: module.color }}>
                        <Icon size={24} strokeWidth={1.8} />
                      </span>
                      <span className={cx('rounded-full border px-2.5 py-1 text-[10px] font-black uppercase', availability.className)}>
                        {availability.label}
                      </span>
                    </span>
                    <span className="mt-4 block">
                      <span className="flex items-center gap-2">
                        <strong className="truncate text-lg font-black text-[var(--rc-text)]">{module.name}</strong>
                        {favorite ? <Star size={14} fill="currentColor" className="text-amber-300" /> : null}
                      </span>
                      <span className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--rc-text-muted)]">{module.description}</span>
                    </span>
                    <span className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--rc-forest-border)] pt-3 text-xs">
                      <span className="rounded-xl bg-white/[0.04] px-3 py-2 text-[var(--rc-text-muted)]">
                        <strong className="block text-base text-[var(--rc-forest-accent)]">{module.submodules.length}</strong>
                        sub-modul
                      </span>
                      <span className="rounded-xl bg-white/[0.04] px-3 py-2 text-[var(--rc-text-muted)]">
                        <strong className="block text-base text-[var(--rc-forest-accent)]">{module.reportCount}</strong>
                        laporan
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <aside className="border-t border-[var(--rc-border)] bg-[rgba(5,17,10,.72)] p-5 xl:border-l xl:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--rc-text-faint)]">Module detail</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--rc-text)]">{selectedModule.name}</h2>
            </div>
            <button
              type="button"
              onClick={() => toggleFavorite(moduleStorageId(selectedModule))}
              className={cx(
                'rc-forest-focus grid h-10 w-10 place-items-center rounded-xl border transition',
                favorites.includes(moduleStorageId(selectedModule))
                  ? 'border-amber-300/30 bg-amber-400/10 text-amber-300'
                  : 'border-[var(--rc-border)] bg-white/5 text-[var(--rc-text-faint)] hover:text-amber-300',
              )}
              aria-label="Toggle module favorite"
            >
              <Star size={16} fill={favorites.includes(moduleStorageId(selectedModule)) ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cx('rounded-full border px-2.5 py-1 text-[10px] font-black uppercase', availabilityCopy[selectedModule.availability].className)}>
                {availabilityCopy[selectedModule.availability].label}
              </span>
              <span className="rounded-full border border-[var(--rc-border)] px-2.5 py-1 text-[10px] font-bold uppercase text-[var(--rc-text-faint)]">
                {selectedModule.permissionKey}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--rc-text-muted)]">{selectedModule.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white/[0.04] p-3">
                <dt className="text-[var(--rc-text-faint)]">Total report</dt>
                <dd className="mt-1 text-lg font-black text-[var(--rc-text)]">{selectedModule.reportCount}</dd>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-3">
                <dt className="text-[var(--rc-text-faint)]">Updated</dt>
                <dd className="mt-1 text-sm font-black text-[var(--rc-text)]">{selectedModule.lastUpdated}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">
              <Layers3 size={14} />
              Direct submodule
            </div>
            {selectedModule.submodules.map((submodule) => {
              const href = withSource(submodule.route ?? selectedModule.route, activeSource)
              const locked = submodule.availability === 'restricted'
              return (
                <Link
                  key={submodule.id}
                  href={locked ? '#' : href ?? '#'}
                  onClick={(event) => {
                    if (locked) event.preventDefault()
                    else addRecent(`submodule:${selectedModule.id}:${submodule.id}`)
                  }}
                  className={cx(
                    'rc-forest-focus grid min-h-[82px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-3 transition',
                    locked
                      ? 'cursor-not-allowed border-rose-300/20 bg-rose-400/5 opacity-70'
                      : 'border-[var(--rc-forest-border)] bg-white/[0.04] hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.07]',
                  )}
                  aria-disabled={locked}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-[var(--rc-text)]">{submodule.name}</span>
                    <span className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--rc-text-faint)]">{submodule.description}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-black text-[var(--rc-forest-accent)]">{submodule.reportCount}</span>
                    {locked ? <Lock size={15} className="ml-auto mt-1 text-rose-200" /> : <ArrowRight size={15} className="ml-auto mt-1 text-[var(--rc-text-faint)]" />}
                  </span>
                </Link>
              )
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href={withSource(selectedModule.route, activeSource) ?? '#'}
              onClick={() => addRecent(moduleStorageId(selectedModule))}
              className="rc-forest-focus inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--rc-forest-primary)] px-3 py-3 text-sm font-black text-[#03130c] hover:bg-[var(--rc-forest-accent)]"
            >
              Buka modul
              <ArrowRight size={16} />
            </Link>
            <Link
              href={withSource('/report-center/inventory', activeSource) ?? '#'}
              className="rc-forest-focus inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--rc-border)] bg-white/5 px-3 py-3 text-sm font-black text-[var(--rc-text-muted)] hover:bg-white/10"
            >
              Inventory live
              <Eye size={16} />
            </Link>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--rc-border)] bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">
              <Clock3 size={14} />
              Recent module
            </div>
            <div className="mt-3 space-y-2">
              {recentModules.length ? recentModules.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-bold text-[var(--rc-text-muted)]">{entry.id.replace('module:', '')}</span>
                  <span className="text-[var(--rc-text-faint)]">{new Date(entry.viewedAt).toLocaleDateString('id-ID')}</span>
                </div>
              )) : (
                <p className="text-xs leading-5 text-[var(--rc-text-faint)]">Belum ada modul yang dibuka pada browser ini.</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-xs font-bold text-emerald-100">
            <ShieldCheck size={16} />
            Payroll dan HR dipisah sebagai top-level module; akses tetap mengikuti permission registry.
          </div>
        </aside>
      </div>
    </section>
  )
}

export default GlobalModuleNavigator
