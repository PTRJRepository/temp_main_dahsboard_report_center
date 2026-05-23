"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const mssql_1 = require("mssql");
// Database configuration from environment
const config = {
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
};
/**
 * Database Connection Class - Singleton pattern
 * Manages connection pool to SQL Server
 */
class DatabaseConnection {
    constructor() {
        this.pool = null;
        this.isConnecting = false;
    }
    static getInstance() {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection();
        }
        return DatabaseConnection.instance;
    }
    /**
     * Get connection pool (creates if not exists)
     */
    async getPool() {
        if (this.pool?.connected) {
            return this.pool;
        }
        if (this.isConnecting) {
            // Wait for ongoing connection
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.getPool();
        }
        this.isConnecting = true;
        try {
            this.pool = await mssql_1.default.connect(config);
            console.log('✅ Connected to SQL Server:', config.database);
            return this.pool;
        }
        catch (error) {
            console.error('❌ SQL Server connection failed:', error);
            throw error;
        }
        finally {
            this.isConnecting = false;
        }
    }
    /**
     * Execute a query with parameters
     */
    async query(queryText, params) {
        const pool = await this.getPool();
        const request = pool.request();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                request.input(key, value);
            });
        }
        const result = await request.query(queryText);
        return result.recordset;
    }
    /**
     * Execute a query that returns a single row
     */
    async queryOne(queryText, params) {
        const rows = await this.query(queryText, params);
        return rows.length > 0 ? rows[0] : null;
    }
    /**
     * Execute an insert/update/delete statement
     */
    async execute(queryText, params) {
        const pool = await this.getPool();
        const request = pool.request();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                request.input(key, value);
            });
        }
        const result = await request.query(queryText);
        return result.rowsAffected[0] || 0;
    }
    /**
     * Close connection pool
     */
    async close() {
        if (this.pool) {
            await this.pool.close();
            this.pool = null;
            console.log('🔌 SQL Server connection closed');
        }
    }
}
// Export singleton instance
exports.db = DatabaseConnection.getInstance();
exports.default = exports.db;
