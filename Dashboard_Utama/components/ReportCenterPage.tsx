'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import GlobalSearch from '@/components/dashboard/GlobalSearch'
import HeroBanner from '@/components/dashboard/HeroBanner'
import ModuleCard, { MODULES } from '@/components/dashboard/ModuleCard'
import FavoritesPanel from '@/components/dashboard/FavoritesPanel'
import RecentPanel from '@/components/dashboard/RecentPanel'
import SystemInfoPanel from '@/components/dashboard/SystemInfoPanel'
import { IntelligenceWidget } from '@/components/intelligence/IntelligenceWidget'

const MOCK_RECOMMENDATIONS = [
  { id: '1', reportName: 'Stok Persediaan per Gudang', module: 'Procurement / Inventory', reason: 'similar' as const, reasonText: 'Report Inventory live siap dibuka', confidence: 0.92, subtitle: 'Gudang PG1A' },
  { id: '2', reportName: 'Produktivitas Panen Harian', module: 'Financial', reason: 'updated' as const, reasonText: 'Masuk ke sub-modul Produktivitas', confidence: 0.85, subtitle: 'DME Estate', timestamp: '30 menit lalu' },
  { id: '3', reportName: 'Rekap Lembur Mingguan', module: 'Human Resources', reason: 'due' as const, reasonText: 'Masuk ke sub-modul Lembur', confidence: 0.95, timestamp: 'Besok' },
  { id: '4', reportName: 'Budget vs Actual', module: 'Budget', reason: 'time_based' as const, reasonText: 'Katalog budget siap ditinjau', confidence: 0.78 },
]

export default function ReportCenterPage() {
  const [insightsOpen, setInsightsOpen] = useState(false)

  return (
    <>
      <GlobalSearch />
      <div className="mx-auto max-w-screen-2xl space-y-5 px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <HeroBanner />

        <section id="modules" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Report families</p>
              <h2 className="mt-1 text-base font-bold text-[var(--rc-text)]">Modul Laporan Lengkap</h2>
            </div>
            <span className="rounded-full border border-[var(--rc-border)] px-3 py-1 text-xs font-semibold text-[var(--rc-text-muted)]">
              {MODULES.length} modul utama
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {MODULES.map((mod) => (
              <ModuleCard key={mod.id} module={mod} className="h-full" />
            ))}
          </div>
        </section>

        <section className="rc-panel overflow-hidden rounded-3xl">
          <button
            type="button"
            onClick={() => setInsightsOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/5"
            aria-expanded={insightsOpen}
          >
            <span>
              <span className="block text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Insight tambahan</span>
              <span className="mt-1 block text-sm font-semibold text-[var(--rc-text)]">
                Rekomendasi, favorit, recent, dan status sistem
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
                onSelect={(rec) => console.log('Selected:', rec.reportName)}
              />
              <div id="favorites" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <FavoritesPanel />
                <RecentPanel />
                <SystemInfoPanel />
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
