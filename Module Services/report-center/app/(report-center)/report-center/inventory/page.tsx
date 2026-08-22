import { redirect } from 'next/navigation'

type PageProps = {
  searchParams?: Promise<{ source?: string; stockGroup?: string; itemType?: string }>
}

function normalizeSource(value?: string) {
  return value === 'pabrik' ? 'pabrik' : 'estate'
}

function stockGroupFromQuery(query?: { stockGroup?: string; itemType?: string }) {
  const itemType = query?.itemType?.trim().toLowerCase()
  if (itemType === 'gudang') return 'gudang'
  if (itemType === 'workshop') return 'workshop'
  const group = query?.stockGroup?.trim().toLowerCase()
  if (group === 'gudang' || group === 'workshop' || group === 'process' || group === 'inventory') return group
  return 'inventory'
}

/** Inventory is a procurement sub-module — always land on procurement workspace. */
export default async function InventoryReportsPage({ searchParams }: PageProps) {
  const query = await searchParams
  const source = normalizeSource(query?.source)
  const stockGroup = stockGroupFromQuery(query)
  redirect(`/report-center/procurement?source=${source}&stockGroup=${stockGroup}`)
}
