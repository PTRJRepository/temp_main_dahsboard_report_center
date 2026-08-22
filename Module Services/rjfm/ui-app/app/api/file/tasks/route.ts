import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { rjfmFetch } from '../../../../lib/rjfm/server'

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.search || ''
    const r = await rjfmFetch(`/api/v1/tasks${q}`, { method: 'GET' })
    const body = await r.text()
    return new NextResponse(body, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } })
  } catch (e: any) {
    const s = e.message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ status: 'error', message: e.message }, { status: s })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const r = await rjfmFetch('/api/v1/tasks', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } })
    const text = await r.text()
    return new NextResponse(text, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } })
  } catch (e: any) {
    const s = e.message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ status: 'error', message: e.message }, { status: s })
  }
}
