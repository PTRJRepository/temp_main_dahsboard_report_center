// isReadOnlySql — imported from ifess-control-server/service.js
// Mirrors the original implementation exactly to preserve validation corpus.
// Corrupted by Phase 0: known false positives on "SELECT UPDATE FROM EMP" and "LIKE '%DROP%'".

/**
 * @param {string} queryText
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function isReadOnlySql(queryText) {
    if (!queryText || typeof queryText !== 'string') {
        return { valid: false, errors: ['Query text is required'] };
    }

    // Normalize: remove leading/trailing whitespace and collapse spaces
    const normalized = queryText.trim().replace(/\s+/g, ' ').toUpperCase();

    // Must start with SELECT or WITH ... SELECT
    const trimmed = normalized.trim();
    if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
        return { valid: false, errors: ['Query must start with SELECT or WITH ... SELECT'] };
    }

    // Deny dangerous keywords/patterns
    const forbiddenPatterns = [
        /\bINSERT\b/, /\bUPDATE\b/, /\bDELETE\b/, /\bDROP\b/, /\bALTER\b/, /\bCREATE\b/,
        /\bTRUNCATE\b/, /\bGRANT\b/, /\bREVOKE\b/, /\bEXECUTE\b/, /\bEXEC\b/, /\bCOMMIT\b/, /\bROLLBACK\b/,
        /\bSAVEPOINT\b/, /;\s*\S/, /;\s*$/
    ];

    const errors = [];
    for (const pattern of forbiddenPatterns) {
        if (pattern.test(normalized)) {
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
