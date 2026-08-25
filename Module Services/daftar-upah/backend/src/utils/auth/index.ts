/**
 * Authentication Utilities - Main Entry Point
 *
 * This module exports all authentication-related utilities
 * for use throughout the application.
 *
 * Usage:
 *   import { permissionService, userService } from '../utils/auth';
 */

// Types
export {
    type User,
    type UserWithHash,
    type UserCreate,
    type UserUpdate,
    type JWTPayload,
    type LoginRequest,
    type LoginResponse,
    type AuthResult,
    type APIKeyConfig,
    type Session,
    type AuditLog,
    type PermissionResult,
    type DivisionAccessOptions,
    UserRole,
    AuditAction
} from "./auth-types";

// Services
export { PermissionService, permissionService } from "./permission-service";
export { UserService, userService } from "./user-service";

// Re-export from AuthService for convenience
export { AuthService } from "../../services/authService";

// Constants
export const AUTH_CONFIG = {
    TOKEN_EXPIRY_HOURS: 8,
    TOKEN_EXPIRY_SECONDS: 8 * 60 * 60,
    BCRYPT_ROUNDS: 10,
    MIN_PASSWORD_LENGTH: 6,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION_MINUTES: 15
} as const;

export const ROLE_DISPLAY_NAMES: Record<string, string> = {
    admin: "Administrator",
    user: "Pengguna",
    kerani: "Kerani",
    visitor: "Pengunjung"
};

export const DIVISION_CODES = {
    // Production divisions
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
    // Virtual divisions
    INF: "Infrastruktur",
    WKS_AR: "Workshop ARC Group",
    WKS_PG: "Workshop PG Group",
    WORKSHOP: "Workshop Umum",
    MILL: "Pabrik"
} as const;
