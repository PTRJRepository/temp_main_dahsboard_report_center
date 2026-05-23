import React, { useCallback } from 'react';
import {
  Clock,
  Database,
  Server,
  Star,
  Tag,
  ChevronRight,
  Play,
  Pause,
  Trash2,
  Loader,
} from 'lucide-react';
import type { ReportSummary, ReportStatus } from './reportTypes';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ReportListItemProps {
  report: ReportSummary;
  /** Currently selected (highlighted) item */
  isSelected?: boolean;
  /** Called when the row is clicked */
  onSelect?: (id: string) => void;
  /** Called when "run now" action is triggered */
  onRun?: (id: string) => void;
  /** Called when "cancel" action is triggered */
  onCancel?: (id: string) => void;
  /** Called when "delete" action is triggered */
  onDelete?: (id: string) => void;
  /** Show inline action buttons */
  showActions?: boolean;
  className?: string;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ReportStatus, {
  badgeClass: string;
  dotClass: string;
  label: string;
}> = {
  running: {
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500 ring-2 ring-blue-500/30',
    label: 'Running',
  },
  completed: {
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
    label: 'Completed',
  },
  failed: {
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    dotClass: 'bg-red-500',
    label: 'Failed',
  },
  scheduled: {
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-400',
    label: 'Scheduled',
  },
  cancelled: {
    badgeClass: 'bg-slate-50 text-slate-500 border-slate-200',
    dotClass: 'bg-slate-300',
    label: 'Cancelled',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatExecTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ReportListItem: React.FC<ReportListItemProps> = ({
  report,
  isSelected = false,
  onSelect,
  onRun,
  onCancel,
  onDelete,
  showActions = true,
  className = '',
}) => {
  const status = STATUS_CONFIG[report.status];
  const isRunning = report.status === 'running';
  const isScheduled = report.status === 'scheduled';
  const isFailed = report.status === 'failed';

  const handleRowClick = useCallback(() => {
    onSelect?.(report.id);
  }, [onSelect, report.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect?.(report.id);
      }
    },
    [onSelect, report.id],
  );

  return (
    <article
      role="listitem"
      className={`
        group relative flex items-start gap-3 px-6 py-4
        border-b border-slate-100 last:border-b-0
        transition-colors cursor-pointer select-none
        ${isSelected
          ? 'bg-blue-50 border-l-2 border-l-blue-500'
          : 'hover:bg-slate-50 border-l-2 border-l-transparent'
        }
        ${className}
      `}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={`Report: ${report.title}`}
      aria-selected={isSelected}
    >
      {/* Status dot */}
      <div className="flex-shrink-0 mt-1.5" aria-hidden="true">
        <span
          className={`inline-block w-2 h-2 rounded-full ${status.dotClass}`}
          title={status.label}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: title + status badge */}
        <div className="flex items-center gap-2 flex-wrap">
          {report.isFavorite && (
            <Star
              size={13}
              aria-label="Favorite"
              className="flex-shrink-0 text-amber-400 fill-amber-400"
            />
          )}
          <h3 className="text-sm font-semibold text-slate-800 truncate leading-tight">
            {report.title}
          </h3>
          <span
            className={`
              flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded
              text-[10px] font-semibold border
              ${status.badgeClass}
            `}
          >
            {status.label}
          </span>
        </div>

        {/* Row 2: description */}
        {report.description && (
          <p className="mt-0.5 text-xs text-slate-500 line-clamp-1 leading-snug">
            {report.description}
          </p>
        )}

        {/* Row 3: meta row */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          {/* Author */}
          <span className="flex items-center gap-1 truncate">
            {report.author.avatarUrl ? (
              <img
                src={report.author.avatarUrl}
                alt=""
                className="w-4 h-4 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold"
              >
                {report.author.name[0]?.toUpperCase() ?? '?'}
              </span>
            )}
            <span>{report.author.name}</span>
          </span>

          {/* Database */}
          <span className="flex items-center gap-1">
            <Database size={11} aria-hidden="true" />
            <span className="truncate">{report.database}</span>
          </span>

          {/* Server */}
          <span className="flex items-center gap-1">
            <Server size={11} aria-hidden="true" />
            <span>{report.serverProfile}</span>
          </span>

          {/* Execution time */}
          {report.executionMs !== undefined && (
            <span className="flex items-center gap-1">
              <Clock size={11} aria-hidden="true" />
              <span>{formatExecTime(report.executionMs)}</span>
            </span>
          )}

          {/* Row count */}
          {report.rowCount !== undefined && (
            <span className="font-medium text-slate-600">
              {report.rowCount.toLocaleString()} rows
            </span>
          )}

          {/* Last updated */}
          <span className="ml-auto text-slate-400 tabular-nums">
            {formatRelativeTime(report.updatedAt)}
          </span>
        </div>

        {/* Tags */}
        {report.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {report.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-500 font-medium"
              >
                <Tag size={9} aria-hidden="true" />
                {tag}
              </span>
            ))}
            {report.tags.length > 4 && (
              <span className="text-[10px] text-slate-400 px-1">
                +{report.tags.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right-side chevron / actions */}
      {showActions ? (
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5 self-center">
          {/* Text actions — shown on hover / focus-within */}
          <div className="hidden group-hover:flex group-focus-within:flex items-center gap-1">
            {(isScheduled || isFailed) && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRun?.(report.id); }}
                aria-label={`Run report "${report.title}" now`}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
                           bg-blue-50 text-blue-700 border border-blue-200
                           hover:bg-blue-100 transition-colors cursor-pointer"
              >
                {isRunning ? <Loader size={10} className="animate-spin" /> : <Play size={10} />}
                Run
              </button>
            )}
            {isRunning && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCancel?.(report.id); }}
                aria-label={`Cancel report "${report.title}"`}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
                           bg-amber-50 text-amber-700 border border-amber-200
                           hover:bg-amber-100 transition-colors cursor-pointer"
              >
                <Pause size={10} />
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete?.(report.id); }}
              aria-label={`Delete report "${report.title}"`}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
                         bg-red-50 text-red-600 border border-red-200
                         hover:bg-red-100 transition-colors cursor-pointer"
            >
              <Trash2 size={10} />
              Delete
            </button>
          </div>
          <ChevronRight
            size={14}
            aria-hidden="true"
            className="text-slate-300 group-hover:text-slate-400 transition-colors"
          />
        </div>
      ) : (
        <ChevronRight
          size={14}
          aria-hidden="true"
          className="flex-shrink-0 text-slate-300 self-center"
        />
      )}
    </article>
  );
};

export default ReportListItem;