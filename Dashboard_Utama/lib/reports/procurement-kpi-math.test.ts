import assert from 'node:assert/strict'
import {
  frequencyPerDay,
  netFlowAmount,
  percentOf,
  poFillRate,
  returnRate,
  riskCount,
  usageIntensity,
} from './procurement-kpi-math'

// NetFlow = Receive − Issue + Return (signed)
assert.equal(netFlowAmount(100, 60, 5), 45)
assert.equal(netFlowAmount(50, 80, 0), -30)
assert.equal(netFlowAmount(0, 0, 0), 0)

// FreqPerDay = Events / ActiveDays; aman saat 0 hari
assert.equal(frequencyPerDay(120, 20), 6)
assert.equal(frequencyPerDay(50, 0), 0)
assert.equal(frequencyPerDay(0, 10), 0)

// ReturnRate = Return / Issue (fraksi)
assert.equal(returnRate(10, 200), 0.05)
assert.equal(returnRate(0, 100), 0)
assert.equal(returnRate(5, 0), 0)

// POFillRate = QtyReceive / QtyOrder
assert.equal(poFillRate(80, 100), 0.8)
assert.equal(poFillRate(0, 0), 0)
assert.equal(poFillRate(100, 100), 1)

// UsageIntensity = Issue / StockValue
assert.equal(usageIntensity(25, 500), 0.05)
assert.equal(usageIntensity(10, 0), 0)

// RiskCount = Slow + Dead + Stale (abaikan NaN)
assert.equal(riskCount(3, 2, 5), 10)
assert.equal(riskCount(NaN, 1, 2), 3)

// percentOf (0..100)
assert.equal(percentOf(1, 4), 25)
assert.equal(percentOf(1, 0), 0)

console.log('OK procurement-kpi-math tests')
