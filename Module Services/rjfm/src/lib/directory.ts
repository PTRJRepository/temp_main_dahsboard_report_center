// User directory — linked ke extend_db_ptrj (tabel user_ptrj) sebagai sumber user utama.
import { getPool, sql } from '../config/db.js'
import { store } from './store.js'

// Role di user_ptrj bebas (ADMIN, KERANI, MNGR, ASISTEN, MANDOR, GM_ESTATE, dst).
// Normalisasi ke role_code yang dipakai guard RJFM.
export function normRole(raw?: string | null): 'MANAGER' | 'ASISTEN' | 'SUPERADMIN' | 'KERANI' {
  const r = String(raw || '').trim().toUpperCase()
  if (r === 'ASISTEN') return 'ASISTEN'
  if (r === 'MANAGER' || r === 'MNGR') return 'MANAGER'
  if (['ADMIN', 'SUPERADMIN', 'GM_ESTATE'].includes(r)) return 'SUPERADMIN'
  return 'KERANI'
}

export type DbUser = {
  user_id: number
  username: string
  full_name: string
  email: string
  role_code: string
  raw_role: string
  divisi: string | null
  afdeling_id: number | null
}

function rowToUser(r: any): DbUser {
  return {
    user_id: Number(r.id),
    username: String(r.email || ''),
    full_name: String(r.name || r.email || ''),
    email: String(r.email || ''),
    role_code: normRole(r.role),
    raw_role: String(r.role || ''),
    divisi: r.divisi ?? null,
    afdeling_id: null,
  }
}

export function syncToStore(u: DbUser) {
  store.upsertUser({
    user_id: u.user_id,
    username: u.username,
    full_name: u.full_name,
    email: u.email,
    phone_number: '',
    role_code: u.role_code as any,
    afdeling_id: null,
    password_hash: '',
    is_active: true,
  })
}

/** Cari user di user_ptrj berdasarkan email (login pakai email). */
export async function dbUserByEmail(email: string): Promise<DbUser | null> {
  const pool = await getPool()
  const r = await pool
    .request()
    .input('email', sql.VarChar(255), email.trim().toLowerCase())
    .query('SELECT id, name, email, role, divisi FROM user_ptrj WHERE LOWER(email) = @email')
  return r.recordset[0] ? rowToUser(r.recordset[0]) : null
}

/** Semua user dari user_ptrj (untuk manager memilih target kerani). */
export async function dbUsers(): Promise<DbUser[]> {
  const pool = await getPool()
  const r = await pool.request().query('SELECT id, name, email, role, divisi FROM user_ptrj ORDER BY name')
  return r.recordset.map(rowToUser)
}
