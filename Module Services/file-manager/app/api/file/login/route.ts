import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'

const RJFM_BASE = process.env.RJFM_BASE_URL || 'http://localhost:8011'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const r = await fetch(`${RJFM_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: body.username || body.email, password: body.password }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) return NextResponse.json(data, { status: r.status })
  const token = data?.data?.token
  const res = NextResponse.json(data)
  if (token) {
    res.cookies.set('rjfm-token', token, { httpOnly: false, secure: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12 })
  }
  return res
}
