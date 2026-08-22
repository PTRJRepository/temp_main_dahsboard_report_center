// Smoke test: DB login (extend_db_ptrj), demo fallback, users dari DB
const http = require('http')

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const r = http.request({ host: '127.0.0.1', port: 8011, path, method, headers: {
      'Content-Type': 'application/json',
      ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    } }, res => {
      let buf = ''
      res.on('data', c => buf += c)
      res.on('end', () => resolve({ status: res.statusCode, json: (() => { try { return JSON.parse(buf) } catch { return null } })() }))
    })
    r.on('error', reject)
    if (data) r.write(data)
    r.end()
  })
}

const assert = (cond, name) => { if (!cond) { console.error('FAIL:', name); process.exitCode = 1 } else console.log('PASS:', name) }

async function main() {
  // 1) login DB — admin/admin123 (dari user_ptrj)
  const adm = await req('POST', '/api/v1/auth/login', { username: 'admin', password: 'admin123' })
  assert(adm.status === 200 && adm.json?.data?.mode === 'mssql', `login DB admin (mode=${adm.json?.data?.mode}, role=${adm.json?.data?.user?.role_code})`)

  // 2) login DB gagal password
  const bad = await req('POST', '/api/v1/auth/login', { username: 'admin', password: 'salah' })
  assert(bad.status === 401, 'login DB password salah ditolak')

  // 3) demo fallback masih jalan
  const demo = await req('POST', '/api/v1/auth/login', { username: 'kerani', password: 'kerani123' })
  assert(demo.status === 200 && demo.json?.data?.mode === 'demo', 'login demo kerani fallback')

  // 4) users dari extend_db_ptrj (manager/admin token)
  const tok = adm.json?.data?.token
  const users = await req('GET', '/api/v1/users', null, tok)
  const list = users.json?.data || []
  const keraniCount = list.filter(u => u.role_code === 'KERANI').length
  assert(users.status === 200 && users.json?.source === 'mssql' && list.length > 0, `meta/users source=mssql (${list.length} user, ${keraniCount} kerani)`)
  console.log('   contoh:', JSON.stringify(list.slice(0, 3).map(u => ({ id: u.user_id, name: u.full_name, role: u.raw_role, divisi: u.divisi }))))

  // 5) buat tugas memo cepat (tanpa category & deadline) ke kerani pertama dari DB
  const target = list.find(u => u.role_code === 'KERANI')
  if (target) {
    const mk = await req('POST', '/api/v1/tasks', { title: 'Smoke Memo', description: 'Tes memo tanpa kategori/deadline.', target_kerani_ids: [target.user_id] }, tok)
    assert(mk.status === 201, `buat tugas memo cepat (id=${mk.json?.data?.task_id})`)
  }
}

main().catch(e => { console.error('ERROR', e); process.exit(1) })
