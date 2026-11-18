import { useEffect, useState } from 'react'
import type { SavedStation } from './stationActions'

type Hours = { wholeDay: boolean; periods: { label: string; start: string; end: string }[]; exceptions: string[] }

function isHours(value: unknown): value is Hours {
  if (!value || typeof value !== 'object') return false
  const hours = value as Hours
  return typeof hours.wholeDay === 'boolean' && Array.isArray(hours.periods) && Array.isArray(hours.exceptions) &&
    hours.periods.every(period => period && typeof period.label === 'string' && typeof period.start === 'string' && typeof period.end === 'string') &&
    hours.exceptions.every(exception => typeof exception === 'string')
}

export function StationDetails({ station }: { station: SavedStation }) {
  const [hours, setHours] = useState<Hours | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    if (!remaining) return
    const timer = window.setTimeout(() => setRemaining(seconds => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [remaining])
  const maps = new URL('https://www.google.com/maps/search/')
  maps.search = new URLSearchParams({ api: '1', query: [station.name, station.street, station.houseNumber, station.place].filter(Boolean).join(' ') }).toString()

  async function loadHours() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/stations/${encodeURIComponent(station.id)}/opening-hours`, { signal: AbortSignal.timeout(15000) })
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('Retry-After'))
        setRemaining(Number.isInteger(retryAfter) && retryAfter > 0 && retryAfter <= 61 ? retryAfter : 61)
        return
      }
      if (response.status === 404) {
        setError('Der Öffnungszeitenabruf ist in diesem Backend nicht verfügbar. Bitte starte die aktuelle Backend-Version.')
        return
      }
      if (!response.ok) throw new Error('Hours unavailable')
      const value: unknown = await response.json()
      if (!isHours(value)) throw new Error('Invalid opening hours')
      setHours(value)
    } catch {
      setError('Die Öffnungszeiten konnten gerade nicht geladen werden.')
    } finally {
      setBusy(false)
    }
  }

  return <details className="source-details">
    <summary>Öffnungszeiten und Bewertungen</summary>
    {!hours && <button type="button" className="favorite-button" disabled={busy || remaining > 0} onClick={() => void loadHours()}>{busy ? 'Öffnungszeiten werden geladen …' : remaining ? `Erneut möglich in ${remaining} s` : 'Öffnungszeiten abrufen'}</button>}
    {error && <p role="status">{error}</p>}
    {hours && <div aria-live="polite">
      {hours.wholeDay && <p>Regulär rund um die Uhr geöffnet</p>}
      {hours.periods.length > 0 && <ul>{hours.periods.map((period, index) => <li key={index}>{period.label}: {period.start}–{period.end} Uhr</li>)}</ul>}
      {!hours.wholeDay && !hours.periods.length && <p>Keine regulären Öffnungszeiten gemeldet.</p>}
      {hours.exceptions.length > 0 && <><p>Gemeldete Abweichungen</p><ul>{hours.exceptions.map((exception, index) => <li key={index}>{exception}</li>)}</ul></>}
      <a className="route-link" href="https://www.tankerkoenig.de/">Quelle: Tankerkönig</a>
    </div>}
    <p><a className="route-link" href={maps.toString()} target="_blank" rel="noopener noreferrer">Bewertungen und Kommentare auf Google Maps ansehen ↗</a></p>
  </details>
}
