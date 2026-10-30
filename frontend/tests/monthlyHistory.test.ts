import { expect, test } from 'vitest'
import { monthlyChartData, validMonthlyHistory } from '../src/monthlyHistory'
const id='11111111-1111-4111-8111-111111111111'
const fixture=()=>({year:2022,fuelType:'e10' as const,aggregation:'monthly_source_mean' as const,unit:'EUR/l' as const,
  sourceUrl:'https://www.kaggle.com/datasets/oles04/petrol-station-germany',datasetVersion:2,licenseUrl:'https://creativecommons.org/licenses/by-nc-sa/4.0/',importedAt:'2026-10-30T12:00:00Z',series:[{station:{id,name:'Test',city:'Testcity',address:'Example',monthCount:2},points:[{month:'2022-01-01',meanPrice:1.5},{month:'2022-03-01',meanPrice:1.8}]}]})
test('keeps missing months empty and preserves calendar order without zero prices',()=>{
  const data=fixture(); expect(validMonthlyHistory(data,2022,'e10',[id])).toBe(true)
  const rows=monthlyChartData(data.series,2022)
  expect(rows).toHaveLength(12); expect(rows[0].price0).toBe(1.5); expect(rows[1].price0).toBeNull(); expect(rows[2].price0).toBe(1.8)
})
test('rejects changed aggregation, duplicate months, wrong station, and fabricated negative prices',()=>{
  expect(validMonthlyHistory({...fixture(),aggregation:'observations'},2022,'e10',[id])).toBe(false)
  const duplicate=fixture(); duplicate.series[0].points[1].month='2022-01-01'; expect(validMonthlyHistory(duplicate,2022,'e10',[id])).toBe(false)
  const bad=fixture(); bad.series[0].points[0].meanPrice=0; expect(validMonthlyHistory(bad,2022,'e10',[id])).toBe(false)
  expect(validMonthlyHistory(fixture(),2023,'e10',[id])).toBe(false)
  expect(validMonthlyHistory(fixture(),2022,'diesel',[id])).toBe(false)
  expect(validMonthlyHistory(fixture(),2022,'e10',['22222222-2222-4222-8222-222222222222'])).toBe(false)
})
