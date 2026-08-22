// Lihat referensi aset di HTML login + coba fetch asetnya
async function main() {
  const base = process.argv[2] || 'http://127.0.0.1:8011'
  const h = await (await fetch(base + '/file/login')).text()
  const refs = h.match(/\/_next\/[^"'\s>]+/g) || []
  console.log('refs:', [...new Set(refs)].slice(0, 10))
  if (refs.length) {
    for (const ref of [...new Set(refs)].slice(0, 3)) {
      const r = await fetch(base + ref)
      console.log(r.status, ref.slice(0, 70), '|', r.headers.get('content-type'))
    }
  } else {
    console.log('TIDAK ADA referensi /_next di HTML!')
    console.log('potongan head:', h.slice(0, 500))
  }
}
main()
