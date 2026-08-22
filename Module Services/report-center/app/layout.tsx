import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Report Center - PT Rebinmas Jaya',
  description: 'Report Center untuk analisis inventaris, stok, dan pergerakan barang',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
