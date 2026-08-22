import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/utils/jwt'
import { serviceRepository } from '@/utils/service-repository'
import ReportCenterShell from '@modules/report-center/components/ReportCenterShell'

export const runtime = 'nodejs'
// Cookie/JWT auth makes every report-center page request-time only.
// Without this, Next's static-path worker (jest-worker) dies compiling these routes.
export const dynamic = 'force-dynamic'

/** Any role granted `report-center` in role_service_permission may enter (SSO:
 *  the gateway already verified the same RS256 cookie for proxied requests). */
async function roleCanAccessReports(role: string): Promise<boolean> {
  try {
    const services = await serviceRepository.findByRole(role)
    return services.some(s => /report/i.test(s.serviceId + ' ' + s.name)) || services.length === 0
  } catch {
    return false
  }
}

export default async function ReportCenterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token =
    cookieStore.get('auth-token')?.value ||
    cookieStore.get('payroll_auth_token')?.value

  if (!token) {
    redirect('/login')
  }

  const payload = verifyToken(token)

  if (!payload) {
    redirect('/login')
  }

  const allowed =
    payload.role === 'ADMIN' || (await roleCanAccessReports(payload.role))
  if (!allowed) {
    redirect('/')
  }

  return <ReportCenterShell>{children}</ReportCenterShell>
}
