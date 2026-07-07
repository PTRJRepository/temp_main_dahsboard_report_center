'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
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
    live: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    preview: 'border-blue-200 bg-blue-50 text-blue-700',
    mapping_db: 'border-orange-200 bg-orange-50 text-orange-700',
    need_validation: 'border-amber-200 bg-amber-50 text-amber-700',
    planned: 'border-slate-200 bg-slate-50 text-slate-500',
  }
  return classes[status]
}

function canOpenReport(report: InventoryCatalogReport) {
  return report.status === 'live' && Boolean(report.existingReportId)
}

async function fetchReport(report: InventoryReport, source: ReportSource, stale: string, limit = 50) {
  const params = new URLSearchParams({ report: report.apiReport, limit: String(limit), source })
  if (report.id === 'item-stale-update' || report.id === 'item-movement-update-tracking') params.set('stale', stale)
  const response = await fetch(`/api/reports/inventory?${params.toString()}`, { cache: 'no-store' })
  const data = (await response.json()) as ApiResponse
  if (!response.ok || !data.success || !data.data) {
    throw new Error(data.error ?? 'Gagal memuat laporan')
  }
  return data.data
}

async function exportExcel(report: InventoryReport, source: ReportSource, stale: string) {
  const payload = await fetchReport(report, source, stale, 500)
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.json_to_sheet(payload.rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, report.title.slice(0, 31))
  XLSX.writeFile(workbook, `${report.id}.xlsx`)
}

async function exportPdf(report: InventoryReport, source: ReportSource, stale: string) {
  const payload = await fetchReport(report, source, stale, 80)
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
        'rounded-[18px] border bg-white p-[18px] shadow-[0_8px_22px_rgba(15,23,42,0.08)] transition duration-200',
        active
          ? 'border-2 border-[#16A34A] bg-[#F0FDF4] shadow-[0_0_0_4px_rgba(22,163,74,0.12),0_16px_36px_rgba(15,23,42,0.12)]'
          : 'border-[#CBD5E1] hover:-translate-y-0.5 hover:border-[#16A34A] hover:shadow-[0_16px_36px_rgba(15,23,42,0.14)]',
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
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 truncate text-lg font-extrabold text-slate-950">{value}</p>
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
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500">
          Workspace
        </span>
      </div>
      <h3 className="mt-4 text-lg font-extrabold text-slate-950">{tile.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{tile.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tile.stages.map((stage) => (
          <span key={stage} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
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
        <h3 className="mt-3 truncate text-base font-extrabold text-slate-950">{stage.shortName}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{stage.description}</p>
        <p className="mt-3 text-xs font-extrabold text-slate-500">{count} report</p>
      </TileShell>
    </button>
  )
}

function KpiTile({
  label,
  value,
  note,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  note: string
  icon: LucideIcon
  color: string
}) {
  return (
    <TileShell className="min-h-[130px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{note}</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ backgroundColor: color }}>
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
                  ? 'border-emerald-200 bg-emerald-300/20 text-white'
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
            <p className="mt-2 text-sm leading-6 text-slate-100">{text}</p>
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

      <div className="mt-4 rounded-2xl border border-[#DDE6F0] bg-[#F8FAFC] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border px-2.5 py-1 text-[11px] font-extrabold" style={{ borderColor: `${stage.color}30`, backgroundColor: `${stage.color}14`, color: stage.color }}>
              <StageIcon size={13} />
              {stage.stageName}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-extrabold text-slate-600">
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
        className="mt-3 min-w-0 flex-1 rounded-2xl border border-[#DDE6F0] bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{report.categoryLabel}</p>
        <div className="mt-2 flex items-start gap-2">
          <span className="shrink-0 rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-extrabold text-slate-600">{report.reportCode}</span>
          <h3 className="line-clamp-2 text-lg font-extrabold leading-6 text-slate-950">{report.name}</h3>
        </div>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{report.description}</p>
      </button>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-[#DDE6F0] bg-[#F8FAFC] p-3">
          <p className="text-[11px] font-semibold text-slate-400">Cadence</p>
          <p className="mt-1 truncate text-sm font-extrabold text-slate-800">{report.cadence}</p>
        </div>
        <div className="rounded-2xl border border-[#DDE6F0] bg-[#F8FAFC] p-3">
          <p className="text-[11px] font-semibold text-slate-400">Owner</p>
          <p className="mt-1 truncate text-sm font-extrabold text-slate-800">{report.owner}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {report.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
            {tag}
          </span>
        ))}
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
          {analysisQuestions(report).length} pertanyaan AI
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr_auto_auto] gap-2 rounded-2xl border border-[#DDE6F0] bg-[#F8FAFC] p-3">
        <button
          type="button"
          onClick={onFavorite}
          className={favorite ? 'grid h-10 w-10 place-items-center rounded-xl border border-amber-200 bg-amber-100 text-amber-600' : 'grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:border-amber-200 hover:text-amber-500'}
          aria-label={favorite ? 'Hapus favorit' : 'Tambah favorit'}
        >
          <Star size={16} fill={favorite ? 'currentColor' : 'none'} />
        </button>
        <button type="button" onClick={onPreview} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-emerald-200 hover:bg-white">
          <Eye size={15} />
          Preview
        </button>
        <button
          type="button"
          onClick={onExcel}
          disabled={!openable}
          className={openable ? 'grid h-10 w-10 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'grid h-10 w-10 cursor-not-allowed place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300'}
          aria-label="Export Excel"
        >
          <FileSpreadsheet size={15} />
        </button>
        <button
          type="button"
          onClick={onPdf}
          disabled={!openable}
          className={openable ? 'grid h-10 w-10 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'grid h-10 w-10 cursor-not-allowed place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300'}
          aria-label="Export PDF"
        >
          <Download size={15} />
        </button>
      </div>
      <button
        type="button"
        onClick={onView}
        disabled={!openable}
        className={openable ? 'mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#167A3A] px-3 text-sm font-bold text-white hover:bg-[#0f6a30]' : 'mt-2 inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-400'}
      >
        {openable ? 'Buka Report' : 'Catalog Preview'}
        <ArrowRight size={15} />
      </button>
    </TileShell>
  )
}

export default function InventoryReportsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSource = normalizeSource(searchParams.get('source'))
  const initialReport = findCatalogReport(searchParams.get('report'))
  const initialStage = normalizeStage(searchParams.get('stage'))
  const [selectedSource, setSelectedSource] = useState<ReportSource>(initialSource)
  const [selectedReportCode, setSelectedReportCode] = useState(initialReport.reportCode)
  const [activeStage, setActiveStage] = useState<FlowStageCode>(initialStage)
  const [search, setSearch] = useState('')
  const [staleFilter, setStaleFilter] = useState('dari-1-bulan-sampai-sekarang')
  const [payload, setPayload] = useState<ReportPayload | null>(null)
  const [aiDashboard, setAiDashboard] = useState<AiDashboardDefinition | null>(null)
  const [aiDashboardLoading, setAiDashboardLoading] = useState(false)
  const [aiDashboardError, setAiDashboardError] = useState<string | null>(null)
  const [aiInsightVisible, setAiInsightVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { favorites, toggleFavorite, addRecent } = useReportStore()

  const selectedCatalogReport = LIVE_INVENTORY_REPORT_CATALOG.find((report) => report.reportCode === selectedReportCode) ?? LIVE_INVENTORY_REPORT_CATALOG[0]
  const selectedStage = stageInfo(activeStage)
  const selectedReportStage = stageInfo(selectedCatalogReport.flowStage)
  const linkedLiveReport = selectedCatalogReport.existingReportId ? getInventoryReport(selectedCatalogReport.existingReportId) : undefined
  const openableSelectedReport = canOpenReport(selectedCatalogReport) && Boolean(linkedLiveReport)
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
      const queryMatch =
        !q ||
        [
          report.reportCode,
          report.name,
          report.shortName,
          report.description,
          report.businessPurpose,
          report.categoryLabel,
          report.owner,
          report.cadence,
          statusLabel(report.status),
          stageInfo(report.flowStage).stageName,
          ...analysisQuestions(report),
          ...report.tags,
        ].some((value) => value.toLowerCase().includes(q))
      return stageMatch && queryMatch
    })
  }, [activeStage, search])

  const sourceTileValue = sourceDescription(selectedSource)
  const liveCount = LIVE_INVENTORY_REPORT_CATALOG.length
  const summaryEntries = payload ? Object.entries(payload.summary).slice(0, 4) : []
  const previewColumns = payload?.columns.slice(0, 5) ?? []
  const previewRows = payload?.rows.slice(0, 5) ?? []
  const maxChart = payload?.chart.reduce((max, row) => Math.max(max, numericValue(row)), 0) ?? 0

  const updateUrl = (source: ReportSource, stage: FlowStageCode, reportCode: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(REPORT_SOURCE_STORAGE_KEY, source)
      window.dispatchEvent(new CustomEvent('report-center-source-change', { detail: source }))
    }
    router.replace(`/report-center/inventory?source=${source}&stage=${stage}&report=${reportCode}`, { scroll: false })
  }

  const selectSource = (source: ReportSource) => {
    setAiInsightVisible(false)
    setSelectedSource(source)
    updateUrl(source, activeStage, selectedCatalogReport.reportCode)
  }

  const selectStage = (stage: FlowStageCode) => {
    const nextReport =
      stage === 'all'
        ? selectedCatalogReport
        : selectedCatalogReport.flowStage === stage
        ? selectedCatalogReport
        : LIVE_INVENTORY_REPORT_CATALOG.find((report) => report.flowStage === stage) ?? selectedCatalogReport
    setAiInsightVisible(false)
    setActiveStage(stage)
    setSelectedReportCode(nextReport.reportCode)
    updateUrl(selectedSource, stage, nextReport.reportCode)
  }

  const previewReport = (report: InventoryCatalogReport) => {
    setAiInsightVisible(false)
    setSelectedReportCode(report.reportCode)
    addRecent(catalogReportId(report))
    updateUrl(selectedSource, activeStage, report.reportCode)
  }

  const viewReport = (report: InventoryCatalogReport) => {
    const liveReport = report.existingReportId ? getInventoryReport(report.existingReportId) : undefined
    if (!canOpenReport(report) || !liveReport) {
      previewReport(report)
      return
    }
    addRecent(catalogReportId(report))
    router.push(`/report-center/inventory/${liveReport.id}?source=${selectedSource}`)
  }

  const exportLiveExcel = (report: InventoryCatalogReport) => {
    const liveReport = report.existingReportId ? getInventoryReport(report.existingReportId) : undefined
    if (liveReport) void exportExcel(liveReport, selectedSource, staleFilter)
  }

  const exportLivePdf = (report: InventoryCatalogReport) => {
    const liveReport = report.existingReportId ? getInventoryReport(report.existingReportId) : undefined
    if (liveReport) void exportPdf(liveReport, selectedSource, staleFilter)
  }

  useEffect(() => {
    const sourceParam = searchParams.get('source')
    const storedSource = typeof window !== 'undefined' ? window.localStorage.getItem(REPORT_SOURCE_STORAGE_KEY) : null
    const nextSource = sourceParam ? normalizeSource(sourceParam) : normalizeSource(storedSource)
    const nextStage = normalizeStage(searchParams.get('stage'))
    const nextReport = findCatalogReport(searchParams.get('report'))
    if (typeof window !== 'undefined') window.localStorage.setItem(REPORT_SOURCE_STORAGE_KEY, nextSource)
    if (nextSource !== selectedSource) setSelectedSource(nextSource)
    if (nextStage !== activeStage) setActiveStage(nextStage)
    if (nextReport.reportCode !== selectedReportCode) setSelectedReportCode(nextReport.reportCode)
  }, [activeStage, searchParams, selectedReportCode, selectedSource])

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
        const data = await fetchReport(linkedLiveReport, selectedSource, staleFilter, 25)
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
  }, [linkedLiveReport, openableSelectedReport, selectedSource, staleFilter])

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
              stale: staleFilter,
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
  }, [aiInsightVisible, payload, selectedCatalogReport.description, selectedCatalogReport.name, selectedCatalogReport.reportCode, selectedSource, staleFilter])

  return (
    <main className="min-h-full bg-transparent">
      <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <nav className="text-sm font-medium text-slate-500">
              <Link href="/report-center" className="hover:text-emerald-700">Dashboard</Link>
              <span className="mx-2">/</span>
              <span>Procurement</span>
              <span className="mx-2">/</span>
              <span className="text-slate-950">Inventory</span>
            </nav>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Inventory Report Center</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Windows Tile operational monitor untuk report Inventory yang sudah live dan bisa dibuka dari Procurement.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-[18px] border border-[#DDE6F0] bg-white p-1 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              {SOURCE_OPTIONS.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => selectSource(source.id)}
                  className={[
                    'rounded-xl px-3 py-2 text-xs font-extrabold transition',
                    selectedSource === source.id ? 'bg-[#167A3A] text-white' : 'text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {source.label}
                </button>
              ))}
            </div>
            <Link
              href={`/report-center?module=procurement&source=${selectedSource}#modules`}
              className="inline-flex items-center gap-2 rounded-[18px] border border-[#DDE6F0] bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.06)] hover:bg-slate-50"
            >
              <ArrowLeft size={16} />
              Procurement
            </Link>
          </div>
        </div>

        <section className="rc-panel rc-panel-active overflow-hidden rounded-[18px] p-[18px] text-white">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-200">Inventory Flow Monitor</p>
              <h2 className="mt-2 text-2xl font-extrabold">Live Inventory Reports</h2>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-emerald-50/90">
                Procurement sekarang hanya menampilkan report yang sudah live dan bisa dibuka dari viewer/export.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[18px] border border-white/10 bg-white/10 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100/80">Sumber DB</p>
                <p className="mt-2 truncate text-sm font-extrabold">{sourceTileValue}</p>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/10 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100/80">Safety</p>
                <p className="mt-2 text-sm font-extrabold">Read-only SELECT</p>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/10 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100/80">Mode</p>
                <p className="mt-2 text-sm font-extrabold">Live only</p>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/10 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100/80">Live</p>
                <p className="mt-2 text-sm font-extrabold">{liveCount} report</p>
              </div>
            </div>
          </div>
        </section>

        <details className="mt-5 overflow-hidden rounded-[18px] border border-[var(--rc-border)] bg-white/5">
          <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold text-[var(--rc-text)] hover:bg-white/5">
            Buka workspace tile tambahan
          </summary>
          <div className="grid gap-4 border-t border-[var(--rc-border)] p-4 md:grid-cols-3">
            {WORKSPACE_TILES.map((tile) => <WorkspaceTile key={tile.title} tile={tile} />)}
          </div>
        </details>

        <details className="mt-5 overflow-hidden rounded-[18px] border border-[var(--rc-border)] bg-white/5">
          <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold text-[var(--rc-text)] hover:bg-white/5">
            Flow filter: {selectedStage.stageName}
          </summary>
          <div className="flex gap-3 overflow-x-auto border-t border-[var(--rc-border)] p-4">
            <FlowStageTile
              stage={stageInfo('all')}
              count={liveCount}
              active={activeStage === 'all'}
              onClick={() => selectStage('all')}
            />
            {LIVE_FLOW_STAGES.map((stage) => (
              <FlowStageTile
                key={stage.stageCode}
                stage={stage}
                count={stageCounts.get(stage.stageCode) ?? 0}
                active={activeStage === stage.stageCode}
                onClick={() => selectStage(stage.stageCode)}
              />
            ))}
          </div>
        </details>

        <details className="mt-5 overflow-hidden rounded-[18px] border border-[var(--rc-border)] bg-white/5">
          <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold text-[var(--rc-text)] hover:bg-white/5">
            Buka ringkasan KPI inventory
          </summary>
          <div className="grid grid-cols-2 gap-4 border-t border-[var(--rc-border)] p-4 lg:grid-cols-4">
            <KpiTile label="Live Report" value={String(liveCount)} note="Bisa buka viewer/export" icon={CheckCircle2} color="#D99A00" />
            <KpiTile label="Flow Live" value={String(stageCounts.size)} note="Hanya flow dengan report live" icon={Layers} color="#D99A00" />
            <KpiTile label="Sumber DB" value={selectedSource === 'pabrik' ? 'Pabrik' : 'Estate'} note={sourceTileValue} icon={Database} color="#D99A00" />
            <KpiTile label="Query Mode" value="Read-only" note="SELECT only" icon={ShieldCheck} color="#D99A00" />
          </div>
        </details>

        <section className="mt-5 rounded-[18px] border border-emerald-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">AI Insight</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Analisa payload disembunyikan dulu supaya halaman tetap bersih.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAiInsightVisible((current) => !current)}
              className={aiInsightVisible ? 'inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-extrabold text-slate-700 hover:bg-white' : 'inline-flex h-11 items-center gap-2 rounded-2xl bg-[#167A3A] px-4 text-sm font-extrabold text-white hover:bg-[#0f6a30]'}
            >
              <Sparkles size={16} />
              {aiInsightVisible ? 'Sembunyikan AI Insight' : 'Tampilkan AI Insight'}
            </button>
          </div>
        </section>

        {aiInsightVisible && (
        <section className="mt-5">
          <AIInsightTile
            selectedReport={selectedCatalogReport}
            hasLivePayload={Boolean(payload)}
            payload={payload}
            dataSource={sourceTileValue}
            error={error}
          />
        </section>
        )}

        {aiInsightVisible && (
        <section className="mt-5">
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
              stale: staleFilter,
              reportCode: selectedCatalogReport.reportCode,
            }}
            loading={loading || aiDashboardLoading}
            error={aiDashboardError}
          />
        </section>
        )}

        <section className="mt-5 rounded-[18px] border border-[#DDE6F0] bg-white p-[18px] shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1.4fr)_180px_190px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari report: barang masuk, nilai aset gudang, solar kendaraan..."
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold text-slate-950 outline-none focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
            <div className="inline-flex h-11 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-700">
              <CheckCircle2 size={15} />
              Live only
            </div>
            {selectedCatalogReport.existingReportId === 'item-movement-update-tracking' ? (
              <select
                value={staleFilter}
                onChange={(event) => {
                  setAiInsightVisible(false)
                  setStaleFilter(event.target.value)
                }}
                className="h-11 rounded-2xl border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800"
              >
                {STALE_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            ) : (
              <div className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500">
                <Filter size={15} />
                Flow live
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setSearch('')
                selectStage('all')
              }}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-950">Report Tile Grid</h2>
                <p className="mt-1 text-sm text-slate-500">{filteredReports.length} report live sesuai flow dan search.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">
                {selectedStage.stageName}
              </span>
            </div>

            {filteredReports.length === 0 ? (
              <TileShell className="p-10 text-center">
                <p className="text-lg font-extrabold text-slate-950">Tidak ada report ditemukan</p>
                <p className="mt-2 text-sm text-slate-500">Coba kata kunci lain seperti barang masuk, nilai aset gudang, atau solar kendaraan.</p>
              </TileShell>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {filteredReports.map((report) => (
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
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
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
                <p className="mt-2 text-sm leading-6 text-slate-300">{selectedCatalogReport.businessPurpose}</p>
              </div>

              <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-[18px]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{selectedCatalogReport.categoryLabel}</p>
                  <h3 className="mt-2 text-base font-extrabold text-slate-950">{selectedCatalogReport.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selectedCatalogReport.description}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-semibold text-slate-400">Report Code</p>
                    <p className="mt-1 text-sm font-extrabold text-slate-950">{selectedCatalogReport.reportCode}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-semibold text-slate-400">Last Updated</p>
                    <p className="mt-1 text-sm font-extrabold text-slate-950">{selectedCatalogReport.lastUpdated}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-950">
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
                        <span className="text-slate-500">{label}</span>
                        <span className="truncate text-right font-bold text-slate-700">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedCatalogReport.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{tag}</span>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Pertanyaan untuk AI</p>
                  <div className="mt-3 space-y-2">
                    {analysisQuestions(selectedCatalogReport).map((question) => (
                      <div key={question} className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-semibold leading-5 text-emerald-900">
                        {question}
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] font-semibold text-emerald-700">
                    Pertanyaan ini dikirim ke AI bersama payload live saat report sudah punya query.
                  </p>
                </div>

                {loading ? (
                  <div className="mt-4 space-y-3">
                    <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
                  </div>
                ) : error ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                    <p className="font-bold text-red-700">Gagal memuat payload live</p>
                    <p className="mt-1 text-sm leading-6 text-red-600">{error}</p>
                  </div>
                ) : payload ? (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {summaryEntries.map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
                          <p className="mt-1 truncate text-lg font-extrabold text-slate-950">{formatValue(value)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-950">
                        <Table2 size={16} />
                        Live Preview Table
                      </div>
                      <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="min-w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              {previewColumns.map((column) => (
                                <th key={column} className="whitespace-nowrap px-3 py-2 font-bold">{column}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {previewRows.length === 0 ? (
                              <tr>
                                <td colSpan={Math.max(previewColumns.length, 1)} className="px-3 py-6 text-center text-slate-500">
                                  Tidak ada data pada filter ini.
                                </td>
                              </tr>
                            ) : previewRows.map((row, index) => (
                              <tr key={index}>
                                {previewColumns.map((column) => (
                                  <td key={column} className="whitespace-nowrap px-3 py-2 text-slate-700">{formatValue(row[column])}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {payload.chart.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-950">
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
                                  <span className="truncate font-bold text-slate-700">{labelValue(row)}</span>
                                  <span className="text-slate-500">{formatValue(value)}</span>
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
                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <p className="font-bold text-blue-700">Live report belum bisa dibuka</p>
                    <p className="mt-1 text-sm leading-6 text-blue-600">
                      Report ini ada di daftar live, tetapi link viewer belum tersedia untuk source aktif.
                    </p>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => previewReport(selectedCatalogReport)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    <Eye size={15} />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => viewReport(selectedCatalogReport)}
                    disabled={!openableSelectedReport}
                    className={openableSelectedReport ? 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#167A3A] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#0f6a30]' : 'inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-400'}
                  >
                    <FileText size={15} />
                    Buka
                  </button>
                  <button
                    type="button"
                    onClick={() => exportLiveExcel(selectedCatalogReport)}
                    disabled={!openableSelectedReport}
                    className={openableSelectedReport ? 'inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100' : 'inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-400'}
                  >
                    <FileSpreadsheet size={15} />
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => exportLivePdf(selectedCatalogReport)}
                    disabled={!openableSelectedReport}
                    className={openableSelectedReport ? 'inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100' : 'inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-400'}
                  >
                    <Download size={15} />
                    PDF
                  </button>
                </div>
              </div>
            </TileShell>
          </aside>
        </section>
      </div>
    </main>
  )
}
