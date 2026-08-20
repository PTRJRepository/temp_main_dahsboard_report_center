'use client'

import { Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { inventoryReports } from '@/modules/report-center/lib/reports/inventory/config'
import { useReportStore } from '@/modules/report-center/store/reportStore'

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
    <section className="flex h-full min-h-[300px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-100 text-amber-600">
          <Star size={18} fill="currentColor" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-950">Laporan Favorit</h2>
          <p className="text-xs text-slate-500">Disimpan oleh user dari report real</p>
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
            Belum ada report favorit. Tandai report Inventory setelah preview data tampil.
          </div>
        )}
        {items.map((report) => (
          <button
            key={report!.id}
            type="button"
            onClick={() => openReport(report!.id)}
            className="flex w-full items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
          >
            <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-950">{report!.title}</span>
              <span className="mt-1 block truncate text-xs text-slate-500">
                {report!.groupTitle} | {report!.lastUpdated}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
