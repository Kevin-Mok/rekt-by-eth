#!/usr/bin/env python3
"""Read-only, bounded Stage 1 public endpoint probes. No credentials accepted."""
import argparse
import datetime as dt
import json
from pathlib import Path
import subprocess
import tempfile
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'http://127.0.0.1:4317'
WALLET = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
SAFE_HEADERS = {'date', 'content-type', 'access-control-allow-origin',
                'access-control-allow-methods', 'access-control-allow-headers',
                'access-control-expose-headers', 'x-ratelimit-limit',
                'x-ratelimit-remaining', 'x-ratelimit-reset', 'retry-after'}

def probe(name, url, payload=None):
    print(f'{ICON} Probing {name} …', flush=True)
    with tempfile.TemporaryDirectory() as tmp:
        body, headers = Path(tmp)/'body', Path(tmp)/'headers'
        cmd = ['curl','--silent','--show-error','--max-time','35',
               '--header',f'Origin: {ORIGIN}', '--dump-header',str(headers),
               '--output',str(body),'--write-out','%{http_code}']
        if payload is not None:
            cmd += ['--header','Content-Type: application/json','--data',json.dumps(payload)]
        p = subprocess.run(cmd+[url], capture_output=True, text=True)
        text = body.read_text(errors='replace') if body.exists() else ''
        try: data = json.loads(text)
        except json.JSONDecodeError: data = {'non_json_sample':text[:1000]}
        selected_headers = {}
        if headers.exists():
            for line in headers.read_text().splitlines():
                key, sep, value = line.partition(':')
                if sep and key.lower() in SAFE_HEADERS: selected_headers[key.lower()] = value.strip()
        record = {'source_url':url, 'retrieved_at':dt.datetime.now(dt.timezone.utc).isoformat(),
                  'origin':ORIGIN,'curl_exit':p.returncode,'http_status':p.stdout,
                  'headers':selected_headers,'response':data,'diagnostic':p.stderr[:500]}
        # Transaction-list projection omits unrelated explorer metadata and inline artwork.
        if isinstance(data,dict) and 'items' in data:
            keys = ['hash','block_number','timestamp','type','status','result','gas_used','gas_price','fee']
            record['response'] = {'items':[{**{k:t.get(k) for k in keys},
                'from':t.get('from',{}).get('hash'), 'to':(t.get('to') or {}).get('hash')}
                for t in data['items']], 'next_page_params':data.get('next_page_params')}
            record['projection'] = 'Receipt-relevant fields only; original list metadata omitted.'
        out = ROOT/'fixtures'/'sources'/f'{name}.json'
        out.parent.mkdir(parents=True,exist_ok=True)
        out.write_text(json.dumps(record,indent=2)+'\n')
        print(f'{ICON} {name}: HTTP {p.stdout or "none"}; curl exit {p.returncode}; evidence {out.relative_to(ROOT)}', flush=True)
        return record

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('scope',choices=['paging','coingecko','rpc'])
parser.add_argument('--plain',action='store_true',help='ASCII progress output')
args=parser.parse_args()
ICON = '[source]' if args.plain else '🔎'
if args.scope == 'coingecko':
    r=probe('coingecko-2015','https://api.coingecko.com/api/v3/coins/ethereum/history?date=08-08-2015&localization=false')
    prices=r['response'].get('market_data',{}).get('current_price',{})
    if r['http_status']!='200' or not all(isinstance(prices.get(c),(int,float)) and prices[c]>0 for c in ('usd','cad')):
        print(f'{ICON} PRICE-01 attempt 2 FAILED: keyless historical USD/CAD quote unavailable. Stop implementation; retain evidence.',flush=True)
        raise SystemExit(2)
    print(f'{ICON} Sample quote received; full daily range and browser access remain UNVERIFIED.',flush=True)
elif args.scope == 'paging':
    base=f'https://eth.blockscout.com/api/v2/addresses/{WALLET}/transactions'
    a=probe('blockscout-page1',base+'?filter=from')
    cursor=a['response'].get('next_page_params')
    if not cursor: raise SystemExit('No continuation cursor; paging unverified')
    b=probe('blockscout-page2',base+'?'+urllib.parse.urlencode(cursor))
    first={t['hash'] for t in a['response'].get('items',[])}
    second={t['hash'] for t in b['response'].get('items',[])}
    print(f'{ICON} Paging: {len(first)} + {len(second)} unique hashes; overlap {len(first&second)}. Limited sample, NOT complete wallet.',flush=True)
elif args.scope == 'rpc':
    probe('publicnode-chain', 'https://ethereum-rpc.publicnode.com',{'jsonrpc':'2.0','id':1,'method':'eth_chainId','params':[]})
    p=ROOT/'fixtures/sources/blockscout-page1.json'
    if p.exists():
        h=json.loads(p.read_text())['response']['items'][0]['hash']
        probe('publicnode-receipt','https://ethereum-rpc.publicnode.com',{'jsonrpc':'2.0','id':2,'method':'eth_getTransactionReceipt','params':[h]})
