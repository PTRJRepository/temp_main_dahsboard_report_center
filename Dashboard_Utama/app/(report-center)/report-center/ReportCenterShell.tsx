'use client'

import { motion } from 'framer-motion'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { useReportStore } from '@/store/reportStore'

export default function ReportCenterShell({
  children,
}: {
  children: React.ReactNode
}) {
  const { sidebarCollapsed } = useReportStore()

  return (
    <div className="report-center-dark flex h-screen overflow-hidden bg-[var(--rc-bg)] text-[var(--rc-text)]">
      <Sidebar />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_0%,rgba(245,158,11,0.1),transparent_28rem)]" />
        <Topbar />
        <motion.main
          key={sidebarCollapsed ? 'collapsed' : 'expanded'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative flex-1 overflow-y-auto"
        >
          {children}
        </motion.main>
      </div>
    </div>
  )
}
