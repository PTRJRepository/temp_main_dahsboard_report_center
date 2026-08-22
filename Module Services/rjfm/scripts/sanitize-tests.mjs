// Uji sanitasi upload: exe disamarkan, double-ext, KML valid
const BASE = 'http://localhost:8011'

async function main() {
  const login = await fetch(BASE + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'kerani', password: 'kerani123' }) })
  const tok = (await login.json()).data.token
  const H = { Authorization: 'Bearer ' + tok }

  let fail = 0
  const check = (ok, name) => { console.log(ok ? 'PASS:' : 'FAIL:', name); if (!ok) fail++ }

  // 1) exe dengan nama .pdf → harus ditolak (magic bytes MZ tidak dikenali)
  let fd = new FormData()
  fd.append('file', new Blob([Buffer.from('MZ\x90\x00fake')], { type: 'application/pdf' }), 'rapor.pdf')
  let r = await fetch(BASE + '/api/v1/drive/upload', { method: 'POST', headers: H, body: fd })
  check(r.status === 415, `exe disamarkan .pdf ditolak (${r.status})`)

  // 2) PDF asli tapi nama .exe → ditolak (ekstensi berbahaya)
  fd = new FormData()
  fd.append('file', new Blob([Buffer.from('%PDF-1.4 x\n%%EOF')]), 'virus.exe')
  r = await fetch(BASE + '/api/v1/drive/upload', { method: 'POST', headers: H, body: fd })
  check(r.status === 415, `pdf bernama .exe ditolak (${r.status})`)

  // 3) KML valid → diterima
  const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Blok C4</name><Polygon><outerBoundaryIs><LinearRing><coordinates>100.1,-0.1,0 100.2,-0.1,0 100.2,-0.2,0 100.1,-0.2,0 100.1,-0.1,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`
  fd = new FormData()
  fd.append('file', new Blob([Buffer.from(kml)], { type: 'application/vnd.google-earth.kml+xml' }), 'blok-c4.kml')
  r = await fetch(BASE + '/api/v1/drive/upload', { method: 'POST', headers: H, body: fd })
  check(r.status === 201, `KML diterima (${r.status})`)
  if (r.status === 201) {
    const id = (await r.json()).data.file_id
    // stream kembali content-type benar
    const s = await fetch(`${BASE}/api/v1/drive/${id}/stream`, { headers: H })
    check(s.status === 200 && (s.headers.get('content-type') || '').includes('xml'), 'stream KML ok')
  }

  // 4) path traversal di nama file dibersihkan
  fd = new FormData()
  fd.append('file', new Blob([Buffer.from('%PDF-1.4 t\n%%EOF')]), '..\\..\\evil.pdf')
  r = await fetch(BASE + '/api/v1/drive/upload', { method: 'POST', headers: H, body: fd })
  const j = await r.json().catch(() => ({}))
  check(r.status === 201 && !String(j?.data?.name).includes('..'), `path traversal dibersihkan (${j?.data?.name})`)

  process.exit(fail ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
