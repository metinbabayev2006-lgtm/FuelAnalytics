export type EnergyKind = 'electric' | 'gas'
export type EnergySite = {
  id: string; name: string; latitude: number; longitude: number; distanceKm: number
  address: string; services: string[]; openingHours: string | null; access: string | null; connectors: string[]
}
export type EnergyResult = { fetchedAt: string; kind: EnergyKind; stations: EnergySite[]; truncated: boolean; source: 'osm' | 'bnetza'; sourceDate: string | null }
export function validEnergyResult(value: unknown): value is EnergyResult {
  if (typeof value !== 'object' || value === null) return false
  const data = value as Record<string, unknown>
  if ((data.source !== 'osm' && data.source !== 'bnetza') ||
      (data.source === 'bnetza' && (data.kind !== 'electric' || typeof data.sourceDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.sourceDate))) ||
      (data.source === 'osm' && data.sourceDate !== null) ||
      (data.kind !== 'electric' && data.kind !== 'gas') || typeof data.fetchedAt !== 'string' ||
      !Number.isFinite(Date.parse(data.fetchedAt)) || typeof data.truncated !== 'boolean' || !Array.isArray(data.stations)) return false
  return data.stations.every((item: unknown) => {
    if (typeof item !== 'object' || item === null) return false
    const site = item as Record<string, unknown>
    return typeof site.id === 'string' && (data.source === 'bnetza' ? /^bnetza:[1-9][0-9]*$/.test(site.id) : /^osm:(node|way|relation):[1-9][0-9]*$/.test(site.id)) &&
      typeof site.name === 'string' && site.name.length > 0 && typeof site.address === 'string' &&
      typeof site.latitude === 'number' && Number.isFinite(site.latitude) && Math.abs(site.latitude) <= 90 &&
      typeof site.longitude === 'number' && Number.isFinite(site.longitude) && Math.abs(site.longitude) <= 180 &&
      typeof site.distanceKm === 'number' && Number.isFinite(site.distanceKm) && site.distanceKm >= 0 &&
      Array.isArray(site.services) && site.services.length > 0 && site.services.every(service =>
        data.kind === 'electric' ? service === 'Elektro' : service === 'LPG' || service === 'CNG') &&
      Array.isArray(site.connectors) && site.connectors.every(text => typeof text === 'string') &&
      (site.openingHours === null || typeof site.openingHours === 'string') && (site.access === null || typeof site.access === 'string')
  })
}
