import assert from 'node:assert'
import { buildCategoryEvolutionFromMatrix } from './movement-category-evolution'
import { MOVEMENT_CATEGORY_THRESHOLDS } from './movement-category'

const rows = [
  {
    code: 'A001',
    name: 'Alpha',
    cells: {
      qty: [10, 20, 30],
      amount: [100, 200, 300],
      docs: [1, 3, 7],
      // Stock valuation (preferred for Amount composition)
      valuation: [1000, 1100, 1200],
    },
  },
  {
    code: 'B002',
    name: 'Beta',
    cells: {
      qty: [0, 5, 0],
      amount: [0, 50, 0],
      docs: [0, 1, 0],
      valuation: [500, 480, 450],
    },
  },
]

const result = buildCategoryEvolutionFromMatrix(rows, ['2024-01', '2024-02', '2024-03'], MOVEMENT_CATEGORY_THRESHOLDS)

assert.strictEqual(result.byPeriod.length, 3)
assert.strictEqual(result.byPeriod[0].categories['Slow Moving'].count, 1)
assert.strictEqual(result.byPeriod[1].categories['Moving'].count, 1)
assert.strictEqual(result.byPeriod[2].categories['Fast Moving'].count, 1)
// Amount uses valuation, not issue amount
assert.strictEqual(result.byPeriod[0].categories['Slow Moving'].amount, 1000)
assert.strictEqual(result.byPeriod[0].categories['Dead Stock'].amount, 500)
assert.strictEqual(result.byPeriod[2].categories['Fast Moving'].amount, 1200)
assert.strictEqual(result.movers.length, 1)
assert.strictEqual(result.movers[0].code, 'A001')
assert.strictEqual(result.movers[0].fromCategory, 'Slow Moving')
assert.strictEqual(result.movers[0].toCategory, 'Fast Moving')
assert.strictEqual(result.totals.qty, 65)
assert.strictEqual(result.totals.amount, 1000 + 1100 + 1200 + 500 + 480 + 450)
assert.strictEqual(result.totals.docs, 12)

// Fallback: no valuation → use issue amount
const fallback = buildCategoryEvolutionFromMatrix(
  [{ code: 'C', name: 'C', cells: { qty: [1], amount: [99], docs: [1] } }],
  ['2024-01'],
  MOVEMENT_CATEGORY_THRESHOLDS,
)
assert.strictEqual(fallback.byPeriod[0].categories['Slow Moving'].amount, 99)

console.log('movement-category-evolution helper tests passed')
