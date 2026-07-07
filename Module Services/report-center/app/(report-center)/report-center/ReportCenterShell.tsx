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
          {children}
        </motion.main>
      </div>
    </div>
  )
}
