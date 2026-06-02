import { Suspense } from 'react'
import InventoryReportsClient from './InventoryReportsClient'

export default function InventoryReportsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Memuat module Inventory...</div>}>
      <InventoryReportsClient />
    </Suspense>
  )
}
