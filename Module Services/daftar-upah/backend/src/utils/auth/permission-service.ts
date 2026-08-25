/**
 * Permission Service - Role-Based Access Control (RBAC)
 *
 * Handles permission checking, division access, and role validation.
 * This service provides a unified way to check user permissions.
 */

import { User, UserRole } from "./auth-types";
import { AuthService } from "../../services/authService";

/**
 * Permission service singleton for access control
 */
export class PermissionService {
    private static instance: PermissionService;

    private constructor() {}

    public static getInstance(): PermissionService {
        if (!PermissionService.instance) {
            PermissionService.instance = new PermissionService();
        }
        return PermissionService.instance;
    }

    /**
     * Check if user has admin role
     */
    public isAdmin(user: User | null): boolean {
        if (!user) return false;
        return user.role === UserRole.ADMIN;
    }

    /**
     * Check if user has specific role
     */
    public hasRole(user: User | null, role: UserRole): boolean {
        if (!user) return false;
        return user.role === role;
    }

    /**
     * Check if user has any of the specified roles
     */
    public hasAnyRole(user: User | null, roles: UserRole[]): boolean {
        if (!user) return false;
        return roles.includes(user.role);
    }

    /**
     * Check if user has access to a specific division
     */
    public hasDivisionAccess(user: User | null, divisionCode: string): boolean {
        if (!user) return false;

        // Admin has access to all divisions
        if (user.role === UserRole.ADMIN) return true;

        // Normalize division code
        const normalizedDivision = divisionCode.toUpperCase();

        // Check if user's divisions array includes this division
        if (user.divisions.includes(normalizedDivision)) return true;

        // Check for ALL access
        if (user.divisions.includes("ALL")) return true;

        // Check for virtual divisions
        const virtualDivisions = ["INF", "NRS", "WKS_AR", "WKS_PG", "WORKSHOP", "MILL"];
        if (virtualDivisions.includes(normalizedDivision)) {
            // Map virtual to real divisions
            const realDivisions = this.mapVirtualToRealDivision(normalizedDivision);
            return realDivisions.some(d => user.divisions.includes(d));
        }

        return false;
    }

    /**
     * Check if user has access to all specified divisions
     */
    public hasAllDivisionAccess(user: User | null, divisionCodes: string[]): boolean {
        if (!user) return false;
        if (user.role === UserRole.ADMIN) return true;

        return divisionCodes.every(div => this.hasDivisionAccess(user, div));
    }

    /**
     * Check if user has access to any of the specified divisions
     */
    public hasAnyDivisionAccess(user: User | null, divisionCodes: string[]): boolean {
        if (!user) return false;
        if (user.role === UserRole.ADMIN) return true;

        return divisionCodes.some(div => this.hasDivisionAccess(user, div));
    }

    /**
     * Get accessible divisions for user
     */
    public getAccessibleDivisions(user: User | null): string[] {
        if (!user) return [];

        // Admin gets all divisions
        if (user.role === UserRole.ADMIN) {
            return AuthService.ALL_DIVISIONS;
        }

        return user.divisions;
    }

    /**
     * Filter divisions user can access
     */
    public filterAccessibleDivisions(user: User | null, divisions: string[]): string[] {
        if (!user) return [];
        return divisions.filter(div => this.hasDivisionAccess(user, div));
    }

    /**
     * Check if user can perform an action based on resource ownership
     */
    public canAccessResource(user: User | null, resourceDivision: string): boolean {
        if (!user) return false;

        // Admin can access all resources
        if (user.role === UserRole.ADMIN) return true;

        // Visitor cannot modify resources
        if (user.role === UserRole.VISITOR) return false;

        // Check division access
        return this.hasDivisionAccess(user, resourceDivision);
    }

    /**
     * Check if user can modify data
     */
    public canModify(user: User | null): boolean {
        if (!user) return false;

        // Only admin and regular users can modify
        return user.role === UserRole.ADMIN || user.role === UserRole.USER;
    }

    /**
     * Check if user is active
     */
    public isActive(user: User | null): boolean {
        if (!user) return false;
        return user.is_active;
    }

    /**
     * Map virtual division to real divisions
     */
    private mapVirtualToRealDivision(virtual: string): string[] {
        const mappings: Record<string, string[]> = {
            "INF": ["KBN", "IJL", "STF-OFFICE"],
            "NRS": ["NRS"],
            "WKS_AR": ["ARC", "ARA", "ARB1", "ARB2"],
            "WKS_PG": ["PG2A", "P1A", "P1B", "P2A", "P2B"],
            "WORKSHOP": ["KBN", "IJL"],
            "MILL": ["PG2A", "NRS"]
        };
        return mappings[virtual] || [];
    }

    /**
     * Get role display name
     */
    public getRoleDisplayName(role: UserRole): string {
        const displayNames: Record<UserRole, string> = {
            [UserRole.ADMIN]: "Administrator",
            [UserRole.USER]: "Pengguna",
            [UserRole.KERANI]: "Kerani",
            [UserRole.VISITOR]: "Pengunjung"
        };
        return displayNames[role] || role;
    }

    /**
     * Get role description
     */
    public getRoleDescription(role: UserRole): string {
        const descriptions: Record<UserRole, string> = {
            [UserRole.ADMIN]: "Akses penuh ke semua fitur dan divisi",
            [UserRole.USER]: "Akses standar dengan batasan divisi",
            [UserRole.KERANI]: "Akses kerani - hanya data divisi terkait",
            [UserRole.VISITOR]: "Hanya baca - tidak dapat mengubah data"
        };
        return descriptions[role] || "";
    }
}

export const permissionService = PermissionService.getInstance();
