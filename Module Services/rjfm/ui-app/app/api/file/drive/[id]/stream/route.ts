import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { rjfmFetch } from '../../../../../../lib/rjfm/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await rjfmFetch(`/api/v1/drive/${id}/stream`)
    const buf = Buffer.from(await r.arrayBuffer())
    const headers: Record<string, string> = {}
    const ct = r.headers.get('Content-Type'); if (ct) headers['Content-Type'] = ct
    const cd = r.headers.get('Content-Disposition'); if (cd) headers['Content-Disposition'] = cd
    return new NextResponse(buf, { status: r.status, headers })
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}
