export default function InventoryLoading() {
    return (
        <div className="p-6 lg:p-8 space-y-6" aria-busy="true">
            <div className="space-y-2">
                <div className="h-7 w-64 rounded bg-black/[0.07] animate-pulse" />
                <div className="h-3.5 w-96 max-w-full rounded bg-black/[0.05] animate-pulse" />
            </div>
            <div className="flex flex-wrap gap-2">
                {[80, 110, 95, 120, 70].map((w, i) => (
                    <div key={i} className="h-9 rounded-lg bg-black/[0.05] animate-pulse" style={{ width: w }} />
                ))}
            </div>
            <div className="rounded-[var(--radius-xl)] border border-black/5 overflow-hidden">
                {[...Array(9)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-black/5 last:border-0" style={{ animation: `fade-in 0.25s var(--ease-out) ${i * 40}ms both` }}>
                        <div className="h-3.5 w-1/4 rounded bg-black/[0.06] animate-pulse" />
                        <div className="h-3.5 w-1/6 rounded bg-black/[0.04] animate-pulse" />
                        <div className="h-3.5 w-1/5 rounded bg-black/[0.04] animate-pulse" />
                        <div className="h-3.5 flex-1 rounded bg-black/[0.03] animate-pulse" />
                    </div>
                ))}
            </div>
        </div>
    )
}
