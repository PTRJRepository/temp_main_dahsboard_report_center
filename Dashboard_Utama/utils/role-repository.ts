import { db } from './db'

// Role interface
export interface Role {
    name: string
    description?: string
    createdAt?: Date
    updatedAt?: Date
}

// Default roles seeded when table is empty (survives table-missing by returning defaults)
export const DEFAULT_ROLES = ['ADMIN', 'KERANI', 'AKUNTING', 'HRD', 'PAJAK', 'VISITOR', 'MNGR', 'ASISTEN', 'MANDOR']

/**
 * Role Repository - manages the role_ptrj registry.
 * Roles drive the dynamic role dropdowns and permission matrix.
 */
export class RoleRepository {

    /**
     * Get all roles
     */
    async findAll(): Promise<Role[]> {
        try {
            const rows = await db.query<Role>(
                'SELECT name, description, createdAt, updatedAt FROM role_ptrj ORDER BY name'
            )
            if (rows.length > 0) return rows
        } catch (e) {
            // Table may not exist yet — fall through to defaults
            console.error('Role lookup failed, using defaults:', e)
        }
        return DEFAULT_ROLES.map(name => ({ name }))
    }

    /**
     * Create a new role
     */
    async create(data: { name: string; description?: string }): Promise<boolean> {
        const affected = await db.execute(
            `INSERT INTO role_ptrj (name, description) VALUES (@name, @description)`,
            { name: data.name, description: data.description || null }
        )
        return affected > 0
    }

    /**
     * Delete a role
     */
    async delete(name: string): Promise<boolean> {
        const affected = await db.execute(
            'DELETE FROM role_ptrj WHERE name = @name',
            { name }
        )
        return affected > 0
    }

    /**
     * Check a role exists (fallback: accept any stored-role-shaped value so
     * legacy/seed roles created before the registry existed still pass)
     */
    async exists(name: string): Promise<boolean> {
        const roles = await this.findAll()
        const normalized = String(name).trim().toUpperCase()
        return roles.some(r => r.name.toUpperCase() === normalized)
    }
}

// Export singleton instance
export const roleRepository = new RoleRepository()
export default roleRepository
