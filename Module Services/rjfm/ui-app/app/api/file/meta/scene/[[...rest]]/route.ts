// Proxy scene photo API: /api/file/meta/scene* → Express /api/v1/meta/scene*
// (diluar whitelist [kind], jadi butuh route sendiri agar tidak 404).
import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { rjfmFetch } from '../../../../../../lib/rjfm/server'

async function proxy(req: NextRequest, suffix: string) {
  try {
    const search = req.nextUrl.search || ''
    const r = await rjfmFetch(`/api/v1/meta/scene${suffix}${search}`, { method: 'GET' })
    if (suffix.startsWith('/image')) {
      // biner — teruskan apa adanya
      const buf = Buffer.from(await r.arrayBuffer())
      const headers: Record<string, string> = {}
      const ct = r.headers.get('Content-Type'); if (ct) headers['Content-Type'] = ct
      const cc = r.headers.get('Cache-Control'); if (cc) headers['Cache-Control'] = cc
      return new NextResponse(buf, { status: r.status, headers })
    }
    const body = await r.text()
    return new NextResponse(body, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } })
  } catch (e: any) {
    const s = e.message === 'Unauthorized' ? 401 : 502
    return NextResponse.json({ status: 'error', message: e.message }, { status: s })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ rest?: string[] }> }) {
  const { rest } = await params
  return proxy(req, '/' + (rest || []).join('/'))
}
