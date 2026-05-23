/**
 * DataTable.tsx
 * Full-featured data table with sticky header, search, sort, pagination, column visibility, and row selection.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ColumnDef<T = Record<string, unknown>> {
  /** Unique column key */
  key: string;
  /** Display label (header) */
  label: string;
  /** Field path or render function */
  render?: (row: T, index: number) => React.ReactNode;
  /** Align content */
  align?: 'left' | 'center' | 'right';
  /** Minimum column width (px) */
  minWidth?: number;
  /** Can this column be hidden */
  hideable?: boolean;
  /** Can this column be sorted */
  sortable?: boolean;
  /** Fixed column width */
  width?: number;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface DataTableState<T = Record<string, unknown>> {
  /** Current page (1-based) */
  page: number;
  /** Rows per page */
  pageSize: number;
  /** Client-side search query */
  search: string;
  /** Column sort state */
  sortKey: string | null;
  sortDirection: SortDirection;
  /** Selected row keys */
  selectedKeys: Set<string>;
  /** Visible column keys */
  visibleColumns: Set<string>;
}

export interface DataTableProps<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Row data */
  data: T[];
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Unique row key extractor */
  rowKey?: keyof T | ((row: T) => string);
  /** Loading skeleton state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Error state */
  error?: string;
  /** Row selection enabled */
  selectable?: boolean;
  /** Called when sort changes */
  onSort?: (key: string, direction: SortDirection) => void;
  /** Called when page changes */
  onPageChange?: (page: number, pageSize: number) => void;
  /** Called when export is triggered */
  onExport?: (format: 'csv' | 'xlsx' | 'pdf') => void;
  /** Called when selected rows change */
  onSelectionChange?: (keys: Set<string>, rows: T[]) => void;
  /** Caption for accessibility */
  caption?: string;
  /** CSS class for container */
  className?: string;
  /** Initial sort key */
  defaultSortKey?: string;
  /** Initial sort direction */
  defaultSortDir?: SortDirection;
  /** Zebra row striping */
  striped?: boolean;
  /** Compact row height */
  compact?: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`animate-spin ${className ?? ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const SortAscIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
  </svg>
);

const SortDescIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l-4 4" />
  </svg>
);

const SortNeutralIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
  </svg>
);

const ChevronLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const ChevronsLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
);

const ChevronsRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ColumnsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const WarningIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

// ─── Skeleton rows ────────────────────────────────────────────────────────────

const SkeletonRows: React.FC<{ rows: number; cols: number; compact?: boolean }> = ({ rows, cols, compact }) => (
  <>
    {Array.from({ length: rows }).map((_, ri) => (
      <tr key={ri} className="border-b border-slate-100">
        {Array.from({ length: cols }).map((_, ci) => (
          <td key={ci} className={`px-4 ${compact ? 'py-2' : 'py-3'}`}>
            <div className={`animate-pulse bg-slate-200 rounded h-4 ${ci === 0 ? 'w-3/4' : ci === cols - 1 ? 'w-1/2' : 'w-full'}`}
              aria-hidden="true" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

// ─── Column Visibility Dropdown ──────────────────────────────────────────────

interface ColumnVisibilityProps {
  columns: ColumnDef<Record<string, unknown>>[];
  visibleColumns: Set<string>;
  onToggle: (key: string) => void;
}

const ColumnVisibilityDropdown: React.FC<ColumnVisibilityProps> = ({
  columns, visibleColumns, onToggle,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle column visibility"
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg
          bg-white border border-slate-200 text-slate-600 hover:bg-slate-50
          focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600
          transition-colors duration-150"
      >
        <ColumnsIcon className="h-4 w-4" />
        Kolom
        <ChevronRightIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Column visibility options"
          className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1"
        >
          {columns.map((col) => {
            const isVisible = visibleColumns.has(col.key);
            const isLastVisible = visibleColumns.size === 1 && isVisible;
            return (
              <button
                key={col.key}
                type="button"
                role="menuitem"
                onClick={() => !isLastVisible && onToggle(col.key)}
                disabled={isLastVisible}
                aria-checked={isVisible}
                aria-label={`${col.label} column — ${isVisible ? 'visible' : 'hidden'}`}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left
                  ${isLastVisible ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'}
                  focus:outline-none focus-visible:bg-slate-50`}
              >
                <span className={`flex-shrink-0 h-4 w-4 rounded border flex items-center justify-center
                  ${isVisible ? 'bg-green-600 border-green-600' : 'border-slate-300'}`}>
                  {isVisible && <CheckIcon className="h-2.5 w-2.5 text-white" />}
                </span>
                {col.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ page, pageSize, total, onPageChange, onPageSizeChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = Math.min((page - 1) * pageSize + 1, total);
  const end = Math.min(page * pageSize, total);

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  const sizeOptions = [10, 25, 50, 100];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-slate-100"
      aria-label={`Pagination, halaman ${page} dari ${totalPages}`}>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Menampilkan</span>
        <select
          value={pageSize}
          onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
          aria-label="Rows per page"
          className="px-2 py-1 border border-slate-200 rounded-lg text-slate-700 bg-white
            focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
        >
          {sizeOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span>dari {total.toLocaleString('id-ID')} data</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          aria-label="First page"
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed
            focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
        >
          <ChevronsLeftIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed
            focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 py-1 text-slate-400">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p as number)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
              className={`min-w-[2.25rem] h-8 px-2 rounded-lg text-sm font-medium transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600
                ${p === page
                  ? 'bg-green-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed
            focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          aria-label="Last page"
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed
            focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
        >
          <ChevronsRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * DataTable — production-ready data table.
 *
 * @example
 * <DataTable
 *   data={rows}
 *   columns={columns}
 *   rowKey="id"
 *   onSort={(key, dir) => fetchSorted(key, dir)}
 *   onPageChange={(page, size) => fetchPage(page, size)}
 * />
 */
export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  rowKey = 'id' as keyof T,
  loading = false,
  emptyMessage = 'Tidak ada data untuk ditampilkan',
  error,
  selectable = false,
  onSort,
  onPageChange,
  onExport,
  onSelectionChange,
  caption,
  className = '',
  defaultSortKey,
  defaultSortDir = 'asc',
  striped = true,
  compact = false,
}: DataTableProps<T>) {
  // State
  const [state, setState] = useState<DataTableState<T>>({
    page: 1,
    pageSize: 25,
    search: '',
    sortKey: defaultSortKey ?? null,
    sortDirection: defaultSortDir,
    selectedKeys: new Set<string>(),
    visibleColumns: new Set(columns.filter((c) => c.hideable !== false).map((c) => c.key)),
  });

  // Resets on data change
  const dataLengthRef = useRef(data.length);
  useEffect(() => {
    if (data.length !== dataLengthRef.current) {
      dataLengthRef.current = data.length;
      setState((s) => ({ ...s, page: 1 }));
    }
  }, [data.length]);

  // Helpers
  const getKey = useCallback(
    (row: T, index: number): string => {
      if (typeof rowKey === 'function') return rowKey(row);
      return String(row[rowKey] ?? `row-${index}`);
    },
    [rowKey]
  );

  const getValue = useCallback(
    (row: T, col: ColumnDef<T>, rowIndex: number): React.ReactNode => {
      if (col.render) return col.render(row, rowIndex);
      return String((row as Record<string, unknown>)[col.key] ?? '');
    },
    []
  );

  // Filtered + sorted data
  const processed = useMemo(() => {
    let result = [...data];

    // Client-side search
    if (state.search.trim()) {
      const q = state.search.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => {
          const val = getValue(row, col, 0);
          return String(val).toLowerCase().includes(q);
        })
      );
    }

    // Sort
    if (state.sortKey && state.sortDirection) {
      const col = columns.find((c) => c.key === state.sortKey);
      if (col) {
        result.sort((a, b) => {
          const va = getValue(a, col, 0);
          const vb = getValue(b, col, 0);
          const cmp = String(va).localeCompare(String(vb), 'id-ID', { numeric: true });
          return state.sortDirection === 'asc' ? cmp : -cmp;
        });
      }
    }

    return result;
  }, [data, state.search, state.sortKey, state.sortDirection, columns, getValue]);

  // Paginated
  const pageData = useMemo(() => {
    const start = (state.page - 1) * state.pageSize;
    return processed.slice(start, start + state.pageSize);
  }, [processed, state.page, state.pageSize]);

  // Visible columns (respect column visibility)
  const visibleCols = useMemo(
    () => columns.filter((c) => state.visibleColumns.has(c.key) || !c.hideable),
    [columns, state.visibleColumns]
  );

  // Handlers
  const handleSort = useCallback(
    (key: string) => {
      const col = columns.find((c) => c.key === key);
      if (!col?.sortable) return;
      const nextDir: SortDirection =
        state.sortKey === key ? (state.sortDirection === 'asc' ? 'desc' : state.sortDirection === 'desc' ? null : 'asc') : 'asc';
      setState((s) => ({ ...s, sortKey: nextDir ? key : null, sortDirection: nextDir, page: 1 }));
      onSort?.(key, nextDir);
    },
    [columns, state.sortKey, state.sortDirection, onSort]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setState((s) => ({ ...s, page }));
      onPageChange?.(page, state.pageSize);
    },
    [state.pageSize, onPageChange]
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      setState((s) => ({ ...s, pageSize, page: 1 }));
    },
    []
  );

  const handleSearch = useCallback(
    (search: string) => setState((s) => ({ ...s, search, page: 1 })),
    []
  );

  const handleToggleColumn = useCallback(
    (key: string) =>
      setState((s) => {
        const next = new Set(s.visibleColumns);
        if (next.has(key)) { next.delete(key); } else { next.add(key); }
        return { ...s, visibleColumns: next };
      }),
    []
  );

  const handleSelectAll = useCallback(() => {
    const allKeys = new Set(pageData.map((row, i) => getKey(row, i)));
    const next = state.selectedKeys.size === allKeys.size
      ? new Set<string>()
      : new Set(state.selectedKeys);
    if (state.selectedKeys.size !== allKeys.size) allKeys.forEach((k) => next.add(k));
    setState((s) => ({ ...s, selectedKeys: next }));
    onSelectionChange?.(next, data.filter((r, i) => next.has(getKey(r, i))));
  }, [pageData, state.selectedKeys, getKey, data, onSelectionChange]);

  const handleSelectRow = useCallback(
    (key: string, row: T) => {
      const next = new Set(state.selectedKeys);
      if (next.has(key)) next.delete(key); else next.add(key);
      setState((s) => ({ ...s, selectedKeys: next }));
      onSelectionChange?.(next, data.filter((r, i) => next.has(getKey(r, i))));
    },
    [state.selectedKeys, getKey, data, onSelectionChange]
  );

  const alignClass = (align?: string) => {
    if (align === 'right') return 'text-right';
    if (align === 'center') return 'text-center';
    return 'text-left';
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-80">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={state.search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Cari data…"
            aria-label="Search table data"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg
              bg-white placeholder-slate-400
              focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus:border-green-400
              transition-colors duration-150"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Export dropdown */}
          {onExport && (
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => {
                  const menu = document.getElementById('export-menu');
                  menu?.classList.toggle('hidden');
                }}
                aria-haspopup="true"
                aria-label="Export data"
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg
                  bg-green-700 hover:bg-green-800 text-white
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400
                  transition-colors duration-150"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
              <div
                id="export-menu"
                role="menu"
                aria-label="Export format options"
                className="hidden absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1"
              >
                {(['csv', 'xlsx', 'pdf'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    role="menuitem"
                    onClick={() => { onExport(fmt); document.getElementById('export-menu')?.classList.add('hidden'); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50
                      focus:outline-none focus-visible:bg-slate-50"
                  >
                    Export as {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Column visibility */}
          <ColumnVisibilityDropdown
            columns={columns as ColumnDef<Record<string, unknown>>[]}
            visibleColumns={state.visibleColumns}
            onToggle={handleToggleColumn}
          />
        </div>
      </div>

      {/* Table wrapper */}
      <div className="overflow-x-auto">
        <table
          role="grid"
          aria-label={caption ?? 'Data table'}
          aria-rowcount={data.length}
          className="w-full text-sm"
        >
          {caption && <caption className="sr-only">{caption}</caption>}

          {/* Sticky Header */}
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <tr>
              {selectable && (
                <th scope="col" className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={pageData.length > 0 && state.selectedKeys.size === new Set(pageData.map((_, i) => getKey(_, i))).size}
                    onChange={handleSelectAll}
                    aria-label="Select all rows on this page"
                    className="rounded border-slate-300 text-green-600
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600
                      cursor-pointer"
                  />
                </th>
              )}
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={
                    state.sortKey === col.key
                      ? state.sortDirection === 'asc' ? 'ascending' : state.sortDirection === 'desc' ? 'descending' : 'none'
                      : col.sortable !== false ? 'none' : undefined
                  }
                  className={`px-4 py-3 font-semibold text-slate-600 whitespace-nowrap
                    ${alignClass(col.align)}
                    ${col.sortable !== false ? 'cursor-pointer select-none hover:bg-slate-100 transition-colors' : ''}
                  `}
                  style={{ minWidth: col.minWidth, width: col.width }}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && (
                      <span className="inline-flex flex-col -space-y-0.5">
                        {state.sortKey === col.key ? (
                          state.sortDirection === 'asc' ? (
                            <SortAscIcon className="h-3 w-3 text-green-600" />
                          ) : (
                            <SortDescIcon className="h-3 w-3 text-green-600" />
                          )
                        ) : (
                          <SortNeutralIcon className="h-3 w-3 text-slate-300" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody aria-live="polite" aria-relevant="additions removals">
            {/* Error */}
            {error && (
              <tr>
                <td colSpan={visibleCols.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <WarningIcon className="h-10 w-10 text-red-400" />
                    <p className="text-slate-700 font-medium">{error}</p>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200
                        text-slate-700 transition-colors focus:outline-none focus-visible:ring-2
                        focus-visible:ring-green-600"
                    >
                      Muat Ulang
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* Loading skeleton */}
            {!error && loading && (
              <SkeletonRows rows={state.pageSize} cols={visibleCols.length} compact={compact} />
            )}

            {/* Empty state */}
            {!error && !loading && pageData.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length + (selectable ? 1 : 0)} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-slate-500 font-medium">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            )}

            {/* Data rows */}
            {!error && !loading && pageData.map((row, rowIndex) => {
              const key = getKey(row, rowIndex);
              const isSelected = state.selectedKeys.has(key);
              return (
                <tr
                  key={key}
                  className={`border-b border-slate-100 transition-colors duration-100
                    ${striped && rowIndex % 2 === 1 ? 'bg-slate-50/50' : ''}
                    ${isSelected ? 'bg-green-50/50' : 'hover:bg-slate-50'}
                  `}
                  aria-selected={selectable ? isSelected : undefined}
                >
                  {selectable && (
                    <td className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(key, row)}
                        aria-label={`Select row ${rowIndex + 1}`}
                        className="rounded border-slate-300 text-green-600
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600
                          cursor-pointer"
                      />
                    </td>
                  )}
                  {visibleCols.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 ${compact ? 'py-2' : 'py-3'} ${alignClass(col.align)} text-slate-700`}
                      style={{ minWidth: col.minWidth }}
                    >
                      {getValue(row, col, rowIndex)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!error && (
        <Pagination
          page={state.page}
          pageSize={state.pageSize}
          total={processed.length}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
}

export default DataTable;