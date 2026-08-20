'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { ArrowRight, BarChart3, Layers3, Lock, Package, Star, Users, Wallet } from 'lucide-react'
import {
  REPORT_GLOBAL_MODULES,
  type ReportGlobalModuleConfig,
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

const availabilityCopy: Record<ReportModuleAvailability, { label: string; className: string }> = {
  live: {
    label: 'Live',
    className: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200',
  },
  preview: {
    label: 'Preview',
    className: 'border-amber-300/25 bg-amber-400/10 text-amber-200',
  },
  restricted: {
    label: 'Restricted',
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
  const { favorites, toggleFavorite, addRecent, setActiveModule } = useReportStore()

  const liveModules = REPORT_GLOBAL_MODULES.filter((module) => module.availability === 'live').length
  const previewModules = REPORT_GLOBAL_MODULES.filter((module) => module.availability === 'preview').length

  const openModule = (module: ReportGlobalModuleConfig) => {
    setActiveModule(module.id)
    addRecent(moduleStorageId(module))
  }

  return (
    <section className={cx('rc-panel rc-panel-active overflow-hidden rounded-[28px]', className)} aria-label="Global report modules">
      <div className="relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 rc-reference-grid opacity-80" aria-hidden="true" />
        <div className="relative z-10">
          {/* Hero command bar */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="rc-eyebrow text-[var(--rc-forest-accent)]">Global report center</p>
              <h1 className="rc-display mt-2 text-3xl font-semibold leading-[1.02] tracking-[-0.045em] text-[var(--rc-text)] sm:text-4xl">
                Pilih modul bisnis, bukan tumpukan report.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--rc-text-muted)]">
                Procurement, Payroll, Human Resources, Financial, dan Budget jadi pintu utama.
                Status live/preview mengikuti registry, jadi user tahu mana yang siap dipakai.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {([
                ['Modul', REPORT_GLOBAL_MODULES.length],
                ['Live', liveModules],
                ['Preview', previewModules],
              ] as const).map(([label, value]) => (
                <span key={label} className="rc-chip inline-flex items-baseline gap-2 px-3 py-1.5">
                  <strong className="rc-metric text-base text-[var(--rc-text)]">{value}</strong>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--rc-text-faint)]">{label}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Grid kartu modul = langsung navigasi */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {REPORT_GLOBAL_MODULES.map((module) => {
              const Icon = iconMap[module.icon]
              const availability = availabilityCopy[module.availability]
              const favorite = favorites.includes(moduleStorageId(module))
              const locked = (module.availability as ReportModuleAvailability) === 'restricted'
              const href = withSource(module.route, activeSource) ?? '#'

              const cardBody = (
                <>
                  <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: module.color }} aria-hidden="true" />
                  <span className="flex items-start justify-between gap-3">
                    <span
                      className="grid h-12 w-12 place-items-center rounded-2xl border-[var(--rc-forest-border)] bg-white/[0.05]"
                      style={{ color: module.color }}
                    >
                      <Icon size={24} strokeWidth={1.8} />
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={cx('rounded-full border px-2.5 py-1 text-[10px] font-black uppercase', availability.className)}>
                        {availability.label}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          toggleFavorite(moduleStorageId(module))
                        }}
                        className={cx(
                          'rc-forest-focus grid h-7 w-7 place-items-center rounded-lg border transition',
                          favorite
                            ? 'border-amber-300/30 bg-amber-400/10 text-amber-300'
                            : 'border-[var(--rc-border)] bg-white/5 text-[var(--rc-text-faint)] hover:text-amber-300',
                        )}
                        aria-label={favorite ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                        aria-pressed={favorite}
                      >
                        <Star size={13} fill={favorite ? 'currentColor' : 'none'} />
                      </button>
                    </span>
                  </span>
                  <span className="mt-4 block">
                    <span className="flex items-center gap-2">
                      <strong className="truncate text-lg font-black text-[var(--rc-text)]">{module.name}</strong>
                      {locked ? <Lock size={14} className="text-rose-200" /> : <ArrowRight size={15} className="text-[var(--rc-text-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--rc-forest-accent)]" />}
                    </span>
                    <span className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--rc-text-muted)]">{module.description}</span>
                  </span>
                  <span className="mt-4 grid-cols-2 gap-2 border-t border-[var(--rc-forest-border)] pt-3 text-xs">
                    <span className="rounded-xl bg-white/[0.04] px-3 py-2 text-[var(--rc-text-muted)]">
                      <strong className="rc-metric block text-base text-[var(--rc-forest-accent)]">{module.submodules.length}</strong>
                      sub-modul
                    </span>
                    <span className="rounded-xl bg-white/[0.04] px-3 py-2 text-[var(--rc-text-muted)]">
                      <strong className="rc-metric block text-base text-[var(--rc-forest-accent)]">{module.reportCount}</strong>
                      laporan
                    </span>
                  </span>
                  {module.submodules.length ? (
                    <span className="mt-3 block">
                      <span className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">
                        <Layers3 size={12} />
                        Sub-modul
                      </span>
                      <span className="flex flex-wrap gap-1.5">
                        {module.submodules.map((submodule) => {
                          const sub = submodule as {
                            id: string
                            name: string
                            availability: ReportModuleAvailability
                            route?: string
                          }
                          const subLocked = sub.availability === 'restricted'
                          const subHref = withSource(sub.route ?? module.route, activeSource) ?? '#'
                          if (subLocked) {
                            return (
                              <span
                                key={sub.id}
                                className="inline-flex cursor-not-allowed items-center gap-1 rounded-full border-rose-300/20 bg-rose-400/5 px-2.5 py-1 text-[11px] font-bold text-rose-200/80"
                                aria-disabled="true"
                              >
                                <Lock size={11} />
                                {sub.name}
                              </span>
                            )
                          }
                          return (
                            <Link
                              key={sub.id}
                              href={subHref}
                              onClick={(event) => {
                                event.stopPropagation()
                                addRecent(`submodule:${module.id}:${sub.id}`)
                              }}
                              className="rc-forest-focus inline-flex items-center gap-1 rounded-full border-[var(--rc-forest-border)] bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-[var(--rc-text-muted)] transition hover:border-[var(--rc-forest-border-strong)] hover:text-[var(--rc-text)]"
                            >
                              {sub.name}
                            </Link>
                          )
                        })}
                      </span>
                    </span>
                  ) : null}
                </>
              )

              if (locked) {
                return (
                  <div
                    key={module.id}
                    className="group relative min-h-[214px] cursor-not-allowed overflow-hidden rounded-2xl border-rose-300/20 bg-[rgba(7,26,20,.55)] p-4 opacity-75"
                    aria-disabled="true"
                  >
                    {cardBody}
                  </div>
                )
              }

              return (
                <Link
                  key={module.id}
                  href={href}
                  onClick={() => openModule(module)}
                  className="rc-forest-focus group relative min-h-[214px] overflow-hidden rounded-2xl border-[var(--rc-forest-border)] bg-[rgba(7,26,20,.72)] p-4 transition hover:-translate-y-1 hover:border-[var(--rc-forest-border-strong)] hover:bg-[rgba(11,36,25,.9)]"
                >
                  {cardBody}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export default GlobalModuleNavigator
