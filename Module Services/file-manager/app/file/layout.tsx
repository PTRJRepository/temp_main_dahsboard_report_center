'use client'
import { usePathname } from 'next/navigation'
import FileShell from './FileShell'

export default function Layout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  if (path === '/file/login') return <>{children}</>
  return <FileShell>{children}</FileShell>
}
