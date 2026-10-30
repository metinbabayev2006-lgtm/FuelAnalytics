"""Import official German LPG motor-fuel prices, taxes included; Python standard library only."""
import argparse
import datetime as dt
from decimal import Decimal
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile
import xml.etree.ElementTree as ET

URL = 'https://energy.ec.europa.eu/document/download/906e60ca-8b6a-44e7-8589-652854d2fd3f_en?filename=Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx'
SOURCE = 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}

def extract(path):
    with ZipFile(path) as archive:
        shared = [''.join(node.itertext()) for node in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        sheet = next(s for s in workbook.findall('s:sheets/s:sheet', NS) if s.attrib['name'] == 'Prices with taxes')
        rels = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        target = next(r.attrib['Target'] for r in rels if r.attrib['Id'] == sheet.attrib['{' + NS['r'] + '}id'])
        sheet_path = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        def value(cell):
            node = cell.find('s:v', NS)
            if cell.attrib.get('t') == 'inlineStr':
                return ''.join(cell.find('s:is', NS).itertext())
            if node is None: return None
            return shared[int(node.text)] if cell.attrib.get('t') == 's' else node.text
        rows = []
        with archive.open(sheet_path) as stream:
            for _, row in ET.iterparse(stream, events=('end',)):
                if row.tag != '{' + NS['s'] + '}row': continue
                rows.append({''.join(filter(str.isalpha, c.attrib['r'])): value(c) for c in row.findall('s:c', NS)})
                row.clear()
    matches = [col for col, name in rows[0].items() if name == 'DE_price_with_tax_LPG']
    if len(matches) != 1: raise ValueError('German LPG column missing or ambiguous')
    column = matches[0]
    if rows[2].get(column, '').strip().lower() != '1000 l' or 'LPG motor fuel' not in rows[1].get(column, ''):
        raise ValueError('Unexpected source unit or fuel definition')
    points = {}
    for row in rows[3:]:
        raw = row.get(column)
        if raw in (None, '', 'n.a.', 'N/A', ':'): continue
        # Six decimals retain published precision while removing Excel binary-float noise.
        price = (Decimal(raw) / Decimal(1000)).quantize(Decimal("0.000001"))
        date = (dt.datetime(1899, 12, 30) + dt.timedelta(days=float(row['A']))).date()
        if not Decimal(0) < price < Decimal(20) or date > dt.datetime.now(dt.timezone.utc).date():
            raise ValueError('Invalid price/date in official series')
        if date.isoformat() in points: raise ValueError('Duplicate reference date')
        points[date.isoformat()] = float(price)
    if len(points) < 52: raise ValueError('Source unexpectedly incomplete; previous import preserved')
    return [{'date': date, 'price': price} for date, price in sorted(points.items())]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, help='Existing official XLSX, otherwise download it')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'backend/src/main/resources/data/lpg-de-weekly.json')
    args = parser.parse_args()
    source = args.input
    if source is None:
        import tempfile
        with urlopen(Request(URL, headers={'User-Agent': 'FuelAnalytics-Educational/0.1'}), timeout=45) as response:
            data = response.read(20_000_001)
        if len(data) > 20_000_000: raise ValueError('Unexpectedly large download')
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source.xlsx'; source.write_bytes(data)
            points = extract(source)
    else:
        data = source.read_bytes(); points = extract(source)
    payload = {'country': 'DE', 'fuel': 'lpg', 'unit': 'EUR/l', 'taxesIncluded': True,
               'source': 'European Commission Weekly Oil Bulletin', 'sourceUrl': SOURCE,
               'downloadUrl': URL, 'sha256': hashlib.sha256(data).hexdigest(),
               'importedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'points': points}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    pending = args.output.with_suffix('.pending')
    pending.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    pending.replace(args.output)
    print(f'Imported {len(points)} LPG weekly prices: {points[0]} through {points[-1]}')

if __name__ == '__main__': main()
