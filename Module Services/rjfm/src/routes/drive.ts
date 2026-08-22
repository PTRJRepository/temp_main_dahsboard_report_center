import { Router } from 'express'
import multer from 'multer'
import { auth, MANAGER_ROLES } from '../middleware/auth.js'
import { saveBuffer, createReadStream } from '../lib/storage.js'
import { sniffMime, validateUpload, sanitizeFilename } from '../lib/validators.js'
import { env } from '../config/env.js'
import { store } from '../lib/store.js'

export const driveRouter = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxFileMb * 1024 * 1024 } })

driveRouter.get('/', auth(), (req, res) => {
  const parent = req.query.parent_id === undefined ? undefined : (req.query.parent_id === '' || req.query.parent_id === 'root' ? null : Number(req.query.parent_id))
  const q = String(req.query.q || '')
  const trashed = req.query.trashed === '1'
  const starred = req.query.starred === '1'
  const recent = req.query.recent === '1'
  const data = store.driveList(req.user!.user_id, { parent_id: parent as any, q, trashed, starred, recent })
  res.json({ status: 'success', data, quota: store.driveQuota(req.user!.user_id) })
})

driveRouter.post('/folders', auth(), (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ status: 'error', message: 'name required' })
  const parent_id = req.body?.parent_id == null ? null : Number(req.body.parent_id)
  const item = store.driveMkdir(req.user!.user_id, name, parent_id)
  res.status(201).json({ status: 'success', data: item })
})

driveRouter.post('/upload', auth(), (req, res, next) => {
  upload.single('file')(req as any, res as any, (err: any) => {
    if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ status: 'error', message: err.message })
    next()
  })
}, async (req: any, res) => {
  const file = req.file as Express.Multer.File | undefined
  if (!file) return res.status(400).json({ status: 'error', message: 'file required' })
  const sniffed = sniffMime(file.buffer)
  if (!sniffed) return res.status(415).json({ status: 'error', message: 'Format berkas tidak dikenali' })
  const parent_id = req.body?.parent_id ? Number(req.body.parent_id) : null
  const unsafe = validateUpload(file.originalname, sniffed)
  if (unsafe) return res.status(415).json({ status: 'error', message: unsafe })
  try {
    const saved = await saveBuffer(file.buffer, sanitizeFilename(file.originalname), `drive/u${req.user.user_id}`)
    const item = store.driveAddFile(req.user.user_id, {
      parent_id, name: saved.originalName, mime_type: saved.mimeType, size_bytes: saved.sizeBytes,
      storage_path: saved.storagePath, sha256: saved.sha256,
    })
    res.status(201).json({ status: 'success', data: item })
  } catch (e: any) {
    res.status(e.status || 500).json({ status: 'error', message: e.message })
  }
})

driveRouter.patch('/:id', auth(), (req, res) => {
  try {
    const item = store.drivePatch(Number(req.params.id), req.user!.user_id, {
      name: req.body?.name, parent_id: req.body?.parent_id, trashed: req.body?.trashed, starred: req.body?.starred,
    })
    res.json({ status: 'success', data: item })
  } catch (e: any) {
    res.status(e.status || 500).json({ status: 'error', message: e.message })
  }
})

driveRouter.get('/:id/stream', auth(), (req, res) => {
  const item = store.driveGet(Number(req.params.id))
  if (!item) return res.status(404).json({ status: 'error', message: 'Not found' })
  const isOwner = item.owner_user_id === req.user!.user_id
  const isManager = MANAGER_ROLES.includes(req.user!.role_code)
  if (!isOwner && !isManager) return res.status(404).json({ status: 'error', message: 'Not found' })
  if (item.kind === 'folder') return res.status(400).json({ status: 'error', message: 'folder' })
  if (!item.storage_path) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    return res.end(`(demo) ${item.name}`)
  }
  try {
    const stream = createReadStream(item.storage_path)
    res.setHeader('Content-Type', item.mime_type || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(item.name)}"`)
    stream.on('error', () => { res.setHeader('Content-Type', 'text/plain'); res.end(`(demo) ${item.name}`) })
    stream.pipe(res)
  } catch {
    res.setHeader('Content-Type', 'text/plain'); res.end(`(demo) ${item.name}`)
  }
})
