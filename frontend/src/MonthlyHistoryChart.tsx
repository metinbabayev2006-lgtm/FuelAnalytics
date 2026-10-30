import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { monthlyChartData } from './monthlyHistory'
import type { MonthlyHistoryData } from './monthlyHistory'
const colors = ['#087f70', '#4263c7', '#9b5914']
export function MonthlyHistoryChart({ data }: { data: MonthlyHistoryData }) {
  return <div className="price-chart" role="group" aria-label="Historische Monatsdurchschnitte, keine einzelnen Preisänderungen. Exakte Werte in der Tabelle.">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart data={monthlyChartData(data.series, data.year)} accessibilityLayer margin={{ top: 20, right: 24, bottom: 12, left: 0 }}>
      <CartesianGrid stroke="#dce4eb" strokeDasharray="3 3" />
      <XAxis dataKey="label" /><YAxis domain={['auto', 'auto']} width={75} tickFormatter={value => Number(value).toLocaleString('de-DE', { minimumFractionDigits: 3 })} />
      <Tooltip formatter={(value, name) => [typeof value === 'number' ? value.toLocaleString('de-DE', { minimumFractionDigits: 3 }) + ' €/Liter (Monatsmittel)' : 'Keine Daten', String(name)]} />
      <Legend />
      {data.series.map((series, index) => <Line key={series.station.id} dataKey={`price${index}`} name={`${series.station.name} · ${series.station.address}`} stroke={colors[index]} strokeWidth={2} connectNulls={false} dot={{ r: 4 }} isAnimationActive={false} />)}
    </LineChart></ResponsiveContainer>
  </div>
}
