import { liveInventoryReports } from './inventory/config'
import { getIntelligenceModule, type IntelligenceModuleId } from './intelligence'
import { getReportModuleConfig } from './module-registry'

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
  const moduleConfig = getReportModuleConfig(moduleId)
  if (!moduleConfig) return []

  return moduleConfig.submodules.map((submodule) => {
    const href = submodule.route?.startsWith('/report-center')
      ? withReportSource(submodule.route, source)
      : submodule.route

    return {
      id: submodule.id,
      name: submodule.name,
      description: submodule.description,
      count: submodule.reportCount,
      href,
    }
  })
}

function withReportSource(route: string, source: ReportSource) {
  const separator = route.includes('?') ? '&' : '?'
  return route.includes('source=') ? route : `${route}${separator}source=${source}`
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
