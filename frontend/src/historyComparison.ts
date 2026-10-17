export type Fuel = 'diesel' | 'e5' | 'e10'
export type HistoryStation = { id: string; name: string; street?: string | null; houseNumber?: string | null; place?: string | null }
export type Observation = { stationId: string; fuelType: string; price: number; observedAt: string }
export type HistorySeries = { station: HistoryStation; prices: Observation[]; error?: string }

export function historyStationLabel(station: HistoryStation) {
  const address = [station.street, station.houseNumber, station.place].filter(Boolean).join(' ')
  return address ? `${station.name} · ${address}` : station.name
}

export function validateHistory(data: unknown, stationId: string, fuel: Fuel, from: string, to: string): Observation[] {
  if (!Array.isArray(data)) throw new Error('Der Preisverlauf hat ein unerwartetes Format.')
  const seen = new Set<number>()
  const prices = data.map((value: unknown) => {
    if (typeof value !== 'object' || value === null) throw new Error('Der Preisverlauf enthält ungültige Messwerte.')
    const row = value as Record<string, unknown>
    const time = typeof row.observedAt === 'string' ? Date.parse(row.observedAt) : NaN
    if (row.stationId !== stationId || row.fuelType !== fuel || typeof row.price !== 'number' || !Number.isFinite(row.price) || row.price <= 0 ||
        !Number.isFinite(time) || time < Date.parse(from) || time >= Date.parse(to) || seen.has(time)) {
      throw new Error('Der Preisverlauf enthält ungültige oder doppelte Messwerte.')
    }
    seen.add(time)
    return { stationId, fuelType: fuel, price: row.price, observedAt: row.observedAt as string }
  })
  return prices.sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
}

/** Union of actual observation times. Missing station values stay absent. */
export function comparisonRows(series: readonly HistorySeries[]) {
  const rows = new Map<number, { timestamp: number; [key: string]: number }>()
  series.forEach((entry, index) => {
    for (const observation of entry.prices) {
      const timestamp = Date.parse(observation.observedAt)
      const row = rows.get(timestamp) ?? { timestamp }
      row[`series${index}`] = observation.price
      rows.set(timestamp, row)
    }
  })
  return [...rows.values()].sort((a, b) => a.timestamp - b.timestamp)
}

export function toggleComparison(ids: readonly string[], id: string) {
  if (ids.includes(id)) return ids.filter(value => value !== id)
  return ids.length < 2 ? [...ids, id] : [...ids]
}

export async function loadHistorySeries(station: HistoryStation, fuel: Fuel, from: string, to: string, signal: AbortSignal, request: typeof fetch = fetch): Promise<HistorySeries> {
  try {
    const query = new URLSearchParams({ fuelType: fuel, from, to })
    const response = await request(`/api/stations/${encodeURIComponent(station.id)}/prices?${query}`, { signal, cache: 'no-store' })
    if (!response.ok) throw new Error(response.status === 404 ? 'Tankstelle nicht mehr gespeichert.' : 'Preisverlauf konnte nicht geladen werden.')
    return { station, prices: validateHistory(await response.json(), station.id, fuel, from, to) }
  } catch (cause) {
    return { station, prices: [], error: signal.aborted ? 'Laden abgebrochen oder Zeitlimit erreicht.' : cause instanceof Error ? cause.message : 'Preisverlauf konnte nicht geladen werden.' }
  }
}
