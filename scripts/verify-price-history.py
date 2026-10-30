#!/usr/bin/env python3
"""Refresh bounded public source verification; no credentials or paid endpoints."""
import argparse,json,subprocess,datetime as d,pathlib,time,urllib.parse
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("--plain",action="store_true",help="ASCII progress")
args=parser.parse_args()
PROBE="[source]" if args.plain else "🔎"
PASS="[pass]" if args.plain else "✅"
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'fixtures/sources/restart-price-history.json'
start=d.date(2015,7,30); end=d.datetime.now(d.timezone.utc).date()
records=[]; prices={}
while start<end:
 stop=min(start+d.timedelta(days=299),end)
 url='https://api.exchange.coinbase.com/products/ETH-USD/candles?'+urllib.parse.urlencode({'granularity':86400,'start':str(start)+'T00:00:00Z','end':str(stop)+'T00:00:00Z'})
 print(PROBE+' Coinbase',start,stop,flush=True)
 p=subprocess.run(['curl','-sS','--max-time','40','-H','Origin: http://127.0.0.1:4317','-D','/tmp/wallet-price-headers',url],capture_output=True,text=True)
 try: rows=json.loads(p.stdout)
 except ValueError: rows={'error':p.stderr}
 headers={}
 for line in pathlib.Path('/tmp/wallet-price-headers').read_text().splitlines():
  key,sep,val=line.partition(':')
  if key.lower() in ['access-control-allow-origin','access-control-expose-headers','date','retry-after']: headers[key.lower()]=val.strip()
 r={'url':url,'curl_exit':p.returncode,'headers':headers,'count':len(rows) if isinstance(rows,list) else 0}
 if isinstance(rows,list):
  for row in rows:
   day=d.datetime.fromtimestamp(row[0],d.timezone.utc).date()
   if start<=day<stop: prices[str(day)]=str(row[4])
  r['first']=min([x[0] for x in rows],default=None);r['last']=max([x[0] for x in rows],default=None)
 else: r['error']=rows
 records.append(r)
 out.write_text(json.dumps({'retrieved_at':d.datetime.now(d.timezone.utc).isoformat(),'source':'Coinbase Exchange ETH-USD UTC daily close','windows':records,'prices':dict(sorted(prices.items()))},indent=2)+'\n')
 start=stop; time.sleep(.4)
print(PASS+' Daily prices',len(prices),'range',min(prices,default='missing'),max(prices,default='missing'),flush=True)
