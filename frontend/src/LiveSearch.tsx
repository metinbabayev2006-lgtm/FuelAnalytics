import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { StationsMap } from './StationsMap'
import { LocationPicker } from './LocationPicker'
import { locationLabel } from './location'
import type { Location } from './location'

const PriceHistory = lazy(() => import('./PriceHistory').then(module => ({ default: module.PriceHistory })))

type Fuel = 'diesel' | 'e5' | 'e10'
type Entry = {
  station: { id: string; name: string; street: string | null; houseNumber: string | null; place: string | null; latitude: number; longitude: number }
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
      typeof station.latitude === 'number' && Number.isFinite(station.latitude) && Math.abs(station.latitude) <= 90 &&
      typeof station.longitude === 'number' && Number.isFinite(station.longitude) && Math.abs(station.longitude) <= 180 &&
      ['street', 'houseNumber', 'place'].every(field => station[field] === null || typeof station[field] === 'string') &&
      typeof entry.open === 'boolean' && typeof entry.distanceKm === 'number' && Number.isFinite(entry.distanceKm) && entry.distanceKm >= 0 &&
      object(entry.prices) && Object.entries(entry.prices).every(([fuel, price]) =>
        Object.hasOwn(fuels, fuel) && typeof price === 'number' && Number.isFinite(price) && price > 0)
  })
}

export function LiveSearch() {
  const [fuel, setFuel] = useState<Fuel>('e10')
  const [sort, setSort] = useState('price')
  const [historyStationId, setHistoryStationId] = useState<string | null>(null)
  const [result, setResult] = useState<(Result & { searchLabel: string; radiusKm: number; center: Location }) | null>(null)
  const [location, setLocation] = useState<Location | null>(null)
  const [radiusKm, setRadiusKm] = useState(5)
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
    if (!location || activeRequest.current || Date.now() < nextRequest.current) return
    const searchLabel = locationLabel(location)
    const requestedRadius = radiusKm
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
        body: JSON.stringify({ latitude: location.latitude, longitude: location.longitude, radiusKm: requestedRadius }),
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
      setResult({ ...data, searchLabel, radiusKm: requestedRadius, center: location })
      setHistoryStationId(null)
    } catch (cause) {
      setError(controller.signal.aborted ? 'Die Anfrage wurde abgebrochen oder hat zu lange gedauert.'
        : cause instanceof Error ? cause.message : 'Die Suche ist fehlgeschlagen.')
    } finally {
      window.clearTimeout(timeout)
      activeRequest.current = null
      setLoading(false)
    }
  }

  const entries = useMemo(() => [...(result?.stations ?? [])].sort((a, b) => {
    if (sort === 'distance') return a.distanceKm - b.distanceKm || a.station.name.localeCompare(b.station.name)
    const aPrice = a.prices[fuel] ?? Infinity
    const bPrice = b.prices[fuel] ?? Infinity
    if (aPrice !== bPrice) return aPrice - bPrice
    return a.distanceKm - b.distanceKm || a.station.name.localeCompare(b.station.name)
  }), [result, sort, fuel])

  return <section className="connection-card live-card" aria-labelledby="live-title">
    <span className="live-badge">Tankerkönig · echte Daten</span>
    <h2 id="live-title">Tankstellen suchen</h2>
    <p className="demo-note">Wähle einen Ort und den Umkreis. Preise werden auf deinen Klick abgerufen und gespeichert.</p>
    <LocationPicker selected={location} onSelect={setLocation} disabled={loading} />
    <h3>2. Kraftstoffpreise abrufen</h3>
    <p>{location ? `Ausgewählter Ort: ${locationLabel(location)}` : 'Bitte zuerst einen Ort suchen und einen Treffer auswählen.'}</p>
    <div className="search-controls">
      <label>Suchradius<select disabled={loading} value={radiusKm} onChange={event => setRadiusKm(Number(event.target.value))}>
        {[1, 2, 5, 10, 15, 25].map(radius => <option key={radius} value={radius}>{radius} km</option>)}
      </select></label>
      <label>Kraftstoff<select value={fuel} onChange={event => setFuel(event.target.value as Fuel)}>
        <option value="e10">Super E10</option><option value="e5">Super E5</option><option value="diesel">Diesel</option>
      </select></label>
      <label>Sortieren nach<select value={sort} onChange={event => setSort(event.target.value)}>
        <option value="price">Preis, günstigster zuerst</option><option value="distance">Entfernung, nächste zuerst</option>
      </select></label>
    </div>
    <button disabled={!location || loading || remaining > 0} onClick={() => void search()}>
      {loading ? 'Preise werden abgerufen …' : remaining > 0 ? `Erneut möglich in ${remaining} s` : 'Preise abrufen'}
    </button>
    <p className="last-checked">Kein automatischer Abruf. Kraftstoffwechsel und Sortierung benötigen keine neue Abfrage.</p>
    {loading && <p role="status">Tankstellen werden abgerufen und in der Datenbank gespeichert …</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {!result && !loading && !error && <p>Noch keine Live-Abfrage in dieser Ansicht.</p>}
    {result && <>
      <h3>Ergebnisse: {result.searchLabel} · {result.radiusKm} km</h3>
      <p role="status">{result.stations.length} Tankstellen · Datenstand: <time dateTime={result.observedAt}>{dateFormat.format(new Date(result.observedAt))}</time> (Berlin)</p>
      {(loading || error) && <p className="loading">Die angezeigten Ergebnisse stammen weiterhin vom oben genannten Datenstand.</p>}
      {result.rejectedStations > 0 && <p className="loading">{result.rejectedStations} ungültige Datensätze wurden verworfen.</p>}
      <StationsMap entries={entries} fuel={fuel} center={result.center} radiusKm={result.radiusKm} observedAt={result.observedAt} />
      {entries.length === 0 ? <p>Im gewählten Umkreis wurden keine Tankstellen gefunden.</p> : <div className="table-scroll">
        <table>
          <caption>{fuels[fuel]} · Preise in Euro je Liter · Entfernung zum Suchmittelpunkt, keine Fahrstrecke</caption>
          <thead><tr><th scope="col">Tankstelle</th><th scope="col">Entfernung</th><th scope="col">Preis (€/Liter)</th></tr></thead>
          <tbody>{entries.map(entry => <tr key={entry.station.id}>
            <td><strong>{entry.station.name}</strong><span className="station-address">{[entry.station.street, entry.station.houseNumber, entry.station.place].filter(Boolean).join(' ')}</span>
              <span className={entry.open ? 'connected' : 'demo-note'}>{entry.open ? 'Geöffnet beim Abruf' : 'Geschlossen beim Abruf'}</span>
              <button className="history-button" aria-pressed={historyStationId === entry.station.id} onClick={() => setHistoryStationId(entry.station.id)}>Preisverlauf ansehen<span className="sr-only">: {entry.station.name}</span></button></td>
            <td>{distanceFormat.format(entry.distanceKm)} km</td>
            <td>{entry.prices[fuel] !== undefined ? priceFormat.format(entry.prices[fuel]!) : 'Nicht verfügbar'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <div><Suspense fallback={<p role="status">Diagramm wird geladen …</p>}>
        {result.stations.filter(entry => entry.station.id === historyStationId).map(entry =>
          <PriceHistory key={entry.station.id} station={entry.station} fuel={fuel} observedAt={result.observedAt} />)}
      </Suspense></div>
    </>}
    <p className="last-checked">Quelle: <a href="https://creativecommons.tankerkoenig.de/">Tankerkönig / MTS-K</a> · <a href="https://creativecommons.org/licenses/by/4.0/deed.de">CC BY 4.0</a>. Preise können sich seit dem Abruf geändert haben.</p>
  </section>
}
