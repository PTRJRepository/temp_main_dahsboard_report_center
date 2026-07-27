import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  LEGACY_NO_MOVEMENT_CATEGORY,
  LEGACY_STALE_CATEGORY,
  MOVEMENT_CATEGORY_ORDER,
  MOVEMENT_CATEGORY_THRESHOLDS,
  buildMovementCategoryBalancedRows,
  countMovementCategoryRows,
  movementCategoryFromIssueCount,
  movementCategoryRank,
  movementCategoryRankSqlCase,
  movementCategorySqlCase,
  movementCategoryThresholdLabel,
  normalizeMovementCategoryLabel,
  normalizeMovementCategoryThresholds,
} from './movement-category'

assert.deepEqual(MOVEMENT_CATEGORY_ORDER, ['Fast Moving', 'Moving', 'Slow Moving', 'Dead Stock'])
assert.equal(MOVEMENT_CATEGORY_THRESHOLDS.fastMinIssueCount, 6)
assert.equal(MOVEMENT_CATEGORY_THRESHOLDS.movingMinIssueCount, 2)
assert.equal(MOVEMENT_CATEGORY_THRESHOLDS.movingMaxIssueCount, 5)

assert.equal(movementCategoryFromIssueCount(6, 0), 'Fast Moving')
assert.equal(movementCategoryFromIssueCount(5, 0), 'Moving')
assert.equal(movementCategoryFromIssueCount(2, 0), 'Moving')
assert.equal(movementCategoryFromIssueCount(1, 10), 'Slow Moving')
assert.equal(movementCategoryFromIssueCount(0, 10), 'Dead Stock')
assert.equal(movementCategoryFromIssueCount(0, 0), 'Dead Stock')
assert.equal(
  movementCategoryFromIssueCount(7, 0, {
    fastMinIssueCount: 8,
    movingMinIssueCount: 3,
    movingMaxIssueCount: 7,
    slowIssueCount: 2,
  }),
  'Moving',
)
assert.equal(
  movementCategoryFromIssueCount(2, 10, {
    fastMinIssueCount: 8,
    movingMinIssueCount: 3,
    movingMaxIssueCount: 7,
    slowIssueCount: 2,
  }),
  'Slow Moving',
)

assert.equal(normalizeMovementCategoryLabel(LEGACY_NO_MOVEMENT_CATEGORY), 'Dead Stock')
assert.equal(normalizeMovementCategoryLabel(LEGACY_STALE_CATEGORY), 'Dead Stock')
assert.equal(movementCategoryRank('Fast Moving') < movementCategoryRank('Moving'), true)
assert.equal(movementCategoryRank(LEGACY_STALE_CATEGORY), movementCategoryRank('Dead Stock'))
assert.equal(movementCategoryRank(LEGACY_NO_MOVEMENT_CATEGORY), movementCategoryRank('Dead Stock'))

const categorySql = movementCategorySqlCase('IssueCount', 'QuantityClosing')
assert.equal(categorySql.includes("IssueCount >= 6 THEN 'Fast Moving'"), true)
assert.equal(categorySql.includes("IssueCount BETWEEN 2 AND 5 THEN 'Moving'"), true)
assert.equal(categorySql.includes("IssueCount = 1 THEN 'Slow Moving'"), true)
assert.equal(categorySql.includes("ELSE 'Dead Stock'"), true)
assert.equal(categorySql.includes("'Stale'"), false)

const customThresholds = normalizeMovementCategoryThresholds({
  fastMinIssueCount: 10,
  movingMinIssueCount: 3,
  movingMaxIssueCount: 9,
  slowIssueCount: 2,
})
assert.deepEqual(customThresholds, {
  fastMinIssueCount: 10,
  movingMinIssueCount: 3,
  movingMaxIssueCount: 9,
  slowIssueCount: 2,
  deadStockIssueCount: 0,
})
assert.equal(movementCategoryThresholdLabel(customThresholds), 'Fast >= 10, Moving 3-9, Slow = 2, Dead = 0 issue')
const customCategorySql = movementCategorySqlCase('IssueCount', 'QuantityClosing', customThresholds)
assert.equal(customCategorySql.includes("IssueCount >= 10 THEN 'Fast Moving'"), true)
assert.equal(customCategorySql.includes("IssueCount BETWEEN 3 AND 9 THEN 'Moving'"), true)
assert.equal(customCategorySql.includes("IssueCount = 2 THEN 'Slow Moving'"), true)

const rankSql = movementCategoryRankSqlCase('MovementCategory')
assert.equal(rankSql.includes("WHEN 'Dead Stock' THEN 4"), true)
assert.equal(rankSql.includes("WHEN 'Stale' THEN 4"), true)
assert.equal(rankSql.includes("WHEN 'No Movement' THEN 4"), true)

const balanced = buildMovementCategoryBalancedRows(
  [
    { id: 'dead-1', category: 'Dead Stock', priority: 100 },
    { id: 'dead-2', category: 'Dead Stock', priority: 90 },
    { id: 'dead-3', category: 'Dead Stock', priority: 80 },
    { id: 'fast-1', category: 'Fast Moving', priority: 70 },
    { id: 'moving-1', category: 'Moving', priority: 60 },
    { id: 'stale-1', category: 'No Movement', priority: 50 },
  ],
  4,
  (row) => row.category,
  (left, right) => right.priority - left.priority,
)

// stale-1 folds into Dead Stock group; round-robin: Fast, Moving, Dead(dead-1), Dead(dead-2)
assert.deepEqual(balanced.map((row) => row.id), ['fast-1', 'moving-1', 'dead-1', 'dead-2'])

assert.deepEqual(countMovementCategoryRows(balanced, 'category'), {
  'Fast Moving': 1,
  Moving: 1,
  'Dead Stock': 2,
})

const inventoryRouteSource = readFileSync(new URL('../../app/api/reports/inventory/route.ts', import.meta.url), 'utf8')
assert.equal(inventoryRouteSource.includes("FROM [${database}].[dbo].[IN_STOCKISSUELN] l"), true)
assert.equal(inventoryRouteSource.includes("WHERE ISNULL(${itemType}, '') <> '4'"), true)
assert.equal(inventoryRouteSource.includes("${nonWorkshopItemTypeFilter('issueItem')}"), true)
assert.equal(inventoryRouteSource.includes("FROM [${database}].[dbo].[WS_JOBSTOCK] s"), true)
assert.equal(inventoryRouteSource.includes("WHERE ${itemType} = '4'"), true)
assert.equal(inventoryRouteSource.includes("RTRIM(ISNULL(s.TransType, '')) = '1'"), true)
assert.equal(inventoryRouteSource.includes('movementWindowFromFilters(filters)'), true)
assert.equal(inventoryRouteSource.includes('movementThresholdsFromFilters(filters)'), true)
assert.equal(inventoryRouteSource.includes('movementCategoryThresholdLabel(movementThresholds)'), true)
assert.equal(inventoryRouteSource.includes('movementFastMin'), true)
assert.equal(inventoryRouteSource.includes('GUARDRAIL(monthly-valuation-itemtype)'), true)
assert.equal(inventoryRouteSource.includes("IN ('1', '4')"), true)
assert.equal(inventoryRouteSource.includes("THEN 'WS_JOBSTOCK'"), true)
assert.equal(inventoryRouteSource.includes("ELSE 'STOCK_ISSUE_REGULAR'"), true)
assert.equal(inventoryRouteSource.includes('ItemType4WorkshopSourceInvalid'), true)
assert.equal(inventoryRouteSource.includes('MovementSourceMissing'), true)

console.log('movement-category tests passed')
