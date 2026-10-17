import { Icon } from './Icon'
import { euroFormat, fillCostCents, litreFormat, parseTankVolume } from './tankCosts'

type Props = {
  value: string
  onChange: (value: string) => void
  minimumPrice: number | null
  maximumPrice: number | null
}

export function TankCalculator({ value, onChange, minimumPrice, maximumPrice }: Props) {
  const volume = parseTankVolume(value)
  const min = minimumPrice === null ? null : fillCostCents(minimumPrice, volume)
  const max = maximumPrice === null ? null : fillCostCents(maximumPrice, volume)
  return <section className="tank-calculator" aria-labelledby="tank-title">
    <div className="tank-input-panel">
      <div className="tank-heading"><Icon name="fuel" /><div><p className="section-kicker">DEINE TANKFÜLLUNG</p><h4 id="tank-title">Was kostet dein nächster Stopp?</h4></div></div>
      <label htmlFor="tank-volume">Tankmenge in Litern</label>
      <div className="tank-volume-input"><input id="tank-volume" type="text" inputMode="decimal" value={value} maxLength={8} onChange={event => onChange(event.target.value)} aria-invalid={volume === null} aria-describedby="tank-volume-help" /><span aria-hidden="true">Liter</span></div>
      <div className="tank-presets" aria-label="Tankmenge schnell wählen">{[20, 40, 60].map(litres => <button key={litres} type="button" aria-pressed={volume === litres * 10} onClick={() => onChange(String(litres))}>{litres} Liter</button>)}</div>
      <p id="tank-volume-help" className={volume === null ? 'error' : 'last-checked'}>0,1 bis 200 Liter · maximal eine Nachkommastelle.</p>
    </div>
    <div className="tank-estimate" aria-live="polite" aria-atomic="true">
      {volume === null ? <p>Bitte gib eine gültige Tankmenge ein, zum Beispiel 40 oder 35,5.</p> : min === null || max === null ? <p>Für die Tankkosten fehlen verfügbare Preise von beim Abruf geöffneten Tankstellen.</p> : <>
        <p className="tank-estimate-label">Dein Vergleich für <strong>{litreFormat.format(volume / 10)} Liter</strong></p>
        <dl className="tank-totals"><div><dt>Günstigste Füllung</dt><dd>{euroFormat.format(min / 100)}</dd></div><div><dt>Teuerste Füllung</dt><dd>{euroFormat.format(max / 100)}</dd></div><div><dt>Preisunterschied</dt><dd>{euroFormat.format((max - min) / 100)}</dd></div></dl>
        <p className="last-checked">Die Kosten je Tankstelle stehen in der Liste. Rechenvergleich zum Datenstand oben, ohne Fahrtkosten oder Umwege. Beträge auf Cent gerundet.</p>
      </>}
    </div>
  </section>
}

export function StationFillCost({ price, volume, cheapestCents }: { price: number | undefined; volume: number | null; cheapestCents: number | null }) {
  if (volume === null) return <span className="station-fill-cost">Tankmenge prüfen</span>
  const cents = fillCostCents(price, volume)
  if (cents === null || cheapestCents === null) return <span className="station-fill-cost">Keine Kosten verfügbar</span>
  const difference = cents - cheapestCents
  return <span className="station-fill-cost"><strong>{euroFormat.format(cents / 100)}</strong><span>für {litreFormat.format(volume / 10)} Liter</span><span className={difference === 0 ? 'best-fill' : ''}>{difference === 0 ? 'Günstigste Füllung' : `+${euroFormat.format(difference / 100)} zum Minimum`}</span></span>
}
