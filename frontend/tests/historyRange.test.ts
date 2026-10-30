import { expect, test } from 'vitest'
import { historyRange } from '../src/historyRange'

test('all saved prices and rolling days use precise bounds', () => {
  const now = new Date('2026-10-30T12:00:00Z')
  expect(historyRange(0, '', '', now)).toEqual({ from: '1970-01-01T00:00:00.000Z', to: now.toISOString() })
  expect(historyRange(1, '', '', now)?.from).toBe('2026-10-29T12:00:00.000Z')
})
test('custom date includes entire final day in the device timezone', () => {
  const range = historyRange(-1, '2026-10-25', '2026-10-25')!
  expect(range.from).toBe(new Date(2026, 9, 25).toISOString())
  expect(range.to).toBe(new Date(2026, 9, 26).toISOString())
})
test('incomplete, reversed and impossible dates never create history requests', () => {
  for (const [start, end] of [['', '2026-10-01'], ['2026-11-01', '2026-10-01'], ['2026-02-30', '2026-03-01'], ['1969-01-01', '2026-01-01']])
    expect(historyRange(-1, start, end)).toBeNull()
})
