// Repro "Forbidden role" saat upload: login kerani → submit assignment miliknya
const BASE = 'http://127.0.0.1:8011'

async function main() {
  const l = await fetch(BASE + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'kerani', password: 'kerani123' }) })
  const lj = await l.json()
  const tok = lj.data.token
  const uid = lj.data.user.user_id
  console.log('login ok — user_id:', uid, 'role:', lj.data.user.role_code)

  const t = await fetch(BASE + '/api/v1/tasks', { headers: { Authorization: 'Bearer ' + tok } })
  const tj = await t.json()
  const mine = (tj.data || []).filter(x => x.assignment_id)
  console.log('assignments:', mine.map(x => `${x.assignment_id}:${x.current_status}`).join(', '))
  if (!mine.length) return console.log('tidak ada assignment')

  const pdf = Buffer.from('%PDF-1.4 upload repro\n%%EOF')
  for (const a of mine.slice(0, 1)) {
    const fd = new FormData()
    fd.append('file', new Blob([pdf], { type: 'application/pdf' }), 'repro-upload.pdf')
    fd.append('notes', 'repro forbidden test')
    const r = await fetch(BASE + `/api/v1/assignments/${a.assignment_id}/submit`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok }, body: fd })
    console.log(`submit assignment ${a.assignment_id}:`, r.status, (await r.text()).slice(0, 120))
  }
}
main().catch(e => { console.error(e); process.exit(1) })
