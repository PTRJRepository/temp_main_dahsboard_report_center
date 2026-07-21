'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Database,
  DollarSign,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Fuel,
  Layers,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Table2,
  Truck,
  Undo2,
  Warehouse,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getInventoryReport, liveInventoryReports, type InventoryReport } from '@/lib/reports/inventory/config'
import type { InsightContent } from '@/lib/reports/intelligence'
import AiDynamicDashboard from '@/components/report/AiDynamicDashboard'
import type { AiDashboardDefinition } from '@/lib/reports/ai-dashboard'
import { useReportStore } from '@/store/reportStore'
import type { ReportFilterInput } from '@/lib/reports/report-filtering'

type DbRow = Record<string, unknown>

type ReportPayload = {
  title: string
  description: string
  rows: DbRow[]
  columns: string[]
  summary: DbRow
  chart: DbRow[]
  metadata: DbRow
}

type ApiResponse = {
  success: boolean
  report: string
  data?: ReportPayload
  error?: string
}

type ReportSource = 'estate' | 'pabrik'
type FlowStageCode =
  | 'all'
  | 'request'
  | 'purchase_order'
  | 'in_transit'
  | 'receive'
  | 'placement'
  | 'movement'
  | 'usage'
  | 'return'
  | 'adjustment'
  | 'closing'
  | 'final_stock'
  | 'valuation'
  | 'audit'

type ReportStatusKey = 'live' | 'preview' | 'mapping_db' | 'need_validation' | 'planned'
type ReportAction = 'preview' | 'view' | 'excel' | 'pdf'

type FlowStage = {
  stageCode: FlowStageCode
  stageName: string
  shortName: string
  description: string
  icon: LucideIcon
  color: string
  status: ReportStatusKey
}

type InventoryCatalogReport = {
  reportCode: string
  flowStage: Exclude<FlowStageCode, 'all'>
  name: string
  shortName: string
  categoryLabel: string
  group?: string
  groupTitle?: string
  description: string
  businessPurpose: string
  cadence: string
  owner: string
  status: ReportStatusKey
  tags: string[]
  actions: ReportAction[]
  existingReportId?: string
  sourceDatabase?: string
  lastUpdated: string
}

const SOURCE_OPTIONS: Array<{ id: ReportSource; label: string; description: string }> = [
  { id: 'estate', label: 'Estate / Kebun', description: 'SERVER_PROFILE_2 / db_ptrj' },
  { id: 'pabrik', label: 'Pabrik', description: 'SERVER_PROFILE_3 / db_ptrj_mill' },
]
const REPORT_SOURCE_STORAGE_KEY = 'report-center:last-source'

const STALE_FILTER_OPTIONS = [
  { value: 'dari-1-bulan-sampai-sekarang', label: '> 1 bulan' },
  { value: 'dari-3-bulan-sampai-sekarang', label: '> 3 bulan' },
  { value: 'dari-6-bulan-sampai-sekarang', label: '> 6 bulan' },
  { value: 'dari-1-tahun-sampai-sekarang', label: '> 1 tahun' },
  { value: 'dari-2-tahun-sampai-sekarang', label: '> 2 tahun' },
  { value: 'dari-3-tahun-sampai-sekarang', label: '> 3 tahun' },
  { value: 'dari-5-tahun-sampai-sekarang', label: '> 5 tahun' },
]

const MOVEMENT_WINDOW_OPTIONS = [
  { value: 'all', label: 'MC: All period' },
  { value: '1m', label: 'MC: 1 bulan' },
  { value: '3m', label: 'MC: 3 bulan' },
  { value: '6m', label: 'MC: 6 bulan' },
  { value: '12m', label: 'MC: 12 bulan' },
]

const INVENTORY_ANALYSIS_GROUP_OPTIONS = [
  { value: 'ProductTypeCode', label: 'Product Type Code', description: 'Official RPTIN1000015 analysis group' },
  { value: 'ProductCategoryCode', label: 'Product Category Code', description: 'IN_ITEM.ProdCatCode' },
  { value: 'ProductBrandCode', label: 'Product Brand Code', description: 'IN_ITEM.ProdBrandCode' },
  { value: 'ProductModelCode', label: 'Product Model Code', description: 'IN_ITEM.ProdModelCode' },
  { value: 'ProductMaterialCode', label: 'Product Material Code', description: 'IN_ITEM.ProdMatCode' },
  { value: 'MovementCategory', label: 'Actual Movement Category', description: 'Fast/Moving/Slow/Dead/Stale aktual' },
] as const

type InventoryAnalysisGroup = (typeof INVENTORY_ANALYSIS_GROUP_OPTIONS)[number]['value']

/** @deprecated Stock Analysis Code removed from monthly path */
const STOCK_ANALYSIS_SCOPE_OPTIONS = [] as const

const FLOW_STAGES: FlowStage[] = [
  {
    stageCode: 'request',
    stageName: 'Request',
    shortName: 'Request',
    description: 'Permintaan barang dan outstanding pembelian.',
    icon: ClipboardList,
    color: '#2563EB',
    status: 'mapping_db',
  },
  {
    stageCode: 'purchase_order',
    stageName: 'Purchase Order',
    shortName: 'PO',
    description: 'Barang yang sudah dipesan ke supplier.',
    icon: ShoppingCart,
    color: '#7C3AED',
    status: 'mapping_db',
  },
  {
    stageCode: 'in_transit',
    stageName: 'In Transit',
    shortName: 'Transit',
    description: 'Barang dalam perjalanan sebelum diterima gudang.',
    icon: Truck,
    color: '#0D9488',
    status: 'planned',
  },
  {
    stageCode: 'receive',
    stageName: 'Receive',
    shortName: 'Receive',
    description: 'Goods receive, GRN, dan matching invoice.',
    icon: PackageCheck,
    color: '#16A34A',
    status: 'mapping_db',
  },
  {
    stageCode: 'placement',
    stageName: 'Placement',
    shortName: 'Placement',
    description: 'Penempatan barang per gudang dan lokasi.',
    icon: MapPin,
    color: '#0891B2',
    status: 'planned',
  },
  {
    stageCode: 'movement',
    stageName: 'Movement',
    shortName: 'Movement',
    description: 'Mutasi masuk, keluar, dan transfer gudang.',
    icon: RefreshCw,
    color: '#167A3A',
    status: 'live',
  },
  {
    stageCode: 'usage',
    stageName: 'Usage',
    shortName: 'Usage',
    description: 'Pemakaian barang, BBM, dan cost center.',
    icon: Fuel,
    color: '#EA580C',
    status: 'live',
  },
  {
    stageCode: 'return',
    stageName: 'Return',
    shortName: 'Return',
    description: 'Retur barang ke supplier.',
    icon: Undo2,
    color: '#DC2626',
    status: 'mapping_db',
  },
  {
    stageCode: 'adjustment',
    stageName: 'Adjustment',
    shortName: 'Adjust',
    description: 'Stock opname dan koreksi persediaan.',
    icon: Wrench,
    color: '#D97706',
    status: 'planned',
  },
  {
    stageCode: 'closing',
    stageName: 'Closing',
    shortName: 'Closing',
    description: 'Tutup bulan inventory.',
    icon: CheckCircle2,
    color: '#475569',
    status: 'planned',
  },
  {
    stageCode: 'final_stock',
    stageName: 'Final Stock',
    shortName: 'Final',
    description: 'Posisi stok akhir setelah seluruh transaksi.',
    icon: Warehouse,
    color: '#167A3A',
    status: 'live',
  },
  {
    stageCode: 'valuation',
    stageName: 'Valuation',
    shortName: 'Value',
    description: 'Nilai persediaan dan aset inventory.',
    icon: DollarSign,
    color: '#D99A00',
    status: 'live',
  },
  {
    stageCode: 'audit',
    stageName: 'Audit',
    shortName: 'Audit',
    description: 'Kualitas data, master data, dan flag risiko.',
    icon: ShieldCheck,
    color: '#64748B',
    status: 'live',
  },
]

// Legacy flow metadata only. Display names/descriptions are normalized from liveInventoryReports below.
const LEGACY_INVENTORY_FLOW_CATALOG: InventoryCatalogReport[] = [
  {
    reportCode: 'INV-01',
    flowStage: 'request',
    name: 'Permintaan Pembelian & Outstanding Inventory',
    shortName: 'PR & Outstanding',
    categoryLabel: 'REQUEST CONTROL',
    description: 'Menampilkan permintaan pembelian barang inventory, jumlah diminta, jumlah diterima, outstanding, dan nilai permintaan.',
    businessPurpose: 'Membantu memantau barang yang sudah diminta tetapi belum diterima penuh.',
    cadence: 'Harian',
    owner: 'Procurement',
    status: 'mapping_db',
    tags: ['PR', 'outstanding', 'request', 'barang belum diterima'],
    actions: ['preview'],
    sourceDatabase: 'PR / Purchasing tables',
    lastUpdated: 'Mapping database',
  },
  {
    reportCode: 'INV-02',
    flowStage: 'purchase_order',
    name: 'Purchase Order & Barang Dalam Pesanan',
    shortName: 'PO Inventory',
    categoryLabel: 'PO CONTROL',
    description: 'Menampilkan purchase order, supplier, item yang dipesan, qty order, nilai order, status PO, dan sisa barang yang belum diterima.',
    businessPurpose: 'Memantau barang yang sudah dipesan tetapi belum masuk gudang.',
    cadence: 'Harian',
    owner: 'Procurement',
    status: 'mapping_db',
    tags: ['PO', 'on order', 'supplier', 'barang dipesan'],
    actions: ['preview'],
    sourceDatabase: 'PO / Supplier linkage',
    lastUpdated: 'Mapping database',
  },
  {
    reportCode: 'INV-03',
    flowStage: 'in_transit',
    name: 'Barang Dalam Perjalanan dari Supplier',
    shortName: 'In Transit',
    categoryLabel: 'IN TRANSIT',
    description: 'Menampilkan barang yang sudah dikirim supplier tetapi belum diterima resmi di gudang.',
    businessPurpose: 'Membantu gudang menyiapkan penerimaan barang yang sedang dalam perjalanan.',
    cadence: 'Harian',
    owner: 'Procurement / Warehouse',
    status: 'planned',
    tags: ['dispatch', 'in transit', 'barang dalam perjalanan'],
    actions: ['preview'],
    sourceDatabase: 'Dispatch Advice / shipment mapping',
    lastUpdated: 'Planned',
  },
  {
    reportCode: 'INV-04',
    flowStage: 'receive',
    name: 'Penerimaan Barang & Nilai Pembelian',
    shortName: 'Goods Receive',
    categoryLabel: 'RECEIVING',
    description: 'Menampilkan barang yang diterima dari supplier, qty diterima, nilai penerimaan, dokumen goods receive, dan referensi PO.',
    businessPurpose: 'Menjadi laporan utama barang masuk yang menambah stok inventory.',
    cadence: 'Harian',
    owner: 'Warehouse Ops',
    status: 'mapping_db',
    tags: ['goods receive', 'GRN', 'barang masuk', 'receipt'],
    actions: ['preview'],
    sourceDatabase: 'IN_STOCKRECEIVE / purchasing linkage',
    lastUpdated: 'Mapping database',
  },
  {
    reportCode: 'INV-05',
    flowStage: 'receive',
    name: 'Validasi PO, Penerimaan, dan Invoice',
    shortName: 'PO-GRN-Invoice Match',
    categoryLabel: 'MATCHING CONTROL',
    description: 'Membandingkan purchase order, goods receive, dan invoice untuk melihat selisih qty, nilai, dan dokumen yang belum lengkap.',
    businessPurpose: 'Memastikan barang diterima sesuai PO dan tagihan sebelum nilai inventory difinalisasi.',
    cadence: 'Harian',
    owner: 'Finance AP / Procurement',
    status: 'mapping_db',
    tags: ['PO matching', 'GRN', 'invoice', 'selisih'],
    actions: ['preview'],
    sourceDatabase: 'PO / GRN / AP invoice matching',
    lastUpdated: 'Mapping database',
  },
  {
    reportCode: 'INV-06',
    flowStage: 'placement',
    name: 'Penempatan Barang per Gudang dan Lokasi',
    shortName: 'Warehouse Placement',
    categoryLabel: 'WAREHOUSE PLACEMENT',
    description: 'Menampilkan lokasi penempatan barang setelah diterima, termasuk gudang, lokasi/bin, kategori, item, dan qty.',
    businessPurpose: 'Membantu mengetahui barang ditempatkan di gudang atau lokasi mana.',
    cadence: 'Harian',
    owner: 'Warehouse Ops',
    status: 'planned',
    tags: ['penempatan', 'lokasi gudang', 'bin', 'warehouse'],
    actions: ['preview'],
    sourceDatabase: 'Warehouse location / bin mapping',
    lastUpdated: 'Planned',
  },
  {
    reportCode: 'INV-07',
    flowStage: 'movement',
    name: 'Pergerakan Stok Masuk & Keluar',
    shortName: 'Stock Movement',
    categoryLabel: 'MUTASI & TRANSAKSI',
    description: 'Menampilkan seluruh pergerakan stok barang, termasuk barang masuk, barang keluar, transfer, adjustment, dan perubahan stok antar periode.',
    businessPurpose: 'Membantu memahami arus barang dan perubahan stok antar periode.',
    cadence: 'Harian',
    owner: 'Inventory Accounting',
    status: 'live',
    tags: ['stock movement', 'mutasi stok', 'barang masuk', 'barang keluar'],
    actions: ['preview', 'view', 'excel', 'pdf'],
    existingReportId: 'movement-stock',
    sourceDatabase: 'IN_STOCKISSUE / IN_STOCKRECEIVE / PU_GOODSRCV / IN_STOCKTRANSFER',
    lastUpdated: 'Live query',
  },
  {
    reportCode: 'INV-08',
    flowStage: 'movement',
    name: 'Transfer Stok Antar Gudang',
    shortName: 'Transfer Gudang',
    categoryLabel: 'WAREHOUSE TRANSFER',
    description: 'Menampilkan perpindahan barang dari gudang asal ke gudang tujuan, termasuk item, qty, tanggal transfer, dan status transfer.',
    businessPurpose: 'Memantau perpindahan stok antar lokasi agar saldo gudang tetap akurat.',
    cadence: 'Harian',
    owner: 'Warehouse Ops',
    status: 'planned',
    tags: ['transfer gudang', 'stock transfer', 'mutasi antar gudang'],
    actions: ['preview'],
    sourceDatabase: 'IN_STOCKTRANSFER',
    lastUpdated: 'Planned',
  },
  {
    reportCode: 'INV-09',
    flowStage: 'usage',
    name: 'Pemakaian Barang Operasional',
    shortName: 'Barang Operasional',
    categoryLabel: 'OPERATIONAL USAGE',
    description: 'Menampilkan barang yang digunakan untuk kebutuhan operasional, termasuk cost center, kendaraan, blok, qty, cost, dan nilai pemakaian.',
    businessPurpose: 'Melihat barang inventory yang sudah digunakan operasional dan mengurangi stok.',
    cadence: 'Harian',
    owner: 'Warehouse Ops',
    status: 'live',
    tags: ['pemakaian barang', 'barang keluar', 'operasional', 'cost center'],
    actions: ['preview', 'view', 'excel', 'pdf'],
    existingReportId: 'pengeluaran-barang',
    sourceDatabase: 'IN_STOCKISSUE / IN_STOCKISSUELN',
    lastUpdated: 'Live query',
  },
  {
    reportCode: 'INV-10',
    flowStage: 'usage',
    name: 'Pemakaian BBM Kendaraan & Operasional',
    shortName: 'Pemakaian BBM',
    categoryLabel: 'FUEL USAGE',
    description: 'Menampilkan pemakaian BBM berdasarkan kendaraan, gudang, blok, kode fuel, qty, cost, dan total nilai pemakaian.',
    businessPurpose: 'Memantau penggunaan solar/BBM sebagai bagian dari barang inventory yang dipakai operasional.',
    cadence: 'Harian',
    owner: 'Warehouse Ops',
    status: 'live',
    tags: ['BBM', 'solar', 'diesel', 'fuel usage', 'kendaraan'],
    actions: ['preview', 'view', 'excel', 'pdf'],
    existingReportId: 'fuel-usage',
    sourceDatabase: 'IN_STOCKISSUE fuel usage mapping',
    lastUpdated: 'Live query',
  },
  {
    reportCode: 'INV-11',
    flowStage: 'return',
    name: 'Retur Barang ke Supplier',
    shortName: 'Goods Return',
    categoryLabel: 'RETURN CONTROL',
    description: 'Menampilkan barang yang dikembalikan ke supplier karena rusak, salah spesifikasi, kelebihan kirim, atau alasan retur lainnya.',
    businessPurpose: 'Menjelaskan pengurangan stok karena retur pembelian dan koreksi nilai inventory.',
    cadence: 'Harian',
    owner: 'Warehouse / Procurement',
    status: 'mapping_db',
    tags: ['goods return', 'retur barang', 'supplier', 'barang rusak'],
    actions: ['preview'],
    sourceDatabase: 'Goods Return / supplier return mapping',
    lastUpdated: 'Mapping database',
  },
  {
    reportCode: 'INV-12',
    flowStage: 'adjustment',
    name: 'Stock Opname & Koreksi Persediaan',
    shortName: 'Stock Opname',
    categoryLabel: 'ADJUSTMENT',
    description: 'Menampilkan hasil stock opname, selisih stok, koreksi persediaan, adjustment, dan nilai selisih.',
    businessPurpose: 'Membantu audit kesesuaian stok sistem dengan stok fisik.',
    cadence: 'Bulanan',
    owner: 'Inventory Control',
    status: 'planned',
    tags: ['stock opname', 'adjustment', 'selisih stok', 'stok fisik'],
    actions: ['preview'],
    sourceDatabase: 'Stock opname / adjustment mapping',
    lastUpdated: 'Planned',
  },
  {
    reportCode: 'INV-13',
    flowStage: 'closing',
    name: 'Closing Inventory Bulanan',
    shortName: 'Closing Inventory',
    categoryLabel: 'MONTH-END CLOSING',
    description: 'Menampilkan ringkasan proses closing inventory bulanan, termasuk saldo awal, barang masuk, barang keluar, adjustment, retur, transfer, dan saldo akhir.',
    businessPurpose: 'Memberikan ringkasan resmi alur inventory selama satu periode sebelum posisi akhir dikunci.',
    cadence: 'Bulanan',
    owner: 'Inventory Accounting',
    status: 'planned',
    tags: ['closing inventory', 'tutup bulan', 'saldo awal', 'saldo akhir'],
    actions: ['preview'],
    sourceDatabase: 'Closing period summary mapping',
    lastUpdated: 'Planned',
  },
  {
    reportCode: 'INV-14',
    flowStage: 'final_stock',
    name: 'Posisi Akhir Stok Bulanan',
    shortName: 'Final Stock Position',
    categoryLabel: 'ENDING STOCK',
    description: 'Menampilkan saldo akhir stok per item, gudang, kategori, satuan, dan periode setelah seluruh transaksi inventory diproses.',
    businessPurpose: 'Menjadi laporan final untuk melihat posisi stok akhir bulan.',
    cadence: 'Bulanan',
    owner: 'Inventory Control',
    status: 'live',
    tags: ['stok akhir', 'ending stock', 'final stock', 'saldo akhir'],
    actions: ['preview', 'view', 'excel', 'pdf'],
    existingReportId: 'stok-gudang',
    sourceDatabase: 'IN_ITEM / stock position',
    lastUpdated: 'Live query',
  },
  {
    reportCode: 'INV-15',
    flowStage: 'valuation',
    name: 'Valuasi Stok & Nilai Persediaan Gudang',
    shortName: 'Valuasi Gudang',
    categoryLabel: 'EXECUTIVE INVENTORY POSITION',
    description: 'Menampilkan nilai persediaan barang per gudang, total stok, harga rata-rata, nilai inventory, dan ringkasan aset persediaan.',
    businessPurpose: 'Membantu manajemen melihat nilai aset inventory pada akhir periode.',
    cadence: 'Harian / Bulanan',
    owner: 'Inventory Control',
    status: 'live',
    tags: ['valuasi stok', 'nilai persediaan', 'aset inventory', 'stock valuation'],
    actions: ['preview', 'view', 'excel', 'pdf'],
    existingReportId: 'stok-gudang',
    sourceDatabase: 'IN_ITEM / IN_PRODCAT',
    lastUpdated: 'Live query',
  },
  {
    reportCode: 'INV-16',
    flowStage: 'audit',
    name: 'Audit Kualitas Data Inventory',
    shortName: 'Inventory Data Quality',
    categoryLabel: 'MASTER DATA & QUALITY',
    description: 'Menampilkan data inventory yang perlu diperiksa, seperti kode kosong, stok negatif, harga nol, atau transaksi tanpa referensi dokumen.',
    businessPurpose: 'Membantu tim menemukan data bermasalah sebelum closing atau export laporan resmi.',
    cadence: 'Harian',
    owner: 'Inventory Control / IT',
    status: 'live',
    tags: ['audit inventory', 'data quality', 'stok negatif', 'kode kosong', 'harga nol'],
    actions: ['preview', 'view', 'excel', 'pdf'],
    existingReportId: 'item-movement-update-tracking',
    sourceDatabase: 'IN_ITEM / IN_ITEMCODE / quality flags',
    lastUpdated: 'Live query',
  },
]

const REPORT_FLOW_STAGE_BY_ID: Record<string, Exclude<FlowStageCode, 'all'>> = {
  'stok-gudang': 'valuation',
  'asset-stock-valuasi-listing': 'valuation',
  'item-movement-update-tracking': 'audit',
  'movement-stock': 'movement',
  'pengeluaran-barang': 'usage',
  'goods-receiving-receipt-activity': 'receive',
  'purchase-request-inventory': 'request',
  'transfer-antar-gudang': 'movement',
  'stock-opname': 'adjustment',
  'fuel-usage': 'usage',
  'riwayat-transaksi': 'audit',
  'return-barang': 'return',
  'item-stale-update': 'audit',
  'purchase-order-history': 'purchase_order',
  'supplier-purchasing-performance': 'purchase_order',
  'pupuk-stock-procurement': 'final_stock',
  'vehicle-running-workshop': 'usage',
}

const REPORT_SHORT_NAME_BY_ID: Record<string, string> = {
  'stok-gudang': 'Stok & Nilai Gudang',
  'asset-stock-valuasi-listing': 'Asset Stock Valuasi',
  'item-movement-update-tracking': 'Movement Health',
  'movement-stock': 'Movement Stock',
  'pengeluaran-barang': 'Pengeluaran Barang',
  'goods-receiving-receipt-activity': 'Goods Receiving',
  'purchase-request-inventory': 'PR Inventory',
  'transfer-antar-gudang': 'Transfer Gudang',
  'stock-opname': 'Stock Opname',
  'fuel-usage': 'Fuel Usage',
  'riwayat-transaksi': 'Riwayat Transaksi',
  'return-barang': 'Return Barang',
  'item-stale-update': 'Aging Master',
  'purchase-order-history': 'PO History',
  'supplier-purchasing-performance': 'Supplier Performance',
  'pupuk-stock-procurement': 'Pupuk Stock',
  'vehicle-running-workshop': 'Vehicle Workshop',
}

const LEGACY_CATALOG_BY_REPORT_ID = new Map(
  LEGACY_INVENTORY_FLOW_CATALOG.flatMap((report) =>
    report.existingReportId ? [[report.existingReportId, report] as const] : [],
  ),
)

function catalogStatus(report: InventoryReport): ReportStatusKey {
  if (report.status === 'live') return 'live'
  if (report.status === 'update') return 'need_validation'
  return 'planned'
}

function toInventoryCatalogReport(report: InventoryReport): InventoryCatalogReport {
  const legacyCatalog = LEGACY_CATALOG_BY_REPORT_ID.get(report.id)

  return {
    reportCode: report.code,
    flowStage: REPORT_FLOW_STAGE_BY_ID[report.id] ?? legacyCatalog?.flowStage ?? 'audit',
    name: report.title,
    shortName: REPORT_SHORT_NAME_BY_ID[report.id] ?? legacyCatalog?.shortName ?? report.title,
    categoryLabel: report.groupTitle,
    group: report.group,
    groupTitle: report.groupTitle,
    description: report.description,
    businessPurpose: report.executiveQuestion,
    cadence: report.cadence,
    owner: report.owner,
    status: catalogStatus(report),
    tags: report.tags,
    actions: ['preview', 'view', 'excel', 'pdf'],
    existingReportId: report.id,
    sourceDatabase: report.sourceTables.join(' / '),
    lastUpdated: report.lastUpdated,
  }
}

function catalogReportId(report: InventoryCatalogReport) {
  return report.existingReportId ?? report.reportCode
}

const LIVE_INVENTORY_REPORT_CATALOG = liveInventoryReports.map(toInventoryCatalogReport)

const LIVE_FLOW_STAGE_CODES = new Set<FlowStageCode>(
  LIVE_INVENTORY_REPORT_CATALOG.map((report) => report.flowStage),
)

const LIVE_FLOW_STAGES = FLOW_STAGES.filter((stage) => LIVE_FLOW_STAGE_CODES.has(stage.stageCode))

const WORKSPACE_TILES = [
  {
    title: 'Stock Movement',
    description: 'Mutasi stok dan pemakaian barang yang sudah memakai query live.',
    icon: Truck,
    color: '#2563EB',
    stages: ['Movement', 'Usage'],
  },
  {
    title: 'Stock Position',
    description: 'Posisi stok akhir dan valuasi persediaan dari report live.',
    icon: Warehouse,
    color: '#167A3A',
    stages: ['Final Stock', 'Valuation'],
  },
  {
    title: 'Inventory Quality',
    description: 'Audit kualitas data inventory dan update movement yang sudah live.',
    icon: ShieldCheck,
    color: '#D99A00',
    stages: ['Audit'],
  },
]

const REPORT_ANALYSIS_QUESTIONS: Record<string, string[]> = {
  'asset-stock-valuasi-listing': [
    'Product type mana yang paling besar membawa total_amount asset stock?',
    'Item apa yang paling material berdasarkan quantity_on_hand x unit_cost?',
    'Berapa item dengan quantity_on_hand nol atau unit_cost nol yang perlu direview?',
    'Apakah nilai workshop item mendominasi valuasi stock pabrik?',
  ],
  'INV-01': [
    'Permintaan barang apa yang paling besar dan paling lama belum terpenuhi?',
    'Berapa nilai outstanding request yang paling material?',
    'Unit atau gudang mana yang perlu diprioritaskan untuk follow up PR?',
    'Apakah ada request yang berisiko mengganggu operasional karena belum diterima?',
  ],
  'INV-02': [
    'PO mana yang paling besar nilainya dan belum diterima penuh?',
    'Supplier mana yang punya barang on order paling material?',
    'Item apa yang paling banyak masih dalam pesanan?',
    'Apakah ada PO yang perlu diprioritaskan karena outstanding tinggi?',
  ],
  'INV-03': [
    'Barang apa yang sedang dalam perjalanan dan paling material untuk gudang?',
    'Supplier atau shipment mana yang perlu disiapkan penerimaannya?',
    'Apakah ada in transit yang berisiko terlambat diterima?',
    'Gudang mana yang akan menerima barang paling banyak?',
  ],
  'INV-04': [
    'Barang masuk dari supplier mana yang paling besar hari ini?',
    'Dokumen goods receive mana yang paling material nilainya?',
    'Item apa yang paling banyak diterima dan berdampak ke stok?',
    'Apakah penerimaan sudah konsisten dengan referensi PO?',
  ],
  'INV-05': [
    'Dokumen mana yang punya selisih PO, penerimaan, dan invoice paling besar?',
    'Supplier mana yang perlu dicek karena matching belum lengkap?',
    'Item apa yang punya gap qty atau nilai paling material?',
    'Apa risiko terbesar sebelum invoice difinalisasi?',
  ],
  'INV-06': [
    'Barang apa yang perlu dicek lokasi penempatannya?',
    'Gudang atau bin mana yang paling padat berdasarkan qty/nilai?',
    'Apakah ada barang diterima yang belum jelas lokasinya?',
    'Kategori apa yang paling banyak ditempatkan di gudang aktif?',
  ],
  'INV-07': [
    'Jenis mutasi apa yang paling besar mempengaruhi stok?',
    'Item apa yang paling banyak bergerak masuk atau keluar?',
    'Gudang mana yang punya aktivitas mutasi paling material?',
    'Apakah movement keluar lebih dominan dibanding movement masuk?',
  ],
  'INV-08': [
    'Transfer antar gudang mana yang paling besar qty atau nilainya?',
    'Gudang asal dan tujuan mana yang paling aktif?',
    'Item apa yang paling sering dipindahkan antar gudang?',
    'Apakah ada transfer yang perlu dicek status penyelesaiannya?',
  ],
  'INV-09': [
    'Barang operasional apa yang paling besar pemakaiannya?',
    'Cost center atau blok mana yang paling banyak memakai barang?',
    'Item apa yang paling mengurangi stok operasional?',
    'Apakah ada pemakaian yang terlihat tidak biasa dibanding item lain?',
  ],
  'INV-10': [
    'Kendaraan atau unit mana yang memakai BBM paling besar?',
    'Jenis fuel apa yang paling dominan dalam pemakaian?',
    'Apakah ada pemakaian solar yang perlu ditinjau karena nilainya tinggi?',
    'Gudang atau blok mana yang paling besar menyerap BBM?',
  ],
  'INV-11': [
    'Barang apa yang paling banyak diretur ke supplier?',
    'Supplier mana yang paling sering menerima retur?',
    'Apa alasan atau kategori retur yang paling material?',
    'Berapa dampak retur terhadap nilai inventory?',
  ],
  'INV-12': [
    'Item apa yang punya selisih stock opname paling besar?',
    'Gudang mana yang perlu audit fisik lebih dulu?',
    'Apakah koreksi persediaan lebih banyak menambah atau mengurangi stok?',
    'Nilai adjustment mana yang paling material untuk closing?',
  ],
  'INV-13': [
    'Komponen apa yang paling mempengaruhi closing inventory bulan ini?',
    'Apakah saldo akhir lebih dipengaruhi barang masuk, keluar, transfer, atau adjustment?',
    'Gudang mana yang paling material dalam closing?',
    'Apa risiko data sebelum closing inventory dikunci?',
  ],
  'INV-14': [
    'Item atau gudang mana yang paling besar dalam posisi stok akhir?',
    'Kategori apa yang paling dominan pada ending stock?',
    'Apakah ada stok akhir yang perlu perhatian karena terlalu tinggi atau nol?',
    'Bagaimana ringkasan final stock untuk periode aktif?',
  ],
  'INV-15': [
    'Gudang mana yang memiliki nilai persediaan paling besar?',
    'Item apa yang paling material terhadap nilai aset inventory?',
    'Kategori mana yang paling mendominasi valuasi stok?',
    'Apa risiko utama jika nilai persediaan terbesar perlu divalidasi?',
  ],
  'INV-16': [
    'Quality flag apa yang paling banyak muncul dalam data inventory?',
    'Item mana yang perlu diprioritaskan untuk validasi master data?',
    'Apakah ada stok nol, harga nol, atau update stale yang material?',
    'Apa risiko data terbesar sebelum report resmi diexport?',
  ],
}

function analysisQuestions(report: InventoryCatalogReport) {
  const canonicalId = catalogReportId(report)
  const legacyCode = LEGACY_CATALOG_BY_REPORT_ID.get(canonicalId)?.reportCode
  return REPORT_ANALYSIS_QUESTIONS[canonicalId] ?? (legacyCode ? REPORT_ANALYSIS_QUESTIONS[legacyCode] : undefined) ?? [
    `Apa temuan paling material dari ${report.shortName}?`,
    `Apa risiko utama dari payload ${report.shortName}?`,
    `Aksi apa yang perlu dilakukan berdasarkan report ini?`,
  ]
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') return value.toLocaleString('id-ID')
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
    }
    return value
  }
  return String(value)
}

function numericValue(row: DbRow) {
  const value = Object.values(row).find((item) => typeof item === 'number') as number | undefined
  return value ?? 0
}

function labelValue(row: DbRow) {
  const value = Object.values(row).find((item) => typeof item === 'string')
  return value ? String(value) : 'Data'
}

function normalizeSource(value: string | null): ReportSource {
  return value === 'pabrik' ? 'pabrik' : 'estate'
}

function normalizeStage(value: string | null): FlowStageCode {
  return value && LIVE_FLOW_STAGE_CODES.has(value as FlowStageCode) ? (value as FlowStageCode) : 'all'
}

function normalizeMovementWindow(value: string | null) {
  return MOVEMENT_WINDOW_OPTIONS.some((option) => option.value === value) ? String(value) : 'all'
}

function normalizeStaleFilter(value: string | null) {
  return STALE_FILTER_OPTIONS.some((option) => option.value === value) ? String(value) : 'dari-1-bulan-sampai-sekarang'
}

function normalizeReportGroup(value: string | null) {
  if (!value || value === 'all') return 'all'
  return LIVE_INVENTORY_REPORT_CATALOG.some((report) => report.group === value) ? value : 'all'
}

function normalizeAnalysisGroup(value: string | null): InventoryAnalysisGroup {
  return INVENTORY_ANALYSIS_GROUP_OPTIONS.some((option) => option.value === value)
    ? (value as InventoryAnalysisGroup)
    : 'ProductTypeCode'
}

function cleanScopeCode(value: string | null) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9_.-]/g, '').slice(0, 40)
}

function scopeCodeFromParams(analysisGroup: InventoryAnalysisGroup, params: { get(name: string): string | null }) {
  if (analysisGroup === 'MovementCategory') return params.get('movementCategory') ?? ''
  if (analysisGroup === 'ProductTypeCode') return cleanScopeCode(params.get('productType'))
  if (analysisGroup === 'ProductCategoryCode') return cleanScopeCode(params.get('productCategory'))
  if (analysisGroup === 'ProductBrandCode') return cleanScopeCode(params.get('productBrand'))
  if (analysisGroup === 'ProductModelCode') return cleanScopeCode(params.get('productModel'))
  if (analysisGroup === 'ProductMaterialCode') return cleanScopeCode(params.get('productMaterial'))
  return ''
}

function findCatalogReport(value: string | null) {
  if (!value) return LIVE_INVENTORY_REPORT_CATALOG.find((report) => report.existingReportId === 'stok-gudang') ?? LIVE_INVENTORY_REPORT_CATALOG[0]
  const normalized = value.toLowerCase()
  return (
    LIVE_INVENTORY_REPORT_CATALOG.find((report) => report.reportCode.toLowerCase() === normalized) ??
    LIVE_INVENTORY_REPORT_CATALOG.find((report) => report.existingReportId?.toLowerCase() === normalized) ??
    LIVE_INVENTORY_REPORT_CATALOG.find((report) => report.name.toLowerCase() === normalized) ??
    LIVE_INVENTORY_REPORT_CATALOG.find((report) => report.shortName.toLowerCase() === normalized) ??
    LIVE_INVENTORY_REPORT_CATALOG[0]
  )
}

function sourceDescription(source: ReportSource) {
  return SOURCE_OPTIONS.find((item) => item.id === source)?.description ?? SOURCE_OPTIONS[0].description
}

function sourceLabel(source: ReportSource) {
  return SOURCE_OPTIONS.find((item) => item.id === source)?.label ?? SOURCE_OPTIONS[0].label
}

function stageInfo(stageCode: FlowStageCode) {
  if (stageCode === 'all') {
    return {
      stageCode: 'all' as const,
      stageName: 'All Flow',
      shortName: 'All',
      description: 'Semua alur inventory.',
      icon: Layers,
      color: '#167A3A',
      status: 'live' as ReportStatusKey,
    }
  }
  return FLOW_STAGES.find((stage) => stage.stageCode === stageCode) ?? FLOW_STAGES[0]
}

function statusLabel(status: ReportStatusKey) {
  const labels: Record<ReportStatusKey, string> = {
    live: 'Live',
    preview: 'Preview',
    mapping_db: 'Mapping DB',
    need_validation: 'Need Validation',
    planned: 'Planned',
  }
  return labels[status]
}

function statusClasses(status: ReportStatusKey) {
  const classes: Record<ReportStatusKey, string> = {
    live: 'border-[rgba(52,211,153,.35)] bg-[rgba(52,211,153,.12)] text-emerald-200',
    preview: 'border-[rgba(41,199,200,.35)] bg-[rgba(41,199,200,.12)] text-cyan-200',
    mapping_db: 'border-[rgba(245,158,11,.35)] bg-[rgba(245,158,11,.12)] text-amber-200',
    need_validation: 'border-[rgba(214,184,92,.38)] bg-[rgba(214,184,92,.12)] text-yellow-100',
    planned: 'border-[var(--rc-forest-border)] bg-white/5 text-[var(--rc-text-faint)]',
  }
  return classes[status]
}

function canOpenReport(report: InventoryCatalogReport) {
  return report.status === 'live' && Boolean(report.existingReportId)
}

function appendFilterParam(params: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null || value === '') return
  params.set(key, String(value))
}

function buildModuleReportParams(report: InventoryReport, source: ReportSource, limit = 50, filters: ReportFilterInput = {}) {
  const params = new URLSearchParams({ report: report.apiReport, limit: String(limit), source })
  appendFilterParam(params, 'stale', filters.stale)
  appendFilterParam(params, 'movementWindow', filters.movementWindow ?? 'all')
  appendFilterParam(params, 'period', filters.period)
  appendFilterParam(params, 'stockAnalysis', filters.stockAnalysis)
  appendFilterParam(params, 'productType', filters.productType)
  appendFilterParam(params, 'productCategory', filters.productCategory)
  appendFilterParam(params, 'productBrand', filters.productBrand)
  appendFilterParam(params, 'productModel', filters.productModel)
  appendFilterParam(params, 'productMaterial', filters.productMaterial)
  appendFilterParam(params, 'movementCategory', filters.movementCategory)
  appendFilterParam(params, 'groupBy', filters.groupBy)
  appendFilterParam(params, 'chartDimension', filters.chartDimension)
  return params
}

async function fetchReport(report: InventoryReport, source: ReportSource, limit = 50, filters: ReportFilterInput = {}) {
  const params = buildModuleReportParams(report, source, limit, filters)
  const response = await fetch(`/api/reports/inventory?${params.toString()}`, { cache: 'no-store', headers: typeof window !== 'undefined' ? { 'x-sql-gateway-base': window.localStorage.getItem('report-center:sql-gateway-base') || 'http://10.0.0.110:8001' } : undefined })
  const data = (await response.json()) as ApiResponse
  if (!response.ok || !data.success || !data.data) {
    throw new Error(data.error ?? 'Gagal memuat laporan')
  }
  return data.data
}

async function exportExcel(report: InventoryReport, source: ReportSource, filters: ReportFilterInput = {}) {
  const payload = await fetchReport(report, source, 500, filters)
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.json_to_sheet(payload.rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, report.title.slice(0, 31))
  XLSX.writeFile(workbook, `${report.id}.xlsx`)
}

async function exportPdf(report: InventoryReport, source: ReportSource, filters: ReportFilterInput = {}) {
  const payload = await fetchReport(report, source, 80, filters)
  const { default: JsPDF } = await import('jspdf')
  const doc = new JsPDF({ orientation: 'landscape', unit: 'pt' })
  const columns = payload.columns.slice(0, 6)
  let y = 48
  doc.setFontSize(16)
  doc.text(report.title, 40, y)
  y += 20
  doc.setFontSize(9)
  doc.text(payload.description, 40, y)
  y += 28
  doc.setFontSize(8)
  doc.text(columns.join(' | '), 40, y)
  y += 16
  payload.rows.slice(0, 28).forEach((row) => {
    doc.text(columns.map((column) => formatValue(row[column])).join(' | ').slice(0, 150), 40, y)
    y += 14
  })
  doc.save(`${report.id}.pdf`)
}

function TileShell({
  children,
  className = '',
  active = false,
}: {
  children: React.ReactNode
  className?: string
  active?: boolean
}) {
  return (
    <div
      className={[
        'rounded-[18px] border border-[var(--rc-forest-border)] bg-[var(--rc-forest-surface)] p-[18px] shadow-[0_4px_16px_rgba(0,0,0,.2)] transition duration-200',
        active
          ? 'border-[rgba(155,226,61,.42)] bg-[linear-gradient(90deg,rgba(24,185,107,.16),rgba(155,226,61,.05))] shadow-[inset_3px_0_0_var(--rc-forest-accent),0_0_24px_rgba(24,185,107,.08)]'
          : 'hover:-translate-y-0.5 hover:border-[var(--rc-forest-border-strong)] hover:bg-[var(--rc-forest-surface-raised)]',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

function StatusBadge({ status }: { status: ReportStatusKey }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold shadow-sm ${statusClasses(status)}`}>
      {statusLabel(status)}
    </span>
  )
}

function MiniTile({
  label,
  value,
  icon: Icon,
  color = '#167A3A',
}: {
  label: string
  value: string
  icon: LucideIcon
  color?: string
}) {
  return (
    <TileShell className="min-h-[96px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">{label}</p>
          <p className="mt-2 truncate text-lg font-extrabold text-[var(--rc-text)]">{value}</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white" style={{ backgroundColor: color }}>
          <Icon size={18} />
        </span>
      </div>
    </TileShell>
  )
}

function WorkspaceTile({ tile }: { tile: (typeof WORKSPACE_TILES)[number] }) {
  const Icon = tile.icon
  return (
    <TileShell className="min-h-[180px]">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ backgroundColor: tile.color }}>
          <Icon size={23} />
        </span>
        <span className="rounded-full border border-[var(--rc-forest-border)] bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-[var(--rc-text-faint)]">
          Workspace
        </span>
      </div>
      <h3 className="mt-4 text-lg font-extrabold text-[var(--rc-text)]">{tile.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--rc-text-muted)]">{tile.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tile.stages.map((stage) => (
          <span key={stage} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-[var(--rc-text-muted)]">
            {stage}
          </span>
        ))}
      </div>
    </TileShell>
  )
}

function FlowStageTile({
  stage,
  count,
  active,
  onClick,
}: {
  stage: ReturnType<typeof stageInfo>
  count: number
  active: boolean
  onClick: () => void
}) {
  const Icon = stage.icon
  return (
    <button type="button" onClick={onClick} className="min-w-[180px] text-left">
      <TileShell active={active} className="min-h-[150px]">
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ backgroundColor: stage.color }}>
            <Icon size={21} />
          </span>
          <StatusBadge status={stage.status} />
        </div>
        <h3 className="mt-3 truncate text-base font-extrabold text-[var(--rc-text)]">{stage.shortName}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--rc-text-muted)]">{stage.description}</p>
        <p className="mt-3 text-xs font-extrabold text-[var(--rc-text-faint)]">{count} report</p>
      </TileShell>
    </button>
  )
}

function KpiTile({
  label,
  value,
  context,
  basis,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  context: string
  basis: string
  icon: LucideIcon
  color: string
}) {
  return (
    <TileShell className="min-h-[156px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">{label}</p>
          <p className="mt-2 truncate text-2xl font-extrabold text-[var(--rc-text)]">{value}</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-[var(--rc-text-muted)]">{context}</p>
          <p className="mt-2 rounded-xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold leading-4 text-[var(--rc-text-faint)]">Basis: {basis}</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{ backgroundColor: color }}>
          <Icon size={20} />
        </span>
      </div>
    </TileShell>
  )
}

function AIInsightTile({
  selectedReport,
  hasLivePayload,
  payload,
  dataSource,
  error,
}: {
  selectedReport: InventoryCatalogReport
  hasLivePayload: boolean
  payload: ReportPayload | null
  dataSource: string
  error: string | null
}) {
  const questions = analysisQuestions(selectedReport)
  const [selectedQuestion, setSelectedQuestion] = useState(questions[0] ?? '')
  const [generatedInsight, setGeneratedInsight] = useState<InsightContent | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  useEffect(() => {
    const nextQuestions = analysisQuestions(selectedReport)
    setSelectedQuestion(nextQuestions[0] ?? '')
    setGeneratedInsight(null)
    setGenerateError(null)
  }, [selectedReport])

  const fallbackInsight: InsightContent = {
    summary: `Pilih pertanyaan untuk ${selectedReport.shortName}. AI akan menjawab dari payload report, bukan query baru.`,
    trendDetection: hasLivePayload ? 'Payload live tersedia untuk dianalisis.' : 'Payload belum tersedia untuk report ini.',
    anomalyDetection: error ?? `Status report: ${statusLabel(selectedReport.status)}.`,
    recommendation: canOpenReport(selectedReport) ? 'Klik salah satu pertanyaan bisnis untuk membuat analisa berbasis payload.' : 'Selesaikan mapping DB agar pertanyaan bisa dijawab dari payload live.',
    dataQualityNote: `Daftar pertanyaan adalah metadata report. Sumber aktif: ${dataSource}.`,
  }
  const activeInsight = generatedInsight ?? fallbackInsight

  const generateQuestionInsight = async (question: string) => {
    setSelectedQuestion(question)
    setGeneratedInsight(null)
    setGenerateError(null)

    if (!payload) {
      setGenerateError('AI belum bisa menjawab karena payload live belum tersedia untuk report ini.')
      return
    }

    setGenerating(true)
    try {
      const response = await fetch('/api/reports/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${selectedReport.reportCode} - ${selectedReport.shortName}`,
          context: {
            moduleId: 'inventory',
            moduleName: 'Inventory',
            reportName: selectedReport.name,
            reportDescription: selectedReport.description,
            dataSource,
            analysisQuestion: question,
            analysisQuestions: questions,
            summary: payload.summary,
            metadata: payload.metadata,
            sampleRows: payload.rows.slice(0, 8),
            chart: payload.chart.slice(0, 8),
            alerts: [selectedReport.businessPurpose],
          },
          fallbackInsight,
        }),
      })
      const result = (await response.json()) as {
        success?: boolean
        insight?: InsightContent
        error?: string
        warning?: string
      }
      if (!response.ok || !result.success || !result.insight) {
        throw new Error(result.error ?? 'AI gagal membaca payload report.')
      }
      setGeneratedInsight(result.insight)
      setGenerateError(result.warning ?? null)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'AI gagal membaca payload report.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <aside className="flex min-h-[320px] flex-col overflow-hidden rounded-[18px] border border-emerald-400/30 bg-[linear-gradient(145deg,#052E2B_0%,#064E3B_62%,#0B3B2A_100%)] p-[18px] text-white shadow-[0_18px_42px_rgba(6,78,59,0.24)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-200">AI Insight</p>
          <h3 className="mt-1 text-xl font-extrabold">Question-Based Payload Analysis</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-bold text-emerald-100">
          <Sparkles size={13} />
          SAFE
        </span>
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-4">
        <p className="text-[11px] font-bold tracking-[0.18em] text-emerald-200">PERTANYAAN REPORT</p>
        <div className="mt-3 grid gap-2">
          {questions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => void generateQuestionInsight(question)}
              className={[
                'rounded-xl border px-3 py-2 text-left text-xs font-semibold leading-5 transition',
                selectedQuestion === question
                  ? 'border-[rgba(52,211,153,.28)] bg-emerald-300/20 text-white'
                  : 'border-white/10 bg-white/5 text-emerald-50/85 hover:bg-white/10',
              ].join(' ')}
            >
              {question}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] font-semibold text-emerald-100/80">
          {generating ? 'AI sedang membaca payload...' : hasLivePayload ? 'Klik pertanyaan untuk analisa dari payload.' : 'Pertanyaan siap, payload live belum tersedia.'}
        </p>
      </div>
      <div className="mt-3 grid flex-1 gap-3">
        {[
          ['PERTANYAAN AKTIF', selectedQuestion || 'Belum memilih pertanyaan.'],
          ['ANALISA UTAMA', activeInsight.summary],
          ['SOROTAN DATA', activeInsight.trendDetection],
          ['RISIKO / OUTLIER', activeInsight.anomalyDetection],
          ['AKSI', activeInsight.recommendation],
          ['CATATAN DATA', activeInsight.dataQualityNote],
        ].map(([title, text]) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <p className="text-[11px] font-bold tracking-[0.18em] text-emerald-200">{title}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--rc-text)]">{text}</p>
          </div>
        ))}
        {generateError && (
          <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs font-semibold leading-5 text-amber-100">
            {generateError}
          </div>
        )}
        {!hasLivePayload && !generateError && (
          <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs font-semibold leading-5 text-amber-100">
            AI menunggu payload hasil query. AI tidak melakukan query database sendiri.
          </div>
        )}
      </div>
    </aside>
  )
}

function ReportTile({
  report,
  source,
  selected,
  favorite,
  onPreview,
  onView,
  onFavorite,
  onExcel,
  onPdf,
}: {
  report: InventoryCatalogReport
  source: ReportSource
  selected: boolean
  favorite: boolean
  onPreview: () => void
  onView: () => void
  onFavorite: () => void
  onExcel: () => void
  onPdf: () => void
}) {
  const stage = stageInfo(report.flowStage)
  const StageIcon = stage.icon
  const openable = canOpenReport(report)

  return (
    <TileShell
      active={selected}
      className={[
        'flex min-h-[340px] flex-col overflow-hidden',
        selected ? 'ring-2 ring-emerald-500/15' : 'ring-1 ring-slate-200/80',
      ].join(' ')}
    >
      <div className="-mx-[18px] -mt-[18px] h-2" style={{ backgroundColor: stage.color }} />

      <div className="mt-4 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border px-2.5 py-1 text-[11px] font-extrabold" style={{ borderColor: `${stage.color}30`, backgroundColor: `${stage.color}14`, color: stage.color }}>
              <StageIcon size={13} />
              {stage.stageName}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-2.5 py-1 text-[11px] font-extrabold text-[var(--rc-text-muted)]">
              <Database size={12} />
              {sourceLabel(source)}
            </span>
          </div>
          <StatusBadge status={report.status} />
        </div>
      </div>

      <button
        type="button"
        onClick={onPreview}
        className="mt-3 min-w-0 flex-1 rounded-2xl border border-[var(--rc-forest-border)] bg-[rgba(7,26,20,.82)] p-4 text-left transition hover:border-emerald-300 hover:bg-[rgba(24,185,107,.12)]"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">{report.categoryLabel}</p>
        <div className="mt-2 flex items-start gap-2">
          <span className="shrink-0 rounded-lg border border-[var(--rc-forest-border)] bg-white/[0.06] px-2 py-1 text-[11px] font-extrabold text-[var(--rc-text-muted)]">{report.reportCode}</span>
          <h3 className="line-clamp-2 text-lg font-extrabold leading-6 text-[var(--rc-text)]">{report.name}</h3>
        </div>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--rc-text-muted)]">{report.description}</p>
      </button>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-3">
          <p className="text-[11px] font-semibold text-[var(--rc-text-faint)]">Cadence</p>
          <p className="mt-1 truncate text-sm font-extrabold text-[var(--rc-text)]">{report.cadence}</p>
        </div>
        <div className="rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-3">
          <p className="text-[11px] font-semibold text-[var(--rc-text-faint)]">Owner</p>
          <p className="mt-1 truncate text-sm font-extrabold text-[var(--rc-text)]">{report.owner}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {report.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-full border border-[var(--rc-forest-border)] bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-[var(--rc-text-muted)]">
            {tag}
          </span>
        ))}
        <span className="rounded-full border border-[rgba(52,211,153,.28)] bg-[rgba(24,185,107,.12)] px-2.5 py-1 text-xs font-bold text-[var(--rc-forest-accent)]">
          {analysisQuestions(report).length} pertanyaan AI
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr_auto_auto] gap-2 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-3">
        <button
          type="button"
          onClick={onFavorite}
          className={favorite ? 'grid h-10 w-10 place-items-center rounded-xl border border-[rgba(245,158,11,.28)] bg-amber-100 text-amber-600' : 'grid h-10 w-10 place-items-center rounded-xl border border-[var(--rc-forest-border)] bg-white/[0.04] text-[var(--rc-text-faint)] hover:border-[rgba(245,158,11,.28)] hover:text-amber-500'}
          aria-label={favorite ? 'Hapus favorit' : 'Tambah favorit'}
        >
          <Star size={16} fill={favorite ? 'currentColor' : 'none'} />
        </button>
        <button type="button" onClick={onPreview} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-2 text-sm font-bold text-[var(--rc-text-muted)] hover:border-[rgba(52,211,153,.28)] hover:bg-white/10">
          <Eye size={15} />
          Preview
        </button>
        <button
          type="button"
          onClick={onExcel}
          disabled={!openable}
          className={openable ? 'grid h-10 w-10 place-items-center rounded-xl border border-[rgba(52,211,153,.28)] bg-[rgba(24,185,107,.12)] text-[var(--rc-forest-accent)] hover:bg-emerald-100' : 'grid h-10 w-10 cursor-not-allowed place-items-center rounded-xl border border-[var(--rc-forest-border)] bg-white/[0.04] text-[var(--rc-text-muted)]'}
          aria-label="Export Excel"
        >
          <FileSpreadsheet size={15} />
        </button>
        <button
          type="button"
          onClick={onPdf}
          disabled={!openable}
          className={openable ? 'grid h-10 w-10 place-items-center rounded-xl border border-[rgba(251,113,133,.28)] bg-[rgba(251,113,133,.12)] text-red-200 hover:bg-red-100' : 'grid h-10 w-10 cursor-not-allowed place-items-center rounded-xl border border-[var(--rc-forest-border)] bg-white/[0.04] text-[var(--rc-text-muted)]'}
          aria-label="Export PDF"
        >
          <Download size={15} />
        </button>
      </div>
      <button
        type="button"
        onClick={onView}
        disabled={!openable}
        className={openable ? 'mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--rc-forest-primary)] px-3 text-sm font-bold text-[#03130b] hover:brightness-110' : 'mt-2 inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 text-sm font-bold text-[var(--rc-text-faint)]'}
      >
        {openable ? 'Buka Report' : 'Catalog Preview'}
        <ArrowRight size={15} />
      </button>
    </TileShell>
  )
}

export type InventoryReportsClientProps = {
  /** When true, hide outer chrome + overview (parent procurement already shows KPI/overview). */
  embedded?: boolean
  /** Force source from parent procurement workspace. */
  fixedSource?: ReportSource
  /** Scope Gudang/Workshop under Inventory. */
  itemType?: 'gudang' | 'workshop'
}

export default function InventoryReportsClient({
  embedded = false,
  fixedSource,
  itemType,
}: InventoryReportsClientProps = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamString = searchParams.toString()
  const lastSyncedSearchRef = useRef<string | null>(null)
  const searchWriteTimerRef = useRef<number | null>(null)
  const initialSource = normalizeSource(fixedSource ?? searchParams.get('source'))
  const initialReport = findCatalogReport(searchParams.get('report'))
  const initialStage = normalizeStage(searchParams.get('stage'))
  const initialMovementWindow = normalizeMovementWindow(searchParams.get('movementWindow'))
  const initialAnalysisGroup = normalizeAnalysisGroup(searchParams.get('groupBy') ?? searchParams.get('chartDimension'))
  const initialReportGroup = normalizeReportGroup(searchParams.get('reportGroup'))
  const [selectedSource, setSelectedSource] = useState<ReportSource>(initialSource)
  const [selectedReportCode, setSelectedReportCode] = useState(initialReport.reportCode)
  const [activeStage, setActiveStage] = useState<FlowStageCode>(initialStage)
  const [activeReportGroup, setActiveReportGroup] = useState(initialReportGroup)
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [staleFilter, setStaleFilter] = useState(normalizeStaleFilter(searchParams.get('stale')))
  const [movementWindowFilter, setMovementWindowFilter] = useState(initialMovementWindow)
  const [periodFilter, setPeriodFilter] = useState(searchParams.get('period') ?? '')
  const [analysisGroup, setAnalysisGroup] = useState<InventoryAnalysisGroup>(initialAnalysisGroup)
  const [scopeCode, setScopeCode] = useState(() => scopeCodeFromParams(initialAnalysisGroup, searchParams))
  const [payload, setPayload] = useState<ReportPayload | null>(null)
  const [aiDashboard, setAiDashboard] = useState<AiDashboardDefinition | null>(null)
  const [aiDashboardLoading, setAiDashboardLoading] = useState(false)
  const [aiDashboardError, setAiDashboardError] = useState<string | null>(null)
  const [aiInsightVisible, setAiInsightVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Which catalog group section is in view / last jumped to. */
  const [activeCatalogGroup, setActiveCatalogGroup] = useState<string>('')
  const catalogJumpLockRef = useRef(false)
  const { favorites, toggleFavorite, addRecent } = useReportStore()

  const selectedCatalogReport = LIVE_INVENTORY_REPORT_CATALOG.find((report) => report.reportCode === selectedReportCode) ?? LIVE_INVENTORY_REPORT_CATALOG[0]
  const selectedStage = stageInfo(activeStage)
  const selectedReportStage = stageInfo(selectedCatalogReport.flowStage)
  const linkedLiveReport = selectedCatalogReport.existingReportId ? getInventoryReport(selectedCatalogReport.existingReportId) : undefined
  const openableSelectedReport = canOpenReport(selectedCatalogReport) && Boolean(linkedLiveReport)
  useEffect(() => {
    if (fixedSource) setSelectedSource(fixedSource)
  }, [fixedSource])

  const moduleScopeFilters = useMemo<ReportFilterInput>(() => {
    const code = cleanScopeCode(scopeCode)
    const filters: ReportFilterInput = {
      stale: selectedCatalogReport.existingReportId === 'item-movement-update-tracking' ? staleFilter : undefined,
      movementWindow: movementWindowFilter || 'all',
      period: periodFilter || undefined,
      groupBy: analysisGroup,
      chartDimension: analysisGroup,
      itemType: itemType || undefined,
    }

    if (analysisGroup === 'ProductTypeCode') filters.productType = code || undefined
    if (analysisGroup === 'ProductCategoryCode') filters.productCategory = code || undefined
    if (analysisGroup === 'ProductBrandCode') filters.productBrand = code || undefined
    if (analysisGroup === 'ProductModelCode') filters.productModel = code || undefined
    if (analysisGroup === 'ProductMaterialCode') filters.productMaterial = code || undefined
    if (analysisGroup === 'MovementCategory') filters.movementCategory = scopeCode.trim() || undefined

    return filters
  }, [analysisGroup, itemType, movementWindowFilter, periodFilter, scopeCode, selectedCatalogReport.existingReportId, staleFilter])
  const activeAnalysisGroup = INVENTORY_ANALYSIS_GROUP_OPTIONS.find((option) => option.value === analysisGroup) ?? INVENTORY_ANALYSIS_GROUP_OPTIONS[0]
  const stageCounts = useMemo(
    () =>
      new Map<FlowStageCode, number>(
        LIVE_FLOW_STAGES.map((stage) => [
          stage.stageCode,
          LIVE_INVENTORY_REPORT_CATALOG.filter((report) => report.flowStage === stage.stageCode).length,
        ]),
      ),
    [],
  )

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase()
    return LIVE_INVENTORY_REPORT_CATALOG.filter((report) => {
      const stageMatch = activeStage === 'all' || report.flowStage === activeStage
      const groupMatch = activeReportGroup === 'all' || report.group === activeReportGroup
      const queryMatch =
        !q ||
        [
          report.reportCode,
          report.name,
          report.shortName,
          report.description,
          report.businessPurpose,
          report.categoryLabel,
          report.groupTitle ?? '',
          report.owner,
          report.cadence,
          statusLabel(report.status),
          stageInfo(report.flowStage).stageName,
          ...analysisQuestions(report),
          ...report.tags,
        ].some((value) => value.toLowerCase().includes(q))
      return stageMatch && groupMatch && queryMatch
    })
  }, [activeReportGroup, activeStage, search])

  const reportGroupOptions = useMemo(() => {
    const seen = new Map<string, string>()
    LIVE_INVENTORY_REPORT_CATALOG.forEach((report) => {
      if (report.group && !seen.has(report.group)) seen.set(report.group, report.groupTitle ?? report.categoryLabel)
    })
    return Array.from(seen, ([group, title]) => ({ group, title }))
  }, [])

  const groupedReports = useMemo(() => reportGroupOptions
    .map((group) => ({
      group,
      reports: filteredReports.filter((report) => report.group === group.group),
    }))
    .filter((group) => group.reports.length > 0), [filteredReports, reportGroupOptions])

  useEffect(() => {
    if (!groupedReports.length) {
      setActiveCatalogGroup('')
      return
    }
    if (!groupedReports.some((entry) => entry.group.group === activeCatalogGroup)) {
      setActiveCatalogGroup(groupedReports[0].group.group)
    }
  }, [activeCatalogGroup, groupedReports])

  const jumpToCatalogGroup = (groupId: string) => {
    const target = document.getElementById(`catalog-group-${groupId}`)
    if (!target) return
    const root = target.closest('.rc-scroll-root') as HTMLElement | null
    catalogJumpLockRef.current = true
    setActiveCatalogGroup(groupId)

    if (root) {
      const rootRect = root.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const stickyNav = root.querySelector('.rc-catalog-jump') as HTMLElement | null
      const stickyOffset = (stickyNav?.offsetHeight ?? 56) + 12
      const nextTop = root.scrollTop + (targetRect.top - rootRect.top) - stickyOffset
      root.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    window.setTimeout(() => {
      catalogJumpLockRef.current = false
    }, 700)
  }

  useEffect(() => {
    if (!groupedReports.length) return

    const first = document.getElementById(`catalog-group-${groupedReports[0].group.group}`)
    const root = (first?.closest('.rc-scroll-root') as HTMLElement | null) ?? null
    if (!root) return

    const onScroll = () => {
      if (catalogJumpLockRef.current) return
      const stickyNav = root.querySelector('.rc-catalog-jump') as HTMLElement | null
      const marker = root.getBoundingClientRect().top + (stickyNav?.offsetHeight ?? 56) + 24
      let current = groupedReports[0].group.group
      for (const entry of groupedReports) {
        const el = document.getElementById(`catalog-group-${entry.group.group}`)
        if (!el) continue
        if (el.getBoundingClientRect().top <= marker) current = entry.group.group
      }
      setActiveCatalogGroup((prev) => (prev === current ? prev : current))
    }

    onScroll()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [groupedReports])

  const sourceTileValue = sourceDescription(selectedSource)
  const liveCount = LIVE_INVENTORY_REPORT_CATALOG.length
  const summaryEntries = payload ? Object.entries(payload.summary).slice(0, 4) : []
  const previewColumns = payload?.columns.slice(0, 5) ?? []
  const previewRows = payload?.rows.slice(0, 5) ?? []
  const maxChart = payload?.chart.reduce((max, row) => Math.max(max, numericValue(row)), 0) ?? 0
  const selectedReportGroupLabel = activeReportGroup === 'all'
    ? 'Semua group'
    : reportGroupOptions.find((group) => group.group === activeReportGroup)?.title ?? activeReportGroup
  const movementWindowLabel = MOVEMENT_WINDOW_OPTIONS.find((item) => item.value === movementWindowFilter)?.label ?? movementWindowFilter
  const staleFilterLabel = STALE_FILTER_OPTIONS.find((item) => item.value === staleFilter)?.label ?? staleFilter
  const activeScopeSummary = [
    selectedReportGroupLabel,
    selectedStage.stageName,
    search.trim() ? `Cari: ${search.trim()}` : 'Tanpa search',
    periodFilter || 'Period current',
    movementWindowLabel,
  ].join(' · ')
  const reportSelectOptions = filteredReports.length ? filteredReports : [selectedCatalogReport]
  const kpiCards = [
    {
      label: 'Reports shown',
      value: String(filteredReports.length),
      context: activeScopeSummary,
      basis: `${filteredReports.length} dari ${liveCount} live report setelah filter aktif`,
      icon: Table2,
      color: '#167A3A',
    },
    {
      label: 'Active source',
      value: sourceLabel(selectedSource),
      context: sourceTileValue,
      basis: `URL param source=${selectedSource}`,
      icon: Database,
      color: '#2563EB',
    },
    {
      label: 'Current scope',
      value: activeAnalysisGroup.label,
      context: `Code: ${scopeCode || 'semua'} · ${movementWindowLabel}`,
      basis: `groupBy=${analysisGroup}; period=${periodFilter || 'current'}`,
      icon: Filter,
      color: '#D99A00',
    },
    {
      label: 'Selected report',
      value: selectedCatalogReport.shortName,
      context: `${selectedCatalogReport.reportCode} · ${statusLabel(selectedCatalogReport.status)} · ${selectedReportStage.stageName}`,
      basis: openableSelectedReport ? `linked live report=${linkedLiveReport?.id}` : 'catalog preview; live link belum tersedia',
      icon: FileText,
      color: selectedReportStage.color,
    },
  ]

  const moduleUrl = (
    source: ReportSource,
    stage: FlowStageCode,
    reportCode: string,
    filters: ReportFilterInput = moduleScopeFilters,
    nextSearch = search,
    nextReportGroup = activeReportGroup,
    nextStale = staleFilter,
  ) => {
    // Stay on current route (procurement embedded or inventory) so filter changes
    // never bounce through /inventory redirect and reset scroll.
    const basePath = pathname.startsWith('/report-center/procurement')
      ? '/report-center/procurement'
      : pathname.startsWith('/report-center/inventory')
        ? pathname
        : '/report-center/procurement'
    const params = new URLSearchParams()
    const stockGroup = searchParams.get('stockGroup') ?? (itemType === 'gudang' ? 'gudang' : itemType === 'workshop' ? 'workshop' : 'inventory')
    appendFilterParam(params, 'source', source)
    appendFilterParam(params, 'stockGroup', stockGroup)
    appendFilterParam(params, 'stage', stage)
    appendFilterParam(params, 'report', reportCode)
    const targetReport = findCatalogReport(reportCode)
    appendFilterParam(params, 'search', nextSearch.trim())
    if (nextReportGroup !== 'all') appendFilterParam(params, 'reportGroup', nextReportGroup)
    if (targetReport.existingReportId === 'item-movement-update-tracking') appendFilterParam(params, 'stale', nextStale)
    appendFilterParam(params, 'period', filters.period)
    appendFilterParam(params, 'movementWindow', filters.movementWindow)
    appendFilterParam(params, 'groupBy', filters.groupBy)
    appendFilterParam(params, 'chartDimension', filters.chartDimension)
    appendFilterParam(params, 'stockAnalysis', filters.stockAnalysis)
    appendFilterParam(params, 'productType', filters.productType)
    appendFilterParam(params, 'productCategory', filters.productCategory)
    appendFilterParam(params, 'productBrand', filters.productBrand)
    appendFilterParam(params, 'productModel', filters.productModel)
    appendFilterParam(params, 'productMaterial', filters.productMaterial)
    appendFilterParam(params, 'movementCategory', filters.movementCategory)
    return `${basePath}?${params.toString()}`
  }

  const updateUrl = (
    source: ReportSource,
    stage: FlowStageCode,
    reportCode: string,
    filters: ReportFilterInput = moduleScopeFilters,
    nextSearch = search,
    nextReportGroup = activeReportGroup,
    nextStale = staleFilter,
  ) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(REPORT_SOURCE_STORAGE_KEY, source)
      window.dispatchEvent(new CustomEvent('report-center-source-change', { detail: source }))
    }
    const nextUrl = moduleUrl(source, stage, reportCode, filters, nextSearch, nextReportGroup, nextStale)
    const currentUrl = `${pathname}?${searchParamString}`
    if (nextUrl === currentUrl || nextUrl === `${pathname}?`) return
    // Mark as local write so the URL-sync effect does not re-apply the same params.
    lastSyncedSearchRef.current = nextUrl.split('?')[1] ?? ''
    router.replace(nextUrl, { scroll: false })
  }

  const reportForScope = (stage: FlowStageCode, reportGroup: string) => {
    const reports = LIVE_INVENTORY_REPORT_CATALOG.filter((report) => {
      const stageMatch = stage === 'all' || report.flowStage === stage
      const groupMatch = reportGroup === 'all' || report.group === reportGroup
      return stageMatch && groupMatch
    })
    return reports.find((report) => report.reportCode === selectedCatalogReport.reportCode) ?? reports[0] ?? selectedCatalogReport
  }

  const selectSource = (source: ReportSource) => {
    setAiInsightVisible(false)
    setSelectedSource(source)
    updateUrl(source, activeStage, selectedCatalogReport.reportCode)
  }

  const selectStage = (stage: FlowStageCode) => {
    const nextReport = reportForScope(stage, activeReportGroup)
    setAiInsightVisible(false)
    setActiveStage(stage)
    setSelectedReportCode(nextReport.reportCode)
    updateUrl(selectedSource, stage, nextReport.reportCode)
  }

  const selectReportGroup = (reportGroup: string) => {
    const nextReport = reportForScope(activeStage, reportGroup)
    setAiInsightVisible(false)
    setActiveReportGroup(reportGroup)
    setSelectedReportCode(nextReport.reportCode)
    updateUrl(selectedSource, activeStage, nextReport.reportCode, moduleScopeFilters, search, reportGroup)
  }

  const updateSearch = (value: string) => {
    setSearch(value)
    if (searchWriteTimerRef.current) window.clearTimeout(searchWriteTimerRef.current)
    searchWriteTimerRef.current = window.setTimeout(() => {
      updateUrl(selectedSource, activeStage, selectedCatalogReport.reportCode, moduleScopeFilters, value)
    }, 300)
  }

  const updateModuleScope = (filters: ReportFilterInput, nextSearch = search, nextStale = staleFilter) => {
    updateUrl(selectedSource, activeStage, selectedCatalogReport.reportCode, filters, nextSearch, activeReportGroup, nextStale)
  }

  const filtersForScope = (nextAnalysisGroup: InventoryAnalysisGroup, nextScopeCode: string, overrides: ReportFilterInput = {}) => {
    const filters: ReportFilterInput = {
      ...moduleScopeFilters,
      stockAnalysis: undefined,
      productType: undefined,
      productCategory: undefined,
      productBrand: undefined,
      productModel: undefined,
      productMaterial: undefined,
      movementCategory: undefined,
      groupBy: nextAnalysisGroup,
      chartDimension: nextAnalysisGroup,
      ...overrides,
    }
    const code = cleanScopeCode(nextScopeCode)
    if (nextAnalysisGroup === 'ProductTypeCode') filters.productType = code || undefined
    if (nextAnalysisGroup === 'ProductCategoryCode') filters.productCategory = code || undefined
    if (nextAnalysisGroup === 'ProductBrandCode') filters.productBrand = code || undefined
    if (nextAnalysisGroup === 'ProductModelCode') filters.productModel = code || undefined
    if (nextAnalysisGroup === 'ProductMaterialCode') filters.productMaterial = code || undefined
    if (nextAnalysisGroup === 'MovementCategory') filters.movementCategory = nextScopeCode.trim() || undefined
    return filters
  }

  const resetFilterHub = () => {
    const nextReport = reportForScope('all', 'all')
    const filters = filtersForScope('ProductTypeCode', '', { movementWindow: 'all', period: undefined })
    setAiInsightVisible(false)
    setActiveStage('all')
    setActiveReportGroup('all')
    setSelectedReportCode(nextReport.reportCode)
    setSearch('')
    setPeriodFilter('')
    setScopeCode('')
    setMovementWindowFilter('all')
    setAnalysisGroup('ProductTypeCode')
    setStaleFilter('dari-1-bulan-sampai-sekarang')
    updateUrl(selectedSource, 'all', nextReport.reportCode, filters, '', 'all', 'dari-1-bulan-sampai-sekarang')
  }

  const previewReport = (report: InventoryCatalogReport) => {
    setAiInsightVisible(false)
    setSelectedReportCode(report.reportCode)
    addRecent(catalogReportId(report))
    updateUrl(selectedSource, activeStage, report.reportCode)
  }

  const detailReportUrl = (report: InventoryReport, filters: ReportFilterInput = moduleScopeFilters) => {
    const params = buildModuleReportParams(report, selectedSource, 50, filters)
    params.delete('report')
    params.delete('limit')
    return `/report-center/inventory/${report.id}?${params.toString()}`
  }

  const viewReport = (report: InventoryCatalogReport) => {
    const liveReport = report.existingReportId ? getInventoryReport(report.existingReportId) : undefined
    if (!canOpenReport(report) || !liveReport) {
      previewReport(report)
      return
    }
    addRecent(catalogReportId(report))
    router.push(detailReportUrl(liveReport))
  }

  const exportLiveExcel = (report: InventoryCatalogReport) => {
    const liveReport = report.existingReportId ? getInventoryReport(report.existingReportId) : undefined
    if (liveReport) void exportExcel(liveReport, selectedSource, moduleScopeFilters)
  }

  const exportLivePdf = (report: InventoryCatalogReport) => {
    const liveReport = report.existingReportId ? getInventoryReport(report.existingReportId) : undefined
    if (liveReport) void exportPdf(liveReport, selectedSource, moduleScopeFilters)
  }

  useEffect(() => {
    return () => {
      if (searchWriteTimerRef.current) window.clearTimeout(searchWriteTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (searchParamString === lastSyncedSearchRef.current) return
    lastSyncedSearchRef.current = searchParamString

    const params = new URLSearchParams(searchParamString)
    const sourceParam = params.get('source')
    const storedSource = typeof window !== 'undefined' ? window.localStorage.getItem(REPORT_SOURCE_STORAGE_KEY) : null
    const nextSource = sourceParam ? normalizeSource(sourceParam) : normalizeSource(storedSource)
    const nextStage = normalizeStage(params.get('stage'))
    const nextReport = findCatalogReport(params.get('report'))
    const nextMovementWindow = normalizeMovementWindow(params.get('movementWindow'))
    const nextAnalysisGroup = normalizeAnalysisGroup(params.get('groupBy') ?? params.get('chartDimension'))
    const nextReportGroup = normalizeReportGroup(params.get('reportGroup'))
    const nextScopeCode = scopeCodeFromParams(nextAnalysisGroup, params)
    if (typeof window !== 'undefined') window.localStorage.setItem(REPORT_SOURCE_STORAGE_KEY, nextSource)
    setSelectedSource(nextSource)
    setActiveStage(nextStage)
    setActiveReportGroup(nextReportGroup)
    setSelectedReportCode(nextReport.reportCode)
    setSearch(params.get('search') ?? '')
    setStaleFilter(normalizeStaleFilter(params.get('stale')))
    setMovementWindowFilter(nextMovementWindow)
    setAnalysisGroup(nextAnalysisGroup)
    setPeriodFilter(params.get('period') ?? '')
    setScopeCode(nextScopeCode)
  }, [searchParamString])

  useEffect(() => {
    if (!openableSelectedReport || !linkedLiveReport) {
      setPayload(null)
      setAiDashboard(null)
      setAiDashboardError(null)
      setAiDashboardLoading(false)
      setError(null)
      setLoading(false)
      return
    }

    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchReport(linkedLiveReport, selectedSource, 25, moduleScopeFilters)
        if (!active) return
        setPayload(data)
      } catch (err) {
        if (!active) return
        setPayload(null)
        setError(err instanceof Error ? err.message : 'Gagal memuat laporan')
      } finally {
        if (active) setLoading(false)
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [linkedLiveReport, moduleScopeFilters, openableSelectedReport, selectedSource])

  useEffect(() => {
    if (!aiInsightVisible || !payload) {
      setAiDashboard(null)
      setAiDashboardError(null)
      setAiDashboardLoading(false)
      return
    }

    let active = true
    const timer = window.setTimeout(async () => {
      setAiDashboardLoading(true)
      setAiDashboardError(null)
      try {
        const response = await fetch(`/api/reports/${encodeURIComponent(selectedCatalogReport.reportCode)}/ai-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filters: {
              source: selectedSource,
              ...moduleScopeFilters,
              reportCode: selectedCatalogReport.reportCode,
              reportName: selectedCatalogReport.name,
            },
            payload,
            report: {
              code: selectedCatalogReport.reportCode,
              name: selectedCatalogReport.name,
              description: selectedCatalogReport.description,
            },
            options: {
              maxCharts: 5,
              includePriorityTable: true,
              includeMissingFields: true,
              language: 'id',
            },
          }),
        })
        const result = await response.json()
        if (!active) return
        if (!response.ok || result.error) throw new Error(result.error ?? 'AI dynamic analysis gagal dibuat.')
        setAiDashboard(result as AiDashboardDefinition)
      } catch (err) {
        if (!active) return
        setAiDashboard(null)
        setAiDashboardError(err instanceof Error ? err.message : 'AI dynamic analysis gagal dibuat.')
      } finally {
        if (active) setAiDashboardLoading(false)
      }
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [aiInsightVisible, moduleScopeFilters, payload, selectedCatalogReport.description, selectedCatalogReport.name, selectedCatalogReport.reportCode, selectedSource])

  const shellClass = embedded
    ? 'min-h-0 bg-transparent'
    : 'min-h-full bg-transparent'
  const innerClass = embedded
    ? 'mx-auto max-w-[1680px] space-y-5'
    : 'mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8'

  return (
    <main className={shellClass}>
      <div className={innerClass}>
        {!embedded ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <nav className="text-sm font-medium text-[var(--rc-text-faint)]">
              <Link href="/report-center" className="hover:text-[var(--rc-forest-accent)]">Dashboard</Link>
              <span className="mx-2">/</span>
              <Link href={`/report-center/procurement?source=${selectedSource}`} className="hover:text-[var(--rc-forest-accent)]">Procurement</Link>
              <span className="mx-2">/</span>
              <span className="text-[var(--rc-text)]">Inventory</span>
            </nav>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--rc-text)]">Inventory Report Center</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--rc-text-muted)]">
              Windows Tile operational monitor untuk report Inventory yang sudah live dan bisa dibuka dari Procurement.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/report-center/procurement?source=${selectedSource}&stockGroup=inventory`}
              className="inline-flex items-center gap-2 rounded-[18px] border border-[var(--rc-forest-border)] bg-[rgba(7,26,20,.82)] px-4 py-2.5 text-sm font-bold text-[var(--rc-text-muted)] shadow-[0_6px_18px_rgba(15,23,42,0.06)] hover:bg-white/10"
            >
              <ArrowLeft size={16} />
              Procurement
            </Link>
          </div>
        </div>
        ) : (
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--rc-forest-accent)]">
                Inventory submodule · {itemType === 'gudang' ? 'Gudang' : itemType === 'workshop' ? 'Workshop' : 'All scope'}
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--rc-text)]">
                Flow catalog + report cards
              </h2>
              <p className="mt-1 text-sm font-semibold text-[var(--rc-text-muted)]">
                Pengelompokan stage sama seperti inventory: request → receive → movement → usage → valuation → audit.
              </p>
            </div>
          </div>
        )}


        <section className="mb-5 overflow-hidden rounded-[24px] border border-[rgba(52,211,153,.24)] bg-[linear-gradient(145deg,rgba(7,26,20,.96),rgba(4,12,9,.96))] p-4 shadow-[0_18px_54px_rgba(0,0,0,.18)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--rc-forest-accent)]">Filter pusat</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[var(--rc-text)]">Cari report dulu, insight menyusul.</h2>
              <p className="mt-1 text-sm font-semibold text-[var(--rc-text-muted)]">
                Semua filter di sini sync ke URL. Ganti pilihan, grid dan preview langsung ikut berubah.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold text-[var(--rc-text-muted)]">
              <span className="rounded-full border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-1">{filteredReports.length} dari {liveCount} report</span>
              <span className="rounded-full border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-1">{selectedReportGroupLabel}</span>
              <span className="rounded-full border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-1">{selectedStage.stageName}</span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(260px,1.5fr)_180px_180px_180px]">
            <label className="relative block">
              <span className="sr-only">Cari report</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--rc-text-faint)]" />
              <input
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Cari report: PO, supplier, pupuk, solar, valuasi..."
                className="h-12 w-full rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] pl-9 pr-3 text-sm font-semibold text-[var(--rc-text)] outline-none focus:border-emerald-400 focus:bg-[rgba(5,17,10,.95)] focus:ring-4 focus:ring-emerald-500/10"
              />
            </label>

            <select
              value={selectedSource}
              onChange={(event) => selectSource(event.target.value as ReportSource)}
              className="h-12 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 text-sm font-extrabold text-[var(--rc-text)] outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
            >
              {SOURCE_OPTIONS.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
            </select>

            <select
              value={activeReportGroup}
              onChange={(event) => selectReportGroup(event.target.value)}
              className="h-12 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 text-sm font-extrabold text-[var(--rc-text)] outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
            >
              <option value="all">Semua group</option>
              {reportGroupOptions.map((group) => <option key={group.group} value={group.group}>{group.title}</option>)}
            </select>

            <select
              value={activeStage}
              onChange={(event) => selectStage(event.target.value as FlowStageCode)}
              className="h-12 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 text-sm font-extrabold text-[var(--rc-text)] outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
            >
              <option value="all">Semua flow</option>
              {LIVE_FLOW_STAGES.map((stage) => <option key={stage.stageCode} value={stage.stageCode}>{stage.stageName} ({stageCounts.get(stage.stageCode) ?? 0})</option>)}
            </select>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(260px,1.4fr)_auto_160px_minmax(210px,0.9fr)_minmax(180px,0.8fr)_auto]">
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-[var(--rc-forest-accent)]">Quick report jump</span>
              <select
                value={selectedCatalogReport.reportCode}
                onChange={(event) => previewReport(findCatalogReport(event.target.value))}
                className="h-12 w-full rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 text-sm font-extrabold text-[var(--rc-text)] outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
              >
                {reportSelectOptions.map((report) => <option key={report.reportCode} value={report.reportCode}>{report.shortName} · {report.reportCode}</option>)}
              </select>
            </label>

            <button
              type="button"
              onClick={() => viewReport(selectedCatalogReport)}
              disabled={!openableSelectedReport}
              className={openableSelectedReport ? 'mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--rc-forest-primary)] px-4 text-sm font-black text-[#03130b] hover:brightness-110' : 'mt-5 inline-flex h-12 cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-4 text-sm font-bold text-[var(--rc-text-faint)]'}
            >
              <FileText size={15} />
              Open
            </button>

            <input
              type="month"
              value={periodFilter}
              onChange={(event) => {
                const nextPeriod = event.target.value
                const filters = { ...moduleScopeFilters, period: nextPeriod || undefined }
                setAiInsightVisible(false)
                setPeriodFilter(nextPeriod)
                updateModuleScope(filters)
              }}
              className="h-12 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 text-sm font-extrabold text-[var(--rc-text)] outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
            />

            <select
              value={analysisGroup}
              onChange={(event) => {
                const nextGroup = event.target.value as InventoryAnalysisGroup
                const filters = filtersForScope(nextGroup, '')
                setAiInsightVisible(false)
                setAnalysisGroup(nextGroup)
                setScopeCode('')
                updateModuleScope(filters)
              }}
              className="h-12 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 text-sm font-extrabold text-[var(--rc-text)] outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
            >
              {INVENTORY_ANALYSIS_GROUP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <select
              value={movementWindowFilter}
              onChange={(event) => {
                const nextWindow = event.target.value
                const filters = { ...moduleScopeFilters, movementWindow: nextWindow || 'all' }
                setAiInsightVisible(false)
                setMovementWindowFilter(nextWindow)
                updateModuleScope(filters)
              }}
              title="Window hitung Movement Category (issue count)."
              className="h-12 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 text-sm font-extrabold text-[var(--rc-text)] outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
            >
              {MOVEMENT_WINDOW_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <button
              type="button"
              onClick={resetFilterHub}
              className="h-12 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-4 text-sm font-bold text-[var(--rc-text-muted)] hover:bg-white/10"
            >
              Reset
            </button>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)]">
            {analysisGroup === 'MovementCategory' ? (
              <select
                value={scopeCode}
                onChange={(event) => {
                  const nextCode = event.target.value
                  const filters = filtersForScope(analysisGroup, nextCode)
                  setScopeCode(nextCode)
                  updateModuleScope(filters)
                }}
                className="h-12 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 text-sm font-extrabold text-[var(--rc-text)] outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
              >
                <option value="">Semua movement category</option>
                {['Fast Moving', 'Moving', 'Slow Moving', 'Dead Stock', 'Stale'].map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            ) : (
              <input
                value={scopeCode}
                onChange={(event) => {
                  const nextCode = cleanScopeCode(event.target.value)
                  const filters = filtersForScope(analysisGroup, nextCode)
                  setScopeCode(nextCode)
                  updateModuleScope(filters)
                }}
                placeholder={`Kode ${activeAnalysisGroup.label}, kosong = semua`}
                className="h-12 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 text-sm font-extrabold text-[var(--rc-text)] outline-none placeholder:text-[var(--rc-text-faint)] focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
              />
            )}

            {selectedCatalogReport.existingReportId === 'item-movement-update-tracking' ? (
              <select
                value={staleFilter}
                onChange={(event) => {
                  const nextStale = event.target.value
                  setAiInsightVisible(false)
                  setStaleFilter(nextStale)
                  updateModuleScope(moduleScopeFilters, search, nextStale)
                }}
                className="h-12 rounded-2xl border border-[rgba(245,158,11,.28)] bg-[rgba(245,158,11,.12)] px-3 text-sm font-extrabold text-amber-100 outline-none focus:border-amber-300 focus:ring-4 focus:ring-amber-500/10"
              >
                {STALE_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>Movement update stale {option.label}</option>)}
              </select>
            ) : (
              <div className="flex h-12 items-center rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 text-sm font-bold text-[var(--rc-text-faint)]">
                Stale filter muncul hanya untuk report movement update tracking.
              </div>
            )}
          </div>
        </section>

        <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((card) => (
            <KpiTile key={card.label} {...card} />
          ))}
        </section>

        <section className="mt-5" aria-labelledby="report-catalog-heading">
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="report-catalog-heading" className="text-lg font-extrabold text-[var(--rc-text)]">Report Catalog</h2>
                <p className="mt-1 text-sm text-[var(--rc-text-muted)]">{filteredReports.length} report live, dikelompokkan berdasarkan business group. Klik group di bar navigasi untuk lompat langsung.</p>
              </div>
              <span className="rounded-full border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-[var(--rc-text-muted)]">
                {selectedStage.stageName}
              </span>
            </div>

            {filteredReports.length === 0 ? (
              <TileShell className="p-10 text-center">
                <p className="text-lg font-extrabold text-[var(--rc-text)]">Tidak ada report ditemukan</p>
                <p className="mt-2 text-sm text-[var(--rc-text-faint)]">Coba kata kunci lain seperti barang masuk, nilai aset gudang, atau solar kendaraan.</p>
              </TileShell>
            ) : (
              <div className="space-y-4">
                {/* Hallmark · component: sticky jump-nav · genre: modern-minimal · theme: forest-tokens
                 * states: default · hover · focus · active · (disabled N/A)
                 */}
                <nav
                  className="rc-catalog-jump sticky top-0 z-20 -mx-1 mb-1 border-b border-[var(--rc-forest-border)] bg-[rgba(4,14,10,.92)] px-1 py-2.5 backdrop-blur-md"
                  aria-label="Navigasi group report catalog"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--rc-forest-accent)]">Lompat group</p>
                    <span className="text-[10px] font-bold text-[var(--rc-text-faint)]">{groupedReports.length} group · klik = scroll</span>
                  </div>
                  <div className="rc-catalog-jump-track flex gap-2 overflow-x-auto pb-0.5">
                    {groupedReports.map(({ group, reports }) => {
                      const active = activeCatalogGroup === group.group
                      return (
                        <button
                          key={group.group}
                          type="button"
                          onClick={() => jumpToCatalogGroup(group.group)}
                          aria-current={active ? 'true' : undefined}
                          className={
                            active
                              ? 'rc-catalog-jump-chip is-active inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/50 bg-[var(--rc-forest-primary)] px-3.5 py-2 text-xs font-black text-[#03130b] shadow-[0_0_0_3px_rgba(52,211,153,.18)] outline-none focus-visible:ring-2 focus-visible:ring-emerald-300'
                              : 'rc-catalog-jump-chip inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--rc-forest-border)] bg-white/[0.04] px-3.5 py-2 text-xs font-bold text-[var(--rc-text-muted)] outline-none transition-[background-color,border-color,color] duration-150 hover:border-emerald-400/35 hover:bg-white/[0.08] hover:text-[var(--rc-text)] focus-visible:ring-2 focus-visible:ring-emerald-400/70'
                          }
                        >
                          <span className="max-w-[14rem] truncate">{group.title}</span>
                          <span
                            className={
                              active
                                ? 'rounded-full bg-black/15 px-1.5 py-0.5 text-[10px] font-black tabular-nums'
                                : 'rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-[var(--rc-forest-accent)]'
                            }
                          >
                            {reports.length}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </nav>

                {groupedReports.map(({ group, reports }) => {
                  return (
                    <section
                      key={group.group}
                      id={`catalog-group-${group.group}`}
                      data-catalog-group={group.group}
                      className="rc-catalog-group scroll-mt-24 rounded-[22px] border border-[var(--rc-forest-border)] bg-[rgba(7,26,20,.58)] p-4"
                    >
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-extrabold text-[var(--rc-text)]">{group.title}</h3>
                          <p className="text-xs leading-5 text-[var(--rc-text-muted)]">Business group dari metadata report. Flow tetap terlihat di tiap card.</p>
                        </div>
                        <span className="rounded-full border border-[var(--rc-forest-border)] bg-white/5 px-3 py-1 text-xs font-bold text-[var(--rc-forest-accent)]">{reports.length} report</span>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                        {reports.map((report) => (
                          <ReportTile
                            key={report.reportCode}
                            report={report}
                            source={selectedSource}
                            selected={report.reportCode === selectedCatalogReport.reportCode}
                            favorite={favorites.includes(catalogReportId(report))}
                            onPreview={() => previewReport(report)}
                            onView={() => viewReport(report)}
                            onFavorite={() => toggleFavorite(catalogReportId(report))}
                            onExcel={() => exportLiveExcel(report)}
                            onPdf={() => exportLivePdf(report)}
                          />
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            )}
          </div>

          <section className="mt-5 space-y-4 rounded-[24px] border border-[var(--rc-forest-border)] bg-[rgba(7,26,20,.82)] p-4 shadow-[0_18px_54px_rgba(0,0,0,.18)]">
            <div className="grid grid-cols-2 gap-3">
              <MiniTile label="Stage" value={selectedReportStage.shortName} icon={selectedReportStage.icon} color={selectedReportStage.color} />
              <MiniTile label="Status" value={statusLabel(selectedCatalogReport.status)} icon={Database} color="#2563EB" />
              <MiniTile label="Owner" value={selectedCatalogReport.owner} icon={Warehouse} color="#167A3A" />
              <MiniTile label="Cadence" value={selectedCatalogReport.cadence} icon={RefreshCw} color="#D99A00" />
            </div>

            <TileShell className="overflow-hidden p-0">
              <div className="bg-[#071426] p-[18px] text-white">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-200">Preview Catalog</p>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <h2 className="text-xl font-extrabold">{selectedCatalogReport.shortName}</h2>
                  <StatusBadge status={selectedCatalogReport.status} />
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--rc-text-muted)]">{selectedCatalogReport.businessPurpose}</p>
              </div>

              <div className="p-[18px]">
                <div className="rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">{selectedCatalogReport.categoryLabel}</p>
                  <h3 className="mt-2 text-base font-extrabold text-[var(--rc-text)]">{selectedCatalogReport.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--rc-text-muted)]">{selectedCatalogReport.description}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-3">
                    <p className="text-[11px] font-semibold text-[var(--rc-text-faint)]">Report Code</p>
                    <p className="mt-1 text-sm font-extrabold text-[var(--rc-text)]">{selectedCatalogReport.reportCode}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-3">
                    <p className="text-[11px] font-semibold text-[var(--rc-text-faint)]">Last Updated</p>
                    <p className="mt-1 text-sm font-extrabold text-[var(--rc-text)]">{selectedCatalogReport.lastUpdated}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[var(--rc-text)]">
                    <Database size={16} />
                    Status Live Report
                  </div>
                  <div className="space-y-2 text-xs">
                    {[
                      ['Source', selectedCatalogReport.sourceDatabase ?? sourceTileValue],
                      ['Server', sourceTileValue],
                      ['Open Full Report', openableSelectedReport ? 'Available' : 'Unavailable'],
                      ['Safety', 'Read-only, SQL write blocked'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4">
                        <span className="text-[var(--rc-text-faint)]">{label}</span>
                        <span className="truncate text-right font-bold text-[var(--rc-text-muted)]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedCatalogReport.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-[var(--rc-text-muted)]">{tag}</span>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-[rgba(52,211,153,.28)] bg-[rgba(24,185,107,.12)] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--rc-forest-accent)]">Pertanyaan untuk AI</p>
                  <div className="mt-3 space-y-2">
                    {analysisQuestions(selectedCatalogReport).map((question) => (
                      <div key={question} className="rounded-xl border border-[rgba(52,211,153,.2)] bg-white/5 px-3 py-2 text-xs font-semibold leading-5 text-[var(--rc-text)]">
                        {question}
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] font-semibold text-[var(--rc-forest-accent)]">
                    Pertanyaan ini dikirim ke AI bersama payload live saat report sudah punya query.
                  </p>
                </div>

                {loading ? (
                  <div className="mt-4 space-y-3">
                    <div className="h-20 animate-pulse rounded-2xl bg-white/[0.06]" />
                    <div className="h-32 animate-pulse rounded-2xl bg-white/[0.06]" />
                  </div>
                ) : error ? (
                  <div className="mt-4 rounded-2xl border border-[rgba(251,113,133,.28)] bg-[rgba(251,113,133,.12)] p-4">
                    <p className="font-bold text-red-200">Gagal memuat payload live</p>
                    <p className="mt-1 text-sm leading-6 text-red-100">{error}</p>
                  </div>
                ) : payload ? (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {summaryEntries.map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-3">
                          <p className="truncate text-xs font-semibold text-[var(--rc-text-faint)]">{label}</p>
                          <p className="mt-1 truncate text-lg font-extrabold text-[var(--rc-text)]">{formatValue(value)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[var(--rc-text)]">
                        <Table2 size={16} />
                        Live Preview Table
                      </div>
                      <div className="overflow-x-auto rounded-2xl border border-[var(--rc-forest-border)]">
                        <table className="min-w-full text-left text-xs">
                          <thead className="bg-white/[0.04] text-[var(--rc-text-faint)]">
                            <tr>
                              {previewColumns.map((column) => (
                                <th key={column} className="whitespace-nowrap px-3 py-2 font-bold">{column}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10">
                            {previewRows.length === 0 ? (
                              <tr>
                                <td colSpan={Math.max(previewColumns.length, 1)} className="px-3 py-6 text-center text-[var(--rc-text-faint)]">
                                  Tidak ada data pada filter ini.
                                </td>
                              </tr>
                            ) : previewRows.map((row, index) => (
                              <tr key={index}>
                                {previewColumns.map((column) => (
                                  <td key={column} className="whitespace-nowrap px-3 py-2 text-[var(--rc-text-muted)]">{formatValue(row[column])}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {payload.chart.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] p-3">
                        <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[var(--rc-text)]">
                          <BarChart3 size={16} />
                          Sample Chart
                        </div>
                        <div className="space-y-2">
                          {payload.chart.slice(0, 5).map((row, index) => {
                            const value = numericValue(row)
                            const width = maxChart > 0 ? Math.max(8, (value / maxChart) * 100) : 8
                            return (
                              <div key={index}>
                                <div className="flex justify-between gap-3 text-xs">
                                  <span className="truncate font-bold text-[var(--rc-text-muted)]">{labelValue(row)}</span>
                                  <span className="text-[var(--rc-text-faint)]">{formatValue(value)}</span>
                                </div>
                                <div className="mt-1 h-2 rounded-full bg-white">
                                  <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${width}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-4 rounded-2xl border border-[rgba(41,199,200,.28)] bg-[rgba(41,199,200,.12)] p-4">
                    <p className="font-bold text-cyan-200">Live report belum bisa dibuka</p>
                    <p className="mt-1 text-sm leading-6 text-cyan-100">
                      Report ini ada di daftar live, tetapi link viewer belum tersedia untuk source aktif.
                    </p>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => previewReport(selectedCatalogReport)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-[var(--rc-text-muted)] hover:bg-white/10">
                    <Eye size={15} />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => viewReport(selectedCatalogReport)}
                    disabled={!openableSelectedReport}
                    className={openableSelectedReport ? 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#167A3A] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#0f6a30]' : 'inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-[var(--rc-text-faint)]'}
                  >
                    <FileText size={15} />
                    Buka
                  </button>
                  <button
                    type="button"
                    onClick={() => exportLiveExcel(selectedCatalogReport)}
                    disabled={!openableSelectedReport}
                    className={openableSelectedReport ? 'inline-flex items-center justify-center gap-2 rounded-2xl border border-[rgba(52,211,153,.28)] bg-[rgba(24,185,107,.12)] px-3 py-2.5 text-sm font-bold text-[var(--rc-forest-accent)] hover:bg-emerald-100' : 'inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-[var(--rc-text-faint)]'}
                  >
                    <FileSpreadsheet size={15} />
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => exportLivePdf(selectedCatalogReport)}
                    disabled={!openableSelectedReport}
                    className={openableSelectedReport ? 'inline-flex items-center justify-center gap-2 rounded-2xl border border-[rgba(251,113,133,.28)] bg-[rgba(251,113,133,.12)] px-3 py-2.5 text-sm font-bold text-red-200 hover:bg-red-100' : 'inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-[var(--rc-text-faint)]'}
                  >
                    <Download size={15} />
                    PDF
                  </button>
                </div>
              </div>
            </TileShell>
          </section>
        </section>

        <section className="mt-5 rounded-[24px] border border-[var(--rc-forest-border)] bg-[rgba(7,26,20,.72)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--rc-forest-accent)]">Insights</p>
              <p className="mt-1 text-sm font-semibold text-[var(--rc-text-muted)]">AI membaca selected report + filter pusat yang sama. Tidak ada filter kedua.</p>
            </div>
            <button
              type="button"
              onClick={() => setAiInsightVisible((current) => !current)}
              className={aiInsightVisible ? 'inline-flex h-11 items-center gap-2 rounded-2xl border border-[var(--rc-forest-border)] bg-white/[0.04] px-4 text-sm font-extrabold text-[var(--rc-text-muted)] hover:bg-white/10' : 'inline-flex h-11 items-center gap-2 rounded-2xl bg-[var(--rc-forest-primary)] px-4 text-sm font-extrabold text-[#03130b] hover:brightness-110'}
            >
              <Sparkles size={16} />
              {aiInsightVisible ? 'Hide insights' : 'Show insights'}
            </button>
          </div>
        </section>

        {aiInsightVisible && (
          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <AIInsightTile selectedReport={selectedCatalogReport} hasLivePayload={Boolean(payload)} payload={payload} dataSource={sourceTileValue} error={error} />
            <AiDynamicDashboard
              definition={aiDashboard}
              payload={payload}
              report={{
                code: selectedCatalogReport.reportCode,
                name: selectedCatalogReport.name,
                description: selectedCatalogReport.description,
              }}
              filters={{
                source: selectedSource,
                ...moduleScopeFilters,
                reportCode: selectedCatalogReport.reportCode,
                reportGroup: activeReportGroup,
                search,
              }}
              loading={loading || aiDashboardLoading}
              error={aiDashboardError}
            />
          </section>
        )}
      </div>
    </main>
  )
}
