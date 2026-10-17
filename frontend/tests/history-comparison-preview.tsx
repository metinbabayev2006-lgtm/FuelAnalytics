import { useState } from 'react'
import { PriceHistory } from '../src/PriceHistory'
import { validateHistory } from '../src/historyComparison'
import type { Fuel, HistorySeries, HistoryStation } from '../src/historyComparison'
import '../src/index.css'
import '../src/App.css'

const base = Date.now() - 60_000
const stations: HistoryStation[] = [
  { id: 'a', name: 'SYNTHETISCH Nord', street: 'Beispielweg', houseNumber: '1' },
  { id: 'b', name: 'SYNTHETISCH Süd', street: 'Beispielweg', houseNumber: '2' },
  { id: 'c', name: 'SYNTHETISCH Einzelpunkt' },
  { id: 'empty', name: 'SYNTHETISCH ohne Messungen' },
  { id: 'failed', name: 'SYNTHETISCH Ladefehler' },
]
const values: Record<string, number[][]> = {
  a: [[-4, 1.799], [-2, 1.759], [-1, 1.779]],
  b: [[-3, 1.859], [-2, 1.799], [-0.5, 1.809]],
  c: [[-1, 1.789]],
}
async function syntheticLoader(station: HistoryStation, fuel: Fuel, from: string, to: string, signal: AbortSignal): Promise<HistorySeries> {
  if (signal.aborted) return { station, prices: [], error: 'Synthetischer Abbruch' }
  if (station.id === 'failed') return { station, prices: [], error: 'Absichtlich simulierter Ladefehler.' }
  const prices = (fuel === 'e5' ? [] : values[station.id] ?? []).map(([hours, price]) => ({ stationId: station.id, fuelType: fuel, price: price + (fuel === 'diesel' ? -0.1 : 0), observedAt: new Date(base + hours * 3_600_000).toISOString() }))
    .filter(price => Date.parse(price.observedAt) >= Date.parse(from) && Date.parse(price.observedAt) < Date.parse(to))
  return { station, prices: validateHistory(prices, station.id, fuel, from, to) }
}

export function HistoryPreview() {
  const [fuel, setFuel] = useState<Fuel>('e10')
  return <main className="app">
    <p className="demo-badge">TESTANSICHT · SYNTHETISCHE DATEN · KEINE ECHTEN PREISE</p>
    <h1>Preisverläufe vergleichen</h1><p>Isolierte UI-Prüfung ohne Anbieter- oder Datenbankabfragen.</p>
    <label>Kraftstoff<select value={fuel} onChange={event => setFuel(event.target.value as Fuel)}><option value="e10">Super E10</option><option value="diesel">Diesel</option><option value="e5">Super E5 (leer)</option></select></label>
    <PriceHistory station={stations[0]} availableStations={stations} fuel={fuel} observedAt={new Date(base).toISOString()} loadSeries={syntheticLoader} />
  </main>
}
