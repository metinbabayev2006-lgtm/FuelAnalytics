import { useState } from 'react'
import { StationFillCost, TankCalculator } from '../src/TankCalculator'
import { summarizePrices } from '../src/priceStatistics'
import type { Fuel } from '../src/priceStatistics'
import { fillCostCents, parseTankVolume } from '../src/tankCosts'
import '../src/index.css'
import '../src/App.css'

// Isolated manual UI fixture; no network data and no provider requests.
const entries: Parameters<typeof summarizePrices>[0] = [
  { station: { id: 'a', name: 'SYNTHETISCH A' }, open: true, prices: { e10: 1.704, diesel: 1.599 } },
  { station: { id: 'b', name: 'SYNTHETISCH B' }, open: true, prices: { e10: 1.705, diesel: 1.699 } },
  { station: { id: 'missing', name: 'SYNTHETISCH ohne Preis' }, open: true, prices: {} },
  { station: { id: 'closed', name: 'SYNTHETISCH geschlossen' }, open: false, prices: { e10: 1.1, diesel: 1.1 } },
]

export function Preview() {
  const [amount, setAmount] = useState('40')
  const [fuel, setFuel] = useState<Fuel>('e10')
  const summary = summarizePrices(entries, fuel)
  const volume = parseTankVolume(amount)
  const minimum = summary ? fillCostCents(summary.min, volume) : null
  return <main className="app">
    <p className="demo-badge">TESTANSICHT · SYNTHETISCHE DATEN · KEINE ECHTEN PREISE</p>
    <h1>Tankkosten prüfen</h1>
    <p>Isolierte Komponentenprüfung ohne Tankerkönig-Abfrage.</p>
    <label>Kraftstoff<select value={fuel} onChange={event => setFuel(event.target.value as Fuel)}><option value="e10">Super E10</option><option value="diesel">Diesel</option><option value="e5">Super E5 (ohne Daten)</option></select></label>
    <div style={{ marginTop: 24 }}><TankCalculator value={amount} onChange={setAmount} minimumPrice={summary?.min ?? null} maximumPrice={summary?.max ?? null} /></div>
    <table><caption>Synthetische Kosten je Tankstelle</caption><thead><tr><th>Tankstelle</th><th>Tankkosten</th></tr></thead><tbody>{entries.map(entry => <tr key={entry.station.id}><td>{entry.station.name}</td><td><StationFillCost price={entry.open ? entry.prices[fuel] : undefined} volume={volume} cheapestCents={minimum} /></td></tr>)}</tbody></table>
  </main>
}

