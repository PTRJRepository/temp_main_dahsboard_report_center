'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronLeft, Database, Globe2, Menu, Search } from 'lucide-react'
import { usePathname } from 'next/navigation'

const LABELS: Record<string, string> = {
  inventory: 'Inventory',
  absensi: 'Absensi',
  payroll: 'Payroll',
  'daftar-upah': 'Daftar Upah',
  premi: 'Premi & Lembur',
  produktivitas: 'Produktivitas Kebun',
  karyawan: 'Karyawan',
  estate: 'Estate / Divisi',
  integrasi: 'Integrasi & Audit',
}

type UserProfile = {
  name?: string
  email?: string
  role?: string
}

type ReportSource = 'estate' | 'pabrik'

const REPORT_SOURCE_STORAGE_KEY = 'report-center:last-source'
const REPORT_SOURCES: Array<{ id: ReportSource; label: string; shortLabel: string; description: string }> = [
  { id: 'estate', label: 'Estate / Kebun', shortLabel: 'Estate', description: 'SERVER_PROFILE_2 / db_ptrj' },
  { id: 'pabrik', label: 'Pabrik', shortLabel: 'Pabrik', description: 'SERVER_PROFILE_3 / db_ptrj_mill' },
]

function roleLabel(role?: string) {
  const normalized = String(role ?? '').trim().toLowerCase()
  const labels: Record<string, string> = {
    admin: 'Administrator',
    administrator: 'Administrator',
    kerani: 'Kerani',
    hr: 'HR Staff',
    payroll: 'Payroll Staff',
    mngr: 'Manager',
    manager: 'Manager',
    asisten: 'Asisten',
    mandor: 'Mandor',
    visitor: 'Visitor',
    superadmin: 'Super Administrator',
  }
  return labels[normalized] ?? (role ? String(role).trim() : 'Administrator')
}

function normalizeSource(value: string | null): ReportSource {
  return value === 'pabrik' ? 'pabrik' : 'estate'
}

function sourceLabel(source: ReportSource) {
  return REPORT_SOURCES.find((item) => item.id === source)?.label ?? REPORT_SOURCES[0].label
}

function readStoredUser() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem('user')
    if (!raw) return null
    return JSON.parse(raw) as UserProfile
  } catch {
    return null
  }
}

function displayName(user: UserProfile | null) {
  return user?.name || user?.email || roleLabel(user?.role)
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return value.slice(0, 2).toUpperCase()
}

function pageTitle(pathname: string) {
  if (pathname === '/report-center' || pathname === '/report-center/') return ['Dashboard Report', 'Pusat akses laporan perusahaan']
  const parts = pathname.replace('/report-center/', '').split('/').filter(Boolean)
  const last = parts[parts.length - 1]
  return [LABELS[last] ?? last?.replace(/-/g, ' ') ?? 'Dashboard Report', 'Pusat akses laporan perusahaan']
}

export default function Topbar() {
  const pathname = usePathname()
  const searchRef = useRef<HTMLInputElement>(null)
  const [currentUser] = useState<UserProfile | null>(() => readStoredUser())
  const [reportSource, setReportSource] = useState<ReportSource>(() => {
    if (typeof window === 'undefined') return 'estate'
    const params = new URLSearchParams(window.location.search)
    return normalizeSource(params.get('source') ?? window.localStorage.getItem(REPORT_SOURCE_STORAGE_KEY))
  })
  const [title, subtitle] = pageTitle(pathname)
  const name = displayName(currentUser)
  const role = roleLabel(currentUser?.role)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
        window.dispatchEvent(new CustomEvent('report-center-open-search'))
      }
    }
    window.addEventListener('keydown', handler)
    const handleSourceChange = (event: Event) => {
      setReportSource(normalizeSource((event as CustomEvent<string>).detail))
    }
    window.addEventListener('report-center-source-change', handleSourceChange)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('report-center-source-change', handleSourceChange)
    }
  }, [])

  const openSidebar = () => document.getElementById('mobile-sidebar-opener')?.click()

  const selectSource = (source: ReportSource) => {
    setReportSource(source)
    window.localStorage.setItem(REPORT_SOURCE_STORAGE_KEY, source)
    window.dispatchEvent(new CustomEvent('report-center-source-change', { detail: source }))
    if (pathname.startsWith('/report-center')) {
      const params = new URLSearchParams(window.location.search)
      params.set('source', source)
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`)
    }
  }

  const openGlobalSearch = () => {
    window.dispatchEvent(new CustomEvent('report-center-open-search'))
    searchRef.current?.blur()
  }

  return (
    <header className="sticky top-0 z-30 flex h-[78px] shrink-0 items-center gap-4 border-b border-[var(--rc-border)] bg-[#0b1018]/92 px-4 text-[var(--rc-text)] shadow-none backdrop-blur-xl lg:px-7">
      <button
        type="button"
        onClick={openSidebar}
        className="rounded-xl p-2 text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)] lg:hidden"
        aria-label="Buka sidebar"
      >
        <Menu size={20} />
      </button>

      <div className="flex min-w-[220px] items-center gap-3">
        <button
          type="button"
          className="hidden h-10 w-10 place-items-center rounded-xl border border-[var(--rc-border)] bg-white/5 text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)] lg:grid"
          aria-label="Navigasi"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-bold leading-tight text-[#0F172A]">{title}</h1>
          <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="hidden flex-1 justify-center md:flex">
        <div className="relative w-full max-w-[530px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            type="search"
            placeholder="Cari laporan, kategori, atau kata kunci..."
            onFocus={openGlobalSearch}
            onClick={openGlobalSearch}
            className="h-[42px] w-full rounded-xl border border-[var(--rc-border)] bg-[#0f172a]/90 pl-10 pr-20 text-sm font-medium text-[var(--rc-text)] outline-none placeholder:text-[var(--rc-text-faint)] focus:border-[var(--rc-accent)] focus:ring-4 focus:ring-amber-500/10"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
            Ctrl + K
          </kbd>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="hidden h-[42px] items-center gap-2 rounded-xl border border-[var(--rc-border)] bg-white/5 px-3 text-sm font-semibold text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)] sm:inline-flex"
        >
          <Globe2 size={16} />
          ID
        </button>
        <button
          type="button"
          className="relative grid h-[42px] w-[42px] place-items-center rounded-xl border border-[var(--rc-border)] bg-white/5 text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)]"
          aria-label="Notification"
        >
          <Bell size={18} />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[var(--rc-accent)]" />
        </button>
        <div className="hidden h-[42px] items-center rounded-xl border border-[var(--rc-border)] bg-white/5 p-1 shadow-none lg:flex">
          {REPORT_SOURCES.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => selectSource(source.id)}
              title={source.description}
              className={[
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-extrabold transition',
                reportSource === source.id
                  ? 'bg-[var(--rc-accent)] text-slate-950 shadow-none'
                  : 'text-[var(--rc-text-muted)] hover:bg-white/10 hover:text-[var(--rc-text)]',
              ].join(' ')}
            >
              <Database size={13} />
              {source.shortLabel}
            </button>
          ))}
        </div>
        <div className="flex h-[42px] items-center gap-3 rounded-xl border border-[var(--rc-border)] bg-white/5 px-2.5 pr-3 hover:bg-white/10">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--rc-accent)] text-xs font-bold text-slate-950">{initials(name)}</span>
          <span className="hidden text-left lg:block">
            <span className="block text-sm font-bold leading-tight text-slate-900">{name}</span>
            <span className="block text-[11px] font-medium text-slate-500">{role} · {sourceLabel(reportSource)}</span>
          </span>
        </div>
      </div>
    </header>
  )
}
