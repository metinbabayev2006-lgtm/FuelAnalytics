import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { LiveSearch } from '../src/LiveSearch'

// Map layout needs a real browser; these tests cover form/network behaviour.
vi.mock('../src/StationsMap', () => ({ StationsMap: () => <div>Interaktive Testkarte</div> }))

const location = { id: 1, name: 'Testort', region: 'Testregion', district: null, latitude: 52, longitude: 9 }
const result = {
  observedAt: '2026-10-22T12:00:00Z', rejectedStations: 0,
  stations: [
    { station: { id: 'a', name: 'Günstige Tankstelle', street: null, houseNumber: null, place: 'Testort', latitude: 52, longitude: 9 }, open: true, distanceKm: 3, prices: { e10: 1.8, diesel: 1.7 } },
    { station: { id: 'b', name: 'Nahe Tankstelle', street: null, houseNumber: null, place: 'Testort', latitude: 52.01, longitude: 9 }, open: true, distanceKm: 1, prices: { e10: 1.9, diesel: 1.6 } },
  ],
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function chooseLocation() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Ort suchen' }))
  await user.click(await screen.findByRole('button', { name: /Testort, Testregion/ }))
  return user
}

test('does not enable a price request before selecting a location', () => {
  render(<LiveSearch />)
  expect((screen.getByRole('button', { name: 'Preise abrufen' }) as HTMLButtonElement).disabled).toBe(true)
})

test('allows retry immediately after a local configuration error without a provider request', async () => {
  let calls = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).startsWith('/api/locations')) return Response.json({ locations: [location] })
    calls++
    return calls === 1 ? new Response('', { status: 503 }) : Response.json(result)
  }))
  render(<LiveSearch />)
  const user = await chooseLocation()
  await user.click(screen.getByRole('button', { name: 'Preise abrufen' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Schlüssel')
  const retry = screen.getByRole('button', { name: 'Preise abrufen' }) as HTMLButtonElement
  expect(retry.disabled).toBe(false)
  await user.click(retry)
  expect(await screen.findByText('Günstige Tankstelle', { selector: 'td strong' })).toBeTruthy()
  expect(calls).toBe(2)
})

test('changes sort, fuel and fill amount locally without another API request', async () => {
  const fetchMock = vi.fn(async (url: string) => Response.json(
    String(url).startsWith('/api/locations') ? { locations: [location] } : result))
  vi.stubGlobal('fetch', fetchMock)
  render(<LiveSearch />)
  const user = await chooseLocation()
  await user.click(screen.getByRole('button', { name: 'Preise abrufen' }))
  await screen.findByText('Günstige Tankstelle', { selector: 'td strong' })
  const table = screen.getByRole('table')
  expect(within(table).getAllByRole('row')[1].textContent).toContain('Günstige Tankstelle')
  await user.selectOptions(screen.getByLabelText('Sortieren nach'), 'distance')
  expect(within(table).getAllByRole('row')[1].textContent).toContain('Nahe Tankstelle')
  await user.selectOptions(screen.getByLabelText('Kraftstoff'), 'diesel')
  expect(screen.getByRole('heading', { name: 'Preisvergleich · Diesel' })).toBeTruthy()
  await user.click(screen.getByText('Tankkosten berechnen'))
  fireEvent.change(screen.getByLabelText('Tankmenge in Litern'), { target: { value: '35,5' } })
  expect(table.textContent).toContain('56,80')
  fireEvent.change(screen.getByLabelText('Tankmenge in Litern'), { target: { value: '' } })
  expect(screen.getByText(/Bitte gib eine gültige Tankmenge ein/)).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('rejects malformed search data instead of rendering partial results', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(
    String(url).startsWith('/api/locations') ? { locations: [location] } : { stations: [] })))
  render(<LiveSearch />)
  const user = await chooseLocation()
  await user.click(screen.getByRole('button', { name: 'Preise abrufen' }))
  expect((await screen.findByRole('alert')).textContent).toContain('unerwartetes Format')
  expect(screen.queryByRole('table')).toBeNull()
})

test('keeps the cooldown on a provider rate-limit response', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).startsWith('/api/locations')
    ? Response.json({ locations: [location] }) : new Response('', { status: 429 })))
  render(<LiveSearch />)
  const user = await chooseLocation()
  await user.click(screen.getByRole('button', { name: 'Preise abrufen' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Abfragelimit')
  expect((screen.getByRole('button', { name: /Erneut möglich in/ }) as HTMLButtonElement).disabled).toBe(true)
})

test('ignores a late location response after the user edits the query', async () => {
  let resolve: ((response: Response) => void) | undefined
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { resolve = done })))
  render(<LiveSearch />)
  fireEvent.click(screen.getByRole('button', { name: 'Ort suchen' }))
  await waitFor(() => expect(resolve).toBeDefined())
  fireEvent.change(screen.getByLabelText('Ort oder Postleitzahl in Deutschland'), { target: { value: 'Lemgo' } })
  await act(async () => { resolve!(Response.json({ locations: [location] })) })
  expect(screen.queryByRole('button', { name: /Testort, Testregion/ })).toBeNull()
  expect((screen.getByRole('button', { name: 'Preise abrufen' }) as HTMLButtonElement).disabled).toBe(true)
})
