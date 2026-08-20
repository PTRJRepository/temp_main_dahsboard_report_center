import { liveInventoryReports, type InventoryReport } from './inventory/config'

export type ReportSource = 'estate' | 'pabrik'
export type ProcurementStockGroup = 'inventory' | 'gudang' | 'workshop' | 'process'

type ReportLinkParam = string | number | boolean | Array<Record<string, string | number | undefined>>

type ProcurementReportEntry = {
  reportId: string
  purpose: string
  signal: string
  metricLabel: string
  params?: Record<string, ReportLinkParam>
}

export type ProcurementReportCard = {
  id: string
  code: string
  title: string
  description: string
  purpose: string
  signal: string
  metricLabel: string
  groupTitle: string
  href: string
  priority: InventoryReport['priority']
  cadence: InventoryReport['cadence']
  owner: string
  tags: string[]
}

export type ProcurementGroupCard = {
  id: ProcurementStockGroup
  label: string
  shortLabel: string
  eyebrow: string
  title: string
  description: string
  count: number
  href: string
  active: boolean
}

export type ProcurementProcessStage = {
  id: string
  label: string
  description: string
  href: string
  reportTitle: string
}

type ProcurementGroupDefinition = Omit<ProcurementGroupCard, 'count' | 'href' | 'active'> & {
  reports: ProcurementReportEntry[]
}

const reportById = new Map(liveInventoryReports.map((report) => [report.id, report]))

const procurementGroups: Record<ProcurementStockGroup, ProcurementGroupDefinition> = {
  inventory: {
    id: 'inventory',
    label: 'Inventory',
    shortLabel: 'Inventory',
    eyebrow: 'Master inventory',
    title: 'Inventory all-scope: Gudang + Workshop/Mesin dalam satu master.',
    description: 'Default procurement inventory harus membaca ItemType 1 Stock/Gudang dan ItemType 4 Workshop/Mesin sekaligus. Pilih Gudang atau Workshop hanya untuk isolasi scope.',
    reports: [
      {
        reportId: 'asset-stock-valuasi-listing',
        purpose: 'Valuasi inventory penuh dengan Stock Gudang dan Workshop/Mesin tanpa menyempitkan ItemType.',
        signal: 'Angka ini adalah total inventory default: ItemType 1 + ItemType 4.',
        metricLabel: 'Total inventory valuation',
      },
      {
        reportId: 'all-stock-movement-analysis',
        purpose: 'Movement category aktual untuk semua item inventory, termasuk Gudang dan Workshop.',
        signal: 'Fast/slow/dead stock dihitung dari movement periodik, bukan taxonomy master.',
        metricLabel: 'Actual movement category',
        params: { groupBy: 'MovementCategory', movementWindow: 'all' },
      },
      {
        reportId: 'stok-gudang',
        purpose: 'Saldo, quantity, lokasi, dan nilai persediaan inventory full-scope.',
        signal: 'Default report center membaca Stock Gudang + Workshop kecuali user memilih scope item type.',
        metricLabel: 'Inventory stock position',
      },
      {
        reportId: 'monthly-stock-account-movement-details',
        purpose: 'Rekonstruksi opening, issue, receive, return, closing, dan valuasi bulanan untuk inventory penuh.',
        signal: 'Monthly movement menjadi bridge inventory dengan accounting period dan process procurement.',
        metricLabel: 'Monthly movement',
      },
      {
        reportId: 'item-stale-update',
        purpose: 'Aging master item dan stock yang tidak update untuk Gudang dan Workshop.',
        signal: 'Prioritaskan item bernilai besar yang stale atau tidak punya movement valid.',
        metricLabel: 'Inventory stale',
      },
    ],
  },
  gudang: {
    id: 'gudang',
    label: 'Stock Gudang',
    shortLabel: 'Gudang',
    eyebrow: 'Stock control',
    title: 'Saldo, valuasi, movement, transfer, dan opname gudang.',
    description: 'Untuk user gudang yang perlu melihat total nilai stock, item bergerak, lokasi dominan, stale stock, dan kontrol selisih.',
    reports: [
      {
        reportId: 'stok-gudang',
        purpose: 'Total item, total quantity, total valuasi, gudang dominan, dan stock minimum.',
        signal: 'Jawab pertanyaan: berapa nilai stock sekarang dan gudang mana paling material.',
        metricLabel: 'Total valuasi',
        params: { groupBy: 'Gudang', itemType: 'gudang' },
      },
      {
        reportId: 'asset-stock-valuasi-listing',
        purpose: 'Detail item valuasi gudang dengan quantity on hand, on hold, unit cost, dan total amount.',
        signal: 'Drill-down yang sinkron dengan KPI valuasi Stock Gudang.',
        metricLabel: 'Detail item valuasi',
        params: { itemType: 'gudang' },
      },
      {
        reportId: 'all-stock-movement-analysis',
        purpose: 'Klasifikasi Fast Moving, Moving, Slow Moving, Dead Stock, dan Stale secara periodik.',
        signal: 'Movement category menjadi filter utama untuk barang cepat/lambat bergerak.',
        metricLabel: 'Movement category',
        params: { groupBy: 'MovementCategory', itemType: 'gudang', movementWindow: 'all' },
      },
      {
        reportId: 'movement-stock',
        purpose: 'Barang masuk, barang keluar, dan transfer dalam satu alur movement.',
        signal: 'Lihat gap masuk/keluar per bulan dan item dengan movement terbesar.',
        metricLabel: 'Movement stock',
        params: { itemType: 'gudang' },
      },
      {
        reportId: 'transfer-antar-gudang',
        purpose: 'Route transfer gudang asal ke gudang tujuan, quantity, dan nilai transfer.',
        signal: 'Pisahkan aktivitas transfer dari issue dan receiving biasa.',
        metricLabel: 'Transfer route',
      },
      {
        reportId: 'stock-opname',
        purpose: 'Audit selisih opname, adjustment, dan item dengan deviasi nilai terbesar.',
        signal: 'Dipakai untuk kontrol fisik dan koreksi stok.',
        metricLabel: 'Adjustment',
      },
      {
        reportId: 'item-stale-update',
        purpose: 'Aging master item dan stock yang tidak update lebih dari 12 bulan.',
        signal: 'Prioritaskan item bernilai besar yang stale atau tidak punya issue valid.',
        metricLabel: 'Stale stock',
        params: { itemType: 'gudang' },
      },
    ],
  },
  workshop: {
    id: 'workshop',
    label: 'Stock Workshop',
    shortLabel: 'Workshop',
    eyebrow: 'Workshop stock',
    title: 'Sparepart, item type 4, kendaraan, running unit, dan biaya workshop.',
    description: 'Untuk user workshop yang perlu memisahkan pemakaian sparepart dan biaya kendaraan dari stock gudang regular.',
    reports: [
      {
        reportId: 'vehicle-running-workshop',
        purpose: 'Kendaraan, running/usage unit, pemakaian sparepart, dan workshop stock amount.',
        signal: 'Pusat analisis workshop: kendaraan mana paling besar cost dan usage.',
        metricLabel: 'Workshop usage',
      },
      {
        reportId: 'all-stock-movement-analysis',
        purpose: 'Movement item workshop dengan filter ItemType 4 dan grouping movement category.',
        signal: 'Pisahkan workshop movement dari stock regular saat membaca fast/slow/dead stock.',
        metricLabel: 'ItemType 4',
        params: {
          groupBy: 'MovementCategory',
          itemType: 'workshop',
          movementWindow: 'all',
        },
      },
      {
        reportId: 'asset-stock-valuasi-listing',
        purpose: 'Valuasi item stock dan workshop dengan grouping product type atau item type.',
        signal: 'Cocok untuk melihat material sparepart workshop dalam valuasi asset stock.',
        metricLabel: 'Workshop valuation',
        params: { itemType: 'workshop' },
      },
      {
        reportId: 'pengeluaran-barang',
        purpose: 'Issue operasional termasuk pemakaian barang workshop dari WS_JOBSTOCK.',
        signal: 'Lihat barang keluar ke operasional, cost center, blok, dan kendaraan.',
        metricLabel: 'Issue usage',
        params: { itemType: 'workshop' },
      },
      {
        reportId: 'item-stale-update',
        purpose: 'Item workshop yang stale, tidak update, atau tidak punya issue valid.',
        signal: 'Bersihkan sparepart mati sebelum nilainya menumpuk.',
        metricLabel: 'Workshop stale',
        params: { itemType: 'workshop' },
      },
    ],
  },
  process: {
    id: 'process',
    label: 'Procurement Process',
    shortLabel: 'Process',
    eyebrow: 'PR -> PO -> Receive',
    title: 'PR, PO, supplier, receiving, outstanding, dan rekonsiliasi.',
    description: 'Untuk user procurement yang perlu membaca proses pembelian dari request sampai barang masuk ke inventory.',
    reports: [
      {
        reportId: 'purchase-request-inventory',
        purpose: 'PR inventory, quantity request, received, outstanding, dan item belum terpenuhi.',
        signal: 'Awal proses procurement: kebutuhan apa yang belum masuk.',
        metricLabel: 'PR outstanding',
      },
      {
        reportId: 'purchase-order-history',
        purpose: 'Histori PO per item dan supplier, qty order, qty receive, invoice, dan outstanding.',
        signal: 'Lihat supplier mana memasok item tertentu dan konsentrasi nilai PO.',
        metricLabel: 'PO history',
      },
      {
        reportId: 'goods-receiving-receipt-activity',
        purpose: 'Aktivitas receiving dari supplier dengan referensi PO, item, qty, cost, dan lokasi.',
        signal: 'Receiving activity harus dipisah dari stock balance.',
        metricLabel: 'Goods receive',
      },
      {
        reportId: 'supplier-purchasing-performance',
        purpose: 'Kinerja supplier, PO, goods receive, invoice, dan kualitas master supplier.',
        signal: 'Kontrol supplier yang paling material dan perlu audit master.',
        metricLabel: 'Supplier',
      },
      {
        reportId: 'monthly-stock-account-movement-details',
        purpose: 'Rekonstruksi opening, issue, receive, return, closing, dan valuasi per accounting period.',
        signal: 'Bridge antara proses procurement dan accounting movement bulanan.',
        metricLabel: 'Monthly movement',
      },
    ],
  },
}

const processStages: Array<{ id: string; label: string; description: string; reportId: string }> = [
  {
    id: 'request',
    label: 'PR',
    description: 'Kebutuhan barang dan outstanding request.',
    reportId: 'purchase-request-inventory',
  },
  {
    id: 'order',
    label: 'PO',
    description: 'Order ke supplier, qty order, dan nilai PO.',
    reportId: 'purchase-order-history',
  },
  {
    id: 'receive',
    label: 'Receive',
    description: 'Barang diterima, supplier, PO line, dan nilai receive.',
    reportId: 'goods-receiving-receipt-activity',
  },
  {
    id: 'stock',
    label: 'Stock',
    description: 'Saldo, valuasi, gudang, dan movement category.',
    reportId: 'stok-gudang',
  },
  {
    id: 'usage',
    label: 'Issue',
    description: 'Barang keluar ke operasional, blok, cost center, dan kendaraan.',
    reportId: 'pengeluaran-barang',
  },
  {
    id: 'workshop',
    label: 'Workshop',
    description: 'Sparepart, job stock, kendaraan, dan running usage.',
    reportId: 'vehicle-running-workshop',
  },
]

function inventoryReport(reportId: string) {
  const report = reportById.get(reportId)
  if (!report) throw new Error(`Procurement report not found: ${reportId}`)
  return report
}

function appendReportParam(params: URLSearchParams, key: string, value: ReportLinkParam | undefined) {
  if (value === undefined || value === '') return
  params.set(key, Array.isArray(value) ? JSON.stringify(value) : String(value))
}

export function createProcurementReportHref(
  reportId: string,
  source: ReportSource,
  params: Record<string, ReportLinkParam | undefined> = {},
) {
  const query = new URLSearchParams({ source })
  Object.entries(params).forEach(([key, value]) => appendReportParam(query, key, value))
  return `/report-center/inventory/${reportId}?${query.toString()}`
}

export function createProcurementGroupHref(group: ProcurementStockGroup, source: ReportSource) {
  return `/report-center/procurement?source=${source}&stockGroup=${group}`
}

export function normalizeProcurementStockGroup(value: string | null | undefined): ProcurementStockGroup {
  const normalized = value?.trim().toLowerCase()
  // GUARDRAIL(procurement-inventory-default):
  // Procurement is the global module; Inventory is the default master scope under it.
  // Inventory must include both Gudang/ItemType 1 and Workshop-Mesin/ItemType 4.
  // Do not default this back to "gudang"; use stockGroup=gudang only when explicitly requested.
  if (!normalized || normalized === 'inventory' || normalized === 'all' || normalized === 'semua') return 'inventory'
  if (normalized === 'workshop' || normalized === 'stock-workshop') return 'workshop'
  if (normalized === 'gudang' || normalized === 'stock-gudang' || normalized === 'stock') return 'gudang'
  if (normalized === 'process' || normalized === 'proses' || normalized === 'procurement-process') return 'process'
  return 'inventory'
}

function reportCard(entry: ProcurementReportEntry, source: ReportSource): ProcurementReportCard {
  const report = inventoryReport(entry.reportId)
  return {
    id: report.id,
    code: report.code,
    title: report.title,
    description: report.description,
    purpose: entry.purpose,
    signal: entry.signal,
    metricLabel: entry.metricLabel,
    groupTitle: report.groupTitle,
    href: createProcurementReportHref(report.id, source, entry.params),
    priority: report.priority,
    cadence: report.cadence,
    owner: report.owner,
    tags: report.tags.slice(0, 4),
  }
}

export function getProcurementWorkspace(source: ReportSource, activeGroupInput?: string | null) {
  const activeGroup = normalizeProcurementStockGroup(activeGroupInput)
  const groupCards: ProcurementGroupCard[] = (Object.keys(procurementGroups) as ProcurementStockGroup[]).map((group) => ({
    id: group,
    label: procurementGroups[group].label,
    shortLabel: procurementGroups[group].shortLabel,
    eyebrow: procurementGroups[group].eyebrow,
    title: procurementGroups[group].title,
    description: procurementGroups[group].description,
    count: procurementGroups[group].reports.length,
    href: createProcurementGroupHref(group, source),
    active: group === activeGroup,
  }))

  const activeDefinition = procurementGroups[activeGroup]

  return {
    source,
    activeGroup,
    groups: groupCards,
    activeGroupDetail: {
      id: activeDefinition.id,
      label: activeDefinition.label,
      title: activeDefinition.title,
      description: activeDefinition.description,
      reports: activeDefinition.reports.map((entry) => reportCard(entry, source)),
    },
    processStages: processStages.map((stage): ProcurementProcessStage => {
      const report = inventoryReport(stage.reportId)
      return {
        id: stage.id,
        label: stage.label,
        description: stage.description,
        href: createProcurementReportHref(report.id, source),
        reportTitle: report.title,
      }
    }),
    totalLiveReports: liveInventoryReports.length,
    totalStockReports: procurementGroups.inventory.reports.length + procurementGroups.gudang.reports.length + procurementGroups.workshop.reports.length,
    totalProcessReports: procurementGroups.process.reports.length,
  }
}
