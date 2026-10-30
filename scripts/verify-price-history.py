#!/usr/bin/env python3
"""Refresh bounded public price evidence atomically; no credentials or paid APIs."""
import argparse
import datetime as dt
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'fixtures/sources/restart-price-history.json'
HEADERS = {'access-control-allow-origin', 'access-control-expose-headers', 'date', 'retry-after'}


def validate_candles(rows, start, stop):
    if not isinstance(rows, list) or len(rows) > 300:
        raise ValueError('Expected at most 300 Coinbase candles.')
    prices = {}
    stamps = []
    for row in rows:
        if not isinstance(row, list) or len(row) != 6 or type(row[0]) is not int or row[0] % 86400:
            raise ValueError('Malformed daily candle fields or UTC bucket.')
        try:
            day = dt.datetime.fromtimestamp(row[0], dt.timezone.utc).date()
            values = [Decimal(str(value)) for value in row[1:]]
        except (ValueError, OverflowError, OSError, InvalidOperation):
            raise ValueError('Malformed daily candle date or numbers.') from None
        if not all(value.is_finite() for value in values):
            raise ValueError('Non-finite daily candle value.')
        low, high, opened, close, volume = values
        if low <= 0 or high < low or not low <= opened <= high or not low <= close <= high or volume < 0:
            raise ValueError('Invalid daily candle price range.')
        stamps.append(row[0])
        if start <= day < stop:
            key, price = str(day), str(close)
            if key in prices and Decimal(prices[key]) != close:
                raise ValueError('Conflicting daily closes for the same UTC day.')
            prices[key] = price
    return prices, stamps


def fetch_window(url, start, stop, args):
    icon = '[source]' if args.plain else '🔎'
    last_error = 'Source unavailable.'
    for attempt in range(3):
        print(f'{icon} Coinbase {start} to {stop}; attempt {attempt+1}/3', flush=True)
        retry_after = 0
        with tempfile.TemporaryDirectory(prefix='wallet-price-probe-') as directory:
            head, body = Path(directory) / 'headers', Path(directory) / 'body'
            result = subprocess.run([
                'curl', '--silent', '--show-error', '--max-time', '40',
                '-H', 'Origin: http://127.0.0.1:4317', '-D', str(head),
                '-o', str(body), '-w', '%{http_code}', url,
            ], capture_output=True, text=True)
            headers = {}
            if head.exists():
                for line in head.read_text().splitlines():
                    key, separator, value = line.partition(':')
                    if separator and key.lower() in HEADERS:
                        headers[key.lower()] = value.strip()
            try:
                retry_after = min(60, max(0, float(headers.get('retry-after', '0'))))
            except ValueError:
                pass
            try:
                if result.returncode != 0:
                    raise ValueError(f'Public request failed (curl exit {result.returncode}).')
                if result.stdout.strip() != '200':
                    raise ValueError(f'Public source returned HTTP {result.stdout.strip() or "unknown"}.')
                rows = json.loads(body.read_text(), parse_float=Decimal)
                prices, stamps = validate_candles(rows, start, stop)
                return prices, {'url': url, 'curl_exit': 0, 'http_status': 200, 'headers': headers,
                                'count': len(rows), 'first': min(stamps, default=None), 'last': max(stamps, default=None)}
            except (ValueError, OSError) as error:
                last_error = str(error)
                if args.details:
                    print(f'{icon} Details: {last_error} {result.stderr[:500]}', flush=True)
        if attempt < 2:
            delay = max(2 ** attempt, retry_after)
            print(f'{icon} Temporary source problem; retry in {delay:g}s. Previous evidence is unchanged.', flush=True)
            time.sleep(delay)
    raise ValueError(f'{start} to {stop}: {last_error} Retry budget exhausted.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plain', action='store_true', help='ASCII progress labels')
    parser.add_argument('--details', action='store_true', help='Include raw request diagnostics on failure')
    args = parser.parse_args()
    source = '[source]' if args.plain else '🔎'
    failure = '[fail]' if args.plain else '⚠️'
    try:
        start, end = dt.date(2015, 7, 30), dt.datetime.now(dt.timezone.utc).date()
        records, prices = [], {}
        while start < end:
            stop = min(start + dt.timedelta(days=299), end)
            url = 'https://api.exchange.coinbase.com/products/ETH-USD/candles?' + urllib.parse.urlencode({
                'granularity': 86400, 'start': str(start) + 'T00:00:00Z', 'end': str(stop) + 'T00:00:00Z'})
            found, record = fetch_window(url, start, stop, args)
            prices.update(found)
            records.append(record)
            start = stop
            time.sleep(.4)
        if not prices:
            raise ValueError('No valid daily prices returned across the complete requested range.')
        evidence = {'retrieved_at': dt.datetime.now(dt.timezone.utc).isoformat(),
                    'source': 'Coinbase Exchange ETH-USD UTC daily close',
                    'windows': records, 'prices': dict(sorted(prices.items()))}
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', dir=OUTPUT.parent, prefix='.price-history-', suffix='.tmp', delete=False) as stream:
                temporary = Path(stream.name)
                json.dump(evidence, stream, indent=2)
                stream.write('\n')
            temporary.replace(OUTPUT)
        finally:
            if temporary is not None and temporary.exists():
                temporary.unlink()
        print(f'{"[pass]" if args.plain else "✅"} Daily prices {len(prices)}; range {min(prices)} to {max(prices)}; all {len(records)} windows verified.', flush=True)
        return 0
    except (ValueError, OSError) as error:
        print(f'{failure} Price refresh failed; previous evidence preserved. {error}', flush=True)
        if args.details:
            print(f'{source} Details: {type(error).__name__}', flush=True)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
