import { Suspense } from 'react'
import ReportViewerClient from './ReportViewerClient'

export const dynamic = 'force-dynamic'
export const dynamicParams = true

// Skip static path workers — report IDs are runtime-only.
export function generateStaticParams() {
  return []
}

type PageProps = {
  params: Promise<{ report: string }>
}

export default async function InventoryReportViewerPage({ params }: PageProps) {
  const { report } = await params

  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Memuat report...</div>}>
      <ReportViewerClient reportId={report} />
    </Suspense>
  )
}
