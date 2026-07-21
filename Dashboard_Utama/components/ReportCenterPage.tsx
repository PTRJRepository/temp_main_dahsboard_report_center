'use client'

import { useMemo, useState } from 'react'
import { Activity, Boxes, ChevronDown, ChevronRight, Database, FileText, Users } from 'lucide-react'
import GlobalSearch from '@/components/dashboard/GlobalSearch'
import FavoritesPanel from '@/components/dashboard/FavoritesPanel'
import RecentPanel from '@/components/dashboard/RecentPanel'
import SystemInfoPanel from '@/components/dashboard/SystemInfoPanel'
import { IntelligenceWidget } from '@/components/intelligence/IntelligenceWidget'
import GlobalModuleNavigator from '@/components/report-center/GlobalModuleNavigator'
import { REPORT_GLOBAL_MODULES } from '@/lib/reports/module-registry'

const MOCK_RECOMMENDATIONS = [
  { id: '1', reportName: 'Stok Persediaan per Gudang', module: 'Procurement / Inventory', reason: 'similar' as const, reasonText: 'Report Inventory live siap dibuka', confidence: 0.92, subtitle: 'Gudang PG1A' },
  { id: '2', reportName: 'Produktivitas Panen Harian', module: 'Financial', reason: 'updated' as const, reasonText: 'Masuk ke sub-modul Produktivitas', confidence: 0.85, subtitle: 'DME Estate', timestamp: '30 menit lalu' },
  { id: '3', reportName: 'Wage Register', module: 'Payroll', reason: 'due' as const, reasonText: 'Payroll dipisah dari HR sebagai modul preview', confidence: 0.95, timestamp: 'Preview' },
  { id: '4', reportName: 'Budget vs Actual', module: 'Budget', reason: 'time_based' as const, reasonText: 'Katalog budget siap ditinjau', confidence: 0.78 },
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
      { icon: Boxes, value: REPORT_GLOBAL_MODULES.length.toLocaleString('id-ID'), label: 'Modul global', stroke: '#9be23d' },
      { icon: FileText, value: totalReports.toLocaleString('id-ID'), label: 'Total laporan registry', stroke: '#29c7c8' },
      { icon: Database, value: liveReports.toLocaleString('id-ID'), label: 'Report live', stroke: '#18b96b' },
      { icon: Users, value: previewReports.toLocaleString('id-ID'), label: 'Report preview', stroke: '#d6b85c' },
      { icon: Activity, value: 'Registry', label: 'Source of truth', stroke: '#20ce79' },
    ]
  }, [])

  return (
    <>
      <GlobalSearch />
      <main className="mx-auto max-w-screen-2xl space-y-5 px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <GlobalModuleNavigator />

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Ringkasan registry report center">
          {stats.map((item) => {
            const Icon = item.icon
            return (
              <article key={item.label} className="rc-kpi-card min-h-[132px] p-[18px]">
                <div className="relative z-10 flex items-center gap-3">
                  <div className="grid h-[42px] w-[42px] place-items-center rounded-[13px] border border-[rgba(155,226,61,.22)] bg-[rgba(24,185,107,.1)] text-[var(--rc-forest-accent)]">
                    <Icon size={22} strokeWidth={1.8} />
                  </div>
                  <div>
                    <strong className="block text-[26px] leading-none tracking-[-0.04em] text-[var(--rc-text)]">{item.value}</strong>
                    <p className="mt-1 text-xs text-[var(--rc-text-faint)]">{item.label}</p>
                  </div>
                </div>
                <svg className="relative z-10 mt-4 h-9 w-full" viewBox="0 0 220 36" fill="none" aria-hidden="true">
                  <path d="M2 28c18-4 28 2 42-3s20-14 34-7 25 10 41 2 27-11 45-5 27 5 54-7" stroke={item.stroke} strokeWidth="2" strokeLinecap="round" />
                </svg>
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
              <span className="block text-xs font-bold uppercase tracking-[0.24em] text-[var(--rc-forest-accent)]">Insight tambahan</span>
              <span className="mt-1 block text-sm font-semibold text-[var(--rc-text)]">
                Rekomendasi, favorit, recent, dan status sistem tetap tersedia tanpa memenuhi first viewport.
              </span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--rc-border)] px-3 py-1 text-xs font-bold text-[var(--rc-text-muted)]">
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
