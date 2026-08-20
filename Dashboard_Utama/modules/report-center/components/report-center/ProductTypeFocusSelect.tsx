'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Filter, X } from 'lucide-react'

type Option = { code: string; name: string }

/**
 * Multi-select fokus product type (client-side).
 * - Tanpa pilihan → semua type tampil.
 * - Dengan pilihan → hanya type terpilih yang tampil di list panel.
 * Seragam dengan gaya report-center (forest accent) dan dipakai di atas
 * `ProductTypeAnalysisPanel`; tidak mengubah data fetch, hanya filter tampilan.
 */
export default function ProductTypeFocusSelect({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDocDown = (event: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selectedSet = new Set(selected)
  const toggle = (code: string) => {
    if (selectedSet.has(code)) onChange(selected.filter((c) => c !== code))
    else onChange([...selected, code])
  }

  const label =
    selected.length === 0
      ? 'Semua product type'
      : selected.length === 1
        ? (options.find((o) => o.code === selected[0])?.name ?? selected[0])
        : `${selected.length} type dipilih`

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="rc-forest-focus inline-flex max-w-[260px] items-center gap-2 rounded-full border-[var(--rc-forest-border)] bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-[var(--rc-text-muted)] transition hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Filter size={13} className="shrink-0 text-[var(--rc-forest-accent)]" />
        <span className="truncate">{label}</span>
        {selected.length > 0 && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Reset fokus product type"
            onClick={(e) => {
              e.stopPropagation()
              onChange([])
            }}
            className="shrink-0 rounded-full p-0.5 text-[var(--rc-text-faint)] transition hover:bg-white/10 hover:text-[var(--rc-text)]"
          >
            <X size={12} />
          </span>
        )}
        <ChevronDown size={13} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-2xl border-[var(--rc-forest-border)] bg-[rgba(4,14,9,.97)] shadow-[0_18px_50px_rgba(0,0,0,.55)] backdrop-blur"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--rc-forest-border)] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">
              Fokus product type
            </p>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] font-semibold text-[var(--rc-forest-accent)] transition hover:text-[var(--rc-text)]"
              >
                Reset
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {options.length === 0 ? (
              <p className="px-2 py-4 text-center text-[11px] text-[var(--rc-text-faint)]">
                Belum ada product type dimuat.
              </p>
            ) : (
              options.map((opt) => {
                const active = selectedSet.has(opt.code)
                return (
                  <button
                    key={opt.code}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => toggle(opt.code)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12px] transition ${
                      active
                        ? 'bg-[rgba(74,222,128,.12)] text-[var(--rc-text)]'
                        : 'text-[var(--rc-text-muted)] hover:bg-white/[0.06] hover:text-[var(--rc-text)]'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition ${
                        active
                          ? 'border-[var(--rc-forest-accent)] bg-[var(--rc-forest-accent)] text-[#04120a]'
                          : 'border-[var(--rc-forest-border)] bg-transparent text-transparent'
                      }`}
                    >
                      <Check size={11} strokeWidth={3.5} />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{opt.name}</span>
                    <span className="shrink-0 text-[10px] text-[var(--rc-text-faint)]">{opt.code}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
