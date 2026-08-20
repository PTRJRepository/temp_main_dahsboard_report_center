'use client'

export type WorkspaceTabId = 'ringkasan' | 'analisis' | 'detail' | 'audit'

export type ReportWorkspaceTabsProps = {
  value: WorkspaceTabId
  onChange: (tab: WorkspaceTabId) => void
  showAudit?: boolean
  className?: string
}

const TABS: Array<{ id: WorkspaceTabId; label: string; hint: string }> = [
  { id: 'ringkasan', label: 'Ringkasan', hint: 'KPI & scope' },
  { id: 'analisis', label: 'Analisis', hint: 'chart / AI / quality' },
  { id: 'detail', label: 'Detail Data', hint: 'tabel virtual' },
  { id: 'audit', label: 'Audit', hint: 'SQL / metadata' },
]

export function ReportWorkspaceTabs({
  value,
  onChange,
  showAudit = true,
  className,
}: ReportWorkspaceTabsProps) {
  const tabs = TABS.filter((tab) => showAudit || tab.id !== 'audit')
  return (
    <div
      className={['mt-3 flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-black/20 p-1.5', className].filter(Boolean).join(' ')}
      role="tablist"
      aria-label="Workspace report"
    >
      {tabs.map((tab) => {
        const active = value === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={
              active
                ? 'inline-flex min-w-[120px] flex-col rounded-lg border border-lime-300/40 bg-lime-400/15 px-3 py-2 text-left text-lime-50 shadow-[0_0_0_1px_rgba(163,230,53,0.12)]'
                : 'inline-flex min-w-[120px] flex-col rounded-lg border border-transparent px-3 py-2 text-left text-white/65 hover:border-white/10 hover:bg-white/5 hover:text-white'
            }
          >
            <span className="text-xs font-black uppercase tracking-[0.12em]">{tab.label}</span>
            <span className={`mt-0.5 text-[10px] font-semibold ${active ? 'text-lime-100/80' : 'text-white/40'}`}>{tab.hint}</span>
          </button>
        )
      })}
    </div>
  )
}

export default ReportWorkspaceTabs
