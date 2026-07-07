import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const rawBaseUrl = process.env.SQL_GATEWAY_URL ?? 'http://10.0.0.110:3001/query'
const BASE_URL = rawBaseUrl.replace(/\/v1\/query\/?$/, '')
const TOKEN =
  process.env.SQL_GATEWAY_API_KEY ??
  '2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6'
type ReportSource = 'estate' | 'pabrik'

type GatewayServer = {
  name: string
  host: string
  port: number
  defaultDatabase?: string
  readOnly?: boolean
  connected?: boolean
  healthy?: boolean
}

type GatewayServersResponse = {
  success?: boolean
  data?: {
    servers?: GatewayServer[]
    defaultServer?: string
  }
  error?: string
}

function databaseForServer(server: string) {
  if (process.env.DATABASE_NAME) return process.env.DATABASE_NAME
  if (server === 'SERVER_PROFILE_2') return 'db_ptrj'
  if (server === 'SERVER_PROFILE_3') return 'db_ptrj_mill'
  return 'db_ptrj'
}

function sourceToServer(source: ReportSource) {
  return source === 'pabrik' ? 'SERVER_PROFILE_3' : 'SERVER_PROFILE_2'
}

function getSource(request: NextRequest): ReportSource {
  const raw = (request.nextUrl.searchParams.get('source') ?? '').trim().toLowerCase()
  return raw === 'pabrik' || raw === 'mill' || raw === 'factory' ? 'pabrik' : 'estate'
}

export async function GET(request: NextRequest) {
  const activeSource = getSource(request)
  const activeServerName = sourceToServer(activeSource)
  try {
    const response = await fetch(`${BASE_URL}/v1/servers`, {
      headers: { 'x-api-key': TOKEN },
      cache: 'no-store',
    })
    const result = (await response.json().catch(() => ({}))) as GatewayServersResponse
    const servers = result.data?.servers ?? []
    const activeServer = servers.find((server) => server.name === activeServerName)
    const sources = (['estate', 'pabrik'] as const).map((source) => {
      const serverName = sourceToServer(source)
      const server = servers.find((item) => item.name === serverName)
      return {
        source,
        label: source === 'pabrik' ? 'Pabrik' : 'Estate / Kebun',
        server: serverName,
        database: databaseForServer(serverName),
        connected: Boolean(server?.connected),
        healthy: Boolean(server?.healthy),
      }
    })

    if (!response.ok || result.success === false) {
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? `SQL Gateway HTTP ${response.status}`,
          activeSource,
          activeServer: activeServerName,
          activeDatabase: databaseForServer(activeServerName),
          checkedAt: new Date().toISOString(),
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success: true,
      gatewayOnline: true,
      activeSource,
      activeServer: activeServerName,
      activeDatabase: databaseForServer(activeServerName),
      activeConnected: Boolean(activeServer?.connected),
      activeHealthy: Boolean(activeServer?.healthy),
      sources,
      servers,
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        gatewayOnline: false,
        activeSource,
        activeServer: activeServerName,
        activeDatabase: databaseForServer(activeServerName),
        error: error instanceof Error ? error.message : 'Gagal membaca status SQL Gateway',
        checkedAt: new Date().toISOString(),
      },
      { status: 502 },
    )
  }
}
