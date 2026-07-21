import {
  BarChart3,
  LucideIcon,
  Package,
  Users,
  Wallet,
} from 'lucide-react'
import { liveInventoryReports } from '@/lib/reports/inventory/config'
import {
  REPORT_GLOBAL_MODULES,
  getReportModuleConfig,
  type ReportGlobalModuleId,
} from './module-registry'

export type IntelligenceModuleId = ReportGlobalModuleId

export type VisualPoint = {
  label: string
  value: number
  secondary?: number
}

export type InsightContent = {
  summary: string
  trendDetection: string
  anomalyDetection: string
  recommendation: string
  dataQualityNote: string
}

export type IntelligenceModule = {
  id: IntelligenceModuleId
  route: string
  name: string
  reportCount: number
  icon: LucideIcon
  accent: string
  description: string
  primaryChart: string
  available: boolean
  kpis: Array<{ label: string; value: string; tone: 'green' | 'blue' | 'gold' | 'red' | 'slate' }>
  trend: VisualPoint[]
  breakdown: VisualPoint[]
  composition: VisualPoint[]
  ranking: Array<{ label: string; value: string; note: string }>
  alerts: Array<{ title: string; detail: string; tone: 'green' | 'gold' | 'red' | 'slate' }>
  insight: InsightContent
}

const moduleConfig = (id: IntelligenceModuleId) => {
  const config = getReportModuleConfig(id)
  if (!config) throw new Error(`Report module config not found: ${id}`)
  return config
}

const totalRegistryReports = REPORT_GLOBAL_MODULES.reduce((total, module) => total + module.reportCount, 0)

export const intelligenceModules: IntelligenceModule[] = [
  {
    id: 'procurement',
    route: moduleConfig('procurement').route,
    name: moduleConfig('procurement').name,
    reportCount: moduleConfig('procurement').reportCount,
    icon: Package,
    accent: moduleConfig('procurement').color,
    description: moduleConfig('procurement').description,
    primaryChart: 'procurement_inventory_monitor',
    available: true,
    kpis: [
      { label: 'Sub-modul', value: '1', tone: 'green' },
      { label: 'Inventory live', value: 'Live', tone: 'green' },
      { label: 'Report', value: String(liveInventoryReports.length), tone: 'blue' },
      { label: 'Mode', value: 'Live only', tone: 'slate' },
    ],
    trend: [
      { label: 'Movement', value: 2 },
      { label: 'Stock', value: 2 },
      { label: 'Valuation', value: 1 },
      { label: 'Audit', value: 1 },
    ],
    breakdown: [
      { label: 'Inventory live', value: liveInventoryReports.length },
    ],
    composition: [
      { label: 'Live', value: liveInventoryReports.length },
    ],
    ranking: liveInventoryReports.slice(0, 3).map((report) => ({
      label: report.title,
      value: 'Live',
      note: report.groupTitle,
    })),
    alerts: [{ title: 'Inventory live', detail: 'Report Inventory tetap memakai query read-only yang sudah dibuat.', tone: 'green' }],
    insight: {
      summary: 'Procurement sekarang diprioritaskan untuk report Inventory yang sudah live.',
      trendDetection: 'Inventory adalah sub-modul yang sudah live.',
      anomalyDetection: 'Tidak ada report non-live yang ditampilkan di Procurement.',
      recommendation: 'Gunakan Procurement > Inventory untuk membuka report real.',
      dataQualityNote: 'Data live mengikuti payload Inventory.',
    },
  },
  {
    id: 'payroll',
    route: moduleConfig('payroll').route,
    name: moduleConfig('payroll').name,
    reportCount: moduleConfig('payroll').reportCount,
    icon: Wallet,
    accent: moduleConfig('payroll').color,
    description: moduleConfig('payroll').description,
    primaryChart: 'payroll_wage_monitor',
    available: false,
    kpis: [
      { label: 'Sub-modul', value: String(moduleConfig('payroll').submodules.length), tone: 'green' },
      { label: 'Report', value: String(moduleConfig('payroll').reportCount), tone: 'blue' },
      { label: 'RBAC', value: 'Payroll', tone: 'gold' },
      { label: 'Query', value: 'Preview', tone: 'slate' },
    ],
    trend: [
      { label: 'Payroll Run', value: 8 },
      { label: 'Wage Register', value: 10 },
      { label: 'Audit', value: 6 },
    ],
    breakdown: moduleConfig('payroll').submodules.map((submodule) => ({
      label: submodule.name,
      value: submodule.reportCount,
    })),
    composition: [
      { label: 'Payroll', value: 34 },
      { label: 'Wages', value: 42 },
      { label: 'Audit', value: 24 },
    ],
    ranking: [
      { label: 'Payroll Run Summary', value: 'Preview', note: 'Gate permission Payroll' },
      { label: 'Wage Register', value: 'Preview', note: 'Daftar upah dan comparison' },
      { label: 'Payroll Audit', value: 'Preview', note: 'Exception dan validasi' },
    ],
    alerts: [{ title: 'Payroll terpisah', detail: 'Payroll menjadi modul global sendiri dan tidak lagi dihitung sebagai sub-modul HR.', tone: 'gold' }],
    insight: {
      summary: 'Payroll disiapkan sebagai modul global terpisah dengan permission payroll.',
      trendDetection: 'Katalog payroll dipisahkan dari HR agar route dan RBAC tidak drift.',
      anomalyDetection: 'Query real Payroll belum diaktifkan.',
      recommendation: 'Gunakan modul Payroll untuk wage register dan payroll run saat query siap.',
      dataQualityNote: 'Akses mengikuti permission payroll yang sudah ada.',
    },
  },
  {
    id: 'financial',
    route: moduleConfig('financial').route,
    name: moduleConfig('financial').name,
    reportCount: moduleConfig('financial').reportCount,
    icon: Wallet,
    accent: moduleConfig('financial').color,
    description: moduleConfig('financial').description,
    primaryChart: 'financial_productivity_monitor',
    available: false,
    kpis: [
      { label: 'Sub-modul', value: '1', tone: 'blue' },
      { label: 'Report', value: '16', tone: 'blue' },
      { label: 'Cost view', value: 'Ready', tone: 'green' },
      { label: 'Query', value: 'Preview', tone: 'gold' },
    ],
    trend: [
      { label: 'Jan', value: 58 },
      { label: 'Feb', value: 62 },
      { label: 'Mar', value: 69 },
      { label: 'Apr', value: 73 },
      { label: 'Mei', value: 78 },
    ],
    breakdown: [
      { label: 'Produktivitas', value: 16 },
      { label: 'Cost per KG', value: 4 },
      { label: 'Man Hour', value: 3 },
    ],
    composition: [
      { label: 'Productivity', value: 58 },
      { label: 'Cost', value: 24 },
      { label: 'Efficiency', value: 18 },
    ],
    ranking: [
      { label: 'Produktivitas Panen Harian', value: 'Preview', note: 'Sub-modul utama Financial' },
      { label: 'Cost per KG', value: 'Preview', note: 'View efisiensi biaya' },
      { label: 'Efisiensi Man Hour', value: 'Preview', note: 'Rasio output tenaga kerja' },
    ],
    alerts: [{ title: 'Produktivitas dipindah', detail: 'Modul Produktivitas kini berada di Financial.', tone: 'slate' }],
    insight: {
      summary: 'Financial memusatkan report produktivitas dan efisiensi biaya.',
      trendDetection: 'Katalog menyiapkan analisis cost per KG dan man hour.',
      anomalyDetection: 'Query real Financial belum diaktifkan.',
      recommendation: 'Mulai dari report Produktivitas Panen Harian.',
      dataQualityNote: 'Data akan mengikuti query produktivitas saat endpoint siap.',
    },
  },
  {
    id: 'human-resources',
    route: moduleConfig('human-resources').route,
    name: moduleConfig('human-resources').name,
    reportCount: moduleConfig('human-resources').reportCount,
    icon: Users,
    accent: moduleConfig('human-resources').color,
    description: moduleConfig('human-resources').description,
    primaryChart: 'hr_wages_monitor',
    available: false,
    kpis: [
      { label: 'Sub-modul', value: String(moduleConfig('human-resources').submodules.length), tone: 'green' },
      { label: 'Report', value: String(moduleConfig('human-resources').reportCount), tone: 'blue' },
      { label: 'Payroll', value: 'Terpisah', tone: 'gold' },
      { label: 'Query', value: 'Preview', tone: 'slate' },
    ],
    trend: [
      { label: 'Absensi', value: 18 },
      { label: 'Premi', value: 12 },
      { label: 'Lembur', value: 10 },
      { label: 'Analisis', value: 30 },
    ],
    breakdown: [
      { label: 'Absensi', value: 18 },
      { label: 'Premi/Lembur', value: 17 },
      { label: 'Summary/Wages/Dampak', value: 35 },
    ],
    composition: [
      { label: 'Absensi', value: 26 },
      { label: 'Premi/Lembur', value: 24 },
      { label: 'Analisis', value: 50 },
    ],
    ranking: [
      { label: 'Summary Report', value: 'HR', note: 'Sudah masuk Human Resources' },
      { label: 'Wages Comparison', value: 'HR', note: 'Sudah masuk Human Resources' },
      { label: 'Dampak Report', value: 'HR', note: 'Sudah masuk Human Resources' },
    ],
    alerts: [{ title: 'HR digabung', detail: 'Premi, lembur, summary, wages, dan dampak report sudah berada di HR.', tone: 'green' }],
    insight: {
      summary: 'Human Resources menjadi modul utama untuk workforce non-payroll.',
      trendDetection: 'Absensi, premi, lembur, dan dampak report berada di HR; Payroll punya modul sendiri.',
      anomalyDetection: 'Query real HR belum diaktifkan.',
      recommendation: 'Gunakan sub-modul untuk memilih Absensi, Premi, Lembur, atau analisis workforce.',
      dataQualityNote: 'Katalog HR siap disambungkan ke query absensi dan workforce.',
    },
  },
  {
    id: 'budget',
    route: moduleConfig('budget').route,
    name: moduleConfig('budget').name,
    reportCount: moduleConfig('budget').reportCount,
    icon: BarChart3,
    accent: moduleConfig('budget').color,
    description: moduleConfig('budget').description,
    primaryChart: 'budget_variance_monitor',
    available: false,
    kpis: [
      { label: 'Sub-modul', value: '3', tone: 'gold' },
      { label: 'Report', value: '12', tone: 'blue' },
      { label: 'Variance', value: 'Ready', tone: 'green' },
      { label: 'Query', value: 'Preview', tone: 'slate' },
    ],
    trend: [
      { label: 'Plan', value: 40 },
      { label: 'Actual', value: 55 },
      { label: 'Variance', value: 62 },
      { label: 'Forecast', value: 68 },
    ],
    breakdown: [
      { label: 'Planning', value: 4 },
      { label: 'Realization', value: 4 },
      { label: 'Variance', value: 4 },
    ],
    composition: [
      { label: 'Planning', value: 34 },
      { label: 'Actual', value: 33 },
      { label: 'Variance', value: 33 },
    ],
    ranking: [
      { label: 'Budget vs Actual', value: 'Preview', note: 'Kontrol realisasi' },
      { label: 'Variance Report', value: 'Preview', note: 'Deviasi akun kritis' },
      { label: 'Budget Plan Summary', value: 'Preview', note: 'Rencana budget' },
    ],
    alerts: [{ title: 'Budget siap katalog', detail: 'Sub-modul budget sudah dibuat untuk realisasi dan variance.', tone: 'gold' }],
    insight: {
      summary: 'Budget menjadi modul utama untuk rencana, realisasi, dan variance.',
      trendDetection: 'Katalog disusun untuk pemantauan deviasi budget.',
      anomalyDetection: 'Query real Budget belum diaktifkan.',
      recommendation: 'Mulai dari Budget vs Actual dan Budget Variance Report.',
      dataQualityNote: 'Data akan mengikuti mapping budget saat query disambungkan.',
    },
  },
]

export const getIntelligenceModule = (id: string) =>
  intelligenceModules.find((module) => module.id === id)

export const overviewIntelligence = {
  kpis: [
    { label: 'Modul utama', value: String(REPORT_GLOBAL_MODULES.length), tone: 'green' as const },
    { label: 'Katalog report', value: String(totalRegistryReports), tone: 'blue' as const },
    { label: 'Live inventory', value: `${liveInventoryReports.length} report`, tone: 'gold' as const },
    { label: 'Health score', value: '96%', tone: 'green' as const },
  ],
  trend: [
    { label: 'Procurement', value: 88 },
    { label: 'Payroll', value: 70 },
    { label: 'Financial', value: 78 },
    { label: 'HR', value: 82 },
    { label: 'Budget', value: 64 },
  ],
  breakdown: intelligenceModules.map((module) => ({
    label: module.name,
    value: module.reportCount,
  })),
  composition: [
    { label: 'Live', value: 27 },
    { label: 'Preview ready', value: Math.max(0, totalRegistryReports - liveInventoryReports.length) },
    { label: 'Main modules', value: REPORT_GLOBAL_MODULES.length },
  ],
  ranking: [
    { label: 'Human Resources', value: `${moduleConfig('human-resources').reportCount} report`, note: 'Workforce non-payroll' },
    { label: 'Payroll', value: `${moduleConfig('payroll').reportCount} report`, note: 'Permission payroll terpisah' },
    { label: 'Procurement', value: `${liveInventoryReports.length} live`, note: 'Inventory live di dalamnya' },
  ],
  alerts: [
    { title: 'Modul utama disederhanakan', detail: 'Portal memakai Procurement, Payroll, Human Resources, Financial, dan Budget.', tone: 'green' as const },
    { title: 'Inventory tetap live', detail: 'Report inventory berada di Procurement > Inventory.', tone: 'gold' as const },
  ],
  insight: {
    summary: 'Report Center memakai 5 modul utama dengan sub-modul di dalamnya.',
    trendDetection: 'Inventory tetap menjadi sub-modul live di bawah Procurement.',
    anomalyDetection: 'Sub-modul non-inventory masih berupa katalog preview sampai query real disambungkan.',
    recommendation: 'Mulai dari Procurement > Inventory untuk report yang sudah live.',
    dataQualityNote: 'Data source mengikuti mapping server: portal, estate/kebun, dan pabrik.',
  },
}
