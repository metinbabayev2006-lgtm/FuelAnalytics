import { useState } from 'react'
import { EnergyResults } from '../src/EnergyResults'
import type { EnergyResult } from '../src/energyTypes'
import '../src/index.css'
import '../src/App.css'
export function EnergyPreview() {
  const [kind, setKind] = useState<'electric' | 'gas'>('electric')
  const [empty, setEmpty] = useState(false)
  const result: EnergyResult = { fetchedAt: '2026-10-22T12:00:00Z', kind, truncated: false, stations: empty ? [] : [
    { id: 'osm:node:1', name: 'SYNTHETISCH <script> Teststandort', latitude: 51.9386, longitude: 8.8732, distanceKm: 0,
      address: 'Fiktive Beispielstraße 1', services: kind === 'electric' ? ['Elektro'] : ['LPG', 'CNG'], access: 'customers', openingHours: 'Mo-Fr 08:00-20:00', connectors: kind === 'electric' ? ['CCS · 150 kW', 'Typ 2 · 22 kW'] : [] },
  ] }
  return <main className="app"><h1>Synthetische Komponentenprüfung · keine echten Standortdaten</h1>
    <p>Teststandort frei erfunden. Kartenhintergrund wird von OpenStreetMap geladen. Routen sind nicht zur Navigation bestimmt.</p>
    <label>Testtyp<select value={kind} onChange={e => setKind(e.target.value as 'electric' | 'gas')}><option value="electric">Elektro</option><option value="gas">Gas</option></select></label>
    <label><input type="checkbox" checked={empty} onChange={e => setEmpty(e.target.checked)} />Leeres Ergebnis</label>
    <EnergyResults result={result} center={{ id: 1, name: 'Synthetisches Testgebiet', region: null, district: null, latitude: 51.9386, longitude: 8.8732 }} radiusKm={5} searchLabel="SYNTHETISCHES TESTGEBIET" sort="distance" stale={false} />
  </main>
}
createRoot(document.getElementById('root')!).render(<Preview />)
