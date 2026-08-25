// Gateway NAS — akses file & data RJFM dari service lain pakai x-api-key.
import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import { requireApiKey } from '../middleware/apikey.js'
import { env } from '../config/env.js'
import { getStorageHealth, saveBuffer, downloadBuffer, statRemote, deleteRemote, contentDisposition, listAllFiles } from '../lib/storage.js'
import { sniffMime, validateUpload, sanitizeFilename } from '../lib/validators.js'
import { store } from '../lib/store.js'

export const gatewayRouter = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxFileMb * 1024 * 1024 } })

gatewayRouter.use(requireApiKey)

const CONTENT_TYPE: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.kml': 'application/vnd.google-earth.kml+xml', '.kmz': 'application/vnd.google-earth.kmz',
  '.csv': 'text/csv', '.txt': 'text/plain',
}

function contentTypeFor(name: string): string {
  return CONTENT_TYPE[path.extname(name).toLowerCase()] || 'application/octet-stream'
}

/** Rapikan folder relatif dari input eksternal — tolak traversal. Titik dipertahankan (ekstensi). */
function safeFolder(input: string | undefined): string {
  if (!input) return ''
  const segs = String(input).split(/[\\/]+/).filter(s => s && s !== '.' && s !== '..').map(s => s.replace(/[^a-zA-Z0-9_.\- ]/g, '_').replace(/\.{2,}/g, '.'))
  return segs.join('/')
}

// ---- Health & stats -------------------------------------------------------
gatewayRouter.get('/health', (_req, res) => {
  res.json({ status: 'success', service: 'rjfm-gateway', time: new Date().toISOString(), storage: getStorageHealth() })
})

gatewayRouter.get('/stats', async (_req, res) => {
  const s = store.all()
  let files = { count: 0, bytes: 0 }
  try {
    const all = await listAllFiles()
    files = all.reduce((acc, f) => ({ count: acc.count + 1, bytes: acc.bytes + f.size }), { count: 0, bytes: 0 })
  } catch { /* NAS tidak terjangkau — laporkan nol */ }
  res.json({
    status: 'success',
    data: {
      tasks: s.tasks.length,
      assignments: s.assignments.length,
      revisions: s.revisions.length,
      drive_items: s.drive.filter(d => !d.trashed).length,
      users_synced: s.users.length,
      files_on_storage: files.count,
      bytes_on_storage: files.bytes,
    },
    storage: await getStorageHealth(),
  })
})

// ---- List berkas di NAS ---------------------------------------------------
gatewayRouter.get('/files', async (req, res) => {
  const prefix = safeFolder(String(req.query.prefix || ''))
  const limit = Math.min(Number(req.query.limit) || 200, 1000)
  try {
    const all = await listAllFiles()
    const out = all
      .filter(f => !prefix || f.rel.startsWith(prefix))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, limit)
      .map(f => ({ path: f.rel, size_bytes: f.size, modified_at: new Date(f.mtime * 1000).toISOString() }))
    res.json({ status: 'success', total: out.length, data: out })
  } catch (e: any) {
    res.status(e.status || 502).json({ status: 'error', message: e.message })
  }
})

// ---- Download by path ------------------------------------------------------
gatewayRouter.get('/download', async (req, res) => {
  const rel = safeFolder(String(req.query.path || ''))
  if (!rel) return res.status(400).json({ status: 'error', message: 'query ?path= wajib' })
  try {
    const st = await statRemote(rel)
    if (!st) return res.status(404).json({ status: 'error', message: 'Berkas tidak ditemukan' })
    const buf = await downloadBuffer(rel)
    if (!buf) return res.status(404).json({ status: 'error', message: 'Berkas tidak ditemukan' })
    res.setHeader('Content-Type', contentTypeFor(rel))
    res.setHeader('Content-Disposition', contentDisposition(path.basename(rel)))
    res.send(buf)
  } catch (e: any) {
    res.status(e.status || 502).json({ status: 'error', message: e.message })
  }
})

// ---- Upload ke NAS ---------------------------------------------------------
gatewayRouter.post('/upload', upload.single('file'), async (req: any, res) => {
  const file = req.file as Express.Multer.File | undefined
  if (!file) return res.status(400).json({ status: 'error', message: 'file required (multipart field "file")' })
  const folder = safeFolder(req.body?.folder)
  const sniffed = sniffMime(file.buffer)
  if (!sniffed) return res.status(415).json({ status: 'error', message: 'Format berkas tidak dikenali' })
  const unsafe = validateUpload(file.originalname, sniffed)
  if (unsafe) return res.status(415).json({ status: 'error', message: unsafe })
  try {
    const saved = await saveBuffer(file.buffer, sanitizeFilename(file.originalname), folder ? `gateway/${folder}` : 'gateway')
    res.status(201).json({
      status: 'success',
      data: { path: saved.storagePath, size_bytes: saved.sizeBytes, mime_type: saved.mimeType, sha256: saved.sha256 },
      download: `/api/gateway/download?path=${encodeURIComponent(saved.storagePath)}`,
    })
  } catch (e: any) {
    res.status(e.status || 500).json({ status: 'error', message: e.message })
  }
})

// ---- Delete by path (hapus permanen) ---------------------------------------
gatewayRouter.delete('/file', async (req, res) => {
  const rel = safeFolder(String(req.query.path || req.body?.path || ''))
  if (!rel) return res.status(400).json({ status: 'error', message: 'query ?path= wajib' })
  try {
    const st = await statRemote(rel)
    if (!st) return res.status(404).json({ status: 'error', message: 'Berkas tidak ditemukan' })
    // proteksi: hanya berkas di bawah gateway/ yang boleh dihapus via API
    if (!rel.startsWith('gateway/')) return res.status(403).json({ status: 'error', message: 'Hanya berkas di bawah gateway/ yang boleh dihapus via API' })
    await deleteRemote(rel)
    res.json({ status: 'success', deleted: rel })
  } catch (e: any) {
    res.status(e.status || 502).json({ status: 'error', message: e.message })
  }
})

// ---- Data tugas & submission ----------------------------------------------
gatewayRouter.get('/tasks', (_req, res) => {
  const s = store.all()
  const data = s.tasks.filter(t => t.is_active).map(t => ({
    ...t,
    assignment_count: s.assignments.filter(a => a.task_id === t.task_id).length,
    revision_count: s.revisions.filter(r => s.assignments.some(a => a.assignment_id === r.assignment_id && a.task_id === t.task_id)).length,
  }))
  res.json({ status: 'success', data })
})

gatewayRouter.get('/revisions/:id/stream', async (req, res) => {
  const row = store.revision(Number(req.params.id))
  if (!row) return res.status(404).json({ status: 'error', message: 'Revision not found' })
  try {
    const buf = await downloadBuffer(row.file_storage_path)
    if (!buf) return res.status(404).json({ status: 'error', message: 'Berkas fisik tidak ada di NAS' })
    res.setHeader('Content-Type', row.file_mime_type || contentTypeFor(row.file_original_name))
    res.setHeader('Content-Disposition', contentDisposition(row.file_original_name))
    res.send(buf)
  } catch (e: any) {
    if (res.headersSent) return res.end()
    res.status(e.status || 502).json({ status: 'error', message: e.message })
  }
})

gatewayRouter.get('/users', (_req, res) => {
  const s = store.all()
  res.json({
    status: 'success',
    data: s.users.map(({ password_hash: _p, ...r }) => ({ user_id: r.user_id, username: r.username, full_name: r.full_name, role_code: r.role_code })),
  })
})
