export default function DashboardUserLoading() {
    return (
        <div className="min-h-screen bg-[#0a120e]" aria-busy="true">
            {/* Hero band */}
            <div className="bg-gradient-to-br from-[#081411] via-[#0c231a] to-[#123526] px-4 sm:px-8 lg:px-12 py-8">
                <div className="max-w-[1600px] mx-auto flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-800/60 animate-pulse shrink-0" />
                    <div className="space-y-2">
                        <div className="h-3 w-32 rounded bg-white/15 animate-pulse" />
                        <div className="h-7 w-48 rounded bg-white/25 animate-pulse" />
                    </div>
                </div>
            </div>
            {/* Ticker strip */}
            <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 -mt-2">
                <div className="h-10 rounded-full bg-[#101c17]/90 border border-slate-700/50 animate-pulse" />
            </div>
            {/* Tab pills */}
            <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 pt-8">
                <div className="flex gap-2 mb-7">
                    {[64, 120, 110, 96].map((w, i) => (
                        <div key={i} className="h-10 rounded-xl bg-white/[0.06] animate-pulse" style={{ width: w }} />
                    ))}
                </div>
                {/* Card grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="rounded-[20px] border border-white/10 bg-white/[0.04] overflow-hidden" style={{ animation: `fade-up 0.35s var(--ease-out) ${i * 60}ms both` }}>
                            <div className="h-36 bg-white/[0.06] animate-pulse" />
                            <div className="px-5 pt-9 pb-4 space-y-3">
                                <div className="h-4 w-2/3 rounded bg-white/15 animate-pulse" />
                                <div className="h-3 w-full rounded bg-white/[0.08] animate-pulse" />
                                <div className="h-3 w-4/5 rounded bg-white/[0.08] animate-pulse" />
                                <div className="flex justify-between pt-2 border-t border-white/[0.06]">
                                    <div className="h-3 w-12 rounded bg-white/10 animate-pulse" />
                                    <div className="h-7 w-16 rounded-full bg-white/10 animate-pulse" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
