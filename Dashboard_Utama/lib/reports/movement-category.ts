export const MOVEMENT_CATEGORY_ORDER = [
  'Fast Moving',
  'Moving',
  'Slow Moving',
  'Dead Stock',
  'Stale',
] as const

export type MovementCategory = (typeof MOVEMENT_CATEGORY_ORDER)[number]

export const LEGACY_NO_MOVEMENT_CATEGORY = 'No Movement'

const movementCategoryRanks = new Map<string, number>(
  MOVEMENT_CATEGORY_ORDER.map((category, index) => [category, index + 1]),
)

function numericValue(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
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

export function movementCategoryFromIssueCount(issueCount: unknown, quantityClosing: unknown): MovementCategory {
  const count = Math.max(0, Math.trunc(numericValue(issueCount)))
  const quantity = numericValue(quantityClosing)

  if (count >= 6) return 'Fast Moving'
  if (count >= 2) return 'Moving'
  if (count === 1) return 'Slow Moving'
  if (quantity > 0) return 'Dead Stock'
  return 'Stale'
}

export function movementCategorySqlCase(issueCountExpression: string, quantityExpression: string) {
  return `CASE
        WHEN ${issueCountExpression} >= 6 THEN 'Fast Moving'
        WHEN ${issueCountExpression} BETWEEN 2 AND 5 THEN 'Moving'
        WHEN ${issueCountExpression} = 1 THEN 'Slow Moving'
        WHEN ${quantityExpression} > 0 THEN 'Dead Stock'
        ELSE 'Stale'
      END`
}

export function movementAnalysisSqlCase(issueCountExpression: string, quantityExpression: string) {
  return `CASE
        WHEN ${issueCountExpression} >= 6 THEN 'Fast Moving: StockIssue Movement >= 6'
        WHEN ${issueCountExpression} BETWEEN 2 AND 5 THEN 'Moving: StockIssue Movement 2-5'
        WHEN ${issueCountExpression} = 1 THEN 'Slow Moving: StockIssue Movement 1'
        WHEN ${quantityExpression} > 0 THEN 'Dead Stock: stok ada, StockIssue Movement 0'
        ELSE 'Stale: stok dan StockIssue Movement 0'
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
