// shared/auth/jwt.js
// JWT verification helpers — shared by the Bun gateway and Next.js auth routes.
// Extracted from server_bun.js (was lines 111-147).

import { createVerify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let _publicKey = null;

/** Load the RSA public key once (lazy, allows ROOT_DIR override). */
export function loadPublicKey(rootDir) {
    if (!_publicKey) {
        _publicKey = readFileSync(resolve(rootDir, 'keys/public.pem'), 'utf-8').trim();
    }
    return _publicKey;
}

/** Allow overriding the key directly (tests / custom paths). */
export function setPublicKey(pem) {
    _publicKey = pem.trim();
}

function base64UrlToBuffer(value) {
    const padded = value + '='.repeat((4 - value.length % 4) % 4);
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function decodeJwtSegment(value) {
    return JSON.parse(base64UrlToBuffer(value).toString('utf8'));
}

/**
 * Verify a JWT (RS256). Returns the payload on success, null otherwise.
 * Never throws — bad tokens return null.
 */
export function verifyJWT(token, rootDir) {
    if (!token) return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [headerB64, payloadB64, signatureB64] = parts;
        const header = decodeJwtSegment(headerB64);
        if (header.alg !== 'RS256') return null;

        const verifier = createVerify('RSA-SHA256');
        verifier.update(`${headerB64}.${payloadB64}`);
        verifier.end();
        if (!verifier.verify(loadPublicKey(rootDir), base64UrlToBuffer(signatureB64))) return null;

        const payload = decodeJwtSegment(payloadB64);
        if (payload.exp && payload.exp * 1000 < Date.now()) return null;
        return payload;
    } catch { return null; }
}

/** Extract auth-token or payroll_auth_token from a Cookie header. */
export function extractToken(cookieHeader) {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/(?:^|;\s*)(?:auth-token|payroll_auth_token)=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

// Verified-payload cache: RS256 verify costs ~1ms CPU per call and browsers
// resend the SAME cookie on every request of a session, so cache verified
// payloads keyed by raw token until exp−5s. Bounded map; oldest entry evicted
// at cap, expired entries dropped on access. Key rotation takes effect once
// cached tokens expire (same trust window as the JWT itself).
const _verifiedCache = new Map();
const VERIFIED_CACHE_MAX = 1000;

/**
 * verifyJWT with a per-process result cache. Same contract as verifyJWT —
 * returns the payload on success, null otherwise, never throws.
 */
export function verifyJWTCached(token, rootDir) {
    if (!token) return null;
    const hit = _verifiedCache.get(token);
    if (hit) {
        if (Date.now() < hit.exp - 5000) return hit.payload;
        _verifiedCache.delete(token);
        return null;
    }
    const payload = verifyJWT(token, rootDir);
    if (payload?.exp) {
        if (_verifiedCache.size >= VERIFIED_CACHE_MAX) {
            _verifiedCache.delete(_verifiedCache.keys().next().value);
        }
        _verifiedCache.set(token, { payload, exp: payload.exp * 1000 });
    }
    return payload;
}
