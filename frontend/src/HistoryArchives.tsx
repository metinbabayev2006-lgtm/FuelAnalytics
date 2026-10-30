import { lazy, Suspense, useState } from 'react'
import { ArchiveHistory } from './ArchiveHistory'
const Kaggle = lazy(() => import('./HistoricalMonthly').then(m => ({ default: m.HistoricalMonthly })))
export function HistoryArchives() {
  const [source, setSource] = useState<'archive' | 'kaggle'>('archive')
  const [opened, setOpened] = useState(false)
  return <><div className="history-source-switch" role="group" aria-label="Historisches Archiv auswählen">
    <button aria-pressed={source === 'archive'} onClick={() => setSource('archive')}>Tankerkönig · zwölf Monate</button>
    <button aria-pressed={source === 'kaggle'} onClick={() => { setSource('kaggle'); setOpened(true) }}>Kaggle · ältere Jahre</button>
  </div><div hidden={source !== 'archive'}><ArchiveHistory /></div><div hidden={source !== 'kaggle'}>{opened && <Suspense fallback={<p>Älteres Archiv wird geöffnet …</p>}><Kaggle /></Suspense>}</div></>
}
