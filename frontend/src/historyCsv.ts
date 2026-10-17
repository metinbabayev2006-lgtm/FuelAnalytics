import type { HistorySeries } from './historyComparison'

function cell(value: string) {
  // Spreadsheet formula injection is possible even inside quoted CSV fields.
  const safe = /^[\s\uFEFF]*[=+@-]/u.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function historyCsv(series: readonly HistorySeries[], from: string, to: string, demo = false) {
  const rows = series.filter(entry => !entry.error).flatMap(entry => entry.prices.map(price => ({ station: entry.station, price })))
    .sort((a, b) => Date.parse(a.price.observedAt) - Date.parse(b.price.observedAt) || a.station.id.localeCompare(b.station.id))
  if (rows.length === 0) return null
  const header = ['Datenart', 'Tankstellen-ID', 'Tankstelle', 'Adresse', 'Kraftstoff', 'Preis_EUR_pro_Liter', 'Beobachtet_UTC', 'Zeitraum_von_UTC_inklusiv', 'Zeitraum_bis_UTC_exklusiv', 'Quelle']
  const lines = rows.map(({ station, price }) => [demo ? 'SYNTHETISCH' : 'Gespeicherter Abruf', station.id, station.name,
    [station.street, station.houseNumber, station.place].filter(Boolean).join(' '), price.fuelType,
    price.price.toFixed(3).replace('.', ','), new Date(price.observedAt).toISOString(), from, to,
    demo ? 'Fiktive Beispieldaten' : 'Tankerkönig / MTS-K · CC BY 4.0 · https://creativecommons.tankerkoenig.de/'])
  return '\uFEFF' + [header, ...lines].map(row => row.map(cell).join(';')).join('\r\n') + '\r\n'
}
