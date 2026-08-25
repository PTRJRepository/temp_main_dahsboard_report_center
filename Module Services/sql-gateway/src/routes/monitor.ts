import type { FastifyInstance } from 'fastify';
import { monitor, writeHeartbeat } from '../services/monitor.js';
import { connectionManager } from '../services/connectionManager.js';
import { appConfig } from '../config.js';

function parseMinutes(raw: unknown, fallback = 60): number {
    const n = parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(n, 1440 * 7);
}

/** Monitoring & audit API consumed by the unified dashboard UI (/monitor/*). */
export async function monitorRoutes(app: FastifyInstance): Promise<void> {

    /** GET /monitor/overview — headline stats + counters + pool health + log files. */
    app.get<{ Querystring: { minutes?: string } }>('/monitor/overview', async (req) => {
        const minutes = parseMinutes(req.query.minutes);
        return {
            success: true,
            data: {
                stats: monitor.stats(minutes),
                status: monitor.status(),
                servers: connectionManager.getServersStatus(),
                cache: connectionManager.cacheStats(),
                config: {
                    retentionDays: appConfig.logRetentionDays,
                    rateLimitPerMin: appConfig.rateLimitPerMin,
                    fullAccessWindow: { profile: appConfig.fullAccessProfile, db: appConfig.fullAccessDb },
                    defaultServer: connectionManager.getDefaultServer(),
                    profilesConfigured: connectionManager.getProfileNames().length,
                },
                identity: req.identity,
            },
            error: null,
        };
    });

    /** GET /monitor/requests — traffic log with filters. */
    app.get<{ Querystring: Record<string, string> }>('/monitor/requests', async (req) => {
        const q = req.query;
        return {
            success: true,
            data: monitor.recentRequests({
                limit: parseInt(q.limit ?? '100', 10),
                minutes: q.minutes ? parseMinutes(q.minutes) : undefined,
                caller: q.caller || undefined,
                ip: q.ip || undefined,
                statusClass: q.statusClass || undefined,
                q: q.q || undefined,
            }),
            error: null,
        };
    });

    /** GET /monitor/queries — SQL audit log with filters. */
    app.get<{ Querystring: Record<string, string> }>('/monitor/queries', async (req) => {
        const q = req.query;
        return {
            success: true,
            data: monitor.recentQueries({
                limit: parseInt(q.limit ?? '100', 10),
                minutes: q.minutes ? parseMinutes(q.minutes) : undefined,
                caller: q.caller || undefined,
                q: q.q || undefined,
            }),
            error: null,
        };
    });

    /** GET /monitor/security — blocked/failed auth/rate-limit/spoof events. */
    app.get<{ Querystring: Record<string, string> }>('/monitor/security', async (req) => {
        const q = req.query;
        return {
            success: true,
            data: monitor.recentSecurity({
                limit: parseInt(q.limit ?? '100', 10),
                minutes: q.minutes ? parseMinutes(q.minutes) : undefined,
                kind: q.kind || undefined,
                ip: q.ip || undefined,
            }),
            error: null,
        };
    });

    /** GET /monitor/callers — per-caller/per-mode aggregation within window. */
    app.get<{ Querystring: { minutes?: string } }>('/monitor/callers', async (req) => {
        return { success: true, data: monitor.callerSummary(parseMinutes(req.query.minutes)), error: null };
    });

    /** GET /monitor/logs — list persisted JSONL audit files. */
    app.get('/monitor/logs', async () => {
        const files = await monitor.listFiles();
        return { success: true, data: { dir: appConfig.logDir, files, retentionDays: appConfig.logRetentionDays }, error: null };
    });

    /** POST /monitor/heartbeat — flush a heartbeat marker (ops check). */
    app.post('/monitor/heartbeat', async () => {
        await writeHeartbeat();
        return { success: true, error: null };
    });

    /** GET /monitor/self — echo resolved identity (integration debugging). */
    app.get('/monitor/self', async (req) => {
        return { success: true, data: req.identity, error: null };
    });
}
