// Test end-to-end: manager buat tugas utk TIAP kerani (DB) → login sbg kerani
// itu → upload berkas → cek status SUBMITTED.
// Login per kerani: password DB tidak diketahui → pakai jalur demo store:
// setiap kerani DB di-sync ke store saat /users, TAPI tanpa password.
// Maka untuk simulasi "kerani mengupload", kita jadi kerani itu lewat portal-
// style token: mint JWT HS256 dengan secret modul (role KERANI, user_id = id DB).
const jwt = require('jsonwebtoken')
const SECRET = 'ptrj-rebinmas-secret-key-2024'
const BASE = 'http://127.0.0.1:8011'
const PDF = Buffer.from('%PDF-1.4 tugas-per-kerani test\n%%EOF')

async function main() {
  // 1) manager login + daftar kerani
  const l = await fetch(BASE + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) })
  const { data: { token: mgrTok } } = await l.json()
  const H = { Authorization: 'Bearer ' + mgrTok, 'Content-Type': 'application/json' }
  const u = await fetch(BASE + '/api/v1/users', { headers: H })
  const kerani = ((await u.json()).data || []).filter(x => (x.raw_role || x.role_code || '').toUpperCase() === 'KERANI')

  let pass = 0, fail = 0
  for (const k of kerani) {
    try {
      // 2) buat tugas utk kerani ini
      const mk = await fetch(BASE + '/api/v1/tasks', {
        method: 'POST', headers: H,
        body: JSON.stringify({ title: `Tugas Upload — ${k.full_name}`, description: `Tes upload oleh ${k.full_name} (${k.divisi || '-'})`, target_kerani_ids: [k.user_id], priority: 'MEDIUM' }),
      })
      if (mk.status !== 201) throw new Error(`create task ${mk.status}`)
      const { data: { task_id } } = await mk.json()

      // 3) jadi kerani itu (HS256 token dgn user_id DB)
      const ktok = jwt.sign({ user_id: k.user_id, username: k.username, role_code: 'KERANI' }, SECRET, { expiresIn: '1h' })

      // 4) kerani lihat tugasnya
      const tl = await fetch(BASE + '/api/v1/tasks', { headers: { Authorization: 'Bearer ' + ktok } })
      const tj = await tl.json()
      const mine = (tj.data || []).find(x => x.task_id === task_id && x.assignment_id)
      if (!mine) throw new Error('tugas tidak terlihat oleh kerani')

      // 5) kerani upload
      const fd = new FormData()
      fd.append('file', new Blob([PDF], { type: 'application/pdf' }), `upload_${k.username}.pdf`)
      fd.append('notes', `Upload oleh ${k.full_name}`)
      const sub = await fetch(BASE + `/api/v1/assignments/${mine.assignment_id}/submit`, { method: 'POST', headers: { Authorization: 'Bearer ' + ktok }, body: fd })
      const sj = await sub.json().catch(() => ({}))
      if (sub.status !== 200) throw new Error(`submit ${sub.status}: ${sj.message || ''}`)

      console.log(`PASS ${k.full_name.padEnd(26)} task#${task_id} assignment#${mine.assignment_id} rev${sj.data.revision_number}`)
      pass++
    } catch (e) {
      console.log(`FAIL ${k.full_name}: ${e.message}`)
      fail++
    }
  }
  console.log(`\n==== RESULT pass=${pass} fail=${fail} ====`)
  process.exit(fail ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
