/**
 * Admin Auth Routes - User Management API
 *
 * These routes provide user management capabilities for administrators.
 * All routes require admin authentication.
 */

import { Elysia, t } from "elysia";
import { AuthService } from "../services/authService";
import { userService } from "../utils/auth/user-service";
import { permissionService } from "../utils/auth/permission-service";
import { resolveUserFromHeaders } from "../utils/authBypass";
import { UserRole } from "../utils/auth/auth-types";

/**
 * Admin auth routes
 */
export const adminAuthRoutes = new Elysia({ prefix: "/admin/auth" })
    .decorate("authService", AuthService.getInstance())
    .derive(async ({ headers }) => {
        const authService = AuthService.getInstance();
        const user = await resolveUserFromHeaders(headers, authService);
        return { adminUser: user };
    })

    // ==================== USER MANAGEMENT ====================

    /**
     * GET /admin/auth/users
     * Get all users (admin only)
     */
    .get("/users", async ({ adminUser, set }) => {
        // Check admin access
        if (!permissionService.isAdmin(adminUser)) {
            set.status = 403;
            return { error: "Access denied. Admin role required." };
        }

        try {
            const users = await userService.getAllUsers();
            return { users };
        } catch (error) {
            set.status = 500;
            return { error: "Failed to fetch users" };
        }
    })

    /**
     * GET /admin/auth/users/:id
     * Get user by ID (admin only)
     */
    .get("/users/:id", async ({ adminUser, set, params }) => {
        if (!permissionService.isAdmin(adminUser)) {
            set.status = 403;
            return { error: "Access denied. Admin role required." };
        }

        const id = parseInt(params.id);
        if (isNaN(id)) {
            set.status = 400;
            return { error: "Invalid user ID" };
        }

        try {
            const user = await userService.getUserById(id);
            if (!user) {
                set.status = 404;
                return { error: "User not found" };
            }
            return { user };
        } catch (error) {
            set.status = 500;
            return { error: "Failed to fetch user" };
        }
    })

    /**
     * POST /admin/auth/users
     * Create new user (admin only)
     */
    .post("/users", async ({ adminUser, body, set }) => {
        if (!permissionService.isAdmin(adminUser)) {
            set.status = 403;
            return { error: "Access denied. Admin role required." };
        }

        const { username, email, password, full_name, role, divisions } = body as any;

        // Validation
        if (!username || !email || !password || !full_name) {
            set.status = 400;
            return { error: "Missing required fields: username, email, password, full_name" };
        }

        if (!Object.values(UserRole).includes(role)) {
            set.status = 400;
            return { error: `Invalid role. Must be one of: ${Object.values(UserRole).join(", ")}` };
        }

        if (password.length < 6) {
            set.status = 400;
            return { error: "Password must be at least 6 characters" };
        }

        try {
            const newUser = await userService.createUser({
                username,
                email,
                password,
                full_name,
                role,
                divisions: divisions || []
            });

            set.status = 201;
            return { user: newUser, message: "User created successfully" };
        } catch (error: any) {
            set.status = 400;
            return { error: error.message || "Failed to create user" };
        }
    }, {
        body: t.Object({
            username: t.String(),
            email: t.String(),
            password: t.String(),
            full_name: t.String(),
            role: t.String(),
            divisions: t.Optional(t.Array(t.String()))
        })
    })

    /**
     * PUT /admin/auth/users/:id
     * Update user (admin only)
     */
    .put("/users/:id", async ({ adminUser, set, params, body }) => {
        if (!permissionService.isAdmin(adminUser)) {
            set.status = 403;
            return { error: "Access denied. Admin role required." };
        }

        const id = parseInt(params.id);
        if (isNaN(id)) {
            set.status = 400;
            return { error: "Invalid user ID" };
        }

        const updateData = body as any;

        // Validate role if provided
        if (updateData.role && !Object.values(UserRole).includes(updateData.role)) {
            set.status = 400;
            return { error: `Invalid role. Must be one of: ${Object.values(UserRole).join(", ")}` };
        }

        try {
            const updatedUser = await userService.updateUser(id, updateData);
            return { user: updatedUser, message: "User updated successfully" };
        } catch (error: any) {
            set.status = 400;
            return { error: error.message || "Failed to update user" };
        }
    }, {
        body: t.Object({
            email: t.Optional(t.String()),
            full_name: t.Optional(t.String()),
            role: t.Optional(t.String()),
            divisions: t.Optional(t.Array(t.String())),
            is_active: t.Optional(t.Boolean())
        })
    })

    /**
     * DELETE /admin/auth/users/:id
     * Delete user (admin only)
     */
    .delete("/users/:id", async ({ adminUser, set, params }) => {
        if (!permissionService.isAdmin(adminUser)) {
            set.status = 403;
            return { error: "Access denied. Admin role required." };
        }

        const id = parseInt(params.id);
        if (isNaN(id)) {
            set.status = 400;
            return { error: "Invalid user ID" };
        }

        // Prevent self-deletion
        if (adminUser?.id === id) {
            set.status = 400;
            return { error: "Cannot delete your own account" };
        }

        try {
            await userService.deleteUser(id);
            return { message: "User deleted successfully" };
        } catch (error: any) {
            set.status = 400;
            return { error: error.message || "Failed to delete user" };
        }
    })

    // ==================== PASSWORD MANAGEMENT ====================

    /**
     * POST /admin/auth/users/:id/password
     * Change user password (admin only)
     */
    .post("/users/:id/password", async ({ adminUser, set, params, body }) => {
        if (!permissionService.isAdmin(adminUser)) {
            set.status = 403;
            return { error: "Access denied. Admin role required." };
        }

        const id = parseInt(params.id);
        if (isNaN(id)) {
            set.status = 400;
            return { error: "Invalid user ID" };
        }

        const { new_password } = body as any;

        if (!new_password || new_password.length < 6) {
            set.status = 400;
            return { error: "Password must be at least 6 characters" };
        }

        try {
            await userService.changePassword(id, new_password);
            return { message: "Password changed successfully" };
        } catch (error: any) {
            set.status = 400;
            return { error: error.message || "Failed to change password" };
        }
    }, {
        body: t.Object({
            new_password: t.String()
        })
    })

    // ==================== USER STATUS ====================

    /**
     * POST /admin/auth/users/:id/activate
     * Activate user (admin only)
     */
    .post("/users/:id/activate", async ({ adminUser, set, params }) => {
        if (!permissionService.isAdmin(adminUser)) {
            set.status = 403;
            return { error: "Access denied. Admin role required." };
        }

        const id = parseInt(params.id);
        if (isNaN(id)) {
            set.status = 400;
            return { error: "Invalid user ID" };
        }

        try {
            const user = await userService.activateUser(id);
            return { user, message: "User activated successfully" };
        } catch (error: any) {
            set.status = 400;
            return { error: error.message || "Failed to activate user" };
        }
    })

    /**
     * POST /admin/auth/users/:id/deactivate
     * Deactivate user (admin only)
     */
    .post("/users/:id/deactivate", async ({ adminUser, set, params }) => {
        if (!permissionService.isAdmin(adminUser)) {
            set.status = 403;
            return { error: "Access denied. Admin role required." };
        }

        const id = parseInt(params.id);
        if (isNaN(id)) {
            set.status = 400;
            return { error: "Invalid user ID" };
        }

        // Prevent self-deactivation
        if (adminUser?.id === id) {
            set.status = 400;
            return { error: "Cannot deactivate your own account" };
        }

        try {
            const user = await userService.deactivateUser(id);
            return { user, message: "User deactivated successfully" };
        } catch (error: any) {
            set.status = 400;
            return { error: error.message || "Failed to deactivate user" };
        }
    })

    // ==================== SEARCH & FILTER ====================

    /**
     * GET /admin/auth/users/search
     * Search users (admin only)
     */
    .get("/users/search", async ({ adminUser, set, query }) => {
        if (!permissionService.isAdmin(adminUser)) {
            set.status = 403;
            return { error: "Access denied. Admin role required." };
        }

        const { q } = query as { q?: string };

        if (!q || q.length < 2) {
            set.status = 400;
            return { error: "Search query must be at least 2 characters" };
        }

        try {
            const users = await userService.searchUsers(q);
            return { users };
        } catch (error: any) {
            set.status = 500;
            return { error: "Failed to search users" };
        }
    })

    /**
     * GET /admin/auth/users/role/:role
     * Get users by role (admin only)
     */
    .get("/users/role/:role", async ({ adminUser, set, params }) => {
        if (!permissionService.isAdmin(adminUser)) {
            set.status = 403;
            return { error: "Access denied. Admin role required." };
        }

        const role = params.role as UserRole;
        if (!Object.values(UserRole).includes(role)) {
            set.status = 400;
            return { error: `Invalid role. Must be one of: ${Object.values(UserRole).join(", ")}` };
        }

        try {
            const users = await userService.getUsersByRole(role);
            return { users };
        } catch (error: any) {
            set.status = 500;
            return { error: "Failed to fetch users by role" };
        }
    })

    // ==================== DIVISIONS ====================

    /**
     * GET /admin/auth/divisions
     * Get all available divisions (admin only)
     */
    .get("/divisions", async ({ adminUser, set }) => {
        if (!permissionService.isAdmin(adminUser)) {
            set.status = 403;
            return { error: "Access denied. Admin role required." };
        }

        return {
            divisions: AuthService.ALL_DIVISIONS.map(code => ({
                code,
                name: getDivisionName(code)
            }))
        };
    })

    /**
     * GET /admin/auth/roles
     * Get all available roles (admin only)
     */
    .get("/roles", async ({ adminUser, set }) => {
        if (!permissionService.isAdmin(adminUser)) {
            set.status = 403;
            return { error: "Access denied. Admin role required." };
        }

        return {
            roles: Object.values(UserRole).map(role => ({
                value: role,
                display_name: permissionService.getRoleDisplayName(role),
                description: permissionService.getRoleDescription(role)
            }))
        };
    });

/**
 * Get division display name
 */
function getDivisionName(code: string): string {
    const names: Record<string, string> = {
        ARA: "Afdeling ARA",
        ARC: "Afdeling ARC",
        ARB1: "Afdeling ARB1",
        ARB2: "Afdeling ARB2",
        NRS: "Afdeling NRS",
        PG2A: "Afdeling PG2A",
        P1A: "Afdeling P1A",
        P1B: "Afdeling P1B",
        P2A: "Afdeling P2A",
        P2B: "Afdeling P2B",
        KBN: "Kebun (Umum)",
        IJL: "Inti Jawa Lestari",
        "STF-OFFICE": "Staff Office",
        SECURITY: "Keamanan",
        INF: "Infrastruktur",
        WKS_AR: "Workshop ARC Group",
        WKS_PG: "Workshop PG Group",
        WORKSHOP: "Workshop Umum",
        MILL: "Pabrik"
    };
    return names[code] || code;
}
