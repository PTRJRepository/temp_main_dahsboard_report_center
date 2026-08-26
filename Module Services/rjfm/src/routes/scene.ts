// Scene photo — cari foto ilustrasi estate via shared/google-image-search,
// unduh berkasnya, simpan ke NAS folder scene/ lalu sajikan dari situ.
// Cache per query: pencarian hanya terjadi sekali per kata kunci.
import { Router } from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { auth, MANAGER_ROLES } from '../middleware/auth.js'
import { saveBuffer, statRemote, downloadBuffer } from '../lib/storage.js'
import { env } from '../config/env.js'

export const sceneRouter = Router()

type SceneEntry = { storagePath: string; credit: string; source: string; addedAt: string }

// cache in-memory: query → entry (persisten sebenarnya di NAS scene/index.json)
const memoryCache = new Map<string, SceneEntry>()
let indexLoaded = false

const SCENE_DIR = 'scene'

function sceneIndexPath(): string {
  return `${SCENE_DIR}/index.json`
}

async function loadIndex(): Promise<Map<string, SceneEntry>> {
  if (indexLoaded) return memoryCache
  try {
    const buf = await downloadBuffer(sceneIndexPath())
    if (buf) {
      const arr = JSON.parse(buf.toString('utf8')) as Array<SceneEntry & { q: string }>
      for (const e of arr) memoryCache.set(e.q, { storagePath: e.storagePath, credit: e.credit, source: e.source, addedAt: e.addedAt })
    }
  } catch { /* belum ada index — mulai kosong */ }
  indexLoaded = true
  return memoryCache
}

async function saveIndex(): Promise<void> {
  const entries = [...memoryCache.entries()].map(([q, e]) => ({ q, ...e }))
  const dirAbs = `${env.storagePath.replace(/\/+$/, '')}/${SCENE_DIR}`
  // tulis lewat saveBuffer agar konsisten dengan adapter storage
  await saveBuffer(Buffer.from(JSON.stringify(entries, null, 2)), 'index.json', SCENE_DIR)
  void dirAbs
}

/** Kata kunci baku per tema halaman. */
const THEME_QUERIES: Record<string, string> = {
  estate: 'kebun sawit aerial view plantation indonesia',
  palm: 'palm oil trees rows plantation morning',
  harvest: 'panen kelapa sawit tengkolok brondolan',
  road: 'jalan tanah merah kebun sawit',
  tractor: 'traktor kebun sawit pemupukan',
  login: 'oil palm plantation sunrise landscape',
}

async function searchAndStore(query: string): Promise<SceneEntry> {
  // import dinamis — tool zero-dependency di shared/ (di luar folder modul).
  // Path relatif env.googleImageSearchPath dihitung dari file ini.
  const here = path.dirname(fileURLToPath(import.meta.url))
  const toolPath = path.resolve(here, env.googleImageSearchPath)
  const mod: any = await import(/* webpackIgnore: true */ 'file:///' + toolPath.replace(/\\/g, '/'))
  const res = await mod.searchGoogleImages(query, { count: 6 })
  const candidates = (res.results || []).filter((r: any) => r.imageUrl)
  let lastErr: Error | null = null
  for (const c of candidates) {
    try {
      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), 20000)
      const resp = await fetch(c.imageUrl, { signal: ac.signal, redirect: 'follow' })
      clearTimeout(t)
      if (!resp.ok) continue
      const mime = resp.headers.get('content-type') || ''
      if (!mime.startsWith('image/')) continue
      const ab = Buffer.from(await resp.arrayBuffer())
      if (ab.length < 20_000) continue // terlalu kecil = thumbnail rusak
      if (ab.length > 8 * 1024 * 1024) continue
      const extMap: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }
      const ext = extMap[mime] || '.jpg'
      const key = crypto.createHash('sha1').update(query).digest('hex').slice(0, 10)
      const saved = await saveBuffer(ab, `scene_${key}${ext}`, SCENE_DIR)
      const entry: SceneEntry = {
        storagePath: saved.storagePath,
        credit: c.title || '',
        source: c.pageUrl || c.source || '',
        addedAt: new Date().toISOString(),
      }
      memoryCache.set(query, entry)
      await saveIndex().catch(() => {})
      return entry
    } catch (e: any) {
      lastErr = e
      continue // gambar 404/hotlink-blocked → coba kandidat berikutnya
    }
  }
  throw lastErr || new Error('Tidak ada gambar cocok untuk: ' + query)
}

/**
 * GET /api/v1/meta/scene?theme=estate
 * → { url: '/api/v1/meta/scene/image?path=...&v=<mtime>', credit, source }
 * Gambar dicari sekali per tema lalu tersimpan permanen di NAS.
 */
sceneRouter.get('/scene', auth(), async (req, res) => {
  try {
    const theme = String(req.query.theme || 'estate').toLowerCase()
    const query = THEME_QUERIES[theme] || String(req.query.q || '').trim() || THEME_QUERIES.estate
    const cache = await loadIndex()
    let entry = cache.get(query)
    if (!entry) {
      entry = await searchAndStore(query)
    } else {
      // pastikan berkas masih ada di NAS (bila terhapus → cari ulang)
      const st = await statRemote(entry.storagePath).catch(() => null)
      if (!st) entry = await searchAndStore(query)
    }
    res.json({
      status: 'success',
      data: {
        url: `/api/file/meta/scene/image?path=${encodeURIComponent(entry.storagePath)}&v=${Date.now()}`,
        credit: entry.credit,
        source: entry.source,
        theme,
        query,
      },
    })
  } catch (e: any) {
    res.status(502).json({ status: 'error', message: e.message || 'Gagal mengambil foto scene' })
  }
})

/**
 * GET /api/v1/meta/scene/task?q=<judul tugas>
 * Cari gambar relevan berdasarkan judul/teks bebas — dipakai kartu tugas
 * agar tiap penugasan punya ilustrasi kontekstual (mis. "LHP Blok C" → foto sawit).
 * Hasil di-cache per query di scene/index.json.
 */
sceneRouter.get('/scene/task', auth(), async (req, res) => {
  try {
    const raw = String(req.query.q || '').trim()
    if (!raw) return res.status(400).json({ status: 'error', message: 'query ?q= wajib' })
    // rapikan jadi kata kunci pencarian: potong ke ~6 kata pertama
    const query = raw.split(/\s+/).slice(0, 6).join(' ').toLowerCase()
    const cache = await loadIndex()
    let entry = cache.get(query)
    if (!entry) {
      entry = await searchAndStore(query)
    } else {
      const st = await statRemote(entry.storagePath).catch(() => null)
      if (!st) entry = await searchAndStore(query)
    }
    res.json({
      status: 'success',
      data: {
        url: `/api/file/meta/scene/image?path=${encodeURIComponent(entry.storagePath)}&v=${Date.now()}`,
        credit: entry.credit,
        source: entry.source,
        query,
      },
    })
  } catch (e: any) {
    res.status(502).json({ status: 'error', message: e.message || 'Gagal mengambil foto untuk judul ini' })
  }
})

/** Sajikan berkas scene dari NAS (public untuk img src — tetap butuh sesi via cookie). */
sceneRouter.get('/scene/image', auth(), async (req, res) => {
  const rel = String(req.query.path || '')
  if (!rel.startsWith(`${SCENE_DIR}/`) || rel.includes('..')) {
    return res.status(400).json({ status: 'error', message: 'Path tidak sah' })
  }
  try {
    const st = await statRemote(rel)
    if (!st) return res.status(404).json({ status: 'error', message: 'Berkas scene tidak ada' })
    const buf = await downloadBuffer(rel)
    if (!buf) return res.status(404).json({ status: 'error', message: 'Berkas scene tidak ada' })
    const ext = path.extname(rel).toLowerCase()
    const ct = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg'
    res.setHeader('Content-Type', ct)
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable')
    res.send(buf)
  } catch (e: any) {
    res.status(e.status || 502).json({ status: 'error', message: e.message })
  }
})

void MANAGER_ROLES
