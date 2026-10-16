export type Location = { id: number; name: string; region: string | null; district: string | null; latitude: number; longitude: number }

export function locationLabel(location: Location) {
  return [...new Set([location.name, location.district, location.region].filter(Boolean))].join(', ')
}

export function locationPosition(location: Location) {
  const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4 })
  return `Mittelpunkt: ${number.format(location.latitude)}° N, ${number.format(location.longitude)}° O`
}
