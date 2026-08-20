'use client'

import type { ReactNode } from 'react'

export type ReportCommand = {
  id: string
  label: string
  icon?: ReactNode
  description?: string
  selected?: boolean
  disabled?: boolean
  loading?: boolean
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  onClick?: () => void
}

export type ReportCommandBarProps = {
  contextSlot?: ReactNode
  searchSlot?: ReactNode
  filterSlot?: ReactNode
  commands?: ReportCommand[]
  aiSlot?: ReactNode
  exportSlot?: ReactNode
  className?: string
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function ReportCommandBar({
  contextSlot,
  searchSlot,
  filterSlot,
  commands = [],
  aiSlot,
  exportSlot,
  className,
}: ReportCommandBarProps) {
  return (
    <div className={cx('rc-command-bar', className)} role="toolbar" aria-label="Report controls">
      {contextSlot ? <div className="rc-command-bar__context">{contextSlot}</div> : null}
      {searchSlot ? <div className="rc-command-bar__search">{searchSlot}</div> : null}
      {filterSlot ? <div className="rc-command-bar__filters">{filterSlot}</div> : null}

      {commands.length ? (
        <div className="rc-command-bar__actions" aria-label="Primary report actions">
          {commands.map((command) => (
            <button
              key={command.id}
              type="button"
              onClick={command.onClick}
              disabled={command.disabled || command.loading}
              aria-pressed={command.selected || undefined}
              className={cx(
                'rc-command-bar__button',
                `rc-command-bar__button--${command.tone ?? 'default'}`,
                command.selected && 'is-selected',
                command.loading && 'is-loading',
              )}
            >
              {command.icon ? <span className="rc-command-bar__icon">{command.icon}</span> : null}
              <span className="rc-command-bar__label">{command.loading ? 'Memproses...' : command.label}</span>
              {command.description ? <span className="rc-command-bar__description">{command.description}</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {(aiSlot || exportSlot) ? (
        <div className="rc-command-bar__edge-actions">
          {aiSlot}
          {exportSlot}
        </div>
      ) : null}
    </div>
  )
}

export default ReportCommandBar
