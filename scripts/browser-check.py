#!/usr/bin/env python3
"""Run reproducible browser checks with the installed Chrome CLI; server must be running."""
import argparse,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port',type=int,default=4317,help='Selected local server port')
parser.add_argument('--plain',action='store_true',help='ASCII labels')
parser.add_argument('--details',action='store_true',help='Print raw browser diagnostics on failure')
args=parser.parse_args()
print(('[browser]' if args.plain else '🌐')+' Checking controlled browser states; live sources are a separate check',flush=True)
fixture=json.loads((root/'fixtures/sources/restart-small-wallet.json').read_text())
prices=json.loads((root/'fixtures/sources/restart-price-history.json').read_text())
wallets=json.loads((root/'fixtures/public-wallets.json').read_text())
script='const fixture='+json.dumps(fixture)+';\nconst prices='+json.dumps(prices['prices'])+';\nconst wallets='+json.dumps(wallets)+';\n'
script+=(root/'tests/browser-states.js').read_text().replace('http://127.0.0.1:4317',f'http://127.0.0.1:{args.port}')
result=subprocess.run(['chrome-devtools-axi','run'],input=script,text=True,capture_output=True,timeout=180)
if result.returncode:
 print(('[fail]' if args.plain else '⚠️')+' Browser checks failed; use --details for diagnostics.',flush=True)
 if args.details:print(result.stdout+result.stderr)
else:print(result.stdout.strip())
raise SystemExit(result.returncode)
