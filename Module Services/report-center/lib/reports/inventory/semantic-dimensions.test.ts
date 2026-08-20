import assert from 'node:assert/strict'
import {
  INVENTORY_SEMANTIC_DIMENSION_IDS,
  assertSeparateInventorySemanticDimensions,
  getInventorySemanticDimension,
  getInventorySemanticDimensionAliases,
  inventorySemanticDimensionsOverlap,
  resolveInventorySemanticDimensionId,
} from './semantic-dimensions'

assert.deepEqual(INVENTORY_SEMANTIC_DIMENSION_IDS, [
  'item-code',
  'item-type',
  'product-type',
  'product-category',
  'stock-analysis',
  'location',
  'movement-category',
])

assert.equal(getInventorySemanticDimension('movement-category').source, 'computed-periodic')
assert.equal(getInventorySemanticDimension('movement-category').periodScoped, true)
assert.equal(getInventorySemanticDimension('stock-analysis').source, 'stored-taxonomy')

assert.equal(resolveInventorySemanticDimensionId('MovementCategory'), 'movement-category')
assert.equal(resolveInventorySemanticDimensionId('StockAnalysisCode'), 'stock-analysis')
assert.equal(resolveInventorySemanticDimensionId('DEADS'), undefined)

assert.equal(resolveInventorySemanticDimensionId('category', 'monthly-stock-account-movement-details'), 'stock-analysis')
assert.equal(resolveInventorySemanticDimensionId('category', 'all-stock-movement-analysis'), 'product-type')
assert.equal(resolveInventorySemanticDimensionId('movementCategory', 'all-stock-movement-analysis'), 'movement-category')

assert.equal(inventorySemanticDimensionsOverlap('stock-analysis', 'movement-category'), false)
assert.doesNotThrow(() => assertSeparateInventorySemanticDimensions('stock-analysis', 'movement-category'))

const monthlyStockAliases = getInventorySemanticDimensionAliases('stock-analysis', 'monthly-stock-account-movement-details')
assert.equal(monthlyStockAliases.includes('category'), true)
assert.equal(monthlyStockAliases.includes('MovementCategory'), false)

console.info('inventory semantic-dimensions tests passed')
