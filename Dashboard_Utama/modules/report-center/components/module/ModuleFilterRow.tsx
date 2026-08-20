import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import type { FilterState, ReportStatus, ReportCategory } from './reportTypes';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ModuleFilterRowProps {
  /** Current filter values */
  filters: FilterState;
  /** Update a single filter key */
  onFilterChange: (key: keyof FilterState, value: string) => void;
  /** Reset all filters to defaults */
  onReset: () => void;
  /** Available server profile options for the dropdown */
  serverProfileOptions?: { value: string; label: string }[];
  /** Placeholder for search input */
  searchPlaceholder?: string;
  /** Show the date-range inputs */
  showDateRange?: boolean;
  className?: string;
}

// ─── Status & Category options ────────────────────────────────────────────────

const STATUS_OPTIONS: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'cancelled', label: 'Cancelled' },
];

const CATEGORY_OPTIONS: { value: ReportCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'sales', label: 'Sales' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'finance', label: 'Finance' },
  { value: 'operations', label: 'Operations' },
  { value: 'custom', label: 'Custom' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const ModuleFilterRow: React.FC<ModuleFilterRowProps> = ({
  filters,
  onFilterChange,
  onReset,
  serverProfileOptions = [],
  searchPlaceholder = 'Search reports…',
  showDateRange = false,
  className = '',
}) => {
  const hasActiveFilters =
    filters.search !== '' ||
    filters.status !== 'all' ||
    filters.category !== 'all' ||
    filters.serverProfile !== 'all' ||
    (showDateRange && filters.dateRange !== null);

  return (
    <div
      className={`flex flex-wrap items-center gap-3 bg-white border-b border-slate-200 px-6 py-3 ${className}`}
      role="search"
      aria-label="Report filters"
    >
      {/* Search */}
      <div className="relative flex-1 min-w-[220px] max-w-sm">
        <Search
          size={14}
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onFilterChange('search', e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Search reports"
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md
                     text-slate-700 placeholder-slate-400
                     focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                     transition-colors"
        />
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1.5">
        <SlidersHorizontal size={13} aria-hidden="true" className="text-slate-400 flex-shrink-0" />
        <label className="sr-only" htmlFor="filter-status">Status</label>
        <select
          id="filter-status"
          value={filters.status}
          onChange={(e) => onFilterChange('status', e.target.value)}
          className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50
                     text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                     transition-colors cursor-pointer"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor="filter-category">Category</label>
        <select
          id="filter-category"
          value={filters.category}
          onChange={(e) => onFilterChange('category', e.target.value)}
          className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50
                     text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                     transition-colors cursor-pointer"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Server profile filter */}
      {serverProfileOptions.length > 0 && (
        <div className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor="filter-server">Server Profile</label>
          <select
            id="filter-server"
            value={filters.serverProfile}
            onChange={(e) => onFilterChange('serverProfile', e.target.value)}
            className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50
                       text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                       transition-colors cursor-pointer"
          >
            <option value="all">All Servers</option>
            {serverProfileOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Date range */}
      {showDateRange && (
        <>
          <label className="sr-only" htmlFor="filter-date-from">From date</label>
          <input
            id="filter-date-from"
            type="date"
            value={filters.dateRange?.from ?? ''}
            onChange={(e) =>
              onFilterChange('dateRange', JSON.stringify({
                from: e.target.value,
                to: filters.dateRange?.to ?? '',
              }))
            }
            className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50
                       text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                       transition-colors"
          />
          <span className="text-slate-400 text-xs" aria-hidden="true">→</span>
          <label className="sr-only" htmlFor="filter-date-to">To date</label>
          <input
            id="filter-date-to"
            type="date"
            value={filters.dateRange?.to ?? ''}
            onChange={(e) =>
              onFilterChange('dateRange', JSON.stringify({
                from: filters.dateRange?.from ?? '',
                to: e.target.value,
              }))
            }
            className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50
                       text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                       transition-colors"
          />
        </>
      )}

      {/* Reset */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onReset}
          aria-label="Clear all filters"
          className="ml-auto text-xs text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
        >
          Clear filters
        </button>
      )}
    </div>
  );
};

export default ModuleFilterRow;