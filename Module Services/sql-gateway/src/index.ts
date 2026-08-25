import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { appConfig } from './config.js';
import { authPlugin } from './plugins/auth.js';
import { trafficPlugin } from './plugins/traffic.js';
import { queryRoutes } from './routes/query.js';
import { monitorRoutes } from './routes/monitor.js';
import { connectionManager } from './services/connectionManager.js';
import { monitor, writeHeartbeat } from './services/monitor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

async function main(): Promise<void> {
    await monitor.init();

    const app = Fastify({
        logger: { level: 'warn' },
        trustProxy: false, // req.ip stays the socket peer; XFF recorded separately for audit truth
        bodyLimit: 1_048_576,
        genReqId: () => randomUUID(),
    });

    // Hooks: traffic recording + identity/rate-limit (order matters:
    // onResponse always runs, preHandler resolves identity before handlers).
    await trafficPlugin(app);
    await authPlugin(app);

    // Health probe — no auth.
    app.get('/health', async () => {
        const profiles = connectionManager.getProfileNames();
        const servers = connectionManager.getServersStatus();
        return {
            status: 'ok',
            service: 'sql-gateway',
            timestamp: new Date().toISOString(),
            degraded: profiles.length === 0,
            profiles: profiles.length,
            poolsHealthy: servers.filter(s => s.healthy).length,
        };
    });

    // Login page — public; SSO via portal (recommended) or API-key entry.
    let loginHtmlCache: string | null = null;
    app.get('/login', async (_req, reply) => {
        if (!loginHtmlCache) {
            const raw = await readFile(join(publicDir, 'login.html'), 'utf-8');
            loginHtmlCache = raw.replaceAll('__LOGIN_URL__', appConfig.loginUrl);
        }
        return reply.status(200).type('text/html').send(loginHtmlCache);
    });

    // Unified dashboard UI (static, no build step) + APIs.
    if (existsSync(publicDir)) {
        await app.register(fastifyStatic, { root: publicDir, prefix: '/', index: 'index.html' });
    } else {
        console.warn('[ui] public/ dir missing — dashboard UI unavailable');
    }

    await app.register(queryRoutes);
    // Legacy alias: route gateway lama `/query` (rewritePath:false) meneruskan
    // path apa adanya, jadi `/query/v1/query` harus tetap dijawab di :8001.
    await app.register(queryRoutes, { prefix: '/query' });
    await app.register(monitorRoutes);

    // Graceful shutdown: flush heartbeat, close pools, stop listener.
    let shuttingDown = false;
    const shutdown = async (signal: string): Promise<void> => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`[sql-gateway] ${signal} received — shutting down...`);
        try {
            await writeHeartbeat();
            await connectionManager.closeAll();
            await app.close();
        } catch { /* best effort */ }
        process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
        console.error('[sql-gateway] unhandledRejection:', reason);
    });

    // Warm pools in the background so listen() is never blocked by a slow DB.
    void connectionManager.warmUp().then(() => writeHeartbeat()).catch(() => {});

    await app.listen({ port: appConfig.port, host: appConfig.host });
    console.log(`[sql-gateway] listening on http://${appConfig.host}:${appConfig.port}`);
    console.log(`[sql-gateway] UI: /  · API: /v1/* · monitoring: /monitor/* · health: /health`);
    console.log(`[sql-gateway] api keys loaded: ${appConfig.apiKeys.size} · profiles: ${connectionManager.getProfileNames().join(', ') || '(none)'}`);
}

main().catch(err => {
    console.error('[sql-gateway] fatal:', err);
    process.exit(1);
});
