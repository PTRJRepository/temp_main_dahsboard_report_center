/**
 * EmptyState.tsx
 * Placeholder UI when a list, search, or panel has no content to display.
 */

import React from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  /** Primary message */
  title: string;
  /** Optional secondary description */
  description?: string;
  /** Optional illustration / icon */
  illustration?: React.ReactNode;
  /** Optional illustration SVG path or image URL */
  illustrationSrc?: string;
  /** Optional call-to-action button */
  action?: React.ReactNode;
  /** 'info' | 'warning' | 'error' | 'search' | 'custom' (default 'info') */
  variant?: 'info' | 'warning' | 'error' | 'search' | 'custom';
  /** CSS class for the container */
  className?: string;
  /** Center align content */
  centered?: boolean;
  /** HTML id */
  id?: string;
  /** Compact — remove extra vertical spacing */
  compact?: boolean;
}

// ─── Default illustrations ────────────────────────────────────────────────────

const DatabaseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

const SearchXIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    <path d="M13 13l6 6m0-6l-6 6" />
  </svg>
);

const ExclamationIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * EmptyState — shown when a list/panel is empty.
 *
 * @example
 * <EmptyState
 *   title="No results found"
 *   description="Try adjusting your search filters."
 *   variant="search"
 *   action={<button onClick={clearFilters}>Clear filters</button>}
 * />
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  illustration,
  illustrationSrc,
  action,
  variant = 'info',
  className = '',
  centered = true,
  id,
  compact = false,
}) => {
  // Pick default illustration based on variant
  const defaultIllustration = (() => {
    const base = 'h-12 w-12 text-slate-300 mb-4';
    switch (variant) {
      case 'search':
        return <SearchXIcon className={`${base} text-slate-400`} />;
      case 'error':
        return <ExclamationIcon className={`${base} text-red-400`} />;
      case 'warning':
        return <ExclamationIcon className={`${base} text-amber-400`} />;
      default:
        return <DatabaseIcon className={`${base} text-slate-300`} />;
    }
  })();

  const content = (
    <div
      id={id}
      className={`
        flex flex-col
        ${centered ? 'items-center justify-center text-center' : 'items-start'}
        ${compact ? 'py-4' : 'py-8 px-4'}
        ${className}
      `}
      role="status"
      aria-live="polite"
    >
      {/* Illustration */}
      <div className="mb-3">
        {illustrationSrc ? (
          <img
            src={illustrationSrc}
            alt=""
            className="h-16 w-16 object-contain opacity-60"
          />
        ) : illustration ? (
          <div className="flex items-center justify-center">{illustration}</div>
        ) : (
          defaultIllustration
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
          {description}
        </p>
      )}

      {/* Action */}
      {action && (
        <div className="mt-4">{action}</div>
      )}
    </div>
  );

  // Wrap in a visually distinct container for variants
  if (variant === 'error' || variant === 'warning') {
    return (
      <div
        className={`
          rounded-xl border
          ${variant === 'error' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}
          ${compact ? 'p-4' : 'p-6'}
        `}
      >
        {content}
      </div>
    );
  }

  return content;
};

export default EmptyState;