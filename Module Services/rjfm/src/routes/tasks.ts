import { Router } from 'express'
import { auth, MANAGER_ROLES } from '../middleware/auth.js'
import { store } from '../lib/store.js'

export const tasksRouter = Router()

tasksRouter.post('/', auth(MANAGER_ROLES), (req, res) => {
  const { category_id, title, description, target_kerani_ids, deadline, priority, allowed_types, max_file_size_mb, template_file_path } = req.body ?? {}
  if (!title || !description || !Array.isArray(target_kerani_ids) || target_kerani_ids.length === 0) {
    return res.status(400).json({ status: 'error', message: 'title, description, target_kerani_ids[] required' })
  }
  // Memo cepat: category & deadline opsional — default kategori pertama, hari ini 17:00.
  const catId = category_id ? Number(category_id) : (store.categories()[0]?.category_id ?? 1)
  const dl = deadline ? new Date(deadline) : (() => { const d = new Date(); d.setHours(17, 0, 0, 0); return d })()
  const allowedMimes = Array.isArray(allowed_types) && allowed_types.length
    ? allowed_types.join(',')
    : 'application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png'
  const t = store.createTask({
    category_id: catId,
    created_by_user_id: req.user!.user_id,
    title, description,
    allowed_mime_types: allowedMimes,
    max_file_size_mb: max_file_size_mb ?? 10,
    deadline: dl.toISOString(),
    priority: priority || 'MEDIUM',
    template_file_path: template_file_path || null,
    target_kerani_ids,
  })
  res.status(201).json({ status: 'success', data: { task_id: t.task_id } })
})

tasksRouter.get('/', auth(), (req, res) => {
  res.json({ status: 'success', data: store.tasksFor(req.user as any) })
})

tasksRouter.get('/:id', auth(), (req, res) => {
  const t = store.task(Number(req.params.id))
  if (!t) return res.status(404).json({ status: 'error', message: 'Task not found' })
  res.json({ status: 'success', data: t })
})
