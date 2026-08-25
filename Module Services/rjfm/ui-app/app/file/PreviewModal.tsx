'use client'

// Preview universal untuk submission & drive:
// PDF (iframe), foto, video, Excel/CSV (tabel), Word sederhana (HTML), KML/KMZ (peta Leaflet), teks.
import { useEffect, useRef, useState } from 'react'
import { X, Download, Loader2, MapPin, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import { DOMParser } from '@xmldom/xmldom'
import { kml as kmlToGeoJSON } from '@tmcw/togeojson'
import type * as LeafletNS from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ponytail: leaflet menyentuh `window`/`document` saat import (SSR build crash) —
// load lazy di client effect. Upgrade path: ganti ke react-leaflet yang SSR-safe.
let L: typeof LeafletNS | null = null
async function loadLeaflet() {
  if (!L) L = (await import('leaflet')).default
  return L
}

export type PreviewTarget = {
  url: string          // stream URL (sudah dengan auth cookie proxy)
  name: string
  mime?: string | null
}

type Kind = 'pdf' | 'image' | 'video' | 'sheet' | 'doc' | 'kml' | 'text' | 'unknown'

function kindOf(name: string, mime?: string | null): Kind {
  const ext = name.toLowerCase().split('.').pop() || ''
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) || mime?.startsWith('image/')) return 'image'
  if (['mp4', 'webm', 'mov'].includes(ext) || mime?.startsWith('video/')) return 'video'
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'sheet'
  if (['docx', 'doc'].includes(ext)) return 'doc'
  if (['kml', 'kmz'].includes(ext)) return 'kml'
  if (['txt', 'log'].includes(ext) || mime?.startsWith('text/')) return 'text'
  return 'unknown'
}

async function readKmz(buf: ArrayBuffer): Promise<string> {
  // ponytail: KMZ (zip berisi doc.kml) — butuh unzip lib; minta user ekstrak dulu.
  void buf
  throw new Error('KMZ belum didukung — ekstrak ke KML.')
}

export default function PreviewModal({ target, onClose }: { target: PreviewTarget; onClose: () => void }) {
  const kind = kindOf(target.name, target.mime)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [html, setHtml] = useState<string>('')       // doc / text
  const [rows, setRows] = useState<{ head: string[]; body: string[][]; sheetNames: string[]; active: number }>({ head: [], body: [], sheetNames: [], active: 0 })
  const [geo, setGeo] = useState<any>(null)
  const mapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    ;(async () => {
      try {
        if (kind === 'pdf' || kind === 'image' || kind === 'video') {
          // validasi dulu bahwa URL merespons 200 — jika file fisik hilang,
          // tampilkan pesan jelas alih-alih iframe/gambar rusak
          const head = await fetch(target.url, { method: 'HEAD' }).catch(() => null)
          if (head && !head.ok) throw new Error(head.status === 403 ? 'Akses ditolak ke berkas ini.' : `Berkas tidak dapat dibuka (${head.status}). File fisik mungkin terhapus atau belum tersinkron di NAS.`)
          setLoading(false); return
        }
        const r = await fetch(target.url)
        if (!r.ok) throw new Error(r.status === 403 ? 'Akses ditolak ke berkas ini.' : `Berkas tidak dapat dibuka (${r.status}). File fisik mungkin terhapus atau belum tersinkron di NAS.`)
        if (kind === 'sheet') {
          const buf = await r.arrayBuffer()
          const wb = XLSX.read(buf, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const json = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })
          const head = (json[0] || []).map(String)
          const body = json.slice(1, 100).map((row: any[]) => (row || []).slice(0, 30).map(c => String(c)))
          if (alive) setRows({ head, body, sheetNames: wb.SheetNames, active: 0 })
        } else if (kind === 'doc') {
          const buf = await r.arrayBuffer()
          if (target.name.toLowerCase().endsWith('.doc')) {
            throw new Error('Format Word lama (.doc) tidak didukung pratinjau — unduh dan buka dengan Microsoft Word.')
          }
          const res = await mammoth.convertToHtml({ arrayBuffer: buf })
          if (alive) setHtml(res.value)
        } else if (kind === 'kml') {
          if (target.name.toLowerCase().endsWith('.kmz')) await readKmz(await r.arrayBuffer())
          const text = await r.text()
          const dom = new DOMParser().parseFromString(text, 'text/xml')
          const gj = kmlToGeoJSON(dom as Document)
          if (!gj.features.length) throw new Error('Tidak ada geometri di KML ini.')
          if (alive) setGeo(gj)
        } else if (kind === 'text') {
          const text = await r.text()
          if (alive) setHtml(`<pre class="whitespace-pre-wrap">${text.replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;')}</pre>`)
        }
      } catch (e: any) {
        if (alive) setErr(e.message || 'Gagal memuat preview')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [target.url, kind])

  // Peta KML
  useEffect(() => {
    if (!geo || !mapRef.current) return
    let map: LeafletNS.Map | null = null
    let cancelled = false
    ;(async () => {
      const leaflet = await loadLeaflet()
      if (cancelled || !mapRef.current) return
      map = leaflet.map(mapRef.current, { scrollWheelZoom: true })
      leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map)
      const layer = leaflet.geoJSON(geo as any, {
        style: () => ({ color: '#059669', weight: 2.5, fillOpacity: 0.15 }),
        pointToLayer: (_f, latlng) => leaflet.circleMarker(latlng, { radius: 7, color: '#047857', fillColor: '#34d399', fillOpacity: 0.9 }),
        onEachFeature: (f, lyr) => {
          const name = (f.properties && (f.properties.name || f.properties.Name)) || ''
          const desc = (f.properties && (f.properties.description || f.properties.Description)) || ''
          if (name || desc) lyr.bindPopup(`<b>${String(name)}</b>${desc ? `<br/>${String(desc).slice(0, 300)}` : ''}`)
        },
      }).addTo(map)
      map.fitBounds(layer.getBounds(), { padding: [24, 24] })
    })()
    return () => { cancelled = true; map?.remove() }
  }, [geo])

  const dl = (
    <a href={target.url} download={target.name} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-black">
      <Download className="w-4 h-4" /> Unduh
    </a>
  )

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900 truncate">{target.name}</p>
            <p className="text-xs text-slate-500">{target.mime || kind.toUpperCase()}</p>
          </div>
          {dl}
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50 min-h-[320px]">
          {loading ? (
            <div className="h-full grid place-items-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : err ? (
            <div className="p-8">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2 max-w-lg mx-auto">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {err}
              </div>
            </div>
          ) : kind === 'pdf' ? (
            <iframe src={target.url} title={target.name} className="w-full h-[78vh]" />
          ) : kind === 'image' ? (
            <div className="grid place-items-center p-6"><img src={target.url} alt={target.name} className="max-w-full max-h-[75vh] rounded-xl shadow" /></div>
          ) : kind === 'video' ? (
            <div className="grid place-items-center p-6"><video src={target.url} controls className="max-w-full max-h-[75vh] rounded-xl shadow bg-black" /></div>
          ) : kind === 'kml' ? (
            <div ref={mapRef} className="w-full h-[70vh]" />
          ) : kind === 'sheet' ? (
            <div className="p-4">
              {rows.sheetNames.length > 1 && (
                <div className="flex gap-1 mb-3 overflow-auto">
                  {rows.sheetNames.map((sn, i) => (
                    <span key={sn} className={`px-2.5 py-1 rounded-lg text-xs border ${i === rows.active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}>{sn}</span>
                  ))}
                </div>
              )}
              <div className="overflow-auto rounded-xl border border-slate-200 bg-white max-h-[65vh]">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>{rows.head.map((h, i) => <th key={i} className="border-b border-slate-200 px-2.5 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.body.map((row, ri) => (
                      <tr key={ri} className="odd:bg-white even:bg-slate-50">
                        {row.map((c, ci) => <td key={ci} className="px-2.5 py-1.5 border-b border-slate-100 whitespace-nowrap max-w-[240px] truncate">{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">Pratinjau 100 baris pertama sheet &quot;{rows.sheetNames[rows.active]}&quot;. Unduh untuk lihat lengkap.</p>
            </div>
          ) : kind === 'doc' || kind === 'text' ? (
            <div className="p-6 sm:p-10">
              <div className="max-w-3xl mx-auto prose prose-sm prose-slate bg-white border border-slate-200 rounded-2xl p-8 shadow-sm [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1"
                dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-600 mb-4">Format ini tidak punya pratinjau.</p>
              {dl}
            </div>
          )}
        </div>

        {kind === 'kml' && !loading && !err && (
          <div className="px-5 py-2.5 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-1.5 shrink-0">
            <MapPin className="w-3.5 h-3.5" /> Peta: OpenStreetMap — klik fitur untuk nama/keterangan dari KML.
          </div>
        )}
      </div>
    </div>
  )
}
