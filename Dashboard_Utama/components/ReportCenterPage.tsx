'use client'

import { motion } from 'framer-motion'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import HeroBanner from '@/components/dashboard/HeroBanner'
import ModuleCard, { MODULES } from '@/components/dashboard/ModuleCard'
import GlobalSearch from '@/components/dashboard/GlobalSearch'
import FavoritesPanel from '@/components/dashboard/FavoritesPanel'
import RecentPanel from '@/components/dashboard/RecentPanel'
import SystemInfoPanel from '@/components/dashboard/SystemInfoPanel'
import { IntelligenceWidget } from '@/components/intelligence/IntelligenceWidget'
import { useReportStore } from '@/store/reportStore'

const MOCK_RECOMMENDATIONS = [
  { id: '1', reportName: 'Stok Persediaan per Gudang', module: 'Procurement / Inventory', reason: 'similar' as const, reasonText: 'Report Inventory live siap dibuka', confidence: 0.92, subtitle: 'Gudang PG1A' },
  { id: '2', reportName: 'Produktivitas Panen Harian', module: 'Financial', reason: 'updated' as const, reasonText: 'Masuk ke sub-modul Produktivitas', confidence: 0.85, subtitle: 'DME Estate', timestamp: '30 menit lalu' },
  { id: '3', reportName: 'Rekap Lembur Mingguan', module: 'Human Resources', reason: 'due' as const, reasonText: 'Masuk ke sub-modul Lembur', confidence: 0.95, timestamp: 'Besok' },
  { id: '4', reportName: 'Budget vs Actual', module: 'Budget', reason: 'time_based' as const, reasonText: 'Katalog budget siap ditinjau', confidence: 0.78 },
]

export default function ReportCenterPage() {
  const { sidebarCollapsed } = useReportStore()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <motion.main
          key={sidebarCollapsed ? 'collapsed' : 'expanded'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex-1 overflow-y-auto"
        >
          <GlobalSearch />
          <div className="mx-auto max-w-screen-xl px-4 pb-10 sm:px-6 lg:px-8">
            <section className="pt-6">
              <HeroBanner />
            </section>
            <section className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-800">Modul Laporan</h2>
                <span className="text-xs text-slate-400">4 modul utama</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {MODULES.map((mod) => (
                  <ModuleCard key={mod.id} module={mod} className="h-full" />
                ))}
              </div>
            </section>
            <section className="mb-8">
              <IntelligenceWidget
                recommendations={MOCK_RECOMMENDATIONS}
                onSelect={(rec) => console.log('Selected:', rec.reportName)}
              />
            </section>
            <section>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FavoritesPanel />
                <RecentPanel />
                <SystemInfoPanel />
              </div>
            </section>
          </div>
        </motion.main>
      </div>
    </div>
  )
}
