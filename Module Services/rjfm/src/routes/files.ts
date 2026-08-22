import { Router } from 'express'
import { auth, MANAGER_ROLES } from '../middleware/auth.js'
import { createReadStream } from '../lib/storage.js'
import { store } from '../lib/store.js'

export const filesRouter = Router()

filesRouter.get('/:id/stream', auth(), (req, res) => {
  const revisionId = Number(req.params.id)
  const row = store.revision(revisionId)
  if (!row) return res.status(404).json({ status: 'error', message: 'File not found' })
  const role = req.user!.role_code
  const uid = req.user!.user_id
  const allowed = MANAGER_ROLES.includes(role) || row.kerani_user_id === uid || row.created_by_user_id === uid
  if (!allowed) return res.status(403).json({ status: 'error', message: 'Forbidden: no access to this file' })
  try {
    const stream = createReadStream(row.file_storage_path)
    res.setHeader('Content-Type', row.file_mime_type || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.file_original_name)}"`)
    stream.on('error', () => {
      res.status(200)
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(`(demo) file ${row.file_original_name} — SHA ${row.file_hash_sha256}\n${row.notes_from_kerani || ''}`)
    })
    stream.pipe(res)
  } catch {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(`(demo) file ${row.file_original_name}`)
  }
})
