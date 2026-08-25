import { Router } from 'express'
import { auth, MANAGER_ROLES } from '../middleware/auth.js'
import { downloadBuffer, contentDisposition } from '../lib/storage.js'
import { store } from '../lib/store.js'

export const filesRouter = Router()

filesRouter.get('/:id/stream', auth(), async (req, res) => {
  const revisionId = Number(req.params.id)
  const row = store.revision(revisionId)
  if (!row) return res.status(404).json({ status: 'error', message: 'File not found' })
  const role = req.user!.role_code
  const uid = req.user!.user_id
  const allowed = MANAGER_ROLES.includes(role) || row.kerani_user_id === uid || row.created_by_user_id === uid
  if (!allowed) return res.status(403).json({ status: 'error', message: 'Forbidden: no access to this file' })
  try {
    const buf = await downloadBuffer(row.file_storage_path)
    if (!buf || !buf.length) {
      return res.status(404).json({ status: 'error', message: 'Berkas fisik tidak ditemukan di NAS. Mungkin terhapus atau belum tersinkron.' })
    }
    res.setHeader('Content-Type', row.file_mime_type || 'application/octet-stream')
    res.setHeader('Content-Disposition', contentDisposition(row.file_original_name))
    res.send(buf)
  } catch (e: any) {
    if (res.headersSent) return res.end()
    res.status(e.status === 500 ? 502 : (e.status || 502)).json({ status: 'error', message: e.message })
  }
})
