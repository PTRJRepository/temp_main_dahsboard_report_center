import type { FastifyInstance } from 'fastify';
import { monitor, type TrafficRecord } from '../services/monitor.js';

/**
 * Records every request/response into the audit monitor:
 * socket IP + forwarded client IP, method/path, status, duration, bytes,
 * user agent and resolved caller identity. Also persisted as daily JSONL.
 */
export async function trafficPlugin(app: FastifyInstance): Promise<void> {
    app.addHook('onResponse', async (req, reply) => {
        const xff = req.headers['x-forwarded-for'];
        const record: TrafficRecord = {
            id: String(req.id),
            ts: Date.now(),
            ip: req.ip,
            clientIp: typeof xff === 'string' && xff.length ? xff.split(',')[0].trim() : null,
            method: req.method,
            path: req.url.split('?')[0],
            status: reply.statusCode,
            durMs: Math.round((reply.elapsedTime ?? 0) * 100) / 100,
            bytes: Number(reply.getHeader('content-length') ?? 0),
            ua: String(req.headers['user-agent'] ?? '').slice(0, 200),
            caller: req.identity?.caller ?? 'anon',
            mode: req.identity?.mode ?? 'none',
        };
        monitor.recordRequest(record);
    });
}
