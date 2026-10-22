import { useEffect, useState } from 'react'
import './App.css'
import { LiveSearch } from './LiveSearch'
import { Icon } from './Icon'

type ConnectionState = 'loading' | 'connected' | 'error'

function App() {
  const [connection, setConnection] = useState<ConnectionState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [completedCheck, setCompletedCheck] = useState(0)

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
    <div className="dashboard-shell">
      <a className="skip-link" href="#main-content">Zum Inhalt springen</a>
      <aside className="sidebar">
        <a className="brand" href="#main-content" aria-label="FuelAnalytics Start"><span className="brand-symbol"><Icon name="fuel" /></span><span>Fuel<span className="brand-light">Analytics</span><small>PREISE. MIT PERSPEKTIVE.</small></span></a>
        <div className="nav-label">DEIN ÜBERBLICK</div>
        <nav aria-label="Hauptnavigation">
          <a href="#search-panel"><Icon name="search" />Tankstellen finden<Icon name="arrow" /></a>
          <a href="#results"><Icon name="map" />Preisvergleich</a>
          <a href="#history-area"><Icon name="chart" />Preisverlauf</a>
        </nav>
        <div className="sidebar-note"><span className="note-icon"><Icon name="layers" /></span><strong>Daten statt Bauchgefühl.</strong><p>Vergleiche Preise in deiner Nähe und entdecke, was sich über die Zeit verändert.</p></div>
        <div className="sidebar-footer"><span className="project-dot" /> EIN HOCHSCHULPROJEKT<small>TH OWL · Datenmanagement<br />und Visualisierung · WS 26/27</small></div>
      </aside>
      <div className="main-column">
      <header className="topbar"><span>Dashboard <span className="breadcrumb">/ Kraftstoffpreise</span></span><a className={`connection-pill ${connection}`} href="#system-status"><span />{connection === 'connected' ? 'Backend verbunden' : connection === 'loading' ? 'Verbindung prüfen …' : 'Backend offline'}</a></header>
      <main className="app" id="main-content">
      <section className="hero" aria-labelledby="page-title">
        <div><p className="eyebrow"><span /> KRAFTSTOFFPREISE IN DEUTSCHLAND</p><h1 id="page-title">Besser tanken.<br /><span>Klarer entscheiden.</span></h1><p className="intro">Dein nächster Tankstopp, gut informiert.<br className="desktop-break" /> Preise vergleichen. Unterschiede sehen. Entwicklungen verstehen.</p></div>
        <div className="hero-aside"><Icon name="map" /><span>Deine Umgebung.<br /><strong>Dein Preisvergleich.</strong></span><p>Benzin, Diesel, Elektro und Gas.<br />Alle Ergebnisse auf einen Blick.</p></div>
      </section>
      <LiveSearch />
      <div className="project-tools">
      <details className="secondary-panel" id="system-status"><summary>Systemstatus & Verbindung</summary>
      <section className="connection-card" aria-labelledby="connection-title">
        <h2 id="connection-title">Verbindung zum Backend</h2>
        <p role="status" className={`status ${connection}`}>
          {connection === 'loading' && 'Verbindung wird geprüft …'}
          {connection === 'connected' && 'Backend erreichbar'}
          {connection === 'error' && 'Backend nicht erreichbar'}
        </p>
        <p>
          {connection === 'connected'
            ? 'Das Java-Backend antwortet erfolgreich. Die Verbindung zur Datenbank und zu Tankerkönig wird hier noch nicht geprüft.'
            : connection === 'error'
              ? 'Prüfe, ob das Spring-Boot-Backend auf Port 8080 läuft, und versuche es erneut.'
              : 'Die Anwendung fragt den Status des Java-Backends ab.'}
        </p>
        <button disabled={connection === 'loading'} onClick={() => {
          setConnection('loading')
          setAttempt((value) => value + 1)
        }}>{connection === 'loading' ? 'Wird geprüft …' : 'Erneut prüfen'}</button>
        <p className="last-checked" aria-live="polite" aria-atomic="true">
          {lastChecked ? <>
            Zuletzt geprüft: <time dateTime={lastChecked.toISOString()}>
              {lastChecked.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' })}
            </time> Uhr (Berlin)
            {' · '}Prüfung {completedCheck} abgeschlossen
          </> : 'Noch keine Prüfung abgeschlossen.'}
        </p>
      </section></details></div>
      <footer className="page-footer"><span>FuelAnalytics <span>·</span> Mit Daten besser entscheiden.</span><span>Hochschulprojekt · TH OWL</span></footer>
      </main></div>
    </div>
  )
}

export default App
