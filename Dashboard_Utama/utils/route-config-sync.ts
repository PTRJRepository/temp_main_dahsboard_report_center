import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// Gateway root is the parent of Dashboard_Utama (proxy-gateway-portal).
// server.js chdir's into Dashboard_Utama, so process.cwd() == Dashboard_Utama.
const GATEWAY_ROOT = resolve(process.cwd(), '..')

interface RouteConfig {
    id: string
    path?: string
    target?: string
    description?: string
    name?: string
    servicePath?: string
    serviceUrl?: string
    enabled?: boolean
    hidden?: boolean
    public?: boolean
    rewriteContent?: boolean | string
    rewritePath?: boolean
    [key: string]: unknown
}

export interface ServiceRouteInput {
    serviceId: string
    name: string
    description?: string
    serviceUrl: string
    path?: string
    enabled?: boolean
    imagePath?: string | null
}

function configPaths(): { dev: string; prod: string } {
    return {
        dev: resolve(GATEWAY_ROOT, 'routes-config.json'),
        prod: resolve(GATEWAY_ROOT, 'routes-config.production.json'),
    }
}

function readConfig(filePath: string): RouteConfig[] {
    try {
        if (!existsSync(filePath)) return []
        const parsed = JSON.parse(readFileSync(filePath, 'utf8'))
        return Array.isArray(parsed) ? parsed : []
    } catch (e) {
        console.error(`Failed to read route config ${filePath}:`, e)
        return []
    }
}

function writeConfig(filePath: string, routes: RouteConfig[]): boolean {
    try {
        writeFileSync(filePath, JSON.stringify(routes, null, 4) + '\n', 'utf8')
        return true
    } catch (e) {
        console.error(`Failed to write route config ${filePath}:`, e)
        return false
    }
}

function routeFromService(input: ServiceRouteInput): RouteConfig {
    const route: RouteConfig = {
        id: input.serviceId,
        path: input.path || `/${input.serviceId}`,
        target: input.serviceUrl,
        description: input.description || undefined,
        name: input.name,
        enabled: input.enabled !== false,
        rewriteContent: false,
        rewritePath: true,
    }
    if (input.imagePath) route.image = input.imagePath
    return route
}

/**
 * Sync service registry to the gateway routes-config files.
 * Conservative merge: existing routes (with custom fields like rewriteContent,
 * spaIndex, aliases) are preserved untouched. Only missing routes are appended,
 * and delete removes by id.
 */
function syncAllFiles(mutate: (routes: RouteConfig[]) => RouteConfig[]): { dev: boolean; prod: boolean } {
    const paths = configPaths()
    const dev = readConfig(paths.dev)
    const prod = readConfig(paths.prod)
    const devResult = mutate(dev)
    const prodResult = mutate(prod)
    return {
        dev: writeConfig(paths.dev, devResult),
        prod: writeConfig(paths.prod, prodResult),
    }
}

export function syncAddService(input: ServiceRouteInput): { dev: boolean; prod: boolean } {
    return syncAllFiles(routes => {
        if (routes.some(r => r.id === input.serviceId)) return routes // preserve existing custom route
        routes.push(routeFromService(input))
        return routes
    })
}

export function syncRemoveService(serviceId: string): { dev: boolean; prod: boolean } {
    return syncAllFiles(routes => routes.filter(r => r.id !== serviceId))
}

export function syncUpdateServiceEnabled(serviceId: string, enabled: boolean): { dev: boolean; prod: boolean } {
    return syncAllFiles(routes => {
        return routes.map(r => (r.id === serviceId ? { ...r, enabled } : r))
    })
}

// ── Route config page helpers (read all / toggle / remove raw routes) ──────
export interface RouteConfigRow extends RouteConfig {
    _source: 'dev' | 'prod'
}

export function listAllRoutes(): { dev: RouteConfig[]; prod: RouteConfig[] } {
    const paths = configPaths()
    return {
        dev: readConfig(paths.dev),
        prod: readConfig(paths.prod),
    }
}

export function setRouteEnabled(routeId: string, enabled: boolean): { dev: boolean; prod: boolean } {
    return syncAllFiles(routes =>
        routes.map(r => (r.id === routeId ? { ...r, enabled } : r))
    )
}

export function deleteRoute(routeId: string): { dev: boolean; prod: boolean } {
    return syncAllFiles(routes => routes.filter(r => r.id !== routeId))
}
