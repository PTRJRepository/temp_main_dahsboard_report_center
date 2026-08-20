/**
 * lib/rbac/index.ts
 * Public API surface for the RBAC library.
 */

export type { Role } from './types';
export { ROLE_LABELS } from './types';
export type { UserSession, AuthContextValue } from './types';
export { AuthProvider, useAuthContext, MOCK_USER_LIST } from './AuthContext';

// NOTE: permission helpers (canAccessModule, etc.) moved to
// modules/report-center/lib/rbac/permissions.ts (report-center module scope).

export { usePermission, useModuleAccess, useReportAccess, useExportAccess } from './usePermission';

export type { ProtectedRouteProps } from './ProtectedRoute';
export { ProtectedRoute } from './ProtectedRoute';