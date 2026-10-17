import type { SearchResult } from './searchTypes'
import type { Fuel, HistorySeries, HistoryStation } from './historyComparison'

export function createDemoResult(now = Date.now()): SearchResult {
  return {
    observedAt: new Date(now - 60_000).toISOString(), searchLabel: 'DEMO · Fiktive Tankstellen bei Detmold', radiusKm: 5,
    center: { id: -2, name: 'DEMO Detmold', region: null, district: null, latitude: 51.9385, longitude: 8.8732 }, rejectedStations: 0,
    stations: [
      { station: { id: 'demo-nord', name: 'DEMO Nord · fiktiv', street: 'Beispielweg', houseNumber: '1', place: 'Detmold (fiktiv)', latitude: 51.95, longitude: 8.88 }, open: true, distanceKm: 1.4, prices: { e10: 1.759, e5: 1.819, diesel: 1.659 } },
      { station: { id: 'demo-sued', name: 'DEMO Süd · fiktiv', street: 'Musterstraße', houseNumber: '2', place: 'Detmold (fiktiv)', latitude: 51.92, longitude: 8.87 }, open: true, distanceKm: 2.1, prices: { e10: 1.809, e5: 1.869, diesel: 1.709 } },
      { station: { id: 'demo-west', name: 'DEMO West · fiktiv', street: 'Testallee', houseNumber: '3', place: 'Detmold (fiktiv)', latitude: 51.94, longitude: 8.83 }, open: true, distanceKm: 3, prices: { e10: 1.789, diesel: 1.689 } },
      { station: { id: 'demo-geschlossen', name: 'DEMO Geschlossen · fiktiv', street: 'Beispielring', houseNumber: '4', place: 'Detmold (fiktiv)', latitude: 51.96, longitude: 8.91 }, open: false, distanceKm: 3.6, prices: {} },
    ],
  }
}

export function demoHistoryLoader(result: SearchResult) {
  return async (station: HistoryStation, fuel: Fuel, from: string, to: string, signal: AbortSignal): Promise<HistorySeries> => {
    const price = result.stations.find(entry => entry.station.id === station.id)?.prices[fuel]
    if (signal.aborted) return { station, prices: [], error: 'Laden abgebrochen.' }
    if (price === undefined) return { station, prices: [] }
    const offsets = station.id === 'demo-west' ? [0] : [-72, -24, -6, 0]
    const prices = offsets.map((hours, index) => ({ stationId: station.id, fuelType: fuel,
      price: Number((price + (offsets.length - 1 - index) * 0.01).toFixed(3)), observedAt: new Date(Date.parse(result.observedAt) + hours * 3_600_000).toISOString() }))
      .filter(point => Date.parse(point.observedAt) >= Date.parse(from) && Date.parse(point.observedAt) < Date.parse(to))
    return { station, prices }
  }
}
