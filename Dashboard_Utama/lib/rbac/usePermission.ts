/**
 * lib/rbac/usePermission.ts
 * Custom React hooks for RBAC permission checks in components.
 * Wraps the pure functions from ./permissions.ts with live role context.
 */

import { useCallback } from 'react';
import { useAuthContext } from './AuthContext';
import type { ModuleId, ReportId, ExportFormat } from '@/modules/report-center/lib/rbac/permissions';
import {
  canAccessModule,
  canViewReport,
  canExport,
  getAccessibleModules,
  getViewableReports,
  getExportableFormats,
} from '@/modules/report-center/lib/rbac/permissions';

// ─── Core hook ───────────────────────────────────────────────────────────────

/**
 * Returns a permission function scoped to the current user.
 *
 * Usage:
 *   const { can } = usePermission();
 *   if (can('accessModule', 'payroll')) { ... }
 *
 * Supported actions: 'accessModule' | 'viewReport' | 'export'
 */
export function usePermission() {
  const { user } = useAuthContext();
  const role = user?.role ?? null;

  const can = useCallback(
    (action: 'accessModule' | 'viewReport' | 'export', target: string): boolean => {
      if (!role) return false;

      switch (action) {
        case 'accessModule':
          return canAccessModule(role, target as ModuleId);
        case 'viewReport':
          return canViewReport(role, target as ReportId);
        case 'export':
          return canExport(role, target as ExportFormat);
        default:
          return false;
      }
    },
    [role],
  );

  return { can, role };
}

// ─── Named helpers ───────────────────────────────────────────────────────────

/**
 * Returns the set of module IDs the current user can access.
 * Updates automatically when the session changes.
 */
export function useModuleAccess(): ModuleId[] {
  const { user } = useAuthContext();
  if (!user) return [];
  return getAccessibleModules(user.role);
}

/**
 * Returns the set of report IDs the current user can view.
 */
export function useReportAccess(): ReportId[] {
  const { user } = useAuthContext();
  if (!user) return [];
  return getViewableReports(user.role);
}

/**
 * Returns the set of export formats the current user can use.
 */
export function useExportAccess(): ExportFormat[] {
  const { user } = useAuthContext();
  if (!user) return [];
  return getExportableFormats(user.role);
}