/**
 * Create a success response
 */
export function successResponse(data, dbAlias, executionMs) {
    return {
        success: true,
        db: dbAlias,
        execution_ms: Math.round(executionMs),
        data,
        error: null,
    };
}
/**
 * Create an error response
 */
export function errorResponse(error, dbAlias, executionMs = 0) {
    return {
        success: false,
        db: dbAlias || null,
        execution_ms: Math.round(executionMs),
        data: null,
        error,
    };
}
/**
 * Measure execution time
 */
export function measureTime(fn) {
    const start = performance.now();
    return fn().then((result) => ({
        result,
        durationMs: performance.now() - start,
    }));
}
//# sourceMappingURL=transformer.js.map