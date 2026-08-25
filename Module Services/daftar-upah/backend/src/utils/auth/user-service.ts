/**
 * User Service - User Management Operations
 *
 * Provides CRUD operations for user management.
 * This service can be used by admin API endpoints.
 */

import * as bcrypt from "bcryptjs";
import { Database } from "bun:sqlite";
import { join } from "path";
import { User, UserCreate, UserUpdate, UserRole, UserWithHash } from "./auth-types";
import { AuthService } from "../../services/authService";

/**
 * User service for user management operations
 */
export class UserService {
    private static instance: UserService;
    private db: Database;

    private constructor() {
        const dbPath = join(process.cwd(), "data", "users.db");
        // AuthService owns the schema (CREATE TABLE IF NOT EXISTS at boot). Open with
        // `create: true` to match it: `{ create: false }` throws SQLITE_MISUSE on this
        // Bun build, and this module can load before AuthService has created the file.
        this.db = new Database(dbPath, { create: true });
    }

    public static getInstance(): UserService {
        if (!UserService.instance) {
            UserService.instance = new UserService();
        }
        return UserService.instance;
    }

    /**
     * Get all users (without password hash)
     */
    public async getAllUsers(): Promise<User[]> {
        const rows = this.db.query("SELECT * FROM users ORDER BY created_at DESC").all();
        return rows.map(row => this.mapRowToUser(row));
    }

    /**
     * Get user by ID
     */
    public async getUserById(id: number): Promise<User | null> {
        const row = this.db.query("SELECT * FROM users WHERE id = ?").get(id);
        return row ? this.mapRowToUser(row) : null;
    }

    /**
     * Get user by username
     */
    public async getUserByUsername(username: string): Promise<UserWithHash | null> {
        const row = this.db.query("SELECT * FROM users WHERE username = ?").get(username);
        return row ? this.mapRowToUserWithHash(row) : null;
    }

    /**
     * Get user by email
     */
    public async getUserByEmail(email: string): Promise<User | null> {
        const row = this.db.query("SELECT * FROM users WHERE email = ?").get(email);
        return row ? this.mapRowToUser(row) : null;
    }

    /**
     * Create new user
     */
    public async createUser(data: UserCreate): Promise<User> {
        // Check for existing username or email
        const existing = this.db.query(
            "SELECT id FROM users WHERE username = ? OR email = ?"
        ).get(data.username, data.email);

        if (existing) {
            throw new Error("Username or email already exists");
        }

        // Hash password
        const passwordHash = bcrypt.hashSync(data.password, 10);

        // Insert user
        const divisionsJson = JSON.stringify(data.divisions);
        const result = this.db.query(
            `INSERT INTO users (username, email, password_hash, full_name, role, divisions, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)`
        ).run(
            data.username,
            data.email,
            passwordHash,
            data.full_name,
            data.role,
            divisionsJson
        );

        const newUser = await this.getUserById(result.lastInsertRowid as number);
        if (!newUser) throw new Error("Failed to create user");

        return newUser;
    }

    /**
     * Update existing user
     */
    public async updateUser(id: number, data: UserUpdate): Promise<User> {
        const updates: string[] = [];
        const values: any[] = [];

        if (data.email !== undefined) {
            updates.push("email = ?");
            values.push(data.email);
        }
        if (data.full_name !== undefined) {
            updates.push("full_name = ?");
            values.push(data.full_name);
        }
        if (data.role !== undefined) {
            updates.push("role = ?");
            values.push(data.role);
        }
        if (data.divisions !== undefined) {
            updates.push("divisions = ?");
            values.push(JSON.stringify(data.divisions));
        }
        if (data.is_active !== undefined) {
            updates.push("is_active = ?");
            values.push(data.is_active ? 1 : 0);
        }

        if (updates.length === 0) {
            const user = await this.getUserById(id);
            if (!user) throw new Error("User not found");
            return user;
        }

        updates.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);

        this.db.query(
            `UPDATE users SET ${updates.join(", ")} WHERE id = ?`
        ).run(...values);

        const updatedUser = await this.getUserById(id);
        if (!updatedUser) throw new Error("User not found");

        return updatedUser;
    }

    /**
     * Change user password
     */
    public async changePassword(id: number, newPassword: string): Promise<void> {
        const passwordHash = bcrypt.hashSync(newPassword, 10);
        this.db.query(
            "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).run(passwordHash, id);
    }

    /**
     * Delete user
     */
    public async deleteUser(id: number): Promise<void> {
        // Prevent deleting the last admin
        const admins = this.db.query(
            "SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = 1"
        ).get(UserRole.ADMIN) as { count: number };

        const user = await this.getUserById(id);
        if (!user) throw new Error("User not found");

        if (user.role === UserRole.ADMIN && admins.count <= 1) {
            throw new Error("Cannot delete the last admin user");
        }

        this.db.query("DELETE FROM users WHERE id = ?").run(id);
    }

    /**
     * Deactivate user
     */
    public async deactivateUser(id: number): Promise<User> {
        return this.updateUser(id, { is_active: false });
    }

    /**
     * Activate user
     */
    public async activateUser(id: number): Promise<User> {
        return this.updateUser(id, { is_active: true });
    }

    /**
     * Get users by role
     */
    public async getUsersByRole(role: UserRole): Promise<User[]> {
        const rows = this.db.query(
            "SELECT * FROM users WHERE role = ? ORDER BY created_at DESC"
        ).all(role);
        return rows.map(row => this.mapRowToUser(row));
    }

    /**
     * Get active users
     */
    public async getActiveUsers(): Promise<User[]> {
        const rows = this.db.query(
            "SELECT * FROM users WHERE is_active = 1 ORDER BY created_at DESC"
        ).all();
        return rows.map(row => this.mapRowToUser(row));
    }

    /**
     * Search users by name or username
     */
    public async searchUsers(query: string): Promise<User[]> {
        const searchTerm = `%${query}%`;
        const rows = this.db.query(
            `SELECT * FROM users
             WHERE username LIKE ? OR full_name LIKE ? OR email LIKE ?
             ORDER BY created_at DESC`
        ).all(searchTerm, searchTerm, searchTerm);
        return rows.map(row => this.mapRowToUser(row));
    }

    /**
     * Verify password
     */
    public async verifyPassword(userId: number, password: string): Promise<boolean> {
        const row = this.db.query(
            "SELECT password_hash FROM users WHERE id = ?"
        ).get(userId) as { password_hash: string } | undefined;

        if (!row) return false;
        return bcrypt.compareSync(password, row.password_hash);
    }

    /**
     * Map database row to User object
     */
    private mapRowToUser(row: any): User {
        let divisions: string[] = [];
        try {
            divisions = JSON.parse(row.divisions || "[]");
        } catch {
            divisions = [];
        }

        return {
            id: row.id,
            username: row.username,
            email: row.email,
            full_name: row.full_name,
            role: row.role as UserRole,
            divisions,
            is_active: Boolean(row.is_active),
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        };
    }

    /**
     * Map database row to UserWithHash object
     */
    private mapRowToUserWithHash(row: any): UserWithHash {
        return {
            ...this.mapRowToUser(row),
            password_hash: row.password_hash
        };
    }
}

export const userService = UserService.getInstance();
