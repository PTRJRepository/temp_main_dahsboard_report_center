import { ApiKeyPermissions } from '../middleware/auth.js';
export interface ValidationResult {
    valid: boolean;
    error?: string;
    queryType?: string;
    tables?: string[];
}
/**
 * Query Validator using node-sql-parser
 * Validates SQL queries against security rules and user permissions
 */
export declare class QueryValidator {
    private parser;
    constructor();
    /**
     * Validate a SQL query against permissions
     */
    validate(sqlQuery: string, permissions: ApiKeyPermissions, dbAlias: string): ValidationResult;
    /**
     * Check if database is in allowed list
     */
    private isDatabaseAllowed;
    /**
     * Check if database allows write operations
     */
    private isDatabaseWriteAllowed;
    /**
     * Check if tables are in write_tables list
     */
    private isTableWriteAllowed;
    /**
     * Extract table names from tableList
     * tableList format: ["select::null::tablename", "update::db::tablename"]
     */
    private extractTables;
}
export declare const queryValidator: QueryValidator;
//# sourceMappingURL=queryValidator.d.ts.map