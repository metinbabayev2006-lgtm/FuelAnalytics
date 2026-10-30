import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { validArchiveData, validArchiveStatus } from './archiveData'
import type { ArchiveData, ArchiveStatus } from './archiveData'
import { validMonthlyStation } from './monthlyHistory'
import type { MonthlyStation } from './monthlyHistory'
import type { Fuel } from './historyComparison'
const Chart = lazy(() => import('./ArchiveHistoryChart').then(m => ({ default: m.ArchiveHistoryChart })))
const price = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 6 })
const month = (v: string) => new Date(v + 'T00:00:00Z').toLocaleDateString('de-DE', { timeZone: 'UTC', month: 'long', year: 'numeric' })
export function ArchiveHistory() {
  const [status, setStatus] = useState<ArchiveStatus | null>(null), [retry, setRetry] = useState(0)
  const [city, setCity] = useState('Detmold'), [fuel, setFuel] = useState<Fuel>('e10')
  const [page, setPage] = useState<{ entries: MonthlyStation[]; hasMore: boolean; offset: number } | null>(null)
  const [selected, setSelected] = useState<string[]>([]), [data, setData] = useState<ArchiveData | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController(); active.current = controller; let alive = true
    fetch('/api/history/archive/status', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }).then(async r => {
      if (!r.ok) throw new Error('Tankerkönig-Archiv nicht erreichbar. Bitte das aktualisierte Backend starten.')
      const value: unknown = await r.json()
      if (!validArchiveStatus(value)) throw new Error('Unerwarteter Archivstatus.')
      if (alive) { setStatus(value); if (value.available && !value.cities.includes('Detmold')) setCity(value.cities[0]) }
    }).catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Archiv nicht erreichbar.') })
      .finally(() => { if (alive) active.current = null })
    return () => { alive = false; controller.abort(); active.current?.abort() }
  }, [retry])
  function reset() { setPage(null); setSelected([]); setData(null); setError('') }
  async function load(series: boolean, offset = 0) {
    if (active.current || busy) return
    const controller = new AbortController(); active.current = controller; setBusy(true); setError(''); setData(null)
    if (!series) { setPage(null); setSelected([]) }
    try {
      const query = new URLSearchParams(series ? { fuelType: fuel, stationIds: selected.join(',') } : { city, fuelType: fuel, offset: String(offset) })
      const response = await fetch('/api/history/archive/' + (series ? 'series?' : 'stations?') + query, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
      if (!response.ok) throw new Error('Archivdaten konnten nicht geladen werden. Bitte Auswahl und Backend prüfen.')
      const value: unknown = await response.json()
      if (series) {
        if (!status || !validArchiveData(value, status, fuel, selected)) throw new Error('Unerwarteter Archivverlauf. Bei einem neuen Import bitte den Archivstatus erneut prüfen.')
        if (!controller.signal.aborted) setData(value)
      } else {
        if (!value || typeof value !== 'object' || !('entries' in value) || !Array.isArray(value.entries) || !value.entries.every(validMonthlyStation) || !('hasMore' in value) || typeof value.hasMore !== 'boolean') throw new Error('Unerwartete Archiv-Tankstellenliste.')
        if (!controller.signal.aborted) setPage({ entries: value.entries, hasMore: value.hasMore, offset })
      }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Archiv nicht erreichbar.')
    } finally { if (!controller.signal.aborted) { active.current = null; setBusy(false) } }
  }
  return <section className="secondary-panel monthly-archive" aria-labelledby="archive-title">
    <h2 id="archive-title">Tankerkönig · zwölf Monate im Vergleich</h2>
    <p>Historische Preisänderungen einzelner Tankstellen, als zeitgewichtete Monatsdurchschnitte ausgewertet. Keine neuen Anbieterabfragen beim Anzeigen.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {!status && !error && <p role="status">Archivstatus wird geprüft …</p>}
    {status && !status.available && <p role="status">Der Jahresimport ist noch nicht abgeschlossen. Bis dahin sind die älteren Kaggle-Monatswerte in der zweiten Archivansicht verfügbar.</p>}
    <button disabled={busy} onClick={() => { if (active.current) return; reset(); setStatus(null); setRetry(v => v + 1) }}>Archivstatus erneut prüfen</button>
    {status?.available && <>
      <p><strong>Zeitraum: {month(status.periodStart)} bis {month(new Date(Date.parse(status.periodEnd) - 86400000).toISOString().slice(0, 10))}</strong> · Ende ausgeschlossen: {status.periodEnd} (Berlin).</p>
      <p className="last-checked">Die Stadtauswahl folgt den Ortsnamen im historischen Tankstellenregister, nicht einem Suchradius. Nicht jede Tankstelle bietet jeden Kraftstoff durchgehend an.</p>
      <form onSubmit={e => { e.preventDefault(); void load(false) }}><fieldset disabled={busy}><div className="search-controls">
        <label>Archivstadt<select value={city} onChange={e => { setCity(e.target.value); reset() }}>{status.cities.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Kraftstoff im Tankerkönig-Archiv<select value={fuel} onChange={e => { setFuel(e.target.value as Fuel); reset() }}><option value="e10">Super E10</option><option value="e5">Super E5</option><option value="diesel">Diesel</option></select></label>
        <button>Archiv-Tankstellen laden</button>
      </div></fieldset></form>
      {busy && <p role="status">Archivdaten werden geladen …</p>}
      {page && <>
        <p>{page.entries.length} Tankstellen · {city} · Seite {page.offset / 100 + 1}. Bis zu drei Tankstellen vergleichen.</p>
        {!page.entries.length && <p>Für diese Auswahl sind keine bekannten Preisintervalle gespeichert.</p>}
        <fieldset className="history-picker" disabled={busy}><legend>Archiv-Tankstellen vergleichen ({selected.length}/3)</legend><div className="history-choices">{page.entries.map(s => <label key={s.id}><input type="checkbox" checked={selected.includes(s.id)} disabled={!selected.includes(s.id) && selected.length >= 3} onChange={() => { setSelected(values => values.includes(s.id) ? values.filter(v => v !== s.id) : [...values, s.id]); setData(null) }} /><span>{s.name} · {s.address} · {s.monthCount} Monate mit bekannten Preisen</span></label>)}</div></fieldset>
        {(page.hasMore || page.offset > 0) && <div className="station-actions"><button disabled={busy || page.offset === 0} onClick={() => void load(false, page.offset - 100)}>Vorherige Archivseite</button><button disabled={busy || !page.hasMore} onClick={() => void load(false, page.offset + 100)}>Nächste Archivseite</button></div>}
        <button disabled={busy || !selected.length} onClick={() => void load(true)}>Zwölfmonatsverlauf anzeigen</button>
      </>}
      {data && <>
        <h3>Zeitgewichtete Monatsdurchschnitte · {fuel === 'diesel' ? 'Diesel' : fuel === 'e5' ? 'Super E5' : 'Super E10'}</h3>
        <p>Im Diagramm stehen nur Monate mit 100 % bekannter Preisgültigkeit. Unbekannte Startpreise, fehlende Intervalle und entfernte Kraftstoffangebote werden nicht aufgefüllt. Teilwerte und Abdeckung stehen in der Tabelle.</p>
        <Suspense fallback={<p role="status">Archivdiagramm wird geladen …</p>}><Chart data={data} /></Suspense>
        <div className="history-statistics">{data.series.map(s => {
          const complete = s.points.filter(p => p.knownSeconds === p.totalSeconds && p.meanPrice !== null)
          const prices = complete.map(p => p.meanPrice as number)
          const seconds = complete.reduce((sum, p) => sum + p.knownSeconds, 0)
          return <article className="history-stat-card" key={s.station.id}><h4>{s.station.name} · {s.station.address}</h4><dl>
            <dt>Niedrigstes vollständiges Monatsmittel</dt><dd>{prices.length ? price(Math.min(...prices)) + ' €/l' : 'Keine vollständigen Monate'}</dd>
            <dt>Höchstes vollständiges Monatsmittel</dt><dd>{prices.length ? price(Math.max(...prices)) + ' €/l' : 'Keine vollständigen Monate'}</dd>
            <dt>Zeitgewichtetes Mittel der vollständigen Monate</dt><dd>{seconds ? price(complete.reduce((sum, p) => sum + (p.meanPrice as number) * p.knownSeconds, 0) / seconds) + ' €/l' : 'Nicht verfügbar'}</dd>
            <dt>Vollständige Monate</dt><dd>{complete.length}/{s.points.length}</dd>
          </dl><p className="last-checked">Minima und Maxima beziehen sich auf Monatsmittel, nicht auf einzelne Preisänderungen.</p></article>
        })}</div>
        <div className="table-scroll"><table><caption>Tankerkönig · Monatsmittel und zeitliche Abdeckung</caption><thead><tr><th>Monat</th>{data.series.map(s => <th key={s.station.id}>{s.station.name} · {s.station.address}</th>)}</tr></thead><tbody>{data.series[0].points.map((point, i) => <tr key={point.month}><th scope="row">{month(point.month)}</th>{data.series.map(s => { const p = s.points[i]; return <td key={s.station.id}>{p.meanPrice === null ? 'Kein bekannter Preis' : price(p.meanPrice) + ' €/l' + (p.knownSeconds < p.totalSeconds ? ' (Teilwert)' : '')}<br />Abdeckung: {(100 * p.knownSeconds / p.totalSeconds).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %</td> })}</tr>)}</tbody></table></div>
      </>}
      <p className="source-footer">Quelle: <a href={status.sourceUrl} target="_blank" rel="noopener noreferrer">Tankerkönig-Preisarchiv</a> · <a href={status.licenseUrl}>CC BY-NC-SA 4.0</a> · Import: {new Date(status.importedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} (Berlin). Preisgültigkeitsdauer gewichtet; Tageslängen berücksichtigen Sommer- und Winterzeit.</p>
    </>}
  </section>
}
