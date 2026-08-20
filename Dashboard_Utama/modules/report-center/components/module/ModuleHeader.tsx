import React from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ModuleHeaderProps {
  /** Display title */
  title: string;
  /** Subtitle / description */
  subtitle?: string;
  /** Optional badge text (e.g. "v2.1", "BETA") */
  badge?: string;
  /** Icon or avatar element rendered before the title */
  icon?: React.ReactNode;
  /** Right-side action area */
  actions?: React.ReactNode;
  /** Breadcrumb trail */
  breadcrumbs?: { label: string; href?: string }[];
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ModuleHeader: React.FC<ModuleHeaderProps> = ({
  title,
  subtitle,
  badge,
  icon,
  actions,
  breadcrumbs,
  className = '',
}) => {
  return (
    <header
      className={`flex flex-col gap-3 border-b border-slate-200 bg-white px-6 py-5 ${className}`}
      aria-label={`Module header: ${title}`}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1 text-xs text-slate-400">
            {breadcrumbs.map((crumb, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true">/</span>}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="hover:text-slate-600 transition-colors"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className={i === breadcrumbs.length - 1 ? 'text-slate-700 font-medium' : ''}>
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Icon */}
          {icon && (
            <span className="flex-shrink-0 text-slate-500 mt-0.5" aria-hidden="true">
              {icon}
            </span>
          )}

          {/* Title block */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-900 truncate leading-tight">
                {title}
              </h1>
              {badge && (
                <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-500">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="mt-0.5 text-sm text-slate-500 leading-snug">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right-side actions */}
        {actions && (
          <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
};

export default ModuleHeader;
