'use client'

import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Loader2, RefreshCw, SearchX, WifiOff } from 'lucide-react'

export type ReportStateKind =
  | 'loading'
  | 'empty'
  | 'partial'
  | 'stale'
  | 'ai-unavailable'
  | 'recoverable-error'
  | 'fatal-error'
  | 'success'

export type ReportStateAction = {
  label: string
  onClick?: () => void
  href?: string
  tone?: 'primary' | 'secondary' | 'danger'
}

export type ReportStatePanelProps = {
  state: ReportStateKind
  title: string
  description?: string
  meta?: ReactNode
  actions?: ReportStateAction[]
  compact?: boolean
  className?: string
}

const stateIcon = {
  loading: Loader2,
  empty: SearchX,
  partial: Clock3,
  stale: RefreshCw,
  'ai-unavailable': WifiOff,
  'recoverable-error': AlertTriangle,
  'fatal-error': AlertTriangle,
  success: CheckCircle2,
} satisfies Record<ReportStateKind, typeof AlertTriangle>

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function ReportStatePanel({
  state,
  title,
  description,
  meta,
  actions = [],
  compact,
  className,
}: ReportStatePanelProps) {
  const Icon = stateIcon[state]

  return (
    <section
      className={cx('rc-state-panel', `rc-state-panel--${state}`, compact && 'rc-state-panel--compact', className)}
      role={state === 'fatal-error' || state === 'recoverable-error' ? 'alert' : 'status'}
      aria-live={state === 'loading' ? 'polite' : undefined}
    >
      <div className="rc-state-panel__icon" aria-hidden="true">
        <Icon size={compact ? 18 : 24} className={state === 'loading' ? 'rc-state-panel__spin' : undefined} />
      </div>
      <div className="rc-state-panel__body">
        <h2 className="rc-state-panel__title">{title}</h2>
        {description ? <p className="rc-state-panel__description">{description}</p> : null}
        {meta ? <div className="rc-state-panel__meta">{meta}</div> : null}
        {actions.length ? (
          <div className="rc-state-panel__actions">
            {actions.map((action) => {
              const className = cx('rc-state-panel__action', `rc-state-panel__action--${action.tone ?? 'secondary'}`)
              return action.href ? (
                <a key={action.label} href={action.href} className={className}>{action.label}</a>
              ) : (
                <button key={action.label} type="button" onClick={action.onClick} className={className}>
                  {action.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default ReportStatePanel
