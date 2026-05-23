/**
 * lib/rbac/index.ts
 * Public API surface for the RBAC library.
 */

export type { Role } from './types';
export { ROLE_LABELS } from './types';
export type { UserSession, AuthContextValue } from './types';
export { AuthProvider, useAuthContext, MOCK_USER_LIST } from './AuthContext';

export type { ModuleId, ReportId, ExportFormat } from './permissions';
export { MODULE_LABELS, REPORT_LABELS } from './permissions';
export {
  canAccessModule,
  canViewReport,
  canExport,
  getAccessibleModules,
  getViewableReports,
  getExportableFormats,
} from './permissions';

export { usePermission, useModuleAccess, useReportAccess, useExportAccess } from './usePermission';

export type { ProtectedRouteProps } from './ProtectedRoute';
export { ProtectedRoute } from './ProtectedRoute';