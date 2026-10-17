import { useMemo, useState } from 'react'
import { historyCsv } from './historyCsv'
import type { Fuel, HistorySeries } from './historyComparison'

export function HistoryExport({ series, fuel, from, to, demo }: { series: HistorySeries[]; fuel: Fuel; from: string; to: string; demo: boolean }) {
  const csv = useMemo(() => historyCsv(series, from, to, demo), [series, from, to, demo])
  const [message, setMessage] = useState('')
  function download() {
    if (!csv) return
    try {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `fuelanalytics-${demo ? 'DEMO-' : ''}${fuel}-${to.replaceAll(/[:.]/g, '-')}.csv`
      document.body.append(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setMessage('CSV-Download gestartet. Die Datei enthält die unten angezeigten, erfolgreich geladenen Messungen.')
    } catch { setMessage('Der CSV-Download konnte nicht gestartet werden. Bitte versuche es erneut.') }
  }
  return <div className="history-export"><button type="button" disabled={!csv} onClick={download}>Preisverlauf als CSV herunterladen</button>
    <p className="last-checked">{demo ? 'Fiktive Daten, in Datei und Dateiname als DEMO markiert. ' : ''}Für die ausgewählten Tankstellen, den Kraftstoff und Zeitraum. Semikolon-getrennt für Excel, Preise mit Dezimalkomma, Zeitstempel in UTC. Keine neuen Preisabrufe.</p>
    {series.some(entry => entry.error) && <p role="status">Teilweiser Export: Nicht geladene Tankstellen fehlen in der Datei.</p>}
    {!csv && <p>Keine Messungen zum Exportieren verfügbar.</p>}
    {message && <p role="status">{message}</p>}
  </div>
}
