'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Search, X, FileText, ArrowRight, Star, StarOff } from 'lucide-react'
import { inventoryReports } from '@modules/report-center/lib/reports/inventory/config'
import { useReportStore } from '@modules/report-center/store/reportStore'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportEntry = typeof inventoryReports[number]
const REPORT_SOURCE_STORAGE_KEY = 'report-center:last-source'

function normalizeReportSource(value: string | null) {
  return value === 'pabrik' ? 'pabrik' : 'estate'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlobalSearch() {
  const router = useRouter()
  const { favorites, toggleFavorite } = useReportStore()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Filtered results ────────────────────────────────────────────────────────
  const results: ReportEntry[] = query.trim().length === 0
    ? inventoryReports.slice(0, 10)
    : inventoryReports.filter((r) => {
        const q = query.toLowerCase()
        return (
          r.title.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)) ||
          r.groupTitle.toLowerCase().includes(q)
        )
      }).slice(0, 12)

  // ── Ctrl+K shortcut ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setQuery('')
        setCursor(0)
      }
    }
    window.addEventListener('keydown', handler)
    const openFromTopbar = () => {
      setOpen(true)
      setQuery('')
      setCursor(0)
    }
    window.addEventListener('report-center-open-search', openFromTopbar)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('report-center-open-search', openFromTopbar)
    }
  }, [])

  // ── Focus input when opened ────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // ── Keyboard nav ───────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault()
      const item = results[cursor]
      if (item) navigateTo(item)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }, [results, cursor])

  const navigateTo = (report: ReportEntry) => {
    const source = normalizeReportSource(window.localStorage.getItem(REPORT_SOURCE_STORAGE_KEY))
    useReportStore.getState().addRecent(report.id)
    router.push(`/report-center/inventory?source=${source}&report=${report.id}`)
    setOpen(false)
    setQuery('')
  }

  const toggleFav = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    toggleFavorite(id)
  }

  const close = () => {
    setOpen(false)
    setQuery('')
    setCursor(0)
  }

  if (!open) return null

  return (
    /* ── Backdrop ── */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Cari laporan"
    >
      {/* ── Modal ── */}
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* ── Search input ── */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <Search size={18} className="flex-shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0) }}
            placeholder="Cari laporan, modul, atau kata kunci..."
            className="flex-1 bg-transparent text-slate-900 placeholder-slate-400 outline-none text-base"
            aria-label="Search reports"
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="flex-shrink-0 rounded-full p-0.5 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:flex select-none rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-400">
            ESC
          </kbd>
        </div>

        {/* ── Results ── */}
        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
              <Search size={32} strokeWidth={1.5} />
              <p className="text-sm">Tidak ada report ditemukan untuk &ldquo;{query}&rdquo;.</p>
              <p className="text-xs text-slate-300">Coba kata kunci lain.</p>
            </div>
          ) : (
            <ul role="listbox" aria-label="Search results">
              {results.map((report, idx) => {
                const isFav = favorites.includes(report.id)
                const isActive = idx === cursor
                return (
                  <li
                    key={report.id}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => navigateTo(report)}
                    onMouseEnter={() => setCursor(idx)}
                    className={`
                      group relative flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors
                      ${isActive ? 'bg-slate-50' : 'hover:bg-slate-50'}
                    `}
                  >
                    {/* Icon */}
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-green-100' : 'bg-slate-100'}`}>
                      <FileText size={16} className={isActive ? 'text-green-600' : 'text-slate-500'} strokeWidth={1.8} />
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-slate-400">{report.code}</span>
                        <span className="truncate text-sm font-medium text-slate-900">{report.title}</span>
                      </div>
                      <p className="truncate text-xs text-slate-400">{report.groupTitle}</p>
                    </div>

                    {/* Tags */}
                    <div className="hidden flex-shrink-0 gap-1 lg:flex">
                      {report.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Favorite toggle */}
                    <button
                      onClick={(e) => toggleFav(e, report.id)}
                      className={`flex-shrink-0 rounded p-1 transition-colors ${isFav ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
                      aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {isFav ? <Star size={14} fill="currentColor" /> : <StarOff size={14} />}
                    </button>

                    {/* Arrow */}
                    <ArrowRight size={14} className={`flex-shrink-0 transition-opacity ${isActive ? 'text-green-600 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* ── Footer hint ── */}
        <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px]">↵</kbd>
            buka
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px]">ESC</kbd>
            tutup
          </span>
        </div>
      </div>
    </div>
  )
}
