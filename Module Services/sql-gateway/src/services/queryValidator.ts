import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Parser } = require('node-sql-parser') as { Parser: new () => { parse(sql: string, opts: { database: string }): { tableList: string[]; ast: unknown } } };

export interface ValidationResult {
    valid: boolean;
    error?: string;
    queryType?: string;
    tables?: string[];
}

const BLACKLISTED_OPERATIONS = ['DROP', 'TRUNCATE', 'GRANT', 'REVOKE',
    'CREATE_PROCEDURE', 'ALTER_PROCEDURE', 'DROP_PROCEDURE',
    'CREATE_FUNCTION', 'ALTER_FUNCTION', 'DROP_FUNCTION',
    'CREATE_VIEW', 'ALTER_VIEW', 'DROP_VIEW',
    'CREATE_TRIGGER', 'ALTER_TRIGGER', 'DROP_TRIGGER',
    'CREATE_INDEX', 'DROP_INDEX'];

const WRITE_OPERATIONS = ['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'CREATE', 'ALTER', 'EXEC', 'EXECUTE'];

/**
 * Permission-aware SQL validation (node-sql-parser, TransactSQL dialect).
 *
 * Access model:
 *  - READ-ONLY callers (readOnly keys / non-ADMIN portal users): SELECT only.
 *  - Full-access callers (admin keys / ADMIN users): writes allowed ONLY on
 *    the FULLACCESS profile+db pair; every other target stays read-only.
 *  - Blacklisted ops (DROP/GRANT/…) follow the same rule as writes.
 *
 * If the parser chokes on dialect quirks we fall back to prefix checks so
 * valid-but-unparseable SQL still runs through the read-only gate safely.
 */
class QueryValidator {
    private parser;

    constructor() {
        this.parser = new Parser();
    }

    validate(sqlQuery: string, hasFullAccess: boolean): ValidationResult {
        let ast: unknown;
        try {
            const parsed = this.parser.parse(sqlQuery, { database: 'TransactSQL' });
            ast = parsed.ast;
        } catch {
            ast = null; // fall back to keyword checks below
        }

        if (ast !== null && ast !== undefined) {
            const statements = Array.isArray(ast) ? ast : [ast];
            for (const statement of statements) {
                const queryType = String((statement as { type?: string })?.type || '').toUpperCase();
                if (!queryType) continue;

                if (BLACKLISTED_OPERATIONS.includes(queryType) && !hasFullAccess) {
                    return {
                        valid: false,
                        error: `Blocked: ${queryType} requires full access (write window profile+db pair).`,
                        queryType,
                    };
                }
                if (WRITE_OPERATIONS.includes(queryType) && !hasFullAccess) {
                    return {
                        valid: false,
                        error: `Access denied: '${queryType}' is not allowed for read-only callers.`,
                        queryType,
                    };
                }
            }
            return { valid: true };
        }

        // Fallback: keyword-prefix checks
        const upper = sqlQuery.toUpperCase().replace(/^\s*(\[[^\]]+\]|\w+)\s*\.\s*(\[?[A-Za-z_]\w*\]?)?\s*/, '');
        for (const op of [...BLACKLISTED_OPERATIONS, ...WRITE_OPERATIONS]) {
            if (upper.startsWith(`${op} `) || upper === op) {
                if (!hasFullAccess) {
                    return {
                        valid: false,
                        error: BLOCKED_MSG(op),
                        queryType: op,
                    };
                }
            }
        }
        return { valid: true };

        function BLOCKED_MSG(op: string): string {
            return WRITE_OPERATIONS.includes(op)
                ? `Access denied: '${op}' is not allowed for read-only callers.`
                : `Blocked: ${op} requires full access.`;
        }
    }
}

export const queryValidator = new QueryValidator();
