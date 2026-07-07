/**
 * IFESS Control Server - API Key Authentication
 *
 * Validates X-API-Key header against configured key.
 * Mirrors the .NET ApiKeyValidator implementation.
 */

const crypto = require('crypto');

// Default API key (should be overridden via environment)
const DEFAULT_API_KEY = process.env.IFESS_API_KEY || 'ptrj-rebinmas-air-ruak-parit-gunung-darul';

let apiKey = DEFAULT_API_KEY;

/**
 * Set the API key (e.g., from config)
 */
function setApiKey(key) {
    if (key) {
        apiKey = key;
        console.log('[IFESS Auth] API key configured');
    }
}

/**
 * Get current API key (masked for logging)
 */
function getMaskedApiKey() {
    if (!apiKey || apiKey.length < 8) {
        return '***';
    }
    return apiKey.substring(0, 4) + '***' + apiKey.substring(apiKey.length - 4);
}

/**
 * Validate if the provided API key matches
 */
function isValid(key) {
    if (!key) {
        return false;
    }

    // Use timing-safe comparison to prevent timing attacks
    try {
        const providedKeyBuffer = Buffer.from(key, 'utf8');
        const expectedKeyBuffer = Buffer.from(apiKey, 'utf8');

        if (providedKeyBuffer.length !== expectedKeyBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(providedKeyBuffer, expectedKeyBuffer);
    } catch (error) {
        // If comparison fails (different lengths), return false
        return false;
    }
}

/**
 * Express middleware for API key validation
 */
function authMiddleware(req, res, next) {
    const providedKey = req.headers['x-api-key'];

    if (!isValid(providedKey)) {
        console.warn(`[IFESS Auth] Unauthorized access attempt from ${req.ip}`);
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Valid X-API-Key header is required.'
        });
    }

    next();
}

/**
 * Optional auth middleware - allows public endpoints but validates if key provided
 */
function optionalAuthMiddleware(req, res, next) {
    const providedKey = req.headers['x-api-key'];

    // If no key provided, continue without auth (for public endpoints)
    if (!providedKey) {
        return next();
    }

    // If key provided, validate it
    if (!isValid(providedKey)) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid X-API-Key.'
        });
    }

    next();
}

module.exports = {
    setApiKey,
    getMaskedApiKey,
    isValid,
    authMiddleware,
    optionalAuthMiddleware
};
