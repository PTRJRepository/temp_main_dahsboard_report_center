'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HardDrive, Loader2, ClipboardList, ShieldCheck, Database, ArrowRight } from 'lucide-react'
import { ScenePhoto, PalmAccent } from '../decor'

const DEMO = [
  { u: 'kerani', p: 'kerani123', label: 'Kerani' },
  { u: 'manager', p: 'manager123', label: 'Manager' },
  { u: 'asisten', p: 'manager123', label: 'Asisten' },
]

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

  const fill = (u: string, p: string) => { setUsername(u); setPassword(p) }

  return (
    <div className="min-h-screen flex bg-[#f3f5ec]">
      {/* Panel kiri: pemandangan kebun sawit */}
      <div className="hidden lg:flex lg:w-[46%] relative flex-col justify-between overflow-hidden border-r border-green-900/10">
        <ScenePhoto theme="login" className="absolute inset-0" />
        {/* kabut atas untuk teks */}
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-white/85 via-white/50 to-transparent" />

        <div className="relative p-12">
          <div className="flex items-center gap-3 anim-fadeup">
            <div className="w-12 h-12 rounded-2xl btn-primary grid place-items-center shadow-lg shadow-green-800/30">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-green-950 tracking-tight leading-none">RJ<span className="text-green-600">Drive</span></p>
              <p className="text-xs text-green-800/70 mt-1 uppercase tracking-widest font-bold">Rebinmas Jaya — Estate Portal</p>
            </div>
          </div>

          <h1 className="anim-fadeup d-1 mt-16 text-5xl font-black leading-[1.06] tracking-tight text-green-950 max-w-md">
            <span className="shimmer-text">Instruksi Kerja</span><br />
            &amp; Berkas,<br />Satu Pintu.
          </h1>
          <p className="anim-fadeup d-2 mt-4 text-green-900/80 max-w-md text-lg font-medium">
            Atasan membuat penugasan, kerani mengumpulkan berkas. Setiap berkas tercatat siapa pengirimnya, kapan, dan catatannya.
          </p>
        </div>

        <div className="relative m-8 rounded-3xl bg-white/85 backdrop-blur border border-green-900/10 shadow-xl shadow-green-900/10 p-6 anim-fadeup d-3 max-w-xl">
          <ul className="space-y-4">
            {[
              { icon: ClipboardList, title: 'Tahu persis apa yang diupload', desc: 'Checklist tugas + deadline jelas di beranda.' },
              { icon: ShieldCheck, title: 'Review terstruktur', desc: 'Pilih kerani, klik berkas, putuskan — tanpa scroll panjang.' },
              { icon: Database, title: 'Terhubung database perusahaan', desc: 'Akun langsung dari extend_db_ptrj.' },
            ].map(f => (
              <li key={f.title} className="flex gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 grid place-items-center shrink-0"><f.icon className="w-5 h-5" /></div>
                <div>
                  <p className="font-bold text-green-950">{f.title}</p>
                  <p className="text-sm text-slate-600 mt-0.5">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <PalmAccent className="absolute -bottom-2 right-3 w-24 h-24 opacity-25 pointer-events-none" />
        </div>
      </div>

      {/* Form kanan */}
      <div className="flex-1 relative grid place-items-center p-6 overflow-hidden">
        <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-lime-200/60 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-20 w-96 h-96 rounded-full bg-emerald-100/80 blur-3xl pointer-events-none" style={{ animationDelay: '-7s' }} />

        <div className="w-full max-w-lg anim-pop relative">
          <div className="flex items-center gap-3 lg:hidden mb-8 justify-center">
            <div className="w-12 h-12 rounded-2xl btn-primary grid place-items-center"><HardDrive className="w-6 h-6" /></div>
            <div>
              <h1 className="text-xl font-extrabold text-green-950">RJ<span className="text-green-600">Drive</span></h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Manajemen Berkas &amp; Instruksi Kerja</p>
            </div>
          </div>

          <form onSubmit={submit} className="card rounded-3xl p-9 space-y-6 relative">
            {/* strip sawit di tepi atas kartu */}
            <svg viewBox="0 0 400 26" className="absolute inset-x-0 top-0 w-full h-6 text-green-600/90 rounded-t-3xl" preserveAspectRatio="none" aria-hidden>
              <path fill="currentColor" d="M0 0 H400 V8 C340 22 300 24 240 14 C180 4 120 24 60 18 C36 15 16 12 0 14 Z" />
            </svg>

            <div className="hidden lg:block pt-3">
              <h2 className="text-3xl font-black tracking-tight text-green-950">Masuk ke akun Anda</h2>
              <p className="text-sm text-slate-500 mt-1.5">Gunakan email perusahaan yang terdaftar.</p>
            </div>

            <label className="block">
              <span className="text-xs font-extrabold text-green-900 uppercase tracking-widest">Email / Username</span>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="nama@rebinmas.com" autoComplete="username"
                className="input-field mt-2 w-full rounded-2xl px-4 py-3.5 text-base" />
            </label>
            <label className="block">
              <span className="text-xs font-extrabold text-green-900 uppercase tracking-widest">Password</span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
                className="input-field mt-2 w-full rounded-2xl px-4 py-3.5 text-base" />
            </label>

            {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">{err}</p>}

            <button disabled={busy || !username || !password}
              className="btn-primary w-full rounded-2xl py-4 text-base font-extrabold disabled:opacity-40 flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Masuk <ArrowRight className="w-5 h-5" /></>}
            </button>

            <div className="divider-glow" />
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2.5">Akun demo — klik untuk isi otomatis</p>
              <div className="grid grid-cols-3 gap-2">
                {DEMO.map(d => (
                  <button key={d.u} type="button" onClick={() => fill(d.u, d.p)}
                    className="rounded-xl border border-green-900/10 bg-green-50/60 hover:border-green-500 hover:bg-green-100 px-2 py-2.5 text-center transition-colors">
                    <p className="text-xs font-extrabold text-green-900">{d.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{d.u}</p>
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
