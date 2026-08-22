// Uji gateway NAS: health, upload, list, download, delete, tasks, auth gagal
const BASE = 'http://localhost:8011'
const KEY = 'rjfm_gateway_pr0d_9f3Kx7QmV2nL8sW5hJ1cB4dA6eT0uY2i'
const H = { 'x-api-key': KEY }

let fail = 0
const check = (ok, name) => { console.log(ok ? 'PASS:' : 'FAIL:', name); if (!ok) fail++ }

async function main() {
  // 1) tanpa key → 401
  let r = await fetch(BASE + '/api/gateway/health')
  check(r.status === 401, `tanpa api-key ditolak (${r.status})`)

  // 2) key salah → 401
  r = await fetch(BASE + '/api/gateway/health', { headers: { 'x-api-key': 'salah' } })
  check(r.status === 401, `api-key salah ditolak (${r.status})`)

  // 3) health OK + info NAS
  r = await fetch(BASE + '/api/gateway/health', { headers: H })
  const jh = await r.json().catch(() => null)
  check(r.status === 200 && jh?.storage, `gateway/health ok (free ${(jh?.storage?.freeBytes / 1024 ** 3 || 0).toFixed(0)} GB)`)

  // 4) upload ke folder blok-c/
  const kml = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Blok C9</name><Point><coordinates>100.3,-0.3</coordinates></Point></Placemark></Document></kml>`
  let fd = new FormData()
  fd.append('file', new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' }), 'blok-c9.kml')
  fd.append('folder', 'blok-c')
  r = await fetch(BASE + '/api/gateway/upload', { method: 'POST', headers: H, body: fd })
  const ju = await r.json().catch(() => ({}))
  check(r.status === 201 && ju?.data?.path?.startsWith('gateway/blok-c/'), `upload ke NAS (${ju?.data?.path})`)

  // 5) list memuat berkas tadi
  r = await fetch(BASE + '/api/gateway/files?prefix=gateway', { headers: H })
  const jl = await r.json()
  check(jl.data.some(f => f.path === ju.data.path), 'list files berisi berkas baru')

  // 6) download → isi sama
  r = await fetch(BASE + `/api/gateway/download?path=${encodeURIComponent(ju.data.path)}`, { headers: H })
  const txt = await r.text()
  check(r.status === 200 && txt.includes('Blok C9'), 'download isi cocok')

  // 7) traversal ditolak
  r = await fetch(BASE + `/api/gateway/download?path=../../Windows/win.ini`, { headers: H })
  check([400, 404].includes(r.status), `path traversal diblokir (${r.status})`)

  // 8) hapus berkas gateway/
  r = await fetch(BASE + `/api/gateway/file?path=${encodeURIComponent(ju.data.path)}`, { method: 'DELETE', headers: H })
  check(r.status === 200, 'delete berkas gateway')

  // 9) proteksi delete di luar gateway/
  r = await fetch(BASE + `/api/gateway/file?path=tasks/1/x.pdf`, { method: 'DELETE', headers: H })
  check([403, 404].includes(r.status), `delete di luar gateway/ diproteksi (${r.status})`)

  // 10) stats & tasks & revisions stream
  r = await fetch(BASE + '/api/gateway/stats', { headers: H })
  const js = await r.json()
  check(r.status === 200 && typeof js.data.files_on_storage === 'number', `stats ok (${js.data?.files_on_storage} berkas)`)
  r = await fetch(BASE + '/api/gateway/tasks', { headers: H })
  const jt = await r.json()
  check(r.status === 200 && Array.isArray(jt.data), `tasks ok (${jt.data?.length} tugas)`)
  r = await fetch(BASE + '/api/gateway/revisions/99999/stream', { headers: H })
  check(r.status === 404, 'revisions tidak ada → 404')

  process.exit(fail ? 1 : 0)
}
main().catch(e => { console.error('ERR', e); process.exit(1) })
