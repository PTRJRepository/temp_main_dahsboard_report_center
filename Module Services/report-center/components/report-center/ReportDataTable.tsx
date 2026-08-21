'use client'

import { Fragment, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ReportTableRenderRow } from '@modules/report-center/lib/reports/report-detail-performance'
import ReportRowDetail from '@modules/report-center/components/report-center/ReportRowDetail'
import { renderReportCell } from '@modules/report-center/components/report-center/reportTableCells'

type DbRow = Record<string, unknown>

export type ReportDataTableProps = {
  tableExpanded: boolean
  tableContainerRef: RefObject<HTMLDivElement | null>
  visibleColumns: string[]
  tableRows: Array<ReportTableRenderRow<DbRow>>
  virtualRows: Array<{ index: number; start: number; end: number; size: number; key?: string | number | bigint }>
  virtualPaddingTop: number
  virtualPaddingBottom: number
  filteredRowsLength: number
  sortColumn?: string | null
  sortDirection?: 'asc' | 'desc' | null
  onSort: (column: string) => void
  displayColumnLabel: (column: string) => string
  displayColumnHelp: (column: string) => string
  formatValue: (value: unknown, field?: string) => string
  headerCellClass: (column: string) => string
  bodyCellClass: (column: string, columnIndex: number, subtotal?: boolean, selected?: boolean, zebraAlt?: boolean) => string
  cellContentClass: (column: string) => string
  stickyCellStyle: (column: string) => CSSProperties | undefined
  collapsedGroups: Record<string, boolean>
  expandedMovementRows: Record<string, boolean>
  onToggleGroup: (groupKey: string) => void
  onToggleMovementRow: (rowKey: string) => void
  onToggleReportRow: (event: { preventDefault: () => void; stopPropagation: () => void }, rowKey: string) => void
  activeTableGroupColumn?: string
  groupMetricTotal: (rows: DbRow[], keys: string[]) => number
  reportId: string
  rowDetailMode: 'generic' | 'movement'
  emptyLabel?: string
  footer?: ReactNode
}

export function ReportDataTable({
  tableExpanded,
  tableContainerRef,
  visibleColumns,
  tableRows,
  virtualRows,
  virtualPaddingTop,
  virtualPaddingBottom,
  filteredRowsLength,
  sortColumn,
  sortDirection,
  onSort,
  displayColumnLabel,
  displayColumnHelp,
  formatValue,
  headerCellClass,
  bodyCellClass,
  cellContentClass,
  stickyCellStyle,
  collapsedGroups,
  expandedMovementRows,
  onToggleGroup,
  onToggleMovementRow,
  onToggleReportRow,
  activeTableGroupColumn,
  groupMetricTotal,
  reportId,
  rowDetailMode,
  emptyLabel = 'Tidak ada report ditemukan. Coba ubah kata kunci atau filter.',
  footer,
}: ReportDataTableProps) {
  const renderTableRow = (rowModel: ReportTableRenderRow<DbRow>) => {
    if (rowModel.type === 'group-header') {
      const group = rowModel.group
      const collapsed = Boolean(collapsedGroups[group.key])
      const itemCurrent = groupMetricTotal(group.rows, ['ItemCurrent']) || group.rows.length
      const amountCurrent = groupMetricTotal(group.rows, ['AmountItem', 'AmountCurrent', 'TotalAmount', 'total_amount', 'NilaiStok'])
      const totalQuantity = groupMetricTotal(group.rows, ['total_quantity', 'quantity_on_hand', 'QuantityClosing', 'StockIssueMovementQty', 'TotalStok', 'Qty', 'qty'])
      const movementReport = reportId === 'all-stock-movement-analysis'
      const subtotalChips = group.subtotalColumns
        .filter((column) => !['ItemCurrent', 'AmountItem', 'AmountCurrent', 'TotalAmount', 'NilaiStok', 'NilaiPersediaan', 'Amount', 'QuantityClosing', 'StockIssueMovementQty', 'TotalStok', 'Qty'].includes(column))
        .slice(0, 2)

      return (
        <tr key={rowModel.key} className="bg-[var(--rc-surface)] text-slate-200">
          <td colSpan={Math.max(visibleColumns.length, 1)} className="border-y border-amber-400/20 px-2 py-1.5">
            <button
              type="button"
              onClick={() => onToggleGroup(group.key)}
              className="flex w-full min-w-0 items-center justify-between gap-2 text-left"
            >
              <span className="inline-flex min-w-0 items-center gap-1.5 font-black text-amber-100">
                {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span className="truncate text-xs">{displayColumnLabel(activeTableGroupColumn ?? '')}: {group.label}</span>
              </span>
              <span className="flex shrink-0 flex-nowrap gap-1 overflow-hidden">
                <span className="rounded border border-emerald-300/20 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">{movementReport ? 'Item' : 'Item'}: {formatValue(itemCurrent)}</span>
                <span className="rounded border border-amber-300/20 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-100">{movementReport ? 'Amt' : 'Amt'}: {formatValue(amountCurrent, 'AmountItem')}</span>
                <span className="rounded border border-slate-300/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">Qty: {formatValue(totalQuantity)}</span>
                {subtotalChips.map((column) => (
                  <span key={column} className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-slate-300 xl:inline">
                    {displayColumnLabel(column)}: {formatValue(group.totals[column], column)}
                  </span>
                ))}
              </span>
            </button>
          </td>
        </tr>
      )
    }

    if (rowModel.type === 'group-subtotal') {
      const group = rowModel.group
      return (
        <tr key={rowModel.key} className="rc-subtotal-row bg-[#13261c] text-amber-50 border-l-2 border-amber-400/70">
          {visibleColumns.map((column, columnIndex) => (
            <td
              key={column}
              className={bodyCellClass(column, columnIndex, true)}
              style={stickyCellStyle(column)}
            >
              {columnIndex === 0
                ? `Subtotal ${group.label}`
                : group.subtotalColumns.includes(column)
                  ? formatValue(group.totals[column], column)
                  : ''}
            </td>
          ))}
        </tr>
      )
    }

    if (rowModel.type === 'detail') {
      return (
        <ReportRowDetail
          key={rowModel.key}
          row={rowModel.row}
          columns={visibleColumns}
          colSpan={visibleColumns.length}
          mode={rowDetailMode}
          displayColumnLabel={displayColumnLabel}
        />
      )
    }

    const movementExpanded = Boolean(expandedMovementRows[rowModel.rowKey])
    const zebraAlt = rowModel.rowIndex % 2 !== 0
    return (
      <tr
        key={rowModel.key}
        className={`group cursor-pointer ${movementExpanded ? 'is-selected' : ''}`}
        onClick={() => onToggleMovementRow(rowModel.rowKey)}
      >
        {visibleColumns.map((column, columnIndex) => (
          <td
            key={column}
            className={bodyCellClass(column, columnIndex, false, movementExpanded, zebraAlt)}
            style={stickyCellStyle(column)}
          >
            {columnIndex === 0 ? (
              <button type="button" onClick={(event) => onToggleReportRow(event, rowModel.rowKey)} className="inline-flex max-w-full min-w-0 items-start gap-1 text-left leading-snug text-amber-100 hover:text-amber-300">
                {movementExpanded ? <ChevronDown size={13} className="mt-0.5 shrink-0" /> : <ChevronRight size={13} className="mt-0.5 shrink-0" />}
                <span className="min-w-0 whitespace-normal break-words line-clamp-2">{renderReportCell(column, rowModel.row[column], rowModel.row)}</span>
              </button>
            ) : (
              <span className={cellContentClass(column)}>
                {renderReportCell(column, rowModel.row[column], rowModel.row)}
              </span>
            )}
          </td>
        ))}
      </tr>
    )
  }

  return (
    <>
      <div className={`overflow-auto ${tableExpanded ? 'h-[calc(100vh-58px)] rounded-lg border border-amber-400/20 bg-[var(--rc-bg)]' : 'h-[76vh] min-h-[620px] max-h-[920px] bg-[var(--rc-bg)]'}`} ref={tableContainerRef}>
        <table className={`w-full table-fixed border-separate border-spacing-0 text-left ${tableExpanded ? 'text-[11px]' : 'text-[11px] sm:text-xs'}`}>
          <thead className={`sticky top-0 z-30 border-b border-amber-400/25 uppercase text-amber-100 ${tableExpanded ? 'text-[9px] tracking-[0.06em]' : 'text-[10px] tracking-[0.08em]'}`}>
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column}
                  className={headerCellClass(column)}
                  style={stickyCellStyle(column)}
                  title={displayColumnHelp(column)}
                >
                  <button
                    type="button"
                    onClick={() => onSort(column)}
                    aria-sort={sortColumn === column ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="w-full text-left text-[11px] font-bold leading-tight hover:text-amber-300 line-clamp-2"
                  >
                    {displayColumnLabel(column)}{sortColumn === column ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filteredRowsLength === 0 ? (
              <tr>
                <td colSpan={Math.max(visibleColumns.length, 1)} className="px-4 py-12 text-center text-slate-400">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              <Fragment>
                {virtualPaddingTop > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={Math.max(visibleColumns.length, 1)} style={{ height: virtualPaddingTop, padding: 0, border: 0 }} />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => {
                  const rowModel = tableRows[virtualRow.index]
                  return rowModel ? renderTableRow(rowModel) : null
                })}
                {virtualPaddingBottom > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={Math.max(visibleColumns.length, 1)} style={{ height: virtualPaddingBottom, padding: 0, border: 0 }} />
                  </tr>
                )}
              </Fragment>
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </>
  )
}

export default ReportDataTable
