'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Filter, Clock, AlertTriangle, CheckCircle2, UploadCloud, FileText, ChevronRight } from 'lucide-react'
import { TicketCard, StickyNote } from '../decor'

type Row = any

const TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'ASSIGNED', label: 'Ditugaskan' },
  { key: 'REVISION_NEEDED', label: 'Perlu Revisi' },
  { key: 'SUBMITTED', label: 'Menunggu Review' },
  { key: 'APPROVED', label: 'Disetujui' },
]

const STATUS_CLS: Record<string, string> = {
  ASSIGNED: 'bg-sky-100 text-sky-800 border-sky-200',
  SUBMITTED: 'bg-amber-100 text-amber-800 border-amber-200',
  REVISION_NEEDED: 'bg-red-100 text-red-700 border-red-200',
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
}
function priorityColor(p?: string) {
  if (p === 'URGENT') return { dot: 'bg-red-500', stripe: 'border-l-red-500' }
  if (p === 'HIGH') return { dot: 'bg-orange-400', stripe: 'border-l-orange-400' }
  if (p === 'MEDIUM') return { dot: 'bg-sky-400', stripe: 'border-l-sky-400' }
  return { dot: 'bg-slate-300', stripe: 'border-l-slate-300' }
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
        const finalRows = merged.length ? merged : tasks
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

  const countFor = (key: string) =>
    key === 'all' ? rows.length : rows.filter(x => (x.current_status || 'ASSIGNED') === key).length

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 anim-fadeup">
          <div>
            <h1 className="text-4xl font-black tracking-tight flex items-center gap-3 text-green-950"><FileText className="w-8 h-8 text-green-600" /> Tugas Saya</h1>
            <p className="text-sm text-slate-500 mt-1.5">Instruksi dari atasan — kumpulkan &amp; submit berkas.</p>
          </div>
          <div className="relative w-full xl:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari judul / deskripsi..."
              className="input-field w-full pl-11 pr-4 py-3 rounded-2xl text-sm" />
          </div>
        </div>

        {/* segmented status */}
        <div className="mt-6 flex items-center gap-2 p-1.5 card rounded-2xl overflow-auto anim-fadeup d-1 w-fit max-w-full">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all duration-200 inline-flex items-center gap-1.5 ${tab === t.key ? 'chip-on' : 'text-slate-500 hover:text-green-900 hover:bg-green-50'}`}>
              {t.label}
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums ${tab === t.key ? 'bg-white/25' : 'bg-green-100 text-green-800'}`}>{countFor(t.key)}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 relative">
          {loading ? (
            <div className="card rounded-3xl p-12 text-center text-sm text-slate-500 animate-pulse">Memuat tugas...</div>
          ) : err ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Gagal memuat: {err}</div>
          ) : filtered.length === 0 ? (
            <StickyNote variant="blue" className="rounded-xl text-center py-8 px-6 max-w-xl mx-auto mt-4">
              <Filter className="w-7 h-7 mx-auto opacity-60" />
              <p className="mt-2 text-lg font-black">Belum ada tugas</p>
              <p className="text-[13px] font-semibold opacity-80 mt-1">Tugas akan ditempel di sini setelah Manager/Admin membuat penugasan untuk akun Anda.</p>
            </StickyNote>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-8 pb-3">
              {filtered.map((t: any, i: number) => {
                const status = t.current_status || 'ASSIGNED'
                const due = t.deadline ? new Date(t.deadline) : null
                const overdue = due ? due.getTime() < Date.now() && status !== 'APPROVED' : false
                const tone = status === 'REVISION_NEEDED' ? 'red' : status === 'SUBMITTED' ? 'amber' : status === 'APPROVED' ? 'green' : 'sky'
                return (
                  <div key={`${t.task_id}-${t.assignment_id || 'x'}`} style={{ animationDelay: `${Math.min(i, 9) * 50}ms` }} className={`anim-fadeup`}>
                    <TicketCard tone={tone as any}
                      stub={
                        <span className={`w-full inline-flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-[10px] font-extrabold uppercase tracking-wider text-center leading-tight transition-all ${status === 'APPROVED'
                          ? 'bg-stone-200/80 text-stone-500'
                          : status === 'REVISION_NEEDED' ? 'bg-red-600 text-white shadow-md shadow-red-400/40 group-hover:bg-red-500'
                          : status === 'SUBMITTED' ? 'bg-white border border-amber-300 text-amber-800'
                          : 'btn-primary'}`}>
                          {status === 'APPROVED' ? <><CheckCircle2 className="w-5 h-5" /> Selesai</> : status === 'REVISION_NEEDED' ? <><AlertTriangle className="w-5 h-5" /> Revisi</> : status === 'SUBMITTED' ? <><Clock className="w-5 h-5" /> Ditinjau</> : <><UploadCloud className="w-5 h-5" /> Kumpul</>}
                        </span>
                      }>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`w-2 h-2 rounded-full ${priorityColor(t.priority).dot}`} />
                        <span className="text-[9px] font-extrabold tracking-[0.18em] uppercase text-stone-400">{t.priority || 'MEDIUM'}</span>
                        <span className="text-[10px] font-mono text-stone-400">#{String(t.task_id).padStart(4, '0')}</span>
                        <span className={`ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_CLS[status]}`}>{status}</span>
                      </div>
                      <h3 className="mt-2.5 text-lg font-black tracking-tight leading-snug text-green-950 line-clamp-2">{t.title}</h3>
                      <p className="mt-1 text-[13px] text-slate-600 line-clamp-2">→ {t.description}</p>
                      {status === 'REVISION_NEEDED' && t.latest_feedback && (
                        <div className="mt-3 border-l-4 border-red-400 bg-red-50 rounded-r-lg px-3 py-2">
                          <p className="text-[9px] font-extrabold text-red-700 uppercase tracking-widest flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Catatan atasan</p>
                          <p className="text-xs text-red-900 mt-0.5 line-clamp-2">{t.latest_feedback}</p>
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        {due ? (
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2 py-1 rounded-md border ${overdue ? 'text-red-700 border-red-400 bg-red-50' : 'text-green-800 border-green-500 bg-green-50'}`}>
                            <Clock className="w-3 h-3" /> {due.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }).toUpperCase()}
                            {overdue && <AlertTriangle className="w-3 h-3" />}
                          </span>
                        ) : <span />}
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-green-700 group-hover:translate-x-1 transition-transform">Buka <ChevronRight className="w-4 h-4" /></span>
                      </div>
                    </TicketCard>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
