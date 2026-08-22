// Serve UI RJFM (Next standalone build dari ui-app/ milik modul ini)
// + rewrite /api/file/* → /api/v1/* — semua dalam satu port 8011.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { env } from '../config/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Isolasi modul: build UI berada DI DALAM folder modul ini.
// Turbopack root = repo root, jadi output standalone menempel path relatif
// dari repo root: .next/standalone/Module Services/rjfm/ui-app
const STANDALONE = process.env.RJFM_UI_STANDALONE
  || path.resolve(__dirname, '../../ui-app/.next/standalone/Module Services/rjfm/ui-app')
const STATIC_ASSETS = path.resolve(__dirname, '../../ui-app/.next/static')
const PUBLIC_DIR = path.join(STANDALONE, 'public')

export function mountUi(app: express.Express): Promise<void> {
  if (!fs.existsSync(path.join(STANDALONE, 'server.js'))) {
    console.log('[rjfm-ui] standalone build tidak ditemukan — UI dimatikan (jalankan: cd Dashboard_Utama && npx next build)')
    return Promise.resolve()
  }
  // (mounting continues below; always returns a promise)

  // Proxy API untuk UI: /api/file/* → /api/v1/*.
  // WAJIB app-level (bukan router ter-scope): req.url di dalam middleware
  // ter-scope '/api/file' hanya berisi SUFFIX ('/login'), dan mengubah itu
  // tidak mengubah path matching layer berikutnya. Rewrite di level app
  // memodifikasi full URL sehingga Express match /api/v1/* dengan benar.
  app.use((req: any, res: any, next: any) => {
    if (req.url === '/api/file' || req.url.startsWith('/api/file/')) {
      req.url = '/api/v1' + req.url.slice('/api/file'.length)
    }
    next()
  })

  // Static assets Next (_next/static) + public/
  if (fs.existsSync(STATIC_ASSETS)) app.use('/_next/static', express.static(STATIC_ASSETS, { maxAge: '365d', immutable: true }))
  if (fs.existsSync(PUBLIC_DIR)) app.use(express.static(PUBLIC_DIR))

  // Semua halaman lain → server Next standalone.
  // Next 16 standalone's server.js LISTENS ITSELF (ignores later PORT mutation),
  // so it must bind a PRIVATE port — never env.port (that's express's). It is
  // then reverse-proxied from this express app. RJFM_UI_PORT overrides.
  const uiPort = parseInt(process.env.RJFM_UI_PORT || '8012', 10)
  process.env.PORT = String(uiPort)
  process.env.HOSTNAME = '127.0.0.1'
  // UI routes call back into the express API — pin the API base explicitly
  // (default derives from PORT, which here is the private UI port, not :8011).
  process.env.RJFM_API_PORT = String(env.port)
  const serverPath = path.join(STANDALONE, 'server.js').replace(/\\/g, '/')
  const url = 'file:///' + encodeURI(serverPath).replace(/^\/+/, '')

  return import(/* webpackIgnore: true */ url)
    .then(async (mod: any) => {
      // Wait for the standalone server to accept connections on uiPort…
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 250))
        try { await fetch(`http://127.0.0.1:${uiPort}/`); break } catch { /* not yet */ }
      }
      const { createProxyMiddleware } = await import('http-proxy-middleware')
      app.use('/', createProxyMiddleware({
        target: `http://127.0.0.1:${uiPort}`,
        changeOrigin: true,
        ws: true,
        // express API routes were mounted earlier, so they win by order;
        // anything reaching here is a UI page/asset.
      }))
      console.log(`[rjfm-ui] monolith ON — UI di port ${env.port} via internal :${uiPort} (standalone: ${STANDALONE})`)
    })
    .catch((e) => {
      console.error('[rjfm-ui] gagal memuat next server:', e.message)
    })
}
