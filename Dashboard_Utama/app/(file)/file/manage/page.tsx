'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Send, Users, CalendarClock, CheckCircle2, Loader2, History } from 'lucide-react'

type UserRow = { user_id: number; username: string; full_name: string; role_code: string; raw_role?: string; divisi?: string | null }

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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Tugas Baru</h1>
        <p className="text-sm text-slate-500">Tulis seperti memo — judul, instruksi, pilih kerani, kirim.</p>
      </div>

      {ok ? (
        <div className="rounded-3xl bg-white border border-emerald-200 p-10 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-50 mx-auto grid place-items-center"><CheckCircle2 className="w-7 h-7 text-emerald-600" /></div>
          <p className="mt-4 font-semibold text-slate-900">Tugas terkirim ke {ok.count} kerani</p>
          <p className="text-sm text-slate-500 mt-1">Notifikasi sudah masuk ke beranda mereka.</p>
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={() => setOk(null)} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">Buat lagi</button>
            <Link href="/file/tasks" className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Lihat semua tugas</Link>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Judul</span>
            <input value={title} onChange={e => setTitle(e.target.value)} autoFocus placeholder="LHP Harian 21 Agu"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300" />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Instruksi</span>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} placeholder="Tolong scan LHP hari ini + foto kondisi TPH blok C..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300" />
          </label>

          <div>
            <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-slate-400" /> Deadline</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEADLINE_CHIPS.map(c => (
                <button key={c.key} onClick={() => setDlKey(c.key)}
                  className={`px-3.5 py-2 rounded-full text-sm border transition-colors ${dlKey === c.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                  {c.label}
                </button>
              ))}
            </div>
            {dlKey === 'custom' && (
              <input type="datetime-local" value={customDl} onChange={e => setCustomDl(e.target.value)}
                className="mt-2 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><Users className="w-4 h-4 text-slate-400" /> Untuk kerani</p>
              <button onClick={() => setPicked(p => p.length === kerani.length ? [] : kerani.map(u => u.user_id))} className="text-xs font-medium text-emerald-700 hover:underline">
                {picked.length === kerani.length && kerani.length > 0 ? 'Kosongkan' : 'Pilih semua'}
              </button>
            </div>
            {kerani.length === 0 ? (
              <p className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                {usersErr || 'Tidak ada user KERANI di database. Tambahkan di menu user portal.'}
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {kerani.map(u => {
                  const on = picked.includes(u.user_id)
                  return (
                    <button key={u.user_id} onClick={() => toggle(u.user_id)}
                      className={`px-3.5 py-2 rounded-full text-sm border transition-colors ${on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400'}`}>
                      {u.full_name}{u.divisi ? <span className={`ml-1.5 text-[11px] ${on ? 'text-emerald-100' : 'text-slate-400'}`}>{u.divisi}</span> : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{err}</p>}

          <button onClick={submit} disabled={busy}
            className="w-full rounded-2xl bg-emerald-600 text-white py-3.5 font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {busy ? 'Mengirim...' : `Kirim ke ${picked.length} kerani`}
          </button>
          <p className="text-xs text-slate-400 text-center">Kerani langsung melihat tugas ini di beranda mereka. Format berkas default: PDF, Excel, JPG, PNG (maks 10 MB).</p>
        </div>
      )}

      {/* Tugas terbaru */}
      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-sm">Baru saja dibuat</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {recent.length === 0 ? <p className="p-5 text-sm text-slate-500">Belum ada tugas.</p> : recent.map((t: any) => (
            <div key={t.task_id} className="px-5 py-3 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t.title}</p>
                <p className="text-xs text-slate-500">{t.deadline ? new Date(t.deadline).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
