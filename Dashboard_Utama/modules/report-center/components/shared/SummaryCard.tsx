/**
 * SummaryCard.tsx
 * Stat card for displaying a single key metric with optional trend, icon, and actions.
 */

import React from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SummaryCardProps {
  /** Primary metric value (large) */
  value: string | number;
  /** Label / title */
  label: string;
  /** Optional description or sub-label */
  description?: string;
  /** Trend indicator: positive = up, negative = down, neutral = flat */
  trend?: 'up' | 'down' | 'neutral';
  /** Trend change (e.g. "+12.5%") */
  trendValue?: string;
  /** Trend description (e.g. "vs last month") */
  trendDescription?: string;
  /** Icon to display in the header */
  icon?: React.ReactNode;
  /** Icon background color class */
  iconBg?: string;
  /** Icon color class */
  iconColor?: string;
  /** Card accent/emphasis color (top border or bg tint) */
  accentColor?: string;
  /** What to show in the top-right corner */
  badge?: React.ReactNode;
  /** Optional clickable — renders as a button */
  onClick?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Error message to display instead of value */
  error?: string;
  /** CSS class for container */
  className?: string;
  /** Link href — wraps value area as an anchor */
  href?: string;
  /** HTML id */
  id?: string;
  /** 'sm' | 'md' (default) | 'lg' */
  size?: 'sm' | 'md' | 'lg';
  /** Divider between sections */
  showDivider?: boolean;
  /** Footer slot */
  footer?: React.ReactNode;
  /** Skeleton shimmer variant: 'text' | 'chart' | 'both' */
  skeletonVariant?: 'text' | 'chart' | 'both';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TrendArrow: React.FC<{ direction: 'up' | 'down' | 'neutral'; className?: string }> = ({
  direction,
  className = '',
}) => {
  if (direction === 'neutral') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-label="No change"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
      </svg>
    );
  }

  if (direction === 'up') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-label="Increasing"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l5-5 5 5M7 7l5 5 5-5" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-label="Decreasing"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-5 5-5-5m10 10l-5-5-5 5" />
    </svg>
  );
};

const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`animate-pulse bg-slate-200 rounded ${className}`}
    aria-hidden="true"
  />
);

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * SummaryCard — displays a single KPI with optional trend and icon.
 *
 * @example
 * <SummaryCard
 *   label="Total Queries"
 *   value={1247}
 *   trend="up"
 *   trendValue="+8.2%"
 *   trendDescription="vs last week"
 *   icon={<DatabaseIcon />}
 * />
 */
export const SummaryCard: React.FC<SummaryCardProps> = ({
  value,
  label,
  description,
  trend,
  trendValue,
  trendDescription,
  icon,
  iconBg = 'bg-indigo-100',
  iconColor = 'text-indigo-600',
  accentColor,
  badge,
  onClick,
  loading = false,
  error,
  className = '',
  href,
  id,
  size = 'md',
  showDivider = false,
  footer,
  skeletonVariant = 'both',
}) => {
  const accentBorder = accentColor ? `border-t-4 border-t-[${accentColor}]` : '';
  const hasTrend = trend !== undefined || trendValue !== undefined;

  const sizeTokens = {
    sm: { value: 'text-xl', label: 'text-xs', iconWrap: 'h-8 w-8', desc: 'text-xs' },
    md: { value: 'text-2xl', label: 'text-sm', iconWrap: 'h-10 w-10', desc: 'text-xs' },
    lg: { value: 'text-3xl', label: 'text-base', iconWrap: 'h-12 w-12', desc: 'text-sm' },
  };
  const t = sizeTokens[size];

  const cardBase = `
    bg-white rounded-xl border border-slate-200 shadow-sm
    flex flex-col overflow-hidden
    ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 transition-shadow duration-200' : ''}
    ${accentBorder}
  `;

  const Inner: React.FC<React.HTMLAttributes<HTMLDivElement>> = (props) => (
    <div id={id} className={`${cardBase} ${className}`} {...props} />
  );

  const body = (
    <div className="p-4 flex-1">
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon && (
            <div className={`${iconBg} ${t.iconWrap} rounded-lg flex items-center justify-center shrink-0`}>
              <span className={`${iconColor} ${size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'}`}>
                {icon}
              </span>
            </div>
          )}
          <span className={`${t.label} font-semibold text-slate-500 uppercase tracking-wide`}>
            {label}
          </span>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {skeletonVariant !== 'chart' && <SkeletonBlock className={`h-6 w-24 ${t.value.replace('text-', '')}`} />}
          {skeletonVariant !== 'text' && (
            <SkeletonBlock className="h-8 w-full rounded" />
          )}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <p className="text-sm text-red-500 font-medium">{error}</p>
      )}

      {/* Value */}
      {!loading && !error && (
        <>
          <p className={`${t.value} font-bold text-slate-900 tracking-tight leading-none mb-1`}>
            {value}
          </p>
          {description && (
            <p className={`${t.desc} text-slate-500 mt-0.5`}>{description}</p>
          )}
        </>
      )}

      {/* Trend */}
      {!loading && !error && hasTrend && (
        <div className="flex items-center gap-1.5 mt-2">
          {trend && (
            <span
              className={`
                flex items-center gap-0.5 text-xs font-semibold
                ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-slate-400'}
              `}
            >
              <TrendArrow direction={trend} className="h-3.5 w-3.5" />
              {trendValue}
            </span>
          )}
          {trendDescription && (
            <span className="text-xs text-slate-400">{trendDescription}</span>
          )}
        </div>
      )}

      {/* Divider */}
      {showDivider && !loading && !error && footer && (
        <div className="border-t border-slate-100 mt-3" />
      )}
    </div>
  );

  const footerEl = footer && !loading && !error ? (
    <div className="px-4 pb-4">{footer}</div>
  ) : null;

  if (href) {
    return (
      <a href={href} className={`${cardBase} ${className} no-underline`} aria-label={`${label}: ${value}`}>
        {body}
        {footerEl}
      </a>
    );
  }

  if (onClick) {
    return (
      <Inner onClick={onClick} role="button" tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && onClick()}>
        {body}
        {footerEl}
      </Inner>
    );
  }

  return (
    <Inner aria-label={`${label}: ${value}`}>
      {body}
      {footerEl}
    </Inner>
  );
};

export default SummaryCard;