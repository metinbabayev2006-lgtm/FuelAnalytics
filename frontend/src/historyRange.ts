/** Calendar dates use the browser/device timezone and include the complete end date. */
export function historyRange(days: number, start: string, end: string, now = new Date()) {
  if (days !== -1) return {
    from: days === 0 ? '1970-01-01T00:00:00.000Z' : new Date(now.getTime() - days * 86_400_000).toISOString(),
    to: now.toISOString(),
  }
  function date(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    const [year, month, day] = value.split('-').map(Number)
    const parsed = new Date(year, month - 1, day)
    return year >= 1970 && parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day ? parsed : null
  }
  const from = date(start), through = date(end)
  if (!from || !through || from > through) return null
  through.setDate(through.getDate() + 1)
  return { from: from.toISOString(), to: through.toISOString() }
}
