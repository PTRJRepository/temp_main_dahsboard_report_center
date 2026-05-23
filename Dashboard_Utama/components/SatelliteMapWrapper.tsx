'use client'

import dynamic from 'next/dynamic'

// Dynamically import SatelliteMap to avoid SSR issues with Leaflet
const SatelliteMap = dynamic(() => import('./SatelliteMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[400px] bg-gray-200 rounded-2xl animate-pulse flex items-center justify-center">
            <p className="text-gray-500">Memuat peta...</p>
        </div>
    )
})

export default function SatelliteMapWrapper() {
    return <SatelliteMap />
}
