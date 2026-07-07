import {
  BarChart3,
  LucideIcon,
  Package,
  Users,
  Wallet,
} from 'lucide-react'
import { liveInventoryReports } from '@/lib/reports/inventory/config'

export type IntelligenceModuleId =
  | 'procurement'
  | 'financial'
  | 'human-resources'
  | 'budget'

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

export const intelligenceModules: IntelligenceModule[] = [
  {
    id: 'procurement',
    route: '/report-center?module=procurement#modules',
    name: 'Procurement',
    reportCount: liveInventoryReports.length,
    icon: Package,
    accent: '#167A3A',
    description: 'Inventory live dalam satu workspace Procurement.',
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
    id: 'financial',
    route: '/report-center?module=financial#modules',
    name: 'Financial',
    reportCount: 16,
    icon: Wallet,
    accent: '#2563EB',
    description: 'Produktivitas dan efisiensi biaya ditempatkan di modul Financial.',
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
    route: '/report-center?module=human-resources#modules',
    name: 'Human Resources',
    reportCount: 94,
    icon: Users,
    accent: '#DB2777',
    description: 'Payroll, daftar upah, absensi, premi, lembur, summary, wages, dan dampak report.',
    primaryChart: 'hr_wages_monitor',
    available: false,
    kpis: [
      { label: 'Sub-modul', value: '8', tone: 'green' },
      { label: 'Report', value: '94', tone: 'blue' },
      { label: 'Payroll', value: '24', tone: 'gold' },
      { label: 'Query', value: 'Preview', tone: 'slate' },
    ],
    trend: [
      { label: 'Payroll', value: 24 },
      { label: 'Upah', value: 15 },
      { label: 'Absensi', value: 18 },
      { label: 'Premi', value: 12 },
      { label: 'Analisis', value: 20 },
    ],
    breakdown: [
      { label: 'Payroll', value: 24 },
      { label: 'Daftar Upah', value: 15 },
      { label: 'Absensi', value: 18 },
      { label: 'Premi/Lembur', value: 17 },
      { label: 'Summary/Wages/Dampak', value: 20 },
    ],
    composition: [
      { label: 'Payroll & Upah', value: 42 },
      { label: 'Absensi', value: 19 },
      { label: 'Premi/Lembur', value: 18 },
      { label: 'Analisis', value: 21 },
    ],
    ranking: [
      { label: 'Summary Report', value: 'HR', note: 'Sudah masuk Human Resources' },
      { label: 'Wages Comparison', value: 'HR', note: 'Sudah masuk Human Resources' },
      { label: 'Dampak Report', value: 'HR', note: 'Sudah masuk Human Resources' },
    ],
    alerts: [{ title: 'HR digabung', detail: 'Premi, lembur, summary, wages, dan dampak report sudah berada di HR.', tone: 'green' }],
    insight: {
      summary: 'Human Resources menjadi modul utama untuk seluruh report karyawan dan upah.',
      trendDetection: 'Report analisis wages dan dampak kini tidak berdiri sendiri.',
      anomalyDetection: 'Query real HR belum diaktifkan.',
      recommendation: 'Gunakan sub-modul untuk memilih Payroll, Daftar Upah, Premi, Lembur, atau analisis.',
      dataQualityNote: 'Katalog HR siap disambungkan ke query payroll/absensi.',
    },
  },
  {
    id: 'budget',
    route: '/report-center?module=budget#modules',
    name: 'Budget',
    reportCount: 12,
    icon: BarChart3,
    accent: '#D99A00',
    description: 'Budget planning, budget realization, dan variance analysis.',
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
    { label: 'Modul utama', value: '4', tone: 'green' as const },
    { label: 'Katalog report', value: '157', tone: 'blue' as const },
    { label: 'Live inventory', value: `${liveInventoryReports.length} report`, tone: 'gold' as const },
    { label: 'Health score', value: '96%', tone: 'green' as const },
  ],
  trend: [
    { label: 'Procurement', value: 88 },
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
    { label: 'Preview ready', value: 130 },
    { label: 'Main modules', value: 4 },
  ],
  ranking: [
    { label: 'Human Resources', value: '94 report', note: 'Katalog terbesar' },
    { label: 'Procurement', value: `${liveInventoryReports.length} live`, note: 'Inventory live di dalamnya' },
    { label: 'Financial', value: '16 report', note: 'Produktivitas dipindah ke sini' },
  ],
  alerts: [
    { title: 'Modul utama disederhanakan', detail: 'Portal memakai Procurement, Financial, Human Resources, dan Budget.', tone: 'green' as const },
    { title: 'Inventory tetap live', detail: 'Report inventory berada di Procurement > Inventory.', tone: 'gold' as const },
  ],
  insight: {
    summary: 'Report Center memakai 4 modul utama dengan sub-modul di dalamnya.',
    trendDetection: 'Inventory tetap menjadi sub-modul live di bawah Procurement.',
    anomalyDetection: 'Sub-modul non-inventory masih berupa katalog preview sampai query real disambungkan.',
    recommendation: 'Mulai dari Procurement > Inventory untuk report yang sudah live.',
    dataQualityNote: 'Data source mengikuti mapping server: portal, estate/kebun, dan pabrik.',
  },
}
