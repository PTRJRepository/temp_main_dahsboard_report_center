'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Folder, FileText, Star, Trash2, UploadCloud, Plus, Image as ImgIcon, Eye, Film, Map as MapIcon, FileSpreadsheet } from 'lucide-react'
import PreviewModal, { type PreviewTarget } from '../PreviewModal'

// Leaflet (di PreviewModal) menyentuh `window` saat module load — halaman ini
// tidak boleh di-prerender saat build.
export const dynamic = 'force-dynamic'


function iconFor(it: any) {
  if (it.kind === 'folder') return <Folder className="w-10 h-10 text-amber-500" />
  if ((it.mime_type || '').startsWith('image/')) return <ImgIcon className="w-10 h-10 text-sky-500" />
  const ext = it.name?.toLowerCase().split('.').pop() || ''
  if (['mp4', 'webm', 'mov'].includes(ext)) return <Film className="w-10 h-10 text-purple-500" />
  if (['kml', 'kmz'].includes(ext)) return <MapIcon className="w-10 h-10 text-emerald-600" />
  if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet className="w-10 h-10 text-green-600" />
  return <FileText className="w-10 h-10 text-slate-400" />
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          {quota && <p className="text-xs text-slate-500">{(quota.used_bytes / 1024).toFixed(1)} KB terpakai dari {(quota.cap_bytes / 1024 / 1024 / 1024).toFixed(0)} GB</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={mkdir} disabled={busy} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Folder</button>
          <label className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm inline-flex items-center gap-1 cursor-pointer">
            <UploadCloud className="w-4 h-4" /> Upload
            <input type="file" className="hidden" accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.kml,.kmz,.csv,.txt" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </div>
      </div>
      {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">Kosong — buat folder atau upload berkas.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {items.map((it) => (
            <div key={it.file_id} className="group rounded-2xl bg-white border border-slate-200 p-3 hover:shadow-md relative">
              <button className="w-full text-left" onClick={() => it.kind === 'folder' ? router.push(`/file/drive?parent=${it.file_id}`) : setPreview({ url: `/api/file/drive/${it.file_id}/stream`, name: it.name, mime: it.mime_type })}>
                <div className="h-20 grid place-items-center">{iconFor(it)}</div>
                <p className="text-sm font-medium truncate mt-1">{it.name}</p>
                <p className="text-[11px] text-slate-500">{it.kind === 'folder' ? 'Folder' : `${(it.size_bytes / 1024).toFixed(1)} KB`}</p>
              </button>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1">
                {it.kind !== 'folder' && (
                  <button title="Pratinjau" onClick={() => setPreview({ url: `/api/file/drive/${it.file_id}/stream`, name: it.name, mime: it.mime_type })} className="p-1 rounded bg-white border"><Eye className="w-3.5 h-3.5 text-emerald-700" /></button>
                )}
                <button title="Bintang" onClick={() => patch(it.file_id, { starred: !it.starred })} className="p-1 rounded bg-white border"><Star className={`w-3.5 h-3.5 ${it.starred ? 'fill-amber-400 text-amber-400' : ''}`} /></button>
                <button title="Sampah" onClick={() => patch(it.file_id, { trashed: !it.trashed })} className="p-1 rounded bg-white border"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {preview && <PreviewModal target={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

export default function DrivePage() {
  return <Suspense fallback={<div className="p-8 text-sm text-slate-500">Memuat Drive...</div>}><DriveInner /></Suspense>
}
