import assert from 'node:assert/strict'
import test from 'node:test'
import { comparisonRows, historyStatistics, loadHistorySeries, toggleComparison, validateHistory } from '../src/historyComparison.ts'
import type { Observation } from '../src/historyComparison.ts'

const from = '2026-10-16T00:00:00Z'
const to = '2026-10-17T00:00:00Z'
const point = (stationId: string, hour: number, price = 1.799): Observation => ({ stationId, fuelType: 'e10', price, observedAt: `2026-10-16T${String(hour).padStart(2, '0')}:00:00Z` })

test('history statistics count repeated samples equally without time weighting or input mutation', () => {
  const prices = [point('a', 23, 1.899), point('a', 0, 1.799), point('a', 1, 1.799)]
  const snapshot = structuredClone(prices)
  const stats = historyStatistics(prices)!
  assert.equal(stats.count, 3)
  assert.equal(stats.min, 1.799)
  assert.equal(stats.max, 1.899)
  assert.ok(Math.abs(stats.mean - (1.899 + 1.799 + 1.799) / 3) < 1e-12)
  assert.equal(stats.first, Date.parse(point('a', 0).observedAt))
  assert.equal(stats.last, Date.parse(point('a', 23).observedAt))
  assert.deepEqual(prices, snapshot)
})

test('empty histories have no statistics and a single sample has equal price metrics', () => {
  assert.equal(historyStatistics([]), null)
  const stats = historyStatistics([point('a', 8, 1.739)])!
  assert.equal(stats.count, 1)
  assert.equal(stats.min, 1.739)
  assert.equal(stats.mean, 1.739)
  assert.equal(stats.max, 1.739)
  assert.equal(stats.first, stats.last)
})

test('merges actual timestamps without filling missing prices or inserting zeros', () => {
  const series = [
    { station: { id: 'a', name: 'Synthetic A' }, prices: [point('a', 12), point('a', 8)] },
    { station: { id: 'b', name: 'Synthetic B' }, prices: [point('b', 10, 1.899), point('b', 12, 1.859)] },
  ]
  const snapshot = structuredClone(series)
  const rows = comparisonRows(series)
  assert.equal(rows.length, 3)
  assert.deepEqual(rows[0], { timestamp: Date.parse(point('a', 8).observedAt), series0: 1.799 })
  assert.deepEqual(rows[1], { timestamp: Date.parse(point('b', 10).observedAt), series1: 1.899 })
  assert.deepEqual(rows[2], { timestamp: Date.parse(point('b', 12).observedAt), series0: 1.799, series1: 1.859 })
  assert.deepEqual(series, snapshot)
})

test('empty and failed series do not shift the identifiers of remaining lines', () => {
  const rows = comparisonRows([
    { station: { id: 'a', name: 'Synthetic A' }, prices: [], error: 'Synthetic failure' },
    { station: { id: 'b', name: 'Synthetic B' }, prices: [point('b', 8)] },
  ])
  assert.equal(rows[0].series1, 1.799)
  assert.equal(Object.hasOwn(rows[0], 'series0'), false)
  assert.deepEqual(comparisonRows([]), [])
})

test('comparison selection limits extras to two and allows removing/replacing one', () => {
  assert.deepEqual(toggleComparison(['a', 'b'], 'c'), ['a', 'b'])
  assert.deepEqual(toggleComparison(['a', 'b'], 'a'), ['b'])
  assert.deepEqual(toggleComparison(['b'], 'c'), ['b', 'c'])
  assert.deepEqual(toggleComparison(['a'], 'a'), [])
})

test('validates identity, fuel, prices, interval and duplicate timestamps', () => {
  const good = point('a', 8)
  const invalid: unknown[] = [null, {}, [null], [{ ...good, stationId: 'b' }], [{ ...good, fuelType: 'diesel' }],
    [{ ...good, price: 0 }], [{ ...good, price: Infinity }], [{ ...good, observedAt: 'invalid' }],
    [{ ...good, observedAt: to }], [{ ...good, observedAt: '2026-10-15T23:00:00Z' }], [good, { ...good }]]
  for (const data of invalid) assert.throws(() => validateHistory(data, 'a', 'e10', from, to))
  assert.deepEqual(validateHistory([], 'a', 'e10', from, to), [])
})

test('normalizes ordering and includes the interval start while excluding its end', () => {
  const points = [point('a', 12), point('a', 0)]
  const snapshot = structuredClone(points)
  assert.deepEqual(validateHistory(points, 'a', 'e10', from, to).map(row => row.observedAt), [point('a', 0).observedAt, point('a', 12).observedAt])
  assert.deepEqual(points, snapshot)
  assert.throws(() => validateHistory([point('a', 0), { ...point('a', 0), observedAt: '2026-10-16T02:00:00+02:00' }], 'a', 'e10', from, to))
})

test('partial request failure retains the successful station and shares query bounds', async () => {
  const urls: string[] = []
  const request: typeof fetch = async input => {
    const url = String(input); urls.push(url)
    return url.includes('/a/') ? new Response(JSON.stringify([point('a', 8)])) : new Response('', { status: 500 })
  }
  const signal = new AbortController().signal
  const result = await Promise.all(['a', 'b'].map(id => loadHistorySeries({ id, name: 'Synthetic ' + id }, 'e10', from, to, signal, request)))
  assert.equal(result[0].prices.length, 1)
  assert.equal(result[0].error, undefined)
  assert.equal(result[1].prices.length, 0)
  assert.ok(result[1].error)
  for (const url of urls) {
    const params = new URL(url, 'http://localhost').searchParams
    assert.equal(params.get('from'), from)
    assert.equal(params.get('to'), to)
    assert.equal(params.get('fuelType'), 'e10')
  }
})

test('invalid provider JSON and aborted history requests return explicit failures', async () => {
  const station = { id: 'a', name: 'Synthetic A' }
  const signal = new AbortController().signal
  const malformed = await loadHistorySeries(station, 'e10', from, to, signal, async () => new Response('{'))
  assert.ok(malformed.error)
  assert.deepEqual(malformed.prices, [])
  const controller = new AbortController(); controller.abort()
  const aborted = await loadHistorySeries(station, 'e10', from, to, controller.signal, async () => { throw new Error('Synthetic abort') })
  assert.match(aborted.error!, /abgebrochen/)
})
