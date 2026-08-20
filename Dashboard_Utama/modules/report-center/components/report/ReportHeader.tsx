/**
 * ReportHeader.tsx
 * Report page header with breadcrumb, title, module badge, status badge, and favorite button.
 */

import React from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export type ReportStatus = 'draft' | 'published' | 'archived' | 'processing';

export interface ReportMeta {
  id: string;
  name: string;
  module: string;
  moduleColor?: string;
  status?: ReportStatus;
  description?: string;
  lastUpdated?: string;
  updatedBy?: string;
  version?: string;
}

export interface ReportHeaderProps {
  /** Report metadata */
  report: ReportMeta;
  /** Breadcrumb trail */
  breadcrumb?: BreadcrumbItem[];
  /** Called when favorite is toggled */
  onFavoriteToggle?: (isFavorite: boolean) => void;
  /** Initial favorite state */
  isFavorite?: boolean;
  /** CSS class for container */
  className?: string;
}

// ─── Status badge config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ReportStatus, { label: string; bg: string; text: string; dot: string }> = {
  published: { label: 'Dipublikasi', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  draft: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  processing: { label: 'Diproses', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  archived: { label: 'Arsip', bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-400' },
};

// ─── Module badge colors ─────────────────────────────────────────────────────

const MODULE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  inventory: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  keuangan: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  supply: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  hr: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  general: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
};

function getModuleColor(module: string) {
  return MODULE_COLORS[module.toLowerCase()] ?? MODULE_COLORS.general;
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const StarIcon: React.FC<{ filled: boolean; className?: string }> = ({ filled, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

// ─── FavoriteButton (local) ──────────────────────────────────────────────────

interface FavoriteBtnProps {
  isFavorite: boolean;
  onToggle: (v: boolean) => void;
}

const FavoriteButton: React.FC<FavoriteBtnProps> = ({ isFavorite, onToggle }) => {
  const [animating, setAnimating] = React.useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);
    onToggle(!isFavorite);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isFavorite ? 'Hapus dari favorit' : 'Tambah ke favorit'}
      aria-pressed={isFavorite}
      title={isFavorite ? 'Hapus dari favorit' : 'Tambah ke favorit'}
      className={`p-2 rounded-full transition-all duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400
        ${isFavorite ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50'}`}
    >
      <StarIcon
        filled={isFavorite}
        className={`h-5 w-5 transition-all duration-200 ${animating ? 'scale-125' : 'scale-100'}`}
      />
    </button>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ReportHeader — header for report pages with breadcrumb and metadata.
 *
 * @example
 * <ReportHeader
 *   report={{ id: '1', name: 'Laporan Stok Bulanan', module: 'inventory', status: 'published' }}
 *   breadcrumb={[{ label: 'Dashboard', href: '/' }, { label: 'Laporan' }]}
 *   onFavoriteToggle={(v) => toggleFav(v)}
 * />
 */
export const ReportHeader: React.FC<ReportHeaderProps> = ({
  report,
  breadcrumb = [],
  onFavoriteToggle,
  isFavorite = false,
  className = '',
}) => {
  const statusCfg = report.status ? STATUS_CONFIG[report.status] : null;
  const modCfg = getModuleColor(report.module);

  const formatDate = (iso?: string) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <header
      aria-label={`Report header: ${report.name}`}
      className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
    >
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-green-700 via-green-600 to-amber-500" aria-hidden="true" />

      <div className="px-6 py-5">
        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 mb-4 text-sm">
            {breadcrumb.map((item, i) => {
              const isLast = i === breadcrumb.length - 1;
              return (
                <React.Fragment key={item.label}>
                  {i > 0 && <ChevronRightIcon className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />}
                  {item.href && !isLast ? (
                    <a
                      href={item.href}
                      className="text-slate-500 hover:text-green-700 hover:underline
                        focus:outline-none focus-visible:text-green-700"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <span className={isLast ? 'text-slate-700 font-medium' : 'text-slate-500'}>
                      {item.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        )}

        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Module badge */}
            <div className="mb-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border
                ${modCfg.bg} ${modCfg.text} ${modCfg.border}`}
                aria-label={`Modul: ${report.module}`}>
                {report.module.charAt(0).toUpperCase() + report.module.slice(1)}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-slate-900 leading-tight mb-2">
              {report.name}
            </h1>

            {/* Description */}
            {report.description && (
              <p className="text-sm text-slate-500 leading-relaxed mb-3">{report.description}</p>
            )}

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-4 mt-3">
              {statusCfg && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                  ${statusCfg.bg} ${statusCfg.text}`}
                  aria-label={`Status: ${statusCfg.label}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} aria-hidden="true" />
                  {statusCfg.label}
                </span>
              )}

              {report.version && (
                <span className="text-xs text-slate-400 font-mono">
                  v{report.version}
                </span>
              )}

              {report.lastUpdated && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Diperbarui: {formatDate(report.lastUpdated)}
                </span>
              )}

              {report.updatedBy && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {report.updatedBy}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {onFavoriteToggle && (
              <FavoriteButton isFavorite={isFavorite} onToggle={onFavoriteToggle} />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default ReportHeader;