'use client'

export type ExportPreflightKind = 'csv' | 'excel' | 'pdf'

export type ExportPreflightDialogProps = {
  open: boolean
  kind: ExportPreflightKind
  reportTitle: string
  ceiling: number
  loadedRows?: number
  onCancel: () => void
  onConfirm: () => void
}

const COPY: Record<ExportPreflightKind, { title: string; body: string; confirm: string }> = {
  csv: {
    title: 'Export CSV',
    body: 'CSV diunduh dari server dengan format=csv. Bukan sampel AI. Batas sistem mengikuti limitAll.',
    confirm: 'Unduh CSV',
  },
  excel: {
    title: 'Export Excel',
    body: 'Excel memuat baris di browser. Untuk data besar, proses bisa berat. Bukan laporan resmi PDF.',
    confirm: 'Lanjut Excel',
  },
  pdf: {
    title: 'PDF pratinjau',
    body: 'PDF pratinjau maks 34 baris × 7 kolom. Bukan laporan resmi penuh.',
    confirm: 'Buat pratinjau',
  },
}

export function ExportPreflightDialog({
  open,
  kind,
  reportTitle,
  ceiling,
  loadedRows,
  onCancel,
  onConfirm,
}: ExportPreflightDialogProps) {
  if (!open) return null
  const copy = COPY[kind]
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-lime-300/30 bg-[#071426] text-white shadow-[0_28px_80px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-200">Export honesty</p>
          <p className="mt-1 text-lg font-black">{copy.title}</p>
          <p className="mt-1 text-xs font-semibold text-white/55">{reportTitle}</p>
        </div>
        <div className="space-y-3 px-4 py-4 text-sm font-semibold text-white/75">
          <p>{copy.body}</p>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-white/45">Batas sistem</span>
              <span className="font-black text-lime-100">{ceiling.toLocaleString('id-ID')} baris</span>
            </div>
            {typeof loadedRows === 'number' && (
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-white/45">Baris termuat (preview)</span>
                <span className="font-black text-white">{loadedRows.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>
          {kind === 'pdf' && (
            <p className="rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-100">
              Filename: *-pratinjau.pdf · watermark pratinjau
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-white/70 hover:bg-white/10"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl border border-lime-300/40 bg-lime-400/15 px-3 py-2 text-xs font-black text-lime-50 hover:bg-lime-400/25"
          >
            {copy.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExportPreflightDialog
