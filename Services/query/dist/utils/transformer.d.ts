export interface StandardResponse<T = unknown> {
    success: boolean;
    db: string | null;
    execution_ms: number;
    data: T | null;
    error: string | null;
}
/**
 * Create a success response
 */
export declare function successResponse<T>(data: T, dbAlias: string, executionMs: number): StandardResponse<T>;
/**
 * Create an error response
 */
export declare function errorResponse(error: string, dbAlias?: string, executionMs?: number): StandardResponse<null>;
/**
 * Measure execution time
 */
export declare function measureTime<T>(fn: () => Promise<T>): Promise<{
    result: T;
    durationMs: number;
}>;
//# sourceMappingURL=transformer.d.ts.map