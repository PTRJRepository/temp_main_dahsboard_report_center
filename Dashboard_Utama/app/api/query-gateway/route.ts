import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const IFESS_API_KEY = process.env.IFESS_API_KEY || ''
const GATEWAY_BASE = process.env.GATEWAY_BASE || 'http://localhost:3001'

const ENDPOINT_MAP: Record<string, { method: string; path: string }> = {
    'validate': { method: 'POST', path: '/api/ifess/query-gateway/validate' },
    'dispatch': { method: 'POST', path: '/api/ifess/query-gateway/dispatch' },
    'listBatches': { method: 'GET', path: '/api/ifess/query-gateway/batches' },
    'getBatch': { method: 'GET', path: '/api/ifess/query-gateway/batches' },
    'storeResult': { method: 'POST', path: '/api/ifess/query-gateway/jobs' },
    'storeChunk': { method: 'POST', path: '/api/ifess/query-gateway/jobs' },
    'listTemplates': { method: 'GET', path: '/api/ifess/query-gateway/templates' },
    'createTemplate': { method: 'POST', path: '/api/ifess/query-gateway/templates' },
    'updateTemplate': { method: 'PUT', path: '/api/ifess/query-gateway/templates' },
    'deleteTemplate': { method: 'DELETE', path: '/api/ifess/query-gateway/templates' }
}

function gatewayFetch(url: string, options?: RequestInit) {
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': IFESS_API_KEY,
            ...options?.headers
        }
    })
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action, params = {} } = body

        if (!action || !ENDPOINT_MAP[action]) {
            return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
        }

        let url = ''
        const fetchOptions: RequestInit = {
            method: ENDPOINT_MAP[action].method,
            headers: { 'Content-Type': 'application/json' }
        }

        switch (action) {
            case 'validate':
                url = `${GATEWAY_BASE}/api/ifess/query-gateway/validate`
                fetchOptions.body = JSON.stringify({ queryText: params.queryText })
                break

            case 'dispatch':
                url = `${GATEWAY_BASE}/api/ifess/query-gateway/dispatch`
                fetchOptions.body = JSON.stringify({
                    queryName: params.queryName || 'Ad-hoc Query',
                    queryText: params.queryText,
                    targetMode: params.targetMode || 'AllClients',
                    targetClientIds: params.targetClientIds || [],
                    targetGroup: params.targetGroup || null,
                    maxRows: params.maxRows || 1000,
                    timeoutSeconds: params.timeoutSeconds || 30,
                    requestedBy: params.requestedBy || 'ifess-control-ui'
                })
                break

            case 'storeResult':
                url = `${GATEWAY_BASE}/api/ifess/query-gateway/jobs/${params.jobId}/result`
                fetchOptions.body = JSON.stringify({
                    clientId: params.clientId,
                    headers: params.headers,
                    rows: params.rows,
                    rowCount: params.rowCount,
                    isTruncated: params.isTruncated,
                    executionTimeMs: params.executionTimeMs,
                    status: params.status,
                    errorMessage: params.errorMessage
                })
                break

            case 'storeChunk':
                url = `${GATEWAY_BASE}/api/ifess/query-gateway/jobs/${params.jobId}/chunks`
                fetchOptions.body = JSON.stringify({
                    clientId: params.clientId,
                    chunkIndex: params.chunkIndex,
                    headers: params.headers,
                    rows: params.rows,
                    isLastChunk: params.isLastChunk
                })
                break

            case 'createTemplate':
                url = `${GATEWAY_BASE}/api/ifess/query-gateway/templates`
                fetchOptions.body = JSON.stringify({
                    templateCode: params.templateCode,
                    templateName: params.templateName,
                    description: params.description,
                    queryText: params.queryText,
                    defaultMaxRows: params.defaultMaxRows,
                    defaultTimeoutSeconds: params.defaultTimeoutSeconds,
                    tags: params.tags,
                    createdBy: params.createdBy
                })
                break

            case 'updateTemplate':
                url = `${GATEWAY_BASE}/api/ifess/query-gateway/templates/${params.templateCode}`
                fetchOptions.body = JSON.stringify({
                    templateName: params.templateName,
                    description: params.description,
                    queryText: params.queryText,
                    defaultMaxRows: params.defaultMaxRows,
                    defaultTimeoutSeconds: params.defaultTimeoutSeconds,
                    tags: params.tags,
                    enabled: params.enabled
                })
                break

            default:
                return NextResponse.json({ error: `Action not implemented: ${action}` }, { status: 501 })
        }

        const response = await gatewayFetch(url, fetchOptions)
        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status })
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('[Query Gateway Proxy] Error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const action = searchParams.get('action')

        if (action === 'listBatches') {
            const response = await gatewayFetch(`${GATEWAY_BASE}/api/ifess/query-gateway/batches`)
            const data = await response.json()
            return NextResponse.json(data)
        }

        if (action === 'getBatch') {
            const batchId = searchParams.get('batchId')
            const response = await gatewayFetch(`${GATEWAY_BASE}/api/ifess/query-gateway/batches/${batchId}`)
            const data = await response.json()
            return NextResponse.json(data)
        }

        if (action === 'listTemplates') {
            const response = await gatewayFetch(`${GATEWAY_BASE}/api/ifess/query-gateway/templates`)
            const data = await response.json()
            return NextResponse.json(data)
        }

        return NextResponse.json({ error: 'Use POST with action parameter or valid GET action' }, { status: 400 })
    } catch (error) {
        console.error('[Query Gateway Proxy] Error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
    }
}
