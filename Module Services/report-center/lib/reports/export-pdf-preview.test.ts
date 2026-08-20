import assert from 'node:assert/strict'
import {
  activeFilterText,
  pickPdfColumns,
  safeFilePart,
  shortText,
  isNumericValue,
} from './export-pdf-preview'

assert.equal(safeFilePart('Stok Gudang / A'), 'stok-gudang-a')
assert.equal(shortText('abcdefghij', 6), 'abcde…')
assert.equal(activeFilterText({}), 'all')
assert.equal(activeFilterText({ ItemType: [1, 4], AccYear: 2026, empty: '' }), 'ItemType=1,4 · AccYear=2026')
assert.equal(isNumericValue(12.5), true)
assert.equal(isNumericValue('1.234'), true)
assert.equal(isNumericValue('ABC'), false)

const cols = [
  'Notes',
  'ItemCode',
  'LongRemark',
  'QtyOnHand',
  'Foo',
  'Amount',
  'LocCode',
  'Bar',
  'Baz',
  'Qux',
  'Extra',
]
const picked = pickPdfColumns(cols, 6)
assert.ok(picked.includes('ItemCode'))
assert.ok(picked.includes('QtyOnHand'))
assert.ok(picked.includes('Amount'))
assert.ok(picked.includes('LocCode'))
assert.equal(picked.length, 6)
// original relative order preserved among survivors
assert.deepEqual(
  picked,
  cols.filter((c) => picked.includes(c)),
)

console.log('export-pdf-preview.test.ts: ok')
