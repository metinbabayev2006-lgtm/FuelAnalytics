import { validMonthlyStation } from './monthlyHistory'
import type { MonthlyStation } from './monthlyHistory'
export type ArchiveStatus = { available: boolean; periodStart: string; periodEnd: string; sourceUrl: string; licenseUrl: string; importedAt: string; downloadedDays: number; cities: string[] }
export type ArchivePoint = { month: string; meanPrice: number | null; knownSeconds: number; totalSeconds: number }
export type ArchiveSeries = { station: MonthlyStation; points: ArchivePoint[] }
export type ArchiveData = { metadata: ArchiveStatus; fuelType: 'diesel' | 'e5' | 'e10'; aggregation: 'time_weighted_known_intervals'; series: ArchiveSeries[] }
const cities = ['Berlin', 'München', 'Frankfurt am Main', 'Köln', 'Detmold']
export function validArchiveStatus(value: unknown): value is ArchiveStatus {
  if (!value || typeof value !== 'object' || !('available' in value) || typeof value.available !== 'boolean') return false
  if (!value.available) return true
  const s = value as ArchiveStatus
  return typeof s.periodStart === 'string' && /^20\d\d-\d{2}-01$/.test(s.periodStart) && typeof s.periodEnd === 'string' && /^20\d\d-\d{2}-01$/.test(s.periodEnd) &&
    Number.isFinite(Date.parse(s.periodStart)) && Date.parse(s.periodEnd) > Date.parse(s.periodStart) && Date.parse(s.periodEnd) - Date.parse(s.periodStart) <= 366 * 86400000 &&
    s.sourceUrl === 'https://data.tankerkoenig.de/tankerkoenig-organization/tankerkoenig-data' && s.licenseUrl === 'https://creativecommons.org/licenses/by-nc-sa/4.0/' &&
    typeof s.importedAt === 'string' && Number.isFinite(Date.parse(s.importedAt)) && Number.isSafeInteger(s.downloadedDays) && s.downloadedDays > 0 &&
    Array.isArray(s.cities) && s.cities.length > 0 && new Set(s.cities).size === s.cities.length && s.cities.every(city => cities.includes(city))
}
export function archiveMonths(status: ArchiveStatus): string[] {
  const result: string[] = []
  for (const date = new Date(status.periodStart + 'T00:00:00Z'); date < new Date(status.periodEnd + 'T00:00:00Z'); date.setUTCMonth(date.getUTCMonth() + 1)) result.push(date.toISOString().slice(0, 10))
  return result
}
export function validArchiveData(value: unknown, status: ArchiveStatus, fuel: string, ids: string[]): value is ArchiveData {
  if (!value || typeof value !== 'object') return false
  const data = value as ArchiveData
  if (!validArchiveStatus(data.metadata) || !data.metadata.available || data.metadata.periodStart !== status.periodStart || data.metadata.periodEnd !== status.periodEnd ||
    data.metadata.importedAt !== status.importedAt || data.fuelType !== fuel || data.aggregation !== 'time_weighted_known_intervals' || !Array.isArray(data.series) || data.series.length !== ids.length) return false
  const months = archiveMonths(status), seen = new Set<string>()
  return data.series.every(series => {
    if (!series || !validMonthlyStation(series.station) || !ids.includes(series.station.id) || seen.has(series.station.id) || !Array.isArray(series.points) || series.points.length !== months.length) return false
    seen.add(series.station.id)
    return series.points.every((p, i) => p && p.month === months[i] && Number.isSafeInteger(p.knownSeconds) && Number.isSafeInteger(p.totalSeconds) &&
      p.totalSeconds > 0 && p.totalSeconds <= 31 * 90000 && p.knownSeconds >= 0 && p.knownSeconds <= p.totalSeconds &&
      (p.knownSeconds === 0 ? p.meanPrice === null : typeof p.meanPrice === 'number' && Number.isFinite(p.meanPrice) && p.meanPrice > 0 && p.meanPrice < 20))
  })
}
export function archiveChartRows(data: ArchiveData) {
  return archiveMonths(data.metadata).map((month, i) => {
    const row: Record<string, string | number | null> = { month, label: new Date(month + 'T00:00:00Z').toLocaleDateString('de-DE', { timeZone: 'UTC', month: 'short', year: '2-digit' }) }
    data.series.forEach((s, n) => { const p = s.points[i]; row['price' + n] = p.knownSeconds === p.totalSeconds ? p.meanPrice : null })
    return row
  })
}
