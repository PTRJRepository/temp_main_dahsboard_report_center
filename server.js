const express = require('express');
const http = require('http');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const DASHBOARD_DIR = path.join(ROOT_DIR, 'Dashboard_Utama');

// Performance optimization patterns
const STATIC_EXTENSIONS_RE = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|webp|avif|map)$/;
const VERSION_HASH_RE = /-[a-f0-9]{6,}\.[a-z]+$/;

// Load environment configuration based on NODE_ENV
// Development: localhost
// Production: 223.25.98.220 (atau fallback 10.0.0.110)
const env = process.env.NODE_ENV || 'development';
const envPath = path.join(ROOT_DIR, `.env.${env}`);

// Load dotenv if the file exists
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log(`✅ Loaded environment from: .env.${env}`);
} else {
    // Fallback to default .env if exists
    const defaultEnvPath = path.join(ROOT_DIR, '.env');
    if (fs.existsSync(defaultEnvPath)) {
        require('dotenv').config({ path: defaultEnvPath });
        console.log('✅ Loaded environment from: .env (default)');
    } else {
        console.log('⚠️ No .env file found, using environment variables');
    }
}

// Use the exact Next.js version from the dashboard app to avoid manifest version mismatch
const next = require(path.join(DASHBOARD_DIR, 'node_modules', 'next'));

const dev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 3001;

// Log current environment AFTER PORT is defined
console.log(`🌍 Running in ${env.toUpperCase()} mode`);
if (typeof Bun !== 'undefined') {
    console.log(`🍞 Running on Bun v${Bun.version}`);
}
console.log(`📡 Backend Host: ${process.env.BACKEND_HOST || 'localhost'}`);
console.log(`📡 Fallback Host: ${process.env.BACKEND_HOST_FALLBACK || 'localhost'}`);


// Next.js 16 resolves production artifacts from process.cwd() in this embedded server.
// Keep gateway paths rooted at ROOT_DIR, but run Next from the dashboard app directory.
if (process.cwd() !== DASHBOARD_DIR) {
    process.chdir(DASHBOARD_DIR);
}

// Configure Next.js with the correct host and port
// This ensures that Next.js RSC/prefetch requests use the correct URL
const nextApp = next({
    dev,
    dir: DASHBOARD_DIR,
    hostname: 'localhost',
    port: Number(PORT)
});
const nextHandle = nextApp.getRequestHandler();

const app = express();

// Determine which config file to use based on environment
const CONFIG_FILE = path.join(ROOT_DIR, `routes-config.${env}.json`);
const DEFAULT_CONFIG_FILE = path.join(ROOT_DIR, 'routes-config.json');


// Middleware
app.use(cors());
app.use(morgan('dev'));

// Load routes configuration
let routes = [];
let activeConfigFile = CONFIG_FILE;

function loadRoutes() {
    try {
        // Try environment-specific config first
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            routes = JSON.parse(data);
            activeConfigFile = CONFIG_FILE;
            console.log(`✅ Loaded ${routes.length} routes from: routes-config.${env}.json`);
        } else if (fs.existsSync(DEFAULT_CONFIG_FILE)) {
            // Fallback to default config
            const data = fs.readFileSync(DEFAULT_CONFIG_FILE, 'utf8');
            routes = JSON.parse(data);
            activeConfigFile = DEFAULT_CONFIG_FILE;
            console.log(`✅ Loaded ${routes.length} routes from: routes-config.json (fallback)`);
        } else {
            console.log('⚠️ Config file not found, starting empty.');
            routes = [];
        }
    } catch (error) {
        console.error('❌ Error loading routes:', error.message);
        routes = [];
    }
}

function saveRoutes() {
    try {
        fs.writeFileSync(activeConfigFile, JSON.stringify(routes, null, 4));
        console.log(`✅ Routes saved to: ${path.basename(activeConfigFile)}`);
    } catch (error) {
        console.error('❌ Error saving routes:', error.message);
    }
}

// Initial load
loadRoutes();

// Watch for file changes to hot-reload config
// Watch both environment-specific and default config files
const filesToWatch = [CONFIG_FILE, DEFAULT_CONFIG_FILE];
filesToWatch.forEach(file => {
    if (fs.existsSync(file)) {
        fs.watchFile(file, (curr, prev) => {
            console.log(`🔄 Config change detected in ${path.basename(file)}, reloading...`);
            loadRoutes();
            // Clear proxy caches when routes change
            proxyCache.clear();
            wsProxyCache.clear();
            console.log('🧹 Proxy cache cleared');
        });
    }
});

// ============================================
// SERVE STATIC CONFIG UI AT /config-path
// Must be BEFORE nextApp.prepare() to avoid Next.js intercepting
// ============================================

// Serve static files for route management config UI (CSS, JS)
app.use('/_static', express.static(path.join(__dirname, 'public')));

// Serve /config-path as static config management HTML
app.get('/config-path', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// SERVE UPAH FRONTEND FROM DIST FOLDER
// Static serving untuk frontend yang sudah di-build
// ============================================

const upahDistPath = path.join(ROOT_DIR, 'Services', 'upah', 'dist');

// Daftar path yang termasuk dalam upah app (tanpa prefix /upah)
// Jika ada path baru di frontend, tambahkan di sini
// CATATAN: /login TIDAK termasuk karena itu adalah login page dashboard utama di :3001/login
const UPAH_APP_PATHS = [
    '/payroll',
    '/employee',
    '/report',
    '/locked'
];

// Check if dist folder exists
console.log('🔍 Debug: __dirname:', __dirname);
console.log('🔍 Debug: process.cwd():', process.cwd());
console.log('🔍 Debug: ROOT_DIR:', ROOT_DIR);
console.log('🔍 Debug: upahDistPath:', upahDistPath);
// Serve Dashboard Assets (Fallback/Override)
// This ensures assets like 'kebun sawit.webp' in Dashboard_Utama/public/assets are accessible
const dashboardAssetsPath = path.join(__dirname, 'Dashboard_Utama', 'public', 'assets');
if (fs.existsSync(dashboardAssetsPath)) {
    console.log(`✅ Found dashboard assets: ${dashboardAssetsPath}`);
    app.use('/assets', express.static(dashboardAssetsPath));
    app.use('/upah/assets', express.static(dashboardAssetsPath));
}

if (fs.existsSync(upahDistPath)) {
    console.log(`✅ Found upah dist folder: ${upahDistPath}`);

    // Serve static assets from root paths (locally to ensure they load)
    // /images/* -> serve from dist/images
    app.use('/images', express.static(path.join(upahDistPath, 'images')));

    // Also serve with /upah prefix
    app.use('/upah/images', express.static(path.join(upahDistPath, 'images')));
    app.use('/upah/assets', express.static(path.join(upahDistPath, 'assets')));
    app.use('/upah/vite.svg', express.static(path.join(upahDistPath, 'vite.svg')));
}

// Disable local index.html serving to use backend proxy for the app itself
if (false && fs.existsSync(upahDistPath)) {

    app.get('/upah/*', (req, res, next) => {
        // Skip if requesting a static file with extension
        const extPattern = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webp)$/;
        if (extPattern.test(req.path)) {
            return next();
        }

        // For SPA routes, serve index.html
        serveUpahIndex(req, res);
    });

    function serveUpahIndex(req, res) {
        const indexPath = path.join(upahDistPath, 'index.html');
        console.log(`📄 Serving upah index.html for path: ${req.path}`);

        fs.readFile(indexPath, 'utf8', (err, html) => {
            if (err) {
                console.error('❌ Error reading upah index.html:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Dist sudah di-build dengan base: '/upah/' di vite.config.js
            // dan basename="/upah" di React Router, jadi tidak perlu rewrite

            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Cache-Control', 'no-cache');
            res.send(html);
        });
    }
} else {
    console.log(`⚠️ Upah dist folder not found at: ${upahDistPath}`);
}

// ============================================
// PROXY MIDDLEWARE CACHE
// ============================================

// Cache for proxy middleware instances (HTTP with content rewriting)
const proxyCache = new Map();

// Separate cache for WebSocket proxies (no selfHandleResponse)
const wsProxyCache = new Map();

// Function to get or create proxy middleware for a route
function getProxyMiddleware(route) {
    if (!proxyCache.has(route.id)) {
        const publicLabel = route.public ? ' [PUBLIC - No Auth Required]' : '';
        console.log(`📦 Creating proxy middleware for ${route.path} -> ${route.target}${publicLabel}`);

        // Create pathRewrite rule to strip the route path prefix unless disabled
        // e.g., /absen -> /, /absen/api -> /api
        const pathRewriteRule = {};
        if (route.rewritePath !== false) {
            pathRewriteRule[`^${route.path}`] = '';
        }

        const proxy = createProxyMiddleware({
            target: route.target,
            changeOrigin: route.changeOrigin !== false,
            pathRewrite: pathRewriteRule, // Strip the path prefix
            ws: true, // Support WebSocket for Vite HMR
            logLevel: 'debug',

            // CRITICAL: Self-handle response to rewrite HTML/JS/CSS content
            selfHandleResponse: true,

            onError: (err, req, res) => {
                console.error(`❌ Proxy error for ${route.path}:`, err.message);
                // res might not be an Express response (e.g., during WebSocket upgrade)
                if (res && typeof res.status === 'function' && !res.headersSent) {
                    res.status(502).json({
                        error: 'Proxy Error',
                        message: `Backend service at ${route.target} is not reachable`,
                        details: err.message
                    });
                } else if (res && typeof res.writeHead === 'function' && !res.headersSent) {
                    // Raw HTTP response
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'Proxy Error',
                        message: `Backend service at ${route.target} is not reachable`,
                        details: err.message
                    }));
                }
            },
            onProxyReq: (proxyReq, req, res) => {
                // Remove Accept-Encoding to prevent compression, so we can rewrite content
                proxyReq.removeHeader('Accept-Encoding');

                // Remove conditional request headers to force fresh response (not 304)
                // This is needed so we can rewrite the HTML/JS/CSS content
                proxyReq.removeHeader('If-None-Match');
                proxyReq.removeHeader('If-Modified-Since');

                // Add appropriate headers for static assets
                if (req.path && req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
                    // Allow caching for static assets but ensure they're fresh
                    proxyReq.setHeader('Cache-Control', 'public, max-age=0');
                    proxyReq.removeHeader('If-None-Match');
                    proxyReq.removeHeader('If-Modified-Since');
                }

                console.log(`➡️ Proxying: ${req.method} ${req.originalUrl} -> ${route.target}${proxyReq.path}`);
                if (req.headers.cookie) {
                    console.log(`🍪 Cookies present (Original): ${req.headers.cookie}`);

                    // CRITICAL: Strip 'auth-token' (RS256) because it causes Backend (8002) to crash/error (HTTP 500/404)
                    // Backend expects HS256 (payroll_auth_token) or nothing.
                    const cookies = req.headers.cookie.split(';');
                    const safeCookies = cookies.filter(c => !c.trim().startsWith('auth-token='));

                    if (safeCookies.length < cookies.length) {
                        const newCookieHeader = safeCookies.join(';');
                        proxyReq.setHeader('cookie', newCookieHeader);
                        console.log(`✂️  Sanitized Cookies (Removed auth-token): ${newCookieHeader}`);

                        if (!newCookieHeader.includes('payroll_auth_token')) {
                            console.log('⚠️  WARNING: payroll_auth_token is MISSING! Backend requests will be anonymous/fail. Please log in on Port 8002.');
                        } else {
                            console.log('✅  Backend Cookie (payroll_auth_token) present.');
                        }
                    }
                } else {
                    console.log('🍪 No cookies found in request');
                }
            },
            onProxyRes: (proxyRes, req, res) => {
                console.log(`⬅️ Response: ${proxyRes.statusCode} from ${route.target}`);

                // INTERCEPT 401/403 for HTML requests -> Force Logout/Redirect
                if ((proxyRes.statusCode === 401 || proxyRes.statusCode === 403) &&
                    req.headers['accept'] && req.headers['accept'].includes('text/html')) {
                    console.log(`🚫 Auth Error (${proxyRes.statusCode}) for HTML request. Redirecting to /login.`);
                    res.writeHead(302, { 'Location': '/login' });
                    res.end();
                    proxyRes.resume();
                    return;
                }

                const contentType = proxyRes.headers['content-type'] || '';
                const contentEncoding = proxyRes.headers['content-encoding'] || '';
                const isHtml = contentType.includes('text/html');
                const isJs = contentType.includes('javascript') || contentType.includes('application/javascript');
                const isCss = contentType.includes('text/css');

                // Rewrite Location header for redirects
                if (proxyRes.headers['location']) {
                    const location = proxyRes.headers['location'];
                    if (location.startsWith(route.target)) {
                        const relativePath = location.replace(route.target, '');
                        proxyRes.headers['location'] = `${route.path}${relativePath}`;
                    }
                }

                const isCompressed = ['gzip', 'deflate', 'br'].includes(contentEncoding);

                // ================================================
                // F-003: Passthrough routes — stream compressed bytes directly (no buffering)
                // ================================================
                if (route.rewriteContent === false) {
                    res.statusCode = proxyRes.statusCode;
                    Object.keys(proxyRes.headers).forEach(key => res.setHeader(key, proxyRes.headers[key]));
                    return proxyRes.pipe(res);
                }

                // ================================================
                // F-001: Static Extension Fast-Path — stream directly, zero buffering
                // ================================================
                const reqPath = new URL(req.url, 'http://localhost').pathname;
                const STATIC_EXT_RE = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|webp|avif|map)$/;
                if (STATIC_EXT_RE.test(reqPath)) {
                    console.log(`⚡ Static fast-path: ${reqPath}`);
                    res.statusCode = proxyRes.statusCode;
                    Object.keys(proxyRes.headers).forEach(key => {
                        if (key === 'content-encoding') return; // keep upstream compression
                        res.setHeader(key, proxyRes.headers[key]);
                    });

                    // F-002: Cache-Control headers for static assets
                    const hasVersionHash = /-[a-f0-9]{6,}\.[a-z]+$/.test(reqPath);
                    if (hasVersionHash) {
                        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                    } else {
                        res.setHeader('Cache-Control', 'public, max-age=3600');
                    }

                    // Stream direct — no buffering, no rewrite overhead
                    return proxyRes.pipe(res);
                }

                // ================================================
                // F-002: Cache-Control for HTML (no-cache, no-store)
                // ================================================
                if (isHtml) {
                    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                }

                // Only rewrite HTML, JS, and CSS — skip root path and compressed content
                const shouldRewrite = (isHtml || isJs || isCss) && route.path !== '/' && !isCompressed;

                if (shouldRewrite) {
                    let body = '';
                    proxyRes.on('data', (chunk) => {
                        body += chunk.toString('utf8');
                    });

                    proxyRes.on('end', () => {
                        try {
                            // Rewrite absolute paths (localhost:8002) to relative proxy paths
                            // http://localhost:8002/api -> /upah/api
                            const targetRegex = new RegExp(route.target, 'g');
                            body = body.replace(targetRegex, route.path);

                            // ALSO Rewrite public domain references to 8002 (which is blocked) to relative path
                            // http://ptrjestate.rebinmas.com:8002/api -> /upah/api
                            body = body.replace(/http:\/\/ptrjestate\.rebinmas\.com:8002/g, route.path);

                            // Rewrite absolute paths to include base path
                            // /app.js → /absen/app.js
                            // /src/main.jsx → /absen/src/main.jsx
                            // /@vite/client → /absen/@vite/client

                            if (isHtml) {
                                // Rewrite HTML: script src, link href, img src, etc.
                                body = body.replace(/(<script[^>]+src=["']\s*)\/(?!\/)/gi, `$1${route.path}/`);
                                body = body.replace(/(<link[^>]+href=["']\s*)\/(?!\/)/gi, `$1${route.path}/`);
                                body = body.replace(/(<img[^>]+src=["']\s*)\/(?!\/)/gi, `$1${route.path}/`);
                                body = body.replace(/(<a[^>]+href=["']\s*)\/(?!\/)/gi, `$1${route.path}/`);

                                // Rewrite base tag if exists
                                if (!body.includes('<base')) {
                                    body = body.replace(/<head>/i, `<head>\n  <base href="${route.path}/">`);
                                }

                                // Handle Vite-specific paths
                                body = body.replace(/(["'])\/@vite\//g, `$1${route.path}/@vite/`);
                            }

                            if (isJs) {
                                // Rewrite JS: import statements and fetch calls
                                body = body.replace(/from\s+["']\/(?!\/)/g, `from "${route.path}/`);
                                body = body.replace(/import\s+["']\/(?!\/)/g, `import "${route.path}/`);
                                body = body.replace(/fetch\(["']\/(?!\/)/g, `fetch("${route.path}/`);
                            }

                            if (isCss) {
                                // Rewrite CSS: url() references
                                body = body.replace(/url\(["']?\/(?!\/)/g, `url("${route.path}/`);
                            }

                            // Set correct headers
                            res.statusCode = proxyRes.statusCode;
                            Object.keys(proxyRes.headers).forEach(key => {
                                res.setHeader(key, proxyRes.headers[key]);
                            });

                            // Update content-length
                            res.setHeader('content-length', Buffer.byteLength(body));

                            res.end(body);
                        } catch (error) {
                            console.error(`❌ Error rewriting content for ${route.path}:`, error.message);
                            res.statusCode = 500;
                            res.end('Internal Server Error');
                        }
                    });
                } else {
                    // For non-rewritable content or root path, just pipe through
                    res.statusCode = proxyRes.statusCode;
                    Object.keys(proxyRes.headers).forEach(key => {
                        res.setHeader(key, proxyRes.headers[key]);
                    });
                    proxyRes.pipe(res);
                }
            }
        });
        proxyCache.set(route.id, proxy);
    }
    return proxyCache.get(route.id);
}

// Function to get or create WebSocket proxy middleware for a route
// This is separate because WebSocket needs direct connection without selfHandleResponse
function getWsProxyMiddleware(route) {
    if (!wsProxyCache.has(route.id)) {
        console.log(`📦 Creating WebSocket proxy for ${route.path} -> ${route.target}`);

        // Create pathRewrite rule to strip the route path prefix unless disabled
        const pathRewriteRule = {};
        if (route.rewritePath !== false) {
            pathRewriteRule[`^${route.path}`] = '';
        }

        const wsProxy = createProxyMiddleware({
            target: route.target,
            changeOrigin: true,
            pathRewrite: pathRewriteRule,
            ws: true,
            logLevel: 'debug',
            // NO selfHandleResponse for WebSocket - it needs direct connection
            onError: (err, req, socket) => {
                console.error(`❌ WebSocket proxy error for ${route.path}:`, err.message);
                if (socket && socket.destroy) {
                    socket.destroy();
                }
            },
            onProxyReqWs: (proxyReq, req, socket, options, head) => {
                console.log(`🔌 WebSocket proxying: ${req.url} -> ${route.target}`);
            }
        });
        wsProxyCache.set(route.id, wsProxy);
    }
    return wsProxyCache.get(route.id);
}

nextApp.prepare().then(() => {

    // ============================================
    // ROUTE MANAGEMENT API ENDPOINTS
    // ============================================

    // Get all routes
    app.get('/api/routes', (req, res) => {
        res.json(routes);
    });

    // Add new route
    app.post('/api/routes', express.json(), (req, res) => {
        const { path: routePath, target, description, enabled } = req.body;

        if (!routePath || !target) {
            return res.status(400).json({ error: 'Path and target are required' });
        }

        const newRoute = {
            id: `route-${Date.now()}`,
            path: routePath,
            target,
            description: description || '',
            enabled: enabled !== false
        };

        routes.push(newRoute);
        saveRoutes();

        res.json({ message: 'Route added successfully', route: newRoute });
    });

    // Update route
    app.put('/api/routes/:id', express.json(), (req, res) => {
        const { id } = req.params;
        const { path: routePath, target, description, enabled } = req.body;

        const index = routes.findIndex(r => r.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Route not found' });
        }

        routes[index] = {
            ...routes[index],
            path: routePath || routes[index].path,
            target: target || routes[index].target,
            description: description !== undefined ? description : routes[index].description,
            enabled: enabled !== undefined ? enabled : routes[index].enabled
        };

        saveRoutes();
        res.json({ message: 'Route updated successfully', route: routes[index] });
    });

    // Toggle route enabled/disabled
    app.post('/api/routes/:id/toggle', (req, res) => {
        const { id } = req.params;

        const index = routes.findIndex(r => r.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Route not found' });
        }

        routes[index].enabled = !routes[index].enabled;
        saveRoutes();

        res.json({ message: `Route ${routes[index].enabled ? 'enabled' : 'disabled'}`, route: routes[index] });
    });

    // Delete route
    app.delete('/api/routes/:id', (req, res) => {
        const { id } = req.params;

        const index = routes.findIndex(r => r.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Route not found' });
        }

        routes.splice(index, 1);
        saveRoutes();

        res.json({ message: 'Route deleted successfully' });
    });

    // Check route health
    app.get('/api/routes/:id/health', async (req, res) => {
        const { id } = req.params;

        const route = routes.find(r => r.id === id);
        if (!route) {
            return res.status(404).json({ error: 'Route not found' });
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(route.target, {
                method: 'HEAD',
                signal: controller.signal
            });
            clearTimeout(timeout);

            res.json({ status: response.ok ? 'healthy' : 'unhealthy' });
        } catch (error) {
            res.json({ status: 'unhealthy', error: error.message });
        }
    });

    // ============================================
    // LEGACY API ROUTES FOR BACKWARD COMPATIBILITY
    // ============================================

    // Get backend host from environment (uses BACKEND_HOST or fallback to localhost)
    const absenHost = process.env.BACKEND_HOST || 'localhost';
    const absenPort = process.env.ABSEN_PORT || '5176';
    const absenTarget = `http://${absenHost}:${absenPort}`;

    // Route attendance API calls to the absen service
    app.use('/api/attendance', createProxyMiddleware({
        target: absenTarget,
        changeOrigin: true,
        pathRewrite: {
            '^/api': '/api'
        },
        logLevel: 'debug',
        onError: (err, req, res) => {
            console.error('❌ Attendance API proxy error:', err.message);
            if (!res.headersSent) {
                res.status(502).json({
                    error: 'Service Unavailable',
                    message: 'Attendance service is not reachable'
                });
            }
        }
    }));

    // Route attendance-by-loc-enhanced API calls to the absen service
    app.use('/api/attendance-by-loc-enhanced', createProxyMiddleware({
        target: absenTarget,
        changeOrigin: true,
        pathRewrite: {
            '^/api': '/api'
        },
        logLevel: 'debug',
        onError: (err, req, res) => {
            console.error('❌ Attendance API proxy error:', err.message);
            if (!res.headersSent) {
                res.status(502).json({
                    error: 'Service Unavailable',
                    message: 'Attendance service is not reachable'
                });
            }
        }
    }));

    // ============================================
    // DYNAMIC PROXY MIDDLEWARE
    // ============================================

    // ============================================
    // PROXY MIDDLEWARE - MUST BE BEFORE Next.js HANDLER
    // ============================================

    // Check if path matches a defined proxy route FIRST
    app.use((req, res, next) => {
        const reqPath = req.path;
        const referer = req.get('Referer');

        // Skip management and static routes
        // Note: /query (SQL Gateway) is NOT skipped here - it goes through proxy without auth
        if (reqPath === '/config-path' ||
            reqPath.startsWith('/_static') ||
            reqPath.startsWith('/api/routes') ||
            reqPath.startsWith('/api/auth') ||
            reqPath.startsWith('/api/services') ||
            reqPath.startsWith('/api/ifess')) {
            console.log(`[Proxy Skip] Passing through: ${reqPath}`);
            return next();
        }

        // Skip Next.js internal paths
        if (reqPath.startsWith('/_next') || reqPath.startsWith('/static')) {
            return nextHandle(req, res);
        }

        // Sort routes by path length (longest first) to ensure specific routes match before generic ones
        const sortedRoutes = [...routes].sort((a, b) => b.path.length - a.path.length);

        // Find matching route either by direct path match or by referer for asset requests
        let matchedRoute = sortedRoutes.find(r => r.enabled && reqPath.startsWith(r.path));

        // If no direct match, check if this is an asset request based on referer
        if (!matchedRoute && referer) {
            for (const route of sortedRoutes) {
                if (route.enabled && referer.includes(route.path)) {
                    // This is likely an asset request for this route
                    matchedRoute = route;
                    console.log(`📎 Asset request detected for ${route.path}: ${reqPath}`);
                    break;
                }
            }
        }

        if (matchedRoute) {
            console.log(`🔀 Proxying ${reqPath} -> ${matchedRoute.target}`);

            // Check if this is a WebSocket upgrade request
            const isWebSocketRequest =
                (req.headers.connection || '').toLowerCase().includes('upgrade') ||
                (req.headers.upgrade || '').toLowerCase() === 'websocket';

            // Use passthrough proxy (no selfHandleResponse) when:
            // 1. This is a WebSocket upgrade request
            // 2. rewriteContent is explicitly set to false
            const usePassthroughProxy = isWebSocketRequest || matchedRoute.rewriteContent === false;

            if (usePassthroughProxy) {
                console.log(`🔌 Using passthrough proxy for: ${reqPath} (WebSocket: ${isWebSocketRequest}, rewriteContent: ${matchedRoute.rewriteContent})`);
                const wsProxy = getWsProxyMiddleware(matchedRoute);
                return wsProxy(req, res, next);
            }

            // Use regular proxy with content rewriting for normal HTTP requests
            const proxyMiddleware = getProxyMiddleware(matchedRoute);
            return proxyMiddleware(req, res, next);
        }

        // If no proxy route matches, continue to next middleware
        next();
    });

    // ============================================
    // Next.js ROUTES - HANDLE ONLY DASHBOARD PATHS
    // ============================================

    app.use((req, res) => {
        const reqPath = req.path;

        // Only let Next.js handle dashboard-specific routes
        const isDashboardRoute =
            reqPath === '/' ||
            reqPath === '/login' ||
            reqPath === '/ifess-control' ||
            reqPath.startsWith('/dashboard') ||
            reqPath.startsWith('/dashboard-user') ||
            reqPath.startsWith('/admin') ||
            reqPath.startsWith('/modules') ||
            reqPath.startsWith('/api/auth') ||
            reqPath.startsWith('/api/services') ||
            reqPath.startsWith('/api/routes');

        if (isDashboardRoute) {
            return nextHandle(req, res);
        }

        // Return 404 for unmatched routes
        res.status(404).json({
            error: 'Not Found',
            message: 'No route configured for this path',
            path: reqPath,
            availableRoutes: routes.filter(r => r.enabled).map(r => ({
                path: r.path,
                target: r.target,
                description: r.description
            }))
        });
    });

    // Create HTTP server for WebSocket support
    const server = http.createServer(app);

    // Handle WebSocket upgrade requests
    server.on('upgrade', (req, socket, head) => {
        const reqPath = req.url;
        console.log(`🔌 WebSocket upgrade: ${reqPath}`);
        console.log(`🔌 Headers - Origin: ${req.headers.origin}, Referer: ${req.headers.referer}`);

        const sortedRoutes = [...routes].sort((a, b) => b.path.length - a.path.length);
        let matchedRoute = sortedRoutes.find(r => r.enabled && reqPath.startsWith(r.path));

        // WebSocket HMR requests might come as relative paths (e.g., /?token=xxx)
        // Check multiple headers to find the originating route
        if (!matchedRoute) {
            // Check origin header
            if (req.headers.origin) {
                matchedRoute = sortedRoutes.find(r => r.enabled && req.headers.origin.includes(r.path));
            }

            // Check referer header (Vite HMR often uses this)
            if (!matchedRoute && req.headers.referer) {
                matchedRoute = sortedRoutes.find(r => r.enabled && req.headers.referer.includes(r.path));
            }

            // For Vite: if request is to root (/?token=...) and we have enabled routes with rewriteContent,
            // use the first one that targets a dev server (common Vite ports)
            if (!matchedRoute && (reqPath === '/' || reqPath.startsWith('/?'))) {
                matchedRoute = sortedRoutes.find(r =>
                    r.enabled &&
                    r.rewriteContent === true &&
                    (r.target.includes(':3000') || r.target.includes(':5173') || r.target.includes(':5174') || r.target.includes(':5175') || r.target.includes(':5176') || r.target.includes(':5177'))
                );
            }

            if (matchedRoute) {
                console.log(`🔌 WebSocket HMR request detected for ${matchedRoute.path}: ${reqPath}`);
            }
        }

        if (matchedRoute) {
            console.log(`🔌 WebSocket -> ${matchedRoute.target}`);
            // Use dedicated WebSocket proxy (without selfHandleResponse)
            const wsProxy = getWsProxyMiddleware(matchedRoute);
            wsProxy.upgrade(req, socket, head);
        } else {
            console.log(`❌ No WebSocket route for: ${reqPath}`);
            socket.destroy();
        }
    });

    server.listen(PORT, (err) => {
        if (err) throw err;
        console.log(`\n> 🚀 Unified Server running on http://localhost:${PORT}`);
        console.log(`> 🖥️  Dashboard & Proxy Gateway Integrated`);
        console.log(`> ⚙️  Route Config: http://localhost:${PORT}/config-path`);
        console.log(`> 🔌 WebSocket proxy enabled`);
    });
});
// Force restart: Config updated for query route
