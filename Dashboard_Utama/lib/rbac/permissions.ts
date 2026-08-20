/**
 * lib/rbac/permissions.ts
 * Core RBAC permission functions.
 * Defines module access, report visibility, and export permissions per role.
 * TypeScript strict mode.
 */

import { getReportModuleConfig } from '@/modules/report-center/lib/reports/module-registry';
import type { ModuleId, ReportCenterModuleId, Role } from './types';

export type { ModuleId } from './types';

// ─── Module Registry ─────────────────────────────────────────────────────────

/** Human-readable module labels */
export const MODULE_LABELS: Record<ModuleId, string> = {
  dashboard:   'Dashboard',
  queries:     'Query Builder',
  users:       'User Management',
  reports:     'Reports',
  payroll:     'Payroll',
  settings:    'Settings',
  audit_logs:  'Audit Logs',
};

// ─── Access Matrix ───────────────────────────────────────────────────────────

/** Which roles can access each module */
const MODULE_ACCESS: Record<ModuleId, Role[]> = {
  dashboard:   ['kerani', 'hr', 'payroll', 'manager', 'admin', 'SuperAdmin'],
  queries:     ['kerani', 'hr', 'payroll', 'manager', 'admin', 'SuperAdmin'],
  users:       ['hr', 'manager', 'admin', 'SuperAdmin'],
  reports:     ['kerani', 'hr', 'payroll', 'manager', 'admin', 'SuperAdmin'],
  payroll:     ['payroll', 'manager', 'admin', 'SuperAdmin'],
  settings:    ['manager', 'admin', 'SuperAdmin'],
  audit_logs:  ['manager', 'admin', 'SuperAdmin'],
};

// ─── Report Types ────────────────────────────────────────────────────────────

export type ReportId =
  | 'summary'
  | 'query_history'
  | 'user_activity'
  | 'hr_report'
  | 'payroll_report'
  | 'audit_log';

export const REPORT_LABELS: Record<ReportId, string> = {
  summary:          'Summary Report',
  query_history:    'Query History',
  user_activity:    'User Activity',
  hr_report:        'HR Report',
  payroll_report:  'Payroll Report',
  audit_log:        'Audit Log',
};

/** Which roles can view each report */
const REPORT_ACCESS: Record<ReportId, Role[]> = {
  summary:         ['kerani', 'hr', 'payroll', 'manager', 'admin', 'SuperAdmin'],
  query_history:   ['kerani', 'hr', 'payroll', 'manager', 'admin', 'SuperAdmin'],
  user_activity:   ['manager', 'admin', 'SuperAdmin'],
  hr_report:        ['hr', 'manager', 'admin', 'SuperAdmin'],
  payroll_report:  ['payroll', 'manager', 'admin', 'SuperAdmin'],
  audit_log:        ['manager', 'admin', 'SuperAdmin'],
};

// ─── Export Capabilities ─────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'xlsx' | 'json' | 'pdf';

const EXPORT_ACCESS: Record<ExportFormat, Role[]> = {
  csv:  ['kerani', 'hr', 'payroll', 'manager', 'admin', 'SuperAdmin'],
  xlsx: ['payroll', 'manager', 'admin', 'SuperAdmin'],
  json: ['manager', 'admin', 'SuperAdmin'],
  pdf:  ['manager', 'admin', 'SuperAdmin'],
};

// ─── Guard Helpers ───────────────────────────────────────────────────────────

/**
 * Returns true when `role` is allowed to access `module`.
 */
export function canAccessModule(role: Role, module: ModuleId): boolean {
  return MODULE_ACCESS[module]?.includes(role) ?? false;
}

/**
 * Maps Report Center global modules to existing RBAC modules.
 * This keeps Payroll restricted to the payroll permission while preserving
 * legacy Report Center access for the other global report modules.
 */
export function canAccessReportCenterModule(role: Role, module: ReportCenterModuleId | string): boolean {
  const config = getReportModuleConfig(module);
  return config ? canAccessModule(role, config.permissionKey) : false;
}

/**
 * Returns true when `role` is allowed to view `report`.
 */
export function canViewReport(role: Role, report: ReportId): boolean {
  return REPORT_ACCESS[report]?.includes(role) ?? false;
}

/**
 * Returns true when `role` is allowed to export in `format`.
 */
export function canExport(role: Role, format: ExportFormat): boolean {
  return EXPORT_ACCESS[format]?.includes(role) ?? false;
}

/**
 * Returns all modules a given role can access.
 */
export function getAccessibleModules(role: Role): ModuleId[] {
  return (Object.keys(MODULE_ACCESS) as ModuleId[]).filter((m) =>
    canAccessModule(role, m),
  );
}

/**
 * Returns all reports a given role can view.
 */
export function getViewableReports(role: Role): ReportId[] {
  return (Object.keys(REPORT_ACCESS) as ReportId[]).filter((r) =>
    canViewReport(role, r),
  );
}

/**
 * Returns all export formats a given role can use.
 */
export function getExportableFormats(role: Role): ExportFormat[] {
  return (Object.keys(EXPORT_ACCESS) as ExportFormat[]).filter((f) =>
    canExport(role, f),
  );
}
