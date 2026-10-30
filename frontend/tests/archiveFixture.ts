import { archiveMonths } from '../src/archiveData'
import type { ArchiveData, ArchiveStatus } from '../src/archiveData'
export const archiveStatus: ArchiveStatus = { available: true, periodStart: '2025-10-01', periodEnd: '2026-10-01', sourceUrl: 'https://data.tankerkoenig.de/tankerkoenig-organization/tankerkoenig-data', licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/', importedAt: '2026-10-30T14:00:00Z', downloadedDays: 366, cities: ['Berlin', 'München', 'Frankfurt am Main', 'Köln', 'Detmold'] }
export const archiveId = '11111111-1111-4111-8111-111111111111'
export function archiveFixture(): ArchiveData {
  return { metadata: archiveStatus, aggregation: 'time_weighted_known_intervals', fuelType: 'e10', series: [{ station: { id: archiveId, name: 'Synthetic archive station', city: 'Detmold', address: 'Example 1', monthCount: 12 }, points: archiveMonths(archiveStatus).map((month, i) => ({ month, meanPrice: 1.5 + i / 100, knownSeconds: i === 1 ? 1296000 : 2592000, totalSeconds: 2592000 })) }] }
}
