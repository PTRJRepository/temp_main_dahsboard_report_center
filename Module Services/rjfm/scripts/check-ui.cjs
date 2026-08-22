// Cek UI via LAN IP: halaman + CSS + POST login (semua di satu port 8011)
async function main() {
  const base = process.argv[2] || 'http://10.0.0.128:8011'
  const r1 = await fetch(base + '/file/login')
  const h1 = await r1.text()
  console.log('login page:', r1.status, '| len:', h1.length)
  const m = h1.match(/href="([^"]*\.css[^"]*)"/)
  console.log('css ref:', m ? m[1] : 'NONE')
  if (m) {
    const cssUrl = new URL(m[1], base)
    const r2 = await fetch(cssUrl)
    const len = (await r2.text()).length
    console.log('css fetch:', r2.status, r2.headers.get('content-type'), 'len:', len)
  }
  // POST login via LAN IP
  const ac = new AbortController(); setTimeout(() => ac.abort(), 8000)
  try {
    const r3 = await fetch(base + '/api/file/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }), signal: ac.signal })
    console.log('POST login:', r3.status)
    if (r3.ok) {
      const ck = (r3.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ')
      const r4 = await fetch(base + '/api/file/meta/users', { headers: { cookie: ck } })
      const j = await r4.json()
      console.log('users:', r4.status, '| kerani:', (j.data || []).filter(x => ((x.raw_role || x.role_code || '') + '').toUpperCase() === 'KERANI').length)
    }
  } catch (e) { console.log('POST login hang/err:', e.message) }
}
main().catch(e => { console.error('ERR', e); process.exit(1) })
