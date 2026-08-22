'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { ArrowRight, BarChart3, Layers3, Lock, Package, Star, Users, Wallet } from 'lucide-react'
import {
  REPORT_GLOBAL_MODULES,
  type ReportGlobalModuleConfig,
  type ReportModuleAvailability,
  type ReportModuleIcon,
} from '@modules/report-center/lib/reports/module-registry'
import { useReportStore } from '@modules/report-center/store/reportStore'

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
    <section className={cx('rc-panel overflow-hidden rounded-[28px]', className)} aria-label="Global report modules">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rc-border)] bg-[rgba(5,17,10,.62)] px-5 py-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--rc-forest-accent)]">Pilih modul bisnis</p>
          <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[var(--rc-text)]">
            Bukan tumpukan report — lima pintu utama.
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {([
            ['Modul', REPORT_GLOBAL_MODULES.length],
            ['Live', liveModules],
            ['Preview', previewModules],
          ] as const).map(([label, value]) => (
            <span key={label} className="rc-chip inline-flex items-baseline gap-1.5 px-3 py-1.5">
              <strong className="rc-metric text-sm text-[var(--rc-text)]">{value}</strong>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--rc-text-faint)]">{label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:p-5 sm:grid-cols-2 xl:grid-cols-5">
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
                  className="grid h-11 w-11 place-items-center rounded-2xl border transition"
                  style={{ color: module.color, borderColor: `${module.color}45`, backgroundColor: `${module.color}1c` }}
                >
                  <Icon size={22} strokeWidth={1.8} />
                </span>
                <span className="flex items-center gap-1.5">
                  <span className={cx('rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em]', availability.className)}>
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
                        : 'border-white/10 bg-white/5 text-[var(--rc-text-faint)] hover:text-amber-300',
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
                  <strong className="truncate text-base font-black tracking-[-0.02em] text-[var(--rc-text)]">{module.name}</strong>
                  {locked ? <Lock size={13} className="shrink-0 text-rose-200" /> : <ArrowRight size={15} className="ml-auto shrink-0 text-[var(--rc-text-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--rc-forest-accent)]" />}
                </span>
                <span className="mt-2 line-clamp-3 block text-xs leading-5 text-[var(--rc-text-muted)]">{module.description}</span>
              </span>
              <span className="mt-4 flex items-center justify-between border-t border-[var(--rc-forest-border)] pt-3 text-[11px] font-bold text-[var(--rc-text-faint)]">
                <span><strong className="rc-metric mr-1 text-sm text-[var(--rc-forest-accent)]">{module.submodules.length}</strong>sub-modul</span>
                <span><strong className="rc-metric mr-1 text-sm text-[var(--rc-forest-accent)]">{module.reportCount}</strong>laporan</span>
              </span>
              {module.submodules.length ? (
                <span className="mt-3 block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">
                    <Layers3 size={12} />
                    Sub-modul
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {module.submodules.slice(0, 3).map((submodule) => {
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
                            className="inline-flex cursor-not-allowed items-center gap-1 rounded-full border border-rose-300/20 bg-rose-400/5 px-2.5 py-1 text-[11px] font-bold text-rose-200/80"
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
                          className="rc-forest-focus inline-flex max-w-full items-center truncate rounded-full border border-[var(--rc-forest-border)] bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-[var(--rc-text-muted)] transition hover:border-[var(--rc-forest-border-strong)] hover:text-[var(--rc-text)]"
                        >
                          {sub.name}
                        </Link>
                      )
                    })}
                    {module.submodules.length > 3 && (
                      <span className="inline-flex items-center rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-[var(--rc-text-faint)]">
                        +{module.submodules.length - 3}
                      </span>
                    )}
                  </span>
                </span>
              ) : null}
            </>
          )

          if (locked) {
            return (
              <div
                key={module.id}
                className="group relative min-h-[218px] cursor-not-allowed overflow-hidden rounded-2xl border border-rose-300/20 bg-[rgba(7,26,20,.55)] p-4 opacity-75"
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
              style={{ '--mod-accent': module.color } as React.CSSProperties}
              className="rc-forest-focus group relative min-h-[218px] overflow-hidden rounded-2xl border border-[var(--rc-forest-border)] bg-[rgba(7,26,20,.72)] p-4 transition hover:-translate-y-1 hover:border-[var(--rc-forest-border-strong)] hover:bg-[rgba(11,36,25,.9)] hover:shadow-[0_24px_60px_-18px_var(--mod-accent)]"
            >
              {cardBody}
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export default GlobalModuleNavigator
