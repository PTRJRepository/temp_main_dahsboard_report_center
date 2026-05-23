export interface ApiKeyPermissions {
    description?: string;
    allowed_dbs: string[];
    read_only: boolean;
    write_dbs: string[];
    write_tables: string[];
}
export interface ApiKeyRecord {
    id: string;
    key: string;
    permissions: ApiKeyPermissions;
    createdAt: Date;
    lastUsed?: Date;
    expiresAt?: Date;
    isActive: boolean;
}
export declare class ApiKeyManager {
    private static readonly API_KEYS_FILE;
    private static readonly KEY_PREFIX;
    /**
     * Generate a new API key
     */
    static generateApiKey(): string;
    /**
     * Create a new API key record with permissions
     */
    static createApiKey(permissions: ApiKeyPermissions, description?: string): Promise<ApiKeyRecord>;
    /**
     * Save a single API key to storage
     */
    private static saveApiKey;
    /**
     * Load all API keys from storage
     */
    static loadApiKeys(): Promise<Record<string, ApiKeyRecord>>;
    /**
     * Write API keys to storage
     */
    private static writeApiKeysFile;
    /**
     * Find an API key by its value
     */
    static findByKey(apiKey: string): Promise<ApiKeyRecord | null>;
    /**
     * Find an API key by its ID
     */
    static findById(id: string): Promise<ApiKeyRecord | null>;
    /**
     * Deactivate an API key (soft delete)
     */
    static deactivateApiKey(id: string): Promise<boolean>;
    /**
     * Get all active API keys
     */
    static getAllApiKeys(): Promise<ApiKeyRecord[]>;
    /**
     * Validate if an API key exists and is active
     */
    static validateApiKey(apiKey: string): Promise<ApiKeyRecord | null>;
}
//# sourceMappingURL=apiKeyGenerator.d.ts.map