import sql from 'mssql';
/**
 * Optimized Connection Pool Manager for SQL Server
 * Uses single profile (LOCAL) to connect, supports switching databases
 */
declare class ConnectionManager {
    private pool;
    private connecting;
    private profileName;
    /**
     * Get current profile name
     */
    getActiveProfile(): string;
    /**
     * Get or create the connection pool
     */
    getPool(): Promise<sql.ConnectionPool>;
    /**
     * Pre-warm connection pool at startup
     */
    warmUp(): Promise<void>;
    /**
     * Create a new connection pool with optimized settings
     */
    private createPool;
    /**
     * Execute a query, optionally on a specific database
     */
    query(sqlQuery: string, params?: Record<string, unknown>, database?: string): Promise<sql.IResult<unknown>>;
    /**
     * Close connection pool
     */
    closeAll(): Promise<void>;
    /**
     * Get pool statistics
     */
    getPoolStats(): {
        connected: boolean;
        size: number;
    } | null;
}
export declare const connectionManager: ConnectionManager;
export {};
//# sourceMappingURL=connectionManager.d.ts.map