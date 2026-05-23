'use client'

import { useEffect, useRef, useState } from 'react'

// Estate locations
const estates = [
    {
        name: 'Kantor Pusat / Induk Rebinmas Jaya (Parit Gunung)',
        position: [-2.7412499297005497, 107.88343331898686] as [number, number],
        description: 'Kantor Pusat PT Rebinmas Jaya',
        type: 'office'
    },
    {
        name: 'Air Ruak Estate',
        position: [-2.8226592062084985, 107.89119926420152] as [number, number],
        description: 'Kantor Air Ruak Estate',
        type: 'estate'
    },
    {
        name: 'Darul Makmur Estate (DME)',
        position: [-2.6434984396258683, 107.86948716050739] as [number, number],
        description: 'Air Raya, Kandis, Cendong',
        type: 'estate'
    },
]

export default function SatelliteMap() {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const [isLoaded, setIsLoaded] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined' || mapInstanceRef.current) return

        // Dynamically load Leaflet
        const loadLeaflet = async () => {
            try {
                // Add CSS
                if (!document.getElementById('leaflet-css')) {
                    const link = document.createElement('link')
                    link.id = 'leaflet-css'
                    link.rel = 'stylesheet'
                    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
                    document.head.appendChild(link)
                }

                // Import Leaflet
                const L = (await import('leaflet')).default

                // Fix marker icons
                delete (L.Icon.Default.prototype as any)._getIconUrl
                L.Icon.Default.mergeOptions({
                    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                })

                if (mapRef.current && !mapInstanceRef.current) {
                    // Create map
                    const map = L.map(mapRef.current).setView([-2.74, 107.88], 11)

                    // Add satellite tile layer
                    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                        attribution: '&copy; Esri'
                    }).addTo(map)

                    // Add labels layer
                    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
                        attribution: ''
                    }).addTo(map)

                    // Add markers for each estate
                    estates.forEach((estate) => {
                        const marker = L.marker(estate.position).addTo(map)
                        marker.bindPopup(`
                            <div style="text-align: center; padding: 4px;">
                                <h3 style="font-weight: bold; color: #3A7D44; margin: 0 0 4px 0;">${estate.name}</h3>
                                <p style="font-size: 12px; color: #666; margin: 0;">${estate.description}</p>
                            </div>
                        `)
                    })

                    mapInstanceRef.current = map
                    setIsLoaded(true)
                }
            } catch (error) {
                console.error('Error loading Leaflet:', error)
            }
        }

        loadLeaflet()

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove()
                mapInstanceRef.current = null
            }
        }
    }, [])

    return (
        <div className="w-full h-[400px] rounded-2xl overflow-hidden shadow-xl border-4 border-white relative">
            {!isLoaded && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center z-10">
                    <p className="text-gray-500">Memuat peta...</p>
                </div>
            )}
            <div ref={mapRef} className="w-full h-full" />
        </div>
    )
}
