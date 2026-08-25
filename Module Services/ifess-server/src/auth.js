/**
 * IFESS Server — API Key Authentication
 *
 * Validates the X-API-Key header against the configured keys using a
 * timing-safe comparison. Accepts either IFESS_API_KEY (direct client +
 * control UI traffic) or IFESS_CLIENT_API_KEY (gateway-proxied flow),
 * mirroring the two-key scheme in server_bun.js.
 */

import crypto from 'node:crypto';
import { IFESS_API_KEY, IFESS_CLIENT_API_KEY } from './config.js';

const validKeys = [IFESS_API_KEY, IFESS_CLIENT_API_KEY].filter(Boolean);

export function getMaskedApiKey() {
    const k = IFESS_API_KEY || '';
    if (k.length < 8) return '***';
    return k.slice(0, 4) + '***' + k.slice(-4);
}

/** Timing-safe X-API-Key check against every accepted key. */
export function validateApiKey(req) {
    const provided = req.headers.get('x-api-key');
    if (!provided) return false;
    try {
        const a = Buffer.from(provided, 'utf8');
        for (const expected of validKeys) {
            const b = Buffer.from(expected, 'utf8');
            if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
        }
        return false;
    } catch {
        return false;
    }
}

export function unauthorizedResponse() {
    return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Valid X-API-Key header is required.'
    }), { status: 401, headers: { 'Content-Type': 'application/json' } });
}
