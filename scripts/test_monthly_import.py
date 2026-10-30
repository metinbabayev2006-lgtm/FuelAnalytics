import csv
import importlib.util
from pathlib import Path
import tempfile
import unittest

MODULE = Path(__file__).with_name('import_monthly_history.py')
spec = importlib.util.spec_from_file_location('monthly_import', MODULE)
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
ID = '11111111-1111-4111-8111-111111111111'

class MonthlyImportTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.stations = self.root / 'stations.csv'
        with self.stations.open('w', encoding='utf-8', newline='') as stream:
            writer = csv.writer(stream); writer.writerow(['uuid','name','street','house_number','post_code','city'])
            writer.writerow([ID, 'Test; "quoted"\nstation', 'Example', '1', '01234', 'Testcity'])
        self.prices = self.root / 'prices.csv'
    def write(self, rows):
        with self.prices.open('w', newline='', encoding='utf-8') as stream:
            writer = csv.writer(stream); writer.writerow(['station_uuid','year','month','diesel','e5','e10']); writer.writerows(rows)
    def test_separate_mean_import_with_safe_source_text_missing_values_and_explicit_year_filter(self):
        self.write([[ID,2021,12,1,1,1],[ID,2022,1,'0','NaN','1.5'],[ID,2022,2,'1.6','1.7','1.8'],['22222222-2222-4222-8222-222222222222',2022,1,1,1,1]])
        output=self.root / 'import.sql'
        report=module.prepare(self.stations,self.prices,2022,output)
        self.assertEqual(report,dict(year=2022,stations=1,monthly_fuel_values=4,excluded_values=2,unmatched_rows=1,outside_year_rows=1))
        sql=output.read_text(encoding='utf-8')
        self.assertTrue(sql.startswith('BEGIN;'))
        self.assertTrue(sql.endswith('COMMIT;\n'))
        self.assertNotIn('price_observation',sql)
        self.assertNotIn('2021-12-01',sql)
        self.assertIn('Test; ""quoted"" station',sql)
        self.assertIn('monthly_price',sql)
    def test_duplicate_month_fails_before_overwriting_previous_import(self):
        self.write([[ID,2022,1,1,1,1],[ID,2022,1,2,2,2]])
        output=self.root / 'import.sql'; output.write_text('previous')
        with self.assertRaises(ValueError): module.prepare(self.stations,self.prices,2022,output)
        self.assertEqual(output.read_text(),'previous')
    def test_empty_city_is_quoted_for_postgres_copy_not_null(self):
        with self.stations.open('w', encoding='utf-8', newline='') as stream:
            writer = csv.writer(stream)
            writer.writerow(['uuid','name','street','house_number','post_code','city'])
            writer.writerow([ID, 'Station', '', '', '', ''])
        self.write([[ID,2022,1,1,1,1]])
        output = self.root / 'import.sql'
        module.prepare(self.stations,self.prices,2022,output)
        self.assertIn(f'"{ID}","Station","",""', output.read_text(encoding='utf-8'))
    def test_invalid_month_and_empty_valid_prices_fail_closed(self):
        self.write([[ID,2022,13,1,1,1]])
        with self.assertRaises(ValueError): module.prepare(self.stations,self.prices,2022,self.root/'out.sql')
        self.write([[ID,2022,1,0,0,0]])
        with self.assertRaises(ValueError): module.prepare(self.stations,self.prices,2022,self.root/'out.sql')

if __name__=='__main__': unittest.main()
