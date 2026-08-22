'use client'

import { Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { inventoryReports } from '@modules/report-center/lib/reports/inventory/config'
import { useReportStore } from '@modules/report-center/store/reportStore'

function formatRelative(isoString: string) {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return isoString
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'baru saja'
  if (min < 60) return `${min} menit lalu`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} jam lalu`
  return `${Math.floor(hour / 24)} hari lalu`
}

export default function RecentPanel() {
  const router = useRouter()
  const { recent } = useReportStore()
  const items = recent.slice(0, 5)

  const openReport = (id: string) => {
    router.push(`/report-center/inventory?report=${id}`)
  }

  return (
    <section className="flex h-full min-h-[300px] flex-col rounded-[24px] border border-[var(--rc-forest-border)] bg-[rgba(7,26,20,.72)] p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-200">
          <Clock size={18} />
        </div>
        <div>
          <h2 className="text-base font-black tracking-[-0.02em] text-[var(--rc-text)]">Laporan Terbaru</h2>
          <p className="text-xs font-semibold text-[var(--rc-text-faint)]">Terakhir dibuka di browser ini</p>
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--rc-forest-border)] bg-white/[0.03] p-4 text-sm font-semibold text-[var(--rc-text-faint)]">
            Belum ada report yang dibuka pada browser ini.
          </div>
        )}
        {items.map((entry) => {
          const report = inventoryReports.find((item) => item.id === entry.id)
          if (!report) return null
          return (
            <button
              key={`${entry.id}-${entry.viewedAt}`}
              type="button"
              onClick={() => openReport(entry.id)}
              className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-emerald-300/30 hover:bg-white/[0.075]"
            >
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[var(--rc-text)]">{report.title}</span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--rc-text-faint)]">
                  {report.groupTitle} · {formatRelative(entry.viewedAt)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
