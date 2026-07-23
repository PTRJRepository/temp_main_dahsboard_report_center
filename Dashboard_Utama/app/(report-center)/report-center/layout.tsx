import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/utils/jwt'
import ReportCenterShell from './ReportCenterShell'

export const runtime = 'nodejs'
// Cookie/JWT auth makes every report-center page request-time only.
// Without this, Next's static-path worker (jest-worker) dies compiling these routes.
export const dynamic = 'force-dynamic'

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

  if (payload.role !== 'ADMIN') {
    redirect('/dashboard-user')
  }

  return <ReportCenterShell>{children}</ReportCenterShell>
}
