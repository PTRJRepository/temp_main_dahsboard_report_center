'use client'

import { useEffect, useState } from 'react'
import { FileText, FileSpreadsheet, Image as ImageIcon, Film, Download, Search, Eye, Files, FolderTree, UserRound, Clock3, StickyNote } from 'lucide-react'
import PreviewModal, { type PreviewTarget } from '../PreviewModal'

const REV_CLS: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED_NEEDS_REVISION: 'bg-red-100 text-red-700 border-red-200',
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
}
function relTime(iso?: string | null) {
  if (!iso) return '-'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} mnt lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  return `${Math.floor(h / 24)} hari lalu`
}

function FileIcon({ mime, name, big }: { mime?: string | null; name?: string; big?: boolean }) {
  const ext = (name || '').toLowerCase().split('.').pop() || ''
  const cls = big ? 'w-9 h-9' : 'w-5 h-5'
  if ((mime || '').startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <ImageIcon className={`${cls} text-sky-500`} />
  if (['mp4', 'webm'].includes(ext)) return <Film className={`${cls} text-violet-500`} />
  if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet className={`${cls} text-lime-600`} />
  if (ext === 'pdf') return <FileText className={`${cls} text-red-500`} />
  return <FileText className={`${cls} text-slate-400`} />
}

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
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 anim-fadeup">
        <div>
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3 text-green-950"><Files className="w-8 h-8 text-green-600" /> Semua Berkas</h1>
          <p className="text-sm text-slate-500 mt-1.5">Audit seluruh berkas — siapa mengirim, kapan, catatannya apa.</p>
        </div>
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama file / orang..."
            className="input-field w-full pl-11 pr-4 py-3 rounded-2xl text-sm" />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 p-1.5 card rounded-2xl w-fit anim-fadeup d-1">
        {([['submissions', `Submission (${rows.length})`], ['drive', `Drive (${drive.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${tab === k ? 'chip-on' : 'text-slate-500 hover:text-green-900 hover:bg-green-50'}`}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 card rounded-3xl p-12 text-center text-sm text-slate-500 animate-pulse">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 card rounded-3xl border-dashed p-14 text-center anim-fadeup">
          <Search className="w-9 h-9 text-slate-300 mx-auto" />
          <p className="mt-3 font-bold text-lg">Tidak ada berkas</p>
          <p className="text-sm text-slate-500">Coba kata kunci lain atau ganti tab.</p>
        </div>
      ) : tab === 'submissions' ? (
        <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((r: any, i: number) => (
            <div key={r.revision_id} style={{ animationDelay: `${Math.min(i, 9) * 40}ms` }}
              className="anim-fadeup card card-hover rounded-3xl p-5 flex items-start gap-4 group">
              <div className="w-12 h-12 rounded-2xl bg-green-50 grid place-items-center shrink-0"><FileIcon mime={r.file_mime_type} name={r.file_original_name} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-extrabold truncate group-hover:text-green-700 transition-colors" title={r.file_original_name}>{r.file_original_name}</p>
                  <span className={`shrink-0 text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${REV_CLS[r.review_status]}`}>{r.review_status}</span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{r.task_title || `Tugas #${r.task_id}`} · v{r.revision_number}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold">
                  <span className="inline-flex items-center gap-1 text-green-900"><UserRound className="w-3 h-3 text-sky-600" /> {r.kerani_name || `User #${r.kerani_user_id}`}</span>
                  <span className="inline-flex items-center gap-1 text-slate-500"><Clock3 className="w-3 h-3 text-green-600" /> {relTime(r.submitted_at)}</span>
                  <span className="text-slate-400">{(r.file_size_bytes / 1024).toFixed(1)} KB · SHA {String(r.file_hash_sha256 || '').slice(0, 8)}…</span>
                </div>
                {r.notes_from_kerani && (
                  <p className="text-[11px] text-slate-700 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5 mt-2 line-clamp-2 flex gap-1.5" title={r.notes_from_kerani}>
                    <StickyNote className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" /> {r.notes_from_kerani}
                  </p>
                )}
                {r.manager_feedback && (
                  <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-2.5 py-1.5 mt-1.5 line-clamp-2" title={r.manager_feedback}>
                    Instruksi atasan: “{r.manager_feedback}”
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => setPreview({ url: `/api/file/files/${r.revision_id}/stream`, name: r.file_original_name, mime: r.file_mime_type })}
                  className="p-2.5 rounded-xl hover:bg-green-100 text-green-700 transition-colors" title="Pratinjau"><Eye className="w-4 h-4" /></button>
                <a href={`/api/file/files/${r.revision_id}/stream`} download={r.file_original_name}
                  className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors" title="Unduh"><Download className="w-4 h-4" /></a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {filtered.map((it: any, i: number) => (
            <div key={it.file_id} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
              className="anim-fadeup card card-hover rounded-3xl p-4 relative group">
              <button className="w-full text-left" onClick={() => it.kind !== 'folder' && setPreview({ url: `/api/file/drive/${it.file_id}/stream`, name: it.name, mime: it.mime_type })}>
                <div className="h-16 grid place-items-center">
                  {it.kind === 'folder' ? <FolderTree className="w-9 h-9 text-amber-500" /> : <FileIcon mime={it.mime_type} name={it.name} big />}
                </div>
                <p className="text-sm font-extrabold truncate mt-2 group-hover:text-green-700 transition-colors">{it.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 inline-flex items-center gap-1"><UserRound className="w-3 h-3" /> {it.owner_name}{it.kind === 'file' ? ` · ${(it.size_bytes / 1024).toFixed(1)} KB` : ''}</p>
              </button>
              {it.kind !== 'folder' && (
                <a href={`/api/file/drive/${it.file_id}/stream`} download={it.name}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-white border border-slate-200 transition-opacity"><Download className="w-3.5 h-3.5 text-slate-500" /></a>
              )}
            </div>
          ))}
        </div>
      )}
      {preview && <PreviewModal target={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
