import { inventoryColumnLabel } from '@/lib/reports/inventory/column-glossary'
import type { ReportFilterInput } from '@/lib/reports/report-filtering'
import { formatKpiValue, formatMetric } from '@/utils/format'
import type { ReportKpiCard, ReportPayload } from './types'

type DbRow = Record<string, unknown>

function formatValue(value: unknown, field?: string) {
  return formatMetric(value, field)
}

const LEGACY_COLUMN_LABELS: Record<string, string> = {
  acc_year: 'AccYear',
  acc_month: 'AccMonth',
  report_id: 'Report ID',
  source_report_title: 'Source Report',
  RecommendedAction: 'Recommended Action',
  ItemCurrent: 'Item Current',
  MovementActivityCountActual: 'Movement Activity Count',
  MovementActivityQtyActual: 'Movement Activity Qty',
  MovementActivityAmountActual: 'Movement Activity Amount',
  MovementIssueCountActual: 'Movement Actual Count',
  MovementIssueQtyActual: 'Movement Actual Qty',
  MovementIssueAmountActual: 'Movement Actual Amount',
  StockIssueDocumentCountActual: 'StockIssue Doc Count',
  StockIssueDocumentQtyActual: 'StockIssue Doc Qty',
  StockIssueDocumentAmountActual: 'StockIssue Doc Amount',
  MovementSourceValid: 'Movement Source Valid',
  LastStockIssueMovementDate: 'Last StockIssue Movement Date',
  StockIssueMovementAgeDays: 'StockIssue Movement Age Days',
  StockIssueMovementEvent1: 'StockIssue Movement Event 1',
  StockIssueMovementEvent2: 'StockIssue Movement Event 2',
  JumlahAmountStockIssue: 'Jumlah Amount Stock Issue',
  JumlahQtyMovement: 'Jumlah Qty Movement',
  JumlahAmountMovement: 'Jumlah Amount Movement',
  StockIssueEvent1: 'Stock Issue Event 1',
  StockIssueEvent2: 'Stock Issue Event 2',
}

function displayColumnLabel(field: string) {
  return inventoryColumnLabel(field, LEGACY_COLUMN_LABELS[field] ?? field)
}

function compactMetric(value: unknown, field?: string, label?: string) {
  return formatKpiValue(value, field, label)
}

function kpiMeaning(field: string, label = displayColumnLabel(field)) {
  if (/period|bulan|month/i.test(field)) return `${label} applied by report filters.`
  if (/amount|nilai|value|cost|harga|valuation|asset/i.test(field)) return `${label} amount/value in IDR for selected report scope.`
  if (/qty|quantity|stok|stock|saldo/i.test(field)) return `${label} physical quantity total for selected report scope.`
  if (/count|item|rows|row|total|supplier|location|gudang/i.test(field)) return `${label} count for selected report scope.`
  return `${label} from report summary for selected scope.`
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function resolveGroupFieldAliases(groupBy?: string): string[] {
  if (!groupBy) return []
  const g = String(groupBy).trim()
  const map: Record<string, string[]> = {
    ProductTypeCode: ['ProductTypeCode', 'ProductType', 'product_type_code', 'ProductTypeDescription'],
    ProductType: ['ProductType', 'ProductTypeCode', 'product_type_code', 'ProductTypeDescription'],
    ProductCategoryCode: ['ProductCategoryCode', 'product_category_code', 'KodeKategori', 'Kategori'],
    ProductBrandCode: ['ProductBrandCode', 'product_brand_code'],
    ProductModelCode: ['ProductModelCode', 'product_model_code'],
    ProductMaterialCode: ['ProductMaterialCode', 'product_material_code'],
    MovementCategory: ['MovementCategory'],
    Location: ['Location', 'Gudang', 'LocCode', 'location'],
    Gudang: ['Gudang', 'Location', 'LocCode', 'location'],
    LocCode: ['LocCode', 'Gudang', 'Location', 'location'],
    ItemType: ['ItemType', 'ItemTypeName'],
    ItemTypeName: ['ItemTypeName', 'ItemType'],
  }
  return map[g] ?? [g]
}

function groupFieldsMatch(selected?: string, actual?: string) {
  if (!selected || !actual) return false
  if (selected === actual) return true
  const selectedAliases = new Set(resolveGroupFieldAliases(selected))
  const actualAliases = new Set(resolveGroupFieldAliases(actual))
  for (const key of selectedAliases) {
    if (actualAliases.has(key)) return true
  }
  return false
}

function resolveGroupDimension(rows: DbRow[], groupBy?: string, preferred: string[] = []) {
  if (groupBy) {
    const aliases = resolveGroupFieldAliases(groupBy)
    for (const key of aliases) {
      if (rows.some((row) => row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '')) {
        return key
      }
    }
    // Keep user selection even if empty on loaded page (chart/server may still scope by it).
    return aliases[0] ?? groupBy
  }

  for (const key of preferred.filter(Boolean) as string[]) {
    const aliases = resolveGroupFieldAliases(key)
    for (const alias of aliases) {
      if (rows.some((row) => row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== '')) {
        return alias
      }
    }
  }
  return undefined
}

function amountKeysForRows(rows: DbRow[]) {
  const preferred = ['ClosingAmount', 'AmountItem', 'TotalAmount', 'total_amount', 'NilaiStok', 'Amount', 'OnHandHoldAmount']
  return preferred.filter((key) => rows.some((row) => toNumber(row[key]) !== 0 || row[key] !== undefined))
}

function qtyKeysForRows(rows: DbRow[]) {
  const preferred = ['ClosingQty', 'TotalQty', 'total_quantity', 'Qty', 'QuantityClosing', 'IssuedTotalQty']
  return preferred.filter((key) => rows.some((row) => row[key] !== undefined))
}

function firstNumericRowValue(row: DbRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value === undefined || value === null || value === '') continue
    return toNumber(value)
  }
  return undefined
}

function chartRowDimensionId(row: DbRow) {
  return String(row.DimensionId ?? '').trim().toLowerCase()
}

function chartRowMatchesGroupField(row: DbRow, groupField: string) {
  const dimId = chartRowDimensionId(row)
  if (groupFieldsMatch(groupField, 'MovementCategory')) {
    return dimId === 'movement-category' || Boolean(row.MovementCategory)
  }
  if (groupFieldsMatch(groupField, 'Location') || groupFieldsMatch(groupField, 'Gudang')) {
    return dimId === 'location' || Boolean(row.Gudang || row.Location || row.location || row.LocCode)
  }
  if (groupFieldsMatch(groupField, 'ItemType')) {
    return dimId === 'item-type' || Boolean(row.ItemType || row.ItemTypeName)
  }
  if (groupFieldsMatch(groupField, 'ProductTypeCode') || groupFieldsMatch(groupField, 'ProductType')) {
    return (
      dimId === 'product-type' ||
      Boolean(row.ProductTypeCode || row.ProductType || row.product_type_code)
    )
  }
  if (groupFieldsMatch(groupField, 'ProductCategoryCode')) {
    return dimId === 'product-category' || Boolean(row.ProductCategoryCode || row.product_category_code)
  }
  if (groupFieldsMatch(groupField, 'ProductBrandCode')) {
    return dimId === 'product-brand' || Boolean(row.ProductBrandCode || row.product_brand_code)
  }
  if (groupFieldsMatch(groupField, 'ProductModelCode')) {
    return dimId === 'product-model' || Boolean(row.ProductModelCode || row.product_model_code)
  }
  if (groupFieldsMatch(groupField, 'ProductMaterialCode')) {
    return dimId === 'product-material' || Boolean(row.ProductMaterialCode || row.product_material_code)
  }
  // Reject foreign dimension ids even if Label is filled.
  if (dimId && !['', 'analysis-group'].includes(dimId)) {
    const expected = String(groupField).replace(/Code$/i, '').toLowerCase()
    if (!dimId.includes(expected) && dimId !== String(groupField).toLowerCase()) return false
  }
  return resolveGroupFieldAliases(groupField).some((alias) => {
    const value = row[alias]
    return value !== undefined && value !== null && String(value).trim() !== ''
  })
}

function chartGroupKey(row: DbRow, groupField: string) {
  // Only read fields that belong to the active group dimension.
  // Never fall back to bare Label/DimensionValue from a foreign chart slice
  // (mixed monthly chart packs ProductType + MovementCategory + ItemType).
  if (!chartRowMatchesGroupField(row, groupField)) return ''

  const aliases = resolveGroupFieldAliases(groupField)
  const candidates = [
    ...aliases.map((alias) => row[alias]),
    ...(groupFieldsMatch(groupField, 'Location') || groupFieldsMatch(groupField, 'Gudang')
      ? [row.Gudang, row.Location, row.location, row.LocCode]
      : []),
    ...(groupFieldsMatch(groupField, 'MovementCategory') ? [row.MovementCategory] : []),
    ...(groupFieldsMatch(groupField, 'ProductTypeCode') || groupFieldsMatch(groupField, 'ProductType')
      ? [row.ProductTypeCode, row.ProductType, row.product_type_code, row.ProductTypeDescription]
      : []),
    // Safe only after chartRowMatchesGroupField — same-dimension chart rows.
    row.DimensionValue,
    row.Label,
  ]
  for (const value of candidates) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
}

function chartGroupName(row: DbRow, groupField: string) {
  const value =
    groupField === 'Gudang' || groupField === 'Location'
      ? row[groupField] ?? row.Gudang ?? row.Location
      : groupField === 'MovementCategory'
        ? row.MovementCategory ?? row.DimensionName ?? row.Label
        : row.DimensionName ??
          row[`${groupField.replace(/Code$/, '')}Description`] ??
          row.ProductTypeDescription ??
          (groupField === 'ItemType' || groupField === 'ItemTypeName' ? row.ItemTypeName ?? row.ItemType : undefined) ??
          row.Label
  return String(value ?? '').trim()
}

function chartMatchesGroupField(chart: DbRow[], groupField: string) {
  if (!chart.length) return false
  // Mixed monthly charts include ProductType + MovementCategory + ItemType slices.
  // Accept the chart only if at least one ROW matches the selected group field.
  return chart.some((row) => chartRowMatchesGroupField(row, groupField))
}

function chartRowsForGroupField(chart: DbRow[], groupField: string) {
  return chart.filter((row) => chartRowMatchesGroupField(row, groupField))
}

function chartMetricValue(row: DbRow, metric: string) {
  const aliases: Record<string, string[]> = {
    TotalItem: ['TotalItem', 'TotalRows', 'ItemCurrent'],
    ItemCurrent: ['ItemCurrent', 'TotalItem', 'TotalRows'],
    // Monthly MC / group cards must show period Closing, not live OnHandHold.
    AmountItem: ['ClosingAmount', 'Amount', 'AmountItem', 'AssetAmountRealTime', 'TotalAmount', 'OnHandHoldAmount'],
    AssetAmountRealTime: ['ClosingAmount', 'Amount', 'AssetAmountRealTime', 'AmountItem', 'TotalAmount', 'OnHandHoldAmount'],
    QtyOnHandHold: ['ClosingQty', 'QtyOnHandHold', 'Qty', 'total_quantity'],
    ClosingAmount: ['ClosingAmount', 'Amount', 'TotalAmount'],
    ClosingQty: ['ClosingQty', 'Qty', 'TotalQty'],
    IssuedTotalAmount: ['IssuedTotalAmount', 'IssuedAmount'],
    StockIssueMovementCount: ['StockIssueMovementCount', 'MovementIssueCountActual'],
    StockIssueMovementQty: ['StockIssueMovementQty', 'MovementIssueQtyActual'],
    StockIssueMovementAmount: ['StockIssueMovementAmount', 'MovementIssueAmountActual'],
    OnHandHoldAmount: ['ClosingAmount', 'Amount', 'OnHandHoldAmount'],
  }
  return firstNumericRowValue(row, aliases[metric] ?? [metric])
}

const SUB_KPI_CHART_TOTAL_KEYS = [
  'TotalItem',
  'ItemCurrent',
  'AmountItem',
  'AssetAmountRealTime',
  'QtyOnHandHold',
  'ClosingAmount',
  'OpeningAmount',
  'IssuedTotalAmount',
  'IssuedStationAmount',
  'IssuedVehicleAmount',
  'GoodsReceiveAmount',
  'ReturnAmount',
  'OnHandHoldAmount',
  'ClosingQty',
  'OpeningQty',
  'IssuedTotalQty',
  'GoodsReceiveQty',
  'ReturnQty',
  'MovementActivityCountActual',
  'MovementActivityQtyActual',
  'MovementActivityAmountActual',
  'MovementIssueCountActual',
  'MovementIssueQtyActual',
  'MovementIssueAmountActual',
  'StockIssueMovementCount',
  'StockIssueMovementQty',
  'StockIssueMovementAmount',
] as const

function chartTotalsForGroup(row: DbRow) {
  const totals: Record<string, number> = {}
  SUB_KPI_CHART_TOTAL_KEYS.forEach((key) => {
    const value = chartMetricValue(row, key)
    if (value !== undefined) totals[key] = value
  })
  return totals
}

function chartTotalsByGroup(chart: DbRow[], groupField: string | undefined) {
  const totals = new Map<string, Record<string, number>>()
  if (!groupField) return totals

  chartRowsForGroupField(chart, groupField).forEach((row) => {
    const key = chartGroupKey(row, groupField)
    if (!key) return
    const next = chartTotalsForGroup(row)
    if (Object.keys(next).length > 0) totals.set(key, next)
  })

  return totals
}

function isSummableMetricField(field: string) {
  if (!field) return false
  if (/Code$|Name$|Description|Period|Date|Time|ID$|Label|Category|Type|Status|UOM|Unit$|Location|Gudang|Supplier|Rank|Window|Source|Rule|Raw|technical|report_id|server|database|sql/i.test(field)) {
    return false
  }
  return /Amount|Qty|Quantity|Total|Nilai|Count|Event|Cost|Value|OnHand|Hold|Closing|Opening|Issued|Received|Return|Goods|Adjustment|Transfer|Dispatch|Ledger|Station|Vehicle|Item$|Rows|Score/i.test(field)
}

const KPI_TONES = [
  'border-emerald-200 bg-emerald-50 text-emerald-900',
  'border-sky-100 bg-sky-50 text-sky-800',
  'border-amber-100 bg-amber-50 text-amber-800',
  'border-rose-100 bg-rose-50 text-rose-800',
  'border-purple-100 bg-purple-50 text-purple-800',
  'border-cyan-100 bg-cyan-50 text-cyan-800',
  'border-lime-100 bg-lime-50 text-lime-800',
  'border-blue-100 bg-blue-50 text-blue-800',
] as const

function resolveMetricKeysForKpis(
  summary: DbRow,
  columns: string[],
  preferredColumns: string[] = [],
  max = 16,
) {
  const summaryMetricKeys = Object.keys(summary).filter((key) => {
    const value = summary[key]
    if (value === null || value === undefined || value === '') return false
    if (typeof value === 'object') return false
    // Exclude ItemType split fields from global metric strip (shown on breakdown cards).
    if (/^(StockGudang|WorkshopMesin)/i.test(key)) return false
    return isSummableMetricField(key)
  })
  const columnMetrics = columns.filter((key) => isSummableMetricField(key))
  // Official RPTIN1000015 amount/qty block first so KPI strip mirrors export columns.
  const preferredOrder = [
    ...preferredColumns,
    'ClosingAmount',
    'OpeningAmount',
    'IssuedTotalAmount',
    'IssuedStationAmount',
    'IssuedVehicleAmount',
    'LedgerAmount',
    'GoodsReceiveAmount',
    'ReturnAmount',
    'GoodsReturnAmount',
    'DispatchAdvAmount',
    'ReceivedAmount',
    'ReturnAdviceAmount',
    'TransferredAmount',
    'AdjustmentAmount',
    'OnHandHoldAmount',
    'AmountItem',
    'TotalAmount',
    'total_amount',
    'NilaiStok',
    'ClosingQty',
    'OpeningQty',
    'IssuedTotalQty',
    'GoodsReceiveQty',
    'ReceivedQty',
    'ReturnQty',
    'QtyOnHandHold',
    'TotalQty',
    'TotalItem',
    'FilteredRows',
    'StockIssueMovementCount',
    'StockIssueMovementAmount',
  ]
  const ordered = [
    ...preferredOrder.filter((key) => summaryMetricKeys.includes(key) || columnMetrics.includes(key)),
    ...summaryMetricKeys.filter((key) => !preferredOrder.includes(key)),
    ...columnMetrics.filter((key) => !preferredOrder.includes(key) && !summaryMetricKeys.includes(key)),
  ]
  return [...new Set(ordered)].slice(0, max)
}

function pickMetricValue(summary: DbRow, rows: DbRow[], key: string) {
  const fromSummary = summary[key]
  if (fromSummary !== undefined && fromSummary !== null && fromSummary !== '') {
    return { value: fromSummary, source: 'summary' as const }
  }
  if (rows.length === 0) return null
  return {
    value: rows.reduce((sum, row) => sum + toNumber(row[key]), 0),
    source: 'rows' as const,
  }
}

const SUB_KPI_DEFAULT_LIMIT = 48

function buildItemTypeBreakdownCards(
  summary: DbRow,
  rows: DbRow[],
  metricKeys: string[],
): ReportKpiCard[] {
  const primary = metricKeys[0] ?? 'ClosingAmount'
  const secondary = metricKeys.slice(0, 4)

  const summaryPairs: Array<{ key: string; label: string; amountKeys: string[]; qtyKeys: string[]; itemKeys: string[] }> = [
    {
      key: 'gudang',
      label: 'Stock Gudang',
      amountKeys: ['StockGudangClosingAmount', 'StockGudangOnHandHoldAmount', 'GudangTotalAmount', 'GudangTotalAssetAmount'],
      qtyKeys: ['StockGudangQtyOnHandHold', 'GudangTotalQty'],
      itemKeys: ['StockGudangItem', 'GudangItemCount', 'GudangItemWithStock'],
    },
    {
      key: 'workshop',
      label: 'Workshop Mesin',
      amountKeys: ['WorkshopMesinClosingAmount', 'WorkshopMesinOnHandHoldAmount', 'WorkshopTotalAmount'],
      qtyKeys: ['WorkshopMesinQtyOnHandHold', 'WorkshopTotalQty'],
      itemKeys: ['WorkshopMesinItem', 'WorkshopItemCount'],
    },
  ]

  const hasSummarySplit = summaryPairs.some((pair) =>
    [...pair.amountKeys, ...pair.itemKeys].some((key) => summary[key] !== undefined && summary[key] !== null && summary[key] !== ''),
  )

  if (hasSummarySplit) {
    return summaryPairs.map((pair, index) => {
      const amount = pair.amountKeys.map((key) => summary[key]).find((value) => value !== undefined && value !== null && value !== '')
      const qty = pair.qtyKeys.map((key) => summary[key]).find((value) => value !== undefined && value !== null && value !== '')
      const items = pair.itemKeys.map((key) => summary[key]).find((value) => value !== undefined && value !== null && value !== '')
      const metrics = [
        amount !== undefined ? { key: 'amount', label: 'Amount', value: amount } : null,
        qty !== undefined ? { key: 'qty', label: 'Qty', value: qty } : null,
        items !== undefined ? { key: 'items', label: 'Items', value: items } : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: unknown }>
      return {
        label: pair.label,
        value: amount ?? items ?? qty ?? 0,
        description: `${pair.label} amount/value in IDR. Qty and item chips show physical quantity and item count.`,
        tone: KPI_TONES[index % KPI_TONES.length],
        scope: 'breakdown' as const,
        groupField: 'ItemType',
        groupKey: pair.key,
        metrics,
      }
    })
  }

  // Fallback: split loaded rows by ItemType 1 vs 4 when summary has no dedicated columns.
  const buckets: Array<{ key: string; label: string; match: (row: DbRow) => boolean }> = [
    {
      key: 'gudang',
      label: 'Stock Gudang',
      match: (row) => {
        const t = String(row.ItemType ?? row.ItemTypeName ?? '').trim().toLowerCase()
        return t === '1' || t.includes('gudang') || t.includes('stock')
      },
    },
    {
      key: 'workshop',
      label: 'Workshop Mesin',
      match: (row) => {
        const t = String(row.ItemType ?? row.ItemTypeName ?? '').trim().toLowerCase()
        return t === '4' || t.includes('workshop') || t.includes('mesin')
      },
    },
  ]

  return buckets.map((bucket, index) => {
    const matched = rows.filter(bucket.match)
    const metrics = secondary.map((metric) => ({
      key: metric,
      label: displayColumnLabel(metric),
      value: matched.reduce((sum, row) => sum + toNumber(row[metric]), 0),
    }))
    const head = metrics.find((metric) => metric.key === primary) ?? metrics[0]
    return {
      label: bucket.label,
      value: head?.value ?? matched.length,
      description: `${matched.length} items in ItemType breakdown. Value follows primary metric for selected scope.`,
      tone: KPI_TONES[index % KPI_TONES.length],
      scope: 'breakdown' as const,
      groupField: 'ItemType',
      groupKey: bucket.key,
      metrics,
    }
  })
}

function buildSubCategoryKpiCards(
  rows: DbRow[],
  groupField: string | undefined,
  metricKeys: string[],
  chart: DbRow[] = [],
  limit = SUB_KPI_DEFAULT_LIMIT,
): ReportKpiCard[] {
  if (!groupField || metricKeys.length === 0) return []
  const primary = metricKeys[0]
  // Keep export-aligned movement columns on each sub card (not just top 5).
  const secondary = metricKeys.slice(0, 12)
  const buckets = new Map<string, { count: number; metrics: Record<string, number>; name?: string; fromChart?: boolean }>()

  // Prefer full-scope chart aggregates (GROUP BY analysis field over report_rows).
  // Loaded table rows are paginated — summing them understates Closing vs export grand total.
  const matchedChart = chartRowsForGroupField(chart, groupField)
  const useChartOnly = matchedChart.length > 0

  if (useChartOnly) {
    for (const row of matchedChart) {
      const key = chartGroupKey(row, groupField)
      if (!key) continue
      const bucket = buckets.get(key) ?? { count: 0, metrics: {}, name: undefined, fromChart: true }
      const chartName = chartGroupName(row, groupField)
      if (chartName) bucket.name = chartName
      for (const metric of secondary) {
        const value = chartMetricValue(row, metric)
        if (value !== undefined) bucket.metrics[metric] = value
      }
      const primaryValue = chartMetricValue(row, primary)
      if (primaryValue !== undefined) bucket.metrics[primary] = primaryValue
      const itemCount = chartMetricValue(row, 'TotalItem')
      if (itemCount !== undefined) bucket.count = itemCount
      bucket.fromChart = true
      buckets.set(key, bucket)
    }
  } else {
    const groupAliases = resolveGroupFieldAliases(groupField)
    for (const row of rows) {
      let key = ''
      for (const alias of groupAliases) {
        const text = String(row[alias] ?? '').trim()
        if (text) {
          key = text
          break
        }
      }
      if (!key) key = '(blank)'
      const bucket = buckets.get(key) ?? { count: 0, metrics: {}, name: undefined }
      bucket.count += 1
      if (
        !bucket.name &&
        (groupFieldsMatch(groupField, 'ProductTypeCode') || groupFieldsMatch(groupField, 'ProductType')) &&
        row.ProductTypeDescription
      ) {
        bucket.name = String(row.ProductTypeDescription)
      }
      if (!bucket.name && groupFieldsMatch(groupField, 'MovementCategory') && row.MovementCategory) {
        bucket.name = String(row.MovementCategory)
      }
      for (const metric of secondary) {
        bucket.metrics[metric] = (bucket.metrics[metric] ?? 0) + toNumber(row[metric])
      }
      buckets.set(key, bucket)
    }
  }

  const ranked = [...buckets.entries()]
    .sort((a, b) => (b[1].metrics[primary] ?? 0) - (a[1].metrics[primary] ?? 0) || b[1].count - a[1].count)
    .slice(0, limit)

  return ranked.map(([key, stats], index) => {
    const masterHint =
      stats.name && stats.name !== key
        ? `${key} · ${stats.name}`
        : key
    const metricList = secondary
      .filter((metric) => stats.metrics[metric] !== undefined)
      .map((metric) => ({
        key: metric,
        label: displayColumnLabel(metric),
        value: stats.metrics[metric],
      }))
    const head = metricList[0]
    return {
      label: masterHint,
      value: head?.value ?? stats.count,
      description: stats.fromChart
        ? `${stats.count} items in ${displayColumnLabel(groupField)}. Amount/Qty chips use full grouped summary.`
        : `${stats.count} items in ${displayColumnLabel(groupField)} from loaded rows only.`,
      tone: KPI_TONES[index % KPI_TONES.length],
      scope: 'sub' as const,
      groupField,
      groupKey: key,
      metrics: metricList,
    }
  })
}

function buildDynamicGrandTotalKpis(
  payload: ReportPayload,
  filters?: ReportFilterInput,
  preferredColumns: string[] = [],
  limit = 12,
  tableGroupField?: string,
): ReportKpiCard[] {
  const summary = payload.summary ?? {}
  const metadata = payload.metadata ?? {}
  const rows = payload.rows ?? []
  const columns = payload.columns ?? []
  const metricKeys = resolveMetricKeysForKpis(summary, columns, preferredColumns, 8)

  const globalCards: ReportKpiCard[] = []
  const used = new Set<string>()

  for (const key of metricKeys) {
    if (used.has(key) || globalCards.length >= 14) break
    const picked = pickMetricValue(summary, rows, key)
    if (!picked) continue
    if (typeof picked.value === 'string' && Number.isNaN(Number(String(picked.value).replace(/[^\d.-]/g, ''))) && String(picked.value).trim() !== '0') {
      continue
    }
    used.add(key)
    globalCards.push({
      label: displayColumnLabel(key),
      value: picked.value,
      description: picked.source === 'summary' ? kpiMeaning(key) : `${displayColumnLabel(key)} sum from loaded rows only.`,
      tone: KPI_TONES[globalCards.length % KPI_TONES.length],
      scope: 'global',
    })
  }

  const period =
    summary.ActualPeriod ??
    summary.actualPeriod ??
    metadata.actualPeriod ??
    metadata.period ??
    filters?.period
  const acc = summary.AccountingPeriod ?? summary.accountingPeriod ?? metadata.accountingPeriod
  if (period) {
    globalCards.push({
      label: 'Actual Period',
      value: period,
      description: 'Actual calendar period applied by report filters.',
      tone: 'border-white/10 bg-[#0F2B1A] text-white',
      scope: 'global',
    })
  }
  if (acc) {
    globalCards.push({
      label: 'Acc Period',
      value: acc,
      description: 'Accounting fiscal period used by inventory report data.',
      tone: 'border-white/10 bg-[#1A1A1A] text-white',
      scope: 'global',
    })
  }

  // Two analysis families (do not mix):
  // 1) Stored taxonomy sub — fields already on row/master (ProductType, Location…).
  // 2) Computed rails — derived outside raw table cells (Movement Actual from StockIssue window).
  // Future auto-calc analyses → new scope rail like `movement`, never dump into `sub`.
  const selectedGroup = tableGroupField || filters?.groupBy || filters?.chartDimension
  const selectedIsItemType = groupFieldsMatch(selectedGroup, 'ItemType')
  const selectedIsComputedMovement = groupFieldsMatch(selectedGroup, 'MovementCategory')
  // Sub-category = stored fields only. MovementCategory never resolves as sub dim.
  const dim = resolveGroupDimension(
    rows,
    selectedIsItemType || selectedIsComputedMovement ? undefined : selectedGroup,
    selectedGroup && !selectedIsItemType && !selectedIsComputedMovement
      ? []
      : ['ProductTypeCode', 'ProductType', 'Gudang', 'Location'],
  )
  const breakdownCards = buildItemTypeBreakdownCards(summary, rows, metricKeys)
  const subCards =
    selectedIsItemType || selectedIsComputedMovement
      ? []
      : buildSubCategoryKpiCards(rows, dim, metricKeys, payload.chart ?? [], SUB_KPI_DEFAULT_LIMIT)
  // Computed Movement Actual — always own rail (scope=movement), not sub-category.
  // Force ClosingAmount first so Fast Moving KPI = filtered detail Closing, not live OnHandHold.
  const movementMetricKeys = [
    'ClosingAmount',
    'ClosingQty',
    'TotalItem',
    'MovementIssueCountActual',
    'IssuedTotalAmount',
    ...metricKeys.filter((key) => !['ClosingAmount', 'ClosingQty', 'TotalItem', 'MovementIssueCountActual', 'IssuedTotalAmount'].includes(key)),
  ]
  const MOVEMENT_CATEGORY_HINT: Record<string, string> = {
    'Fast Moving': 'Issue >= 6 dokumen di window · Closing amount bucket',
    Moving: 'Issue 2–5 dokumen di window · Closing amount bucket',
    'Slow Moving': 'Issue tepat 1 dokumen di window · Closing amount bucket',
    'Dead Stock': 'Issue 0 + masih ada ClosingQty · stok idle (bukan kosong)',
    Stale: 'Issue 0 + ClosingQty 0 · kosong/tidak aktif di periode (bukan dead stock)',
  }
  const movementRailCards = buildSubCategoryKpiCards(
    rows,
    'MovementCategory',
    movementMetricKeys,
    payload.chart ?? [],
    SUB_KPI_DEFAULT_LIMIT,
  ).map((card) => {
    const categoryKey = String(card.groupKey ?? card.label ?? '').trim()
    const hint = MOVEMENT_CATEGORY_HINT[categoryKey]
    return {
      ...card,
      scope: 'movement' as const,
      description: hint
        ? `${hint} · full-scope Closing`
        : 'Movement Actual · full-scope Closing by category (period window)',
    }
  })

  // Structure: GLOBAL → ItemType breakdown → stored sub → computed Movement Actual.
  const metricPreview = globalCards
    .filter((card) => card.scope === 'global' && card.label !== 'Actual Period' && card.label !== 'Acc Period')
    .slice(0, 14)

  if (breakdownCards.length > 0 || subCards.length > 0 || movementRailCards.length > 0) {
    return [
      {
        label: 'Global totals',
        value: metricPreview[0]?.value ?? rows.length,
        description: breakdownCards.length
          ? `Grand total summary for Gudang + Workshop. Also shows ${subCards.length} taxonomy groups and ${movementRailCards.length} Movement Category cards.`
          : `${displayColumnLabel(dim ?? 'taxonomy')} grouping summary: ${subCards.length} taxonomy groups and ${movementRailCards.length} Movement Category cards.`,
        tone: 'border-white/10 bg-[#0F2B1A] text-lime-100',
        scope: 'global' as const,
        metrics: metricPreview.map((card) => ({ key: card.label, label: card.label, value: card.value })),
      },
      ...globalCards.slice(0, 14),
      ...breakdownCards,
      ...(subCards.length > 0
        ? [
            {
              label: `Sub · ${displayColumnLabel(dim ?? 'group')}`,
              value: subCards.length,
              description: 'Stored taxonomy grouping such as Product, Brand, Model, Material, or Location. Not Movement Category.',
              tone: 'border-white/10 bg-[#102b1b] text-lime-100',
              scope: 'sub' as const,
              groupField: dim,
            },
            ...subCards,
          ]
        : []),
      ...movementRailCards,
    ]
  }

  return [...globalCards.slice(0, limit), ...movementRailCards]
}

function groupedKpiCards(rows: DbRow[], groupBy?: string, preferred: string[] = [], limit = 6): ReportKpiCard[] {
  return buildSubCategoryKpiCards(rows, resolveGroupDimension(rows, groupBy, preferred), amountKeysForRows(rows).concat(qtyKeysForRows(rows)).slice(0, 4), [], limit)
}

function pickSummaryOnly(summary: DbRow, keys: string[]) {
  for (const key of keys) {
    const raw = summary[key]
    if (raw === undefined || raw === null || raw === '') continue
    return { key, value: raw, source: 'summary' as const }
  }
  return null
}

const FLOW_KPI_SURFACE = 'border-[color:var(--rc-forest-border,rgba(155,226,61,0.18))] bg-white/[0.04] text-white'

const MONTHLY_FLOW_DESCRIPTION: Record<string, string> = {
  opening: 'Opening stock value at start of accounting period. Qty shows opening quantity.',
  received: 'Received amount for selected period. Qty shows received quantity.',
  return_advice: 'Return Advice amount for selected period. Qty shows return-advice quantity.',
  transferred: 'Transfer amount for selected period. Qty shows transferred quantity.',
  adjustment: 'Adjustment amount applied to stock value. Qty shows adjustment quantity.',
  issued_ledger: 'Issue amount without station or vehicle allocation. Qty shows issued quantity.',
  issued_station: 'Issue amount allocated to station/block/cost center. Qty shows issued quantity.',
  issued_vehicle: 'Issue amount allocated to vehicle usage. Qty shows issued quantity.',
  issued_total: 'Total Issue / Total Usage amount: ledger + station + vehicle. Qty shows total issued quantity.',
  purchasing_return: 'Purchasing return amount for selected period. Qty shows returned quantity.',
  purchasing_goods_receive: 'Goods Receive amount for selected period. Qty shows received quantity.',
  purchasing_goods_return: 'Goods Return amount for selected period. Qty shows returned quantity.',
  purchasing_dispatch_advice: 'Dispatch Advice amount for selected period. Qty shows dispatch quantity.',
  closing: 'Closing stock value after issue, receive, return, transfer, and adjustment. Qty shows closing quantity.',
}

const OFFICIAL_MONTHLY_KPI_COLUMNS: Array<{
  key: string
  label: string
  amountField: string
  qtyField: string
  flowSection: string
  sourceTable: string
}> = [
  { key: 'opening', label: 'Opening', amountField: 'OpeningAmount', qtyField: 'OpeningQty', flowSection: 'opening', sourceTable: 'IN_MTHENDITEM' },
  { key: 'received', label: 'Received', amountField: 'ReceivedAmount', qtyField: 'ReceivedQty', flowSection: 'inventory', sourceTable: 'placeholder_zero' },
  { key: 'return_advice', label: 'Return Advice', amountField: 'ReturnAdviceAmount', qtyField: 'ReturnAdviceQty', flowSection: 'inventory', sourceTable: 'placeholder_zero' },
  { key: 'transferred', label: 'Transferred', amountField: 'TransferredAmount', qtyField: 'TransferredQty', flowSection: 'inventory', sourceTable: 'placeholder_zero' },
  { key: 'adjustment', label: 'Adjustment', amountField: 'AdjustmentAmount', qtyField: 'AdjustmentQty', flowSection: 'inventory', sourceTable: 'placeholder_zero' },
  { key: 'issued_ledger', label: 'Issued - Ledger', amountField: 'LedgerAmount', qtyField: 'LedgerQty', flowSection: 'issued', sourceTable: 'IN_STOCKISSUE + IN_FUELISSUE + WS_JOBSTOCK' },
  { key: 'issued_station', label: 'Issued - Station', amountField: 'IssuedStationAmount', qtyField: 'IssuedStationQty', flowSection: 'issued', sourceTable: 'IN_STOCKISSUE + IN_FUELISSUE + WS_JOBSTOCK' },
  { key: 'issued_vehicle', label: 'Issued - Vehicle', amountField: 'IssuedVehicleAmount', qtyField: 'IssuedVehicleQty', flowSection: 'issued', sourceTable: 'IN_STOCKISSUE + IN_FUELISSUE + WS_JOBSTOCK' },
  { key: 'issued_total', label: 'Issued - Total', amountField: 'IssuedTotalAmount', qtyField: 'IssuedTotalQty', flowSection: 'issued', sourceTable: 'ledger + station + vehicle' },
  { key: 'purchasing_return', label: 'Purchasing - Return', amountField: 'ReturnAmount', qtyField: 'ReturnQty', flowSection: 'purchasing', sourceTable: 'WS_JOBSTOCK TransType 2' },
  { key: 'purchasing_goods_receive', label: 'Purchasing - Goods Receive', amountField: 'GoodsReceiveAmount', qtyField: 'GoodsReceiveQty', flowSection: 'purchasing', sourceTable: 'PU_GOODSRCVLN' },
  { key: 'purchasing_goods_return', label: 'Purchasing - Goods Return', amountField: 'GoodsReturnAmount', qtyField: 'GoodsReturnQty', flowSection: 'purchasing', sourceTable: 'PU_GOODSRETLN' },
  { key: 'purchasing_dispatch_advice', label: 'Purchasing - Dispatch Advice', amountField: 'DispatchAdvAmount', qtyField: 'DispatchAdvQty', flowSection: 'purchasing', sourceTable: 'placeholder_zero' },
  { key: 'closing', label: 'Closing', amountField: 'ClosingAmount', qtyField: 'ClosingQty', flowSection: 'closing', sourceTable: 'IN_MTHENDITEM / reconstructed' },
]

function buildOfficialMovementFlowKpis(payload: ReportPayload): ReportKpiCard[] {
  const summary = payload.summary ?? {}
  // GUARDRAIL(flow-kpi-summary-only): page rows = TOP N window — never sum for grand totals.
  const amt = (keys: string[]) => pickSummaryOnly(summary, keys)
  const qty = (keys: string[]) => pickSummaryOnly(summary, keys)

  const ledgerN = toNumber(amt(['LedgerAmount'])?.value)
  const stationN = toNumber(amt(['IssuedStationAmount'])?.value)
  const vehicleN = toNumber(amt(['IssuedVehicleAmount'])?.value)
  const issuedPartsSum = ledgerN + stationN + vehicleN
  const issuedDirect = toNumber(amt(['IssuedTotalAmount'])?.value)
  const issuedTotalValue = issuedDirect > 0 ? issuedDirect : issuedPartsSum > 0 ? issuedPartsSum : issuedDirect

  const cards: ReportKpiCard[] = OFFICIAL_MONTHLY_KPI_COLUMNS.map((col) => {
    const amountRaw = col.key === 'issued_total' ? issuedTotalValue : toNumber(amt([col.amountField])?.value)
    const qtyRaw = toNumber(qty([col.qtyField])?.value)
    return {
      label: col.label,
      value: amountRaw,
      description: MONTHLY_FLOW_DESCRIPTION[col.key] ?? `${col.label} amount in IDR. Qty shows movement quantity.`,
      tone: col.key === 'closing' ? `${FLOW_KPI_SURFACE} ring-1 ring-lime-400/25` : FLOW_KPI_SURFACE,
      scope: 'flow' as const,
      flowSection: col.flowSection,
      sourceTable: col.sourceTable,
      sourceField: col.amountField,
      metrics: [
        { key: col.amountField, label: 'Amount', value: amountRaw, sourceTable: col.sourceTable, sourceField: col.amountField },
        { key: col.qtyField, label: 'Qty', value: qtyRaw, sourceTable: col.sourceTable, sourceField: col.qtyField },
      ],
    }
  })

  const itemCount = toNumber(amt(['TotalItem', 'FilteredRows', 'TotalRows'])?.value)
  cards.push({
    label: 'Jumlah Item',
    value: itemCount,
    description: 'Item count in selected inventory scope. Count uses server summary, not visible page rows.',
    tone: FLOW_KPI_SURFACE,
    scope: 'flow',
    flowSection: 'count',
    sourceTable: 'summary',
    sourceField: 'TotalItem',
    metrics: [{ key: 'TotalItem', label: 'Item', value: itemCount, sourceField: 'TotalItem' }],
  })

  return cards
}

export function monthlyStockMovementKpis(payload: ReportPayload, filters?: ReportFilterInput, tableGroupField?: string): ReportKpiCard[] {
  // Primary = official 14 columns only. Secondary group breakdown uses ProductTypeCode default.
  const flowCards = buildOfficialMovementFlowKpis(payload)
  const groupField = tableGroupField ?? filters?.groupBy ?? filters?.chartDimension ?? 'ProductTypeCode'
  const rest = buildDynamicGrandTotalKpis(
    payload,
    {
      ...filters,
      groupBy: groupField === 'StockAnalysisCode' ? 'ProductTypeCode' : groupField,
      chartDimension: groupField === 'StockAnalysisCode' ? 'ProductTypeCode' : groupField,
      stockAnalysis: undefined,
      category: undefined,
    },
    [
      'ClosingAmount',
      'OpeningAmount',
      'ReceivedAmount',
      'ReturnAdviceAmount',
      'TransferredAmount',
      'AdjustmentAmount',
      'LedgerAmount',
      'IssuedTotalAmount',
      'IssuedStationAmount',
      'IssuedVehicleAmount',
      'GoodsReceiveAmount',
      'GoodsReturnAmount',
      'DispatchAdvAmount',
      'ReturnAmount',
      'ClosingQty',
      'OpeningQty',
      'TotalItem',
    ],
    20,
    groupField === 'StockAnalysisCode' ? 'ProductTypeCode' : groupField,
  )
  const withoutDuplicateGlobals = rest.filter((card) => {
    if (card.scope === 'flow') return false
    if (card.scope !== 'global') return true
    const label = card.label.toLowerCase()
    return !/(opening|closing|issued|ledger|station|vehicle|received|return advice|transfer|adjustment|goods receive|goods return|dispatch|return amount)/i.test(
      label,
    )
  })
  return [...flowCards, ...withoutDuplicateGlobals]
}

