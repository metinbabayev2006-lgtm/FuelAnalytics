import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { LocationPicker } from '../src/LocationPicker'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
test('address mode sends the street only after submit and requires selecting a result', async () => {
  const location = { id: -100000000012, name: 'Teststraße 4, Testort', region: null, district: null, latitude: 52, longitude: 9 }
  const request = vi.fn(async () => Response.json({ locations: [location] }))
  vi.stubGlobal('fetch', request)
  const onSelect = vi.fn()
  render(<LocationPicker selected={null} onSelect={onSelect} disabled={false} locating={false} onLocationBusy={vi.fn()} />)
  const user = userEvent.setup()
  await user.selectOptions(screen.getByLabelText('Suchen nach'), 'address')
  const input = screen.getByLabelText('Straße, Hausnummer und Ort in Deutschland')
  await user.clear(input); await user.type(input, 'Teststraße 4, Testort')
  expect(request).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Ort suchen' }))
  expect(String(request.mock.calls[0][0])).toContain('&mode=address')
  expect(String(request.mock.calls[0][0])).toContain('Teststra%C3%9Fe')
  await user.click(await screen.findByRole('button', { name: /Teststraße 4, Testort/ }))
  expect(onSelect).toHaveBeenLastCalledWith(location)
})
