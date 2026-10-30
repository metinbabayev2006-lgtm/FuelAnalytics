import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { archiveChartRows } from './archiveData'
import type { ArchiveData } from './archiveData'
export function ArchiveHistoryChart({ data }: { data: ArchiveData }) {
  return <div className="price-chart" role="group" aria-label="Zeitgewichtete Tankerkönig-Monatsmittel. Unvollständige Monate bleiben im Diagramm leer.">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart data={archiveChartRows(data)} accessibilityLayer margin={{ top: 20, right: 24, bottom: 12, left: 0 }}>
      <CartesianGrid stroke="#dce4eb" strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis domain={['auto', 'auto']} width={75} tickFormatter={v => Number(v).toLocaleString('de-DE', { minimumFractionDigits: 3 })} />
      <Tooltip formatter={(v, name) => [typeof v === 'number' ? v.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 6 }) + ' €/l (zeitgewichtet)' : 'Unvollständiger Monat', String(name)]} /><Legend />
      {data.series.map((s, n) => <Line key={s.station.id} dataKey={'price' + n} name={s.station.name + ' · ' + s.station.address} stroke={['#087f70', '#4263c7', '#9b5914'][n]} strokeWidth={2.5} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />)}
    </LineChart></ResponsiveContainer>
  </div>
}
