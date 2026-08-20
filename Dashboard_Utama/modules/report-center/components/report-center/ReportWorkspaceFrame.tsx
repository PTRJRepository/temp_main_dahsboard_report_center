'use client'

import type { ReactNode } from 'react'

type WorkspaceCrumb = {
  label: string
  href?: string
}

export type ReportWorkspaceFrameProps = {
  eyebrow?: string
  title: string
  description?: string
  breadcrumbs?: WorkspaceCrumb[]
  statusSlot?: ReactNode
  commandSlot?: ReactNode
  insightSlot?: ReactNode
  asideSlot?: ReactNode
  footerSlot?: ReactNode
  children: ReactNode
  className?: string
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function ReportWorkspaceFrame({
  eyebrow,
  title,
  description,
  breadcrumbs,
  statusSlot,
  commandSlot,
  insightSlot,
  asideSlot,
  footerSlot,
  children,
  className,
}: ReportWorkspaceFrameProps) {
  return (
    <section className={cx('rc-workspace-frame', className)} aria-labelledby="report-workspace-title">
      <div className="rc-workspace-frame__ambient" aria-hidden="true" />
      <header className="rc-workspace-frame__header">
        <div className="min-w-0">
          {breadcrumbs?.length ? (
            <nav className="rc-workspace-frame__breadcrumbs" aria-label="Report breadcrumb">
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} className="rc-workspace-frame__crumb">
                  {crumb.href ? <a href={crumb.href}>{crumb.label}</a> : crumb.label}
                </span>
              ))}
            </nav>
          ) : null}
          {eyebrow ? <p className="rc-workspace-frame__eyebrow">{eyebrow}</p> : null}
          <div className="rc-workspace-frame__title-row">
            <h1 id="report-workspace-title" className="rc-workspace-frame__title">{title}</h1>
            {statusSlot ? <div className="rc-workspace-frame__status">{statusSlot}</div> : null}
          </div>
          {description ? <p className="rc-workspace-frame__description">{description}</p> : null}
        </div>
        {insightSlot ? <aside className="rc-workspace-frame__insight">{insightSlot}</aside> : null}
      </header>

      {commandSlot ? <div className="rc-workspace-frame__commands">{commandSlot}</div> : null}

      <div className={asideSlot ? 'rc-workspace-frame__grid' : 'rc-workspace-frame__grid rc-workspace-frame__grid--single'}>
        <div className="rc-workspace-frame__main">{children}</div>
        {asideSlot ? <aside className="rc-workspace-frame__aside">{asideSlot}</aside> : null}
      </div>

      {footerSlot ? <footer className="rc-workspace-frame__footer">{footerSlot}</footer> : null}
    </section>
  )
}

export default ReportWorkspaceFrame
