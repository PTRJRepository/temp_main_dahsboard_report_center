export default function ReportDetailLoading() {
    return (
        <div className="p-6 lg:p-8 space-y-5" aria-busy="true">
            {/* Header row: title + actions */}
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                    <div className="h-7 w-72 max-w-full rounded bg-black/[0.07] animate-pulse" />
                    <div className="h-3.5 w-96 max-w-full rounded bg-black/[0.05] animate-pulse" />
                </div>
                <div className="flex gap-2">{[...Array(3)].map((_, i) => <div key={i} className="h-9 w-24 rounded-lg bg-black/[0.05] animate-pulse" />)}</div>
            </div>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-black/5 p-4 space-y-2" style={{ animation: `fade-up 0.3s var(--ease-out) ${i * 60}ms both` }}>
                        <div className="h-3 w-20 rounded bg-black/[0.05] animate-pulse" />
                        <div className="h-6 w-28 rounded bg-black/[0.07] animate-pulse" />
                    </div>
                ))}
            </div>
            {/* Table */}
            <div className="rounded-[var(--radius-xl)] border border-black/5 overflow-hidden">
                <div className="flex gap-4 px-4 py-3 bg-black/[0.02] border-b border-black/5">
                    {[18, 14, 16, 22, 12].map((w, i) => <div key={i} className="h-3 rounded bg-black/[0.06] animate-pulse" style={{ width: `${w}%` }} />)}
                </div>
                {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-black/5 last:border-0" style={{ animation: `fade-in 0.25s var(--ease-out) ${i * 35}ms both` }}>
                        {[18, 14, 16, 22, 12].map((w, j) => <div key={j} className="h-3.5 rounded bg-black/[0.04] animate-pulse" style={{ width: `${w}%` }} />)}
                    </div>
                ))}
            </div>
        </div>
    )
}
