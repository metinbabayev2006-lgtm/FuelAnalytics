"""Resumable, city-filtered Tankerkönig archive import; credentials only from local .env.

Daily changes are retained in compressed local checkpoints. PostgreSQL receives
time-weighted daily integrals, never synthetic individual price observations.
"""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
import csv
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import time as clock
import urllib.error
import urllib.request
import uuid
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://data.tankerkoenig.de/tankerkoenig-organization/tankerkoenig-data/raw/branch/master/'
SOURCE = 'https://data.tankerkoenig.de/tankerkoenig-organization/tankerkoenig-data'
LICENSE = 'https://creativecommons.org/licenses/by-nc-sa/4.0/'
CITIES = ('Berlin', 'München', 'Frankfurt am Main', 'Köln', 'Detmold')
FUELS = ('diesel', 'e5', 'e10')
BERLIN = ZoneInfo('Europe/Berlin')
CACHE_VERSION = 1


def city_for(row):
    value = ' '.join(row['city'].split()).casefold()
    if value == 'berlin' or value.startswith('berlin-'): return 'Berlin'
    if value in ('münchen', 'muenchen'): return 'München'
    if value == 'köln' or value.startswith('köln-') or value == 'koeln': return 'Köln'
    if value == 'detmold': return 'Detmold'
    if value in ('frankfurt', 'frankfurt am main', 'frankfurt a. main', 'frankfurt main', 'frankfurt/m.bonames'):
        # Frankfurt/Oder must never be included through an ambiguous city name.
        if Decimal('49.8') < Decimal(row['latitude']) < Decimal('50.4') and Decimal('8.4') < Decimal(row['longitude']) < Decimal('9.0'):
            return 'Frankfurt am Main'
    return None


def credentials():
    values = {}
    for line in (ROOT / '.env').read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1); values[key.strip()] = value.strip().strip('"').strip("'")
    try:
        return base64.b64encode((values['TANKERKOENIG_ARCHIVE_USERNAME'] + ':' + values['TANKERKOENIG_ARCHIVE_PASSWORD']).encode()).decode()
    except KeyError:
        raise ValueError('Archive credentials missing from local .env') from None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Archive redirect refused to protect credentials')


def download(kind, day, folder, auth):
    path = f'{kind}/{day:%Y/%m}/{day:%Y-%m-%d}-{kind}.csv'
    target = folder / f'.download-{day}-{kind}.csv'
    for attempt in range(3):
        try:
            request = urllib.request.Request(BASE + path, headers={'Authorization': 'Basic ' + auth, 'User-Agent': 'FuelAnalytics-Educational/1.0'})
            digest = hashlib.sha256(); size = 0
            with urllib.request.build_opener(NoRedirect).open(request, timeout=90) as response, target.open('wb') as output:
                expected = response.headers.get('Content-Length')
                while chunk := response.read(262144):
                    size += len(chunk)
                    if size > 100_000_000: raise ValueError('Unexpected archive file size')
                    output.write(chunk); digest.update(chunk)
                if expected is not None and size != int(expected): raise ValueError('Truncated archive file')
            return target, digest.hexdigest(), size
        except (OSError, ValueError, urllib.error.URLError):
            if attempt == 2: raise RuntimeError(f'Download failed for {day} {kind}; completed checkpoints are preserved') from None
            clock.sleep(2 * (attempt + 1))


def checkpoint(day, folder, auth):
    target = folder / f'{day}.json.gz'
    if target.exists():
        with gzip.open(target, 'rt', encoding='utf-8') as stream: value = json.load(stream)
        if value.get('version') != CACHE_VERSION or value.get('day') != str(day) or value.get('cities') != list(CITIES):
            raise ValueError('Incompatible archive checkpoint; use a separate cache directory')
        return value
    stations_path, stations_hash, station_bytes = download('stations', day, folder, auth)
    stations = {}
    with stations_path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if not {'uuid', 'name', 'city', 'street', 'house_number', 'post_code', 'latitude', 'longitude'} <= set(reader.fieldnames or []):
            raise ValueError('Unexpected archive station header')
        for row in reader:
            city = city_for(row)
            if city:
                station_id = str(uuid.UUID(row['uuid']))
                if station_id in stations: raise ValueError('Duplicate archive station')
                stations[station_id] = [' '.join(row['name'].split()) or 'Tankstelle', city, ' '.join(' '.join(row.get(f, '') for f in ('street','house_number','post_code','city')).split())]
    if not stations or any(len(v[0]) > 500 or len(v[2]) > 1000 for v in stations.values()): raise ValueError('Invalid archive station metadata')
    prices_path, prices_hash, price_bytes = download('prices', day, folder, auth)
    events = []
    start, end = bounds(day)
    with prices_path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if not {'date','station_uuid',*FUELS,*(f+'change' for f in FUELS)} <= set(reader.fieldnames or []):
            raise ValueError('Unexpected archive price header')
        for row in reader:
            if row['station_uuid'] not in stations: continue
            moment = datetime.fromisoformat(row['date'])
            if moment.tzinfo is None: raise ValueError('Archive timestamp lacks timezone')
            stamp = int(moment.timestamp())
            if not start <= stamp < end: raise ValueError('Archive timestamp outside file date')
            changes = []
            for fuel in FUELS:
                flag = int(row[fuel+'change'])
                if flag not in (0,1,2,3): raise ValueError('Unexpected price change flag')
                price = None
                if flag in (1,3):
                    try:
                        value = Decimal(row[fuel])
                        if value.is_finite() and 0 < value < 20 and value * 1_000_000 == (value * 1_000_000).to_integral_value(): price = int(value * 1_000_000)
                    except InvalidOperation: pass
                changes.append([flag, price])
            events.append([stamp,row['station_uuid'],changes])
    events.sort(key=lambda event: (event[0],event[1]))
    value = {'version': CACHE_VERSION, 'cities': list(CITIES), 'day': str(day), 'stations': stations, 'events': events,
             'stationsSha256': stations_hash, 'pricesSha256': prices_hash, 'downloadedBytes': station_bytes + price_bytes}
    pending = target.with_suffix('.pending')
    with gzip.open(pending, 'wt', encoding='utf-8') as stream: json.dump(value,stream,ensure_ascii=False,separators=(',',':'))
    pending.replace(target)
    stations_path.unlink(); prices_path.unlink()
    return value


def bounds(day):
    return tuple(int(datetime.combine(d,time.min,BERLIN).timestamp()) for d in (day,day+timedelta(days=1)))


def integrate_day(day, checkpoint_value, state):
    start, end = bounds(day)
    active = checkpoint_value['stations']
    # A station absent from that day's city-filtered snapshot has no known local interval.
    for key in list(state):
        if key[0] not in active: del state[key]
    totals = { (station_id,fuel): [0,0,start] for station_id in active for fuel in FUELS }
    for stamp,station_id,changes in checkpoint_value['events']:
        for fuel,(flag,price) in zip(FUELS,changes):
            if flag == 0: continue
            key = station_id,fuel
            total = totals[key]
            if stamp < total[2]: raise ValueError('Price events out of order')
            previous = state.get(key)
            if previous is not None:
                seconds = stamp-total[2]; total[0] += previous*seconds; total[1] += seconds
            total[2] = stamp
            state[key] = price if flag in (1,3) else None
    result = []
    for key,(weighted,known,last) in totals.items():
        previous = state.get(key)
        if previous is not None: weighted += previous*(end-last); known += end-last
        result.append([key[0],str(day),key[1],str(Decimal(weighted)/1_000_000),known,end-start])
    return result


def prepare(folder, start, end):
    """Inclusive start, exclusive end. Never publish a partial download as a complete import."""
    state, stations, records, manifest = {}, {}, [], []
    day = start-timedelta(days=1)  # Seed prices when available; unknown initial prices stay unknown.
    while day < end:
        with gzip.open(folder/f'{day}.json.gz','rt',encoding='utf-8') as stream: cached=json.load(stream)
        if cached.get('version') != CACHE_VERSION or cached.get('day') != str(day) or cached.get('cities') != list(CITIES):
            raise ValueError('Checkpoint identity mismatch; database untouched')
        rows = integrate_day(day,cached,state)
        if day >= start:
            stations.update({key:[' '.join(str(v).split()) for v in values] for key,values in cached['stations'].items()}); records.extend(rows)
        manifest.append([str(day),cached['stationsSha256'],cached['pricesSha256']])
        day += timedelta(days=1)
    if not stations or not any(row[4] > 0 for row in records): raise ValueError('No known archive price intervals')
    manifest_path=folder/'manifest.json'
    manifest_path.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    digest=hashlib.sha256(manifest_path.read_bytes()).hexdigest()
    sql=folder/'import.sql'; pending=folder/'import.pending'
    with pending.open('w',encoding='utf-8',newline='') as stream:
        writer=csv.writer(stream,lineterminator='\n',quoting=csv.QUOTE_ALL)
        stream.write('BEGIN;\nCREATE TEMP TABLE incoming_archive_station (LIKE archive_station) ON COMMIT DROP;\nCOPY incoming_archive_station FROM STDIN WITH (FORMAT csv);\n')
        writer.writerows([station_id,*values] for station_id,values in sorted(stations.items()))
        stream.write('\\.\nINSERT INTO archive_station SELECT * FROM incoming_archive_station ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,city=EXCLUDED.city,address=EXCLUDED.address;\n')
        # This importer owns this one selected period, separate from all live/Kaggle tables.
        stream.write('DELETE FROM archive_daily_price;\nDELETE FROM archive_import;\nCOPY archive_import (id,period_start,period_end,source_url,license_url,manifest_sha256,downloaded_days,cities) FROM STDIN WITH (FORMAT csv);\n')
        writer.writerow((1,start,end,SOURCE,LICENSE,digest,len(manifest),', '.join(CITIES)))
        stream.write('\\.\nCOPY archive_daily_price (station_id,reference_day,fuel_type,price_seconds,known_seconds,total_seconds) FROM STDIN WITH (FORMAT csv);\n')
        writer.writerows(records)
        stream.write('\\.\nCOMMIT;\n')
    pending.replace(sql)
    return sql,{'stations':len(stations),'daily_fuel_intervals':len(records),'period_start':str(start),'period_end_exclusive':str(end),'source_days':len(manifest)}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from',dest='start',type=date.fromisoformat,default=date(2025,10,1))
    parser.add_argument('--to',dest='end',type=date.fromisoformat,default=date(2026,10,1),help='Exclusive end')
    parser.add_argument('--workers',type=int,default=3,choices=(1,2,3))
    parser.add_argument('--prepare-only',action='store_true')
    args=parser.parse_args()
    if not args.start < args.end or (args.end-args.start).days > 366 or args.start.day != 1 or args.end.day != 1:
        parser.error('Choose complete calendar months, at most twelve; end is exclusive')
    folder=ROOT/'data/tankerkoenig-archive'/f'{args.start}_{args.end}'
    folder.mkdir(parents=True,exist_ok=True)
    days=[args.start-timedelta(days=1)+timedelta(days=i) for i in range((args.end-args.start).days+1)]
    auth=credentials()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for index,result in enumerate(pool.map(lambda day: checkpoint(day,folder,auth),days),1):
            print(f'Archive {index}/{len(days)}: {result["day"]}, {len(result["stations"])} city stations, {len(result["events"])} changes',flush=True)
    sql,report=prepare(folder,args.start,args.end)
    print('Validated archive:',json.dumps(report),flush=True)
    if not args.prepare_only:
        with sql.open('rb') as source:
            subprocess.run(['docker','compose','exec','-T','postgres','psql','-U','fuelanalytics','-d','fuelanalytics','-v','ON_ERROR_STOP=1','--quiet'],stdin=source,cwd=ROOT,check=True)
        print('Archive imported into PostgreSQL. Live and Kaggle tables unchanged.',flush=True)
    else: print('Prepared SQL only; database unchanged.',flush=True)


if __name__=='__main__': main()
