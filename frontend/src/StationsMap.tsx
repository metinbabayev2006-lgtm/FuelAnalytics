import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type MapEntry = {
  station: { id: string; name: string; latitude: number; longitude: number }
  open: boolean
  prices: Partial<Record<'diesel' | 'e5' | 'e10', number>>
}
type Props = {
  entries: MapEntry[]
  fuel: 'diesel' | 'e5' | 'e10'
  center: { latitude: number; longitude: number }
  radiusKm: number
  observedAt: string
}

const fuelNames = { diesel: 'Diesel', e5: 'Super E5', e10: 'Super E10' }
const priceFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export function StationsMap({ entries, fuel, center, radiusKm, observedAt }: Props) {
  const container = useRef<HTMLDivElement | null>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef<L.LayerGroup | null>(null)
  const searchArea = useRef<L.LayerGroup | null>(null)
  const bounds = useRef<L.LatLngBounds | null>(null)
  const [tileError, setTileError] = useState(false)

  useEffect(() => {
    if (!container.current) return
    const instance = L.map(container.current, { scrollWheelZoom: false }).setView([51, 10], 6)
    map.current = instance
    markers.current = L.layerGroup().addTo(instance)
    searchArea.current = L.layerGroup().addTo(instance)
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance)
    tiles.on('tileerror', () => setTileError(true))
    const resize = new ResizeObserver(() => instance.invalidateSize())
    resize.observe(container.current)
    return () => {
      resize.disconnect()
      instance.remove()
      map.current = null
      markers.current = null
      searchArea.current = null
    }
  }, [])

  useEffect(() => {
    const layer = markers.current
    if (!layer) return
    layer.clearLayers()
    for (const entry of entries) {
      const price = entry.prices[fuel]
      const label = price === undefined ? '—' : priceFormat.format(price)
      const priceLabel = document.createElement('span')
      priceLabel.textContent = label
      const icon = L.divIcon({
        html: priceLabel,
        className: `station-price-marker${price === undefined ? ' unavailable' : ''}`,
        iconSize: [68, 30], iconAnchor: [34, 15],
      })
      const marker = L.marker([entry.station.latitude, entry.station.longitude], {
        icon, title: `${entry.station.name} · ${fuelNames[fuel]}: ${price === undefined ? 'Nicht verfügbar' : label + ' €/Liter'}`,
        alt: entry.station.name, keyboard: true,
      }).addTo(layer)
      // Provider text is inserted as text nodes, never interpolated into HTML.
      const popup = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = entry.station.name
      const priceText = document.createElement('p')
      priceText.textContent = `${fuelNames[fuel]}: ${price === undefined ? 'Nicht verfügbar' : label + ' €/Liter'}`
      const openText = document.createElement('p')
      openText.textContent = entry.open ? 'Geöffnet beim Abruf' : 'Geschlossen beim Abruf'
      popup.append(title, priceText, openText)
      marker.bindPopup(popup)
    }
  }, [entries, fuel])

  useEffect(() => {
    if (!map.current || !searchArea.current) return
    searchArea.current.clearLayers()
    const point: L.LatLngTuple = [center.latitude, center.longitude]
    const circle = L.circle(point, { radius: radiusKm * 1000, color: '#287a60', weight: 2, fillOpacity: 0.04 })
      .addTo(searchArea.current)
    L.circleMarker(point, { radius: 6, color: '#ffffff', fillColor: '#2459b8', fillOpacity: 1, weight: 2 })
      .bindTooltip('Suchmittelpunkt').addTo(searchArea.current)
    bounds.current = circle.getBounds()
    map.current.fitBounds(bounds.current, { padding: [24, 24], maxZoom: 15 })
  }, [center.latitude, center.longitude, radiusKm, observedAt])

  return <section className="map-section" aria-labelledby="map-title">
    <h4 id="map-title">Tankstellen auf der Karte</h4>
    <p className="last-checked">Markierungen zeigen {fuelNames[fuel]} in €/Liter. Anklicken für Details. Der Kreis zeigt den Suchradius, der blaue Punkt den Mittelpunkt.</p>
    <div ref={container} className="station-map" role="region" aria-label="Interaktive Karte der gefundenen Tankstellen" />
    {tileError && <p role="status" className="loading">Einige Kartenkacheln konnten nicht geladen werden. Die Tankstellen stehen weiterhin in der Tabelle.</p>}
    <button type="button" onClick={() => { if (bounds.current) map.current?.fitBounds(bounds.current, { padding: [24, 24], maxZoom: 15 }) }}>
      Suchgebiet anzeigen
    </button>
    <p className="last-checked">— bedeutet: Preis nicht verfügbar. Kartenhintergrund: OpenStreetMap. <a href="https://www.openstreetmap.org/fixthemap">Kartenfehler melden</a>.</p>
  </section>
}
