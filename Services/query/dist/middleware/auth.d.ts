import { FastifyRequest, FastifyReply } from 'fastify';
export interface ApiKeyPermissions {
    description?: string;
    allowed_dbs: string[];
    read_only: boolean;
    write_dbs: string[];
    write_tables: string[];
}
declare module 'fastify' {
    interface FastifyRequest {
        apiKey: string;
        permissions: ApiKeyPermissions;
    }
}
/**
 * Authentication middleware - validates x-api-key header against env API_TOKEN
 */
export declare function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void>;
//# sourceMappingURL=auth.d.ts.map