import assert from 'node:assert/strict'
import test from 'node:test'
import { fillCostCents, parseTankVolume } from '../src/tankCosts.ts'

test('accepts German and decimal-point litres without losing a tenth', () => {
  assert.equal(parseTankVolume('40'), 400)
  assert.equal(parseTankVolume(' 35,5 '), 355)
  assert.equal(parseTankVolume('35.5'), 355)
  assert.equal(parseTankVolume('0,1'), 1)
  assert.equal(parseTankVolume('200'), 2000)
})

test('rejects empty, partial, out-of-range and over-precise amounts', () => {
  for (const value of ['', ' ', '0', '-10', '200,1', '201', '1.23', '1e2', 'Infinity', 'abc', '35,', '1,2.3']) {
    assert.equal(parseTankVolume(value), null, value)
  }
})

test('computes complete fills and decimal quantities in integer cents', () => {
  assert.equal(fillCostCents(1.799, 400), 7196)
  assert.equal(fillCostCents(1.799, 355), 6386)
  assert.equal(fillCostCents(1.005, 10), 101)
  assert.equal(fillCostCents(2.299, 2000), 45980)
})

test('differences use rounded complete fills rather than rounded per-litre differences', () => {
  const cheapest = fillCostCents(1.704, 355)!
  const expensive = fillCostCents(1.705, 355)!
  assert.equal(cheapest, 6049)
  assert.equal(expensive, 6053)
  assert.equal(expensive - cheapest, 4)
  assert.equal(fillCostCents(1.705, 355)! - expensive, 0)
})

test('unavailable prices and invalid volumes never produce a cost', () => {
  for (const price of [undefined, 0, -1, NaN, Infinity]) assert.equal(fillCostCents(price, 400), null)
  for (const volume of [null, 0, -1, 1.5, 2001, NaN]) assert.equal(fillCostCents(1.799, volume), null)
  assert.equal(fillCostCents(Number.MAX_VALUE, 400), null)
})
