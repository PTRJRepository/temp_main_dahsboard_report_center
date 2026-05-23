import { config } from 'dotenv';
config();
// Cache profiles to avoid re-parsing env on every request
let cachedProfiles = null;
/**
 * Parse DATABASE_PROFILES_* environment variables into structured config
 * Results are cached for performance
 */
export function loadDatabaseProfiles() {
    // Return cached profiles if available
    if (cachedProfiles) {
        return cachedProfiles;
    }
    const profiles = {};
    const envVars = process.env;
    // Find all unique database profile names
    const profileNames = new Set();
    for (const key of Object.keys(envVars)) {
        if (key.startsWith('DATABASE_PROFILES_')) {
            const parts = key.replace('DATABASE_PROFILES_', '').split('_');
            const propertyNames = ['DRIVER', 'SERVER', 'PORT', 'USERNAME', 'PASSWORD', 'DATABASE', 'NAME', 'TRUSTED', 'CONNECTION', 'ENCRYPT'];
            let profileParts = [];
            for (let i = 0; i < parts.length; i++) {
                if (propertyNames.includes(parts[i])) {
                    break;
                }
                profileParts.push(parts[i]);
            }
            if (profileParts.length > 0) {
                profileNames.add(profileParts.join('_'));
            }
        }
    }
    // Build config for each profile with OPTIMIZED pool settings
    for (const profileName of profileNames) {
        const prefix = `DATABASE_PROFILES_${profileName}_`;
        const server = envVars[`${prefix}SERVER`];
        const database = envVars[`${prefix}DATABASE_NAME`];
        if (!server || !database) {
            continue;
        }
        profiles[profileName] = {
            driver: envVars[`${prefix}DRIVER`] || 'ODBC Driver 17 for SQL Server',
            server: server,
            port: parseInt(envVars[`${prefix}PORT`] || '1433', 10),
            user: envVars[`${prefix}USERNAME`] || 'sa',
            password: envVars[`${prefix}PASSWORD`] || '',
            database: database,
            options: {
                encrypt: envVars[`${prefix}ENCRYPT`] === 'true',
                trustServerCertificate: envVars[`${prefix}TRUSTED_CONNECTION`] !== 'true',
            },
            pool: {
                // OPTIMIZED: Larger pool for better concurrency
                max: 20, // Max 20 connections per database
                min: 2, // Keep 2 connections warm
                idleTimeoutMillis: 60000, // 60 seconds idle timeout
                acquireTimeoutMillis: 15000, // 15 seconds to acquire connection
            },
        };
    }
    // Cache the result
    cachedProfiles = profiles;
    return profiles;
}
/**
 * Get database configuration by alias (case-insensitive)
 */
export function getDatabaseConfig(alias) {
    const profiles = loadDatabaseProfiles();
    // Case-insensitive lookup
    const normalizedAlias = alias.toUpperCase();
    return profiles[normalizedAlias];
}
/**
 * Get all available database aliases
 */
export function getAvailableAliases() {
    return Object.keys(loadDatabaseProfiles());
}
/**
 * Clear cached profiles (useful for testing)
 */
export function clearProfileCache() {
    cachedProfiles = null;
}
//# sourceMappingURL=database.js.map