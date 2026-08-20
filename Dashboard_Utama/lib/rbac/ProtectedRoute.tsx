/**
 * lib/rbac/ProtectedRoute.tsx
 * Route wrapper that enforces RBAC at the component level.
 * Renders the target element only when the user is authenticated AND
 * authorized; otherwise redirects to /login (unauthenticated) or
 * renders the `unauthorized` slot (authenticated but unauthorized).
 */

'use client'

import React from 'react'
import { redirect } from 'next/navigation'
import { useAuth } from '@/modules/report-center/components/AuthProvider'
import { canAccessModule, canAccessReportCenterModule } from '@/modules/report-center/lib/rbac/permissions'
import type { ModuleId, ReportCenterModuleId, Role } from './types'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProtectedRouteProps {
  children: React.ReactNode
  module?: ModuleId
  reportModule?: ReportCenterModuleId
  allowedRoles?: string[]
  loginPrompt?: React.ReactNode
  unauthorized?: React.ReactNode
  renderOnDenied?: boolean
  redirectOnUnauthenticated?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ProtectedRoute
 *
 * Simple usage (module-based):
 *   <ProtectedRoute module="payroll">
 *     <PayrollPage />
 *   </ProtectedRoute>
 *
 * Role-based:
 *   <ProtectedRoute allowedRoles={['manager', 'admin']}>
 *     <AdminPanel />
 *   </ProtectedRoute>
 *
 * Show inline prompt instead of redirect when unauthenticated:
 *   <ProtectedRoute allowedRoles={['admin']} redirectOnUnauthenticated={false} loginPrompt={<p>Silakan login</p>}>
 *     <AdminPanel />
 *   </ProtectedRoute>
 */
export function ProtectedRoute({
  children,
  module,
  reportModule,
  allowedRoles,
  loginPrompt = (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <p className="text-slate-600 text-sm">Anda harus login untuk mengakses halaman ini.</p>
      </div>
    </div>
  ),
  unauthorized = (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <p className="text-slate-600 text-sm">Akses ditolak — Anda tidak memiliki izin untuk halaman ini.</p>
      </div>
    </div>
  ),
  renderOnDenied = false,
  redirectOnUnauthenticated = true,
}: ProtectedRouteProps): React.JSX.Element {
  const { user, isLoading } = useAuth()

  // Auth state still loading — render nothing to avoid flash
  if (isLoading) {
    return <>{null}</>
  }

  // Not authenticated
  if (!user) {
    if (redirectOnUnauthenticated) {
      redirect('/login')  // throws — never returns
    }
    return <>{loginPrompt}</>
  }

  // Determine if access is granted
  let granted = false
  if (allowedRoles !== undefined) {
    granted = allowedRoles.includes(user.role)
  } else if (reportModule !== undefined) {
    granted = canAccessReportCenterModule(user.role as Role, reportModule)
  } else if (module !== undefined) {
    granted = canAccessModule(user.role as Role, module)
  } else {
    // Neither gate provided — treat as public (allow)
    granted = true
  }

  if (!granted) {
    if (renderOnDenied) {
      return <>{unauthorized}</>
    }
    // Authenticated but unauthorized — no /unauthorized route exists;
    // show inline unauthorized slot
    return <>{unauthorized}</>
  }

  return <>{children}</>
}
