/**
 * lib/rbac/types.ts
 * Shared TypeScript types for the RBAC system.
 */

export type Role = 'kerani' | 'hr' | 'payroll' | 'manager' | 'admin' | 'SuperAdmin';

/** All available module IDs in the Report Center */
export type ModuleId =
  | 'dashboard'
  | 'queries'
  | 'users'
  | 'reports'
  | 'payroll'
  | 'settings'
  | 'audit_logs';

export type ReportCenterModuleId =
  | 'procurement'
  | 'payroll'
  | 'human-resources'
  | 'financial'
  | 'budget';

/** Human-readable role labels */
export const ROLE_LABELS: Record<Role, string> = {
  kerani:  'Kerani',
  hr:      'HR',
  payroll: 'Payroll',
  manager: 'Manager',
  admin:   'Admin',
  SuperAdmin: 'SuperAdmin',
};

export interface UserSession {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  email?: string;
  /** ISO timestamp of when the session was created */
  sessionCreatedAt: string;
  /** ISO timestamp of when the access token expires */
  expiresAt: string;
}

export interface AuthContextValue {
  /** Currently authenticated user, or null when logged out */
  user: UserSession | null;
  /** True while the auth state is being resolved (e.g. token check) */
  isLoading: boolean;
  login(username: string, password: string): Promise<void>;
  logout(): void;
}
