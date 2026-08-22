export default function FileLoading() {
    return (
        <div className="min-h-screen bg-slate-100 flex" aria-busy="true">
            {/* Sidebar */}
            <div className="hidden md:flex w-64 bg-slate-900 flex-col gap-3 p-3">
                <div className="h-14 px-2 flex items-center gap-2.5 border-b border-white/10 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/30 animate-pulse" />
                    <div className="space-y-1.5"><div className="h-3 w-20 rounded bg-white/20 animate-pulse" /><div className="h-2 w-24 rounded bg-white/10 animate-pulse" /></div>
                </div>
                {[...Array(6)].map((_, i) => <div key={i} className="h-9 rounded-xl bg-white/[0.06] animate-pulse" />)}
            </div>
            {/* Main */}
            <div className="flex-1 p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <div className="h-8 w-48 rounded-lg bg-slate-200 animate-pulse" />
                    <div className="h-9 w-28 rounded-xl bg-slate-200 animate-pulse" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3" style={{ animation: `fade-up 0.3s var(--ease-out) ${i * 60}ms both` }}>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse" />
                            <div className="h-4 w-2/3 rounded bg-slate-200 animate-pulse" />
                            <div className="h-3 w-full rounded bg-slate-100 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
