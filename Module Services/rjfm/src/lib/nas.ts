// Klien Synology FileStation (WebAPI) — pengganti akses SMB drive Z:.
// NAS diakses via HTTP (RJFM_NAS_URL, default http://10.0.0.8:5000).
//
// Catatan penting hasil uji langsung di DSM Storage03:
//  - SYNO.FileStation.Upload v2 memakai field form `path` (BUKAN dest_folder_path)
//    + `overwrite` + part `file`, dan _sid lewat query.
//  - Download mengembalikan biner dengan header Content-Disposition saat sukses;
//    saat gagal mengembalikan JSON {success:false} → dipakai untuk deteksi 404.
import { env } from '../config/env.js'

export type NasFile = {
  name: string
  path: string
  isdir: boolean
  size: number
  mtime: number // unix detik
}

const SESSION_TTL_MS = 50 * 60 * 1000 // DSM session ~ jam; perpanjang sebelum habis

let cached: { sid: string; at: number } | null = null
let loginPromise: Promise<string> | null = null

function joinNas(...parts: Array<string | undefined>): string {
  return parts
    .filter(Boolean)
    .map((p, i) => (i === 0 ? String(p).replace(/\/+$/g, '') : String(p).replace(/^\/+|\/+$/g, '')))
    .join('/')
}

export function nasFullPath(relativePath: string): string {
  const rel = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  return joinNas(env.storagePath, rel)
}

async function rawFetch(url: string, init: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ac.signal, redirect: 'manual' })
  } finally {
    clearTimeout(timer)
  }
}

type SynoResponse = { success?: boolean; error?: { code: number }; data?: any }

async function callJson(params: Record<string, string>, init: RequestInit = {}, timeoutMs?: number): Promise<SynoResponse> {
  const qs = new URLSearchParams(params).toString()
  const r = await rawFetch(`${env.nas.url}/webapi/entry.cgi?${qs}`, init, timeoutMs)
  if (!r.ok) throw Object.assign(new Error(`NAS HTTP ${r.status}`), { status: 502 })
  return await r.json() as SynoResponse
}

async function doLogin(): Promise<string> {
  if (!env.nas.user || !env.nas.pass) {
    throw Object.assign(new Error('Kredensial NAS belum diset (RJFM_NAS_USER / RJFM_NAS_PASS).'), { status: 500 })
  }
  const qs = new URLSearchParams({
    api: 'SYNO.API.Auth',
    version: '6',
    method: 'login',
    account: env.nas.user,
    passwd: env.nas.pass,
    session: 'FileStation',
    format: 'sid',
  }).toString()
  const r = await rawFetch(`${env.nas.url}/webapi/entry.cgi?${qs}`)
  const j = await r.json() as SynoResponse
  const sid = j?.data?.sid
  if (!j?.success || !sid) {
    throw Object.assign(new Error(`Login NAS gagal (code ${j?.error?.code ?? r.status}).`), { status: 502 })
  }
  cached = { sid, at: Date.now() }
  return sid
}

/** SID valid dari cache, atau login baru. Aman dipanggil serentak. */
export async function nasEnsureSid(force = false): Promise<string> {
  if (!force && cached && Date.now() - cached.at < SESSION_TTL_MS) return cached.sid
  if (!loginPromise) {
    loginPromise = doLogin().finally(() => { loginPromise = null })
  }
  return loginPromise
}

function isSessionError(code?: number): boolean {
  // 105 no permission, 106 timeout, 107 duplicate login, 119 sid invalid/not found
  return code === 105 || code === 106 || code === 107 || code === 119
}

/** Panggilan JSON dengan retry sekali bila sesi kedaluwarsa. */
async function callWithSession(params: Record<string, string>, timeoutMs?: number): Promise<SynoResponse> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const sid = await nasEnsureSid(attempt > 0)
    const res = await callJson({ ...params, _sid: sid }, {}, timeoutMs)
    if (res.success !== false) return res
    if (isSessionError(res.error?.code)) continue
    throw Object.assign(new Error(`NAS error ${res.error?.code}: ${params.api}.${params.method}`), { status: 502, code: res.error?.code })
  }
  throw Object.assign(new Error(`NAS sesi tidak dapat diperbarui.`), { status: 502 })
}

/** Daftar isi satu folder. Folder yang belum ada → [] (bukan error). */
export async function nasList(absDir: string): Promise<NasFile[]> {
  let res: SynoResponse
  try {
    res = await callWithSession({
      api: 'SYNO.FileStation.List',
      version: '2',
      method: 'list',
      folder_path: absDir,
      additional: '["size","time"]',
    })
  } catch (e: any) {
    // 408 = "path tidak ada di File Station" — folder belum dibuat
    if (e.code === 408) return []
    throw e
  }
  const files = res?.data?.files as any[] | undefined
  return (files || []).map(f => ({
    name: f.name,
    path: f.path,
    isdir: !!f.isdir,
    size: Number(f?.additional?.size || 0),
    mtime: Number(f?.additional?.time?.mtime || 0),
  }))
}

async function existsDir(absDir: string): Promise<boolean> {
  try {
    const items = await nasList(absDir)
    return Array.isArray(items)
  } catch {
    return false
  }
}

const ensuredDirs = new Set<string>()

/** Pastikan folder ada — buat bertingkat bila perlu (mkdir -p). */
export async function nasEnsureDir(absDir: string): Promise<void> {
  const clean = absDir.replace(/\/+$/, '')
  if (!clean || ensuredDirs.has(clean)) return
  if (await existsDir(clean)) { ensuredDirs.add(clean); return }
  const segments = clean.split('/').filter(Boolean)
  let cur = ''
  for (let i = 0; i < segments.length; i++) {
    cur += '/' + segments[i]
    if (i < 2 && !clean.startsWith('/IT')) { /* share root biasanya sudah ada */ }
    if (ensuredDirs.has(cur)) continue
    if (await existsDir(cur)) { ensuredDirs.add(cur); continue }
    const parent = cur.split('/').slice(0, -1).join('/') || '/'
    const name = segments[i]
    await callWithSession({
      api: 'SYNO.FileStation.CreateFolder',
      version: '2',
      method: 'create',
      folder_path: JSON.stringify([parent]),
      name,
    })
    ensuredDirs.add(cur)
  }
}

/** Upload buffer ke folder tujuan (absolut di NAS) dengan nama file tertentu. */
export async function nasUpload(absDir: string, filename: string, buffer: Buffer): Promise<void> {
  await nasEnsureDir(absDir)
  for (let attempt = 0; attempt < 2; attempt++) {
    const sid = await nasEnsureSid(attempt > 0)
    // Body multipart dibangun manual: FormData+Blob Node mengirim chunked yang
    // membuat DSM memotong isi berkas (byte NUL/biner hilang). Dengan Buffer
    // utuh + Content-Length eksplisit, berkas tersimpan identik.
    const boundary = '----rjfm' + Date.now() + Math.random().toString(36).slice(2, 8)
    const safeName = filename.replace(/["\r\n]/g, '_')
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="path"\r\n\r\n${absDir}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="create_parents"\r\n\r\ntrue\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeName}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    ].map(s => Buffer.from(s, 'utf8'))
    const body = Buffer.concat([...parts, buffer, Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')])
    const qs = new URLSearchParams({ api: 'SYNO.FileStation.Upload', version: '2', method: 'upload', _sid: sid }).toString()
    const r = await rawFetch(`${env.nas.url}/webapi/entry.cgi?${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: new Uint8Array(body),
    }, 60000)
    const text = await r.text()
    let j: SynoResponse
    try { j = JSON.parse(text) as SynoResponse } catch {
      throw Object.assign(new Error(`Respon upload NAS tidak sah (HTTP ${r.status}).`), { status: 502 })
    }
    if (j.success !== false) return
    if (isSessionError(j.error?.code)) continue
    throw Object.assign(new Error(`Upload ke NAS gagal (code ${j.error?.code}).`), { status: 502, code: j.error?.code })
  }
  throw Object.assign(new Error('Upload ke NAS gagal setelah pembaruan sesi.'), { status: 502 })
}

/**
 * Unduh berkas dari NAS. Return null bila berkas tidak ada.
 * Sukses ditandai header Content-Disposition dari FileStation.
 */
export async function nasDownload(absPathOrRel: string): Promise<Buffer | null> {
  // Terima path relatif (dari storage) maupun absolut — normalkan ke absolut NAS.
  const absPath = absPathOrRel.startsWith('/') ? absPathOrRel : nasFullPath(absPathOrRel)
  for (let attempt = 0; attempt < 2; attempt++) {
    const sid = await nasEnsureSid(attempt > 0)
    const qs = new URLSearchParams({
      api: 'SYNO.FileStation.Download',
      version: '2',
      method: 'download',
      path: JSON.stringify([absPath]),
      mode: 'download',
      _sid: sid,
    }).toString()
    const r = await rawFetch(`${env.nas.url}/webapi/entry.cgi?${qs}`, {}, 60000)
    if (!r.ok) {
      if (r.status === 404) return null
      throw Object.assign(new Error(`NAS HTTP ${r.status} saat unduh.`), { status: 502 })
    }
    const cd = r.headers.get('Content-Disposition')
    const buf = Buffer.from(await r.arrayBuffer())
    // Gagal → FileStation balas JSON error tanpa Content-Disposition
    if (!cd && buf.length && buf[0] === 0x7b /* '{' */) {
      try {
        const j = JSON.parse(buf.toString('utf8')) as SynoResponse
        if (j.success === false) {
          if (isSessionError(j.error?.code)) continue
          return null // file hilang / tidak dapat diakses → anggap tidak ada
        }
      } catch { /* bukan json — lanjut sebagai isi */ }
    }
    return buf
  }
  return null
}

/** Stat berkas/folder. Null bila tidak ada. */
export async function nasStat(absPath: string): Promise<NasFile | null> {
  try {
    const parent = absPath.split('/').slice(0, -1).join('/') || '/'
    const name = absPath.split('/').pop() || ''
    const items = await nasList(parent)
    return items.find(f => f.name === name) || null
  } catch {
    return null
  }
}

/** Hapus berkas/folder (recursive pada sisi NAS). */
export async function nasRemove(absPaths: string[]): Promise<void> {
  if (!absPaths.length) return
  await callWithSession({
    api: 'SYNO.FileStation.Delete',
    version: '2',
    method: 'delete',
    path: JSON.stringify(absPaths),
    recursive: 'true',
  })
}

/** Walk rekursif seluruh berkas di bawah baseAbs → daftar path relatif + ukuran + mtime. */
export async function nasWalk(baseRel = ''): Promise<Array<{ rel: string; size: number; mtime: number }>> {
  const out: Array<{ rel: string; size: number; mtime: number }> = []
  const baseAbs = baseRel ? nasFullPath(baseRel) : env.storagePath
  const walk = async (absDir: string, relPrefix: string) => {
    const items = await nasList(absDir)
    for (const it of items) {
      const rel = relPrefix ? `${relPrefix}/${it.name}` : it.name
      if (it.isdir) {
        await walk(it.path, rel)
      } else {
        out.push({ rel, size: it.size, mtime: it.mtime })
      }
    }
  }
  await walk(baseAbs, baseRel.replace(/\/+$/, ''))
  return out
}

/** Cek NAS hidup & kredensial benar. */
export async function nasPing(): Promise<boolean> {
  try {
    await nasList(env.storagePath)
    return true
  } catch {
    return false
  }
}
