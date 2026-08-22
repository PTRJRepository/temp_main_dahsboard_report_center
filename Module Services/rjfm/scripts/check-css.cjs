// Cek referensi CSS + fetch css via kedua prefix
async function main() {
  const base = process.argv[2] || 'http://127.0.0.1:8011'
  const h = await (await fetch(base + '/file/login')).text()
  const i = h.indexOf('.css')
  console.log('ada ".css" di HTML:', i >= 0)
  const refs = h.match(/[^\s"'<>]+\.css[^\s"'<>]*/g) || []
  for (const ref of refs.slice(0, 5)) {
    console.log('ref:', ref)
    const abs = new URL(ref, base + '/file/login')
    const r = await fetch(abs)
    console.log(' →', r.status, r.headers.get('content-type'), 'len', (await r.text()).length)
  }
  if (!refs.length) {
    // coba tebak path stylesheet standar Next
    for (const p of ['/_next/static/css/app.css', '/file/_next/static/chunks/main.css']) {
      const r = await fetch(base + p)
      console.log('guess', p, '→', r.status)
    }
  }
}
main()
