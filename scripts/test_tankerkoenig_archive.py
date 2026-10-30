import importlib.util
from datetime import date
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import gzip
import json

spec=importlib.util.spec_from_file_location('archive',Path(__file__).with_name('import_tankerkoenig_archive.py'))
archive=importlib.util.module_from_spec(spec); spec.loader.exec_module(archive)
ID='11111111-1111-4111-8111-111111111111'

class ArchiveTests(unittest.TestCase):
    def cached(self,day,events):
        return {'stations':{ID:['Synthetic','Detmold','Example 1']},'events':events}
    def test_prices_are_weighted_by_duration_not_number_of_changes(self):
        day=date(2026,1,1); start,end=archive.bounds(day)
        events=[[start,ID,[[1,1000000],[0,None],[0,None]]],[start+6*3600,ID,[[1,2000000],[0,None],[0,None]]]]
        rows=archive.integrate_day(day,self.cached(day,events),{})
        diesel=next(r for r in rows if r[2]=='diesel')
        self.assertEqual(diesel[4],86400)
        self.assertEqual(float(diesel[3])/diesel[4],1.75)
        self.assertEqual(next(r for r in rows if r[2]=='e10')[4],0)
    def test_unknown_start_removed_price_and_new_price_leave_gaps(self):
        day=date(2026,1,1); start,end=archive.bounds(day)
        events=[[start+3600,ID,[[3,1500000],[0,None],[0,None]]],[start+7200,ID,[[2,None],[0,None],[0,None]]]]
        state={}; rows=archive.integrate_day(day,self.cached(day,events),state)
        self.assertEqual(rows[0][4],3600)
        self.assertEqual(float(rows[0][3]),5400)
        self.assertIsNone(state[(ID,'diesel')])
    def test_summer_and_winter_time_have_real_23_and_25_hour_days(self):
        for day,hours in [(date(2026,3,29),23),(date(2025,10,26),25)]:
            state={(ID,'diesel'):2000000}
            row=archive.integrate_day(day,self.cached(day,[]),state)[0]
            self.assertEqual(row[4],hours*3600); self.assertEqual(row[5],hours*3600)
            self.assertEqual(float(row[3])/row[4],2)
    def test_station_outside_daily_city_snapshot_cannot_carry_old_price(self):
        state={(ID,'diesel'):2000000}
        self.assertEqual(archive.integrate_day(date(2026,1,1),{'stations':{},'events':[]},state),[])
        self.assertEqual(state,{})
    def test_resume_reuses_completed_checkpoint_without_network(self):
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory); day=date(2026,1,1)
            data={'version':archive.CACHE_VERSION,'day':str(day),'cities':list(archive.CITIES),'events':[]}
            with gzip.open(folder/f'{day}.json.gz','wt',encoding='utf-8') as stream: json.dump(data,stream)
            with patch.object(archive,'download',side_effect=AssertionError('Must not redownload')):
                self.assertEqual(archive.checkpoint(day,folder,'secret'),data)
    def test_frankfurt_oder_and_neighboring_cities_are_excluded(self):
        self.assertIsNone(archive.city_for({'city':'Frankfurt','latitude':'52.34','longitude':'14.55'}))
        self.assertEqual(archive.city_for({'city':'FRANKFURT AM MAIN','latitude':'50.11','longitude':'8.68'}),'Frankfurt am Main')
        self.assertIsNone(archive.city_for({'city':'Garching b. München'}))
    def test_preparation_keeps_sources_separate_and_quotes_normalized_station_text(self):
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory)
            for day in (date(2025,12,31),date(2026,1,1)):
                value=self.cached(day,[[archive.bounds(day)[0],ID,[[1,1500000],[0,None],[0,None]]]])
                value.update(version=archive.CACHE_VERSION,day=str(day),cities=list(archive.CITIES),stationsSha256='a'*64,pricesSha256='b'*64)
                value['stations'][ID][0]='Synthetic\n"quoted" station'
                with gzip.open(folder/f'{day}.json.gz','wt',encoding='utf-8') as stream: json.dump(value,stream)
            sql,report=archive.prepare(folder,date(2026,1,1),date(2026,1,2))
            text=sql.read_text(encoding='utf-8')
            self.assertEqual(report['source_days'],2)
            self.assertEqual(report['daily_fuel_intervals'],3)
            self.assertTrue(text.startswith('BEGIN;'))
            self.assertTrue(text.endswith('COMMIT;\n'))
            self.assertIn('Synthetic ""quoted"" station',text)
            self.assertNotIn('price_observation',text)
            self.assertNotIn('historical_monthly_price',text)
            self.assertNotIn('DELETE FROM station;',text)
    def test_missing_source_day_does_not_replace_previous_prepared_sql(self):
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory); target=folder/'import.sql'; target.write_text('previous')
            with self.assertRaises(FileNotFoundError): archive.prepare(folder,date(2026,1,1),date(2026,1,2))
            self.assertEqual(target.read_text(),'previous')

if __name__=='__main__': unittest.main()
