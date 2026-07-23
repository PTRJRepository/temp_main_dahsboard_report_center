export const MOVEMENT_CATEGORY_ORDER = [
  'Fast Moving',
  'Moving',
  'Slow Moving',
  'Dead Stock',
  'Stale',
] as const

export type MovementCategory = (typeof MOVEMENT_CATEGORY_ORDER)[number]

export const LEGACY_NO_MOVEMENT_CATEGORY = 'No Movement'

export const MOVEMENT_CATEGORY_CLASSIFICATION_VERSION = 'movement-category:v4-periodic-window'

export type MovementCategoryThresholds = {
  fastMinIssueCount: number
  movingMinIssueCount: number
  movingMaxIssueCount: number
  slowIssueCount: number
  deadStockIssueCount: 0
}

export const MOVEMENT_CATEGORY_THRESHOLDS: MovementCategoryThresholds = {
  fastMinIssueCount: 6,
  movingMinIssueCount: 2,
  movingMaxIssueCount: 5,
  slowIssueCount: 1,
  deadStockIssueCount: 0,
}

export type MovementCategoryThresholdInput = Partial<{
  fastMinIssueCount: unknown
  movingMinIssueCount: unknown
  movingMaxIssueCount: unknown
  slowIssueCount: unknown
}>

const movementCategoryRanks = new Map<string, number>(
  MOVEMENT_CATEGORY_ORDER.map((category, index) => [category, index + 1]),
)

function numericValue(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function boundedIssueCount(value: unknown, fallback: number, min = 1, max = 999) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(Math.max(Math.trunc(numeric), min), max)
}

export function normalizeMovementCategoryThresholds(input: MovementCategoryThresholdInput = {}): MovementCategoryThresholds {
  const slowIssueCount = boundedIssueCount(input.slowIssueCount, MOVEMENT_CATEGORY_THRESHOLDS.slowIssueCount)
  const movingMinIssueCount = boundedIssueCount(
    input.movingMinIssueCount,
    MOVEMENT_CATEGORY_THRESHOLDS.movingMinIssueCount,
    slowIssueCount + 1,
  )
  const movingMaxIssueCount = boundedIssueCount(
    input.movingMaxIssueCount,
    MOVEMENT_CATEGORY_THRESHOLDS.movingMaxIssueCount,
    movingMinIssueCount,
  )
  const fastMinIssueCount = boundedIssueCount(
    input.fastMinIssueCount,
    MOVEMENT_CATEGORY_THRESHOLDS.fastMinIssueCount,
    movingMaxIssueCount + 1,
  )

  return {
    fastMinIssueCount,
    movingMinIssueCount,
    movingMaxIssueCount,
    slowIssueCount,
    deadStockIssueCount: MOVEMENT_CATEGORY_THRESHOLDS.deadStockIssueCount,
  }
}

export function movementCategoryThresholdLabel(thresholds: MovementCategoryThresholdInput = {}) {
  const normalized = normalizeMovementCategoryThresholds(thresholds)
  return `Fast >= ${normalized.fastMinIssueCount}, Moving ${normalized.movingMinIssueCount}-${normalized.movingMaxIssueCount}, Slow = ${normalized.slowIssueCount}, Dead/Stale = 0 issue`
}

export function normalizeMovementCategoryLabel(value: unknown): MovementCategory | string {
  const label = String(value ?? '').trim()
  if (label === LEGACY_NO_MOVEMENT_CATEGORY) return 'Stale'
  return (MOVEMENT_CATEGORY_ORDER as readonly string[]).includes(label) ? label : label
}

export function movementCategoryRank(value: unknown) {
  const label = normalizeMovementCategoryLabel(value)
  return movementCategoryRanks.get(String(label)) ?? Number.MAX_SAFE_INTEGER
}

export function movementCategoryFromIssueCount(
  issueCount: unknown,
  quantityClosing: unknown,
  thresholdsInput: MovementCategoryThresholdInput = {},
): MovementCategory {
  const thresholds = normalizeMovementCategoryThresholds(thresholdsInput)
  const count = Math.max(0, Math.trunc(numericValue(issueCount)))
  const quantity = numericValue(quantityClosing)

  if (count >= thresholds.fastMinIssueCount) return 'Fast Moving'
  if (count >= thresholds.movingMinIssueCount && count <= thresholds.movingMaxIssueCount) return 'Moving'
  if (count === thresholds.slowIssueCount) return 'Slow Moving'
  if (quantity > 0) return 'Dead Stock'
  return 'Stale'
}

export function movementCategorySqlCase(
  issueCountExpression: string,
  quantityExpression: string,
  thresholdsInput: MovementCategoryThresholdInput = {},
) {
  const thresholds = normalizeMovementCategoryThresholds(thresholdsInput)
  return `CASE
        WHEN ${issueCountExpression} >= ${thresholds.fastMinIssueCount} THEN 'Fast Moving'
        WHEN ${issueCountExpression} BETWEEN ${thresholds.movingMinIssueCount} AND ${thresholds.movingMaxIssueCount} THEN 'Moving'
        WHEN ${issueCountExpression} = ${thresholds.slowIssueCount} THEN 'Slow Moving'
        WHEN ${quantityExpression} > 0 THEN 'Dead Stock'
        ELSE 'Stale'
      END`
}

export function movementAnalysisSqlCase(
  issueCountExpression: string,
  quantityExpression: string,
  thresholdsInput: MovementCategoryThresholdInput = {},
) {
  const thresholds = normalizeMovementCategoryThresholds(thresholdsInput)
  return `CASE
        WHEN ${issueCountExpression} >= ${thresholds.fastMinIssueCount} THEN 'Fast Moving: issue docs >= ${thresholds.fastMinIssueCount} in window'
        WHEN ${issueCountExpression} BETWEEN ${thresholds.movingMinIssueCount} AND ${thresholds.movingMaxIssueCount} THEN 'Moving: issue docs ${thresholds.movingMinIssueCount}-${thresholds.movingMaxIssueCount} in window'
        WHEN ${issueCountExpression} = ${thresholds.slowIssueCount} THEN 'Slow Moving: issue docs = ${thresholds.slowIssueCount} in window'
        WHEN ${quantityExpression} > 0 THEN 'Dead Stock: no issue in window, ClosingQty > 0 (idle stock)'
        ELSE 'Stale: no issue in window, ClosingQty = 0 (empty/inactive — not idle stock)'
      END`
}

export function movementCategoryRankSqlCase(categoryExpression: string) {
  return `CASE ${categoryExpression}
        WHEN 'Fast Moving' THEN 1
        WHEN 'Moving' THEN 2
        WHEN 'Slow Moving' THEN 3
        WHEN 'Dead Stock' THEN 4
        WHEN 'Stale' THEN 5
        WHEN 'No Movement' THEN 5
        ELSE 9
      END`
}

export function isMovementCategoryField(value: unknown) {
  return String(value ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase() === 'movementcategory'
}

export function countMovementCategoryRows(
  rows: Array<Record<string, unknown>>,
  field = 'MovementCategory',
) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const category = String(normalizeMovementCategoryLabel(row[field]) || '(Kosong)')
    counts[category] = (counts[category] ?? 0) + 1
    return counts
  }, {})
}

export function buildMovementCategoryBalancedRows<T>(
  rows: T[],
  limit: number,
  getCategory: (row: T) => unknown,
  compareWithinCategory?: (left: T, right: T) => number,
) {
  const safeLimit = Math.max(0, Math.trunc(limit))
  if (safeLimit === 0) return []

  const groups = new Map<string, T[]>()
  rows.forEach((row) => {
    const category = String(normalizeMovementCategoryLabel(getCategory(row)) || '(Kosong)')
    const groupRows = groups.get(category) ?? []
    groupRows.push(row)
    groups.set(category, groupRows)
  })

  groups.forEach((groupRows) => {
    if (compareWithinCategory) groupRows.sort(compareWithinCategory)
  })

  const orderedGroups = [...groups.entries()]
    .sort(([left], [right]) => movementCategoryRank(left) - movementCategoryRank(right) || left.localeCompare(right))
    .map(([, groupRows]) => groupRows)
  const result: T[] = []
  const maxGroupLength = Math.max(0, ...orderedGroups.map((groupRows) => groupRows.length))

  for (let index = 0; index < maxGroupLength && result.length < safeLimit; index += 1) {
    for (const groupRows of orderedGroups) {
      const row = groupRows[index]
      if (row !== undefined) result.push(row)
      if (result.length >= safeLimit) break
    }
  }

  return result
}
