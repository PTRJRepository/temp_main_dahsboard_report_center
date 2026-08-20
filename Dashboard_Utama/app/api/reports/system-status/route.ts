import { NextRequest, NextResponse } from 'next/server'
import {
  gatewayOverrideFromRequest,
  resolveSqlGatewayApiKey,
  resolveSqlGatewayBase,
  sqlGatewayServersUrl,
  SQL_GATEWAY_FALLBACK,
  SQL_GATEWAY_PRIMARY,
  SQL_GATEWAY_PRESETS,
} from '@/modules/report-center/lib/reports/sql-gateway-config'

export const dynamic = 'force-dynamic'

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

function publicGatewayError() {
  return 'Status SQL Gateway belum tersedia. Periksa konfigurasi server-side.'
}

function publicServerStatus(server: GatewayServer) {
  return {
    name: server.name,
    defaultDatabase: server.defaultDatabase,
    readOnly: server.readOnly,
    connected: Boolean(server.connected),
    healthy: Boolean(server.healthy),
  }
}

export async function GET(request: NextRequest) {
  const activeSource = getSource(request)
  const activeServerName = sourceToServer(activeSource)
  const override = gatewayOverrideFromRequest({
    headers: request.headers,
    searchParams: request.nextUrl.searchParams,
  })
  const baseUrl = resolveSqlGatewayBase({ override })
  const token = resolveSqlGatewayApiKey()

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        gatewayOnline: false,
        gatewayBase: baseUrl,
        presets: SQL_GATEWAY_PRESETS,
        defaults: { primary: SQL_GATEWAY_PRIMARY, fallback: SQL_GATEWAY_FALLBACK },
        activeSource,
        activeServer: activeServerName,
        activeDatabase: databaseForServer(activeServerName),
        error: publicGatewayError(),
        checkedAt: new Date().toISOString(),
      },
      { status: 503 },
    )
  }

  try {
    const response = await fetch(sqlGatewayServersUrl(baseUrl), {
      headers: { 'x-api-key': token },
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
          gatewayOnline: false,
          gatewayBase: baseUrl,
          presets: SQL_GATEWAY_PRESETS,
          defaults: { primary: SQL_GATEWAY_PRIMARY, fallback: SQL_GATEWAY_FALLBACK },
          error: publicGatewayError(),
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
      gatewayBase: baseUrl,
      presets: SQL_GATEWAY_PRESETS,
      defaults: { primary: SQL_GATEWAY_PRIMARY, fallback: SQL_GATEWAY_FALLBACK },
      activeSource,
      activeServer: activeServerName,
      activeDatabase: databaseForServer(activeServerName),
      activeConnected: Boolean(activeServer?.connected),
      activeHealthy: Boolean(activeServer?.healthy),
      sources,
      servers: servers.map(publicServerStatus),
      checkedAt: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json(
      {
        success: false,
        gatewayOnline: false,
        gatewayBase: baseUrl,
        presets: SQL_GATEWAY_PRESETS,
        defaults: { primary: SQL_GATEWAY_PRIMARY, fallback: SQL_GATEWAY_FALLBACK },
        activeSource,
        activeServer: activeServerName,
        activeDatabase: databaseForServer(activeServerName),
        error: publicGatewayError(),
        checkedAt: new Date().toISOString(),
      },
      { status: 502 },
    )
  }
}
