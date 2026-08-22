// API Key store untuk gateway NAS — hash SHA-256, raw key hanya tampil saat create.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const STORE_PATH = process.env.RJFM_APIKEY_PATH || path.join(process.cwd(), 'data', 'rjfm-apikeys.json')

export type ApiKeyScope = 'read' | 'write' | 'delete' | 'admin'

export type ApiKey = {
  key_id: number
  name: string
  prefix: string        // 10 char pertama untuk ditampilkan
  key_hash: string      // sha256 hex dari raw key
  scopes: ApiKeyScope[]
  created_by_user_id: number
  created_by_name: string
  created_at: string
  last_used_at: string | null
  revoked: boolean
}

type KeyStore = { seq: number; keys: ApiKey[] }

let mem: KeyStore | null = null

function load(): KeyStore {
  if (mem) return mem
  try {
    if (fs.existsSync(STORE_PATH)) {
      mem = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as KeyStore
      return mem
    }
  } catch { /* seed baru */ }
  mem = { seq: 0, keys: [] }
  save()
  return mem
}

function save() {
  if (!mem) return
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true })
  fs.writeFileSync(STORE_PATH, JSON.stringify(mem, null, 2), 'utf8')
}

export function hashKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

/** Buat key baru. Raw key HANYA dikembalikan di sini — simpan hanya hash. */
export function createKey(input: { name: string; scopes: ApiKeyScope[]; createdBy: { user_id: number; name: string } }): { record: ApiKey; raw: string } {
  const s = load()
  const raw = `rjfm_${crypto.randomBytes(32).toString('base64url')}`
  s.seq += 1
  const record: ApiKey = {
    key_id: s.seq,
    name: input.name.trim().slice(0, 60),
    prefix: raw.slice(5, 15),
    key_hash: hashKey(raw),
    scopes: input.scopes.length ? input.scopes : ['read'],
    created_by_user_id: input.createdBy.user_id,
    created_by_name: input.createdBy.name,
    created_at: new Date().toISOString(),
    last_used_at: null,
    revoked: false,
  }
  s.keys.unshift(record)
  save()
  return { record, raw }
}

export function verifyKey(raw: string): ApiKey | null {
  const h = hashKey(raw)
  const k = load().keys.find(x => x.key_hash === h)
  if (!k || k.revoked) return null
  // update last_used_at max sekali per menit agar tidak write-storm
  const now = Date.now()
  if (!k.last_used_at || now - new Date(k.last_used_at).getTime() > 60_000) {
    k.last_used_at = new Date().toISOString()
    save()
  }
  return k
}

export function listKeys(): Array<Omit<ApiKey, 'key_hash'>> {
  return load().keys.map(({ key_hash: _h, ...r }) => r)
}

export function revokeKey(keyId: number): boolean {
  const s = load()
  const k = s.keys.find(x => x.key_id === keyId)
  if (!k) return false
  k.revoked = true
  save()
  return true
}

export function hasScope(key: ApiKey, scope: ApiKeyScope): boolean {
  return key.scopes.includes('admin') || key.scopes.includes(scope)
}
