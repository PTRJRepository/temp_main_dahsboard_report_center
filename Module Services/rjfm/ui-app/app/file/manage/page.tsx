'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Send, Users, CalendarClock, CheckCircle2, Loader2, History, ShieldAlert } from 'lucide-react'
import { PalmAccent } from '../decor'

type UserRow = { user_id: number; username: string; full_name: string; role_code: string; raw_role?: string; divisi?: string | null }

// Kebijakan: hanya Manager/Admin/GM yang boleh membuat tugas.
const TASK_CREATORS = ['MANAGER', 'SUPERADMIN', 'ADMIN', 'GM_ESTATE']

const DEADLINE_CHIPS = [
  { key: 'today17', label: 'Hari ini 17.00' },
  { key: 'tomorrow8', label: 'Besok 08.00' },
  { key: '3days', label: '3 hari' },
  { key: 'week', label: 'Minggu depan' },
  { key: 'custom', label: 'Pilih tanggal...' },
]

function chipDeadline(key: string): string {
  const d = new Date()
  if (key === 'today17') { d.setHours(17, 0, 0, 0); return d.toISOString() }
  if (key === 'tomorrow8') { d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return d.toISOString() }
  if (key === '3days') { d.setDate(d.getDate() + 3); d.setHours(17, 0, 0, 0); return d.toISOString() }
  if (key === 'week') { d.setDate(d.getDate() + 7); d.setHours(17, 0, 0, 0); return d.toISOString() }
  return d.toISOString()
}

export default function FileManagePage() {
  const [roleOk, setRoleOk] = useState<boolean | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [picked, setPicked] = useState<number[]>([])
  const [usersErr, setUsersErr] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [dlKey, setDlKey] = useState('today17')
  const [customDl, setCustomDl] = useState('')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState<{ task_id: number; count: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [recent, setRecent] = useState<any[]>([])

  useEffect(() => {
    try {
      const me = JSON.parse(localStorage.getItem('rjfm-user') || 'null')
      const r = (me?.role_code || me?.role || '').toUpperCase()
      setRoleOk(TASK_CREATORS.includes(r))
    } catch { setRoleOk(false) }
  }, [])

  const kerani = useMemo(() => users.filter(u => (u.raw_role || u.role_code || '').toUpperCase() === 'KERANI'), [users])

  useEffect(() => {
    fetch('/api/file/meta/users').then(r => r.json()).then(j => {
      if (j.status === 'error' || !Array.isArray(j.data)) { setUsersErr(j.message || 'Gagal memuat daftar kerani.'); return }
      setUsers(j.data)
      if (j.source === 'demo') setUsersErr('Database tidak terjangkau — memakai daftar lokal.')
    }).catch(() => setUsersErr('Gagal memuat daftar kerani (server tidak merespons).'))
    fetch('/api/file/tasks', { cache: 'no-store' }).then(r => r.json()).then(j => setRecent((j.data || []).slice(0, 8))).catch(() => {})
  }, [])

  const toggle = (id: number) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const submit = async () => {
    setErr(null); setOk(null)
    if (!title.trim()) { setErr('Tulis judul singkat.'); return }
    if (!desc.trim()) { setErr('Tulis instruksi untuk kerani.'); return }
    if (picked.length === 0) { setErr('Pilih minimal 1 kerani.'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/file/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: desc.trim(),
          target_kerani_ids: picked,
          deadline: dlKey === 'custom' ? new Date(customDl).toISOString() : chipDeadline(dlKey),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`)
      setOk({ task_id: j.data?.task_id, count: picked.length })
      setTitle(''); setDesc(''); setPicked([])
      fetch('/api/file/tasks', { cache: 'no-store' }).then(r => r.json()).then(j => setRecent((j.data || []).slice(0, 8))).catch(() => {})
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  if (roleOk === false) {
    return (
      <div className="max-w-lg mx-auto anim-pop relative">
        <div className="card rounded-3xl border-red-200 p-12 text-center relative overflow-hidden">
          <PalmAccent className="absolute -bottom-2 right-4 w-28 h-28 opacity-10 pointer-events-none" />
          <div className="w-16 h-16 rounded-full bg-red-50 mx-auto grid place-items-center"><ShieldAlert className="w-8 h-8 text-red-500" /></div>
          <p className="mt-5 text-2xl font-black tracking-tight text-green-950">Akses Terbatas</p>
          <p className="text-sm text-slate-600 mt-2">Pembuatan tugas hanya untuk <b className="text-green-800">Manager, Admin, dan GM</b>. Kerani &amp; Asisten tidak dapat membuat penugasan.</p>
          <Link href="/file/home" className="btn-primary inline-block mt-6 px-6 py-3 rounded-2xl text-sm font-extrabold">Kembali ke Beranda</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-7">
      <div className="anim-fadeup">
        <h1 className="text-4xl font-black tracking-tight flex items-center gap-3 text-green-950"><Send className="w-8 h-8 text-green-600" /> Tugas Baru</h1>
        <p className="text-sm text-slate-500 mt-1.5">Tulis seperti memo — judul, instruksi, pilih kerani, kirim.</p>
      </div>

      {ok ? (
        <div className="anim-pop card rounded-3xl border-green-200 p-14 text-center relative overflow-hidden">
          <PalmAccent className="absolute -bottom-3 right-6 w-32 h-32 opacity-15 pointer-events-none" />
          <div className="w-20 h-20 rounded-full bg-green-100 mx-auto grid place-items-center "><CheckCircle2 className="w-10 h-10 text-green-600" /></div>
          <p className="mt-6 text-2xl font-black tracking-tight text-green-950">Tugas terkirim ke {ok.count} kerani</p>
          <p className="text-sm text-slate-500 mt-2">Notifikasi sudah masuk ke beranda mereka.</p>
          <div className="mt-8 flex justify-center gap-3">
            <button onClick={() => setOk(null)} className="btn-primary px-7 py-3.5 rounded-2xl text-sm font-extrabold">Buat lagi</button>
            <Link href="/file/tasks" className="px-7 py-3.5 rounded-2xl bg-white border border-green-900/15 text-sm font-bold text-green-900 hover:bg-green-50 transition-colors">Lihat semua tugas</Link>
          </div>
        </div>
      ) : (
        <div className="card rounded-3xl shadow-xl shadow-green-900/10 p-8 sm:p-10 space-y-7 anim-fadeup d-1">
          <label className="block">
            <span className="text-xs font-extrabold text-green-900 uppercase tracking-widest">Judul</span>
            <input value={title} onChange={e => setTitle(e.target.value)} autoFocus placeholder="LHP Harian 21 Agu"
              className="input-field mt-2 w-full rounded-2xl px-4 py-3.5 text-base font-semibold" />
          </label>

          <label className="block">
            <span className="text-xs font-extrabold text-green-900 uppercase tracking-widest">Instruksi</span>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} placeholder="Tolong scan LHP hari ini + foto kondisi TPH blok C..."
              className="input-field mt-2 w-full rounded-2xl px-4 py-3.5 text-base" />
          </label>

          <div>
            <p className="text-xs font-extrabold text-green-900 uppercase tracking-widest flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-green-600" /> Deadline</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEADLINE_CHIPS.map(c => (
                <button key={c.key} onClick={() => setDlKey(c.key)}
                  className={`px-4 py-2.5 rounded-2xl text-sm font-bold border transition-all ${dlKey === c.key ? 'chip-on' : 'bg-white text-slate-600 border-slate-200 hover:border-green-400 hover:text-green-900'}`}>
                  {c.label}
                </button>
              ))}
            </div>
            {dlKey === 'custom' && (
              <input type="datetime-local" value={customDl} onChange={e => setCustomDl(e.target.value)}
                className="input-field mt-3 rounded-2xl px-4 py-3 text-sm" />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold text-green-900 uppercase tracking-widest flex items-center gap-1.5"><Users className="w-4 h-4 text-green-600" /> Untuk kerani <span className="text-green-700">({picked.length} dipilih)</span></p>
              <button onClick={() => setPicked(p => p.length === kerani.length ? [] : kerani.map(u => u.user_id))} className="text-xs font-extrabold text-green-700 hover:text-green-600">
                {picked.length === kerani.length && kerani.length > 0 ? 'Kosongkan' : 'Pilih semua'}
              </button>
            </div>
            {kerani.length === 0 ? (
              <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                {usersErr || 'Tidak ada user KERANI di database. Tambahkan di menu user portal.'}
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {kerani.map(u => {
                  const on = picked.includes(u.user_id)
                  return (
                    <button key={u.user_id} onClick={() => toggle(u.user_id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left text-sm border transition-all ${on ? 'chip-on scale-[1.02]' : 'bg-white text-slate-700 border-slate-200 hover:border-green-400 hover:text-green-900'}`}>
                      <span className={`w-9 h-9 rounded-xl grid place-items-center text-xs font-black shrink-0 ${on ? 'bg-white/25' : 'bg-green-100 text-green-700'}`}>
                        {u.full_name.split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase()).join('')}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-extrabold truncate">{u.full_name}</span>
                        {u.divisi && <span className={`block text-[10px] truncate font-semibold ${on ? 'text-green-50' : 'text-slate-400'}`}>{u.divisi}</span>}
                      </span>
                      {on && <CheckCircle2 className="w-4 h-4 ml-auto shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">{err}</p>}

          <button onClick={submit} disabled={busy}
            className="btn-primary w-full rounded-2xl py-4 text-base font-extrabold disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {busy ? 'Mengirim...' : `Kirim ke ${picked.length} kerani`}
          </button>
          <p className="text-xs text-slate-400 text-center font-semibold">Kerani langsung melihat tugas ini di beranda mereka. Format default: PDF, Excel, JPG, PNG (maks 10 MB). Berkas yang dikumpulkan otomatis masuk Drive kerani.</p>
        </div>
      )}

      {/* Tugas terbaru */}
      <div className="card rounded-3xl overflow-hidden anim-fadeup d-2">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-green-600" />
          <h2 className="font-extrabold text-sm">Baru saja dibuat</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {recent.length === 0 ? <p className="p-6 text-sm text-slate-500">Belum ada tugas.</p> : recent.map((t: any) => (
            <div key={t.task_id} className="px-6 py-3.5 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
              <div className="min-w-0 flex-1">
                <p className="font-extrabold truncate text-sm">{t.title}</p>
                <p className="text-xs text-slate-400">{t.deadline ? new Date(t.deadline).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
