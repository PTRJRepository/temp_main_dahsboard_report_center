import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { rjfmFetch } from '../../../../../lib/rjfm/server'

const ALLOWED = new Set(['categories', 'afdelings', 'users', 'notifications'])

export async function GET(_req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const { kind } = await params
    if (!ALLOWED.has(kind)) return NextResponse.json({ status: 'error', message: 'Not found' }, { status: 404 })
    const r = await rjfmFetch(`/api/v1/${kind}`, { method: 'GET' })
    const body = await r.text()
    return new NextResponse(body, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } })
  } catch (e: any) {
    const s = e.message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ status: 'error', message: e.message }, { status: s })
  }
}
