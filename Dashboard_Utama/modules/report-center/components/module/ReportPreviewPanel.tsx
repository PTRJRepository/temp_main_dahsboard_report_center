import React, { useState, useCallback } from 'react';
import {
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Download,
  ExternalLink,
  FileText,
  Loader,
  Clock,
  Database,
  Server,
  User,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import type { ReportSummary } from './reportTypes';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ReportPreviewPanelProps {
  /** The report to display; null → empty state */
  report: ReportSummary | null;
  /** Raw query text to display in the code block */
  queryText?: string;
  /** Optional preview rows for a results table */
  previewRows?: Record<string, string>[];
  /** Column labels for the preview table */
  previewColumns?: string[];
  /** API / backend error if report is in failed state */
  errorMessage?: string;
  /** Called when the user requests the full download */
  onDownload?: (id: string) => void;
  /** Called when the user closes the panel */
  onClose?: () => void;
  /** Called when user wants to open the full report */
  onOpenFull?: (id: string) => void;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAbsoluteTime(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatExecTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<SectionProps> = ({ title, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-5 py-3 text-sm font-semibold
                   text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        aria-expanded={open}
      >
        {title}
        {open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
};

// ─── Copy-to-clipboard chip ────────────────────────────────────────────────────

function CopyChip({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [text]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
                  border transition-colors cursor-pointer ${className}`}
    >
      {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
    </button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
        <FileText size={22} aria-hidden="true" className="text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-600">No report selected</p>
        <p className="mt-1 text-xs text-slate-400">
          Click a report from the list to preview its details here.
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const ReportPreviewPanel: React.FC<ReportPreviewPanelProps> = ({
  report,
  queryText,
  previewRows,
  previewColumns,
  errorMessage,
  onDownload,
  onClose,
  onOpenFull,
  className = '',
}) => {
  if (!report) {
    return (
      <div className={`flex flex-col h-full bg-white border-l border-slate-200 ${className}`}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full bg-white border-l border-slate-200 overflow-hidden ${className}`}
      aria-label={`Preview: ${report.title}`}
    >
      {/* ── Panel Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-800 truncate leading-tight">
            {report.title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400 truncate">
            {report.status === 'running' ? 'Running…' : `Preview · ${report.status}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onOpenFull && (
            <button
              type="button"
              onClick={() => onOpenFull(report.id)}
              aria-label="Open full report"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium
                         border border-slate-200 text-slate-600
                         hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ExternalLink size={11} />
              Open
            </button>
          )}
          {onDownload && (
            <button
              type="button"
              onClick={() => onDownload(report.id)}
              aria-label="Download report"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium
                         bg-blue-600 text-white border border-blue-700
                         hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Download size={11} />
              Export
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview panel"
              className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100
                         transition-colors cursor-pointer"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Error banner */}
        {(report.status === 'failed' || errorMessage) && (
          <div className="mx-5 mt-4 flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle size={14} aria-hidden="true" className="flex-shrink-0 mt-0.5 text-red-500" />
            <p className="text-xs text-red-700 font-medium leading-snug">
              {errorMessage ?? 'An error occurred while running this report. Check the logs for details.'}
            </p>
          </div>
        )}

        {/* Loading banner */}
        {report.status === 'running' && (
          <div className="mx-5 mt-4 flex items-center gap-2.5 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <Loader size={14} aria-hidden="true" className="flex-shrink-0 text-blue-500 animate-spin" />
            <p className="text-xs text-blue-700 font-medium">
              This report is currently executing. Results will appear here when complete.
            </p>
          </div>
        )}

        {/* Meta grid */}
        <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3 border-b border-slate-100">
          {[
            {
              icon: <User size={12} />,
              label: 'Author',
              value: report.author.name,
            },
            {
              icon: <Database size={12} />,
              label: 'Database',
              value: report.database,
            },
            {
              icon: <Server size={12} />,
              label: 'Server',
              value: report.serverProfile,
            },
            {
              icon: <Calendar size={12} />,
              label: 'Created',
              value: formatAbsoluteTime(report.createdAt),
            },
            {
              icon: <Clock size={12} />,
              label: 'Last run',
              value: formatAbsoluteTime(report.updatedAt),
            },
            ...(report.executionMs !== undefined
              ? [{
                  icon: <Clock size={12} />,
                  label: 'Duration',
                  value: formatExecTime(report.executionMs),
                }]
              : []),
          ].map(({ icon, label, value }) => (
            <div key={label} className="flex items-start gap-2">
              <span className="flex-shrink-0 text-slate-400 mt-0.5" aria-hidden="true">{icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="text-xs text-slate-700 font-medium truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Description */}
        {report.description && (
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-slate-600 leading-relaxed">{report.description}</p>
          </div>
        )}

        {/* Query SQL */}
        {queryText && (
          <CollapsibleSection title="Query SQL">
            <div className="relative">
              <div className="absolute right-2 top-2 z-10">
                <CopyChip
                  text={queryText}
                  className="border-slate-200 text-slate-500 hover:bg-slate-100"
                />
              </div>
              <pre className="p-3 pr-16 rounded-lg bg-slate-800 text-slate-100 text-xs
                              font-mono leading-relaxed overflow-x-auto
                              border border-slate-700">
                <code>{queryText}</code>
              </pre>
            </div>
          </CollapsibleSection>
        )}

        {/* Preview results */}
        {previewRows && previewRows.length > 0 && previewColumns && (
          <CollapsibleSection title={`Preview (${previewRows.length} rows)`}>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {previewColumns.map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                      {previewColumns.map((col) => (
                        <td key={col} className="px-3 py-2 text-slate-700 font-mono whitespace-nowrap">
                          {row[col] ?? <span className="text-slate-300 italic">null</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        )}

        {/* Tags */}
        {report.tags.length > 0 && (
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {report.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-xs font-medium
                             bg-slate-100 text-slate-600 border border-slate-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Schedule info */}
        {report.schedule && (
          <div className="px-5 py-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Schedule</p>
            <p className="text-xs font-mono text-slate-600">{report.schedule.cron}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Next run: <span className="font-medium">{formatAbsoluteTime(report.schedule.nextRun)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportPreviewPanel;