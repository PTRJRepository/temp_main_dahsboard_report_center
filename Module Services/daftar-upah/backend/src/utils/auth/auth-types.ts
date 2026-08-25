/**
 * Shared Authentication Types for PORTAL_ESTATE
 *
 * This module defines unified types that can be used across
 * the application for authentication and authorization.
 */

/**
 * User roles supported by the system
 */
export enum UserRole {
    ADMIN = "admin",       // Full access to all divisions and features
    USER = "user",         // Regular user with division-restricted access
    KERANI = "kerani",     // Division-specific data access (field supervisor)
    VISITOR = "visitor"    // Read-only access
}

/**
 * User entity stored in database
 */
export interface User {
    id: number;
    username: string;
    email: string;
    full_name: string;
    role: UserRole;
    divisions: string[];    // Division codes user can access
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

/**
 * User with password hash (internal use only)
 */
export interface UserWithHash extends User {
    password_hash: string;
}

/**
 * User creation payload
 */
export interface UserCreate {
    username: string;
    email: string;
    password: string;
    full_name: string;
    role: UserRole;
    divisions: string[];
}

/**
 * User update payload
 */
export interface UserUpdate {
    email?: string;
    full_name?: string;
    role?: UserRole;
    divisions?: string[];
    is_active?: boolean;
}

/**
 * JWT token payload structure
 */
export interface JWTPayload {
    sub: number;           // User ID
    username: string;
    email: string;
    role: UserRole;
    full_name: string;
    divisions: string[];
    iat: number;          // Issued at
    exp: number;           // Expiration timestamp
}

/**
 * Login request payload
 */
export interface LoginRequest {
    username: string;
    password: string;
}

/**
 * Login response structure
 */
export interface LoginResponse {
    access_token: string;
    token_type: "bearer";
    expires_in: number;
    user: Omit<UserWithHash, "password_hash">;
}

/**
 * Authentication result
 */
export interface AuthResult {
    success: boolean;
    user?: User;
    token?: string;
    error?: string;
}

/**
 * API key bypass configuration
 */
export interface APIKeyConfig {
    key: string;
    name: string;
    description?: string;
}

/**
 * Session information
 */
export interface Session {
    user: User;
    token: string;
    expires_at: Date;
}

/**
 * Audit log entry
 */
export interface AuditLog {
    id: number;
    user_id: number | null;
    action: string;
    details: string | null;
    timestamp: Date;
}

/**
 * Audit actions enum
 */
export enum AuditAction {
    LOGIN_SUCCESS = "LOGIN_SUCCESS",
    LOGIN_FAILED = "LOGIN_FAILED",
    LOGOUT = "LOGOUT",
    USER_CREATED = "USER_CREATED",
    USER_UPDATED = "USER_UPDATED",
    USER_DELETED = "USER_DELETED",
    PASSWORD_CHANGED = "PASSWORD_CHANGED",
    PERMISSION_CHANGED = "PERMISSION_CHANGED"
}

/**
 * Permission check result
 */
export interface PermissionResult {
    allowed: boolean;
    reason?: string;
}

/**
 * Division access check options
 */
export interface DivisionAccessOptions {
    user: User;
    requiredDivisions: string[];
    requireAll?: boolean;  // If true, user must have ALL divisions
}
