import { useEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { comparisonRows, historyStationLabel, historyStatistics, loadHistorySeries, toggleComparison } from './historyComparison'
import type { Fuel, HistorySeries, HistoryStation } from './historyComparison'
import { HistoryExport } from './HistoryExport'
import { historyRange } from './historyRange'
import { useId } from 'react'

const names = { diesel: 'Diesel', e5: 'Super E5', e10: 'Super E10' }
const colors = ['#416c3b', '#2866a0', '#a35424']
const dashes = ['', '8 4', '2 4']
const priceFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const dateFormat = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'medium' })
const tickFormat = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function ComparisonChart({ series }: { series: HistorySeries[] }) {
  const data = useMemo(() => comparisonRows(series), [series])
  const observations = series.flatMap((entry, index) => entry.prices.map(price => ({ ...price, index })))
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt) || a.index - b.index)
  return <>
    <ul className="history-legend" aria-label="Diagrammlegende">{series.map((entry, index) => <li key={entry.station.id}>
      <span className={`history-line-sample line-${index}`} style={{ borderColor: colors[index] }} aria-hidden="true" />
      <span><strong>{historyStationLabel(entry.station)}</strong><small>{entry.error ? 'Nicht geladen' : `${entry.prices.length} Beobachtungen`}</small></span>
    </li>)}</ul>
    <div className="price-chart" role="group" aria-label={`Gemeinsamer Preisverlauf für ${series.length} Tankstellen. Exakte Messwerte stehen in der Tabelle darunter.`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 16, right: 24, bottom: 16, left: 4 }} accessibilityLayer>
          <CartesianGrid stroke="#e1e7d9" strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" type="number" scale="time" domain={([min, max]: readonly [number, number]) => min === max ? [min - 30_000, max + 30_000] : [min, max]} tickFormatter={value => tickFormat.format(new Date(Number(value)))} stroke="#71806a" minTickGap={40} />
          <YAxis domain={['auto', 'auto']} tickFormatter={value => priceFormat.format(Number(value))} stroke="#71806a" width={66} />
          <Tooltip filterNull labelFormatter={value => dateFormat.format(new Date(Number(value)))} formatter={(value, name) => [`${priceFormat.format(Number(value))} €/Liter`, name]} contentStyle={{ background: '#fff', border: '1px solid #c6d3ba', borderRadius: 8, color: '#263b30', boxShadow: '0 5px 20px #203c1910', maxWidth: 280, whiteSpace: 'normal', overflowWrap: 'anywhere' }} />
          {series.map((entry, index) => <Line key={entry.station.id} name={historyStationLabel(entry.station)} dataKey={`series${index}`} type="linear" connectNulls stroke={colors[index]} strokeDasharray={dashes[index]} strokeWidth={2} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <p className="last-checked">Punkte sind gespeicherte Abrufe. Linien verbinden nur die Messpunkte derselben Tankstelle; Zwischenpreise sind unbekannt. Fehlende Werte werden nicht ergänzt. Die Preisachse ist automatisch skaliert.</p>
    <details><summary>Messwerte als Tabelle ({observations.length})</summary><div className="table-scroll">
      <table><caption>Beobachtungen aller ausgewählten Tankstellen · Uhrzeiten in Europe/Berlin</caption>
        <thead><tr><th scope="col">Beobachtet am</th><th scope="col">Tankstelle</th><th scope="col">Preis (€/Liter)</th></tr></thead>
        <tbody>{observations.map(price => <tr key={`${price.stationId}-${price.observedAt}`}><td><time dateTime={price.observedAt}>{dateFormat.format(new Date(price.observedAt))}</time></td><td>{historyStationLabel(series[price.index].station)}</td><td>{priceFormat.format(price.price)}</td></tr>)}</tbody>
      </table>
    </div></details>
  </>
}

export function HistoryStatistics({ series }: { series: HistorySeries[] }) {
  const statsId = useId()
  return <section className="history-analysis" aria-labelledby={statsId}>
    <h4 id={statsId}>Auswertung der gespeicherten Messungen</h4>
    <p className="last-checked">Für den oben gewählten Zeitraum · Preise in €/Liter. Der Durchschnitt zählt jeden Abruf gleich, auch wiederholte Preise. Er ist kein zeitgewichteter Tagesdurchschnitt und keine Prognose.</p>
    <div className="history-statistics">{series.map(entry => {
      const stats = entry.error ? null : historyStatistics(entry.prices)
      return <article key={entry.station.id} className="history-stat-card">
        <h5>{historyStationLabel(entry.station)}</h5>
        {stats ? <>
          <dl>
            <div><dt>Niedrigster Preis</dt><dd>{priceFormat.format(stats.min)}</dd></div>
            <div><dt>Durchschnitt</dt><dd>{priceFormat.format(stats.mean)}</dd></div>
            <div><dt>Höchster Preis</dt><dd>{priceFormat.format(stats.max)}</dd></div>
            <div><dt>Messungen</dt><dd>{stats.count}</dd></div>
          </dl>
          <p className="last-checked">Erste Messung: <time dateTime={new Date(stats.first).toISOString()}>{dateFormat.format(new Date(stats.first))}</time><br />Letzte Messung: <time dateTime={new Date(stats.last).toISOString()}>{dateFormat.format(new Date(stats.last))}</time></p>
          {stats.count === 1 && <p className="last-checked">Nur eine Messung: Alle drei Preiskennzahlen sind gleich; eine Entwicklung ist daraus nicht ableitbar.</p>}
        </> : <p className="last-checked">{entry.error ? 'Auswertung nicht verfügbar: Verlauf konnte nicht geladen werden.' : 'Keine Messungen im gewählten Zeitraum; keine Preiskennzahlen verfügbar.'}</p>}
      </article>
    })}</div>
  </section>
}

function HistoryData({ stations, fuel, days, start, end, loadSeries, demo }: { stations: HistoryStation[]; fuel: Fuel; days: number; start: string; end: string; loadSeries: typeof loadHistorySeries; demo: boolean }) {
  const [state, setState] = useState<{ series: HistorySeries[]; from: string; to: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    const range = historyRange(days, start, end)
    if (!range) { window.clearTimeout(timeout); return }
    const { from, to } = range
    async function load() {
      const series = await Promise.all(stations.map(station => loadSeries(station, fuel, from, to, controller.signal)))
      window.clearTimeout(timeout)
      if (active) setState({ series, from, to })
    }
    void load()
    return () => { active = false; controller.abort(); window.clearTimeout(timeout) }
  }, [stations, fuel, days, start, end, loadSeries])
  if (!state) return <p role="status">Gespeicherte Preise für {stations.length} Tankstelle{stations.length === 1 ? '' : 'n'} werden geladen …</p>
  const hasPrices = state.series.some(entry => entry.prices.length > 0)
  return <>
    <p className="last-checked">{days === 0 ? 'Alle gespeicherten Messungen bis ' : 'Zeitraum: ' + dateFormat.format(new Date(state.from)) + ' bis '}{dateFormat.format(new Date(state.to))} (Berlin, Ende ausgeschlossen).</p>
    {state.series.map(entry => <div key={entry.station.id} className="history-series-status">
      {entry.error ? <p role="alert" className="error">{historyStationLabel(entry.station)}: {entry.error}</p>
        : entry.prices.length === 0 ? <p role="status">{historyStationLabel(entry.station)}: Keine Beobachtungen für diesen Kraftstoff und Zeitraum gespeichert.</p>
          : <p><strong>{entry.station.name}</strong>: {entry.prices.length} Beobachtungen{entry.prices.length === 1 ? ' · Nur ein Messpunkt, noch kein Verlauf.' : ''}</p>}
    </div>)}
    {hasPrices && <><ComparisonChart series={state.series} />
      <details className="optional-panel"><summary>Statistik und Export</summary>
        <HistoryStatistics series={state.series} />
        <HistoryExport series={state.series} fuel={fuel} from={state.from} to={state.to} demo={demo} />
      </details>
    </>}
    {state.series.every(entry => entry.error) && <p>Bitte prüfe das Backend und lade den Verlauf erneut.</p>}
  </>
}

export function PriceHistory({ station, availableStations, fuel, observedAt, loadSeries = loadHistorySeries, demo = false, initialDays = 7 }: { station: HistoryStation; availableStations: HistoryStation[]; fuel: Fuel; observedAt: string; loadSeries?: typeof loadHistorySeries; demo?: boolean; initialDays?: number }) {
  const [days, setDays] = useState(initialDays)
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const titleId = useId()
  const rangeValid = historyRange(days, start, end) !== null
  const [attempt, setAttempt] = useState(0)
  const [extraIds, setExtraIds] = useState<string[]>([])
  const stations = useMemo(() => [station, ...extraIds.flatMap(id => availableStations.filter(candidate => candidate.id === id && candidate.id !== station.id))], [station, availableStations, extraIds])
  const heading = useRef<HTMLHeadingElement | null>(null)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => heading.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [])
  return <section className="history-section" aria-labelledby={titleId}>

    <h3 id={titleId} ref={heading} tabIndex={-1}>{stations.length === 1 ? `Preisverlauf: ${station.name}` : `${stations.length} Tankstellen im Preisvergleich`}</h3>
    <p>{names[fuel]} · {demo ? 'DEMO: Alle Messungen sind synthetisch und wurden nicht von Tankerkönig abgerufen.' : 'Nur gespeicherte Beobachtungen. Das Laden fragt keine neuen Tankerkönig-Preise ab.'}</p>
    <details className="history-comparison"><summary>Weitere Tankstellen vergleichen ({stations.length}/3)</summary><fieldset className="history-picker"><legend className="sr-only">Tankstellen vergleichen</legend>
      <p className="last-checked">Ausgangspunkt: <strong>{historyStationLabel(station)}</strong>. Wähle bis zu zwei weitere der angezeigten Tankstellen.</p>
      <div className="history-choices">{availableStations.filter(candidate => candidate.id !== station.id).map(candidate => <label key={candidate.id}>
        <input type="checkbox" checked={extraIds.includes(candidate.id)} disabled={extraIds.length >= 2 && !extraIds.includes(candidate.id)} onChange={() => setExtraIds(ids => toggleComparison(ids, candidate.id))} />
        <span>{historyStationLabel(candidate)}</span>
      </label>)}</div>
      {extraIds.length > 0 && <button type="button" className="history-reset" onClick={() => setExtraIds([])}>Vergleichsauswahl zurücksetzen</button>}
    </fieldset></details>
    <div className="search-controls"><label>Zeitraum<select value={days} onChange={event => setDays(Number(event.target.value))}>
      <option value={1}>Letzte 24 Stunden</option><option value={7}>Letzte 7 Tage</option><option value={30}>Letzte 30 Tage</option><option value={90}>Letzte 90 Tage</option><option value={365}>Letztes Jahr</option><option value={0}>Alle gespeicherten Preise</option><option value={-1}>Eigenen Zeitraum wählen</option>
    </select></label></div>
    {days === -1 && <fieldset className="history-picker"><legend>Eigener Zeitraum</legend>
      <div className="search-controls"><label>Von einschließlich<input type="date" value={start} onChange={event => setStart(event.target.value)} /></label>
      <label>Bis einschließlich<input type="date" value={end} onChange={event => setEnd(event.target.value)} /></label></div>
      <p className="last-checked">Datumswahl in der Zeitzone dieses Geräts ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Messzeiten im Diagramm und in der Tabelle: Berlin.</p>
      {!rangeValid && <p role="alert">Bitte ein gültiges Anfangs- und Enddatum wählen. Das Enddatum darf nicht vor dem Anfang liegen.</p>}
    </fieldset>}
    <button disabled={!rangeValid} onClick={() => setAttempt(value => value + 1)}>Verlauf neu laden</button>
    {rangeValid && <HistoryData key={`${stations.map(entry => entry.id).join(',')}-${fuel}-${days}-${start}-${end}-${attempt}-${observedAt}`} stations={stations} fuel={fuel} days={days} start={start} end={end} loadSeries={loadSeries} demo={demo} />}
    <details className="source-details"><summary>Hinweise zu den Messungen</summary><p className="last-checked">Der Beobachtungszeitpunkt ist der Abrufzeitpunkt, nicht der bestätigte Zeitpunkt einer Preisänderung. Unterschiedliche Messzeitpunkte erlauben keinen direkten Preisvergleich für denselben Moment. Historische Daten entstehen erst durch eigene Abrufe.</p></details>
  </section>
}
