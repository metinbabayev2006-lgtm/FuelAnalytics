import { useEffect, useState } from 'react'
import './App.css'

type ConnectionState = 'loading' | 'connected' | 'error'

function App() {
  const [connection, setConnection] = useState<ConnectionState>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    let active = true

    async function checkBackend() {
      try {
        const response = await fetch('/api/health', { signal: controller.signal })
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
    <main className="app">
      <p className="eyebrow">TH OWL · Datenmanagement und Visualisierung</p>
      <h1>FuelAnalytics</h1>
      <p className="intro">Kraftstoffpreise verstehen und vergleichen.</p>
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
        }}>Erneut prüfen</button>
      </section>
    </main>
  )
}

export default App
