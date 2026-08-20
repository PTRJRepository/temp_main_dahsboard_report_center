/**
 * IntelligenceWidget.tsx
 * Displays a list of AI-generated report recommendations as cards.
 * Includes loading skeleton, empty state, and five reason-type variants.
 *
 * Design tokens: navy / green / gold
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { EmptyState } from '../shared/EmptyState';
import { SkeletonCard } from '../shared/LoadingSkeleton';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Reason categories that drive badge color, icon, and copy. */
export type RecommendationReasonType =
  | 'time_based'   // scheduled / recurring — sky
  | 'updated'      // upstream data changed — emerald
  | 'similar'      // similar to recently viewed — violet
  | 'due'          // deadline / SLA approaching — amber
  | 'anomaly';     // statistical anomaly detected — red

export interface Recommendation {
  /** Unique identifier */
  id: string;
  /** Display name of the recommended report */
  reportName: string;
  /** Module / data domain this report belongs to */
  module: string;
  /** Why this report is recommended */
  reason: RecommendationReasonType;
  /** Human-readable reason text */
  reasonText: string;
  /** Confidence score 0–1 */
  confidence: number;
  /** Optional subtitle / owner */
  subtitle?: string;
  /** Optional relative time string e.g. "2 hours ago" */
  timestamp?: string;
}

export interface IntelligenceWidgetProps {
  /** List of recommendations to display */
  recommendations: Recommendation[];
  /** Called when the user selects / clicks a recommendation card */
  onSelect: (rec: Recommendation) => void;
  /** Show loading skeleton instead of content */
  loading?: boolean;
  /** Optional title override */
  title?: string;
  /** Optional subtitle under the title */
  subtitle?: string;
  /** Max visible cards before scroll (default 5) */
  maxVisible?: number;
  /** CSS class for the container */
  className?: string;
}

// ─── Design Tokens ───────────────────────────────────────────────────────────
// sky     — time_based (scheduled/recurring)
// emerald — updated (upstream data changed)
// violet  — similar (similar to recently viewed)
// red     — anomaly (statistical anomaly)
// amber   — due (deadline/SLA approaching)

const TOKENS = {
  sky: {
    badgeBg:   'bg-sky-50 text-sky-700 ring-sky-200',
    badgeText: 'text-sky-700',
    icon:      'text-sky-500',
    border:    'border-sky-200',
    ring:      'focus-visible:ring-sky-400',
    confidenceBar: 'bg-sky-500',
  },
  emerald: {
    badgeBg:   'bg-emerald-50 text-emerald-700 ring-emerald-200',
    badgeText: 'text-emerald-700',
    icon:      'text-emerald-500',
    border:    'border-emerald-200',
    ring:      'focus-visible:ring-emerald-500',
    confidenceBar: 'bg-emerald-600',
  },
  violet: {
    badgeBg:   'bg-violet-50 text-violet-700 ring-violet-200',
    badgeText: 'text-violet-700',
    icon:      'text-violet-500',
    border:    'border-violet-200',
    ring:      'focus-visible:ring-violet-400',
    confidenceBar: 'bg-violet-500',
  },
  red: {
    badgeBg:   'bg-red-50 text-red-700 ring-red-200',
    badgeText: 'text-red-700',
    icon:      'text-red-500',
    border:    'border-red-200',
    ring:      'focus-visible:ring-red-400',
    confidenceBar: 'bg-red-500',
  },
  amber: {
    badgeBg:   'bg-amber-50 text-amber-800 ring-amber-200',
    badgeText: 'text-amber-800',
    icon:      'text-amber-500',
    border:    'border-amber-200',
    ring:      'focus-visible:ring-amber-400',
    confidenceBar: 'bg-amber-500',
  },
} as const;

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true">
    <path d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true">
    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const SparkleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true">
    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const AlertIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true">
    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const BoltIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true">
    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const ArrowIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true">
    <path d="M9 5l7 7-7 7" />
  </svg>
);

const BrainIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true">
    <path d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
  </svg>
);

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Returns a colour token key based on confidence tier. */
function confidenceTier(confidence: number): 'emerald' | 'amber' | 'red' {
  if (confidence >= 0.8) return 'emerald';
  if (confidence >= 0.6) return 'amber';
  return 'red';
}

const MODULE_ABBREV: Record<string, string> = {
  finance: 'FIN', operations: 'OPS', sales: 'SLS',
  inventory: 'INV', hr: 'HR', logistics: 'LOG',
};

function moduleAbbrev(module: string): string {
  const abbr = MODULE_ABBREV[module?.toLowerCase() ?? ''];
  return abbr ?? (module ?? '').slice(0, 3).toUpperCase();
}

interface ConfidenceBarProps {
  value: number; // 0–1
  tokenKey: 'sky' | 'emerald' | 'violet' | 'red' | 'amber';
}

const ConfidenceBar: React.FC<ConfidenceBarProps> = ({ value, tokenKey }) => {
  const pct = Math.round(value * 100);
  const t = TOKENS[tokenKey];

  return (
    <div className="flex items-center gap-2" aria-label={`Confidence: ${pct}%`}>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${t.confidenceBar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-500 tabular-nums w-9 text-right">
        {pct}%
      </span>
    </div>
  );
};

interface RecommendationCardProps {
  rec: Recommendation;
  onSelect: (rec: Recommendation) => void;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ rec, onSelect }) => {
  // Inline reason config lookup — avoids hoisting issue
  const reasonMeta: Record<string, { label: string; tokenKey: 'sky' | 'emerald' | 'violet' | 'red' | 'amber'; Icon: React.FC<{ className?: string }> }> = {
    time_based: { label: 'Scheduled', tokenKey: 'sky',     Icon: ClockIcon },
    updated:    { label: 'Updated',   tokenKey: 'emerald', Icon: RefreshIcon },
    similar:    { label: 'Similar',   tokenKey: 'violet',  Icon: SparkleIcon },
    due:        { label: 'Due Soon',  tokenKey: 'amber',   Icon: AlertIcon },
    anomaly:    { label: 'Anomaly',   tokenKey: 'red',     Icon: BoltIcon },
  };
  const cfg = reasonMeta[rec.reason] ?? reasonMeta['time_based'];
  const t = TOKENS[cfg.tokenKey];
  const barTier = confidenceTier(rec.confidence);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(rec)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(rec);
        }
      }}
      aria-label={`Recommendation: ${rec.reportName} — ${cfg.label}, ${Math.round(rec.confidence * 100)}% confidence`}
      className={`
        group relative bg-white rounded-xl border ${t.border}
        p-4 cursor-pointer
        hover:shadow-md hover:-translate-y-0.5
        transition-all duration-200 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${t.ring}
      `}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Left: module badge + report name */}
        <div className="flex items-start gap-3 min-w-0">
          {/* Module badge */}
          <span
            className={`shrink-0 mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-lg font-mono font-bold text-xs tracking-wide ${t.badgeBg}`}
            title={rec.module}
          >
            {moduleAbbrev(rec.module)}
          </span>

          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
              {rec.reportName}
            </h3>
            {rec.subtitle && (
              <p className="text-xs text-slate-400 mt-0.5 truncate">{rec.subtitle}</p>
            )}
          </div>
        </div>

        {/* Arrow indicator */}
        <span className={`shrink-0 mt-1 transition-transform duration-200 group-hover:translate-x-0.5 ${t.icon}`}>
          <ArrowIcon className="h-4 w-4" />
        </span>
      </div>

      {/* Reason row */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className={`${t.icon}`}>
          <cfg.Icon className="h-3.5 w-3.5" />
        </span>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${t.badgeBg}`}>
          {cfg.label}
        </span>
        <span className="text-xs text-slate-500 line-clamp-1">{rec.reasonText}</span>
      </div>

      {/* Confidence bar */}
      <ConfidenceBar value={rec.confidence} tokenKey={barTier} />
    </article>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const IntelligenceSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="flex flex-col gap-3" aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3"
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-200 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-3.5 bg-slate-200 rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-slate-100 rounded w-1/2 animate-pulse" />
          </div>
        </div>
        {/* Reason */}
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-slate-200 animate-pulse" />
          <div className="h-3 bg-slate-200 rounded w-16 animate-pulse" />
          <div className="h-3 bg-slate-100 rounded flex-1 animate-pulse" />
        </div>
        {/* Confidence bar */}
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-slate-300 rounded-full animate-pulse"
            style={{ width: `${55 + i * 12}%` }}
          />
        </div>
      </div>
    ))}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * IntelligenceWidget — displays a scrollable list of AI recommendations.
 *
 * @example
 * <IntelligenceWidget
 *   recommendations={[
 *     { id: '1', reportName: 'Q4 Revenue', module: 'Finance', reason: 'anomaly', reasonText: 'Unusual spike in Q4', confidence: 0.87 }
 *   ]}
 *   onSelect={(rec) => navigate(`/report/${rec.id}`)}
 * />
 */
export const IntelligenceWidget: React.FC<IntelligenceWidgetProps> = ({
  recommendations,
  onSelect,
  loading = false,
  title = 'AI Recommendations',
  subtitle = 'Based on your query history and data patterns',
  maxVisible = 5,
  className = '',
}) => {
  const [expanded, setExpanded] = React.useState(false);

  const visible = expanded ? recommendations : recommendations.slice(0, maxVisible);
  const hasMore = recommendations.length > maxVisible;

  return (
    <section
      aria-label={title}
      className={`flex flex-col ${className}`}
    >
      {/* Widget header */}
      <div className="flex items-center gap-2.5 mb-4 px-1">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 text-white shrink-0">
          <BrainIcon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 leading-none">{title}</h2>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {!loading && recommendations.length > 0 && (
          <span className="ml-auto shrink-0 text-xs font-semibold text-slate-400 tabular-nums">
            {recommendations.length} found
          </span>
        )}
      </div>

      {/* Content area */}
      {loading ? (
        <IntelligenceSkeleton count={3} />
      ) : recommendations.length === 0 ? (
        <EmptyState
          title="No recommendations yet"
          description="Recommendations will appear here as the AI learns your query patterns."
          variant="info"
          compact
          className="rounded-xl border border-slate-200 bg-slate-50"
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 overflow-y-auto">
            {visible.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} onSelect={onSelect} />
            ))}
          </div>

          {/* Show more / fewer */}
          {hasMore && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="
                  inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-semibold
                  text-slate-600 transition hover:bg-slate-100 hover:text-slate-950
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#167A3A]
                "
                aria-expanded={expanded}
              >
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                {expanded
                  ? 'Show fewer'
                  : `Show ${recommendations.length - maxVisible} more`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default IntelligenceWidget;
