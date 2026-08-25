// Verifikasi submit via cookie rjfm-token (jalur UI monolith)
const BASE = 'http://127.0.0.1:8011'

async function main() {
  const l = await fetch(BASE + '/api/file/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'kerani', password: 'kerani123' }) })
  const sc = l.headers.getSetCookie ? l.headers.getSetCookie() : []
  const ck = sc.map(c => c.split(';')[0]).join('; ')
  const lj = await l.json()
  console.log('login:', l.status, '| uid:', lj.data.user.user_id, '| cookie len:', ck.length)

  const pdf = Buffer.from('%PDF-1.4 cookie submit test\n%%EOF')
  const fd = new FormData()
  fd.append('file', new Blob([pdf], { type: 'application/pdf' }), 'via-cookie.pdf')
  const r = await fetch(BASE + '/api/file/assignments/4/submit', { method: 'POST', headers: { Cookie: ck }, body: fd })
  console.log('submit via cookie:', r.status, (await r.text()).slice(0, 100))

  // drive upload via cookie juga
  const fd2 = new FormData()
  fd2.append('file', new Blob([pdf], { type: 'application/pdf' }), 'drive-cookie.pdf')
  const r2 = await fetch(BASE + '/api/file/drive/upload', { method: 'POST', headers: { Cookie: ck }, body: fd2 })
  console.log('drive upload via cookie:', r2.status, (await r2.text()).slice(0, 80))
}
main().catch(e => { console.error('ERR', e.message); process.exit(1) })
