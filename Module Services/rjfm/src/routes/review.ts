import { Router } from 'express'
import { auth, MANAGER_ROLES } from '../middleware/auth.js'
import { validateFeedback } from '../lib/validators.js'
import { store } from '../lib/store.js'

export const reviewRouter = Router()

reviewRouter.post('/:id/review', auth(MANAGER_ROLES), (req, res) => {
  const assignmentId = Number(req.params.id)
  const { review_status, manager_feedback } = req.body ?? {}
  if (!['APPROVED', 'REJECTED_NEEDS_REVISION'].includes(review_status)) {
    return res.status(400).json({ status: 'error', message: 'review_status must be APPROVED | REJECTED_NEEDS_REVISION' })
  }
  const err = validateFeedback(review_status, manager_feedback)
  if (err) return res.status(422).json({ status: 'error', code: 'FEEDBACK_MANDATORY_REQUIRED', message: err })
  try {
    const data = store.review(assignmentId, req.user!.user_id, review_status, manager_feedback)
    res.json({ status: 'success', message: review_status === 'APPROVED' ? 'Berkas disetujui.' : 'Instruksi revisi terkirim ke Kerani.', data: { ...data, updated_at: new Date().toISOString() } })
  } catch (e: any) {
    res.status(e.status || 500).json({ status: 'error', code: e.code, message: e.message })
  }
})
