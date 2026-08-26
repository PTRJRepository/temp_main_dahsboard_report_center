// shared/auth/paths.js
// Path protection + redirect helpers — shared by the Bun gateway.
// Extracted from server_bun.js (was lines 149-181).

const PUBLIC_PATHS = new Set(['/', '/login', '/logout', '/favicon.ico']);
const DASHBOARD_PUBLIC_PREFIXES = ['/_next', '/assets', '/api/auth'];
// /report-center, /api/reports, /file and /api/file are served by standalone
// modules (Module Services/report-center :3101 and Module Services/file-manager
// :3103) via routes-config.json — NOT by the Dashboard_Utama app. Keep them out
// of DASHBOARD_PATHS so the gateway proxies them through the route table.
// Same applies to iFESS (2026-08-26 cut-over): /ifess-control, /api/ifess,
// /api/clients and /api/query-gateway belong to Module Services/ifess-server
// (:8003) via the route table — removed from DASHBOARD_PATHS.
const DASHBOARD_PATHS = ['/admin', '/dashboard', '/dashboard-user', '/modules', '/api/services', '/config-path'];
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
