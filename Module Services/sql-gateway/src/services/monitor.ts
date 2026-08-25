import { appendFile, mkdir, readdir, stat, unlink } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { appConfig } from '../config.js';

const fsAppendFile = promisify(appendFile);
const fsMkdir = promisify(mkdir);
const fsReaddir = promisify(readdir);
const fsStat = promisify(stat);
const fsUnlink = promisify(unlink);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrafficRecord {
    id: string;
    ts: number;
    ip: string;            // socket peer (truth)
    clientIp: string | null; // X-Forwarded-For first hop (real client via gateway)
    method: string;
    path: string;
    status: number;
    durMs: number;
    bytes: number;
    ua: string;
    caller: string;        // 'api:<name>' | 'user:<name>' | 'anon' | 'rejected'
    mode: string;          // 'api-key' | 'gateway' | 'cookie' | 'none'
}

export interface QueryRecord {
    id: string;
    ts: number;
    caller: string;
    mode: string;
    ip: string;
    server: string;
    db: string;
    sqlHash: string;
    sqlPreview: string;
    paramKeys: string[];
    rows: number;
    execMs: number;
    cacheHit: boolean;
    decision: 'allowed' | 'blocked' | 'error';
    queryType?: string;
    error?: string;
}

export interface SecurityEvent {
    id: string;
    ts: number;
    kind: string;          // 'invalid-api-key' | 'spoof-attempt' | 'blocked-sql' | 'rate-limited' | 'unauthorized' | ...
    ip: string;
    caller: string;
    detail: string;
    path?: string;
}

// ─── Ring buffer (circular) ──────────────────────────────────────────────────

class Ring<T> {
    private buf: (T | undefined)[];
    private head = 0; // next write index
    private count = 0;

    constructor(capacity: number) {
        this.buf = new Array(capacity);
    }

    push(item: T): void {
        this.buf[this.head] = item;
        this.head = (this.head + 1) % this.buf.length;
        if (this.count < this.buf.length) this.count++;
    }

    /** Newest-first snapshot. */
    latest(): T[] {
        const out: T[] = [];
        for (let i = 1; i <= this.count; i++) {
            const idx = (this.head - i + this.buf.length * 2) % this.buf.length;
            const v = this.buf[idx];
            if (v !== undefined) out.push(v);
        }
        return out;
    }

    get size(): number {
        return this.count;
    }
}

// ─── JSONL sink ──────────────────────────────────────────────────────────────

type SinkKind = 'traffic' | 'queries' | 'security';

const dayKey = (ts: number): string => new Date(ts).toISOString().slice(0, 10);

class JsonlSink {
    private dirReady = false;
    private dropped = 0;
    private writtenPerKind: Record<SinkKind, { file: string; bytes: number }> = {
        traffic: { file: '', bytes: 0 },
        queries: { file: '', bytes: 0 },
        security: { file: '', bytes: 0 },
    };

    constructor(private dir: string) {}

    async init(): Promise<void> {
        if (this.dirReady) return;
        if (!existsSync(this.dir)) await fsMkdir(this.dir, { recursive: true });
        this.dirReady = true;
        pruneOldLogs().catch(() => {});
    }

    append(kind: SinkKind, record: object): void {
        const line = JSON.stringify(record) + '\n';
        const file = join(this.dir, `${kind}-${dayKey(Date.now())}.jsonl`);
        const meta = this.writtenPerKind[kind];
        // Size guard: stop writing when today's file exceeds cap (audit integrity
        // beats silent overwrite; rotation happens naturally at midnight).
        if (meta.file === file && meta.bytes > appConfig.logMaxFileBytes) {
            this.dropped++;
            return;
        }
        appendFile(file, line, { flag: 'a' }, (err) => {
            if (err) {
                this.dropped++;
                if (this.dropped === 1 || this.dropped % 500 === 0) {
                    console.warn(`[monitor] jsonl write failed (${this.dropped} dropped): ${err.message}`);
                }
            }
        });
        if (meta.file !== file) {
            meta.file = file;
            meta.bytes = Buffer.byteLength(line);
        } else {
            meta.bytes += Buffer.byteLength(line);
        }
    }

    async listFiles(): Promise<Array<{ name: string; sizeBytes: number; mtime: string }>> {
        if (!existsSync(this.dir)) return [];
        const names = await fsReaddir(this.dir).catch(() => [] as string[]);
        const out: Array<{ name: string; sizeBytes: number; mtime: string }> = [];
        for (const name of names.sort().reverse()) {
            if (!name.endsWith('.jsonl')) continue;
            try {
                const st = await fsStat(join(this.dir, name));
                out.push({ name, sizeBytes: st.size, mtime: st.mtime.toISOString() });
            } catch { /* raced unlink — skip */ }
        }
        return out.slice(0, 200);
    }

    get dropCount(): number { return this.dropped; }
}

/** Delete rotated log files older than the retention window. */
async function pruneOldLogs(): Promise<void> {
    const dir = appConfig.logDir;
    if (!existsSync(dir)) return;
    const cutoff = Date.now() - appConfig.logRetentionDays * 86_400_000;
    const names = await fsReaddir(dir).catch(() => [] as string[]);
    for (const name of names) {
        const m = /^(\w+)-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(name);
        if (!m) continue;
        const fileTs = Date.parse(`${m[2]}T00:00:00Z`);
        if (Number.isFinite(fileTs) && fileTs < cutoff) {
            void fsUnlink(join(dir, name)).catch(() => {});
        }
    }
}

// ─── Monitor singleton ───────────────────────────────────────────────────────

class Monitor {
    readonly requests: Ring<TrafficRecord>;
    readonly queries: Ring<QueryRecord>;
    readonly security: Ring<SecurityEvent>;
    private sink: JsonlSink;
    private lastPrune = Date.now();

    counters = {
        startedAt: Date.now(),
        totalRequests: 0,
        totalQueries: 0,
        cacheHits: 0,
        cacheMisses: 0,
        slowQueries: 0,
        blockedQueries: 0,
        securityEvents: 0,
        rateLimited: 0,
    };

    constructor() {
        this.requests = new Ring<TrafficRecord>(appConfig.requestRingSize);
        this.queries = new Ring<QueryRecord>(appConfig.queryRingSize);
        this.security = new Ring<SecurityEvent>(appConfig.securityRingSize);
        this.sink = new JsonlSink(appConfig.logDir);
    }

    async init(): Promise<void> {
        await this.sink.init();
    }

    recordRequest(r: TrafficRecord): void {
        this.counters.totalRequests++;
        this.requests.push(r);
        this.sink.append('traffic', r);
        if (r.status === 401 || r.status === 403 || r.status === 429) {
            this.recordSecurity({
                kind: r.status === 429 ? 'rate-limited' : 'unauthorized',
                ip: r.ip,
                caller: r.caller,
                detail: `HTTP ${r.status} on ${r.method} ${r.path}`,
                path: r.path,
                ts: r.ts,
            });
        }
        this.maybePrune();
    }

    recordQuery(r: QueryRecord): void {
        this.counters.totalQueries++;
        if (r.cacheHit) this.counters.cacheHits++; else this.counters.cacheMisses++;
        if (!r.cacheHit && r.decision === 'allowed' && r.execMs > 5000) this.counters.slowQueries++;
        if (r.decision === 'blocked') this.counters.blockedQueries++;
        this.queries.push(r);
        this.sink.append('queries', r);
    }

    recordSecurity(e: { kind: string; ip: string; caller: string; detail: string; path?: string; ts?: number }): SecurityEvent {
        const ev: SecurityEvent = {
            id: randomId(),
            ts: e.ts ?? Date.now(),
            kind: e.kind,
            ip: e.ip,
            caller: e.caller,
            detail: String(e.detail).slice(0, 400),
            path: e.path,
        };
        this.counters.securityEvents++;
        if (ev.kind === 'rate-limited') this.counters.rateLimited++;
        this.security.push(ev);
        this.sink.append('security', ev);
        return ev;
    }

    bumpCache(counter: 'hits' | 'misses'): void {
        if (counter === 'hits') this.counters.cacheHits++; else this.counters.cacheMisses++;
    }

    private maybePrune(): void {
        const now = Date.now();
        if (now - this.lastPrune > 6 * 3_600_000) {
            this.lastPrune = now;
            pruneOldLogs().catch(() => {});
        }
    }

    // ── Aggregations ──

    stats(minutes: number) {
        const sinceTs = Date.now() - minutes * 60_000;
        const reqs = this.requests.latest().filter(r => r.ts >= sinceTs);
        const qs = this.queries.latest().filter(q => q.ts >= sinceTs);

        const latencies = reqs.map(r => r.durMs).sort((a, b) => a - b);
        const pick = (p: number): number => latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))] : 0;
        const avg = latencies.length ? latencies.reduce((s, v) => s + v, 0) / latencies.length : 0;

        let ok2xx = 0, err4xx = 0, err5xx = 0;
        for (const r of reqs) {
            if (r.status >= 500) err5xx++;
            else if (r.status >= 400) err4xx++;
            else ok2xx++;
        }

        const perCaller = new Map<string, { requests: number; errors: number; avgMs: number; _sum: number }>();
        const perIp = new Map<string, number>();
        const buckets = new Map<string, { req: number; err: number; q: number }>();

        for (const r of reqs) {
            const c = perCaller.get(r.caller) || { requests: 0, errors: 0, avgMs: 0, _sum: 0 };
            c.requests++;
            c._sum += r.durMs;
            if (r.status >= 400) c.errors++;
            c.avgMs = Math.round(c._sum / c.requests);
            perCaller.set(r.caller, c);

            perIp.set(r.clientIp || r.ip, (perIp.get(r.clientIp || r.ip) || 0) + 1);

            const key = new Date(r.ts).toISOString().slice(0, 16); // minute bucket
            const b = buckets.get(key) || { req: 0, err: 0, q: 0 };
            b.req++;
            if (r.status >= 400) b.err++;
            buckets.set(key, b);
        }
        for (const q of qs) {
            const key = new Date(q.ts).toISOString().slice(0, 16);
            const b = buckets.get(key) || { req: 0, err: 0, q: 0 };
            b.q++;
            buckets.set(key, b);
        }

        const topIps = [...perIp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([ip, count]) => ({ ip, count }));

        const slowest = [...qs].sort((a, b) => b.execMs - a.execMs).slice(0, 5)
            .map(q => ({ ts: q.ts, server: q.server, db: q.db, execMs: q.execMs, sqlPreview: q.sqlPreview, caller: q.caller }));

        const cacheTotal = this.counters.cacheHits + this.counters.cacheMisses;

        return {
            windowMinutes: minutes,
            requests: {
                total: reqs.length,
                ok2xx, err4xx, err5xx,
                errorRate: reqs.length ? Number((((err4xx + err5xx) / reqs.length) * 100).toFixed(2)) : 0,
                avgMs: Math.round(avg),
                p50Ms: Math.round(pick(0.5)),
                p95Ms: Math.round(pick(0.95)),
            },
            queries: {
                total: qs.length,
                blocked: qs.filter(q => q.decision === 'blocked').length,
                errors: qs.filter(q => q.decision === 'error').length,
                cacheHits: qs.filter(q => q.cacheHit).length,
                slow: qs.filter(q => !q.cacheHit && q.execMs > 5000).length,
                avgMs: qs.length ? Math.round(qs.reduce((s, q) => s + q.execMs, 0) / qs.length) : 0,
            },
            cacheHitRatePct: cacheTotal ? Number(((this.counters.cacheHits / cacheTotal) * 100).toFixed(2)) : 0,
            callers: [...perCaller.entries()].map(([caller, c]) => ({ caller, ...c })).sort((a, b) => b.requests - a.requests),
            topIps,
            series: [...buckets.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)
                .map(([minute, b]) => ({ minute, ...b })),
            slowestQueries: slowest,
        };
    }

    recentRequests(opts: { limit?: number; minutes?: number; caller?: string; ip?: string; statusClass?: string; q?: string }): TrafficRecord[] {
        return filterLatest(this.requests.latest(), opts, r => [r.path, r.caller, r.ip, r.clientIp ?? '', String(r.status)]);
    }

    recentQueries(opts: { limit?: number; minutes?: number; caller?: string; q?: string }): QueryRecord[] {
        return filterLatest(this.queries.latest(), opts, r => [r.sqlPreview, r.db, r.server, r.caller]);
    }

    recentSecurity(opts: { limit?: number; minutes?: number; kind?: string; ip?: string }): SecurityEvent[] {
        return filterLatest(this.security.latest(), opts, r => [r.kind, r.detail, r.ip, r.caller]);
    }

    callerSummary(minutes: number) {
        const sinceTs = Date.now() - minutes * 60_000;
        const reqs = this.requests.latest().filter(r => r.ts >= sinceTs);
        const map = new Map<string, { caller: string; mode: string; requests: number; errors: number; lastSeen: number; ips: Set<string> }>();
        for (const r of reqs) {
            const key = `${r.mode}|${r.caller}`;
            let c = map.get(key);
            if (!c) {
                c = { caller: r.caller, mode: r.mode, requests: 0, errors: 0, lastSeen: 0, ips: new Set<string>() };
                map.set(key, c);
            }
            c.requests++;
            if (r.status >= 400) c.errors++;
            c.lastSeen = Math.max(c.lastSeen, r.ts);
            c.ips.add(r.clientIp || r.ip);
        }
        return [...map.values()]
            .map(c => ({ ...c, ips: [...c.ips].slice(0, 8) }))
            .sort((a, b) => b.requests - a.requests);
    }

    status() {
        return {
            rings: { requests: this.requests.size, queries: this.queries.size, security: this.security.size },
            counters: this.counters,
            sinkDropped: this.sink.dropCount,
            uptimeSec: Math.round((Date.now() - this.counters.startedAt) / 1000),
        };
    }

    listFiles() {
        return this.sink.listFiles();
    }
}

function filterLatest<T extends { ts: number }>(
    items: T[],
    opts: { limit?: number; minutes?: number; caller?: string; ip?: string; kind?: string; statusClass?: string; q?: string },
    searchable: (item: T) => string[],
): T[] {
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 1000);
    const sinceTs = opts.minutes ? Date.now() - opts.minutes * 60_000 : 0;
    const qLower = opts.q?.toLowerCase();
    const out: T[] = [];
    for (const item of items) { // already newest-first
        if (sinceTs && item.ts < sinceTs) break;
        const rec = item as unknown as Record<string, unknown>;
        if (opts.caller && rec.caller !== opts.caller) continue;
        if (opts.ip && rec.ip !== opts.ip && rec.clientIp !== opts.ip) continue;
        if (opts.kind && rec.kind !== opts.kind) continue;
        if (opts.statusClass) {
            const s = Number(rec.status) || 0;
            if (opts.statusClass === '2xx' && !(s >= 200 && s < 300)) continue;
            if (opts.statusClass === '4xx' && !(s >= 400 && s < 500)) continue;
            if (opts.statusClass === '5xx' && s < 500) continue;
        }
        if (qLower) {
            const hay = searchable(item).join(' ').toLowerCase();
            if (!hay.includes(qLower)) continue;
        }
        out.push(item);
        if (out.length >= limit) break;
    }
    return out;
}

function randomId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const monitor = new Monitor();

/** Force a flush point: rewrite a heartbeat marker so operators can verify the sink works. */
export async function writeHeartbeat(): Promise<void> {
    const dir = appConfig.logDir;
    await writeFile(join(dir, 'heartbeat.json'), JSON.stringify({ ts: new Date().toISOString(), ...monitor.status() }, null, 2));
}
