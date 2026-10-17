import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { StationsMap } from './StationsMap'
import { PriceSummary } from './PriceSummary'
import { StationFillCost, TankCalculator } from './TankCalculator'
import { summarizePrices } from './priceStatistics'
import { fillCostCents, parseTankVolume } from './tankCosts'
import { Icon } from './Icon'
import { LocationPicker } from './LocationPicker'
import { locationLabel } from './location'
import type { Location } from './location'
import { RouteLink } from './RouteLink'
import { useFavorites } from './useFavorites'
import { createDemoResult, demoHistoryLoader } from './demoData'
import type { Result, SearchResult } from './searchTypes'

const PriceHistory = lazy(() => import('./PriceHistory').then(module => ({ default: module.PriceHistory })))

type Fuel = 'diesel' | 'e5' | 'e10'
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
  const [demo, setDemo] = useState(false)
  return <>
    <div className={`demo-mode-panel${demo ? ' active' : ''}`}>
      <div><strong>{demo ? 'VORFÜHRMODUS · ALLE PREISE UND TANKSTELLEN SIND FIKTIV' : 'Das Projekt kennenlernen'}</strong>
        <p>{demo ? 'Beispieldaten für Liste, Karte, Tankkosten, Preisverlauf und CSV. Keine echten Routen oder Anbieterabrufe. Die Karte zeigt ein schematisches Koordinatengitter.' : 'Ohne Preis-API ausprobieren: Der Vorführmodus zeigt ausdrücklich fiktive Beispieldaten.'}</p></div>
      <button type="button" aria-pressed={demo} onClick={() => setDemo(value => !value)}>{demo ? 'Zur echten Suche wechseln' : 'Vorführmodus starten'}</button>
    </div>
    <SearchWorkspace key={demo ? 'demo' : 'live'} demo={demo} />
  </>
}

function SearchWorkspace({ demo }: { demo: boolean }) {
  const [fuel, setFuel] = useState<Fuel>('e10')
  const [sort, setSort] = useState('price')
  const [tankAmount, setTankAmount] = useState('40')
  const [historyStationId, setHistoryStationId] = useState<string | null>(null)
  const [result, setResult] = useState<SearchResult | null>(() => demo ? createDemoResult() : null)
  const [location, setLocation] = useState<Location | null>(null)
  const [radiusKm, setRadiusKm] = useState(5)
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState(0)
  const nextRequest = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)
  const favorites = useFavorites(demo)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const loadDemoSeries = useMemo(() => demo && result ? demoHistoryLoader(result) : undefined, [demo, result])

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((nextRequest.current - Date.now()) / 1000))), 1000)
    return () => { window.clearInterval(timer); activeRequest.current?.abort() }
  }, [])

  async function search() {
    if (demo || !location || activeRequest.current || Date.now() < nextRequest.current) return
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

  const entries = useMemo(() => [...(result?.stations ?? [])].filter(entry => !favoritesOnly || favorites.favorites.some(item => item.id === entry.station.id)).sort((a, b) => {
    if (sort === 'distance') return a.distanceKm - b.distanceKm || a.station.name.localeCompare(b.station.name)
    const aPrice = a.prices[fuel] ?? Infinity
    const bPrice = b.prices[fuel] ?? Infinity
    if (aPrice !== bPrice) return aPrice - bPrice
    return a.distanceKm - b.distanceKm || a.station.name.localeCompare(b.station.name)
  }), [result, sort, fuel, favoritesOnly, favorites.favorites])

  const comparison = useMemo(() => summarizePrices(result?.stations ?? [], fuel), [result, fuel])
  const historyStations = useMemo(() => result?.stations.map(entry => entry.station) ?? [], [result])
  const tankVolume = parseTankVolume(tankAmount)
  const cheapestFill = comparison ? fillCostCents(comparison.min, tankVolume) : null

  return <section className="live-card" aria-labelledby="live-title">
    <div className="search-panel" id="search-panel">
    <div className="section-heading"><div><p className="section-kicker">01 / DEINE SUCHE</p><h2 id="live-title">Wo möchtest du tanken?</h2></div><span className="live-badge"><span />{demo ? 'Synthetische Beispieldaten' : 'Daten von Tankerkönig'}</span></div>
    <div className="search-workspace">
    <LocationPicker selected={location} onSelect={setLocation} disabled={loading || demo} locating={locating} onLocationBusy={setLocating} />
    <div className="search-options"><h3><span className="step-number">2</span> Suche eingrenzen</h3>
    <p className="selection-note">{demo ? 'Vorführgebiet: Detmold · 5 km. Die echte Suche ist im Vorführmodus gesperrt.' : location ? `Ausgewählt: ${locationLabel(location)}` : 'Wähle zuerst einen passenden Ortstreffer.'}</p>
    <div className="search-controls">
      <label>Suchradius<select disabled={loading || demo} value={radiusKm} onChange={event => setRadiusKm(Number(event.target.value))}>
        {[1, 2, 5, 10, 15, 25].map(radius => <option key={radius} value={radius}>{radius} km</option>)}
      </select></label>
      <label>Kraftstoff<select value={fuel} onChange={event => setFuel(event.target.value as Fuel)}>
        <option value="e10">Super E10</option><option value="e5">Super E5</option><option value="diesel">Diesel</option>
      </select></label>
      <label>Sortieren nach<select value={sort} onChange={event => setSort(event.target.value)}>
        <option value="price">Preis, günstigster zuerst</option><option value="distance">Entfernung, nächste zuerst</option>
      </select></label>
    </div>
    <button className="search-submit" disabled={demo || !location || loading || remaining > 0} onClick={() => void search()}>
      {loading ? 'Preise werden abgerufen …' : remaining > 0 ? `Erneut möglich in ${remaining} s` : 'Preise abrufen'}
      <Icon name="arrow" /></button>
    <p className="last-checked">Abruf auf Klick. Danach frei vergleichen und sortieren.</p>
    </div></div>
    {loading && <p role="status">Tankstellen werden abgerufen und in der Datenbank gespeichert …</p>}
    {error && <p role="alert" className="error">{error}</p>}
    </div>
    <details className="favorites-panel"><summary>Meine Favoriten ({favorites.favorites.length})</summary>
      <p className="last-checked">Nur in diesem Browser gespeichert, ohne Preise. Demo-Favoriten sind von echten Favoriten getrennt.</p>
      {favorites.message && <p role="status">{favorites.message}</p>}
      {favorites.favorites.length === 0 ? <p>Noch keine Favoriten. Merke eine Tankstelle in der Ergebnisliste.</p> : <ul>{favorites.favorites.map(station => <li key={station.id}>
        <strong>{station.name}</strong><span>{[station.street, station.houseNumber, station.place].filter(Boolean).join(' ')}</span>
        <div className="station-actions"><RouteLink station={station} demo={demo} />
          {!demo && <button type="button" disabled={loading || locating} onClick={() => setLocation({ id: -2, name: `Um ${station.name}`, region: station.place, district: null, latitude: station.latitude, longitude: station.longitude })}>In dieser Umgebung suchen</button>}
          <button type="button" onClick={() => favorites.toggle(station)} aria-label={`Favorit ${station.name} entfernen`}>Entfernen</button></div>
      </li>)}</ul>}
    </details>
    <div id="results" className="results-area">
    {!result && <div className="empty-state"><div className="empty-orbit" aria-hidden="true"><span /><span /><Icon name="fuel" /></div><div><p className="section-kicker">DEIN NÄCHSTER TANKSTOPP</p><h3>Ein guter Preis beginnt<br />mit einem guten Überblick.</h3><p>Wähle oben einen Ort und rufe die Preise ab.<br />Hier erscheinen dein Preisvergleich und die Tankstellenkarte.</p></div><span className="empty-caption">SUCHEN → VERGLEICHEN → ENTSCHEIDEN</span></div>}
    {result && <>
      <div className="section-heading result-heading"><div><p className="section-kicker">02 / DEIN PREISÜBERBLICK</p><h3>{result.searchLabel} <span className="radius-badge">{result.radiusKm} km Umkreis</span></h3></div><p className="result-count"><strong>{result.stations.length}</strong> Tankstellen gefunden</p></div>
      <p role="status" className="data-timestamp">Datenstand: <time dateTime={result.observedAt}>{dateFormat.format(new Date(result.observedAt))}</time> (Berlin)</p>
      {(loading || error) && <p className="loading">Die angezeigten Ergebnisse stammen weiterhin vom oben genannten Datenstand.</p>}
      {result.rejectedStations > 0 && <p className="loading">{result.rejectedStations} ungültige Datensätze wurden verworfen.</p>}
      <PriceSummary entries={result.stations} fuel={fuel} />
      <TankCalculator value={tankAmount} onChange={setTankAmount} minimumPrice={comparison?.min ?? null} maximumPrice={comparison?.max ?? null} />
      <label className="favorite-filter"><input type="checkbox" checked={favoritesOnly} onChange={event => setFavoritesOnly(event.target.checked)} />Nur Favoriten in Liste und Karte anzeigen</label>
      {favorites.message && <p role="status">{favorites.message}</p>}
      <p className="last-checked">Preisübersicht und Tankkosten beziehen sich weiterhin auf alle gefundenen Tankstellen. {demo ? 'Keine echten Routen für fiktive Tankstellen.' : '„Route zur Tankstelle“ öffnet Google Maps in einem neuen Tab und übermittelt die Zielkoordinaten. Startpunkt dort wählen; unsere Entfernungen sind Luftlinien.'}</p>
      <div className="results-grid">
      <StationsMap entries={entries} fuel={fuel} center={result.center} radiusKm={result.radiusKm} observedAt={result.observedAt} demo={demo} />
      <section className="station-panel" aria-labelledby="stations-title"><div className="panel-heading"><div><p className="section-kicker">PREISE IM VERGLEICH</p><h4 id="stations-title">Deine Tankstellen</h4></div><span className="count-badge">{entries.length}</span></div>
      {entries.length === 0 ? <p>{favoritesOnly ? 'Keine gespeicherten Favoriten in diesem Suchergebnis. Deaktiviere den Filter, um alle Tankstellen zu sehen.' : 'Im gewählten Umkreis wurden keine Tankstellen gefunden.'}</p> : <div className="table-scroll station-list-scroll">
        <table className="station-table">
          <caption>{fuels[fuel]} · Preise in Euro je Liter · Entfernung zum Suchmittelpunkt, keine Fahrstrecke</caption>
          <thead><tr><th scope="col">Tankstelle</th><th scope="col">Entfernung</th><th scope="col">Preis (€/Liter)</th></tr></thead>
          <tbody>{entries.map(entry => <tr key={entry.station.id}>
            <td><strong>{entry.station.name}</strong><span className="station-address">{[entry.station.street, entry.station.houseNumber, entry.station.place].filter(Boolean).join(' ')}</span>
              <span className={`station-open ${entry.open ? 'connected' : 'demo-note'}`}>{entry.open ? 'Geöffnet beim Abruf' : 'Geschlossen beim Abruf'}</span>
              <button className="history-button" aria-pressed={historyStationId === entry.station.id} onClick={() => setHistoryStationId(entry.station.id)}><Icon name="chart" />Preisverlauf ansehen<span className="sr-only">: {entry.station.name}</span><Icon name="arrow" /></button>
              <div className="station-actions"><RouteLink station={entry.station} demo={demo} /><button type="button" className="favorite-button" aria-pressed={favorites.favorites.some(item => item.id === entry.station.id)} onClick={() => favorites.toggle(entry.station)} aria-label={`Favorit: ${entry.station.name}`}>{favorites.favorites.some(item => item.id === entry.station.id) ? '★ Gemerkt' : '☆ Merken'}</button></div></td>
            <td className="station-distance">{distanceFormat.format(entry.distanceKm)} km</td>
            <td className="station-price">{entry.prices[fuel] !== undefined ? priceFormat.format(entry.prices[fuel]!) : 'Nicht verfügbar'}<StationFillCost price={entry.open ? entry.prices[fuel] : undefined} volume={tankVolume} cheapestCents={cheapestFill} /></td>
          </tr>)}</tbody>
        </table>
      </div>}</section></div>
    </>}
    </div>
      <div id="history-area"><Suspense fallback={<p role="status">Diagramm wird geladen …</p>}>
        {result && <>
        {result.stations.filter(entry => entry.station.id === historyStationId).map(entry =>
          <PriceHistory key={entry.station.id} station={entry.station} availableStations={historyStations} fuel={fuel} observedAt={result.observedAt} loadSeries={loadDemoSeries} demo={demo} />)}
        </>}
      </Suspense></div>
      {!historyStationId && <div className="history-placeholder"><Icon name="chart" /><div><h3>Jeder Abruf erzählt ein Stück mehr.</h3><p>Wähle nach deiner Suche bei einer Tankstelle „Preisverlauf ansehen“, um gespeicherte Beobachtungen zu vergleichen.</p></div></div>}
    <p className="source-footer">{demo ? 'Synthetische Vorführdaten · keine echten Preise oder Tankstellen.' : <>Quelle: <a href="https://creativecommons.tankerkoenig.de/">Tankerkönig / MTS-K</a> · <a href="https://creativecommons.org/licenses/by/4.0/deed.de">CC BY 4.0</a>. Preise können sich seit dem Abruf geändert haben.</>}</p>
  </section>
}
