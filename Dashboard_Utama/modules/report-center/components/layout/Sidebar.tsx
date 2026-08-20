'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Grid2X2,
  HelpCircle,
  Home,
  LogOut,
  Menu,
  Package,
  Settings,
  Star,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useReportStore } from '@/modules/report-center/store/reportStore'
import { useAuth } from '@/modules/report-center/components/AuthProvider'

type NavItem = {
  label: string
  subtitle: string
  href: string
  icon: React.ReactNode
}

type NavGroup = {
  title?: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        label: 'Dashboard Report',
        subtitle: 'Ringkasan & akses cepat',
        href: '/report-center',
        icon: <Home size={18} />,
      },
    ],
  },
  {
    title: 'MODUL UTAMA',
    items: [
      { label: 'Procurement', subtitle: 'Inventory live', href: '/report-center?module=procurement#modules', icon: <Package size={18} /> },
      { label: 'Financial', subtitle: 'Produktivitas & efisiensi', href: '/report-center?module=financial#modules', icon: <Wallet size={18} /> },
      { label: 'Human Resources', subtitle: 'Payroll, upah, premi, lembur', href: '/report-center?module=human-resources#modules', icon: <UserCheck size={18} /> },
      { label: 'Budget', subtitle: 'Budget, realisasi, variance', href: '/report-center?module=budget#modules', icon: <BarChart3 size={18} /> },
    ],
  },
  {
    title: 'REPORT CEPAT',
    items: [
      { label: 'Inventory Live', subtitle: 'Report real yang sudah aktif', href: '/report-center/inventory', icon: <FileText size={18} /> },
      { label: 'Daftar Laporan', subtitle: 'Semua sub-modul report', href: '/report-center#modules', icon: <Grid2X2 size={18} /> },
      { label: 'Favorit Saya', subtitle: 'Laporan yang disimpan', href: '/report-center#favorites', icon: <Star size={18} /> },
    ],
  },
  {
    title: 'PENGELOLAAN',
    items: [
      { label: 'Integrasi Data', subtitle: 'Status & sinkronisasi data', href: '/report-center#integration', icon: <Database size={18} /> },
      { label: 'Pengaturan', subtitle: 'Pengaturan laporan & akses', href: '/report-center#settings', icon: <Settings size={18} /> },
    ],
  },
]

const REPORT_SOURCE_STORAGE_KEY = 'report-center:last-source'

function normalizeReportSource(value: string | null) {
  return value === 'pabrik' ? 'pabrik' : 'estate'
}

export default function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sourceParam = searchParams.get('source')
  const { sidebarCollapsed, toggleSidebar } = useReportStore()
  const { logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [reportSource, setReportSource] = useState(() => normalizeReportSource(sourceParam))

  useEffect(() => {
    window.queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search)
      const source = params.get('source') ?? window.localStorage.getItem(REPORT_SOURCE_STORAGE_KEY)
      setReportSource(normalizeReportSource(source))
    })
    const handleSourceChange = (event: Event) => {
      const source = (event as CustomEvent<string>).detail
      setReportSource(normalizeReportSource(source))
    }
    window.addEventListener('report-center-source-change', handleSourceChange)
    return () => window.removeEventListener('report-center-source-change', handleSourceChange)
  }, [sourceParam])

  const isActive = (href: string) => {
    const path = href.split('#')[0]
    if (href.includes('#')) return false
    return path === '/report-center' ? pathname === '/report-center' || pathname === '/report-center/' : pathname.startsWith(path)
  }

  const hrefWithSource = (href: string) => {
    if (!href.startsWith('/report-center')) return href
    const [beforeHash, hash] = href.split('#')
    const [path, query = ''] = beforeHash.split('?')
    const params = new URLSearchParams(query)
    params.set('source', reportSource)
    const queryString = params.toString()
    return `${path}${queryString ? `?${queryString}` : ''}${hash ? `#${hash}` : ''}`
  }

  const navContent = (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0b1018] via-[#090d14] to-[#06080d] text-white">
      <div className="flex min-h-[78px] items-center gap-3 border-b border-white/10 px-4">
        <div className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
          <FileText size={19} className="text-amber-300" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-wide">PT REBINMAS JAYA</p>
            <p className="mt-0.5 text-[11px] font-semibold tracking-[0.2em] text-slate-400">REPORT PORTAL</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Tutup sidebar"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <div className="space-y-6">
          {NAV_GROUPS.map((group, groupIndex) => (
            <section key={group.title ?? `main-${groupIndex}`}>
              {!sidebarCollapsed && group.title && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {group.title}
                </p>
              )}
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const active = isActive(item.href)
                  const href = hrefWithSource(item.href)
                  return (
                    <Link
                      key={`${group.title ?? 'main'}-${item.label}`}
                      href={href}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={[
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                        active
                          ? 'bg-amber-500/10 text-white shadow-none ring-1 ring-amber-400/25 before:absolute before:left-0 before:top-2 before:h-[calc(100%-16px)] before:w-1 before:rounded-r before:bg-amber-400'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white',
                        sidebarCollapsed ? 'justify-center' : '',
                      ].join(' ')}
                    >
                      <span className={active ? 'text-white' : 'text-slate-400 group-hover:text-white'}>{item.icon}</span>
                      {!sidebarCollapsed && (
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{item.label}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-slate-400">{item.subtitle}</span>
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </nav>

      <div className="space-y-3 border-t border-white/10 px-3 py-4">
        {!sidebarCollapsed && (
          <div className="rounded-[14px] bg-gradient-to-br from-amber-500/20 to-white/5 p-4 ring-1 ring-amber-300/15">
            <div className="flex items-center justify-between gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">
                <HelpCircle size={18} />
              </div>
              <ChevronRight size={18} className="text-amber-100" />
            </div>
            <p className="mt-3 text-sm font-semibold">Butuh bantuan?</p>
            <p className="mt-1 text-xs leading-5 text-amber-100/75">Lihat panduan atau hubungi tim</p>
          </div>
        )}

        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] border border-white/15 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} />Sembunyikan Menu</>}
        </button>
        <button
          type="button"
          onClick={() => logout?.()}
          className="flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] border border-white/15 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <LogOut size={18} />
          {!sidebarCollapsed && 'Logout'}
        </button>
        {!sidebarCollapsed && <p className="px-2 text-[11px] font-medium text-slate-500">Report Portal v2.0.0</p>}
      </div>
    </div>
  )

  return (
    <>
      <motion.aside
        animate={{ width: sidebarCollapsed ? 84 : 250 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="hidden h-screen shrink-0 border-r border-[var(--rc-border)] bg-[#0b1018] lg:block"
      >
        {navContent}
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-950/55 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -290 }}
              animate={{ x: 0 }}
              exit={{ x: -290 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed inset-y-0 left-0 z-50 w-[288px] lg:hidden"
            >
              {navContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <button
        id="mobile-sidebar-opener"
        type="button"
        onClick={() => setMobileOpen(true)}
        className="hidden"
        aria-label="Buka sidebar"
      >
        <Menu size={20} />
      </button>
    </>
  )
}
