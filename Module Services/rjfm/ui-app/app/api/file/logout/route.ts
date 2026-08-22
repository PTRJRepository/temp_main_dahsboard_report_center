import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
export async function POST() {
  const res = NextResponse.json({ status: 'success' })
  res.cookies.set('rjfm-token', '', { path: '/', maxAge: 0 })
  return res
}
