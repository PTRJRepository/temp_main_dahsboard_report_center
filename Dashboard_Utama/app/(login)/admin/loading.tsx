export default function AdminLoading() {
    return (
        <div className="space-y-6" aria-busy="true">
            {/* Header band */}
            <div className="rounded-[var(--radius-xl)] bg-gradient-to-br from-[#0c231a] via-[#123526] to-[#1b4a33] p-7 md:p-9">
                <div className="h-3 w-24 rounded bg-white/20 animate-pulse mb-3" />
                <div className="h-8 w-56 rounded bg-white/30 animate-pulse" />
                <div className="h-3 w-72 rounded bg-white/10 animate-pulse mt-3" />
            </div>
            {/* Tabs */}
            <div className="flex gap-2 w-fit p-1.5 rounded-2xl bg-white shadow-sm">
                <div className="h-10 w-28 rounded-xl bg-emerald-600/80 animate-pulse" />
                <div className="h-10 w-40 rounded-xl bg-gray-100 animate-pulse" />
            </div>
            {/* Table skeleton */}
            <div className="rounded-[var(--radius-xl)] border border-gray-100 bg-white p-6 space-y-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4" style={{ animation: `fade-up 0.3s var(--ease-out) ${i * 50}ms both` }}>
                        <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3.5 w-1/3 rounded bg-gray-200 animate-pulse" />
                            <div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />
                        </div>
                        <div className="h-8 w-24 rounded-lg bg-gray-100 animate-pulse" />
                    </div>
                ))}
            </div>
        </div>
    )
}
