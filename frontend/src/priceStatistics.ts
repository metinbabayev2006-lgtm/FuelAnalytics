export type Fuel = 'diesel' | 'e5' | 'e10'
type Entry = {
  station: { id: string; name: string; street?: string | null; houseNumber?: string | null; place?: string | null }
  open: boolean
  prices: Partial<Record<Fuel, number>>
}

export function summarizePrices(entries: readonly Entry[], fuel: Fuel) {
  const available = entries.flatMap(entry => {
    const price = entry.prices[fuel]
    return entry.open && typeof price === 'number' && Number.isFinite(price) && price > 0
      ? [{ station: entry.station, mills: Math.round(price * 1000) }] : []
  })
  if (available.length === 0) return null
  const totals = available.reduce((result, entry) => ({
    min: Math.min(result.min, entry.mills), max: Math.max(result.max, entry.mills), sum: result.sum + entry.mills,
  }), { min: Infinity, max: -Infinity, sum: 0 })
  return {
    count: available.length,
    min: totals.min / 1000,
    max: totals.max / 1000,
    average: totals.sum / available.length / 1000,
    spread: (totals.max - totals.min) / 1000,
    cheapest: available.filter(entry => entry.mills === totals.min).map(entry => entry.station),
  }
}
