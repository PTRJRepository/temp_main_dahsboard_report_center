'use client'

import { useState } from 'react'

export type TileSize = '1x1' | '2x1' | '2x2'

interface MonitorTileProps {
  children: React.ReactNode
  size?: TileSize
  title?: string
  subtitle?: string
  onClick?: () => void
  accentColor?: string
  className?: string
}

const sizeClasses: Record<TileSize, string> = {
  '1x1': 'col-span-1 row-span-1',
  '2x1': 'col-span-2 row-span-1',
  '2x2': 'col-span-2 row-span-2',
}

export default function MonitorTile({
  children,
  size = '1x1',
  title,
  subtitle,
  onClick,
  accentColor,
  className = '',
}: MonitorTileProps) {
  const [pressed, setPressed] = useState(false)

  const borderStyle = accentColor ? { borderLeft: `4px solid ${accentColor}` } : {}

  return (
    <div
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={borderStyle}
      className={`
        group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4
        transition-all duration-150 cursor-pointer
        hover:border-slate-400 hover:shadow-lg hover:scale-[1.02]
        active:scale-[0.98]
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {title && (
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          {subtitle && (
            <span className="text-[10px] text-slate-400">{subtitle}</span>
          )}
        </div>
      )}
      <div className="flex-1">{children}</div>
    </div>
  )
}