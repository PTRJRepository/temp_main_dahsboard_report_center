'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2, XCircle, AlertTriangle, Eye, RefreshCw,
  UserRound, Inbox, Send,
} from 'lucide-react'
import PreviewModal, { type PreviewTarget } from '../PreviewModal'
import { StickyNote } from '../decor'

type FilterKey = 'SUBMITTED' | 'REVISION_NEEDED' | 'APPROVED' | 'all'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'SUBMITTED', label: 'Perlu Review' },
  { key: 'APPROVED', label: 'Disetujui' },
  { key: 'REVISION_NEEDED', label: 'Direvisi' },
  { key: 'all', label: 'Semua' },
]

function initials(name?: string) {
  const parts = (name || '?').trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() || '').join('') || '?'
}

const REV_CLS: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED_NEEDS_REVISION: 'bg-red-100 text-red-700 border-red-200',
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
}

export default function FileReviewPage() {
  const [rows, setRows] = useState<any[]>([])
  const [detail, setDetail] = useState<Record<number, any>>({})
  const [keraniId, setKeraniId] = useState<number | null>(null)
  const [filter, setFilter] = useState<FilterKey>('SUBMITTED')
  const [selected, setSelected] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewTarget | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setErr(null); setMsg(null)
    try {
      const r = await fetch('/api/file/assignments', { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`)
      const list = j.data || []
      setRows(list)
      const entries = await Promise.all(list.map(async (a: any) => {
        try {
          const rd = await fetch(`/api/file/assignments/${a.assignment_id}`, { cache: 'no-store' })
          const jd = await rd.json().catch(() => ({}))
          return [a.assignment_id, jd.data] as const
        } catch { return [a.assignment_id, null] as const }
      }))
      setDetail(Object.fromEntries(entries))
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const keraniList = useMemo(() => {
    const map = new Map<number, { id: number; name: string; pending: number; total: number }>()
    for (const a of rows) {
      const cur = map.get(a.kerani_user_id)
        || { id: a.kerani_user_id, name: a.kerani_full_name || a.kerani_username || `User #${a.kerani_user_id}`, pending: 0, total: 0 }
      cur.total++
      if (a.current_status === 'SUBMITTED') cur.pending++
      map.set(a.kerani_user_id, cur)
    }
    return [...map.values()].sort((x, y) => y.pending - x.pending || x.name.localeCompare(y.name))
  }, [rows])

  useEffect(() => {
    if (keraniId === null && keraniList.length > 0) setKeraniId(keraniList[0].id)
  }, [keraniList, keraniId])

  const filtered = useMemo(() => {
    let r = rows.filter(a => a.kerani_user_id === keraniId)
    if (filter !== 'all') r = r.filter(a => a.current_status === filter)
    return r
  }, [rows, keraniId, filter])

  useEffect(() => {
    if (!filtered.some(a => a.assignment_id === selected)) {
      setSelected(filtered.length ? filtered[0].assignment_id : null)
      setFeedback('')
    }
  }, [filtered]) // eslint-disable-line react-hooks/exhaustive-deps

  const sel = filtered.find(a => a.assignment_id === selected) || null
  const selDetail = sel ? detail[sel.assignment_id] : null
  const revs: any[] = selDetail?.revisions || []
  const canAct = sel?.current_status === 'SUBMITTED'

  const review = async (status: 'APPROVED' | 'REJECTED_NEEDS_REVISION') => {
    if (!sel) return
    const fb = feedback.trim()
    if (status === 'REJECTED_NEEDS_REVISION' && fb.length < 10) { setMsg('Untuk revisi, instruksi wajib ≥10 karakter.'); return }
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(`/api/file/submissions/${sel.assignment_id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_status: status, manager_feedback: fb || undefined }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`)
      setMsg(status === 'APPROVED' ? 'Disetujui.' : 'Permintaan revisi terkirim.')
      setFeedback('')
      await load()
    } catch (e: any) { setMsg(e.message) } finally { setBusy(false) }
  }

  const pickKerani = (id: number) => { setKeraniId(id); setMsg(null) }

  if (loading) return <div className="max-w-7xl mx-auto"><div className="card rounded-3xl p-12 text-center text-sm text-slate-500 animate-pulse">Memuat data review...</div></div>
  if (err) return <div className="max-w-7xl mx-auto"><div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{err}</div></div>

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 anim-fadeup">
        <div>
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3 text-green-950"><CheckCircle2 className="w-8 h-8 text-green-600" /> Review Berkas</h1>
          <p className="text-sm text-slate-500 mt-1.5">Pilih kerani → pilih tugas → putuskan di panel kanan. Tanpa scroll panjang.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl card card-hover text-sm font-extrabold text-green-900"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>

      {msg && <div className="mt-4 anim-pop rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-800 w-fit">{msg}</div>}

      {keraniList.length === 0 ? (
        <div className="mt-6 card rounded-3xl border-dashed p-14 text-center">
          <Inbox className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="mt-3 font-bold text-lg">Belum ada assignment</p>
          <p className="text-sm text-slate-500">Buat tugas terlebih dahulu agar kerani mengumpulkan berkas.</p>
        </div>
      ) : (
        <>
          {/* Segmentasi 1: chip kerani */}
          <div className="mt-6 flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1">
            {keraniList.map((k, i) => {
              const on = k.id === keraniId
              return (
                <button key={k.id} onClick={() => pickKerani(k.id)}
                  style={{ animationDelay: `${i * 45}ms` }}
                  className={`anim-slidex shrink-0 flex items-center gap-3 pl-2 pr-5 py-2 rounded-2xl border transition-all duration-200 ${on
                    ? 'chip-on scale-[1.03]'
                    : 'card card-hover text-green-950'}`}>
                  <span className={`w-9 h-9 rounded-xl grid place-items-center text-xs font-black ${on ? 'bg-white/25' : 'bg-green-100 text-green-700'}`}>{initials(k.name)}</span>
                  <span className="text-left">
                    <span className="block text-sm font-extrabold leading-tight">{k.name}</span>
                    <span className={`block text-[10px] uppercase tracking-wider font-bold ${on ? 'text-green-50' : 'text-slate-400'}`}>{k.total} tugas</span>
                  </span>
                  {k.pending > 0 && (
                    <span className={`min-w-[22px] h-[22px] px-1.5 rounded-full grid place-items-center text-[11px] font-black animate-pulse ${on ? 'bg-white text-green-800' : 'bg-red-500 text-white'}`}>{k.pending}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Segmentasi 2: filter status */}
          <div className="mt-4 flex items-center gap-2 p-1.5 card rounded-2xl w-fit max-w-full overflow-auto">
            {FILTERS.map(f => {
              const cnt = f.key === 'all'
                ? rows.filter(a => a.kerani_user_id === keraniId).length
                : rows.filter(a => a.kerani_user_id === keraniId && a.current_status === f.key).length
              return (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap inline-flex items-center gap-1.5 transition-all ${filter === f.key ? 'chip-on' : 'text-slate-500 hover:text-green-900 hover:bg-green-50'}`}>
                  {f.label}
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums ${filter === f.key ? 'bg-white/25' : 'bg-green-100 text-green-800'}`}>{cnt}</span>
                </button>
              )
            })}
          </div>

          {/* Master–detail */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 space-y-3">
              {filtered.length === 0 ? (
                <div className="card rounded-3xl border-dashed p-10 text-center">
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="mt-3 text-sm font-bold">Tidak ada tugas untuk filter ini</p>
                </div>
              ) : filtered.map((a: any, i: number) => {
                const on = a.assignment_id === selected
                const stCls = a.current_status === 'APPROVED' ? 'bg-green-100 text-green-800 border-green-200'
                  : a.current_status === 'REVISION_NEEDED' ? 'bg-red-100 text-red-700 border-red-200'
                  : 'bg-amber-100 text-amber-800 border-amber-200'
                return (
                  <button key={a.assignment_id} onClick={() => { setSelected(a.assignment_id); setFeedback(''); setMsg(null) }}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className={`anim-fadeup w-full text-left rounded-xl p-[1px] transition-transform duration-200 ${on ? '' : 'hover:-translate-y-0.5'}`}>
                    <div className={`rounded-xl p-4 border-l-8 shadow-sm transition-all duration-200 ${on
                      ? 'bg-green-50 border-green-600 ring-2 ring-green-500/50'
                      : 'bg-white border-stone-300'}`}
                      style={{ transform: `rotate(${(i % 3 - 1) * 0.25}deg)` }}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-extrabold leading-snug text-green-950">{a.title || `Tugas #${a.task_id}`}</p>
                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${stCls}`}>{a.current_status}</span>
                      </div>
                      <p className="text-xs mt-1.5 text-slate-400 font-semibold">
                        {a.deadline ? new Date(a.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        {(detail[a.assignment_id]?.revisions?.length || 0) > 0 && ` · v${Math.max(...(detail[a.assignment_id]?.revisions || [{ revision_number: 0 }]).map((r: any) => r.revision_number))}`}
                        {a.current_status === 'SUBMITTED' && <span className="ml-2 inline-flex items-center gap-1 text-amber-700 font-extrabold"><AlertTriangle className="w-3 h-3" /> menunggu review</span>}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="lg:col-span-7 lg:sticky lg:top-24">
              {!sel ? (
                <div className="card rounded-3xl border-dashed p-14 text-center">
                  <UserRound className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="mt-3 text-sm text-slate-500 font-bold">Pilih salah satu tugas di kiri untuk mulai review.</p>
                </div>
              ) : (
                <div className="anim-fadeup card rounded-3xl overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-green-50 to-transparent">
                    <p className="text-[10px] font-black tracking-[0.2em] text-green-600 uppercase">Panel Review</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight text-green-950">{sel.title}</h2>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{sel.description}</p>
                  </div>

                  <div className="p-6 space-y-3 max-h-[42vh] overflow-auto">
                    {revs.length === 0 ? (
                      <p className="text-sm text-slate-500">Belum ada submission dari kerani ini.</p>
                    ) : [...revs].map((r: any) => (
                      <div key={r.revision_id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 hover:border-green-400 transition-colors">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-green-800 bg-green-100 rounded-lg px-2 py-1">v{r.revision_number}</span>
                          <button onClick={() => setPreview({ url: `/api/file/files/${r.revision_id}/stream`, name: r.file_original_name, mime: r.file_mime_type })}
                            className="min-w-0 flex-1 text-left font-bold truncate hover:text-green-700 flex items-center gap-2">
                            <Eye className="w-4 h-4 text-green-600 shrink-0" /> {r.file_original_name}
                          </button>
                          <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${REV_CLS[r.review_status]}`}>{r.review_status}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          Dikirim {new Date(r.submitted_at).toLocaleString('id-ID')} · {(r.file_size_bytes / 1024).toFixed(1)} KB
                        </p>
                        {r.notes_from_kerani && (
                          <p className="text-xs text-slate-700 mt-1.5 italic bg-white border border-slate-200 rounded-xl px-3 py-2">Catatan kerani: “{r.notes_from_kerani}”</p>
                        )}
                        {r.notes_from_kerani === null && r.revision_number > 1 && (
                          <StickyNote variant="yellow" rotate={0.7} ruled={false} className="mt-2 rounded-lg px-3 py-2 text-xs">
                            <span className="font-black uppercase tracking-wider text-[9px] opacity-70">Memo kerani</span>
                            <p>Tanpa catatan tambahan pada revisi ini.</p>
                          </StickyNote>
                        )}
                        {r.manager_feedback && (
                          <StickyNote variant="red" rotate={-0.8} ruled={false} className="mt-2 rounded-lg px-3 py-2 text-xs leading-snug">
                            <span className="font-black uppercase tracking-wider text-[9px] opacity-80">Instruksi atasan</span>
                            <p className="font-semibold">“{r.manager_feedback}”</p>
                          </StickyNote>
                        )}
                      </div>
                    ))}
                  </div>

                  {canAct ? (
                    <div className="p-6 border-t border-slate-100 bg-gradient-to-t from-green-50/80 to-transparent">
                      <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Instruksi revisi (wajib bila menolak)</label>
                      <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={2}
                        placeholder="Contoh: Angka tonase TPH 12 tidak sinkron dengan nota PKS. Hitung ulang & upload ulang."
                        className="input-field mt-2 w-full rounded-2xl px-4 py-3 text-sm" />
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-[11px] text-slate-400 font-semibold">Minimum 10 karakter untuk permintaan revisi.</p>
                        <p className={`text-[11px] font-black tabular-nums ${feedback.trim().length >= 10 ? 'text-green-700' : 'text-slate-400'}`}>{feedback.trim().length}/10</p>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <button onClick={() => review('APPROVED')} disabled={busy}
                          className="btn-primary rounded-2xl py-3.5 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-5 h-5" /> Setujui
                        </button>
                        <button onClick={() => review('REJECTED_NEEDS_REVISION')} disabled={busy}
                          className="rounded-2xl border border-red-300 bg-red-50 text-red-700 py-3.5 text-sm font-extrabold hover:bg-red-100 disabled:opacity-50 inline-flex items-center justify-center gap-2 transition-colors">
                          <XCircle className="w-5 h-5" /> Minta Revisi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-6 py-4 border-t border-slate-100 text-sm text-slate-500 flex items-center gap-2">
                      <Send className="w-4 h-4 text-slate-300" />
                      Status saat ini <b className="text-slate-700 mx-1">{sel.current_status}</b> — tidak ada aksi review yang dibutuhkan.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {preview && <PreviewModal target={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
