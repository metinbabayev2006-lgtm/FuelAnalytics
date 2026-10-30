import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { HistoricalMonthly } from '../src/HistoricalMonthly'
vi.mock('../src/MonthlyHistoryChart',()=>({MonthlyHistoryChart:()=> <p>Monatsdiagramm</p>}))
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
const station={id:'11111111-1111-4111-8111-111111111111',name:'Archivstation',city:'Detmold',address:'Teststraße 1',monthCount:2}
test('loads actual selected historical year and renders explicitly monthly statistics instead of measurements',async()=>{
  const request=vi.fn(async (url:string)=>url.endsWith('/years') ? Response.json([2022]) : url.includes('/stations?') ? Response.json({entries:[station],hasMore:false}) : Response.json({year:2022,fuelType:'e10',aggregation:'monthly_source_mean',unit:'EUR/l',sourceUrl:'https://www.kaggle.com/datasets/oles04/petrol-station-germany',datasetVersion:2,licenseUrl:'https://creativecommons.org/licenses/by-nc-sa/4.0/',importedAt:'2026-10-30T12:00:00Z',series:[{station,points:[{month:'2022-01-01',meanPrice:1.5},{month:'2022-03-01',meanPrice:1.8}]}]}))
  vi.stubGlobal('fetch',request);render(<HistoricalMonthly/>);const user=userEvent.setup()
  await screen.findByLabelText('Historisches Jahr')
  expect(screen.queryByRole('option',{name:'2026'})).toBeNull()
  await user.click(screen.getByRole('button',{name:'Historische Tankstellen laden'}))
  await user.click(await screen.findByRole('checkbox',{name:/Archivstation/}))
  await user.click(screen.getByRole('button',{name:'Monatsverlauf anzeigen'}))
  expect(await screen.findByText('Monatsdiagramm')).toBeTruthy()
  expect(screen.getByText('Niedrigstes Monatsmittel')).toBeTruthy()
  expect(screen.getAllByText('Keine Daten')).toHaveLength(10)
  expect(request).toHaveBeenCalledTimes(3)
  for(const [url] of request.mock.calls) expect(url).toContain('/api/history/monthly/')
  await user.type(screen.getByLabelText('Stadt im historischen Archiv'),'x')
  expect(screen.queryByText('Monatsdiagramm')).toBeNull()
})
test('handles missing imports and provider-free retry',async()=>{
  const request=vi.fn(async()=>Response.json([]));vi.stubGlobal('fetch',request);render(<HistoricalMonthly/>);
  expect(await screen.findByText('Noch keine historischen Monatsdaten verfügbar.')).toBeTruthy()
  await userEvent.click(screen.getByRole('button',{name:'Archiv erneut prüfen'}));expect(request).toHaveBeenCalledTimes(2)
})
test('rejects invalid yearly metadata with an actionable error',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json([2022,2022])));render(<HistoricalMonthly/>);
  expect((await screen.findByRole('alert')).textContent).toContain('Unerwartete Jahresauswahl')
})
