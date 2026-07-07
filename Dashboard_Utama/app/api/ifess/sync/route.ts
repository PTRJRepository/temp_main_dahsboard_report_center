// /api/ifess/sync — SERVER-PULL sync endpoint.
// POST { division, table, clientId } → server pulls latest data from the client (dispatches
// a query, polls the result, bulk-inserts to SQL, advances watermark). Client is passive.
// The old client-push (watermark GET + chunk POST) is removed.
import { NextRequest, NextResponse } from 'next/server'
import { pullTable } from '@/lib/ifess-sync/pull'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }
  const { division, table, clientId } = body
  if (!division || !table || !clientId) {
    return NextResponse.json({ error: 'division, table, clientId required' }, { status: 400 })
  }
  const result = await pullTable(division, table, clientId)
  return NextResponse.json(result, { status: result.status === 'failed' ? 500 : 200 })
}
