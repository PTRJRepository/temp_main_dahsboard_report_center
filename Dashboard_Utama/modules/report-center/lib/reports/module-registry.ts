import type { ModuleId as RbacModuleId } from '@/lib/rbac/types'
import { liveInventoryReports } from './inventory/config'

export type ReportGlobalModuleId =
  | 'procurement'
  | 'payroll'
  | 'human-resources'
  | 'financial'
  | 'budget'

export type ReportModuleStatus = 'active' | 'coming_soon' | 'locked'
export type ReportModuleAvailability = 'live' | 'preview' | 'restricted'
export type ReportModuleIcon = 'Package' | 'Wallet' | 'Users' | 'BarChart3'

export type ReportSubmoduleConfig = {
  id: string
  name: string
  description: string
  reportCount: number
  route?: string
  availability: ReportModuleAvailability
}

export type ReportGlobalModuleConfig = {
  id: ReportGlobalModuleId
  name: string
  description: string
  reportCount: number
  route: string
  status: ReportModuleStatus
  availability: ReportModuleAvailability
  lastUpdated: string
  color: string
  icon: ReportModuleIcon
  permissionKey: RbacModuleId
  aliases: string[]
  submodules: ReportSubmoduleConfig[]
}

export const REPORT_GLOBAL_MODULES = [
  {
    id: 'procurement',
    name: 'Procurement',
    description: 'Inventory, gudang, purchasing, workshop, fuel, dan kontrol persediaan dalam satu workspace procurement.',
    reportCount: liveInventoryReports.length,
    route: '/report-center/procurement',
    status: 'active',
    availability: 'live',
    lastUpdated: 'Today 09:00',
    color: '#167A3A',
    icon: 'Package',
    permissionKey: 'reports',
    aliases: ['inventory', 'gudang', 'workshop', 'fuel', 'purchasing'],
    submodules: [
      {
        id: 'inventory',
        name: 'Inventory',
        description: 'Master inventory procurement: default gabungan Stock Gudang (ItemType 1) dan Workshop/Mesin (ItemType 4).',
        reportCount: liveInventoryReports.length,
        route: '/report-center/procurement?stockGroup=inventory',
        availability: 'live',
      },
      {
        id: 'stock-gudang',
        name: 'Inventory: Gudang',
        description: 'Scope inventory khusus ItemType 1: posisi stock, valuasi, movement category, transfer, opname, dan stale item gudang.',
        reportCount: liveInventoryReports.filter((report) => ['executive', 'transaction', 'control'].includes(report.group)).length,
        route: '/report-center/procurement?stockGroup=gudang',
        availability: 'live',
      },
      {
        id: 'stock-workshop',
        name: 'Inventory: Workshop/Mesin',
        description: 'Scope inventory khusus ItemType 4: sparepart, vehicle running, job stock, dan pemakaian workshop.',
        reportCount: liveInventoryReports.filter((report) =>
          /workshop|vehicle/i.test(`${report.group} ${report.title} ${report.description} ${report.tags.join(' ')}`),
        ).length,
        route: '/report-center/procurement?stockGroup=workshop',
        availability: 'live',
      },
      {
        id: 'procurement-process',
        name: 'Procurement Process',
        description: 'PR, PO, goods receive, supplier performance, outstanding, dan rekonsiliasi movement.',
        reportCount: liveInventoryReports.filter((report) => report.group === 'purchasing').length,
        route: '/report-center/procurement?stockGroup=process',
        availability: 'live',
      },
      {
        id: 'fuel',
        name: 'Fuel Inventory',
        description: 'Pemakaian BBM, kendaraan, blok, qty, dan nilai fuel issue.',
        reportCount: liveInventoryReports.filter((report) => report.group === 'fuel').length,
        route: '/report-center/inventory/fuel-usage',
        availability: 'live',
      },
    ],
  },
  {
    id: 'payroll',
    name: 'Payroll',
    description: 'Payroll, daftar upah, wage register, comparison, dan kontrol pembayaran tenaga kerja.',
    reportCount: 24,
    route: '/report-center/payroll',
    status: 'active',
    availability: 'preview',
    lastUpdated: 'Today 08:00',
    color: '#0F766E',
    icon: 'Wallet',
    permissionKey: 'payroll',
    aliases: ['payroll-report', 'wages', 'upah', 'wage-register'],
    submodules: [
      { id: 'payroll-run', name: 'Payroll Run', description: 'Payroll periodik dan slip pembayaran.', reportCount: 8, availability: 'preview' },
      { id: 'wage-register', name: 'Wage Register', description: 'Daftar upah, comparison, dan kontrol biaya tenaga kerja.', reportCount: 10, availability: 'preview' },
      { id: 'payroll-audit', name: 'Payroll Audit', description: 'Exception, perubahan, dan jejak validasi payroll.', reportCount: 6, availability: 'preview' },
    ],
  },
  {
    id: 'human-resources',
    name: 'Human Resources',
    description: 'Kehadiran, premi, lembur, dampak report, dan analisis workforce non-payroll.',
    reportCount: 70,
    route: '/report-center/human-resources',
    status: 'active',
    availability: 'preview',
    lastUpdated: 'Today 08:00',
    color: '#DB2777',
    icon: 'Users',
    permissionKey: 'reports',
    aliases: ['hr', 'human-resource', 'attendance', 'absensi', 'premi', 'lembur'],
    submodules: [
      { id: 'attendance', name: 'Absensi', description: 'Kehadiran, absensi harian, dan status tenaga kerja.', reportCount: 18, availability: 'preview' },
      { id: 'premium-overtime', name: 'Premi & Lembur', description: 'Premi produksi, lembur, dan summary upah operasional.', reportCount: 17, availability: 'preview' },
      { id: 'workforce-analysis', name: 'Workforce Analysis', description: 'Summary, wages impact, dan analisis produktivitas tenaga kerja.', reportCount: 35, availability: 'preview' },
    ],
  },
  {
    id: 'financial',
    name: 'Financial',
    description: 'Produktivitas, cost efficiency, cost per KG, dan financial performance reporting.',
    reportCount: 16,
    route: '/report-center/financial',
    status: 'active',
    availability: 'preview',
    lastUpdated: 'Today 08:00',
    color: '#2563EB',
    icon: 'Wallet',
    permissionKey: 'reports',
    aliases: ['finance', 'productivity', 'produktivitas', 'cost'],
    submodules: [
      { id: 'produktivitas', name: 'Produktivitas', description: 'Panen harian, cost per KG, dan efisiensi output.', reportCount: 12, availability: 'preview' },
      { id: 'cost-control', name: 'Cost Control', description: 'Cost view dan variance biaya operasional.', reportCount: 4, availability: 'preview' },
    ],
  },
  {
    id: 'budget',
    name: 'Budget',
    description: 'Budget planning, budget realization, variance analysis, dan forecast.',
    reportCount: 12,
    route: '/report-center/budget',
    status: 'active',
    availability: 'preview',
    lastUpdated: 'Today 08:00',
    color: '#D99A00',
    icon: 'BarChart3',
    permissionKey: 'reports',
    aliases: ['budgeting', 'variance', 'forecast'],
    submodules: [
      { id: 'planning', name: 'Budget Planning', description: 'Rencana budget dan forecast.', reportCount: 4, availability: 'preview' },
      { id: 'realization', name: 'Budget Realization', description: 'Realisasi dan actual spending.', reportCount: 4, availability: 'preview' },
      { id: 'variance', name: 'Variance Analysis', description: 'Deviasi budget vs actual.', reportCount: 4, availability: 'preview' },
    ],
  },
] as const satisfies readonly ReportGlobalModuleConfig[]

export const REPORT_GLOBAL_MODULE_IDS = REPORT_GLOBAL_MODULES.map((module) => module.id)

export const REPORT_MODULE_ALIASES = REPORT_GLOBAL_MODULES.reduce<Record<string, ReportGlobalModuleId>>((aliases, module) => {
  aliases[module.id] = module.id
  module.aliases.forEach((alias) => {
    aliases[alias] = module.id
  })
  return aliases
}, {})

export function normalizeReportModuleId(id: string | null | undefined): ReportGlobalModuleId | undefined {
  if (!id) return undefined
  return REPORT_MODULE_ALIASES[id.trim().toLowerCase()]
}

export function getReportModuleConfig(id: string | null | undefined): ReportGlobalModuleConfig | undefined {
  const moduleId = normalizeReportModuleId(id)
  return moduleId ? REPORT_GLOBAL_MODULES.find((module) => module.id === moduleId) : undefined
}

export function getReportSubmoduleConfig(moduleId: string, submoduleId: string) {
  return getReportModuleConfig(moduleId)?.submodules.find((submodule) => submodule.id === submoduleId)
}

export function validateReportModuleRegistry() {
  const issues: string[] = []
  const ids = new Set<string>()
  const routes = new Set<string>()

  REPORT_GLOBAL_MODULES.forEach((module) => {
    if (ids.has(module.id)) issues.push(`Duplicate module id: ${module.id}`)
    ids.add(module.id)

    if (routes.has(module.route)) issues.push(`Duplicate module route: ${module.route}`)
    routes.add(module.route)

    const submoduleIds = new Set<string>()
    module.submodules.forEach((submodule) => {
      if (submoduleIds.has(submodule.id)) issues.push(`Duplicate submodule id in ${module.id}: ${submodule.id}`)
      submoduleIds.add(submodule.id)
    })
  })

  return {
    valid: issues.length === 0,
    issues,
  }
}
