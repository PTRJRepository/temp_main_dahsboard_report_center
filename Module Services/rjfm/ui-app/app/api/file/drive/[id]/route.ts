import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { rjfmFetch } from '../../../../../lib/rjfm/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.text()
    const r = await rjfmFetch(`/api/v1/drive/${id}`, { method: 'PATCH', body, headers: { 'Content-Type': 'application/json' } })
    return new NextResponse(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}
