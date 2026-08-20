import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'

/**
 * ScrollArea — wadah scroll vertikal seragam report-center.
 *
 * Menggantikan `overflow-auto` polos + scrollbar bawaan browser dengan gaya
 * `.rc-scroll-y` yang konsisten (forest theme). Pakai di mana saja yang butuh
 * scroll vertikal: daftar, panel, tabel tinggi, dll.
 *
 * Contoh:
 *   <ScrollArea className="h-64">…konten…</ScrollArea>
 *   <ScrollArea thin className="max-h-40">…</ScrollArea>
 */

type ScrollAreaProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  /** Varian tipis (untuk daftar padat / panel kecil). */
  thin?: boolean
  style?: CSSProperties
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { children, thin = false, className, style, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx('rc-scroll-y', thin && 'rc-scroll-y--thin', className)}
      style={style}
      {...rest}
    >
      {children}
    </div>
  )
})

export default ScrollArea
