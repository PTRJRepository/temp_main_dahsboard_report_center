'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Folder, FileText, Star, Trash2, UploadCloud, Plus, Image as ImgIcon, Eye, Film,
  Map as MapIcon, FileSpreadsheet, ChevronRight, UserRound, StickyNote as StickyNoteIcon, Clock3, RotateCcw,
} from 'lucide-react'
import PreviewModal, { type PreviewTarget } from '../PreviewModal'
import { StickyNote } from '../decor'

// Leaflet (di PreviewModal) menyentuh `window` saat module load — halaman ini
// tidak boleh di-prerender saat build.
export const dynamic = 'force-dynamic'

function iconFor(it: any) {
  if (it.kind === 'folder') return <Folder className="w-10 h-10 text-amber-500" />
  if ((it.mime_type || '').startsWith('image/')) return <ImgIcon className="w-10 h-10 text-sky-500" />
  const ext = it.name?.toLowerCase().split('.').pop() || ''
  if (['mp4', 'webm', 'mov'].includes(ext)) return <Film className="w-10 h-10 text-violet-500" />
  if (['kml', 'kmz'].includes(ext)) return <MapIcon className="w-10 h-10 text-green-600" />
  if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet className="w-10 h-10 text-lime-600" />
  return <FileText className="w-10 h-10 text-slate-400" />
}

function relTime(iso?: string | null) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} mnt lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  return `${d} hari lalu`
}

/** Strip jejak asal berkas: dari siapa · kapan · catatan apa. */
function TraceBadges({ it }: { it: any }) {
  if (it.kind !== 'file' || !it.source) return null
  if (it.source !== 'task_submission') {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
        <UploadCloud className="w-3 h-3" /> Upload manual{relTime(it.created_at) ? ` · ${relTime(it.created_at)}` : ''}
      </div>
    )
  }
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 border border-green-200 text-green-800">
          <FileText className="w-3 h-3" /> {it.task_title || 'Tugas'}
        </span>
        <span className="inline-flex items-center gap-1 text-slate-600"><UserRound className="w-3 h-3 text-sky-600" /> {it.submitter_name || '—'}</span>
        <span className="inline-flex items-center gap-1 text-slate-500" title={it.submitted_at || ''}><Clock3 className="w-3 h-3 text-green-600" /> {relTime(it.submitted_at) || '-'}</span>
      </div>
      {it.notes && (
        <p className="text-[11px] text-slate-700 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5 line-clamp-2 flex gap-1.5" title={it.notes}>
          <StickyNoteIcon className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" /> {it.notes}
        </p>
      )}
    </div>
  )
}

function DriveInner() {
  const sp = useSearchParams()
  const router = useRouter()
  const parent = sp.get('parent')
  const q = sp.get('q') || ''
  const starred = sp.get('starred') === '1'
  const trashed = sp.get('trashed') === '1'
  const recent = sp.get('recent') === '1'
  const [items, setItems] = useState<any[]>([])
  const [quota, setQuota] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [preview, setPreview] = useState<PreviewTarget | null>(null)

  const qs = new URLSearchParams()
  if (parent) qs.set('parent_id', parent)
  else if (!starred && !trashed && !recent && !q) qs.set('parent_id', 'root')
  if (q) qs.set('q', q)
  if (starred) qs.set('starred', '1')
  if (trashed) qs.set('trashed', '1')
  if (recent) qs.set('recent', '1')

  const load = () => {
    fetch(`/api/file/drive?${qs.toString()}`, { cache: 'no-store' })
      .then(async r => {
        const j = await r.json()
        if (r.status === 401) { router.replace('/file/login'); return }
        if (!r.ok) throw new Error(j.message)
        setItems(j.data || []); setQuota(j.quota)
      })
      .catch(e => setErr(e.message))
  }
  useEffect(() => { load() }, [qs.toString()])

  const mkdir = async () => {
    const name = prompt('Nama folder')
    if (!name) return
    setBusy(true)
    await fetch('/api/file/drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parent_id: parent ? Number(parent) : null }) })
    setBusy(false); load()
  }
  const upload = async (f: File) => {
    const fd = new FormData(); fd.append('file', f)
    if (parent) fd.append('parent_id', parent)
    setBusy(true)
    const r = await fetch('/api/file/drive', { method: 'POST', body: fd })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(j.message || 'Upload gagal'); return }
    load()
  }
  const patch = async (id: number, body: any) => {
    await fetch(`/api/file/drive/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    load()
  }

  const title = trashed ? 'Sampah' : starred ? 'Berbintang' : recent ? 'Terbaru' : q ? `Hasil: ${q}` : 'Drive Saya'
  const folders = items.filter(i => i.kind === 'folder')
  const files = items.filter(i => i.kind !== 'folder')

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f) }}
      className="max-w-7xl mx-auto relative">
      {drag && (
        <div className="anim-pop fixed inset-0 z-50 bg-green-900/40 backdrop-blur-sm grid place-items-center pointer-events-none">
          <div className="rounded-3xl border-4 border-dashed border-green-600 bg-white/95 px-14 py-12 text-center shadow-2xl">
            <UploadCloud className="w-14 h-14 text-green-600 mx-auto animate-bounce" />
            <p className="mt-4 text-2xl font-black text-green-950">Lepaskan untuk mengunggah</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4 anim-fadeup">
        <div>
          {parent && (
            <button onClick={() => router.push('/file/drive')} className="mb-1 inline-flex items-center gap-1 text-xs font-extrabold text-slate-400 hover:text-green-700 transition-colors">
              Drive Saya <ChevronRight className="w-3 h-3" /> Folder
            </button>
          )}
          <h1 className="text-4xl font-black tracking-tight text-green-950">{title}</h1>
          {quota && <p className="text-xs text-slate-500 mt-1.5">{(quota.used_bytes / 1024 / 1024).toFixed(2)} MB terpakai dari {(quota.cap_bytes / 1024 ** 3).toFixed(0)} GB ({quota.percent}%)</p>}
        </div>
        <div className="flex gap-2.5">
          <button onClick={mkdir} disabled={busy} className="px-5 py-3 rounded-2xl card card-hover text-sm font-extrabold inline-flex items-center gap-2 text-green-900"><Plus className="w-4 h-4 text-green-600" /> Folder</button>
          <label className={`btn-primary px-5 py-3 rounded-2xl text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer ${busy ? 'opacity-60' : ''}`}>
            <UploadCloud className={`w-4 h-4 ${busy ? 'animate-bounce' : ''}`} /> {busy ? 'Mengunggah...' : 'Upload'}
            <input type="file" className="hidden" accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.kml,.kmz,.csv,.txt" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </div>
      </div>

      {err && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 w-fit">{err}</p>}

      {items.length === 0 ? (
        <div className="mt-10 flex flex-wrap gap-6 justify-center items-start anim-fadeup">
          <StickyNote variant="yellow" rotate={-2} className="w-64 rounded-lg py-8 px-5 text-center">
            <UploadCloud className="w-9 h-9 mx-auto opacity-70" />
            <p className="mt-3 text-base font-black">Kosong</p>
            <p className="text-[12px] font-semibold opacity-80 mt-1">Tarik &amp; lepas berkas ke area halaman ini.</p>
          </StickyNote>
          <StickyNote variant="green" rotate={1.5} className="w-64 rounded-lg py-8 px-5 text-center">
            <Plus className="w-9 h-9 mx-auto opacity-70" />
            <p className="mt-3 text-base font-black">Buat Folder</p>
            <p className="text-[12px] font-semibold opacity-80 mt-1">Rapikan berkas per blok / per laporan.</p>
          </StickyNote>
          <StickyNote variant="blue" rotate={-1} className="w-64 rounded-lg py-8 px-5 text-center">
            <FileText className="w-9 h-9 mx-auto opacity-70" />
            <p className="mt-3 text-base font-black">Dari Tugas?</p>
            <p className="text-[12px] font-semibold opacity-80 mt-1">Hasil tugas kerani otomatis masuk folder “Tugas” lengkap dengan jejak pengirim.</p>
          </StickyNote>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {folders.length > 0 && (
            <section>
              <p className="text-xs font-black tracking-widest text-green-700 uppercase mb-3">Folder</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {folders.map((it, i) => (
                  <button key={it.file_id} onClick={() => router.push(`/file/drive?parent=${it.file_id}`)}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className="anim-fadeup card card-hover rounded-3xl p-4 text-left group relative">
                    <div className="h-14 grid place-items-center">{iconFor(it)}</div>
                    <p className="text-sm font-extrabold truncate mt-2 group-hover:text-green-700 transition-colors">{it.name}</p>
                    <p className="text-[11px] text-slate-400">Folder</p>
                    {!trashed && (
                      <span onClick={(e) => { e.stopPropagation(); patch(it.file_id, { trashed: true }) }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-white border border-slate-200 hover:border-red-300 transition-opacity cursor-pointer" title="Ke sampah">
                        <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {files.length > 0 && (
            <section>
              <p className="text-xs font-black tracking-widest text-green-700 uppercase mb-3">Berkas</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {files.map((it, i) => (
                  <div key={it.file_id} style={{ animationDelay: `${Math.min(i, 9) * 40}ms` }}
                    className={`anim-fadeup ticket group relative transition-all hover:-translate-y-[2px] hover:shadow-[0_16px_36px_-18px_rgba(27,45,34,.35)]`}>
                    {it.source === 'task_submission' && (
                      <span className="absolute -top-2.5 left-5 z-10 px-2.5 py-0.5 rounded-full bg-green-700 text-[9px] font-black uppercase tracking-widest text-white shadow-sm">Dari Tugas</span>
                    )}
                    <button className="w-full text-left p-5"
                      onClick={() => it.kind === 'folder' ? router.push(`/file/drive?parent=${it.file_id}`) : setPreview({ url: `/api/file/drive/${it.file_id}/stream`, name: it.name, mime: it.mime_type })}>
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-xl bg-green-50 border border-green-100 grid place-items-center shrink-0">{iconFor(it)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold truncate text-green-950" title={it.name}>{it.name}</p>
                          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                            {(it.size_bytes / 1024).toFixed(1)} KB{it.sha256 ? ` · SHA ${String(it.sha256).slice(0, 10)}…` : ''}
                          </p>
                          <TraceBadges it={it} />
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 px-5 pb-4 -mt-1">
                      <button title="Pratinjau" onClick={() => setPreview({ url: `/api/file/drive/${it.file_id}/stream`, name: it.name, mime: it.mime_type })}
                        className="p-2 rounded-lg hover:bg-green-100 text-green-700 transition-colors"><Eye className="w-4 h-4" /></button>
                      <button title="Bintang" onClick={() => patch(it.file_id, { starred: !it.starred })}
                        className="p-2 rounded-lg hover:bg-amber-100 transition-colors"><Star className={`w-4 h-4 ${it.starred ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} /></button>
                      <button title={trashed ? 'Pulihkan' : 'Sampah'} onClick={() => patch(it.file_id, { trashed: !it.trashed })}
                        className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                        {trashed ? <RotateCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                      {it.source === 'task_submission' && it.source_assignment_id && (
                        <a href={`/file/tasks/${it.source_assignment_id}`} className="ml-auto text-[11px] font-extrabold text-green-700 hover:text-green-600 inline-flex items-center gap-1">
                          Buka tugas <ChevronRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      {preview && <PreviewModal target={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

export default function DrivePage() {
  return <Suspense fallback={<div className="max-w-7xl mx-auto card rounded-3xl p-12 text-center text-sm text-slate-500 animate-pulse">Memuat Drive...</div>}><DriveInner /></Suspense>
}
