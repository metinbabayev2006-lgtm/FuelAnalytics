import { summarizePrices } from './priceStatistics'
import type { Fuel } from './priceStatistics'

type Entry = Parameters<typeof summarizePrices>[0][number]
const names = { diesel: 'Diesel', e5: 'Super E5', e10: 'Super E10' }
const priceFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export function PriceSummary({ entries, fuel }: { entries: readonly Entry[]; fuel: Fuel }) {
  const summary = summarizePrices(entries, fuel)
  return <section className="price-summary" aria-labelledby="summary-title">
    <h4 id="summary-title">Preisvergleich · {names[fuel]}</h4>
    {!summary ? <p>Für diesen Kraftstoff sind keine Preise von beim Abruf geöffneten Tankstellen verfügbar.</p> : <>
      <dl className="summary-grid">
        <div><dt>Günstigster Preis</dt><dd>{priceFormat.format(summary.min)} <span>€/Liter</span></dd></div>
        <div><dt>Durchschnitt</dt><dd>{priceFormat.format(summary.average)} <span>€/Liter</span></dd></div>
        <div><dt>Höchster Preis</dt><dd>{priceFormat.format(summary.max)} <span>€/Liter</span></dd></div>
        <div><dt>Preisspanne</dt><dd>{priceFormat.format(summary.spread)} <span>€/Liter</span></dd></div>
      </dl>
      <div className="cheapest-stations"><span>{summary.cheapest.length === 1 ? 'Günstigste Tankstelle' : `${summary.cheapest.length} Tankstellen zum günstigsten Preis`}</span><ul>{summary.cheapest.map(station => <li key={station.id}><strong>{station.name}</strong><span>{[station.street, station.houseNumber, station.place].filter(Boolean).join(' ')}</span></li>)}</ul></div>
      <p className="last-checked">Basis: {summary.count} von {entries.length} gefundenen Tankstellen. Berücksichtigt werden nur beim Abruf geöffnete Tankstellen mit verfügbarem {names[fuel]}-Preis. Der Durchschnitt zählt jede Tankstelle gleich; die Preisspanne ist die Differenz zwischen höchstem und niedrigstem Preis. Es gilt der Datenstand oben.</p>
    </>}
  </section>
}
