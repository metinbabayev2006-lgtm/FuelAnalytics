import { useEffect, useRef, useState } from 'react'
import type { Location } from './location'

type PositionRequest = Geolocation['getCurrentPosition']
const browserPosition: PositionRequest = (success, error, options) => navigator.geolocation.getCurrentPosition(success, error, options)

export function LocationButton({ onSelect, onStart, onBusyChange, disabled, requestPosition = browserPosition, supported = Boolean(navigator.geolocation && window.isSecureContext) }: { onSelect: (location: Location) => void; onStart: () => void; onBusyChange: (busy: boolean) => void; disabled: boolean; requestPosition?: PositionRequest; supported?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const request = useRef(0)
  useEffect(() => () => { request.current++; onBusyChange(false) }, [onBusyChange])
  function locate() {
    if (!supported) { setMessage('Standort ist hier nicht verfügbar. Bitte suche einen Ort manuell.'); return }
    const id = ++request.current
    setBusy(true); onBusyChange(true); onStart(); setMessage('')
    try { requestPosition(position => {
      if (request.current !== id) return
      const { latitude, longitude, accuracy } = position.coords
      if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
        setMessage('Der Browser hat keinen gültigen Standort geliefert.')
      } else {
        onSelect({ id: -1, name: 'Mein aktueller Standort', region: null, district: null, latitude, longitude })
        setMessage(`Standort ausgewählt${Number.isFinite(accuracy) ? ` · Genauigkeit ungefähr ${Math.round(accuracy)} m` : ''}. Starte jetzt die Preis- oder Standortsuche.`)
      }
      setBusy(false); onBusyChange(false)
    }, error => {
      if (request.current !== id) return
      setBusy(false); onBusyChange(false)
      setMessage(error.code === 1 ? 'Standortzugriff abgelehnt. Du kannst weiterhin einen Ort manuell suchen.' : error.code === 3 ? 'Standortbestimmung hat zu lange gedauert. Versuche es erneut oder suche einen Ort.' : 'Standort konnte nicht bestimmt werden. Bitte suche einen Ort manuell.')
    }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }) }
    catch { setBusy(false); onBusyChange(false); setMessage('Standortzugriff ist hier nicht möglich. Bitte suche einen Ort manuell.') }
  }
  return <div className="location-device"><button type="button" disabled={disabled || busy} onClick={locate}>{busy ? 'Standort wird ermittelt …' : 'Meinen Standort verwenden'}</button>
    <p className="last-checked">Nur auf Klick und mit Browserfreigabe. Dein Standort wird nicht als Favorit gespeichert. Erst die Preis- oder Standortsuche sendet den Suchmittelpunkt an unser Backend und den jeweiligen Anbieter: Tankerkönig für Benzin/Diesel, Overpass für Elektro/Gas.</p>
    {message && <p role="status">{message}</p>}</div>
}
