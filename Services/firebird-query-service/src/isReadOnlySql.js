// isReadOnlySql — validates SQL is read-only (SELECT/WITH only)

/**
 * @param {string} queryText
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function isReadOnlySql(queryText) {
    if (!queryText || typeof queryText !== 'string') {
        return { valid: false, errors: ['Query text is required'] };
    }

    const normalized = queryText.trim().replace(/\s+/g, ' ').toUpperCase();
    const trimmed = normalized.trim();

    if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
        return { valid: false, errors: ['Query must start with SELECT or WITH ... SELECT'] };
    }

    // Strip string literals so keywords inside strings (e.g. LIKE '%DROP%') are not flagged
    const stripped = normalized
        .replace(/'[^']*'/g, "''")
        .replace(/"[^"]*"/g, '""');

    // Second pass: remove keywords used as column names in SELECT lists.
    // "SELECT UPDATE FROM EMP" → UPDATE is a column name between SELECT and FROM.
    // Strip SELECT ... FROM clause content from stripped text before forbidden checks.
    const selectMatch = stripped.match(/\bSELECT\s+(.*?)\s+FROM\b/i);
    const hasSelectFrom = selectMatch !== null;

    let scanTarget = stripped;
    if (hasSelectFrom) {
        // Extract SELECT-list words (comma-separated projection list)
        const selectList = selectMatch[1];
        // Remove column-name aliases that happen to be SQL keywords (e.g. "SELECT UPDATE," → remove UPDATE)
        // A column name in a SELECT list is: word bounded by commas, parens, or whitespace
        const cleanedList = selectList.replace(
            /\b(UPDATE|INSERT|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|EXEC|COMMIT|ROLLBACK|SAVEPOINT)\b/g,
            ' COLNAME '
        );
        scanTarget = stripped.replace(selectList, cleanedList);
    }

    const forbiddenPatterns = [
        /\bINSERT\b/, /\bUPDATE\b/, /\bDELETE\b/, /\bDROP\b/, /\bALTER\b/, /\bCREATE\b/,
        /\bTRUNCATE\b/, /\bGRANT\b/, /\bREVOKE\b/, /\bEXECUTE\b/, /\bEXEC\b/, /\bCOMMIT\b/, /\bROLLBACK\b/,
        /\bSAVEPOINT\b/, /;\s*\S/, /;\s*$/
    ];

    const errors = [];
    for (const pattern of forbiddenPatterns) {
        if (pattern.test(scanTarget)) {
            errors.push(`Query contains forbidden pattern: ${pattern.toString()}`);
        }
    }

    // Reject multiple statements by semicolon
    if (normalized.includes(';')) {
        errors.push('Multiple SQL statements are not allowed');
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return { valid: true, errors: [] };
}
