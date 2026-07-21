'use client'

import type { ReactNode } from 'react'

export type AnalyticsKpiStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export type AnalyticsKpiItem = {
  id: string
  label: string
  value: string | number | null
  unit?: string
  helper?: string
  trend?: string
  icon?: ReactNode
  status?: AnalyticsKpiStatus
  selected?: boolean
  loading?: boolean
  disabled?: boolean
  onSelect?: () => void
}

export type AnalyticsKpiStripProps = {
  items: AnalyticsKpiItem[]
  title?: string
  description?: string
  className?: string
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function displayValue(value: AnalyticsKpiItem['value']) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') return value.toLocaleString('id-ID', { maximumFractionDigits: 2 })
  return value
}

export function AnalyticsKpiStrip({ items, title, description, className }: AnalyticsKpiStripProps) {
  return (
    <section className={cx('rc-kpi-strip', className)} aria-label={title ?? 'Report KPI'}>
      {(title || description) ? (
        <div className="rc-kpi-strip__header">
          {title ? <h2 className="rc-kpi-strip__title">{title}</h2> : null}
          {description ? <p className="rc-kpi-strip__description">{description}</p> : null}
        </div>
      ) : null}

      <div className="rc-kpi-strip__grid">
        {items.map((item) => {
          const interactive = Boolean(item.onSelect) && !item.disabled && !item.loading
          const content = (
            <>
              <span className="rc-kpi-strip__topline">
                {item.icon ? <span className="rc-kpi-strip__icon">{item.icon}</span> : null}
                <span className="rc-kpi-strip__label">{item.label}</span>
                <span className="rc-kpi-strip__status">{item.status ?? 'neutral'}</span>
              </span>
              <strong className="rc-kpi-strip__value">
                {item.loading ? '...' : displayValue(item.value)}
                {item.unit ? <span>{item.unit}</span> : null}
              </strong>
              {(item.helper || item.trend) ? (
                <span className="rc-kpi-strip__meta">
                  {item.trend ? <em>{item.trend}</em> : null}
                  {item.helper ? <span>{item.helper}</span> : null}
                </span>
              ) : null}
            </>
          )

          return interactive ? (
            <button
              key={item.id}
              type="button"
              onClick={item.onSelect}
              className={cx('rc-kpi-strip__item', `rc-kpi-strip__item--${item.status ?? 'neutral'}`, item.selected && 'is-selected')}
              aria-pressed={item.selected || undefined}
            >
              {content}
            </button>
          ) : (
            <article
              key={item.id}
              className={cx('rc-kpi-strip__item', `rc-kpi-strip__item--${item.status ?? 'neutral'}`, item.disabled && 'is-disabled', item.loading && 'is-loading')}
            >
              {content}
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default AnalyticsKpiStrip
