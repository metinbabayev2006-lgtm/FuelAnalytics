import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizePrices } from '../src/priceStatistics.ts'

const entry = (id: string, price?: number, open = true) => ({
  station: { id, name: `Synthetische Tankstelle ${id}` }, open, prices: { e10: price },
})

test('excludes closed stations and missing or invalid prices from all statistics', () => {
  const result = summarizePrices([
    entry('a', 1.799), entry('b', 1.899), entry('closed', 1.2, false),
    entry('missing'), entry('invalid', NaN), entry('zero', 0), entry('negative', -1),
  ], 'e10')!
  assert.equal(result.count, 2)
  assert.equal(result.min, 1.799)
  assert.equal(result.max, 1.899)
  assert.equal(result.average, 1.849)
  assert.equal(result.spread, 0.1)
  assert.deepEqual(result.cheapest.map(station => station.id), ['a'])
})

test('preserves tied cheapest stations and does not change input order', () => {
  const entries = [entry('expensive', 1.9), entry('a', 1.799), entry('b', 1.799)]
  const snapshot = structuredClone(entries)
  assert.deepEqual(summarizePrices(entries, 'e10')!.cheapest.map(station => station.id), ['a', 'b'])
  assert.deepEqual(entries, snapshot)
})

test('returns no comparison when there are no eligible prices for the selected fuel', () => {
  assert.equal(summarizePrices([], 'e10'), null)
  assert.equal(summarizePrices([entry('closed', 1.799, false)], 'e10'), null)
  assert.equal(summarizePrices([entry('e10-only', 1.799)], 'diesel'), null)
})

test('a single price has zero spread and is its own average', () => {
  const result = summarizePrices([entry('a', 1.789)], 'e10')!
  assert.equal(result.count, 1)
  assert.equal(result.average, 1.789)
  assert.equal(result.spread, 0)
})

test('fuel selection changes the comparison and averages are not rounded prematurely', () => {
  const entries = [
    { ...entry('a', 1.799), prices: { e10: 1.799, diesel: 1.699 } },
    { ...entry('b', 1.799), prices: { e10: 1.799, diesel: 1.7 } },
  ]
  assert.equal(summarizePrices(entries, 'diesel')!.average, 1.6995)
  assert.equal(summarizePrices(entries, 'diesel')!.spread, 0.001)
  assert.equal(summarizePrices(entries, 'e10')!.spread, 0)
})
