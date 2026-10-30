import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PriceHistory } from '../src/PriceHistory'

const station = { id: '11111111-1111-1111-1111-111111111111', name: 'Synthetische Verlaufstankstelle' }
const observedAt = new Date(Date.now() - 60_000).toISOString()
const earlier = new Date(Date.now() - 120_000).toISOString()
const observation = { stationId: station.id, fuelType: 'e10', price: 1.799, observedAt }

beforeEach(() => {
  // jsdom has no layout. The real diagram is also checked in the browser.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function showHistory() {
  render(<PriceHistory station={station} availableStations={[station]} fuel="e10" observedAt={observedAt} />)
}

test('shows an explicit empty history without inventing observations', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json([])))
  showHistory()
  expect(await screen.findByText(/Keine Beobachtungen für diesen Kraftstoff und Zeitraum gespeichert/)).toBeTruthy()
  expect(screen.queryByRole('table')).toBeNull()
})

test('explains a single observation and shows its exact value', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json([observation])))
  showHistory()
  expect(await screen.findByText(/Nur ein Messpunkt, noch kein Verlauf/)).toBeTruthy()
  const table = screen.getByRole('table', { hidden: true })
  expect(table.textContent).toContain('1,799')
})

test('sorts observations chronologically in the accessible table', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json([observation, { ...observation, observedAt: earlier, price: 1.759 }])))
  showHistory()
  await screen.findAllByText(/2 Beobachtungen/)
  const table = screen.getByRole('table', { hidden: true })
  const rows = within(table).getAllByRole('row', { hidden: true })
  expect(rows[1].textContent).toContain('1,759')
  expect(rows[2].textContent).toContain('1,799')
})

test('rejects a different fuel rather than presenting it under the selected label', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json([{ ...observation, fuelType: 'diesel' }])))
  showHistory()
  expect((await screen.findByRole('alert')).textContent).toContain('ungültige oder doppelte Messwerte')
  expect(screen.queryByRole('table', { hidden: true })).toBeNull()
})

test('reloads stored observations after a temporary server failure', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 500 }))
    .mockResolvedValue(Response.json([]))
  vi.stubGlobal('fetch', fetchMock)
  showHistory()
  expect((await screen.findByRole('alert')).textContent).toContain('nicht geladen')
  await userEvent.click(screen.getByRole('button', { name: 'Verlauf neu laden' }))
  expect(await screen.findByText(/Keine Beobachtungen für diesen Kraftstoff und Zeitraum gespeichert/)).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('custom calendar range requests only valid dates and includes the final day', async () => {
  const request = vi.fn(async () => Response.json([]))
  vi.stubGlobal('fetch', request)
  showHistory()
  await screen.findByText(/Keine Beobachtungen für diesen Kraftstoff/)
  await userEvent.selectOptions(screen.getByLabelText('Zeitraum'), '-1')
  const before = request.mock.calls.length
  expect(screen.getByRole('button', { name: 'Verlauf neu laden' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByLabelText('Von einschließlich'), { target: { value: '2026-10-22' } })
  fireEvent.change(screen.getByLabelText('Bis einschließlich'), { target: { value: '2026-10-30' } })
  await screen.findByText(/Keine Beobachtungen für diesen Kraftstoff/)
  expect(request).toHaveBeenCalledTimes(before + 1)
  const url = new URL(String(request.mock.calls.at(-1)![0]), 'http://localhost')
  expect(url.searchParams.get('from')).toBe(new Date(2026, 9, 22).toISOString())
  expect(url.searchParams.get('to')).toBe(new Date(2026, 9, 31).toISOString())
  fireEvent.change(screen.getByLabelText('Von einschließlich'), { target: { value: '2026-11-01' } })
  expect((await screen.findByRole('alert')).textContent).toContain('Enddatum')
  expect(request).toHaveBeenCalledTimes(before + 1)
})
test('keeps chart data visible while statistics and export open on demand without fetching again', async () => {
  const request = vi.fn(async () => Response.json([observation]))
  vi.stubGlobal('fetch', request)
  showHistory()
  await screen.findByText(/Nur ein Messpunkt/)
  const panel = screen.getByText('Statistik und Export').closest('details')!
  expect(panel.open).toBe(false)
  await userEvent.click(screen.getByText('Statistik und Export'))
  expect(panel.open).toBe(true)
  expect(screen.getByRole('heading', { name: 'Auswertung der gespeicherten Messungen' })).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Preisverlauf als CSV herunterladen' }) as HTMLButtonElement).disabled).toBe(false)
  expect(request).toHaveBeenCalledTimes(1)
})