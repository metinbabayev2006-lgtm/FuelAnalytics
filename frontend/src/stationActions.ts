export type SavedStation = {
  id: string; name: string; street: string | null; houseNumber: string | null; place: string | null
  latitude: number; longitude: number
}

export function routeUrl(point: { latitude: number; longitude: number }) {
  if (!Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90 || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180) return null
  const query = new URLSearchParams({ api: '1', destination: `${point.latitude},${point.longitude}`, travelmode: 'driving' })
  return `https://www.google.com/maps/dir/?${query}`
}

export function readFavorites(raw: string | null): SavedStation[] {
  if (raw === null) return []
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value) || value.length > 50) throw new Error('Ungültige Favoriten')
  const ids = new Set<string>()
  return value.map(item => {
    if (typeof item !== 'object' || item === null) throw new Error('Ungültiger Favorit')
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || !row.id || row.id.length > 100 || ids.has(row.id) ||
        typeof row.name !== 'string' || !row.name || row.name.length > 255 ||
        !['street', 'houseNumber', 'place'].every(key => row[key] === null || (typeof row[key] === 'string' && row[key].length <= 255)) ||
        typeof row.latitude !== 'number' || typeof row.longitude !== 'number' || !routeUrl({ latitude: row.latitude, longitude: row.longitude })) throw new Error('Ungültiger Favorit')
    ids.add(row.id)
    return { id: row.id, name: row.name, street: row.street as string | null, houseNumber: row.houseNumber as string | null,
      place: row.place as string | null, latitude: row.latitude, longitude: row.longitude }
  })
}

export function toggleFavorite(current: readonly SavedStation[], station: SavedStation) {
  if (current.some(item => item.id === station.id)) return current.filter(item => item.id !== station.id)
  if (current.length >= 50) throw new Error('Du kannst höchstens 50 Tankstellen merken. Entferne zuerst einen Favoriten.')
  // Store only metadata, never search prices or the user's location.
  return [...current, readFavorites(JSON.stringify([station]))[0]]
}
