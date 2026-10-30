import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { LpgPoint } from './lpgStatistics'

const price = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 5 })
const date = (value: unknown) => new Date(Number(value)).toLocaleDateString('de-DE', { timeZone: 'UTC' })
export function NationalLpgChart({ points }: { points: LpgPoint[] }) {
  const data = points.map(point => ({ timestamp: Date.parse(point.date + 'T00:00:00Z'), price: point.price }))
  return <div className="price-chart" role="group" aria-label="LPG-Wochenpreise für Deutschland. Exakte Werte in der Tabelle darunter.">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart data={data} margin={{ top: 16, right: 20, bottom: 16, left: 4 }} accessibilityLayer>
      <CartesianGrid stroke="#e1e7d9" strokeDasharray="3 3" />
      <XAxis type="number" scale="time" dataKey="timestamp" domain={['dataMin', 'dataMax']} tickFormatter={date} minTickGap={55} />
      <YAxis domain={['auto', 'auto']} tickFormatter={value => price.format(Number(value))} width={75} />
      <Tooltip labelFormatter={date} formatter={value => [price.format(Number(value)) + ' €/Liter', 'LPG Deutschland']} />
      <Line type="linear" dataKey="price" name="LPG Deutschland" stroke="#087f70" strokeWidth={2} dot={points.length < 100} isAnimationActive={false} />
    </LineChart></ResponsiveContainer>
  </div>
}
