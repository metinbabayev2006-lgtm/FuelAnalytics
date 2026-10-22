import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validEnergyResult } from '../src/energyTypes.ts'
const fixture = () => ({ fetchedAt: '2026-10-22T12:00:00Z', kind: 'electric', truncated: false, stations: [
  { id: 'osm:node:1', name: '<script>', latitude: 52, longitude: 9, distanceKm: 0,
    address: '', services: ['Elektro'], openingHours: null, access: null, connectors: ['CCS · 150 kW'] },
] })
test('validates electric and gas location results without inventing prices', () => {
  assert.equal(validEnergyResult(fixture()), true)
  const gas = fixture(); gas.kind = 'gas'; gas.stations[0].services = ['LPG', 'CNG']
  assert.equal(validEnergyResult(gas), true)
})
test('rejects invalid coordinates, identifiers and mixed energy categories', () => {
  const coordinates = fixture(); coordinates.stations[0].latitude = 200
  assert.equal(validEnergyResult(coordinates), false)
  const identifier = fixture(); identifier.stations[0].id = 'javascript:alert(1)'
  assert.equal(validEnergyResult(identifier), false)
  const services = fixture(); services.stations[0].services = ['LPG']
  assert.equal(validEnergyResult(services), false)
  assert.equal(validEnergyResult({ ...fixture(), fetchedAt: 'not-a-date' }), false)
})
