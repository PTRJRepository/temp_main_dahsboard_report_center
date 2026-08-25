import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { ensureStorageRoot } from './lib/storage.js';
import { authRouter } from './routes/auth.js';
import { tasksRouter } from './routes/tasks.js';
import { assignmentsRouter } from './routes/assignments.js';
import { reviewRouter } from './routes/review.js';
import { filesRouter } from './routes/files.js';
import { systemRouter } from './routes/system.js';
import { metaRouter } from './routes/meta.js';
import { sceneRouter } from './routes/scene.js';
import { driveRouter } from './routes/drive.js';
import { gatewayRouter } from './routes/gateway.js';
import { mountUi, mountApiRewriter } from './ui/serve.js';

const app = express();

// Rewriter UI /api/file/* → /api/v1/* — WAJIB sebelum semua route API.
mountApiRewriter(app);

app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// health (public) — also under /rjfm and /file prefixes (rewritePath:false proxy)
for (const p of ['', '/rjfm', '/file']) {
  app.get(`${p}/health/live`, (_req, res) => res.json({ ok: true, service: 'rjfm', time: new Date().toISOString() }));
  app.get(`${p}/health/ready`, (_req, res) => res.json({ ok: true, service: 'rjfm', version: '1.0.0' }));
  app.get(`${p}/health`, (_req, res) => res.json({ status: 'Healthy', service: 'rjfm', time: new Date().toISOString() }));
}

// OpenAPI-aligned routes — mount for direct :8011, /rjfm/* and /file/* (gateway rewritePath:false)
for (const prefix of ['', '/rjfm', '/file']) {
  app.use(`${prefix}/api/v1/auth`, authRouter);
  app.use(`${prefix}/api/v1/tasks`, tasksRouter);
  app.use(`${prefix}/api/v1/assignments`, assignmentsRouter);
  app.use(`${prefix}/api/v1/submissions`, reviewRouter);
  app.use(`${prefix}/api/v1/files`, filesRouter);
  app.use(`${prefix}/api/v1/system`, systemRouter);
  app.use(`${prefix}/api/v1/drive`, driveRouter);
  app.use(`${prefix}/api/v1`, metaRouter);
  // sceneRouter WAJIB sebelum metaRouter — metaRouter punya catch-all
  // `app.use('/api/v1', ...)` yang menelan /meta/scene bila didahulukan.
  app.use(`${prefix}/api/v1/meta`, sceneRouter);
  app.use(`${prefix}/api/auth`, authRouter);
  app.use(`${prefix}/api/tasks`, tasksRouter);
  app.use(`${prefix}/api/assignments`, assignmentsRouter);
  app.use(`${prefix}/api/submissions`, reviewRouter);
  app.use(`${prefix}/api/files`, filesRouter);
  app.use(`${prefix}/api/system`, systemRouter);
  // Gateway NAS — service-to-service, auth via x-api-key (RJFM_API_KEY)
  app.use(`${prefix}/api/gateway`, gatewayRouter);
}

// Monolith UI — Next standalone build dilayani Express di port yang sama.
// Dipasang ASYNC: catch-all 404 baru ditambahkan setelah proxy UI siap,
// supaya urutan middleware benar (API → UI → 404).
mountUi(app).then(() => {
  app.use((_req, res) => res.status(404).json({ status: 'error', message: 'Not found' }));
});
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[rjfm]', err);
  res.status(err.status || 500).json({ status: 'error', message: err.message || 'Internal error' });
});

// Pastikan folder dasar tersedia di NAS (async, tidak menghalangi listen).
// Kegagalan dicatat tapi server tetap hidup — operasi berkas akan melapor
// dengan pesan jelas bila NAS belum terjangkau.
ensureStorageRoot().catch((e) => {
  console.warn('[rjfm] storage root belum siap:', e.message);
});

app.listen(env.port, '0.0.0.0', () => {
  console.log(`[rjfm] listening on :${env.port} env=${env.nodeEnv} db=${env.mssql.host}/${env.mssql.database}`);
});
