'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HardDrive, Loader2, ClipboardList, ShieldCheck, Database } from 'lucide-react'

export default function FileLogin() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/file/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.message || 'Login gagal')
      localStorage.setItem('rjfm-user', JSON.stringify(j.data?.user || {}))
      router.replace('/file/home')
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Panel brand */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex-col justify-between p-10">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -left-20 -bottom-32 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-900 grid place-items-center"><HardDrive className="w-5 h-5" /></div>
          <div>
            <p className="font-bold text-white">RJ Drive</p>
            <p className="text-xs text-slate-400">Rebinmas Jaya — Estate Portal</p>
          </div>
        </div>
        <div className="relative">
          <h1 className="text-3xl font-bold text-white leading-tight">Manajemen Berkas &amp;<br />Instruksi Kerja</h1>
          <p className="mt-3 text-sm text-slate-300 max-w-sm">Atasan membuat penugasan, kerani mengumpulkan berkas. Semua tersimpan aman di server perusahaan.</p>
          <ul className="mt-8 space-y-4">
            {[
              { icon: ClipboardList, title: 'Tahu persis apa yang diupload', desc: 'Checklist tugas + deadline jelas di beranda.' },
              { icon: ShieldCheck, title: 'Review terstruktur', desc: 'Setiap revisi tercatat dengan catatan atasan.' },
              { icon: Database, title: 'Terhubung database perusahaan', desc: 'Akun langsung dari extend_db_ptrj.' },
            ].map(f => (
              <li key={f.title} className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 grid place-items-center shrink-0"><f.icon className="w-4 h-4 text-emerald-300" /></div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} PT Rebinmas Jaya</p>
      </div>

      {/* Form */}
      <div className="flex-1 grid place-items-center p-6 bg-slate-100">
        <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl border border-slate-200 space-y-5">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white grid place-items-center"><HardDrive className="w-5 h-5" /></div>
            <div>
              <h1 className="font-bold">RJ Drive</h1>
              <p className="text-xs text-slate-500">Manajemen Berkas — Instruksi Kerja</p>
            </div>
          </div>
          <div className="hidden lg:block">
            <h2 className="text-xl font-bold text-slate-900">Masuk ke akun Anda</h2>
            <p className="text-sm text-slate-500 mt-1">Gunakan email perusahaan yang terdaftar.</p>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email / Username</span>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="nama@rebinmas.com" autoComplete="username"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300" />
          </label>
          {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{err}</p>}
          <button disabled={busy || !username || !password}
            className="w-full rounded-xl bg-slate-900 text-white py-3 font-semibold hover:bg-black disabled:opacity-40 flex items-center justify-center gap-2 transition-colors">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Masuk
          </button>
          <details className="text-xs text-slate-500 group">
            <summary className="cursor-pointer select-none font-medium text-slate-600 hover:text-slate-900">Akun demo (untuk testing)</summary>
            <div className="mt-2 space-y-1 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p>Kerani: <code>kerani</code> / <code>kerani123</code></p>
              <p>Manager: <code>manager</code> / <code>manager123</code></p>
              <p>Asisten: <code>asisten</code> / <code>manager123</code></p>
            </div>
          </details>
        </form>
      </div>
    </div>
  )
}
