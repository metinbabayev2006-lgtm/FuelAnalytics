"""Import Kaggle v2 monthly station means into separate PostgreSQL tables. Standard library only."""
import argparse
import csv
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
from pathlib import Path
import subprocess
import uuid

SOURCE = 'https://www.kaggle.com/datasets/oles04/petrol-station-germany'
LICENSE = 'https://creativecommons.org/licenses/by-nc-sa/4.0/'
FUELS = ('diesel', 'e5', 'e10')
ROOT = Path(__file__).resolve().parents[1]


def text(value, maximum):
    result = ' '.join((value or '').split())
    if len(result) > maximum:
        raise ValueError('Source text exceeds schema length')
    return result


def read_stations(path):
    stations = {}
    with path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if not {'uuid', 'name', 'street', 'house_number', 'post_code', 'city'} <= set(reader.fieldnames or []):
            raise ValueError('Unexpected station columns')
        for row in reader:
            station_id = str(uuid.UUID(row['uuid']))
            if station_id in stations:
                raise ValueError('Duplicate source station ID')
            stations[station_id] = (
                station_id, text(row['name'], 500) or 'Tankstelle', text(row['city'], 300),
                text(' '.join(row.get(field, '') for field in ('street', 'house_number', 'post_code', 'city')), 1000),
            )
    return stations


def read_prices(path, stations, year):
    records, used, seen = [], set(), set()
    excluded, unmatched, outside_year = 0, 0, 0
    with path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if not {'station_uuid', 'year', 'month', *FUELS} <= set(reader.fieldnames or []):
            raise ValueError('Unexpected monthly price columns')
        for row in reader:
            station_id = str(uuid.UUID(row['station_uuid']))
            source_year, month = int(row['year']), int(row['month'])
            if not 2000 <= source_year <= 2100 or not 1 <= month <= 12:
                raise ValueError('Unexpected source year/month')
            if source_year != year:
                outside_year += 1
                continue
            key = station_id, month
            if key in seen:
                raise ValueError('Duplicate source station/month')
            seen.add(key)
            if station_id not in stations:
                unmatched += 1
                continue
            for fuel in FUELS:
                try:
                    price = Decimal(row[fuel])
                    if not price.is_finite() or not Decimal(0) < price < Decimal(20):
                        raise InvalidOperation
                    if price != price.quantize(Decimal('0.000001')):
                        raise ValueError('Source precision exceeds database schema')
                except (InvalidOperation, TypeError):
                    excluded += 1
                    continue
                records.append((station_id, f'{year:04d}-{month:02d}-01', fuel, str(price), year))
                used.add(station_id)
    if not records:
        raise ValueError('No valid monthly source values; database untouched')
    return records, used, excluded, unmatched, outside_year


def prepare(stations_path, prices_path, year, output):
    stations = read_stations(stations_path)
    records, used, excluded, unmatched, outside_year = read_prices(prices_path, stations, year)
    hashes = [hashlib.sha256(path.read_bytes()).hexdigest() for path in (prices_path, stations_path)]
    output.parent.mkdir(parents=True, exist_ok=True)
    pending = output.with_suffix('.pending')
    with pending.open('w', encoding='utf-8', newline='') as stream:
        stream.write('BEGIN;\nCREATE TEMP TABLE incoming_historical_station (LIKE historical_station) ON COMMIT DROP;\n')
        stream.write('COPY incoming_historical_station (id,name,city,address) FROM STDIN WITH (FORMAT csv);\n')
        # Quote empty strings explicitly: PostgreSQL COPY otherwise interprets them as NULL.
        writer = csv.writer(stream, lineterminator='\n', quoting=csv.QUOTE_ALL)
        writer.writerows(stations[station_id] for station_id in sorted(used))
        stream.write('\\.\n')
        stream.write('INSERT INTO historical_station SELECT * FROM incoming_historical_station ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,city=EXCLUDED.city,address=EXCLUDED.address;\n')
        stream.write('CREATE TEMP TABLE incoming_monthly_import (LIKE historical_monthly_import INCLUDING DEFAULTS) ON COMMIT DROP;\n')
        stream.write('COPY incoming_monthly_import (import_year,source_url,dataset_version,license_url,prices_sha256,stations_sha256,excluded_values,unmatched_rows,outside_year_rows) FROM STDIN WITH (FORMAT csv);\n')
        writer.writerow((year, SOURCE, 2, LICENSE, *hashes, excluded, unmatched, outside_year))
        stream.write('\\.\n')
        stream.write('INSERT INTO historical_monthly_import SELECT * FROM incoming_monthly_import ON CONFLICT (import_year) DO UPDATE SET source_url=EXCLUDED.source_url,dataset_version=EXCLUDED.dataset_version,license_url=EXCLUDED.license_url,prices_sha256=EXCLUDED.prices_sha256,stations_sha256=EXCLUDED.stations_sha256,excluded_values=EXCLUDED.excluded_values,unmatched_rows=EXCLUDED.unmatched_rows,outside_year_rows=EXCLUDED.outside_year_rows,imported_at=EXCLUDED.imported_at;\n')
        stream.write(f'DELETE FROM historical_monthly_price WHERE import_year={year};\n')
        stream.write('COPY historical_monthly_price (station_id,reference_month,fuel_type,mean_price,import_year) FROM STDIN WITH (FORMAT csv);\n')
        writer.writerows(records)
        stream.write('\\.\nCOMMIT;\n')
    pending.replace(output)
    return {'year': year, 'stations': len(used), 'monthly_fuel_values': len(records), 'excluded_values': excluded, 'unmatched_rows': unmatched, 'outside_year_rows': outside_year}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stations', type=Path, default=ROOT / 'data/kaggle/stations.csv')
    parser.add_argument('--prices', type=Path, help='Defaults to data/kaggle/aggregated<year>.csv')
    parser.add_argument('--year', type=int, default=2022)
    parser.add_argument('--prepare-only', action='store_true', help='Validate and write local SQL without changing PostgreSQL')
    args = parser.parse_args()
    if not 2000 <= args.year <= 2100:
        parser.error('year must be between 2000 and 2100')
    sql = ROOT / f'data/kaggle/import-monthly-{args.year}.sql'
    prices = args.prices or ROOT / f'data/kaggle/aggregated{args.year}.csv'
    summary = prepare(args.stations, prices, args.year, sql)
    print('Validated source:', summary)
    if not args.prepare_only:
        # Database must already have Flyway V4. All changes are one transaction;
        # ON_ERROR_STOP aborts on COPY/schema failures and connection close rolls back.
        with sql.open('rb') as source:
            subprocess.run(['docker', 'compose', 'exec', '-T', 'postgres', 'psql', '-U', 'fuelanalytics', '-d', 'fuelanalytics',
                            '-v', 'ON_ERROR_STOP=1', '--quiet'], stdin=source, cwd=ROOT, check=True)
        print('Imported monthly means into PostgreSQL; live observations were not modified.')
    else:
        print('Prepared only:', sql)


if __name__ == '__main__':
    main()
