import 'server-only'
import { cookies } from 'next/headers'
import { verifyToken } from '../../utils/jwt'
import jwt from 'jsonwebtoken'

const RJFM_BASE = process.env.RJFM_BASE_URL || 'http://localhost:8011'
const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'ptrj-rebinmas-secret-key-2024'

export type RjfmSession = { userId: number; name: string; email: string; role: string; token: string; source: 'portal' | 'rjfm' }

export async function getSession(): Promise<RjfmSession | null> {
  const jar = await cookies()
  const rjfmTok = jar.get('rjfm-token')?.value
  if (rjfmTok) {
    try {
      const p = jwt.verify(rjfmTok, JWT_SECRET) as any
      return {
        userId: p.user_id, name: p.username, email: p.username, role: p.role_code, token: rjfmTok, source: 'rjfm',
      }
    } catch { /* fall through */ }
  }
  const raw = jar.get('auth-token')?.value || jar.get('payroll_auth_token')?.value || null
  if (!raw) return null
  const p = verifyToken(raw)
  if (!p) return null
  const token = jwt.sign(
    { user_id: p.userId, username: p.email || p.username, role_code: p.role },
    JWT_SECRET,
    { expiresIn: '2h' },
  )
  return { userId: p.userId, name: p.name, email: p.email, role: p.role, token, source: 'portal' }
}

export function isManagerRole(role?: string) {
  return ['ADMIN', 'MANAGER', 'ASISTEN', 'SUPERADMIN'].includes((role || '').toUpperCase())
}

export async function rjfmFetch(path: string, init: RequestInit = {}) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  const url = `${RJFM_BASE}${path.startsWith('/') ? path : `/${path}`}`
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${session.token}`,
  }
  if (!(init.body instanceof FormData) && !headers['Content-Type'] && init.method && init.method !== 'GET') {
    headers['Content-Type'] = 'application/json'
  }
  return fetch(url, { ...init, headers, cache: 'no-store' })
}
