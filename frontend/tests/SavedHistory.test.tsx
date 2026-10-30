import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { SavedHistory } from '../src/SavedHistory'

vi.mock('../src/PriceHistory', () => ({ PriceHistory: ({ initialDays }: { initialDays: number }) => <p>Archivdiagramm: {initialDays}</p> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
test('loads saved stations on demand and opens all historical data without live provider calls', async () => {
  const station = { id: '11111111-1111-1111-1111-111111111111', name: 'Archivstation', place: 'Detmold' }
  const request = vi.fn(async () => Response.json({ entries: [{ station, count: 3, firstObservedAt: '2026-10-16T12:00:00Z', lastObservedAt: '2026-10-30T12:00:00Z' }], hasMore: false }))
  vi.stubGlobal('fetch', request)
  render(<SavedHistory />)
  expect(request).not.toHaveBeenCalled()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Gespeicherte Tankstellen laden' }))
  await user.selectOptions(await screen.findByLabelText('Gespeicherte Tankstelle'), station.id)
  expect(await screen.findByText('Archivdiagramm: 0')).toBeTruthy()
  expect(request).toHaveBeenCalledTimes(1)
  expect(String(request.mock.calls[0][0])).toContain('/api/stations/archive?fuelType=e10')
  await user.selectOptions(screen.getByLabelText('Kraftstoff im Preisarchiv'), 'diesel')
  expect(screen.queryByText('Archivdiagramm: 0')).toBeNull()
})
test('rejects malformed archive data and permits retry', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ entries: [{ count: -1 }], hasMore: false })))
  render(<SavedHistory />)
  await userEvent.click(screen.getByRole('button', { name: 'Gespeicherte Tankstellen laden' }))
  expect((await screen.findByRole('alert')).textContent).toContain('unerwartete Daten')
})
