import { lazy, Suspense, useState } from 'react'
import { lpgPeriod, lpgStatistics, validLpgSeries, validOpenVanLpg } from './lpgStatistics'
import type { LpgSeries, OpenVanLpg } from './lpgStatistics'

const LpgChart = lazy(() => import('./NationalLpgChart').then(module => ({ default: module.NationalLpgChart })))
const price = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 5 })
const date = (value: string) => new Date(value + 'T00:00:00Z').toLocaleDateString('de-DE', { timeZone: 'UTC' })
const time = (value: string) => new Date(value).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })

export function NationalLpg() {
  const [series, setSeries] = useState<LpgSeries | null>(null)
  const [comparison, setComparison] = useState<OpenVanLpg | null>(null)
  const [saved, setSaved] = useState<OpenVanLpg[]>([])
  const [years, setYears] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [compareBusy, setCompareBusy] = useState(false)
  const [compareError, setCompareError] = useState('')
  async function load() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/lpg/national', { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error('LPG-Statistik konnte nicht geladen werden. Bitte prüfe das Backend.')
      const data: unknown = await response.json()
      if (!validLpgSeries(data)) throw new Error('Die LPG-Statistik enthält ungültige Daten.')
      setSeries(data)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'LPG-Statistik nicht erreichbar.')
    } finally { setBusy(false) }
  }
  async function loadComparison(refresh: boolean) {
    if (compareBusy) return
    setCompareBusy(true); setCompareError('')
    try {
      const response = await fetch(refresh ? '/api/lpg/openvan' : '/api/lpg/openvan/saved', { method: refresh ? 'POST' : 'GET', signal: AbortSignal.timeout(18000), cache: 'no-store' })
      if (!response.ok) throw new Error(response.status === 429 ? 'OpenVan begrenzt Abrufe. Bitte mindestens zehn Minuten warten.' : 'OpenVan-Vergleich derzeit nicht verfügbar. Die EU-Statistik bleibt nutzbar.')
      const data: unknown = await response.json()
      if (refresh) {
        if (!validOpenVanLpg(data)) throw new Error('OpenVan hat keinen gültigen LPG-Preis in Euro je Liter geliefert.')
        setComparison(data)
      } else {
        if (!Array.isArray(data) || !data.every(validOpenVanLpg)) throw new Error('Ungültiges OpenVan-Archiv.')
        setSaved(data)
      }
    } catch (cause) { setCompareError(cause instanceof Error ? cause.message : 'Vergleich nicht erreichbar.')
    } finally { setCompareBusy(false) }
  }
  const points = series ? lpgPeriod(series.points, years) : []
  const stats = lpgStatistics(points)
  const latest = series?.points[series.points.length - 1]
  const previous = series && series.points.length > 1 ? series.points[series.points.length - 2] : null
  const delta = latest && previous ? latest.price - previous.price : null
  return <section className="national-lpg secondary-panel" id="lpg-statistics" aria-labelledby="lpg-title">
    <h2 id="lpg-title">Deutschland im Überblick</h2>
    <p>Bundesweite Durchschnittspreise statt einzelner Tankstellenpreise. Die Standortkarte zeigt weiterhin Gastankstellen in deiner Nähe.</p>
    <button disabled={busy} onClick={() => void load()}>{busy ? 'LPG-Statistik wird geladen …' : 'LPG-Statistik laden'}</button>
    {error && <p role="alert" className="error">{error}</p>}
    {series && latest && <>
      <div className="lpg-latest"><span>Letzter offizieller Wochenwert</span><strong>{price.format(latest.price)} €/Liter</strong>
        <span>Bezugsdatum: {date(latest.date)} · Deutschland · einschließlich Steuern</span>
        {delta !== null && previous && <span>{delta >= 0 ? '+' : ''}{price.format(delta * 100)} ct/Liter gegenüber {date(previous.date)}</span>}
      </div>
      <details className="source-details"><summary>Datenstand und Quelle</summary><p className="last-checked">EU-Wochenwerte, keine Live-Preise. Importiert: {time(series.importedAt)} (Berlin). {series.points.length} vorhandene Wochenwerte seit {date(series.points[0].date)}. Fehlende Wochen bleiben ohne Wert.</p></details>
      <label>Zeitraum für LPG<select value={years} onChange={event => setYears(Number(event.target.value))}>
        <option value={1}>Letztes Jahr im Datenbestand</option><option value={5}>Letzte 5 Jahre im Datenbestand</option><option value={0}>Gesamter verfügbarer Verlauf</option>
      </select></label>
      {stats && <><h3>Statistik im gewählten Zeitraum</h3><dl className="lpg-statistics">
        <div><dt>Niedrigster Wochenwert</dt><dd>{price.format(stats.min)} €/Liter</dd></div>
        <div><dt>Durchschnitt der Wochenwerte</dt><dd>{price.format(stats.mean)} €/Liter</dd></div>
        <div><dt>Höchster Wochenwert</dt><dd>{price.format(stats.max)} €/Liter</dd></div>
        <div><dt>Wochenwerte</dt><dd>{stats.count}</dd></div>
      </dl><details className="source-details"><summary>So wird die Statistik berechnet</summary><p className="last-checked">Jede vorhandene Woche zählt gleich. Dies ist kein zeit- oder mengen­gewichteter Marktpreis. Die Statistik enthält ausschließlich die offizielle EU-Reihe.</p></details></>}
      <Suspense fallback={<p role="status">LPG-Diagramm wird geladen …</p>}><LpgChart points={points} /></Suspense>
      <p className="last-checked">Linien verbinden gemeldete Wochenwerte; Preise zwischen diesen Daten sind unbekannt. Die Preisachse passt sich dem Zeitraum an.</p>
      <details><summary>LPG-Wochenwerte als Tabelle ({points.length})</summary><div className="table-scroll"><table><caption>LPG-Durchschnitt Deutschland · einschließlich Steuern · €/Liter</caption>
        <thead><tr><th scope="col">Bezugsdatum</th><th scope="col">€/Liter</th></tr></thead>
        <tbody>{points.map(point => <tr key={point.date}><td><time dateTime={point.date}>{date(point.date)}</time></td><td>{price.format(point.price)}</td></tr>)}</tbody>
      </table></div></details>
      <p className="source-footer">Quelle: <a href={series.sourceUrl} target="_blank" rel="noopener noreferrer">Europäische Kommission · Weekly Oil Bulletin</a>. Importierte Originalwerte in €/1.000 Liter wurden durch 1.000 geteilt. Nationale Durchschnittswerte dürfen keiner einzelnen Tankstelle zugeordnet werden.</p>
      <details className="lpg-comparison"><summary>Zusätzlicher Vergleich: OpenVan</summary>
        <p>OpenVan liefert einen weiteren Deutschland-Wert. Quellen, Methodik und Stand können von der EU-Reihe abweichen. Dieser Wert fließt weder in das Diagramm noch in dessen Statistik ein.</p>
        <div className="station-actions"><button disabled={compareBusy} onClick={() => void loadComparison(true)}>OpenVan-Vergleich abrufen</button><button disabled={compareBusy} onClick={() => void loadComparison(false)}>Gespeicherte OpenVan-Werte laden</button></div>
        {compareBusy && <p role="status">Vergleich wird geladen …</p>}
        {compareError && <p role="alert" className="error">{compareError}</p>}
        {comparison && <p><strong>OpenVan: {price.format(comparison.price)} €/Liter</strong><br />Quellabruf durch OpenVan: {time(comparison.sourceFetchedAt)} (Berlin). Von uns abgerufen: {time(comparison.retrievedAt)} (Berlin). Kein bestätigter Preisstichtag einer Tankstelle.</p>}
        {saved.length > 0 && <ul>{saved.map(row => <li key={row.sourceFetchedAt}>{time(row.sourceFetchedAt)}: {price.format(row.price)} €/Liter</li>)}</ul>}
        {!compareBusy && saved.length === 0 && <p className="last-checked">Das Archiv enthält nur von uns erfolgreich abgerufene OpenVan-Werte. Wiederholte Abrufe desselben Quellzeitpunkts erzeugen keine zusätzlichen Messwerte.</p>}
        <p className="source-footer">Quelle: <a href="https://openvan.camp/de/developers" target="_blank" rel="noopener noreferrer">OpenVan.camp</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Ohne API-Key; sechs Stunden Cache, bei Fehlern mindestens zehn Minuten bis zur nächsten Anbieteranfrage.</p>
      </details>
    </>}
    <p className="last-checked">LPG (Autogas) und CNG (Erdgas) sind unterschiedliche Kraftstoffe. Für CNG liegen hier keine vergleichbaren Preiswerte vor.</p>
  </section>
}
