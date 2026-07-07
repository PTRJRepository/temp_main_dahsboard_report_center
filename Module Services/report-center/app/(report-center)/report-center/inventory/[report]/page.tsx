import { Suspense } from 'react'
import ReportViewerClient from './ReportViewerClient'

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
