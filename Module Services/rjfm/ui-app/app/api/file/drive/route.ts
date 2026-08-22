import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { rjfmFetch } from '../../../../lib/rjfm/server'

export async function GET(req: NextRequest) {
  try {
    const r = await rjfmFetch(`/api/v1/drive${req.nextUrl.search}`)
    return new NextResponse(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') || ''
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData()
      const r = await rjfmFetch('/api/v1/drive/upload', { method: 'POST', body: form as any })
      return new NextResponse(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
    }
    const body = await req.text()
    const r = await rjfmFetch('/api/v1/drive/folders', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } })
    return new NextResponse(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}
