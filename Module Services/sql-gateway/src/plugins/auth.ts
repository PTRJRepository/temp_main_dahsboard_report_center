import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { appConfig, type ApiKeyEntry } from '../config.js';
import { monitor } from '../services/monitor.js';

// ─── Authkit: repo-level shared module, local copy as fallback ──────────────
// Per operator request the SINGLE SOURCE OF TRUTH is the repo-root
// shared/authkit (outside Module Services) so every consumer tracks one file.
// The bundled copy in ../lib/authkit.js only serves as a fallback if this
// module is ever run detached from the monorepo.
type Authkit = typeof import('../lib/authkit.js');

async function loadAuthkit(): Promise<Authkit> {
    const sharedPath = '../../../../shared/authkit/index.js';
    const shared = (await import(/* @vite-ignore */ sharedPath).catch(() => null)) as Authkit | null;
    if (shared && typeof shared.verifyGatewayIdentity === 'function') return shared;
    return import('../lib/authkit.js');
}

export interface RequestIdentity {
    mode: 'api-key' | 'gateway' | 'cookie' | 'none';
    caller: string;              // audit label: api:<name> / user:<name> / anon / rejected
    kind: 'service' | 'user' | 'anon';
    name: string;
    readOnly: boolean;           // true → SELECT-only everywhere
    role?: string;
    email?: string;
}

declare module 'fastify' {
    interface FastifyRequest {
        identity: RequestIdentity;
    }
}

function safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
}

function isLoopback(req: FastifyRequest): boolean {
    const ra = req.socket?.remoteAddress || '';
    return ra === '127.0.0.1' || ra === '::1' || ra === '::ffff:127.0.0.1';
}

/** Paths reachable without any identity. */
const PUBLIC_PATHS = new Set(['/health', '/login']);

/**
 * Identity resolution order:
 *  1) x-api-key  → service principal (m2m). Timing-safe compare against the
 *     configured key map; invalid key = hard 401 (no cookie fallback).
 *  2) X-User-* headers — trusted ONLY from loopback peers, i.e. requests the
 *     gateway proxied after verifying the portal RS256 cookie (it strips any
 *     inbound copies first). Proxy-authenticated users skip all further auth.
 *  3) Portal cookie verified locally via shared/authkit (keys/public.pem) —
 *     the direct-access path.
 * Anything else → browser navigations get 302 → /login?next=…, API calls 401.
 */
export async function authPlugin(app: FastifyInstance): Promise<void> {
    const authkit = await loadAuthkit();

    app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
        const url = req.url.split('?')[0];
        const ip = req.ip;

        if (PUBLIC_PATHS.has(url)) {
            req.identity = { mode: 'none', caller: 'anon', kind: 'anon', name: '', readOnly: true };
            return;
        }

        // ── 1) API key (m2m) ──
        const rawKey = req.headers['x-api-key'];
        if (typeof rawKey === 'string' && rawKey.length > 0) {
            let matched: ApiKeyEntry | undefined;
            for (const [key, entry] of appConfig.apiKeys.entries()) {
                if (safeEqual(rawKey, key)) { matched = entry; break; }
            }
            if (!matched) {
                monitor.recordSecurity({
                    kind: 'invalid-api-key', ip, caller: 'rejected',
                    detail: `Invalid x-api-key presented (${rawKey.length} chars)`, path: url,
                });
                req.identity = { mode: 'none', caller: 'rejected', kind: 'anon', name: '', readOnly: true };
                return reply.code(401).send({ success: false, error: 'Invalid API key.' });
            }
            req.identity = {
                mode: 'api-key',
                caller: `api:${matched.name}`,
                kind: 'service',
                name: matched.name,
                readOnly: matched.readOnly,
            };
            applyRateLimit(req, reply);
            return;
        }

        // ── 2) Gateway-injected user headers (loopback peers only) ──
        const gwUser = authkit.verifyGatewayIdentity(req.headers);
        if (gwUser) {
            if (!isLoopback(req)) {
                monitor.recordSecurity({
                    kind: 'spoof-attempt', ip, caller: `user:${gwUser.name}`,
                    detail: 'X-User-* headers from non-loopback peer rejected', path: url,
                });
                req.identity = { mode: 'none', caller: 'rejected', kind: 'anon', name: '', readOnly: true };
                return reply.code(401).send({ success: false, error: 'Untrusted identity headers.' });
            }
            req.identity = {
                mode: 'gateway',
                caller: `user:${gwUser.name || gwUser.userId}`,
                kind: 'user',
                name: gwUser.name || String(gwUser.userId),
                email: gwUser.email,
                role: gwUser.role,
                readOnly: String(gwUser.role).toUpperCase() !== 'ADMIN',
            };
            applyRateLimit(req, reply);
            return;
        }

        // ── 3) Portal cookie (direct access, verified via shared/authkit) ──
        const token = authkit.extractPortalToken(req.headers.cookie);
        const payload = authkit.verifyPortalCookie(token);
        if (payload) {
            const name = String(payload.name ?? payload.username ?? payload.sub ?? '');
            const role = String(payload.role ?? '');
            req.identity = {
                mode: 'cookie',
                caller: `user:${name}`,
                kind: 'user',
                name,
                email: String(payload.email ?? ''),
                role,
                readOnly: role.toUpperCase() !== 'ADMIN',
            };
            applyRateLimit(req, reply);
            return;
        }

        // ── Unauthorized ──
        req.identity = { mode: 'none', caller: 'anon', kind: 'anon', name: '', readOnly: true };
        const isApiSurface = url.startsWith('/v1/') || url.startsWith('/monitor/');
        const accept = String(req.headers.accept ?? '*/*');
        const looksLikeBrowser = req.method === 'GET'
            && !isApiSurface
            && (accept.includes('text/html') || accept === '*/*' || accept === '');
        if (looksLikeBrowser) {
            // Browser navigation → unified login page (SSO button or API key).
            return reply.status(302).header('location', `/login?next=${encodeURIComponent(req.url)}`).send();
        }
        return reply.code(401).send({
            success: false,
            error: 'Unauthorized. Provide x-api-key header or a valid portal session.',
        });
    });
}

// ─── Fixed-window rate limit on /v1/* per caller+IP ─────────────────────────

const windows = new Map<string, { start: number; count: number }>();

function applyRateLimit(req: FastifyRequest, reply: FastifyReply): void {
    const path = req.url.split('?')[0];
    if (!path.startsWith('/v1/')) return;

    const now = Date.now();
    if (windows.size > 5000) windows.clear(); // hard cap on tracker memory
    const key = `${req.identity.caller}|${req.ip}|${Math.floor(now / 60_000)}`;
    let w = windows.get(key);
    if (!w || now - w.start > 60_000) {
        w = { start: now, count: 0 };
        windows.set(key, w);
    }
    w.count++;
    if (w.count > appConfig.rateLimitPerMin) {
        monitor.recordSecurity({
            kind: 'rate-limited', ip: req.ip, caller: req.identity.caller,
            detail: `${w.count} req/min exceeds limit ${appConfig.rateLimitPerMin}`, path,
        });
        reply.code(429).header('retry-after', '60').send({
            success: false,
            error: `Rate limit exceeded (${appConfig.rateLimitPerMin} req/min for ${req.identity.caller}).`,
        });
    }
}
