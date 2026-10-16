import { useEffect, useState } from 'react'

const stationId = '11111111-1111-4111-8111-111111111111'
const historyQuery = '?fuelType=e10&from=2026-10-16T00:00:00Z&to=2026-10-17T00:00:00Z'

type Station = { id: string; name: string; street: string; houseNumber: string; postalCode: string; place: string }
type Observation = { stationId: string; fuelType: string; price: number; observedAt: string }
type DemoState = { kind: 'loading' } | { kind: 'error'; message: string } |
  { kind: 'ready'; station: Station; prices: Observation[] }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStation(value: unknown): value is Station {
  return isObject(value) && value.id === stationId &&
    ['name', 'street', 'houseNumber', 'postalCode', 'place'].every(key => typeof value[key] === 'string')
}

function isObservation(value: unknown): value is Observation {
  return isObject(value) && value.stationId === stationId && value.fuelType === 'e10' &&
    typeof value.price === 'number' && Number.isFinite(value.price) && value.price > 0 &&
    typeof value.observedAt === 'string' && Number.isFinite(Date.parse(value.observedAt))
}

const dateFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short',
})
const priceFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export function DemoStation() {
  const [state, setState] = useState<DemoState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    let active = true

    async function load() {
      try {
        const options = { signal: controller.signal, cache: 'no-store' as const }
        const [stationResponse, pricesResponse] = await Promise.all([
          fetch(`/api/stations/${stationId}`, options),
          fetch(`/api/stations/${stationId}/prices${historyQuery}`, options),
        ])
        if (stationResponse.status === 404) throw new Error('Die Demo-Tankstelle wurde in dieser Datenbank noch nicht angelegt.')
        if (!stationResponse.ok || !pricesResponse.ok) throw new Error('Die Demodaten konnten nicht geladen werden. Prüfe, ob das Backend läuft.')
        const station: unknown = await stationResponse.json()
        const prices: unknown = await pricesResponse.json()
        if (!isStation(station) || !Array.isArray(prices) || !prices.every(isObservation)) {
          throw new Error('Das Backend hat unerwartete Demodaten geliefert.')
        }
        if (active) setState({ kind: 'ready', station, prices: [...prices].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)) })
      } catch (error) {
        if (active) setState({ kind: 'error', message: controller.signal.aborted
          ? 'Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.'
          : error instanceof Error ? error.message : 'Demodaten konnten nicht geladen werden.' })
      } finally {
        window.clearTimeout(timeout)
      }
    }
    void load()
    return () => { active = false; window.clearTimeout(timeout); controller.abort() }
  }, [attempt])

  return (
    <section className="connection-card demo-card" aria-labelledby="demo-title">
      <span className="demo-badge">Synthetische Demodaten</span>
      <h2 id="demo-title">Tankstelle und Preisverlauf</h2>
      <p className="demo-note">Fiktive Tankstelle und erfundene Preise zur Funktionsprüfung. Keine aktuellen Tankerkönig-Daten.</p>
      {state.kind === 'loading' && <p role="status">Demodaten werden geladen …</p>}
      {state.kind === 'error' && <p role="alert" className="error">{state.message}</p>}
      {state.kind === 'ready' && <>
        <h3>{state.station.name}</h3>
        <p>{state.station.street} {state.station.houseNumber}<br />{state.station.postalCode} {state.station.place}</p>
        {state.prices.length === 0 ? <p>Für diesen Zeitraum sind keine E10-Beobachtungen gespeichert.</p> :
          <div className="table-scroll">
            <table>
              <caption>Super E10 · 16. Oktober 2026 · Uhrzeiten in Europe/Berlin</caption>
              <thead><tr><th scope="col">Beobachtet am</th><th scope="col">Preis (€/Liter)</th></tr></thead>
              <tbody>{state.prices.map(price => <tr key={price.observedAt}>
                <td><time dateTime={price.observedAt}>{dateFormat.format(new Date(price.observedAt))}</time></td>
                <td>{priceFormat.format(price.price)}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        <p className="last-checked">Der Beobachtungszeitpunkt ist der Abrufzeitpunkt, nicht der bestätigte Zeitpunkt einer Preisänderung.</p>
      </>}
      <button disabled={state.kind === 'loading'} onClick={() => {
        setState({ kind: 'loading' })
        setAttempt(value => value + 1)
      }}>{state.kind === 'loading' ? 'Wird geladen …' : 'Demodaten neu laden'}</button>
    </section>
  )
}
