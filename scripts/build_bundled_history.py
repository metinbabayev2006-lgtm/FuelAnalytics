"""Build credential-free, versioned presentation data from validated local imports.

This does not access Docker, .env or the network. Only historical tables are
exported; user observations, favorites and credentials are never included.
"""
import csv
import gzip
import hashlib
import itertools
import json
from pathlib import Path
from import_tankerkoenig_archive import city_for, CITIES

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'backend/src/main/resources/bundled-history'
TABLES = {
    'incoming_archive_station': 'archive_station', 'archive_import': 'archive_import', 'archive_daily_price': 'archive_daily_price',
    'incoming_historical_station': 'historical_station', 'incoming_monthly_import': 'historical_monthly_import', 'historical_monthly_price': 'historical_monthly_price',
}

def copy_groups(path):
    with path.open(encoding='utf-8', newline='') as stream:
        for line in stream:
            if not line.startswith('COPY '): continue
            table = line.split()[1]
            if table not in TABLES: raise ValueError('Unexpected source table')
            rows = csv.reader(itertools.takewhile(lambda value: value.strip() != '\\.', stream))
            yield TABLES[table], rows

def write_bundle(source, filename, selected=None):
    target=OUTPUT/filename; pending=target.with_suffix('.pending'); counts={}
    with pending.open('wb') as raw, gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0) as zipped:
        for table,rows in copy_groups(source):
            for row in rows:
                if table in ('historical_station','historical_monthly_price') and row[0] not in selected: continue
                if table == 'historical_station': row[2] = selected[row[0]]
                zipped.write((json.dumps([table,row],ensure_ascii=False,separators=(',',':'))+'\n').encode('utf-8'))
                counts[table]=counts.get(table,0)+1
    if len(counts)!=3 or not all(counts.values()): raise ValueError('Incomplete historical bundle')
    pending.replace(target)
    return {'file':filename,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'rows':counts,'bytes':target.stat().st_size}

def main():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    selected={}
    with (ROOT/'data/kaggle/stations.csv').open(encoding='utf-8-sig',newline='') as stream:
        for row in csv.DictReader(stream):
            city=city_for(row)
            if city: selected[row['uuid']]=city
    archive=write_bundle(ROOT/'data/tankerkoenig-archive/2025-10-01_2026-10-01/import.sql','archive.jsonl.gz')
    monthly=write_bundle(ROOT/'data/kaggle/import-monthly-2022.sql','kaggle-2022.jsonl.gz',selected)
    manifest={'format':1,'cities':list(CITIES),'license':'https://creativecommons.org/licenses/by-nc-sa/4.0/',
              'archive':archive,'monthly':monthly}
    (OUTPUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest,ensure_ascii=True,indent=2))

if __name__=='__main__': main()
