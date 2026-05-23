import { FastifyInstance } from 'fastify';
import { ApiKeyPermissions, ApiKeyRecord } from '../utils/apiKeyGenerator.js';
export interface CreateApiKeyRequest {
    description?: string;
    permissions: ApiKeyPermissions;
    expiresAt?: string;
}
export interface CreateApiKeyResponse {
    success: boolean;
    data?: {
        id: string;
        key: string;
        createdAt: Date;
        permissions: ApiKeyPermissions;
    };
    error?: string;
}
export interface ListApiKeysResponse {
    success: boolean;
    data?: {
        keys: Array<Omit<ApiKeyRecord, 'key'>>;
    };
    error?: string;
}
export interface DeleteApiKeyResponse {
    success: boolean;
    data?: {
        deleted: boolean;
    };
    error?: string;
}
export declare function apiKeyRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=apiKeys.d.ts.map