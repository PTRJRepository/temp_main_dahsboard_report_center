import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ModuleStatusBannerProps {
  /** Visual and semantic variant */
  type: 'info' | 'warning' | 'error' | 'success';
  /** Primary message (bold) */
  message: string;
  /** Secondary explanation text */
  description?: string;
  /** Show dismiss (×) button */
  dismissible?: boolean;
  /** Called when banner is dismissed */
  onDismiss?: () => void;
  /** Optional CTA button rendered right-aligned */
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const BANNER_CONFIG = {
  info: {
    wrapperClass: 'bg-blue-50 border-blue-200',
    textClass: 'text-blue-800',
    subtextClass: 'text-blue-700',
    icon: <Info size={16} aria-hidden="true" />,
    iconClass: 'text-blue-500',
  },
  warning: {
    wrapperClass: 'bg-amber-50 border-amber-200',
    textClass: 'text-amber-800',
    subtextClass: 'text-amber-700',
    icon: <AlertTriangle size={16} aria-hidden="true" />,
    iconClass: 'text-amber-500',
  },
  error: {
    wrapperClass: 'bg-red-50 border-red-200',
    textClass: 'text-red-800',
    subtextClass: 'text-red-700',
    icon: <AlertCircle size={16} aria-hidden="true" />,
    iconClass: 'text-red-500',
  },
  success: {
    wrapperClass: 'bg-emerald-50 border-emerald-200',
    textClass: 'text-emerald-800',
    subtextClass: 'text-emerald-700',
    icon: <CheckCircle size={16} aria-hidden="true" />,
    iconClass: 'text-emerald-500',
  },
} as const;

// ─── Component ───────────────────────────────────────────────────────────────

export const ModuleStatusBanner: React.FC<ModuleStatusBannerProps> = ({
  type,
  message,
  description,
  dismissible = false,
  onDismiss,
  action,
  className = '',
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const config = BANNER_CONFIG[type];

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border
        ${config.wrapperClass} ${config.textClass} ${className}
      `}
    >
      {/* Icon */}
      <span className={`flex-shrink-0 mt-0.5 ${config.iconClass}`}>
        {config.icon}
      </span>

      {/* Text block */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-snug ${config.textClass}`}>
          {message}
        </p>
        {description && (
          <p className={`mt-0.5 text-xs leading-relaxed ${config.subtextClass}`}>
            {description}
          </p>
        )}
      </div>

      {/* Action button */}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={`
            flex-shrink-0 text-xs font-medium px-3 py-1 rounded
            border transition-colors cursor-pointer
            ${type === 'info'
              ? 'border-blue-300 text-blue-700 hover:bg-blue-100'
              : type === 'warning'
              ? 'border-amber-300 text-amber-700 hover:bg-amber-100'
              : type === 'error'
              ? 'border-red-300 text-red-700 hover:bg-red-100'
              : 'border-emerald-300 text-emerald-700 hover:bg-emerald-100'
            }
          `}
        >
          {action.label}
        </button>
      )}

      {/* Dismiss */}
      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          className={`
            flex-shrink-0 p-0.5 rounded transition-colors cursor-pointer
            hover:bg-black/5 ${config.subtextClass}
          `}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default ModuleStatusBanner;
