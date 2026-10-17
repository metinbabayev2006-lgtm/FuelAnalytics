import assert from 'node:assert/strict'
import test from 'node:test'
import { readFavorites, routeUrl, toggleFavorite } from '../src/stationActions.ts'
import { historyCsv } from '../src/historyCsv.ts'
import { createDemoResult, demoHistoryLoader } from '../src/demoData.ts'

const station = { id: 'synthetic-a', name: '=HYPERLINK("https://example.invalid")', street: 'Muster; Straße', houseNumber: '1', place: 'Fiktiv', latitude: 51.93, longitude: 8.87 }
const from = '2026-10-16T00:00:00Z', to = '2026-10-18T00:00:00Z'
const point = { stationId: station.id, fuelType: 'e10', price: 1.759, observedAt: '2026-10-17T12:00:00Z' }

test('route links encode only destination coordinates and never carry a user origin or credentials', () => {
  const url = new URL(routeUrl(station)!)
  assert.equal(url.origin + url.pathname, 'https://www.google.com/maps/dir/')
  assert.deepEqual(Object.fromEntries(url.searchParams), { api: '1', destination: '51.93,8.87', travelmode: 'driving' })
  for (const invalid of [{ latitude: NaN, longitude: 1 }, { latitude: 91, longitude: 1 }, { latitude: 1, longitude: Infinity }, { latitude: 1, longitude: -181 }]) assert.equal(routeUrl(invalid), null)
})

test('favorites round trip metadata only, deduplicate by ID and remove without mutating input', () => {
  const extra = { ...station, prices: { e10: 1.759 }, observedAt: to }
  const list = toggleFavorite([], extra)
  assert.deepEqual(list, [station])
  assert.deepEqual(readFavorites(JSON.stringify(list)), [station])
  assert.deepEqual(toggleFavorite(list, station), [])
  assert.deepEqual(list, [station])
  assert.deepEqual(readFavorites(null), [])
})

test('invalid, duplicate or excessive saved favorites are rejected', () => {
  for (const raw of ['{', '{}', JSON.stringify([station, station]), JSON.stringify([{ ...station, latitude: 100 }]), JSON.stringify([{ ...station, name: null }])]) assert.throws(() => readFavorites(raw))
  const full = Array.from({ length: 50 }, (_, index) => ({ ...station, id: String(index) }))
  assert.throws(() => toggleFavorite(full, station), /50/)
  assert.equal(toggleFavorite(full, full[0]).length, 49)
})

test('CSV is Excel-friendly, quotes delimiters and neutralizes spreadsheet formula fields', () => {
  const csv = historyCsv([{ station, prices: [point] }], from, to)!
  assert.ok(csv.startsWith('\uFEFF"Datenart";'))
  assert.ok(csv.includes('"1,759"'))
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.invalid"")"'))
  assert.ok(csv.includes('"Muster; Straße 1 Fiktiv"'))
  assert.ok(csv.includes('"2026-10-17T12:00:00.000Z"'))
  assert.ok(csv.includes(`"${from}";"${to}"`))
  assert.ok(csv.endsWith('\r\n'))
  for (const name of ['+cmd', '-cmd', '@SUM(1)', '\t=1', '\r\n=1']) {
    const safe = historyCsv([{ station: { ...station, name }, prices: [point] }], from, to)!
    assert.ok(safe.includes(`"'${name}"`))
  }
})

test('CSV sorts actual observations, excludes failed series, labels demo and has no empty export', () => {
  assert.equal(historyCsv([], from, to), null)
  assert.equal(historyCsv([{ station, prices: [point], error: 'failed' }], from, to), null)
  const csv = historyCsv([{ station, prices: [{ ...point, observedAt: '2026-10-17T14:00:00Z' }, point] }], from, to, true)!
  assert.ok(csv.indexOf('12:00:00.000Z') < csv.indexOf('14:00:00.000Z'))
  assert.ok(csv.includes('SYNTHETISCH'))
  assert.ok(!csv.includes('Tankerkönig / MTS-K'))
})

test('demo histories are synthetic, obey interval and fuel selection and need no requests', async () => {
  const result = createDemoResult(Date.parse('2026-10-17T15:00:00Z'))
  assert.ok(result.stations.every(entry => entry.station.name.includes('fiktiv')))
  const load = demoHistoryLoader(result)
  const signal = new AbortController().signal
  const station = result.stations[0].station
  const data = await load(station, 'e10', from, to, signal)
  assert.equal(data.prices.length, 3)
  assert.equal(data.prices.at(-1)!.price, result.stations[0].prices.e10)
  assert.ok(data.prices.every(point => point.fuelType === 'e10' && Date.parse(point.observedAt) >= Date.parse(from) && Date.parse(point.observedAt) < Date.parse(to)))
  const missing = await load(result.stations[2].station, 'e5', from, to, signal)
  assert.deepEqual(missing.prices, [])
  const controller = new AbortController(); controller.abort()
  assert.ok((await load(station, 'diesel', from, to, controller.signal)).error)
})
