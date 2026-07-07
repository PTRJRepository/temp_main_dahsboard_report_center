import { NextRequest, NextResponse } from 'next/server'

// Use Node.js runtime
export const runtime = 'nodejs'

// Server-side API key (from environment)
const IFESS_API_KEY = process.env.IFESS_API_KEY || 'ptrj-rebinmas-air-ruak-parit-gunung-darul'
const GATEWAY_BASE = process.env.GATEWAY_BASE || 'http://localhost:3001'

// Map frontend method names to API endpoints
const ENDPOINT_MAP: Record<string, { method: string; path: string }> = {
    // Dashboard
    'getDashboard': { method: 'GET', path: '/api/ifess/dashboard' },

    // Clients
    'listClients': { method: 'GET', path: '/api/ifess/clients' },
    'getClient': { method: 'GET', path: '/api/ifess/clients' },
    'getClientConfig': { method: 'GET', path: '/api/ifess/clients' },
    'registerClient': { method: 'POST', path: '/api/ifess/clients/register' },
    'updateClientConfig': { method: 'PUT', path: '/api/ifess/clients' },

    // Heartbeat
    'sendHeartbeat': { method: 'POST', path: '/api/ifess/clients' },

    // Module Status
    'getModuleStatuses': { method: 'GET', path: '/api/ifess/module-statuses' },
    'reportModuleStatus': { method: 'POST', path: '/api/ifess/clients' },

    // Commands
    'listCommands': { method: 'GET', path: '/api/ifess/commands' },
    'createCommand': { method: 'POST', path: '/api/ifess/clients' },
    'pollCommands': { method: 'GET', path: '/api/ifess/clients' },
    'reportCommandResult': { method: 'POST', path: '/api/ifess/clients' },

    // Client Groups
    'listClientGroups': { method: 'GET', path: '/api/ifess/client-groups' },
    'getClientGroup': { method: 'GET', path: '/api/ifess/client-groups' },
    'createClientGroup': { method: 'POST', path: '/api/ifess/client-groups' },
    'updateClientGroup': { method: 'PUT', path: '/api/ifess/client-groups' },
    'deleteClientGroup': { method: 'DELETE', path: '/api/ifess/client-groups' },
    'addClientToGroup': { method: 'POST', path: '/api/ifess/client-groups' },
    'removeClientFromGroup': { method: 'DELETE', path: '/api/ifess/client-groups' },

    // Audit Logs
    'listAuditLogs': { method: 'GET', path: '/api/ifess/audit-logs' }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action, params = {} } = body

        if (!action) {
            return NextResponse.json(
                { error: 'Action is required' },
                { status: 400 }
            )
        }

        const endpoint = ENDPOINT_MAP[action]
        if (!endpoint) {
            return NextResponse.json(
                { error: `Unknown action: ${action}` },
                { status: 400 }
            )
        }

        // Build the full URL based on action
        let url: string
        const fetchOptions: RequestInit = {
            method: endpoint.method,
            headers: {
                'X-API-Key': IFESS_API_KEY,
                'Content-Type': 'application/json'
            }
        }

        switch (action) {
            case 'getDashboard':
                url = `${GATEWAY_BASE}/api/ifess/dashboard`
                break

            case 'listClients':
                url = `${GATEWAY_BASE}/api/ifess/clients`
                break

            case 'getClient':
                url = `${GATEWAY_BASE}/api/ifess/clients/${params.clientId}`
                break

            case 'getClientConfig':
                url = `${GATEWAY_BASE}/api/ifess/clients/${params.clientId}/config`
                break

            case 'registerClient':
                url = `${GATEWAY_BASE}/api/ifess/clients/register`
                fetchOptions.body = JSON.stringify(params)
                break

            case 'updateClientConfig':
                url = `${GATEWAY_BASE}/api/ifess/clients/${params.clientId}/config`
                fetchOptions.body = JSON.stringify(params.config || params)
                break

            case 'sendHeartbeat':
                url = `${GATEWAY_BASE}/api/ifess/clients/${params.clientId}/heartbeat`
                fetchOptions.body = JSON.stringify({
                    timestamp: new Date().toISOString(),
                    status: params.status || 'Online',
                    uptimeSeconds: params.uptimeSeconds || 0,
                    modules: params.modules || []
                })
                break

            case 'getModuleStatuses':
                url = params.clientId
                    ? `${GATEWAY_BASE}/api/ifess/clients/${params.clientId}/modules/status`
                    : `${GATEWAY_BASE}/api/ifess/module-statuses`
                break

            case 'reportModuleStatus':
                url = `${GATEWAY_BASE}/api/ifess/clients/${params.clientId}/modules/status`
                fetchOptions.body = JSON.stringify({ modules: params.modules || [] })
                break

            case 'listCommands':
                url = `${GATEWAY_BASE}/api/ifess/commands`
                if (params.clientId) {
                    url += `?clientId=${params.clientId}`
                }
                break

            case 'createCommand':
                url = `${GATEWAY_BASE}/api/ifess/clients/${params.clientId}/commands`
                fetchOptions.body = JSON.stringify({
                    commandType: params.commandType,
                    moduleCode: params.moduleCode,
                    payload: params.payload || {}
                })
                break

            case 'pollCommands':
                url = `${GATEWAY_BASE}/api/ifess/clients/${params.clientId}/commands/pending`
                break

            case 'reportCommandResult':
                url = `${GATEWAY_BASE}/api/ifess/clients/${params.clientId}/commands/${params.commandId}/result`
                fetchOptions.body = JSON.stringify({
                    status: params.status,
                    message: params.message
                })
                break

            // Client Groups
            case 'listClientGroups':
                url = `${GATEWAY_BASE}/api/ifess/client-groups`
                break

            case 'getClientGroup':
                url = `${GATEWAY_BASE}/api/ifess/client-groups/${params.groupCode}`
                break

            case 'createClientGroup':
                url = `${GATEWAY_BASE}/api/ifess/client-groups`
                fetchOptions.body = JSON.stringify({
                    groupCode: params.groupCode,
                    groupName: params.groupName,
                    description: params.description
                })
                break

            case 'updateClientGroup':
                url = `${GATEWAY_BASE}/api/ifess/client-groups/${params.groupCode}`
                fetchOptions.body = JSON.stringify({
                    groupName: params.groupName,
                    description: params.description
                })
                break

            case 'deleteClientGroup':
                url = `${GATEWAY_BASE}/api/ifess/client-groups/${params.groupCode}`
                break

            case 'addClientToGroup':
                url = `${GATEWAY_BASE}/api/ifess/client-groups/${params.groupCode}/clients/${params.clientId}`
                break

            case 'removeClientFromGroup':
                url = `${GATEWAY_BASE}/api/ifess/client-groups/${params.groupCode}/clients/${params.clientId}`
                break

            // Audit Logs
            case 'listAuditLogs':
                url = `${GATEWAY_BASE}/api/ifess/audit-logs`
                break

            default:
                return NextResponse.json(
                    { error: `Action not implemented: ${action}` },
                    { status: 501 }
                )
        }

        // Make the request to the gateway
        const response = await fetch(url, fetchOptions)
        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status })
        }

        return NextResponse.json(data)

    } catch (error) {
        console.error('[IFESS Proxy] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

// Health check endpoint
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'health') {
        try {
            const response = await fetch(`${GATEWAY_BASE}/api/ifess/health`)
            return NextResponse.json(await response.json())
        } catch (error) {
            return NextResponse.json(
                { error: 'Gateway unreachable' },
                { status: 503 }
            )
        }
    }

    if (action === 'server-info') {
        try {
            const response = await fetch(`${GATEWAY_BASE}/api/ifess/server-info`)
            return NextResponse.json(await response.json())
        } catch (error) {
            return NextResponse.json(
                { error: 'Gateway unreachable' },
                { status: 503 }
            )
        }
    }

    return NextResponse.json({ error: 'Use POST with action parameter' }, { status: 400 })
}
