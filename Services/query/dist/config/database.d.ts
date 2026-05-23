export interface DatabaseConfig {
    driver: string;
    server: string;
    port: number;
    user: string;
    password: string;
    database: string;
    options: {
        encrypt: boolean;
        trustServerCertificate: boolean;
    };
    pool: {
        max: number;
        min: number;
        idleTimeoutMillis: number;
        acquireTimeoutMillis: number;
    };
}
type DatabaseProfiles = Record<string, DatabaseConfig>;
/**
 * Parse DATABASE_PROFILES_* environment variables into structured config
 * Results are cached for performance
 */
export declare function loadDatabaseProfiles(): DatabaseProfiles;
/**
 * Get database configuration by alias (case-insensitive)
 */
export declare function getDatabaseConfig(alias: string): DatabaseConfig | undefined;
/**
 * Get all available database aliases
 */
export declare function getAvailableAliases(): string[];
/**
 * Clear cached profiles (useful for testing)
 */
export declare function clearProfileCache(): void;
export {};
//# sourceMappingURL=database.d.ts.map