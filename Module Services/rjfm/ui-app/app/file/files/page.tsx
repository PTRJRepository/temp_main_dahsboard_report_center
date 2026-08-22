'use client'

import { useEffect, useState } from 'react'
import { FileText, Download, Search, Filter, Eye } from 'lucide-react'
import PreviewModal, { type PreviewTarget } from '../PreviewModal'

export default function AllFilesPage() {
  const [rows, setRows] = useState<any[]>([])
  const [drive, setDrive] = useState<any[]>([])
  const [tab, setTab] = useState<'submissions' | 'drive'>('submissions')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<PreviewTarget | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/file/meta/admin/files', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/file/meta/admin/drive', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([f, d]) => {
      setRows(f.data || [])
      setDrive(d.data || [])
      setLoading(false)
    })
  }, [])

  const filtered = (tab === 'submissions' ? rows : drive).filter((x: any) => {
    if (!q.trim()) return true
    const s = q.toLowerCase()
    const name = x.file_original_name || x.name || ''
    const who = x.kerani_name || x.owner_name || ''
    return name.toLowerCase().includes(s) || who.toLowerCase().includes(s)
  })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold">Semua Berkas</h1>
          <p className="text-xs text-slate-500">Akses semua file dari semua kerani &amp; drive</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button onClick={() => setTab('submissions')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'submissions' ? 'bg-white shadow border border-slate-200 text-slate-900' : 'text-slate-600'}`}>Submission Tugas</button>
          <button onClick={() => setTab('drive')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'drive' ? 'bg-white shadow border border-slate-200 text-slate-900' : 'text-slate-600'}`}>Drive</button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama file / orang..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center"><Filter className="w-6 h-6 text-slate-400" /></div>
          <p className="mt-3 font-medium text-slate-900">Tidak ada berkas</p>
        </div>
      ) : tab === 'submissions' ? (
        <div className="space-y-2">
          {filtered.map((r: any) => (
            <div key={r.revision_id} className="rounded-xl bg-white border border-slate-200 p-4 flex items-center gap-3 hover:shadow-sm">
              <FileText className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.file_original_name}</p>
                <p className="text-xs text-slate-500">
                  {r.kerani_name || `User #${r.kerani_user_id}`} · {r.task_title || `Tugas #${r.task_id}`} · v{r.revision_number}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full border shrink-0 ${r.review_status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : r.review_status === 'REJECTED_NEEDS_REVISION' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{r.review_status}</span>
              <button onClick={() => setPreview({ url: `/api/file/files/${r.revision_id}/stream`, name: r.file_original_name, mime: r.file_mime_type })}
                className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-700" title="Pratinjau"><Eye className="w-4 h-4" /></button>
              <a href={`/api/file/files/${r.revision_id}/stream`} download={r.file_original_name} className="p-2 rounded-lg hover:bg-slate-100" title="Unduh"><Download className="w-4 h-4" /></a>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {filtered.map((it: any) => (
            <div key={it.file_id} className="group rounded-2xl bg-white border border-slate-200 p-3 hover:shadow-md relative">
              <button className="w-full text-left" onClick={() => it.kind !== 'folder' && setPreview({ url: `/api/file/drive/${it.file_id}/stream`, name: it.name, mime: it.mime_type })}>
                <div className="h-20 grid place-items-center">
                  {it.kind === 'folder' ? <span className="text-3xl">📁</span> : (it.mime_type || '').startsWith('image/') ? <span className="text-3xl">🖼️</span> : <FileText className="w-10 h-10 text-slate-400" />}
                </div>
                <p className="text-sm font-medium truncate mt-1">{it.name}</p>
                <p className="text-[11px] text-slate-500">{it.owner_name} · {it.kind === 'file' ? `${(it.size_bytes / 1024).toFixed(1)} KB` : 'Folder'}</p>
              </button>
              {it.kind !== 'folder' && (
                <a href={`/api/file/drive/${it.file_id}/stream`} download={it.name} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded bg-white border"><Download className="w-3.5 h-3.5" /></a>
              )}
            </div>
          ))}
        </div>
      )}
      {preview && <PreviewModal target={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
