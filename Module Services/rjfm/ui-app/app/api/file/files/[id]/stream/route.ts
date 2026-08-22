import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { rjfmFetch } from '../../../../../../lib/rjfm/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await rjfmFetch(`/api/v1/files/${id}/stream`, { method: 'GET' })
    if (!r.ok) {
      const body = await r.text()
      return new NextResponse(body, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } })
    }
    const buf = Buffer.from(await r.arrayBuffer())
    const headers: Record<string, string> = {}
    const ct = r.headers.get('Content-Type')
    const cd = r.headers.get('Content-Disposition')
    if (ct) headers['Content-Type'] = ct
    if (cd) headers['Content-Disposition'] = cd
    return new NextResponse(buf, { status: 200, headers })
  } catch (e: any) {
    const s = e.message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ status: 'error', message: e.message }, { status: s })
  }
}
