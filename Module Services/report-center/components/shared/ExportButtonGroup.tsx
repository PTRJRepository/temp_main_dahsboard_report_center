/**
 * ExportButtonGroup.tsx
 * Dropdown button group for exporting data in multiple formats (CSV, JSON, XLSX, SQL).
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'json' | 'xlsx' | 'sql' | 'tsv';

export interface ExportOption {
  format: ExportFormat;
  label: string;
  description?: string;
  /** MIME type */
  mimeType?: string;
  /** File extension */
  extension?: string;
  /** Icon (ReactNode) */
  icon?: React.ReactNode;
  /** Disabled state */
  disabled?: boolean;
  /** CSS color for the format badge */
  badgeColor?: string;
}

export interface ExportButtonGroupProps {
  /** Available export formats */
  formats?: ExportOption[];
  /** Label on the main trigger button */
  label?: string;
  /** Called when user selects a format with a formatter function */
  onExport: (format: ExportFormat) => void | Promise<void>;
  /** Disable all buttons */
  disabled?: boolean;
  /** Show an icon next to the label */
  triggerIcon?: React.ReactNode;
  /** Size: 'sm' | 'md' (default) | 'lg' */
  size?: 'sm' | 'md' | 'lg';
  /** CSS class for container */
  className?: string;
  /** Show format badge (e.g. "CSV") next to label */
  showBadge?: boolean;
  /** Loading state — shows spinner inside trigger */
  loading?: boolean;
  /** Number of rows to be exported (shown in tooltip) */
  rowCount?: number;
  /** Show export history / recent format */
  showRecent?: boolean;
  /** Most recently exported format */
  recentFormat?: ExportFormat | null;
}

// ─── Default formats ───────────────────────────────────────────────────────────

const DEFAULT_FORMATS: ExportOption[] = [
  {
    format: 'csv',
    label: 'Export as CSV',
    description: 'Comma-separated values, opens in Excel',
    extension: '.csv',
    mimeType: 'text/csv',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    format: 'json',
    label: 'Export as JSON',
    description: 'Structured data format, great for APIs',
    extension: '.json',
    mimeType: 'application/json',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  {
    format: 'xlsx',
    label: 'Export as XLSX',
    description: 'Microsoft Excel workbook',
    extension: '.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    badgeColor: 'bg-indigo-100 text-indigo-700',
  },
  {
    format: 'sql',
    label: 'Export as SQL',
    description: 'INSERT statements for database import',
    extension: '.sql',
    mimeType: 'text/plain',
    badgeColor: 'bg-cyan-100 text-cyan-700',
  },
  {
    format: 'tsv',
    label: 'Export as TSV',
    description: 'Tab-separated values',
    extension: '.tsv',
    mimeType: 'text/tab-separated-values',
    badgeColor: 'bg-slate-100 text-slate-700',
  },
];

// ─── Icons ────────────────────────────────────────────────────────────────────

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`animate-spin ${className ?? ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ExportButtonGroup — dropdown with format options.
 *
 * @example
 * <ExportButtonGroup
 *   onExport={(format) => downloadData(format)}
 *   rowCount={150}
 * />
 */
export const ExportButtonGroup: React.FC<ExportButtonGroupProps> = ({
  formats = DEFAULT_FORMATS,
  label = 'Export',
  onExport,
  disabled = false,
  triggerIcon,
  size = 'md',
  className = '',
  showBadge = false,
  loading = false,
  rowCount,
  showRecent = true,
  recentFormat,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard nav
  useEffect(() => {
    if (!isOpen) return;
    const focusable = listRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled])'
    );
    if (!focusable?.length) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsOpen(false); containerRef.current?.focus(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const first = focusable[0];
        first?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExportingFormat(format);
      setIsOpen(false);
      try {
        await onExport(format);
      } finally {
        setExportingFormat(null);
      }
    },
    [onExport]
  );

  const sizeTokens = {
    sm: { btn: 'px-3 py-1.5 text-xs', icon: 'h-3.5 w-3.5', chevron: 'h-3 w-3', gap: 'gap-1.5' },
    md: { btn: 'px-4 py-2 text-sm', icon: 'h-4 w-4', chevron: 'h-4 w-4', gap: 'gap-2' },
    lg: { btn: 'px-5 py-2.5 text-base', icon: 'h-5 w-5', chevron: 'h-5 w-5', gap: 'gap-2.5' },
  };
  const t = sizeTokens[size];

  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${label} — select export format`}
        className={`
          inline-flex items-center ${t.gap} ${t.btn}
          bg-indigo-600 hover:bg-indigo-700 text-white
          font-medium rounded-lg border border-indigo-700
          transition-colors duration-150
          focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${loading ? 'cursor-wait' : ''}
        `}
      >
        {loading ? (
          <SpinnerIcon className={`${t.icon} text-white`} />
        ) : exportingFormat ? (
          <SpinnerIcon className={`${t.icon} text-white`} />
        ) : triggerIcon ? (
          <span className={t.icon}>{triggerIcon}</span>
        ) : (
          <DownloadIcon className={`${t.icon} text-white`} />
        )}
        <span>{loading ? 'Exporting…' : label}</span>
        <ChevronDownIcon className={`${t.chevron} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Export format options"
          className="
            absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200
            rounded-xl shadow-xl z-50 overflow-hidden
          "
        >
          {/* Row count hint */}
          {rowCount !== undefined && (
            <li className="px-4 py-2 text-xs text-slate-400 border-b border-slate-100 bg-slate-50">
              {rowCount.toLocaleString()} row{rowCount !== 1 ? 's' : ''} will be exported
            </li>
          )}

          {formats.map((option) => {
            const isExporting = exportingFormat === option.format;
            return (
              <li key={option.format}>
                <button
                  type="button"
                  onClick={() => handleExport(option.format)}
                  disabled={option.disabled || isExporting}
                  role="option"
                  aria-selected={false}
                  className={`
                    w-full flex items-start gap-3 px-4 py-3 text-left
                    transition-colors duration-100
                    hover:bg-indigo-50 active:bg-indigo-100
                    ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    focus:outline-none focus-visible:bg-indigo-50
                  `}
                >
                  {/* Icon / spinner */}
                  <span className="mt-0.5 shrink-0">
                    {isExporting ? (
                      <SpinnerIcon className="h-4 w-4 text-indigo-500" />
                    ) : recentFormat === option.format && showRecent ? (
                      <CheckIcon className="h-4 w-4 text-emerald-500" />
                    ) : option.icon ?? (
                      <DownloadIcon className="h-4 w-4 text-slate-400" />
                    )}
                  </span>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{option.label}</span>
                      {showBadge && option.badgeColor && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-semibold ${option.badgeColor}`}>
                          {option.format.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {option.description && (
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{option.description}</p>
                    )}
                  </div>

                  {/* Extension */}
                  {option.extension && (
                    <span className="text-xs text-slate-400 font-mono shrink-0 mt-1">
                      {option.extension}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ExportButtonGroup;