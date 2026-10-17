import { useEffect, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Fuel = 'diesel' | 'e5' | 'e10'
type Station = { id: string; name: string }
export type Observation = { stationId: string; fuelType: string; price: number; observedAt: string }
const names = { diesel: 'Diesel', e5: 'Super E5', e10: 'Super E10' }
const priceFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const dateFormat = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'medium' })
const tickFormat = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function PriceChart({ prices }: { prices: Observation[] }) {
  const data = prices.map(price => ({ ...price, timestamp: Date.parse(price.observedAt) }))
  return <>
    {prices.length === 1 && <p>Erst eine Beobachtung vorhanden. Für einen Verlauf werden weitere Abrufe benötigt.</p>}
    <div className="price-chart" role="group" aria-label={`Preisverlauf mit ${prices.length} Beobachtungen. Exakte Werte stehen in der Tabelle darunter.`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 16, right: 24, bottom: 16, left: 4 }} accessibilityLayer>
          <CartesianGrid stroke="#34465b" strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={value => tickFormat.format(new Date(Number(value)))} stroke="#b5c3d2" minTickGap={40} />
          <YAxis domain={['auto', 'auto']} tickFormatter={value => priceFormat.format(Number(value))} stroke="#b5c3d2" width={66} />
          <Tooltip labelFormatter={value => dateFormat.format(new Date(Number(value)))} formatter={value => [`${priceFormat.format(Number(value))} €/Liter`, 'Preis']} contentStyle={{ background: '#0e1928', border: '1px solid #70859f', color: '#edf3fa' }} />
          <Line type="linear" dataKey="price" stroke="#a2e4c5" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <details><summary>Messwerte als Tabelle ({prices.length})</summary><div className="table-scroll">
      <table><caption>Gespeicherte Beobachtungen · Uhrzeiten in Europe/Berlin</caption>
        <thead><tr><th scope="col">Beobachtet am</th><th scope="col">Preis (€/Liter)</th></tr></thead>
        <tbody>{prices.map(price => <tr key={price.observedAt}><td><time dateTime={price.observedAt}>{dateFormat.format(new Date(price.observedAt))}</time></td><td>{priceFormat.format(price.price)}</td></tr>)}</tbody>
      </table>
    </div></details>
    <p className="last-checked">Die Linie verbindet gespeicherte Abrufe. Dazwischen fehlen Messungen; der tatsächliche Verlauf ist unbekannt. Die Preisachse ist automatisch skaliert.</p>
  </>
}

function HistoryData({ station, fuel, days }: { station: Station; fuel: Fuel; days: number }) {
  const [state, setState] = useState<{ prices: Observation[]; from: string; to: string } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    const to = new Date().toISOString()
    const from = new Date(Date.parse(to) - days * 86_400_000).toISOString()
    async function load() {
      try {
        const query = new URLSearchParams({ fuelType: fuel, from, to })
        const response = await fetch(`/api/stations/${encodeURIComponent(station.id)}/prices?${query}`, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error(response.status === 404 ? 'Diese Tankstelle ist nicht mehr gespeichert.' : 'Der Preisverlauf konnte nicht geladen werden. Prüfe das Backend.')
        const data: unknown = await response.json()
        if (!Array.isArray(data) || !data.every((value: unknown): value is Observation => {
          if (typeof value !== 'object' || value === null) return false
          const item = value as Record<string, unknown>
          return item.stationId === station.id && item.fuelType === fuel && typeof item.price === 'number' && Number.isFinite(item.price) && item.price > 0 &&
            typeof item.observedAt === 'string' && Number.isFinite(Date.parse(item.observedAt)) && Date.parse(item.observedAt) >= Date.parse(from) && Date.parse(item.observedAt) < Date.parse(to)
        })) throw new Error('Der Preisverlauf hat ein unerwartetes Format.')
        if (active) setState({ prices: [...data].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)), from, to })
      } catch (cause) {
        if (active) setError(controller.signal.aborted ? 'Das Laden hat zu lange gedauert. Bitte erneut versuchen.' : cause instanceof Error ? cause.message : 'Preisverlauf konnte nicht geladen werden.')
      } finally { window.clearTimeout(timeout) }
    }
    void load()
    return () => { active = false; controller.abort(); window.clearTimeout(timeout) }
  }, [station.id, fuel, days])
  if (error) return <p role="alert" className="error">{error}</p>
  if (!state) return <p role="status">Gespeicherte Preise werden geladen …</p>
  const range = state.prices.reduce((result, observation) => ({
    min: Math.min(result.min, observation.price), max: Math.max(result.max, observation.price),
  }), { min: Infinity, max: -Infinity })
  return <>
    <p className="last-checked">Zeitraum: {dateFormat.format(new Date(state.from))} bis {dateFormat.format(new Date(state.to))} (Berlin, Ende ausgeschlossen).</p>
    {state.prices.length === 0 ? <p role="status">Für diesen Kraftstoff und Zeitraum sind keine Beobachtungen gespeichert.</p> : <>
      <p role="status">{state.prices.length} Beobachtungen · Minimum {priceFormat.format(range.min)} · Maximum {priceFormat.format(range.max)} €/Liter</p>
      <PriceChart prices={state.prices} />
    </>}
  </>
}

export function PriceHistory({ station, fuel, observedAt }: { station: Station; fuel: Fuel; observedAt: string }) {
  const [days, setDays] = useState(7)
  const [attempt, setAttempt] = useState(0)
  const heading = useRef<HTMLHeadingElement | null>(null)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => heading.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [])
  return <section className="history-section" aria-labelledby="history-title">
    <h3 id="history-title" ref={heading} tabIndex={-1}>Preisverlauf: {station.name}</h3>
    <p>{names[fuel]} · Nur bereits gespeicherte Beobachtungen. Das Laden fragt keine neuen Tankerkönig-Preise ab.</p>
    <div className="search-controls"><label>Zeitraum<select value={days} onChange={event => setDays(Number(event.target.value))}>
      <option value={1}>Letzte 24 Stunden</option><option value={7}>Letzte 7 Tage</option><option value={30}>Letzte 30 Tage</option>
    </select></label></div>
    <button onClick={() => setAttempt(value => value + 1)}>Verlauf neu laden</button>
    <HistoryData key={`${station.id}-${fuel}-${days}-${attempt}-${observedAt}`} station={station} fuel={fuel} days={days} />
    <p className="last-checked">Der Beobachtungszeitpunkt ist der Abrufzeitpunkt, nicht der bestätigte Zeitpunkt einer Preisänderung. Historische Daten entstehen erst durch eigene Abrufe.</p>
  </section>
}
