import type { SavedStation } from './stationActions'
import type { Fuel } from './historyComparison'
import type { Location } from './location'
export type Entry = { station: SavedStation; open: boolean; distanceKm: number; prices: Partial<Record<Fuel, number>> }
export type Result = { observedAt: string; stations: Entry[]; rejectedStations: number }
export type SearchResult = Result & { searchLabel: string; radiusKm: number; center: Location }
