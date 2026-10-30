export type MonthlyStation = { id: string; name: string; city: string; address: string; monthCount: number }
export type MonthlySeries = { station: MonthlyStation; points: { month: string; meanPrice: number }[] }
export type MonthlyHistoryData = {
  year: number; fuelType: 'diesel' | 'e5' | 'e10'; aggregation: 'monthly_source_mean'; unit: 'EUR/l'
  sourceUrl: string; datasetVersion: number; licenseUrl: string; importedAt: string; series: MonthlySeries[]
}
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
export function validMonthlyStation(value: unknown): value is MonthlyStation {
  if (typeof value !== 'object' || value === null) return false
  const s = value as MonthlyStation
  return typeof s.id === 'string' && uuid.test(s.id) && typeof s.name === 'string' && typeof s.city === 'string' &&
    typeof s.address === 'string' && Number.isInteger(s.monthCount) && s.monthCount > 0 && s.monthCount <= 12
}
export function validMonthlyHistory(value: unknown, year: number, fuel: string, ids: string[]): value is MonthlyHistoryData {
  if (typeof value !== 'object' || value === null) return false
  const data = value as MonthlyHistoryData
  if (data.year !== year || data.fuelType !== fuel || data.aggregation !== 'monthly_source_mean' || data.unit !== 'EUR/l' ||
    data.sourceUrl !== 'https://www.kaggle.com/datasets/oles04/petrol-station-germany' ||
    data.licenseUrl !== 'https://creativecommons.org/licenses/by-nc-sa/4.0/' || data.datasetVersion !== 2 ||
    typeof data.importedAt !== 'string' || !Number.isFinite(Date.parse(data.importedAt)) || !Array.isArray(data.series) || data.series.length !== ids.length) return false
  const seen = new Set<string>()
  return data.series.every(series => {
    if (typeof series !== 'object' || series === null || !validMonthlyStation(series.station) ||
      !ids.includes(series.station.id) || seen.has(series.station.id) || !Array.isArray(series.points) ||
      series.points.length !== series.station.monthCount) return false
    seen.add(series.station.id)
    let last = ''
    return series.points.every(point => {
      if (typeof point !== 'object' || point === null || typeof point.month !== 'string' ||
        !new RegExp(`^${year}-(0[1-9]|1[0-2])-01$`).test(point.month) || point.month <= last ||
        typeof point.meanPrice !== 'number' || !Number.isFinite(point.meanPrice) || point.meanPrice <= 0 || point.meanPrice >= 20) return false
      last = point.month; return true
    })
  })
}
export function monthlyChartData(series: MonthlySeries[], year: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}-01`
    const row: Record<string, string | number | null> = { month, label: new Date(month + 'T00:00:00Z').toLocaleDateString('de-DE', { timeZone: 'UTC', month: 'short' }) }
    series.forEach((entry, number) => { row[`price${number}`] = entry.points.find(point => point.month === month)?.meanPrice ?? null })
    return row
  })
}
