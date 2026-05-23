import sql, { ConnectionPool, IResult } from 'mssql'

// Database configuration from environment
const config: sql.config = {
    server: process.env.MSSQL_HOST || '10.0.0.110',
    port: parseInt(process.env.MSSQL_PORT || '1433'),
    user: process.env.MSSQL_USER || 'sa',
    password: process.env.MSSQL_PASSWORD || 'ptrj@123',
    database: process.env.MSSQL_DATABASE || 'extend_db_ptrj',
    options: {
        encrypt: false,
        trustServerCertificate: true,
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
}

/**
 * Database Connection Class - Singleton pattern
 * Manages connection pool to SQL Server
 */
class DatabaseConnection {
    private static instance: DatabaseConnection
    private pool: ConnectionPool | null = null
    private isConnecting: boolean = false

    private constructor() { }

    public static getInstance(): DatabaseConnection {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection()
        }
        return DatabaseConnection.instance
    }

    /**
     * Get connection pool (creates if not exists)
     */
    public async getPool(): Promise<ConnectionPool> {
        if (this.pool?.connected) {
            return this.pool
        }

        if (this.isConnecting) {
            // Wait for ongoing connection
            await new Promise(resolve => setTimeout(resolve, 100))
            return this.getPool()
        }

        this.isConnecting = true
        try {
            this.pool = await sql.connect(config)
            console.log('✅ Connected to SQL Server:', config.database)
            return this.pool
        } catch (error) {
            console.error('❌ SQL Server connection failed:', error)
            throw error
        } finally {
            this.isConnecting = false
        }
    }

    /**
     * Execute a query with parameters
     */
    public async query<T>(queryText: string, params?: Record<string, any>): Promise<T[]> {
        const pool = await this.getPool()
        const request = pool.request()

        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                request.input(key, value)
            })
        }

        const result: IResult<T> = await request.query(queryText)
        return result.recordset
    }

    /**
     * Execute a query that returns a single row
     */
    public async queryOne<T>(queryText: string, params?: Record<string, any>): Promise<T | null> {
        const rows = await this.query<T>(queryText, params)
        return rows.length > 0 ? rows[0] : null
    }

    /**
     * Execute an insert/update/delete statement
     */
    public async execute(queryText: string, params?: Record<string, any>): Promise<number> {
        const pool = await this.getPool()
        const request = pool.request()

        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                request.input(key, value)
            })
        }

        const result = await request.query(queryText)
        return result.rowsAffected[0] || 0
    }

    /**
     * Close connection pool
     */
    public async close(): Promise<void> {
        if (this.pool) {
            await this.pool.close()
            this.pool = null
            console.log('🔌 SQL Server connection closed')
        }
    }
}

// Export singleton instance
export const db = DatabaseConnection.getInstance()
export default db
