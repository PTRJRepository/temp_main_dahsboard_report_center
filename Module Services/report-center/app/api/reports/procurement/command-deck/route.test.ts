import assert from 'node:assert/strict'

/**
 * Contract test untuk composite command-deck endpoint.
 * Memastikan pemetaan groupBy+scopeCode -> param API identik dengan
 * `analysisScopeParams` di ProcurementKpiStrip (mirror client/server).
 *
 * Jalankan: npx tsx app/api/reports/procurement/command-deck/route.test.ts
 */

// --- Duplikasi minimal fungsi murni dari route.ts agar bisa diuji tanpa Next runtime.
// Jika route.ts berubah, samakan mapping di sini (mirror, bukan import server-only).

type CommandDeckFilters = {
  period: string
  movementWindow: string
  groupBy: string
  scopeCode: string
  itemType: '' | 'gudang' | 'workshop'
  location: string
}

function analysisScopeParams(filters: CommandDeckFilters): Record<string, string> {
  const value = filters.scopeCode
  const params: Record<string, string> = {}
  if (!value) return params
  switch (filters.groupBy) {
    case 'StockAnalysisCode':
      params.stockAnalysis = value
      params.category = value
      break
    case 'ProductTypeCode':
      params.productType = value
      break
    case 'ProductCategoryCode':
      params.productCategory = value
      params.category = value
      break
    case 'ProductBrandCode':
      params.productBrand = value
      break
    case 'ProductModelCode':
      params.productModel = value
      break
    case 'ProductMaterialCode':
      params.productMaterial = value
      break
  }
  return params
}

function base(overrides: Partial<CommandDeckFilters> = {}): CommandDeckFilters {
  return {
    period: '2026-07',
    movementWindow: 'all',
    groupBy: 'ProductTypeCode',
    scopeCode: '',
    itemType: '',
    location: '',
    ...overrides,
  }
}

// scopeCode kosong -> tidak ada param scope
assert.deepEqual(analysisScopeParams(base()), {})

// groupBy -> param mapping
assert.deepEqual(analysisScopeParams(base({ groupBy: 'StockAnalysisCode', scopeCode: 'DEADS' })), {
  stockAnalysis: 'DEADS',
  category: 'DEADS',
})
assert.deepEqual(analysisScopeParams(base({ groupBy: 'ProductTypeCode', scopeCode: 'SP' })), {
  productType: 'SP',
})
assert.deepEqual(analysisScopeParams(base({ groupBy: 'ProductCategoryCode', scopeCode: 'CAT1' })), {
  productCategory: 'CAT1',
  category: 'CAT1',
})
assert.deepEqual(analysisScopeParams(base({ groupBy: 'ProductBrandCode', scopeCode: 'BRX' })), {
  productBrand: 'BRX',
})
assert.deepEqual(analysisScopeParams(base({ groupBy: 'ProductModelCode', scopeCode: 'MDL' })), {
  productModel: 'MDL',
})
assert.deepEqual(analysisScopeParams(base({ groupBy: 'ProductMaterialCode', scopeCode: 'MAT' })), {
  productMaterial: 'MAT',
})

console.log('OK command-deck contract (analysisScopeParams mirror)')
