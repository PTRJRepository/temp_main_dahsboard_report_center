import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { appConfig, defaultProfileName, getProfile } from '../config.js';
import { connectionManager } from '../services/connectionManager.js';
import { queryValidator } from '../services/queryValidator.js';
import { monitor, type QueryRecord } from '../services/monitor.js';
import type { RequestIdentity } from '../plugins/auth.js';

interface QueryBody {
    sql: string;
    database?: string;
    server?: string;
    params?: Record<string, unknown>;
}

interface BatchQueryBody {
    queries: Array<{ sql: string; params?: Record<string, unknown> }>;
    database?: string;
    server?: string;
}

function fail(server: string | undefined, db: string | undefined, error: string, startedAt: number, code = 400) {
    return {
        statusCode: code,
        body: {
            success: false,
            server: server || defaultProfileName(),
            db: db || null,
            execution_ms: round1(performance.now() - startedAt),
            data: null,
            error,
        },
    };
}

function round1(n: number): number {
    return Math.round(n * 100) / 100;
}

/**
 * Whether this caller may perform write/DDL on the target profile+db.
 * Rule (mirrors the source gateway, extended per-caller):
 *   fullAccess caller AND (profile = SQLGW_FULLACCESS_PROFILE AND db = SQLGW_FULLACCESS_DB)
 * Full-access callers = non-readOnly API keys, or portal users with role ADMIN.
 */
function computeFullAccess(identity: RequestIdentity, serverProfile?: string, database?: string): boolean {
    if (identity.readOnly) return false;
    const profileName = (serverProfile || defaultProfileName()).toUpperCase();
    const dbName = (database || getProfile(profileName)?.database || '').toLowerCase();
    return profileName === appConfig.fullAccessProfile && dbName === appConfig.fullAccessDb;
}

function recordQuery(req: FastifyRequest, opts: {
    sqlText: string; params?: Record<string, unknown>;
    server: string; db: string;
    execMs: number; rows: number; cacheHit: boolean;
    decision: QueryRecord['decision']; queryType?: string; error?: string;
}): void {
    const id = req.identity;
    const rec: QueryRecord = {
        id: String(req.id),
        ts: Date.now(),
        caller: id?.caller ?? 'anon',
        mode: id?.mode ?? 'none',
        ip: req.ip,
        server: opts.server,
        db: opts.db,
        sqlHash: createHash('sha256').update(opts.sqlText).digest('hex').slice(0, 16),
        sqlPreview: opts.sqlText.replace(/\s+/g, ' ').trim().slice(0, 400),
        paramKeys: opts.params ? Object.keys(opts.params) : [],
        rows: opts.rows,
        execMs: round1(opts.execMs),
        cacheHit: opts.cacheHit,
        decision: opts.decision,
        queryType: opts.queryType,
        error: opts.error ? String(opts.error).slice(0, 400) : undefined,
    };
    monitor.recordQuery(rec);
    if (opts.decision === 'blocked') {
        monitor.recordSecurity({
            kind: 'blocked-sql',
            ip: req.ip,
            caller: rec.caller,
            detail: `${opts.queryType ?? 'WRITE'} blocked on ${opts.server}/${opts.db}: ${rec.sqlPreview.slice(0, 200)}`,
            path: '/v1/query',
        });
    }
}

export async function queryRoutes(app: FastifyInstance): Promise<void> {

    /** GET /v1/servers — profile list with pool health. */
    app.get('/v1/servers', async () => {
        const servers = connectionManager.getServersStatus();
        return {
            success: true,
            data: {
                servers,
                total: servers.length,
                defaultServer: connectionManager.getDefaultServer(),
                fullAccessWindow: {
                    profile: appConfig.fullAccessProfile,
                    db: appConfig.fullAccessDb,
                },
            },
            error: null,
        };
    });

    /** GET /v1/databases?server= — databases on a profile's server. */
    app.get<{ Querystring: { server?: string } }>('/v1/databases', async (req, reply) => {
        const startedAt = performance.now();
        const serverProfile = req.query.server;
        try {
            const result = await connectionManager.query(
                'SELECT name FROM sys.databases WHERE state = 0 ORDER BY name',
                undefined,
                undefined,
                serverProfile,
            );
            const databases = ((result.recordset ?? []) as Array<{ name: string }>).map(r => r.name);
            return {
                success: true,
                server: serverProfile || connectionManager.getDefaultServer(),
                data: { databases, total: databases.length },
                error: null,
            };
        } catch (err) {
            const f = fail(serverProfile, undefined, `Failed to list databases: ${(err as Error).message}`, startedAt, 500);
            return reply.code(f.statusCode).send(f.body);
        }
    });

    /** POST /v1/query — execute a single SQL statement. */
    app.post<{ Body: QueryBody }>('/v1/query', async (req, reply) => {
        const startedAt = performance.now();
        const { sql, database, server, params } = req.body ?? {} as QueryBody;

        if (!sql || typeof sql !== 'string') {
            const f = fail(server, database, 'Missing required field: sql', startedAt);
            return reply.code(f.statusCode).send(f.body);
        }
        if (sql.length > appConfig.maxSqlLength) {
            const f = fail(server, database, `SQL too long (${sql.length} > ${appConfig.maxSqlLength} chars)`, startedAt);
            return reply.code(f.statusCode).send(f.body);
        }

        const serverName = (server || defaultProfileName()).toUpperCase();
        const dbName = database || '';

        // Profile-level read-only switch
        if (connectionManager.isProfileReadOnly(serverName)) {
            const validationRO = queryValidator.validate(sql, false);
            if (!validationRO.valid) {
                recordQuery(req, {
                    sqlText: sql, params, server: serverName, db: dbName,
                    execMs: performance.now() - startedAt, rows: 0, cacheHit: false,
                    decision: 'blocked', queryType: validationRO.queryType, error: validationRO.error,
                });
                const f = fail(serverName, dbName, validationRO.error ?? 'Blocked', startedAt, 403);
                return reply.code(f.statusCode).send(f.body);
            }
        }

        // Caller-permission validation
        const hasFullAccess = computeFullAccess(req.identity!, server, database);
        const validation = queryValidator.validate(sql, hasFullAccess);
        if (!validation.valid) {
            recordQuery(req, {
                sqlText: sql, params, server: serverName, db: dbName,
                execMs: performance.now() - startedAt, rows: 0, cacheHit: false,
                decision: 'blocked', queryType: validation.queryType, error: validation.error,
            });
            const f = fail(serverName, dbName, validation.error ?? 'Blocked', startedAt, 403);
            return reply.code(f.statusCode).send(f.body);
        }

        try {
            const cacheHitsBefore = monitor.counters.cacheHits;
            const t0 = performance.now();
            const result = await connectionManager.query(sql, params, database, server);
            const execMs = performance.now() - t0;
            const rows = Array.isArray(result.recordset) ? result.recordset.length : Number(result.rowsAffected?.[0] ?? 0);
            const wasCached = monitor.counters.cacheHits > cacheHitsBefore;

            recordQuery(req, {
                sqlText: sql, params, server: serverName, db: dbName,
                execMs, rows, cacheHit: wasCached,
                decision: 'allowed',
            });

            return {
                success: true,
                server: serverName,
                db: dbName || 'default',
                execution_ms: round1(execMs),
                data: { recordset: result.recordset, rowsAffected: result.rowsAffected },
                error: null,
            };
        } catch (err) {
            const message = (err as Error).message;
            recordQuery(req, {
                sqlText: sql, params, server: serverName, db: dbName,
                execMs: performance.now() - startedAt, rows: 0, cacheHit: false,
                decision: 'error', error: message,
            });
            const f = fail(serverName, dbName, `Database error: ${message}`, startedAt, 500);
            return reply.code(f.statusCode).send(f.body);
        }
    });

    /** POST /v1/query/batch — sequential multi-statement execution. */
    app.post<{ Body: BatchQueryBody }>('/v1/query/batch', async (req, reply) => {
        const startedAt = performance.now();
        const { queries, database, server } = req.body ?? {} as BatchQueryBody;

        if (!Array.isArray(queries) || queries.length === 0) {
            const f = fail(server, database, 'Missing required field: queries array', startedAt);
            return reply.code(f.statusCode).send(f.body);
        }
        if (queries.length > appConfig.maxBatchQueries) {
            const f = fail(server, database, `Batch too large (${queries.length} > ${appConfig.maxBatchQueries})`, startedAt);
            return reply.code(f.statusCode).send(f.body);
        }

        const hasFullAccess = computeFullAccess(req.identity!, server, database);
        for (let i = 0; i < queries.length; i++) {
            const v = queryValidator.validate(String(queries[i]?.sql ?? ''), hasFullAccess);
            if (!v.valid) {
                recordQuery(req, {
                    sqlText: String(queries[i]?.sql ?? ''), params: queries[i]?.params,
                    server: (server || defaultProfileName()).toUpperCase(), db: database || '',
                    execMs: performance.now() - startedAt, rows: 0, cacheHit: false,
                    decision: 'blocked', queryType: v.queryType, error: `batch[${i}]: ${v.error}`,
                });
                const f = fail(server, database, `Query ${i + 1} validation failed: ${v.error}`, startedAt, 403);
                return reply.code(f.statusCode).send(f.body);
            }
        }

        try {
            const results: unknown[] = [];
            for (const q of queries) {
                const result = await connectionManager.query(q.sql, q.params, database, server);
                results.push({ recordset: result.recordset, rowsAffected: result.rowsAffected });
            }
            recordQuery(req, {
                sqlText: `[batch x${queries.length}]`, params: undefined,
                server: (server || defaultProfileName()).toUpperCase(), db: database || '',
                execMs: performance.now() - startedAt, rows: results.length, cacheHit: false,
                decision: 'allowed', queryType: 'BATCH',
            });
            return {
                success: true,
                server: (server || defaultProfileName()).toUpperCase(),
                db: database || 'default',
                execution_ms: round1(performance.now() - startedAt),
                data: { results, transactionCommitted: false, note: 'Sequential mode: no transaction wrapping' },
                error: null,
            };
        } catch (err) {
            const f = fail(server, database, `Batch query failed: ${(err as Error).message}`, startedAt, 500);
            recordQuery(req, {
                sqlText: '[batch]', server: (server || defaultProfileName()).toUpperCase(), db: database || '',
                execMs: performance.now() - startedAt, rows: 0, cacheHit: false,
                decision: 'error', error: (err as Error).message,
            });
            return reply.code(f.statusCode).send(f.body);
        }
    });

    /** DELETE /v1/cache — purge the read-result cache. */
    app.delete('/v1/cache', async () => {
        const purged = connectionManager.purgeCache();
        return { success: true, data: { purgedEntries: purged }, error: null };
    });

    /** GET /v1/cache — cache stats. */
    app.get('/v1/cache', async () => {
        return { success: true, data: connectionManager.cacheStats(), error: null };
    });
}

