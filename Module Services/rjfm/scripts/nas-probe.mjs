const NAS = 'http://10.0.0.20:5000'
const USER = 'it', PASS = 'Itd@2025'

async function j(url, opts = {}) {
  const r = await fetch(NAS + url, { ...opts, redirect: 'manual' })
  const t = await r.text()
  try { return { status: r.status, json: JSON.parse(t) } } catch { return { status: r.status, text: t.slice(0, 120) } }
}

const sid = (await j(`/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${encodeURIComponent(USER)}&passwd=${encodeURIComponent(PASS)}&session=FileStation&format=sid`)).json.data.sid
console.log('SID ok')

// Try bare string (no array brackets)
console.log('--- bare string folder_path ---')
const r1 = await j(`/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=list&folder_path=${encodeURIComponent('/IT')}&_sid=${sid}`)
console.log('LIST /IT bare:', r1.status, r1.json?.success ? r1.json.data.files.map(f=>f.name).join(',') : (r1.json?.error?.code || r1.text?.slice(0,80)))

// Try create under share root /IT
console.log('--- create under /IT root ---')
const r2 = await j(`/webapi/entry.cgi?api=SYNO.FileStation.Create&version=2&method=create&folder_path=${encodeURIComponent('["/IT"]')}&name=RJFM_RootTest&_sid=${sid}`)
console.log('CREATE /IT/RJFM_RootTest:', JSON.stringify(r2.json || r2.text).slice(0, 200))

// Try create with bare parent string
console.log('--- create bare parent ---')
const r3 = await j(`/webapi/entry.cgi?api=SYNO.FileStation.Create&version=2&method=create&folder_path=${encodeURIComponent('/IT/Extend Server Portal')}&name=RJFM_BareTest&_sid=${sid}`)
console.log('CREATE bare:', JSON.stringify(r3.json || r3.text).slice(0, 200))

// Check permissions: get info about /IT
console.log('--- getinfo /IT ---')
const r4 = await j(`/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=getinfo&path=${encodeURIComponent('["/IT"]')}&_sid=${sid}`)
console.log('GETINFO /IT:', JSON.stringify(r4.json || r4.text).slice(0, 300))

await j(`/webapi/auth.cgi?api=SYNO.API.Auth&version=1&method=logout&session=FileStation&_sid=${sid}`)
console.log('LOGOUT')
