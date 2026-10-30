import { useEffect, useRef, useState } from 'react'

import { locationLabel, locationPosition } from './location'
import type { Location } from './location'
import { LocationButton } from './LocationButton'

function isLocation(value: unknown): value is Location {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return Number.isInteger(row.id) && typeof row.name === 'string' && row.name.length > 0 &&
    (row.region === null || typeof row.region === 'string') && (row.district === null || typeof row.district === 'string') &&
    typeof row.latitude === 'number' && Number.isFinite(row.latitude) && Math.abs(row.latitude) <= 90 &&
    typeof row.longitude === 'number' && Number.isFinite(row.longitude) && Math.abs(row.longitude) <= 180
}

type Props = { selected: Location | null; onSelect: (location: Location | null) => void; disabled: boolean; locating: boolean; onLocationBusy: (busy: boolean) => void }

export function LocationPicker({ selected, onSelect, disabled, locating, onLocationBusy }: Props) {
  const [query, setQuery] = useState('Detmold')
  const [mode, setMode] = useState('place')
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const active = useRef<AbortController | null>(null)

  useEffect(() => () => { active.current?.abort(); active.current = null }, [])

  async function searchLocations() {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setLoading(true)
    setError('')
    setLocations([])
    setSearched(false)
    onSelect(null)
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await fetch(`/api/locations?query=${encodeURIComponent(query.trim())}&mode=${mode}`, { signal: controller.signal })
      if (!response.ok) throw new Error(response.status === 429 ? 'Bitte warte kurz vor der nächsten Ortssuche.'
        : mode === 'address' && response.status !== 400 ? 'Die Adresssuche ist derzeit nicht erreichbar. Bitte später erneut versuchen oder Ort/PLZ bzw. deinen Standort nutzen.'
        : response.status === 400 ? 'Bitte gib einen Ort oder eine Adresse mit 2 bis 100 Zeichen oder eine fünfstellige deutsche PLZ ein.'
          : /^[0-9]{5}$/.test(query.trim()) ? 'Der PLZ-Dienst ist nicht erreichbar oder liefert keine gültigen Koordinaten. Bitte suche stattdessen nach dem Ortsnamen.'
            : 'Der Dienst für Ortsnamen ist derzeit nicht erreichbar. Bitte versuche eine fünfstellige PLZ (Berlin zum Beispiel: 10115) oder nutze deinen Standort.')
      const data: unknown = await response.json()
      if (typeof data !== 'object' || data === null || !('locations' in data) ||
        !Array.isArray(data.locations) || !data.locations.every(isLocation)) throw new Error('Die Ortssuche hat unerwartete Daten geliefert.')
      if (active.current === controller) { setLocations(data.locations); setSearched(true) }
    } catch (cause) {
      if (active.current === controller) setError(controller.signal.aborted ? 'Die Ortssuche hat zu lange gedauert. Versuche eine PLZ statt des Ortsnamens oder umgekehrt, oder nutze deinen Standort.'
        : cause instanceof Error ? cause.message : 'Die Ortssuche ist fehlgeschlagen.')
    } finally {
      window.clearTimeout(timeout)
      if (active.current === controller) { active.current = null; setLoading(false) }
    }
  }

  return <div className="location-picker">
    <form onSubmit={event => { event.preventDefault(); void searchLocations() }}>
      <fieldset disabled={disabled || locating}>
        <legend>Standort</legend>
        <div className="location-type"><label htmlFor="location-mode">Suchen nach</label>
        <select id="location-mode" value={mode} onChange={event => {
          active.current?.abort(); active.current = null
          setMode(event.target.value); onSelect(null); setLocations([]); setLoading(false); setError(''); setSearched(false)
        }}><option value="place">Ort oder PLZ</option><option value="address">Straße und Hausnummer</option></select></div>
        <label htmlFor="place-query">{mode === 'address' ? 'Straße, Hausnummer und Ort in Deutschland' : 'Ort oder Postleitzahl in Deutschland'}</label>
        {mode === 'address' && <p className="last-checked">Zum Beispiel: Hornsche Straße 43, Detmold. Suche über OpenStreetMap.</p>}
        <div className="location-input-row">
          <input id="place-query" value={query} minLength={2} maxLength={100} required onChange={event => {
            active.current?.abort(); active.current = null
            setQuery(event.target.value); onSelect(null); setLocations([]); setLoading(false); setError(''); setSearched(false)
          }} />
          <button type="submit" disabled={loading || query.trim().length < 2}>{loading ? 'Ort wird gesucht …' : 'Ort suchen'}</button>
        </div>
        {loading && <p role="status">Passende Orte werden gesucht …</p>}
        {error && <p role="alert" className="error">{error}</p>}
        {searched && locations.length === 0 && <p role="status">Kein passender Treffer gefunden. Ergänze bei Straßen bitte den Ort oder die PLZ.</p>}
        {locations.length > 0 && <>
          <p role="status">Passenden Treffer auswählen:</p>
          <ul className="location-results">{locations.map(location => <li key={location.id}>
            <button type="button" aria-pressed={selected?.id === location.id} onClick={() => onSelect(location)}>
              {locationLabel(location)}{selected?.id === location.id ? ' · Ausgewählt' : ''}
              <span className="location-position sr-only">{locationPosition(location)}</span>
            </button>
          </li>)}</ul>
        </>}
        <details className="source-details"><summary>Datenquellen der Suche</summary><p className="last-checked">Adressen: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende · ODbL</a>, über Nominatim. Ortsnamen: <a href="https://open-meteo.com/en/docs/geocoding-api">Open-Meteo</a> / <a href="https://www.geonames.org/">GeoNames</a>. PLZ: <a href="https://zippopotam.us/">Zippopotam.us</a> / GeoNames. Die Ortssuche ruft noch keine Kraftstoffpreise ab.</p></details>
      </fieldset>
    </form>
    <LocationButton disabled={disabled || loading} onBusyChange={onLocationBusy} onStart={() => onSelect(null)} onSelect={location => {
      active.current?.abort(); active.current = null
      setLocations([]); setSearched(false); setError(''); setLoading(false); onSelect(location)
    }} />
  </div>
}
