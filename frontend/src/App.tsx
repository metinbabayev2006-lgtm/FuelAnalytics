import { useEffect, useState } from 'react'
import './App.css'
import { LiveSearch } from './LiveSearch'
import { Icon } from './Icon'
import { SavedHistory } from './SavedHistory'

type ConnectionState = 'loading' | 'connected' | 'error'
type View = 'search' | 'history'
function viewForHash(hash: string): View {
  return ['#saved-history', '#history-monthly', '#lpg-statistics'].includes(hash) ? 'history' : 'search'
}
const pages = {
  search: { title: 'Tankstellen in deiner Nähe', description: 'Ort auswählen, Preise vergleichen und die passende Tankstelle finden.' },
  history: { title: 'Preisverläufe vergleichen', description: 'Eigene Messungen, historische Monatswerte und LPG-Durchschnittspreise für Deutschland.' },
}


function App() {
  const [view, setView] = useState<View>(() => viewForHash(window.location.hash))
  useEffect(() => {
    const navigate = () => { if (['#search-panel', '#results', '#history-area', '#saved-history', '#history-monthly', '#lpg-statistics'].includes(window.location.hash)) { setView(viewForHash(window.location.hash)); window.scrollTo(0, 0) } }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])
  function selectPage(next: View, hash: string) {
    setView(next)
    if (window.location.hash !== hash) window.history.pushState({}, '', hash)
    window.scrollTo(0, 0)
  }
  const [connection, setConnection] = useState<ConnectionState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [completedCheck, setCompletedCheck] = useState(0)
  const [statusExpanded, setStatusExpanded] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    let active = true

    async function checkBackend() {
      try {
        const response = await fetch('/api/health', {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('Backend request failed')
        const data: unknown = await response.json()
        if (typeof data !== 'object' || data === null ||
            !('status' in data) || data.status !== 'UP' ||
            !('application' in data) || data.application !== 'FuelAnalytics') {
          throw new Error('Unexpected backend response')
        }
        if (active) setConnection('connected')
      } catch {
        if (active) setConnection('error')
      } finally {
        window.clearTimeout(timeout)
        if (active) {
          setLastChecked(new Date())
          setCompletedCheck(attempt + 1)
        }
      }
    }

    void checkBackend()
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [attempt])


  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Zum Inhalt springen</a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#search-panel" onClick={event => { event.preventDefault(); selectPage('search', '#search-panel') }} aria-label="FuelAnalytics Start">
            <span className="brand-symbol"><Icon name="fuel" /></span><span>Fuel<span className="brand-light">Analytics</span></span>
          </a>
          <nav className="main-nav" aria-label="Hauptnavigation">
            <a href="#search-panel" aria-current={view === 'search' ? 'page' : undefined} onClick={event => { event.preventDefault(); selectPage('search', '#search-panel') }}><Icon name="search" />Tankstellen</a>
            <a href="#saved-history" aria-current={view === 'history' ? 'page' : undefined} onClick={event => { event.preventDefault(); selectPage('history', '#saved-history') }}><Icon name="chart" />Preisverlauf</a>
          </nav>
          <a className={'connection-pill ' + connection} href="#system-status" onClick={() => setStatusExpanded(true)}>
            <span />{connection === 'connected' ? 'Verbunden' : connection === 'loading' ? 'Verbinde …' : 'Nicht verbunden'}
          </a>
        </div>
      </header>
      <main className="app" id="main-content">
        <div className="page-heading"><h1>{pages[view].title}</h1><p>{pages[view].description}</p></div>
        {/* Keep each workspace mounted so navigation preserves searches, selections and API cooldowns. */}
        <div className="page-view" hidden={view !== 'search'}><LiveSearch /></div>
        <div className="page-view" hidden={view !== 'history'}><SavedHistory /></div>
        <details className="system-details" id="system-status" open={statusExpanded} onToggle={event => setStatusExpanded(event.currentTarget.open)}>
          <summary>Verbindungsdetails</summary>
          <section className="connection-card" aria-labelledby="connection-title">
            <h2 id="connection-title">Verbindung zur Anwendung</h2>
            <p role="status" className={'status ' + connection}>
              {connection === 'loading' ? 'Verbindung wird geprüft …' : connection === 'connected' ? 'Die Anwendung ist erreichbar.' : 'Die Anwendung ist nicht erreichbar.'}
            </p>
            <p>{connection === 'connected' ? 'Dieser Test prüft die Verbindung zum Java-Backend. Datenbank und Preisanbieter werden bei den jeweiligen Abfragen geprüft.' : 'Starte das Backend auf Port 8080 und prüfe die Verbindung erneut.'}</p>
            <button onClick={() => { setConnection('loading'); setAttempt(value => value + 1) }} disabled={connection === 'loading'}>Erneut prüfen</button>
            <p className="last-checked">{lastChecked ? <>Zuletzt geprüft: <time dateTime={lastChecked.toISOString()}>{lastChecked.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' })}</time> Uhr (Berlin) · Prüfung {completedCheck}</> : 'Noch keine Prüfung abgeschlossen.'}</p>
          </section>
        </details>
        <footer className="page-footer"><span>FuelAnalytics</span><span>Ein Projekt der TH OWL · WS 2026/27</span></footer>
      </main>
    </div>
  )
}
export default App
