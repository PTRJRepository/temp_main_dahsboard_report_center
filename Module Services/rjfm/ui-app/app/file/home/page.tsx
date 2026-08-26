'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  UploadCloud, AlertTriangle, CheckCircle2, Clock, ChevronRight,
  ClipboardList, Plus, FileCheck2, Users, Files,
} from 'lucide-react'
import { TicketCard, StickyNote, PalmAccent } from '../decor'

type Row = any

const TASK_CREATORS = ['MANAGER', 'SUPERADMIN', 'ADMIN', 'GM_ESTATE']
const MANAGER_LIKE = ['MANAGER', 'ASISTEN', 'SUPERADMIN', 'ADMIN', 'GM_ESTATE']

const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Perlu Diupload',
  REVISION_NEEDED: 'Perlu Revisi',
  SUBMITTED: 'Menunggu Review',
  APPROVED: 'Disetujui',
}
const STATUS_CLS: Record<string, string> = {
  ASSIGNED: 'bg-sky-100 text-sky-800 border-sky-200',
  SUBMITTED: 'bg-amber-100 text-amber-800 border-amber-200',
  REVISION_NEEDED: 'bg-red-100 text-red-700 border-red-200',
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
}

function countdown(deadline?: string) {
  if (!deadline) return null
  const diff = new Date(deadline).getTime() - Date.now()
  const abs = Math.abs(diff)
  const h = Math.floor(abs / 36e5)
  const m = Math.floor((abs % 36e5) / 6e4)
  let txt = h >= 24 ? `${Math.floor(h / 24)} hari ${h % 24} jam` : h >= 1 ? `${h} jam ${m} menit` : `${m} menit`
  return { late: diff < 0, txt }
}
function priorityColor(p?: string) {
  if (p === 'URGENT') return { dot: 'bg-red-500', stripe: 'border-l-red-500' }
  if (p === 'HIGH') return { dot: 'bg-orange-400', stripe: 'border-l-orange-400' }
  if (p === 'MEDIUM') return { dot: 'bg-sky-400', stripe: 'border-l-sky-400' }
  return { dot: 'bg-slate-300', stripe: 'border-l-slate-300' }
}

function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    const t0 = performance.now(), dur = 700
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [value])
  return <>{n}</>
}

export default function FileHomePage() {
  const [me, setMe] = useState<any>(null)
  const [tasks, setTasks] = useState<Row[]>([])
  const [assignments, setAssignments] = useState<Row[]>([])
  const [allFiles, setAllFiles] = useState<Row[]>([])
  const [users, setUsers] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try { setMe(JSON.parse(localStorage.getItem('rjfm-user') || 'null')) } catch {}
    const j = (r: Response) => r.json()
    Promise.all([
      fetch('/api/file/tasks', { cache: 'no-store' }).then(j).catch(() => ({})),
      fetch('/api/file/assignments', { cache: 'no-store' }).then(j).catch(() => ({})),
      fetch('/api/file/meta/admin/files', { cache: 'no-store' }).then(j).catch(() => ({})),
      fetch('/api/file/meta/users', { cache: 'no-store' }).then(j).catch(() => ({})),
    ]).then(([t, a, f, u]: any[]) => {
      setTasks(Array.isArray(t?.data) ? t.data : [])
      setAssignments(Array.isArray(a?.data) ? a.data : [])
      setAllFiles(Array.isArray(f?.data) ? f.data : [])
      setUsers(Array.isArray(u?.data) ? u.data : [])
    }).finally(() => setLoading(false))
  }, [])

  const role = (me?.role_code || me?.role || '').toUpperCase()
  const isMgr = MANAGER_LIKE.includes(role)
  const isCreator = TASK_CREATORS.includes(role)

  const keraniRows = useMemo(() => {
    const order: Record<string, number> = { REVISION_NEEDED: 0, ASSIGNED: 1, SUBMITTED: 2, APPROVED: 3 }
    return [...tasks].sort((a, b) => {
      const oa = order[a.current_status || 'ASSIGNED'] ?? 9
      const ob = order[b.current_status || 'ASSIGNED'] ?? 9
      if (oa !== ob) return oa - ob
      return String(a.deadline || '9999').localeCompare(String(b.deadline || '9999'))
    })
  }, [tasks])

  const needUpload = keraniRows.filter(r => ['ASSIGNED', 'REVISION_NEEDED'].includes(r.current_status || 'ASSIGNED'))
  const waiting = keraniRows.filter(r => r.current_status === 'SUBMITTED')
  const approved = keraniRows.filter(r => r.current_status === 'APPROVED')

  const mgrPendingReview = assignments.filter(a => a.current_status === 'SUBMITTED')
  const mgrActiveTasks = tasks.filter(t => t.is_active !== false)
  const keraniCount = users.filter(u => (u.role_code || '').toUpperCase() === 'KERANI').length
  const recentSubs = [...allFiles].slice(0, 6)

  const hour = new Date().getHours()
  const greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam'

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="card rounded-2xl p-12 text-center text-sm text-slate-500 animate-pulse">Memuat beranda...</div>
      </div>
    )
  }

  const StatCard = ({ label, value, icon: Icon, accent }: any) => (
    <div className={`anim-fadeup card rounded-2xl p-5 border-l-4 ${accent.stripe}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <div className={`w-9 h-9 rounded-lg grid place-items-center ${accent.chip}`}><Icon className="w-[18px] h-[18px]" /></div>
      </div>
      <p className="mt-3 text-4xl font-bold tracking-tight tabular-nums text-green-950"><CountUp value={value} /></p>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* ===== Hero — panel gelap korporat ===== */}
      <div className="anim-fadeup rounded-2xl overflow-hidden relative bg-gradient-to-br from-green-900 via-green-800 to-green-900 border border-green-900/20 shadow-xl shadow-green-900/15 min-h-[220px] flex flex-col justify-between">
        <PalmAccent tone="#1e5c38" className="absolute -right-6 -bottom-10 w-72 h-72 opacity-40 pointer-events-none" />
        <div className="relative p-8 sm:p-10 pb-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-lime-300 font-semibold uppercase tracking-[0.22em] text-[11px]">{greet}</p>
            <h1 className="mt-1.5 text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-white">{me?.full_name || me?.username || 'Pengguna'}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            {isMgr ? (
              <>
                {isCreator && (
                  <Link href="/file/manage" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm bg-lime-400 text-green-950 hover:bg-lime-300 transition-colors"><Plus className="w-4 h-4" /> Buat Tugas</Link>
                )}
                <Link href="/file/review" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-colors"><FileCheck2 className="w-4 h-4 text-lime-300" /> Review{mgrPendingReview.length > 0 ? ` (${mgrPendingReview.length})` : ''}</Link>
              </>
            ) : (
              <>
                <Link href="/file/tasks" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm bg-lime-400 text-green-950 hover:bg-lime-300 transition-colors"><ClipboardList className="w-4 h-4" /> Semua Tugas</Link>
                <Link href="/file/drive" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-colors"><UploadCloud className="w-4 h-4 text-lime-300" /> Drive Saya</Link>
              </>
            )}
          </div>
        </div>
        <div className="relative px-8 sm:p-10 pt-0 pb-8">
          <p className="text-sm sm:text-base font-medium text-emerald-100/85 max-w-2xl">
            {isMgr
              ? 'Pantau submission kerani, review berkas masuk, dan kelola penugasan estate.'
              : needUpload.length > 0
                ? `Ada ${needUpload.length} berkas yang harus Anda kumpulkan — urut sesuai deadline.`
                : 'Semua berkas sudah terkumpul. Tugas baru dari atasan akan muncul di sini.'}
          </p>
        </div>
      </div>

      {isMgr ? (
        <>
          {/* ===== Statistik manager ===== */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
            <StatCard label="Menunggu Review" value={mgrPendingReview.length} icon={FileCheck2} accent={{ chip: 'bg-amber-100 text-amber-700', blob: 'bg-amber-200', stripe: 'border-l-amber-400' }} />
            <StatCard label="Tugas Aktif" value={mgrActiveTasks.length} icon={ClipboardList} accent={{ chip: 'bg-sky-100 text-sky-700', blob: 'bg-sky-200', stripe: 'border-l-sky-400' }} />
            <StatCard label="Kerani Terdaftar" value={keraniCount} icon={Users} accent={{ chip: 'bg-green-100 text-green-700', blob: 'bg-green-200', stripe: 'border-l-green-500' }} />
            <StatCard label="Total Berkas Masuk" value={allFiles.length} icon={Files} accent={{ chip: 'bg-violet-100 text-violet-700', blob: 'bg-violet-200', stripe: 'border-l-violet-400' }} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="anim-fadeup d-2 card rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-extrabold">Submission Terbaru</h2>
                <Link href="/file/review" className="text-xs font-extrabold text-green-700 hover:text-green-600">Review semua →</Link>
              </div>
              <div className="divide-y divide-slate-50">
                {recentSubs.length === 0 ? <p className="p-6 text-sm text-slate-500">Belum ada berkas masuk.</p> : recentSubs.map((f: any) => (
                  <Link key={f.revision_id} href="/file/review" className="flex items-center gap-3 px-6 py-3.5 hover:bg-green-50/50 transition-colors">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${f.review_status === 'APPROVED' ? 'bg-green-500' : f.review_status === 'REJECTED_NEEDS_REVISION' ? 'bg-red-500' : 'bg-amber-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate">{f.file_original_name}</p>
                      <p className="text-xs text-slate-500 truncate">{f.kerani_name || '—'} · {f.task_title || ''}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="anim-fadeup d-3 card rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-extrabold">Deadline Terdekat</h2>
                <Link href="/file/tasks" className="text-xs font-extrabold text-green-700 hover:text-green-600">Semua tugas →</Link>
              </div>
              <div className="divide-y divide-slate-50">
                {[...mgrActiveTasks].filter(t => t.deadline).sort((a, b) => String(a.deadline).localeCompare(String(b.deadline))).slice(0, 6).map((t: any) => {
                  const cd = countdown(t.deadline)
                  return (
                    <div key={t.task_id} className="flex items-center gap-3 px-6 py-3.5">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${priorityColor(t.priority).dot}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold truncate">{t.title}</p>
                        <p className={`text-xs flex items-center gap-1 ${cd?.late ? 'text-red-600 font-extrabold' : 'text-slate-500'}`}><Clock className="w-3 h-3" /> {cd ? `${cd.late ? 'Lewat' : ''} ${cd.txt}` : '-'}</p>
                      </div>
                    </div>
                  )
                })}
                {mgrActiveTasks.length === 0 && <p className="p-6 text-sm text-slate-500">Belum ada tugas aktif.</p>}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ===== Ringkasan kerani ===== */}
          <div className="grid grid-cols-3 gap-5">
            <StatCard label="Harus Diupload" value={needUpload.length} icon={UploadCloud} accent={{ chip: needUpload.length > 0 ? 'bg-red-100 text-red-600  rounded-2xl' : 'bg-slate-100 text-slate-500 rounded-2xl', blob: 'bg-red-200', stripe: needUpload.length > 0 ? 'border-l-red-500' : 'border-l-slate-300' }} />
            <StatCard label="Menunggu Review" value={waiting.length} icon={Clock} accent={{ chip: 'bg-amber-100 text-amber-700', blob: 'bg-amber-200', stripe: 'border-l-amber-400' }} />
            <StatCard label="Disetujui" value={approved.length} icon={CheckCircle2} accent={{ chip: 'bg-green-100 text-green-700', blob: 'bg-green-200', stripe: 'border-l-green-500' }} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black tracking-tight flex items-center gap-2.5 text-green-950"><UploadCloud className="w-6 h-6 text-green-600" /> Yang Harus Diupload</h2>
              <Link href="/file/tasks" className="text-sm font-extrabold text-green-700 hover:text-green-600">Lihat semua →</Link>
            </div>
            {keraniRows.length === 0 ? (
              <StickyNote variant="green" className="rounded-xl text-center py-8 px-6 max-w-xl">
                <p className="text-lg font-black">Belum ada penugasan</p>
                <p className="text-[13px] font-semibold opacity-80 mt-1">Tugas dari atasan akan muncul di panel ini beserta berkas yang perlu diunggah.</p>
              </StickyNote>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-8 pb-3">
                {keraniRows.map((t: any, i: number) => {
                  const status = t.current_status || 'ASSIGNED'
                  const cd = countdown(t.deadline)
                  const done = status === 'APPROVED'
                  const tone = status === 'REVISION_NEEDED' ? 'red' : status === 'SUBMITTED' ? 'amber' : status === 'APPROVED' ? 'green' : 'sky'
                  return (
                    <div key={`${t.task_id}-${t.assignment_id || 'x'}`} style={{ animationDelay: `${i * 60}ms` }} className={`anim-fadeup`}>
                      <TicketCard tone={tone as any}
                        stub={
                          <Link href={`/file/tasks/${t.assignment_id || t.task_id}?taskId=${t.task_id}`}
                            className={`w-full inline-flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-[10px] font-extrabold uppercase tracking-wider text-center leading-tight transition-all ${done
                              ? 'bg-stone-200/80 text-stone-500 hover:bg-stone-300/80'
                              : status === 'REVISION_NEEDED' ? 'bg-red-600 text-white hover:bg-red-500 shadow-md shadow-red-400/40 hover:-translate-y-0.5'
                              : status === 'SUBMITTED' ? 'bg-white border border-amber-300 text-amber-800'
                              : 'btn-primary hover:-translate-y-0.5'}`}>
                            {done ? <><CheckCircle2 className="w-5 h-5" /> Lihat</> : status === 'SUBMITTED' ? <><Clock className="w-5 h-5" /> Lihat<br />Status</> : <><UploadCloud className="w-5 h-5" /> Upload<br />Sekarang</>}
                          </Link>
                        }>
                        {/* kepala panel: prioritas + nomor + status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`w-2 h-2 rounded-full ${priorityColor(t.priority).dot}`} />
                          <span className="text-[9px] font-extrabold tracking-[0.18em] uppercase text-stone-400">{t.priority || 'MEDIUM'}</span>
                          <span className="text-[10px] font-mono text-stone-400">#{String(t.task_id).padStart(4, '0')}</span>
                          <span className={`ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_CLS[status]}`}>{STATUS_LABEL[status] || status}</span>
                        </div>

                        {/* isi instruksi */}
                        <h3 className="mt-2.5 text-lg font-black tracking-tight leading-snug text-green-950">{t.title}</h3>
                        <p className="mt-1 text-[13px] text-slate-600 line-clamp-2">{t.description}</p>

                        {status === 'REVISION_NEEDED' && t.latest_feedback && (
                          <div className="mt-3 border-l-4 border-red-400 bg-red-50 rounded-r-lg px-3 py-2">
                            <p className="text-[9px] font-extrabold text-red-700 uppercase tracking-widest flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Catatan atasan</p>
                            <p className="text-xs text-red-900 mt-0.5 line-clamp-2">{t.latest_feedback}</p>
                          </div>
                        )}

                        {/* deadline */}
                        {t.deadline && !done && (
                          <div className="mt-3 flex items-center justify-between">
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2 py-1 rounded-md border ${cd?.late ? 'text-red-700 border-red-300 bg-red-50' : 'text-green-800 border-green-200 bg-green-50'}`}>
                              <Clock className="w-3 h-3" /> {new Date(t.deadline).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }).toUpperCase()} · {new Date(t.deadline).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {cd && <span className={`text-[11px] font-extrabold ${cd.late ? 'text-red-600' : 'text-slate-400'}`}>{cd.late ? `+${cd.txt}` : cd.txt}</span>}
                          </div>
                        )}
                      </TicketCard>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
