import sql from 'mssql';
import { getDatabaseConfig, getAvailableAliases } from '../config/database.js';
// Use LOCAL profile by default
const DEFAULT_PROFILE = 'LOCAL';
/**
 * Optimized Connection Pool Manager for SQL Server
 * Uses single profile (LOCAL) to connect, supports switching databases
 */
class ConnectionManager {
    pool = null;
    connecting = null;
    profileName = DEFAULT_PROFILE;
    /**
     * Get current profile name
     */
    getActiveProfile() {
        return this.profileName;
    }
    /**
     * Get or create the connection pool
     */
    async getPool() {
        // Return existing pool if available and connected
        if (this.pool?.connected) {
            return this.pool;
        }
        // If currently connecting, wait for that promise
        if (this.connecting) {
            return this.connecting;
        }
        // Create new connection
        this.connecting = this.createPool();
        try {
            this.pool = await this.connecting;
            return this.pool;
        }
        finally {
            this.connecting = null;
        }
    }
    /**
     * Pre-warm connection pool at startup
     */
    async warmUp() {
        console.log(`🔥 Pre-warming connection to ${this.profileName}...`);
        try {
            await this.getPool();
            console.log(`✅ Connection ready`);
        }
        catch (err) {
            console.warn(`⚠️ Warmup failed: ${err.message}`);
        }
    }
    /**
     * Create a new connection pool with optimized settings
     */
    async createPool() {
        const config = getDatabaseConfig(this.profileName);
        if (!config) {
            const available = getAvailableAliases();
            throw new Error(`Profile '${this.profileName}' not found. Available: ${available.join(', ')}`);
        }
        const poolConfig = {
            user: config.user,
            password: config.password,
            server: config.server,
            port: config.port,
            database: config.database, // Default database
            pool: {
                max: config.pool.max,
                min: config.pool.min,
                idleTimeoutMillis: config.pool.idleTimeoutMillis,
                acquireTimeoutMillis: config.pool.acquireTimeoutMillis,
            },
            options: {
                encrypt: config.options.encrypt,
                trustServerCertificate: config.options.trustServerCertificate,
                useUTC: true,
                enableArithAbort: true,
            },
            requestTimeout: 30000,
            connectionTimeout: 15000,
        };
        const pool = new sql.ConnectionPool(poolConfig);
        pool.on('error', (err) => {
            console.error(`Pool error:`, err.message);
            this.pool = null;
        });
        await pool.connect();
        console.log(`✅ Connected: ${config.server}:${config.port} (default db: ${config.database})`);
        return pool;
    }
    /**
     * Execute a query, optionally on a specific database
     */
    async query(sqlQuery, params, database) {
        const pool = await this.getPool();
        const request = pool.request();
        // Add parameters if provided
        if (params && Object.keys(params).length > 0) {
            for (const [key, value] of Object.entries(params)) {
                request.input(key, value);
            }
        }
        // If database specified, prepend USE statement
        const finalQuery = database
            ? `USE [${database}]; ${sqlQuery}`
            : sqlQuery;
        return request.query(finalQuery);
    }
    /**
     * Close connection pool
     */
    async closeAll() {
        if (this.pool) {
            console.log(`Closing connection pool...`);
            await this.pool.close();
            this.pool = null;
            console.log('Connection pool closed.');
        }
    }
    /**
     * Get pool statistics
     */
    getPoolStats() {
        if (!this.pool)
            return null;
        return {
            connected: this.pool.connected,
            size: this.pool.size,
        };
    }
}
// Export singleton instance
export const connectionManager = new ConnectionManager();
//# sourceMappingURL=connectionManager.js.map