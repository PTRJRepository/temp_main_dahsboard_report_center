import { Router } from 'express'
import multer from 'multer'
import { auth, MANAGER_ROLES } from '../middleware/auth.js'
import { saveBuffer } from '../lib/storage.js'
import { sniffMime, validateUpload, sanitizeFilename } from '../lib/validators.js'
import { env } from '../config/env.js'
import { store } from '../lib/store.js'

export const assignmentsRouter = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxFileMb * 1024 * 1024 } })

assignmentsRouter.post('/:id/submit', auth(['KERANI', 'ASISTEN', 'MANAGER', 'SUPERADMIN']), (req, res, next) => {
  upload.single('file')(req as any, res as any, (err: any) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? `File melebihi ${env.maxFileMb} MB` : err.message
      return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ status: 'error', message: msg })
    }
    next()
  })
}, async (req: any, res) => {
  const assignmentId = Number(req.params.id)
  const notes: string | undefined = req.body?.notes
  const file: Express.Multer.File | undefined = req.file
  if (!file) return res.status(400).json({ status: 'error', message: 'file required (multipart field "file")' })
  const sniffed = sniffMime(file.buffer)
  if (!sniffed) return res.status(415).json({ status: 'error', message: 'Format berkas tidak dikenali' })
  const unsafe = validateUpload(file.originalname, sniffed)
  if (unsafe) return res.status(415).json({ status: 'error', message: unsafe })
  const safeName = sanitizeFilename(file.originalname)
  try {
    const pack = store.assignment(assignmentId)
    if (!pack) return res.status(404).json({ status: 'error', message: 'Assignment not found' })
    const assignment = pack.assignment
    if (assignment.kerani_user_id !== req.user!.user_id && !MANAGER_ROLES.includes(req.user!.role_code)) {
      return res.status(403).json({ status: 'error', message: 'Not assigned to you' })
    }
    const subFolder = `tasks/${assignment.task_id}/assign_${assignmentId}`
    const saved = await saveBuffer(file.buffer, safeName, subFolder)
    const rev = store.submitRevision(assignmentId, saved, notes)
    res.json({
      status: 'success',
      data: { revision_number: rev.revision_number, file_name: saved.originalName, sha256: saved.sha256, current_status: 'SUBMITTED', timestamp: new Date().toISOString() },
    })
  } catch (e: any) {
    res.status(e.status || 500).json({ status: 'error', message: e.message })
  }
})

assignmentsRouter.get('/', auth(), (req, res) => {
  res.json({ status: 'success', data: store.assignmentsFor(req.user as any) })
})

assignmentsRouter.get('/:id', auth(), (req, res) => {
  const pack = store.assignment(Number(req.params.id))
  if (!pack) return res.status(404).json({ status: 'error', message: 'Assignment not found' })
  const role = req.user!.role_code
  const uid = req.user!.user_id
  if (!MANAGER_ROLES.includes(role) && pack.assignment.kerani_user_id !== uid) {
    return res.status(403).json({ status: 'error', message: 'Forbidden' })
  }
  res.json({ status: 'success', data: pack })
})
