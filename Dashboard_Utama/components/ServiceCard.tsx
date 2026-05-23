import Link from 'next/link'
import Image from 'next/image'
import * as LucideIcons from 'lucide-react'

interface ServiceCardProps {
    name: string
    description: string | null
    icon: string | null
    routeUrl: string
    imagePath?: string | null
}

export default function ServiceCard({ name, description, icon, routeUrl, imagePath }: ServiceCardProps) {
    // Dynamic Icon Lookup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const IconComponent = (icon && LucideIcons[icon as keyof typeof LucideIcons] ? LucideIcons[icon as keyof typeof LucideIcons] : LucideIcons.HelpCircle) as any

    return (
        <Link href={routeUrl} className="group block h-full">
            <div className="h-full bg-white rounded-xl shadow-sm hover:shadow-xl border border-gray-100/50 hover:border-palm-green/20 overflow-hidden transition-all duration-300 relative">
                {/* Banner Image Area */}
                <div className="h-40 relative w-full bg-gray-50 overflow-hidden">
                    {imagePath ? (
                        <Image
                            src={imagePath}
                            alt={name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300">
                            <LucideIcons.Image className="h-12 w-12 opacity-50" />
                        </div>
                    )}
                    {/* Overlay Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />

                    {/* Icon floating */}
                    <div className="absolute bottom-3 left-4">
                        <div className="p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm text-palm-green">
                            <IconComponent className="h-5 w-5" />
                        </div>
                    </div>
                </div>

                <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-gray-800 group-hover:text-palm-green transition-colors">
                            {name}
                        </h3>
                        <LucideIcons.ArrowUpRight className="h-5 w-5 text-gray-300 group-hover:text-palm-green transition-colors opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 duration-300" />
                    </div>

                    {description && (
                        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                            {description}
                        </p>
                    )}
                </div>
            </div>
        </Link>
    )
}
