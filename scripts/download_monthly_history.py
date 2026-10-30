"""Download only a selected Kaggle v2 yearly aggregate and station list, not the full dataset."""
import argparse
from io import BytesIO
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]


def download(filename, directory):
    url = 'https://www.kaggle.com/api/v1/datasets/download/oles04/petrol-station-germany/' + quote(filename, safe='') + '?datasetVersionNumber=2'
    with urlopen(Request(url, headers={'User-Agent': 'FuelAnalytics/0.1'}), timeout=60) as response:
        content = response.read(30_000_001)
    if len(content) > 30_000_000:
        raise ValueError('Unexpectedly large archive')
    expected = Path(filename).name
    with ZipFile(BytesIO(content)) as archive:
        entries = [entry for entry in archive.infolist() if entry.filename == expected]
        if len(entries) != 1 or entries[0].file_size > 100_000_000:
            raise ValueError('Unexpected archive contents')
        value = archive.read(entries[0])
    # Exact member read only: never extract untrusted paths or execute source files.
    first_line = value.decode('utf-8-sig').splitlines()[0]
    expected_prefix = 'station_uuid,year,month,diesel,e5,e10' if filename.startswith('aggregated_years/') else 'uuid,name,brand,street,house_number,post_code,city'
    if not first_line.startswith(expected_prefix):
        raise ValueError('Unexpected CSV header')
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / expected
    pending = target.with_suffix('.pending')
    pending.write_bytes(value)
    pending.replace(target)
    print(f'Downloaded {expected}: {len(value):,} bytes (Kaggle version 2)')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--year', type=int, default=2022)
    parser.add_argument('--output', type=Path, default=ROOT / 'data/kaggle')
    args = parser.parse_args()
    if args.year not in range(2014, 2024):
        parser.error('This historical dataset only provides 2014 to 2023 (partial years possible).')
    download(f'aggregated_years/aggregated{args.year}.csv', args.output)
    download('stations.csv', args.output)


if __name__ == '__main__':
    main()
