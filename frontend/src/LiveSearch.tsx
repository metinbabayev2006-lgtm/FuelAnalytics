import { useEffect, useRef, useState } from 'react'

type Fuel = 'diesel' | 'e5' | 'e10'
type Entry = {
  station: { id: string; name: string; street: string | null; houseNumber: string | null; place: string | null }
  open: boolean
  distanceKm: number
  prices: Partial<Record<Fuel, number>>
}
type Result = { observedAt: string; stations: Entry[]; rejectedStations: number }

const fuels: Record<Fuel, string> = { diesel: 'Diesel', e5: 'Super E5', e10: 'Super E10' }
const priceFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const distanceFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })
const dateFormat = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'medium' })

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function validResult(value: unknown): value is Result {
  if (!object(value) || typeof value.observedAt !== 'string' || !Number.isFinite(Date.parse(value.observedAt)) ||
    !Number.isInteger(value.rejectedStations) || (value.rejectedStations as number) < 0 || !Array.isArray(value.stations)) return false
  return value.stations.every(entry => {
    if (!object(entry) || !object(entry.station)) return false
    const station = entry.station
    return typeof station.id === 'string' && typeof station.name === 'string' &&
      ['street', 'houseNumber', 'place'].every(field => station[field] === null || typeof station[field] === 'string') &&
      typeof entry.open === 'boolean' && typeof entry.distanceKm === 'number' && Number.isFinite(entry.distanceKm) && entry.distanceKm >= 0 &&
      object(entry.prices) && Object.entries(entry.prices).every(([fuel, price]) =>
        Object.hasOwn(fuels, fuel) && typeof price === 'number' && Number.isFinite(price) && price > 0)
  })
}

export function LiveSearch() {
  const [fuel, setFuel] = useState<Fuel>('e10')
  const [sort, setSort] = useState('price')
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState(0)
  const nextRequest = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((nextRequest.current - Date.now()) / 1000))), 1000)
    return () => { window.clearInterval(timer); activeRequest.current?.abort() }
  }, [])

  async function search() {
    if (activeRequest.current || Date.now() < nextRequest.current) return
    const controller = new AbortController()
    activeRequest.current = controller
    nextRequest.current = Date.now() + 61_000
    setRemaining(61)
    setLoading(true)
    setError('')
    const timeout = window.setTimeout(() => controller.abort(), 20_000)
    try {
      const response = await fetch('/api/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ latitude: 51.93855, longitude: 8.87318, radiusKm: 5 }),
      })
      if (!response.ok) {
        const messages: Record<number, string> = {
          429: 'Das Abfragelimit ist erreicht. Bitte warte mindestens 61 Sekunden und versuche es erneut.',
          503: 'Der Tankerkönig-Schlüssel ist im Backend nicht korrekt eingerichtet.',
          502: 'Tankerkönig ist derzeit nicht erreichbar oder liefert ungültige Daten.',
        }
        throw new Error(messages[response.status] ?? 'Die Abfrage oder Speicherung ist fehlgeschlagen. Prüfe das Backend und die Datenbank.')
      }
      const data: unknown = await response.json()
      if (!validResult(data)) throw new Error('Die Suchantwort hat ein unerwartetes Format.')
      setResult(data)
    } catch (cause) {
      setError(controller.signal.aborted ? 'Die Anfrage wurde abgebrochen oder hat zu lange gedauert.'
        : cause instanceof Error ? cause.message : 'Die Suche ist fehlgeschlagen.')
    } finally {
      window.clearTimeout(timeout)
      activeRequest.current = null
      setLoading(false)
    }
  }

  const entries = [...(result?.stations ?? [])].sort((a, b) => {
    if (sort === 'distance') return a.distanceKm - b.distanceKm || a.station.name.localeCompare(b.station.name)
    const aPrice = a.prices[fuel] ?? Infinity
    const bPrice = b.prices[fuel] ?? Infinity
    if (aPrice !== bPrice) return aPrice - bPrice
    return a.distanceKm - b.distanceKm || a.station.name.localeCompare(b.station.name)
  })

  return <section className="connection-card live-card" aria-labelledby="live-title">
    <span className="live-badge">Tankerkönig · echte Daten</span>
    <h2 id="live-title">Tankstellen in Detmold</h2>
    <p className="demo-note">5 km um den gewählten Mittelpunkt in Detmold. Preise werden auf deinen Klick abgerufen und gespeichert.</p>
    <div className="search-controls">
      <label>Kraftstoff<select value={fuel} onChange={event => setFuel(event.target.value as Fuel)}>
        <option value="e10">Super E10</option><option value="e5">Super E5</option><option value="diesel">Diesel</option>
      </select></label>
      <label>Sortieren nach<select value={sort} onChange={event => setSort(event.target.value)}>
        <option value="price">Preis, günstigster zuerst</option><option value="distance">Entfernung, nächste zuerst</option>
      </select></label>
    </div>
    <button disabled={loading || remaining > 0} onClick={() => void search()}>
      {loading ? 'Preise werden abgerufen …' : remaining > 0 ? `Erneut möglich in ${remaining} s` : 'Preise abrufen'}
    </button>
    <p className="last-checked">Kein automatischer Abruf. Kraftstoffwechsel und Sortierung benötigen keine neue Abfrage.</p>
    {loading && <p role="status">Tankstellen werden abgerufen und in der Datenbank gespeichert …</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {!result && !loading && !error && <p>Noch keine Live-Abfrage in dieser Ansicht. Klicke auf „Preise abrufen“.</p>}
    {result && <>
      <p role="status">{result.stations.length} Tankstellen · Datenstand: <time dateTime={result.observedAt}>{dateFormat.format(new Date(result.observedAt))}</time> (Berlin)</p>
      {(loading || error) && <p className="loading">Die angezeigten Ergebnisse stammen weiterhin vom oben genannten Datenstand.</p>}
      {result.rejectedStations > 0 && <p className="loading">{result.rejectedStations} ungültige Datensätze wurden verworfen.</p>}
      {entries.length === 0 ? <p>Im gewählten Umkreis wurden keine Tankstellen gefunden.</p> : <div className="table-scroll">
        <table>
          <caption>{fuels[fuel]} · Preise in Euro je Liter · Entfernung zum Suchmittelpunkt, keine Fahrstrecke</caption>
          <thead><tr><th scope="col">Tankstelle</th><th scope="col">Entfernung</th><th scope="col">Preis (€/Liter)</th></tr></thead>
          <tbody>{entries.map(entry => <tr key={entry.station.id}>
            <td><strong>{entry.station.name}</strong><span className="station-address">{[entry.station.street, entry.station.houseNumber, entry.station.place].filter(Boolean).join(' ')}</span>
              <span className={entry.open ? 'connected' : 'demo-note'}>{entry.open ? 'Geöffnet beim Abruf' : 'Geschlossen beim Abruf'}</span></td>
            <td>{distanceFormat.format(entry.distanceKm)} km</td>
            <td>{entry.prices[fuel] !== undefined ? priceFormat.format(entry.prices[fuel]!) : 'Nicht verfügbar'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </>}
    <p className="last-checked">Quelle: <a href="https://creativecommons.tankerkoenig.de/">Tankerkönig / MTS-K</a> · <a href="https://creativecommons.org/licenses/by/4.0/deed.de">CC BY 4.0</a>. Preise können sich seit dem Abruf geändert haben.</p>
  </section>
}
