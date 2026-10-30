import { expect, test } from 'vitest'
import { archiveChartRows, validArchiveData, validArchiveStatus } from '../src/archiveData'
import { archiveFixture, archiveId, archiveStatus } from './archiveFixture'
test('validates archive provenance, ordered months, station IDs and price coverage', () => {
  const data = archiveFixture()
  expect(validArchiveStatus(archiveStatus)).toBe(true)
  expect(validArchiveData(data, archiveStatus, 'e10', [archiveId])).toBe(true)
  expect(validArchiveData(data, archiveStatus, 'diesel', [archiveId])).toBe(false)
  data.series[0].points[0].knownSeconds = 999999999
  expect(validArchiveData(data, archiveStatus, 'e10', [archiveId])).toBe(false)
  expect(validArchiveStatus({ ...archiveStatus, sourceUrl: 'https://example.com' })).toBe(false)
})
test('incomplete months are chart gaps, never fabricated complete prices', () => {
  const data = archiveFixture(), rows = archiveChartRows(data)
  expect(rows).toHaveLength(12)
  expect(rows[0].month).toBe('2025-10-01')
  expect(rows[11].month).toBe('2026-09-01')
  expect(rows[0].price0).toBe(1.5)
  expect(rows[1].price0).toBeNull()
})
