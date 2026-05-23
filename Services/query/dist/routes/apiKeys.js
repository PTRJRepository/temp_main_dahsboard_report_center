import { ApiKeyManager } from '../utils/apiKeyGenerator.js';
import { authMiddleware } from '../middleware/auth.js';
export async function apiKeyRoutes(fastify) {
    // Initialize API keys with default values (only if special init key is provided)
    fastify.post('/init', {
        schema: {
            description: 'Initialize the API key system with default keys (requires INIT_KEY)',
            tags: ['API Keys'],
            hide: true, // Hide from documentation
            body: {
                type: 'object',
                required: ['initKey'],
                properties: {
                    initKey: { type: 'string' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { initKey } = request.body;
            const expectedInitKey = process.env.INIT_KEY;
            // Check if the provided init key matches the expected one
            if (!expectedInitKey || initKey !== expectedInitKey) {
                reply.code(401);
                return {
                    success: false,
                    message: 'Invalid initialization key'
                };
            }
            // Check if API keys already exist to prevent re-initialization
            const existingKeys = await ApiKeyManager.getAllApiKeys();
            if (existingKeys.length > 0) {
                reply.code(400);
                return {
                    success: false,
                    message: 'API keys already exist. Cannot re-initialize.'
                };
            }
            // Create default API keys
            const defaultPermissions = {
                description: 'Default API key - write only to extend_db_ptrj, others read-only',
                allowed_dbs: ['*'],
                read_only: false,
                write_dbs: ['EXTEND_DB_PTRJ'],
                write_tables: ['*'],
            };
            const adminPermissions = {
                description: 'Admin API key with full write access to all databases',
                allowed_dbs: ['*'],
                read_only: false,
                write_dbs: ['*'],
                write_tables: ['*'],
            };
            const readOnlyPermissions = {
                description: 'Strictly read-only API key for reporting',
                allowed_dbs: ['*'],
                read_only: true,
                write_dbs: [],
                write_tables: [],
            };
            await ApiKeyManager.createApiKey(defaultPermissions, 'Default API Key');
            await ApiKeyManager.createApiKey(adminPermissions, 'Admin API Key');
            await ApiKeyManager.createApiKey(readOnlyPermissions, 'Read-Only API Key');
            return {
                success: true,
                message: 'API key system initialized successfully'
            };
        }
        catch (error) {
            request.log.error(error);
            return {
                success: false,
                message: 'Failed to initialize API key system'
            };
        }
    });
    // Create a new API key
    fastify.post('/api-keys', {
        preHandler: authMiddleware, // Require authentication to create new API keys
        schema: {
            description: 'Create a new API key with specified permissions',
            tags: ['API Keys'],
            body: {
                type: 'object',
                required: ['permissions'],
                properties: {
                    description: { type: 'string' },
                    permissions: {
                        type: 'object',
                        required: ['allowed_dbs', 'read_only', 'write_dbs', 'write_tables'],
                        properties: {
                            description: { type: 'string' },
                            allowed_dbs: { type: 'array', items: { type: 'string' } },
                            read_only: { type: 'boolean' },
                            write_dbs: { type: 'array', items: { type: 'string' } },
                            write_tables: { type: 'array', items: { type: 'string' } }
                        }
                    },
                    expiresAt: { type: 'string', format: 'date-time' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                key: { type: 'string' }, // Only returned on creation
                                createdAt: { type: 'string', format: 'date-time' },
                                permissions: {
                                    type: 'object',
                                    properties: {
                                        description: { type: 'string' },
                                        allowed_dbs: { type: 'array', items: { type: 'string' } },
                                        read_only: { type: 'boolean' },
                                        write_dbs: { type: 'array', items: { type: 'string' } },
                                        write_tables: { type: 'array', items: { type: 'string' } }
                                    }
                                }
                            }
                        },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            // Only allow creation if the requesting key has admin privileges
            if (request.permissions.read_only) {
                reply.code(403);
                return {
                    success: false,
                    error: 'Read-only keys cannot create new API keys'
                };
            }
            const { description, permissions, expiresAt } = request.body;
            // Create the API key
            const keyRecord = await ApiKeyManager.createApiKey(permissions, description);
            // Set expiration if provided
            if (expiresAt) {
                keyRecord.expiresAt = new Date(expiresAt);
                await ApiKeyManager['writeApiKeysFile']({
                    [keyRecord.id]: keyRecord,
                    ...await ApiKeyManager.loadApiKeys()
                });
            }
            // Return the key with the actual API key value (only returned once)
            return {
                success: true,
                data: {
                    id: keyRecord.id,
                    key: keyRecord.key,
                    createdAt: keyRecord.createdAt,
                    permissions: keyRecord.permissions
                }
            };
        }
        catch (error) {
            request.log.error(error);
            return {
                success: false,
                error: 'Failed to create API key'
            };
        }
    });
    // List all API keys (without revealing the actual keys for security)
    fastify.get('/api-keys', {
        preHandler: authMiddleware, // Require authentication to list API keys
        schema: {
            description: 'List all active API keys (without revealing actual key values)',
            tags: ['API Keys'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                keys: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            permissions: {
                                                type: 'object',
                                                properties: {
                                                    description: { type: 'string' },
                                                    allowed_dbs: { type: 'array', items: { type: 'string' } },
                                                    read_only: { type: 'boolean' },
                                                    write_dbs: { type: 'array', items: { type: 'string' } },
                                                    write_tables: { type: 'array', items: { type: 'string' } }
                                                }
                                            },
                                            createdAt: { type: 'string', format: 'date-time' },
                                            lastUsed: { type: 'string', format: 'date-time' },
                                            expiresAt: { type: 'string', format: 'date-time' },
                                            isActive: { type: 'boolean' }
                                        }
                                    }
                                }
                            }
                        },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const keys = await ApiKeyManager.getAllApiKeys();
            // Don't return the actual key values for security
            const safeKeys = keys.map(({ key, ...safeKey }) => safeKey);
            return {
                success: true,
                data: {
                    keys: safeKeys
                }
            };
        }
        catch (error) {
            request.log.error(error);
            return {
                success: false,
                error: 'Failed to list API keys'
            };
        }
    });
    // Delete (deactivate) an API key
    fastify.delete('/api-keys/:id', {
        preHandler: authMiddleware, // Require authentication to delete API keys
        schema: {
            description: 'Deactivate an API key',
            tags: ['API Keys'],
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                deleted: { type: 'boolean' }
                            }
                        },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            // Only allow deletion if the requesting key has admin privileges
            if (request.permissions.read_only) {
                reply.code(403);
                return {
                    success: false,
                    error: 'Read-only keys cannot delete API keys'
                };
            }
            const { id } = request.params;
            const deleted = await ApiKeyManager.deactivateApiKey(id);
            if (!deleted) {
                reply.code(404);
                return {
                    success: false,
                    error: 'API key not found'
                };
            }
            return {
                success: true,
                data: {
                    deleted: true
                }
            };
        }
        catch (error) {
            request.log.error(error);
            return {
                success: false,
                error: 'Failed to delete API key'
            };
        }
    });
}
//# sourceMappingURL=apiKeys.js.map