import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'File Management — PT Rebinmas Jaya',
  description: 'Penugasan operasional, pengumpulan berkas & audit revisi',
}

export default function FileGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
