// Gateway NAS — akses file & data RJFM dari service lain pakai x-api-key.
import { Router } from 'express'
import multer from 'multer'
import fs from 'node:fs'
import path from 'node:path'
import { requireApiKey } from '../middleware/apikey.js'
import { env } from '../config/env.js'
import { getStorageHealth, createReadStream, saveBuffer, absolutePath } from '../lib/storage.js'
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

gatewayRouter.get('/stats', (_req, res) => {
  const s = store.all()
  const files = countFilesRecursive(env.storagePath)
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
    storage: getStorageHealth(),
  })
})

function countFilesRecursive(root: string): { count: number; bytes: number } {
  let count = 0, bytes = 0
  try {
    for (const entry of fs.readdirSync(root, { recursive: true }) as Array<string | Buffer>) {
      const p = path.join(String(entry))
      let st: fs.Stats
      try { st = fs.statSync(p) } catch { continue }
      if (st.isFile()) { count += 1; bytes += st.size }
    }
  } catch { /* root belum ada */ }
  return { count, bytes }
}

// ---- List berkas di NAS ---------------------------------------------------
gatewayRouter.get('/files', (req, res) => {
  const prefix = safeFolder(String(req.query.prefix || ''))
  const limit = Math.min(Number(req.query.limit) || 200, 1000)
  const out: Array<{ path: string; size_bytes: number; modified_at: string }> = []
  try {
    const all = fs.readdirSync(env.storagePath, { recursive: true }) as Array<string | Buffer>
    for (const entry of all) {
      const rel = String(entry).replace(/\\/g, '/')
      if (prefix && !rel.startsWith(prefix)) continue
      let st: fs.Stats
      try { st = fs.statSync(path.join(env.storagePath, rel)) } catch { continue }
      if (!st.isFile()) continue
      out.push({ path: rel, size_bytes: st.size, modified_at: st.mtime.toISOString() })
    }
  } catch { /* root kosong */ }
  out.sort((a, b) => b.modified_at.localeCompare(a.modified_at))
  res.json({ status: 'success', total: out.length, data: out.slice(0, limit) })
})

// ---- Download by path ------------------------------------------------------
gatewayRouter.get('/download', (req, res) => {
  const rel = safeFolder(String(req.query.path || ''))
  if (!rel) return res.status(400).json({ status: 'error', message: 'query ?path= wajib' })
  try {
    const full = absolutePath(rel)
    if (!fs.existsSync(full)) return res.status(404).json({ status: 'error', message: 'Berkas tidak ditemukan' })
    res.setHeader('Content-Type', contentTypeFor(rel))
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(path.basename(rel))}"`)
    const stream = createReadStream(rel)
    stream.on('error', () => res.status(500).end())
    stream.pipe(res)
  } catch (e: any) {
    res.status(e.status || 400).json({ status: 'error', message: e.message })
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
gatewayRouter.delete('/file', (req, res) => {
  const rel = safeFolder(String(req.query.path || req.body?.path || ''))
  if (!rel) return res.status(400).json({ status: 'error', message: 'query ?path= wajib' })
  try {
    const full = absolutePath(rel)
    if (!fs.existsSync(full)) return res.status(404).json({ status: 'error', message: 'Berkas tidak ditemukan' })
    // proteksi: hanya berkas di bawah gateway/ yang boleh dihapus via API
    if (!rel.startsWith('gateway/')) return res.status(403).json({ status: 'error', message: 'Hanya berkas di bawah gateway/ yang boleh dihapus via API' })
    fs.unlinkSync(full)
    res.json({ status: 'success', deleted: rel })
  } catch (e: any) {
    res.status(e.status || 400).json({ status: 'error', message: e.message })
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

gatewayRouter.get('/revisions/:id/stream', (req, res) => {
  const row = store.revision(Number(req.params.id))
  if (!row) return res.status(404).json({ status: 'error', message: 'Revision not found' })
  try {
    res.setHeader('Content-Type', row.file_mime_type || contentTypeFor(row.file_original_name))
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.file_original_name)}"`)
    const stream = createReadStream(row.file_storage_path)
    stream.on('error', () => res.status(404).json({ status: 'error', message: 'Berkas fisik tidak ada di NAS' }))
    stream.pipe(res)
  } catch (e: any) {
    res.status(e.status || 500).json({ status: 'error', message: e.message })
  }
})

gatewayRouter.get('/users', (_req, res) => {
  const s = store.all()
  res.json({
    status: 'success',
    data: s.users.map(({ password_hash: _p, ...r }) => ({ user_id: r.user_id, username: r.username, full_name: r.full_name, role_code: r.role_code })),
  })
})
