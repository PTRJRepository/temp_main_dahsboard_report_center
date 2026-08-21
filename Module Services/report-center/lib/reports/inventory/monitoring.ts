import type { InsightContent } from '@modules/report-center/lib/reports/intelligence'
import type { MonitoringVisualData } from '@modules/report-center/lib/reports/monitoring'

export type InventoryDbRow = Record<string, unknown>

export type InventoryQueryPayload = {
  title: string
  description: string
  rows: InventoryDbRow[]
  columns: string[]
  summary: InventoryDbRow
  chart?: InventoryDbRow[]
  metadata: InventoryDbRow
}

const labelFields = [
  'Label',
  'QualityFlag',
  'Route',
  'NamaBarang',
  'NamaFuel',
  'KodeBarang',
  'KodeFuel',
  'Deskripsi',
  'Dokumen',
  'DokumenPR',
  'DokumenTransfer',
  'DokumenFuel',
  'DokumenReturn',
  'Gudang',
  'GudangAsal',
  'GudangTujuan',
  'Kendaraan',
  'Tipe',
  'Jenis',
  'JenisMutasi',
  'Kategori',
  'AccCode',
  'BlkCode',
  'Satuan',
  'Status',
]

const categoryFields = ['QualityFlag', 'Kategori', 'Tipe', 'Jenis', 'JenisMutasi', 'Gudang', 'GudangAsal', 'Kendaraan', 'Satuan', 'Status', 'AccCode', 'BlkCode']

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function firstPresent(row: InventoryDbRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && value !== '') return value
  }
  return undefined
}

function metricValue(row: InventoryDbRow, preferred: string[] = []) {
  const preferredValue = firstPresent(row, preferred)
  if (preferredValue !== undefined) return toNumber(preferredValue)

  const values = Object.entries(row)
    .filter(([key]) => !/date|tanggal|update|year|month/i.test(key))
    .map(([, value]) => toNumber(value))
    .filter((value) => value > 0)

  return values.length ? Math.max(...values) : 0
}

function labelValue(row: InventoryDbRow) {
  const value = firstPresent(row, labelFields)
  if (value !== undefined) return String(value).trim() || 'Data'

  const firstString = Object.values(row).find((item) => typeof item === 'string' && item.trim())
  return firstString ? String(firstString).trim() : 'Data'
}

function formatMetric(value: unknown, prefix = '') {
  const numeric = toNumber(value)
  if (!numeric) return '-'

  const abs = Math.abs(numeric)
  const compact =
    abs >= 1_000_000_000
      ? `${(numeric / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}B`
      : abs >= 1_000_000
        ? `${(numeric / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}M`
        : abs >= 1_000
          ? `${(numeric / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}K`
          : numeric.toLocaleString('id-ID', { maximumFractionDigits: 2 })

  return prefix ? `${prefix} ${compact}` : compact
}

function formatDate(value: unknown) {
  if (!value) return '-'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function summaryMetric(summary: InventoryDbRow, keys: string[], fallback = 0) {
  const value = firstPresent(summary, keys)
  return value === undefined ? fallback : toNumber(value)
}

function isStockAgingPayload(payload: InventoryQueryPayload) {
  return Boolean(payload.metadata.stockAgingReport) || /stock\s+aging|item\s+movement\s+health|umur\s+stok/i.test(`${payload.title} ${payload.description}`)
}

function topStockAgingWarehouse(payload: InventoryQueryPayload) {
  return [...(payload.chart ?? [])]
    .map((row) => ({
      gudang: String(firstPresent(row, ['Gudang', 'Label']) ?? '-'),
      nilai: metricValue(row, ['NilaiStale', 'TotalAmount', 'NilaiStok', 'Amount', 'Aggregate']),
      item: metricValue(row, ['StaleLebih1Tahun', 'TotalItem', 'TotalRows']),
    }))
    .filter((row) => row.nilai > 0 || row.item > 0)
    .sort((a, b) => b.nilai - a.nilai || b.item - a.item)[0]
}

function topStockAgingItem(payload: InventoryQueryPayload) {
  const row = [...payload.rows]
    .sort((a, b) => {
      const riskDelta = metricValue(b, ['RiskScore']) - metricValue(a, ['RiskScore'])
      if (riskDelta) return riskDelta
      return metricValue(b, ['TotalAmount', 'NilaiStok']) - metricValue(a, ['TotalAmount', 'NilaiStok'])
    })[0]
  if (!row) return undefined
  return {
    label: labelValue(row),
    risk: String(firstPresent(row, ['RiskLevel']) ?? '-'),
    gudang: String(firstPresent(row, ['Gudang']) ?? '-'),
    umur: metricValue(row, ['UmurTahun']) || metricValue(row, ['UmurBulan']) / 12,
    nilai: metricValue(row, ['TotalAmount', 'NilaiStok']),
    action: 'Review item Critical/High berdasarkan umur stok, gudang, dan total amount.',
  }
}

function createStockAgingInsightFromPayload(payload: InventoryQueryPayload): InsightContent {
  const source = `${String(payload.metadata.sourceServer ?? '-')} / ${String(payload.metadata.sourceDatabase ?? '-')}`
  const stale = summaryMetric(payload.summary, ['StaleLebih12Bulan', 'ItemUpdateLebih12Bulan'])
  const dead = summaryMetric(payload.summary, ['DeadStockLebih24Bulan'])
  const riskyValue = summaryMetric(payload.summary, ['NilaiStokBerisiko'])
  const zeroStock = summaryMetric(payload.summary, ['ItemStokNol'])
  const noCategory = summaryMetric(payload.summary, ['ItemTanpaKategori'])
  const noIssue = summaryMetric(payload.summary, ['ItemTanpaIssueValid'])
  const topWarehouse = topStockAgingWarehouse(payload)
  const topItem = topStockAgingItem(payload)

  return {
    summary: `${payload.title}: ${formatMetric(stale || payload.rows.length)} item tidak update > 12 bulan${dead ? `, ${formatMetric(dead)} tidak update > 24 bulan` : ''}${riskyValue ? `, nilai stok berisiko ${formatMetric(riskyValue)}` : ''}.`,
    trendDetection: topWarehouse
      ? `Gudang ${topWarehouse.gudang} paling berisiko dengan ${formatMetric(topWarehouse.nilai)} nilai tidak update dari ${formatMetric(topWarehouse.item)} item.`
      : 'Distribusi aging belum cukup untuk ranking gudang; fokuskan pembacaan pada bucket update aging dan tabel prioritas.',
    anomalyDetection: topItem
      ? `Item prioritas: ${topItem.label}, risiko ${topItem.risk}, gudang ${topItem.gudang}, umur ${formatMetric(topItem.umur)} tahun, total amount ${formatMetric(topItem.nilai)}.`
      : payload.rows.length === 0
        ? 'Filter aktif tidak mengembalikan item; longgarkan scope aging atau cek filter kualitas data.'
        : 'Belum ada item prioritas yang dapat dibaca dari payload.',
    recommendation: topItem
      ? `${topItem.action} Mulai dari item Critical/High bernilai terbesar sebelum export.`
      : 'Prioritaskan Tidak Update > 24 Bulan, Tidak Update > 12 Bulan, lalu issue stok nol/tanpa kategori/tanpa issue valid.',
    dataQualityNote: `Quality issue: stok nol ${formatMetric(zeroStock)}, tanpa kategori ${formatMetric(noCategory)}, tanpa issue valid ${formatMetric(noIssue)}. AI hanya membaca payload hasil query. Sumber data: ${source}.`,
  }
}

function groupComposition(rows: InventoryDbRow[]) {
  const grouped = new Map<string, number>()
  rows.forEach((row) => {
    const category = String(firstPresent(row, categoryFields) ?? 'Lainnya').trim() || 'Lainnya'
    const value = metricValue(row, ['AmountCurrent', 'QuantityClosing', 'MovementGapQty', 'MovementQtyAll', 'StockIssueQtyAllPeriod', 'MovementAmountAll', 'StockIssueAmountAllPeriod', 'StokAkhir', 'Qty', 'Amount', 'NilaiStok', 'TotalAmount'])
    grouped.set(category, (grouped.get(category) ?? 0) + Math.max(1, value))
  })

  return [...grouped.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
}

function chartPoints(payload: InventoryQueryPayload, preferred: string[]) {
  const source = payload.chart?.length ? payload.chart : payload.rows.slice(0, 8)
  return source
    .slice(0, 8)
    .map((row) => ({
      label: labelValue(row),
      value: metricValue(row, preferred),
    }))
    .filter((item) => item.value > 0)
}

function rankingRows(rows: InventoryDbRow[]) {
  return rows
    .map((row) => ({
      label: labelValue(row),
      value: metricValue(row, ['AmountCurrent', 'NilaiStok', 'Amount', 'TotalAmount', 'MovementAmountAll', 'StockIssueAmountAllPeriod', 'QuantityClosing', 'MovementGapQty', 'MovementQtyAll', 'StockIssueQtyAllPeriod', 'StokAkhir', 'Qty', 'Shortage']),
      note: String(firstPresent(row, ['MovementCategory', 'StaleMovementRelation', 'Gudang', 'Kategori', 'Tipe', 'Satuan', 'Status']) ?? 'Hasil query inventory'),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((item) => ({
      label: item.label,
      value: formatMetric(item.value),
      note: item.note,
    }))
}

export function hasInventoryQueryData(payload?: InventoryQueryPayload | null) {
  if (!payload) return false
  return (
    payload.rows.length > 0 ||
    Boolean(payload.chart?.length) ||
    Object.keys(payload.summary ?? {}).length > 0 ||
    Object.keys(payload.metadata ?? {}).length > 0
  )
}

export function createInventoryMonitoringData(payload: InventoryQueryPayload): MonitoringVisualData {
  const totalRows = summaryMetric(
    payload.summary,
    ['TotalItem', 'TotalBaris', 'TotalTransaksi', 'TotalPenerimaan', 'TotalDokumen', 'TotalItemReorder'],
    payload.rows.length,
  )
  const stockOrAmount = summaryMetric(payload.summary, [
    'NilaiPersediaan',
    'NilaiKeluar',
    'NilaiMasuk',
    'NilaiTransfer',
    'NilaiFuel',
    'NilaiReturn',
    'NilaiPR',
    'TotalAmount',
    'EstimasiNilaiOrder',
    'TotalSelisihNilai',
    'TotalStok',
    'ItemCurrent',
    'AmountCurrent',
    'MovementGapQty',
    'MovementQtyAll',
    'MovementAmountAll',
    'StockIssueQtyAllPeriod',
    'StockIssueAmountAllPeriod',
    'TotalQty',
  ])
  const reorder = summaryMetric(payload.summary, ['ItemMinimumStock', 'TotalItemReorder'])
  const lastUpdate = firstPresent(payload.summary, ['TerakhirUpdate']) ?? payload.metadata.generatedAt
  const trend = chartPoints(payload, [
    'NilaiPersediaan',
    'NilaiKeluar',
    'NilaiMasuk',
    'NilaiTransfer',
    'NilaiFuel',
    'NilaiReturn',
    'NilaiPR',
    'TotalAmount',
    'Amount',
    'Qty',
    'AmountCurrent',
    'TotalStok',
    'MovementGapQty',
    'MovementQtyAll',
    'MovementAmountAll',
    'StockIssueQtyAllPeriod',
    'StockIssueAmountAllPeriod',
    'QtyOutstanding',
    'QtyFuel',
    'QtyTransfer',
    'QtyReturn',
    'TotalItem',
    'TotalRows',
    'Transaksi',
  ])
  const breakdown = chartPoints(payload, [
    'NilaiStok',
    'NilaiPersediaan',
    'NilaiKeluar',
    'NilaiMasuk',
    'NilaiTransfer',
    'NilaiFuel',
    'NilaiReturn',
    'NilaiPR',
    'TotalAmount',
    'Amount',
    'AmountCurrent',
    'TotalStok',
    'MovementGapQty',
    'MovementQtyAll',
    'MovementAmountAll',
    'StockIssueQtyAllPeriod',
    'StockIssueAmountAllPeriod',
    'TotalItem',
    'TotalRows',
    'Transaksi',
  ])
  const composition = groupComposition(payload.rows)
  const ranking = rankingRows(payload.rows)

  return {
    title: payload.title,
    accent: '#167A3A',
    badge: 'Real query result',
    kpis: [
      { label: 'Total data', value: formatMetric(totalRows), tone: 'green' },
      {
        label: stockOrAmount >= 1_000_000 ? 'Nilai / amount' : 'Qty / stok',
        value: stockOrAmount >= 1_000_000 ? formatMetric(stockOrAmount, 'Rp') : formatMetric(stockOrAmount),
        tone: 'blue',
      },
      { label: 'Reorder alert', value: formatMetric(reorder), tone: reorder > 0 ? 'gold' : 'green' },
      { label: 'Last update', value: formatDate(lastUpdate), tone: 'slate' },
    ],
    trend: trend.length ? trend : [{ label: 'Data', value: totalRows || payload.rows.length }],
    breakdown: breakdown.length ? breakdown : [{ label: payload.title, value: totalRows || payload.rows.length }],
    composition: composition.length ? composition : [{ label: 'Query result', value: totalRows || payload.rows.length || 1 }],
    ranking: ranking.length
      ? ranking
      : [{ label: payload.title, value: formatMetric(totalRows || payload.rows.length), note: 'Hasil query inventory' }],
    alerts: [
      ...(reorder > 0
        ? [{ title: 'Reorder alert', detail: `${formatMetric(reorder)} item berada di bawah minimum stok.`, tone: 'gold' as const }]
        : [{ title: 'Reorder normal', detail: 'Tidak ada alert reorder pada summary query ini.', tone: 'green' as const }]),
      {
        title: 'Sumber data',
        detail: `${String(payload.metadata.sourceServer ?? '-')} / ${String(payload.metadata.sourceDatabase ?? '-')}`,
        tone: 'slate' as const,
      },
      ...(payload.rows.length === 0
        ? [{ title: 'Data kosong', detail: 'Query berhasil tetapi tidak mengembalikan row pada filter ini.', tone: 'gold' as const }]
        : []),
    ],
  }
}

export function createInventoryInsightFromPayload(payload: InventoryQueryPayload): InsightContent {
  if (isStockAgingPayload(payload)) return createStockAgingInsightFromPayload(payload)

  const totalRows = payload.rows.length
  const reorder = summaryMetric(payload.summary, ['ItemMinimumStock', 'TotalItemReorder'])
  const lastUpdate = firstPresent(payload.summary, ['TerakhirUpdate']) ?? payload.metadata.generatedAt
  const source = `${String(payload.metadata.sourceServer ?? '-')} / ${String(payload.metadata.sourceDatabase ?? '-')}`
  const summaryEntries = Object.entries(payload.summary ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${formatMetric(value)}`)
  const topChart = chartPoints(payload, [
    'NilaiPersediaan',
    'NilaiStok',
    'NilaiKeluar',
    'NilaiMasuk',
    'NilaiTransfer',
    'NilaiFuel',
    'NilaiReturn',
    'NilaiPR',
    'TotalAmount',
    'Amount',
    'QtyOutstanding',
    'QtyFuel',
    'QtyTransfer',
    'TotalItem',
    'TotalRows',
  ])[0]
  const qualityKeys = [
    ['ItemStokNol', 'item stok nol'],
    ['ItemTanpaKategori', 'item tanpa kategori'],
    ['ItemTanpaIssueValid', 'item tanpa issue valid'],
    ['ItemUpdateLebih12Bulan', 'item update lebih dari 12 bulan'],
    ['BarisAccCodeKosong', 'baris AccCode kosong'],
    ['BarisBlkCodeKosong', 'baris BlkCode kosong'],
    ['BarisVehCodeKosong', 'baris VehCode kosong'],
    ['OutstandingAmountNol', 'line outstanding dengan amount 0'],
  ] as const
  const qualityFindings = qualityKeys
    .map(([key, label]) => ({ label, value: summaryMetric(payload.summary, [key]) }))
    .filter((item) => item.value > 0)
  const metadataQualityNotes = Array.isArray(payload.metadata.qualityNotes)
    ? payload.metadata.qualityNotes.map(String).slice(0, 2)
    : []

  return {
    summary:
      summaryEntries.length > 0
        ? `${payload.title} membaca ${totalRows.toLocaleString('id-ID')} row sample. Ringkasan utama: ${summaryEntries.join(', ')}.`
        : `${payload.title} membaca ${totalRows.toLocaleString('id-ID')} row sample dari query inventory yang sudah ditentukan.`,
    trendDetection:
      topChart
        ? `Chart utama menunjukkan ${topChart.label} sebagai titik paling material dengan nilai ${formatMetric(topChart.value)}. Chart memakai ${payload.chart?.length ?? 0} titik data hasil query.`
        : payload.chart && payload.chart.length > 0
          ? `Chart preview memakai ${payload.chart.length.toLocaleString('id-ID')} titik data hasil query.`
          : 'Query ini belum mengembalikan chart terpisah, preview memakai row hasil query.',
    anomalyDetection:
      qualityFindings.length > 0
        ? `Quality flags terdeteksi: ${qualityFindings.slice(0, 4).map((item) => `${formatMetric(item.value)} ${item.label}`).join(', ')}.`
        : reorder > 0
          ? `${reorder.toLocaleString('id-ID')} item terdeteksi pada indikator reorder/minimum stock.`
          : totalRows === 0
            ? 'Query berhasil tetapi tidak ada row pada filter aktif.'
            : 'Tidak ada quality flag material pada summary query ini.',
    recommendation:
      qualityFindings.length > 0
        ? `Prioritaskan review ${qualityFindings[0].label}, lalu cek chart dan sample row sebelum export executive/audit.`
        : reorder > 0
          ? 'Prioritaskan review report Reorder Level dan Stock Opname sebelum export.'
          : 'Gunakan preview tabel, metadata, dan filter sebelum membuka atau export full report.',
    dataQualityNote: `AI hanya membaca payload hasil query. Sumber data: ${source}. Last update: ${formatDate(lastUpdate)}.${metadataQualityNotes.length ? ` Catatan: ${metadataQualityNotes.join(' ')}` : ''}`,
  }
}
