import { cleanup, render, screen } from '@testing-library/react'
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
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Deine gespeicherten Preise')
  expect(screen.queryByRole('button', { name: 'Preise abrufen' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'LPG-Statistik laden' })).toBeNull()
  await user.click(screen.getByRole('link', { name: 'LPG-Übersicht', exact: true }))
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
  expect(screen.getByRole('link', { name: 'LPG-Übersicht' }).getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('button', { name: 'LPG-Statistik laden' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Preise abrufen' })).toBeNull()
})