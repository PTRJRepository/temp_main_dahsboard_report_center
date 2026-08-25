import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getPool, sql } from '../config/db.js'
import { env } from '../config/env.js'
import { store } from '../lib/store.js'
import { dbUserByEmail, syncToStore, normRole } from '../lib/directory.js'

export const authRouter = Router()

function tokenFor(u: { user_id: number; username: string; role_code: string; afdeling_id?: number | null }) {
  return jwt.sign({ user_id: u.user_id, username: u.username, role_code: u.role_code, afdeling_id: u.afdeling_id ?? null }, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as any)
}

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {}
  if (!username || !password) return res.status(400).json({ status: 'error', message: 'username & password required' })
  const id = String(username).trim()

  // Helper: set cookie rjfm-token untuk UI monolith (middleware menerima cookie ini)
  const withCookie = (payload: any) => {
    res.setHeader('Set-Cookie', `rjfm-token=${payload.token}; Path=/; SameSite=Lax; Max-Age=${12 * 3600}`)
    return res.json({ status: 'success', data: payload })
  }

  // 1) extend_db_ptrj.user_ptrj — sumber utama (login pakai email)
  try {
    const pool = await getPool()
    const r = await pool
      .request()
      .input('email', sql.VarChar(255), id.toLowerCase())
      .query('SELECT id, name, email, password, role, divisi FROM user_ptrj WHERE LOWER(email) = @email')
    const row = r.recordset[0]
    if (row) {
      const ok = await bcrypt.compare(String(password), String(row.password || ''))
      if (!ok) return res.status(401).json({ status: 'error', message: 'Email atau password salah' })
      const role_code = normRole(row.role)
      const user = {
        user_id: Number(row.id),
        username: String(row.email),
        full_name: String(row.name || row.email),
        role_code,
        divisi: row.divisi ?? null,
      }
      syncToStore({ ...user, email: user.username, raw_role: String(row.role || ''), afdeling_id: null } as any)
      const token = tokenFor({ user_id: user.user_id, username: user.username, role_code, afdeling_id: null })
      return withCookie({ token, user, mode: 'mssql' })
    }
  } catch {
    // DB tidak reachable → lanjut ke demo store
  }

  // 2) demo / JSON store (fallback — akun uji)
  const local = store.findUserByUsername(id)
  if (local) {
    const ok = await bcrypt.compare(String(password), local.password_hash)
    if (!ok) return res.status(401).json({ status: 'error', message: 'Email atau password salah' })
    const token = tokenFor(local)
    return withCookie({ token, user: { user_id: local.user_id, username: local.username, role_code: local.role_code, full_name: local.full_name, afdeling_id: local.afdeling_id }, mode: 'demo' })
  }

  return res.status(401).json({ status: 'error', message: 'Email atau password salah' })
})

authRouter.get('/me', async (req, res) => {
  const hdr = req.headers.authorization || ''
  const raw = hdr.startsWith('Bearer ') ? hdr.slice(7) : ''
  if (!raw) return res.status(401).json({ status: 'error', message: 'Unauthorized' })
  try {
    const p = jwt.verify(raw, env.jwtSecret) as any
    const u = store.findUser(p.user_id)
    res.json({ status: 'success', data: { user_id: p.user_id, username: p.username, role_code: p.role_code, full_name: u?.full_name || p.username } })
  } catch {
    res.status(401).json({ status: 'error', message: 'Invalid token' })
  }
})
