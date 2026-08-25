import sql from 'mssql';
import { appConfig, defaultProfileName, getProfile } from '../config.js';
import { monitor } from './monitor.js';

interface CacheEntry {
    data: unknown[];
    timestamp: number;
}

const WRITE_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'DROP', 'CREATE', 'ALTER', 'EXEC', 'EXECUTE', 'MERGE'];
const SLOW_QUERY_THRESHOLD_MS = 5000;

function shouldSkipCache(sqlQuery: string): boolean {
    const upper = sqlQuery.toUpperCase().trim();
    return WRITE_KEYWORDS.some(k => upper.startsWith(k));
}

/**
 * Multi-pool connection manager (one pool per server profile), with a
 * TTL result cache for read queries and slow-query counters fed into the
 * audit monitor. Adapted from the source gateway; pool settings identical.
 */
class ConnectionManager {
    private pools = new Map<string, sql.ConnectionPool>();
    private connecting = new Map<string, Promise<sql.ConnectionPool>>();
    private healthStatus = new Map<string, boolean>();
    private cache = new Map<string, CacheEntry>();

    getDefaultServer(): string {
        return defaultProfileName();
    }

    getProfileNames(): string[] {
        return appConfig.profiles.map(p => p.name);
    }

    async getPool(serverProfile?: string): Promise<sql.ConnectionPool> {
        const profileName = (serverProfile || this.getDefaultServer()).toUpperCase();
        const existing = this.pools.get(profileName);
        if (existing?.connected) return existing;

        const pending = this.connecting.get(profileName);
        if (pending) return pending;

        const createPromise = this.createPool(profileName);
        this.connecting.set(profileName, createPromise);
        try {
            const pool = await createPromise;
            this.pools.set(profileName, pool);
            this.healthStatus.set(profileName, true);
            return pool;
        } catch (err) {
            this.healthStatus.set(profileName, false);
            throw err;
        } finally {
            this.connecting.delete(profileName);
        }
    }

    /** Pre-warm every configured pool in parallel; failures are non-fatal. */
    async warmUp(timeoutMs = 8000): Promise<void> {
        const names = this.getProfileNames();
        if (!names.length) {
            console.warn('[pool] no DATABASE_PROFILES_* configured — starting degraded (health OK, queries disabled)');
            return;
        }
        const work = names.map(async name => {
            try {
                await this.getPool(name);
                console.log(`[pool] ${name}: connected`);
            } catch (err) {
                console.warn(`[pool] ${name}: warmup failed — ${(err as Error).message}`);
                this.healthStatus.set(name, false);
            }
        });
        await Promise.race([
            Promise.allSettled(work),
            new Promise(res => setTimeout(res, timeoutMs)),
        ]);
    }

    private async createPool(profileName: string): Promise<sql.ConnectionPool> {
        const cfg = getProfile(profileName) ?? (() => { throw new Error(`Unknown server profile '${profileName}'. Available: ${this.getProfileNames().join(', ') || '(none)'}`); })();

        const pool = new sql.ConnectionPool({
            user: cfg.user,
            password: cfg.password,
            server: cfg.server,
            port: cfg.port,
            database: cfg.database,
            options: {
                encrypt: cfg.options.encrypt,
                trustServerCertificate: cfg.options.trustServerCertificate,
                useUTC: true,
                enableArithAbort: true,
            },
            requestTimeout: 120_000,
            connectionTimeout: 15_000,
            pool: {
                max: cfg.pool.max,
                min: cfg.pool.min,
                idleTimeoutMillis: cfg.pool.idleTimeoutMillis,
                acquireTimeoutMillis: cfg.pool.acquireTimeoutMillis,
            },
        });

        pool.on('error', (err: Error) => {
            console.error(`[pool] error [${profileName}]: ${err.message}`);
            this.healthStatus.set(profileName, false);
            this.pools.delete(profileName);
        });

        await pool.connect();
        console.log(`[pool] ${profileName} -> ${cfg.server}:${cfg.port} db=${cfg.database} readOnly=${cfg.readOnly}`);
        return pool;
    }

    /**
     * Execute a query. Read results are cached per (profile|db|sql|params)
     * for SQLGW_CACHE_TTL_MS; cache metrics flow into the monitor.
     */
    async query(
        sqlText: string,
        params?: Record<string, unknown>,
        database?: string,
        serverProfile?: string,
    ): Promise<sql.IResult<unknown>> {
        const skipCache = shouldSkipCache(sqlText);
        const cacheKey = `${(serverProfile || this.getDefaultServer()).toUpperCase()}|${database || ''}|${sqlText.trim().toUpperCase()}|${JSON.stringify(params || {})}`;

        if (!skipCache) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < appConfig.cacheTtlMs) {
                monitor.bumpCache('hits');
                return {
                    recordset: cached.data,
                    rowsAffected: [cached.data.length],
                    output: {},
                } as unknown as sql.IResult<unknown>;
            }
        }

        const pool = await this.getPool(serverProfile);
        const request = pool.request();

        if (params && Object.keys(params).length > 0) {
            for (const [key, value] of Object.entries(params)) {
                request.input(key, value);
            }
        }

        const finalQuery = database ? `USE [${database}]; ${sqlText}` : sqlText;
        const result = await request.query(finalQuery);

        monitor.bumpCache('misses');

        if (!skipCache) {
            this.cache.set(cacheKey, { data: result.recordset ?? [], timestamp: Date.now() });
            if (this.cache.size > 1000) this.pruneCache();
        }
        return result;
    }

    private pruneCache(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > appConfig.cacheTtlMs) this.cache.delete(key);
        }
    }

    purgeCache(): number {
        const n = this.cache.size;
        this.cache.clear();
        return n;
    }

    cacheStats(): { entries: number; ttlMs: number } {
        return { entries: this.cache.size, ttlMs: appConfig.cacheTtlMs };
    }

    isProfileReadOnly(serverProfile?: string): boolean {
        return getProfile(serverProfile)?.readOnly ?? true;
    }

    getServersStatus() {
        return appConfig.profiles.map(p => {
            const pool = this.pools.get(p.name);
            return {
                name: p.name,
                host: p.server,
                port: p.port,
                defaultDatabase: p.database,
                readOnly: p.readOnly,
                connected: pool?.connected ?? false,
                healthy: this.healthStatus.get(p.name) ?? false,
                pool: pool ? { size: pool.size, available: pool.available, pending: pool.pending } : null,
                isDefault: p.name === this.getDefaultServer(),
            };
        });
    }

    async closeAll(): Promise<void> {
        const closes = [...this.pools.entries()].map(async ([name, pool]) => {
            try { await pool.close(); } catch { /* already gone */ }
            console.log(`[pool] ${name}: closed`);
        });
        await Promise.allSettled(closes);
        this.pools.clear();
        this.healthStatus.clear();
    }
}

export const connectionManager = new ConnectionManager();

export function slowThresholdMs(): number {
    return SLOW_QUERY_THRESHOLD_MS;
}
