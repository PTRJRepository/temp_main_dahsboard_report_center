/**
 * IFESS Control Service — Auth Module
 * Validates X-API-Key header against IFESS_API_KEY env var.
 */

const IFESS_API_KEY = process.env.IFESS_API_KEY || 'ptrj-rebinmas-air-ruak-parit-gunung-darul';

/**
 * @param {Request} req — Bun Request object
 * @returns {boolean} true if API key is valid
 */
export function validateApiKey(req) {
    const key = req.headers.get('x-api-key');
    if (!key) return false;
    return key === IFESS_API_KEY;
}

/**
 * Returns a 401 JSON response for unauthorized requests.
 */
export function unauthorizedResponse(message = 'Valid X-API-Key header is required.') {
    return new Response(JSON.stringify({ error: 'Unauthorized', message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
    });
}
