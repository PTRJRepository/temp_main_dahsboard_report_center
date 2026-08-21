'use client'

import { useMemo, useState } from 'react'
import { Activity, Boxes, ChevronDown, ChevronRight, Database, FileText, Users } from 'lucide-react'
import GlobalSearch from '@modules/report-center/components/dashboard/GlobalSearch'
import FavoritesPanel from '@modules/report-center/components/dashboard/FavoritesPanel'
import RecentPanel from '@modules/report-center/components/dashboard/RecentPanel'
import SystemInfoPanel from '@modules/report-center/components/dashboard/SystemInfoPanel'
import { IntelligenceWidget } from '@modules/report-center/components/intelligence/IntelligenceWidget'
import GlobalModuleNavigator from '@modules/report-center/components/report-center/GlobalModuleNavigator'
import Sparkline from '@modules/report-center/components/report-center/Sparkline'
import { REPORT_GLOBAL_MODULES } from '@modules/report-center/lib/reports/module-registry'

const MOCK_RECOMMENDATIONS = [
  { id: '1', reportName: 'Stok Persediaan per Gudang', module: 'Procurement / Inventory', reason: 'similar' as const, reasonText: 'Report Inventory live siap dibuka', confidence: 0.92, subtitle: 'Gudang PG1A' },
  { id: '2', reportName: 'Produktivitas Panen Harian', module: 'Financial', reason: 'updated' as const, reasonText: 'Masuk ke sub-modul Produktivitas', confidence: 0.85, subtitle: 'DME Estate', timestamp: '30 menit lalu' },
  { id: '3', reportName: 'Wage Register', module: 'Payroll', reason: 'due' as const, reasonText: 'Payroll dipisah dari HR sebagai modul preview', confidence: 0.95, timestamp: 'Preview' },
  { id: '4', reportName: 'Budget vs Actual', module: 'Budget', reason: 'time_based' as const, reasonText: 'Katalog budget siap ditinjau', confidence: 0.78 },
]

/** Deret sparkline statis per kartu KPI (dekoratif, menggantikan path SVG hardcode). */
const SPARK_SERIES: number[][] = [
  [12, 14, 13, 17, 16, 19, 18, 22, 21, 24],
  [8, 9, 12, 11, 14, 15, 14, 18, 20, 22],
  [20, 18, 22, 21, 25, 24, 27, 26, 30, 31],
  [6, 8, 7, 10, 9, 12, 13, 12, 15, 16],
  [10, 12, 11, 13, 14, 13, 16, 17, 18, 20],
]

export default function ReportCenterPage() {
  const [insightsOpen, setInsightsOpen] = useState(false)
  const stats = useMemo(() => {
    const totalReports = REPORT_GLOBAL_MODULES.reduce((sum, module) => sum + module.reportCount, 0)
    const liveReports = REPORT_GLOBAL_MODULES
      .filter((module) => module.availability === 'live')
      .reduce((sum, module) => sum + module.reportCount, 0)
    const previewReports = totalReports - liveReports

    return [
      { icon: Boxes, value: REPORT_GLOBAL_MODULES.length.toLocaleString('id-ID'), label: 'Modul global' },
      { icon: FileText, value: totalReports.toLocaleString('id-ID'), label: 'Total laporan registry' },
      { icon: Database, value: liveReports.toLocaleString('id-ID'), label: 'Report live' },
      { icon: Users, value: previewReports.toLocaleString('id-ID'), label: 'Report preview' },
      { icon: Activity, value: 'Registry', label: 'Source of truth' },
    ]
  }, [])

  return (
    <>
      <GlobalSearch />
      <main className="mx-auto max-w-screen-2xl space-y-5 px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <GlobalModuleNavigator />

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Ringkasan registry report center">
          {stats.map((item, idx) => {
            const Icon = item.icon
            return (
              <article key={item.label} className="rc-kpi-card min-h-[132px] p-[18px]">
                <div className="relative z-10 flex items-center gap-3">
                  <div className="grid h-[42px] w-[42px] place-items-center rounded-[13px] border-[rgba(155,226,61,.22)] bg-[rgba(24,185,107,.1)] text-[var(--rc-forest-accent)]">
                    <Icon size={22} strokeWidth={1.8} />
                  </div>
                  <div>
                    <strong className="rc-metric block text-[26px] leading-none tracking-[-0.04em] text-[var(--rc-text)]">{item.value}</strong>
                    <p className="mt-1 text-xs text-[var(--rc-text-faint)]">{item.label}</p>
                  </div>
                </div>
                <Sparkline values={SPARK_SERIES[idx % SPARK_SERIES.length]} width={220} height={36} className="relative z-10 mt-4 h-9 w-full" />
              </article>
            )
          })}
        </section>

        <section className="rc-panel overflow-hidden rounded-3xl">
          <button
            type="button"
            onClick={() => setInsightsOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/5"
            aria-expanded={insightsOpen}
          >
            <span>
              <span className="rc-eyebrow block text-[var(--rc-forest-accent)]">Insight tambahan</span>
              <span className="mt-1 block text-sm font-semibold text-[var(--rc-text)]">
                Rekomendasi, favorit, recent, dan status sistem tetap tersedia tanpa memenuhi first viewport.
              </span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border-[var(--rc-border)] px-3 py-1 text-xs font-bold text-[var(--rc-text-muted)]">
              {insightsOpen ? 'Tutup' : 'Buka jika perlu'}
              {insightsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </button>

          {insightsOpen && (
            <div className="grid grid-cols-1 gap-4 border-t border-[var(--rc-border)] p-4 xl:grid-cols-[1.45fr_1fr]">
              <IntelligenceWidget
                recommendations={MOCK_RECOMMENDATIONS}
                onSelect={(rec) => console.info('Selected recommendation:', rec.reportName)}
              />
              <div id="favorites" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <FavoritesPanel />
                <RecentPanel />
                <SystemInfoPanel />
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
