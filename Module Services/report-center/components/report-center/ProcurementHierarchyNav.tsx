'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, FileText, Package, ShoppingCart } from 'lucide-react'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  SUBMODULE_LABELS,
  getHierarchyCounts,
  getHierarchyFor,
  resolveLiveHref,
  type HierarchyEntry,
  type ProcurementCategory,
  type ProcurementSubModule,
} from '@modules/report-center/lib/reports/procurement-hierarchy'
import type { ReportSource } from '@modules/report-center/lib/reports/procurement-workspace'
import InventoryReportsClient from '@/app/(report-center)/report-center/inventory/InventoryReportsClient'

type ScopeFilter = 'all' | 'gudang' | 'workshop'

type ProcurementHierarchyNavProps = {
  source: ReportSource
  initialSubModule?: ProcurementSubModule
  initialScope?: ScopeFilter
}

const submoduleIcon: Record<ProcurementSubModule, typeof Package> = {
  purchasing: ShoppingCart,
  inventory: Package,
}

function EntryCard({ entry, source }: { entry: HierarchyEntry; source: ReportSource }) {
  const href = resolveLiveHref(entry, source)
  const live = entry.status === 'live' && href

  const body = (
    <div
      className={[
        'flex h-full flex-col rounded-2xl border p-4 transition',
        live
          ? 'border-white/10 bg-white/[0.045] hover:-translate-y-0.5 hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.075]'
          : 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] opacity-60',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={[
            'grid h-10 w-10 place-items-center rounded-xl border',
            live
              ? 'border-[var(--rc-forest-border)] bg-black/20 text-[var(--rc-forest-accent)]'
              : 'border-white/[0.08] bg-white/[0.03] text-[var(--rc-text-faint)]',
          ].join(' ')}
        >
          <FileText size={17} />
        </div>
        <span
          className={[
            'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            live
              ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200'
              : 'border-amber-300/25 bg-amber-400/10 text-amber-200',
          ].join(' ')}
        >
          {live ? 'Live' : 'Segera'}
        </span>
      </div>
      <h3 className="mt-3 line-clamp-2 text-[13px] font-semibold leading-5 text-[var(--rc-text)]">{entry.title}</h3>
      {entry.note ? <p className="mt-1 line-clamp-2 rc-data text-[10px] text-[var(--rc-text-faint)]">{entry.note}</p> : null}
      <div className="mt-auto flex items-center justify-end gap-1 pt-3 text-[11px] font-semibold">
        {live ? (
          <span className="inline-flex items-center gap-1 text-[var(--rc-forest-accent)]">
            Buka
            <ArrowRight size={12} />
          </span>
        ) : (
          <span className="text-[var(--rc-text-faint)]">Belum tersedia</span>
        )}
      </div>
    </div>
  )

  return live ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    <div className="h-full" aria-disabled="true">
      {body}
    </div>
  )
}

export default function ProcurementHierarchyNav({ source, initialSubModule = 'inventory', initialScope = 'all' }: ProcurementHierarchyNavProps) {
  const [submodule, setSubmodule] = useState<ProcurementSubModule>(initialSubModule)
  const [category, setCategory] = useState<ProcurementCategory>('reports')
  const [scope, setScope] = useState<ScopeFilter>(initialScope)

  const counts = getHierarchyCounts()
  const entries = getHierarchyFor(submodule, category)

  const showScopeFilter = submodule === 'inventory'
  const showEmbeddedCatalog = submodule === 'inventory' && category === 'reports'

  return (
    <div>
      {/* Level 1: sub-module */}
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(SUBMODULE_LABELS) as ProcurementSubModule[]).map((key) => {
          const Icon = submoduleIcon[key]
          const active = submodule === key
          const total = CATEGORY_ORDER.reduce((acc, cat) => acc + counts[key][cat].total, 0)
          const live = CATEGORY_ORDER.reduce((acc, cat) => acc + counts[key][cat].live, 0)
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSubmodule(key)}
              data-active={active}
              className={[
                'flex items-center gap-3 rounded-2xl border p-4 text-left transition',
                active
                  ? 'border-[var(--rc-forest-border)] bg-[rgba(6,32,19,.55)]'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
              ].join(' ')}
            >
              <span
                className={[
                  'grid h-11 w-11 shrink-0 place-items-center rounded-xl border',
                  active
                    ? 'border-[var(--rc-forest-border)] bg-black/20 text-[var(--rc-forest-accent)]'
                    : 'border-white/10 bg-white/[0.04] text-[var(--rc-text-muted)]',
                ].join(' ')}
              >
                <Icon size={19} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold uppercase tracking-wide text-[var(--rc-text)]">
                  {SUBMODULE_LABELS[key]}
                </span>
                <span className="mt-0.5 block rc-data text-[10px] text-[var(--rc-text-faint)]">
                  {live} live · {total} entri
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Level 2: kategori + scope filter */}
      <div className="mt-4 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5 rounded-2xl border-white/10 bg-black/20 p-1.5">
          {CATEGORY_ORDER.map((cat) => {
            const active = category === cat
            const { total, live } = counts[submodule][cat]
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                data-active={active}
                className={[
                  'inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold transition',
                  active ? 'bg-[var(--rc-forest-primary)] text-[#03130c]' : 'text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)]',
                ].join(' ')}
              >
                {CATEGORY_LABELS[cat]}
                <span className={active ? 'rc-data text-[10px] opacity-80' : 'rc-data text-[10px] text-[var(--rc-text-faint)]'}>
                  {live}/{total}
                </span>
              </button>
            )
          })}
        </div>

        {showScopeFilter ? (
          <div className="flex items-center gap-1.5 rounded-2xl border-white/10 bg-black/20 p-1.5" role="group" aria-label="Scope item type">
            {([
              { id: 'all' as const, label: 'Semua' },
              { id: 'gudang' as const, label: 'Gudang' },
              { id: 'workshop' as const, label: 'Workshop' },
            ]).map((opt) => {
              const active = scope === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScope(opt.id)}
                  data-active={active}
                  className={[
                    'inline-flex h-8 items-center rounded-lg px-3 text-[11px] font-semibold transition',
                    active ? 'bg-white/[0.12] text-[var(--rc-text)]' : 'text-[var(--rc-text-faint)] hover:bg-white/[0.06] hover:text-[var(--rc-text-muted)]',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {/* Isi kategori */}
      <div className="mt-4">
        {showEmbeddedCatalog ? (
          <div>
            {entries.filter((e) => e.status === 'soon').length > 0 ? (
              <p className="mb-3 rc-data text-[10px] text-[var(--rc-text-faint)]">
                {entries.filter((e) => e.status === 'live').length} laporan live · {entries.filter((e) => e.status === 'soon').length} segera menyusul
              </p>
            ) : null}
            <InventoryReportsClient embedded fixedSource={source} itemType={scope === 'all' ? undefined : scope} />
          </div>
        ) : entries.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} source={source} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
            <p className="text-[13px] font-semibold text-[var(--rc-text-muted)]">Belum ada entri pada kategori ini.</p>
            <p className="mt-1 rc-data text-[10px] text-[var(--rc-text-faint)]">Struktur mengikuti susunan kanonik modul procurement.</p>
          </div>
        )}
      </div>
    </div>
  )
}
