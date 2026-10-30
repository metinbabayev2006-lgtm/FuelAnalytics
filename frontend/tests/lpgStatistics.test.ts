import { expect, test } from 'vitest'
import { lpgPeriod, lpgStatistics, validLpgSeries, validOpenVanLpg } from '../src/lpgStatistics'
const points = [{ date: '2020-01-01', price: 0.6 }, { date: '2026-10-19', price: 1.09525 }, { date: '2026-10-26', price: 1.13025 }]
test('filters from last official reference date and averages only existing weeks', () => {
  const filtered = lpgPeriod(points, 1)
  expect(filtered).toHaveLength(2)
  expect(lpgStatistics(filtered)).toEqual({ min: 1.09525, max: 1.13025, mean: (1.09525 + 1.13025) / 2, count: 2 })
  expect(lpgPeriod(points, 0)).toEqual(points)
  expect(lpgStatistics([])).toBeNull()
})
test('requires chronological LPG data with verified country, unit and source', () => {
  const data = { country: 'DE', fuel: 'lpg', unit: 'EUR/l', taxesIncluded: true, source: 'EU', sourceUrl: 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en', importedAt: '2026-10-30T12:00:00Z', points }
  expect(validLpgSeries(data)).toBe(true)
  expect(validLpgSeries({ ...data, points: [...points].reverse() })).toBe(false)
  expect(validLpgSeries({ ...data, points: [{ date: '2026-02-30', price: 1 }] })).toBe(false)
  expect(validLpgSeries({ ...data, unit: 'EUR/kg' })).toBe(false)
  expect(validLpgSeries({ ...data, points: [{ date: '2026-01-01', price: null }] })).toBe(false)
})
test('missing CNG or wrong OpenVan units cannot become LPG prices', () => {
  const value = { price: 1.095, currency: 'EUR', unit: 'liter', sourceFetchedAt: '2026-10-26T12:00:00Z', retrievedAt: '2026-10-30T12:00:00Z' }
  expect(validOpenVanLpg(value)).toBe(true)
  for (const invalid of [{ ...value, price: null }, { ...value, price: 0 }, { ...value, currency: 'USD' }, { ...value, unit: 'kg' }])
    expect(validOpenVanLpg(invalid)).toBe(false)
})
