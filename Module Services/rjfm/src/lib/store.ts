import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'
import { MANAGER_ROLES } from '../middleware/auth.js'

const STORE_PATH = process.env.RJFM_STORE_PATH || path.join(process.cwd(), 'data', 'rjfm-demo.json')

export type RoleCode = 'SUPERADMIN' | 'MANAGER' | 'ASISTEN' | 'KERANI'
export type TaskStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'REVISION_NEEDED' | 'APPROVED'
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED_NEEDS_REVISION'

export type User = {
  user_id: number
  username: string
  full_name: string
  email: string
  phone_number: string
  role_code: RoleCode
  afdeling_id: number | null
  password_hash: string
  is_active: boolean
}
export type Category = { category_id: number; category_name: string; description: string; is_active: boolean }
export type Afdeling = { afdeling_id: number; code: string; name: string; is_active: boolean }
export type Task = {
  task_id: number
  category_id: number
  created_by_user_id: number
  title: string
  description: string
  allowed_mime_types: string
  max_file_size_mb: number
  deadline: string
  priority: string
  template_file_path: string | null
  is_active: boolean
  created_at: string
}
export type Assignment = {
  assignment_id: number
  task_id: number
  kerani_user_id: number
  current_status: TaskStatus
  assigned_at: string
  completed_at: string | null
}
export type Revision = {
  revision_id: number
  assignment_id: number
  revision_number: number
  file_original_name: string
  file_system_name: string
  file_storage_path: string
  file_size_bytes: number
  file_mime_type: string
  file_hash_sha256: string
  notes_from_kerani: string | null
  submitted_at: string
  reviewed_by_user_id: number | null
  review_status: ReviewStatus
  manager_feedback: string | null
  reviewed_at: string | null
}
export type DriveItem = {
  file_id: number
  owner_user_id: number
  parent_id: number | null
  name: string
  kind: 'folder' | 'file'
  mime_type: string | null
  size_bytes: number
  storage_path: string | null
  sha256: string | null
  trashed: boolean
  starred: boolean
  created_at: string
  updated_at: string
}
export type Notif = {
  notification_id: number
  user_id: number
  title: string
  message: string
  channel: string
  related_task_id: number | null
  is_read: boolean
  created_at: string
}

type Store = {
  seq: Record<string, number>
  users: User[]
  categories: Category[]
  afdelings: Afdeling[]
  tasks: Task[]
  assignments: Assignment[]
  revisions: Revision[]
  drive: DriveItem[]
  notifications: Notif[]
}

function now() { return new Date().toISOString() }
function next(s: Store, k: string) { s.seq[k] = (s.seq[k] || 0) + 1; return s.seq[k] }

function seed(): Store {
  const hash = bcrypt.hashSync('kerani123', 8)
  const hashMgr = bcrypt.hashSync('manager123', 8)
  const hashAdm = bcrypt.hashSync('admin123', 8)
  const s: Store = {
    seq: { user: 3, cat: 5, afd: 5, task: 2, assignment: 3, revision: 1, drive: 6, notif: 2 },
    users: [
      { user_id: 1, username: 'manager', full_name: 'Estate Manager', email: 'manager@rebinmas.local', phone_number: '+628111000001', role_code: 'MANAGER', afdeling_id: null, password_hash: hashMgr, is_active: true },
      { user_id: 2, username: 'kerani', full_name: 'Kerani Afdeling 01', email: 'kerani@rebinmas.local', phone_number: '+628111000002', role_code: 'KERANI', afdeling_id: 1, password_hash: hash, is_active: true },
      { user_id: 3, username: 'asisten', full_name: 'Asisten Afdeling 01', email: 'asisten@rebinmas.local', phone_number: '+628111000003', role_code: 'ASISTEN', afdeling_id: 1, password_hash: hashMgr, is_active: true },
      { user_id: 4, username: 'admin', full_name: 'Superadmin IT', email: 'admin@rebinmas.local', phone_number: '+628111000000', role_code: 'SUPERADMIN', afdeling_id: null, password_hash: hashAdm, is_active: true },
      { user_id: 5, username: 'kerani_afd2', full_name: 'Kerani Afdeling 02', email: 'kerani2@rebinmas.local', phone_number: '+628111000004', role_code: 'KERANI', afdeling_id: 2, password_hash: hash, is_active: true },
    ],
    categories: [
      { category_id: 1, category_name: 'Laporan Harian Panen (LHP)', description: 'Rekap pemetikan TBS', is_active: true },
      { category_id: 2, category_name: 'Laporan Pemupukan & Agronomi', description: 'Dosis pupuk lapangan', is_active: true },
      { category_id: 3, category_name: 'Rekap Restan Buah TBS', description: 'Sisa buah TPH', is_active: true },
      { category_id: 4, category_name: 'Absensi & Premi Mandor/Pemanen', description: 'Kehadiran & premi', is_active: true },
      { category_id: 5, category_name: 'Perawatan Unit & Traksi', description: 'Servis alat berat', is_active: true },
    ],
    afdelings: [
      { afdeling_id: 1, code: 'AFD-01', name: 'Afdeling 01 (Kebun Barat)', is_active: true },
      { afdeling_id: 2, code: 'AFD-02', name: 'Afdeling 02 (Kebun Timur)', is_active: true },
      { afdeling_id: 3, code: 'AFD-03', name: 'Afdeling 03 (Kebun Selatan)', is_active: true },
      { afdeling_id: 4, code: 'PKS-01', name: 'Pabrik Kelapa Sawit (Mill)', is_active: true },
      { afdeling_id: 5, code: 'TRAKSI', name: 'Workshop & Traksi', is_active: true },
    ],
    tasks: [
      {
        task_id: 1, category_id: 1, created_by_user_id: 1,
        title: 'LHP Harian Afdeling 01 — 21 Agu 2026',
        description: 'Unggah scan LHP resmi yang ditandatangani mandor + foto kondisi TPH Blok C. Format PDF/JPG.',
        allowed_mime_types: 'application/pdf,image/jpeg,image/png',
        max_file_size_mb: 10, deadline: new Date(Date.now() + 36e5 * 8).toISOString(),
        priority: 'HIGH', template_file_path: null, is_active: true, created_at: now(),
      },
      {
        task_id: 2, category_id: 3, created_by_user_id: 3,
        title: 'Rekap Restan TBS TPH 12–14',
        description: 'Hitung restan per TPH. Jika ada selisih vs nota PKS, lampirkan foto tumpukan.',
        allowed_mime_types: 'application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg',
        max_file_size_mb: 10, deadline: new Date(Date.now() + 36e5 * 30).toISOString(),
        priority: 'URGENT', template_file_path: null, is_active: true, created_at: now(),
      },
    ],
    assignments: [
      { assignment_id: 1, task_id: 1, kerani_user_id: 2, current_status: 'ASSIGNED', assigned_at: now(), completed_at: null },
      { assignment_id: 2, task_id: 2, kerani_user_id: 2, current_status: 'REVISION_NEEDED', assigned_at: now(), completed_at: null },
      { assignment_id: 3, task_id: 1, kerani_user_id: 5, current_status: 'ASSIGNED', assigned_at: now(), completed_at: null },
    ],
    revisions: [
      {
        revision_id: 1, assignment_id: 2, revision_number: 1,
        file_original_name: 'Restan_TPH12_v1.pdf', file_system_name: 'seed_restan_v1.pdf',
        file_storage_path: 'drive/seed_restan_v1.pdf', file_size_bytes: 1200,
        file_mime_type: 'application/pdf', file_hash_sha256: crypto.createHash('sha256').update('seed').digest('hex'),
        notes_from_kerani: 'Draft awal restan TPH 12', submitted_at: now(),
        reviewed_by_user_id: 1, review_status: 'REJECTED_NEEDS_REVISION',
        manager_feedback: 'Angka tonase TPH 12 halaman 2 tidak sinkron dengan nota timbang PKS. Hitung ulang dan upload v2.',
        reviewed_at: now(),
      },
    ],
    drive: [
      { file_id: 1, owner_user_id: 2, parent_id: null, name: 'Laporan Panen', kind: 'folder', mime_type: null, size_bytes: 0, storage_path: null, sha256: null, trashed: false, starred: true, created_at: now(), updated_at: now() },
      { file_id: 2, owner_user_id: 2, parent_id: null, name: 'Foto TPH', kind: 'folder', mime_type: null, size_bytes: 0, storage_path: null, sha256: null, trashed: false, starred: false, created_at: now(), updated_at: now() },
      { file_id: 3, owner_user_id: 2, parent_id: 1, name: 'Template_LHP.xlsx', kind: 'file', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size_bytes: 2048, storage_path: 'drive/template_lhp.xlsx', sha256: 'abc', trashed: false, starred: false, created_at: now(), updated_at: now() },
      { file_id: 4, owner_user_id: 1, parent_id: null, name: 'Shared Manager', kind: 'folder', mime_type: null, size_bytes: 0, storage_path: null, sha256: null, trashed: false, starred: false, created_at: now(), updated_at: now() },
      { file_id: 5, owner_user_id: 2, parent_id: null, name: 'Draft lama.pdf', kind: 'file', mime_type: 'application/pdf', size_bytes: 800, storage_path: 'drive/draft_lama.pdf', sha256: 'def', trashed: true, starred: false, created_at: now(), updated_at: now() },
      { file_id: 6, owner_user_id: 2, parent_id: 2, name: 'tph-blok-c.jpg', kind: 'file', mime_type: 'image/jpeg', size_bytes: 4096, storage_path: 'drive/tph-blok-c.jpg', sha256: 'ghi', trashed: false, starred: true, created_at: now(), updated_at: now() },
    ],
    notifications: [
      { notification_id: 1, user_id: 2, title: 'Tugas baru: LHP Harian', message: 'Unggah scan LHP + foto TPH sebelum jam 17.00.', channel: 'IN_APP', related_task_id: 1, is_read: false, created_at: now() },
      { notification_id: 2, user_id: 2, title: 'Perlu Revisi: Rekap Restan', message: 'Catatan Koreksi: Angka tonase TPH 12 tidak sinkron.', channel: 'IN_APP', related_task_id: 2, is_read: false, created_at: now() },
    ],
  }
  s.seq.user = 5
  return s
}

let mem: Store | null = null

function load(): Store {
  if (mem) return mem
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true })
    if (fs.existsSync(STORE_PATH)) {
      mem = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as Store
      return mem
    }
  } catch { /* seed */ }
  mem = seed()
  save()
  return mem
}
function save() {
  if (!mem) return
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true })
  fs.writeFileSync(STORE_PATH, JSON.stringify(mem, null, 2), 'utf8')
}

export const store = {
  all: () => load(),
  save,
  next: (k: string) => next(load(), k),
  findUserByUsername(u: string) {
    const s = load()
    return s.users.find(x => x.username.toLowerCase() === u.toLowerCase() && x.is_active && !!x.password_hash)
  },
  findUser(id: number) { return load().users.find(x => x.user_id === id) },
  upsertUser(u: User) {
    const s = load()
    const i = s.users.findIndex(x => x.user_id === u.user_id)
    if (i >= 0) {
      // preserve existing local password (demo login) when syncing from MSSQL
      s.users[i] = { ...s.users[i], ...u, password_hash: u.password_hash || s.users[i].password_hash }
    } else {
      s.users.push({ ...u, password_hash: u.password_hash || '' })
    }
    save()
  },
  usersKerani() { return load().users.filter(x => x.role_code === 'KERANI' && x.is_active) },
  categories() { return load().categories.filter(c => c.is_active) },
  afdelings() { return load().afdelings.filter(a => a.is_active) },
  users() { return load().users.filter(u => u.is_active).map(({ password_hash: _, ...r }) => r) },
  tasksFor(user: { user_id: number; role_code: string }) {
    const s = load()
    if (MANAGER_ROLES.includes(user.role_code)) return s.tasks.filter(t => t.is_active)
    const mine = s.assignments.filter(a => a.kerani_user_id === user.user_id)
    return mine.map(a => {
      const t = s.tasks.find(x => x.task_id === a.task_id)!
      const latestRev = s.revisions.filter(r => r.assignment_id === a.assignment_id).sort((x, y) => y.revision_number - x.revision_number)[0]
      return { ...t, assignment_id: a.assignment_id, current_status: a.current_status, latest_feedback: latestRev?.manager_feedback ?? null, revision_count: s.revisions.filter(r => r.assignment_id === a.assignment_id).length }
    }).filter(Boolean)
  },
  task(id: number) { return load().tasks.find(t => t.task_id === id) },
  assignmentsFor(user: { user_id: number; role_code: string }) {
    const s = load()
    const list = MANAGER_ROLES.includes(user.role_code)
      ? s.assignments
      : s.assignments.filter(a => a.kerani_user_id === user.user_id)
    return list.map(a => {
      const t = s.tasks.find(x => x.task_id === a.task_id)
      const u = s.users.find(x => x.user_id === a.kerani_user_id)
      return { ...a, title: t?.title, description: t?.description, deadline: t?.deadline, priority: t?.priority, kerani_username: u?.username }
    })
  },
  assignment(id: number) {
    const s = load()
    const a = s.assignments.find(x => x.assignment_id === id)
    if (!a) return null
    const t = s.tasks.find(x => x.task_id === a.task_id)
    const revs = s.revisions.filter(r => r.assignment_id === id).sort((x, y) => y.revision_number - x.revision_number)
    return { assignment: { ...a, title: t?.title, description: t?.description, deadline: t?.deadline, priority: t?.priority }, revisions: revs }
  },
  createTask(input: Omit<Task, 'task_id' | 'created_at' | 'is_active'> & { target_kerani_ids: number[] }) {
    const s = load()
    const task_id = next(s, 'task')
    const t: Task = { ...input, task_id, is_active: true, created_at: now(), template_file_path: input.template_file_path ?? null }
    s.tasks.unshift(t)
    for (const kid of input.target_kerani_ids) {
      const assignment_id = next(s, 'assignment')
      s.assignments.unshift({ assignment_id, task_id, kerani_user_id: kid, current_status: 'ASSIGNED', assigned_at: now(), completed_at: null })
      const nid = next(s, 'notif')
      s.notifications.unshift({ notification_id: nid, user_id: kid, title: `Tugas baru: ${t.title}`, message: t.description, channel: 'IN_APP', related_task_id: task_id, is_read: false, created_at: now() })
      const n2 = next(s, 'notif')
      s.notifications.unshift({ notification_id: n2, user_id: kid, title: `Tugas baru: ${t.title}`, message: t.description, channel: 'WHATSAPP', related_task_id: task_id, is_read: false, created_at: now() })
    }
    save()
    return t
  },
  submitRevision(assignmentId: number, file: { originalName: string; systemName: string; storagePath: string; sizeBytes: number; mimeType: string; sha256: string }, notes?: string) {
    const s = load()
    const a = s.assignments.find(x => x.assignment_id === assignmentId)
    if (!a) throw Object.assign(new Error('Assignment not found'), { status: 404 })
    const maxRev = s.revisions.filter(r => r.assignment_id === assignmentId).reduce((m, r) => Math.max(m, r.revision_number), 0)
    const revision_id = next(s, 'revision')
    const rev: Revision = {
      revision_id, assignment_id: assignmentId, revision_number: maxRev + 1,
      file_original_name: file.originalName, file_system_name: file.systemName, file_storage_path: file.storagePath,
      file_size_bytes: file.sizeBytes, file_mime_type: file.mimeType, file_hash_sha256: file.sha256,
      notes_from_kerani: notes || null, submitted_at: now(),
      reviewed_by_user_id: null, review_status: 'PENDING', manager_feedback: null, reviewed_at: null,
    }
    s.revisions.unshift(rev)
    a.current_status = 'SUBMITTED'
    a.completed_at = null
    save()
    return rev
  },
  review(assignmentId: number, reviewerId: number, status: 'APPROVED' | 'REJECTED_NEEDS_REVISION', feedback?: string | null) {
    if (status === 'REJECTED_NEEDS_REVISION' && (!feedback || feedback.trim().length < 10)) {
      throw Object.assign(new Error('Instruksi revisi wajib diisi minimal 10 karakter agar kerani paham letak perbaikan.'), { status: 422, code: 'FEEDBACK_MANDATORY_REQUIRED' })
    }
    const s = load()
    const a = s.assignments.find(x => x.assignment_id === assignmentId)
    if (!a) throw Object.assign(new Error('Assignment not found'), { status: 404 })
    const latest = s.revisions.filter(r => r.assignment_id === assignmentId).sort((x, y) => y.revision_number - x.revision_number)[0]
    if (!latest) throw Object.assign(new Error('Tidak ditemukan berkas submission untuk tugas ini.'), { status: 404 })
    latest.reviewed_by_user_id = reviewerId
    latest.review_status = status
    latest.manager_feedback = feedback || null
    latest.reviewed_at = now()
    a.current_status = status === 'APPROVED' ? 'APPROVED' : 'REVISION_NEEDED'
    a.completed_at = status === 'APPROVED' ? now() : null
    const t = s.tasks.find(x => x.task_id === a.task_id)
    const nid = next(s, 'notif')
    s.notifications.unshift({
      notification_id: nid, user_id: a.kerani_user_id,
      title: status === 'APPROVED' ? `Tugas Disetujui: ${t?.title}` : `Perlu Revisi Segera: ${t?.title}`,
      message: status === 'APPROVED' ? 'Berkas disetujui Manager/Asisten.' : `Catatan Koreksi: ${feedback}`,
      channel: 'IN_APP', related_task_id: a.task_id, is_read: false, created_at: now(),
    })
    save()
    return { assignment_id: assignmentId, review_status: status }
  },
  revision(id: number) {
    const s = load()
    const r = s.revisions.find(x => x.revision_id === id)
    if (!r) return null
    const a = s.assignments.find(x => x.assignment_id === r.assignment_id)
    const t = a ? s.tasks.find(x => x.task_id === a.task_id) : null
    return { ...r, kerani_user_id: a?.kerani_user_id, task_id: a?.task_id, created_by_user_id: t?.created_by_user_id }
  },
  driveList(ownerId: number, opts: { parent_id?: number | null; q?: string; trashed?: boolean; starred?: boolean; recent?: boolean }) {
    const s = load()
    let items = s.drive.filter(d => d.owner_user_id === ownerId)
    if (opts.trashed) items = items.filter(d => d.trashed)
    else items = items.filter(d => !d.trashed)
    if (opts.starred) items = items.filter(d => d.starred)
    if (opts.recent) items = [...items].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 30)
    else if (opts.parent_id === undefined) { /* all */ }
    else items = items.filter(d => d.parent_id === (opts.parent_id ?? null))
    if (opts.q) {
      const q = opts.q.toLowerCase()
      items = items.filter(d => d.name.toLowerCase().includes(q))
    }
    return items
  },
  driveGet(id: number) { return load().drive.find(d => d.file_id === id) },
  driveMkdir(ownerId: number, name: string, parent_id: number | null) {
    const s = load()
    const file_id = next(s, 'drive')
    const item: DriveItem = { file_id, owner_user_id: ownerId, parent_id, name, kind: 'folder', mime_type: null, size_bytes: 0, storage_path: null, sha256: null, trashed: false, starred: false, created_at: now(), updated_at: now() }
    s.drive.unshift(item); save(); return item
  },
  driveAddFile(ownerId: number, rec: Omit<DriveItem, 'file_id' | 'owner_user_id' | 'created_at' | 'updated_at' | 'trashed' | 'starred' | 'kind'> & { kind?: 'file' }) {
    const s = load()
    const file_id = next(s, 'drive')
    const item: DriveItem = { file_id, owner_user_id: ownerId, kind: 'file', trashed: false, starred: false, created_at: now(), updated_at: now(), ...rec }
    s.drive.unshift(item); save(); return item
  },
  drivePatch(id: number, ownerId: number, patch: Partial<Pick<DriveItem, 'name' | 'parent_id' | 'trashed' | 'starred'>>) {
    const s = load()
    const d = s.drive.find(x => x.file_id === id && x.owner_user_id === ownerId)
    if (!d) throw Object.assign(new Error('File not found'), { status: 404 })
    Object.assign(d, patch, { updated_at: now() })
    save(); return d
  },
  driveQuota(ownerId: number) {
    const s = load()
    const used = s.drive.filter(d => d.owner_user_id === ownerId && !d.trashed && d.kind === 'file').reduce((n, d) => n + d.size_bytes, 0)
    const cap = 2 * 1024 * 1024 * 1024 // 2GB demo
    return { used_bytes: used, cap_bytes: cap, free_bytes: cap - used, percent: Math.round((used / cap) * 10000) / 100 }
  },
  allFiles() {
    const s = load()
    return s.revisions.map(r => {
      const a = s.assignments.find(x => x.assignment_id === r.assignment_id)
      const t = a ? s.tasks.find(x => x.task_id === a.task_id) : null
      const u = a ? s.users.find(x => x.user_id === a.kerani_user_id) : null
      return {
        revision_id: r.revision_id, assignment_id: r.assignment_id, revision_number: r.revision_number,
        file_original_name: r.file_original_name, file_storage_path: r.file_storage_path,
        file_size_bytes: r.file_size_bytes, file_mime_type: r.file_mime_type, file_hash_sha256: r.file_hash_sha256,
        review_status: r.review_status, submitted_at: r.submitted_at, manager_feedback: r.manager_feedback,
        task_id: a?.task_id, task_title: t?.title, kerani_user_id: a?.kerani_user_id, kerani_name: u?.full_name,
      }
    }).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
  },
  allDrive() {
    const s = load()
    return s.drive.map(d => {
      const u = s.users.find(x => x.user_id === d.owner_user_id)
      return { ...d, owner_name: u?.full_name || `User #${d.owner_user_id}`, owner_username: u?.username }
    })
  },
  notifs(userId: number) { return load().notifications.filter(n => n.user_id === userId && n.channel === 'IN_APP').slice(0, 50) },
  markRead(id: number, userId: number) {
    const n = load().notifications.find(x => x.notification_id === id && x.user_id === userId)
    if (n) { n.is_read = true; save() }
    return n
  },
}

export { env }
