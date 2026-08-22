'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, UploadCloud, History, FileText, AlertTriangle, CheckCircle2, Download, Clock, Eye } from 'lucide-react'
import PreviewModal, { type PreviewTarget } from '../../PreviewModal'

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
      setMsg(`Berhasil upload v${j.data?.revision_number} — SHA ${String(j.data?.sha256 || '').slice(0, 12)}...`)
      setFile(null)
      setNotes('')
      load()
    } catch (e: any) {
      setMsg(e.message)
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 p-8 text-sm text-slate-600">Memuat...</div>
  if (err) return <div className="min-h-screen bg-slate-50 p-8"><div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{err}</div><Link href="/file/tasks" className="mt-4 inline-block text-sm text-slate-700 underline">Kembali</Link></div>
  const a = data?.assignment
  const revs: any[] = data?.revisions || []
  const latest = revs[0]
  const status = a?.current_status || 'ASSIGNED'

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <Link href="/file/tasks" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Kembali ke daftar</Link>

        <div className="mt-4 rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{a?.title || `Tugas #${a?.task_id}`}</h1>
              <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a?.description}</p>
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Deadline: {a?.deadline ? new Date(a.deadline).toLocaleString('id-ID') : '-'}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : status === 'REVISION_NEEDED' ? 'bg-red-50 text-red-700 border-red-200' : status === 'SUBMITTED' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{status}</span>
          </div>

          {latest?.review_status === 'REJECTED_NEEDS_REVISION' && latest?.manager_feedback && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Perlu revisi — instruksi atasan:</p>
              <p className="text-sm text-red-900 mt-1 whitespace-pre-wrap">{latest.manager_feedback}</p>
            </div>
          )}
          {latest?.review_status === 'APPROVED' && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Berkas disetujui — terkunci (read-only).</div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2"><UploadCloud className="w-5 h-5 text-emerald-600" /> Kumpulkan berkas</h2>
            <p className="text-xs text-slate-500 mt-1">PDF / Excel (xls/xlsx) / JPG / PNG, maks 10 MB. Berkas diperiksa magic bytes.</p>
            <div className="mt-4 space-y-3">
              <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors p-6 text-center">
                <input type="file" accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.kml,.kmz,.csv,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                {file ? (
                  <>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB — klik untuk ganti</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-medium text-slate-700">Klik untuk pilih berkas</p>
                    <p className="text-xs text-slate-500 mt-0.5">PDF, Word, Excel, foto, video, KML, CSV, TXT — maks 10 MB. Berkas berbahaya (exe/script) otomatis ditolak.</p>
                  </>
                )}
              </label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan untuk atasan (opsional) — mis. perbaikan tonase blok C4..." rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              <button onClick={submit} disabled={submitting || !file} className="w-full rounded-xl bg-emerald-600 text-white py-3 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">{submitting ? 'Mengunggah...' : 'Upload / Submit Revisi'}</button>
              {msg && <p className="text-sm rounded-xl bg-slate-100 border border-slate-200 p-3 whitespace-pre-wrap">{msg}</p>}
              {taskIdParam && <p className="text-xs text-slate-400">task_id={taskIdParam} • assignment_id={assignmentId}</p>}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2"><History className="w-5 h-5 text-slate-600" /> Riwayat revisi</h2>
            {revs.length === 0 ? (
              <p className="text-sm text-slate-500 mt-3">Belum ada submission.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {revs.map((r: any) => (
                  <div key={r.revision_id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold tracking-widest text-slate-500">v{r.revision_number}</span>
                      <span className={`text-xs px-2 py-1 rounded-full border ${r.review_status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : r.review_status === 'REJECTED_NEEDS_REVISION' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{r.review_status}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 mt-1 flex items-center gap-1.5"><FileText className="w-4 h-4 text-slate-500" /> {r.file_original_name}</p>
                    <p className="text-xs text-slate-500">{new Date(r.submitted_at).toLocaleString('id-ID')} • {(r.file_size_bytes / 1024).toFixed(1)} KB • {r.file_mime_type}</p>
                    {r.notes_from_kerani && <p className="text-xs text-slate-600 mt-1 italic">Catatan: {r.notes_from_kerani}</p>}
                    {r.manager_feedback && (
                      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2">
                        <p className="text-[11px] font-semibold text-red-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Alasan revisi (atasan):</p>
                        <p className="text-xs text-red-900 mt-0.5 whitespace-pre-wrap">{r.manager_feedback}</p>
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-3">
                      <button onClick={() => setPreview({ url: `/api/file/files/${r.revision_id}/stream`, name: r.file_original_name, mime: r.file_mime_type })}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"><Eye className="w-3.5 h-3.5" /> Pratinjau</button>
                      <a href={`/api/file/files/${r.revision_id}/stream`} download={r.file_original_name} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"><Download className="w-3.5 h-3.5" /> Unduh</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {preview && <PreviewModal target={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
