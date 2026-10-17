import { routeUrl } from './stationActions'

export function RouteLink({ station, demo = false }: { station: { name: string; latitude: number; longitude: number }; demo?: boolean }) {
  const href = routeUrl(station)
  if (demo) return <span className="last-checked">Fiktive Tankstelle · keine echte Route</span>
  if (!href) return null
  return <a className="route-link" href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`Route zu ${station.name} in Google Maps (neuer Tab)`}>Route zur Tankstelle ↗</a>
}
