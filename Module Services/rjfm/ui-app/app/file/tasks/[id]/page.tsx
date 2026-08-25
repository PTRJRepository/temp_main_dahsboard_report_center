'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, UploadCloud, History, FileText, AlertTriangle, CheckCircle2,
  Download, Clock, Eye, FolderInput,
} from 'lucide-react'
import PreviewModal, { type PreviewTarget } from '../../PreviewModal'
import { StickyNote } from '../../decor'

const REV_CLS: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED_NEEDS_REVISION: 'bg-red-100 text-red-700 border-red-200',
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
}
const STATUS_CLS: Record<string, string> = {
  ASSIGNED: 'bg-sky-100 text-sky-800 border-sky-200',
  SUBMITTED: 'bg-amber-100 text-amber-800 border-amber-200',
  REVISION_NEEDED: 'bg-red-100 text-red-700 border-red-200',
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
}

export default function TaskDetailPage() {
  const params = useParams() as { id: string }
  const search = useSearchParams()
  const assignmentId = params.id
  const taskIdParam = search.get('taskId')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [preview, setPreview] = useState<PreviewTarget | null>(null)

  const load = async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch(`/api/file/assignments/${assignmentId}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`)
      setData(j.data)
    } catch (e: any) {
      setErr(e.message)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [assignmentId])

  const submit = async () => {
    if (!file) { setMsg('Pilih berkas dulu.'); return }
    if (file.size > 10 * 1024 * 1024) { setMsg('Maks 10 MB.'); return }
    setSubmitting(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (notes.trim()) fd.append('notes', notes.trim())
      const r = await fetch(`/api/file/assignments/${assignmentId}/submit`, { method: 'POST', body: fd })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`)
      setMsg(`Berhasil upload v${j.data?.revision_number} — berkas otomatis masuk folder “Tugas” di Drive Saya.`)
      setFile(null)
      setNotes('')
      load()
    } catch (e: any) {
      setMsg(e.message)
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="max-w-6xl mx-auto card rounded-3xl p-12 text-center text-sm text-slate-400 animate-pulse">Memuat...</div>
  if (err) return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-3xl bg-red-500/10 border border-red-500/30 p-5 text-sm text-red-200">{err}</div>
      <Link href="/file/tasks" className="mt-4 inline-block text-sm font-bold text-emerald-400 hover:text-emerald-300">← Kembali</Link>
    </div>
  )
  const a = data?.assignment
  const revs: any[] = data?.revisions || []
  const latest = revs[0]
  const status = a?.current_status || 'ASSIGNED'
  const locked = status === 'APPROVED'

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f && !locked) setFile(f) }}
      className="max-w-6xl mx-auto relative">
      {drag && !locked && (
        <div className="anim-pop fixed inset-0 z-50 bg-emerald-950/70 backdrop-blur-sm grid place-items-center pointer-events-none">
          <div className="rounded-3xl border-4 border-dashed border-emerald-400 px-14 py-12 text-center">
            <UploadCloud className="w-14 h-14 text-emerald-300 mx-auto animate-bounce" />
            <p className="mt-4 text-2xl font-black text-white">Lepaskan untuk melampirkan</p>
          </div>
        </div>
      )}

      <Link href="/file/tasks" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-emerald-400 transition-colors"><ArrowLeft className="w-4 h-4" /> Kembali ke daftar</Link>

      {/* Header tugas */}
      <div className={`mt-4 rounded-[2rem] card p-8 relative overflow-hidden anim-fadeup ${status === 'REVISION_NEEDED' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-emerald-500'}`}>
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">{a?.title || `Tugas #${a?.task_id}`}</h1>
            <p className="text-slate-300 mt-2 whitespace-pre-wrap">{a?.description}</p>
            <p className="text-xs text-slate-400 mt-3 inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Deadline: <b>{a?.deadline ? new Date(a.deadline).toLocaleString('id-ID') : '-'}</b></p>
          </div>
          <span className={`px-4 py-2 rounded-full text-xs font-extrabold border ${STATUS_CLS[status]} ${status === 'REVISION_NEEDED' ? 'animate-pulse' : ''}`}>{status}</span>
        </div>

        {latest?.review_status === 'REJECTED_NEEDS_REVISION' && latest?.manager_feedback && (
          <div className="relative mt-5 max-w-2xl">
            <StickyNote variant="red" rotate={-1} className="rounded-lg px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Perlu revisi — catatan atasan</p>
              <p className="mt-1 whitespace-pre-wrap font-semibold">{latest.manager_feedback}</p>
            </StickyNote>
          </div>
        )}
        {locked && (
          <div className="relative mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200 flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Berkas disetujui — terkunci (read-only).</div>
        )}
      </div>

      <div className="mt-7 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Submit */}
        <div className="lg:col-span-3 card rounded-[2rem] p-8 anim-fadeup d-1">
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2.5"><UploadCloud className="w-6 h-6 text-emerald-400" /> Kumpulkan berkas</h2>
          <p className="text-xs text-slate-400 mt-1">PDF / Excel / Word / foto / video / KML — maks 10 MB. Validasi isi (magic bytes) aktif.</p>
          <div className="mt-5 space-y-4">
            <label className={`block cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-200 p-8 text-center ${locked ? 'opacity-50 pointer-events-none border-white/10' : drag ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]' : 'border-white/15 hover:border-emerald-500/60 hover:bg-emerald-500/5'}`}>
              <input type="file" disabled={locked} accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.kml,.kmz,.csv,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
              <FolderInput className={`w-9 h-9 mx-auto ${file ? 'text-emerald-400' : 'text-slate-500'}`} />
              {file ? (
                <>
                  <p className="mt-2 font-extrabold">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB — klik untuk ganti</p>
                </>
              ) : (
                <>
                  <p className="mt-2 font-bold">Tarik &amp; lepas di sini, atau klik untuk memilih</p>
                  <p className="text-xs text-slate-500 mt-0.5">Ekstensi berbahaya (exe/script) otomatis ditolak sistem.</p>
                </>
              )}
            </label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={locked} placeholder="Catatan untuk atasan (opsional) — mis. perbaikan tonase blok C4..." rows={3}
              className="input-dark w-full rounded-2xl px-4 py-3 text-sm disabled:opacity-50" />
            {!locked && (
              <button onClick={submit} disabled={submitting || !file}
                className="btn-primary w-full rounded-2xl text-white py-4 text-sm font-extrabold disabled:opacity-40">
                {submitting ? 'Mengunggah...' : 'Upload / Submit Revisi'}
              </button>
            )}
            {msg && <p className="text-sm rounded-2xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 whitespace-pre-wrap text-emerald-200">{msg}</p>}
            {taskIdParam && <p className="text-[11px] text-slate-600">task_id={taskIdParam} • assignment_id={assignmentId}</p>}
          </div>
        </div>

        {/* Riwayat revisi */}
        <div className="lg:col-span-2 card rounded-[2rem] p-8 anim-fadeup d-2">
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2.5"><History className="w-6 h-6 text-slate-400" /> Riwayat revisi</h2>
          {revs.length === 0 ? (
            <p className="text-sm text-slate-400 mt-4">Belum ada submission.</p>
          ) : (
            <div className="mt-5 space-y-4 max-h-[62vh] overflow-auto pr-1">
              {[...revs].map((r: any) => (
                <div key={r.revision_id} className="rounded-2xl border border-white/10 bg-white/[.03] p-4 hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-400 bg-white/5 rounded-lg px-2 py-1">v{r.revision_number}</span>
                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${REV_CLS[r.review_status]}`}>{r.review_status}</span>
                  </div>
                  <p className="font-bold mt-2 flex items-center gap-2 truncate"><FileText className="w-4 h-4 text-slate-400 shrink-0" /> {r.file_original_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{new Date(r.submitted_at).toLocaleString('id-ID')} · {(r.file_size_bytes / 1024).toFixed(1)} KB</p>
                  {r.notes_from_kerani && <p className="text-xs text-slate-300 mt-1.5 italic bg-white/5 rounded-xl px-2.5 py-1.5">Catatan: {r.notes_from_kerani}</p>}
                  {r.manager_feedback && (
                    <div className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
                      <p className="text-[10px] font-extrabold text-red-300 uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Alasan revisi:</p>
                      <p className="text-xs text-red-100 mt-0.5 whitespace-pre-wrap">{r.manager_feedback}</p>
                    </div>
                  )}
                  <div className="mt-2.5 flex items-center gap-4">
                    <button onClick={() => setPreview({ url: `/api/file/files/${r.revision_id}/stream`, name: r.file_original_name, mime: r.file_mime_type })}
                      className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-400 hover:text-emerald-300"><Eye className="w-3.5 h-3.5" /> Pratinjau</button>
                    <a href={`/api/file/files/${r.revision_id}/stream`} download={r.file_original_name}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white"><Download className="w-3.5 h-3.5" /> Unduh</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {preview && <PreviewModal target={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
