export const INVENTORY_SEMANTIC_DIMENSION_IDS = [
  'item-code',
  'item-type',
  'product-type',
  'product-category',
  'stock-analysis',
  'location',
  'movement-category',
] as const

export type InventorySemanticDimensionId = (typeof INVENTORY_SEMANTIC_DIMENSION_IDS)[number]

export type InventorySemanticDimensionSource =
  | 'identity'
  | 'stored-taxonomy'
  | 'location'
  | 'computed-periodic'
  | 'computed-all-period'

export type InventorySemanticDimensionDefinition = {
  id: InventorySemanticDimensionId
  label: string
  source: InventorySemanticDimensionSource
  canonicalFields: string[]
  aliases: string[]
  periodScoped?: boolean
  description: string
}

export type InventoryReportSemanticAliasMap = Partial<Record<InventorySemanticDimensionId, string[]>>

export const inventorySemanticDimensions: Record<InventorySemanticDimensionId, InventorySemanticDimensionDefinition> = {
  'item-code': {
    id: 'item-code',
    label: 'Item Code',
    source: 'identity',
    canonicalFields: ['ItemCode'],
    aliases: ['KodeBarang', 'item_code', 'itemCode'],
    description: 'Kode unik item/barang pada master dan transaksi inventory.',
  },
  'item-type': {
    id: 'item-type',
    label: 'Item Type',
    source: 'stored-taxonomy',
    canonicalFields: ['ItemType'],
    aliases: ['ItemTypeName', 'TipeBarang', 'item_type'],
    description: 'Tipe item tersimpan, misalnya Stock atau Workshop.',
  },
  'product-type': {
    id: 'product-type',
    label: 'Product Type',
    source: 'stored-taxonomy',
    canonicalFields: ['ProdTypeCode'],
    aliases: ['ProductTypeCode', 'ProductTypeDescription', 'product_type_code', 'product_type_description'],
    description: 'Pengelompokan product type dari master item atau product type.',
  },
  'product-category': {
    id: 'product-category',
    label: 'Product Category',
    source: 'stored-taxonomy',
    canonicalFields: ['ProdCatCode'],
    aliases: ['KodeKategori', 'Kategori', 'ProductCategoryCode', 'ProductCategoryDescription'],
    description: 'Kategori produk dari master item/product category.',
  },
  'stock-analysis': {
    id: 'stock-analysis',
    label: 'Stock Analysis',
    source: 'stored-taxonomy',
    canonicalFields: ['StockAnalysisCode'],
    aliases: ['StockAnalysisDescription', 'AnalysisCode', 'stock_analysis_code'],
    description: 'Taxonomy tersimpan seperti DEADS, MEMOV, dan SLMOV.',
  },
  location: {
    id: 'location',
    label: 'Location',
    source: 'location',
    canonicalFields: ['LocCode'],
    aliases: ['Location', 'Gudang', 'Lokasi', 'Warehouse', 'Site'],
    description: 'Gudang, lokasi, atau site tempat stok dicatat.',
  },
  'movement-category': {
    id: 'movement-category',
    label: 'Movement Category',
    source: 'computed-periodic',
    canonicalFields: ['MovementCategory'],
    aliases: ['MovementBucket', 'MovementClass', 'movementCategory'],
    periodScoped: true,
    description: 'Kategori hasil hitung aktivitas movement dalam window/periode aktif: Fast Moving, Moving, Slow Moving, Dead Stock, atau Stale. Bukan taxonomy master.',
  },
}

export const inventoryReportSemanticAliases: Record<string, InventoryReportSemanticAliasMap> = {
  'all-stock-movement-analysis': {
    'item-code': ['KodeBarang', 'ItemCode'],
    'item-type': ['ItemType', 'ItemTypeName'],
    'product-type': ['category', 'ProductTypeCode', 'ProductTypeDescription', 'product_type_code', 'product_type_description'],
    location: ['location', 'Gudang', 'Location', 'LocCode'],
    'movement-category': ['movementCategory', 'MovementCategory'],
  },
  'monthly-stock-account-movement-details': {
    'item-code': ['KodeBarang', 'ItemCode'],
    'item-type': ['ItemType'],
    'product-type': ['ProductTypeCode', 'ProductTypeDescription', 'ProdTypeCode'],
    'product-category': ['ProductCategoryCode', 'ProdCatCode'],
    'stock-analysis': ['category', 'stockAnalysis', 'StockAnalysisCode', 'StockAnalysisDescription'],
    location: ['location', 'LocCode', 'Lokasi'],
    'movement-category': ['movementCategory', 'MovementCategory'],
  },
  'asset-stock-valuasi-listing': {
    'item-code': ['KodeBarang', 'ItemCode'],
    'item-type': ['ItemType'],
    'product-type': ['category', 'ProductTypeCode', 'ProductTypeDescription', 'product_type_code', 'product_type_description'],
    location: ['location', 'Gudang', 'Location', 'LocCode'],
  },
  'item-movement-update-tracking': {
    'item-code': ['KodeBarang', 'ItemCode'],
    'item-type': ['ItemType'],
    'product-category': ['category', 'KodeKategori', 'Kategori', 'ProdCatCode'],
    location: ['warehouse', 'Gudang', 'Location', 'LocCode'],
    'movement-category': ['movementCategory', 'MovementCategory'],
  },
}

function normalizeToken(value: unknown) {
  return String(value ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function aliasesForDimension(id: InventorySemanticDimensionId, reportId?: string) {
  const dimension = inventorySemanticDimensions[id]
  return [
    id,
    dimension.label,
    ...dimension.canonicalFields,
    ...dimension.aliases,
    ...(reportId ? inventoryReportSemanticAliases[reportId]?.[id] ?? [] : []),
  ]
}

export function getInventorySemanticDimensionAliases(id: InventorySemanticDimensionId, reportId?: string) {
  return [...new Set(aliasesForDimension(id, reportId))]
}

export function getInventorySemanticDimension(id: InventorySemanticDimensionId) {
  return inventorySemanticDimensions[id]
}

export function resolveInventorySemanticDimensionId(value: unknown, reportId?: string): InventorySemanticDimensionId | undefined {
  const normalized = normalizeToken(value)
  if (!normalized) return undefined

  return INVENTORY_SEMANTIC_DIMENSION_IDS.find((id) =>
    aliasesForDimension(id, reportId).some((alias) => normalizeToken(alias) === normalized),
  )
}

export function inventorySemanticDimensionsOverlap(left: InventorySemanticDimensionId, right: InventorySemanticDimensionId, reportId?: string) {
  const leftAliases = new Set(getInventorySemanticDimensionAliases(left, reportId).map(normalizeToken))
  return getInventorySemanticDimensionAliases(right, reportId).some((alias) => leftAliases.has(normalizeToken(alias)))
}

export function assertSeparateInventorySemanticDimensions(left: InventorySemanticDimensionId, right: InventorySemanticDimensionId, reportId?: string) {
  if (inventorySemanticDimensionsOverlap(left, right, reportId)) {
    throw new Error(`Inventory semantic dimensions must stay separate: ${left} and ${right}.`)
  }
}
