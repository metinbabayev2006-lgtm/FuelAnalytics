export type LpgPoint = { date: string; price: number }
export type LpgSeries = { country: 'DE'; fuel: 'lpg'; unit: 'EUR/l'; taxesIncluded: true; source: string; sourceUrl: string; importedAt: string; points: LpgPoint[] }
export type OpenVanLpg = { price: number; currency: 'EUR'; unit: 'liter'; sourceFetchedAt: string; retrievedAt: string }
const price = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 20
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
export function validLpgSeries(value: unknown): value is LpgSeries {
  if (!object(value) || value.country !== 'DE' || value.fuel !== 'lpg' || value.unit !== 'EUR/l' || value.taxesIncluded !== true ||
      typeof value.source !== 'string' || value.sourceUrl !== 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en' ||
      !timestamp(value.importedAt) || !Array.isArray(value.points) || value.points.length === 0) return false
  let previous = ''
  return value.points.every(row => {
    if (!object(row) || typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
        !timestamp(row.date) || new Date(row.date).toISOString().slice(0, 10) !== row.date || row.date <= previous || !price(row.price)) return false
    previous = row.date; return true
  })
}
export function validOpenVanLpg(value: unknown): value is OpenVanLpg {
  return object(value) && price(value.price) && value.currency === 'EUR' && value.unit === 'liter' && timestamp(value.sourceFetchedAt) && timestamp(value.retrievedAt)
}
export function lpgStatistics(points: readonly LpgPoint[]) {
  if (!points.length) return null
  const values = points.map(point => point.price)
  return { min: Math.min(...values), max: Math.max(...values), mean: values.reduce((a, b) => a + b, 0) / values.length, count: values.length }
}
/** Periods are anchored to the latest official reference date, not the local retrieval date. */
export function lpgPeriod(points: readonly LpgPoint[], years: number) {
  if (!points.length || years === 0) return [...points]
  const end = new Date(points[points.length - 1].date + 'T00:00:00Z')
  end.setUTCFullYear(end.getUTCFullYear() - years)
  return points.filter(point => Date.parse(point.date + 'T00:00:00Z') >= end.getTime())
}
