/**
 * ReportSummary.tsx
 * Row of SummaryCard components for report KPI metrics (5-6 cards in responsive grid).
 */

import React from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MetricItem {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  trendDescription?: string;
  description?: string;
  accentColor?: string;
  badge?: React.ReactNode;
  loading?: boolean;
  error?: string;
  onClick?: () => void;
  href?: string;
}

export interface ReportSummaryProps {
  /** Array of metric cards to display */
  metrics: MetricItem[];
  /** Loading state (shows skeleton cards) */
  loading?: boolean;
  /** CSS class for container */
  className?: string;
  /** Card layout: 'grid' | 'row' | 'col' */
  layout?: 'grid' | 'row';
  /** Columns per row on desktop (grid layout) */
  columns?: 2 | 3 | 4 | 5 | 6;
}

// ─── Trend arrow SVG ──────────────────────────────────────────────────────────

const TrendArrowUp: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l5-5 5 5M7 7l5 5 5-5" />
  </svg>
);

const TrendArrowDown: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-5 5-5-5m10 10l-5-5-5 5" />
  </svg>
);

const TrendArrowNeutral: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
  </svg>
);

// ─── Single Metric Card ───────────────────────────────────────────────────────

interface MetricCardProps {
  metric: MetricItem;
  accentColor?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ metric, accentColor }) => {
  const iconBg = metric.iconBg ?? 'bg-green-50';
  const iconColor = metric.iconColor ?? 'text-green-700';

  const TrendIcon = metric.trend === 'up'
    ? TrendArrowUp
    : metric.trend === 'down'
    ? TrendArrowDown
    : TrendArrowNeutral;

  const trendColor = metric.trend === 'up'
    ? 'text-emerald-600'
    : metric.trend === 'down'
    ? 'text-red-500'
    : 'text-slate-400';

  const card = (
    <div
      role="region"
      aria-label={`${metric.label}: ${metric.value}${metric.unit ? ` ${metric.unit}` : ''}`}
      className={`bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col
        hover:shadow-md hover:border-slate-300 transition-shadow duration-200
        ${accentColor ? `border-t-4 border-t-[${accentColor}]` : ''}
        ${metric.onClick ? 'cursor-pointer' : ''}`}
      onClick={metric.onClick}
    >
      <div className="p-4 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {metric.icon && (
              <div className={`${iconBg} h-9 w-9 rounded-lg flex items-center justify-center shrink-0`}>
                <span className={`${iconColor} h-4.5 w-4.5 flex`}>{metric.icon}</span>
              </div>
            )}
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">
              {metric.label}
            </span>
          </div>
          {metric.badge && <div className="shrink-0">{metric.badge}</div>}
        </div>

        {/* Value */}
        <p className="text-2xl font-bold text-slate-900 tracking-tight leading-none mb-1">
          {metric.value}
          {metric.unit && (
            <span className="text-sm font-medium text-slate-400 ml-1">{metric.unit}</span>
          )}
        </p>

        {metric.description && (
          <p className="text-xs text-slate-500 mt-0.5">{metric.description}</p>
        )}

        {/* Trend */}
        {(metric.trend || metric.trendValue) && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`flex items-center gap-0.5 text-xs font-semibold ${trendColor}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              {metric.trendValue}
            </span>
            {metric.trendDescription && (
              <span className="text-xs text-slate-400">{metric.trendDescription}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (metric.href) {
    return (
      <a
        href={metric.href}
        aria-label={`${metric.label}: ${metric.value}`}
        className="block no-underline"
        onClick={(e) => metric.onClick && e.preventDefault()}
      >
        {card}
      </a>
    );
  }

  return card;
};

// ─── Skeleton Card ───────────────────────────────────────────────────────────

const SkeletonCard: React.FC = () => (
  <div
    role="status"
    aria-label="Loading metric"
    className="bg-white rounded-xl border border-slate-200 shadow-sm p-4"
  >
    <div className="flex items-center gap-2 mb-4">
      <div className="animate-pulse bg-slate-200 h-9 w-9 rounded-lg" />
      <div className="animate-pulse bg-slate-200 h-3 w-24 rounded" />
    </div>
    <div className="animate-pulse bg-slate-200 h-8 w-20 rounded mb-1" />
    <div className="animate-pulse bg-slate-100 h-3 w-32 rounded" />
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const ACCENT_COLORS = [
  '#167A3A', '#D9A514', '#1D4ED8', '#9333EA', '#DB2777', '#EA580C',
];

/**
 * ReportSummary — row of metric cards for a report page.
 *
 * @example
 * <ReportSummary
 *   metrics={[
 *     { label: 'Total Transaksi', value: '1,248', trend: 'up', trendValue: '+12.5%' },
 *     { label: 'Total Nilai', value: 'Rp 45.2M', icon: <DollarIcon /> },
 *   ]}
 *   loading={isLoading}
 * />
 */
export const ReportSummary: React.FC<ReportSummaryProps> = ({
  metrics,
  loading = false,
  className = '',
  layout = 'grid',
  columns = 4,
}) => {
  const gridCols: Record<number, string> = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6',
  };

  const colClass = gridCols[columns] ?? gridCols[4];

  if (loading) {
    return (
      <div className={`grid ${colClass} gap-4 ${className}`} aria-busy="true">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Report summary metrics"
      className={`${layout === 'row' ? 'flex flex-wrap gap-4' : `grid ${colClass} gap-4`} ${className}`}
    >
      {metrics.map((metric, i) => (
        <MetricCard
          key={metric.label}
          metric={metric}
          accentColor={metric.accentColor ?? (i < ACCENT_COLORS.length ? ACCENT_COLORS[i] : undefined)}
        />
      ))}
    </div>
  );
};

export default ReportSummary;