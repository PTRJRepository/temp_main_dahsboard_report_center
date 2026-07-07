import { liveInventoryReports } from './inventory/config'
import { getIntelligenceModule, type IntelligenceModuleId } from './intelligence'

type ReportSource = 'estate' | 'pabrik'

type ModulePanelReport = {
  id: string
  title: string
  description: string
  group: string
  status: string
  href?: string
}

type ModulePanelSubModule = {
  id: string
  name: string
  description: string
  count: number
  href?: string
}

function subModulesFor(moduleId: IntelligenceModuleId, source: ReportSource): ModulePanelSubModule[] {
  if (moduleId === 'procurement') {
    return [
      {
        id: 'inventory',
        name: 'Inventory',
        description: 'Stock, gudang, movement, valuasi, fuel, dan audit inventory.',
        count: liveInventoryReports.length,
        href: `/report-center/inventory?source=${source}`,
      },
      {
        id: 'gudang',
        name: 'Gudang & Stock',
        description: 'Posisi stok gudang, valuasi, transfer, opname, dan adjustment.',
        count: liveInventoryReports.filter((report) => ['executive', 'transaction', 'control'].includes(report.group)).length,
        href: `/report-center/inventory?source=${source}&stage=all&report=INV-14`,
      },
      {
        id: 'workshop',
        name: 'Workshop & Vehicle',
        description: 'Item workshop, vehicle running, dan transaksi operasional kendaraan.',
        count: liveInventoryReports.filter((report) => /workshop|vehicle/i.test(`${report.group} ${report.title} ${report.description} ${report.tags.join(' ')}`)).length,
        href: `/report-center/inventory?source=${source}&stage=all&report=INV-07`,
      },
      {
        id: 'fuel',
        name: 'Fuel Inventory',
        description: 'Pemakaian BBM, kendaraan, blok, qty, dan nilai fuel issue.',
        count: liveInventoryReports.filter((report) => report.group === 'fuel').length,
        href: `/report-center/inventory?source=${source}&stage=all&report=INV-10`,
      },
    ]
  }

  const fallback: Record<Exclude<IntelligenceModuleId, 'procurement'>, ModulePanelSubModule[]> = {
    financial: [
      { id: 'produktivitas', name: 'Produktivitas', description: 'Panen harian, cost per KG, dan efisiensi output.', count: 16 },
      { id: 'cost', name: 'Cost Control', description: 'Cost view dan variance biaya operasional.', count: 4 },
    ],
    'human-resources': [
      { id: 'payroll', name: 'Payroll', description: 'Payroll, daftar upah, wages comparison.', count: 24 },
      { id: 'absensi', name: 'Absensi', description: 'Kehadiran, premi, lembur, dan dampak report.', count: 18 },
      { id: 'premi-lembur', name: 'Premi & Lembur', description: 'Premi produksi, lembur, summary upah.', count: 17 },
    ],
    budget: [
      { id: 'planning', name: 'Budget Planning', description: 'Rencana budget dan forecast.', count: 4 },
      { id: 'realization', name: 'Budget Realization', description: 'Realisasi dan actual spending.', count: 4 },
      { id: 'variance', name: 'Variance Analysis', description: 'Deviasi budget vs actual.', count: 4 },
    ],
  }

  return fallback[moduleId]
}

export function getModulePanel(moduleId: string | null, source: ReportSource) {
  if (!moduleId) return null

  const reportModule = getIntelligenceModule(moduleId)
  if (!reportModule) return null

  const reports: ModulePanelReport[] = reportModule.id === 'procurement'
    ? liveInventoryReports.map((report) => ({
        id: report.id,
        title: report.title,
        description: report.description,
        group: report.groupTitle,
        status: report.status === 'live' ? 'Live' : 'Update',
        href: `/report-center/inventory/${report.id}?source=${source}`,
      }))
    : reportModule.ranking.map((report, index) => ({
        id: `${reportModule.id}-${index}`,
        title: report.label,
        description: report.note,
        group: reportModule.name,
        status: report.value,
      }))

  return {
    module: reportModule as typeof reportModule & { id: IntelligenceModuleId },
    subModules: subModulesFor(reportModule.id, source),
    reports,
  }
}
