import { Router } from 'express'
import { auth, MANAGER_ROLES } from '../middleware/auth.js'
import { store } from '../lib/store.js'
import { dbUsers, syncToStore } from '../lib/directory.js'

export const metaRouter = Router()

metaRouter.get('/categories', auth(), (_req, res) => res.json({ status: 'success', data: store.categories() }))
metaRouter.get('/afdelings', auth(), (_req, res) => res.json({ status: 'success', data: store.afdelings() }))
metaRouter.get('/users', auth(MANAGER_ROLES), async (_req, res) => {
  // Daftar user langsung dari extend_db_ptrj.user_ptrj; fallback ke store lokal saat DB down.
  try {
    const users = await dbUsers()
    users.forEach(syncToStore)
    return res.json({
      status: 'success',
      source: 'mssql',
      data: users.map(u => ({ user_id: u.user_id, username: u.username, full_name: u.full_name, role_code: u.role_code, raw_role: u.raw_role, divisi: u.divisi })),
    })
  } catch {
    return res.json({ status: 'success', source: 'demo', data: store.users() })
  }
})
metaRouter.get('/notifications', auth(), (req, res) => res.json({ status: 'success', data: store.notifs(req.user!.user_id) }))
metaRouter.get('/admin/files', auth(MANAGER_ROLES), (_req, res) => res.json({ status: 'success', data: store.allFiles() }))
metaRouter.get('/admin/drive', auth(MANAGER_ROLES), (_req, res) => res.json({ status: 'success', data: store.allDrive() }))
metaRouter.post('/notifications/:id/read', auth(), (req, res) => {
  store.markRead(Number(req.params.id), req.user!.user_id)
  res.json({ status: 'success' })
})
