import {
  REPORT_GLOBAL_MODULES,
  REPORT_GLOBAL_MODULE_IDS,
  getReportModuleConfig as getCanonicalReportModuleConfig,
  type ReportModuleIcon,
  type ReportModuleStatus,
} from '@/lib/reports/module-registry';

export type ModuleStatus = ReportModuleStatus;
export type ModuleIcon = ReportModuleIcon;

export interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  reportCount: number;
  route: string;
  status: ModuleStatus;
  lastUpdated: string;
  color: string;
  icon: ModuleIcon;
}

export const MODULE_CONFIGS: ModuleConfig[] = REPORT_GLOBAL_MODULES.map((module) => ({
  id: module.id,
  name: module.name,
  description: module.description,
  reportCount: module.reportCount,
  route: `/report-center?module=${module.id}#modules`,
  status: module.status,
  lastUpdated: module.lastUpdated,
  color: module.color,
  icon: module.icon,
}));

/** All valid module IDs for generateStaticParams */
export const MODULE_IDS = [...REPORT_GLOBAL_MODULE_IDS];

/** Lookup helper */
export const getModuleConfig = (id: string): ModuleConfig | undefined =>
  MODULE_CONFIGS.find((m) => m.id === getCanonicalReportModuleConfig(id)?.id);
