#!/usr/bin/env python3
"""Check captured independent receipt evidence; --live refreshes dRPC only."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'fixtures/sources/restart-receipts.json'
RPC = 'https://eth.drpc.org'
ORIGIN = 'http://127.0.0.1:4317'


def request(method, params):
    payload = {'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}
    with tempfile.TemporaryDirectory() as directory:
        headers = Path(directory) / 'headers'
        result = subprocess.run([
            'curl', '--silent', '--show-error', '--max-time', '30',
            '-D', str(headers), '-H', f'Origin: {ORIGIN}',
            '-H', 'Content-Type: application/json', '--data', json.dumps(payload), RPC,
        ], capture_output=True, text=True, check=True)
        kept = {}
        for line in headers.read_text().splitlines():
            name, separator, value = line.partition(':')
            if separator and name.lower() in {'date', 'access-control-allow-origin', 'content-type'}:
                kept[name.lower()] = value.strip()
        response = json.loads(result.stdout)
        assert 'error' not in response, f'RPC rejected {method}: {response.get("error")}'
        assert response.get('result') is not None, f'No result for {method}'
        return {'request': payload, 'headers': kept, 'response': response}


def check(evidence):
    assert evidence['chain']['response']['result'] == '0x1', 'Not Ethereum mainnet'
    kinds = set()
    for sample in evidence['samples']:
        explorer, receipt = sample['blockscout'], sample['rpc']['response']['result']
        assert receipt['transactionHash'].lower() == explorer['hash'].lower()
        assert int(receipt['blockNumber'], 16) == explorer['block_number']
        assert receipt['from'].lower() == explorer['from'].lower()
        assert int(receipt['gasUsed'], 16) == int(explorer['gas_used'])
        assert int(receipt['effectiveGasPrice'], 16) == int(explorer['gas_price'])
        assert int(receipt['status'], 16) == (1 if explorer['status'] == 'ok' else 0)
        fee = int(receipt['gasUsed'], 16) * int(receipt['effectiveGasPrice'], 16)
        assert fee == int(explorer['fee']['value']) == int(sample['fee_wei'])
        kinds.add('legacy' if int(receipt['type'], 16) == 0 else 'dynamic')
        if receipt['status'] == '0x0':
            kinds.add('failed')
    assert {'legacy', 'dynamic', 'failed'} <= kinds, 'Missing required receipt coverage'
    return len(evidence['samples'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true', help='Refresh public RPC evidence, retaining explorer samples')
    parser.add_argument('--plain', action='store_true', help='ASCII progress output')
    parser.add_argument('--details', action='store_true', help='Show raw diagnostics on failure')
    args = parser.parse_args()
    print(('Checking' if args.plain else '🔎 Checking') + ' independent mainnet receipts', flush=True)
    evidence = json.loads(EVIDENCE.read_text())
    if args.live:
        evidence['chain'] = request('eth_chainId', [])
        for index, sample in enumerate(evidence['samples'], 1):
            print(f'{"Receipt" if args.plain else "📡 Receipt"} {index}/{len(evidence["samples"])}', flush=True)
            raw = request('eth_getTransactionReceipt', [sample['blockscout']['hash']])
            receipt = raw['response']['result']
            raw['response']['result'] = {key: receipt[key] for key in [
                'transactionHash', 'blockNumber', 'from', 'gasUsed', 'effectiveGasPrice', 'status', 'type'
            ]}
            sample['rpc'] = raw
        evidence['rpc_verified_at'] = datetime.now(timezone.utc).isoformat()
        check(evidence)
        EVIDENCE.write_text(json.dumps(evidence, indent=2) + '\n')
    count = check(evidence)
    print(f'{"PASS" if args.plain else "✅ PASS"}: chain ID 1; {count} exact receipt/fee comparisons; legacy, EIP-1559 and failed covered')


if __name__ == '__main__':
    try:
        main()
    except (AssertionError, KeyError, ValueError, OSError, subprocess.SubprocessError) as error:
        if '--details' in sys.argv:
            raise
        prefix = 'ERROR' if '--plain' in sys.argv else '❌ ERROR'
        print(f'{prefix}: receipt evidence could not be verified; use --details for diagnostics.', file=sys.stderr)
        sys.exit(1)
