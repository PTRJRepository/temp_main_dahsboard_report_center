import { writeFileSync } from 'node:fs'

const BASE = process.env.RJFM_BASE || 'http://localhost:8011'

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, opts)
  const text = await r.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text.slice(0, 200) } }
  return { status: r.status, json, text }
}

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg)
  console.log('  OK', msg)
}

async function main() {
  const pdf = Buffer.from('%PDF-1.4 demo kerani test\n%%EOF')
  const fakeExe = Buffer.from('MZ\x90\x00not-a-pdf')
  let pass = 0, fail = 0
  const run = async (name, fn) => {
    process.stdout.write('\n[' + name + ']\n')
    try { await fn(); pass++ } catch (e) { fail++; console.error('  ' + e.message) }
  }

  let keraniTok, managerTok, asistenTok
  let taskId = 0, assignId = 0

  await run('K1 login kerani demo', async () => {
    const r = await req('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'kerani', password: 'kerani123' }) })
    assert(r.status === 200, '200 login')
    assert(r.json.data.user.role_code === 'KERANI', 'role KERANI')
    keraniTok = r.json.data.token
    assert(!!keraniTok, 'token')
  })
  await run('K2 login salah password', async () => {
    const r = await req('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'kerani', password: 'wrong' }) })
    assert(r.status === 401, '401')
  })
  await run('K3 login manager', async () => {
    const r = await req('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'manager', password: 'manager123' }) })
    assert(r.status === 200 && r.json.data.user.role_code === 'MANAGER', 'manager')
    managerTok = r.json.data.token
  })
  await run('K4 login asisten', async () => {
    const r = await req('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'asisten', password: 'manager123' }) })
    assert(r.status === 200, 'asisten')
    asistenTok = r.json.data.token
  })

  const auth = (t) => ({ Authorization: 'Bearer ' + t })

  await run('K5 kerani lihat tugas assigned (siswa LMS)', async () => {
    const r = await req('/api/v1/tasks', { headers: auth(keraniTok) })
    assert(r.status === 200, '200 tasks')
    const data = r.json.data
    assert(Array.isArray(data) && data.length >= 2, 'min 2 tugas')
    assert(data.every(t => t.assignment_id), 'punya assignment_id')
  })
  await run('K6 kerani tidak boleh create task', async () => {
    const r = await req('/api/v1/tasks', { method: 'POST', headers: { ...auth(keraniTok), 'Content-Type': 'application/json' }, body: JSON.stringify({ category_id: 1, title: 'x', description: 'y', target_kerani_ids: [90002], deadline: new Date().toISOString() }) })
    assert(r.status === 403, '403')
  })
  await run('K7 assignment REVISION_NEEDED punya feedback manager', async () => {
    const r = await req('/api/v1/assignments/2', { headers: auth(keraniTok) })
    assert(r.status === 200, '200 detail')
    assert(r.json.data.assignment.current_status === 'REVISION_NEEDED', 'status revisi')
    const fb = r.json.data.revisions[0]?.manager_feedback || ''
    assert(fb.length >= 10, 'feedback >=10')
  })
  await run('K8 kerani tidak akses assignment orang lain', async () => {
    const r = await req('/api/v1/assignments/3', { headers: auth(keraniTok) })
    assert(r.status === 403, '403 assignment 3 milik kerani_afd2')
  })
  await run('K9 submit tanpa file', async () => {
    const fd = new FormData(); fd.append('notes', 'tanpa file')
    const r = await req(`/api/v1/assignments/${assignId}/submit`, { method: 'POST', headers: auth(keraniTok), body: fd })
    assert(r.status === 400, '400')
  })
  await run('K10 submit exe disamarkan (magic bytes)', async () => {
    const fd = new FormData()
    fd.append('file', new Blob([fakeExe], { type: 'application/pdf' }), 'virus.pdf')
    const r = await req(`/api/v1/assignments/${assignId}/submit`, { method: 'POST', headers: auth(keraniTok), body: fd })
    assert(r.status === 415, '415 mime spoof')
  })
  // Tugas & assignment kerani dibuat dinamis (ID tidak stabil karena seed + run sebelumnya)
  await run('K0 setup: manager buat tugas untuk kerani', async () => {
    const r = await req('/api/v1/tasks', { method: 'POST', headers: { ...auth(managerTok), 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'LHP Harian Uji Otomatis', description: 'Unggah LHP uji.', target_kerani_ids: [90002], deadline: new Date(Date.now() + 864e5).toISOString(), priority: 'HIGH' }) })
    assert(r.status === 201, '201 task')
    taskId = r.json.data.task_id
    const list = await req('/api/v1/assignments', { headers: auth(keraniTok) })
    const mine = (list.json.data || []).filter(x => x.task_id === taskId)
    assert(mine.length === 1, 'assignment untuk kerani')
    assignId = mine[0].assignment_id
  })

  await run('K11 submit PDF valid tugas 1 + mirror Drive', async () => {
    const fd = new FormData()
    fd.append('file', new Blob([pdf], { type: 'application/pdf' }), 'LHP_Afd01.pdf')
    fd.append('notes', 'LHP lengkap + foto TPH')
    const r = await req(`/api/v1/assignments/${assignId}/submit`, { method: 'POST', headers: auth(keraniTok), body: fd })
    assert(r.status === 200, '200 submit')
    assert(r.json.data.revision_number === 1, 'v1')
    assert(r.json.data.current_status === 'SUBMITTED', 'SUBMITTED')
    assert(String(r.json.data.sha256).length === 64, 'sha256')
    // Mirror: berkas tugas otomatis muncul di folder "Tugas" milik kerani
    const d = await req('/api/v1/drive?parent_id=root', { headers: auth(keraniTok) })
    const tugasFolder = d.json.data.find(x => x.kind === 'folder' && String(x.name).toLowerCase() === 'tugas')
    assert(!!tugasFolder, 'folder Tugas dibuat')
    if (tugasFolder) {
      const inside = await req(`/api/v1/drive?parent_id=${tugasFolder.file_id}`, { headers: auth(keraniTok) })
      const mirrored = (inside.json.data || []).find(x => x.name === 'LHP_Afd01.pdf' && x.source === 'task_submission')
      assert(!!mirrored, 'berkas tugas termirror di drive')
      assert(mirrored.submitter_name && mirrored.submitted_at && (mirrored.notes ?? null) !== undefined && typeof mirrored.notes !== 'undefined', 'metadata pengirim/waktu/catatan ada')
      assert(String(mirrored.notes || '').includes('LHP lengkap'), 'isi catatan sesuai')
    }
  })
  await run('K12 kerani tidak boleh review', async () => {
    const r = await req(`/api/v1/submissions/${assignId}/review`, { method: 'POST', headers: { ...auth(keraniTok), 'Content-Type': 'application/json' }, body: JSON.stringify({ review_status: 'APPROVED' }) })
    assert(r.status === 403, '403')
  })
  await run('K13 manager review tanpa feedback → 422', async () => {
    const r = await req(`/api/v1/submissions/${assignId}/review`, { method: 'POST', headers: { ...auth(managerTok), 'Content-Type': 'application/json' }, body: JSON.stringify({ review_status: 'REJECTED_NEEDS_REVISION', manager_feedback: 'pendek' }) })
    assert(r.status === 422, '422 mandatory feedback')
  })
  await run('K14 manager minta revisi dengan feedback', async () => {
    const r = await req(`/api/v1/submissions/${assignId}/review`, { method: 'POST', headers: { ...auth(managerTok), 'Content-Type': 'application/json' }, body: JSON.stringify({ review_status: 'REJECTED_NEEDS_REVISION', manager_feedback: 'Tonase TPH 12 tidak sinkron nota PKS, hitung ulang.' }) })
    assert(r.status === 200, '200 revisi')
  })
  await run('K15 kerani lihat status REVISION_NEEDED + notif', async () => {
    const a = await req(`/api/v1/assignments/${assignId}`, { headers: auth(keraniTok) })
    assert(a.json.data.assignment.current_status === 'REVISION_NEEDED', 'revisi')
    const n = await req('/api/v1/notifications', { headers: auth(keraniTok) })
    assert(n.json.data.some(x => String(x.title).includes('Revisi')), 'notif revisi')
  })
  await run('K16 kerani upload v2', async () => {
    const fd = new FormData()
    fd.append('file', new Blob([pdf], { type: 'application/pdf' }), 'LHP_Afd01_rev2.pdf')
    fd.append('notes', 'Perbaikan tonase sesuai arahan')
    const r = await req(`/api/v1/assignments/${assignId}/submit`, { method: 'POST', headers: auth(keraniTok), body: fd })
    assert(r.json.data.revision_number === 2, 'v2 no overwrite')
  })
  await run('K17 manager approve v2', async () => {
    const r = await req(`/api/v1/submissions/${assignId}/review`, { method: 'POST', headers: { ...auth(managerTok), 'Content-Type': 'application/json' }, body: JSON.stringify({ review_status: 'APPROVED' }) })
    assert(r.status === 200, 'approved')
    const a = await req(`/api/v1/assignments/${assignId}`, { headers: auth(keraniTok) })
    assert(a.json.data.assignment.current_status === 'APPROVED', 'locked approved')
  })
  await run('K18 drive list kerani (GDrive-like)', async () => {
    const r = await req('/api/v1/drive?parent_id=root', { headers: auth(keraniTok) })
    assert(r.status === 200, '200 drive')
    assert(r.json.data.some(x => x.kind === 'folder'), 'punya folder')
    assert(r.json.quota.cap_bytes > 0, 'quota')
  })
  await run('K19 drive mkdir + upload + star + trash', async () => {
    const mk = await req('/api/v1/drive/folders', { method: 'POST', headers: { ...auth(keraniTok), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Bukti Panen Hari Ini' }) })
    assert(mk.status === 201, 'folder')
    const fd = new FormData()
    fd.append('file', new Blob([pdf], { type: 'application/pdf' }), 'bukti.pdf')
    fd.append('parent_id', String(mk.json.data.file_id))
    const up = await req('/api/v1/drive/upload', { method: 'POST', headers: auth(keraniTok), body: fd })
    assert(up.status === 201, 'upload drive')
    const id = up.json.data.file_id
    const st = await req('/api/v1/drive/' + id, { method: 'PATCH', headers: { ...auth(keraniTok), 'Content-Type': 'application/json' }, body: JSON.stringify({ starred: true }) })
    assert(st.json.data.starred === true, 'star')
    const tr = await req('/api/v1/drive/' + id, { method: 'PATCH', headers: { ...auth(keraniTok), 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) })
    assert(tr.json.data.trashed === true, 'trash')
    const trash = await req('/api/v1/drive?trashed=1', { headers: auth(keraniTok) })
    assert(trash.json.data.some(x => x.file_id === id), 'ada di sampah')
  })
  await run('K20 drive search', async () => {
    const r = await req('/api/v1/drive?q=Laporan', { headers: auth(keraniTok) })
    assert(r.status === 200 && r.json.data.length >= 1, 'search Laporan')
  })
  await run('K21 kerani tidak list users (RBAC)', async () => {
    const r = await req('/api/v1/users', { headers: auth(keraniTok) })
    assert(r.status === 403, '403 users')
  })
  await run('K22 asisten TIDAK boleh create task (hanya Manager/Admin/GM)', async () => {
    const r = await req('/api/v1/tasks', { method: 'POST', headers: { ...auth(asistenTok), 'Content-Type': 'application/json' }, body: JSON.stringify({ category_id: 4, title: 'Absensi premi 21 Agu', description: 'Upload rekap absen mandor', target_kerani_ids: [90002], deadline: new Date(Date.now() + 864e5).toISOString(), priority: 'MEDIUM' }) })
    assert(r.status === 403, '403 asisten create')
    // Manager tetap boleh
    const m = await req('/api/v1/tasks', { method: 'POST', headers: { ...auth(managerTok), 'Content-Type': 'application/json' }, body: JSON.stringify({ category_id: 4, title: 'Absensi premi (mgr) 21 Agu', description: 'Upload rekap absen mandor', target_kerani_ids: [90002], deadline: new Date(Date.now() + 864e5).toISOString(), priority: 'MEDIUM' }) })
    assert(m.status === 201, '201 manager create')
    const t = await req('/api/v1/tasks', { headers: auth(keraniTok) })
    assert(t.json.data.some(x => String(x.title).includes('Absensi')), 'kerani melihat tugas baru')
  })
  await run('K23 unauthorized tanpa token', async () => {
    const r = await req('/api/v1/tasks')
    assert(r.status === 401, '401')
  })

  console.log('\n==== RESULT pass=' + pass + ' fail=' + fail + ' ====')
  if (fail) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })


