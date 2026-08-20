import { createProcurementReportHref, type ReportSource } from './procurement-workspace'

export type ProcurementSubModule = 'purchasing' | 'inventory'
export type ProcurementCategory = 'transactions' | 'reports' | 'documents'

export type HierarchyEntry = {
  id: string
  title: string
  submodule: ProcurementSubModule
  category: ProcurementCategory
  liveReportId?: string
  status: 'live' | 'soon'
  note?: string
}

export const SUBMODULE_LABELS: Record<ProcurementSubModule, string> = {
  purchasing: 'Purchasing',
  inventory: 'Inventory',
}

export const CATEGORY_LABELS: Record<ProcurementCategory, string> = {
  transactions: 'Transactions Listing',
  reports: 'Reports',
  documents: 'Documents',
}

export const CATEGORY_ORDER: ProcurementCategory[] = ['transactions', 'reports', 'documents']

// Susunan kanonik mengikuti struktur user:
// PROCUREMENT -> PURCHASING (Transactions Listing / Reports / Documents)
//             -> INVENTORY  (Transactions Listing / Reports / Documents)
const HIERARCHY: HierarchyEntry[] = [
  // ---- PURCHASING -> Documents ----
  { id: 'dispatch-advice-details', title: 'Dispatch Advice Details', submodule: 'purchasing', category: 'documents', status: 'soon', note: 'Detail surat jalan / dispatch advice' },
  { id: 'goods-receive-note', title: 'Goods Receive Note', submodule: 'purchasing', category: 'documents', status: 'live', liveReportId: 'goods-receiving-receipt-activity', note: 'Dokumen penerimaan barang (GRN)' },
  { id: 'goods-return-note', title: 'Goods Return Note', submodule: 'purchasing', category: 'documents', status: 'soon', note: 'Dokumen retur ke supplier' },
  { id: 'purchase-order', title: 'Purchase Order', submodule: 'purchasing', category: 'documents', status: 'live', liveReportId: 'purchase-order-history', note: 'Dokumen PO per item & supplier' },
  { id: 'rincian-perbandingan-harga', title: 'Rincian Perbandingan Harga', submodule: 'purchasing', category: 'documents', status: 'soon', note: 'Perbandingan harga antar penawaran' },

  // ---- INVENTORY -> Transactions Listing ----
  { id: 'fuel-issue-listing', title: 'Fuel Issue Listing', submodule: 'inventory', category: 'transactions', status: 'soon', note: 'Listing pengeluaran BBM' },
  { id: 'fuel-return-listing', title: 'Fuel Return Listing', submodule: 'inventory', category: 'transactions', status: 'soon', note: 'Listing retur BBM' },
  { id: 'outstanding-pr-listing', title: 'Outstanding PR Listing', submodule: 'inventory', category: 'transactions', status: 'live', liveReportId: 'purchase-request-inventory', note: 'PR yang belum terpenuhi' },
  { id: 'purchase-requisition-listing', title: 'Purchase Requisition Listing', submodule: 'inventory', category: 'transactions', status: 'live', liveReportId: 'purchase-request-inventory', note: 'Listing PR inventory' },
  { id: 'stock-adjustment-listing', title: 'Stock Adjustment Listing', submodule: 'inventory', category: 'transactions', status: 'live', liveReportId: 'stock-opname', note: 'Listing penyesuaian / opname' },
  { id: 'stock-issue-listing', title: 'Stock Issue Listing', submodule: 'inventory', category: 'transactions', status: 'live', liveReportId: 'pengeluaran-barang', note: 'Listing pengeluaran barang' },
  { id: 'stock-receive-listing', title: 'Stock Receive Listing', submodule: 'inventory', category: 'transactions', status: 'live', liveReportId: 'goods-receiving-receipt-activity', note: 'Listing penerimaan barang' },
  { id: 'stock-return-advice-listing', title: 'Stock Return Advice Listing', submodule: 'inventory', category: 'transactions', status: 'soon', note: 'Listing advice retur stok' },
  { id: 'stock-return-listing', title: 'Stock Return Listing', submodule: 'inventory', category: 'transactions', status: 'live', liveReportId: 'return-barang', note: 'Listing retur barang' },
  { id: 'stock-transfer-listing', title: 'Stock Transfer Listing', submodule: 'inventory', category: 'transactions', status: 'live', liveReportId: 'transfer-antar-gudang', note: 'Listing transfer antar gudang' },

  // ---- INVENTORY -> Reports ----
  { id: 'daily-fuel-issuance-report', title: 'Daily Fuel Issuance Report', submodule: 'inventory', category: 'reports', status: 'soon', note: 'Laporan BBM harian' },
  { id: 'inventory-valuation-listing', title: 'Inventory Valuation Listing', submodule: 'inventory', category: 'reports', status: 'live', liveReportId: 'asset-stock-valuasi-listing', note: 'RPTIN1000011' },
  { id: 'material-distribution-listing', title: 'Material Distribution Listing', submodule: 'inventory', category: 'reports', status: 'soon', note: 'Distribusi material per area' },
  { id: 'monthly-inventory-utilization', title: 'Monthly Inventory Utilization', submodule: 'inventory', category: 'reports', status: 'soon', note: 'Utilisasi inventory bulanan' },
  { id: 'monthly-stock-account-movement', title: 'Monthly Stock Account Movement', submodule: 'inventory', category: 'reports', status: 'live', liveReportId: 'monthly-stock-account-movement-details', note: 'Ringkasan movement akun stok' },
  { id: 'monthly-stock-account-movement-details', title: 'Monthly Stock Account Movement Details', submodule: 'inventory', category: 'reports', status: 'live', liveReportId: 'monthly-stock-account-movement-details', note: 'RPTIN1000015' },
  { id: 'stock-aging-report', title: 'Stock Aging Report', submodule: 'inventory', category: 'reports', status: 'live', liveReportId: 'item-movement-update-tracking', note: 'Umur stok & movement health' },
  { id: 'stock-movement-detail-listing', title: 'Stock Movement Detail Listing', submodule: 'inventory', category: 'reports', status: 'live', liveReportId: 'movement-stock', note: 'Detail mutasi masuk/keluar/transfer' },
  { id: 'stock-summary-listing', title: 'Stock Summary Listing', submodule: 'inventory', category: 'reports', status: 'live', liveReportId: 'stok-gudang', note: 'Ringkasan posisi & nilai stok' },
  { id: 'stock-take-listing', title: 'Stock Take Listing', submodule: 'inventory', category: 'reports', status: 'live', liveReportId: 'stock-opname', note: 'Listing hasil stock take' },
  { id: 'stock-usage-frequency-listing', title: 'Stock Usage Frequency Listing', submodule: 'inventory', category: 'reports', status: 'live', liveReportId: 'all-stock-movement-analysis', note: 'Frekuensi pemakaian stok' },
  { id: 'summarized-stock-movement-list', title: 'Summarized Stock Movement List', submodule: 'inventory', category: 'reports', status: 'live', liveReportId: 'movement-stock', note: 'Ringkasan movement stok' },
  { id: 'summary-store-issue-slip-report', title: 'Summary Store Issue Slip Report', submodule: 'inventory', category: 'reports', status: 'live', liveReportId: 'pengeluaran-barang', note: 'Ringkasan issue slip gudang' },
]

export function getHierarchyFor(submodule: ProcurementSubModule, category: ProcurementCategory): HierarchyEntry[] {
  return HIERARCHY.filter((entry) => entry.submodule === submodule && entry.category === category)
}

export function getHierarchyCounts(): Record<ProcurementSubModule, Record<ProcurementCategory, { total: number; live: number }>> {
  const blank = () => ({ transactions: { total: 0, live: 0 }, reports: { total: 0, live: 0 }, documents: { total: 0, live: 0 } })
  const counts: Record<ProcurementSubModule, Record<ProcurementCategory, { total: number; live: number }>> = {
    purchasing: blank(),
    inventory: blank(),
  }
  for (const entry of HIERARCHY) {
    counts[entry.submodule][entry.category].total += 1
    if (entry.status === 'live') counts[entry.submodule][entry.category].live += 1
  }
  return counts
}

export function resolveLiveHref(entry: HierarchyEntry, source: ReportSource): string | undefined {
  if (entry.status !== 'live' || !entry.liveReportId) return undefined
  return createProcurementReportHref(entry.liveReportId, source)
}
