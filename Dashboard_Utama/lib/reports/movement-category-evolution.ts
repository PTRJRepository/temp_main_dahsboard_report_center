import {
  MOVEMENT_CATEGORY_ORDER,
  movementCategoryFromIssueCount,
  type MovementCategory,
  type MovementCategoryThresholds,
} from './movement-category'

export type CategoryEvolutionPoint = {
  period: string
  categories: Record<
    MovementCategory,
    { count: number; qty: number; amount: number }
  >
}

export type MovementMover = {
  code: string
  name: string
  fromCategory: MovementCategory
  toCategory: MovementCategory
  firstPeriod: string
  lastPeriod: string
  totalQty: number
  totalAmount: number
}

export type CategoryEvolutionResult = {
  byPeriod: CategoryEvolutionPoint[]
  movers: MovementMover[]
  totals: { qty: number; amount: number; docs: number; itemCount: number }
}

type MatrixRow = {
  code: string
  name: string
  cells: { qty: number[]; amount: number[]; docs: number[] }
}

function emptyCategories(): Record<MovementCategory, { count: number; qty: number; amount: number }> {
  return {
    'Fast Moving': { count: 0, qty: 0, amount: 0 },
    Moving: { count: 0, qty: 0, amount: 0 },
    'Slow Moving': { count: 0, qty: 0, amount: 0 },
    'Dead Stock': { count: 0, qty: 0, amount: 0 },
  }
}

export function buildCategoryEvolutionFromMatrix(
  rows: MatrixRow[],
  periods: string[],
  thresholds: MovementCategoryThresholds,
): CategoryEvolutionResult {
  const byPeriod = periods.map((period) => ({
    period,
    categories: emptyCategories(),
  }))

  const movers: MovementMover[] = []
  let totalQty = 0
  let totalAmount = 0
  let totalDocs = 0

  for (const row of rows) {
    const itemPeriods: { period: string; category: MovementCategory; qty: number; amount: number; docs: number }[] = []
    let totalItemQty = 0
    let totalItemAmount = 0

    for (let i = 0; i < periods.length; i += 1) {
      const docs = row.cells.docs[i] ?? 0
      const qty = row.cells.qty[i] ?? 0
      const amount = row.cells.amount[i] ?? 0
      const category = movementCategoryFromIssueCount(docs, 0, thresholds)

      byPeriod[i].categories[category].count += 1
      byPeriod[i].categories[category].qty += qty
      byPeriod[i].categories[category].amount += amount

      totalQty += qty
      totalAmount += amount
      totalDocs += docs
      totalItemQty += qty
      totalItemAmount += amount

      itemPeriods.push({ period: periods[i], category, qty, amount, docs })
    }

    const active = itemPeriods.filter((p) => p.category !== 'Dead Stock')
    if (active.length >= 2) {
      const first = active[0]
      const last = active[active.length - 1]
      if (first.category !== last.category) {
        movers.push({
          code: row.code,
          name: row.name,
          fromCategory: first.category,
          toCategory: last.category,
          firstPeriod: first.period,
          lastPeriod: last.period,
          totalQty: totalItemQty,
          totalAmount: totalItemAmount,
        })
      }
    }
  }

  return {
    byPeriod,
    movers,
    totals: {
      qty: totalQty,
      amount: totalAmount,
      docs: totalDocs,
      itemCount: rows.length,
    },
  }
}
