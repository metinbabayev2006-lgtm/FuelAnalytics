import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { NationalLpg } from '../src/NationalLpg'
vi.mock('../src/NationalLpgChart', () => ({ NationalLpgChart: () => <p>Geprüftes LPG-Diagramm</p> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const series = { country: 'DE', fuel: 'lpg', unit: 'EUR/l', taxesIncluded: true, source: 'EU', sourceUrl: 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en', importedAt: '2026-10-30T12:00:00Z', points: [{ date: '2020-01-01', price: 0.6 }, { date: '2026-10-19', price: 1.09525 }, { date: '2026-10-26', price: 1.13025 }] }
test('loads official data on click and keeps the optional OpenVan price out of statistics', async () => {
  const request = vi.fn(async (url: string) => url === '/api/lpg/national' ? Response.json(series) : Response.json({ price: 1.095, currency: 'EUR', unit: 'liter', sourceFetchedAt: '2026-10-26T12:00:00Z', retrievedAt: '2026-10-30T12:00:00Z' }))
  vi.stubGlobal('fetch', request)
  render(<NationalLpg />)
  expect(request).not.toHaveBeenCalled()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'LPG-Statistik laden' }))
  expect(await screen.findAllByText('1,13025 €/Liter')).toHaveLength(2)
  expect(await screen.findByText('Geprüftes LPG-Diagramm')).toBeTruthy()
  await user.click(screen.getByText('Zusätzlicher Vergleich: OpenVan'))
  await user.click(screen.getByRole('button', { name: 'OpenVan-Vergleich abrufen' }))
  expect(await screen.findByText('OpenVan: 1,095 €/Liter')).toBeTruthy()
  expect(screen.getByText('1,11275 €/Liter')).toBeTruthy()
  expect(request).toHaveBeenCalledTimes(2)
  await user.selectOptions(screen.getByLabelText('Zeitraum für LPG'), '0')
  expect(screen.getByText('0,6' + '00 €/Liter')).toBeTruthy()
  expect(request).toHaveBeenCalledTimes(2)
})
test('shows retryable local dataset error without requesting external prices', async () => {
  const request = vi.fn(async () => Response.json({ country: 'DE', points: [] }))
  vi.stubGlobal('fetch', request); render(<NationalLpg />)
  await userEvent.click(screen.getByRole('button', { name: 'LPG-Statistik laden' }))
  expect((await screen.findByRole('alert')).textContent).toContain('ungültige Daten')
  expect(request).toHaveBeenCalledTimes(1)
})
