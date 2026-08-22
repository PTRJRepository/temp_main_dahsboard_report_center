'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Filter, Clock, AlertTriangle, CheckCircle2, UploadCloud, FileText, ChevronRight } from 'lucide-react'

type Row = any

const TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'ASSIGNED', label: 'Ditugaskan' },
  { key: 'REVISION_NEEDED', label: 'Perlu Revisi' },
  { key: 'SUBMITTED', label: 'Menunggu Review' },
  { key: 'APPROVED', label: 'Disetujui' },
]

function badge(status: string) {
  const map: Record<string, string> = {
    ASSIGNED: 'bg-slate-100 text-slate-700 border-slate-200',
    SUBMITTED: 'bg-amber-50 text-amber-700 border-amber-200',
    REVISION_NEEDED: 'bg-red-50 text-red-700 border-red-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  return map[status] || 'bg-slate-50 text-slate-600 border-slate-200'
}
function priorityDot(p?: string) {
  if (p === 'URGENT') return 'bg-red-600'
  if (p === 'HIGH') return 'bg-orange-500'
  if (p === 'MEDIUM') return 'bg-blue-500'
  return 'bg-slate-400'
}

export default function FileTasksPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch('/api/file/tasks', { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) { window.location.replace('/file/login'); throw new Error('login') }
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`)
        // also fetch assignments to map status for kerani view
        let assignments: any[] = []
        try {
          const ra = await fetch('/api/file/assignments', { cache: 'no-store' })
          const ja = await ra.json().catch(() => ({}))
          if (ra.ok) assignments = Array.isArray(ja.data) ? ja.data : []
        } catch {}
        const byTask = new Map<number, any>()
        for (const a of assignments) {
          const t = a.task_id ?? a.taskId
          if (!byTask.has(t)) byTask.set(t, a)
        }
        const tasks: any[] = Array.isArray(j.data) ? j.data : []
        const merged = tasks.map((t: any) => {
          const a = byTask.get(t.task_id)
          return { ...t, assignment_id: a?.assignment_id, current_status: a?.current_status || a?.currentStatus || t.current_status }
        })
        // if assignments response was tasks with assignment fields (kerani GET /tasks already joined), keep as is
        const finalRows = merged.length ? merged : tasks
        // fallback: if tasks empty but assignments exist, synthesize rows from assignments
        const out = finalRows.length ? finalRows : assignments.map((a: any) => ({ task_id: a.task_id, title: a.title || `Tugas #${a.task_id}`, description: a.description || '', deadline: a.deadline, priority: a.priority || 'MEDIUM', assignment_id: a.assignment_id, current_status: a.current_status }))
        if (alive) setRows(out)
      })
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    let r = rows
    if (tab !== 'all') r = r.filter((x) => (x.current_status || 'ASSIGNED') === tab)
    if (q.trim()) {
      const s = q.toLowerCase()
      r = r.filter((x) => `${x.title} ${x.description}`.toLowerCase().includes(s))
    }
    return r
  }, [rows, q, tab])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><FileText className="w-5 h-5 text-emerald-600" /> Tugas Saya</h1>
              <p className="text-xs text-slate-500">Instruksi dari atasan — kumpulkan &amp; submit berkas.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/file/home" className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">Beranda</Link>
              <Link href="/file/manage" className="hidden sm:inline-flex px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Buat Tugas</Link>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari judul / deskripsi..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 overflow-auto">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${tab === t.key ? 'bg-white shadow border border-slate-200 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>{t.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Memuat tugas...</div>
        ) : err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Gagal memuat: {err} — pastikan login dan DB RJ_FileManagement sudah ada.</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center"><Filter className="w-6 h-6 text-slate-400" /></div>
            <p className="mt-3 font-medium text-slate-900">Belum ada tugas</p>
            <p className="text-sm text-slate-500">Jika kerani, tugas akan muncul setelah Manager/Asisten membuat penugasan untuk akun Anda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((t: any) => {
              const status = t.current_status || 'ASSIGNED'
              const due = t.deadline ? new Date(t.deadline) : null
              const overdue = due ? due.getTime() < Date.now() && status !== 'APPROVED' : false
              return (
                <div key={`${t.task_id}-${t.assignment_id || 'x'}`} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${priorityDot(t.priority)}`} />
                      <span className="text-[11px] font-semibold tracking-widest text-slate-500">{t.priority || 'MEDIUM'}</span>
                      {due && <span className={`inline-flex items-center gap-1 text-xs ${overdue ? 'text-red-600' : 'text-slate-500'}`}><Clock className="w-3.5 h-3.5" /> {due.toLocaleDateString('id-ID')} {overdue && <AlertTriangle className="w-3.5 h-3.5" />}</span>}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${badge(status)}`}>{status}</span>
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-900 leading-tight line-clamp-2">{t.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 line-clamp-2">{t.description}</p>
                  {status === 'REVISION_NEEDED' && t.latest_feedback && (
                    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5">
                      <p className="text-[11px] font-semibold text-red-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Alasan revisi:</p>
                      <p className="text-xs text-red-900 line-clamp-2 mt-0.5">{t.latest_feedback}</p>
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-slate-500 flex items-center gap-1">{status === 'APPROVED' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : status === 'REVISION_NEEDED' ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <UploadCloud className="w-4 h-4 text-slate-400" />} {status === 'REVISION_NEEDED' ? 'Perbaiki & upload ulang' : status === 'APPROVED' ? 'Selesai' : 'Kumpulkan berkas'}</span>
                    <Link href={`/file/tasks/${t.assignment_id || t.task_id}?taskId=${t.task_id}`} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800">Buka <ChevronRight className="w-4 h-4" /></Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
