// shared/auth/paths.js
// Path protection + redirect helpers — shared by the Bun gateway.
// Extracted from server_bun.js (was lines 149-181).

const PUBLIC_PATHS = new Set(['/', '/login', '/logout', '/favicon.ico']);
const DASHBOARD_PUBLIC_PREFIXES = ['/_next', '/assets', '/api/auth'];
const DASHBOARD_PATHS = ['/admin', '/dashboard', '/dashboard-user', '/modules', '/report-center', '/api/services', '/api/reports', '/ifess-control', '/api/ifess', '/api/query-gateway', '/api/file', '/config-path'];
const PROTECTED_PATHS = ['/config-path', ...DASHBOARD_PATHS];

export function isProtectedPath(pathname) {
    return PROTECTED_PATHS.some(p => pathname.startsWith(p));
}

export function isDashboardPublicPath(pathname) {
    return PUBLIC_PATHS.has(pathname) || DASHBOARD_PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

export function isDashboardPath(pathname) {
    return isDashboardPublicPath(pathname) || DASHBOARD_PATHS.some(p => pathname.startsWith(p));
}

export function wantsJson(req, pathname) {
    const accept = req.headers.get('accept') || '';
    return pathname.startsWith('/api/') || accept.includes('application/json') || req.method !== 'GET';
}

export function redirectToLogin(req, pathname, search = '') {
    if (wantsJson(req, pathname)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Proxy' },
        });
    }
    const returnTo = encodeURIComponent(pathname + search);
    return Response.redirect(`/login?returnTo=${returnTo}`, 302);
}

export { PUBLIC_PATHS, DASHBOARD_PUBLIC_PREFIXES, DASHBOARD_PATHS, PROTECTED_PATHS };
