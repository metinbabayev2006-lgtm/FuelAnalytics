import { useState } from 'react'
import { LocationButton } from '../src/LocationButton'
import type { Location } from '../src/location'
import '../src/index.css'
import '../src/App.css'

function Scenario({ scenario }: { scenario: string }) {
  const [busy, setBusy] = useState(false)
  const [location, setLocation] = useState<Location | null>(null)
  const request: Geolocation['getCurrentPosition'] = (success, error) => {
    if (scenario === 'success') success({ coords: { latitude: 51.9385, longitude: 8.8732, accuracy: 120, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) }, timestamp: 0, toJSON: () => ({}) })
    else error?.({ code: scenario === 'denied' ? 1 : 3, message: 'SYNTHETIC', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
  }
  return <><LocationButton disabled={false} supported={scenario !== 'unavailable'} requestPosition={request} onStart={() => setLocation(null)} onBusyChange={setBusy} onSelect={setLocation} />
    <p>Status: {busy ? 'wartet' : 'bereit'}</p><p>Auswahl: {location ? `${location.name} (synthetische Koordinaten)` : 'keine'}</p></>
}

export function LocationPreview() {
  const [scenario, setScenario] = useState('success')
  return <main className="app"><h1>Standortprüfung · nur synthetische Daten</h1><p>Keine Browserfreigabe, kein Gerätezugriff und keine Netzwerkübermittlung.</p>
    <label>Testfall<select value={scenario} onChange={event => setScenario(event.target.value)}><option value="success">Erfolg</option><option value="denied">Abgelehnt</option><option value="timeout">Zeitlimit</option><option value="unavailable">Nicht unterstützt</option></select></label>
    <Scenario key={scenario} scenario={scenario} />
  </main>
}
