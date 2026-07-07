/**
 * ExportQueuePanel.tsx
 * Slide-in panel showing the queue of in-progress and completed export jobs.
 */

import React, { useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExportJobStatus = 'pending' | 'exporting' | 'completed' | 'failed' | 'cancelled';

export interface ExportJob {
  id: string;
  /** Human-readable label (e.g. query name) */
  label: string;
  format: 'csv' | 'json' | 'xlsx' | 'sql' | 'tsv';
  status: ExportJobStatus;
  /** Bytes downloaded / total, 0–1 */
  progress?: number;
  /** Human-readable size of the file (e.g. "2.4 MB") */
  size?: string;
  /** Error message if failed */
  error?: string;
  /** When the job was created */
  createdAt: Date;
  /** When the job finished (completed / failed) */
  completedAt?: Date;
  /** Number of rows exported */
  rowCount?: number;
  /** Download URL (for completed jobs) */
  downloadUrl?: string;
}

export interface ExportQueuePanelProps {
  /** All jobs */
  jobs: ExportJob[];
  /** Whether the panel is visible / open */
  isOpen: boolean;
  /** Called to close the panel */
  onClose: () => void;
  /** Called to cancel a pending/running job */
  onCancel?: (jobId: string) => void;
  /** Called to retry a failed job */
  onRetry?: (jobId: string) => void;
  /** Called to remove a completed/failed job from the list */
  onDismiss?: (jobId: string) => void;
  /** Called when a completed job download link is clicked */
  onDownload?: (job: ExportJob) => void;
  /** Panel position: 'right' | 'bottom' (default 'right') */
  position?: 'right' | 'bottom';
  /** Max height (for right panel) or max height (for bottom panel) */
  maxHeight?: string;
  /** CSS class */
  className?: string;
  /** Show a badge with pending/in-progress count on the trigger */
  badgeCount?: number;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`animate-spin ${className ?? ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const RetryIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDuration = (start: Date, end?: Date): string => {
  const ms = (end ?? new Date()).getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
};

const formatBadgeColor = (format: ExportJob['format']): string => {
  const map: Record<ExportJob['format'], string> = {
    csv: 'bg-emerald-100 text-emerald-700',
    json: 'bg-amber-100 text-amber-700',
    xlsx: 'bg-indigo-100 text-indigo-700',
    sql: 'bg-cyan-100 text-cyan-700',
    tsv: 'bg-slate-100 text-slate-700',
  };
  return map[format] ?? 'bg-slate-100 text-slate-700';
};

const StatusIcon: React.FC<{ status: ExportJobStatus; className?: string }> = ({ status, className }) => {
  switch (status) {
    case 'completed':
      return <CheckCircleIcon className={`h-5 w-5 text-emerald-500 ${className ?? ''}`} />;
    case 'failed':
      return <XCircleIcon className={`h-5 w-5 text-red-500 ${className ?? ''}`} />;
    case 'exporting':
      return <SpinnerIcon className={`h-5 w-5 text-indigo-500 ${className ?? ''}`} />;
    case 'cancelled':
      return <XCircleIcon className={`h-5 w-5 text-slate-400 ${className ?? ''}`} />;
    default:
      return <ClockIcon className={`h-5 w-5 text-slate-400 ${className ?? ''}`} />;
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ExportQueuePanel — side / bottom panel displaying a queue of export jobs.
 *
 * @example
 * <ExportQueuePanel
 *   jobs={jobs}
 *   isOpen={panelOpen}
 *   onClose={() => setPanelOpen(false)}
 *   onCancel={(id) => cancelExport(id)}
 *   onDownload={(job) => downloadFile(job.downloadUrl)}
 * />
 */
export const ExportQueuePanel: React.FC<ExportQueuePanelProps> = ({
  jobs,
  isOpen,
  onClose,
  onCancel,
  onRetry,
  onDismiss,
  onDownload,
  position = 'right',
  maxHeight,
  className = '',
  badgeCount,
}) => {
  const activeCount = jobs.filter(
    (j) => j.status === 'pending' || j.status === 'exporting'
  ).length;

  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;

  const panelBase = `
    flex flex-col bg-white border border-slate-200
    shadow-2xl z-50 transition-all duration-300
    ${position === 'right'
      ? 'fixed top-0 right-0 h-full w-96 border-l border-slate-200'
      : 'fixed bottom-0 left-0 right-0 rounded-t-2xl border-t border-slate-200 max-h-80'}
    ${className}
  `;

  const panelHidden = isOpen ? '' : position === 'right'
    ? 'translate-x-full'
    : 'translate-y-full';

  const handleDownload = useCallback(
    (job: ExportJob) => {
      onDownload?.(job);
    },
    [onDownload]
  );

  return (
    <>
      {/* Backdrop (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-20 z-40 sm:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <aside
        aria-label="Export queue"
        aria-hidden={!isOpen}
        className={`${panelBase} ${panelHidden}`}
        style={position === 'bottom' && maxHeight ? { maxHeight } : position === 'right' && maxHeight ? { maxHeight } : {}}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              Export Queue
              {badgeCount !== undefined && badgeCount > 0 && (
                <span className="bg-indigo-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {badgeCount}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeCount > 0
                ? `${activeCount} active · ${completedCount} done`
                : `${completedCount} completed · ${failedCount} failed`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export queue"
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1.5 transition-colors"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Job list */}
        <div
          className="flex-1 overflow-y-auto custom-scrollbar"
          style={position === 'right' && maxHeight ? {} : { maxHeight: maxHeight ?? '320px' }}
        >
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 px-4 text-center">
              <DownloadIcon className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No export jobs</p>
              <p className="text-xs mt-1 opacity-70">Your queued downloads will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100" role="list">
              {jobs.map((job) => (
                <li key={job.id} className="px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
                    <div className="mt-0.5 shrink-0">
                      <StatusIcon status={job.status} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800 truncate">{job.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-semibold shrink-0 ${formatBadgeColor(job.format)}`}>
                          {job.format.toUpperCase()}
                        </span>
                      </div>

                      {/* Progress bar */}
                      {(job.status === 'exporting' || job.status === 'pending') && job.progress !== undefined && (
                        <div className="mt-2 w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                            style={{ width: `${Math.round(job.progress * 100)}%` }}
                            role="progressbar"
                            aria-valuenow={Math.round(job.progress * 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {job.size && (
                          <span className="text-xs text-slate-400">{job.size}</span>
                        )}
                        {job.rowCount !== undefined && (
                          <span className="text-xs text-slate-400">{job.rowCount.toLocaleString()} rows</span>
                        )}
                        <span className="text-xs text-slate-400">
                          {job.status === 'completed'
                            ? formatDuration(job.createdAt, job.completedAt)
                            : job.status === 'failed'
                            ? `Failed · ${job.error ?? ''}`
                            : 'In progress'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Download (completed) */}
                      {job.status === 'completed' && job.downloadUrl && (
                        <button
                          type="button"
                          onClick={() => handleDownload(job)}
                          aria-label={`Download ${job.label}`}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <DownloadIcon className="h-4 w-4" />
                        </button>
                      )}

                      {/* Retry (failed) */}
                      {job.status === 'failed' && onRetry && (
                        <button
                          type="button"
                          onClick={() => onRetry(job.id)}
                          aria-label={`Retry ${job.label}`}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <RetryIcon className="h-4 w-4" />
                        </button>
                      )}

                      {/* Cancel (pending/exporting) */}
                      {(job.status === 'pending' || job.status === 'exporting') && onCancel && (
                        <button
                          type="button"
                          onClick={() => onCancel(job.id)}
                          aria-label={`Cancel ${job.label}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <CloseIcon className="h-4 w-4" />
                        </button>
                      )}

                      {/* Dismiss (done/failed/cancelled) */}
                      {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && onDismiss && (
                        <button
                          type="button"
                          onClick={() => onDismiss(job.id)}
                          aria-label={`Remove ${job.label} from queue`}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {jobs.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-200 shrink-0 bg-slate-50 rounded-b-2xl">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{jobs.length} job{jobs.length !== 1 ? 's' : ''} total</span>
              <span>{completedCount} completed · {failedCount} failed</span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default ExportQueuePanel;