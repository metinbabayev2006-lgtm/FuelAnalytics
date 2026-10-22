import { StationsMap } from './StationsMap'
import { RouteLink } from './RouteLink'
import type { EnergyResult } from './energyTypes'
import type { Location } from './location'

export function EnergyResults({ result, center, radiusKm, searchLabel, sort, stale }: {
  result: EnergyResult; center: Location; radiusKm: number; searchLabel: string; sort: string; stale: boolean
}) {
  const sites = [...result.stations].sort((a, b) => sort === 'name'
    ? a.name.localeCompare(b.name, 'de') || a.distanceKm - b.distanceKm : a.distanceKm - b.distanceKm || a.name.localeCompare(b.name, 'de'))
  const register = result.source === 'bnetza'
  const sourceName = register ? 'Bundesnetzagentur' : 'OpenStreetMap'
  const entries = sites.map(site => ({ station: site, prices: {}, open: null, services: site.services,
    details: [site.address, site.connectors.join(', '), site.openingHours ? `Öffnungszeiten laut Quelle: ${site.openingHours}` : 'Öffnungszeiten unbekannt',
      site.access === 'customers' ? 'Nur für Kunden' : 'Zugang vor Ort prüfen'] }))
  return <section className="energy-results" aria-label="Lade- und Gastankstellen">
    <div className="section-heading result-heading"><div><p className="section-kicker">02 / DEINE STANDORTE</p>
      <h3>{searchLabel} <span className="radius-badge">{radiusKm} km Umkreis</span></h3></div>
      <p className="result-count"><strong>{sites.length}</strong> {result.kind === 'electric' ? 'Ladestationen' : 'Gastankstellen'} gefunden</p></div>
    <p className="data-timestamp">Standortdaten abgerufen: {new Date(result.fetchedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} (Berlin)</p>
    {register && <p className="data-timestamp">Registerstand: {result.sourceDate} · gespeicherter offizieller Datenbestand, keine Live-Meldung</p>}
    {stale && <p role="status" className="loading">Diese Ergebnisse gehören zur oben genannten Suche. Für die neue Auswahl bitte „Standorte suchen“ anklicken.</p>}
    <p className="energy-notice">Standorte: {sourceName} · keine aktuellen Preise, Öffnungs- oder Belegungsdaten.
      {result.kind === 'electric' ? ' Ladepreis und Zugang hängen vom Betreiber und Ladetarif ab. Freie Anschlüsse bitte beim Betreiber prüfen.' : ' LPG (Autogas) und CNG (Erdgas) sind unterschiedliche Kraftstoffe. Bitte die passende Kennzeichnung beachten.'}
      {' '}Entfernungen sind Luftlinien. Standortdaten können unvollständig oder veraltet sein.</p>
    {result.truncated && <p role="status">{register ? 'Angezeigt werden die nächsten 500 Ladeeinrichtungen aus dem Register. Für weniger Treffer bitte den Suchradius verkleinern.' : 'Die Antwort wurde auf höchstens 500 Standorte begrenzt. Bitte verkleinere den Suchradius; es ist keine vollständige Liste der nächsten Standorte.'}</p>}
    <div className="results-grid">
      <StationsMap entries={entries} fuel={result.kind} center={center} radiusKm={radiusKm} observedAt={result.fetchedAt} />
      <section className="station-panel" aria-label="Standortliste"><div className="panel-heading"><h4>{result.kind === 'electric' ? 'Deine Ladestationen' : 'Deine Gastankstellen'}</h4><span className="count-badge">{sites.length}</span></div>
        {sites.length === 0 ? <p>Keine passenden Standorte im Datenbestand gefunden. Versuche einen größeren Radius. Ein leeres Ergebnis bedeutet nicht, dass es vor Ort keine gibt.</p> :
          <ul className="energy-site-list">{sites.map(site => <li key={site.id}>
            <div className="energy-site-heading"><strong>{site.name}</strong><span>{site.distanceKm.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km</span></div>
            <span className="energy-services">{site.services.join(' · ')}</span><p>{site.address || 'Adresse nicht eingetragen'}</p>
            {site.connectors.length > 0 && <p>Anschlüsse laut Quelle: {site.connectors.join(', ')}</p>}
            <p>{site.openingHours ? `Öffnungszeiten laut Quelle: ${site.openingHours}` : 'Öffnungszeiten unbekannt'}{site.access === 'customers' ? ' · Nur für Kunden' : ' · Zugang vor Ort prüfen'}</p>
            <p className="last-checked">Preis nicht verfügbar{result.kind === 'electric' ? ' · Belegung unbekannt' : ''}</p>
            {register && <p className="last-checked">Register-ID: {site.id.substring(7)}</p>}
            <div className="station-actions"><RouteLink station={site} label="Route zum Standort" />{!register && <a className="route-link" href={`https://www.openstreetmap.org/${site.id.split(':')[1]}/${site.id.split(':')[2]}`} target="_blank" rel="noopener noreferrer">OSM-Eintrag ↗</a>}</div>
          </li>)}</ul>}
      </section>
    </div>
    <p className="source-footer">{register ? <>Standortquelle: <a href="https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/E-Mobilitaet/Ladesaeulenkarte/start.html">Bundesnetzagentur.de</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Registerstand: {result.sourceDate}. Lokale Suche im importierten Datenbestand.</>
      : <>Standortquelle: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende · ODbL</a>, abgerufen über Overpass. Zwischenspeicherung bis zu 30 Minuten.</>}</p>
  </section>
}
