/**
 * ReportActions.tsx
 * Export action bar: ExportButtonGroup (Excel, PDF, CSV) + Print + Copy Link.
 * Success/error feedback with animated states.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExportFormat = 'xlsx' | 'pdf' | 'csv';

export interface ReportActionsProps {
  /** Called when user selects an export format */
  onExport?: (format: ExportFormat) => void | Promise<void>;
  /** Called when user clicks Print */
  onPrint?: () => void;
  /** Called when user clicks Copy Link */
  onCopyLink?: () => void;
  /** Disable all actions */
  disabled?: boolean;
  /** Loading state for export */
  loading?: boolean;
  /** Currently exporting format */
  loadingFormat?: ExportFormat | null;
  /** Show export count badge */
  rowCount?: number;
  /** Label for the export button */
  exportLabel?: string;
  /** Show format badges on buttons */
  showBadge?: boolean;
  /** CSS class for container */
  className?: string;
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const PrinterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
);

const LinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
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

const ExcelIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13h2.25v1h-2.25v2H8.5v-2h2.25v-1H8.5v-1.5h2.25V9H8.5V13zm6-1h1.5v3.5h-1.5v1H15v-1h-1.5V12h1.5v-1H15v1zM9 15.5h1v-1H9v1zm0-2h1v-1H9v1zm4 3.5c0-.55.45-1 1-1s1 .45 1 1-.45 1-1 1-1-.45-1-1zm0-2c0-.55.45-1 1-1s1 .45 1 1-.45 1-1 1-1-.45-1-1zm0-2c0-.55.45-1 1-1s1 .45 1 1-.45 1-1 1-1-.45-1-1z" />
  </svg>
);

const FilePdfIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-4.18 11.5l1.2.9 2.16-1.62-.45-.45-2.16 1.62-1.27-.96-1.27.96 2.16 1.62-.45.45-2.16-1.62 1.2-.9zm6.9.96h1.5v.84l1.22 1.22-.82 1.94h-1.9v-4zm-3.3 2.04l.45.45h2.16l-.45-.45.45-.45h-2.16l-.45.45z" />
  </svg>
);

const CsvIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm3 8.5v1h-3v-1h3zm-1.5 2h-1v-1h1v1zm2.5 0h-1v-1h1v1zm0-2h-1v-1h1v1zm-2.5-1h-1v-1h1v1zm0-2h-1v-1h1v1zm2.5 2h-1v-1h1v1zm0-2h-1v-1h1v1z" />
  </svg>
);

// ─── Export Option ─────────────────────────────────────────────────────────────

interface ExportOptionDef {
  format: ExportFormat;
  label: string;
  icon: React.FC<{ className?: string }>;
  badgeColor: string;
  description: string;
}

const EXPORT_OPTIONS: ExportOptionDef[] = [
  {
    format: 'xlsx',
    label: 'Export Excel',
    icon: ExcelIcon,
    badgeColor: 'bg-emerald-100 text-emerald-700',
    description: 'Microsoft Excel (.xlsx)',
  },
  {
    format: 'pdf',
    label: 'Export PDF',
    icon: FilePdfIcon,
    badgeColor: 'bg-red-50 text-red-600',
    description: 'Portable Document Format',
  },
  {
    format: 'csv',
    label: 'Export CSV',
    icon: CsvIcon,
    badgeColor: 'bg-blue-50 text-blue-600',
    description: 'Comma-separated values',
  },
];

// ─── Toast notification ───────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

const Toast: React.FC<ToastProps> = ({ message, type, visible }) => {
  const bg = type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : type === 'error' ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-blue-50 border-blue-200 text-blue-700';
  const icon = type === 'success' ? <CheckIcon className="h-4 w-4 text-emerald-500" />
    : type === 'error'
      ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      : null;

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg
        text-sm font-medium ${bg} animate-slide-up`}
    >
      {icon}
      {message}
    </div>
  );
};

// ─── Export Dropdown Button ───────────────────────────────────────────────────

interface ExportDropdownProps {
  onExport: (format: ExportFormat) => void;
  loading: boolean;
  loadingFormat: ExportFormat | null;
  disabled: boolean;
  rowCount?: number;
  showBadge: boolean;
}

const ExportDropdown: React.FC<ExportDropdownProps> = ({
  onExport, loading, loadingFormat, disabled, rowCount, showBadge,
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

  const handleExport = async (format: ExportFormat) => {
    setOpen(false);
    await onExport(format);
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Export data — select format"
        className={`
          inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg
          bg-green-700 hover:bg-green-800 text-white shadow-sm
          focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-1
          transition-colors duration-150
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {loading ? (
          <SpinnerIcon className="h-4 w-4 text-white" />
        ) : (
          <DownloadIcon className="h-4 w-4 text-white" aria-hidden="true" />
        )}
        <span>Export</span>
        <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Export format options"
          className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200
            rounded-xl shadow-xl z-50 overflow-hidden"
        >
          {rowCount !== undefined && (
            <li className="px-4 py-2 text-xs text-slate-400 border-b border-slate-100 bg-slate-50">
              {rowCount.toLocaleString('id-ID')} baris data akan di-export
            </li>
          )}
          {EXPORT_OPTIONS.map((opt) => {
            const isLoading = loadingFormat === opt.format;
            return (
              <li key={opt.format}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  aria-label={`${opt.label} — ${opt.description}`}
                  onClick={() => handleExport(opt.format)}
                  disabled={disabled || isLoading}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left
                    hover:bg-slate-50 active:bg-slate-100
                    disabled:opacity-50 disabled:cursor-not-allowed
                    focus:outline-none focus-visible:bg-slate-50
                    transition-colors duration-100"
                >
                  <span className="mt-0.5 shrink-0">
                    {isLoading ? (
                      <SpinnerIcon className="h-5 w-5 text-green-600" />
                    ) : (
                      <opt.icon className="h-5 w-5 text-slate-500" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{opt.label}</span>
                      {showBadge && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${opt.badgeColor}`}>
                          {opt.format.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{opt.description}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ReportActions — export action bar for report pages.
 *
 * @example
 * <ReportActions
 *   onExport={(f) => handleExport(f)}
 *   onPrint={() => window.print()}
 *   onCopyLink={() => navigator.clipboard.writeText(location.href)}
 *   rowCount={1200}
 * />
 */
export const ReportActions: React.FC<ReportActionsProps> = ({
  onExport,
  onPrint,
  onCopyLink,
  disabled = false,
  loading = false,
  loadingFormat = null,
  rowCount,
  exportLabel = 'Export',
  showBadge = false,
  className = '',
}) => {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean }>({
    message: '',
    type: 'info',
    visible: false,
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }, []);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      try {
        await onExport?.(format);
        showToast('File siap diunduh!', 'success');
      } catch {
        showToast('Gagal mengexport. Silakan coba lagi.', 'error');
      }
    },
    [onExport, showToast]
  );

  const handlePrint = useCallback(() => {
    onPrint?.();
  }, [onPrint]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      onCopyLink?.();
      showToast('Link disalin ke clipboard!', 'success');
    } catch {
      showToast('Gagal menyalin link.', 'error');
    }
  }, [onCopyLink, showToast]);

  return (
    <>
      <div
        role="group"
        aria-label="Report actions"
        className={`flex flex-wrap items-center gap-2 ${className}`}
      >
        {/* Export dropdown */}
        {onExport && (
          <ExportDropdown
            onExport={handleExport}
            loading={loading}
            loadingFormat={loadingFormat}
            disabled={disabled}
            rowCount={rowCount}
            showBadge={showBadge}
          />
        )}

        {/* Print */}
        {onPrint && (
          <button
            type="button"
            onClick={handlePrint}
            disabled={disabled}
            aria-label="Print report"
            className="inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg
              bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50
              text-slate-600
              focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-150 shadow-sm"
          >
            <PrinterIcon className="h-4 w-4" aria-hidden="true" />
            <span>Cetak</span>
          </button>
        )}

        {/* Copy link */}
        {onCopyLink && (
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={disabled}
            aria-label="Copy report link to clipboard"
            className="inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg
              bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50
              text-slate-600
              focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-150 shadow-sm"
          >
            <LinkIcon className="h-4 w-4" aria-hidden="true" />
            <span>Salin Link</span>
          </button>
        )}
      </div>

      {/* Toast notification */}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </>
  );
};

export default ReportActions;