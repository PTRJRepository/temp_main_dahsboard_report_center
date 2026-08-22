'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, AlertTriangle, Eye, History } from 'lucide-react'
import PreviewModal, { type PreviewTarget } from '../PreviewModal'

export default function FileReviewPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'SUBMITTED' | 'REVISION_NEEDED' | 'APPROVED'>('all')
  const [feedback, setFeedback] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewTarget | null>(null)
  const [detail, setDetail] = useState<Record<number, any>>({})

  const load = async () => {
    setLoading(true); setErr(null)
    try {
      const r = await fetch('/api/file/assignments', { cache: 'no-store' })
      const j = await r.json().catch(()=>({}))
      if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`)
      const list = j.data||[]
      setRows(list)
      // ambil detail revisi tiap assignment (paralel) — manager boleh lihat semua revisi
      const entries = await Promise.all(list.map(async (a: any) => {
        try {
          const rd = await fetch(`/api/file/assignments/${a.assignment_id}`, { cache: 'no-store' })
          const jd = await rd.json().catch(() => ({}))
          return [a.assignment_id, jd.data] as const
        } catch { return [a.assignment_id, null] as const }
      }))
      setDetail(Object.fromEntries(entries))
    } catch (e:any) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(()=>{ load() }, [])

  const review = async (assignmentId: number, status: 'APPROVED' | 'REJECTED_NEEDS_REVISION') => {
    const fb = (feedback[assignmentId] || '').trim()
    if (status === 'REJECTED_NEEDS_REVISION' && fb.length < 10) { setMsg('Untuk revisi, instruksi wajib ≥10 karakter.'); return }
    setBusy(assignmentId); setMsg(null)
    try {
      const r = await fetch(`/api/file/submissions/${assignmentId}/review`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ review_status: status, manager_feedback: fb || undefined }) })
      const j = await r.json().catch(()=>({}))
      if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`)
      setMsg(status==='APPROVED' ? 'Disetujui.' : 'Permintaan revisi terkirim.')
      setFeedback(f=> ({ ...f, [assignmentId]: '' }))
      load()
    } catch (e:any) { setMsg(e.message) } finally { setBusy(null) }
  }

  const filtered = filter==='all' ? rows : rows.filter(r=> r.current_status===filter)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-xl font-bold text-slate-900">Review Berkas — Atasan / Manager</h1>
        <p className="text-sm text-slate-600">Klik nama berkas untuk pratinjau (PDF, foto, video, Excel, Word, KML). Setujui atau minta revisi dengan alasan yang jelas.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(['all','SUBMITTED','REVISION_NEEDED','APPROVED'] as const).map(k=> (
            <button key={k} onClick={()=>setFilter(k)} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${filter===k?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-700 border-slate-200'}`}>{k==='all'?'Semua':k}</button>
          ))}
          <button onClick={load} className="ml-auto px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-sm">Refresh</button>
        </div>

        {msg && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">{msg}</div>}
        {loading ? <div className="mt-6 rounded-xl bg-white border border-slate-200 p-8 text-center text-sm text-slate-500">Memuat...</div>
        : err ? <div className="mt-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{err}</div>
        : filtered.length===0 ? <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Tidak ada assignment untuk filter ini.</div>
        : (
          <div className="mt-4 space-y-4">
            {filtered.map((a:any)=> (
              <div key={a.assignment_id} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{a.title || `Task #${a.task_id}`} <span className="text-xs font-normal text-slate-500">→ {a.kerani_username || `#${a.kerani_user_id}`}</span></p>
                    <p className="text-xs text-slate-500">{a.deadline ? new Date(a.deadline).toLocaleString('id-ID') : ''}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${a.current_status==='APPROVED'?'bg-emerald-50 text-emerald-700 border-emerald-200':a.current_status==='REVISION_NEEDED'?'bg-red-50 text-red-700 border-red-200':'bg-amber-50 text-amber-700 border-amber-200'}`}>{a.current_status}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Link href={`/file/tasks/${a.assignment_id}`} className="text-sm text-emerald-700 hover:underline">Lihat detail & berkas →</Link>
                  {a.current_status==='SUBMITTED' && <span className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Menunggu review</span>}
                </div>

                {/* Riwayat revisi + pratinjau — manager lihat semua versi */}
                {(detail[a.assignment_id]?.revisions || []).length > 0 && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-2"><History className="w-3.5 h-3.5" /> Riwayat revisi ({detail[a.assignment_id].revisions.length})</p>
                    <div className="space-y-2">
                      {[...detail[a.assignment_id].revisions].map((r: any) => (
                        <div key={r.revision_id} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
                          <span className="text-[11px] font-bold text-slate-500 w-7">v{r.revision_number}</span>
                          <button onClick={() => setPreview({ url: `/api/file/files/${r.revision_id}/stream`, name: r.file_original_name, mime: r.file_mime_type })}
                            className="min-w-0 flex-1 text-left text-sm font-medium truncate hover:text-emerald-700 flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {r.file_original_name}
                          </button>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${r.review_status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : r.review_status === 'REJECTED_NEEDS_REVISION' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{r.review_status}</span>
                          {r.manager_feedback && (
                            <span className="hidden md:inline text-xs text-red-700 truncate max-w-[280px]" title={r.manager_feedback}>“{r.manager_feedback}”</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {a.current_status==='SUBMITTED' && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <label className="text-sm font-medium">Instruksi revisi (wajib ≥10 char jika Tolak/Revisi)</label>
                    <textarea value={feedback[a.assignment_id]||''} onChange={e=> setFeedback(f=>({...f, [a.assignment_id]: e.target.value}))} rows={2} placeholder="Contoh: Angka tonase TPH 12 hal 2 tidak sinkron dengan nota PKS. Hitung ulang & upload kembali." className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" />
                    <p className="text-xs text-slate-500 mt-1">{(feedback[a.assignment_id]||'').trim().length}/10 min untuk revisi</p>
                    <div className="mt-3 flex gap-2">
                      <button onClick={()=>review(a.assignment_id,'APPROVED')} disabled={busy===a.assignment_id} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white py-2.5 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 className="w-4 h-4" /> Setujui</button>
                      <button onClick={()=>review(a.assignment_id,'REJECTED_NEEDS_REVISION')} disabled={busy===a.assignment_id} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-red-200 text-red-700 py-2.5 text-sm font-semibold hover:bg-red-50 disabled:opacity-50"><XCircle className="w-4 h-4" /> Minta Revisi</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {preview && <PreviewModal target={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
