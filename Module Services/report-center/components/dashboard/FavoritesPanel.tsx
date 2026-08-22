'use client'

import { Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { inventoryReports } from '@modules/report-center/lib/reports/inventory/config'
import { useReportStore } from '@modules/report-center/store/reportStore'

function getReport(id: string) {
  return inventoryReports.find((report) => report.id === id)
}

export default function FavoritesPanel() {
  const router = useRouter()
  const { favorites } = useReportStore()
  const ids = favorites.slice(0, 5)
  const items = ids.map(getReport).filter(Boolean)

  const openReport = (id: string) => {
    useReportStore.getState().addRecent(id)
    router.push(`/report-center/inventory?report=${id}`)
  }

  return (
    <section
      id="favorites"
      className="flex h-full min-h-[300px] scroll-mt-24 flex-col rounded-[24px] border border-[var(--rc-forest-border)] bg-[rgba(7,26,20,.72)] p-5"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-amber-300/25 bg-amber-400/10 text-amber-200">
          <Star size={18} fill="currentColor" />
        </div>
        <div>
          <h2 className="text-base font-black tracking-[-0.02em] text-[var(--rc-text)]">Laporan Favorit</h2>
          <p className="text-xs font-semibold text-[var(--rc-text-faint)]">Disimpan dari report real</p>
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--rc-forest-border)] bg-white/[0.03] p-4 text-sm font-semibold text-[var(--rc-text-faint)]">
            Belum ada report favorit. Tandai report Inventory setelah preview data tampil.
          </div>
        )}
        {items.map((report) => (
          <button
            key={report!.id}
            type="button"
            onClick={() => openReport(report!.id)}
            className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-emerald-300/30 hover:bg-white/[0.075]"
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-300" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-[var(--rc-text)]">{report!.title}</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--rc-text-faint)]">
                {report!.groupTitle} · {report!.lastUpdated}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
