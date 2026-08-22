import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { getStorageHealth } from '../lib/storage.js'
import { getPool } from '../config/db.js'
import { store } from '../lib/store.js'

export const systemRouter = Router()

systemRouter.get('/storage-health', auth(['SUPERADMIN', 'MANAGER', 'KERANI', 'ASISTEN']), async (req, res) => {
  const h = await getStorageHealth()
  const q = store.driveQuota(req.user!.user_id)
  res.json({
    status: 'success',
    data: {
      total_space_gb: Math.round((h.totalBytes / 1024 ** 3) * 100) / 100,
      used_space_gb: Math.round((h.usedBytes / 1024 ** 3) * 100) / 100,
      free_space_gb: Math.round((h.freeBytes / 1024 ** 3) * 100) / 100,
      free_percentage: Math.round(h.freePercentage * 100) / 100,
      is_threshold_alert: h.isAlertNeeded,
      drive_quota: q,
    },
  })
})

systemRouter.get('/health', async (_req, res) => {
  let dbOk = false
  try {
    const pool = await getPool()
    await pool.request().query('SELECT 1 as ok')
    dbOk = true
  } catch {}
  res.json({ status: dbOk ? 'Healthy' : 'Degraded', db: dbOk ? 'up' : 'demo-store', time: new Date().toISOString() })
})
