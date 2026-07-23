'use client'

import type { ReactNode } from 'react'
import {
  Download,
  Expand,
  FileSpreadsheet,
  FileText,
  Loader2,
  Minimize2,
  Search,
} from 'lucide-react'

export type ReportTableToolbarProps = {
  tableExpanded: boolean
  tableSearch: string
  onTableSearchChange: (value: string) => void
  shownTableRows: number
  displayTableTotalRows: number
  safeTotalTableRows: number
  serverPaged: boolean
  tableWindowed: boolean
  tableStreaming: boolean
  tableStreamProgress?: { loaded?: number; total?: number } | null
  tableGroupMode: string
  onTableGroupModeChange: (value: string) => void
  autoGroupValue: string
  noGroupValue: string
  payloadColumns: string[]
  displayColumnLabel: (column: string) => string
  groupedTableActive: boolean
  onExpandGroups: () => void
  onCollapseGroups: () => void
  tableDensity: 'compact' | 'comfortable'
  onToggleDensity: () => void
  visibleColumns: string[]
  allColumns: string[]
  onToggleColumn: (column: string) => void
  page: number
  pageCount: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onExportExcel: () => void
  onExportPdf: () => void
  onExportCsv: () => void
  onJumpToAnalysis: (tab: 'sql' | 'ai' | 'charts' | 'quality') => void
  showSqlAudit: boolean
  onEnterFullTable: () => void
  onExitFullTable: () => void
  extraLeft?: ReactNode
}

function btnClass(expanded: boolean, kind: 'default' | 'success' | 'warning' | 'primary' = 'default') {
  if (expanded) {
    if (kind === 'success') return 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-700/30 bg-emerald-50 px-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100'
    return 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 hover:bg-slate-50'
  }
  if (kind === 'success') return 'inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20'
  if (kind === 'warning') return 'inline-flex h-11 items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 text-sm font-bold text-amber-300 hover:bg-amber-500/20'
  if (kind === 'primary') return 'inline-flex h-11 items-center gap-2 rounded-xl bg-[#167A3A] px-4 text-sm font-black text-white hover:bg-[#0f6a30]'
  return 'inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-[#0F2B1A] px-4 text-sm font-bold text-white/85 hover:bg-[#12351F] hover:text-white'
}

export function ReportTableToolbar({
  tableExpanded,
  tableSearch,
  onTableSearchChange,
  shownTableRows,
  displayTableTotalRows,
  safeTotalTableRows,
  serverPaged,
  tableWindowed,
  tableStreaming,
  tableStreamProgress,
  tableGroupMode,
  onTableGroupModeChange,
  autoGroupValue,
  noGroupValue,
  payloadColumns,
  displayColumnLabel,
  groupedTableActive,
  onExpandGroups,
  onCollapseGroups,
  tableDensity,
  onToggleDensity,
  visibleColumns,
  allColumns,
  onToggleColumn,
  page,
  pageCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onExportExcel,
  onExportPdf,
  onExportCsv,
  onJumpToAnalysis,
  showSqlAudit,
  onEnterFullTable,
  onExitFullTable,
  extraLeft,
}: ReportTableToolbarProps) {
  return (
    <div className={`sticky top-0 z-40 flex flex-wrap items-center justify-between border-b border-amber-400/20 bg-[#071426] ${tableExpanded ? 'mb-1 gap-1.5 px-2 py-1.5' : 'mb-0 gap-3 px-4 py-3'}`}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {tableExpanded && (
          <button
            type="button"
            onClick={onExitFullTable}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-900 px-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            <Minimize2 size={16} />
            Exit
          </button>
        )}
        <div className={`relative w-full ${tableExpanded ? 'max-w-xs' : 'max-w-md'}`}>
          <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${tableExpanded ? 'text-slate-400' : 'text-white/40'}`} />
          <input
            value={tableSearch}
            onChange={(event) => onTableSearchChange(event.target.value)}
            placeholder="Search dalam table..."
            className={tableExpanded
              ? 'h-8 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs font-semibold text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
              : 'h-11 w-full rounded-xl border border-white/20 bg-[#1A1A1A] pl-9 pr-3 text-sm font-medium text-white placeholder:text-white/40 outline-none focus:border-emerald-500 focus:bg-[#1A1A1A] focus:ring-4 focus:ring-emerald-500/20'}
          />
        </div>
        {tableExpanded && (
          <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600 md:inline-flex">
            {shownTableRows} / {displayTableTotalRows} row{serverPaged && tableWindowed ? ` dari ${safeTotalTableRows} total` : ''}
          </span>
        )}
        {(tableStreaming || tableStreamProgress) && (
          <span
            className={
              tableExpanded
                ? 'inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-900'
                : 'inline-flex items-center gap-1.5 rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-100'
            }
            title="Full-scope stream after first paint — KPI uses summary, not page window"
          >
            {tableStreaming ? <Loader2 size={14} className="animate-spin shrink-0" aria-hidden="true" /> : null}
            {tableStreaming
              ? `Streaming table ${tableStreamProgress?.loaded?.toLocaleString('id-ID') ?? '…'} / ${tableStreamProgress?.total?.toLocaleString('id-ID') ?? '…'}`
              : `Stream complete · ${(tableStreamProgress?.loaded ?? displayTableTotalRows).toLocaleString('id-ID')} rows`}
          </span>
        )}
        {extraLeft}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={tableGroupMode}
          onChange={(event) => onTableGroupModeChange(event.target.value)}
          className={tableExpanded
            ? 'h-8 max-w-[180px] rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
            : 'h-11 rounded-xl border border-white/20 bg-[#1A1A1A] px-3 text-sm font-semibold text-white outline-none hover:bg-[#252525] focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20'}
        >
          <option value={autoGroupValue}>Auto group</option>
          <option value={noGroupValue}>Tanpa group</option>
          {payloadColumns.map((column) => (
            <option key={column} value={column}>Group: {displayColumnLabel(column)}</option>
          ))}
        </select>

        {groupedTableActive && (
          <div className="flex rounded-xl border border-white/20 bg-[#1A1A1A] p-1">
            <button type="button" onClick={onExpandGroups} className="rounded-lg px-3 py-2 text-xs font-bold text-white/70 hover:bg-[#252525] hover:text-white">
              Expand
            </button>
            <button type="button" onClick={onCollapseGroups} className="rounded-lg px-3 py-2 text-xs font-bold text-white/70 hover:bg-[#252525] hover:text-white">
              Collapse
            </button>
          </div>
        )}

        <button type="button" onClick={onToggleDensity} className={btnClass(tableExpanded)}>
          {tableDensity === 'compact' ? 'Comfort' : 'Compact'}
        </button>

        <details className="relative">
          <summary className={tableExpanded
            ? 'h-8 cursor-pointer rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50'
            : 'h-11 cursor-pointer rounded-xl border border-white/15 bg-[#0F2B1A] px-4 py-2.5 text-sm font-semibold text-white/85 hover:bg-[#12351F] hover:text-white'}>
            Columns
          </summary>
          <div className="absolute right-0 z-20 mt-2 max-h-80 w-64 overflow-y-auto rounded-xl border border-white/20 bg-[#1A1A1A] p-3 text-white shadow-2xl">
            {allColumns.map((column) => (
              <label key={column} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/70 hover:bg-[#252525]">
                <input type="checkbox" checked={visibleColumns.includes(column)} onChange={() => onToggleColumn(column)} />
                <span className="truncate">{displayColumnLabel(column)}</span>
              </label>
            ))}
          </div>
        </details>

        {tableExpanded && !groupedTableActive && (
          <div className="flex h-8 overflow-hidden rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700">
            <button type="button" disabled={page === 1} onClick={() => onPageChange(Math.max(1, page - 1))} className="px-2 hover:bg-slate-50 disabled:opacity-30">Prev</button>
            <span className="border-x border-slate-200 px-2 py-1.5">{page}/{pageCount}</span>
            <button type="button" disabled={page === pageCount} onClick={() => onPageChange(Math.min(pageCount, page + 1))} className="px-2 hover:bg-slate-50 disabled:opacity-30">Next</button>
          </div>
        )}
        {tableExpanded && !groupedTableActive && (
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800"
          >
            {[100, 200, 500].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        )}

        <button type="button" onClick={onExportExcel} className={btnClass(tableExpanded, 'success')}>
          <FileSpreadsheet size={16} />
          Excel
        </button>
        <button type="button" onClick={onExportPdf} className={tableExpanded ? 'hidden' : btnClass(false, 'warning')} title="Pratinjau maks 34 baris × 7 kolom">
          <FileText size={16} />
          PDF pratinjau
        </button>
        <button type="button" onClick={onExportCsv} className={btnClass(tableExpanded)}>
          <Download size={16} />
          CSV
        </button>

        <details className={tableExpanded ? 'hidden' : 'relative'}>
          <summary className="inline-flex h-11 cursor-pointer list-none items-center rounded-xl border border-white/15 bg-[#0F2B1A] px-4 text-sm font-bold text-white/85 hover:bg-[#12351F] hover:text-white">
            Lainnya
          </summary>
          <div className="absolute right-0 z-30 mt-2 flex min-w-[200px] flex-col gap-1 rounded-xl border border-white/15 bg-[#0b1018] p-2 shadow-2xl">
            {showSqlAudit && (
              <button type="button" onClick={() => onJumpToAnalysis('sql')} className="rounded-lg px-3 py-2 text-left text-xs font-bold text-amber-100 hover:bg-white/10">
                SQL (audit)
              </button>
            )}
            <button type="button" onClick={() => onJumpToAnalysis('ai')} className="rounded-lg px-3 py-2 text-left text-xs font-bold text-emerald-200 hover:bg-white/10">
              AI Insight (sampel)
            </button>
            <button type="button" onClick={() => onJumpToAnalysis('charts')} className="rounded-lg px-3 py-2 text-left text-xs font-bold text-white/80 hover:bg-white/10">
              Charts
            </button>
            <button type="button" onClick={() => onJumpToAnalysis('quality')} className="rounded-lg px-3 py-2 text-left text-xs font-bold text-white/80 hover:bg-white/10">
              Quality
            </button>
            <button type="button" onClick={() => window.print()} className="rounded-lg px-3 py-2 text-left text-xs font-bold text-white/80 hover:bg-white/10">
              Print
            </button>
            <button type="button" onClick={() => navigator.clipboard.writeText(window.location.href)} className="rounded-lg px-3 py-2 text-left text-xs font-bold text-white/80 hover:bg-white/10">
              Salin tautan
            </button>
          </div>
        </details>

        <button type="button" onClick={onEnterFullTable} className={tableExpanded ? 'hidden' : btnClass(false, 'primary')}>
          <Expand size={16} />
          Layar penuh
        </button>
      </div>
    </div>
  )
}

export default ReportTableToolbar
