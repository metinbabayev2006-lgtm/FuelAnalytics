import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { monthlyChartData, validMonthlyHistory, validMonthlyStation } from './monthlyHistory'
import type { MonthlyHistoryData, MonthlyStation } from './monthlyHistory'
import type { Fuel } from './historyComparison'
const Chart = lazy(() => import('./MonthlyHistoryChart').then(module => ({ default: module.MonthlyHistoryChart })))
const price = (value: number) => value.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 6 })
const names = { diesel: 'Diesel', e5: 'Super E5', e10: 'Super E10' }
export function HistoricalMonthly() {
  const [years, setYears] = useState<number[]>([])
  const [year, setYear] = useState(2022)
  const [fuel, setFuel] = useState<Fuel>('e10')
  const [city, setCity] = useState('Detmold')
  const [page, setPage] = useState<{ entries: MonthlyStation[]; hasMore: boolean; offset: number; city: string } | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [data, setData] = useState<MonthlyHistoryData | null>(null)
  const [busy, setBusy] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const active = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController(); active.current = controller
    let alive = true
    fetch('/api/history/monthly/years', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }).then(async response => {
      if (!response.ok) throw new Error('Historisches Archiv nicht erreichbar. Bitte Backend und Datenbank prüfen.')
      const value: unknown = await response.json()
      if (!Array.isArray(value) || !value.every(y => Number.isInteger(y) && y >= 2000 && y <= 2100) || new Set(value).size !== value.length) throw new Error('Unerwartete Jahresauswahl im Archiv.')
      if (alive) { setYears(value); if (value.length) setYear(value[0]) }
    }).catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : 'Archiv nicht erreichbar.') })
      .finally(() => { if (alive) { active.current = null; setInitializing(false) } })
    return () => { alive = false; controller.abort(); active.current?.abort() }
  }, [attempt])
  function reset() { setPage(null); setSelected([]); setData(null); setError('') }
  async function loadStations(offset = 0) {
    if (active.current || !city.trim()) return
    const controller = new AbortController(); active.current = controller; setBusy(true); reset()
    try {
      const response = await fetch('/api/history/monthly/stations?' + new URLSearchParams({ year: String(year), fuelType: fuel, city: city.trim(), offset: String(offset) }), { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      if (!response.ok) throw new Error('Die historischen Tankstellen konnten nicht geladen werden.')
      const value: unknown = await response.json()
      if (typeof value !== 'object' || value === null || !('entries' in value) || !Array.isArray(value.entries) ||
        !value.entries.every(validMonthlyStation) || !('hasMore' in value) || typeof value.hasMore !== 'boolean') throw new Error('Unerwartete Tankstellenliste.')
      if (!controller.signal.aborted) setPage({ entries: value.entries, hasMore: value.hasMore, offset, city: city.trim() })
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Archiv nicht erreichbar.')
    } finally { if (!controller.signal.aborted) { active.current = null; setBusy(false) } }
  }
  async function loadSeries() {
    if (active.current || !selected.length) return
    const controller = new AbortController(); active.current = controller; setBusy(true); setError(''); setData(null)
    try {
      const response = await fetch('/api/history/monthly/series?' + new URLSearchParams({ year: String(year), fuelType: fuel, stationIds: selected.join(',') }), { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      if (!response.ok) throw new Error('Für diese Auswahl konnten keine Monatsdaten geladen werden.')
      const value: unknown = await response.json()
      if (!validMonthlyHistory(value, year, fuel, selected)) throw new Error('Die Monatsdaten sind unvollständig oder haben ein unerwartetes Format.')
      if (!controller.signal.aborted) setData(value)
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Archiv nicht erreichbar.')
    } finally { if (!controller.signal.aborted) { active.current = null; setBusy(false) } }
  }
  const rows = data ? monthlyChartData(data.series, data.year) : []
  return <section className="secondary-panel monthly-archive" aria-labelledby="monthly-title">
    <h2 id="monthly-title">Historische Monatsdurchschnitte</h2>
    <p>Vergleiche echte historische Durchschnittspreise einzelner Tankstellen. Diese importierten Werte stehen unabhängig von deinen eigenen Preisabrufen bereit.</p>
    <p className="loading">Historischer Datensatz bis 2023, keine aktuellen Preise. Die Auswahl zeigt ausschließlich tatsächlich importierte Jahre. Jeder Wert ist ein Monatsdurchschnitt aus der Quelle, keine einzelne Messung und kein Tagespreis.</p>
    {initializing && <p role="status">Verfügbare Jahre werden geladen …</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {!initializing && !years.length && <><p>Noch keine historischen Monatsdaten verfügbar.</p><button onClick={() => { setInitializing(true); setError(''); setAttempt(value => value + 1) }}>Archiv erneut prüfen</button></>}
    {years.length > 0 && <>
      <form onSubmit={event => { event.preventDefault(); void loadStations() }}>
        <fieldset disabled={busy}><div className="search-controls">
          <label>Historisches Jahr<select value={year} onChange={event => { setYear(Number(event.target.value)); reset() }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
          <label>Historischer Kraftstoff<select value={fuel} onChange={event => { setFuel(event.target.value as Fuel); reset() }}>{Object.entries(names).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
          <label>Stadt im historischen Archiv<input value={city} maxLength={120} required placeholder="z. B. Detmold, Berlin oder Hamburg" onChange={event => { setCity(event.target.value); reset() }} /></label>
          <button type="submit" disabled={!city.trim()}>Historische Tankstellen laden</button>
        </div></fieldset>
      </form>
      {busy && <p role="status">Historische Daten werden geladen …</p>}
      {page && <>
        <p>{page.entries.length} Tankstellen auf Seite {page.offset / 100 + 1} · {page.city}. Wähle bis zu drei Tankstellen zum Vergleich.</p>
        {page.entries.length === 0 ? <p role="status">Keine Monatsdaten für diese Stadt, dieses Jahr und diesen Kraftstoff vorhanden. Versuche den Ortsnamen ohne Straße oder Bundesland. Historische Daten sind nicht für jede Tankstelle vollständig.</p> : <fieldset className="history-picker" disabled={busy}><legend>Historische Tankstellen vergleichen ({selected.length}/3)</legend><div className="history-choices">
          {page.entries.map(station => <label key={station.id}><input type="checkbox" checked={selected.includes(station.id)} disabled={!selected.includes(station.id) && selected.length >= 3} onChange={() => { setSelected(values => values.includes(station.id) ? values.filter(id => id !== station.id) : [...values, station.id]); setData(null) }} /><span>{station.name} · {station.address} · {station.monthCount}/12 Monate</span></label>)}
        </div></fieldset>}
        {(page.hasMore || page.offset > 0) && <div className="station-actions"><button disabled={busy || page.offset === 0} onClick={() => void loadStations(page.offset - 100)}>Vorherige historische Seite</button><button disabled={busy || !page.hasMore} onClick={() => void loadStations(page.offset + 100)}>Nächste historische Seite</button></div>}
        <button disabled={busy || !selected.length} onClick={() => void loadSeries()}>Monatsverlauf anzeigen</button>
      </>}
      {data && <>
        <h3>{names[data.fuelType]} · Monatsdurchschnitte {data.year}</h3>
        <p>Fehlende Monate bleiben leer. Linien zeigen nur den Trend der Monatsmittel und keine Preisänderungen innerhalb eines Monats.</p>
        <Suspense fallback={<p role="status">Diagramm wird geladen …</p>}><Chart data={data} /></Suspense>
        <div className="history-statistics">{data.series.map(series => {
          const prices = series.points.map(point => point.meanPrice)
          return <article className="history-stat-card" key={series.station.id}><h4>{series.station.name} · {series.station.address}</h4>
            <dl><dt>Niedrigstes Monatsmittel</dt><dd>{price(Math.min(...prices))} €/l</dd><dt>Höchstes Monatsmittel</dt><dd>{price(Math.max(...prices))} €/l</dd><dt>Mittel der vorhandenen Monatswerte</dt><dd>{price(prices.reduce((sum, value) => sum + value, 0) / prices.length)} €/l</dd><dt>Vorhandene Monate</dt><dd>{prices.length}/12</dd></dl>
            <p className="last-checked">Kein Minimum/Maximum einzelner Tankvorgänge. Das Mittel zählt jeden vorhandenen Monat gleich; kein zeitgewichteter Jahresmittelwert.</p></article>
        })}</div>
        <div className="table-scroll"><table><caption>Monatliche Durchschnittspreise in €/Liter · {data.year}</caption><thead><tr><th scope="col">Monat</th>{data.series.map(series => <th scope="col" key={series.station.id}>{series.station.name} · {series.station.address}</th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.month}><th scope="row">{row.label} {data.year}</th>{data.series.map((series, index) => <td key={series.station.id}>{typeof row[`price${index}`] === 'number' ? price(row[`price${index}`] as number) : 'Keine Daten'}</td>)}</tr>)}</tbody></table></div>
        <p className="last-checked">Importiert am {new Date(data.importedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} (Berlin) · Datensatzversion {data.datasetVersion}. Keine Anbieterabfrage beim Anzeigen.</p>
      </>}
    </>}
    <p className="source-footer">Quelle: Tankerkönig, monatlich aggregiert im <a href="https://www.kaggle.com/datasets/oles04/petrol-station-germany" target="_blank" rel="noopener noreferrer">Kaggle-Datensatz von Ole und Mitwirkenden</a> · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>. Aggregationsmethode der Quelle nicht als zeitgewichtet bestätigt.</p>
  </section>
}
