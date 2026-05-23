import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
export class ApiKeyManager {
    static API_KEYS_FILE = path.join(process.cwd(), 'data', 'api_keys.json');
    static KEY_PREFIX = 'dqg_';
    /**
     * Generate a new API key
     */
    static generateApiKey() {
        // Generate a 32-byte random value and encode it in base64
        const randomBytesBuffer = randomBytes(32);
        const apiKey = this.KEY_PREFIX + randomBytesBuffer.toString('base64url');
        return apiKey;
    }
    /**
     * Create a new API key record with permissions
     */
    static async createApiKey(permissions, description) {
        const apiKey = this.generateApiKey();
        const keyRecord = {
            id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            key: apiKey,
            permissions,
            createdAt: new Date(),
            isActive: true
        };
        if (description) {
            keyRecord.permissions.description = description;
        }
        // Save to storage
        await this.saveApiKey(keyRecord);
        // Return without the actual key for security in some contexts
        return keyRecord;
    }
    /**
     * Save a single API key to storage
     */
    static async saveApiKey(keyRecord) {
        const keys = await this.loadApiKeys();
        keys[keyRecord.id] = keyRecord;
        await this.writeApiKeysFile(keys);
    }
    /**
     * Load all API keys from storage
     */
    static async loadApiKeys() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.API_KEYS_FILE);
            await fs.mkdir(dataDir, { recursive: true });
            // Try to read the file
            const fileContent = await fs.readFile(this.API_KEYS_FILE, 'utf-8');
            const keys = JSON.parse(fileContent);
            // Convert date strings back to Date objects
            Object.values(keys).forEach(key => {
                key.createdAt = new Date(key.createdAt);
                if (key.lastUsed)
                    key.lastUsed = new Date(key.lastUsed);
                if (key.expiresAt)
                    key.expiresAt = new Date(key.expiresAt);
            });
            return keys;
        }
        catch (error) {
            // If file doesn't exist, return empty object
            if (error.code === 'ENOENT') {
                return {};
            }
            throw error;
        }
    }
    /**
     * Write API keys to storage
     */
    static async writeApiKeysFile(keys) {
        // Ensure data directory exists
        const dataDir = path.dirname(this.API_KEYS_FILE);
        await fs.mkdir(dataDir, { recursive: true });
        // Convert Date objects to strings for JSON serialization
        const serializableKeys = Object.fromEntries(Object.entries(keys).map(([id, key]) => [
            id,
            {
                ...key,
                createdAt: key.createdAt.toISOString(),
                lastUsed: key.lastUsed ? key.lastUsed.toISOString() : undefined,
                expiresAt: key.expiresAt ? key.expiresAt.toISOString() : undefined
            }
        ]));
        await fs.writeFile(this.API_KEYS_FILE, JSON.stringify(serializableKeys, null, 2));
    }
    /**
     * Find an API key by its value
     */
    static async findByKey(apiKey) {
        const keys = await this.loadApiKeys();
        for (const keyRecord of Object.values(keys)) {
            if (keyRecord.key === apiKey && keyRecord.isActive) {
                // Update last used timestamp
                keyRecord.lastUsed = new Date();
                await this.saveApiKey(keyRecord);
                return keyRecord;
            }
        }
        return null;
    }
    /**
     * Find an API key by its ID
     */
    static async findById(id) {
        const keys = await this.loadApiKeys();
        const key = keys[id];
        return key && key.isActive ? key : null;
    }
    /**
     * Deactivate an API key (soft delete)
     */
    static async deactivateApiKey(id) {
        const keys = await this.loadApiKeys();
        const key = keys[id];
        if (!key) {
            return false;
        }
        key.isActive = false;
        await this.writeApiKeysFile(keys);
        return true;
    }
    /**
     * Get all active API keys
     */
    static async getAllApiKeys() {
        const keys = await this.loadApiKeys();
        return Object.values(keys).filter(key => key.isActive);
    }
    /**
     * Validate if an API key exists and is active
     */
    static async validateApiKey(apiKey) {
        // Check if key exists and is active
        const keyRecord = await this.findByKey(apiKey);
        if (!keyRecord) {
            return null;
        }
        // Check if key is expired
        if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
            // Mark as inactive if expired
            keyRecord.isActive = false;
            await this.saveApiKey(keyRecord);
            return null;
        }
        return keyRecord.isActive ? keyRecord : null;
    }
}
//# sourceMappingURL=apiKeyGenerator.js.map