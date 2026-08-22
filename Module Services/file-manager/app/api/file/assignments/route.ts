import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { rjfmFetch } from '../../../../lib/rjfm/server'

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.search || ''
    const r = await rjfmFetch(`/api/v1/assignments${q}`, { method: 'GET' })
    const body = await r.text()
    return new NextResponse(body, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } })
  } catch (e: any) {
    const s = e.message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ status: 'error', message: e.message }, { status: s })
  }
}
