/**
 * ReportFilters.tsx
 * Multi-filter bar for report pages: periode, date range, lokasi, kategori, supplier, status.
 * "Terapkan Filter" applies and "Reset" restores defaults.
 */

import React, { useState, useId } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface AvailableOptions {
  periode?: FilterOption[];
  lokasi?: FilterOption[];
  kategori?: FilterOption[];
  supplier?: FilterOption[];
  status?: FilterOption[];
}

export interface ReportFiltersState {
  periode: string;
  dateStart: string;
  dateEnd: string;
  lokasi: string;
  kategori: string;
  supplier: string;
  status: string;
}

export interface ReportFiltersProps {
  /** Current filter values */
  filters: Partial<ReportFiltersState>;
  /** Called when user clicks "Terapkan Filter" */
  onApply: (filters: ReportFiltersState) => void;
  /** Called when user clicks "Reset" */
  onReset: () => void;
  /** Available options for each dropdown */
  availableOptions?: AvailableOptions;
  /** Disable all controls */
  disabled?: boolean;
  /** Show/hide individual filters */
  visibleFilters?: (keyof ReportFiltersState)[];
  /** CSS class for container */
  className?: string;
  /** Compact layout (horizontal scroll on mobile) */
  compact?: boolean;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_FILTERS: ReportFiltersState = {
  periode: '',
  dateStart: '',
  dateEnd: '',
  lokasi: '',
  kategori: '',
  supplier: '',
  status: '',
};

const ALL_FILTER_KEYS: (keyof ReportFiltersState)[] = [
  'periode', 'dateStart', 'dateEnd', 'lokasi', 'kategori', 'supplier', 'status',
];

// ─── Icons ─────────────────────────────────────────────────────────────────────

const FilterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const CalendarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ResetIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// ─── Filter Field Component ────────────────────────────────────────────────────

interface FilterFieldProps {
  label: string;
  name: keyof ReportFiltersState;
  value: string;
  onChange: (name: keyof ReportFiltersState, value: string) => void;
  type?: 'text' | 'date' | 'select';
  options?: FilterOption[];
  placeholder?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  required?: boolean;
}

const FilterField: React.FC<FilterFieldProps> = ({
  label, name, value, onChange, type = 'select',
  options = [], placeholder, disabled = false, icon, required,
}) => {
  const id = useId();
  const isSelect = type === 'select';
  const hasOptions = options.length > 0;

  const wrapperClass = `flex flex-col gap-1.5 min-w-[160px] ${isSelect && !hasOptions ? 'hidden' : ''}`;

  const inputClass = `
    w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
    bg-white text-slate-700 placeholder-slate-400
    focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus:border-green-400
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-colors duration-150 appearance-none
    ${isSelect ? 'pr-8 cursor-pointer' : ''}
    ${icon ? 'pl-9' : ''}
  `;

  return (
    <div className={wrapperClass}>
      <label htmlFor={id} className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>

      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </span>
        )}

        {isSelect ? (
          <select
            id={id}
            name={name}
            value={value}
            onChange={(e) => onChange(name, e.target.value)}
            disabled={disabled}
            aria-label={label}
            className={inputClass}
          >
            <option value="">{placeholder ?? `Semua ${label}`}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}{opt.count !== undefined ? ` (${opt.count})` : ''}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            type={type}
            name={name}
            value={value}
            onChange={(e) => onChange(name, e.target.value)}
            disabled={disabled}
            aria-label={label}
            placeholder={placeholder}
            className={inputClass}
          />
        )}

        {isSelect && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <ChevronDownIcon className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ReportFilters — filter bar for report pages.
 *
 * @example
 * <ReportFilters
 *   filters={filters}
 *   onApply={(f) => setFilters(f)}
 *   onReset={() => setFilters(DEFAULT_FILTERS)}
 *   availableOptions={{ lokasi: [...], status: [...] }}
 * />
 */
export const ReportFilters: React.FC<ReportFiltersProps> = ({
  filters,
  onApply,
  onReset,
  availableOptions = {},
  disabled = false,
  visibleFilters = ALL_FILTER_KEYS,
  className = '',
  compact = false,
}) => {
  const [local, setLocal] = useState<ReportFiltersState>({ ...DEFAULT_FILTERS, ...filters });
  const [activeCount, setActiveCount] = useState(0);
  const formId = useId();

  const handleChange = (name: keyof ReportFiltersState, value: string) => {
    setLocal((prev) => ({ ...prev, [name]: value }));
  };

  const handleApply = () => {
    const count = Object.entries(local).filter(([k, v]) => {
      if (!visibleFilters.includes(k as keyof ReportFiltersState)) return false;
      return v !== '' && v !== null && v !== undefined;
    }).length;
    setActiveCount(count);
    onApply(local);
  };

  const handleReset = () => {
    const cleared = { ...DEFAULT_FILTERS };
    setLocal(cleared);
    setActiveCount(0);
    onReset();
  };

  const hasActiveFilters = Object.entries(local).some(([k, v]) => {
    if (!visibleFilters.includes(k as keyof ReportFiltersState)) return false;
    return v !== '' && v !== null && v !== undefined;
  });

  const labelMap: Partial<Record<keyof ReportFiltersState, string>> = {
    periode: 'Periode',
    dateStart: 'Tanggal Mulai',
    dateEnd: 'Tanggal Akhir',
    lokasi: 'Lokasi / Gudang',
    kategori: 'Kategori',
    supplier: 'Supplier',
    status: 'Status',
  };

  const visibleKeys = visibleFilters.filter((k) => {
    if (k === 'periode') return true;
    if (k === 'dateStart') return true;
    if (k === 'dateEnd') return true;
    if (k === 'lokasi') return true;
    if (k === 'kategori') return true;
    if (k === 'supplier') return true;
    if (k === 'status') return true;
    return false;
  });

  return (
    <div
      role="search"
      aria-label="Report filters"
      className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <FilterIcon className="h-4 w-4 text-green-700 shrink-0" aria-hidden="true" />
        <span className="text-sm font-semibold text-slate-700">Filter Laporan</span>
        {hasActiveFilters && (
          <span className="ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-700">
            {activeCount > 0 ? activeCount : ''}
          </span>
        )}
      </div>

      {/* Filter fields */}
      <div
        id={`${formId}-fields`}
        className={`px-4 py-3 flex flex-wrap gap-4 ${compact ? 'overflow-x-auto' : ''}`}
        role="group"
        aria-label="Filter fields"
      >
        {visibleKeys.includes('periode') && (
          <FilterField
            label={labelMap.periode!}
            name="periode"
            value={local.periode}
            onChange={handleChange}
            type="select"
            options={availableOptions.periode ?? [
              { value: '2026-01', label: 'Januari 2026' },
              { value: '2026-02', label: 'Februari 2026' },
              { value: '2026-03', label: 'Maret 2026' },
              { value: '2026-04', label: 'April 2026' },
              { value: '2026-05', label: 'Mei 2026' },
            ]}
            placeholder="Semua Periode"
            disabled={disabled}
          />
        )}

        {visibleKeys.includes('dateStart') && (
          <FilterField
            label={labelMap.dateStart!}
            name="dateStart"
            value={local.dateStart}
            onChange={handleChange}
            type="date"
            disabled={disabled}
            icon={<CalendarIcon className="h-3.5 w-3.5" />}
          />
        )}

        {visibleKeys.includes('dateEnd') && (
          <FilterField
            label={labelMap.dateEnd!}
            name="dateEnd"
            value={local.dateEnd}
            onChange={handleChange}
            type="date"
            disabled={disabled}
            icon={<CalendarIcon className="h-3.5 w-3.5" />}
          />
        )}

        {visibleKeys.includes('lokasi') && (
          <FilterField
            label={labelMap.lokasi!}
            name="lokasi"
            value={local.lokasi}
            onChange={handleChange}
            type="select"
            options={availableOptions.lokasi ?? [
              { value: 'gudang-utama', label: 'Gudang Utama' },
              { value: 'gudang-aik', label: 'Gudang Aik' },
              { value: 'gudang-batu', label: 'Gudang Batu' },
              { value: 'gudang-simpang', label: 'Gudang Simpang' },
            ]}
            placeholder="Semua Lokasi"
            disabled={disabled}
          />
        )}

        {visibleKeys.includes('kategori') && (
          <FilterField
            label={labelMap.kategori!}
            name="kategori"
            value={local.kategori}
            onChange={handleChange}
            type="select"
            options={availableOptions.kategori ?? [
              { value: 'atk', label: 'ATK' },
              { value: 'elektronik', label: 'Elektronik' },
              { value: 'material', label: 'Material' },
              { value: 'kantor', label: 'Peralatan Kantor' },
            ]}
            placeholder="Semua Kategori"
            disabled={disabled}
          />
        )}

        {visibleKeys.includes('supplier') && (
          <FilterField
            label={labelMap.supplier!}
            name="supplier"
            value={local.supplier}
            onChange={handleChange}
            type="select"
            options={availableOptions.supplier ?? [
              { value: 'supplier-a', label: 'PT Sumber Makmur' },
              { value: 'supplier-b', label: 'CV Berkah Jaya' },
              { value: 'supplier-c', label: 'UD Nusa Tenggara' },
            ]}
            placeholder="Semua Supplier"
            disabled={disabled}
          />
        )}

        {visibleKeys.includes('status') && (
          <FilterField
            label={labelMap.status!}
            name="status"
            value={local.status}
            onChange={handleChange}
            type="select"
            options={availableOptions.status ?? [
              { value: 'completed', label: 'Selesai' },
              { value: 'pending', label: 'Tertunda' },
              { value: 'processing', label: 'Diproses' },
              { value: 'cancelled', label: 'Dibatalkan' },
            ]}
            placeholder="Semua Status"
            disabled={disabled}
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
        <button
          type="button"
          onClick={handleApply}
          disabled={disabled}
          aria-label="Apply filters"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg
            bg-green-700 hover:bg-green-800 text-white
            focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-1
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150 shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Terapkan Filter
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={disabled}
          aria-label="Reset all filters"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg
            bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50
            text-slate-600
            focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150"
        >
          <ResetIcon className="h-4 w-4" />
          Reset
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="ml-auto text-xs text-slate-400 hover:text-red-500
              focus:outline-none focus-visible:text-red-500
              transition-colors"
            aria-label="Clear all active filters"
          >
            Hapus semua filter ×
          </button>
        )}
      </div>
    </div>
  );
};

export default ReportFilters;
