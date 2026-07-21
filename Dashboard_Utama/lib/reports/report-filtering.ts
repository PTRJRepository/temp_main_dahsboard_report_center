import type { ReportFilterAction } from './report-experience'

export type DbRow = Record<string, unknown>

export type ReportColumnType = 'string' | 'number' | 'date' | 'boolean'
export type ReportAggregateFn = 'sum' | 'count' | 'avg' | 'min' | 'max'

export type ReportColumnOperator =
  | 'contains'
  | 'equals'
  | 'notEquals'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'blank'
  | 'notBlank'

export type ReportColumnFilter = {
  field: string
  operator: ReportColumnOperator
  value?: string | number
  valueTo?: string | number
}

export type ReportColumnSchema = {
  field: string
  label: string
  type: ReportColumnType
  filterable: true
  sortable: true
  aggregatable: boolean
  operators: ReportColumnOperator[]
}

export type ReportSchema = {
  reportCode?: string
  reportName?: string
  module?: string
  columns: ReportColumnSchema[]
}

export type ReportFilterInput = {
  search?: string
  period?: string
  accYear?: number
  accMonth?: number
  actualYear?: number
  actualMonth?: number
  dateFrom?: string
  dateTo?: string
  location?: string
  category?: string
  supplier?: string
  status?: string
  vehicle?: string
  itemType?: string
  includeWorkshopItem?: string
  productType?: string
  productCategory?: string
  productBrand?: string
  productModel?: string
  productMaterial?: string
  movementCategory?: string
  /** Movement Category issue-count window: all | 1m | 3m | 6m | 12m | custom */
  movementWindow?: string
  /** Dynamic Movement Category issue-count definition. Default: Fast >= 6, Moving 2-5, Slow = 1. */
  movementFastMin?: number
  movementMovingMin?: number
  movementMovingMax?: number
  movementSlowCount?: number
  stockAnalysis?: string
  blankField?: string
  minQty?: number
  minAmount?: number
  sortMetric?: 'amount' | 'qty' | 'date' | 'rows'
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
  chartDimension?: string
  groupBy?: string
  aggregateField?: string
  aggregateFn?: ReportAggregateFn
  top?: number
  resultLimit?: number
  rowStart?: number
  rowEnd?: number
  stale?: string
  analysis?: 'ranking' | 'compare' | 'anomaly' | 'quality' | 'trend'
  columnFilters?: ReportColumnFilter[]
  naturalQuery?: string
}

export type ReadOnlyValidation = {
  safe: boolean
  reason?: string
  blockedTerms?: string[]
  valid?: boolean
  error?: string
}

type FilterablePayload = {
  rows: DbRow[]
  columns: string[]
  summary: DbRow
  chart?: DbRow[]
  metadata: DbRow
}

const textFields = [
  'Dokumen',
  'DokumenFuel',
  'DokumenPR',
  'DokumenReturn',
  'DokumenTransfer',
  'GoodsReceiveID',
  'GoodsReceiveLineID',
  'ReferenceNo',
  'DocumentNo',
  'POID',
  'POLineID',
  'ItemCode',
  'ItemDescription',
  'KodeBarang',
  'NamaBarang',
  'KodeFuel',
  'NamaFuel',
  'NamaPupuk',
  'Location',
  'Gudang',
  'GudangAsal',
  'GudangTujuan',
  'Lokasi',
  'VehicleCode',
  'Kendaraan',
  'NamaKendaraan',
  'Blok',
  'BlkCode',
  'AccCode',
  'ChartOfAccountCode',
  'ChargeTo',
  'ProductTypeCode',
  'ProductTypeDescription',
  'Kategori',
  'KodeKategori',
  'SupplierCode',
  'SupplierName',
  'Status',
  'StatusSupplier',
  'StatusKendaraan',
  'acc_year',
  'acc_month',
  'accounting_period',
  'actual_year',
  'actual_month',
  'actual_period',
  'period_data_source',
  'product_type_code',
  'product_type_description',
]

const dateFields = [
  'Tanggal',
  'PostDate',
  'DocDate',
  'CreateDate',
  'ReferenceDate',
  'GoodsRcvRefDate',
  'ActualPeriodStart',
  'PRDate',
  'PODate',
  'TerakhirUpdate',
  'LastIssueDate',
  'LastReturnDate',
  'LastTransferDate',
  'LastPODate',
  'LastUsageDate',
  'LastWorkshopDate',
  'SupplierUpdateDate',
  'UpdateDate',
]

const fieldAliases: Record<string, string[]> = {
  search: textFields,
  location: ['Gudang', 'GudangAsal', 'GudangTujuan', 'Lokasi', 'Location', 'Blok', 'BlkCode', 'FieldNoCode', 'Route'],
  category: ['Kategori', 'KodeKategori', 'MovementCategory', 'StaleMovementRelation', 'KodeFuel', 'NamaFuel', 'KodeBarang', 'NamaBarang', 'NamaPupuk', 'ItemCode', 'ItemDescription', 'ProductTypeCode', 'ProductTypeDescription', 'product_type_code', 'product_type_description', 'TipeDokumen', 'JenisMutasi', 'SourceDocType'],
  supplier: ['SupplierCode', 'SupplierName', 'LastSupplierCode', 'LastSupplierName'],
  status: ['Status', 'StatusBarang', 'StatusSupplier', 'StatusKendaraan'],
  vehicle: ['Kendaraan', 'VehCode', 'VehicleCode', 'NamaKendaraan'],
  productType: ['ProductTypeCode', 'ProductTypeDescription', 'ProdTypeCode', 'product_type_code', 'product_type_description'],
  productCategory: ['ProductCategoryCode', 'ProductCategoryDescription', 'ProdCatCode', 'KodeKategori', 'Kategori', 'product_category_code'],
  productBrand: ['ProductBrandCode', 'ProdBrandCode', 'product_brand_code'],
  productModel: ['ProductModelCode', 'ProdModelCode', 'product_model_code'],
  productMaterial: ['ProductMaterialCode', 'ProdMatCode', 'product_material_code'],
  stockAnalysis: ['StockAnalysisCode', 'StockAnalysisDescription', 'AnalysisCode', 'stock_analysis_code'],
  amount: ['Amount', 'amount', 'total_amount', 'unit_cost', 'AmountCurrent', 'TotalAmount', 'NilaiFuel', 'NilaiStok', 'NilaiPersediaan', 'NilaiKeluar', 'NilaiMasuk', 'NilaiTransfer', 'NilaiReturn', 'NilaiPR', 'POAmount', 'WorkshopAmount', 'UsageAmount', 'StockIssueAmountAllPeriod', 'MovementAmountAll', 'OutstandingInvoice', 'LastPOAmount', 'Cost', 'UnitCost', 'AverageCost', 'HargaSatuan'],
  qty: ['Qty', 'qty', 'Quantity', 'quantity_on_hand', 'quantity_on_hold', 'total_quantity', 'ItemCurrent', 'QuantityClosing', 'MovementGapQty', 'StockIssueQtyAllPeriod', 'MovementQtyAll', 'MovementEventCountAll', 'QtyFuel', 'TotalQtyFuel', 'QtyTransfer', 'QtyReturn', 'QtyOutstanding', 'TotalQty', 'TotalStok', 'StokAkhir', 'TotalUsageUnit', 'UsageUnit', 'WorkshopQty', 'QtyOrder', 'QtyReceive'],
  date: dateFields,
}

const blankFieldAliases: Record<string, string[]> = {
  vehcode: ['VehCode', 'Kendaraan'],
  kendaraan: ['Kendaraan', 'VehCode'],
  blkcode: ['BlkCode', 'Blok'],
  blok: ['Blok', 'BlkCode'],
  acccode: ['AccCode'],
  loccode: ['Gudang', 'Lokasi'],
  gudang: ['Gudang', 'Lokasi'],
  supplier: ['SupplierCode', 'SupplierName'],
  suppliercode: ['SupplierCode'],
  status: ['Status', 'StatusBarang', 'StatusSupplier', 'StatusKendaraan'],
}

const monthIndex: Record<string, number> = {
  januari: 0,
  january: 0,
  jan: 0,
  februari: 1,
  february: 1,
  feb: 1,
  maret: 2,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  mei: 4,
  may: 4,
  juni: 5,
  june: 5,
  jun: 5,
  juli: 6,
  july: 6,
  jul: 6,
  agustus: 7,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  oktober: 9,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  desember: 11,
  december: 11,
  dec: 11,
}

const sqlWritePattern =
  /\b(insert|update|delete|drop|alter|truncate|merge|exec|execute|create|grant|revoke|deny|backup|restore|dbcc|use|kill|waitfor|openrowset|openquery|bulk|xp_[a-z0-9_]+|sp_[a-z0-9_]+)\b/i

const naturalWritePatterns = [
  /\b(insert|delete|drop|alter|truncate|merge|exec|execute|grant|revoke)\b/i,
  /\bupdate\s+(set|table|database|db|schema|data|record|row|ke|jadi|menjadi)\b/i,
  /\b(create|buat)\s+(index|table|tabel|schema|procedure|view)\b/i,
  /\b(hapus|menghapus|delete|ubah|mengubah|ganti|mengganti|tambah|menambah|simpan|menyimpan)\s+(data|row|record|tabel|table|schema|database|db)\b/i,
  /\b(jalankan|run|execute|exec)\s+(procedure|stored procedure|sp_|xp_)\b/i,
]

export const readOnlyQuerySafety = {
  mode: 'READ_ONLY_STATIC_SELECT',
  blockedOperations: ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'MERGE', 'EXEC'],
  limit: '5-500 rows per request',
}

function stripSqlForValidation(sql: string) {
  return sql
    .replace(/'([^']|'')*'/g, "''")
    .replace(/--.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function validateReadOnlySql(sql: string): ReadOnlyValidation {
  const normalized = stripSqlForValidation(sql)

  if (!/^(select|with)\b/i.test(normalized)) {
    const reason = 'Query report harus diawali SELECT atau WITH.'
    return { safe: false, valid: false, reason, error: reason }
  }

  const blockedTerms = normalized.match(sqlWritePattern)?.map((item) => item.toUpperCase()) ?? []
  if (blockedTerms.length > 0) {
    const reason = `Operasi non-read diblokir: ${[...new Set(blockedTerms)].join(', ')}.`
    return {
      safe: false,
      valid: false,
      reason,
      error: reason,
      blockedTerms: [...new Set(blockedTerms)],
    }
  }

  if (/\bselect\b[\s\S]*\binto\b/i.test(normalized)) {
    const reason = 'SELECT INTO diblokir karena membuat objek baru.'
    return { safe: false, valid: false, reason, error: reason }
  }

  return { safe: true, valid: true }
}

export function validateNaturalLanguageReadOnly(query: string): ReadOnlyValidation {
  const blockedTerms = naturalWritePatterns
    .filter((pattern) => pattern.test(query))
    .map((pattern) => pattern.source)

  if (blockedTerms.length > 0) {
    return {
      safe: false,
      reason: 'Permintaan ditolak karena mengandung instruksi non-read.',
      blockedTerms,
    }
  }

  return { safe: true }
}

function sanitizeLike(value: string) {
  return value.replace(/'/g, "''").replace(/%/g, '').trim()
}

export function textSearch(search: string, fields: string[]) {
  if (!search?.trim()) return ''
  const term = `%${sanitizeLike(search)}%`
  return `AND (${fields.map((field) => `CONVERT(nvarchar, ${field}) LIKE '${term}'`).join(' OR ')})`
}

export function cleanLocationCode(value?: string | null) {
  const code = (value ?? '').trim().toUpperCase()
  return code.length === 4 ? code : 'PTRJ'
}

const STOCK_ACCOUNT_MOVEMENT_ANALYSIS_CODES = ['DEADS', 'MEMOV', 'SLMOV', 'FAMOV', 'NOMOV']

export function cleanStockAccountMovementAnalysisCode(value?: string | null) {
  const code = sanitizeLike(value ?? '').trim().toUpperCase()
  return STOCK_ACCOUNT_MOVEMENT_ANALYSIS_CODES.includes(code) ? code : ''
}

function cleanText(value: unknown, max = 80) {
  if (value === null || value === undefined) return undefined
  const text = String(value).trim().replace(/\s+/g, ' ').slice(0, max)
  return text || undefined
}

function includeWorkshopItemToItemType(value: unknown) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['no', 'n', 'false', '0', 'tidak', 'exclude', 'without', 'tanpa'].includes(normalized)) return 'gudang'
  return undefined
}

function cleanNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(numeric) ? numeric : undefined
}

function parseHumanNumber(value: string) {
  const normalized = value.trim().toLowerCase().replace(',', '.')
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(?:\s*(juta|jt|miliar|milyar|ribu|rb|k|m))?/)
  if (!match?.[1]) return undefined

  const base = Number(match[1])
  if (!Number.isFinite(base)) return undefined

  const unit = match[2]
  if (unit === 'juta' || unit === 'jt' || unit === 'm') return base * 1_000_000
  if (unit === 'miliar' || unit === 'milyar') return base * 1_000_000_000
  if (unit === 'ribu' || unit === 'rb' || unit === 'k') return base * 1_000
  return base
}

function cleanDirection(value: unknown) {
  return value === 'asc' || value === 'desc' ? value : undefined
}

function cleanMetric(value: unknown) {
  return value === 'amount' || value === 'qty' || value === 'date' || value === 'rows' ? value : undefined
}

function cleanAggregateFn(value: unknown): ReportAggregateFn | undefined {
  return value === 'sum' || value === 'count' || value === 'avg' || value === 'min' || value === 'max' ? value : undefined
}

function cleanAnalysis(value: unknown) {
  return value === 'ranking' || value === 'compare' || value === 'anomaly' || value === 'quality' || value === 'trend'
    ? value
    : undefined
}

function cleanOperator(value: unknown): ReportColumnOperator | undefined {
  return value === 'contains' ||
    value === 'equals' ||
    value === 'notEquals' ||
    value === 'gt' ||
    value === 'gte' ||
    value === 'lt' ||
    value === 'lte' ||
    value === 'between' ||
    value === 'blank' ||
    value === 'notBlank'
    ? value
    : undefined
}

function cleanColumnFilters(value: unknown): ReportColumnFilter[] | undefined {
  let source = value
  if (typeof source === 'string' && source.trim()) {
    try {
      source = JSON.parse(source) as unknown
    } catch {
      return undefined
    }
  }

  if (!Array.isArray(source)) return undefined

  const filters = source
    .map((item): ReportColumnFilter | null => {
      if (!item || typeof item !== 'object') return null
      const entry = item as Record<string, unknown>
      const field = cleanText(entry.field, 80)
      const operator = cleanOperator(entry.operator)
      if (!field || !operator) return null

      const value = typeof entry.value === 'number' ? cleanNumber(entry.value) : cleanText(entry.value, 120)
      const valueTo = typeof entry.valueTo === 'number' ? cleanNumber(entry.valueTo) : cleanText(entry.valueTo, 120)
      return {
        field,
        operator,
        value,
        valueTo,
      }
    })
    .filter((item): item is ReportColumnFilter => Boolean(item))

  return filters.length ? filters.slice(0, 5) : undefined
}

function cleanPositiveInt(value: unknown, min: number, max: number) {
  const numeric = cleanNumber(value)
  if (numeric === undefined) return undefined
  return Math.min(Math.max(Math.trunc(numeric), min), max)
}

export function normalizeReportFilters(input: Partial<Record<keyof ReportFilterInput, unknown>>): ReportFilterInput {
  const top = cleanNumber(input.top)
  const includeWorkshopItem = cleanText(input.includeWorkshopItem, 16)
  const itemType = cleanText(input.itemType) ?? includeWorkshopItemToItemType(includeWorkshopItem)
  return {
    search: cleanText(input.search),
    period: cleanText(input.period, 16),
    accYear: cleanPositiveInt(input.accYear, 1, 9999),
    accMonth: cleanPositiveInt(input.accMonth, 1, 12),
    actualYear: cleanPositiveInt(input.actualYear, 1, 9999),
    actualMonth: cleanPositiveInt(input.actualMonth, 1, 12),
    dateFrom: cleanText(input.dateFrom, 32),
    dateTo: cleanText(input.dateTo, 32),
    location: cleanText(input.location),
    category: cleanText(input.category),
    supplier: cleanText(input.supplier),
    status: cleanText(input.status),
    vehicle: cleanText(input.vehicle),
    itemType,
    includeWorkshopItem,
    productType: cleanText(input.productType, 80),
    productCategory: cleanText(input.productCategory, 80),
    productBrand: cleanText(input.productBrand, 80),
    productModel: cleanText(input.productModel, 80),
    productMaterial: cleanText(input.productMaterial, 80),
    movementCategory: cleanText(input.movementCategory, 80),
    movementWindow: cleanText(input.movementWindow, 16),
    movementFastMin: cleanPositiveInt(input.movementFastMin, 1, 999),
    movementMovingMin: cleanPositiveInt(input.movementMovingMin, 1, 999),
    movementMovingMax: cleanPositiveInt(input.movementMovingMax, 1, 999),
    movementSlowCount: cleanPositiveInt(input.movementSlowCount, 1, 999),
    stockAnalysis: cleanText(input.stockAnalysis, 80),
    blankField: cleanText(input.blankField),
    minQty: cleanNumber(input.minQty),
    minAmount: cleanNumber(input.minAmount),
    sortMetric: cleanMetric(input.sortMetric),
    sortColumn: cleanText(input.sortColumn),
    sortDirection: cleanDirection(input.sortDirection),
    chartDimension: cleanText(input.chartDimension),
    groupBy: cleanText(input.groupBy),
    aggregateField: cleanText(input.aggregateField),
    aggregateFn: cleanAggregateFn(input.aggregateFn),
    top: top === undefined ? undefined : Math.min(Math.max(Math.trunc(top), 1), 50),
    resultLimit: cleanPositiveInt(input.resultLimit, 1, 500),
    rowStart: cleanPositiveInt(input.rowStart, 1, 500),
    rowEnd: cleanPositiveInt(input.rowEnd, 1, 500),
    stale: cleanText(input.stale, 80),
    analysis: cleanAnalysis(input.analysis),
    columnFilters: cleanColumnFilters(input.columnFilters),
    naturalQuery: cleanText(input.naturalQuery, 240),
  }
}

const inventoryAnalysisGroupScopeKeys = {
  StockAnalysisCode: ['stockAnalysis', 'category'],
  ProductTypeCode: ['productType'],
  ProductCategoryCode: ['productCategory'],
  ProductBrandCode: ['productBrand'],
  ProductModelCode: ['productModel'],
  ProductMaterialCode: ['productMaterial'],
  MovementCategory: ['movementCategory'],
} as const

type InventoryAnalysisGroupKey = keyof typeof inventoryAnalysisGroupScopeKeys

function normalizeInventoryAnalysisGroup(value?: string) {
  const normalized = String(value ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase()
  // StockAnalysisCode removed from monthly — map legacy to ProductTypeCode.
  if (normalized === 'stockanalysiscode' || normalized === 'stockanalysisname') {
    return 'ProductTypeCode' as InventoryAnalysisGroupKey
  }
  const match = (Object.keys(inventoryAnalysisGroupScopeKeys) as InventoryAnalysisGroupKey[])
    .find((key) => key.replace(/[^a-z0-9]/gi, '').toLowerCase() === normalized)
  return match
}

export function normalizeInventoryAnalysisGroupFilters(filters: ReportFilterInput): ReportFilterInput {
  const analysisGroup = normalizeInventoryAnalysisGroup(filters.groupBy ?? filters.chartDimension)
  if (!analysisGroup) {
    // Always strip SA codes from monthly filter state.
    const stripped: ReportFilterInput = { ...filters }
    delete stripped.stockAnalysis
    delete stripped.category
    return normalizeReportFilters(stripped)
  }

  const next: ReportFilterInput = {
    ...filters,
    groupBy: analysisGroup,
    chartDimension: analysisGroup,
  }

  // Stock Analysis Code removed — always clear SA filters.
  delete next.stockAnalysis
  delete next.category
  if (analysisGroup !== 'ProductTypeCode') delete next.productType
  if (analysisGroup !== 'ProductCategoryCode') delete next.productCategory
  if (analysisGroup !== 'ProductBrandCode') delete next.productBrand
  if (analysisGroup !== 'ProductModelCode') delete next.productModel
  if (analysisGroup !== 'ProductMaterialCode') delete next.productMaterial
  if (analysisGroup !== 'MovementCategory') delete next.movementCategory

  return normalizeReportFilters(next)
}

export function filtersFromSearchParams(params: { get(name: string): string | null }): ReportFilterInput {
  return normalizeReportFilters({
    search: params.get('search') ?? undefined,
    period: params.get('period') ?? undefined,
    accYear: params.get('accYear') ?? undefined,
    accMonth: params.get('accMonth') ?? undefined,
    actualYear: params.get('actualYear') ?? undefined,
    actualMonth: params.get('actualMonth') ?? undefined,
    dateFrom: params.get('dateFrom') ?? undefined,
    dateTo: params.get('dateTo') ?? undefined,
    location: params.get('location') ?? undefined,
    category: params.get('category') ?? undefined,
    supplier: params.get('supplier') ?? undefined,
    status: params.get('status') ?? undefined,
    vehicle: params.get('vehicle') ?? undefined,
    itemType: params.get('itemType') ?? undefined,
    includeWorkshopItem: params.get('includeWorkshopItem') ?? params.get('include_workshop_item') ?? undefined,
    productType: params.get('productType') ?? params.get('productTypeCode') ?? params.get('prodTypeCode') ?? params.get('ProdTypeCode') ?? undefined,
    productCategory: params.get('productCategory') ?? params.get('productCategoryCode') ?? params.get('prodCatCode') ?? params.get('ProdCatCode') ?? undefined,
    productBrand: params.get('productBrand') ?? params.get('productBrandCode') ?? params.get('prodBrandCode') ?? params.get('ProdBrandCode') ?? undefined,
    productModel: params.get('productModel') ?? params.get('productModelCode') ?? params.get('prodModelCode') ?? params.get('ProdModelCode') ?? undefined,
    productMaterial: params.get('productMaterial') ?? params.get('productMaterialCode') ?? params.get('prodMatCode') ?? params.get('ProdMatCode') ?? undefined,
    movementCategory: params.get('movementCategory') ?? undefined,
    movementWindow: params.get('movementWindow') ?? undefined,
    movementFastMin: params.get('movementFastMin') ?? undefined,
    movementMovingMin: params.get('movementMovingMin') ?? undefined,
    movementMovingMax: params.get('movementMovingMax') ?? undefined,
    movementSlowCount: params.get('movementSlowCount') ?? undefined,
    stockAnalysis: params.get('stockAnalysis') ?? undefined,
    blankField: params.get('blankField') ?? undefined,
    minQty: params.get('minQty') ?? undefined,
    minAmount: params.get('minAmount') ?? undefined,
    sortMetric: params.get('sortMetric') ?? undefined,
    sortColumn: params.get('sortColumn') ?? undefined,
    sortDirection: params.get('sortDirection') ?? undefined,
    chartDimension: params.get('chartDimension') ?? params.get('analysisDimension') ?? undefined,
    groupBy: params.get('groupBy') ?? params.get('analysisGroup') ?? params.get('analysis_group') ?? undefined,
    aggregateField: params.get('aggregateField') ?? undefined,
    aggregateFn: params.get('aggregateFn') ?? undefined,
    top: params.get('top') ?? undefined,
    resultLimit: params.get('resultLimit') ?? undefined,
    rowStart: params.get('rowStart') ?? undefined,
    rowEnd: params.get('rowEnd') ?? undefined,
    stale: params.get('stale') ?? undefined,
    analysis: params.get('analysis') ?? undefined,
    columnFilters: params.get('columnFilters') ?? undefined,
    naturalQuery: params.get('natural') ?? params.get('naturalQuery') ?? undefined,
  })
}

export function activeFiltersToRecord(filters: ReportFilterInput) {
  const active: Record<string, string | number | ReportColumnFilter[]> = {}
  Object.entries(filters).forEach(([key, value]) => {
    if (key === 'naturalQuery') return
    if (key === 'stale') return
    if (Array.isArray(value)) {
      if (value.length > 0) active[key] = value as ReportColumnFilter[]
    } else if (value !== undefined && value !== null && value !== '') {
      active[key] = value as string | number
    }
  })
  return active
}

function summaryAffectingFiltersToRecord(filters: ReportFilterInput) {
  const active: Record<string, string | number | ReportColumnFilter[]> = {}
  Object.entries(filters).forEach(([key, value]) => {
    if (key === 'naturalQuery') return
    if (key === 'stale') return
    if (
      key === 'sortMetric' ||
      key === 'sortColumn' ||
      key === 'sortDirection' ||
      key === 'chartDimension' ||
      key === 'groupBy' ||
      key === 'aggregateField' ||
      key === 'aggregateFn' ||
      key === 'top' ||
      key === 'resultLimit' ||
      key === 'rowStart' ||
      key === 'rowEnd' ||
      key === 'analysis'
    ) return

    if (Array.isArray(value)) {
      if (value.length > 0) active[key] = value as ReportColumnFilter[]
    } else if (value !== undefined && value !== null && value !== '') {
      active[key] = value as string | number
    }
  })
  return active
}

export function hasActiveReportFilters(filters: ReportFilterInput) {
  return Object.keys(activeFiltersToRecord(filters)).length > 0
}

function filterActionValue(value: ReportFilterAction['value']): string | number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'boolean') return String(value)
  return value
}

function filterActionColumnFilter(action: ReportFilterAction): ReportColumnFilter | undefined {
  if (!action.field) return undefined
  return {
    field: action.field,
    operator: action.operator ?? 'equals',
    value: filterActionValue(action.value),
    valueTo: filterActionValue(action.valueTo),
  }
}

export function filtersFromReportFilterAction(action: ReportFilterAction): ReportFilterInput {
  if (action.type === 'clear-filter') return normalizeReportFilters({})

  const value = filterActionValue(action.value)
  const valueText = value === undefined ? undefined : String(value)

  if (action.type === 'set-group') {
    return normalizeReportFilters({
      groupBy: action.field ?? valueText,
    })
  }

  if (action.type === 'open-detail') {
    return normalizeReportFilters({
      resultLimit: typeof value === 'number' ? value : undefined,
    })
  }

  const columnFilter = filterActionColumnFilter(action)

  // GUARDRAIL(report-analysis-group-action):
  // Semantic breakdown clicks must carry the matching groupBy/chartDimension
  // so KPI cards, table group totals, export, and AI evidence stay aligned.
  if (action.semanticDimensionId === 'movement-category') {
    return normalizeReportFilters({
      movementCategory: valueText,
      groupBy: 'MovementCategory',
      chartDimension: 'MovementCategory',
    })
  }

  if (action.semanticDimensionId === 'stock-analysis') {
    return normalizeReportFilters({
      stockAnalysis: columnFilter ? undefined : valueText,
      columnFilters: columnFilter ? [columnFilter] : undefined,
      groupBy: 'StockAnalysisCode',
      chartDimension: 'StockAnalysisCode',
    })
  }

  if (action.semanticDimensionId === 'location') {
    return normalizeReportFilters({
      location: valueText,
      groupBy: 'Location',
      chartDimension: 'Location',
    })
  }

  if (action.semanticDimensionId === 'product-type') {
    return normalizeReportFilters({
      productType: columnFilter ? undefined : valueText,
      columnFilters: columnFilter ? [columnFilter] : undefined,
      groupBy: 'ProductTypeCode',
      chartDimension: 'ProductTypeCode',
    })
  }

  if (action.semanticDimensionId === 'product-category') {
    return normalizeReportFilters({
      productCategory: columnFilter ? undefined : valueText,
      columnFilters: columnFilter ? [columnFilter] : undefined,
      groupBy: 'ProductCategoryCode',
      chartDimension: 'ProductCategoryCode',
    })
  }

  if (action.semanticDimensionId === 'product-brand') {
    return normalizeReportFilters({
      productBrand: columnFilter ? undefined : valueText,
      columnFilters: columnFilter ? [columnFilter] : undefined,
      groupBy: 'ProductBrandCode',
      chartDimension: 'ProductBrandCode',
    })
  }

  if (action.semanticDimensionId === 'product-model') {
    return normalizeReportFilters({
      productModel: columnFilter ? undefined : valueText,
      columnFilters: columnFilter ? [columnFilter] : undefined,
      groupBy: 'ProductModelCode',
      chartDimension: 'ProductModelCode',
    })
  }

  if (action.semanticDimensionId === 'product-material') {
    return normalizeReportFilters({
      productMaterial: columnFilter ? undefined : valueText,
      columnFilters: columnFilter ? [columnFilter] : undefined,
      groupBy: 'ProductMaterialCode',
      chartDimension: 'ProductMaterialCode',
    })
  }

  if (columnFilter) {
    return normalizeReportFilters({ columnFilters: [columnFilter] })
  }

  return normalizeReportFilters({ search: valueText })
}

function isDateLikeKey(key: string) {
  return /date|tanggal|periode|period|update|time/i.test(key)
}

function inferColumnType(field: string, rows: DbRow[]): ReportColumnType {
  const values = rows
    .slice(0, 25)
    .map((row) => row[field])
    .filter((value) => value !== null && value !== undefined && value !== '')

  if (values.some((value) => typeof value === 'boolean')) return 'boolean'
  if (values.length > 0 && values.every((value) => strictNumber(value) !== null)) return 'number'
  if ((isDateLikeKey(field) || values.some((value) => typeof value === 'string')) && values.length > 0) {
    const dateLikeCount = values.filter((value) => parseDate(value)).length
    if (dateLikeCount >= Math.ceil(values.length * 0.6)) return 'date'
  }
  return 'string'
}

function operatorsForType(type: ReportColumnType): ReportColumnOperator[] {
  if (type === 'number' || type === 'date') return ['equals', 'gt', 'gte', 'lt', 'lte', 'between', 'blank', 'notBlank']
  if (type === 'boolean') return ['equals', 'notEquals', 'blank', 'notBlank']
  return ['contains', 'equals', 'notEquals', 'blank', 'notBlank']
}

function humanizeColumnLabel(field: string) {
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
}

export function inferReportSchema(payload: FilterablePayload): ReportSchema {
  const metadata = payload.metadata ?? {}
  const columns = payload.columns.length > 0 ? payload.columns : payload.rows[0] ? Object.keys(payload.rows[0]) : []

  return {
    reportCode: String(metadata.reportCode ?? metadata.reportId ?? ''),
    reportName: String(metadata.reportName ?? metadata.title ?? ''),
    module: String(metadata.module ?? metadata.moduleName ?? ''),
    columns: columns.map((field) => {
      const type = inferColumnType(field, payload.rows)
      return {
        field,
        label: humanizeColumnLabel(field),
        type,
        filterable: true,
        sortable: true,
        aggregatable: type === 'number',
        operators: operatorsForType(type),
      }
    }),
  }
}

function schemaField(schema: ReportSchema, field?: string) {
  if (!field) return undefined
  const normalizedField = normalizeColumnToken(field)
  return schema.columns.find((column) => {
    const normalizedColumn = normalizeColumnToken(column.field)
    const normalizedLabel = normalizeColumnToken(column.label)
    return normalizedColumn === normalizedField || normalizedLabel === normalizedField
  })
}

function sanitizeColumnFiltersForSchema(filters: ReportColumnFilter[] | undefined, schema: ReportSchema) {
  if (!filters?.length) return { filters: undefined, rejected: [] as ReportColumnFilter[] }

  const accepted: ReportColumnFilter[] = []
  const rejected: ReportColumnFilter[] = []

  filters.forEach((filter) => {
    const column = schemaField(schema, filter.field)
    if (!column || !column.filterable || !column.operators.includes(filter.operator)) {
      rejected.push(filter)
      return
    }

    accepted.push({
      ...filter,
      field: column.field,
    })
  })

  return {
    filters: accepted.length ? accepted : undefined,
    rejected,
  }
}

function sanitizeFiltersForSchema(filters: ReportFilterInput, schema: ReportSchema) {
  const columnFilters = sanitizeColumnFiltersForSchema(filters.columnFilters, schema)
  const sortColumn = schemaField(schema, filters.sortColumn)?.field
  const chartDimension = schemaField(schema, filters.chartDimension)?.field
  const groupBy = schemaField(schema, filters.groupBy ?? filters.chartDimension)?.field
  const aggregateColumn = schemaField(schema, filters.aggregateField)
  const blankField = schemaField(schema, filters.blankField)?.field
  const aggregateFn = aggregateColumn?.aggregatable || filters.aggregateFn === 'count' ? filters.aggregateFn : undefined

  return {
    filters: {
      ...filters,
      columnFilters: columnFilters.filters,
      sortColumn,
      chartDimension,
      groupBy,
      aggregateField: aggregateColumn?.aggregatable ? aggregateColumn.field : undefined,
      aggregateFn,
      blankField,
    },
    rejectedColumnFilters: columnFilters.rejected,
  }
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const numeric = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(numeric) ? numeric : 0
  }
  return 0
}

function parseDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function rowDate(row: DbRow) {
  for (const key of dateFields) {
    const date = parseDate(row[key])
    if (date) return date
  }
  return null
}

function resolveFields(row: DbRow, fieldNames: string[]) {
  const normalized = new Map(Object.keys(row).map((key) => [key.toLowerCase(), key]))
  return fieldNames
    .map((field) => normalized.get(field.toLowerCase()))
    .filter((field): field is string => Boolean(field))
}

function rowContains(row: DbRow, fieldNames: string[], needle?: string) {
  if (!needle) return true
  const fields = resolveFields(row, fieldNames)
  const haystacks = fields.length > 0 ? fields.map((field) => row[field]) : Object.values(row)
  return haystacks.some((value) => normalizeText(value).includes(needle.toLowerCase()))
}

function fieldIsBlank(row: DbRow, fieldName: string) {
  const normalizedName = fieldName.replace(/[^a-z0-9]/gi, '').toLowerCase()
  const aliases = blankFieldAliases[normalizedName] ?? [fieldName]
  const fields = resolveFields(row, aliases)
  if (fields.length === 0) return false
  return fields.some((field) => {
    const value = row[field]
    return value === null || value === undefined || String(value).trim() === '' || String(value).trim() === '-'
  })
}

function resolveSingleField(row: DbRow, fieldName: string) {
  return resolveFields(row, [fieldName])[0]
}

function strictNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\s*-?\d+(?:[.,]\d+)?\s*$/.test(value)) {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function compareValue(value: unknown, expected: unknown) {
  const valueDate = parseDate(value)
  const expectedDate = parseDate(expected)
  if (valueDate && expectedDate) return valueDate.getTime() - expectedDate.getTime()

  const numericValue = strictNumber(value)
  const numericExpected = strictNumber(expected)
  if (numericValue !== null && numericExpected !== null) return numericValue - numericExpected

  return normalizeText(value).localeCompare(normalizeText(expected), 'id-ID', { numeric: true })
}

function columnFilterPasses(row: DbRow, filter: ReportColumnFilter) {
  const field = resolveSingleField(row, filter.field)
  if (!field) return false

  const value = row[field]
  if (filter.operator === 'blank') return value === null || value === undefined || String(value).trim() === '' || String(value).trim() === '-'
  if (filter.operator === 'notBlank') return value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '-'

  const expected = filter.value
  if (expected === undefined || expected === null || expected === '') return true

  if (filter.operator === 'contains') return normalizeText(value).includes(normalizeText(expected))
  if (filter.operator === 'equals') return normalizeText(value) === normalizeText(expected)
  if (filter.operator === 'notEquals') return normalizeText(value) !== normalizeText(expected)
  if (filter.operator === 'gt') return compareValue(value, expected) > 0
  if (filter.operator === 'gte') return compareValue(value, expected) >= 0
  if (filter.operator === 'lt') return compareValue(value, expected) < 0
  if (filter.operator === 'lte') return compareValue(value, expected) <= 0

  if (filter.operator === 'between') {
    const from = expected
    const to = filter.valueTo
    if (to === undefined || to === null || to === '') return compareValue(value, from) >= 0
    return compareValue(value, from) >= 0 && compareValue(value, to) <= 0
  }

  return true
}

function passesColumnFilters(row: DbRow, filters?: ReportColumnFilter[]) {
  if (!filters?.length) return true
  return filters.every((filter) => columnFilterPasses(row, filter))
}

function metricValue(row: DbRow, metric: 'amount' | 'qty' | 'date' | 'rows' = 'amount') {
  if (metric === 'rows') return 1
  if (metric === 'date') return rowDate(row)?.getTime() ?? 0
  const fields = resolveFields(row, fieldAliases[metric])
  const values = fields.map((field) => toNumber(row[field])).filter((value) => value !== 0)
  if (values.length > 0) return Math.max(...values)
  return Math.max(0, ...Object.values(row).map(toNumber))
}

function passesDateFilters(row: DbRow, filters: ReportFilterInput) {
  const date = rowDate(row)
  if (!date && (filters.dateFrom || filters.dateTo || filters.period)) return false

  if (filters.period && date) {
    const period = filters.period.trim()
    if (/^\d{4}-\d{2}$/.test(period)) {
      const [year, month] = period.split('-').map(Number)
      if (date.getFullYear() !== year || date.getMonth() !== month - 1) return false
    }
  }

  const from = parseDate(filters.dateFrom)
  if (from && date && date < from) return false

  const to = parseDate(filters.dateTo)
  if (to && date) {
    const inclusiveTo = new Date(to)
    inclusiveTo.setHours(23, 59, 59, 999)
    if (date > inclusiveTo) return false
  }

  return true
}

function rowPassesFilters(row: DbRow, filters: ReportFilterInput) {
  if (!rowContains(row, fieldAliases.search, filters.search)) return false
  if (!rowContains(row, fieldAliases.location, filters.location)) return false
  if (!rowContains(row, fieldAliases.category, filters.category)) return false
  if (!rowContains(row, fieldAliases.supplier, filters.supplier)) return false
  if (!rowContains(row, fieldAliases.status, filters.status)) return false
  if (!rowContains(row, fieldAliases.vehicle, filters.vehicle)) return false
  if (!rowContains(row, fieldAliases.productType, filters.productType)) return false
  if (!rowContains(row, fieldAliases.productCategory, filters.productCategory)) return false
  if (!rowContains(row, fieldAliases.productBrand, filters.productBrand)) return false
  if (!rowContains(row, fieldAliases.productModel, filters.productModel)) return false
  if (!rowContains(row, fieldAliases.productMaterial, filters.productMaterial)) return false
  if (filters.movementCategory && normalizeText(row.MovementCategory) !== normalizeText(filters.movementCategory)) return false
  if (!rowContains(row, fieldAliases.stockAnalysis, filters.stockAnalysis)) return false
  if (!passesDateFilters(row, filters)) return false
  if (filters.blankField && !fieldIsBlank(row, filters.blankField)) return false
  if (!passesColumnFilters(row, filters.columnFilters)) return false
  if (filters.minQty !== undefined && metricValue(row, 'qty') < filters.minQty) return false
  if (filters.minAmount !== undefined && metricValue(row, 'amount') < filters.minAmount) return false
  return true
}

function sortRows(rows: DbRow[], filters: ReportFilterInput) {
  if (!filters.sortMetric && !filters.sortColumn && filters.analysis !== 'anomaly' && filters.analysis !== 'ranking') return rows
  const metric = filters.sortMetric ?? 'amount'
  const direction = filters.sortDirection ?? 'desc'
  const sorted = [...rows].sort((a, b) => {
    const sortFieldA = filters.sortColumn ? resolveSingleField(a, filters.sortColumn) : undefined
    const sortFieldB = filters.sortColumn ? resolveSingleField(b, filters.sortColumn) : undefined
    const delta = sortFieldA && sortFieldB
      ? compareValue(a[sortFieldA], b[sortFieldB])
      : metricValue(a, metric) - metricValue(b, metric)
    return direction === 'asc' ? delta : -delta
  })
  return sorted
}

function windowRows(rows: DbRow[], filters: ReportFilterInput) {
  const topLimited = filters.top ? rows.slice(0, filters.top) : rows
  const startIndex = filters.rowStart ? filters.rowStart - 1 : 0
  const endIndex = filters.rowEnd ? filters.rowEnd : undefined
  const ranged = topLimited.slice(startIndex, endIndex)
  return filters.resultLimit ? ranged.slice(0, filters.resultLimit) : ranged
}

function dimensionAliases(filters: ReportFilterInput) {
  const dimension = normalizeText(filters.chartDimension)
  if (dimension.includes('movement')) return ['MovementCategory']
  if (dimension.includes('stockanalysis') || dimension.includes('analysis')) return fieldAliases.stockAnalysis
  if (dimension.includes('kendaraan') || dimension.includes('veh')) return fieldAliases.vehicle
  if (dimension.includes('gudang') || dimension.includes('lokasi') || dimension.includes('loc')) return fieldAliases.location
  if (dimension.includes('supplier')) return fieldAliases.supplier
  if (dimension.includes('status')) return fieldAliases.status
  if (dimension.includes('kategori') || dimension.includes('fuel') || dimension.includes('barang')) return fieldAliases.category
  if (filters.chartDimension) return [filters.chartDimension]
  if (filters.vehicle || filters.analysis === 'compare') return fieldAliases.vehicle
  if (filters.location) return fieldAliases.location
  if (filters.supplier) return fieldAliases.supplier
  if (filters.category) return fieldAliases.category
  return ['Kendaraan', 'Gudang', 'Kategori', 'KodeBarang', 'NamaBarang', 'Label', 'Dokumen']
}

function rowLabel(row: DbRow, fields: string[]) {
  const resolved = resolveFields(row, fields)
  for (const field of resolved) {
    const value = String(row[field] ?? '').trim()
    if (value) return value
  }
  return 'Data'
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100
}

function aggregateValues(values: number[], fn: ReportAggregateFn = 'sum') {
  if (fn === 'count') return values.length
  if (values.length === 0) return 0
  if (fn === 'avg') return values.reduce((sum, value) => sum + value, 0) / values.length
  if (fn === 'min') return Math.min(...values)
  if (fn === 'max') return Math.max(...values)
  return values.reduce((sum, value) => sum + value, 0)
}

function aggregateFieldValue(row: DbRow, filters: ReportFilterInput) {
  if (!filters.aggregateField) return metricValue(row, filters.sortMetric === 'qty' ? 'qty' : 'amount')
  const field = resolveSingleField(row, filters.aggregateField)
  return field ? toNumber(row[field]) : 0
}

function createFilteredChart(rows: DbRow[], filters: ReportFilterInput, fallback: DbRow[] = []) {
  if (!hasActiveReportFilters(filters) && fallback.length > 0) return fallback

  const groups = new Map<string, { rows: number; amount: number; qty: number; aggregateValues: number[] }>()
  const dimension = filters.groupBy ? [filters.groupBy] : dimensionAliases(filters)

  rows.forEach((row) => {
    const label = rowLabel(row, dimension)
    const current = groups.get(label) ?? { rows: 0, amount: 0, qty: 0, aggregateValues: [] }
    current.rows += 1
    current.amount += metricValue(row, 'amount')
    current.qty += metricValue(row, 'qty')
    current.aggregateValues.push(aggregateFieldValue(row, filters))
    groups.set(label, current)
  })

  const metric = filters.sortMetric === 'qty' ? 'qty' : 'amount'
  return [...groups.entries()]
    .map(([label, value]) => {
      const aggregate = aggregateValues(value.aggregateValues, filters.aggregateFn)
      return {
        Label: label,
        TotalRows: value.rows,
        Amount: roundMetric(value.amount),
        Qty: roundMetric(value.qty),
        Aggregate: roundMetric(aggregate),
        AggregateField: filters.aggregateField ?? (metric === 'qty' ? 'Qty' : 'Amount'),
        AggregateFn: filters.aggregateFn ?? 'sum',
      }
    })
    .sort((a, b) => Number(b.Aggregate) - Number(a.Aggregate))
    .slice(0, filters.top ?? 12)
}

function createFilteredSummary(rows: DbRow[], totalBefore: number, filters: ReportFilterInput) {
  const totalAmount = rows.reduce((sum, row) => sum + metricValue(row, 'amount'), 0)
  const totalQty = rows.reduce((sum, row) => sum + metricValue(row, 'qty'), 0)
  const hasMovementMetrics = rows.some((row) => row.StockIssueMovementCount !== undefined || row.StockIssueEventCount !== undefined)
  const totalStockIssueMovementCount = rows.reduce((sum, row) => sum + toNumber(row.StockIssueMovementCount ?? row.StockIssueEventCount), 0)
  const amountValues = rows.map((row) => metricValue(row, 'amount'))
  const qtyValues = rows.map((row) => metricValue(row, 'qty'))
  const aggregate = aggregateValues(rows.map((row) => aggregateFieldValue(row, filters)), filters.aggregateFn)
  const summary: DbRow = {
    FilteredRows: rows.length,
    TotalRowsBeforeFilter: totalBefore,
    TotalAmount: roundMetric(totalAmount),
    TotalQty: roundMetric(totalQty),
    MaxAmount: roundMetric(Math.max(0, ...amountValues)),
    MaxQty: roundMetric(Math.max(0, ...qtyValues)),
    Aggregate: roundMetric(aggregate),
  }

  if (filters.blankField) {
    summary.BlankFieldRows = rows.filter((row) => fieldIsBlank(row, filters.blankField ?? '')).length
  }
  if (hasMovementMetrics) {
    summary.TotalStockIssueMovementCount = roundMetric(totalStockIssueMovementCount)
  }

  return summary
}

export function applyReportFilters<T extends FilterablePayload>(payload: T, input: ReportFilterInput): T {
  const schema = inferReportSchema(payload)
  const sanitized = sanitizeFiltersForSchema(normalizeReportFilters(input), schema)
  const filters = sanitized.filters
  const activeFilters = activeFiltersToRecord(filters)
  const summaryFilters = summaryAffectingFiltersToRecord(filters)

  if (Object.keys(activeFilters).length === 0) {
    return {
      ...payload,
      metadata: {
        ...payload.metadata,
        reportSchema: schema,
        appliedFilters: {},
        rejectedColumnFilters: sanitized.rejectedColumnFilters,
        querySafety: readOnlyQuerySafety,
        filterMode: 'none',
      },
    }
  }

  const matchedRows = sortRows(payload.rows.filter((row) => rowPassesFilters(row, filters)), filters)
  const displayRows = windowRows(matchedRows, filters)
  const windowed = displayRows.length < matchedRows.length
  const shouldRecomputeSummary = Object.keys(summaryFilters).length > 0
  const metadataFilteredRows = shouldRecomputeSummary
    ? matchedRows.length
    : payload.metadata.filteredRows ?? payload.metadata.totalRows ?? matchedRows.length
  const metadataTotalRowsBeforeFilter = shouldRecomputeSummary
    ? payload.rows.length
    : payload.metadata.totalRowsBeforeFilter ?? payload.metadata.totalRows ?? payload.rows.length

  return {
    ...payload,
    rows: displayRows,
    columns: displayRows[0] ? Object.keys(displayRows[0]) : payload.columns,
    summary: shouldRecomputeSummary ? createFilteredSummary(matchedRows, payload.rows.length, filters) : payload.summary,
    chart: createFilteredChart(matchedRows, filters, payload.chart),
    metadata: {
      ...payload.metadata,
      reportSchema: schema,
      appliedFilters: activeFilters,
      rejectedColumnFilters: sanitized.rejectedColumnFilters,
      naturalQuery: filters.naturalQuery,
      filteredRows: metadataFilteredRows,
      displayRows: displayRows.length,
      returnedRows: displayRows.length,
      rangeLimitedRows: windowed ? displayRows.length : undefined,
      matchedRowsBeforeRange: matchedRows.length,
      totalRowsBeforeFilter: metadataTotalRowsBeforeFilter,
      chartSource: 'filtered report payload full matched rows',
      querySafety: readOnlyQuerySafety,
      filterMode: 'allowlisted read-only payload filter',
    },
  }
}

function numberFrom(text: string, pattern: RegExp) {
  const match = text.match(pattern)
  if (!match?.[1]) return undefined
  const value = Number(match[1].replace(',', '.'))
  return Number.isFinite(value) ? value : undefined
}

function monthRangeFromText(text: string, now: Date) {
  const yearMatch = text.match(/\b(20\d{2})\b/)
  const year = yearMatch?.[1] ? Number(yearMatch[1]) : now.getFullYear()
  for (const [name, index] of Object.entries(monthIndex)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) {
      const lastDay = new Date(year, index + 1, 0).getDate()
      return {
        period: `${year}-${String(index + 1).padStart(2, '0')}`,
        dateFrom: formatDateYmd(year, index, 1),
        dateTo: formatDateYmd(year, index, lastDay),
      }
    }
  }
  return {}
}

function explicitPeriodFromText(text: string) {
  const accountingPeriod = text.match(/\b(?:acc|accounting)\s*(?:period|periode)?\s*[:=]?\s*(20\d{2})\s*[-/]\s*(1[0-2]|0?[1-9])\b/i)
  if (accountingPeriod?.[1] && accountingPeriod[2]) {
    return {
      accYear: Number(accountingPeriod[1]),
      accMonth: Number(accountingPeriod[2]),
    }
  }

  const accountingFields = text.match(/\b(?:acc|accounting)\s*(?:year|tahun)?\s*[:=]?\s*(20\d{2})\b[\s,;/-]*(?:acc|accounting)?\s*(?:month|bulan)\s*[:=]?\s*(1[0-2]|0?[1-9])\b/i)
  if (accountingFields?.[1] && accountingFields[2]) {
    return {
      accYear: Number(accountingFields[1]),
      accMonth: Number(accountingFields[2]),
    }
  }

  const actualPeriod = text.match(/\b(?:actual|aktual)?\s*(?:period|periode|bulan)?\s*[:=]?\s*(20\d{2})\s*[-/]\s*(1[0-2]|0[1-9])\b/i)
  if (actualPeriod?.[1] && actualPeriod[2]) {
    return {
      period: `${actualPeriod[1]}-${String(Number(actualPeriod[2])).padStart(2, '0')}`,
    }
  }

  const actualFields = text.match(/\b(?:actual|aktual)\s*(?:year|tahun)?\s*[:=]?\s*(20\d{2})\b[\s,;/-]*(?:actual|aktual)?\s*(?:month|bulan)\s*[:=]?\s*(1[0-2]|0?[1-9])\b/i)
  if (actualFields?.[1] && actualFields[2]) {
    return {
      actualYear: Number(actualFields[1]),
      actualMonth: Number(actualFields[2]),
    }
  }

  return {}
}

function formatDateYmd(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function dayRangeFromText(text: string, now: Date) {
  const yearMatch = text.match(/\b(20\d{2})\b/)
  const year = yearMatch?.[1] ? Number(yearMatch[1]) : now.getFullYear()
  const monthNames = Object.keys(monthIndex).join('|')
  const sameMonth = text.match(
    new RegExp(`\\b(?:range\\s+tanggal|dari\\s+tanggal|tanggal|tgl|dari)?\\s*(\\d{1,2})\\s*(?:sampai|hingga|to|-)\\s*(\\d{1,2})\\s*(${monthNames})\\b`, 'i'),
  )
  if (sameMonth?.[1] && sameMonth[2] && sameMonth[3]) {
    const month = monthIndex[sameMonth[3].toLowerCase()]
    const first = Number(sameMonth[1])
    const second = Number(sameMonth[2])
    if (Number.isFinite(first) && Number.isFinite(second) && month !== undefined) {
      return {
        dateFrom: formatDateYmd(year, month, Math.min(first, second)),
        dateTo: formatDateYmd(year, month, Math.max(first, second)),
      }
    }
  }

  const twoMonths = text.match(
    new RegExp(`\\b(\\d{1,2})\\s*(${monthNames})\\s*(?:sampai|hingga|to|-)\\s*(\\d{1,2})\\s*(${monthNames})\\b`, 'i'),
  )
  if (twoMonths?.[1] && twoMonths[2] && twoMonths[3] && twoMonths[4]) {
    const firstMonth = monthIndex[twoMonths[2].toLowerCase()]
    const secondMonth = monthIndex[twoMonths[4].toLowerCase()]
    const firstDay = Number(twoMonths[1])
    const secondDay = Number(twoMonths[3])
    if (firstMonth !== undefined && secondMonth !== undefined && Number.isFinite(firstDay) && Number.isFinite(secondDay)) {
      return {
        dateFrom: formatDateYmd(year, firstMonth, firstDay),
        dateTo: formatDateYmd(year, secondMonth, secondDay),
      }
    }
  }

  return {}
}

function termAfter(text: string, pattern: RegExp) {
  const match = text.match(pattern)
  const value = match?.[1]?.trim()
  if (!value || /^(untuk|dengan|yang|paling|tertinggi|terbesar|kosong|per)$/i.test(value)) return undefined
  return value
}

function normalizeColumnToken(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function columnWords(column: string) {
  return humanizeColumnLabel(column)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function columnMentionSource(column: string) {
  const words = columnWords(column)
  if (words.length === 0) return escapeRegex(column)

  const full = words.map(escapeRegex).join('\\s*[_ -]?\\s*')
  const alternatives = [full]
  const lastWord = words[words.length - 1]
  if (words.length > 1 && lastWord.length >= 4) alternatives.push(escapeRegex(lastWord))
  return `(?:${[...new Set(alternatives)].join('|')})`
}

function findMentionedColumn(text: string, columns: string[]) {
  const normalizedText = normalizeColumnToken(text)
  let best: { column: string; score: number } | undefined

  columns.forEach((column) => {
    const normalizedColumn = normalizeColumnToken(column)
    const words = columnWords(column).map(normalizeColumnToken).filter(Boolean)
    let score = 0

    if (normalizedColumn.length > 1 && normalizedText.includes(normalizedColumn)) {
      score = 100 + normalizedColumn.length
    } else if (words.length > 1 && words.every((word) => normalizedText.includes(word))) {
      score = 80 + words.join('').length
    } else {
      const distinctiveMatches = words.filter((word) => word.length >= 4 && normalizedText.includes(word))
      if (distinctiveMatches.length > 0) score = 40 + distinctiveMatches.join('').length
    }

    if (score > 0 && (!best || score > best.score)) best = { column, score }
  })

  return best?.column
}

function numberPairFrom(text: string, pattern: RegExp) {
  const match = text.match(pattern)
  if (!match?.[1] || !match?.[2]) return {}
  const first = Number(match[1].replace(',', '.'))
  const second = Number(match[2].replace(',', '.'))
  if (!Number.isFinite(first) || !Number.isFinite(second)) return {}
  return { first, second }
}

function parseRowWindow(text: string) {
  const rowRange = numberPairFrom(text, /\b(?:row|rows|baris|data)\s*(?:ke\s*)?(\d+)\s*(?:-|sampai|hingga|to)\s*(\d+)\b/i)
  if (rowRange.first !== undefined && rowRange.second !== undefined) {
    return {
      rowStart: Math.min(rowRange.first, rowRange.second),
      rowEnd: Math.max(rowRange.first, rowRange.second),
    }
  }

  const limit = numberFrom(text, /\b(?:limit|ambil|tampilkan|show)\s*(\d+)\s*(?:row|rows|baris|data)?\b/i)
  return { resultLimit: limit }
}

function parseExplicitTop(text: string) {
  return numberFrom(text, /\b(?:top|ranking|peringkat)\s*(\d+)\b/i)
}

function parseStaleScope(text: string) {
  if (!/\b(stale|dead\s*stock|update|tidak\s+update|belum\s+update|tidak\s+bergerak|slow\s+moving|perlu\s+dipantau|watch|umur|berumur|aging|age)\b/i.test(text)) return undefined
  if (/\b(dead\s*stock|2\s*(?:tahun|year)|24\s*(?:bulan|month)|lebih\s+dari\s+2\s*(?:tahun|year))\b/i.test(text)) return 'dead-stock'
  if (/\b(perlu\s+dipantau|watch|3\s*-\s*6\s*(?:bulan|month)|3\s*(?:bulan|month)\s*(?:sampai|hingga|to|-)\s*6\s*(?:bulan|month))\b/i.test(text)) return 'watch'
  if (/\b(slow\s*moving|6\s*(?:bulan|month)|6\s*-\s*12\s*(?:bulan|month))\b/i.test(text)) return 'slow-moving'
  if (/\b(aktif|active|3\s*(?:bulan|month))\b/i.test(text)) return 'active'
  if (/\b(kurang|bawah|di\s+bawah|under|below)\s+(?:dari\s+)?1\s*(?:tahun|year)\b/i.test(text)) return 'kurang-1-tahun'
  if (/\b(semua|all)\b/i.test(text)) return 'semua'
  if (/\b(1\s*(?:tahun|year)|12\s*(?:bulan|month)|setahun|lebih\s+dari\s+1\s*(?:tahun|year)|di\s+atas\s+1\s*(?:tahun|year)|ke\s+atas)\b/i.test(text)) return 'lebih-1-tahun'
  return undefined
}

function filterValue(value: string) {
  const trimmed = value.trim()
  const numeric = parseHumanNumber(trimmed)
  return numeric ?? trimmed
}

function isControlWord(value: string) {
  return /^(yang|dengan|untuk|per|by|group|sort|urutkan|order|top|ranking|terbesar|tertinggi|terendah|terkecil|kosong|blank|di|lebih|kurang|dari|atas|bawah|dan|sampai|hingga)$/i.test(value)
}

function pushColumnFilter(filters: ReportColumnFilter[], filter: ReportColumnFilter) {
  if (filters.some((item) => item.field === filter.field && item.operator === filter.operator)) return
  filters.push(filter)
}

function parseColumnFilter(text: string, columns: string[]): ReportColumnFilter[] | undefined {
  const filters: ReportColumnFilter[] = []
  const valuePattern = '([\\w.,:-]+(?:\\s*(?:juta|jt|miliar|milyar|ribu|rb|k|m))?)'

  columns.forEach((column) => {
    const columnPattern = columnMentionSource(column)
    const columnRef = `${columnPattern}(?:nya)?`
    const blankPattern = new RegExp(`${columnRef}\\s*(?:yang\\s+)?\\b(kosong|blank|null)\\b|\\b(kosong|blank|null)\\b\\s+${columnRef}`, 'i')
    const notBlankPattern = new RegExp(`${columnRef}\\s*(?:yang\\s+)?\\b(tidak\\s+kosong|not\\s+blank|not\\s+null)\\b|\\b(tidak\\s+kosong|not\\s+blank|not\\s+null)\\b\\s+${columnRef}`, 'i')

    if (notBlankPattern.test(text)) {
      pushColumnFilter(filters, { field: column, operator: 'notBlank' })
      return
    }
    if (blankPattern.test(text)) {
      pushColumnFilter(filters, { field: column, operator: 'blank' })
      return
    }

    const between = text.match(new RegExp(`${columnRef}\\s*(?:antara|between|dari|range)?\\s*${valuePattern}\\s*(?:dan|sampai|hingga|to|-)\\s*${valuePattern}`, 'i'))
    if (between?.[1] && between[2]) {
      pushColumnFilter(filters, { field: column, operator: 'between', value: filterValue(between[1]), valueTo: filterValue(between[2]) })
      return
    }

    const gte = text.match(new RegExp(`${columnRef}\\s*(?:>=|minimal|min|paling\\s+sedikit|sekurang-kurangnya)\\s*${valuePattern}`, 'i'))
    if (gte?.[1]) {
      pushColumnFilter(filters, { field: column, operator: 'gte', value: filterValue(gte[1]) })
      return
    }

    const gt = text.match(new RegExp(`${columnRef}\\s*(?:di\\s+atas|lebih\\s+dari|greater\\s+than|>)\\s*${valuePattern}`, 'i'))
    if (gt?.[1]) {
      pushColumnFilter(filters, { field: column, operator: 'gt', value: filterValue(gt[1]) })
      return
    }

    const lte = text.match(new RegExp(`${columnRef}\\s*(?:<=|maksimal|max|paling\\s+banyak)\\s*${valuePattern}`, 'i'))
    if (lte?.[1]) {
      pushColumnFilter(filters, { field: column, operator: 'lte', value: filterValue(lte[1]) })
      return
    }

    const lt = text.match(new RegExp(`${columnRef}\\s*(?:di\\s+bawah|kurang\\s+dari|less\\s+than|<)\\s*${valuePattern}`, 'i'))
    if (lt?.[1]) {
      pushColumnFilter(filters, { field: column, operator: 'lt', value: filterValue(lt[1]) })
      return
    }

    const equals = text.match(new RegExp(`${columnRef}\\s*(?:=|adalah|sama\\s+dengan|equals?|is)\\s*${valuePattern}`, 'i'))
    if (equals?.[1]) {
      pushColumnFilter(filters, { field: column, operator: 'equals', value: filterValue(equals[1]) })
      return
    }

    const contains = text.match(new RegExp(`${columnRef}\\s*(?:mengandung|contains?|berisi)\\s*${valuePattern}`, 'i'))
    if (contains?.[1]) {
      pushColumnFilter(filters, { field: column, operator: 'contains', value: filterValue(contains[1]) })
      return
    }

    const implicit = text.match(new RegExp(`${columnRef}\\s+${valuePattern}`, 'i'))
    const implicitValue = implicit?.[1]?.trim()
    if (implicitValue && !isControlWord(implicitValue)) {
      pushColumnFilter(filters, { field: column, operator: 'contains', value: filterValue(implicitValue) })
    }
  })

  return filters.length ? filters.slice(0, 5) : undefined
}

function findColumnByAliases(columns: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeColumnToken)
  return columns.find((column) => normalizedAliases.includes(normalizeColumnToken(column)))
}

function parseStockAgingQualityFilters(text: string, columns: string[]) {
  const filters: ReportColumnFilter[] = []
  const stockField = findColumnByAliases(columns, ['QuantityClosing', 'StokAkhir', 'QtyOnHand', 'StockOnHand', 'QtyAkhir'])
  const categoryField = findColumnByAliases(columns, ['KodeKategori', 'Kategori', 'ProdCatCode'])
  const issueField = findColumnByAliases(columns, ['IssueSummary', 'FlagTanpaIssueValid', 'TanpaIssueValid'])

  if (stockField && /\b(?:stok|stock|qty)(?:\s+\w+)?\s*(?:nol|0)\b|\b(?:stok|stock)\s+nol\b/i.test(text)) {
    pushColumnFilter(filters, { field: stockField, operator: 'equals', value: 0 })
  }

  if (stockField && (/\b(?:stok|stock)\s+(?:ada|tersedia|positif)\b/i.test(text) || /\b(?:ada|punya|memiliki)\s+(?:stok|stock)\b/i.test(text))) {
    pushColumnFilter(filters, { field: stockField, operator: 'gt', value: 0 })
  }

  if (stockField && /\b(?:stok|stock)\s+(?:negatif|minus)\b/i.test(text)) {
    pushColumnFilter(filters, { field: stockField, operator: 'lt', value: 0 })
  }

  if (categoryField && (/\b(?:tanpa|tidak\s+punya|belum\s+ada)\s+kategori\b/i.test(text) || /\bkategori\s+(?:kosong|blank|null)\b/i.test(text))) {
    pushColumnFilter(filters, { field: categoryField, operator: 'blank' })
  }

  if (issueField && (/\b(?:tanpa|tidak\s+punya|belum\s+ada)\s+issue\s+valid\b/i.test(text) || /\bissue\s+(?:tidak\s+valid|kosong|blank|null)\b/i.test(text))) {
    pushColumnFilter(filters, {
      field: issueField,
      operator: normalizeColumnToken(issueField).includes('flag') ? 'equals' : 'contains',
      value: normalizeColumnToken(issueField).includes('flag') ? 1 : 'Tanpa Issue Valid',
    })
  }

  return filters
}

function stockQualityScopeFromText(text: string) {
  if (
    /\b(?:stok|stock)\s+(?:nol|0|ada|tersedia|negatif|minus)\b/i.test(text) ||
    /\b(?:ada|punya|memiliki)\s+(?:stok|stock)\b/i.test(text) ||
    /\b(?:tanpa|tidak\s+punya|belum\s+ada)\s+kategori\b/i.test(text) ||
    /\bkategori\s+(?:kosong|blank|null)\b/i.test(text) ||
    /\b(?:tanpa|tidak\s+punya|belum\s+ada)\s+issue\s+valid\b/i.test(text) ||
    /\bissue\s+(?:tidak\s+valid|kosong|blank|null)\b/i.test(text) ||
    /\bnilai\s+stok\s+(?:terbesar|tertinggi|tinggi|paling\s+besar|paling\s+tinggi|di\s+atas|lebih\s+dari|>=|>|minimal|min)\b/i.test(text) ||
    /\b(?:top|ranking|peringkat)\s*\d*[\w\s-]*\b(?:berdasarkan|by)\s+nilai\s+stok\b/i.test(text)
  ) {
    return 'semua'
  }
  return undefined
}

function parseSortColumn(text: string, columns: string[]) {
  const sortMatch = text.match(/\b(?:sort|urutkan|order)\s*(?:by|berdasarkan|kolom)?\s*([a-z0-9_ -]+)/i)
  if (sortMatch?.[1]) return findMentionedColumn(sortMatch[1], columns)

  const topBasedOnMatch = text.match(/\b(?:top|ranking|peringkat)\s*\d*[\w\s-]*?\b(?:berdasarkan|by)\s+([a-z0-9_ -]+)/i)
  if (topBasedOnMatch?.[1]) return findMentionedColumn(topBasedOnMatch[1], columns)

  const rankingMatch = text.match(/\b([a-z0-9_ -]+?)\s*(?:paling\s+tinggi|paling\s+besar|tertinggi|terbesar|terendah|terkecil)\b/i)
  if (rankingMatch?.[1]) return findMentionedColumn(rankingMatch[1], columns)

  return undefined
}

function parseAggregate(text: string, columns: string[]) {
  const fn: ReportAggregateFn | undefined = /\b(avg|average|rata-rata|rerata)\b/i.test(text)
    ? 'avg'
    : /\b(count|hitung|jumlah data|total data)\b/i.test(text)
      ? 'count'
      : /\b(min|minimal|terendah)\b/i.test(text)
        ? 'min'
        : /\b(max|maksimal|tertinggi|terbesar)\b/i.test(text)
          ? 'max'
          : /\b(sum|total|jumlah)\b/i.test(text)
            ? 'sum'
            : undefined

  const aggregateMatch = text.match(/\b(?:sum|total|jumlah|avg|average|rata-rata|rerata|max|min)\s+([a-z0-9_ -]+?)(?=\s+(?:per|by|group|dan|dengan|sort|urutkan|order|limit|top)\b|$|[,.;])/i)
  const aggregateField = findMentionedColumn(aggregateMatch?.[1] ?? text, columns)

  const groupMatch = text.match(/\b(?:group by|group|kelompokkan berdasarkan|per)\s+([a-z0-9_ -]+)/i)
  const groupPhrase = groupMatch?.[1]?.split(/\b(?:dan|dengan|sort|urutkan|order|limit|top|where|yang)\b|[,.;]/i)[0] ?? ''
  const groupBy = findMentionedColumn(groupPhrase, columns)

  return {
    aggregateFn: fn,
    aggregateField,
    groupBy,
  }
}

export function parseNaturalFilterLocally(query: string, now = new Date(), columns: string[] = []) {
  const safety = validateNaturalLanguageReadOnly(query)
  if (!safety.safe) {
    return {
      safe: false,
      filters: normalizeReportFilters({ naturalQuery: query }),
      explanation: safety.reason ?? 'Permintaan non-read diblokir.',
      safety,
    }
  }

  const text = query.toLowerCase()
  const explicitPeriod = explicitPeriodFromText(text)
  const month = monthRangeFromText(text, now)
  const dayRange = dayRangeFromText(text, now)
  const location = termAfter(text, /\b(?:gudang|lokasi|warehouse|site)\s+([a-z0-9_-]+)/i)
  const vehicle = termAfter(text, /\b(?:kendaraan|vehicle|vehcode)\s+([a-z0-9_-]+)/i)
  const stockAnalysis = termAfter(text, /\bstock\s*analysis\s+([a-z0-9_-]+)/i)
  const minQty = numberFrom(text, /\b(?:qty|quantity|stok|pemakaian)\s*(?:di atas|lebih dari|>=|>)\s*(\d+(?:[.,]\d+)?)/i)
  const minAmount = numberFrom(text, /\b(?:amount|nilai|biaya|cost)\s*(?:di atas|lebih dari|>=|>)\s*(\d+(?:[.,]\d+)?)/i)
  const category = /diesel/i.test(text) ? 'diesel' : /solar/i.test(text) ? 'solar' : undefined
  const rowWindow = parseRowWindow(text)
  const explicitTop = parseExplicitTop(text)
  const stale = parseStaleScope(text)
  const parsedColumnFilters = [
    ...(parseColumnFilter(query, columns) ?? []),
    ...parseStockAgingQualityFilters(text, columns),
  ]
  const columnFilters = dayRange.dateFrom || dayRange.dateTo
    ? parsedColumnFilters.filter((filter) => !isDateLikeKey(filter.field))
    : parsedColumnFilters
  const sortColumn = parseSortColumn(query, columns)
  const aggregate = parseAggregate(query, columns)

  const wantsTop = /\b(paling tinggi|tertinggi|terbesar|top|ranking|rank)\b/i.test(text)
  const wantsCompare = Boolean(aggregate.groupBy) || /\b(bandingkan|compare|per kendaraan|per gudang|per supplier|per kategori|per blok)\b/i.test(text)
  const wantsAnomaly = /\b(anomali|anomaly|outlier)\b/i.test(text)
  const wantsTrend = /\b(tren|trend|bulanan|per bulan)\b/i.test(text)
  const blankField = /vehcode\s+kosong|kendaraan\s+(?:yang\s+)?kosong/i.test(text)
    ? 'VehCode'
    : /blkcode\s+kosong|blok\s+(?:yang\s+)?kosong/i.test(text)
      ? 'BlkCode'
      : /acccode\s+kosong/i.test(text)
        ? 'AccCode'
    : /loccode\s+kosong|gudang\s+(?:yang\s+)?kosong/i.test(text)
          ? 'LocCode'
          : undefined
  const dynamicBlankField = columnFilters?.[0]?.operator === 'blank' ? columnFilters[0].field : undefined

  const chartDimension = /per kendaraan|kendaraan/i.test(text)
    ? 'Kendaraan'
    : /per gudang|gudang/i.test(text)
      ? 'Gudang'
      : /per supplier|supplier/i.test(text)
        ? 'Supplier'
        : /per kategori|kategori/i.test(text)
          ? 'Kategori'
          : /per blok|blok/i.test(text)
            ? 'Blok'
            : findMentionedColumn(query, columns)

  return {
    safe: true,
    filters: normalizeReportFilters({
      ...month,
      ...explicitPeriod,
      ...dayRange,
      location,
      vehicle,
      stockAnalysis,
      category,
      search: category,
      blankField: blankField ?? dynamicBlankField,
      minQty,
      minAmount,
      sortMetric: wantsTop || wantsAnomaly ? (/\b(qty|pemakaian|stok)\b/i.test(text) ? 'qty' : 'amount') : undefined,
      sortColumn,
      sortDirection: wantsTop || wantsAnomaly ? 'desc' : undefined,
      chartDimension: aggregate.groupBy ?? (wantsCompare || chartDimension ? chartDimension : undefined),
      groupBy: aggregate.groupBy,
      aggregateField: aggregate.aggregateField,
      aggregateFn: aggregate.aggregateFn,
      top: explicitTop ?? (wantsTop || wantsAnomaly ? 10 : undefined),
      resultLimit: rowWindow.resultLimit,
      rowStart: rowWindow.rowStart,
      rowEnd: rowWindow.rowEnd,
      stale: stale ?? stockQualityScopeFromText(text),
      analysis: wantsAnomaly ? 'anomaly' : wantsCompare ? 'compare' : wantsTrend ? 'trend' : wantsTop ? 'ranking' : undefined,
      columnFilters: columnFilters.length ? columnFilters : undefined,
      naturalQuery: query,
    }),
    explanation: 'Natural language diterjemahkan menjadi filter allowlist. Tidak ada SQL dari user yang dieksekusi.',
    safety,
  }
}
