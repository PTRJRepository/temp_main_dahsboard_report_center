import { config as loadEnv } from 'dotenv';

loadEnv();

export interface ApiKeyEntry {
    name: string;
    readOnly: boolean;
    description?: string;
}

export interface DatabaseProfile {
    name: string;
    driver: string;
    server: string;
    port: number;
    user: string;
    password: string;
    database: string;
    readOnly: boolean;
    options: { encrypt: boolean; trustServerCertificate: boolean };
    pool: { max: number; min: number; idleTimeoutMillis: number; acquireTimeoutMillis: number };
}

function intEnv(key: string, fallback: number): number {
    const raw = process.env[key];
    if (!raw) return fallback;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Parse SQLGW_API_KEYS (JSON map or array) into entries keyed by the raw key.
 * Invalid entries are skipped with a warning; keys are never logged verbatim.
 */
function loadApiKeys(): Map<string, ApiKeyEntry> {
    const map = new Map<string, ApiKeyEntry>();
    const raw = process.env.SQLGW_API_KEYS;
    if (raw) {
        try {
            const parsed: unknown = JSON.parse(raw);
            const push = (key: unknown, val: unknown): void => {
                if (typeof key !== 'string' || key.length < 8) return;
                let name = `key-${map.size + 1}`;
                let readOnly = true;
                let description: string | undefined;
                if (typeof val === 'string') {
                    name = val;
                } else if (val && typeof val === 'object') {
                    const o = val as Record<string, unknown>;
                    if (typeof o.name === 'string' && o.name) name = o.name;
                    if (typeof o.readOnly === 'boolean') readOnly = o.readOnly;
                    if (typeof o.description === 'string') description = o.description;
                }
                map.set(key, { name, readOnly, description });
            };
            if (Array.isArray(parsed)) {
                for (const item of parsed as Array<Record<string, unknown>>) {
                    if (typeof item?.key === 'string') push(item.key, item);
                }
            } else if (parsed && typeof parsed === 'object') {
                for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) push(k, v);
            }
        } catch {
            console.warn('[config] SQLGW_API_KEYS is not valid JSON — ignoring');
        }
    }
    // Legacy single-token compatibility (old gateway clients)
    const legacy = process.env.API_TOKEN;
    if (legacy && legacy.length >= 8 && !map.has(legacy)) {
        map.set(legacy, { name: 'legacy-token', readOnly: false, description: 'Legacy API_TOKEN (admin)' });
    }
    return map;
}

const KNOWN_SUFFIXES = [
    '_DRIVER', '_SERVER', '_PORT', '_USERNAME', '_PASSWORD',
    '_DATABASE_NAME', '_TRUSTED_CONNECTION', '_ENCRYPT', '_READ_ONLY',
];

/** DATABASE_PROFILES_* env parsing — same contract as the source gateway so .env migrates 1:1. */
function loadProfiles(): DatabaseProfile[] {
    const env = process.env;
    const names = new Set<string>();
    for (const key of Object.keys(env)) {
        if (!key.startsWith('DATABASE_PROFILES_')) continue;
        const after = key.slice('DATABASE_PROFILES_'.length);
        for (const suffix of KNOWN_SUFFIXES) {
            if (after.endsWith(suffix) && after.length > suffix.length) {
                names.add(after.slice(0, -suffix.length));
                break;
            }
        }
    }

    const profiles: DatabaseProfile[] = [];
    for (const name of names) {
        const p = `DATABASE_PROFILES_${name}_`;
        const server = env[`${p}SERVER`];
        if (!server) continue;
        profiles.push({
            name: name.toUpperCase(),
            driver: env[`${p}DRIVER`] || 'ODBC Driver 17 for SQL Server',
            server,
            port: intEnv(`${p}PORT`, 1433),
            user: env[`${p}USERNAME`] || 'sa',
            password: env[`${p}PASSWORD`] || '',
            database: env[`${p}DATABASE_NAME`] || 'master',
            readOnly: env[`${p}READ_ONLY`] === 'true',
            options: {
                encrypt: env[`${p}ENCRYPT`] === 'true',
                trustServerCertificate: env[`${p}TRUSTED_CONNECTION`] !== 'true',
            },
            pool: {
                max: 20,
                min: 5,
                idleTimeoutMillis: 3_600_000,
                acquireTimeoutMillis: 30_000,
            },
        });
    }
    return profiles;
}

export const appConfig = {
    host: process.env.HOST || '0.0.0.0',
    // Port lama SQL Gateway (D:/Tools_Gawe/Database_Query_Gateway) — dipertahankan
    // agar semua pemanggil eksternal yang sudah menunjuk ke :8001 tidak perlu diubah.
    port: intEnv('PORT', 8001),

    apiKeys: loadApiKeys(),

    defaultProfile: (process.env.DB_PROFILE || '').toUpperCase(),
    profiles: loadProfiles(),

    fullAccessProfile: (process.env.SQLGW_FULLACCESS_PROFILE || 'SERVER_PROFILE_1').toUpperCase(),
    fullAccessDb: (process.env.SQLGW_FULLACCESS_DB || 'extend_db_ptrj').toLowerCase(),

    logDir: process.env.SQLGW_LOG_DIR || 'data/logs',
    logRetentionDays: intEnv('SQLGW_LOG_RETENTION_DAYS', 14),
    logMaxFileBytes: intEnv('SQLGW_LOG_MAX_FILE_MB', 50) * 1024 * 1024,
    requestRingSize: intEnv('SQLGW_REQUEST_RING', 5000),
    queryRingSize: intEnv('SQLGW_QUERY_RING', 3000),
    securityRingSize: intEnv('SQLGW_SECURITY_RING', 1000),

    cacheTtlMs: intEnv('SQLGW_CACHE_TTL_MS', 300_000),
    rateLimitPerMin: intEnv('SQLGW_RATE_LIMIT_PER_MIN', 120),

    maxSqlLength: 200_000,
    maxBatchQueries: 100,

    loginUrl: process.env.SQLGW_LOGIN_URL || 'http://localhost:3001/login',
} as const;

export function defaultProfileName(): string {
    if (appConfig.defaultProfile) return appConfig.defaultProfile;
    return appConfig.profiles[0]?.name ?? '';
}

export function getProfile(name?: string): DatabaseProfile | undefined {
    if (!name) return appConfig.profiles.find(p => p.name === defaultProfileName());
    const wanted = name.toUpperCase();
    return appConfig.profiles.find(p => p.name === wanted);
}
