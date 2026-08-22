import { db } from './db'

// Role interface
export interface Role {
    name: string
    description?: string
    createdAt?: Date
    updatedAt?: Date
}

// Default roles shown even when no permission rows reference them.
// Roles are free-form strings stored in role_service_permission.role and
// user_ptrj.role — there is NO role_ptrj table (verified against MSSQL
// extend_db_ptrj 2026-08-21).
export const DEFAULT_ROLES = ['ADMIN', 'KERANI', 'AKUNTING', 'HRD', 'PAJAK', 'VISITOR', 'MNGR', 'ASISTEN', 'MANDOR']

/**
 * Role Repository — roles live as strings in role_service_permission.role
 * and user_ptrj.role (no role_ptrj table exists). findAll derives the union;
 * create seeds a permission row (FK serviceId → service_ptrj); delete removes
 * all permission rows; update renames everywhere the role appears.
 */
export class RoleRepository {

    async findAll(): Promise<Role[]> {
        try {
            const rows = await db.query<{ role: string }>(
                `SELECT DISTINCT role FROM role_service_permission
                 UNION
                 SELECT DISTINCT role FROM user_ptrj`
            )
            const names = new Set(rows.map(r => r.role).filter(Boolean))
            DEFAULT_ROLES.forEach(r => names.add(r))
            return [...names].sort().map(name => ({ name }))
        } catch (e) {
            console.error('Role lookup failed, using defaults:', e)
            return DEFAULT_ROLES.map(name => ({ name }))
        }
    }

    /**
     * Create a role by seeding one permission row against the first existing
     * service (FK requires a real serviceId). The role then appears in findAll
     * and in the permission matrix.
     */
    async create(data: { name: string; description?: string }): Promise<boolean> {
        const name = String(data.name).trim().toUpperCase()
        // Pick an existing service to anchor the FK.
        const svc = await db.query<{ serviceId: string }>(
            'SELECT TOP 1 serviceId FROM service_ptrj WHERE enabled = 1 ORDER BY serviceId'
        )
        const serviceId = svc.length > 0 ? svc[0].serviceId : 'dashboard'
        const affected = await db.execute(
            `INSERT INTO role_service_permission (role, serviceId) VALUES (@role, @serviceId)`,
            { role: name, serviceId }
        )
        return affected > 0
    }

    /**
     * Rename a role everywhere it appears (role_service_permission + user_ptrj).
     */
    async update(oldName: string, newName: string): Promise<boolean> {
        const oldN = String(oldName).trim().toUpperCase()
        const newN = String(newName).trim().toUpperCase()
        if (!oldN || !newN) return false

        await db.execute(
            'UPDATE role_service_permission SET role = @new WHERE role = @old',
            { new: newN, old: oldN }
        )
        const affected = await db.execute(
            'UPDATE user_ptrj SET role = @new WHERE role = @old',
            { new: newN, old: oldN }
        )
        return true
    }

    async delete(name: string): Promise<boolean> {
        const affected = await db.execute(
            'DELETE FROM role_service_permission WHERE role = @name',
            { name }
        )
        return affected > 0
    }

    async exists(name: string): Promise<boolean> {
        const roles = await this.findAll()
        const normalized = String(name).trim().toUpperCase()
        return roles.some(r => r.name.toUpperCase() === normalized)
    }
}

// Export singleton instance
export const roleRepository = new RoleRepository()
export default roleRepository
