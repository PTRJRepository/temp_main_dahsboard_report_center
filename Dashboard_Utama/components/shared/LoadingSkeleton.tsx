/**
 * LoadingSkeleton.tsx
 * Configurable skeleton / shimmer loading placeholders for cards, rows, and text blocks.
 */

import React from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LoadingSkeletonProps {
  /** Shape variant */
  variant?: 'text' | 'card' | 'row' | 'circle' | 'rect' | 'chart';
  /** Width (CSS value) */
  width?: string;
  /** Height (CSS value) */
  height?: string;
  /** Number of items (for list/row variants) */
  count?: number;
  /** CSS class override */
  className?: string;
  /** aria-label for accessibility */
  ariaLabel?: string;
}

export interface SkeletonCardProps {
  /** Number of skeleton cards to render */
  count?: number;
  /** Show avatar / icon placeholder */
  showAvatar?: boolean;
  /** Show action buttons */
  showActions?: boolean;
  /** Lines of text (per card) */
  lines?: number;
  /** Gap between cards */
  gap?: string;
  /** className override */
  className?: string;
}

export interface SkeletonTableProps {
  /** Number of rows */
  rowCount?: number;
  /** Number of columns */
  colCount?: number;
  /** Show table header */
  showHeader?: boolean;
  /** Gap between rows */
  gap?: string;
  /** className override */
  className?: string;
}

// ─── Shimmer animation style (injected once) ──────────────────────────────────

const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

// ─── Hook to inject keyframes once ────────────────────────────────────────────

let injected = false;
const injectShimmer = () => {
  if (injected) return;
  injected = true;
  if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = shimmerKeyframes;
    document.head.appendChild(style);
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SkeletonBase: React.FC<{
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}> = ({ className = '', style, ariaLabel }) => {
  if (typeof document !== 'undefined') injectShimmer();

  return (
    <div
      role="status"
      aria-label={ariaLabel ?? 'Loading…'}
      className={`skeleton-shimmer rounded bg-slate-200 ${className}`}
      style={{
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.6s ease-in-out infinite',
        ...style,
      }}
    />
  );
};

// ─── Variants ─────────────────────────────────────────────────────────────────

/**
 * LoadingSkeleton — single shimmer placeholder.
 *
 * @example
 * <LoadingSkeleton variant="text" width="60%" />
 */
export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'text',
  width,
  height,
  count,
  className = '',
  ariaLabel,
}) => {
  const defaults = {
    text: { height: '0.875rem', width: width ?? '100%', className: 'rounded h-3.5' },
    card: { height: height ?? '120px', width: width ?? '100%', className: 'rounded-xl h-28' },
    row: { height: height ?? '3rem', width: width ?? '100%', className: 'rounded h-12' },
    circle: {
      height: height ?? '2.5rem',
      width: width ?? '2.5rem',
      className: 'rounded-full',
    },
    rect: { height: height ?? '5rem', width: width ?? '100%', className: 'rounded-lg' },
    chart: { height: height ?? '4rem', width: width ?? '100%', className: 'rounded-lg h-16' },
  };

  const d = defaults[variant];
  const items = Array.from({ length: count ?? 1 }, (_, i) => i);

  return (
    <>
      {items.map((i) => (
        <SkeletonBase
          key={i}
          className={`${d.className} ${className}`}
          style={{ height: height ?? d.height, width: width ?? d.width, flexShrink: 0 }}
          ariaLabel={ariaLabel}
        />
      ))}
    </>
  );
};

/**
 * SkeletonCard — 1-N placeholder cards.
 *
 * @example
 * <SkeletonCard count={3} showAvatar showActions />
 */
export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  count = 1,
  showAvatar = false,
  showActions = false,
  lines = 3,
  gap = 'gap-4',
  className = '',
}) => (
  <div className={`grid auto-rows-auto ${gap} ${className}`}>
    {Array.from({ length: count }, (_, cardIdx) => (
      <div
        key={cardIdx}
        className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3"
        aria-hidden="true"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          {showAvatar && (
            <SkeletonBase className="w-10 h-10 rounded-full shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <SkeletonBase className="h-3.5 w-1/3 rounded" />
            <SkeletonBase className="h-2.5 w-1/4 rounded" />
          </div>
        </div>

        {/* Text lines */}
        {Array.from({ length: lines }, (_, i) => (
          <SkeletonBase
            key={i}
            className="h-2.5 rounded"
            style={{ width: i === lines - 1 ? '60%' : '100%' }}
          />
        ))}

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2 pt-1">
            <SkeletonBase className="h-8 w-20 rounded-lg" />
            <SkeletonBase className="h-8 flex-1 rounded-lg" />
          </div>
        )}
      </div>
    ))}
  </div>
);

/**
 * SkeletonTable — placeholder table with configurable rows/cols.
 *
 * @example
 * <SkeletonTable rowCount={5} colCount={4} showHeader />
 */
export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rowCount = 5,
  colCount = 4,
  showHeader = true,
  gap = 'gap-2',
  className = '',
}) => (
  <div className={`flex flex-col ${gap} ${className}`} aria-hidden="true">
    {/* Header row */}
    {showHeader && (
      <div className="flex gap-3 px-4 py-2">
        {Array.from({ length: colCount }, (_, i) => (
          <SkeletonBase key={i} className="h-3 rounded flex-1" style={{ flex: 1 }} />
        ))}
      </div>
    )}

    {/* Data rows */}
    {Array.from({ length: rowCount }, (_, r) => (
      <div
        key={r}
        className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-slate-100"
      >
        {Array.from({ length: colCount }, (_, c) => (
          <SkeletonBase
            key={c}
            className="h-3 rounded"
            style={{ flex: 1 }}
          />
        ))}
      </div>
    ))}
  </div>
);

export default LoadingSkeleton;