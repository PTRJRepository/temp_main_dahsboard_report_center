import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { db } from './db'

// Service interface
export interface Service {
    serviceId: string
    name: string
    description?: string
    serviceUrl: string
    targetUrl?: string
    path?: string
    enabled: boolean
    imagePath?: string | null
    createdAt?: Date
    updatedAt?: Date
}

// Role permission interface
export interface RolePermission {
    id: number
    role: string
    serviceId: string
}

interface GatewayRouteConfig {
    id: string
    path: string
    target: string
    description?: string
    name?: string
    servicePath?: string
    serviceUrl?: string
    enabled?: boolean
    hidden?: boolean
    public?: boolean
    image?: string
}

function readGatewayRouteConfig(): GatewayRouteConfig[] {
    const candidates = [
        resolve(process.cwd(), 'routes-config.json'),
        resolve(process.cwd(), '..', 'routes-config.json'),
    ]

    for (const filePath of candidates) {
        try {
            if (!existsSync(filePath)) continue
            const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as GatewayRouteConfig[]
            return Array.isArray(parsed) ? parsed : []
        } catch (error) {
            console.error('Failed to read gateway route config:', error)
        }
    }

    return []
}

export function getGatewayFallbackServices(role: string): Service[] {
    return getFallbackServices(role)
}

function getFallbackServices(role: string): Service[] {
    const normalizedRole = role.trim().toUpperCase()
    if (!['ADMIN', 'SUPERADMIN'].includes(normalizedRole)) return []

    return readGatewayRouteConfig()
        .filter(route => route.enabled !== false)
        .filter(route => !route.hidden)
        .filter(route => !route.id.startsWith('backend-'))
        .map(route => ({
            serviceId: route.id,
            name: route.name || route.description || route.id,
            description: route.description,
            serviceUrl: route.serviceUrl || route.target,
            targetUrl: route.target,
            path: route.servicePath || route.path,
            enabled: route.enabled !== false,
            imagePath: route.image || null,
        }))
}

/**
 * Service Repository - handles service and role permission operations
 */
export class ServiceRepository {

    /**
     * Get all services
     */
    async findAll(): Promise<Service[]> {
        return db.query<Service>(
            'SELECT * FROM service_ptrj ORDER BY name'
        )
    }

    /**
     * Get enabled services
     */
    async findEnabled(): Promise<Service[]> {
        return db.query<Service>(
            'SELECT * FROM service_ptrj WHERE enabled = 1 ORDER BY name'
        )
    }

    /**
     * Find service by serviceId
     */
    async findById(serviceId: string): Promise<Service | null> {
        return db.queryOne<Service>(
            'SELECT * FROM service_ptrj WHERE serviceId = @serviceId',
            { serviceId }
        )
    }

    /**
     * Get services for a specific role
     */
    async findByRole(role: string): Promise<Service[]> {
        try {
            return await db.query<Service>(
                `SELECT s.* FROM service_ptrj s
                 INNER JOIN role_service_permission rsp ON s.serviceId = rsp.serviceId
                 WHERE rsp.role = @role AND s.enabled = 1
                 ORDER BY s.name`,
                { role }
            )
        } catch (error) {
            console.error('Service role lookup failed, using gateway config fallback:', error)
            return getFallbackServices(role)
        }
    }

    /**
     * Get all role permissions
     */
    async findAllPermissions(): Promise<RolePermission[]> {
        return db.query<RolePermission>(
            'SELECT * FROM role_service_permission'
        )
    }

    /**
     * Create new service
     */
    async create(data: Omit<Service, 'createdAt' | 'updatedAt'>): Promise<boolean> {
        const affected = await db.execute(
            `INSERT INTO service_ptrj (serviceId, name, description, serviceUrl, path, enabled, imagePath)
             VALUES (@serviceId, @name, @description, @serviceUrl, @path, @enabled, @imagePath)`,
            {
                serviceId: data.serviceId,
                name: data.name,
                description: data.description || null,
                serviceUrl: data.serviceUrl,
                path: data.path || null,
                enabled: data.enabled ? 1 : 0,
                imagePath: data.imagePath || null
            }
        )
        return affected > 0
    }

    /**
     * Update service
     */
    async update(serviceId: string, data: Partial<Service>): Promise<boolean> {
        const sets: string[] = []
        const params: Record<string, any> = { serviceId }

        if (data.name !== undefined) { sets.push('name = @name'); params.name = data.name }
        if (data.description !== undefined) { sets.push('description = @description'); params.description = data.description }
        if (data.serviceUrl !== undefined) { sets.push('serviceUrl = @serviceUrl'); params.serviceUrl = data.serviceUrl }
        if (data.path !== undefined) { sets.push('path = @path'); params.path = data.path }
        if (data.enabled !== undefined) { sets.push('enabled = @enabled'); params.enabled = data.enabled ? 1 : 0 }
        if (data.imagePath !== undefined) { sets.push('imagePath = @imagePath'); params.imagePath = data.imagePath }

        if (sets.length === 0) return false

        sets.push('updatedAt = GETDATE()')

        const affected = await db.execute(
            `UPDATE service_ptrj SET ${sets.join(', ')} WHERE serviceId = @serviceId`,
            params
        )
        return affected > 0
    }

    /**
     * Delete service
     */
    async delete(serviceId: string): Promise<boolean> {
        const affected = await db.execute(
            'DELETE FROM service_ptrj WHERE serviceId = @serviceId',
            { serviceId }
        )
        return affected > 0
    }

    /**
     * Assign service to role
     */
    async assignToRole(role: string, serviceId: string): Promise<boolean> {
        try {
            await db.execute(
                `INSERT INTO role_service_permission (role, serviceId) VALUES (@role, @serviceId)`,
                { role, serviceId }
            )
            return true
        } catch {
            return false // Probably already exists
        }
    }

    /**
     * Remove service from role
     */
    async removeFromRole(role: string, serviceId: string): Promise<boolean> {
        const affected = await db.execute(
            'DELETE FROM role_service_permission WHERE role = @role AND serviceId = @serviceId',
            { role, serviceId }
        )
        return affected > 0
    }
}

// Export singleton instance
export const serviceRepository = new ServiceRepository()
export default serviceRepository
