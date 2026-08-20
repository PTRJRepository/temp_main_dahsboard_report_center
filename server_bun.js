/**
 * Bun Native Proxy Gateway — high-performance reverse proxy
 * Equivalent to nginx in functionality, powered by Bun's native HTTP server
 *
 * Key optimizations vs Express:
 * - Native HTTP with zero middleware overhead
 * - LRU in-memory cache for static assets (F-004)
 * - Streaming passthrough for non-HTML content
 * - Connection pooling via keep-alive
 * - Compression pass-through for non-rewrite routes
 * - Bun.serve() for maximum throughput
 *
 * Run: bun run server_bun.js
 * Dev: bun --watch run server_bun.js
 */

// ─── ESM Imports (must be at top) ────────────────────────────────────────────
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import { createVerify } from 'node:crypto';
import { promises as dnsPromises } from 'node:dns';
import { createSocket } from 'node:dgram';
import { Socket } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import {
    arch,
    cpus,
    freemem,
    hostname as osHostname,
    loadavg,
    networkInterfaces,
    platform,
    release,
    totalmem,
    uptime,
} from 'node:os';

// IFESS shared service (kept in CommonJS for Bun/Node compatibility)
const ifessService = require('./Services/ifess-control-server/service');

// ─── Load .env BEFORE any process.env usage ──────────────────────────────────
const env = process.env.NODE_ENV || 'development';
try {
    const dotenv = await import('dotenv');
    try {
        dotenv.config({ path: resolve(import.meta.dir, `.env.${env}`) });
    } catch {
        try {
            dotenv.config({ path: resolve(import.meta.dir, '.env') });
        } catch { /* dotenv optional */ }
    }
} catch { /* dotenv optional */ }

const ROOT_DIR = import.meta.dir;
const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.HOST || '0.0.0.0';
const DASHBOARD_DIR = `${ROOT_DIR}/Dashboard_Utama`;
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT || '3100');
const DASHBOARD_HOST = process.env.DASHBOARD_HOST || '0.0.0.0';
const DASHBOARD_TARGET = process.env.DASHBOARD_TARGET || `http://127.0.0.1:${DASHBOARD_PORT}`;
const FIREBIRD_QUERY_TARGET = process.env.FIREBIRD_QUERY_TARGET || 'http://localhost:8004';
const START_DASHBOARD = process.env.START_DASHBOARD !== 'false';
const START_MODULE_SERVICES = process.env.START_MODULE_SERVICES !== 'false';
const AUTO_INSTALL_MODULE_SERVICES = process.env.AUTO_INSTALL_MODULE_SERVICES !== 'false';
const MONITORING_SERVICE_DIR = `${ROOT_DIR}/Module Services/rebinmas-jaya-server`;
const NETWORK_MONITOR_DIR = `${ROOT_DIR}/Module Services/Wifi_LAN_Monitor/reference-design`;
const CACHE_MAX_SIZE = 50;
const CACHE_TTL_MS = 5 * 60 * 1000;
const GATEWAY_IDLE_TIMEOUT_SECONDS = parseInt(process.env.GATEWAY_IDLE_TIMEOUT_SECONDS || '120');

// ─── LRU Cache Implementation ─────────────────────────────────────────────────
class LRUCache {
    #cache = new Map();
    #maxSize;
    #ttl;

    constructor(maxSize = CACHE_MAX_SIZE, ttlMs = CACHE_TTL_MS) {
        this.#maxSize = maxSize;
        this.#ttl = ttlMs;
    }

    get(key) {
        const entry = this.#cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expires) {
            this.#cache.delete(key);
            return null;
        }
        this.#cache.delete(key);
        this.#cache.set(key, entry);
        return entry.value;
    }

    set(key, value) {
        if (this.#cache.size >= this.#maxSize) {
            const firstKey = this.#cache.keys().next().value;
            this.#cache.delete(firstKey);
        }
        this.#cache.set(key, { value, expires: Date.now() + this.#ttl });
    }

    clear() { this.#cache.clear(); }
    get size() { return this.#cache.size; }
}

// Static asset cache — long TTL, keyed by path + query
const assetCache = new LRUCache(CACHE_MAX_SIZE * 2, 30 * 60 * 1000);

// ─── JWT Verification (lightweight, no crypto.sign overhead) ─────────────────
const JWT_PUBLIC_KEY = readFileSync(`${ROOT_DIR}/keys/public.pem`, 'utf-8').trim();

function verifyJWT(token) {
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
        if (!verifier.verify(JWT_PUBLIC_KEY, base64UrlToBuffer(signatureB64))) return null;

        const payload = decodeJwtSegment(payloadB64);
        if (payload.exp && payload.exp * 1000 < Date.now()) return null;
        return payload;
    } catch { return null; }
}

function base64UrlToBuffer(value) {
    const padded = value + '='.repeat((4 - value.length % 4) % 4);
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function decodeJwtSegment(value) {
    return JSON.parse(base64UrlToBuffer(value).toString('utf8'));
}

function extractToken(cookieHeader) {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/(?:^|;\s*)(?:auth-token|payroll_auth_token)=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

// ─── Public & Protected Path Definitions ──────────────────────────────────────
const PUBLIC_PATHS = new Set(['/', '/login', '/logout', '/favicon.ico']);
const DASHBOARD_PUBLIC_PREFIXES = ['/_next', '/assets', '/api/auth'];
const DASHBOARD_PATHS = ['/admin', '/dashboard', '/dashboard-user', '/modules', '/report-center', '/api/services', '/api/reports', '/ifess-control', '/api/ifess', '/api/query-gateway'];
const PROTECTED_PATHS = ['/config-path', ...DASHBOARD_PATHS];

function isProtectedPath(pathname) {
    return PROTECTED_PATHS.some(p => pathname.startsWith(p));
}

function isDashboardPublicPath(pathname) {
    return PUBLIC_PATHS.has(pathname) || DASHBOARD_PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

function isDashboardPath(pathname) {
    return isDashboardPublicPath(pathname) || DASHBOARD_PATHS.some(p => pathname.startsWith(p));
}

function wantsJson(req, pathname) {
    const accept = req.headers.get('accept') || '';
    return pathname.startsWith('/api/') || accept.includes('application/json') || req.method !== 'GET';
}

function redirectToLogin(req, pathname, search = '') {
    if (wantsJson(req, pathname)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Proxy' },
        });
    }
    const returnTo = encodeURIComponent(pathname + search);
    return Response.redirect(`/login?returnTo=${returnTo}`, 302);
}

// ─── IFESS Control Server Handler (Bun Native) ─────────────────────────────────
const IFESS_API_KEY = process.env.IFESS_API_KEY || 'ptrj-rebinmas-air-ruak-parit-gunung-darul';
// Phase 5: Proxy route API keys
const QUERY_API_KEY = process.env.QUERY_API_KEY || 'ptrj-query-gateway-key';
const UPATH_API_KEY = process.env.UPATH_API_KEY || 'ptrj-upath-key';
const IFESS_CLIENT_API_KEY = process.env.IFESS_CLIENT_API_KEY || 'ptrj-ifess-client-key';

const IFESS_DATA_DIR = `${ROOT_DIR}/data/ifess`;

// IFESS data cache
let ifessData = {
    clients: [],
    configs: {},
    commands: [],
    moduleStatuses: [],
    heartbeatLogs: []
};

function getServerTime() { return new Date().toISOString(); }

function loadIFESSData() {
    try {
        const clientsPath = `${IFESS_DATA_DIR}/clients.json`;
        const configsPath = `${IFESS_DATA_DIR}/configs.json`;
        const commandsPath = `${IFESS_DATA_DIR}/commands.json`;
        const statusesPath = `${IFESS_DATA_DIR}/module-statuses.json`;
        const logsPath = `${IFESS_DATA_DIR}/heartbeat-logs.json`;

        ifessData.clients = JSON.parse(readFileSync(clientsPath, 'utf-8') || '[]');
        ifessData.configs = JSON.parse(readFileSync(configsPath, 'utf-8') || '{}');
        ifessData.commands = JSON.parse(readFileSync(commandsPath, 'utf-8') || '[]');
        ifessData.moduleStatuses = JSON.parse(readFileSync(statusesPath, 'utf-8') || '[]');
        ifessData.heartbeatLogs = JSON.parse(readFileSync(logsPath, 'utf-8') || '[]');
    } catch { /* files may not exist yet */ }
}

function saveIFESSData() {
    try {
        require('fs').mkdirSync(IFESS_DATA_DIR, { recursive: true });
        require('fs').writeFileSync(`${IFESS_DATA_DIR}/clients.json`, JSON.stringify(ifessData.clients, null, 2));
        require('fs').writeFileSync(`${IFESS_DATA_DIR}/configs.json`, JSON.stringify(ifessData.configs, null, 2));
        require('fs').writeFileSync(`${IFESS_DATA_DIR}/commands.json`, JSON.stringify(ifessData.commands, null, 2));
        require('fs').writeFileSync(`${IFESS_DATA_DIR}/module-statuses.json`, JSON.stringify(ifessData.moduleStatuses, null, 2));
        require('fs').writeFileSync(`${IFESS_DATA_DIR}/heartbeat-logs.json`, JSON.stringify(ifessData.heartbeatLogs, null, 2));
    } catch (e) { console.error('IFESS save error:', e); }
}

function validateApiKey(req) {
    const key = req.headers.get('x-api-key');
    if (!key) return false;
    return key === IFESS_API_KEY;
}

// Frontend proxy handler - delegates to shared IFESS service
async function handleFrontendProxy(req) {
    try {
        const body = await req.arrayBuffer();
        const { action, params = {} } = JSON.parse(new TextDecoder().decode(body) || '{}');

        if (!action) {
            return jsonResp(400, { error: 'Action is required' });
        }

        switch (action) {
            case 'getDashboard':
                return jsonResp(200, ifessService.getDashboardSummary());

            case 'listClients':
                return jsonResp(200, ifessService.listClients());

            case 'getClient': {
                const client = ifessService.getClient(params.clientId);
                return client ? jsonResp(200, client) : jsonResp(404, { error: 'Client not found' });
            }

            case 'getClientConfig': {
                const config = ifessService.getClientConfig(params.clientId);
                return config ? jsonResp(200, config) : jsonResp(404, { error: 'Config not found' });
            }

            case 'registerClient':
                return jsonResp(200, ifessService.registerClient(params));

            case 'updateClientConfig': {
                const result = ifessService.updateClientConfig(params.clientId, params.config || params);
                return result.success ? jsonResp(200, result) : jsonResp(400, result);
            }

            case 'sendHeartbeat':
            case 'receiveHeartbeat': {
                const result = ifessService.receiveHeartbeat(params.clientId, params);
                return result.success ? jsonResp(200, result) : jsonResp(404, result);
            }

            case 'getModuleStatuses':
                return jsonResp(200, ifessService.listModuleStatuses(params.clientId));

            case 'reportModuleStatus':
                return jsonResp(200, ifessService.reportModuleStatus(params.clientId, { modules: params.modules || [] }));

            case 'pollCommands':
                return jsonResp(200, { commands: ifessService.pollPendingCommands(params.clientId) });

            case 'listCommands':
                return jsonResp(200, ifessService.listCommands(params.clientId, params.status));

            case 'createCommand': {
                const cmd = ifessService.createCommand(params.clientId, {
                    commandType: params.commandType,
                    moduleCode: params.moduleCode,
                    payload: params.payload || {}
                });
                return jsonResp(200, cmd);
            }

            case 'reportCommandResult': {
                const result = ifessService.reportCommandResult(params.clientId, params.commandId, { status: params.status, message: params.message });
                return result.success ? jsonResp(200, result) : jsonResp(404, result);
            }

            // Client Groups
            case 'listClientGroups':
                return jsonResp(200, ifessService.listClientGroups());

            case 'getClientGroup': {
                const group = ifessService.getClientGroup(params.groupCode);
                return group ? jsonResp(200, group) : jsonResp(404, { error: 'Group not found' });
            }

            case 'createClientGroup': {
                const result = ifessService.createClientGroup(params);
                return result.success ? jsonResp(200, result) : jsonResp(400, result);
            }

            case 'updateClientGroup': {
                const result = ifessService.updateClientGroup(params.groupCode, params);
                return result.success ? jsonResp(200, result) : jsonResp(404, result);
            }

            case 'deleteClientGroup': {
                const result = ifessService.deleteClientGroup(params.groupCode);
                return result.success ? jsonResp(200, result) : jsonResp(404, result);
            }

            case 'addClientToGroup': {
                const result = ifessService.addClientToGroup(params.groupCode, params.clientId);
                return result.success ? jsonResp(200, result) : jsonResp(404, result);
            }

            case 'removeClientFromGroup': {
                const result = ifessService.removeClientFromGroup(params.groupCode, params.clientId);
                return result.success ? jsonResp(200, result) : jsonResp(404, result);
            }

            // Audit Logs
            case 'listAuditLogs':
                return jsonResp(200, ifessService.listAuditLogs(params.filters || {}));

            // ── Firebird → SQL sync ──
            case 'listSyncDivisions':
                return jsonResp(200, ifessService.listSyncDivisions());

            // syncBootstrap: one-time full historical load via FB_Migration subprocess.
            // (The old client-push syncDispatch is removed — sync is now server-pull via
            // the Next.js /api/ifess/sync route, which dispatches EXECUTE_FIREBIRD_QUERY.)
            case 'syncBootstrap': {
                // One-time full historical load via FB_Migration subprocess (heavy).
                const div = ifessService.resolveDivision(params.divisionCode);
                if (!div) return jsonResp(404, { success: false, error: 'Unknown divisionCode' });
                const job = ifessService.createSyncJob({
                    clientId: params.clientId || 'bootstrap',
                    divisionCode: params.divisionCode,
                    mode: 'bootstrap',
                    tables: params.tables || [],
                    requestedBy: params.requestedBy
                });
                // Spawn FB_Migration node subprocess; fire-and-forget (status polled via getSyncJob).
                const fbMigrate = `${ROOT_DIR.replace(/\\/g, '/')}/../FB_Migration/src/migrate.js`;
                const args = [params.tables && params.tables.length ? 'selected' : 'full',
                    '--divisions=' + params.divisionCode,
                    ...(params.tables && params.tables.length ? ['--tables=' + params.tables.join(',')] : []),
                    ...(params.from ? ['--from=' + params.from] : [])];
                ifessService.updateSyncJob(job.syncJobId, { status: 'running', startedAt: new Date().toISOString() });
                spawnFbMigration(fbMigrate, args, job.syncJobId);
                return jsonResp(200, job);
            }

            case 'listSyncJobs':
                return jsonResp(200, ifessService.listSyncJobs(params.limit || 50));

            case 'getSyncJob':
                return jsonResp(200, ifessService.getSyncJob(params.syncJobId));

            default:
                return jsonResp(400, { error: `Unknown action: ${action}` });
        }
    } catch (e) {
        return jsonResp(500, { error: e.message });
    }
}

function jsonResp(status, body) {
    const data = JSON.stringify(body);
    return new Response(data, { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

let monitoringSnapshotCache = null;
let monitoringSnapshotAt = 0;
let monitoringCpuHistory = [];
let lanDiscoveryCache = null;
let lanDiscoveryAt = 0;
let lanDiscoveryInFlight = null;
let lanDiscoveryLastError = null;
let lanDiscoveryLastRefreshReason = null;
let networkUsagePreviousStats = null;

const DISCOVERY_CACHE_TTL_MS = parseInt(process.env.LAN_DISCOVERY_CACHE_TTL_MS || '60000');
const DISCOVERY_REFRESH_INTERVAL_MS = parseInt(process.env.LAN_DISCOVERY_REFRESH_INTERVAL_MS || '600000');
const DISCOVERY_SCHEDULER_TICK_MS = parseInt(process.env.LAN_DISCOVERY_SCHEDULER_TICK_MS || '60000');
const DISCOVERY_AUTO_REFRESH = process.env.LAN_DISCOVERY_AUTO_REFRESH !== 'false';
const DISCOVERY_HOST_LIMIT = parseInt(process.env.LAN_DISCOVERY_HOST_LIMIT || '254');
const DISCOVERY_CONCURRENCY = parseInt(process.env.LAN_DISCOVERY_CONCURRENCY || '32');
const DISCOVERY_PORT_TIMEOUT_MS = parseInt(process.env.LAN_DISCOVERY_PORT_TIMEOUT_MS || '550');
const DISCOVERY_HOST_TIMEOUT_MS = parseInt(process.env.LAN_DISCOVERY_HOST_TIMEOUT_MS || '650');
const DISCOVERY_ALLOW_PUBLIC = process.env.LAN_DISCOVERY_ALLOW_PUBLIC === 'true';
const DISCOVERY_CACHE_FILE = `${ROOT_DIR}/data/monitoring/network-discovery-cache.json`;
const HOST_LABELS_FILE = `${ROOT_DIR}/data/monitoring/network-host-labels.json`;
const NETWORK_USAGE_CACHE_FILE = `${ROOT_DIR}/data/monitoring/network-usage-last.json`;
const DISCOVERY_PORTS = (process.env.LAN_DISCOVERY_PORTS || '22,53,80,135,139,443,445,554,631,3389,5000,5001,5357,5900,8000,8080,8443,9100')
    .split(',')
    .map(port => Number(port.trim()))
    .filter(port => Number.isInteger(port) && port > 0 && port <= 65535);

function clampPercent(value) {
    const number = Number.isFinite(value) ? value : 0;
    return Math.max(0, Math.min(100, Math.round(number)));
}

function bytesToGiB(value) {
    return Math.round((value / 1024 / 1024 / 1024) * 10) / 10;
}

function formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

function runPowerShell(command, timeoutMs = 2500) {
    if (process.platform !== 'win32') return null;

    try {
        return execFileSync('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            command,
        ], {
            encoding: 'utf8',
            timeout: timeoutMs,
            windowsHide: true,
        }).trim();
    } catch {
        return null;
    }
}

async function runPowerShellAsync(command, timeoutMs = 3500) {
    if (process.platform !== 'win32') return null;

    try {
        const proc = Bun.spawn({
            cmd: [
                'powershell.exe',
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy',
                'Bypass',
                '-Command',
                command,
            ],
            stdout: 'pipe',
            stderr: 'ignore',
        });
        const timeout = setTimeout(() => {
            try { proc.kill(); } catch { /* process already exited */ }
        }, timeoutMs);
        const text = await new Response(proc.stdout).text();
        await proc.exited;
        clearTimeout(timeout);
        return text.trim() || null;
    } catch {
        return null;
    }
}

function parseJsonMaybe(value, fallback) {
    if (!value) return fallback;
    try {
        const parsed = JSON.parse(value);
        if (parsed === null || parsed === undefined) return fallback;
        return parsed;
    } catch {
        return fallback;
    }
}

function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined || value === '') return [];
    return [value];
}

function ipToInt(ip) {
    const parts = String(ip).split('.').map(part => Number(part));
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function intToIp(value) {
    return [
        (value >>> 24) & 255,
        (value >>> 16) & 255,
        (value >>> 8) & 255,
        value & 255,
    ].join('.');
}

function netmaskToPrefix(netmask) {
    const intValue = ipToInt(netmask);
    if (intValue === null) return null;
    return intValue.toString(2).padStart(32, '0').replace(/0+$/, '').length;
}

function prefixToNetmask(prefix) {
    const numericPrefix = Number(prefix);
    if (!Number.isInteger(numericPrefix) || numericPrefix < 0 || numericPrefix > 32) return null;
    const mask = numericPrefix === 0 ? 0 : (0xffffffff << (32 - numericPrefix)) >>> 0;
    return intToIp(mask);
}

function getSubnetRange(ip, cidr) {
    const ipInt = ipToInt(ip);
    if (ipInt === null) return null;

    let prefix = null;
    if (cidr && String(cidr).includes('/')) {
        prefix = Number(String(cidr).split('/')[1]);
    }
    if (!Number.isInteger(prefix)) prefix = 24;
    if (prefix < 16) prefix = 24;
    if (prefix > 30) prefix = 30;

    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const network = ipInt & mask;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    return { network, broadcast, prefix };
}

function getSubnetTargets(ip, cidr, limit = DISCOVERY_HOST_LIMIT) {
    const range = getSubnetRange(ip, cidr);
    if (!range) return [];
    const targets = [];

    for (let current = range.network + 1; current < range.broadcast && targets.length < limit; current += 1) {
        targets.push(intToIp(current >>> 0));
    }

    return targets;
}

function isUsableIpv4(ip) {
    if (!ip || ip === '127.0.0.1') return false;
    if (ip.startsWith('169.254.')) return false;
    if (ip.startsWith('0.')) return false;
    return ipToInt(ip) !== null;
}

function isPrivateLanIpv4(ip) {
    const parts = String(ip).split('.').map(part => Number(part));
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part))) return false;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    return false;
}

function isDiscoverableIpv4(ip) {
    return isUsableIpv4(ip) && (DISCOVERY_ALLOW_PUBLIC || isPrivateLanIpv4(ip));
}

function isIpInLocalSubnets(ip, localInterfaces) {
    const ipInt = ipToInt(ip);
    if (ipInt === null) return false;
    return localInterfaces.some(device => {
        if (device.ipAddress === ip) return true;
        const range = getSubnetRange(device.ipAddress, device.cidr);
        return range && ipInt > range.network && ipInt < range.broadcast;
    });
}

function guessVendorFromMac(mac) {
    if (!mac) return null;
    const oui = mac.toUpperCase().replace(/-/g, ':').split(':').slice(0, 3).join(':');
    const vendors = {
        '00:1A:2B': 'Ayecom/legacy network device',
        '00:1B:44': 'SanDisk',
        '00:50:56': 'VMware',
        '00:0C:29': 'VMware',
        '00:05:69': 'VMware',
        '08:00:27': 'VirtualBox',
        '00:15:5D': 'Microsoft Hyper-V',
        '3C:5A:B4': 'Google',
        'F4:F5:D8': 'Google',
        'B8:27:EB': 'Raspberry Pi',
        'DC:A6:32': 'Raspberry Pi',
        'E4:5F:01': 'Raspberry Pi',
        'F0:9F:C2': 'Ubiquiti',
        '24:A4:3C': 'Ubiquiti',
        '78:8A:20': 'Ubiquiti',
        'FC:EC:DA': 'Ubiquiti',
        '00:1E:E5': 'Cisco',
        '00:1B:54': 'Cisco',
        '00:25:9C': 'Cisco',
        'A0:EC:F9': 'Cisco',
        'D4:3D:7E': 'TP-Link',
        'F4:F2:6D': 'TP-Link',
        '50:C7:BF': 'TP-Link',
        'C0:25:E9': 'TP-Link',
        '00:11:32': 'Synology',
        '00:08:9B': 'ICP Electronics',
        'AC:CC:8E': 'Axis Communications',
        '00:40:8C': 'Axis Communications',
        '3C:1E:04': 'D-Link',
        '00:1C:F0': 'D-Link',
        'A4:2B:B0': 'D-Link',
    };
    return vendors[oui] || null;
}

function inferDeviceType(device) {
    const text = [
        device.hostname,
        device.name,
        device.vendor,
        device.httpTitle,
        device.httpServer,
        device.ssdpLocation,
        device.tlsCertificate?.subject,
        device.serviceTypes?.join(' '),
        device.openPorts?.map(port => port.service).join(' '),
    ].filter(Boolean).join(' ').toLowerCase();

    if (/printer|ipp|jetdirect|9100|print/.test(text)) return 'Printer';
    if (/camera|axis|rtsp|nvr|dvr|onvif/.test(text)) return 'Camera';
    if (/router|gateway|firewall|mikrotik|openwrt|pfsense/.test(text)) return 'Router';
    if (/switch|ubiquiti|unifi|cisco|tplink|tp-link/.test(text)) return 'Switch';
    if (/nas|synology|qnap|smb|storage|diskstation/.test(text)) return 'NAS';
    if (/windows|rdp|netbios|workstation|msrpc|ws-discovery/.test(text)) return 'Windows Host';
    if (/linux|ssh/.test(text)) return 'Linux Host';
    if (/chromecast|google cast|dlna|upnp|media|bonjour|airplay/.test(text)) return 'Media Device';
    return 'Unknown';
}

function portServiceName(port) {
    const names = {
        22: 'SSH',
        53: 'DNS',
        80: 'HTTP',
        135: 'MSRPC',
        139: 'NetBIOS',
        443: 'HTTPS',
        445: 'SMB',
        554: 'RTSP',
        631: 'IPP',
        3389: 'RDP',
        5000: 'HTTP-app',
        5001: 'HTTPS-app',
        5357: 'WSDAPI',
        5900: 'VNC',
        8000: 'HTTP-alt',
        8080: 'HTTP-alt',
        8443: 'HTTPS-alt',
        9100: 'JetDirect',
    };
    return names[port] || `TCP ${port}`;
}

async function mapLimit(items, limit, mapper) {
    const results = new Array(items.length);
    let index = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (index < items.length) {
            const current = index;
            index += 1;
            results[current] = await mapper(items[current], current);
        }
    });
    await Promise.all(workers);
    return results;
}

async function withTimeout(promise, timeoutMs, fallback) {
    let timeout = null;
    const guardedPromise = Promise.resolve(promise).catch(() => fallback);
    try {
        return await Promise.race([
            guardedPromise,
            new Promise(resolvePromise => {
                timeout = setTimeout(() => resolvePromise(fallback), timeoutMs);
            }),
        ]);
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

function pickReachabilityStatus(existingStatus, patchStatus) {
    const rank = { offline: 0, warning: 1, critical: 1, healthy: 2 };
    const existingRank = rank[existingStatus] ?? 0;
    const patchRank = rank[patchStatus] ?? existingRank;
    return patchRank >= existingRank ? (patchStatus || existingStatus) : existingStatus;
}

function mergeDevice(map, key, patch) {
    if (!key) return null;
    const existing = map.get(key) || {
        id: key,
        ipAddress: null,
        macAddress: null,
        name: key,
        hostname: null,
        type: 'Unknown',
        status: 'offline',
        branch: osHostname(),
        uptime: '-',
        lastCheck: new Date().toISOString(),
        sources: [],
        evidence: [],
        openPorts: [],
        serviceTypes: [],
    };

    const merged = { ...existing, ...patch };
    merged.ipAddress = patch.ipAddress || existing.ipAddress;
    merged.macAddress = patch.macAddress || existing.macAddress;
    merged.hostname = cleanHostname(patch.hostname) || cleanHostname(existing.hostname);
    merged.httpTitle = patch.httpTitle || existing.httpTitle || null;
    merged.httpServer = patch.httpServer || existing.httpServer || null;
    merged.netmask = patch.netmask || existing.netmask || null;
    merged.cidr = patch.cidr || existing.cidr || null;
    merged.addressFamily = patch.addressFamily || existing.addressFamily;
    merged.status = pickReachabilityStatus(existing.status, patch.status);
    merged.sources = [...new Set([...(existing.sources || []), ...(patch.sources || [])])];
    merged.evidence = [...new Set([...(existing.evidence || []), ...(patch.evidence || [])])].slice(0, 12);
    merged.openPorts = [...(existing.openPorts || []), ...(patch.openPorts || [])]
        .filter((port, index, all) => all.findIndex(item => item.port === port.port) === index)
        .sort((a, b) => a.port - b.port);
    merged.serviceTypes = [...new Set([...(existing.serviceTypes || []), ...(patch.serviceTypes || [])])].slice(0, 12);
    merged.vendor = patch.vendor || existing.vendor || guessVendorFromMac(merged.macAddress);
    merged.type = patch.type && patch.type !== 'Unknown' ? patch.type : inferDeviceType(merged);
    merged.name = pickBestName(existing.name, patch.name, merged.hostname, merged.ipAddress, merged.httpTitle) || merged.macAddress || key;
    map.set(key, merged);
    return merged;
}

function buildDeviceKey(device) {
    return device.ipAddress || device.macAddress || device.name || device.id;
}

function cleanHostname(value) {
    if (!value) return null;
    const text = String(value)
        .trim()
        .replace(/\.$/, '')
        .replace(/^\\\\+/, '')
        .replace(/\s+/g, ' ');
    if (!text || text === '*' || text === '<unknown>') return null;
    if (ipToInt(text) !== null) return null;
    if (/^([0-9a-f]{1,4}:){2,}/i.test(text)) return null;
    if (/^_.*\._(tcp|udp)\./i.test(text)) return null;
    if (/^(localhost|broadcasthost)$/i.test(text)) return null;
    return text;
}

function isIpLiteral(value) {
    return ipToInt(value) !== null;
}

function pickBestName(existingName, patchName, hostname, ipAddress, httpTitle) {
    const cleanedHostname = cleanHostname(hostname);
    if (cleanedHostname) return cleanedHostname;

    const cleanedPatch = cleanHostname(patchName);
    if (cleanedPatch) return cleanedPatch;

    const cleanedExisting = cleanHostname(existingName);
    if (cleanedExisting) return cleanedExisting;

    const cleanedTitle = cleanHostname(httpTitle);
    if (cleanedTitle) return cleanedTitle;

    return ipAddress || existingName || patchName || null;
}

function readWindowsCpuLoad() {
    const output = runPowerShell(
        "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average"
    );
    const value = output === null ? NaN : Number(output.replace(',', '.'));
    return Number.isFinite(value) ? clampPercent(value) : null;
}

function readCpuUsagePercent() {
    const windowsCpu = readWindowsCpuLoad();
    if (windowsCpu !== null) return windowsCpu;

    const cpuCount = Math.max(cpus().length, 1);
    const oneMinuteLoad = loadavg()[0] || 0;
    return clampPercent((oneMinuteLoad / cpuCount) * 100);
}

function readDiskUsage() {
    if (process.platform === 'win32') {
        const output = runPowerShell(`
            Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
            Select-Object DeviceID,Size,FreeSpace |
            ConvertTo-Json -Compress
        `);

        if (output) {
            try {
                const parsed = JSON.parse(output);
                const disks = Array.isArray(parsed) ? parsed : [parsed];
                const totals = disks.reduce((acc, disk) => {
                    acc.size += Number(disk.Size || 0);
                    acc.free += Number(disk.FreeSpace || 0);
                    return acc;
                }, { size: 0, free: 0 });

                if (totals.size > 0) {
                    return {
                        usagePercent: clampPercent(((totals.size - totals.free) / totals.size) * 100),
                        totalGiB: bytesToGiB(totals.size),
                        freeGiB: bytesToGiB(totals.free),
                    };
                }
            } catch { /* fall back below */ }
        }
    }

    return {
        usagePercent: 0,
        totalGiB: null,
        freeGiB: null,
    };
}

function getPrimaryNetworkAddress(devices) {
    const preferred = devices.find(device => device.ipAddress && device.ipAddress !== '127.0.0.1');
    return preferred?.ipAddress || devices[0]?.ipAddress || '127.0.0.1';
}

function getAssetStatus(cpuUsage, ramUsage, diskUsage) {
    if (cpuUsage >= 95 || ramUsage >= 95 || diskUsage >= 95) return 'critical';
    if (cpuUsage >= 80 || ramUsage >= 85 || diskUsage >= 90) return 'warning';
    return 'healthy';
}

function getMonitoringEnvironment() {
    if (process.env.NODE_ENV === 'production') return 'Production';
    if (process.env.NODE_ENV === 'staging') return 'Staging';
    return 'Development';
}

function buildNetworkDevices(nowIso) {
    const entries = Object.entries(networkInterfaces())
        .flatMap(([name, addresses]) => (addresses || []).map(address => ({ name, address })))
        .filter(({ address }) => address && (address.family === 'IPv4' || address.family === 'IPv6'));

    const visibleEntries = entries.some(({ address }) => !address.internal)
        ? entries.filter(({ address }) => !address.internal)
        : entries;

    return visibleEntries.map(({ name, address }, index) => ({
        id: `iface-${index}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
        name,
        type: 'Interface',
        ipAddress: address.address,
        macAddress: address.mac && address.mac !== '00:00:00:00:00:00' ? address.mac : null,
        addressFamily: address.family,
        netmask: address.netmask || null,
        cidr: address.cidr || null,
        status: address.internal ? 'warning' : 'healthy',
        branch: osHostname(),
        uptime: formatDuration(uptime()),
        lastCheck: nowIso,
    }));
}

function getLocalIpv4Interfaces(nowIso) {
    return Object.entries(networkInterfaces())
        .flatMap(([name, addresses]) => (addresses || []).map(address => ({ name, address })))
        .filter(({ address }) => address && address.family === 'IPv4' && !address.internal && isDiscoverableIpv4(address.address))
        .map(({ name, address }, index) => ({
            id: `iface-${index}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
            name,
            hostname: osHostname(),
            type: 'Gateway Interface',
            ipAddress: address.address,
            macAddress: address.mac && address.mac !== '00:00:00:00:00:00' ? address.mac : null,
            addressFamily: address.family,
            netmask: address.netmask || prefixToNetmask(String(address.cidr || '').split('/')[1]) || null,
            cidr: address.cidr || null,
            status: 'healthy',
            branch: osHostname(),
            uptime: formatDuration(uptime()),
            lastCheck: nowIso,
            vendor: guessVendorFromMac(address.mac),
            sources: ['os-interface'],
            evidence: [`Local interface ${name}`],
            openPorts: [],
            serviceTypes: [],
        }));
}

async function collectWindowsInterfaceDetails(nowIso) {
    if (process.platform !== 'win32') return [];

    const output = await runPowerShellAsync(`
        Get-NetIPConfiguration -ErrorAction SilentlyContinue |
        Where-Object { $_.IPv4Address -and $_.IPv4Address.IPAddress } |
        ForEach-Object {
            $adapter = Get-NetAdapter -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue
            $profile = Get-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue
            [pscustomobject]@{
                InterfaceAlias = $_.InterfaceAlias
                InterfaceDescription = $_.InterfaceDescription
                InterfaceIndex = $_.InterfaceIndex
                IPv4Address = ($_.IPv4Address | Select-Object -First 1 -ExpandProperty IPAddress)
                PrefixLength = ($_.IPv4Address | Select-Object -First 1 -ExpandProperty PrefixLength)
                MacAddress = $adapter.MacAddress
                LinkSpeed = $adapter.LinkSpeed
                Status = $adapter.Status
                NetworkProfile = $profile.Name
                DefaultGateway = ($_.IPv4DefaultGateway | Select-Object -First 1 -ExpandProperty NextHop)
                DnsServers = ($_.DNSServer.ServerAddresses -join ', ')
            }
        } | ConvertTo-Json -Compress
    `, 5500);

    return asArray(parseJsonMaybe(output, [])).map((row, index) => {
        const cidr = row.PrefixLength ? `${row.IPv4Address}/${row.PrefixLength}` : null;
        const evidence = [
            row.InterfaceDescription ? `Adapter: ${row.InterfaceDescription}` : '',
            row.LinkSpeed ? `Link speed: ${row.LinkSpeed}` : '',
            row.NetworkProfile ? `Network profile: ${row.NetworkProfile}` : '',
            row.DefaultGateway ? `Default gateway: ${row.DefaultGateway}` : '',
            row.DnsServers ? `DNS: ${row.DnsServers}` : '',
        ].filter(Boolean);

        return {
            id: `win-iface-${row.IPv4Address || index}`,
            name: row.InterfaceAlias || row.IPv4Address,
            hostname: osHostname(),
            type: 'Gateway Interface',
            ipAddress: row.IPv4Address,
            macAddress: row.MacAddress ? String(row.MacAddress).replace(/-/g, ':').toUpperCase() : null,
            addressFamily: 'IPv4',
            netmask: row.PrefixLength ? prefixToNetmask(row.PrefixLength) : null,
            cidr,
            status: String(row.Status || '').toLowerCase() === 'up' ? 'healthy' : 'warning',
            branch: osHostname(),
            uptime: formatDuration(uptime()),
            lastCheck: nowIso,
            vendor: guessVendorFromMac(row.MacAddress),
            sources: ['windows-netipconfiguration'],
            evidence,
            openPorts: [],
            serviceTypes: [],
            defaultGateway: row.DefaultGateway || null,
            dnsServers: row.DnsServers ? String(row.DnsServers).split(/\s*,\s*/).filter(Boolean) : [],
        };
    }).filter(device => isDiscoverableIpv4(device.ipAddress));
}

async function collectDefaultGateways(nowIso) {
    if (process.platform !== 'win32') return [];

    const output = await runPowerShellAsync(`
        Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
        Where-Object { $_.NextHop -and $_.NextHop -ne '0.0.0.0' } |
        Sort-Object RouteMetric,InterfaceMetric |
        Select-Object NextHop,InterfaceAlias,RouteMetric,InterfaceMetric |
        ConvertTo-Json -Compress
    `, 3500);

    return asArray(parseJsonMaybe(output, [])).map((row, index) => ({
        id: `gateway-${row.NextHop || index}`,
        name: `Default gateway ${row.NextHop}`,
        hostname: null,
        type: 'Router',
        ipAddress: row.NextHop,
        macAddress: null,
        status: 'healthy',
        branch: row.InterfaceAlias || osHostname(),
        uptime: '-',
        lastCheck: nowIso,
        sources: ['default-route'],
        evidence: [
            `Default route via ${row.NextHop}`,
            row.InterfaceAlias ? `Interface: ${row.InterfaceAlias}` : '',
            row.RouteMetric !== undefined ? `Route metric: ${row.RouteMetric}` : '',
        ].filter(Boolean),
        openPorts: [],
        serviceTypes: ['Gateway'],
    })).filter(device => isDiscoverableIpv4(device.ipAddress));
}

async function collectArpNeighbors(nowIso) {
    if (process.platform === 'win32') {
        const output = await runPowerShellAsync(`
            Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike '224.*' -and $_.IPAddress -notlike '239.*' -and $_.LinkLayerAddress -and $_.LinkLayerAddress -ne '00-00-00-00-00-00' } |
            Select-Object IPAddress,LinkLayerAddress,State,InterfaceAlias |
            ConvertTo-Json -Compress
        `, 5000);
        return asArray(parseJsonMaybe(output, [])).map((row, index) => ({
            id: `arp-${row.IPAddress || index}`,
            name: row.IPAddress,
            hostname: null,
            type: 'Unknown',
            ipAddress: row.IPAddress,
            macAddress: row.LinkLayerAddress ? String(row.LinkLayerAddress).replace(/-/g, ':').toUpperCase() : null,
            status: String(row.State || '').toLowerCase() === 'unreachable' ? 'offline' : 'healthy',
            branch: row.InterfaceAlias || osHostname(),
            uptime: '-',
            lastCheck: nowIso,
            vendor: guessVendorFromMac(row.LinkLayerAddress),
            sources: ['arp-neighbor'],
            evidence: [`ARP/neighbor state: ${row.State || 'unknown'}`, row.InterfaceAlias ? `Interface: ${row.InterfaceAlias}` : ''].filter(Boolean),
            openPorts: [],
            serviceTypes: [],
        })).filter(device => isDiscoverableIpv4(device.ipAddress));
    }

    try {
        const proc = Bun.spawn({ cmd: ['arp', '-a'], stdout: 'pipe', stderr: 'ignore' });
        const text = await new Response(proc.stdout).text();
        await proc.exited;
        return text.split(/\r?\n/)
            .map(line => line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f:-]{11,17})/i))
            .filter(Boolean)
            .map((match, index) => ({
                id: `arp-${match[1] || index}`,
                name: match[1],
                hostname: null,
                type: 'Unknown',
                ipAddress: match[1],
                macAddress: match[2].replace(/-/g, ':').toUpperCase(),
                status: 'healthy',
                branch: osHostname(),
                uptime: '-',
                lastCheck: nowIso,
                vendor: guessVendorFromMac(match[2]),
                sources: ['arp-neighbor'],
                evidence: ['ARP cache'],
                openPorts: [],
                serviceTypes: [],
            })).filter(device => isDiscoverableIpv4(device.ipAddress));
    } catch {
        return [];
    }
}

async function pingHost(ip) {
    if (process.platform === 'win32') {
        const proc = Bun.spawn({ cmd: ['ping.exe', '-n', '1', '-w', String(DISCOVERY_HOST_TIMEOUT_MS), ip], stdout: 'ignore', stderr: 'ignore' });
        const timeout = setTimeout(() => {
            try { proc.kill(); } catch { /* ignore */ }
        }, DISCOVERY_HOST_TIMEOUT_MS + 350);
        const exitCode = await proc.exited;
        clearTimeout(timeout);
        return exitCode === 0;
    }

    const proc = Bun.spawn({ cmd: ['ping', '-c', '1', '-W', '1', ip], stdout: 'ignore', stderr: 'ignore' });
    const timeout = setTimeout(() => {
        try { proc.kill(); } catch { /* ignore */ }
    }, DISCOVERY_HOST_TIMEOUT_MS + 350);
    const exitCode = await proc.exited;
    clearTimeout(timeout);
    return exitCode === 0;
}

async function pingHostDetailed(ip) {
    if (process.platform !== 'win32') return { ipAddress: ip, reachable: await pingHost(ip), rttMs: null };

    try {
        const proc = Bun.spawn({ cmd: ['ping.exe', '-n', '1', '-w', String(DISCOVERY_HOST_TIMEOUT_MS), ip], stdout: 'pipe', stderr: 'ignore' });
        const timeout = setTimeout(() => {
            try { proc.kill(); } catch { /* ignore */ }
        }, DISCOVERY_HOST_TIMEOUT_MS + 450);
        const text = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        clearTimeout(timeout);
        const rttMatch = text.match(/(?:time|waktu)[=<]\s*(\d+)\s*ms/i);
        const rttMs = rttMatch ? Number(rttMatch[1]) : null;
        return { ipAddress: ip, reachable: exitCode === 0, rttMs };
    } catch {
        return { ipAddress: ip, reachable: false, rttMs: null };
    }
}

async function collectPingSweep(nowIso, localInterfaces) {
    const targets = [...new Set(localInterfaces.flatMap(device => getSubnetTargets(device.ipAddress, device.cidr)))];
    if (targets.length === 0) return [];

    const alive = await mapLimit(targets, DISCOVERY_CONCURRENCY, async ip => {
        const reachable = await pingHost(ip);
        return reachable ? ip : null;
    });

    return alive.filter(Boolean).map(ip => ({
        id: `ping-${ip}`,
        name: ip,
        hostname: null,
        type: 'Unknown',
        ipAddress: ip,
        macAddress: null,
        status: 'healthy',
        branch: osHostname(),
        uptime: '-',
        lastCheck: nowIso,
        sources: ['ping-sweep'],
        evidence: ['ICMP echo reply'],
        openPorts: [],
        serviceTypes: [],
    }));
}

async function collectLatencyMetrics(nowIso, devices) {
    const candidates = devices
        .filter(device => isDiscoverableIpv4(device.ipAddress) && device.status !== 'offline')
        .slice(0, 80);
    if (!candidates.length) {
        return { collectedAt: nowIso, samples: [], summary: { reachable: 0, sampled: 0, avgMs: null, minMs: null, maxMs: null, jitterMs: null } };
    }

    const rows = await mapLimit(candidates, 24, async device => {
        const result = await pingHostDetailed(device.ipAddress);
        return {
            ipAddress: device.ipAddress,
            name: device.hostname || device.name || device.ipAddress,
            reachable: result.reachable,
            rttMs: result.rttMs,
            status: !result.reachable ? 'offline' : result.rttMs === null ? 'unknown' : result.rttMs > 120 ? 'warning' : 'healthy',
            checkedAt: nowIso,
        };
    });

    const values = rows.map(row => row.rttMs).filter(value => Number.isFinite(value));
    const avgMs = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const jitterMs = values.length && avgMs !== null
        ? values.reduce((sum, value) => sum + Math.abs(value - avgMs), 0) / values.length
        : null;

    return {
        collectedAt: nowIso,
        samples: rows,
        summary: {
            sampled: rows.length,
            reachable: rows.filter(row => row.reachable).length,
            avgMs: avgMs === null ? null : Math.round(avgMs * 10) / 10,
            minMs: values.length ? Math.min(...values) : null,
            maxMs: values.length ? Math.max(...values) : null,
            jitterMs: jitterMs === null ? null : Math.round(jitterMs * 10) / 10,
            warning: rows.filter(row => row.status === 'warning').length,
            offline: rows.filter(row => row.status === 'offline').length,
        },
    };
}

async function resolveNameWithPing(ip) {
    if (process.platform !== 'win32') return null;

    try {
        const proc = Bun.spawn({ cmd: ['ping.exe', '-a', '-n', '1', '-w', '900', ip], stdout: 'pipe', stderr: 'ignore' });
        const timeout = setTimeout(() => {
            try { proc.kill(); } catch { /* ignore */ }
        }, 1400);
        const text = await new Response(proc.stdout).text();
        await proc.exited;
        clearTimeout(timeout);
        const escapedIp = ip.replace(/\./g, '\\.');
        const line = text.split(/\r?\n/).find(item => new RegExp(`\\[${escapedIp}\\]`).test(item));
        const match = line?.match(/^\s*Pinging\s+(.+?)\s+\[/i);
        return cleanHostname(match?.[1]);
    } catch {
        return null;
    }
}

async function collectPingResolvedNames(nowIso, devices) {
    if (process.platform !== 'win32') return [];

    const ips = [...new Set(devices.map(device => device.ipAddress).filter(isDiscoverableIpv4))].slice(0, DISCOVERY_HOST_LIMIT);
    const rows = await mapLimit(ips, 24, async ip => {
        const hostname = await resolveNameWithPing(ip);
        if (!hostname) return null;
        return {
            id: `ping-name-${ip}`,
            name: hostname,
            hostname,
            type: 'Unknown',
            ipAddress: ip,
            status: 'healthy',
            branch: osHostname(),
            uptime: '-',
            lastCheck: nowIso,
            sources: ['ping-reverse-name'],
            evidence: [`ping -a name: ${hostname}`],
            openPorts: [],
            serviceTypes: ['Name resolution'],
        };
    });
    return rows.filter(Boolean);
}

async function collectDnsClientCache(nowIso, localInterfaces) {
    if (process.platform !== 'win32') return [];

    const output = await runPowerShellAsync(`
        Get-DnsClientCache -ErrorAction SilentlyContinue |
        Where-Object { $_.Data -match '^([0-9]{1,3}\\.){3}[0-9]{1,3}$' } |
        Select-Object Entry,Data,Type,TimeToLive |
        ConvertTo-Json -Compress
    `, 3000);

    return asArray(parseJsonMaybe(output, [])).map((row, index) => ({
        id: `dns-cache-${row.Data || index}`,
        name: cleanHostname(row.Entry) || row.Data,
        hostname: cleanHostname(row.Entry),
        type: 'Unknown',
        ipAddress: row.Data,
        status: 'healthy',
        branch: osHostname(),
        uptime: '-',
        lastCheck: nowIso,
        sources: ['dns-client-cache'],
        evidence: [
            row.Entry ? `DNS cache: ${row.Entry}` : '',
            row.TimeToLive !== undefined ? `TTL: ${row.TimeToLive}` : '',
        ].filter(Boolean),
        openPorts: [],
        serviceTypes: ['DNS cache'],
    })).filter(device => isDiscoverableIpv4(device.ipAddress) && isIpInLocalSubnets(device.ipAddress, localInterfaces));
}

async function collectActiveConnections(nowIso, localInterfaces) {
    if (process.platform === 'win32') {
        const output = await runPowerShellAsync(`
            Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue |
            Where-Object {
                $_.RemoteAddress -match '^([0-9]{1,3}\\.){3}[0-9]{1,3}$' -and
                $_.RemoteAddress -ne '127.0.0.1' -and
                $_.RemoteAddress -ne '0.0.0.0'
            } |
            Select-Object RemoteAddress,RemotePort,LocalAddress,LocalPort,State,OwningProcess |
            ConvertTo-Json -Compress
        `, 3500);

        return asArray(parseJsonMaybe(output, [])).map((row, index) => ({
            id: `tcp-active-${row.RemoteAddress || index}`,
            name: row.RemoteAddress,
            hostname: null,
            type: 'Unknown',
            ipAddress: row.RemoteAddress,
            status: 'healthy',
            branch: osHostname(),
            uptime: '-',
            lastCheck: nowIso,
            sources: ['active-tcp-connection'],
            evidence: [
                `Established TCP ${row.LocalAddress || '*'}:${row.LocalPort || '*'} -> ${row.RemoteAddress}:${row.RemotePort || '*'}`,
            ],
            openPorts: row.RemotePort ? [{ port: Number(row.RemotePort), service: portServiceName(Number(row.RemotePort)) }] : [],
            serviceTypes: row.RemotePort ? [portServiceName(Number(row.RemotePort))] : [],
        })).filter(device => isDiscoverableIpv4(device.ipAddress) && isIpInLocalSubnets(device.ipAddress, localInterfaces));
    }

    try {
        const proc = Bun.spawn({ cmd: ['netstat', '-n'], stdout: 'pipe', stderr: 'ignore' });
        const text = await new Response(proc.stdout).text();
        await proc.exited;
        return text.split(/\r?\n/)
            .map(line => line.match(/\bTCP\s+\S+\s+(\d+\.\d+\.\d+\.\d+):(\d+)\s+ESTABLISHED/i))
            .filter(Boolean)
            .map((match, index) => ({
                id: `tcp-active-${match[1] || index}`,
                name: match[1],
                hostname: null,
                type: 'Unknown',
                ipAddress: match[1],
                status: 'healthy',
                branch: osHostname(),
                uptime: '-',
                lastCheck: nowIso,
                sources: ['active-tcp-connection'],
                evidence: [`Established TCP connection to ${match[1]}:${match[2]}`],
                openPorts: [{ port: Number(match[2]), service: portServiceName(Number(match[2])) }],
                serviceTypes: [portServiceName(Number(match[2]))],
            })).filter(device => isDiscoverableIpv4(device.ipAddress) && isIpInLocalSubnets(device.ipAddress, localInterfaces));
    } catch {
        return [];
    }
}

function loadNetworkUsagePreviousStats() {
    if (networkUsagePreviousStats) return networkUsagePreviousStats;
    if (!existsSync(NETWORK_USAGE_CACHE_FILE)) return null;

    try {
        networkUsagePreviousStats = JSON.parse(readFileSync(NETWORK_USAGE_CACHE_FILE, 'utf8'));
        return networkUsagePreviousStats;
    } catch {
        return null;
    }
}

function saveNetworkUsageStats(snapshot) {
    try {
        ensureMonitoringDataDir();
        writeFileSync(NETWORK_USAGE_CACHE_FILE, JSON.stringify(snapshot, null, 2), 'utf8');
        networkUsagePreviousStats = snapshot;
    } catch {
        /* usage stats are best-effort */
    }
}

function bytesPerSecondToLabel(value) {
    if (!Number.isFinite(value) || value < 0) return '0 B/s';
    if (value >= 1024 * 1024 * 1024) return `${Math.round((value / 1024 / 1024 / 1024) * 10) / 10} GB/s`;
    if (value >= 1024 * 1024) return `${Math.round((value / 1024 / 1024) * 10) / 10} MB/s`;
    if (value >= 1024) return `${Math.round((value / 1024) * 10) / 10} KB/s`;
    return `${Math.round(value)} B/s`;
}

async function collectNetworkUsage(nowIso, localInterfaces, devices) {
    if (process.platform !== 'win32') {
        return {
            collectedAt: nowIso,
            interfaces: [],
            activeConnections: [],
            deviceConnections: [],
            summary: { activeTcp: 0, listeningTcp: 0, udpEndpoints: 0, totalRxBps: 0, totalTxBps: 0 },
        };
    }

    const [adapterOutput, tcpOutput, udpOutput] = await Promise.all([
        runPowerShellAsync(`
            Get-NetAdapter -Physical -ErrorAction SilentlyContinue |
            ForEach-Object {
                $stats = Get-NetAdapterStatistics -Name $_.Name -ErrorAction SilentlyContinue
                [pscustomobject]@{
                    Name = $_.Name
                    InterfaceDescription = $_.InterfaceDescription
                    Status = $_.Status
                    LinkSpeed = $_.LinkSpeed
                    MacAddress = $_.MacAddress
                    ReceivedBytes = $stats.ReceivedBytes
                    SentBytes = $stats.SentBytes
                    ReceivedUnicastPackets = $stats.ReceivedUnicastPackets
                    SentUnicastPackets = $stats.SentUnicastPackets
                    ReceivedPacketErrors = $stats.ReceivedPacketErrors
                    OutboundPacketErrors = $stats.OutboundPacketErrors
                    DiscardedPacketsReceived = $stats.DiscardedPacketsReceived
                    DiscardedPacketsOutbound = $stats.DiscardedPacketsOutbound
                }
            } | ConvertTo-Json -Compress
        `, 4500),
        runPowerShellAsync(`
            Get-NetTCPConnection -ErrorAction SilentlyContinue |
            Where-Object { $_.RemoteAddress -match '^([0-9]{1,3}\\.){3}[0-9]{1,3}$' } |
            Select-Object LocalAddress,LocalPort,RemoteAddress,RemotePort,State,OwningProcess,CreationTime |
            ConvertTo-Json -Compress
        `, 4500),
        runPowerShellAsync(`
            Get-NetUDPEndpoint -ErrorAction SilentlyContinue |
            Select-Object LocalAddress,LocalPort,OwningProcess |
            ConvertTo-Json -Compress
        `, 3500),
    ]);

    const previous = loadNetworkUsagePreviousStats();
    const previousByName = new Map((previous?.interfaces || []).map(item => [item.name, item]));
    const currentAt = Date.now();
    const previousAt = previous?.timestampMs || 0;
    const elapsedSeconds = previousAt ? Math.max((currentAt - previousAt) / 1000, 1) : null;

    const interfaces = asArray(parseJsonMaybe(adapterOutput, [])).map(row => {
        const name = row.Name || row.InterfaceDescription || 'unknown';
        const previousRow = previousByName.get(name);
        const rxBytes = Number(row.ReceivedBytes || 0);
        const txBytes = Number(row.SentBytes || 0);
        const rxBps = elapsedSeconds && previousRow ? Math.max(0, (rxBytes - Number(previousRow.rxBytes || 0)) / elapsedSeconds) : 0;
        const txBps = elapsedSeconds && previousRow ? Math.max(0, (txBytes - Number(previousRow.txBytes || 0)) / elapsedSeconds) : 0;

        return {
            name,
            description: row.InterfaceDescription || null,
            status: row.Status || 'Unknown',
            linkSpeed: row.LinkSpeed || null,
            macAddress: row.MacAddress ? String(row.MacAddress).replace(/-/g, ':').toUpperCase() : null,
            rxBytes,
            txBytes,
            rxBps,
            txBps,
            rxLabel: bytesPerSecondToLabel(rxBps),
            txLabel: bytesPerSecondToLabel(txBps),
            receivedPackets: Number(row.ReceivedUnicastPackets || 0),
            sentPackets: Number(row.SentUnicastPackets || 0),
            receiveErrors: Number(row.ReceivedPacketErrors || 0),
            transmitErrors: Number(row.OutboundPacketErrors || 0),
            receiveDiscards: Number(row.DiscardedPacketsReceived || 0),
            transmitDiscards: Number(row.DiscardedPacketsOutbound || 0),
        };
    });

    const localIps = new Set(localInterfaces.map(item => item.ipAddress).filter(Boolean));
    const deviceIps = new Set(devices.map(item => item.ipAddress).filter(Boolean));
    const activeConnections = asArray(parseJsonMaybe(tcpOutput, []))
        .map((row, index) => ({
            id: `tcp-${row.LocalAddress}-${row.LocalPort}-${row.RemoteAddress}-${row.RemotePort}-${index}`,
            protocol: 'TCP',
            localAddress: row.LocalAddress,
            localPort: Number(row.LocalPort || 0),
            remoteAddress: row.RemoteAddress,
            remotePort: Number(row.RemotePort || 0),
            state: row.State || 'Unknown',
            owningProcess: Number(row.OwningProcess || 0),
            createdAt: row.CreationTime || null,
            service: portServiceName(Number(row.RemotePort || row.LocalPort || 0)),
            isLocalLan: isDiscoverableIpv4(row.RemoteAddress) && isIpInLocalSubnets(row.RemoteAddress, localInterfaces),
            isGatewayLocal: localIps.has(row.LocalAddress),
        }))
        .filter(item => item.remoteAddress && item.remoteAddress !== '0.0.0.0' && item.remoteAddress !== '127.0.0.1');

    const udpEndpoints = asArray(parseJsonMaybe(udpOutput, [])).map((row, index) => ({
        id: `udp-${row.LocalAddress}-${row.LocalPort}-${index}`,
        protocol: 'UDP',
        localAddress: row.LocalAddress,
        localPort: Number(row.LocalPort || 0),
        owningProcess: Number(row.OwningProcess || 0),
        service: portServiceName(Number(row.LocalPort || 0)),
    }));

    const connectionsByDevice = new Map();
    for (const connection of activeConnections) {
        if (!deviceIps.has(connection.remoteAddress)) continue;
        const existing = connectionsByDevice.get(connection.remoteAddress) || {
            ipAddress: connection.remoteAddress,
            activeTcp: 0,
            establishedTcp: 0,
            ports: [],
            states: {},
            processes: [],
        };
        existing.activeTcp += 1;
        if (String(connection.state).toLowerCase() === 'established') existing.establishedTcp += 1;
        existing.ports.push(`${connection.remotePort}/${connection.service}`);
        existing.states[connection.state] = (existing.states[connection.state] || 0) + 1;
        if (connection.owningProcess) existing.processes.push(connection.owningProcess);
        connectionsByDevice.set(connection.remoteAddress, existing);
    }

    const deviceConnections = [...connectionsByDevice.values()].map(item => ({
        ...item,
        ports: [...new Set(item.ports)].slice(0, 12),
        processes: [...new Set(item.processes)].slice(0, 12),
    }));

    const summary = {
        activeTcp: activeConnections.length,
        establishedTcp: activeConnections.filter(item => String(item.state).toLowerCase() === 'established').length,
        localLanTcp: activeConnections.filter(item => item.isLocalLan).length,
        listeningTcp: activeConnections.filter(item => String(item.state).toLowerCase() === 'listen').length,
        udpEndpoints: udpEndpoints.length,
        totalRxBps: interfaces.reduce((sum, item) => sum + item.rxBps, 0),
        totalTxBps: interfaces.reduce((sum, item) => sum + item.txBps, 0),
        totalRxLabel: bytesPerSecondToLabel(interfaces.reduce((sum, item) => sum + item.rxBps, 0)),
        totalTxLabel: bytesPerSecondToLabel(interfaces.reduce((sum, item) => sum + item.txBps, 0)),
    };

    saveNetworkUsageStats({
        timestampMs: currentAt,
        collectedAt: nowIso,
        interfaces: interfaces.map(item => ({
            name: item.name,
            rxBytes: item.rxBytes,
            txBytes: item.txBytes,
        })),
    });

    return {
        collectedAt: nowIso,
        interfaces,
        activeConnections: activeConnections.slice(0, 500),
        udpEndpoints: udpEndpoints.slice(0, 500),
        deviceConnections,
        summary,
    };
}

async function resolveHostname(ip) {
    try {
        const names = await dnsPromises.reverse(ip);
        return names?.[0] || null;
    } catch {
        if (process.platform !== 'win32') return null;
        const output = await runPowerShellAsync(`Resolve-DnsName -Name '${ip}' -Type PTR -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty NameHost`, 1200);
        return output?.split(/\r?\n/).find(Boolean)?.replace(/\.$/, '') || null;
    }
}

async function collectReverseDns(nowIso, devices) {
    const ips = [...new Set(devices.map(device => device.ipAddress).filter(isDiscoverableIpv4))];
    const rows = await mapLimit(ips, 24, async ip => {
        const hostname = await resolveHostname(ip);
        if (!hostname) return null;
        return {
            id: `dns-${ip}`,
            name: hostname,
            hostname,
            type: 'Unknown',
            ipAddress: ip,
            status: 'healthy',
            branch: osHostname(),
            uptime: '-',
            lastCheck: nowIso,
            sources: ['reverse-dns'],
            evidence: [`PTR: ${hostname}`],
            openPorts: [],
            serviceTypes: [],
        };
    });
    return rows.filter(Boolean);
}

async function collectNetbios(nowIso, devices) {
    if (process.platform !== 'win32') return [];

    const ips = [...new Set(devices.map(device => device.ipAddress).filter(isDiscoverableIpv4))].slice(0, DISCOVERY_HOST_LIMIT);
    const rows = await mapLimit(ips, 16, async ip => {
        const proc = Bun.spawn({ cmd: ['nbtstat.exe', '-A', ip], stdout: 'pipe', stderr: 'ignore' });
        const timeout = setTimeout(() => {
            try { proc.kill(); } catch { /* ignore */ }
        }, 1800);
        const text = await new Response(proc.stdout).text();
        await proc.exited;
        clearTimeout(timeout);
        const names = text.split(/\r?\n/)
            .map(line => cleanHostname(line.match(/^\s*([^\s<]{1,15})\s+<00>\s+UNIQUE/i)?.[1]))
            .filter(Boolean)
            .filter(name => !/^(WORKGROUP|MSHOME|INet~Services)$/i.test(name));
        const hostname = names[0] || null;
        if (!hostname) return null;
        return {
            id: `netbios-${ip}`,
            name: hostname,
            hostname,
            type: 'Windows Host',
            ipAddress: ip,
            status: 'healthy',
            branch: osHostname(),
            uptime: '-',
            lastCheck: nowIso,
            sources: ['netbios'],
            evidence: [`NetBIOS name: ${hostname}`],
            openPorts: [],
            serviceTypes: ['NetBIOS'],
        };
    });
    return rows.filter(Boolean);
}

async function collectNetbiosCache(nowIso, localInterfaces) {
    if (process.platform !== 'win32') return [];

    try {
        const proc = Bun.spawn({ cmd: ['nbtstat.exe', '-c'], stdout: 'pipe', stderr: 'ignore' });
        const timeout = setTimeout(() => {
            try { proc.kill(); } catch { /* ignore */ }
        }, 1600);
        const text = await new Response(proc.stdout).text();
        await proc.exited;
        clearTimeout(timeout);

        return text.split(/\r?\n/)
            .map(line => line.match(/^\s*([^\s<]{1,15})\s+<([0-9A-F]{2})>\s+\w+\s+(\d+\.\d+\.\d+\.\d+)/i))
            .filter(Boolean)
            .map((match, index) => {
                const hostname = cleanHostname(match[1]);
                const ip = match[3];
                if (!hostname || !isDiscoverableIpv4(ip) || !isIpInLocalSubnets(ip, localInterfaces)) return null;
                return {
                    id: `netbios-cache-${ip}-${index}`,
                    name: hostname,
                    hostname,
                    type: 'Windows Host',
                    ipAddress: ip,
                    status: 'healthy',
                    branch: osHostname(),
                    uptime: '-',
                    lastCheck: nowIso,
                    sources: ['netbios-cache'],
                    evidence: [`NetBIOS cache: ${hostname} (${match[2]})`],
                    openPorts: [],
                    serviceTypes: ['NetBIOS'],
                };
            })
            .filter(Boolean);
    } catch {
        return [];
    }
}

async function collectWindowsNetworkBrowse(nowIso, localInterfaces) {
    if (process.platform !== 'win32') return [];

    const output = await runPowerShellAsync(`
        $names = (cmd.exe /c net view 2>$null) |
            ForEach-Object {
                if ($_ -match '^\\\\(?<name>\\S+)') { $matches.name }
            } |
            Where-Object { $_ } |
            Select-Object -Unique

        $names | ForEach-Object {
            $name = $_
            $ip = $null
            try {
                $ip = (Resolve-DnsName -Name $name -Type A -ErrorAction Stop |
                    Where-Object { $_.IPAddress -match '^([0-9]{1,3}\\.){3}[0-9]{1,3}$' } |
                    Select-Object -First 1 -ExpandProperty IPAddress)
            } catch {
                try {
                    $ip = [System.Net.Dns]::GetHostAddresses($name) |
                        Where-Object { $_.AddressFamily -eq 'InterNetwork' } |
                        Select-Object -First 1 |
                        ForEach-Object { $_.IPAddressToString }
                } catch { }
            }

            [pscustomobject]@{
                Name = $name
                IPAddress = $ip
            }
        } | ConvertTo-Json -Compress
    `, 6000);

    return asArray(parseJsonMaybe(output, [])).map((row, index) => {
        const hostname = cleanHostname(row.Name);
        return {
            id: `windows-network-${row.IPAddress || hostname || index}`,
            name: hostname || row.IPAddress,
            hostname,
            type: 'Windows Host',
            ipAddress: row.IPAddress,
            status: row.IPAddress ? 'healthy' : 'warning',
            branch: osHostname(),
            uptime: '-',
            lastCheck: nowIso,
            sources: ['windows-network-browse'],
            evidence: [`Windows network browse: ${hostname || row.Name}`],
            openPorts: [],
            serviceTypes: ['SMB browse'],
        };
    }).filter(device => device.hostname && isDiscoverableIpv4(device.ipAddress) && isIpInLocalSubnets(device.ipAddress, localInterfaces));
}

function parseSsdpHeaders(message) {
    const lines = String(message).split(/\r?\n/);
    const headers = {};
    for (const line of lines) {
        const index = line.indexOf(':');
        if (index === -1) continue;
        headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
    }
    return headers;
}

async function collectSsdp(nowIso) {
    return await new Promise(resolvePromise => {
        const socket = createSocket('udp4');
        const devices = new Map();
        const message = Buffer.from([
            'M-SEARCH * HTTP/1.1',
            'HOST: 239.255.255.250:1900',
            'MAN: "ssdp:discover"',
            'MX: 1',
            'ST: ssdp:all',
            '',
            '',
        ].join('\r\n'));

        const done = () => {
            try { socket.close(); } catch { /* ignore */ }
            resolvePromise([...devices.values()]);
        };

        socket.on('message', (buffer, remote) => {
            const headers = parseSsdpHeaders(buffer.toString('utf8'));
            const ip = remote.address;
            if (!isDiscoverableIpv4(ip)) return;
            const server = headers.server || headers.usn || headers.st || 'SSDP device';
            devices.set(ip, {
                id: `ssdp-${ip}`,
                name: headers.server || headers.st || ip,
                hostname: null,
                type: 'Unknown',
                ipAddress: ip,
                status: 'healthy',
                branch: osHostname(),
                uptime: '-',
                lastCheck: nowIso,
                sources: ['ssdp-upnp'],
                evidence: [server, headers.location ? `Location: ${headers.location}` : ''].filter(Boolean),
                openPorts: [],
                serviceTypes: [headers.st || 'SSDP'].filter(Boolean),
                ssdpLocation: headers.location || null,
            });
        });

        socket.on('error', done);
        socket.bind(() => {
            try {
                socket.setBroadcast(true);
                socket.send(message, 1900, '239.255.255.250');
            } catch {
                done();
            }
        });
        setTimeout(done, 1800);
    });
}

function firstXmlTag(text, tagName) {
    const match = String(text).match(new RegExp(`<(?:[a-z0-9]+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[a-z0-9]+:)?${tagName}>`, 'i'));
    return match?.[1]?.replace(/\s+/g, ' ').trim() || null;
}

async function collectWsDiscovery(nowIso) {
    return await new Promise(resolvePromise => {
        const socket = createSocket('udp4');
        const devices = new Map();
        const messageId = `urn:uuid:${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const message = Buffer.from([
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery">',
            '<e:Header>',
            `<a:MessageID>${messageId}</a:MessageID>`,
            '<a:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</a:To>',
            '<a:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</a:Action>',
            '</e:Header>',
            '<e:Body><d:Probe /></e:Body>',
            '</e:Envelope>',
        ].join(''));

        const done = () => {
            try { socket.close(); } catch { /* ignore */ }
            resolvePromise([...devices.values()]);
        };

        socket.on('message', (buffer, remote) => {
            const ip = remote.address;
            if (!isDiscoverableIpv4(ip)) return;
            const text = buffer.toString('utf8');
            const endpoint = firstXmlTag(text, 'Address');
            const xaddrs = firstXmlTag(text, 'XAddrs');
            const scopes = firstXmlTag(text, 'Scopes');
            const types = firstXmlTag(text, 'Types');
            const nameFromScope = scopes?.split(/\s+/).find(item => /name=|friendly|hostname/i.test(item));
            let name = nameFromScope ? (nameFromScope.split('/').pop() || nameFromScope) : endpoint || xaddrs || ip;
            try {
                name = decodeURIComponent(name);
            } catch { /* keep raw WS-Discovery scope */ }
            devices.set(ip, {
                id: `wsd-${ip}`,
                name,
                hostname: null,
                type: /onvif|NetworkVideoTransmitter|camera/i.test(`${types || ''} ${scopes || ''}`) ? 'Camera' : 'Unknown',
                ipAddress: ip,
                status: 'healthy',
                branch: osHostname(),
                uptime: '-',
                lastCheck: nowIso,
                sources: ['ws-discovery'],
                evidence: [
                    types ? `WS-Discovery types: ${types}` : 'WS-Discovery response',
                    xaddrs ? `XAddrs: ${xaddrs}` : '',
                    scopes ? `Scopes: ${scopes}` : '',
                ].filter(Boolean),
                openPorts: [],
                serviceTypes: ['WS-Discovery', ...(types ? types.split(/\s+/).slice(0, 4) : [])],
            });
        });

        socket.on('error', done);
        socket.bind(() => {
            try {
                socket.setBroadcast(true);
                socket.send(message, 3702, '239.255.255.250');
            } catch {
                done();
            }
        });
        setTimeout(done, 1800);
    });
}

function encodeDnsName(name) {
    const parts = String(name).split('.').filter(Boolean).flatMap(label => {
        const data = Buffer.from(label, 'utf8');
        return [Buffer.from([data.length]), data];
    });
    return Buffer.concat([...parts, Buffer.from([0])]);
}

function readDnsName(buffer, offset, depth = 0) {
    if (depth > 8 || offset >= buffer.length) return { name: '', offset };
    const labels = [];
    let cursor = offset;
    let nextOffset = offset;
    let jumped = false;

    while (cursor < buffer.length) {
        const length = buffer[cursor];
        if (length === 0) {
            if (!jumped) nextOffset = cursor + 1;
            break;
        }
        if ((length & 0xc0) === 0xc0) {
            const pointer = ((length & 0x3f) << 8) | buffer[cursor + 1];
            const parsed = readDnsName(buffer, pointer, depth + 1);
            if (parsed.name) labels.push(parsed.name);
            if (!jumped) nextOffset = cursor + 2;
            jumped = true;
            break;
        }
        cursor += 1;
        labels.push(buffer.slice(cursor, cursor + length).toString('utf8'));
        cursor += length;
        if (!jumped) nextOffset = cursor;
    }

    return { name: labels.filter(Boolean).join('.'), offset: nextOffset };
}

function parseMdnsRecords(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return [];
    const questionCount = buffer.readUInt16BE(4);
    const answerCount = buffer.readUInt16BE(6);
    const authorityCount = buffer.readUInt16BE(8);
    const additionalCount = buffer.readUInt16BE(10);
    let offset = 12;

    for (let index = 0; index < questionCount && offset < buffer.length; index += 1) {
        const parsed = readDnsName(buffer, offset);
        offset = parsed.offset + 4;
    }

    const records = [];
    const recordCount = answerCount + authorityCount + additionalCount;
    for (let index = 0; index < recordCount && offset + 10 <= buffer.length; index += 1) {
        const parsed = readDnsName(buffer, offset);
        offset = parsed.offset;
        if (offset + 10 > buffer.length) break;
        const type = buffer.readUInt16BE(offset);
        const klass = buffer.readUInt16BE(offset + 2);
        const ttl = buffer.readUInt32BE(offset + 4);
        const dataLength = buffer.readUInt16BE(offset + 8);
        const dataOffset = offset + 10;
        offset = dataOffset + dataLength;
        if (offset > buffer.length) break;

        if (type === 1 && dataLength === 4) {
            records.push({
                type,
                klass,
                ttl,
                name: parsed.name,
                value: Array.from(buffer.slice(dataOffset, dataOffset + 4)).join('.'),
            });
        } else if (type === 12) {
            records.push({
                type,
                klass,
                ttl,
                name: parsed.name,
                value: readDnsName(buffer, dataOffset).name,
            });
        } else if (type === 33 && dataLength >= 6) {
            records.push({
                type,
                klass,
                ttl,
                name: parsed.name,
                value: readDnsName(buffer, dataOffset + 6).name,
            });
        } else if (type === 16) {
            const chunks = [];
            let cursor = dataOffset;
            while (cursor < dataOffset + dataLength) {
                const length = buffer[cursor];
                cursor += 1;
                chunks.push(buffer.slice(cursor, cursor + length).toString('utf8'));
                cursor += length;
            }
            records.push({ type, klass, ttl, name: parsed.name, value: chunks.filter(Boolean).join('; ') });
        }
    }

    return records;
}

async function collectMdns(nowIso) {
    return await new Promise(resolvePromise => {
        const socket = createSocket('udp4');
        const devices = new Map();
        const header = Buffer.alloc(12);
        header.writeUInt16BE(1, 4);
        const question = Buffer.concat([
            encodeDnsName('_services._dns-sd._udp.local'),
            Buffer.from([0x00, 0x0c, 0x80, 0x01]),
        ]);
        const message = Buffer.concat([header, question]);

        const done = () => {
            try { socket.close(); } catch { /* ignore */ }
            resolvePromise([...devices.values()]);
        };

        socket.on('message', (buffer, remote) => {
            const ip = remote.address;
            if (!isDiscoverableIpv4(ip)) return;
            const records = parseMdnsRecords(buffer);
            if (records.length === 0) return;
            const names = records
                .filter(record => [12, 33].includes(record.type))
                .map(record => record.value)
                .filter(Boolean);
            const serviceTypes = [...new Set(records
                .map(record => record.name || record.value)
                .filter(value => value && value.includes('._')))]
                .slice(0, 8);
            const evidence = records
                .map(record => {
                    const label = record.type === 12 ? 'PTR' : record.type === 33 ? 'SRV' : record.type === 16 ? 'TXT' : record.type === 1 ? 'A' : `TYPE${record.type}`;
                    return `mDNS ${label}: ${record.name}${record.value ? ` -> ${record.value}` : ''}`;
                })
                .slice(0, 8);

            devices.set(ip, {
                id: `mdns-${ip}`,
                name: names[0] || ip,
                hostname: names.find(name => name.endsWith('.local')) || null,
                type: 'Unknown',
                ipAddress: ip,
                status: 'healthy',
                branch: osHostname(),
                uptime: '-',
                lastCheck: nowIso,
                sources: ['mdns-bonjour'],
                evidence,
                openPorts: [],
                serviceTypes: serviceTypes.length ? serviceTypes : ['mDNS'],
            });
        });

        socket.on('error', done);
        socket.bind(() => {
            try {
                socket.setMulticastTTL(2);
                socket.send(message, 5353, '224.0.0.251');
            } catch {
                done();
            }
        });
        setTimeout(done, 1800);
    });
}

async function probeTcpPort(ip, port) {
    return await new Promise(resolvePromise => {
        const socket = new Socket();
        let settled = false;
        const done = result => {
            if (settled) return;
            settled = true;
            try { socket.destroy(); } catch { /* ignore */ }
            resolvePromise(result);
        };
        socket.setTimeout(DISCOVERY_PORT_TIMEOUT_MS);
        socket.once('connect', () => done({ port, service: portServiceName(port) }));
        socket.once('timeout', () => done(null));
        socket.once('error', () => done(null));
        socket.connect(port, ip);
    });
}

async function fetchHttpTitle(ip, port, secure = false) {
    const protocol = secure ? 'https' : 'http';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1400);
    try {
        const response = await fetch(`${protocol}://${ip}:${port}/`, { signal: controller.signal, redirect: 'manual' });
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && response.status >= 400) return null;
        const text = await response.text();
        const title = text.match(/<title[^>]*>([^<]{1,120})<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim();
        const server = response.headers.get('server');
        return { title: title || null, server: server || null, status: response.status };
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

async function readTlsCertificate(ip, port) {
    return await new Promise(resolvePromise => {
        const socket = tlsConnect({
            host: ip,
            port,
            servername: ip,
            rejectUnauthorized: false,
            timeout: 1200,
        }, () => {
            const cert = socket.getPeerCertificate();
            const summary = cert && Object.keys(cert).length > 0
                ? {
                    subject: cert.subject?.CN || null,
                    issuer: cert.issuer?.CN || null,
                    validTo: cert.valid_to || null,
                }
                : null;
            socket.end();
            resolvePromise(summary);
        });
        socket.once('timeout', () => {
            socket.destroy();
            resolvePromise(null);
        });
        socket.once('error', () => resolvePromise(null));
    });
}

async function collectPortFingerprints(nowIso, devices) {
    const ips = [...new Set(devices.map(device => device.ipAddress).filter(isDiscoverableIpv4))].slice(0, DISCOVERY_HOST_LIMIT);
    const rows = await mapLimit(ips, 20, async ip => {
        const openPorts = (await Promise.all(DISCOVERY_PORTS.map(port => probeTcpPort(ip, port)))).filter(Boolean);
        if (openPorts.length === 0) return null;

        const httpPorts = openPorts.filter(item => [80, 5000, 8000, 8080].includes(item.port));
        const httpsPorts = openPorts.filter(item => [443, 5001, 8443].includes(item.port));
        const httpResults = [];
        for (const item of httpPorts.slice(0, 2)) {
            const result = await fetchHttpTitle(ip, item.port, false);
            if (result) httpResults.push({ port: item.port, ...result });
        }
        for (const item of httpsPorts.slice(0, 2)) {
            const result = await fetchHttpTitle(ip, item.port, true);
            if (result) httpResults.push({ port: item.port, ...result });
        }
        const tlsCert = httpsPorts.length > 0 ? await readTlsCertificate(ip, httpsPorts[0].port) : null;
        const httpTitle = httpResults.find(result => result.title)?.title || null;
        const httpServer = httpResults.find(result => result.server)?.server || null;

        return {
            id: `ports-${ip}`,
            name: httpTitle || ip,
            hostname: null,
            type: 'Unknown',
            ipAddress: ip,
            status: 'healthy',
            branch: osHostname(),
            uptime: '-',
            lastCheck: nowIso,
            sources: ['tcp-port-probe'],
            evidence: [
                `Open ports: ${openPorts.map(item => `${item.port}/${item.service}`).join(', ')}`,
                httpTitle ? `HTTP title: ${httpTitle}` : '',
                httpServer ? `HTTP server: ${httpServer}` : '',
                tlsCert?.subject ? `TLS CN: ${tlsCert.subject}` : '',
            ].filter(Boolean),
            openPorts,
            serviceTypes: openPorts.map(item => item.service),
            httpTitle,
            httpServer,
            tlsCertificate: tlsCert,
        };
    });
    return rows.filter(Boolean);
}

function ensureMonitoringDataDir() {
    const dir = `${ROOT_DIR}/data/monitoring`;
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

function normalizeHostIpAddress(value) {
    const text = String(value || '').trim().toLowerCase();
    return text && ipToInt(text) !== null ? text : null;
}

function normalizeHostMacAddress(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const hex = raw.replace(/[^0-9a-f]/gi, '').toUpperCase();
    if (hex.length !== 12) return null;
    return hex.match(/.{1,2}/g).join(':');
}

function getHostLabelKey(input) {
    const macAddress = normalizeHostMacAddress(input?.macAddress);
    const ipAddress = normalizeHostIpAddress(input?.ipAddress);
    if (macAddress) return `mac:${macAddress}`;
    if (ipAddress) return `ip:${ipAddress}`;
    return null;
}

function normalizeHostLabelInput(input, user = null) {
    const key = getHostLabelKey(input);
    if (!key) return { error: 'valid ipAddress or macAddress is required' };

    const displayName = String(input?.displayName || '').trim();
    const alias = String(input?.alias || '').trim();
    if (!displayName && !alias) return { error: 'displayName or alias is required' };

    const ipAddress = normalizeHostIpAddress(input?.ipAddress);
    const macAddress = normalizeHostMacAddress(input?.macAddress);
    const updatedAt = new Date().toISOString();
    return {
        label: {
            key,
            ipAddress,
            macAddress,
            displayName: displayName || alias,
            alias: alias || displayName,
            updatedAt,
            updatedBy: user?.email || user?.name || user?.sub || 'authenticated-user',
            source: String(input?.source || 'manual').trim() || 'manual',
        },
    };
}

function loadHostLabels() {
    if (!existsSync(HOST_LABELS_FILE)) return { version: 1, updatedAt: null, labels: {} };
    try {
        const payload = JSON.parse(readFileSync(HOST_LABELS_FILE, 'utf8'));
        const labels = payload?.labels && typeof payload.labels === 'object' ? payload.labels : {};
        return { version: 1, updatedAt: payload?.updatedAt || null, labels };
    } catch {
        return { version: 1, updatedAt: null, labels: {} };
    }
}

function saveHostLabels(labels) {
    ensureMonitoringDataDir();
    const payload = {
        version: 1,
        updatedAt: new Date().toISOString(),
        labels: labels && typeof labels === 'object' ? labels : {},
    };
    writeFileSync(HOST_LABELS_FILE, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
}

function getHostLabelsMap(hostLabelStore) {
    if (hostLabelStore?.labels && typeof hostLabelStore.labels === 'object') return hostLabelStore.labels;
    return hostLabelStore && typeof hostLabelStore === 'object' ? hostLabelStore : {};
}

function getHostLabelForItem(hostLabelStore, item) {
    const labels = getHostLabelsMap(hostLabelStore);
    const keys = [
        getHostLabelKey({ macAddress: item?.macAddress }),
        getHostLabelKey({ ipAddress: item?.ipAddress || item?.remoteAddress }),
    ].filter(Boolean);
    return keys.map(key => labels[key]).find(label => label && typeof label === 'object') || null;
}

function getDisplayNameFallback(item) {
    return item?.displayName || item?.hostname || item?.name || item?.ipAddress || item?.remoteAddress || item?.macAddress || item?.id || 'Unknown device';
}

function applyHostLabels(items, hostLabelStore) {
    return asArray(items).map(item => {
        if (!item || typeof item !== 'object') return item;
        const label = getHostLabelForItem(hostLabelStore, item);
        const manualAlias = label ? String(label.displayName || label.alias || '').trim() || null : null;
        return {
            ...item,
            displayName: manualAlias || getDisplayNameFallback(item),
            manualAlias,
        };
    });
}

function summarizeTcpConnections(networkUsage, devices = []) {
    const activeConnections = asArray(networkUsage?.activeConnections);
    const deviceConnections = asArray(networkUsage?.deviceConnections);
    const summary = networkUsage?.summary || {};
    const devicesByIp = new Map(asArray(devices).filter(item => item?.ipAddress).map(item => [item.ipAddress, item]));
    const deviceConnectionsByIp = new Map(deviceConnections.filter(item => item?.ipAddress).map(item => [item.ipAddress, item]));
    const groups = new Map();
    const byState = {};
    const remotePortCounts = new Map();

    const getGroup = ipAddress => {
        const device = devicesByIp.get(ipAddress) || deviceConnectionsByIp.get(ipAddress) || {};
        const group = groups.get(ipAddress) || {
            remoteAddress: ipAddress,
            displayName: getDisplayNameFallback({ ...device, ipAddress }),
            manualAlias: device.manualAlias || null,
            connectionCount: 0,
            establishedTcp: 0,
            localLanTcp: 0,
            states: {},
            ports: new Map(),
        };
        groups.set(ipAddress, group);
        return group;
    };

    for (const connection of activeConnections) {
        const remoteAddress = connection?.remoteAddress || connection?.ipAddress;
        if (!remoteAddress) continue;
        const state = connection.state || 'Unknown';
        const remotePort = Number(connection.remotePort || 0);
        const service = connection.service || portServiceName(remotePort);
        const portKey = `${remotePort}/${service}`;
        const group = getGroup(remoteAddress);

        group.connectionCount += 1;
        if (String(state).toLowerCase() === 'established') group.establishedTcp += 1;
        if (connection.isLocalLan) group.localLanTcp += 1;
        group.states[state] = (group.states[state] || 0) + 1;
        byState[state] = (byState[state] || 0) + 1;
        group.ports.set(portKey, {
            port: remotePort,
            service,
            count: (group.ports.get(portKey)?.count || 0) + 1,
        });
        remotePortCounts.set(portKey, {
            port: remotePort,
            service,
            count: (remotePortCounts.get(portKey)?.count || 0) + 1,
        });
    }

    for (const deviceConnection of deviceConnections) {
        if (!deviceConnection?.ipAddress || groups.has(deviceConnection.ipAddress)) continue;
        const group = getGroup(deviceConnection.ipAddress);
        group.connectionCount = Number(deviceConnection.activeTcp || 0);
        group.establishedTcp = Number(deviceConnection.establishedTcp || 0);
        group.states = { ...(deviceConnection.states || {}) };
        for (const portText of asArray(deviceConnection.ports)) {
            const [portValue, service = portServiceName(Number(portValue || 0))] = String(portText).split('/');
            const port = Number(portValue || 0);
            const portKey = `${port}/${service}`;
            group.ports.set(portKey, { port, service, count: 1 });
        }
    }

    const topRemoteGroups = [...groups.values()]
        .map(group => ({
            ...group,
            ports: [...group.ports.values()].sort((a, b) => b.count - a.count).slice(0, 8),
        }))
        .sort((a, b) => b.connectionCount - a.connectionCount)
        .slice(0, 10);

    const narratives = topRemoteGroups.slice(0, 5).map(group => {
        const port = group.ports[0];
        const countLabel = `${group.connectionCount} active TCP connection${group.connectionCount === 1 ? '' : 's'}`;
        const portLabel = port?.port ? ` to port ${port.port} (${port.service})` : '';
        const lanLabel = group.localLanTcp > 0 ? ' on local LAN' : '';
        return `${group.displayName} has ${countLabel}${portLabel}${lanLabel}.`;
    });

    return {
        total: summary.activeTcp ?? activeConnections.length,
        established: summary.establishedTcp ?? activeConnections.filter(item => String(item?.state).toLowerCase() === 'established').length,
        localLan: summary.localLanTcp ?? activeConnections.filter(item => item?.isLocalLan).length,
        listening: summary.listeningTcp ?? activeConnections.filter(item => String(item?.state).toLowerCase() === 'listen').length,
        topRemoteGroups,
        topRemotePorts: [...remotePortCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10),
        byState,
        narratives,
    };
}

function detectDownDevices(devices, nowIso = new Date().toISOString()) {
    const nowMs = Date.parse(nowIso);
    const suddenWindowMs = 24 * 60 * 60 * 1000;
    const downDevices = asArray(devices)
        .filter(device => device && (device.status === 'offline' || device.inventoryStale === true) && device.lastSeen)
        .map(device => {
            const offline = device.status === 'offline';
            const stale = device.inventoryStale === true;
            return {
                id: device.id || device.ipAddress || device.macAddress || device.name,
                ipAddress: device.ipAddress || null,
                macAddress: device.macAddress || null,
                displayName: getDisplayNameFallback(device),
                manualAlias: device.manualAlias || null,
                lastSeen: device.lastSeen,
                lastCheck: device.lastCheck || null,
                status: device.status || null,
                inventoryStale: stale,
                downReason: offline && stale
                    ? 'Possibly down: offline and stale from previous discovery cache'
                    : offline
                        ? 'Possibly offline in latest discovery data'
                        : 'Possibly down: stale inventory entry from previous discovery cache',
            };
        })
        .sort((a, b) => (Date.parse(b.lastSeen) || 0) - (Date.parse(a.lastSeen) || 0));

    const suddenlyDown = downDevices.filter(device => {
        const lastSeenMs = Date.parse(device.lastSeen);
        return Number.isFinite(nowMs) && Number.isFinite(lastSeenMs) && nowMs - lastSeenMs <= suddenWindowMs;
    });

    return { downDevices, suddenlyDown };
}

function getDiscoveryTimestampMs(discovery, savedAt = null) {
    const value = discovery?.completedAt || discovery?.startedAt || savedAt;
    const timestamp = value ? Date.parse(value) : NaN;
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeLanDiscoveryCache(value) {
    const discovery = value?.discovery || value;
    if (!discovery || !Array.isArray(discovery.devices)) return null;
    return {
        ...discovery,
        methods: Array.isArray(discovery.methods) ? discovery.methods : [],
        methodCounts: discovery.methodCounts && typeof discovery.methodCounts === 'object' ? discovery.methodCounts : {},
        devices: discovery.devices,
        targetLimit: discovery.targetLimit ?? DISCOVERY_HOST_LIMIT,
        allowPublicRanges: discovery.allowPublicRanges ?? DISCOVERY_ALLOW_PUBLIC,
    };
}

function loadLanDiscoveryCacheFromDisk() {
    if (lanDiscoveryCache) return lanDiscoveryCache;
    if (!existsSync(DISCOVERY_CACHE_FILE)) return null;

    try {
        const payload = JSON.parse(readFileSync(DISCOVERY_CACHE_FILE, 'utf8'));
        const discovery = normalizeLanDiscoveryCache(payload);
        if (!discovery) return null;
        lanDiscoveryCache = discovery;
        lanDiscoveryAt = getDiscoveryTimestampMs(discovery, payload.savedAt) || Date.now();
        return lanDiscoveryCache;
    } catch (error) {
        lanDiscoveryLastError = `Failed to load discovery cache: ${error.message}`;
        return null;
    }
}

function persistLanDiscoveryCache(discovery) {
    try {
        ensureMonitoringDataDir();
        writeFileSync(DISCOVERY_CACHE_FILE, JSON.stringify({
            version: 1,
            savedAt: new Date().toISOString(),
            discovery,
        }, null, 2), 'utf8');
    } catch (error) {
        lanDiscoveryLastError = `Failed to persist discovery cache: ${error.message}`;
    }
}

function buildEmptyLanDiscovery(nowIso) {
    return {
        startedAt: null,
        completedAt: null,
        durationMs: 0,
        methods: [],
        methodCounts: {},
        subnetCount: 0,
        targetCount: 0,
        targetLimit: DISCOVERY_HOST_LIMIT,
        allowPublicRanges: DISCOVERY_ALLOW_PUBLIC,
        devices: [],
        generatedAt: nowIso,
    };
}

function decorateLanDiscovery(discovery, source) {
    const completedAtMs = getDiscoveryTimestampMs(discovery);
    const cacheAgeMs = completedAtMs ? Date.now() - completedAtMs : null;
    const stale = cacheAgeMs === null || cacheAgeMs >= DISCOVERY_REFRESH_INTERVAL_MS;
    return {
        ...discovery,
        cached: source !== 'live',
        cacheSource: source,
        cachePath: 'data/monitoring/network-discovery-cache.json',
        cacheAgeMs,
        refreshIntervalMs: DISCOVERY_REFRESH_INTERVAL_MS,
        stale,
        refreshing: Boolean(lanDiscoveryInFlight),
        lastRefreshReason: lanDiscoveryLastRefreshReason,
        lastError: lanDiscoveryLastError,
    };
}

function sortDevicesByAddress(devices) {
    return devices.sort((a, b) => {
        const ai = ipToInt(a.ipAddress);
        const bi = ipToInt(b.ipAddress);
        if (ai !== null && bi !== null) return ai - bi;
        return String(a.name).localeCompare(String(b.name));
    });
}

function countDeviceSources(devices) {
    return devices.reduce((acc, device) => {
        for (const source of device.sources || []) {
            acc[source] = (acc[source] || 0) + 1;
        }
        return acc;
    }, {});
}

function normalizeDeviceId(device) {
    return `lan-${String(device.ipAddress || device.macAddress || device.name).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
}

function mergeDiscoveryWithPrevious(fresh, previous) {
    if (!previous?.devices?.length) return fresh;

    const freshByKey = new Map();
    for (const device of fresh.devices || []) {
        freshByKey.set(buildDeviceKey(device), device);
    }

    const map = new Map();
    for (const device of previous.devices || []) {
        mergeDevice(map, buildDeviceKey(device), device);
    }
    for (const device of fresh.devices || []) {
        mergeDevice(map, buildDeviceKey(device), device);
    }

    const devices = sortDevicesByAddress([...map.values()].map(device => {
        const key = buildDeviceKey(device);
        const freshDevice = freshByKey.get(key);
        const stale = !freshDevice;
        return {
            ...device,
            id: normalizeDeviceId(device),
            type: inferDeviceType(device),
            status: stale ? 'offline' : (freshDevice.status || device.status || 'healthy'),
            inventoryStale: stale,
            lastSeen: stale ? (device.lastCheck || previous.completedAt || null) : fresh.completedAt,
            lastCheck: stale ? (device.lastCheck || previous.completedAt || fresh.completedAt) : fresh.completedAt,
            sources: stale
                ? [...new Set([...(device.sources || []), 'static-cache-previous'])]
                : (device.sources || []),
            evidence: stale
                ? [...new Set([...(device.evidence || []), `Last seen in previous cache: ${device.lastCheck || previous.completedAt || '-'}`])].slice(0, 12)
                : (device.evidence || []),
        };
    }));

    return {
        ...fresh,
        devices,
        methodCounts: countDeviceSources(devices),
        previousCacheMergedAt: new Date().toISOString(),
        previousDeviceCount: previous.devices.length,
        staleDeviceCount: devices.filter(device => device.inventoryStale).length,
    };
}

function isLanDiscoveryStale() {
    const cached = loadLanDiscoveryCacheFromDisk();
    if (!cached || !lanDiscoveryAt) return true;
    return Date.now() - lanDiscoveryAt >= DISCOVERY_REFRESH_INTERVAL_MS;
}

async function runLanDiscoveryScan(nowIso) {
    const startedAt = Date.now();
    const localInterfaces = getLocalIpv4Interfaces(nowIso);
    const targetCount = [...new Set(localInterfaces.flatMap(device => getSubnetTargets(device.ipAddress, device.cidr)))].length;
    const [interfaceDetails, gatewayDevices, arpDevicesBeforeSweep, dnsCacheDevices, netbiosCacheDevices, windowsNetworkDevices, activeConnectionDevices] = await Promise.all([
        withTimeout(collectWindowsInterfaceDetails(nowIso), 6500, []),
        withTimeout(collectDefaultGateways(nowIso), 4500, []),
        withTimeout(collectArpNeighbors(nowIso), 6500, []),
        withTimeout(collectDnsClientCache(nowIso, localInterfaces), 4500, []),
        withTimeout(collectNetbiosCache(nowIso, localInterfaces), 3500, []),
        withTimeout(collectWindowsNetworkBrowse(nowIso, localInterfaces), 7000, []),
        withTimeout(collectActiveConnections(nowIso, localInterfaces), 4500, []),
    ]);
    const pingDevices = await withTimeout(collectPingSweep(nowIso, localInterfaces), 18000, []);
    const arpDevicesAfterSweep = await withTimeout(collectArpNeighbors(nowIso), 6500, []);
    const seedDevices = [
        ...localInterfaces,
        ...interfaceDetails,
        ...gatewayDevices,
        ...arpDevicesBeforeSweep,
        ...dnsCacheDevices,
        ...netbiosCacheDevices,
        ...windowsNetworkDevices,
        ...activeConnectionDevices,
        ...pingDevices,
        ...arpDevicesAfterSweep,
    ];
    const [dnsDevices, pingNameDevices, netbiosDevices, ssdpDevices, wsDiscoveryDevices, mdnsDevices, portDevices] = await Promise.all([
        withTimeout(collectReverseDns(nowIso, seedDevices), 7000, []),
        withTimeout(collectPingResolvedNames(nowIso, seedDevices), 14000, []),
        withTimeout(collectNetbios(nowIso, seedDevices), 18000, []),
        withTimeout(collectSsdp(nowIso), 3000, []),
        withTimeout(collectWsDiscovery(nowIso), 3000, []),
        withTimeout(collectMdns(nowIso), 3000, []),
        withTimeout(collectPortFingerprints(nowIso, seedDevices), 25000, []),
    ]);

    const map = new Map();
    for (const device of [...seedDevices, ...dnsDevices, ...pingNameDevices, ...netbiosDevices, ...ssdpDevices, ...wsDiscoveryDevices, ...mdnsDevices, ...portDevices]) {
        mergeDevice(map, buildDeviceKey(device), device);
    }

    const devices = sortDevicesByAddress([...map.values()].map(device => ({
        ...device,
        id: normalizeDeviceId(device),
        type: inferDeviceType(device),
        status: device.status || 'healthy',
        vendor: device.vendor || guessVendorFromMac(device.macAddress),
        lastCheck: nowIso,
        inventoryStale: false,
        lastSeen: nowIso,
    })));
    const methodCounts = countDeviceSources(devices);

    return {
        startedAt: new Date(startedAt).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        methods: [
            'os-interface',
            'windows-netipconfiguration',
            'default-route',
            'arp-neighbor',
            'ping-sweep',
            'dns-client-cache',
            'netbios-cache',
            'windows-network-browse',
            'active-tcp-connection',
            'reverse-dns',
            'ping-reverse-name',
            'netbios',
            'ssdp-upnp',
            'ws-discovery',
            'mdns-bonjour',
            'tcp-port-probe',
            'http-title',
            'tls-certificate',
        ],
        methodCounts,
        subnetCount: localInterfaces.length,
        targetCount,
        targetLimit: DISCOVERY_HOST_LIMIT,
        allowPublicRanges: DISCOVERY_ALLOW_PUBLIC,
        devices,
    };
}

function scheduleLanDiscoveryRefresh(reason = 'interval') {
    if (lanDiscoveryInFlight) return lanDiscoveryInFlight;

    lanDiscoveryLastRefreshReason = reason;
    lanDiscoveryLastError = null;
    const nowIso = new Date().toISOString();
    lanDiscoveryInFlight = runLanDiscoveryScan(nowIso)
        .then(result => {
            const previous = loadLanDiscoveryCacheFromDisk();
            const merged = mergeDiscoveryWithPrevious(result, previous);
            lanDiscoveryCache = merged;
            lanDiscoveryAt = Date.now();
            persistLanDiscoveryCache(merged);
            monitoringSnapshotCache = null;
            return merged;
        })
        .catch(error => {
            lanDiscoveryLastError = error instanceof Error ? error.message : 'Discovery refresh failed';
            console.warn(`LAN discovery refresh failed: ${lanDiscoveryLastError}`);
            return loadLanDiscoveryCacheFromDisk() || buildEmptyLanDiscovery(nowIso);
        })
        .finally(() => {
            lanDiscoveryInFlight = null;
        });

    return lanDiscoveryInFlight;
}

async function discoverLanDevices(nowIso, options = {}) {
    const cached = loadLanDiscoveryCacheFromDisk();

    if (options.waitForFresh) {
        const live = await scheduleLanDiscoveryRefresh(options.force ? 'manual-wait' : 'wait');
        return decorateLanDiscovery(live, 'live');
    }

    if (options.force || !cached || isLanDiscoveryStale()) {
        scheduleLanDiscoveryRefresh(options.force ? 'manual' : (cached ? 'interval' : 'bootstrap'));
    }

    const latest = loadLanDiscoveryCacheFromDisk() || cached || buildEmptyLanDiscovery(nowIso);
    const source = latest.devices.length > 0 ? 'static-cache' : 'empty';
    return decorateLanDiscovery(latest, source);
}

function startLanDiscoveryScheduler() {
    loadLanDiscoveryCacheFromDisk();
    if (DISCOVERY_AUTO_REFRESH && isLanDiscoveryStale()) {
        scheduleLanDiscoveryRefresh(lanDiscoveryCache ? 'startup-stale' : 'startup-bootstrap');
    }

    if (!DISCOVERY_AUTO_REFRESH) return;
    setInterval(() => {
        if (isLanDiscoveryStale()) {
            scheduleLanDiscoveryRefresh('interval');
        }
    }, Math.max(5000, DISCOVERY_SCHEDULER_TICK_MS));
}

function buildMonitoringAlerts(server, devices, nowIso) {
    const alerts = [];
    const thresholds = [
        ['cpuUsage', 'CPU usage', server.cpuUsage, 80, 95],
        ['ramUsage', 'RAM usage', server.ramUsage, 85, 95],
        ['diskUsage', 'Disk usage', server.diskUsage, 90, 95],
    ];

    thresholds.forEach(([key, label, value, warningLimit, criticalLimit]) => {
        if (value >= criticalLimit) {
            alerts.push({
                id: `alert-${key}-critical`,
                severity: 'Critical',
                source: server.name,
                message: `${label} is ${value}% on ${server.name}`,
                timestamp: nowIso,
                acknowledged: false,
            });
        } else if (value >= warningLimit) {
            alerts.push({
                id: `alert-${key}-warning`,
                severity: 'Warning',
                source: server.name,
                message: `${label} is ${value}% on ${server.name}`,
                timestamp: nowIso,
                acknowledged: false,
            });
        }
    });

    if (devices.length === 0) {
        alerts.push({
            id: 'alert-network-interface-none',
            severity: 'Major',
            source: server.name,
            message: `No active network interfaces were reported by ${server.name}`,
            timestamp: nowIso,
            acknowledged: false,
        });
    }

    return alerts;
}

function buildMonitoringIncidents(alerts, nowIso) {
    return alerts
        .filter(alert => alert.severity === 'Critical' || alert.severity === 'Emergency' || alert.severity === 'Major')
        .map((alert, index) => ({
            id: `inc-${index + 1}-${alert.id.replace(/^alert-/, '')}`,
            title: alert.message,
            severity: alert.severity,
            status: 'Open',
            relatedAsset: alert.source,
            startedAt: nowIso,
            assignedTo: 'Infrastructure',
        }));
}

function attachUsageToDevices(devices, usage, latency) {
    const connectionByIp = new Map((usage?.deviceConnections || []).map(item => [item.ipAddress, item]));
    const latencyByIp = new Map((latency?.samples || []).map(item => [item.ipAddress, item]));
    return devices.map(device => {
        const connection = connectionByIp.get(device.ipAddress);
        const latencySample = latencyByIp.get(device.ipAddress);
        if (!connection && !latencySample) return device;
        const evidence = [
            ...(device.evidence || []),
            connection ? `Active TCP connections: ${connection.activeTcp}` : '',
            connection?.ports?.length ? `Connection ports: ${connection.ports.join(', ')}` : '',
            latencySample?.rttMs !== null && latencySample?.rttMs !== undefined ? `Ping RTT: ${latencySample.rttMs} ms` : '',
        ].filter(Boolean);
        return {
            ...device,
            activeTcpConnections: connection?.activeTcp || 0,
            establishedTcpConnections: connection?.establishedTcp || 0,
            connectionPorts: connection?.ports || [],
            connectionStates: connection?.states || {},
            owningProcesses: connection?.processes || [],
            latencyMs: latencySample?.rttMs ?? null,
            latencyStatus: latencySample?.status || null,
            reachableByPing: latencySample?.reachable ?? null,
            evidence: [...new Set(evidence)].slice(0, 12),
        };
    });
}

async function getMonitoringSnapshot(options = {}) {
    if (!options.forceDiscovery && monitoringSnapshotCache && Date.now() - monitoringSnapshotAt < 2500) {
        return monitoringSnapshotCache;
    }

    const nowIso = new Date().toISOString();
    const interfaceDevices = buildNetworkDevices(nowIso);
    const discovery = await discoverLanDevices(nowIso, {
        force: options.forceDiscovery,
        waitForFresh: options.waitDiscovery,
    });
    const hostLabels = loadHostLabels();
    const discoveredDevices = applyHostLabels(discovery.devices.length > 0 ? discovery.devices : interfaceDevices, hostLabels);
    const usage = await collectNetworkUsage(nowIso, interfaceDevices, discoveredDevices);
    const labeledDeviceConnections = applyHostLabels(usage.deviceConnections || [], hostLabels);
    const labeledActiveConnections = applyHostLabels(usage.activeConnections || [], hostLabels);
    const enrichedUsage = {
        ...usage,
        activeConnections: labeledActiveConnections,
        deviceConnections: labeledDeviceConnections,
    };
    const latency = await collectLatencyMetrics(nowIso, discoveredDevices);
    const networkDevices = attachUsageToDevices(discoveredDevices, enrichedUsage, latency);
    const tcpSummary = summarizeTcpConnections(enrichedUsage, networkDevices);
    const { downDevices, suddenlyDown } = detectDownDevices(networkDevices, nowIso);
    const networkUsage = {
        ...enrichedUsage,
        tcpSummary,
        connectionNarratives: tcpSummary.narratives,
        connectionNarrative: tcpSummary.narratives,
    };
    const cpuUsage = readCpuUsagePercent();
    const totalMemory = totalmem();
    const freeMemory = freemem();
    const ramUsage = clampPercent(((totalMemory - freeMemory) / totalMemory) * 100);
    const disk = readDiskUsage();
    const diskUsage = disk.usagePercent;
    const hostName = osHostname();
    const server = {
        id: `host-${hostName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: hostName,
        ipAddress: getPrimaryNetworkAddress(interfaceDevices),
        macAddress: interfaceDevices.find(device => device.macAddress)?.macAddress || 'unknown',
        os: `${platform()} ${release()} ${arch()}`,
        environment: getMonitoringEnvironment(),
        cpuUsage,
        ramUsage,
        diskUsage,
        status: getAssetStatus(cpuUsage, ramUsage, diskUsage),
        lastCheck: nowIso,
        branch: 'Gateway Host',
        uptime: formatDuration(uptime()),
        totalMemoryGiB: bytesToGiB(totalMemory),
        freeMemoryGiB: bytesToGiB(freeMemory),
        totalDiskGiB: disk.totalGiB,
        freeDiskGiB: disk.freeGiB,
    };
    const alerts = buildMonitoringAlerts(server, interfaceDevices, nowIso);
    const incidents = buildMonitoringIncidents(alerts, nowIso);

    monitoringCpuHistory = [
        ...monitoringCpuHistory,
        {
            time: new Date(nowIso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            value: cpuUsage,
        },
    ].slice(-20);

    monitoringSnapshotCache = {
        success: true,
        source: 'gateway-runtime',
        generatedAt: nowIso,
        host: {
            hostname: hostName,
            platform: platform(),
            release: release(),
            arch: arch(),
            uptimeSeconds: Math.round(uptime()),
        },
        servers: [server],
        interfaces: interfaceDevices,
        networkDevices,
        networkUsage,
        downDevices,
        suddenlyDown,
        networkLatency: latency,
        networkDiscovery: {
            startedAt: discovery.startedAt,
            completedAt: discovery.completedAt,
            durationMs: discovery.durationMs,
            methods: discovery.methods,
            methodCounts: discovery.methodCounts,
            subnetCount: discovery.subnetCount,
            targetCount: discovery.targetCount,
            targetLimit: discovery.targetLimit,
            allowPublicRanges: discovery.allowPublicRanges,
            cached: discovery.cached,
            cacheSource: discovery.cacheSource,
            cachePath: discovery.cachePath,
            cacheAgeMs: discovery.cacheAgeMs,
            refreshIntervalMs: discovery.refreshIntervalMs,
            stale: discovery.stale,
            refreshing: discovery.refreshing,
            lastRefreshReason: discovery.lastRefreshReason,
            lastError: discovery.lastError,
            deviceCount: discovery.devices.length,
        },
        alerts,
        incidents,
        cpuHistory: monitoringCpuHistory,
    };
    monitoringSnapshotAt = Date.now();
    return monitoringSnapshotCache;
}

function handleIFESSApi(req, reqPath) {
    // Public endpoints
    if (reqPath === '/api/ifess/health') {
        return new Response(JSON.stringify({ status: 'Healthy', serverTime: getServerTime() }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (reqPath === '/api/ifess/server-info') {
        return new Response(JSON.stringify(ifessService.getServerInfo()), { headers: { 'Content-Type': 'application/json' } });
    }

    // Frontend proxy handler (POST with {action, params} format) - bypass auth
    if (req.method === 'POST' && reqPath === '/api/ifess') {
        return handleFrontendProxy(req);
    }

    // Query Gateway routes under /api/ifess are proxied to Firebird Query Service
    if (reqPath.startsWith('/api/ifess/query-gateway')) {
        return proxyFirebirdQueryService(req, reqPath, new URL(req.url).search);
    }

    // Protected endpoints - require API key
    if (!validateApiKey(req)) {
        return new Response(JSON.stringify({ error: 'Unauthorized', message: 'Valid X-API-Key header is required.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // GET /api/ifess/clients
    if (req.method === 'GET' && (reqPath === '/api/ifess/clients' || reqPath === '/api/ifess/clients/')) {
        return new Response(JSON.stringify(ifessService.listClients()), { headers: { 'Content-Type': 'application/json' } });
    }

    // GET /api/ifess/dashboard
    if (req.method === 'GET' && reqPath === '/api/ifess/dashboard') {
        return new Response(JSON.stringify(ifessService.getDashboardSummary()), { headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/ifess/clients/register
    if (req.method === 'POST' && reqPath === '/api/ifess/clients/register') {
        return req.arrayBuffer().then(body => {
            try {
                const data = JSON.parse(new TextDecoder().decode(body));
                const result = ifessService.registerClient(data);
                return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
            } catch {
                return new Response(JSON.stringify({ error: 'Bad Request', message: 'Invalid JSON body' }), {
                    status: 400, headers: { 'Content-Type': 'application/json' }
                });
            }
        });
    }

    // POST /api/ifess/clients/:id/heartbeat
    if (req.method === 'POST' && /^\/api\/ifess\/clients\/[^/]+\/heartbeat$/.test(reqPath)) {
        const clientId = reqPath.split('/')[4];
        return req.arrayBuffer().then(body => {
            try {
                const data = JSON.parse(new TextDecoder().decode(body));
                const result = ifessService.receiveHeartbeat(clientId, data);
                return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
            } catch {
                return new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
        });
    }

    // SuperApp compat: GET /api/ifess/clients/:id/commands/pending?limit=N
    if (req.method === 'GET' && /^\/api\/ifess\/clients\/[^/]+\/commands\/pending$/.test(reqPath)) {
        const clientId = reqPath.split('/')[4];
        const commands = ifessService.pollPendingCommands(clientId);
        return new Response(JSON.stringify({ commands }), { headers: { 'Content-Type': 'application/json' } });
    }

    // SuperApp compat: GET /api/ifess/clients/:id/config
    if (req.method === 'GET' && /^\/api\/ifess\/clients\/[^/]+\/config$/.test(reqPath)) {
        const clientId = reqPath.split('/')[4];
        const config = ifessService.getClientConfig(clientId);
        return new Response(JSON.stringify(config), { status: config ? 200 : 404, headers: { 'Content-Type': 'application/json' } });
    }

    // SuperApp compat: POST /api/ifess/clients/:id/commands/:cmdId/result
    if (req.method === 'POST' && /^\/api\/ifess\/clients\/[^/]+\/commands\/[^/]+\/result$/.test(reqPath)) {
        const parts = reqPath.split('/');
        const clientId = parts[4];
        const commandId = parts[6];
        return req.arrayBuffer().then(body => {
            try {
                const data = JSON.parse(new TextDecoder().decode(body));
                const result = ifessService.reportCommandResult(clientId, commandId, data);
                return new Response(JSON.stringify(result), { status: result.success ? 200 : 404, headers: { 'Content-Type': 'application/json' } });
            } catch {
                return new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
        });
    }

    // Client Groups
    if (reqPath === '/api/ifess/client-groups') {
        if (req.method === 'GET') {
            return new Response(JSON.stringify(ifessService.listClientGroups()), { headers: { 'Content-Type': 'application/json' } });
        }
        if (req.method === 'POST') {
            return req.arrayBuffer().then(body => {
                try {
                    const data = JSON.parse(new TextDecoder().decode(body));
                    const result = ifessService.createClientGroup(data);
                    return new Response(JSON.stringify(result), { status: result.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
                } catch {
                    return new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
            });
        }
    }

    // Audit Logs
    if (reqPath === '/api/ifess/audit-logs') {
        if (req.method === 'GET') {
            return new Response(JSON.stringify(ifessService.listAuditLogs()), { headers: { 'Content-Type': 'application/json' } });
        }
    }

    // Default 404
    return new Response(JSON.stringify({ error: 'Not Found', path: reqPath }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
    });
}

// Query Gateway Data Store
const queryData = {
    templates: [],
    history: [],
    batches: {}
};

function loadQueryData() {
    try {
        const templatesPath = `${DATA_DIR}/query-templates.json`;
        const historyPath = `${DATA_DIR}/query-history.json`;
        if (existsSync(templatesPath)) queryData.templates = JSON.parse(readFileSync(templatesPath, 'utf-8'));
        if (existsSync(historyPath)) queryData.history = JSON.parse(readFileSync(historyPath, 'utf-8'));
    } catch { /* first run */ }
}

function saveQueryData() {
    try {
        mkdirSync(`${DATA_DIR}`, { recursive: true });
        writeFileSync(`${DATA_DIR}/query-templates.json`, JSON.stringify(queryData.templates));
        writeFileSync(`${DATA_DIR}/query-history.json`, JSON.stringify(queryData.history));
    } catch { /* ignore */ }
}

function handleQueryGateway(req, reqPath) {
    // Normalize path: strip /api/ifess or /api prefix
    const normalizedPath = reqPath.replace('/api/ifess', '').replace('/api', '');
    console.log(`[QueryGateway] Handling: ${req.method} ${normalizedPath}`);

    if (req.method === 'GET' && (normalizedPath === '/query-gateway/templates' || normalizedPath === '/query-gateway/templates/')) {
        return new Response(JSON.stringify(ifessService.listQueryTemplates()), { headers: { 'Content-Type': 'application/json' } });
    }

    if (req.method === 'POST' && normalizedPath === '/query-gateway/validate') {
        return req.arrayBuffer().then(body => {
            try {
                const { queryText } = JSON.parse(new TextDecoder().decode(body));
                const result = ifessService.isReadOnlySql(queryText);
                return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
            } catch {
                return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
        });
    }

    if (req.method === 'POST' && normalizedPath === '/query-gateway/dispatch') {
        return req.arrayBuffer().then(body => {
            try {
                const data = JSON.parse(new TextDecoder().decode(body));
                const result = ifessService.createQueryBatch(data);
                return new Response(JSON.stringify(result), { status: result.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
            } catch {
                return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
        });
    }

    if (req.method === 'GET' && /\/query-gateway\/batches\/[\w-]+$/.test(normalizedPath)) {
        const batchId = normalizedPath.split('/').pop();
        const batch = ifessService.getQueryBatch(batchId);
        if (!batch) return new Response(JSON.stringify({ error: 'Batch not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify(batch), { headers: { 'Content-Type': 'application/json' } });
    }

    if (req.method === 'GET' && (normalizedPath === '/query-gateway/batches' || normalizedPath === '/query-gateway/batches/')) {
        return new Response(JSON.stringify(ifessService.listQueryBatches()), { headers: { 'Content-Type': 'application/json' } });
    }

    if (req.method === 'POST' && normalizedPath === '/query-gateway/templates') {
        return req.arrayBuffer().then(body => {
            try {
                const data = JSON.parse(new TextDecoder().decode(body));
                const result = ifessService.createQueryTemplate(data);
                return new Response(JSON.stringify(result), { status: result.success ? 201 : 400, headers: { 'Content-Type': 'application/json' } });
            } catch {
                return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
        });
    }

    if (req.method === 'DELETE' && /\/query-gateway\/templates\/[\w-]+$/.test(normalizedPath)) {
        const templateCode = normalizedPath.split('/').pop();
        const result = ifessService.deleteQueryTemplate(templateCode);
        return new Response(JSON.stringify(result), { status: result.success ? 200 : 404, headers: { 'Content-Type': 'application/json' } });
    }

    // PUT /query-gateway/templates/:code — update an existing template (mirror of Next.js proxy updateTemplate)
    if (req.method === 'PUT' && /\/query-gateway\/templates\/[\w-]+$/.test(normalizedPath)) {
        const templateCode = normalizedPath.split('/').pop();
        return req.arrayBuffer().then(body => {
            try {
                const updates = JSON.parse(new TextDecoder().decode(body));
                const result = ifessService.updateQueryTemplate(templateCode, updates);
                return new Response(JSON.stringify(result), { status: result.success ? 200 : 404, headers: { 'Content-Type': 'application/json' } });
            } catch {
                return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
        });
    }

    // POST /query-gateway/jobs/:jobId/result — client reports inline query result
    if (req.method === 'POST' && /\/query-gateway\/jobs\/[^/]+\/result$/.test(normalizedPath)) {
        const jobId = normalizedPath.split('/').slice(-2, -1)[0];
        return req.arrayBuffer().then(body => {
            try {
                const data = JSON.parse(new TextDecoder().decode(body));
                data.queryJobId = jobId;
                const result = ifessService.storeQueryJobResult(data);
                return new Response(JSON.stringify(result), { status: result.success ? 200 : 404, headers: { 'Content-Type': 'application/json' } });
            } catch {
                return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
        });
    }

    // POST /query-gateway/jobs/:jobId/chunks — client reports chunked query result
    if (req.method === 'POST' && /\/query-gateway\/jobs\/[^/]+\/chunks$/.test(normalizedPath)) {
        const jobId = normalizedPath.split('/').slice(-2, -1)[0];
        return req.arrayBuffer().then(body => {
            try {
                const data = JSON.parse(new TextDecoder().decode(body));
                data.queryJobId = jobId;
                const result = ifessService.storeQueryResultChunk(data);
                return new Response(JSON.stringify(result), { status: result.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
            } catch {
                return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
        });
    }

    // GET /query-gateway/batches/:batchId/results — assembled result rows for a batch
    if (req.method === 'GET' && /\/query-gateway\/batches\/[\w-]+\/results$/.test(normalizedPath)) {
        const batchId = normalizedPath.split('/').slice(-2, -1)[0];
        const batch = ifessService.getQueryBatch(batchId);
        if (!batch) return new Response(JSON.stringify({ error: 'Batch not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify({ batchId, status: batch.status, results: batch.results || [], jobs: batch.jobs || [] }), { headers: { 'Content-Type': 'application/json' } });
    }

    // ── Firebird → SQL sync routes (normalizedPath strips /api[/ifess] → /sync/*) ──

    // GET /sync/jobs/:id — sync job status (gateway owns JSON state; used for bootstrap status)
    if (req.method === 'GET' && /^\/sync\/jobs\/[^/]+$/.test(normalizedPath)) {
        const jobId = normalizedPath.split('/').pop();
        const job = ifessService.getSyncJob(jobId);
        if (!job) return new Response(JSON.stringify({ error: 'Sync job not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify(job), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}

// Spawn FB_Migration as a node subprocess for bootstrap (one-time full historical load).
// Fire-and-forget: updates the sync job on completion. The migration writes directly to
// rebinmas_ifess_migrated; watermark is set post-success by the Next.js sync route
// (re-introspect + max(value)). Detached so a long run doesn't block the request.
function spawnFbMigration(scriptPath, args, syncJobId) {
    const __cp = require('node:child_process');
    const env = {
        ...process.env,
        // FB_Migration reads these via dotenv; ensure they're present for the subprocess.
        DB_NAME: process.env.MSSQL_MIGRATED_DB || 'rebinmas_ifess_migrated',
        DB_SERVER: process.env.MSSQL_HOST || '10.0.0.110',
        DB_PORT: process.env.MSSQL_PORT || '1433',
        DB_USER: process.env.MSSQL_USER || 'sa',
        DB_PASSWORD: process.env.MSSQL_PASSWORD || 'ptrj@123',
    };
    try {
        const child = __cp.spawn('node', [scriptPath, ...args], {
            cwd: scriptPath.replace(/[/\\]src[/\\]migrate\.js$/, ''),
            env, detached: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
        });
        let tail = '';
        if (child.stdout) child.stdout.on('data', c => { tail = (tail + c.toString()).slice(-2000); });
        if (child.stderr) child.stderr.on('data', c => { tail = (tail + c.toString()).slice(-2000); });
        child.on('exit', (code) => {
            const ok = code === 0;
            ifessService.updateSyncJob(syncJobId, {
                status: ok ? 'success' : 'failed',
                finishedAt: new Date().toISOString(),
                errorMessage: ok ? null : ('FB_Migration exit ' + code + ' | ' + tail.slice(-500))
            });
        });
        child.on('error', (e) => {
            ifessService.updateSyncJob(syncJobId, { status: 'failed', finishedAt: new Date().toISOString(), errorMessage: String(e && e.message || e) });
        });
        child.unref();
    } catch (e) {
        ifessService.updateSyncJob(syncJobId, { status: 'failed', finishedAt: new Date().toISOString(), errorMessage: 'spawn failed: ' + (e && e.message || e) });
    }
}

// Remove old query data and load/save functions (now handled by service module)

loadQueryData();

// Stuck-command reaper: every 30s, fail any Received command whose client hasn't reported a
// result within 120s (client crashed / network drop mid-execution). Keeps the command queue
// + linked query jobs from hanging forever in a multi-client deployment.
setInterval(() => {
    try { const r = ifessService.reapStaleCommands(120); if (r && r.reaped > 0) console.log(`[reaper] failed ${r.reaped} stale command(s)`); }
    catch (e) { /* reaper must never crash the gateway */ }
}, 30000);

// ─── Routes Configuration ─────────────────────────────────────────────────────
const routesConfigPath = `${ROOT_DIR}/routes-config.json`;
let routesConfig = [];

try {
    const raw = readFileSync(routesConfigPath, 'utf-8');
    const configuredRoutes = JSON.parse(raw)
        .filter(r => r.enabled !== false)
        .flatMap(route => [
            route,
            ...(Array.isArray(route.aliases)
                ? route.aliases.map(alias => ({
                    ...route,
                    id: `${route.id}:${alias}`,
                    path: alias,
                    rewritePath: false,
                    staticRoots: [],
                    spaIndex: undefined,
                    hidden: true,
                }))
                : []),
        ]);
    routesConfig = configuredRoutes
        .sort((a, b) => b.path.length - a.path.length);
    console.log(`Loaded ${routesConfig.length} routes from routes-config.json`);
} catch (e) {
    console.error(`Failed to load routes-config.json: ${e.message}`);
    process.exit(1);
}

// ─── URL Rewriting Utilities ──────────────────────────────────────────────────
const REWRITE_PATTERNS = [
    { from: /https?:\/\/localhost:8002\//g, to: '/upah/' },
    { from: /https?:\/\/localhost:5176\//g, to: '/absen/' },
    { from: /https?:\/\/localhost:5177\//g, to: '/monitoring-beras/' },
    { from: /https?:\/\/localhost:5178\//g, to: '/file/' },
    { from: /https?:\/\/localhost:8003\//g, to: '/ifess/' },
    { from: /src="\/(?!upah|absen|monitoring-beras|server-monitor|network-monitor|report-center|report-center-assets|file|ifess|backend|query|assets|dashboard|src|@vite|node_modules)/g, to: 'src="/dashboard/' },
    { from: /href="\/(?!upah|absen|monitoring-beras|server-monitor|network-monitor|report-center|report-center-assets|file|ifess|backend|query|assets|dashboard|src|@vite|node_modules)/g, to: 'href="/dashboard/' },
    { from: /ws:\/\/localhost:\d+/g, to: `ws://localhost:${PORT}` },
];

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteBody(body, routePath, routeTarget) {
    if (typeof body !== 'string' && !(body instanceof Uint8Array)) return body;
    const text = typeof body === 'string' ? body : new TextDecoder().decode(body);

    if (!text.includes('localhost:8002') &&
        !text.includes('localhost:5176') &&
        !text.includes('localhost:5177') &&
        !text.includes('localhost:5178') &&
        !text.includes('localhost:8003') &&
        !/["'(=]\s*\/(?!\/)/.test(text) &&
        (routePath === '/upah' || !text.includes('/upah/'))) {
        return text;
    }

    let result = text;
    if (routeTarget) {
        result = result.replace(new RegExp(escapeRegExp(routeTarget), 'g'), routePath);
    }

    for (const { from, to } of REWRITE_PATTERNS) {
        result = result.replace(from, to);
    }

    if (routePath !== '/') {
        result = result.replace(/(<script[^>]+src=["']\s*)\/(?!\/)/gi, `$1${routePath}/`);
        result = result.replace(/(<link[^>]+href=["']\s*)\/(?!\/)/gi, `$1${routePath}/`);
        result = result.replace(/(<img[^>]+src=["']\s*)\/(?!\/)/gi, `$1${routePath}/`);
        result = result.replace(/(<a[^>]+href=["']\s*)\/(?!\/)/gi, `$1${routePath}/`);
        result = result.replace(/from\s+(["'])\/(?!\/)/g, `from $1${routePath}/`);
        result = result.replace(/import\s+(["'])\/(?!\/)/g, `import $1${routePath}/`);
        result = result.replace(/fetch\((["'])\/(?!\/)/g, `fetch($1${routePath}/`);
        result = result.replace(/url\((["']?)\/(?!\/)/g, `url($1${routePath}/`);
        result = result.replace(/(["'])\/@vite\//g, `$1${routePath}/@vite/`);
        result = result.replace(/(["'])\/@react-refresh/g, `$1${routePath}/@react-refresh`);
        result = result.replace(/(["'])\/@id\//g, `$1${routePath}/@id/`);
        result = result.replace(/(["'])\/@fs\//g, `$1${routePath}/@fs/`);
        result = result.replace(/(["'])\/src\//g, `$1${routePath}/src/`);
        result = result.replace(/(["'])\/node_modules\//g, `$1${routePath}/node_modules/`);
        result = result.replace(/(["'])\/assets\//g, `$1${routePath}/assets/`);
        result = result.split(`${routePath}${routePath}/`).join(`${routePath}/`);
    }

    if (routePath !== '/upah') {
        result = result.replace(/\/upah\//g, `${routePath}/`);
    }
    return result;
}

function rewriteViteDevResponse(text, routePath) {
    if (routePath === '/') return text;

    return text
        .replace(/(["'`])\/@vite\//g, `$1${routePath}/@vite/`)
        .replace(/(["'`])\/@react-refresh/g, `$1${routePath}/@react-refresh`)
        .replace(/(["'`])\/@id\//g, `$1${routePath}/@id/`)
        .replace(/(["'`])\/@fs\//g, `$1${routePath}/@fs/`)
        .replace(/(["'`])\/src\//g, `$1${routePath}/src/`)
        .replace(/(["'`])\/node_modules\//g, `$1${routePath}/node_modules/`)
        .replace(/(["'`])\/assets\//g, `$1${routePath}/assets/`)
        .replace(/(from\s+["'`])\/(?!\/)/g, `$1${routePath}/`)
        .replace(/(import\(["'`])\/(?!\/)/g, `$1${routePath}/`)
        .split(`${routePath}${routePath}/`).join(`${routePath}/`);
}

// ─── Route Resolution ────────────────────────────────────────────────────────
function matchRoute(urlPath) {
    // Skip IFESS API paths - handled directly by this server
    if (urlPath.startsWith('/api/ifess')) return null;
    for (const route of routesConfig) {
        if (urlPath.startsWith(route.path)) return route;
    }
    return null;
}

function matchRouteFromReferer(req) {
    const referer = req.headers.get('referer') || '';
    if (!referer) return null;

    let refererPath = referer;
    try {
        refererPath = new URL(referer).pathname;
    } catch { /* keep raw header */ }

    return routesConfig.find(route =>
        route.enabled !== false &&
        isHttpTarget(route.target) &&
        (refererPath === route.path || refererPath.startsWith(`${route.path}/`))
    ) || null;
}

function isViteDevAssetPath(reqPath) {
    return reqPath === '/@vite/client' ||
        reqPath === '/@react-refresh' ||
        reqPath.startsWith('/@id/') ||
        reqPath.startsWith('/@fs/') ||
        reqPath.startsWith('/src/') ||
        reqPath.startsWith('/node_modules/.vite/') ||
        reqPath.startsWith('/node_modules/vite/');
}

function isHttpTarget(target) {
    return typeof target === 'string' && /^https?:///i.test(target);
}

// ─── Static File Utilities ───────────────────────────────────────────────────
const STATIC_EXTENSIONS_RE = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|webp|avif|map)$/;
const VERSION_HASH_RE = /-[a-f0-9]{6,}\.[a-z]+$/;

const DEFAULT_STATIC_ROOTS = [
    { prefix: '/ifess-assets', dir: `${DASHBOARD_DIR}/public/ifess-assets`, immutable: false },
    { prefix: '/assets', dir: `${DASHBOARD_DIR}/public/assets`, immutable: false },
];

function normalizeStaticRoots(route) {
    const configured = Array.isArray(route.staticRoots) ? route.staticRoots : [];
    return configured.map(root => ({
        ...root,
        textRewrites: root.textRewrites || route.textRewrites || [],
        dir: root.dir ? resolve(ROOT_DIR, root.dir) : undefined,
        file: root.file ? resolve(ROOT_DIR, root.file) : undefined,
    }));
}

const staticRoots = [
    ...routesConfig.flatMap(normalizeStaticRoots),
    ...DEFAULT_STATIC_ROOTS,
].sort((a, b) => b.prefix.length - a.prefix.length);

function getStaticFilePath(reqPath) {
    const root = staticRoots.find(item => reqPath === item.prefix || reqPath.startsWith(`${item.prefix}/`));
    if (!root) return null;

    if (root.file) return { path: root.file, root };

    const suffix = reqPath.slice(root.prefix.length).replace(/^\//, '');
    if (suffix.includes('..')) return null;
    return { path: suffix ? `${root.dir}/${suffix}` : root.dir, root };
}

function getCacheControl(reqPath, contentType = '') {
    const hasVersionHash = VERSION_HASH_RE.test(reqPath);
    const isJs = contentType.includes('javascript') || contentType.includes('application/javascript');
    const isCss = contentType.includes('text/css');
    const isImage = /\.(png|jpg|jpeg|gif|ico|svg|webp|avif)$/.test(reqPath);
    const isFont = /\.(woff2?|ttf|eot|otf)$/.test(reqPath);
    const isHtml = contentType.includes('text/html');

    if ((isJs || isCss) && hasVersionHash) return 'public, max-age=31536000, immutable';
    if (isJs || isCss) return 'public, max-age=3600';
    if (isImage) return hasVersionHash ? 'public, max-age=31536000, immutable' : 'public, max-age=604800';
    if (isFont) return 'public, max-age=31536000, immutable';
    if (isHtml) return 'no-cache, no-store, must-revalidate';
    return 'no-cache';
}

async function serveLocalFile(filePath, reqPath, options = {}) {
    const file = Bun.file(filePath);
    if (!(await file.exists())) return null;

    const contentType = getMimeType(reqPath);
    const isVersioned = VERSION_HASH_RE.test(reqPath);
    const isText = contentType.includes('text/html') ||
        contentType.includes('javascript') ||
        contentType.includes('text/css') ||
        contentType.includes('application/json') ||
        contentType.includes('text/plain');
    const textRewrites = Array.isArray(options.textRewrites) ? options.textRewrites : [];
    let body;

    if (isText && textRewrites.length > 0) {
        let text = await file.text();
        for (const rewrite of textRewrites) {
            if (!rewrite?.from) continue;
            text = text.split(rewrite.from).join(rewrite.to || '');
        }
        body = new TextEncoder().encode(text);
    } else {
        body = await file.arrayBuffer();
    }

    const cacheControl = options.cacheControl || (isVersioned || options.immutable
        ? 'public, max-age=31536000, immutable'
        : getCacheControl(reqPath, contentType));

    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': contentType,
            'Content-Length': body.byteLength.toString(),
            'Cache-Control': cacheControl,
            'Server': 'Bun-Proxy',
            'X-Proxy-Path': options.proxyPath || 'static-bypass',
        }
    });
}

function getNetworkMonitorFilePath(reqPath) {
    if (reqPath !== '/network-monitor' && !reqPath.startsWith('/network-monitor/')) return null;

    let suffix = decodeURIComponent(reqPath.slice('/network-monitor'.length)).replace(/^\/+/, '');
    suffix = suffix.replace(/\/$/, '');

    if (!suffix ||
        suffix === 'network' ||
        ['index', 'index.html', 'cable-trace', 'cable-trace.html', 'topology', 'topology.html', 'inventory', 'inventory.html'].includes(suffix)) {
        suffix = 'index.html';
    }

    if (suffix.includes('..') || suffix.includes('\\')) return null;
    return `${NETWORK_MONITOR_DIR}/${suffix}`;
}

async function serveNetworkMonitor(reqPath) {
    const filePath = getNetworkMonitorFilePath(reqPath);
    if (!filePath) return null;

    const cacheControl = filePath.endsWith('.html')
        ? 'no-cache, no-store, must-revalidate'
        : undefined;

    return serveLocalFile(filePath, filePath, {
        cacheControl,
        proxyPath: 'network-monitor-static',
    });
}

function isSpaNavigation(req, route, reqPath) {
    if (!route?.spaIndex) return false;
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    if (STATIC_EXTENSIONS_RE.test(reqPath)) return false;
    if (Array.isArray(route.apiPrefixes) && route.apiPrefixes.some(prefix => reqPath.startsWith(prefix))) return false;
    const accept = req.headers.get('accept') || '';
    return accept.includes('text/html') || accept.includes('*/*') || accept === '';
}

async function isUpstreamReady(target) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const response = await fetch(target, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        return response.status < 500;
    } catch {
        return false;
    }
}

async function startDashboardIfNeeded() {
    if (await isUpstreamReady(DASHBOARD_TARGET)) {
        console.log(`Dashboard upstream ready: ${DASHBOARD_TARGET}`);
        return;
    }

    const bunExecutable = process.execPath;
    console.log(`Starting dashboard dev server on ${DASHBOARD_HOST}:${DASHBOARD_PORT}...`);
    const child = Bun.spawn({
        cmd: [bunExecutable, 'run', 'dev', '--', '-p', String(DASHBOARD_PORT), '--hostname', DASHBOARD_HOST],
        cwd: DASHBOARD_DIR,
        stdout: 'inherit',
        stderr: 'inherit',
        env: {
            ...process.env,
            HOST: DASHBOARD_HOST,
            PORT: String(DASHBOARD_PORT),
        },
    });

    process.on('exit', () => child.kill());

    for (let attempt = 0; attempt < 60; attempt += 1) {
        await Bun.sleep(500);
        if (await isUpstreamReady(DASHBOARD_TARGET)) {
            console.log(`Dashboard upstream ready: ${DASHBOARD_TARGET}`);
            return;
        }
    }

    console.warn(`Dashboard upstream did not become ready yet: ${DASHBOARD_TARGET}`);
}
async function ensureNodeDependencies(serviceDir, label) {
    if (existsSync(`${serviceDir}/node_modules`)) return true;

    if (!AUTO_INSTALL_MODULE_SERVICES) {
        console.warn(`${label} dependencies missing: ${serviceDir}/node_modules`);
        return false;
    }

    if (!existsSync(`${serviceDir}/package-lock.json`)) {
        console.warn(`${label} package-lock.json not found, cannot auto-install`);
        return false;
    }

    const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    console.log(`Installing ${label} dependencies with npm ci...`);
    const child = Bun.spawn({
        cmd: [npmExecutable, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'],
        cwd: serviceDir,
        stdout: 'inherit',
        stderr: 'inherit',
        env: process.env,
    });

    const exitCode = await child.exited;
    if (exitCode !== 0) {
        console.warn(`${label} dependency install failed with exit code ${exitCode}`);
        return false;
    }

    return true;
}

async function startRouteServiceIfNeeded(routeId, options) {
    const route = findBaseRoute(routeId);
    if (!route || !isHttpTarget(route.target)) return;

    if (await isUpstreamReady(route.target)) {
        console.log(`${options.label} upstream ready: ${route.target}`);
        return;
    }

    if (!START_MODULE_SERVICES) {
        console.log(`${options.label} upstream not ready: ${route.target}`);
        return;
    }

    const dependenciesReady = await ensureNodeDependencies(options.cwd, options.label);
    if (!dependenciesReady) return;

    const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    console.log(`Starting ${options.label} upstream with npm run ${options.script} at ${route.target}...`);
    const child = Bun.spawn({
        cmd: [npmExecutable, 'run', options.script],
        cwd: options.cwd,
        stdout: 'inherit',
        stderr: 'inherit',
        env: {
            ...process.env,
            PORT: String(options.port),
            ...(options.env || {}),
        },
    });

    process.on('exit', () => child.kill());

    for (let attempt = 0; attempt < 40; attempt += 1) {
        await Bun.sleep(500);
        if (await isUpstreamReady(route.target)) {
            console.log(`${options.label} upstream ready: ${route.target}`);
            return;
        }
    }

    console.warn(`${options.label} upstream did not become ready yet: ${route.target}`);
}

async function startModuleServicesIfNeeded() {
    // Phase 4: removed child-process spawning — module services must be started externally
    console.log('[Phase 4] startModuleServicesIfNeeded() stubbed — services managed externally');
    return;
}
async function proxyDashboard(req, reqPath, search) {
    const targetUrl = `${DASHBOARD_TARGET}${reqPath}${search}`;
    const headers = buildProxyHeaders(req);

    try {
        const response = await fetch(targetUrl, {
            headers,
            method: req.method,
            body: hasRequestBody(req.method) ? req.body : undefined,
            redirect: 'manual',
            signal: req.signal,
        });
        const responseHeaders = copyResponseHeaders(response.headers);
        responseHeaders.set('Server', 'Bun-Proxy');
        responseHeaders.set('X-Proxy-Upstream', 'dashboard');
        return new Response(response.body, { status: response.status, headers: responseHeaders });
    } catch (err) {
        console.error(`Dashboard proxy error: ${err.message}`);
        return new Response('Dashboard Service Unavailable', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Server': 'Bun-Proxy' },
        });
    }
}

function dashboardWsTarget(reqPath, search) {
    if (!reqPath.startsWith('/_next/webpack-hmr')) return null;
    return `${DASHBOARD_TARGET.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')}${reqPath}${search}`;
}

function proxyWsTarget(req, reqPath, search) {
    let route = matchRoute(reqPath);

    if (!route) {
        const referer = req.headers.get('referer') || '';
        route = routesConfig.find(item => item.enabled !== false && referer.includes(item.path));
    }

    if (!route?.target || !isHttpTarget(route.target)) return null;

    const targetPath = route.rewritePath === false
        ? reqPath
        : (reqPath.startsWith(route.path) ? (reqPath.slice(route.path.length) || '/') : reqPath);
    return `${route.target.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')}${targetPath}${search}`;
}

function isWebSocketRequest(req) {
    return (req.headers.get('upgrade') || '').toLowerCase() === 'websocket';
}

function hasRequestBody(method) {
    return method !== 'GET' && method !== 'HEAD';
}

function buildProxyHeaders(req, options = {}) {
    const headers = new Headers();
    for (const [key, value] of req.headers.entries()) {
        const lower = key.toLowerCase();
        if (['connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(lower)) continue;
        if (lower === 'host') continue;
        if (options.stripAcceptEncoding && lower === 'accept-encoding') continue;
        headers.set(key, value);
    }
    headers.set('X-Forwarded-For', req.headers.get('x-forwarded-for') || '127.0.0.1');
    headers.set('X-Forwarded-Host', req.headers.get('host') || `localhost:${PORT}`);
    headers.set('X-Real-IP', req.headers.get('x-real-ip') || '127.0.0.1');
    return headers;
}

function copyResponseHeaders(source) {
    const headers = new Headers();
    source.forEach((value, key) => {
        if (['content-length', 'transfer-encoding', 'connection', 'content-encoding'].includes(key.toLowerCase())) return;
        headers.set(key, value);
    });
    return headers;
}

async function proxyFirebirdQueryService(req, reqPath, search) {
    const servicePath = reqPath
        .replace(/^\/api\/ifess\/query-gateway/, '')
        .replace(/^\/api\/query-gateway/, '') || '/';
    const targetUrl = `${FIREBIRD_QUERY_TARGET}${servicePath}${search}`;

    try {
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: buildProxyHeaders(req),
            body: hasRequestBody(req.method) ? req.body : undefined,
            redirect: 'manual',
            signal: req.signal,
        });
        const headers = copyResponseHeaders(response.headers);
        headers.set('Server', 'Bun-Gateway');
        headers.set('X-Proxy-Upstream', 'firebird-query-service');
        return new Response(response.body, { status: response.status, headers });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Firebird Query Service Unavailable', message: err.message }), {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway' },
        });
    }
}

// ─── HTTP Client Pre-warm ────────────────────────────────────────────────────
async function prewarmConnections() {
    const targets = [...new Set(routesConfig.map(r => r.target).filter(isHttpTarget))];
    console.log('Pre-warming connections to upstream services...');
    await Promise.allSettled(
        targets.map(async (target) => {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                await fetch(target, { signal: controller.signal, method: 'HEAD' });
                clearTimeout(timeout);
                console.log(`  Up: ${target}`);
            } catch {
                console.log(`  Down: ${target} (may not be running yet)`);
            }
        })
    );
}

// ─── Bun HTTP Server ─────────────────────────────────────────────────────────
async function proxyRequest(req, route, reqPath) {
    const url = new URL(req.url);
    const targetPath = route.rewritePath === false
        ? reqPath
        : (reqPath.slice(route.path.length) || '/');
    const targetUrl = `${route.target}${targetPath}${url.search}`;
    const acceptEncoding = req.headers.get('accept-encoding') || '';
    const shouldRewriteContent = route.rewriteContent === true || route.rewriteContent === 'html-only';

    // ── Static Extension Fast-Path ──────────────────────────────────────────
    // Skip buffering entirely — serve as streaming passthrough
    if (STATIC_EXTENSIONS_RE.test(reqPath) && route.path === '/upah') {
        const fetchOptions = {
            headers: { 'Accept-Encoding': acceptEncoding },
            method: req.method,
            redirect: 'follow',
            signal: req.signal,
        };
        try {
            const response = await fetch(targetUrl, fetchOptions);
            const contentType = response.headers.get('content-type') || '';
            const cacheControl = getCacheControl(reqPath, contentType);
            const responseHeaders = new Headers();
            response.headers.forEach((value, key) => {
                if (['content-length', 'transfer-encoding'].includes(key)) return;
                responseHeaders.set(key, value);
            });
            responseHeaders.set('Cache-Control', cacheControl);
            responseHeaders.set('Server', 'Bun-Proxy');
            responseHeaders.set('X-Proxy-Path', 'static-bypass');
            return new Response(response.body, {
                status: response.status,
                headers: responseHeaders,
            });
        } catch { /* fall through to normal proxy */ }
    }

    const headers = buildProxyHeaders(req, { stripAcceptEncoding: shouldRewriteContent });

    const startTime = Date.now();
    // Cache key includes acceptEncoding so gzip/br responses aren't served to clients that didn't request compression
    const cacheKey = `${req.method}:${reqPath}:${acceptEncoding}`;

    // 304 Not Modified — ETag conditional check before hitting upstream
    const upstreamETag = req.headers.get('if-none-match');

    // LRU cache hit for /upah GET requests (text only — no binary in cache)
    if (req.method === 'GET' && route.path === '/upah') {
        const cached = assetCache.get(cacheKey);
        if (cached) {
            // Return 304 if ETag matches (no body = instant response)
            if (upstreamETag && cached.etag && upstreamETag === cached.etag) {
                const responseHeaders = new Headers();
                responseHeaders.set('ETag', cached.etag);
                responseHeaders.set('Cache-Control', cached.headers['cache-control']);
                responseHeaders.set('Server', 'Bun-Proxy');
                return new Response(null, { status: 304, headers: responseHeaders });
            }
            const responseHeaders = new Headers();
            responseHeaders.set('Content-Type', cached.headers['content-type']);
            responseHeaders.set('Cache-Control', cached.headers['cache-control']);
            responseHeaders.set('Server', 'Bun-Proxy');
            if (cached.etag) responseHeaders.set('ETag', cached.etag);
            return new Response(cached.body, { status: cached.status, headers: responseHeaders });
        }
    }

    try {
        const fetchOptions = {
            headers,
            method: req.method,
            body: hasRequestBody(req.method) ? req.body : undefined,
            redirect: 'follow',
            signal: req.signal,
        };

        const response = await fetch(targetUrl, fetchOptions);
        const elapsed = Date.now() - startTime;
        const contentType = response.headers.get('content-type') || '';
        const cacheControl = getCacheControl(reqPath, contentType);

        // Log all requests + slow requests warning
        const logKey = `${req.method} ${route.path}${targetPath} → ${response.status} (${elapsed}ms)`;
        if (elapsed > 500) {
            console.log(`SLOW ${logKey}`);
        } else {
            console.log(logKey);
        }

        // ── Passthrough: streaming for non-rewrite routes ─────────────────────
        if (!shouldRewriteContent) {
            const responseHeaders = copyResponseHeaders(response.headers);
            responseHeaders.set('Cache-Control', cacheControl);
            responseHeaders.set('X-Proxy-Elapsed', `${elapsed}ms`);
            responseHeaders.set('Server', 'Bun-Proxy');
            responseHeaders.set('Vary', 'Accept-Encoding');

            return new Response(response.body, {
                status: response.status,
                headers: responseHeaders,
            });
        }

        if (route.rewriteContent === 'html-only' && !contentType.includes('text/html')) {
            const responseHeaders = copyResponseHeaders(response.headers);
            responseHeaders.set('Cache-Control', cacheControl);
            responseHeaders.set('X-Proxy-Elapsed', `${elapsed}ms`);
            responseHeaders.set('Server', 'Bun-Proxy');
            responseHeaders.set('Vary', 'Accept-Encoding');

            return new Response(response.body, {
                status: response.status,
                headers: responseHeaders,
            });
        }

        // ── Rewrite route: read, optionally rewrite, return concrete bytes ───
        const bodyBuffer = await response.arrayBuffer();
        const isText = contentType.includes('text/html') ||
            contentType.includes('text/plain') ||
            contentType.includes('application/javascript') ||
            contentType.includes('text/css');
        const isHtml = contentType.includes('text/html');

        // Binary: stream directly (no buffering overhead for large files)
        // NOTE: binary content is NOT cached — images/fonts served via static bypass path
        if (!isText) {
            const responseHeaders = copyResponseHeaders(response.headers);
            responseHeaders.set('Cache-Control', cacheControl);
            responseHeaders.set('X-Proxy-Elapsed', `${elapsed}ms`);
            responseHeaders.set('Server', 'Bun-Proxy');
            responseHeaders.set('X-Content-Type-Options', 'nosniff');

            return new Response(bodyBuffer, {
                status: response.status,
                headers: responseHeaders,
            });
        }

        // Text content: rewrite if needed
        const text = new TextDecoder().decode(bodyBuffer);
        const needsRewrite =
            route.rewriteContent === true && (
                text.includes('localhost:8002') ||
                text.includes('localhost:5176') ||
                text.includes('localhost:5177') ||
                text.includes('localhost:5178') ||
                text.includes('localhost:8003') ||
                text.includes('/upah/') ||
                (route.path !== '/' && /["'(=]\s*\/(?!\/)/.test(text))
            );

        let finalText = needsRewrite ? rewriteBody(text, route.path, route.target) : text;
        if (route.id === 'server-monitor') {
            finalText = rewriteViteDevResponse(finalText, route.path);
        }
        const finalBytes = new TextEncoder().encode(finalText);

        const responseHeaders = new Headers({
            'Content-Type': contentType || (isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8'),
            'Content-Length': String(finalBytes.byteLength),
            'Cache-Control': cacheControl,
            'X-Proxy-Elapsed': `${elapsed}ms`,
            'Server': 'Bun-Proxy',
            'Vary': 'Accept-Encoding',
        });

        ['etag', 'last-modified', 'expires'].forEach(h => {
            const v = response.headers.get(h);
            if (v) responseHeaders.set(h, v);
        });

        // Cache GET responses for /upah (text only — skip binary > 100KB)
        if (req.method === 'GET' && route.path === '/upah') {
            const isBinary = bodyBuffer.byteLength > 100 * 1024; // skip large binary
            if (!isBinary) {
                assetCache.set(cacheKey, {
                    body: finalBytes,
                    status: response.status,
                    headers: { 'content-type': contentType, 'cache-control': cacheControl },
                    etag: response.headers.get('etag') || null,
                });
            }
        }

        return new Response(finalBytes, {
            status: response.status,
            headers: responseHeaders,
        });

    } catch (err) {
        console.error(`Proxy error for ${route.path}: ${err.message}`);
        return new Response(JSON.stringify({ error: 'Proxy error', path: reqPath }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Proxy' }
        });
    }
}

// ─── Bun HTTP Server ─────────────────────────────────────────────────────────
console.log(`Bun Native Proxy Gateway starting on ${HOST}:${PORT}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'} | Bun v${Bun.version}`);

if (START_DASHBOARD) {
    await startDashboardIfNeeded();
} else {
    console.log('START_DASHBOARD=false — skipping dashboard upstream startup');
}

if (START_MODULE_SERVICES) { await startModuleServicesIfNeeded(); } else { console.log('[Phase 4] START_MODULE_SERVICES=false — skipping module services startup'); }
await prewarmConnections();
startLanDiscoveryScheduler();

let server;
server = Bun.serve({
    port: PORT,
    hostname: HOST,
    idleTimeout: GATEWAY_IDLE_TIMEOUT_SECONDS,

    async fetch(req) {
        const url = new URL(req.url);
        const reqPath = url.pathname;

        // Phase 1: Canonical health endpoints
        if (reqPath === "/health/live" || reqPath === "/health/live/") {
            const rid = "req_"+Date.now().toString(36)+"_"+(1+Math.random()*999999|0).toString(36);
            return new Response(JSON.stringify({ ok: true, timestamp: new Date().toISOString(), service: "bun-gateway" }), {
                status: 200, headers: { "Content-Type": "application/json", "Server": "Bun-Gateway", "X-Request-ID": rid }
            });
        }
        if (reqPath === '/health/ready' || reqPath === '/health/ready/') {
            return new Response(JSON.stringify({ ok: true, version: "1.0.0", service: 'bun-gateway', initialized: true }), {
                status: 200, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway' }
            });
        }
        if (reqPath === '/version' || reqPath === '/version/') {
            return new Response(JSON.stringify({ gateway: '1.0.0', bun: process.versions.bun || 'unknown' }), {
                status: 200, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway' }
            });
        }

        // Root /health alias — client SetupForm TestServer hits BaseUrl + "health" (no /api/ifess).
        if (reqPath === '/health' || reqPath === '/health/') {
            return new Response(JSON.stringify({ status: 'Healthy', serverTime: getServerTime() }), {
                headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Proxy' }
            });
        }

        if (isWebSocketRequest(req)) {
            const upstreamUrl = dashboardWsTarget(reqPath, url.search) || proxyWsTarget(req, reqPath, url.search);
            if (upstreamUrl && server.upgrade(req, { data: { upstreamUrl, queue: [] } })) {
                return;
            }
            return new Response('WebSocket route not found', {
                status: 404,
                headers: { 'Server': 'Bun-Proxy' },
            });
        }

        if (reqPath === '/__gateway/health') {
            return new Response(JSON.stringify({
                ok: true,
                gateway: 'bun',
                dashboardTarget: DASHBOARD_TARGET,
                routes: routesConfig.map(route => ({ id: route.id, path: route.path, target: route.target, public: route.public === true })),
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Server': 'Bun-Proxy' },
            });
        }

        if (reqPath === '/logout') {
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': '/',
                    'Set-Cookie': 'auth-token=; Path=/; Max-Age=0; SameSite=Lax',
                    'Server': 'Bun-Proxy',
                }
            });
        }

        // ── Bun Native API Handlers (before route matching) ──────────────────
        // SuperApp compat: legacy /api/clients/* → /api/ifess/clients/*
        // (Kerani SuperApp hardcodes "api/clients/..." paths from old 8003 server)
        if (reqPath.startsWith('/api/clients')) {
            return handleIFESSApi(req, '/api/ifess' + reqPath.slice(4));
        }
        // IFESS API
        if (reqPath.startsWith('/api/ifess')) {
            // Sync chunk/watermark/job-status routes go to handleQueryGateway (REST),
            // but the action dispatcher (POST /api/ifess {action:'syncDispatch'}) stays in handleIFESSApi.
            if (reqPath.startsWith('/api/ifess/sync/')) {
                return handleQueryGateway(req, reqPath);
            }
            if (reqPath.startsWith('/api/ifess/query-gateway')) {
                return proxyFirebirdQueryService(req, reqPath, url.search);
            }
            return handleIFESSApi(req, reqPath);
        }
        // Query Gateway — proxied to standalone Firebird Query Service
        if (reqPath.startsWith('/api/query-gateway')) {
            return proxyFirebirdQueryService(req, reqPath, url.search);
        }
        // Runtime monitoring snapshot for Server Monitor and Network Monitor.
        if (reqPath === '/api/monitoring/host-labels') {
            const monitoringToken = extractToken(req.headers.get('cookie') || '');
            const monitoringUser = monitoringToken ? verifyJWT(monitoringToken) : null;
            if (!monitoringUser) return redirectToLogin(req, reqPath, url.search);

            if (req.method === 'GET') {
                const store = loadHostLabels();
                const key = getHostLabelKey({
                    ipAddress: url.searchParams.get('ipAddress') || url.searchParams.get('ip'),
                    macAddress: url.searchParams.get('macAddress') || url.searchParams.get('mac'),
                });
                return jsonResp(200, key
                    ? { success: true, label: store.labels[key] || null }
                    : { success: true, labels: store.labels });
            }

            if (req.method === 'POST') {
                const data = await req.json().catch(() => null);
                if (!data || typeof data !== 'object') return jsonResp(400, { success: false, error: 'Invalid JSON body' });
                const normalized = normalizeHostLabelInput(data, monitoringUser);
                if (normalized.error) return jsonResp(400, { success: false, error: normalized.error });
                const store = loadHostLabels();
                store.labels[normalized.label.key] = normalized.label;
                const saved = saveHostLabels(store.labels);
                return jsonResp(200, { success: true, label: normalized.label, labels: saved.labels });
            }

            return jsonResp(405, { success: false, error: 'Method not allowed' });
        }

        if (reqPath === '/api/monitoring/host-labels/delete') {
            const monitoringToken = extractToken(req.headers.get('cookie') || '');
            const monitoringUser = monitoringToken ? verifyJWT(monitoringToken) : null;
            if (!monitoringUser) return redirectToLogin(req, reqPath, url.search);
            if (req.method !== 'DELETE') return jsonResp(405, { success: false, error: 'Method not allowed' });

            const data = await req.json().catch(() => ({}));
            const key = getHostLabelKey({
                ipAddress: data?.ipAddress || url.searchParams.get('ipAddress') || url.searchParams.get('ip'),
                macAddress: data?.macAddress || url.searchParams.get('macAddress') || url.searchParams.get('mac'),
            });
            if (!key) return jsonResp(400, { success: false, error: 'ipAddress or macAddress is required' });
            const store = loadHostLabels();
            const label = store.labels[key] || null;
            delete store.labels[key];
            const saved = saveHostLabels(store.labels);
            return jsonResp(200, { success: true, label, labels: saved.labels });
        }

        if (reqPath === '/api/monitoring/discovery/refresh') {
            const monitoringToken = extractToken(req.headers.get('cookie') || '');
            const monitoringUser = monitoringToken ? verifyJWT(monitoringToken) : null;
            if (!monitoringUser) return redirectToLogin(req, reqPath, url.search);
            scheduleLanDiscoveryRefresh(url.searchParams.get('reason') || 'manual-api');
            return jsonResp(202, {
                success: true,
                refreshing: true,
                cachePath: 'data/monitoring/network-discovery-cache.json',
                refreshIntervalMs: DISCOVERY_REFRESH_INTERVAL_MS,
                snapshot: await getMonitoringSnapshot({}),
            });
        }

        if (reqPath === '/api/monitoring/snapshot') {
            const monitoringToken = extractToken(req.headers.get('cookie') || '');
            const monitoringUser = monitoringToken ? verifyJWT(monitoringToken) : null;
            if (!monitoringUser) return redirectToLogin(req, reqPath, url.search);
            return jsonResp(200, await getMonitoringSnapshot({
                forceDiscovery: url.searchParams.get('forceDiscovery') === '1',
                waitDiscovery: url.searchParams.get('waitDiscovery') === '1',
            }));
        }

        const directRoute = matchRoute(reqPath);
        const refererRoute = !directRoute && isViteDevAssetPath(reqPath)
            ? matchRouteFromReferer(req)
            : null;
        const route = directRoute || refererRoute;
        const routeReqPath = directRoute ? reqPath : `${route?.path || ''}${reqPath}`;
        const token = extractToken(req.headers.get('cookie') || '');
        const user = token ? verifyJWT(token) : null;

        // Phase 5: require X-API-Key for /query, /ifess
        // NOTE: /backend/upah has NO x-api-key guard — the upah backend auths via
        // its own Bearer JWT; the frontend never sends x-api-key, so guarding it
        // here caused 401s on every /backend/upah/* call (login kick-out loop).
        const hApiKey = req.headers.get('x-api-key'); const reqId = req.headers.get('x-request-id') || 'req_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);

        if (reqPath.startsWith('/query') && !hApiKey) { return new Response(JSON.stringify({error:{code:'UNAUTHORIZED',message:'X-API-Key required'}}), { status: 401, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway' } }); }
        if (reqPath.startsWith('/query') && hApiKey !== QUERY_API_KEY) { return new Response(JSON.stringify({error:{code:'FORBIDDEN',message:'Invalid X-API-Key'}}), { status: 403, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway' } }); }

        if (reqPath.startsWith('/ifess') && !hApiKey) { return new Response(JSON.stringify({error:{code:'UNAUTHORIZED',message:'X-API-Key required'}}), { status: 401, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway' } }); }
        if (reqPath.startsWith('/ifess') && hApiKey !== IFESS_CLIENT_API_KEY) { return new Response(JSON.stringify({error:{code:'FORBIDDEN',message:'Invalid X-API-Key'}}), { status: 403, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway' } }); }

        // ── Static file bypass (zero overhead — fastest path) ───────────────
        const staticFile = getStaticFilePath(reqPath);
        if (staticFile) {
            try {
                const response = await serveLocalFile(staticFile.path, reqPath, {
                    immutable: staticFile.root.immutable,
                    textRewrites: staticFile.root.textRewrites,
                    cacheControl: staticFile.root.immutable
                        ? 'public, max-age=31536000, immutable'
                        : undefined,
                });
                if (response) return response;
            } catch { /* fall through to proxy */ }
        }

        if (route && route.public !== true && !user) {
            return redirectToLogin(req, reqPath, url.search);
        }

        if (route?.id === 'network-monitor' && reqPath === '/network-monitor') {
            return Response.redirect('/network-monitor/', 308);
        }

        if (route?.id === 'network-monitor') {
            const response = await serveNetworkMonitor(reqPath);
            if (response) return response;

            return new Response('Network Monitor asset not found', {
                status: 404,
                headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Server': 'Bun-Proxy' },
            });
        }

        if (route && isSpaNavigation(req, route, reqPath)) {
            const response = await serveLocalFile(resolve(ROOT_DIR, route.spaIndex), '/index.html', {
                textRewrites: route.textRewrites,
                cacheControl: 'no-cache, no-store, must-revalidate',
                proxyPath: 'spa-index',
            });
            if (response) return response;
        }

        // ── IFESS API (Bun native handler) ─────────────────────────────────
        // Moved to early handlers above

        // ── Standalone IFESS query UI (no Next.js dependency) ───────────────
        // /ifess-control (bare) and /ifess-control/app both serve the same latest HTML UI.
        if (reqPath === '/ifess-control' || reqPath === '/ifess-control/' || reqPath === '/ifess-control/app' || reqPath === '/ifess-control/app/') {
            const html = readFileSync(`${ROOT_DIR}/Dashboard_Utama/public/ifess-app.html`, 'utf-8');
            return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        if (reqPath === '/ifess-control/simple' || reqPath === '/ifess-control/simple/') {
            const html = readFileSync(`${ROOT_DIR}/Dashboard_Utama/public/ifess-simple.html`, 'utf-8');
            return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        // ── Dashboard paths first (before route matching) ─────────────────────
        if (isDashboardPath(reqPath)) {
            return proxyDashboard(req, reqPath, url.search);
        }

        // ── Proxy to upstream ───────────────────────────────────────────────
        if (route) {
            return proxyRequest(req, route, routeReqPath);
        }

        if (isProtectedPath(reqPath) && !user) {
            return redirectToLogin(req, reqPath, url.search);
        }

        return new Response(JSON.stringify({
            error: 'Not Found',
            path: reqPath,
            availableRoutes: routesConfig.map(route => ({ path: route.path, target: route.target, description: route.description })),
        }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Proxy' },
        });
    },

    error(err) {
        console.error(`Server error: ${err.message}`);
        return new Response('Internal Server Error', { status: 500 });
    },

    websocket: {
        open(client) {
            const upstream = new WebSocket(client.data.upstreamUrl);
            client.data.upstream = upstream;
            upstream.binaryType = 'arraybuffer';

            upstream.onopen = () => {
                for (const message of client.data.queue || []) upstream.send(message);
                client.data.queue = [];
            };
            upstream.onmessage = (event) => {
                if (client.readyState === WebSocket.OPEN) client.send(event.data);
            };
            upstream.onclose = (event) => {
                if (client.readyState === WebSocket.OPEN) client.close(event.code || 1000, event.reason || 'Dashboard websocket closed');
            };
            upstream.onerror = () => {
                if (client.readyState === WebSocket.OPEN) client.close(1011, 'Dashboard websocket error');
            };
        },

        message(client, message) {
            const upstream = client.data.upstream;
            if (upstream?.readyState === WebSocket.OPEN) {
                upstream.send(message);
                return;
            }
            client.data.queue ||= [];
            client.data.queue.push(message);
        },

        close(client) {
            const upstream = client.data.upstream;
            if (upstream?.readyState === WebSocket.OPEN || upstream?.readyState === WebSocket.CONNECTING) {
                upstream.close();
            }
        },
    },
});

console.log(`\nProxy gateway ready at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
console.log('Routes active:');
routesConfig.forEach(r => console.log(`  ${r.path} → ${r.target}`));

export default server;

// ─── MIME Type Helper ─────────────────────────────────────────────────────────
function getMimeType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const types = {
        'js': 'application/javascript',
        'mjs': 'application/javascript',
        'css': 'text/css',
        'html': 'text/html',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'ttf': 'font/ttf',
        'eot': 'application/vnd.ms-fontobject',
        'otf': 'font/otf',
        'webp': 'image/webp',
        'avif': 'image/avif',
        'map': 'application/json',
    };
    return types[ext] || 'application/octet-stream';
}
