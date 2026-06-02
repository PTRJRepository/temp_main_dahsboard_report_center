'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  Box,
  Building2,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Download,
  FileBadge,
  FileSpreadsheet,
  FileText,
  Leaf,
  Package,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  UserCheck,
  Wallet,
  Warehouse,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import GlobalSearch from '@/components/dashboard/GlobalSearch'
import { liveInventoryReports } from '@/lib/reports/inventory/config'
import {
  createInventoryInsightFromPayload,
  hasInventoryQueryData,
  type InventoryQueryPayload,
} from '@/lib/reports/inventory/monitoring'
import type { InsightContent } from '@/lib/reports/intelligence'
import { useReportStore } from '@/store/reportStore'

type ModuleId =
  | 'procurement'
  | 'financial'
  | 'human-resources'
  | 'budget'

type ReportPreviewStatus = 'Live' | 'Update' | 'Preview' | 'Draft'

type SubModuleReport = {
  id: string
  title: string
  description: string
  category: string
  status: ReportPreviewStatus
  cadence: string
  owner: string
  href?: string
  previewHref?: string
}

type SubModule = {
  id: string
  name: string
  description: string
  reportCount: number
  status: string
  icon: LucideIcon
  color: string
  soft: string
  available: boolean
  href?: string
  reports: SubModuleReport[]
}

type ModuleReportCard = SubModuleReport & {
  moduleId: ModuleId
  moduleName: string
  subModuleName: string
  subModuleColor: string
  subModuleSoft: string
}

type ReportSource = 'estate' | 'pabrik'

type UserProfile = {
  name?: string
  email?: string
  role?: string
  division?: string
  divisi?: string
}

type ModuleTile = {
  id: ModuleId
  name: string
  description: string
  reportCount: number
  status: string
  icon: LucideIcon
  color: string
  soft: string
  available: boolean
  sparkline: number[]
  subModules: SubModule[]
}

type InventoryApiResponse = {
  success: boolean
  data?: InventoryQueryPayload
  error?: string
}

type SystemStatus = {
  success?: boolean
  gatewayOnline?: boolean
  activeSource?: ReportSource
  activeServer?: string
  activeDatabase?: string
  activeConnected?: boolean
  activeHealthy?: boolean
  sources?: Array<{
    source: ReportSource
    label: string
    server: string
    database: string
    connected: boolean
    healthy: boolean
  }>
  checkedAt?: string
  error?: string
}

const MODULES: ModuleTile[] = [
  {
    id: 'procurement',
    name: 'Procurement',
    description: 'Inventory live',
    reportCount: liveInventoryReports.length,
    status: 'Inventory live',
    icon: Package,
    color: '#159947',
    soft: '#EAF7EF',
    available: true,
    sparkline: [42, 58, 51, 72, 64, 86, 78],
    subModules: [
      {
        id: 'inventory',
        name: 'Inventory',
        description: 'Report stok, mutasi, reorder, aging, fuel, dan workshop yang sudah live.',
        reportCount: liveInventoryReports.length,
        status: 'Live',
        icon: Box,
        color: '#159947',
        soft: '#EAF7EF',
        available: true,
        href: '/report-center/inventory',
        reports: liveInventoryReports.map((report) => ({
          id: report.id,
          title: report.title,
          description: report.description,
          category: report.groupTitle,
          status: report.status === 'live' ? 'Live' : 'Update',
          cadence: report.cadence,
          owner: report.owner,
          href: `/report-center/inventory/${report.id}`,
          previewHref: `/report-center/inventory?report=${report.id}`,
        })),
      },
    ],
  },
  {
    id: 'financial',
    name: 'Financial',
    description: 'Produktivitas & efisiensi biaya',
    reportCount: 16,
    status: 'Preview catalog',
    icon: Wallet,
    color: '#2563EB',
    soft: '#EAF2FF',
    available: false,
    sparkline: [32, 48, 52, 44, 58, 63, 68],
    subModules: [
      {
        id: 'produktivitas',
        name: 'Produktivitas',
        description: 'Produktivitas panen, tonase, HK, dan efisiensi per unit.',
        reportCount: 16,
        status: 'Preview',
        icon: Leaf,
        color: '#0D9488',
        soft: '#E6FFFB',
        available: false,
        reports: [
          {
            id: 'fin-produktivitas-harian',
            title: 'Produktivitas Panen Harian',
            description: 'Tonase, HK realisasi, dan output per HK untuk monitoring performa.',
            category: 'Productivity',
            status: 'Preview',
            cadence: 'Harian',
            owner: 'Estate Finance',
          },
          {
            id: 'fin-cost-per-kg',
            title: 'Cost per KG',
            description: 'Biaya produksi per kilogram berdasarkan estate, divisi, dan periode.',
            category: 'Cost Efficiency',
            status: 'Preview',
            cadence: 'Bulanan',
            owner: 'Finance',
          },
          {
            id: 'fin-manhour-efficiency',
            title: 'Efisiensi Man Hour',
            description: 'Rasio output terhadap jam kerja untuk melihat produktivitas tenaga kerja.',
            category: 'Efficiency',
            status: 'Preview',
            cadence: 'Mingguan',
            owner: 'Management',
          },
        ],
      },
    ],
  },
  {
    id: 'human-resources',
    name: 'Human Resources',
    description: 'Payroll, upah, premi, lembur',
    reportCount: 94,
    status: '8 sub-modul',
    icon: UserCheck,
    color: '#DB2777',
    soft: '#FCE7F3',
    available: false,
    sparkline: [74, 78, 76, 80, 79, 82, 84],
    subModules: [
      {
        id: 'payroll',
        name: 'Payroll',
        description: 'Penggajian, potongan, transfer bank, dan BPJS.',
        reportCount: 24,
        status: 'Preview',
        icon: Wallet,
        color: '#7C3AED',
        soft: '#F3E8FF',
        available: false,
        reports: [
          {
            id: 'hr-payroll-summary',
            title: 'Rekap Penggajian Bulanan',
            description: 'Ringkasan payroll per periode, unit kerja, komponen, dan potongan.',
            category: 'Payroll',
            status: 'Preview',
            cadence: 'Bulanan',
            owner: 'Payroll',
          },
        ],
      },
      {
        id: 'daftar-upah',
        name: 'Daftar Upah',
        description: 'Upah harian, HK, borongan, dan komponen upah estate.',
        reportCount: 15,
        status: 'Preview',
        icon: FileBadge,
        color: '#D99A00',
        soft: '#FFF4D6',
        available: false,
        reports: [
          {
            id: 'hr-daftar-upah',
            title: 'Daftar Upah Reguler',
            description: 'Daftar upah per karyawan, mandor, blok, dan periode kerja.',
            category: 'Wages',
            status: 'Preview',
            cadence: 'Harian',
            owner: 'Estate Payroll',
          },
        ],
      },
      {
        id: 'absensi',
        name: 'Absensi',
        description: 'Kehadiran, cuti, checkroll, dan validasi HK.',
        reportCount: 18,
        status: 'Preview',
        icon: UserCheck,
        color: '#2563EB',
        soft: '#EAF2FF',
        available: false,
        reports: [
          {
            id: 'hr-absensi-harian',
            title: 'Daftar Hadir Harian',
            description: 'Kehadiran karyawan harian untuk validasi HK dan payroll.',
            category: 'Attendance',
            status: 'Preview',
            cadence: 'Harian',
            owner: 'HRD',
          },
        ],
      },
      {
        id: 'premi',
        name: 'Premi',
        description: 'Premi produksi, premi panen, dan insentif pekerja.',
        reportCount: 12,
        status: 'Preview',
        icon: Award,
        color: '#DB2777',
        soft: '#FCE7F3',
        available: false,
        reports: [
          {
            id: 'hr-premi-produksi',
            title: 'Premi Produktivitas',
            description: 'Bonus produksi berdasarkan pencapaian target yield dan output.',
            category: 'Incentive',
            status: 'Preview',
            cadence: 'Mingguan',
            owner: 'Estate Management',
          },
        ],
      },
      {
        id: 'lembur',
        name: 'Lembur',
        description: 'Jam lembur, biaya lembur, dan validasi OT per periode.',
        reportCount: 5,
        status: 'Preview',
        icon: Clock,
        color: '#EA580C',
        soft: '#FFEDD5',
        available: false,
        reports: [
          {
            id: 'hr-lembur-mingguan',
            title: 'Rekap Lembur Mingguan',
            description: 'Jam lembur dan biaya OT per karyawan, unit, dan minggu berjalan.',
            category: 'Overtime',
            status: 'Preview',
            cadence: 'Mingguan',
            owner: 'Payroll',
          },
        ],
      },
      {
        id: 'summary-report',
        name: 'Summary Report',
        description: 'Rekap HR lintas payroll, upah, absensi, dan lembur.',
        reportCount: 9,
        status: 'Preview',
        icon: BarChart3,
        color: '#0D9488',
        soft: '#E6FFFB',
        available: false,
        reports: [
          {
            id: 'hr-summary-report',
            title: 'Summary Report Wages',
            description: 'Ringkasan komponen upah, HK, premi, lembur, dan gap validasi.',
            category: 'Summary',
            status: 'Preview',
            cadence: 'Bulanan',
            owner: 'HR Analytics',
          },
        ],
      },
      {
        id: 'wages',
        name: 'Wages Comparison',
        description: 'Perbandingan upah antar periode, unit, dan jenis pekerjaan.',
        reportCount: 6,
        status: 'Preview',
        icon: Scale,
        color: '#EF4444',
        soft: '#FEE2E2',
        available: false,
        reports: [
          {
            id: 'hr-wages-comparison',
            title: 'Wages Comparison',
            description: 'Perbandingan upah aktual vs periode sebelumnya dan target biaya.',
            category: 'Comparison',
            status: 'Preview',
            cadence: 'Bulanan',
            owner: 'HR Finance',
          },
        ],
      },
      {
        id: 'dampak-report',
        name: 'Dampak Report',
        description: 'Analisis dampak perubahan upah, premi, lembur, dan absensi.',
        reportCount: 5,
        status: 'Preview',
        icon: TrendingUp,
        color: '#64748B',
        soft: '#F1F5F9',
        available: false,
        reports: [
          {
            id: 'hr-dampak-report',
            title: 'Dampak Report',
            description: 'Analisis dampak biaya dan produktivitas dari perubahan komponen HR.',
            category: 'Impact Analysis',
            status: 'Preview',
            cadence: 'Bulanan',
            owner: 'Management',
          },
        ],
      },
    ],
  },
  {
    id: 'budget',
    name: 'Budget',
    description: 'Budget, realisasi, variance',
    reportCount: 12,
    status: 'Preview catalog',
    icon: BarChart3,
    color: '#D99A00',
    soft: '#FFF4D6',
    available: false,
    sparkline: [34, 43, 41, 55, 61, 58, 69],
    subModules: [
      {
        id: 'budget-planning',
        name: 'Budget Planning',
        description: 'Rencana budget per unit, akun biaya, dan periode.',
        reportCount: 4,
        status: 'Preview',
        icon: FileText,
        color: '#D99A00',
        soft: '#FFF4D6',
        available: false,
        reports: [
          {
            id: 'budget-plan-summary',
            title: 'Budget Plan Summary',
            description: 'Ringkasan rencana budget per unit kerja dan kategori biaya.',
            category: 'Planning',
            status: 'Preview',
            cadence: 'Tahunan',
            owner: 'Budget Control',
          },
        ],
      },
      {
        id: 'budget-realization',
        name: 'Budget Realization',
        description: 'Realisasi budget, sisa budget, dan kontrol pemakaian.',
        reportCount: 4,
        status: 'Preview',
        icon: Wallet,
        color: '#2563EB',
        soft: '#EAF2FF',
        available: false,
        reports: [
          {
            id: 'budget-actual',
            title: 'Budget vs Actual',
            description: 'Realisasi biaya dibanding budget per periode dan unit.',
            category: 'Realization',
            status: 'Preview',
            cadence: 'Bulanan',
            owner: 'Finance',
          },
        ],
      },
      {
        id: 'budget-variance',
        name: 'Variance Analysis',
        description: 'Analisis deviasi budget untuk tindakan korektif.',
        reportCount: 4,
        status: 'Preview',
        icon: TrendingUp,
        color: '#EA580C',
        soft: '#FFEDD5',
        available: false,
        reports: [
          {
            id: 'budget-variance-report',
            title: 'Budget Variance Report',
            description: 'Deviasi realisasi terhadap budget dengan highlight akun kritis.',
            category: 'Variance',
            status: 'Preview',
            cadence: 'Bulanan',
            owner: 'Management',
          },
        ],
      },
    ],
  },
]

const QUICK_FILTERS = ['Bulan Ini', 'Bulan Lalu', 'Q2 2026', 'YTD 2026', 'Semua Divisi', 'Semua Kebun']
const REPORT_SOURCES: Array<{ id: ReportSource; label: string; description: string }> = [
  { id: 'estate', label: 'Estate / Kebun', description: 'SERVER_PROFILE_2 / db_ptrj' },
  { id: 'pabrik', label: 'Pabrik', description: 'SERVER_PROFILE_3 / db_ptrj_mill' },
]
const REPORT_SOURCE_STORAGE_KEY = 'report-center:last-source'
const REPORT_MODULE_STORAGE_KEY = 'report-center:last-module'

async function fetchInventoryPayload(source: ReportSource) {
  const params = new URLSearchParams({ report: 'stok-gudang', limit: '80', source })
  const response = await fetch(`/api/reports/inventory?${params.toString()}`, { cache: 'no-store' })
  const result = (await response.json()) as InventoryApiResponse
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error ?? 'Gagal memuat real data inventory')
  }
  return result.data
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function firstMetric(summary: Record<string, unknown> | undefined, keys: string[], fallback = 0) {
  if (!summary) return fallback
  for (const key of keys) {
    if (summary[key] !== undefined && summary[key] !== null) return toNumber(summary[key])
  }
  return fallback
}

function formatMetric(value: number) {
  if (!value) return '-'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}M`
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}K`
  return value.toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

function formatDateTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function sourceLabel(source: ReportSource) {
  return REPORT_SOURCES.find((item) => item.id === source)?.label ?? 'Estate / Kebun'
}

function sourceDescription(source: ReportSource) {
  return REPORT_SOURCES.find((item) => item.id === source)?.description ?? 'SERVER_PROFILE_2 / db_ptrj'
}

function normalizeSource(value: string | null): ReportSource {
  return value === 'pabrik' ? 'pabrik' : 'estate'
}

function isModuleId(value: string | null): value is ModuleId {
  return MODULES.some((module) => module.id === value)
}

function withSource(href: string, source: ReportSource) {
  const separator = href.includes('?') ? '&' : '?'
  return `${href}${separator}source=${source}`
}

function buildModuleReports(module: ModuleTile): ModuleReportCard[] {
  return module.subModules.flatMap((subModule) =>
    subModule.reports.map((report) => ({
      ...report,
      moduleId: module.id,
      moduleName: module.name,
      subModuleName: subModule.name,
      subModuleColor: subModule.color,
      subModuleSoft: subModule.soft,
    })),
  )
}

function reportMatchesQuery(report: ModuleReportCard, q: string) {
  return [
    report.id,
    report.title,
    report.description,
    report.category,
    report.status,
    report.cadence,
    report.owner,
    report.moduleName,
    report.subModuleName,
  ].some((value) => value.toLowerCase().includes(q))
}

function reportStatusClass(status: ReportPreviewStatus) {
  switch (status) {
    case 'Live':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'Update':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'Draft':
      return 'border-slate-200 bg-slate-50 text-slate-500'
    default:
      return 'border-blue-200 bg-blue-50 text-blue-700'
  }
}

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

function userDisplayName(user: UserProfile | null) {
  return user?.name || user?.email || 'Pengguna'
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

function reportScope(source: ReportSource) {
  return source === 'pabrik' ? 'Pabrik' : 'Estate / Kebun'
}

function accessLevel(source: ReportSource) {
  return source === 'pabrik' ? 'Partial Access' : 'Full Access'
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(1, ...data)
  return (
    <div className="flex h-9 items-end gap-1">
      {data.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="w-1.5 rounded-full"
          style={{ height: `${Math.max(7, (value / max) * 34)}px`, backgroundColor: color, opacity: 0.35 + index * 0.07 }}
        />
      ))}
    </div>
  )
}

function ModuleTileCard({
  module,
  active,
  onSelect,
}: {
  module: ModuleTile
  active: boolean
  onSelect: (id: ModuleId) => void
}) {
  const Icon = module.icon
  return (
    <button
      type="button"
      onClick={() => onSelect(module.id)}
      className={[
        'group min-h-[140px] min-w-[224px] rounded-2xl border bg-white p-4 text-left shadow-[0_4px_16px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.14)]',
        active ? 'border-[#159947] shadow-[0_0_0_2px_rgba(21,153,71,0.35),0_12px_28px_rgba(21,153,71,0.18)]' : 'border-[#E2E8F0]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ backgroundColor: module.soft, color: module.color }}>
          <Icon size={23} />
        </span>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{
            backgroundColor: module.available ? '#EAF7EF' : '#F1F5F9',
            color: module.available ? '#159947' : '#64748B',
          }}
        >
          {module.available ? 'Live' : 'Katalog'}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-bold text-[#0F172A]">{module.name}</h3>
          <p className="mt-1 truncate text-[12px] font-medium text-[#64748B]">{module.description}</p>
          <p className="mt-2 text-[11px] font-bold text-[#475569]">{module.subModules.length} sub-modul · {module.reportCount} laporan</p>
        </div>
        <Sparkline data={module.sparkline} color={module.color} />
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-[#64748B]">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: module.available ? '#22C55E' : '#CBD5E1' }} />
        {module.status}
      </div>
    </button>
  )
}

function SubModuleCard({
  subModule,
  source,
}: {
  subModule: SubModule
  source: ReportSource
}) {
  const Icon = subModule.icon
  const href = subModule.href ? withSource(subModule.href, source) : null

  return (
    <article className="group min-h-[184px] rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ backgroundColor: subModule.soft, color: subModule.color }}>
          <Icon size={23} />
        </span>
        <span
          className={[
            'rounded-full border px-2.5 py-1 text-[11px] font-bold',
            subModule.available ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500',
          ].join(' ')}
        >
          {subModule.status}
        </span>
      </div>
      <h3 className="mt-4 text-base font-extrabold text-slate-950">{subModule.name}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{subModule.description}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <span className="text-xs font-bold text-slate-500">{subModule.reportCount} report</span>
        {href ? (
          <Link href={href} className="inline-flex items-center gap-1.5 rounded-xl bg-[#159947] px-3 py-2 text-xs font-bold text-white hover:bg-[#107c3a]">
            Buka
            <ArrowRight size={13} />
          </Link>
        ) : (
          <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400">
            Preview
          </span>
        )}
      </div>
    </article>
  )
}

function ModuleReportGallery({
  reports,
  source,
}: {
  reports: ModuleReportCard[]
  source: ReportSource
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {reports.map((report) => {
        const href = report.href ? withSource(report.href, source) : null
        const previewHref = report.previewHref ? withSource(report.previewHref, source) : href

        return (
          <article key={`${report.subModuleName}-${report.id}`} className="group flex min-h-[300px] flex-col overflow-hidden rounded-[18px] border border-[#CBD5E1] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.10)] ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:border-[#159947] hover:shadow-[0_20px_42px_rgba(15,23,42,0.16)]">
            <div className="-mx-4 -mt-4 h-2" style={{ backgroundColor: report.subModuleColor }} />

            <div className="mt-4 rounded-2xl border border-[#DDE6F0] bg-[#F8FAFC] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-xl border px-2.5 py-1 text-[11px] font-extrabold" style={{ borderColor: `${report.subModuleColor}30`, backgroundColor: report.subModuleSoft, color: report.subModuleColor }}>
                    {report.subModuleName}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-extrabold text-slate-600">
                    <Database size={12} />
                    {sourceLabel(source)}
                  </span>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-sm ${reportStatusClass(report.status)}`}>
                  {report.status}
                </span>
              </div>
            </div>

            <div className="mt-3 flex-1 rounded-2xl border border-[#DDE6F0] bg-white p-4 transition group-hover:border-emerald-300 group-hover:bg-emerald-50/35">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{report.category}</p>
              <div className="mt-2 flex items-start gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600">
                  <FileText size={14} />
                </span>
                <h3 className="line-clamp-2 text-base font-extrabold leading-6 text-slate-950">{report.title}</h3>
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{report.description}</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-[#DDE6F0] bg-[#F8FAFC] p-2.5">
                <p className="font-semibold text-slate-400">Cadence</p>
                <p className="mt-0.5 truncate font-bold text-slate-800">{report.cadence}</p>
              </div>
              <div className="rounded-xl border border-[#DDE6F0] bg-[#F8FAFC] p-2.5">
                <p className="font-semibold text-slate-400">Owner</p>
                <p className="mt-0.5 truncate font-bold text-slate-800">{report.owner}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-[#DDE6F0] bg-white p-2.5">
                <p className="font-semibold text-slate-400">Sumber Data Aktif</p>
                <p className="mt-0.5 truncate font-bold text-slate-800">{sourceLabel(source)} - {sourceDescription(source)}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2 rounded-2xl border border-[#DDE6F0] bg-[#F8FAFC] p-3">
              {previewHref ? (
                <Link href={previewHref} className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-[#159947] hover:bg-white">
                  Preview
                </Link>
              ) : null}
              {href ? (
                <Link href={href} className="inline-flex items-center gap-1.5 rounded-xl bg-[#159947] px-3 py-2 text-xs font-bold text-white hover:bg-[#107c3a]">
                  Buka Report
                  <ArrowRight size={13} />
                </Link>
              ) : (
                <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400">
                  Menunggu Query
                </span>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function CatalogPreviewPanel({
  module,
}: {
  module: ModuleTile
}) {
  const totalReports = module.subModules.reduce((sum, item) => sum + item.reportCount, 0)
  const liveSubModules = module.subModules.filter((item) => item.available).length

  return (
    <div className="grid gap-4 p-5 lg:grid-cols-3">
      {[
        { label: 'Sub-Modul', value: String(module.subModules.length), note: 'Grouping lebih ringkas', icon: module.icon, color: module.color, soft: module.soft },
        { label: 'Katalog Report', value: String(totalReports), note: 'Report tersusun per sub-modul', icon: FileSpreadsheet, color: '#2563EB', soft: '#EAF2FF' },
        { label: 'Status Live', value: String(liveSubModules), note: 'Sub-modul dengan query real', icon: Database, color: '#159947', soft: '#EAF7EF' },
      ].map((item) => (
        <KpiCard key={item.label} {...item} />
      ))}
    </div>
  )
}

function KpiCard({
  label,
  value,
  note,
  icon: Icon,
  color,
  soft,
}: {
  label: string
  value: string
  note: string
  icon: LucideIcon
  color: string
  soft: string
}) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">{label}</p>
          <p className="mt-2 text-2xl font-extrabold text-[#0F172A]">{value}</p>
          <p className="mt-1 text-[11px] font-semibold text-[#64748B]">{note}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ backgroundColor: soft, color }}>
          <Icon size={20} />
        </span>
      </div>
    </div>
  )
}

function AICommandPanel({
  insight,
  hasQuery,
  source,
  onCopy,
}: {
  insight: InsightContent
  hasQuery: boolean
  source: ReportSource
  onCopy: () => void
}) {
  return (
    <aside className="flex h-full min-h-[360px] flex-col overflow-hidden rounded-[18px] border border-emerald-400/35 bg-gradient-to-b from-[#052E2B] to-[#064E3B] text-white shadow-[0_18px_42px_rgba(6,78,59,0.24)]">
      <div className="border-b border-white/10 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-200">AI</p>
            <h3 className="mt-1 text-lg font-extrabold">Question-Based AI Insight</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-bold text-emerald-100">
            <Sparkles size={13} />
            READ-ONLY
          </span>
        </div>
      </div>
      <div className="grid flex-1 gap-3 p-5">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
          <p className="text-[11px] font-bold tracking-[0.18em] text-emerald-200">PERTANYAAN PAYLOAD</p>
          <div className="mt-3 grid gap-2 text-xs font-semibold leading-5 text-emerald-50/90">
            {[
              'Gudang mana yang memiliki nilai persediaan paling besar?',
              'Item apa yang paling material terhadap nilai aset inventory?',
              'Apa risiko data terbesar sebelum report diexport?',
            ].map((question) => (
              <span key={question} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2">{question}</span>
            ))}
          </div>
        </div>
        {[
          ['ANALISA UTAMA', insight.summary],
          ['SOROTAN DATA', insight.trendDetection],
          ['RISIKO / OUTLIER', insight.anomalyDetection],
          ['AKSI', insight.recommendation],
        ].map(([title, text]) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <p className="text-[11px] font-bold tracking-[0.18em] text-emerald-200">{title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-100">{text}</p>
          </div>
        ))}
        {!hasQuery && (
          <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs font-semibold leading-5 text-amber-100">
            AI menunggu payload hasil query. AI tidak melakukan query database sendiri.
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-white/10 p-5">
        <Link href={`/report-center/inventory?source=${source}`} className="flex-1 rounded-xl bg-[#159947] px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-[#107c3a]">
          Lihat Insight Lengkap
        </Link>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm font-bold text-white hover:bg-white/15"
        >
          <Copy size={15} />
          Copy
        </button>
      </div>
    </aside>
  )
}

export default function ReportsCenterPage() {
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('Bulan Ini')
  const [activeModuleId, setActiveModuleId] = useState<ModuleId>('procurement')
  const [selectedSource, setSelectedSource] = useState<ReportSource>('estate')
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [inventoryPayload, setInventoryPayload] = useState<InventoryQueryPayload | null>(null)
  const [inventoryError, setInventoryError] = useState<string | null>(null)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const { favorites, toggleFavorite, recent, addRecent } = useReportStore()

  const activeModule = MODULES.find((module) => module.id === activeModuleId) ?? MODULES[0]
  const activeIndex = MODULES.findIndex((module) => module.id === activeModuleId)
  const gatewayHealthy = Boolean(systemStatus?.gatewayOnline && systemStatus.activeConnected && systemStatus.activeHealthy)
  const hasQuery = activeModule.id === 'procurement' && hasInventoryQueryData(inventoryPayload)
  const greetingRole = roleLabel(currentUser?.role)
  const greetingName = userDisplayName(currentUser)
  const searchTerm = query.trim().toLowerCase()
  const activeModuleReports = useMemo(() => buildModuleReports(activeModule), [activeModule])
  const allModuleReports = useMemo(() => MODULES.flatMap((module) => buildModuleReports(module)), [])
  const displayedReports = useMemo(
    () => {
      if (!searchTerm) return activeModuleReports
      const searchSource = activeModule.id === 'procurement' ? activeModuleReports : allModuleReports
      return searchSource.filter((report) => reportMatchesQuery(report, searchTerm))
    },
    [activeModule.id, activeModuleReports, allModuleReports, searchTerm],
  )

  const syncReportContext = (source: ReportSource, moduleId: ModuleId) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(REPORT_SOURCE_STORAGE_KEY, source)
    window.localStorage.setItem(REPORT_MODULE_STORAGE_KEY, moduleId)
    window.dispatchEvent(new CustomEvent('report-center-source-change', { detail: source }))
    const params = new URLSearchParams(window.location.search)
    params.set('source', source)
    params.set('module', moduleId)
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`)
  }

  const selectSource = (source: ReportSource) => {
    setSelectedSource(source)
    syncReportContext(source, activeModuleId)
  }

  const selectModule = (moduleId: ModuleId) => {
    setActiveModuleId(moduleId)
    syncReportContext(selectedSource, moduleId)
  }

  useEffect(() => {
    window.queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search)
      const storedSource = window.localStorage.getItem(REPORT_SOURCE_STORAGE_KEY)
      const storedModule = window.localStorage.getItem(REPORT_MODULE_STORAGE_KEY)
      const nextSource = params.has('source') ? normalizeSource(params.get('source')) : normalizeSource(storedSource)
      const urlModule = params.get('module')
      const nextModule = isModuleId(urlModule) ? urlModule : isModuleId(storedModule) ? storedModule : 'procurement'
      setSelectedSource(nextSource)
      setActiveModuleId(nextModule)
      setCurrentUser(readStoredUser())
      syncReportContext(nextSource, nextModule)
    })
  }, [])

  const kpis = useMemo(() => {
    const summary = inventoryPayload?.summary
    return [
      {
        label: 'Total Item',
        value: formatMetric(firstMetric(summary, ['TotalItem', 'TotalBaris', 'TotalTransaksi'], inventoryPayload?.rows.length ?? 0)),
        note: hasQuery ? 'Hasil query Inventory' : 'Menunggu query',
        icon: Package,
        color: '#2563EB',
        soft: '#EAF2FF',
      },
      {
        label: 'Total Stok',
        value: formatMetric(firstMetric(summary, ['TotalStok', 'TotalQty', 'TotalAmount'])),
        note: hasQuery ? 'Akumulasi data aktif' : 'Menunggu query',
        icon: Warehouse,
        color: '#159947',
        soft: '#EAF7EF',
      },
      {
        label: 'Gudang Aktif',
        value: formatMetric(firstMetric(summary, ['TotalGudang'])),
        note: hasQuery ? 'Distinct lokasi gudang' : 'Menunggu query',
        icon: Building2,
        color: '#2563EB',
        soft: '#EAF2FF',
      },
      {
        label: 'Reorder Alert',
        value: formatMetric(firstMetric(summary, ['ItemMinimumStock', 'TotalItemReorder'])),
        note: hasQuery ? 'Item di bawah minimum' : 'Menunggu query',
        icon: AlertTriangle,
        color: '#EF4444',
        soft: '#FEE2E2',
      },
    ]
  }, [hasQuery, inventoryPayload])

  const insight = useMemo(
    () =>
      inventoryPayload
      && activeModule.id === 'procurement'
        ? createInventoryInsightFromPayload(inventoryPayload)
        : {
            summary: activeModule.id === 'procurement'
              ? `Menunggu hasil query Inventory dari ${sourceLabel(selectedSource)}.`
              : `${activeModule.name} sudah diringkas menjadi ${activeModule.subModules.length} sub-modul katalog.`,
            trendDetection: activeModule.id === 'procurement'
              ? 'Ringkasan live akan tampil setelah query report Inventory berhasil.'
              : 'Trend akan aktif setelah query real untuk sub-modul terkait tersedia.',
            anomalyDetection: inventoryError ?? 'Belum ada payload query untuk dianalisis.',
            recommendation: activeModule.id === 'procurement'
              ? `Periksa status ${sourceDescription(selectedSource)} atau buka sub-modul Inventory saat koneksi sehat.`
              : 'Gunakan kartu sub-modul untuk masuk ke report yang relevan saat query real diaktifkan.',
            dataQualityNote: 'AI hanya membaca payload hasil query. AI tidak menjalankan query sendiri.',
          },
    [activeModule.id, activeModule.name, activeModule.subModules.length, inventoryError, inventoryPayload, selectedSource],
  )

  useEffect(() => {
    let active = true
    fetch(`/api/reports/system-status?source=${selectedSource}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: SystemStatus) => {
        if (active) setSystemStatus(data)
      })
      .catch((error) => {
        if (active) setSystemStatus({ success: false, error: error instanceof Error ? error.message : 'Gagal membaca status gateway' })
      })
    return () => {
      active = false
    }
  }, [selectedSource])

  useEffect(() => {
    if (activeModuleId !== 'procurement') return
    let active = true
    window.queueMicrotask(() => {
      if (!active) return
      setInventoryPayload(null)
      setInventoryError(null)
    })
    fetchInventoryPayload(selectedSource)
      .then((data) => {
        if (active) setInventoryPayload(data)
      })
      .catch((error) => {
        if (active) setInventoryError(error instanceof Error ? error.message : 'Gagal memuat real data inventory')
      })
    return () => {
      active = false
    }
  }, [activeModuleId, selectedSource])

  const filteredModules = useMemo(() => {
    if (!searchTerm) return MODULES
    return MODULES.filter(
      (module) => {
        const reports = buildModuleReports(module)
        return module.name.toLowerCase().includes(searchTerm) ||
        module.description.toLowerCase().includes(searchTerm) ||
        module.status.toLowerCase().includes(searchTerm) ||
        module.subModules.some((subModule) =>
          subModule.name.toLowerCase().includes(searchTerm) ||
          subModule.description.toLowerCase().includes(searchTerm),
        ) ||
        reports.some((report) => reportMatchesQuery(report, searchTerm))
      },
    )
  }, [searchTerm])

  const selectByStep = (step: number) => {
    const next = (activeIndex + step + MODULES.length) % MODULES.length
    selectModule(MODULES[next].id)
  }

  const copyInsight = async () => {
    await navigator.clipboard
      .writeText([insight.summary, insight.trendDetection, insight.anomalyDetection, insight.recommendation, insight.dataQualityNote].join('\n'))
      .catch(() => null)
  }

  return (
    <>
      <GlobalSearch />
      <div className="min-h-full bg-[#F6F8FB] px-4 py-[22px] sm:px-6 lg:px-[22px]">
        <div className="space-y-[18px]">
            <section className="relative min-h-[190px] overflow-hidden rounded-[18px] border border-emerald-900/20 bg-[#064E3B] shadow-[0_16px_46px_rgba(6,78,59,0.22)]">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/assets/kebun sawit.webp')" }} />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,46,34,0.94),rgba(4,46,34,0.72),rgba(4,46,34,0.45))]" />
              <div className="relative grid min-h-[170px] gap-5 p-6 text-white lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
                <div>
                  <p className="text-sm font-semibold text-emerald-100">Yang terhormat,</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h1 className="text-[34px] font-extrabold tracking-tight">{greetingRole}</h1>
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-300/40">✓</span>
                    <span className="inline-flex h-8 items-center gap-2 rounded-xl border border-emerald-200/30 bg-white/14 px-3 text-xs font-extrabold text-emerald-50 backdrop-blur">
                      <Database size={14} />
                      {sourceLabel(selectedSource)}
                    </span>
                    <span className="inline-flex h-8 items-center rounded-xl border border-white/10 bg-white/10 px-3 text-[11px] font-bold text-emerald-100/85 backdrop-blur">
                      {sourceDescription(selectedSource)}
                    </span>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50/90">
                    Selamat datang kembali, {greetingName}. Pantau, analisis, dan akses seluruh laporan operasional berdasarkan modul, periode, dan scope report aktif.
                  </p>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/14 p-3 backdrop-blur">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-100/80">
                        <Database size={14} />
                        Lokasi Report
                      </span>
                      <span className={gatewayHealthy ? 'text-[11px] font-bold text-emerald-100' : 'text-[11px] font-bold text-amber-200'}>
                        {sourceDescription(selectedSource)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {REPORT_SOURCES.map((source) => {
                        const status = systemStatus?.sources?.find((item) => item.source === source.id)
                        const healthy = Boolean(status?.connected && status?.healthy)
                        const active = selectedSource === source.id
                        return (
                          <button
                            key={source.id}
                            type="button"
                            onClick={() => selectSource(source.id)}
                            className={[
                              'rounded-xl border px-3 py-2 text-left transition',
                              active
                                ? 'border-emerald-300 bg-emerald-400/20 text-white'
                                : 'border-white/10 bg-white/8 text-emerald-50/80 hover:bg-white/14',
                            ].join(' ')}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-xs font-extrabold">{source.label}</span>
                              <span className={healthy ? 'h-2 w-2 rounded-full bg-emerald-300' : 'h-2 w-2 rounded-full bg-amber-300'} />
                            </span>
                            <span className="mt-1 block truncate text-[10px] font-semibold text-emerald-50/65">{source.description}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ['Database', gatewayHealthy ? 'Online' : 'Perlu Cek', gatewayHealthy],
                      ['Integrasi', gatewayHealthy ? 'Terhubung' : 'Timeout', gatewayHealthy],
                      ['Update Terakhir', formatDateTime(systemStatus?.checkedAt), true],
                    ].map(([label, value, ok]) => (
                      <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/12 p-3 backdrop-blur">
                        <p className="text-[11px] font-semibold text-emerald-100/80">{label}</p>
                        <p className={ok ? 'mt-1 truncate text-sm font-extrabold text-white' : 'mt-1 truncate text-sm font-extrabold text-amber-200'}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/14 p-4 backdrop-blur">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/18 text-emerald-100">
                          <Calendar size={18} />
                        </span>
                        <span>
                          <span className="block text-[11px] font-bold tracking-[0.14em] text-emerald-100/75">PERIODE AKTIF</span>
                          <span className="mt-1 block text-sm font-extrabold">Mei 2026</span>
                          <span className="block text-[11px] text-emerald-50/70">01 Mei - 31 Mei 2026</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/18 text-emerald-100">
                          <Building2 size={18} />
                        </span>
                        <span>
                          <span className="block text-[11px] font-bold tracking-[0.14em] text-emerald-100/75">SCOPE REPORT</span>
                          <span className="mt-1 block text-sm font-extrabold">{reportScope(selectedSource)}</span>
                          <span className="block text-[11px] text-emerald-50/70">Hak akses: {accessLevel(selectedSource)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

          <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="min-w-0 space-y-[18px]">
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
              <div className="flex flex-wrap items-center gap-2">
                {QUICK_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={[
                      'h-9 rounded-full border px-4 text-sm font-bold transition',
                      activeFilter === filter
                        ? 'border-[#159947] bg-[#159947] text-white'
                        : 'border-[#E2E8F0] bg-white text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                    onClick={() => setActiveFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter('Bulan Ini')
                    setQuery('')
                  }}
                  className="ml-auto inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-bold text-[#159947] hover:bg-[#EAF7EF]"
                >
                  <RefreshCw size={15} />
                  Reset
                </button>
              </div>
            </section>

            <section id="modules" className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-bold text-[#0F172A]">Modul Laporan</h2>
                  <p className="mt-1 text-[13px] text-[#64748B]">Pilih modul untuk melihat ringkasan dan daftar laporan tersedia.</p>
                </div>
                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari report, modul, owner, kategori..."
                    className="h-10 w-full rounded-xl border border-[#E2E8F0] bg-white pl-9 pr-3 text-sm font-semibold outline-none focus:border-[#159947] focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>
              </div>
              <div className="flex gap-[14px] overflow-x-auto pb-2">
                {filteredModules.map((module) => (
                  <ModuleTileCard
                    key={module.id}
                    module={module}
                    active={activeModule.id === module.id}
                    onSelect={selectModule}
                  />
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-[18px] border border-emerald-900/10 bg-white shadow-[0_10px_32px_rgba(15,23,42,0.10)]">
              <div className="border-b border-emerald-900/20 bg-[linear-gradient(135deg,#052E2B_0%,#064E3B_58%,#0B3B2A_100%)] p-5 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[18px] font-extrabold">Modul Terpilih: {activeModule.name}</h2>
                      <span
                        className="rounded-full border px-2.5 py-1 text-[11px] font-bold"
                        style={{
                          backgroundColor: activeModule.available ? 'rgba(34,197,94,0.16)' : 'rgba(255,255,255,0.12)',
                          borderColor: activeModule.available ? 'rgba(134,239,172,0.35)' : 'rgba(255,255,255,0.16)',
                          color: activeModule.available ? '#BBF7D0' : '#CBD5E1',
                        }}
                      >
                        {activeModule.available ? 'Live' : 'Katalog'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-emerald-50/80">
                      {activeModule.id === 'procurement'
                        ? `Procurement hanya menampilkan report Inventory live dari ${sourceLabel(selectedSource)}.`
                        : activeModule.available
                        ? `Sub-modul Inventory membaca query report live dari ${sourceLabel(selectedSource)}.`
                        : `${activeModule.subModules.length} sub-modul sudah dikelompokkan sebagai katalog report.`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/12 px-3 text-sm font-bold text-emerald-50 backdrop-blur">
                      <Calendar size={15} />
                      01 Mei - 31 Mei 2026
                    </span>
                    <button type="button" onClick={() => selectByStep(-1)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/12 text-emerald-50 hover:bg-white/18">
                      <ChevronLeft size={17} />
                    </button>
                    <button type="button" onClick={() => selectByStep(1)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/12 text-emerald-50 hover:bg-white/18">
                      <ChevronRight size={17} />
                    </button>
                    <Link href={activeModule.id === 'procurement' ? `/report-center/inventory?source=${selectedSource}` : `/report-center/${activeModule.id}?source=${selectedSource}`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/12 px-3 text-sm font-bold text-emerald-50 hover:bg-white/18">
                      Detail Monitor
                      <ChevronDown size={15} />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="border-b border-[#E2E8F0] bg-slate-50/70 p-5">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-[16px] font-extrabold text-[#0F172A]">Sub-Modul {activeModule.name}</h2>
                    <p className="mt-1 text-sm text-[#64748B]">
                      {activeModule.id === 'procurement'
                        ? 'Klik sub-modul untuk membuka report live yang sudah tersedia.'
                        : 'Klik sub-modul untuk melihat report yang sudah tersedia atau masih berupa katalog preview.'}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">
                    {activeModule.subModules.length} sub-modul{activeModule.id === 'procurement' ? ' live' : ''}
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {activeModule.subModules.map((subModule) => (
                    <SubModuleCard key={subModule.id} subModule={subModule} source={selectedSource} />
                  ))}
                </div>
              </div>

              {activeModule.id === 'procurement' ? (
                <>
                  <div className="grid gap-4 p-5 lg:grid-cols-4">
                    {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
                  </div>
                  <div className="p-5 pt-0">
                    <AICommandPanel insight={insight} hasQuery={hasQuery} source={selectedSource} onCopy={copyInsight} />
                  </div>
                </>
              ) : (
                <CatalogPreviewPanel module={activeModule} />
              )}

              <div className="border-t border-[#CBD5E1] bg-[#EEF3F8] p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[16px] font-extrabold text-[#0F172A]">
                      {searchTerm ? `Hasil Pencarian Report: "${query.trim()}"` : `Report dalam ${activeModule.name}`}
                    </h2>
                    <p className="mt-1 text-sm text-[#64748B]">
                      {searchTerm
                        ? activeModule.id === 'procurement'
                          ? `${displayedReports.length} report live cocok di Procurement. Sumber aktif tetap ${sourceLabel(selectedSource)}.`
                          : `${displayedReports.length} report cocok dari seluruh modul. Sumber aktif tetap ${sourceLabel(selectedSource)}.`
                        : activeModule.id === 'procurement'
                        ? `${displayedReports.length} report live ditampilkan di Procurement.`
                        : `${displayedReports.length} report ditampilkan sebagai kartu agar sub-modul dan statusnya lebih mudah dipindai.`}
                    </p>
                  </div>
                  {activeModule.id === 'procurement' ? (
                    <Link href={`/report-center/inventory?source=${selectedSource}`} className="inline-flex items-center gap-2 rounded-xl bg-[#159947] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#107c3a]">
                      Lihat semua Inventory
                      <ArrowRight size={15} />
                    </Link>
                  ) : null}
                </div>
                {displayedReports.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[#CBD5E1] bg-white p-8 text-center shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
                    <p className="text-base font-extrabold text-slate-950">Report tidak ditemukan</p>
                    <p className="mt-2 text-sm text-slate-500">Coba kata kunci seperti inventory, payroll, budget, stok, atau owner report.</p>
                  </div>
                ) : (
                  <ModuleReportGallery reports={displayedReports} source={selectedSource} />
                )}
              </div>
            </section>
          </main>

          <aside className="space-y-[14px] xl:sticky xl:top-[94px] xl:self-start">
            <section className="rounded-2xl border border-[#CBD5E1] bg-white p-[18px] shadow-[0_8px_24px_rgba(15,23,42,0.09)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[16px] font-bold text-[#0F172A]">Sering Digunakan</h2>
                <Star size={18} className="text-[#D99A00]" />
              </div>
              <div className="space-y-3">
                {liveInventoryReports.slice(0, 5).map((report, index) => {
                  const isFavorite = favorites.includes(report.id)
                  return (
                    <div key={report.id} className="flex items-center gap-3 rounded-2xl border border-[#DDE6F0] bg-[#F8FAFC] p-3 shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition hover:border-[#159947] hover:bg-white">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-600">{index + 1}</span>
                      <Link href={`/report-center/inventory?source=${selectedSource}&report=${report.id}`} onClick={() => addRecent(report.id)} className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-900 hover:text-[#159947]">{report.title}</span>
                        <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">{report.groupTitle}</span>
                        <span className="mt-1 inline-flex rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-extrabold text-slate-600">{sourceLabel(selectedSource)}</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(report.id)}
                        className={isFavorite ? 'grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-amber-200 bg-amber-50 text-[#D99A00]' : 'grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-300 hover:text-[#D99A00]'}
                        aria-label="Toggle favorite"
                      >
                        <Star size={15} fill={isFavorite ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  )
                })}
              </div>
              <Link href={`/report-center/inventory?source=${selectedSource}`} className="mt-3 inline-flex text-sm font-bold text-[#159947]">Lihat semua</Link>
            </section>

            <section className="rounded-2xl border border-[#CBD5E1] bg-white p-[18px] shadow-[0_8px_24px_rgba(15,23,42,0.09)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[16px] font-bold text-[#0F172A]">Terakhir Dibuka</h2>
                <Clock size={18} className="text-[#2563EB]" />
              </div>
              <div className="space-y-3">
                {recent.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                    Belum ada report yang dibuka.
                  </div>
                ) : (
                  recent.slice(0, 5).map((entry) => {
                    const report = liveInventoryReports.find((item) => item.id === entry.id)
                    if (!report) return null
                    return (
                      <Link key={`${entry.id}-${entry.viewedAt}`} href={`/report-center/inventory?source=${selectedSource}&report=${entry.id}`} className="flex items-center gap-3 rounded-2xl border border-[#DDE6F0] bg-[#F8FAFC] p-3 shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition hover:border-[#2563EB] hover:bg-white">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-100 bg-[#EAF2FF] text-[#2563EB]">
                          <FileSpreadsheet size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-900">{report.title}</span>
                          <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">Dibuka {formatDateTime(entry.viewedAt)}</span>
                          <span className="mt-1 inline-flex rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-extrabold text-slate-600">{sourceLabel(selectedSource)}</span>
                        </span>
                      </Link>
                    )
                  })
                )}
              </div>
              <Link href={`/report-center/inventory?source=${selectedSource}`} className="mt-3 inline-flex text-sm font-bold text-[#159947]">Lihat semua</Link>
            </section>

            <section className="rounded-2xl border border-[#CBD5E1] bg-white p-[18px] shadow-[0_8px_24px_rgba(15,23,42,0.09)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[16px] font-bold text-[#0F172A]">Export Cepat</h2>
                <Download size={18} className="text-[#159947]" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Excel', ext: '.xlsx', icon: FileSpreadsheet, color: '#159947', bg: '#EAF7EF' },
                  { label: 'PDF', ext: '.pdf', icon: FileText, color: '#EF4444', bg: '#FEE2E2' },
                  { label: 'CSV', ext: '.csv', icon: Download, color: '#D99A00', bg: '#FFF4D6' },
                ].map((item) => (
                  <Link key={item.label} href={`/report-center/inventory?source=${selectedSource}`} className="rounded-2xl border border-[#DDE6F0] bg-[#F8FAFC] p-3 text-center shadow-[0_4px_12px_rgba(15,23,42,0.04)] hover:border-[#159947] hover:bg-white">
                    <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl" style={{ backgroundColor: item.bg, color: item.color }}>
                      <item.icon size={18} />
                    </span>
                    <span className="mt-2 block text-sm font-bold text-slate-900">{item.label}</span>
                    <span className="block text-[11px] text-slate-500">{item.ext}</span>
                  </Link>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
      </div>
    </>
  )
}
