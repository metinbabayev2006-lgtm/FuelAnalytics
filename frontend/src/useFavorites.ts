import { useState } from 'react'
import { readFavorites, toggleFavorite } from './stationActions'
import type { SavedStation } from './stationActions'

export function useFavorites(demo: boolean) {
  const key = demo ? 'fuelanalytics.demo-favorites.v1' : 'fuelanalytics.favorites.v1'
  const [state, setState] = useState(() => {
    try { return { favorites: readFavorites(localStorage.getItem(key)), message: '' } }
    catch { return { favorites: [] as SavedStation[], message: 'Favoriten konnten nicht gelesen werden. Du kannst sie für diese Sitzung neu auswählen.' } }
  })
  function toggle(station: SavedStation) {
    try {
      const favorites = toggleFavorite(state.favorites, station)
      let message = ''
      try { localStorage.setItem(key, JSON.stringify(favorites)) }
      catch { message = 'Favoriten bleiben nur für diese Sitzung erhalten; der Browserspeicher ist nicht verfügbar.' }
      setState({ favorites, message })
    } catch (cause) { setState({ ...state, message: cause instanceof Error ? cause.message : 'Favorit konnte nicht geändert werden.' }) }
  }
  return { ...state, toggle }
}
