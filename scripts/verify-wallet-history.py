#!/usr/bin/env python3
"""Validate saved paging evidence; --live resumes from its last atomic cursor."""
import argparse
import datetime as dt
import json
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
FILE = ROOT / 'fixtures/sources/restart-wallet-history.json'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--live', action='store_true', help='Resume keyless public history until terminal cursor')
parser.add_argument('--plain', action='store_true', help='ASCII labels')
parser.add_argument('--details', action='store_true', help='Include raw failure diagnostics')
args = parser.parse_args()
icon = '[source]' if args.plain else '🔎'
data = json.loads(FILE.read_text())
wallet = data['wallet']
rows = {row['hash']: row for row in data['items']}
cursor = data['next_page_params']
seen = set()
try:
    while args.live and cursor:
        key = json.dumps(cursor, sort_keys=True)
        if key in seen:
            raise ValueError('Repeated cursor; saved history remains partial')
        seen.add(key)
        url = f'https://eth.blockscout.com/api/v2/addresses/{wallet}/transactions?' + urllib.parse.urlencode({**cursor, 'filter': 'from'})
        body = None
        for attempt in range(5):
            print(f'{icon} Page {len(data["pages"])+1}; {len(rows)} transactions retained; attempt {attempt+1}/5', flush=True)
            with tempfile.TemporaryDirectory() as directory:
                head, content = Path(directory)/'headers', Path(directory)/'body'
                result = subprocess.run(['curl', '-sS', '--max-time', '35', '-H', 'Origin: http://127.0.0.1:4317', '-D', str(head), '-o', str(content), '-w', '%{http_code}', url], capture_output=True, text=True)
                try:
                    candidate = json.loads(content.read_text())
                except (OSError, ValueError):
                    candidate = None
                if result.returncode == 0 and result.stdout == '200' and isinstance(candidate, dict) and isinstance(candidate.get('items'), list):
                    body = candidate
                    break
                if args.details:
                    print(f'{icon} HTTP {result.stdout}; {result.stderr[:200]}', flush=True)
            delay = min(2 ** (attempt + 1), 30)
            print(f'{icon} Temporary source failure; retry in {delay}s. Cursor preserved.', flush=True)
            time.sleep(delay)
        if body is None:
            raise ValueError('Source still unavailable; resume later with --live')
        for row in body['items']:
            projected = {k: row.get(k) for k in ['hash', 'block_number', 'timestamp', 'type', 'status', 'gas_used', 'gas_price']}
            projected['from'] = row['from']['hash']
            rows[row['hash']] = projected
        cursor = body.get('next_page_params')
        data.update(items=list(rows.values()), next_page_params=cursor, complete=cursor is None, retrieved_at=dt.datetime.now(dt.timezone.utc).isoformat())
        data['pages'].append({'url': url, 'count': len(body['items'])})
        temporary = FILE.with_suffix('.tmp')
        temporary.write_text(json.dumps(data, separators=(',', ':'))+'\n')
        temporary.replace(FILE)
        time.sleep(1)
    assert len(rows) == len(data['items'])
    assert all(row['from'].lower() == wallet.lower() for row in rows.values())
    assert data['complete'] == (cursor is None)
    print(f'{icon} PASS: {len(rows)} unique sent rows / {len(data["pages"])} pages; {"complete" if cursor is None else "PARTIAL, cursor retained"}')
except Exception as error:
    print(f'{icon} Check incomplete: {error}. Saved evidence was preserved.')
    raise SystemExit(1)
