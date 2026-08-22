'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  UploadCloud, AlertTriangle, CheckCircle2, Clock, ChevronRight,
  ClipboardList, Plus, FileCheck2, Users, Files, Inbox,
} from 'lucide-react'

type Row = any

function badge(status: string) {
  const map: Record<string, string> = {
    ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
    SUBMITTED: 'bg-amber-50 text-amber-700 border-amber-200',
    REVISION_NEEDED: 'bg-red-50 text-red-700 border-red-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  return map[status] || 'bg-slate-50 text-slate-600 border-slate-200'
}
const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Perlu Diupload',
  REVISION_NEEDED: 'Perlu Revisi',
  SUBMITTED: 'Menunggu Review',
  APPROVED: 'Disetujui',
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
function priorityDot(p?: string) {
  if (p === 'URGENT') return 'bg-red-600'
  if (p === 'HIGH') return 'bg-orange-500'
  if (p === 'MEDIUM') return 'bg-blue-500'
  return 'bg-slate-400'
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
  const isMgr = ['MANAGER', 'ASISTEN', 'SUPERADMIN'].includes(role)

  // Kerani: baris tugas sudah join assignment_id + current_status dari GET /tasks
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
    return <div className="max-w-6xl mx-auto"><div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-500">Memuat beranda...</div></div>
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header sambutan */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-2xl" />
        <div className="absolute -left-10 -bottom-20 w-56 h-56 rounded-full bg-teal-500/10 blur-2xl" />
        <div className="relative">
          <p className="text-sm text-emerald-300/90">{greet},</p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-0.5">{me?.full_name || me?.username || 'Pengguna'}</h1>
          <p className="mt-2 text-sm text-slate-300 max-w-xl">
            {isMgr
              ? 'Pantau submission kerani, buat instruksi tugas baru, dan review berkas yang masuk.'
              : needUpload.length > 0
                ? `Ada ${needUpload.length} berkas yang harus Anda kumpulkan. Cek daftar di bawah — urut sesuai deadline.`
                : 'Semua berkas sudah terkumpul. Tugas baru dari atasan akan muncul di sini.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {isMgr ? (
              <>
                <Link href="/file/manage" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-900 text-sm font-semibold hover:bg-emerald-400"><Plus className="w-4 h-4" /> Buat Tugas</Link>
                <Link href="/file/review" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-medium hover:bg-white/15"><FileCheck2 className="w-4 h-4" /> Review{mgrPendingReview.length > 0 ? ` (${mgrPendingReview.length})` : ''}</Link>
              </>
            ) : (
              <>
                <Link href="/file/tasks" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-900 text-sm font-semibold hover:bg-emerald-400"><ClipboardList className="w-4 h-4" /> Semua Tugas</Link>
                <Link href="/file/drive" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-medium hover:bg-white/15"><UploadCloud className="w-4 h-4" /> Drive Saya</Link>
              </>
            )}
          </div>
        </div>
      </div>

      {isMgr ? (
        <>
          {/* Statistik manager */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Menunggu Review', value: mgrPendingReview.length, icon: FileCheck2, cls: 'text-amber-600 bg-amber-50' },
              { label: 'Tugas Aktif', value: mgrActiveTasks.length, icon: ClipboardList, cls: 'text-blue-600 bg-blue-50' },
              { label: 'Kerani Terdaftar', value: keraniCount, icon: Users, cls: 'text-emerald-600 bg-emerald-50' },
              { label: 'Total Berkas Masuk', value: allFiles.length, icon: Files, cls: 'text-slate-600 bg-slate-100' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                <div className={`w-9 h-9 rounded-xl grid place-items-center ${s.cls}`}><s.icon className="w-4.5 h-4.5" /></div>
                <p className="mt-3 text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Submission terbaru */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-sm">Submission Terbaru</h2>
                <Link href="/file/review" className="text-xs font-medium text-emerald-700 hover:underline">Review semua</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {recentSubs.length === 0 ? <p className="p-5 text-sm text-slate-500">Belum ada berkas masuk.</p> : recentSubs.map((f: any) => (
                  <Link key={f.revision_id} href="/file/review" className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${f.review_status === 'APPROVED' ? 'bg-emerald-500' : f.review_status === 'REJECTED_NEEDS_REVISION' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{f.file_original_name}</p>
                      <p className="text-xs text-slate-500 truncate">{f.kerani_name || '—'} · {f.task_title || ''}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Deadline terdekat */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-sm">Deadline Terdekat</h2>
                <Link href="/file/tasks" className="text-xs font-medium text-emerald-700 hover:underline">Semua tugas</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {[...mgrActiveTasks].filter(t => t.deadline).sort((a, b) => String(a.deadline).localeCompare(String(b.deadline))).slice(0, 6).map((t: any) => {
                  const cd = countdown(t.deadline)
                  return (
                    <div key={t.task_id} className="flex items-center gap-3 px-5 py-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${priorityDot(t.priority)}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className={`text-xs flex items-center gap-1 ${cd?.late ? 'text-red-600' : 'text-slate-500'}`}><Clock className="w-3 h-3" /> {cd ? `${cd.late ? 'Lewat' : ''} ${cd.txt}` : '-'}</p>
                      </div>
                    </div>
                  )
                })}
                {mgrActiveTasks.length === 0 && <p className="p-5 text-sm text-slate-500">Belum ada tugas aktif.</p>}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Ringkasan kerani */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Harus Diupload', value: needUpload.length, icon: UploadCloud, cls: needUpload.length > 0 ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-100' },
              { label: 'Menunggu Review', value: waiting.length, icon: Clock, cls: 'text-amber-600 bg-amber-50' },
              { label: 'Disetujui', value: approved.length, icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                <div className={`w-9 h-9 rounded-xl grid place-items-center ${s.cls}`}><s.icon className="w-4.5 h-4.5" /></div>
                <p className="mt-3 text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Checklist upload */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2"><UploadCloud className="w-5 h-5 text-emerald-600" /> Yang Harus Diupload</h2>
              <Link href="/file/tasks" className="text-sm font-medium text-emerald-700 hover:underline">Lihat semua tugas</Link>
            </div>
            {keraniRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center"><Inbox className="w-6 h-6 text-slate-400" /></div>
                <p className="mt-3 font-medium text-slate-900">Belum ada penugasan</p>
                <p className="text-sm text-slate-500 mt-1">Tugas dari atasan akan muncul di sini beserta berkas yang perlu diunggah.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {keraniRows.map((t: any) => {
                  const status = t.current_status || 'ASSIGNED'
                  const cd = countdown(t.deadline)
                  const done = status === 'APPROVED'
                  return (
                    <div key={`${t.task_id}-${t.assignment_id || 'x'}`} className={`rounded-2xl bg-white border p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 ${status === 'REVISION_NEEDED' ? 'border-red-200' : 'border-slate-200'}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`w-2 h-2 rounded-full ${priorityDot(t.priority)}`} />
                          <span className="text-[11px] font-semibold tracking-widest text-slate-500">{t.priority || 'MEDIUM'}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${badge(status)}`}>{STATUS_LABEL[status] || status}</span>
                          {cd && !done && (
                            <span className={`text-xs inline-flex items-center gap-1 ${cd.late ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                              <Clock className="w-3.5 h-3.5" /> {cd.late ? `Terlambat ${cd.txt}` : `${cd.txt} lagi`}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 font-semibold text-slate-900 leading-snug">{t.title}</h3>
                        <p className="text-sm text-slate-600 line-clamp-2 mt-0.5">{t.description}</p>
                        {status === 'REVISION_NEEDED' && (
                          t.latest_feedback ? (
                            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2">
                              <p className="text-[11px] font-semibold text-red-800 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> Alasan revisi dari atasan:</p>
                              <p className="text-xs text-red-900 mt-1 whitespace-pre-wrap line-clamp-3">{t.latest_feedback}</p>
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 inline-flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Perbaiki sesuai catatan atasan, lalu upload ulang.
                            </p>
                          )
                        )}
                      </div>
                      <Link href={`/file/tasks/${t.assignment_id || t.task_id}?taskId=${t.task_id}`}
                        className={`shrink-0 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${done ? 'border border-slate-200 text-slate-500 hover:bg-slate-50' : status === 'REVISION_NEEDED' ? 'bg-red-600 text-white hover:bg-red-700' : status === 'ASSIGNED' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                        {done ? <><CheckCircle2 className="w-4 h-4" /> Lihat</> : status === 'SUBMITTED' ? 'Lihat Status' : <><UploadCloud className="w-4 h-4" /> Upload Sekarang</>}
                      </Link>
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
