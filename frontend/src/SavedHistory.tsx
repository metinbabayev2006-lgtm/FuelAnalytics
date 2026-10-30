import { lazy, Suspense, useState } from 'react'
import type { Fuel, HistoryStation } from './historyComparison'

const PriceHistory = lazy(() => import('./PriceHistory').then(module => ({ default: module.PriceHistory })))
type Entry = { station: HistoryStation; count: number; firstObservedAt: string; lastObservedAt: string }
function validEntry(value: unknown): value is Entry {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Entry
  return typeof row.station === 'object' && row.station !== null && typeof row.station.id === 'string' &&
    /^[0-9a-f-]{36}$/i.test(row.station.id) && typeof row.station.name === 'string' &&
    ['street', 'houseNumber', 'place'].every(field => { const v = row.station[field as keyof HistoryStation]; return v === undefined || v === null || typeof v === 'string' }) &&
    Number.isSafeInteger(row.count) && row.count > 0 && typeof row.firstObservedAt === 'string' && typeof row.lastObservedAt === 'string' &&
    Number.isFinite(Date.parse(row.firstObservedAt)) && Number.isFinite(Date.parse(row.lastObservedAt)) && Date.parse(row.firstObservedAt) <= Date.parse(row.lastObservedAt)
}

export function SavedHistory() {
  const [fuel, setFuel] = useState<Fuel>('e10')
  const [state, setState] = useState<{ entries: Entry[]; fuel: Fuel; offset: number; hasMore: boolean } | null>(null)
  const [selected, setSelected] = useState<Entry | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function load(offset = 0) {
    if (loading) return
    setLoading(true); setError(''); setSelected(null); setState(null)
    try {
      const response = await fetch('/api/stations/archive?' + new URLSearchParams({ fuelType: fuel, offset: String(offset) }), { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error('Das Preisarchiv konnte nicht geladen werden. Bitte prüfe Backend und Datenbank.')
      const data: unknown = await response.json()
      if (typeof data !== 'object' || data === null || !('entries' in data) || !Array.isArray(data.entries) || !data.entries.every(validEntry) || !('hasMore' in data) || typeof data.hasMore !== 'boolean')
        throw new Error('Das Preisarchiv hat unerwartete Daten geliefert.')
      setState({ entries: data.entries, hasMore: data.hasMore, offset, fuel })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Preisarchiv nicht erreichbar.')
    } finally { setLoading(false) }
  }
  return <section className="saved-history secondary-panel" id="saved-history" aria-labelledby="saved-history-title">
    <h2 id="saved-history-title">Tankstelle auswählen</h2>
    <p>Wähle einen Kraftstoff und lade deine gespeicherten Tankstellen. Dafür werden keine neuen Preise abgerufen.</p>
    <details className="source-details"><summary>Welche Preise sind gespeichert?</summary><p className="last-checked">Benzin und Diesel: E5, E10 und Diesel werden bei erfolgreichen Preisabfragen gespeichert. Für LPG gibt es weiter unten eine separate Deutschland-Statistik. Für einzelne LPG/CNG- und Ladestationen liegen hier keine Preisverläufe vor. Vor Beginn der Datensammlung sind keine Preise verfügbar.</p></details>
    <div className="search-controls"><label>Kraftstoff im Preisarchiv<select value={fuel} disabled={loading} onChange={event => { setFuel(event.target.value as Fuel); setState(null); setSelected(null); setError('') }}>
      <option value="e10">Super E10</option><option value="e5">Super E5</option><option value="diesel">Diesel</option>
    </select></label><button disabled={loading} onClick={() => void load()}>{loading ? 'Archiv wird geladen …' : 'Gespeicherte Tankstellen laden'}</button></div>
    {error && <p role="alert" className="error">{error}</p>}
    {state && <>
      {state.entries.length === 0 ? <p role="status">Keine gespeicherten Preise auf dieser Seite. Rufe zuerst echte Kraftstoffpreise ab; danach kannst du sie hier wiederfinden.</p> : <>
        <label>Gespeicherte Tankstelle<select value={selected?.station.id ?? ''} onChange={event => setSelected(state.entries.find(entry => entry.station.id === event.target.value) ?? null)}>
          <option value="">Tankstelle auswählen</option>{state.entries.map(entry => <option key={entry.station.id} value={entry.station.id}>{[entry.station.name, entry.station.street, entry.station.houseNumber, entry.station.place].filter(Boolean).join(' · ')} · {entry.count} Messungen</option>)}
        </select></label>
        <p className="last-checked">{state.entries.length} Tankstellen auf Seite {state.offset / 100 + 1}. Das Laden fragt keine neuen Anbieterpreise ab.</p>
      </>}
      {(state.hasMore || state.offset > 0) && <div className="station-actions"><button disabled={loading || state.offset === 0} onClick={() => void load(state.offset - 100)}>Vorherige Seite</button><button disabled={loading || !state.hasMore} onClick={() => void load(state.offset + 100)}>Nächste Seite</button></div>}
      {selected && <><p className="last-checked">Gespeicherter Zeitraum: {new Date(selected.firstObservedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} bis {new Date(selected.lastObservedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} (Berlin).</p>
        <Suspense fallback={<p role="status">Diagramm wird geladen …</p>}><PriceHistory key={selected.station.id + state.fuel} station={selected.station} availableStations={state.entries.map(entry => entry.station)} fuel={state.fuel} observedAt={selected.lastObservedAt} initialDays={0} /></Suspense></>}
    </>}
  </section>
}
