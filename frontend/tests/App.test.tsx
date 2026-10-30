import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from '../src/App'

beforeEach(() => { window.history.replaceState({}, '', '/'); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test('the connection link opens the status details, rather than only scrolling to a closed panel', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status: 'UP', application: 'FuelAnalytics' })))
  render(<App />)
  const status = screen.getByText('Verbindungsdetails').closest('details')!
  expect(status.open).toBe(false)
  await userEvent.click(await screen.findByRole('link', { name: 'Verbunden' }))
  expect(status.open).toBe(true)
})

test('an unexpected health response does not falsely mark the backend connected', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status: 'UP', application: 'Another application' })))
  render(<App />)
  expect(await screen.findByRole('link', { name: 'Nicht verbunden' })).toBeTruthy()
})

test('navigation shows one workspace at a time and preserves the search input', async () => {
  const request = vi.fn(async () => Response.json({ status: 'UP', application: 'FuelAnalytics' }))
  vi.stubGlobal('fetch', request)
  render(<App />)
  await screen.findByRole('link', { name: 'Verbunden', exact: true })
  const user = userEvent.setup()
  const input = screen.getByRole('textbox', { name: 'Ort oder Postleitzahl in Deutschland' })
  await user.clear(input); await user.type(input, 'Lippstadt')
  await user.click(screen.getByRole('link', { name: 'Preisverlauf', exact: true }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Preisverläufe vergleichen')
  expect(screen.queryByRole('button', { name: 'Preise abrufen' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'LPG-Statistik laden' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'LPG-Übersicht', exact: true })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'LPG Deutschland', exact: true }))
  expect(screen.getByRole('button', { name: 'LPG-Statistik laden' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Gespeicherte Tankstellen laden' })).toBeNull()
  await user.click(screen.getByRole('link', { name: 'Tankstellen', exact: true }))
  expect((screen.getByRole('textbox', { name: 'Ort oder Postleitzahl in Deutschland' }) as HTMLInputElement).value).toBe('Lippstadt')
  expect(request).toHaveBeenCalledTimes(1)
})

test('a direct LPG link opens the right workspace', () => {
  window.history.replaceState({}, '', '/#lpg-statistics')
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status: 'UP', application: 'FuelAnalytics' })))
  render(<App />)
  expect(screen.getByRole('link', { name: 'Preisverlauf', exact: true }).getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('button', { name: 'LPG Deutschland', exact: true }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: 'LPG-Statistik laden' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Preise abrufen' })).toBeNull()
})

test('history sources preserve their filters when switching and follow direct hash navigation', async () => {
  const request = vi.fn(async (url: string) => Response.json(url.includes('/monthly/years') ? [2022] : { status: 'UP', application: 'FuelAnalytics' }))
  vi.stubGlobal('fetch', request)
  window.history.replaceState({}, '', '/#saved-history')
  render(<App />)
  const user = userEvent.setup()
  await user.selectOptions(screen.getByLabelText('Kraftstoff im Preisarchiv'), 'diesel')
  await user.click(screen.getByRole('button', { name: 'LPG Deutschland', exact: true }))
  expect(window.location.hash).toBe('#lpg-statistics')
  await user.click(screen.getByRole('button', { name: 'Eigene Messungen', exact: true }))
  expect((screen.getByLabelText('Kraftstoff im Preisarchiv') as HTMLSelectElement).value).toBe('diesel')
  act(() => {
    window.history.replaceState({}, '', '/#history-monthly')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
  expect(await screen.findByRole('heading', { name: 'Tankerkönig · zwölf Monate im Vergleich' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Historische Monatswerte' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.queryByRole('button', { name: 'LPG-Statistik laden' })).toBeNull()
  expect(request.mock.calls.every(([url]) => String(url).startsWith('/api/'))).toBe(true)
})
