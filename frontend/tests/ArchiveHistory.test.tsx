import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { ArchiveHistory } from '../src/ArchiveHistory'
import { archiveFixture, archiveStatus } from './archiveFixture'
vi.mock('../src/ArchiveHistoryChart', () => ({ ArchiveHistoryChart: () => <p>Archive chart</p> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
test('loads selected city data locally, compares known intervals and labels incomplete months', async () => {
  const data = archiveFixture()
  const request = vi.fn(async (url: string) => Response.json(url.endsWith('/status') ? archiveStatus : url.includes('/stations?') ? { entries: [data.series[0].station], hasMore: false } : data))
  vi.stubGlobal('fetch', request)
  render(<ArchiveHistory />)
  expect(await screen.findByLabelText('Archivstadt')).toBeTruthy()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Archiv-Tankstellen laden' }))
  await user.click(await screen.findByRole('checkbox', { name: /Synthetic archive station/ }))
  await user.click(screen.getByRole('button', { name: 'Zwölfmonatsverlauf anzeigen' }))
  expect(await screen.findByText('Archive chart')).toBeTruthy()
  expect(screen.getByText('11/12')).toBeTruthy()
  expect(screen.getByText(/\(Teilwert\)/)).toBeTruthy()
  expect(screen.getByText(/Abdeckung: 50/)).toBeTruthy()
  expect(request.mock.calls.every(([url]) => url.startsWith('/api/history/archive/'))).toBe(true)
})
test('reports an unfinished import honestly and can retry', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ available: false })))
  render(<ArchiveHistory />)
  expect(await screen.findByText(/Jahresimport ist noch nicht abgeschlossen/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Archiv-Tankstellen laden' })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Archivstatus erneut prüfen' }))
  expect(await screen.findByText(/Jahresimport ist noch nicht abgeschlossen/)).toBeTruthy()
})
