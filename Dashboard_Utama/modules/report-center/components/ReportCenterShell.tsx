'use client'

import { motion } from 'framer-motion'
import Sidebar from '@/modules/report-center/components/layout/Sidebar'
import Topbar from '@/modules/report-center/components/layout/Topbar'
import { useReportStore } from '@/modules/report-center/store/reportStore'

const REPORT_CENTER_THEME_V2 = process.env.NEXT_PUBLIC_REPORT_CENTER_THEME_V2 !== 'false'

export default function ReportCenterShell({
  children,
}: {
  children: React.ReactNode
}) {
  const { sidebarCollapsed } = useReportStore()

  return (
    <div className={`report-center-dark rc-shell ${REPORT_CENTER_THEME_V2 ? 'report-center-forest' : ''} flex h-screen overflow-hidden bg-[var(--rc-bg)] text-[var(--rc-text)]`}>
      <Sidebar />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_0%,rgba(16,185,129,0.11),transparent_28rem)]" />
        <Topbar />
        <motion.main
          key={sidebarCollapsed ? 'collapsed' : 'expanded'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="rc-scroll-root relative flex-1 overflow-y-auto"
        >
          {children}
        </motion.main>
      </div>
    </div>
  )
}
