import assert from 'node:assert/strict'
import {
  accountingActualPeriodSelectSql,
  accountingMonthToActualMonth,
  accountingToActualPeriod,
  actualPeriodBounds,
  actualToAccountingPeriod,
  currentActualPeriodJakarta,
  isClosedActualPeriod,
} from './accounting-period'

assert.equal(accountingMonthToActualMonth(1), 4)
assert.equal(accountingMonthToActualMonth('8 '), 11)
assert.equal(accountingMonthToActualMonth('09'), 12)
assert.equal(accountingMonthToActualMonth(12), 3)
assert.equal(accountingMonthToActualMonth(13), null)

assert.deepEqual(accountingToActualPeriod(2027, 1), {
  accYear: 2027,
  accMonth: 1,
  actualYear: 2026,
  actualMonth: 4,
  actualPeriod: '2026-04',
  actualPeriodStart: '2026-04-01',
})

assert.deepEqual(accountingToActualPeriod('2027', '12'), {
  accYear: 2027,
  accMonth: 12,
  actualYear: 2027,
  actualMonth: 3,
  actualPeriod: '2027-03',
  actualPeriodStart: '2027-03-01',
})

assert.deepEqual(actualToAccountingPeriod(2026, 4), {
  actualYear: 2026,
  actualMonth: 4,
  accYear: 2027,
  accMonth: 1,
  accountingPeriod: '2027-01',
})

assert.deepEqual(actualToAccountingPeriod('2027', '03'), {
  actualYear: 2027,
  actualMonth: 3,
  accYear: 2027,
  accMonth: 12,
  accountingPeriod: '2027-12',
})

assert.deepEqual(actualPeriodBounds(2026, 7), {
  startInclusive: '2026-07-01',
  endExclusive: '2026-08-01',
})

assert.deepEqual(actualPeriodBounds(2026, 12), {
  startInclusive: '2026-12-01',
  endExclusive: '2027-01-01',
})

const selectSql = accountingActualPeriodSelectSql({
  accYearExpression: 'AccYear',
  accMonthExpression: 'AccMonth',
  actualPeriodAlias: 'PeriodeAktual',
})

assert.match(selectSql, /AS ActualYear/)
assert.match(selectSql, /AS ActualMonth/)
assert.match(selectSql, /AS PeriodeAktual/)
assert.match(selectSql, /AS ActualPeriodStart/)
assert.match(selectSql, /BETWEEN 1 AND 9 THEN/)
assert.match(selectSql, /\+ 2\) % 12\) \+ 1/)

// isClosedActualPeriod — acuan waktu tetap: 23 Juli 2026 (UTC 12:00 = 19:00 WIB).
const NOW_JUL_2026 = new Date('2026-07-23T12:00:00Z')
assert.equal(currentActualPeriodJakarta(NOW_JUL_2026).period, '2026-07')

assert.equal(isClosedActualPeriod(2026, 6, NOW_JUL_2026), true) // Juni 2026 = closed
assert.equal(isClosedActualPeriod(2025, 12, NOW_JUL_2026), true) // tahun lalu = closed
assert.equal(isClosedActualPeriod('2026', '06', NOW_JUL_2026), true) // string input
assert.equal(isClosedActualPeriod(2026, 7, NOW_JUL_2026), false) // bulan berjalan = live
assert.equal(isClosedActualPeriod(2026, 8, NOW_JUL_2026), false) // masa depan = live
assert.equal(isClosedActualPeriod(2027, 1, NOW_JUL_2026), false) // tahun depan = live
assert.equal(isClosedActualPeriod(null, 6, NOW_JUL_2026), false) // invalid = live (aman)
assert.equal(isClosedActualPeriod(2026, 13, NOW_JUL_2026), false) // invalid = live

// Batas pergantian tahun: Desember tahun lalu = closed saat sekarang Januari.
const NOW_JAN_2027 = new Date('2027-01-05T03:00:00Z') // 10:00 WIB
assert.equal(currentActualPeriodJakarta(NOW_JAN_2027).period, '2027-01')
assert.equal(isClosedActualPeriod(2026, 12, NOW_JAN_2027), true)
assert.equal(isClosedActualPeriod(2027, 1, NOW_JAN_2027), false)
